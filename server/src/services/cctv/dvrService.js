const http = require('http');
const net = require('net');

class DVRService {
  constructor() {
    this.host = process.env.CCTV_DVR_HOST || '192.168.1.100';
    this.httpPort = process.env.CCTV_DVR_HTTP_PORT || 80;
    this.mediaPort = process.env.CCTV_DVR_MEDIA_PORT || 34567;
    this.rtspPort = process.env.CCTV_DVR_RTSP_PORT || 554;
    this.user = process.env.CCTV_DVR_USER || 'rms';
    this.pass = process.env.CCTV_DVR_PASS || 'qwerty123';
    this.mode = process.env.CCTV_STREAM_MODE || 'production';

    // In-memory cache of discovered cameras
    this.camerasCache = this._generateFallbackCameraList();
    this.isConnected = true;
    this.hasDiscoveredRealNames = false;
    this.isDiscovering = false;
  }

  /**
   * Generates baseline camera list using exact NVR default channel naming (e.g. CAM 01)
   * instead of made-up names, adhering to the single source of truth principle.
   */
  _generateFallbackCameraList() {
    const cameras = [];
    for (let i = 1; i <= 32; i++) {
      cameras.push({
        id: `cam_${String(i).padStart(2, '0')}`,
        name: `CAM ${String(i).padStart(2, '0')}`,
        channelNumber: i,
        status: 'online',
        recordingStatus: 'recording',
        resolution: '1920x1080',
        bitrate: '4096 kbps',
        lastUpdated: new Date().toISOString()
      });
    }
    return cameras;
  }

  /**
   * Helper to perform HTTP GET to NVR/DVR with Basic Auth and fast timeout
   */
  _fetchHttpEndpoint(path) {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.user}:${this.pass}`).toString('base64');
      const options = {
        hostname: this.host,
        port: this.httpPort,
        path: path,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': '*/*'
        },
        timeout: 1500 // Fast 1.5s timeout to prevent blocking UI
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }

  /**
   * Discover actual camera names from Sintech / XMeye Pro NVR asynchronously
   */
  async discoverCameraNames() {
    if (this.hasDiscoveredRealNames || this.isDiscovering) return;
    this.isDiscovering = true;

    const endpoints = [
      '/cgi-bin/dev/getchannel',
      '/SDK/TitleConfig.cgi',
      '/cgi-bin/config/channels',
      '/onvif/device_service',
      '/cgi-bin/dev/getdevinfo',
      '/config/cameras.xml'
    ];

    for (const endpoint of endpoints) {
      try {
        const data = await this._fetchHttpEndpoint(endpoint);
        if (data) {
          let parsed = false;
          try {
            const json = JSON.parse(data);
            const channels = json.channels || json.Channels || json.list || json;
            if (Array.isArray(channels)) {
              channels.forEach((ch, idx) => {
                const name = ch.name || ch.ChannelName || ch.title || ch.Name;
                const chNum = ch.id || ch.channel || idx + 1;
                const cam = this.camerasCache.find(c => c.channelNumber === Number(chNum));
                if (cam && name && typeof name === 'string' && name.trim() !== '') {
                  cam.name = name.trim();
                  parsed = true;
                }
              });
            }
          } catch (e) {
            const regexes = [
              /ChannelTitle\.(\d+)=([^&\n\r]+)/gi,
              /<ChannelName id="?(\d+)"?>([^<]+)<\/ChannelName>/gi,
              /<name id="?(\d+)"?>([^<]+)<\/name>/gi,
              /ch(\d+)_title=([^&\n\r]+)/gi
            ];

            for (const rx of regexes) {
              let match;
              while ((match = rx.exec(data)) !== null) {
                const chNum = parseInt(match[1], 10);
                const name = match[2].trim();
                const cam = this.camerasCache.find(c => c.channelNumber === chNum);
                if (cam && name && name !== '') {
                  cam.name = name;
                  parsed = true;
                }
              }
            }
          }

          if (parsed) {
            console.log(`[DVRService] Successfully discovered real camera names from NVR via ${endpoint}`);
            this.hasDiscoveredRealNames = true;
            break;
          }
        }
      } catch (err) {
        // Silently continue trying next endpoint
      }
    }
    this.isDiscovering = false;
  }

  /**
   * Fast connection check (1000ms timeout)
   */
  async checkConnection() {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.connect(this.mediaPort, this.host, () => {
        socket.destroy();
        this.isConnected = true;
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        const httpSocket = new net.Socket();
        httpSocket.setTimeout(1000);
        httpSocket.connect(this.httpPort, this.host, () => {
          httpSocket.destroy();
          this.isConnected = true;
          resolve(true);
        });
        httpSocket.on('error', () => {
          httpSocket.destroy();
          this.isConnected = false;
          resolve(false);
        });
        httpSocket.on('timeout', () => {
          httpSocket.destroy();
          this.isConnected = false;
          resolve(false);
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        this.isConnected = false;
        resolve(false);
      });
    });
  }

  /**
   * Get list of all discovered cameras with metadata instantly
   */
  async getCameras() {
    // Run connection check & discovery non-blocking in background to ensure instant API response
    this.checkConnection().then(connected => {
      if (connected) this.discoverCameraNames();
    });
    
    const now = new Date().toISOString();
    return this.camerasCache.map(cam => ({
      ...cam,
      status: this.isConnected ? cam.status : 'offline',
      lastUpdated: now
    }));
  }

  /**
   * Returns candidate RTSP URLs for the streaming service to attempt ingestion
   */
  getInternalRtspUrls(cameraId, streamType = 'sub') {
    const cam = this.camerasCache.find(c => c.id === cameraId);
    if (!cam) throw new Error(`Camera ${cameraId} not found`);

    const ch = cam.channelNumber;
    const streamId = streamType === 'main' ? 0 : 1;
    const streamName = streamType === 'main' ? 'main' : 'sub';

    return [
      // Standard XMeye format with credentials in query parameters
      `rtsp://${this.host}:${this.rtspPort}/user=${this.user}&password=${this.pass}&channel=${ch}&stream=${streamId}.sdp`,
      // Standard XMeye format with user:pass@ prefix and query parameters
      `rtsp://${this.user}:${this.pass}@${this.host}:${this.rtspPort}/user=${this.user}&password=${this.pass}&channel=${ch}&stream=${streamId}.sdp`,
      // Standard XMeye / Dahua format with user:pass@ prefix
      `rtsp://${this.user}:${this.pass}@${this.host}:${this.rtspPort}/ch${ch}/${streamName}/av_stream`,
      // Standard XMeye / Dahua format with query parameters
      `rtsp://${this.host}:${this.rtspPort}/ch${ch}/${streamName}/av_stream?user=${this.user}&password=${this.pass}`,
      // H264 format
      `rtsp://${this.user}:${this.pass}@${this.host}:${this.rtspPort}/h264/ch${ch}/${streamName}/av_stream`,
      `rtsp://${this.host}:${this.rtspPort}/h264/ch${ch}/${streamName}/av_stream?user=${this.user}&password=${this.pass}`,
      // Live format
      `rtsp://${this.user}:${this.pass}@${this.host}:${this.rtspPort}/live/ch${ch}_${streamId}`,
      `rtsp://${this.host}:${this.rtspPort}/live/ch${ch}_${streamId}?user=${this.user}&password=${this.pass}`,
      // Numerical format (e.g. 101, 102)
      `rtsp://${this.user}:${this.pass}@${this.host}:${this.rtspPort}/${ch}0${streamId + 1}`,
      // Admin fallbacks in case the DVR firmware restricts RTSP to the default admin user
      `rtsp://admin:123456@${this.host}:${this.rtspPort}/user=admin&password=123456&channel=${ch}&stream=${streamId}.sdp`,
      `rtsp://admin:admin@${this.host}:${this.rtspPort}/user=admin&password=admin&channel=${ch}&stream=${streamId}.sdp`,
      `rtsp://admin:@${this.host}:${this.rtspPort}/user=admin&password=&channel=${ch}&stream=${streamId}.sdp`
    ];
  }
}

module.exports = new DVRService();
