const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin', 'kitchen', 'waiter']));

router.get('/', async (req, res) => {
  try {
    const { target_role } = req.query;
    let query = db('messages').orderBy('created_at', 'desc').limit(50);
    
    if (target_role) {
      query = query.where({ target_role }).orWhere({ target_role: 'Everyone' });
    }
    
    const messages = await query;
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { target_role, content, target_stations, audio_data } = req.body;
    
    const [id] = await db('messages').insert({
      sender_role: req.user.role,
      sender_name: req.user.name,
      target_role,
      content: content || null,
      target_stations: target_stations ? JSON.stringify(target_stations) : null,
      audio_data: audio_data || null
    });
    
    const newMessage = await db('messages').where({ id }).first();
    // Parse json back to array for socket payload
    if (newMessage.target_stations) {
      newMessage.target_stations = JSON.parse(newMessage.target_stations);
    }
    
    const io = req.app.get('io');
    if (io) {
      if (target_role === 'Everyone') {
        io.to('admin').to('kitchen').to('waiter').emit('admin:message', newMessage);
      } else if (target_role === 'All Kitchen Staff') {
        io.to('kitchen').emit('admin:message', newMessage);
      } else if (target_role === 'All Waiters') {
        io.to('waiter').emit('admin:message', newMessage);
      } else if (target_role === 'Admin') {
        io.to('admin').emit('admin:message', newMessage);
      }
    }
    
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
