/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('orders', table => {
    table.index('created_at', 'idx_orders_created_at');
    table.index('status', 'idx_orders_status');
  });

  await knex.schema.alterTable('order_items', table => {
    table.index('created_at', 'idx_order_items_created_at');
    table.index('status', 'idx_order_items_status');
  });

  await knex.schema.alterTable('payments', table => {
    table.index('created_at', 'idx_payments_created_at');
  });

  await knex.schema.alterTable('package_payments', table => {
    table.index('created_at', 'idx_pkg_payments_created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('package_payments', table => {
    table.dropIndex('created_at', 'idx_pkg_payments_created_at');
  });

  await knex.schema.alterTable('payments', table => {
    table.dropIndex('created_at', 'idx_payments_created_at');
  });

  await knex.schema.alterTable('order_items', table => {
    table.dropIndex('status', 'idx_order_items_status');
    table.dropIndex('created_at', 'idx_order_items_created_at');
  });

  await knex.schema.alterTable('orders', table => {
    table.dropIndex('status', 'idx_orders_status');
    table.dropIndex('created_at', 'idx_orders_created_at');
  });
};
