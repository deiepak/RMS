const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/', async (req, res) => {
  try {
    const logs = await db('maintenance_logs')
      .leftJoin('vendors', 'maintenance_logs.repaired_by_vendor_id', 'vendors.id')
      .select('maintenance_logs.*', 'vendors.name as vendor_name')
      .orderBy('maintenance_logs.created_at', 'desc');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { item_name, description } = req.body;
    const [id] = await db('maintenance_logs').insert({ item_name, description });
    const log = await db('maintenance_logs').where({ id }).first();
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/repaired', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendor_id, cost, bill_number } = req.body;

    await db.transaction(async trx => {
      // 1. Update maintenance log
      await trx('maintenance_logs').where({ id }).update({
        status: 'repaired',
        repaired_by_vendor_id: vendor_id || null,
        repair_cost: cost || null,
        repaired_at: db.fn.now(),
        updated_at: db.fn.now()
      });

      // 2. If vendor and cost are provided, add to vendor ledger
      if (vendor_id && cost) {
        const log = await trx('maintenance_logs').where({ id }).first();
        await trx('vendor_ledgers').insert({
          vendor_id,
          transaction_type: 'purchase',
          amount: cost,
          bill_number: bill_number || null,
          notes: `Maintenance Repair: ${log.item_name}`
        });
      }
    });

    const updatedLog = await db('maintenance_logs')
      .leftJoin('vendors', 'maintenance_logs.repaired_by_vendor_id', 'vendors.id')
      .select('maintenance_logs.*', 'vendors.name as vendor_name')
      .where({ 'maintenance_logs.id': id }).first();
    
    res.json(updatedLog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db('maintenance_logs').where({ id: req.params.id }).del();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
