const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/overview', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const revenueMethods = await db('payments')
      .where('created_at', '>=', today)
      .select('method')
      .sum('amount as total')
      .groupBy('method');

    const revenueBreakdown = { cash: 0, online: 0, card: 0, total: 0 };
    revenueMethods.forEach(r => {
      const amt = parseFloat(r.total || 0);
      if (r.method === 'online') revenueBreakdown.online += amt;
      else if (r.method === 'card') revenueBreakdown.card += amt;
      else revenueBreakdown.cash += amt;
      revenueBreakdown.total += amt;
    });

    const [orders] = await db('orders')
      .where('created_at', '>=', today)
      .count('id as count');

    const [tables] = await db('restaurant_tables')
      .where('status', 'occupied')
      .count('id as count');

    const [items] = await db('order_items')
      .where('created_at', '>=', today)
      .sum('quantity as count');

    res.json({
      todayRevenue: revenueBreakdown.total || 0,
      revenueBreakdown,
      activeOrders: orders.count || 0,
      tablesOccupied: tables.count || 0,
      itemsServed: items.count || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const revenueByDay = await db('payments')
      .select(db.raw('DATE(created_at) as date'))
      .sum('amount as revenue')
      .groupBy(db.raw('DATE(created_at)'))
      .orderBy('date', 'desc')
      .limit(7);

    res.json(revenueByDay.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/popular-items', async (req, res) => {
  try {
    const popularItems = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .select('menu_items.name')
      .sum('order_items.quantity as count')
      .groupBy('menu_items.id', 'menu_items.name')
      .orderBy('count', 'desc')
      .limit(10);

    res.json(popularItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/peak-hours', async (req, res) => {
  try {
    const peakHours = await db('orders')
      .select(db.raw('HOUR(created_at) as hour'))
      .count('id as count')
      .groupBy(db.raw('HOUR(created_at)'))
      .orderBy('hour', 'asc');

    res.json(peakHours);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/table-utilization', async (req, res) => {
  try {
    const tableStats = await db('orders')
      .join('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .select('restaurant_tables.number')
      .count('orders.id as count')
      .groupBy('restaurant_tables.id', 'restaurant_tables.number')
      .orderBy('count', 'desc');

    res.json(tableStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
