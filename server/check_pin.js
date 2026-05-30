const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

async function run() {
  const employees = await db('employees').select('name', 'pin_hash');
  for (const emp of employees) {
    const isValid = await bcrypt.compare('1234', emp.pin_hash);
    console.log(`Is 1234 valid for ${emp.name}?`, isValid);
  }
  process.exit(0);
}

run();
