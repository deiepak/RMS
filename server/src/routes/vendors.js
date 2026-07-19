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
    
    // Auto-apply unlinked advances AND overpaid bills to oldest unpaid bills on-the-fly
    let totalAdvances = advances.reduce((sum, a) => sum + Number(a.amount), 0);
    
    // Pool overpaid bills into advances
    for (let bill of bills) {
      if (bill.remaining < 0) {
        totalAdvances += Math.abs(bill.remaining);
        bill.paid += bill.remaining; // Adjust paid down so remaining becomes 0
        bill.remaining = 0;
      }
    }

    const oldestBillsFirst = [...bills].reverse();
    for (let bill of oldestBillsFirst) {
      if (bill.remaining > 0 && totalAdvances > 0) {
        const applyAmount = Math.min(bill.remaining, totalAdvances);
        bill.paid += applyAmount;
        bill.remaining -= applyAmount;
        totalAdvances -= applyAmount;
      }
    }

    res.json({ ledger: finalLedger, current_balance: balance, bills, advances });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/ledger', async (req, res) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const { amount, payment_method, reference_id, notes, selected_bill_ids } = req.body;
    
    let remainingPayment = Number(amount);
    
    if (selected_bill_ids && Array.isArray(selected_bill_ids) && selected_bill_ids.length > 0) {
      // 1. Calculate the current remaining balances of all bills for this vendor
      const ledger = await trx('vendor_ledgers').where({ vendor_id: id }).orderBy('created_at', 'desc');
      const chronologicalLedger = [...ledger].reverse();
      const finalLedger = chronologicalLedger.reverse();
      
      const bills = finalLedger.filter(e => e.transaction_type === 'purchase').map(b => ({ ...b, paid: 0, remaining: Number(b.amount) }));
      const advances = [];

      for (let entry of finalLedger) {
        if (entry.transaction_type === 'payment' || entry.transaction_type === 'return') {
          if (entry.linked_bill_id) {
            const bill = bills.find(b => b.id === entry.linked_bill_id);
            if (bill) {
              bill.paid += Number(entry.amount);
              bill.remaining -= Number(entry.amount);
            }
          } else {
            advances.push(entry);
          }
        }
      }

      let totalAdvances = advances.reduce((sum, a) => sum + Number(a.amount), 0);
      for (let bill of bills) {
        if (bill.remaining < 0) {
          totalAdvances += Math.abs(bill.remaining);
          bill.remaining = 0;
        }
      }
      const oldestBillsFirst = [...bills].reverse();
      for (let bill of oldestBillsFirst) {
        if (bill.remaining > 0 && totalAdvances > 0) {
          const applyAmount = Math.min(bill.remaining, totalAdvances);
          bill.remaining -= applyAmount;
          totalAdvances -= applyAmount;
        }
      }

      // 2. Map selected bill IDs to their remaining balances
      const selectedBills = bills.filter(b => selected_bill_ids.includes(b.id)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // Oldest first
      
      const insertedEntries = [];
      
      // 3. Cascade payment over selected bills
      for (let bill of selectedBills) {
        if (remainingPayment <= 0) break;
        if (bill.remaining <= 0) continue;
        
        const amountToApply = Math.min(bill.remaining, remainingPayment);
        const [entryId] = await trx('vendor_ledgers').insert({
          vendor_id: id,
          transaction_type: 'payment',
          amount: amountToApply,
          payment_method,
          reference_id,
          notes: notes || `Bulk payment applied to bill #${bill.id}`,
          linked_bill_id: bill.id
        });
        insertedEntries.push(entryId);
        remainingPayment -= amountToApply;
      }
      
      // 4. If any payment amount is left over, insert as an unlinked advance payment
      if (remainingPayment > 0) {
        const [entryId] = await trx('vendor_ledgers').insert({
          vendor_id: id,
          transaction_type: 'payment',
          amount: remainingPayment,
          payment_method,
          reference_id,
          notes: notes ? `${notes} (Leftover Advance)` : 'Advance from bulk payment',
          linked_bill_id: null
        });
        insertedEntries.push(entryId);
      }
      
      await trx.commit();
      res.status(201).json({ message: 'Bulk payment processed', inserted_entries: insertedEntries });
    } else {
      // Fallback for single standard payment
      const [entryId] = await trx('vendor_ledgers').insert({
        vendor_id: id,
        transaction_type: 'payment',
        amount,
        payment_method,
        reference_id,
        notes,
        linked_bill_id: null
      });
      await trx.commit();
      const newEntry = await db('vendor_ledgers').where({ id: entryId }).first();
      res.status(201).json(newEntry);
    }
  } catch (error) {
    await trx.rollback();
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
