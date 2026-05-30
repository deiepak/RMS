/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('employees', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.enum('role', ['admin', 'kitchen', 'waiter']).notNullable();
    table.string('pin_hash').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('employees');
};
