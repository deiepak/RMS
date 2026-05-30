/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('stock_items', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.decimal('quantity', 10, 2).defaultTo(0);
    table.string('unit').notNullable();
    table.decimal('low_threshold', 10, 2).defaultTo(0);
    table.integer('vendor_id').unsigned().nullable()
      .references('id').inTable('vendors').onDelete('SET NULL');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('stock_items');
};
