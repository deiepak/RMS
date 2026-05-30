/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('vendors', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('contact').nullable();
    table.string('email').nullable();
    table.string('address').nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('vendors');
};
