const knex = require('knex');
const knexfile = require('./knexfile');
const db = knex(knexfile.development);

async function test() {
  try {
    const from = '2026-05-30 00:00:00';
    const to = '2026-05-30 23:59:59';
    const method = 'all';

    console.log('Testing GET /');
    let query = db('payments')
      .join('orders', 'payments.order_id', 'orders.id')
      .select('payments.*', 'orders.order_name as customer_name', 'orders.table_id', 'orders.id as order_id');
    
    query.whereBetween('payments.created_at', [from, to]);
    if (method !== 'all') {
      query.where('payments.method', method);
    }
    await query.limit(1);
    console.log('GET / ok');

    console.log('Testing GET /summary');
    let summaryQuery = db('payments').sum('amount as total');
    summaryQuery.whereBetween('created_at', [from, to]);
    await summaryQuery;
    console.log('GET /summary ok');

    console.log('Testing GET /by-category');
    // From ledger.js:
    const orders = await db('orders')
      .whereBetween('created_at', [from, to])
      .select('id');
      
    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      await db('order_items')
        .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
        .join('menu_categories', 'menu_items.category_id', 'menu_categories.id')
        .whereIn('order_items.order_id', orderIds)
        .whereNot('order_items.status', 'rejected')
        .whereNot('order_items.status', 'cancelled')
        .select('menu_categories.name as category')
        .select(db.raw('SUM(order_items.quantity * order_items.price_at_order) as total'))
        .groupBy('menu_categories.id', 'menu_categories.name');
    }
    console.log('GET /by-category ok');

  } catch(e) {
    console.error('FAILED', e);
  } finally {
    db.destroy();
  }
}
test();
