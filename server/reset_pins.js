const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

async function reset() {
  try {
    const hash = await bcrypt.hash('1234', 10);
    await db('employees').update({ pin_hash: hash });
    console.log('All employee PINs have been reset to 1234');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

reset();
