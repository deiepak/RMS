/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('expense_logs', (table) => {
    table.increments('id').primary();
    table.string('category').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.enum('payment_method', ['cash', 'card', 'online', 'bank', 'cheque']).defaultTo('cash');
    table.text('description').nullable();
    table.string('recorded_by').nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('expense_logs');
};
