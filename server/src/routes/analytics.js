const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

const applyDateFilter = (query, dateCol, from, to) => {
  if (from) query = query.where(dateCol, '>=', from);
  if (to) {
    if (to.length === 10) {
      query = query.where(dateCol, '<=', to + ' 23:59:59');
    } else {
      query = query.where(dateCol, '<=', to);
    }
  }
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

    let q = query
      .select('menu_items.name')
      .sum('order_items.quantity as count')
      .select(db.raw('SUM(order_items.quantity * COALESCE(order_items.price_at_order, menu_items.price)) as revenue'))
      .groupBy('menu_items.id', 'menu_items.name')
      .orderBy('count', 'desc');

    if (req.query.limit !== 'all') {
      q = q.limit(10);
    }

    const popularItems = await q;

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


router.get('/summary-metrics', async (req, res) => {
  try {
    const { from, to } = req.query;

    // Get selected period revenue
    let orderQuery = db('payments');
    orderQuery = applyDateFilter(orderQuery, 'created_at', from, to);
    const orderRev = await orderQuery.sum('amount as total');

    let pkgQuery = db('package_payments');
    pkgQuery = applyDateFilter(pkgQuery, 'created_at', from, to);
    const pkgRev = await pkgQuery.sum('amount as total');
    
    const currentSales = (parseFloat(orderRev[0].total) || 0) + (parseFloat(pkgRev[0].total) || 0);

    // Calculate growth (needs previous period)
    let previousSales = 0;
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const diffTime = Math.abs(toDate - fromDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      
      const prevFrom = new Date(fromDate);
      prevFrom.setDate(prevFrom.getDate() - diffDays);
      const prevTo = new Date(toDate);
      prevTo.setDate(prevTo.getDate() - diffDays);

      const prevFromStr = prevFrom.toISOString().split('T')[0];
      const prevToStr = prevTo.toISOString().split('T')[0];

      const prevOrderRev = await db('payments').where('created_at', '>=', prevFromStr).where('created_at', '<=', prevToStr + ' 23:59:59').sum('amount as total');
      const prevPkgRev = await db('package_payments').where('created_at', '>=', prevFromStr).where('created_at', '<=', prevToStr + ' 23:59:59').sum('amount as total');
      previousSales = (parseFloat(prevOrderRev[0].total) || 0) + (parseFloat(prevPkgRev[0].total) || 0);
    }
    const growth = previousSales === 0 ? (currentSales > 0 ? 100 : 0) : ((currentSales - previousSales) / previousSales) * 100;

    // Average Order Value
    let aovQuery = db('orders').where('status', 'completed');
    aovQuery = applyDateFilter(aovQuery, 'created_at', from, to);
    const aovData = await aovQuery.avg('total as aov');
    const averageOrderValue = parseFloat(aovData[0].aov) || 0;

    // Discounts
    let discountQuery = db('orders').where('status', 'completed');
    discountQuery = applyDateFilter(discountQuery, 'created_at', from, to);
    const discountData = await discountQuery.sum('discount as total_discount');
    const discountsGiven = parseFloat(discountData[0].total_discount) || 0;

    // Refunds
    let refundQuery = db('sales_return_logs');
    refundQuery = applyDateFilter(refundQuery, 'created_at', from, to);
    const refundData = await refundQuery.sum('refund_amount as total_refund');
    const totalRefunds = parseFloat(refundData[0].total_refund) || 0;

    // Prep time estimation
    let prepQuery = db('orders').whereIn('status', ['completed', 'checkout_requested']);
    prepQuery = applyDateFilter(prepQuery, 'created_at', from, to);
    const prepData = await prepQuery.select(db.raw('AVG(TIMESTAMPDIFF(MINUTE, created_at, updated_at)) as avg_prep_time'));
    const avgPrepTime = parseFloat(prepData[0].avg_prep_time) || 0;

    res.json({
      currentSales,
      growth,
      averageOrderValue,
      discountsGiven,
      totalRefunds,
      avgPrepTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/revenue-by-hour', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = db('payments');
    query = applyDateFilter(query, 'created_at', from, to);

    const revenueByHour = await query
      .select(db.raw("HOUR(CONVERT_TZ(created_at, '+00:00', '+05:45')) as hour"))
      .sum('amount as revenue')
      .groupBy(db.raw("HOUR(CONVERT_TZ(created_at, '+00:00', '+05:45'))"))
      .orderBy('hour', 'asc');

    res.json(revenueByHour);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/least-popular-items', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .where('order_items.status', '!=', 'rejected')
      .whereNot('order_items.status', 'cancelled');
    
    query = applyDateFilter(query, 'order_items.created_at', from, to);

    let q = query
      .select('menu_items.name')
      .sum('order_items.quantity as count')
      .select(db.raw('SUM(order_items.quantity * COALESCE(order_items.price_at_order, menu_items.price)) as revenue'))
      .groupBy('menu_items.id', 'menu_items.name')
      .orderBy('count', 'asc');

    if (req.query.limit !== 'all') {
      q = q.limit(10);
    }

    const items = await q;

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/popular-combos', async (req, res) => {
  try {
    const { from, to, type, size, filters } = req.query;
    let comboSize = parseInt(size) || 2;
    if (comboSize > 4) comboSize = 4;
    if (comboSize < 2) comboSize = 2;

    let parsedFilters = [];
    try {
      if (filters) parsedFilters = JSON.parse(filters);
    } catch (e) {
      if (Array.isArray(filters)) parsedFilters = filters;
      else if (typeof filters === 'string') parsedFilters = [filters];
    }
    
    // Sort filters to handle duplicates cleanly
    if (parsedFilters && parsedFilters.length > 0) {
      parsedFilters.sort();
    }
    const hasFilters = parsedFilters && parsedFilters.length === comboSize;

    let query = db('order_items as o1')
      .join('menu_items as m1', 'o1.menu_item_id', 'm1.id')
      .where('o1.status', '!=', 'rejected')
      .whereNot('o1.status', 'cancelled');

    if (type === 'category') {
      query = query.leftJoin('menu_categories as c1', 'm1.category_id', 'c1.id');
    }

    const selectColumns = ['m1.name as item1'];
    const groupColumns = ['m1.name'];

    for (let i = 2; i <= comboSize; i++) {
      query = query.join(`order_items as o${i}`, `o1.order_id`, `o${i}.order_id`)
        .join(`menu_items as m${i}`, `o${i}.menu_item_id`, `m${i}.id`)
        .where(`o${i}.status`, '!=', 'rejected')
        .whereNot(`o${i}.status`, 'cancelled');

      if (type === 'category') {
        query = query.leftJoin(`menu_categories as c${i}`, `m${i}.category_id`, `c${i}.id`);
      }

      selectColumns.push(`m${i}.name as item${i}`);
      groupColumns.push(`m${i}.name`);
    }

    for (let i = 1; i <= comboSize; i++) {
      if (hasFilters) {
        const filterVal = parsedFilters[i - 1];
        if (filterVal && filterVal !== 'all') {
          if (type === 'category') query = query.where(`c${i}.name`, filterVal);
          else if (type === 'item') query = query.where(`m${i}.name`, filterVal);
        }
      }

      if (i > 1) {
        const prevFilter = hasFilters ? parsedFilters[i - 2] : null;
        const currFilter = hasFilters ? parsedFilters[i - 1] : null;
        
        if (!hasFilters || prevFilter === currFilter) {
          query = query.whereRaw(`(m${i-1}.id < m${i}.id OR (m${i-1}.id = m${i}.id AND o${i-1}.id < o${i}.id))`);
        }
      }
    }

    query = applyDateFilter(query, 'o1.created_at', from, to);

    let q = query
      .select(selectColumns)
      .count('* as count')
      .groupBy(groupColumns)
      .orderBy('count', 'desc');

    if (req.query.limit !== 'all') {
      q = q.limit(5);
    }

    const combos = await q;
    res.json(combos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/waiter-performance', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = db('order_items')
      .whereNotNull('order_items.assigned_waiter');
      
    query = applyDateFilter(query, 'order_items.created_at', from, to);

    const stats = await query
      .select('order_items.assigned_waiter as name')
      .count('order_items.id as items_handled')
      .select(db.raw("SUM(CASE WHEN order_items.status = 'rejected' THEN 1 ELSE 0 END) as items_rejected"))
      .select(db.raw("SUM(CASE WHEN order_items.status = 'delivered' THEN 1 ELSE 0 END) as items_delivered"))
      .select(db.raw('SUM(CASE WHEN order_items.status != \'rejected\' AND order_items.status != \'cancelled\' THEN (order_items.quantity * COALESCE(order_items.price_at_order, 0)) ELSE 0 END) as revenue_handled'))
      .groupBy('order_items.assigned_waiter')
      .orderBy('revenue_handled', 'desc');

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/menu-analysis', async (req, res) => {
  try {
    const { from, to, sort } = req.query;
    
    let query = db('menu_items')
      .leftJoin('menu_categories', 'menu_items.category_id', 'menu_categories.id')
      .leftJoin('order_items', function() {
        this.on('menu_items.id', '=', 'order_items.menu_item_id')
          .andOnVal('order_items.status', '!=', 'rejected')
          .andOnVal('order_items.status', '!=', 'cancelled');
          
        if (from) {
          this.andOnVal('order_items.created_at', '>=', from);
        }
        if (to) {
          if (to.length === 10) {
            this.andOnVal('order_items.created_at', '<=', to + ' 23:59:59');
          } else {
            this.andOnVal('order_items.created_at', '<=', to);
          }
        }
      });

    const menuAnalysis = await query
      .select(
        'menu_items.name as itemName',
        db.raw('COALESCE(menu_categories.name, "Uncategorized") as category')
      )
      .sum('order_items.quantity as totalSales')
      .select(db.raw('SUM(order_items.quantity * COALESCE(order_items.price_at_order, menu_items.price)) as totalRevenue'))
      .groupBy('menu_items.id', 'menu_items.name', 'menu_categories.name');

    // Handle sorting manually if needed or via DB
    if (sort === 'revenue') {
      menuAnalysis.sort((a, b) => parseFloat(b.totalRevenue || 0) - parseFloat(a.totalRevenue || 0));
    } else if (sort === 'sales') {
      menuAnalysis.sort((a, b) => parseInt(b.totalSales || 0) - parseInt(a.totalSales || 0));
    } else if (sort === 'category') {
      menuAnalysis.sort((a, b) => a.category.localeCompare(b.category));
    } else {
      // Default sort by sales desc
      menuAnalysis.sort((a, b) => parseInt(b.totalSales || 0) - parseInt(a.totalSales || 0));
    }

    res.json(menuAnalysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
