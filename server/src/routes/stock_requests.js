const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all pending stock requests
router.get('/', async (req, res) => {
  try {
    const requests = await db('stock_requests')
      .where({ status: 'pending' })
      .orderBy('created_at', 'desc');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a stock request
router.post('/', async (req, res) => {
  try {
    const { item_name, quantity, notes, requested_by } = req.body;
    
    const [id] = await db('stock_requests').insert({
      item_name,
      quantity,
      notes,
      requested_by,
      status: 'pending'
    });
    
    const newRequest = await db('stock_requests').where({ id }).first();
    
    // Optionally emit a socket event to admin
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('stock:request', newRequest);
    }
    
    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dismiss/Clear a stock request
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // usually 'okay'
    
    await db('stock_requests').where({ id }).update({ status });
    // Alternatively, we could delete it, but updating to 'okay' keeps it in DB for records if needed.
    // If the user wants it to just disappear, we can just delete it, or the GET / endpoint only returns 'pending' ones.
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
