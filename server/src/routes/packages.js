const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(['admin']));

// GET /api/packages - list all packages
router.get('/', async (req, res) => {
  try {
    const packages = await db('packages').orderBy('created_at', 'desc');
    
    // Attach total payments
    for (let pkg of packages) {
      const payments = await db('package_payments').where({ package_id: pkg.id });
      pkg.paid_amount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    }
    
    res.json(packages);
  } catch (err) {
    console.error('Packages list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/packages/:id - single package with items and payments
router.get('/:id', async (req, res) => {
  try {
    const pkg = await db('packages').where({ id: req.params.id }).first();
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    pkg.items = await db('package_items').where({ package_id: pkg.id });
    pkg.payments = await db('package_payments').where({ package_id: pkg.id }).orderBy('created_at', 'desc');
    
    res.json(pkg);
  } catch (err) {
    console.error('Package fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/packages - create new package
router.post('/', async (req, res) => {
  try {
    const { title, customer_name, contact, event_date, notes, items } = req.body;
    
    if (!title || !customer_name || !items || !items.length) {
      return res.status(400).json({ error: 'Title, customer name, and items are required.' });
    }

    const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.price_per_unit)), 0);

    let packageId;
    await db.transaction(async trx => {
      const [id] = await trx('packages').insert({
        title, customer_name, contact: contact || null, 
        event_date: event_date || null, notes: notes || null, 
        total_amount, status: 'active'
      });
      packageId = id;

      const itemsToInsert = items.map(item => ({
        package_id: id,
        description: item.description,
        quantity: item.quantity,
        price_per_unit: item.price_per_unit,
        total: parseFloat(item.quantity) * parseFloat(item.price_per_unit)
      }));

      await trx('package_items').insert(itemsToInsert);
    });

    const newPackage = await db('packages').where({ id: packageId }).first();
    res.status(201).json(newPackage);
  } catch (err) {
    console.error('Package create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/packages/:id/payments - add payment
router.post('/:id/payments', async (req, res) => {
  try {
    const { amount, payment_method, notes } = req.body;
    
    if (!amount || !payment_method) {
      return res.status(400).json({ error: 'Amount and payment method are required.' });
    }

    await db('package_payments').insert({
      package_id: req.params.id,
      amount,
      payment_method,
      notes: notes || null
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Package payment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/packages/:id
router.delete('/:id', async (req, res) => {
  try {
    await db('packages').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error('Package delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
