/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('adventure_tickets', (table) => {
    table.increments('id').primary();
    table.integer('order_id').unsigned().references('id').inTable('orders').onDelete('CASCADE');
    table.integer('order_item_id').unsigned().references('id').inTable('order_items').onDelete('CASCADE');
    table.string('ticket_code').notNullable().unique();
    table.enum('status', ['unused', 'used', 'cancelled']).defaultTo('unused');
    table.timestamp('used_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('adventure_tickets');
};
