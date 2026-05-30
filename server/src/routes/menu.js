const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/menu - list all menu items with category info
router.get('/', async (req, res) => {
  try {
    const query = db('menu_items')
      .join('menu_categories', 'menu_items.category_id', 'menu_categories.id')
      .select(
        'menu_items.*',
        'menu_categories.name as category_name',
        'menu_categories.name_np as category_name_np',
        'menu_categories.sort_order as category_sort_order'
      )
      .orderBy('menu_categories.sort_order')
      .orderBy('menu_items.sort_order');

    if (req.query.available === 'true') {
      query.where('menu_items.is_available', true);
    }

    const items = await query;
    res.json(items);
  } catch (err) {
    console.error('Menu list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/menu/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db('menu_categories').orderBy('sort_order');
    res.json(categories);
  } catch (err) {
    console.error('Categories list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/menu/categories - create category (admin)
router.post('/categories', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_np, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const [id] = await db('menu_categories').insert({
      name, name_np, sort_order: sort_order || 0
    });

    const category = await db('menu_categories').where({ id }).first();
    res.status(201).json(category);
  } catch (err) {
    console.error('Menu category create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/menu/categories/:id - update category (admin)
router.put('/categories/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.created_at;
    updates.updated_at = db.fn.now();

    const count = await db('menu_categories').where({ id }).update(updates);
    if (count === 0) {
      return res.status(404).json({ error: 'Menu category not found.' });
    }

    const category = await db('menu_categories').where({ id }).first();
    res.json(category);
  } catch (err) {
    console.error('Menu category update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/menu/categories/:id - delete category (admin)
router.delete('/categories/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    // Check if category has items
    const items = await db('menu_items').where({ category_id: req.params.id });
    if (items.length > 0) {
      return res.status(400).json({ error: 'Cannot delete category with associated items.' });
    }

    const count = await db('menu_categories').where({ id: req.params.id }).delete();
    if (count === 0) {
      return res.status(404).json({ error: 'Menu category not found.' });
    }
    res.json({ message: 'Menu category deleted.' });
  } catch (err) {
    console.error('Menu category delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/menu/items - create item (admin)
router.post('/items', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { category_id, name, name_np, description, description_np, price, image_url, is_veg, is_available, sort_order, station_id } = req.body;
    if (!category_id || !name || price === undefined) {
      return res.status(400).json({ error: 'category_id, name, and price are required.' });
    }

    const [id] = await db('menu_items').insert({
      category_id, name, name_np, description, description_np,
      price, image_url, is_veg: is_veg || false,
      is_available: is_available !== undefined ? is_available : true,
      sort_order: sort_order || 0,
      station_id: station_id || null,
    });

    const item = await db('menu_items').where({ id }).first();
    res.status(201).json(item);
  } catch (err) {
    console.error('Menu item create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/menu/items/:id - update item (admin)
router.put('/items/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.created_at;
    updates.updated_at = db.fn.now();

    const count = await db('menu_items').where({ id }).update(updates);
    if (count === 0) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    const item = await db('menu_items').where({ id }).first();
    res.json(item);
  } catch (err) {
    console.error('Menu item update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/menu/items/:id - delete item (admin)
router.delete('/items/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const count = await db('menu_items').where({ id: req.params.id }).delete();
    if (count === 0) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }
    res.json({ message: 'Menu item deleted.' });
  } catch (err) {
    console.error('Menu item delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/menu/items/:id/stock - toggle is_available (kitchen)
router.patch('/items/:id/stock', verifyToken, requireRole(['kitchen', 'admin']), async (req, res) => {
  try {
    const item = await db('menu_items').where({ id: req.params.id }).first();
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    const newAvailability = !item.is_available;
    await db('menu_items')
      .where({ id: req.params.id })
      .update({ is_available: newAvailability, updated_at: db.fn.now() });

    const updated = await db('menu_items').where({ id: req.params.id }).first();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('stock:updated', updated);
    }

    res.json(updated);
  } catch (err) {
    console.error('Menu stock toggle error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
