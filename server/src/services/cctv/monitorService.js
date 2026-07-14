const dvrService = require('./dvrService');
const streamService = require('./streamService');
const loggingService = require('./loggingService');

class MonitorService {
  constructor() {
    this.intervalId = null;
    this.checkIntervalMs = 15000; // Check health every 15 seconds
    this.reconnectAttempts = 0;
  }

  /**
   * Start the background status monitoring heartbeat
   */
  start() {
    if (this.intervalId) return;
    console.log('[MonitorService] Starting CCTV status monitoring service...');
    this.intervalId = setInterval(() => this.checkHealth(), this.checkIntervalMs);
  }

  /**
   * Stop the monitoring service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MonitorService] Stopped CCTV status monitoring service.');
    }
  }

  /**
   * Perform periodic health checks on DVR connectivity and active stream proxies
   */
  async checkHealth() {
    try {
      const isConnected = await dvrService.checkConnection();

      if (!isConnected) {
        this.reconnectAttempts++;
        console.warn(`[MonitorService] DVR connection lost. Attempting auto-reconnect (Attempt ${this.reconnectAttempts})...`);
        
        await loggingService.logEvent({
          userId: 'system',
          eventType: 'stream_failure',
          description: `DVR connection unreachable. Reconnect attempt ${this.reconnectAttempts}`
        });

        // Exponential backoff or max attempts logic could be tied here
      } else {
        if (this.reconnectAttempts > 0) {
          console.log('[MonitorService] DVR connection re-established successfully.');
          this.reconnectAttempts = 0;
        }
      }

      // Check health of active stream sessions
      const activeStreams = streamService.getActiveStreams();
      for (const stream of activeStreams) {
        if (stream.health !== 'healthy') {
          await loggingService.logEvent({
            userId: 'system',
            eventType: 'stream_failure',
            cameraId: stream.cameraId,
            description: `Unhealthy stream detected for camera ${stream.cameraId}`
          });
        }
      }
    } catch (error) {
      console.error('[MonitorService] Error during health check:', error);
    }
  }
}

module.exports = new MonitorService();
