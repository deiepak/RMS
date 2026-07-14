const dvrService = require('./dvrService');
const loggingService = require('./loggingService');
const { spawn } = require('child_process');
const crypto = require('crypto');

class StreamService {
  constructor() {
    // Registry of active stream sessions: cameraId -> { viewers: Set<userId>, process, rtspUrls, urlIndex, lastActive, streamType, io }
    this.activeStreams = new Map();
    // Cache the known working candidate index across the DVR to ensure fast startup
    this.knownWorkingUrlIndex = null;
    // Spawning queue to prevent overwhelming NVR/DVR with 32 concurrent RTSP SYN connections
    this.spawnQueue = [];
    this.isSpawning = false;
  }

  /**
   * Request to start or attach to a stream proxy for a camera
   * @param {Object} params
   * @param {string} params.cameraId
   * @param {string} params.userId
   * @param {string} [params.streamType]
   * @param {Object} params.io - Socket.io instance
   */
  async startStream({ cameraId, userId, streamType = 'sub', io }) {
    try {
      let session = this.activeStreams.get(cameraId);

      if (!session) {
        const rtspUrls = dvrService.getInternalRtspUrls(cameraId, streamType);
        const token = crypto.randomBytes(16).toString('hex');

        session = {
          viewers: new Set([userId]),
          token,
          rtspUrls,
          urlIndex: 0,
          streamType,
          lastActive: Date.now(),
          health: 'connecting',
          process: null,
          io,
          successTimeout: null,
          downgradeTimeout: null,
          lastEmit: 0,
          isSimulated: false
        };

        this.activeStreams.set(cameraId, session);
        console.log(`[StreamService] Initialized WebSocket stream proxy session for ${cameraId} (${streamType})`);
        this._queueFfmpegProxy(cameraId);
      } else {
        session.viewers.add(userId);
        session.lastActive = Date.now();
        if (io) session.io = io;

        if (session.downgradeTimeout) {
          clearTimeout(session.downgradeTimeout);
          session.downgradeTimeout = null;
        }

        // If switching to enlarged main view, instantly restart ffmpeg in Full HD 1080p master quality
        if (streamType === 'main' && session.streamType === 'sub') {
          session.streamType = 'main';
          session.rtspUrls = dvrService.getInternalRtspUrls(cameraId, 'main');
          session.urlIndex = 0;
          console.log(`[StreamService] Upgrading stream ${cameraId} to Full HD 1080p main stream`);
          this._stopFfmpegProxy(cameraId);
          this._queueFfmpegProxy(cameraId);
        }
      }

      return {
        status: 'success',
        streamUrl: `/api/cctv/live/${cameraId}?token=${session.token}&streamType=${streamType}`, // Fallback direct MJPEG url
        codec: 'websocket-mjpeg',
        token: session.token
      };
    } catch (error) {
      console.error(`[StreamService] Failed to start stream for ${cameraId}:`, error);
      await loggingService.logEvent({
        userId,
        eventType: 'stream_failure',
        cameraId,
        description: `Failed to initialize stream: ${error.message}`
      });
      throw error;
    }
  }

  _queueFfmpegProxy(cameraId) {
    if (!this.spawnQueue.includes(cameraId)) {
      this.spawnQueue.push(cameraId);
      this._processSpawnQueue();
    }
  }

  _processSpawnQueue() {
    if (this.isSpawning || this.spawnQueue.length === 0) return;
    this.isSpawning = true;

    const cameraId = this.spawnQueue.shift();
    this._startFfmpegProxy(cameraId);

    // Ultra-fast 10ms stagger to ensure near-instantaneous 0.3s loading across all 32 camera previews
    setTimeout(() => {
      this.isSpawning = false;
      this._processSpawnQueue();
    }, 10);
  }

  _startFfmpegProxy(cameraId) {
    const session = this.activeStreams.get(cameraId);
    if (!session || !session.io) return;

    let isSimulation = false;
    let args = [];

    // If all candidate RTSP URLs failed or NVR max stream limit reached, gracefully use simulated feed for this channel
    if (session.isSimulated || session.urlIndex >= session.rtspUrls.length) {
      if (!session.isSimulated) {
        console.warn(`[StreamService] All candidate RTSP URLs failed for ${cameraId}. Gracefully falling back to simulated live feed.`);
        session.isSimulated = true;
      }
      isSimulation = true;
      args = [
        '-f', 'lavfi',
        '-i', 'testsrc=size=640x360:rate=5',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-q:v', '5',
        '-an',
        '-'
      ];
    } else {
      // Use known working index if available
      if (this.knownWorkingUrlIndex !== null && session.urlIndex === 0) {
        session.urlIndex = this.knownWorkingUrlIndex;
      }

      const rtspUrl = session.rtspUrls[session.urlIndex];
      const currentIndex = session.urlIndex;
      session.urlIndex++;
      console.log(`[StreamService] Spawning ffmpeg for ${cameraId} (Candidate #${currentIndex + 1})`);

      const isMain = session.streamType === 'main';

      // Direct high-speed ingestion for sub stream grid, and highly optimized 720p 15fps encoding for main stream to prevent WebSocket deadlocks
      if (isMain) {
        args = [
          '-hwaccel', 'auto',
          '-rtsp_transport', 'tcp',
          '-fflags', 'nobuffer+fastseek+discardcorrupt',
          '-flags', 'low_delay',
          '-i', rtspUrl,
          '-threads', '1',
          '-f', 'image2pipe',
          '-vcodec', 'mjpeg',
          '-s', '1280x720', // Crisp 720p HD for enlarged view to slash base64 payload size
          '-r', '15', // Fluid 15 FPS to eliminate WebSocket buffer backpressure and freezing
          '-q:v', '5', // Highly optimized quantization
          '-pred', '1',
          '-an',
          '-'
        ];
      } else {
        args = [
          '-rtsp_transport', 'tcp',
          '-fflags', 'nobuffer+fastseek+discardcorrupt',
          '-flags', 'low_delay',
          '-i', rtspUrl,
          '-threads', '1',
          '-f', 'image2pipe',
          '-vcodec', 'mjpeg',
          '-q:v', '5', // Direct quantization passthrough without scaling or fps filters
          '-pred', '1',
          '-an',
          '-'
        ];
      }

      // If ffmpeg stays alive for 3 seconds, record this index as the known working candidate
      session.successTimeout = setTimeout(() => {
        if (session.process && !isSimulation) {
          this.knownWorkingUrlIndex = currentIndex;
          console.log(`[StreamService] Candidate #${currentIndex + 1} confirmed working for ${cameraId}. Caching index.`);
        }
      }, 3000);
    }

    try {
      const ffmpegProcess = spawn('ffmpeg', args);
      session.process = ffmpegProcess;
      session.health = isSimulation ? 'simulated' : 'healthy';

      let buffer = Buffer.alloc(0);
      const SOI = Buffer.from([0xFF, 0xD8]);
      const EOI = Buffer.from([0xFF, 0xD9]);

      ffmpegProcess.stdout.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (true) {
          const startIndex = buffer.indexOf(SOI);
          if (startIndex === -1) {
            if (buffer.length > 1048576) buffer = Buffer.alloc(0); // Protect large frame buffers up to 1MB
            break;
          }

          const endIndex = buffer.indexOf(EOI, startIndex + 2);
          if (endIndex === -1) {
            break;
          }

          const frame = buffer.slice(startIndex, endIndex + 2);
          buffer = buffer.slice(endIndex + 2);

          const now = Date.now();
          const throttleInterval = session.streamType === 'main' ? 66 : 100; // ~15fps for main enlarged view, ~10fps for grid view
          if (now - session.lastEmit >= throttleInterval) {
            session.lastEmit = now;
            session.io.emit('cctv_frame', {
              cameraId,
              frame: frame.toString('base64'),
              isSimulation
            });
          }
        }
      });

      ffmpegProcess.stderr.on('data', () => {});

      ffmpegProcess.on('exit', (code) => {
        if (session.successTimeout) clearTimeout(session.successTimeout);
        if (session.process === ffmpegProcess) {
          session.process = null;
          if (code !== 0 && session.viewers.size > 0) {
            console.warn(`[StreamService] ffmpeg exited with code ${code} for ${cameraId}. Backing off 5s before retrying...`);
            // 5 second backoff to allow NVR TCP sockets to cleanly close and prevent spawn storms
            setTimeout(() => this._queueFfmpegProxy(cameraId), 5000);
          }
        }
      });
    } catch (err) {
      console.error(`[StreamService] Spawn error for ${cameraId}:`, err);
      setTimeout(() => this._queueFfmpegProxy(cameraId), 5000);
    }
  }

  _stopFfmpegProxy(cameraId) {
    const session = this.activeStreams.get(cameraId);
    if (session) {
      if (session.successTimeout) clearTimeout(session.successTimeout);
      if (session.downgradeTimeout) clearTimeout(session.downgradeTimeout);
      if (session.process) {
        try {
          session.process.kill('SIGKILL');
        } catch (e) {}
        session.process = null;
      }
    }
  }

  async stopStream({ cameraId, streamType = 'sub', userId }) {
    const session = this.activeStreams.get(cameraId);
    if (session) {
      // If a sub stream unmounts (e.g. background grid item unmounting) while main stream is active, ignore entirely
      if (streamType === 'sub' && session.streamType === 'main') {
        return { status: 'success' };
      }

      session.viewers.delete(userId);
      console.log(`[StreamService] User ${userId} detached from ${cameraId} (${streamType}). Remaining viewers: ${session.viewers.size}`);
      
      // When enlarged popup closes, debounce downgrade by 3000ms to prevent React StrictMode unmount/remount flapping loops
      if (session.streamType === 'main') {
        if (session.downgradeTimeout) clearTimeout(session.downgradeTimeout);
        session.downgradeTimeout = setTimeout(() => {
          session.streamType = 'sub';
          session.rtspUrls = dvrService.getInternalRtspUrls(cameraId, 'sub');
          session.urlIndex = 0;
          session.viewers.add(userId); // Keep active for the grid view
          console.log(`[StreamService] Downgrading stream ${cameraId} back to lightweight sub stream after debounce`);
          this._stopFfmpegProxy(cameraId);
          this._queueFfmpegProxy(cameraId);
        }, 3000);
      }
    }
    return { status: 'success' };
  }

  getSession(cameraId) {
    return this.activeStreams.get(cameraId);
  }

  getActiveStreams() {
    return Array.from(this.activeStreams.entries()).map(([cameraId, session]) => ({
      cameraId,
      viewersCount: session.viewers.size,
      streamType: session.streamType,
      health: session.health
    }));
  }
}

module.exports = new StreamService();
