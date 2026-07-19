const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/', async (req, res) => {
  try {
    const { from, to, type = 'all' } = req.query; // type: 'income' | 'expense' | 'cash_flow' | 'all'

    // INCOME
    let orderPaymentsQuery = db('payments')
      .join('orders', 'payments.order_id', 'orders.id')
      .where('payments.amount', '>', 0)
      .select(
        'payments.created_at',
        db.raw("'income' as type"),
        db.raw("'order_payment' as category"),
        db.raw("CONCAT('Order #', orders.id) as description"),
        'payments.amount as amount_in',
        db.raw('0 as amount_out'),
        'payments.method as payment_method'
      );

    let packagePaymentsQuery = db('package_payments')
      .join('packages', 'package_payments.package_id', 'packages.id')
      .select(
        'package_payments.created_at',
        db.raw("'income' as type"),
        db.raw("'package_payment' as category"),
        db.raw("CONCAT('Package: ', packages.customer_name) as description"),
        'package_payments.amount as amount_in',
        db.raw('0 as amount_out'),
        'package_payments.payment_method'
      );

    // EXPENSES
    let vendorPurchasesQuery = db('vendor_ledgers')
      .join('vendors', 'vendor_ledgers.vendor_id', 'vendors.id')
      .where('vendor_ledgers.transaction_type', 'purchase')
      .whereNot('vendor_ledgers.notes', 'like', 'Maintenance Repair:%')
      .whereNot('vendor_ledgers.notes', 'like', 'Custom Expense%')
      .select(
        'vendor_ledgers.created_at',
        db.raw("'expense' as type"),
        db.raw("'vendor_purchase' as category"),
        db.raw("CONCAT('Purchase from ', vendors.name) as description"),
        db.raw('0 as amount_in'),
        'vendor_ledgers.amount as amount_out',
        db.raw("'cash' as payment_method") // Or null
      );

    let vendorReturnsQuery = db('vendor_ledgers')
      .join('vendors', 'vendor_ledgers.vendor_id', 'vendors.id')
      .where('vendor_ledgers.transaction_type', 'return')
      .select(
        'vendor_ledgers.created_at',
        db.raw("'income' as type"),
        db.raw("'vendor_return' as category"),
        db.raw("CONCAT('Return to ', vendors.name) as description"),
        'vendor_ledgers.amount as amount_in',
        db.raw('0 as amount_out'),
        db.raw("'cash' as payment_method")
      );

    // CASH FLOW (visible for tracking, does not affect income/expense totals)
    let vendorPaymentsQuery = db('vendor_ledgers')
      .join('vendors', 'vendor_ledgers.vendor_id', 'vendors.id')
      .where('vendor_ledgers.transaction_type', 'payment')
      .whereNotNull('vendor_ledgers.payment_method') // Exclude auto-applied credits
      .select(
        'vendor_ledgers.created_at',
        db.raw("'cash_flow' as type"),
        db.raw("'vendor_payment' as category"),
        db.raw("CONCAT('Payment to ', vendors.name) as description"),
        db.raw('0 as amount_in'),
        'vendor_ledgers.amount as amount_out',
        'vendor_ledgers.payment_method' // Use actual method instead of hardcoded 'cash'
      );

    let hrQuery = db('employee_payments')
      .join('employees', 'employee_payments.employee_id', 'employees.id')
      .select(
        'employee_payments.created_at',
        db.raw("'expense' as type"),
        db.raw("'salary' as category"),
        db.raw("CONCAT('Salary: ', employees.name) as description"),
        db.raw('0 as amount_in'),
        db.raw('(employee_payments.amount + COALESCE(employee_payments.bonus, 0) - COALESCE(employee_payments.deduction, 0)) as amount_out'),
        'employee_payments.payment_method'
      );

    let maintenanceQuery = db('maintenance_logs')
      .whereNotNull('repair_cost')
      .select(
        'created_at',
        db.raw("'expense' as type"),
        db.raw("'maintenance' as category"),
        db.raw("CONCAT('Maintenance: ', item_name) as description"),
        db.raw('0 as amount_in'),
        'repair_cost as amount_out',
        db.raw("'cash' as payment_method")
      );

    // Apply Date Filters
    const applyDateFilter = (query) => {
      let q = query;
      if (from) q = q.where('created_at', '>=', from);
      if (to) {
        if (to.length === 10) q = q.where('created_at', '<=', to + ' 23:59:59');
        else q = q.where('created_at', '<=', to);
      }
      return q;
    };

    // Need to specify table names for joined tables for created_at
    const applyDateFilterJoined = (query, table) => {
      let q = query;
      if (from) q = q.where(`${table}.created_at`, '>=', from);
      if (to) {
        if (to.length === 10) q = q.where(`${table}.created_at`, '<=', to + ' 23:59:59');
        else q = q.where(`${table}.created_at`, '<=', to);
      }
      return q;
    };

    orderPaymentsQuery = applyDateFilterJoined(orderPaymentsQuery, 'payments');
    packagePaymentsQuery = applyDateFilterJoined(packagePaymentsQuery, 'package_payments');
    vendorPurchasesQuery = applyDateFilterJoined(vendorPurchasesQuery, 'vendor_ledgers');
    vendorReturnsQuery = applyDateFilterJoined(vendorReturnsQuery, 'vendor_ledgers');
    vendorPaymentsQuery = applyDateFilterJoined(vendorPaymentsQuery, 'vendor_ledgers');
    hrQuery = applyDateFilterJoined(hrQuery, 'employee_payments');
    maintenanceQuery = applyDateFilter(maintenanceQuery);

    let allQueries = [];

    if (type === 'income' || type === 'all') {
      allQueries.push(orderPaymentsQuery, packagePaymentsQuery, vendorReturnsQuery);
    }
    if (type === 'expense' || type === 'all') {
      allQueries.push(vendorPurchasesQuery, hrQuery, maintenanceQuery);
    }
    if (type === 'cash_flow' || type === 'all') {
      allQueries.push(vendorPaymentsQuery);
    }

    const results = await Promise.all(allQueries);
    
    // Flatten and sort by date descending
    let flatResults = results.flat();
    flatResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(flatResults);
  } catch (error) {
    console.error('Financial Log Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
