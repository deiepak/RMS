const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/', async (req, res) => {
  try {
    const { from, to, method } = req.query;
    
    let query = db('payments')
      .join('orders', 'payments.order_id', 'orders.id')
      .leftJoin('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .where('payments.amount', '>', 0)
      .select(
        'payments.*',
        'orders.id as order_id',
        'orders.order_name as customer_name',
        'orders.total as order_total',
        'orders.discount as order_discount',
        'orders.status as order_status',
        'restaurant_tables.number as table_number',
        db.raw(`(
          SELECT COALESCE(SUM(amount), 0)
          FROM payments p2
          WHERE p2.order_id = orders.id AND p2.amount > 0
        ) as total_order_paid`)
      );

    let pkgQuery = db('package_payments')
      .join('packages', 'package_payments.package_id', 'packages.id')
      .select(
        'package_payments.id',
        'package_payments.amount',
        'package_payments.payment_method as method',
        'package_payments.notes',
        'package_payments.created_at',
        'packages.id as package_id',
        'packages.title as package_title',
        'packages.total_amount as order_total'
      );

    if (from) {
      query = query.where('payments.created_at', '>=', from);
      pkgQuery = pkgQuery.where('package_payments.created_at', '>=', from);
    }
    if (to) {
      query = query.where('payments.created_at', '<=', to);
      pkgQuery = pkgQuery.where('package_payments.created_at', '<=', to);
    }
    if (method && method !== 'all') {
      query = query.where('payments.method', method);
      pkgQuery = pkgQuery.where('package_payments.payment_method', method);
    }

    const [payments, pkgPayments] = await Promise.all([query, pkgQuery]);

    const formattedPkgPayments = pkgPayments.map(p => ({
      id: `pkg_${p.id}`,
      order_id: `PKG-${p.package_id}`,
      amount: p.amount,
      method: p.method,
      collected_by: 'Admin',
      notes: p.notes,
      created_at: p.created_at,
      order_total: p.order_total,
      order_discount: 0,
      order_refund: 0,
      table_number: p.package_title,
      is_package: true
    }));

    const salesReturnsByOrder = await db('sales_return_logs')
      .select('order_id', db.raw('SUM(refund_amount) as refund_total'))
      .groupBy('order_id');
    const returnMap = {};
    salesReturnsByOrder.forEach(r => { returnMap[r.order_id] = parseFloat(r.refund_total); });

    const formattedPayments = payments.map(p => ({
      ...p,
      order_refund: p.order_status === 'cancelled' 
        ? parseFloat(p.total_order_paid) 
        : Math.max(Math.max(0, parseFloat(p.total_order_paid) - parseFloat(p.order_total)), returnMap[p.order_id] || 0)
    }));

    const allPayments = [...formattedPayments, ...formattedPkgPayments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(allPayments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    let query = db('payments')
      .where('payments.amount', '>', 0)
      .whereExists(function() {
        this.select(1).from('orders')
          .whereRaw('orders.id = payments.order_id')
          .whereNot('orders.status', 'cancelled');
      });
    let pkgQuery = db('package_payments');

    if (from) {
      query = query.where('payments.created_at', '>=', from);
      pkgQuery = pkgQuery.where('created_at', '>=', from);
    }
    if (to) {
      query = query.where('payments.created_at', '<=', to);
      pkgQuery = pkgQuery.where('created_at', '<=', to);
    }

    const [payments, pkgPayments] = await Promise.all([
      query.select('method', 'amount'),
      pkgQuery.select('payment_method as method', 'amount')
    ]);

    const allPayments = [...payments, ...pkgPayments];

    const summary = {
      total_revenue: 0,
      count: allPayments.length,
      by_method: {
        cash: 0,
        card: 0,
        online: 0
      }
    };

    allPayments.forEach(p => {
      const amount = parseFloat(p.amount);
      summary.total_revenue += amount;
      if (summary.by_method[p.method] !== undefined) {
        summary.by_method[p.method] += amount;
      }
    });

    const refundsQuery = db('orders')
      .whereExists(function() {
        this.select(1).from('payments').whereRaw('payments.order_id = orders.id');
        if (from) this.where('payments.created_at', '>=', from);
        if (to) this.where('payments.created_at', '<=', to);
      })
      .select(
        'orders.id',
        'orders.status',
        'orders.total',
        db.raw(`(
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE payments.order_id = orders.id AND payments.amount > 0
        ) as total_paid`)
      );

    const salesReturnsByOrder = await db('sales_return_logs')
      .where(function() {
        if (from) this.where('created_at', '>=', from);
        if (to) this.where('created_at', '<=', to);
      })
      .select('order_id', db.raw('SUM(refund_amount) as refund_total'))
      .groupBy('order_id');
    const returnMap = {};
    salesReturnsByOrder.forEach(r => { returnMap[r.order_id] = parseFloat(r.refund_total); });

    const ordersWithRefunds = await refundsQuery;
    let total_refunds = 0;
    let partial_refunds_to_deduct = 0;
    ordersWithRefunds.forEach(o => {
      const paid = parseFloat(o.total_paid);
      if (o.status === 'cancelled') {
        total_refunds += paid;
      } else {
        const expected = parseFloat(o.total);
        const calcDiff = Math.max(0, paid - expected);
        const salesReturnAmount = returnMap[o.id] || 0;
        const actualRefundForOrder = Math.max(calcDiff, salesReturnAmount);
        
        total_refunds += actualRefundForOrder;
        if (calcDiff > 0) {
          partial_refunds_to_deduct += calcDiff;
        }
      }
    });

    summary.total_revenue = Math.max(0, summary.total_revenue - partial_refunds_to_deduct);
    summary.total_refunds = total_refunds;

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-category', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    // Step 1: Get raw category totals using historical price (price_at_order)
    let query = db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .leftJoin('menu_categories', 'menu_items.category_id', 'menu_categories.id')
      .where('orders.status', 'completed')
      .where('order_items.status', '!=', 'rejected')
      .whereNot('order_items.status', 'cancelled')
      .select('menu_categories.name as category')
      .select(db.raw('SUM(order_items.quantity * COALESCE(order_items.price_at_order, menu_items.price)) as total'))
      .count('order_items.id as items_count')
      .groupBy('menu_categories.id', 'menu_categories.name');

    if (from) {
      query = query.where('orders.created_at', '>=', from);
    }
    if (to) {
      query = query.where('orders.created_at', '<=', to);
    }

    const results = await query;

    // Step 2: Get total discounts for the same period to subtract proportionally
    let discountQuery = db('orders')
      .where('orders.status', 'completed')
      .select(
        db.raw('COALESCE(SUM(orders.discount), 0) as total_discount'),
        db.raw('COALESCE(SUM(orders.subtotal), 0) as total_subtotal')
      );

    if (from) {
      discountQuery = discountQuery.where('orders.created_at', '>=', from);
    }
    if (to) {
      discountQuery = discountQuery.where('orders.created_at', '<=', to);
    }

    const [discountData] = await discountQuery;
    const totalDiscount = parseFloat(discountData.total_discount || 0);
    const totalSubtotal = parseFloat(discountData.total_subtotal || 0);

    // Subtract proportional discount from each category
    if (totalDiscount > 0 && totalSubtotal > 0) {
      const discountRatio = totalDiscount / totalSubtotal;
      results.forEach(r => {
        const rawTotal = parseFloat(r.total || 0);
        r.total = parseFloat(Math.max(0, rawTotal - (rawTotal * discountRatio)).toFixed(2));
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
