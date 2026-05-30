/**
 * Socket.IO event handlers.
 * Routes emit events via req.app.get('io').
 * This module only handles connection lifecycle and room management.
 */
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Client joins a room: 'kitchen', 'waiter', 'admin', or 'table-{N}'
    socket.on('join', ({ room }) => {
      if (room) {
        socket.join(room);
        console.log(`[Socket] ${socket.id} joined room: ${room}`);
        socket.emit('joined', { room });
      }
    });

    // Client leaves a room
    socket.on('leave', ({ room }) => {
      if (room) {
        socket.leave(room);
        console.log(`[Socket] ${socket.id} left room: ${room}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });
}

module.exports = setupSocketHandlers;
