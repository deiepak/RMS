const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();



// Helper: recalculate order totals
async function recalculateOrderTotals(orderId) {
  const items = await db('order_items')
    .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
    .where('order_items.order_id', orderId)
    .whereNot('order_items.status', 'rejected')
    .select('order_items.price_at_order', 'menu_items.price', 'order_items.quantity');

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price_at_order || item.price) * item.quantity), 0);

  // Check for promo discount
  const order = await db('orders').where({ id: orderId }).first();
  let discount = 0;
  if (order.promo_code_id) {
    const promo = await db('promo_codes').where({ id: order.promo_code_id }).first();
    if (promo) {
      if (promo.type === 'percent') {
        discount = (subtotal * parseFloat(promo.value)) / 100;
      } else {
        discount = parseFloat(promo.value);
      }
    }
  }

  const afterDiscount = Math.max(subtotal - discount, 0);
  const total = parseFloat((afterDiscount + parseFloat(order.tip_amount || 0)).toFixed(2));

  await db('orders').where({ id: orderId }).update({
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    tax: 0, // Tax is intentionally zero — no tax regime configured. Update recalculateOrderTotals if tax is ever needed.
    total,
    updated_at: db.fn.now(),
  });

  return { subtotal, discount, tax: 0, total };
}

// POST /api/orders - create order
router.post('/', async (req, res) => {
  try {
    const { table_id, customer_name, items, order_type } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ error: 'items are required.' });
    }

    let table = null;
    let order_name = null;

    if (order_type !== 'counter') {
      if (!table_id) return res.status(400).json({ error: 'table_id is required for table orders.' });
      table = await db('restaurant_tables').where({ id: table_id }).first();
      if (!table) return res.status(404).json({ error: 'Table not found.' });
    } else {
      // Generate counter order name for today
      const today = new Date().toISOString().split('T')[0];
      const countResult = await db('orders')
        .where('order_type', 'counter')
        .whereRaw('DATE(created_at) = ?', [today])
        .count('* as cnt');
      const nextNum = (countResult[0].cnt || 0) + 1;
      order_name = `Counter Order ${nextNum}`;
    }

    // Create order
    const [orderId] = await db('orders').insert({
      table_id: table_id || null,
      order_type: order_type || 'table',
      order_name,
      status: 'active',
    });

    // Create order items
    // Fetch menu prices to store as price_at_order
    const menuItemIds = items.map(i => i.menu_item_id);
    const menuPrices = await db('menu_items').whereIn('id', menuItemIds).select('id', 'price');
    const priceMap = {};
    menuPrices.forEach(m => { priceMap[m.id] = parseFloat(m.price); });

    const orderItems = items.map((item) => ({
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity || 1,
      customer_name: item.customer_name || customer_name || 'Guest',
      notes: item.notes || null,
      status: 'pending',
      price_at_order: item.price_at_order || priceMap[item.menu_item_id] || 0,
    }));

    await db('order_items').insert(orderItems);

    // Update table status if it is a table order
    if (table_id) {
      await db('restaurant_tables').where({ id: table_id }).update({ status: 'occupied', updated_at: db.fn.now() });
    }

    // Calculate totals
    await recalculateOrderTotals(orderId);

    // Fetch full order
    const order = await db('orders').where({ id: orderId }).first();
    const fullItems = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .leftJoin('menu_categories', 'menu_items.category_id', 'menu_categories.id')
      .where('order_items.order_id', orderId)
      .select('order_items.*', 'menu_items.name as item_name', 'menu_items.name_np as item_name_np', 'menu_items.price', 'menu_items.station_ids', 'menu_categories.station_ids as category_station_ids');

    // Emit to kitchen
    const io = req.app.get('io');
    if (io) {
      io.emit('order:new', { 
        ...order, 
        items: fullItems, 
        table_number: table ? table.number : order_name,
        source: req.user?.role || 'unknown'
      });
    }

    res.status(201).json({ order, items: fullItems });
  } catch (err) {
    console.error('Order create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/orders - list orders with filters
router.get('/', async (req, res) => {
  try {
    const query = db('orders')
      .leftJoin('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .leftJoin('promo_codes', 'orders.promo_code_id', 'promo_codes.id')
      .select('orders.*', 'restaurant_tables.number as table_number', 'restaurant_tables.section', 'promo_codes.code as promo_code_name');

    if (req.query.status) {
      const statuses = req.query.status.split(',');
      if (req.query.include_undelivered === 'true') {
        query.where(function() {
          this.whereIn('orders.status', statuses)
            .orWhere(function() {
              this.whereIn('orders.status', ['completed'])
                .whereRaw('orders.updated_at >= DATE_SUB(NOW(), INTERVAL 5 HOUR)')
                .whereExists(function() {
                  this.select(1)
                    .from('order_items')
                    .whereRaw('order_items.order_id = orders.id')
                    .whereIn('order_items.status', ['pending', 'accepted', 'preparing', 'prepared', 'picked_up']);
                });
            });
        });
      } else {
        query.whereIn('orders.status', statuses);
      }
    }
    if (req.query.table_id) {
      query.where('orders.table_id', req.query.table_id);
    }
    if (req.query.date) {
      query.where(function() {
        this.whereRaw('DATE(orders.created_at) = ?', [req.query.date])
            .orWhereNotIn('orders.status', ['completed', 'cancelled', 'merged']);
      });
    }
    if (req.query.from) {
      query.where('orders.created_at', '>=', req.query.from);
    }
    if (req.query.to) {
      query.where('orders.created_at', '<=', req.query.to);
    }

    // Safety limit to prevent memory crashes when fetching all history (date cleared)
    if (!req.query.date && !req.query.from && !req.query.status && !req.query.table_id) {
      query.limit(200);
    }

    query.orderBy('orders.created_at', 'desc');
    const orders = await query;

      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const allItems = await db('order_items')
          .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
          .leftJoin('menu_categories', 'menu_items.category_id', 'menu_categories.id')
          .whereIn('order_items.order_id', orderIds)
          .select(
            'order_items.*', 
            'menu_items.name as item_name', 
            'menu_items.name_np as item_name_np', 
            'menu_items.price', 
            'menu_items.station_ids', 
            'menu_categories.name as category_name',
            'menu_categories.station_ids as category_station_ids'
          );

      const itemsByOrderId = {};
      for (const item of allItems) {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push(item);
      }

      for (const order of orders) {
        order.items = itemsByOrderId[order.id] || [];
      }
    } else {
      for (const order of orders) {
        order.items = [];
      }
    }

    res.json(orders);
  } catch (err) {
    console.error('Orders list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/orders/cancel-discount-report - fetch cancelled and discounted orders with details
router.get('/cancel-discount-report', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { from, to, discount_reason, custom_type } = req.query;

    let cancelledQuery = db('orders')
      .leftJoin('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .leftJoin('order_items', 'orders.id', 'order_items.order_id')
      .where(function() {
        this.where('orders.status', 'cancelled')
            .orWhere('order_items.status', 'rejected')
            .orWhere('order_items.status', 'cancelled');
      })
      .select('orders.*', 'restaurant_tables.number as table_number')
      .distinct();

    let discountedQuery = db('orders')
      .leftJoin('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .where('orders.discount', '>', 0)
      .select('orders.*', 'restaurant_tables.number as table_number');

    if (from) {
      cancelledQuery = cancelledQuery.where(function() {
        this.where('orders.updated_at', '>=', from).orWhere('orders.created_at', '>=', from);
      });
      discountedQuery = discountedQuery.where(function() {
        this.where('orders.updated_at', '>=', from).orWhere('orders.created_at', '>=', from);
      });
    }
    if (to) {
      cancelledQuery = cancelledQuery.where(function() {
        this.where('orders.updated_at', '<=', to).orWhere('orders.created_at', '<=', to);
      });
      discountedQuery = discountedQuery.where(function() {
        this.where('orders.updated_at', '<=', to).orWhere('orders.created_at', '<=', to);
      });
    }

    if (discount_reason && discount_reason !== 'all') {
      if (discount_reason === 'Custom') {
        discountedQuery = discountedQuery.where('orders.discount_reason', 'like', 'Custom:%');
      } else {
        discountedQuery = discountedQuery.where('orders.discount_reason', discount_reason);
      }
    }

    const [cancelledOrders, discountedOrders] = await Promise.all([cancelledQuery, discountedQuery]);

    // Fetch order items for all matching orders to get full details and rejection/cancellation reasons
    const allOrderIds = [...new Set([...cancelledOrders.map(o => o.id), ...discountedOrders.map(o => o.id)])];
    let allItems = [];
    if (allOrderIds.length > 0) {
      allItems = await db('order_items')
        .leftJoin('menu_items', 'order_items.menu_item_id', 'menu_items.id')
        .whereIn('order_items.order_id', allOrderIds)
        .select('order_items.*', 'menu_items.name as item_name', 'menu_items.price as item_price');
    }

    // Attach items and derive cancel reason
    cancelledOrders.forEach(order => {
      const items = allItems.filter(i => i.order_id === order.id);
      order.items = items;
      const reasons = items.filter(i => i.status === 'rejected' || i.status === 'cancelled' || order.status === 'cancelled')
                           .map(i => i.reject_reason || i.notes).filter(Boolean);
      order.cancel_reason = reasons.length > 0 ? reasons.join(', ') : (order.status === 'cancelled' ? 'Cancelled by Kitchen / Admin' : 'Item(s) cancelled/rejected by Kitchen');
      if (order.discount_reason?.startsWith('Custom:')) {
        order.custom_discount_type = order.discount_reason.split('Custom:')[1].trim();
      }
    });

    // Attach custom discount type logic for discounted orders
    discountedOrders.forEach(order => {
      const items = allItems.filter(i => i.order_id === order.id);
      order.items = items;
      if (order.discount_reason?.startsWith('Custom:')) {
        order.custom_discount_type = order.discount_reason.split('Custom:')[1].trim();
      }
    });

    // Filter by custom_type if specified
    let finalDiscounted = discountedOrders;
    if (discount_reason === 'Custom' && custom_type) {
      finalDiscounted = discountedOrders.filter(o => o.custom_discount_type?.toLowerCase().includes(custom_type.toLowerCase()));
    }

    // Sort descending by date
    cancelledOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    finalDiscounted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ cancelled: cancelledOrders, discounted: finalDiscounted });
  } catch (err) {
    console.error('Cancel discount report error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/orders/:id - single order
router.get('/:id', async (req, res) => {
  try {
    const order = await db('orders')
      .leftJoin('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .leftJoin('promo_codes', 'orders.promo_code_id', 'promo_codes.id')
      .where('orders.id', req.params.id)
      .select('orders.*', 'restaurant_tables.number as table_number', 'restaurant_tables.section', 'promo_codes.code as promo_code_name')
      .first();

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    order.items = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .leftJoin('menu_categories', 'menu_items.category_id', 'menu_categories.id')
      .where('order_items.order_id', order.id)
      .select('order_items.*', 'menu_items.name as item_name', 'menu_items.name_np as item_name_np', 'menu_items.price', 'menu_items.station_ids', 'menu_categories.name as category_name');

    order.sales_returns = await db('sales_return_logs').where('order_id', order.id);

    res.json(order);
  } catch (err) {
    console.error('Order get error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/orders/table/:tableId/active - active order for a table
router.get('/table/:tableId/active', async (req, res) => {
  try {
    const order = await db('orders')
      .join('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .leftJoin('promo_codes', 'orders.promo_code_id', 'promo_codes.id')
      .where('orders.table_id', req.params.tableId)
      .whereIn('orders.status', ['active', 'checkout_requested', 'payment_ready', 'hold'])
      .orderBy('orders.created_at', 'desc')
      .select('orders.*', 'restaurant_tables.number as table_number', 'restaurant_tables.section', 'promo_codes.code as promo_code_name')
      .first();

    if (!order) {
      return res.json(null);
    }

    order.items = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .where('order_items.order_id', order.id)
      .select('order_items.*', 'menu_items.name as item_name', 'menu_items.name_np as item_name_np', 'menu_items.price', 'menu_items.station_ids');

    res.json(order);
  } catch (err) {
    console.error('Active order get error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/orders/:id/items - add more items
router.post('/:id/items', async (req, res) => {
  try {
    const { items, customer_name } = req.body;
    const orderId = req.params.id;

    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot add items to a completed or cancelled order.' });
    }

    // Fetch menu prices to store as price_at_order
    const menuItemIds = items.map(i => i.menu_item_id);
    const menuPrices = await db('menu_items').whereIn('id', menuItemIds).select('id', 'price');
    const priceMap = {};
    menuPrices.forEach(m => { priceMap[m.id] = parseFloat(m.price); });

    const newItems = items.map((item) => ({
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity || 1,
      customer_name: item.customer_name || customer_name || 'Guest',
      notes: item.notes || null,
      status: 'pending',
      price_at_order: item.price_at_order || priceMap[item.menu_item_id] || 0,
    }));

    await db('order_items').insert(newItems);
    await recalculateOrderTotals(orderId);

    const table = await db('restaurant_tables').where({ id: order.table_id }).first();

    // Fetch updated items
    const fullItems = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .leftJoin('menu_categories', 'menu_items.category_id', 'menu_categories.id')
      .where('order_items.order_id', orderId)
      .select('order_items.*', 'menu_items.name as item_name', 'menu_items.name_np as item_name_np', 'menu_items.price', 'menu_items.station_ids', 'menu_categories.station_ids as category_station_ids');

    const updatedOrder = await db('orders').where({ id: orderId }).first();

    const io = req.app.get('io');
    if (io) {
      // Only emit the newly added items to prevent the kitchen from speaking the entire order again
      const sortedItems = [...fullItems].sort((a, b) => b.id - a.id);
      const recentlyAddedItems = sortedItems.slice(0, newItems.length);
      io.emit('order:update', { orderId: orderId, items: fullItems });
      io.emit('order:new', { 
        ...updatedOrder, 
        items: recentlyAddedItems,
        table_number: table?.number || updatedOrder.order_name,
        source: req.user?.role || 'unknown'
      });
    }

    res.json({ order: updatedOrder, items: fullItems });
  } catch (err) {
    console.error('Add items error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/items/mark-printed
router.patch('/items/mark-printed', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { itemIds } = req.body;
    if (!itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds array is required.' });
    }
    await db('order_items').whereIn('id', itemIds).update({ is_printed: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Mark printed error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/items/:itemId/status - update item status
router.patch('/items/:itemId/status', async (req, res) => {
  try {
    const { status, reject_reason, assigned_waiter } = req.body;
    const { itemId } = req.params;

    const item = await db('order_items').where({ id: itemId }).first();
    if (!item) {
      return res.status(404).json({ error: 'Order item not found.' });
    }

    const updateData = { status, updated_at: db.fn.now() };
    if (reject_reason) updateData.reject_reason = reject_reason;
    if (assigned_waiter) updateData.assigned_waiter = assigned_waiter;

    await db('order_items').where({ id: itemId }).update(updateData);

    // Recalculate if rejected
    if (status === 'rejected') {
      await recalculateOrderTotals(item.order_id);
    }
    
    // Deduct stock if status changed to delivered
    if (status === 'delivered' && item.status !== 'delivered') {
      const links = await db('stock_menu_links').where({ menu_item_id: item.menu_item_id });
      if (links.length > 0) {
        await db.transaction(async trx => {
          for (const link of links) {
            const deduction = link.quantity_consumed * item.quantity;
            
            await trx('stock_transactions').insert({
              stock_item_id: link.stock_id,
              transaction_type: 'consume',
              quantity: deduction,
              notes: `Auto-deducted for Order #${item.order_id}`
            });

            const stockItem = await trx('stock_items').where({ id: link.stock_id }).first();
            if (stockItem) {
              await trx('stock_items')
                .where({ id: link.stock_id })
                .update({ 
                  quantity: Number(stockItem.quantity) - deduction, 
                  updated_at: db.fn.now() 
                });
            }
          }
        });
      }
    }

    const updatedItem = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .where('order_items.id', itemId)
      .select('order_items.*', 'menu_items.name as item_name', 'menu_items.name_np as item_name_np', 'menu_items.price', 'menu_items.station_ids')
      .first();

    const order = await db('orders').where({ id: item.order_id }).first();
    const table = order.table_id ? await db('restaurant_tables').where({ id: order.table_id }).first() : null;
    const tableRoom = table ? `table-${table.number}` : null;

    // Check if all items are rejected or cancelled
    if (status === 'rejected' || status === 'cancelled') {
      const allOrderItems = await db('order_items').where({ order_id: item.order_id });
      const allCancelledOrRejected = allOrderItems.every(i => i.status === 'rejected' || i.status === 'cancelled');
      
      if (allCancelledOrRejected && order.status !== 'cancelled' && order.status !== 'completed') {
        // Auto-cancel the order
        await db('orders').where({ id: order.id }).update({ status: 'cancelled', updated_at: db.fn.now() });
        if (order.table_id) {
          await db('restaurant_tables').where({ id: order.table_id }).update({ status: 'available', updated_at: db.fn.now() });
        }
      }
    }

    const io = req.app.get('io');
    if (io) {
      // Always emit to the table room
      if (tableRoom) io.to(tableRoom).emit('order:item-status', updatedItem);
      // Emit to kitchen so they can update UI or announce cancellation
      io.emit('order:item-status', updatedItem);

      // Additional emissions based on status
      if (status === 'prepared' && table) {
        io.to('waiter').emit('order:ready-for-pickup', {
          item: updatedItem,
          table_number: table.number,
          order_id: item.order_id,
        });
      }
    }

    res.json(updatedItem);
  } catch (err) {
    console.error('Item status update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/:id/checkout - request checkout
router.patch('/:id/checkout', async (req, res) => {
  try {
    const { tip_amount } = req.body;
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const updates = {
      status: 'checkout_requested',
      updated_at: db.fn.now(),
    };
    
    if (tip_amount !== undefined) {
      updates.tip_amount = parseFloat(tip_amount) || 0;
    }

    await db('orders').where({ id: req.params.id }).update(updates);
    
    if (tip_amount !== undefined) {
      await recalculateOrderTotals(req.params.id);
    }

    const updatedOrder = await db('orders').where({ id: req.params.id }).first();
    let table_number = order.order_name || null;
    if (order.table_id) {
      const table = await db('restaurant_tables').where({ id: order.table_id }).first();
      if (table) table_number = table.number;
    }

    const io = req.app.get('io');
    if (io) {
      io.to('waiter').emit('order:checkout-requested', {
        order: updatedOrder,
        table_number,
      });
    }

    res.json(updatedOrder);
  } catch (err) {
    console.error('Checkout request error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/:id/hold - hold order
router.patch('/:id/hold', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    await db('orders').where({ id: req.params.id }).update({ status: 'hold', updated_at: db.fn.now() });
    
    let table_number = order.order_name || null;
    if (order.table_id) {
      const table = await db('restaurant_tables').where({ id: order.table_id }).first();
      if (table) table_number = table.number;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order:hold', { order_id: order.id, table_number });
    }
    res.json({ success: true, status: 'hold' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/:id/unhold - unhold order
router.patch('/:id/unhold', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    await db('orders').where({ id: req.params.id }).update({ status: 'active', updated_at: db.fn.now() });
    
    let table_number = order.order_name || null;
    if (order.table_id) {
      const table = await db('restaurant_tables').where({ id: order.table_id }).first();
      if (table) table_number = table.number;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order:unhold', { order_id: order.id, table_number });
    }
    res.json({ success: true, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/:id/assign-table - assign counter order to a table
router.patch('/:id/assign-table', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { table_id } = req.body;
    if (!table_id) return res.status(400).json({ error: 'table_id is required' });

    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.order_type !== 'counter') return res.status(400).json({ error: 'Only counter orders can be assigned.' });

    await db.transaction(async trx => {
      await trx('orders').where({ id: req.params.id }).update({
        table_id,
        order_type: 'table',
        order_name: null,
        updated_at: db.fn.now()
      });
      await trx('restaurant_tables').where({ id: table_id }).update({ status: 'occupied' });
    });

    const updatedOrder = await db('orders').where({ id: req.params.id }).first();
    const io = req.app.get('io');
    if (io) {
      io.emit('order:new'); // trigger refresh on frontends
    }
    res.json(updatedOrder);
  } catch (err) {
    console.error('Assign table error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/:id/payment-ready - Waiter sends order to Admin for payment
router.patch('/:id/payment-ready', verifyToken, requireRole(['waiter', 'admin']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    await db('orders').where({ id: orderId }).update({
      status: 'payment_ready',
      waiter_name: req.body.waiter_name || null,
      updated_at: db.fn.now(),
    });

    const updatedOrder = await db('orders').where({ id: orderId }).first();
    let table_number = order.order_name || null;
    if (order.table_id) {
      const table = await db('restaurant_tables').where({ id: order.table_id }).first();
      if (table) table_number = table.number;
    }
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('order:payment-ready', { order: updatedOrder, table_number });
    }
    res.json(updatedOrder);
  } catch (err) {
    console.error('Payment ready error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/:id/payment - record payment (Admin)
router.patch('/:id/payment', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { payments, collected_by, manual_discount, discount_reason, cash_tendered, change_due, custom_payment_type } = req.body;
    const orderId = req.params.id;

    if (!payments || !Array.isArray(payments) || !collected_by) {
      return res.status(400).json({ error: 'payments array and collected_by are required.' });
    }

    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ error: 'This order has already been fully paid and completed. Duplicate payments are rejected.' });
    }

    // Apply manual discount if provided
    let finalTotal = parseFloat(order.total);
    let totalDiscount = parseFloat(order.discount || 0);
    
    const md = parseFloat(manual_discount || 0);
    if (md > 0) {
      // Check max discount limit
      const settingsRow = await db('settings').where({ setting_key: 'max_discount_percent' }).first();
      const maxPercent = settingsRow && settingsRow.setting_value ? parseFloat(settingsRow.setting_value) : 100;
      
      const subtotal = parseFloat(order.subtotal || 0);
      const maxAllowed = (subtotal * maxPercent) / 100;
      
      if ((totalDiscount + md) > maxAllowed) {
        return res.status(400).json({ error: `Total discount cannot exceed ${maxPercent}% of subtotal (Max Allowed: ${maxAllowed.toFixed(2)}).` });
      }

      finalTotal = Math.max(0, finalTotal - md);
      totalDiscount += md;
    }

    // Calculate sum of incoming payments
    const paymentSum = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    // Check if it exactly matches the grand total
    if (Math.abs(paymentSum - finalTotal) > 0.01) {
      return res.status(400).json({ error: `Total payments (${paymentSum.toFixed(2)}) must exactly match the grand total (${finalTotal.toFixed(2)}). Partial payments are not allowed.` });
    }

    // Insert all valid payments
    const validPayments = payments.filter(p => parseFloat(p.amount) > 0);

    // Update order to completed and record discount
    const orderUpdates = {
      status: 'completed',
      payment_method: validPayments.length > 1 ? 'split' : (validPayments[0]?.method || 'cash'),
      updated_at: db.fn.now(),
      cash_tendered: parseFloat(cash_tendered || 0),
      change_due: parseFloat(change_due || 0),
      custom_payment_type: custom_payment_type || null
    };
    
    if (md > 0) {
      orderUpdates.total = finalTotal;
      orderUpdates.discount = totalDiscount;
      orderUpdates.discount_reason = discount_reason || 'Manual Discount';
    }

    // Wrap payment + order update + table release in a single transaction
    await db.transaction(async trx => {
      if (validPayments.length > 0) {
        const paymentRecords = validPayments.map(p => ({
          order_id: orderId,
          amount: parseFloat(p.amount),
          method: p.method,
          collected_by: order.waiter_name || collected_by,
        }));
        await trx('payments').insert(paymentRecords);
      }

      await trx('orders').where({ id: orderId }).update(orderUpdates);

      if (order.table_id) {
        await trx('restaurant_tables').where({ id: order.table_id }).update({
          status: 'available',
          updated_at: db.fn.now(),
        });
      }
    });

    const updatedOrder = await db('orders').where({ id: orderId }).first();
    let table = null;
    let tableRoom = null;
    if (order.table_id) {
      table = await db('restaurant_tables').where({ id: order.table_id }).first();
      tableRoom = `table-${table.number}`;
    }

    const io = req.app.get('io');
    if (io) {
      const allPayments = await db('payments').where({ order_id: orderId });
      io.to('admin').emit('order:payment-collected', { order: updatedOrder, table_number: table ? table.number : updatedOrder.order_name, payments: allPayments });
      if (tableRoom) {
        io.to(tableRoom).emit('order:payment-collected', { order: updatedOrder });
      }
    }

    res.json({ order: updatedOrder, totalPaid: paymentSum, isFullyPaid: true, payments: validPayments });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/orders/:id/apply-promo
router.post('/:id/apply-promo', async (req, res) => {
  try {
    const { code } = req.body;
    const orderId = req.params.id;

    if (!code) {
      return res.status(400).json({ error: 'Promo code is required.' });
    }

    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.promo_code_id) {
      return res.status(400).json({ error: 'A promo code is already applied to this order.' });
    }

    const promo = await db('promo_codes').where({ code: code.toUpperCase(), is_active: true }).first();
    if (!promo) {
      return res.status(400).json({ error: 'Invalid or inactive promo code.' });
    }

    // Check expiry
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Promo code has expired.' });
    }

    // Check max uses
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      return res.status(400).json({ error: 'Promo code has reached maximum uses.' });
    }

    // Check min order
    if (parseFloat(order.subtotal) < parseFloat(promo.min_order)) {
      return res.status(400).json({ error: `Minimum order amount is NPR ${promo.min_order}.` });
    }

    // Apply promo
    await db('orders').where({ id: orderId }).update({ promo_code_id: promo.id });
    await db('promo_codes').where({ id: promo.id }).increment('used_count', 1);

    // Recalculate totals
    const totals = await recalculateOrderTotals(orderId);

    const updatedOrder = await db('orders').where({ id: orderId }).first();
    res.json({ order: updatedOrder, discount_applied: totals.discount });
  } catch (err) {
    console.error('Apply promo error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', verifyToken, requireRole(['admin', 'waiter']), async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    await db('orders').where({ id: orderId }).update({
      status,
      updated_at: db.fn.now()
    });

    if ((status === 'cancelled' || status === 'completed') && order.table_id) {
      await db('restaurant_tables').where({ id: order.table_id }).update({ status: 'available' });
    }

    const updatedOrder = await db('orders').where({ id: orderId }).first();

    const io = req.app.get('io');
    if (io) {
      io.emit('order:new'); // trigger general refresh
    }

    res.json(updatedOrder);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});
// POST /api/orders/merge-table - merge source table into target table
router.post('/merge-table', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { source_table_id, target_table_id } = req.body;

    if (!source_table_id || !target_table_id) {
      return res.status(400).json({ error: 'Source and target table IDs are required.' });
    }

    if (source_table_id === target_table_id) {
      return res.status(400).json({ error: 'Source and target tables cannot be the same.' });
    }

    // Get active orders for both
    const getActiveOrder = async (tableId) => {
      return await db('orders')
        .where('table_id', tableId)
        .whereIn('status', ['active', 'checkout_requested', 'payment_ready', 'hold'])
        .orderBy('created_at', 'desc')
        .first();
    };

    const sourceOrder = await getActiveOrder(source_table_id);
    if (!sourceOrder) {
      return res.status(400).json({ error: 'Source table has no active order to merge.' });
    }

    const targetOrder = await getActiveOrder(target_table_id);

    await db.transaction(async (trx) => {
      if (targetOrder) {
        // Both have active orders: move all items from source to target
        await trx('order_items')
          .where('order_id', sourceOrder.id)
          .update({ order_id: targetOrder.id });

        // Set the source order as merged
        await trx('orders')
          .where('id', sourceOrder.id)
          .update({ status: 'merged', updated_at: db.fn.now() });

        // Recalculate target order totals inside transaction? 
        // We'll just do it outside using the existing function.
      } else {
        // Only source has order: move the order to target table
        await trx('orders')
          .where('id', sourceOrder.id)
          .update({ table_id: target_table_id, updated_at: db.fn.now() });
      }

      // Update table statuses
      await trx('restaurant_tables').where('id', source_table_id).update({ status: 'available' });
      await trx('restaurant_tables').where('id', target_table_id).update({ status: 'occupied' });
    });

    if (targetOrder) {
      await recalculateOrderTotals(targetOrder.id);
    } else {
      await recalculateOrderTotals(sourceOrder.id);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order:new'); // trigger general refresh
    }

    res.json({ message: 'Tables merged successfully.' });
  } catch (err) {
    console.error('Merge table error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/orders/:id - delete order by id from db
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await db('orders').where({ id }).first();
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    await db('orders').where({ id }).del();

    const io = req.app.get('io');
    if (io) {
      io.emit('order:new'); // trigger general refresh
    }

    res.json({ message: 'Order deleted successfully.' });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/orders/sales-return-logs - fetch sales return logs
router.get('/sales-return-logs', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { from, to, search } = req.query;
    let query = db('sales_return_logs').select('*');

    if (from) {
      query = query.where('created_at', '>=', from);
    }
    if (to) {
      query = query.where('created_at', '<=', to);
    }
    if (search) {
      query = query.where(function() {
        this.where('order_id', 'like', `%${search}%`)
            .orWhere('item_name', 'like', `%${search}%`)
            .orWhere('processed_by', 'like', `%${search}%`)
            .orWhere('reason', 'like', `%${search}%`);
      });
    }

    query = query.orderBy('created_at', 'desc');
    const logs = await query;
    res.json(logs);
  } catch (err) {
    console.error('Fetch sales return logs error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/orders/:id/sales-return - Process sales return for an order item
router.post('/:id/sales-return', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { order_item_id, quantity, reason } = req.body;

    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const item = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .where('order_items.id', order_item_id)
      .where('order_items.order_id', orderId)
      .select('order_items.*', 'menu_items.name as item_name', 'menu_items.price')
      .first();

    if (!item) {
      return res.status(404).json({ error: 'Order item not found.' });
    }

    const returnQty = parseInt(quantity || item.quantity);
    if (returnQty <= 0 || returnQty > item.quantity) {
      return res.status(400).json({ error: 'Invalid return quantity.' });
    }

    const itemPrice = parseFloat(item.price_at_order || item.price);
    const returnAmount = itemPrice * returnQty;

    await db.transaction(async trx => {
      // 1. Record negative payment
      await trx('payments').insert({
        order_id: orderId,
        amount: -returnAmount,
        method: 'cash',
        collected_by: req.user?.name || 'Admin',
        created_at: new Date()
      });

      // 2. Insert audit log into sales_return_logs
      await trx('sales_return_logs').insert({
        order_id: orderId,
        item_name: item.item_name || 'Item',
        quantity: returnQty,
        refund_amount: returnAmount,
        reason: reason || 'No reason provided',
        processed_by: req.user?.name || 'Admin',
        created_at: new Date()
      });

      // 3. Adjust or delete order item
      if (returnQty === item.quantity) {
        await trx('order_items').where({ id: order_item_id }).delete();
      } else {
        await trx('order_items').where({ id: order_item_id }).update({
          quantity: item.quantity - returnQty,
          updated_at: trx.fn.now()
        });
      }

      // 4. Restock inventory
      const links = await trx('stock_menu_links').where({ menu_item_id: item.menu_item_id });
      if (links.length > 0) {
        for (const link of links) {
          const addition = link.quantity_consumed * returnQty;
          
          await trx('stock_transactions').insert({
            stock_item_id: link.stock_id,
            transaction_type: 'return',
            quantity: addition,
            notes: `Sales return restock for Order #${orderId} (${reason || 'No reason provided'})`
          });

          const stockItem = await trx('stock_items').where({ id: link.stock_id }).first();
          if (stockItem) {
            await trx('stock_items')
              .where({ id: link.stock_id })
              .update({ 
                quantity: Number(stockItem.quantity) + addition, 
                updated_at: trx.fn.now() 
              });
          }
        }
      }
    });

    // 5. Recalculate order totals
    await recalculateOrderTotals(orderId);

    const io = req.app.get('io');
    if (io) {
      io.emit('order:new'); // trigger general refresh
    }

    res.json({ message: 'Sales return processed successfully', returnAmount });
  } catch (error) {
    console.error('Sales Return Error:', error);
    res.status(500).json({ error: 'Failed to process sales return.' });
  }
});

module.exports = router;
