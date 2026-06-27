const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;

    let purchaseQuery = db('vendor_ledgers')
      .where('transaction_type', 'purchase')
      .whereNot('notes', 'like', 'Maintenance Repair:%')
      .whereNot('notes', 'like', 'Custom Expense%');
    let hrQuery = db('employee_payments');
    let maintenanceQuery = db('maintenance_logs').whereNotNull('repair_cost');
    let customQuery = db('expense_logs');

    if (from) {
      purchaseQuery = purchaseQuery.where('created_at', '>=', from);
      hrQuery = hrQuery.where('created_at', '>=', from);
      maintenanceQuery = maintenanceQuery.where('created_at', '>=', from);
      customQuery = customQuery.where('created_at', '>=', from);
    }
    if (to) {
      purchaseQuery = purchaseQuery.where('created_at', '<=', to);
      hrQuery = hrQuery.where('created_at', '<=', to);
      maintenanceQuery = maintenanceQuery.where('created_at', '<=', to);
      customQuery = customQuery.where('created_at', '<=', to);
    }

    const [purchases, hrs, maintenances, customs] = await Promise.all([
      purchaseQuery.sum('amount as total').count('* as count'),
      hrQuery.sum('amount as total').count('* as count'),
      maintenanceQuery.sum('repair_cost as total').count('* as count'),
      customQuery.sum('amount as total').count('* as count'),
    ]);

    const purchaseTotal = parseFloat(purchases[0].total || 0);
    const hrTotal = parseFloat(hrs[0].total || 0);
    const maintenanceTotal = parseFloat(maintenances[0].total || 0);
    const customTotal = parseFloat(customs[0].total || 0);

    res.json({
      total: purchaseTotal + hrTotal + maintenanceTotal + customTotal,
      breakdown: {
        purchases: { total: purchaseTotal, count: purchases[0].count },
        hr: { total: hrTotal, count: hrs[0].count },
        maintenance: { total: maintenanceTotal, count: maintenances[0].count },
        custom: { total: customTotal, count: customs[0].count },
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/daily', async (req, res) => {
  try {
    const { from, to } = req.query;

    let purchaseQuery = db('vendor_ledgers')
      .where('transaction_type', 'purchase')
      .whereNot('notes', 'like', 'Maintenance Repair:%')
      .whereNot('notes', 'like', 'Custom Expense%')
      .select('created_at', 'amount as total', db.raw("'purchase' as category"));
    let hrQuery = db('employee_payments').select('created_at', 'amount as total', db.raw("'hr' as category"));
    let maintenanceQuery = db('maintenance_logs').whereNotNull('repair_cost').select('created_at', 'repair_cost as total', db.raw("'maintenance' as category"));
    let customQuery = db('expense_logs').select('created_at', 'amount as total', db.raw("'custom' as category"));

    if (from) {
      purchaseQuery = purchaseQuery.where('created_at', '>=', from);
      hrQuery = hrQuery.where('created_at', '>=', from);
      maintenanceQuery = maintenanceQuery.where('created_at', '>=', from);
      customQuery = customQuery.where('created_at', '>=', from);
    }
    if (to) {
      purchaseQuery = purchaseQuery.where('created_at', '<=', to);
      hrQuery = hrQuery.where('created_at', '<=', to);
      maintenanceQuery = maintenanceQuery.where('created_at', '<=', to);
      customQuery = customQuery.where('created_at', '<=', to);
    }

    const [purchases, hrs, maintenances, customs] = await Promise.all([purchaseQuery, hrQuery, maintenanceQuery, customQuery]);

    const allExpenses = [...purchases, ...hrs, ...maintenances, ...customs];

    // Group by date
    const dailyMap = {};
    allExpenses.forEach(exp => {
      const dateObj = new Date(exp.created_at);
      if (isNaN(dateObj.getTime())) return;
      const date = dateObj.toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, purchase: 0, hr: 0, maintenance: 0, custom: 0, total: 0 };
      }
      const val = parseFloat(exp.total || 0);
      dailyMap[date][exp.category] += val;
      dailyMap[date].total += val;
    });

    const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    res.json(dailyData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/custom', async (req, res) => {
  try {
    const { category, amount, payment_method, description, vendor_id, recorded_by } = req.body;
    if (!vendor_id) {
      return res.status(400).json({ error: 'Vendor is required. No vendor means no payment.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is compulsory.' });
    }
    if (!category || !amount) {
      return res.status(400).json({ error: 'Category and amount are required.' });
    }
    
    await db.transaction(async trx => {
      await trx('expense_logs').insert({
        category,
        amount,
        payment_method,
        description,
        vendor_id,
        recorded_by
      });
      
      await trx('vendor_ledgers').insert({
        vendor_id,
        transaction_type: 'purchase',
        amount,
        bill_number: null,
        notes: `Custom Expense (${category}): ${description}`
      });
    });
    
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
