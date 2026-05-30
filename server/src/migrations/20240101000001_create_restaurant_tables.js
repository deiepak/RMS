/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('restaurant_tables', (table) => {
    table.increments('id').primary();
    table.integer('number').unsigned().notNullable().unique();
    table.integer('capacity').unsigned().defaultTo(4);
    table.string('section').nullable();
    table.enum('status', ['available', 'occupied', 'reserved']).defaultTo('available');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('restaurant_tables');
};
