import { io } from 'socket.io-client';

const socket = io(window.location.origin, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('[Socket] Connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] Disconnected:', reason);
});

socket.on('connect_error', (err) => {
  console.error('[Socket] Connection error:', err.message);
});

export const subscribeToEvent = (event, callback) => {
  socket.on(event, callback);
};

export const unsubscribeFromEvent = (event, callback) => {
  socket.off(event, callback);
};

export { socket };
