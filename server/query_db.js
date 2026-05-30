const db = require('./src/config/db');

async function run() {
  const employees = await db('employees').select('*');
  console.log('Employees:', employees);
  process.exit(0);
}

run();
