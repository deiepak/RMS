const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/menu'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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
router.post('/items', verifyToken, requireRole(['admin']), upload.single('image'), async (req, res) => {
  try {
    const { category_id, name, name_np, description, description_np, price, is_veg, is_available, sort_order, station_ids } = req.body;
    
    const _price = parseFloat(price);
    const _is_veg = is_veg === 'true' || is_veg === true;
    const _is_available = is_available === 'false' ? false : true;
    const _sort_order = parseInt(sort_order) || 0;

    let image_url = req.body.image_url || null;
    if (req.file) {
      image_url = `/uploads/menu/${req.file.filename}`;
    }

    if (!category_id || !name || isNaN(_price)) {
      return res.status(400).json({ error: 'category_id, name, and valid price are required.' });
    }

    const [id] = await db('menu_items').insert({
      category_id, name, name_np, description, description_np,
      price: _price, image_url, is_veg: _is_veg,
      is_available: _is_available,
      sort_order: _sort_order,
      station_ids: station_ids ? (typeof station_ids === 'string' ? station_ids : JSON.stringify(station_ids)) : '[]',
    });

    const item = await db('menu_items').where({ id }).first();
    res.status(201).json(item);
  } catch (err) {
    console.error('Menu item create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/menu/items/:id - update item (admin)
router.put('/items/:id', verifyToken, requireRole(['admin']), upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const validColumns = ['category_id', 'name', 'name_np', 'description', 'description_np', 'price', 'is_veg', 'is_available', 'sort_order'];
    const updates = {};
    for (const key of validColumns) {
      if (req.body[key] !== undefined) {
        if (key === 'price') updates[key] = parseFloat(req.body[key]);
        else if (key === 'is_veg' || key === 'is_available') updates[key] = (req.body[key] === 'true' || req.body[key] === true);
        else if (key === 'sort_order') updates[key] = parseInt(req.body[key]) || 0;
        else updates[key] = req.body[key];
      }
    }

    if (req.body.station_ids !== undefined) {
      updates.station_ids = typeof req.body.station_ids === 'string' ? req.body.station_ids : JSON.stringify(req.body.station_ids);
    }

    if (req.file) {
      updates.image_url = `/uploads/menu/${req.file.filename}`;
    } else if (req.body.image_url !== undefined && req.body.image_url !== 'null' && req.body.image_url !== '') {
      updates.image_url = req.body.image_url;
    }

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
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Cannot delete item because it has been ordered in the past. Please mark it as unavailable instead.' });
    }
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
