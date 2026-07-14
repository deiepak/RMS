import { api } from './client';

export const cctvApi = {
  /**
   * Get list of all discovered cameras from DVR/NVR
   */
  getCameras: async () => {
    const response = await api.get('/cctv/cameras');
    return response.data;
  },

  /**
   * Request to start or attach to a stream proxy
   */
  startStream: async ({ cameraId, streamType = 'sub' }) => {
    const response = await api.post('/cctv/stream/start', { cameraId, streamType });
    return response.data;
  },

  /**
   * Request to stop or detach from a stream proxy
   */
  stopStream: async ({ cameraId }) => {
    const response = await api.post('/cctv/stream/stop', { cameraId });
    return response.data;
  },

  /**
   * Record audit log event (e.g. view page, view camera)
   */
  logEvent: async ({ eventType, cameraId = null, description = null }) => {
    const response = await api.post('/cctv/log', { eventType, cameraId, description });
    return response.data;
  }
};
