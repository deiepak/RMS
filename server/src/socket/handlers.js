/**
 * Socket.IO event handlers.
 * Routes emit events via req.app.get('io').
 * This module only handles connection lifecycle and room management.
 */
const activeTVs = new Map();

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

    // TV & Cameraman WebRTC Signaling
    socket.on('tv:register', (data) => {
      activeTVs.set(socket.id, { id: socket.id, name: data.name || 'Unnamed TV' });
      io.emit('tv:list', Array.from(activeTVs.values()));
      console.log(`[Socket] TV Registered: ${socket.id} (${data.name})`);
    });

    socket.on('tv:get_list', () => {
      socket.emit('tv:list', Array.from(activeTVs.values()));
    });

    socket.on('tv:offer', (payload) => {
      if (payload.targetId) {
        io.to(payload.targetId).emit('tv:offer', { ...payload, senderId: socket.id });
      } else {
        activeTVs.forEach((tv, tvId) => {
          io.to(tvId).emit('tv:offer', { ...payload, senderId: socket.id, isBroadcast: true });
        });
      }
    });

    socket.on('tv:answer', (payload) => {
      io.to(payload.targetId).emit('tv:answer', { ...payload, senderId: socket.id });
    });

    socket.on('tv:candidate', (payload) => {
      if (payload.targetId) {
        io.to(payload.targetId).emit('tv:candidate', { ...payload, senderId: socket.id });
      } else {
         // if broadcast, need to send candidate to all TVs
        activeTVs.forEach((tv, tvId) => {
          io.to(tvId).emit('tv:candidate', { ...payload, senderId: socket.id });
        });
      }
    });

    socket.on('tv:start_live', (payload) => {
      if (payload && payload.targetId) {
        io.to(payload.targetId).emit('tv:start_live', { senderId: socket.id });
      } else {
        activeTVs.forEach((tv, tvId) => {
          io.to(tvId).emit('tv:start_live', { senderId: socket.id });
        });
      }
    });

    socket.on('tv:stop_live', (payload) => {
      if (payload && payload.targetId) {
        io.to(payload.targetId).emit('tv:stop_live', { senderId: socket.id });
      } else {
        activeTVs.forEach((tv, tvId) => {
          io.to(tvId).emit('tv:stop_live', { senderId: socket.id });
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
      if (activeTVs.has(socket.id)) {
        activeTVs.delete(socket.id);
        io.emit('tv:list', Array.from(activeTVs.values()));
      }
    });
  });
}

module.exports = setupSocketHandlers;
