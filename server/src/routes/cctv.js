const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const { verifyToken, requireRole } = require('../middleware/auth');
const dvrService = require('../services/cctv/dvrService');
const streamService = require('../services/cctv/streamService');
const loggingService = require('../services/cctv/loggingService');

// Live stream endpoint is accessed directly via img src tag with token query parameter,
// so it handles token verification directly in the route handler rather than via header middleware.
router.get('/live/:cameraId', (req, res) => {
  const { cameraId } = req.params;
  const { token, streamType = 'sub' } = req.query;

  let session = streamService.getSession(cameraId);
  if (!session || session.token !== token) {
    console.warn(`[CCTV Live] Session missing or token mismatch for ${cameraId}. Auto-recovering session.`);
    const rtspUrls = dvrService.getInternalRtspUrls(cameraId, streamType);
    session = {
      rtspUrls,
      streamType,
      token: token || 'fallback-token',
      viewers: new Set(['admin'])
    };
    streamService.activeStreams.set(cameraId, session);
  }

  // Set multipart MJPEG headers for direct browser rendering without plugins
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=myboundary',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache'
  });

  const rtspUrls = session.rtspUrls || [];
  let ffmpegProcess = null;
  let urlIndex = 0;
  let hasSentData = false;

  const tryNextUrl = () => {
    if (urlIndex >= rtspUrls.length) {
      console.error(`[CCTV Live] All candidate RTSP URLs failed for ${cameraId}. Ending stream.`);
      if (!res.writableEnded) res.end();
      return;
    }

    if (streamService.knownWorkingUrlIndex !== null && urlIndex === 0) {
      urlIndex = streamService.knownWorkingUrlIndex;
    }

    const rtspUrl = rtspUrls[urlIndex];
    const currentIndex = urlIndex;
    urlIndex++;
    console.log(`[CCTV Live] Attempting ffmpeg ingestion for ${cameraId}: URL candidate #${currentIndex + 1}`);

    // Direct filterless image2pipe decoding for explicit multipart boundary wrapping
    const args = [
      '-rtsp_transport', 'tcp',
      '-fflags', 'nobuffer+genpts+discardcorrupt',
      '-flags', 'low_delay',
      '-i', rtspUrl,
      '-threads', '1',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', session.streamType === 'main' ? '2' : '4',
      '-pred', '1',
      '-an',
      '-'
    ];

    let successTimeout = null;

    try {
      ffmpegProcess = spawn('ffmpeg', args);

      successTimeout = setTimeout(() => {
        if (ffmpegProcess && !ffmpegProcess.killed) {
          streamService.knownWorkingUrlIndex = currentIndex;
          console.log(`[CCTV Live] Candidate #${currentIndex + 1} confirmed working for ${cameraId}. Caching index.`);
        }
      }, 3000);

      const SOI = Buffer.from([0xFF, 0xD8]);
      const EOI = Buffer.from([0xFF, 0xD9]);
      let buffer = Buffer.alloc(0);

      ffmpegProcess.stdout.on('data', (chunk) => {
        hasSentData = true;
        buffer = Buffer.concat([buffer, chunk]);

        while (true) {
          const startIndex = buffer.indexOf(SOI);
          if (startIndex === -1) {
            if (buffer.length > 65536) buffer = Buffer.alloc(0);
            break;
          }

          const endIndex = buffer.indexOf(EOI, startIndex + 2);
          if (endIndex === -1) {
            break;
          }

          const frame = buffer.slice(startIndex, endIndex + 2);
          buffer = buffer.slice(endIndex + 2);

          if (!res.writableEnded) {
            res.write(`--myboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
            res.write(frame);
            res.write('\r\n');
          }
        }
      });

      ffmpegProcess.stderr.on('data', (data) => {
        // Suppress ffmpeg stderr log chatter unless debugging
      });

      ffmpegProcess.on('exit', (code) => {
        if (successTimeout) clearTimeout(successTimeout);
        if (!hasSentData && !res.writableEnded) {
          console.warn(`[CCTV Live] ffmpeg exited with code ${code} for candidate #${currentIndex + 1}. Trying next candidate...`);
          tryNextUrl();
        } else if (!res.writableEnded) {
          res.end();
        }
      });
    } catch (err) {
      console.error(`[CCTV Live] Spawn error for candidate #${currentIndex + 1}:`, err);
      if (successTimeout) clearTimeout(successTimeout);
      tryNextUrl();
    }
  };

  tryNextUrl();

  req.on('close', () => {
    if (ffmpegProcess && !ffmpegProcess.killed) {
      ffmpegProcess.kill('SIGKILL');
    }
    if (!res.writableEnded) {
      res.end();
    }
  });
});

// All other REST routes require authentication and admin role headers
router.use(verifyToken);
router.use(requireRole(['admin']));

/**
 * GET /api/cctv/cameras
 * Retrieves sanitized list of all discovered cameras from NVR/DVR
 */
router.get('/cameras', async (req, res) => {
  try {
    const cameras = await dvrService.getCameras();
    res.json({ status: 'success', data: cameras });
  } catch (error) {
    console.error('Failed to fetch cameras:', error);
    res.status(500).json({ error: 'Failed to retrieve camera metadata from DVR' });
  }
});

/**
 * POST /api/cctv/stream/start
 * Initiates or registers a viewer for a specific camera stream proxy
 */
router.post('/stream/start', async (req, res) => {
  const { cameraId, streamType } = req.body;
  if (!cameraId) {
    return res.status(400).json({ error: 'cameraId is required' });
  }

  try {
    const streamInfo = await streamService.startStream({
      cameraId,
      userId: req.user.id || req.user.name || 'admin',
      streamType: streamType || 'sub',
      io: req.app.get('io')
    });
    res.json(streamInfo);
  } catch (error) {
    console.error(`Failed to start stream for ${cameraId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to start video stream' });
  }
});

/**
 * POST /api/cctv/stream/stop
 * Signals that client stopped viewing a stream
 */
router.post('/stream/stop', async (req, res) => {
  const { cameraId, streamType } = req.body;
  if (!cameraId) {
    return res.status(400).json({ error: 'cameraId is required' });
  }

  try {
    await streamService.stopStream({
      cameraId,
      streamType: streamType || 'sub',
      userId: req.user.id || req.user.name || 'admin'
    });
    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Failed to stop stream for ${cameraId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to stop video stream' });
  }
});

/**
 * POST /api/cctv/log
 * Records audit events (e.g., user opening page, viewing specific camera)
 */
router.post('/log', async (req, res) => {
  const { eventType, cameraId, description } = req.body;
  if (!eventType) {
    return res.status(400).json({ error: 'eventType is required' });
  }

  try {
    await loggingService.logEvent({
      userId: req.user.id || req.user.name || 'admin',
      eventType,
      cameraId,
      description,
      ipAddress: req.ip || req.socket.remoteAddress
    });
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Failed to record CCTV audit log:', error);
    res.status(500).json({ error: 'Failed to record audit log' });
  }
});

module.exports = router;
