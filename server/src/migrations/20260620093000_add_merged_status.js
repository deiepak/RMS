/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const clientType = knex.client.config.client;

  if (clientType === 'mysql' || clientType === 'mysql2') {
    await knex.raw("ALTER TABLE orders MODIFY COLUMN status ENUM('active', 'checkout_requested', 'payment_ready', 'hold', 'completed', 'cancelled', 'merged') DEFAULT 'active'");
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const clientType = knex.client.config.client;

  if (clientType === 'mysql' || clientType === 'mysql2') {
    // We cannot easily remove enum values in MySQL if they are in use, but this is a best-effort rollback
    await knex.raw("ALTER TABLE orders MODIFY COLUMN status ENUM('active', 'checkout_requested', 'payment_ready', 'hold', 'completed', 'cancelled') DEFAULT 'active'");
  }
};
