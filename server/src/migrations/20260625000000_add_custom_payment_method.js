/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw("ALTER TABLE orders MODIFY COLUMN payment_method VARCHAR(50) NULL");
  await knex.raw("ALTER TABLE payments MODIFY COLUMN method VARCHAR(50) NOT NULL");
  
  const hasColumn = await knex.schema.hasColumn('orders', 'custom_payment_type');
  if (!hasColumn) {
    await knex.schema.alterTable('orders', table => {
      table.string('custom_payment_type').nullable();
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('orders', 'custom_payment_type');
  if (hasColumn) {
    await knex.schema.alterTable('orders', table => {
      table.dropColumn('custom_payment_type');
    });
  }
};
