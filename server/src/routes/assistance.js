const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Customer requesting assistance
router.post('/', async (req, res) => {
  try {
    const { table_id, customer_name } = req.body;
    
    const [id] = await db('assistance_requests').insert({
      table_id,
      customer_name,
      status: 'pending'
    });
    
    const request = await db('assistance_requests')
      .join('restaurant_tables', 'assistance_requests.table_id', 'restaurant_tables.id')
      .select('assistance_requests.*', 'restaurant_tables.number as table_number')
      .where('assistance_requests.id', id)
      .first();
      
    const io = req.app.get('io');
    if (io) {
      io.to('waiter').emit('assistance:requested', request);
    }
    
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const { verifyToken, requireRole } = require('../middleware/auth');
router.use(verifyToken);
router.use(requireRole(['admin', 'waiter']));

router.get('/', async (req, res) => {
  try {
    const requests = await db('assistance_requests')
      .join('restaurant_tables', 'assistance_requests.table_id', 'restaurant_tables.id')
      .select('assistance_requests.*', 'restaurant_tables.number as table_number')
      .whereIn('assistance_requests.status', ['pending', 'accepted'])
      .orderBy('assistance_requests.created_at', 'asc');
      
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_waiter } = req.body;
    
    await db('assistance_requests')
      .where({ id })
      .update({ status, assigned_waiter, updated_at: db.fn.now() });
      
    const request = await db('assistance_requests')
      .join('restaurant_tables', 'assistance_requests.table_id', 'restaurant_tables.id')
      .select('assistance_requests.*', 'restaurant_tables.number as table_number')
      .where('assistance_requests.id', id)
      .first();
      
    const io = req.app.get('io');
    if (io) {
      const room = `table-${request.table_number}`;
      if (status === 'accepted') {
        io.to(room).emit('assistance:accepted', request);
      } else if (status === 'resolved') {
        io.to(room).emit('assistance:resolved', request);
      }
    }
    
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
