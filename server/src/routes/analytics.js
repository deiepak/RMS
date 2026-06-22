const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

const applyDateFilter = (query, dateCol, from, to) => {
  if (from) query = query.where(dateCol, '>=', from);
  if (to) query = query.where(dateCol, '<=', to);
  return query;
};

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

    // Include package payments in today's revenue
    const pkgRevenueMethods = await db('package_payments')
      .where('created_at', '>=', today)
      .select('payment_method as method')
      .sum('amount as total')
      .groupBy('payment_method');

    pkgRevenueMethods.forEach(r => {
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
    const { from, to } = req.query;

    let orderQuery = db('payments');
    orderQuery = applyDateFilter(orderQuery, 'created_at', from, to);
    const orderRevenue = await orderQuery
      .select(db.raw("DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:45'), '%Y-%m-%d') as date"))
      .sum('amount as revenue')
      .groupBy(db.raw("DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:45'), '%Y-%m-%d')"));

    let pkgQuery = db('package_payments');
    pkgQuery = applyDateFilter(pkgQuery, 'created_at', from, to);
    const pkgRevenue = await pkgQuery
      .select(db.raw("DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:45'), '%Y-%m-%d') as date"))
      .sum('amount as revenue')
      .groupBy(db.raw("DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:45'), '%Y-%m-%d')"));

    // Merge both revenue sources by date
    const revenueMap = {};
    [...orderRevenue, ...pkgRevenue].forEach(r => {
      if (!revenueMap[r.date]) revenueMap[r.date] = { date: r.date, revenue: 0 };
      revenueMap[r.date].revenue += parseFloat(r.revenue || 0);
    });
    let revenueByDay = Object.values(revenueMap)
      .sort((a, b) => b.date.localeCompare(a.date));

    // If no date filter, limit to last 7 days by default, else show all within range
    if (!from && !to) {
      revenueByDay = revenueByDay.slice(Math.max(revenueByDay.length - 7, 0));
    }

    res.json(revenueByDay);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/popular-items', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .where('order_items.status', '!=', 'rejected')
      .whereNot('order_items.status', 'cancelled');
    
    query = applyDateFilter(query, 'order_items.created_at', from, to);

    const popularItems = await query
      .select('menu_items.name')
      .sum('order_items.quantity as count')
      .select(db.raw('SUM(order_items.quantity * COALESCE(order_items.price_at_order, menu_items.price)) as revenue'))
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
    const { from, to } = req.query;
    let query = db('orders');
    query = applyDateFilter(query, 'created_at', from, to);

    const peakHours = await query
      .select(db.raw("HOUR(CONVERT_TZ(created_at, '+00:00', '+05:45')) as hour"))
      .count('id as count')
      .groupBy(db.raw("HOUR(CONVERT_TZ(created_at, '+00:00', '+05:45'))"))
      .orderBy('hour', 'asc');

    res.json(peakHours);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/table-utilization', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = db('orders')
      .join('restaurant_tables', 'orders.table_id', 'restaurant_tables.id');
    query = applyDateFilter(query, 'orders.created_at', from, to);

    const tableStats = await query
      .select('restaurant_tables.number')
      .count('orders.id as count')
      .groupBy('restaurant_tables.id', 'restaurant_tables.number')
      .orderBy('count', 'desc');

    res.json(tableStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/category-revenue', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .leftJoin('menu_categories', 'menu_items.category_id', 'menu_categories.id')
      .where('orders.status', 'completed')
      .where('order_items.status', '!=', 'rejected')
      .whereNot('order_items.status', 'cancelled');

    query = applyDateFilter(query, 'orders.created_at', from, to);

    const results = await query
      .select('menu_categories.name as name')
      .select(db.raw('SUM(order_items.quantity * COALESCE(order_items.price_at_order, menu_items.price)) as value'))
      .groupBy('menu_categories.id', 'menu_categories.name');
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/day-of-week', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = db('orders');
    query = applyDateFilter(query, 'created_at', from, to);

    const days = await query
      .select(db.raw("DAYOFWEEK(CONVERT_TZ(created_at, '+00:00', '+05:45')) as day"))
      .count('id as count')
      .groupBy(db.raw("DAYOFWEEK(CONVERT_TZ(created_at, '+00:00', '+05:45'))"))
      .orderBy('day', 'asc');
    res.json(days);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
