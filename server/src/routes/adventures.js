const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const crypto = require('crypto');

// Utility to get or create the "Adventures" category
async function getAdventuresCategory() {
  let cat = await db('menu_categories').where({ name: 'Adventures' }).first();
  if (!cat) {
    const [id] = await db('menu_categories').insert({
      name: 'Adventures',
      name_np: 'साहसिक',
      sort_order: 99
    });
    cat = await db('menu_categories').where({ id }).first();
  }
  return cat;
}

// GET /api/adventures/category
router.get('/category', async (req, res) => {
  try {
    const cat = await getAdventuresCategory();
    res.json(cat);
  } catch (err) {
    console.error('Category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/adventures/items
router.get('/items', async (req, res) => {
  try {
    const cat = await getAdventuresCategory();
    const items = await db('menu_items')
      .where({ category_id: cat.id, is_available: true })
      .orderBy('sort_order', 'asc');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/adventures/items
router.post('/items', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const cat = await getAdventuresCategory();
    const { name, price } = req.body;
    const [id] = await db('menu_items').insert({
      category_id: cat.id,
      name,
      price: price || 0,
      is_available: true,
      image_url: `https://placehold.co/400x300/2ecc71/white?text=${encodeURIComponent(name)}`
    });
    const newItem = await db('menu_items').where({ id }).first();
    res.json(newItem);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/adventures/items/:id
router.put('/items/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, price } = req.body;
    await db('menu_items').where({ id: req.params.id }).update({ name, price, updated_at: db.fn.now() });
    const updated = await db('menu_items').where({ id: req.params.id }).first();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/adventures/items/:id
router.delete('/items/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    await db('menu_items').where({ id: req.params.id }).update({ is_available: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/adventures/sell
router.post('/sell', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { items, payment_method, customer_name, subtotal, discount, tax, total } = req.body;
    
    // Create the order
    const [orderId] = await db('orders').insert({
      order_type: 'counter',
      status: 'completed', // Immediately completed
      order_name: customer_name || 'Adventure Guest',
      subtotal,
      discount: discount || 0,
      tax: tax || 0,
      total,
      created_at: db.fn.now()
    });

    const insertedItems = [];
    for (const item of items) {
      const [itemId] = await db('order_items').insert({
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        customer_name: customer_name || 'Guest',
        status: 'delivered' // Instant delivery
      });
      insertedItems.push({ ...item, id: itemId });
    }

    // Create payment record
    await db('payments').insert({
      order_id: orderId,
      amount: total,
      method: payment_method || 'cash',
      collected_by: req.user?.username || 'Admin'
    });

    // Generate adventure tickets for EACH quantity of EACH item
    const tickets = [];
    for (const item of insertedItems) {
      for (let i = 0; i < item.quantity; i++) {
        const ticket_code = crypto.randomUUID();
        const [ticketId] = await db('adventure_tickets').insert({
          order_id: orderId,
          order_item_id: item.id,
          ticket_code,
          status: 'unused'
        });
        tickets.push({
          id: ticketId,
          order_id: orderId,
          ticket_code,
          item_name: item.name,
          price: item.price,
          customer_name: customer_name || 'Guest',
          purchased_at: new Date()
        });
      }
    }

    res.json({ success: true, orderId, tickets });
  } catch (err) {
    console.error('Sell error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/adventures/scan
router.post('/scan', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { ticket_code } = req.body;
    const ticket = await db('adventure_tickets').where({ ticket_code }).first();
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status === 'used') {
      return res.status(400).json({ error: 'Ticket has already been used!' });
    }

    if (ticket.status === 'cancelled') {
      return res.status(400).json({ error: 'Ticket is cancelled!' });
    }

    await db('adventure_tickets').where({ id: ticket.id }).update({
      status: 'used',
      used_at: db.fn.now()
    });

    // Fetch details to show on scan success
    const item = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .where('order_items.id', ticket.order_item_id)
      .select('menu_items.name')
      .first();

    res.json({ success: true, message: 'Ticket validated successfully', adventure_name: item?.name });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/adventures/ticket/:code
router.get('/ticket/:code', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { code } = req.params;
    const ticket = await db('adventure_tickets').where({ ticket_code: code }).first();
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status === 'used') {
      return res.status(400).json({ error: 'Ticket has already been used!' });
    }

    if (ticket.status === 'cancelled') {
      return res.status(400).json({ error: 'Ticket is cancelled!' });
    }

    // Fetch details to show on scan success
    const item = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .where('order_items.id', ticket.order_item_id)
      .select('menu_items.name')
      .first();

    res.json({ success: true, ticket, adventure_name: item?.name });
  } catch (err) {
    console.error('Ticket fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/adventures/stats
router.get('/stats', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = await db('adventure_tickets')
      .join('order_items', 'adventure_tickets.order_item_id', 'order_items.id')
      .select('order_items.menu_item_id as id', 'adventure_tickets.status')
      .count('* as count')
      .groupBy('order_items.menu_item_id', 'adventure_tickets.status');
      
    const formattedStats = {};
    for (const stat of stats) {
      if (!formattedStats[stat.id]) {
        formattedStats[stat.id] = { sold: 0, used: 0, unused: 0, cancelled: 0 };
      }
      const count = parseInt(stat.count, 10);
      formattedStats[stat.id][stat.status] = count;
      formattedStats[stat.id].sold += count;
    }
    
    res.json(formattedStats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
