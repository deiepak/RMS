const db = require('../../config/db');

class LoggingService {
  /**
   * Log CCTV access events to database
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.eventType - 'view_page', 'view_camera', 'stream_failure', 'unauthorized_access'
   * @param {string} [params.cameraId]
   * @param {string} [params.description]
   * @param {string} [params.ipAddress]
   */
  async logEvent({ userId, eventType, cameraId = null, description = null, ipAddress = null }) {
    try {
      await db('cctv_access_logs').insert({
        user_id: userId,
        event_type: eventType,
        camera_id: cameraId,
        description: description,
        ip_address: ipAddress,
        created_at: new Date()
      });
    } catch (error) {
      console.error('Failed to log CCTV event:', error);
    }
  }
}

module.exports = new LoggingService();
