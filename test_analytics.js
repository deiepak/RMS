const db = require('./server/src/config/db');

async function test() {
  try {
    const orderRevenue = await db('payments')
      .select(db.raw('DATE(created_at) as date'))
      .sum('amount as revenue')
      .groupBy(db.raw('DATE(created_at)'));
    console.log("Revenue order:", orderRevenue);

    const pkgRevenue = await db('package_payments')
      .select(db.raw('DATE(created_at) as date'))
      .sum('amount as revenue')
      .groupBy(db.raw('DATE(created_at)'));
    console.log("Revenue pkg:", pkgRevenue);
  } catch (err) {
    console.error("Error in revenue:", err);
  }

  try {
    const popularItems = await db('order_items')
      .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
      .select('menu_items.name')
      .sum('order_items.quantity as count')
      .groupBy('menu_items.id', 'menu_items.name')
      .orderBy('count', 'desc')
      .limit(10);
    console.log("Popular items:", popularItems);
  } catch (err) {
    console.error("Error in popular items:", err);
  }

  try {
    const peakHours = await db('orders')
      .select(db.raw('HOUR(created_at) as hour'))
      .count('id as count')
      .groupBy(db.raw('HOUR(created_at)'))
      .orderBy('hour', 'asc');
    console.log("Peak hours:", peakHours);
  } catch (err) {
    console.error("Error in peak hours:", err);
  }

  try {
    const tableStats = await db('orders')
      .join('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .select('restaurant_tables.number')
      .count('orders.id as count')
      .groupBy('restaurant_tables.id', 'restaurant_tables.number')
      .orderBy('count', 'desc');
    console.log("Table stats:", tableStats);
  } catch (err) {
    console.error("Error in table stats:", err);
  }

  process.exit(0);
}
test();
