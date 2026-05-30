/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const clientType = knex.client.config.client;
  if (clientType === 'mysql' || clientType === 'mysql2') {
    await knex.raw("ALTER TABLE stock_transactions MODIFY COLUMN transaction_type ENUM('purchase', 'damage', 'consume', 'return') NOT NULL");
    await knex.raw("ALTER TABLE vendor_ledgers MODIFY COLUMN transaction_type ENUM('purchase', 'payment', 'return') NOT NULL");
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const clientType = knex.client.config.client;
  if (clientType === 'mysql' || clientType === 'mysql2') {
    await knex.raw("ALTER TABLE stock_transactions MODIFY COLUMN transaction_type ENUM('purchase', 'damage', 'consume') NOT NULL");
    await knex.raw("ALTER TABLE vendor_ledgers MODIFY COLUMN transaction_type ENUM('purchase', 'payment') NOT NULL");
  }
};
