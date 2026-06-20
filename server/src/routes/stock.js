const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole(['admin', 'kitchen']));

router.get('/', async (req, res) => {
  try {
    const { low_stock, department } = req.query;
    let query = db('stock_items')
      .leftJoin('vendors', 'stock_items.vendor_id', 'vendors.id')
      .select('stock_items.*', 'vendors.name as vendor_name')
      .orderBy('stock_items.name', 'asc');

    if (low_stock === 'true') {
      query = query.whereRaw('stock_items.quantity <= stock_items.low_threshold');
    }
    if (department) {
      query = query.where('stock_items.department', department);
    }

    const items = await query;
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, vendor_id, department, name, quantity, unit, low_threshold } = req.body;
    
    if (items && Array.isArray(items) && items.length > 0) {
      const insertedItems = [];
      for (const item of items) {
        if (!item.name || !item.quantity) continue;
        const [id] = await db('stock_items').insert({ 
          name: item.name, 
          quantity: item.quantity, 
          unit: item.unit || 'kg', 
          low_threshold: item.low_threshold || 0, 
          vendor_id: vendor_id || null, 
          department: department || 'general' 
        });
        const newItem = await db('stock_items').where({ id }).first();
        insertedItems.push(newItem);
      }
      return res.status(201).json(insertedItems);
    } else {
      const [id] = await db('stock_items').insert({ 
        name, 
        quantity, 
        unit: unit || 'kg', 
        low_threshold: low_threshold || 0, 
        vendor_id: vendor_id || null, 
        department: department || 'general' 
      });
      const newItem = await db('stock_items').where({ id }).first();
      return res.status(201).json(newItem);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, unit, low_threshold, vendor_id } = req.body;
    await db('stock_items').where({ id }).update({ name, quantity, unit, low_threshold, vendor_id, updated_at: db.fn.now() });
    const updatedItem = await db('stock_items').where({ id }).first();
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.transaction(async trx => {
      // Delete child records first to satisfy foreign key constraints
      await trx('stock_transactions').where({ stock_item_id: id }).del();
      await trx('stock_menu_links').where({ stock_id: id }).del();
      // Then delete the item itself
      await trx('stock_items').where({ id }).del();
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const transactions = await db('stock_transactions')
      .leftJoin('vendors', 'stock_transactions.vendor_id', 'vendors.id')
      .where('stock_transactions.stock_item_id', id)
      .select('stock_transactions.*', 'vendors.name as vendor_name')
      .orderBy('stock_transactions.created_at', 'desc');

    // Enrich consume transactions with order details
    for (const tx of transactions) {
      if (tx.transaction_type === 'consume' && tx.notes) {
        const match = tx.notes.match(/Order #(\d+)/);
        if (match) {
          const orderId = parseInt(match[1]);
          const order = await db('orders')
            .leftJoin('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
            .where('orders.id', orderId)
            .select('orders.id', 'orders.order_type', 'orders.order_name', 'orders.status', 'orders.created_at', 'restaurant_tables.number as table_number')
            .first();
          if (order) {
            tx.order = order;
          }
        }
      }
    }

    // Also fetch linked menu items for this stock
    const links = await db('stock_menu_links')
      .join('menu_items', 'stock_menu_links.menu_item_id', 'menu_items.id')
      .where('stock_menu_links.stock_id', id)
      .select('menu_items.name as menu_item_name', 'stock_menu_links.quantity_consumed');

    // Get the stock item itself
    const stockItem = await db('stock_items')
      .leftJoin('vendors', 'stock_items.vendor_id', 'vendors.id')
      .where('stock_items.id', id)
      .select('stock_items.*', 'vendors.name as vendor_name')
      .first();

    res.json({ transactions, links, stockItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactions = await db('stock_transactions')
      .join('stock_items', 'stock_transactions.stock_item_id', 'stock_items.id')
      .leftJoin('vendors', 'stock_transactions.vendor_id', 'vendors.id')
      .select('stock_transactions.*', 'stock_items.name as item_name', 'stock_items.unit', 'vendors.name as vendor_name')
      .orderBy('stock_transactions.created_at', 'desc')
      .limit(100);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/transactions', async (req, res) => {
  try {
    const { stock_item_id, transaction_type, quantity, vendor_id, notes, cost, bill_number, items } = req.body;
    
    if (transaction_type === 'purchase' && !bill_number) {
      return res.status(400).json({ error: 'Bill number is required for purchases' });
    }
    
    // Begin transaction to ensure consistency
    await db.transaction(async trx => {
      
      if (transaction_type === 'purchase' && Array.isArray(items)) {
        // Bulk Purchase Logic
        for (const item of items) {
          const qty = Number(item.quantity);
          // 1. Insert transaction
          await trx('stock_transactions').insert({
            stock_item_id: item.stock_item_id, 
            transaction_type, 
            quantity: qty, 
            vendor_id: vendor_id || null, 
            notes, 
            bill_number: bill_number || null
          });

          // 2. Update stock item quantity
          const stockItem = await trx('stock_items').where({ id: item.stock_item_id }).first();
          if (!stockItem) throw new Error(`Stock item ${item.stock_item_id} not found`);

          await trx('stock_items')
            .where({ id: item.stock_item_id })
            .update({ quantity: Number(stockItem.quantity) + qty, updated_at: db.fn.now() });
        }

        // 3. Update vendor ledger once for the whole bill
        if (vendor_id && cost) {
          await trx('vendor_ledgers').insert({
            vendor_id,
            transaction_type: 'purchase',
            amount: cost,
            bill_number: bill_number || null,
            notes: `Bulk Purchase (${items.length} items)` + (notes ? ` - ${notes}` : '')
          });
        }
      } else {
        // Single Item Logic (Consume, Damage, Return)
        // 1. Insert transaction
        await trx('stock_transactions').insert({
          stock_item_id, transaction_type, quantity, vendor_id: vendor_id || null, notes, bill_number: bill_number || null
        });

        // 2. Update stock item quantity
        const item = await trx('stock_items').where({ id: stock_item_id }).first();
        if (!item) throw new Error('Stock item not found');

        let newQuantity = Number(item.quantity);
        if (transaction_type === 'damage' || transaction_type === 'consume' || transaction_type === 'return') {
          newQuantity -= Number(quantity);
        }
        
        await trx('stock_items').where({ id: stock_item_id }).update({ quantity: newQuantity, updated_at: db.fn.now() });

        // 3. If return and cost is provided, log as return to credit the ledger
        if (transaction_type === 'return' && vendor_id && cost) {
          await trx('vendor_ledgers').insert({
            vendor_id,
            transaction_type: 'return',
            amount: cost,
            linked_bill_id: req.body.linked_bill_id || null,
            notes: `Returned ${quantity} ${item.unit} of ${item.name}` + (notes ? ` - ${notes}` : '')
          });
        }
      }
    });

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/links', async (req, res) => {
  try {
    const { id } = req.params;
    const links = await db('stock_menu_links')
      .where({ stock_id: id })
      .select('*');
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/links', async (req, res) => {
  try {
    const { id } = req.params;
    const { links } = req.body; // Array of { menu_item_id, quantity_consumed }
    
    await db.transaction(async trx => {
      // 1. Delete existing links for this stock item
      await trx('stock_menu_links').where({ stock_id: id }).del();
      
      // 2. Insert new links
      if (Array.isArray(links) && links.length > 0) {
        const insertData = links.map(link => ({
          stock_id: id,
          menu_item_id: link.menu_item_id,
          quantity_consumed: link.quantity_consumed
        }));
        await trx('stock_menu_links').insert(insertData);
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
