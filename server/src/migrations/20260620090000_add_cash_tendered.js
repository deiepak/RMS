/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.decimal('cash_tendered', 10, 2).defaultTo(0);
    table.decimal('change_due', 10, 2).defaultTo(0);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.dropColumn('cash_tendered');
    table.dropColumn('change_due');
  });
};
