const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/tables
router.get('/', async (req, res) => {
  try {
    const tables = await db('restaurant_tables').orderBy('sort_order', 'asc');
    res.json(tables);
  } catch (err) {
    console.error('Tables list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/tables (admin)
router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { number, capacity, section } = req.body;
    if (!number) {
      return res.status(400).json({ error: 'Table number is required.' });
    }

    const [id] = await db('restaurant_tables').insert({
      number, capacity: capacity || 4, section: section || null,
    });

    const table = await db('restaurant_tables').where({ id }).first();
    res.status(201).json(table);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Table number already exists.' });
    }
    console.error('Table create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/tables/:id (admin)
router.put('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const updates = req.body;
    delete updates.id;
    delete updates.created_at;
    updates.updated_at = db.fn.now();

    const count = await db('restaurant_tables').where({ id: req.params.id }).update(updates);
    if (count === 0) {
      return res.status(404).json({ error: 'Table not found.' });
    }

    const table = await db('restaurant_tables').where({ id: req.params.id }).first();
    res.json(table);
  } catch (err) {
    console.error('Table update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/tables/shift (admin)
router.post('/shift', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { from_table_id, to_table_id } = req.body;
    if (!from_table_id || !to_table_id) {
      return res.status(400).json({ error: 'from_table_id and to_table_id are required' });
    }
    if (from_table_id === to_table_id) {
      return res.status(400).json({ error: 'Cannot shift to the same table' });
    }

    const fromTable = await db('restaurant_tables').where({ id: from_table_id }).first();
    if (!fromTable) return res.status(404).json({ error: 'Origin table not found' });

    // Check if target table is available
    const toTable = await db('restaurant_tables').where({ id: to_table_id }).first();
    if (!toTable) return res.status(404).json({ error: 'Target table not found' });
    if (toTable.status === 'occupied') return res.status(400).json({ error: 'Target table is already occupied' });

    // Find active order on the from_table
    const activeOrder = await db('orders').where({ table_id: from_table_id, status: 'active' }).first();
    if (!activeOrder) {
      return res.status(400).json({ error: 'No active order found on the origin table' });
    }

    // Shift the order
    await db('orders').where({ id: activeOrder.id }).update({ table_id: to_table_id, updated_at: db.fn.now() });
    
    // Update tables
    await db('restaurant_tables').where({ id: from_table_id }).update({ status: 'available', updated_at: db.fn.now() });
    await db('restaurant_tables').where({ id: to_table_id }).update({ status: 'occupied', updated_at: db.fn.now() });

    // Emit socket event to notify Waiters/Kitchen/Customer
    const io = req.app.get('io');
    if (io) {
      io.emit('table:shifted', { 
        from_table_id, 
        to_table_id, 
        order_id: activeOrder.id,
        from_table_number: fromTable.number,
        to_table_number: toTable.number
      });
    }

    res.json({ success: true, message: 'Table shifted successfully' });
  } catch (err) {
    console.error('Table shift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/tables/:id (admin)
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const count = await db('restaurant_tables').where({ id: req.params.id }).delete();
    if (count === 0) {
      return res.status(404).json({ error: 'Table not found.' });
    }
    res.json({ message: 'Table deleted.' });
  } catch (err) {
    console.error('Table delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
