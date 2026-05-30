const db = require('./src/config/db');
async function test() {
  try {
    const res = await db('stock_items').insert({ 
      name: 'Test Knex Return', 
      quantity: 1, 
      unit: 'kg', 
      low_threshold: 0, 
      vendor_id: null, 
      department: 'kitchen' 
    });
    console.log("Insert returned:", res);
    
    const [id] = res;
    console.log("Destructured ID:", id);
    
    const newItem = await db('stock_items').where({ id }).first();
    console.log("Fetched newItem:", newItem);

    // cleanup
    await db('stock_items').where({ id }).del();
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}
test();
