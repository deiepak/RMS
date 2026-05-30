const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All station routes require admin or kitchen role
router.use(verifyToken, requireRole(['admin', 'kitchen']));

// GET /api/stations
router.get('/', async (req, res) => {
  try {
    const stations = await db('stations').orderBy('name', 'asc');
    res.json(stations);
  } catch (err) {
    console.error('Fetch stations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stations
router.post('/', requireRole(['admin']), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const [id] = await db('stations').insert({ name });
    const station = await db('stations').where({ id }).first();
    res.status(201).json(station);
  } catch (err) {
    console.error('Create station error:', err);
    res.status(500).json({ error: 'Internal server error or name already exists' });
  }
});

// PUT /api/stations/:id
router.put('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    await db('stations').where({ id: req.params.id }).update({ name, updated_at: db.fn.now() });
    const station = await db('stations').where({ id: req.params.id }).first();
    res.json(station);
  } catch (err) {
    console.error('Update station error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/stations/:id
router.delete('/:id', requireRole(['admin']), async (req, res) => {
  try {
    // Foreign keys on menu_items and employees will automatically set station_id to NULL
    // due to onDelete('SET NULL') defined in the migration.
    await db('stations').where({ id: req.params.id }).del();
    res.json({ message: 'Station deleted successfully' });
  } catch (err) {
    console.error('Delete station error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
