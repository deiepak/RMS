const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Allow public access to validate
router.post('/validate', async (req, res) => {
  try {
    const { code, order_total } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    const promo = await db('promo_codes')
      .where({ code: code.toUpperCase(), is_active: true })
      .first();

    if (!promo) {
      return res.status(404).json({ error: 'Invalid or inactive promo code' });
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Promo code has expired' });
    }

    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      return res.status(400).json({ error: 'Promo code usage limit reached' });
    }

    if (order_total < promo.min_order) {
      return res.status(400).json({ error: `Minimum order amount of ${promo.min_order} required` });
    }

    let discount_amount = 0;
    if (promo.type === 'percent') {
      discount_amount = (order_total * promo.value) / 100;
    } else if (promo.type === 'flat') {
      discount_amount = promo.value;
    }

    res.json({
      id: promo.id,
      code: promo.code,
      discount_amount: Math.min(discount_amount, order_total) // Cap discount at order total
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin only routes below
router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/', async (req, res) => {
  try {
    const promos = await db('promo_codes').orderBy('created_at', 'desc');
    res.json(promos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { code, type, value, min_order, max_uses, expires_at } = req.body;
    const [id] = await db('promo_codes').insert({
      code: code.toUpperCase(),
      type,
      value,
      min_order: min_order || 0,
      max_uses: max_uses || 0,
      expires_at: expires_at || null
    });
    const newPromo = await db('promo_codes').where({ id }).first();
    res.status(201).json(newPromo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, value, min_order, max_uses, expires_at } = req.body;
    await db('promo_codes').where({ id }).update({
      code: code.toUpperCase(),
      type,
      value,
      min_order: min_order || 0,
      max_uses: max_uses || 0,
      expires_at: expires_at || null
    });
    const updatedPromo = await db('promo_codes').where({ id }).first();
    res.json(updatedPromo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await db('promo_codes').where({ id }).first();
    if (!promo) {
      return res.status(404).json({ error: 'Promo not found' });
    }
    
    await db('promo_codes').where({ id }).update({ is_active: !promo.is_active });
    res.json({ success: true, is_active: !promo.is_active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('promo_codes').where({ id }).del();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
