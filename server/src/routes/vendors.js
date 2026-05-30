const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/', async (req, res) => {
  try {
    const vendors = await db('vendors').select('*').orderBy('created_at', 'desc');
    
    // Add linked items count
    for (let vendor of vendors) {
      const result = await db('stock_items').count('id as count').where('vendor_id', vendor.id).first();
      vendor.linked_items_count = result.count;
    }
    
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, contact, email, address, notes } = req.body;
    const [id] = await db('vendors').insert({ name, contact, email, address, notes });
    const newVendor = await db('vendors').where({ id }).first();
    res.status(201).json(newVendor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact, email, address, notes } = req.body;
    await db('vendors').where({ id }).update({ name, contact, email, address, notes, updated_at: db.fn.now() });
    const updatedVendor = await db('vendors').where({ id }).first();
    res.json(updatedVendor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('vendors').where({ id }).del();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/ledger', async (req, res) => {
  try {
    const { id } = req.params;
    const ledger = await db('vendor_ledgers').where({ vendor_id: id }).orderBy('created_at', 'desc');
    
    // Calculate running balance: Purchases add to balance owed, Payments reduce it.
    let balance = 0;
    // To calculate balance properly, we should iterate chronologically (oldest first).
    const chronologicalLedger = [...ledger].reverse();
    for (let entry of chronologicalLedger) {
      if (entry.transaction_type === 'purchase') balance += Number(entry.amount);
      if (entry.transaction_type === 'payment' || entry.transaction_type === 'return') balance -= Number(entry.amount);
      entry.balance = balance;
    }
    // Reverse it back for newest first
    const finalLedger = chronologicalLedger.reverse();

    // Group into bills
    const bills = finalLedger.filter(e => e.transaction_type === 'purchase').map(b => ({ ...b, paid: 0, remaining: Number(b.amount), linked_transactions: [] }));
    const advances = [];

    for (let entry of finalLedger) {
      if (entry.transaction_type === 'payment' || entry.transaction_type === 'return') {
        if (entry.linked_bill_id) {
          const bill = bills.find(b => b.id === entry.linked_bill_id);
          if (bill) {
            bill.paid += Number(entry.amount);
            bill.remaining -= Number(entry.amount);
            bill.linked_transactions.push(entry);
          }
        } else {
          advances.push(entry);
        }
      }
    }
    
    res.json({ ledger: finalLedger, current_balance: balance, bills, advances });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/ledger', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_method, reference_id, notes, linked_bill_id } = req.body;
    
    const [entryId] = await db('vendor_ledgers').insert({
      vendor_id: id,
      transaction_type: 'payment',
      amount,
      payment_method,
      reference_id,
      notes,
      linked_bill_id: linked_bill_id || null
    });
    
    const newEntry = await db('vendor_ledgers').where({ id: entryId }).first();
    res.status(201).json(newEntry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
