/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('promo_codes', (table) => {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.enum('type', ['percent', 'flat']).notNullable();
    table.decimal('value', 10, 2).notNullable();
    table.decimal('min_order', 10, 2).defaultTo(0);
    table.integer('max_uses').unsigned().defaultTo(0);
    table.integer('used_count').unsigned().defaultTo(0);
    table.datetime('expires_at').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('promo_codes');
};
