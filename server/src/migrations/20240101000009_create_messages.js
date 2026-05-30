/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('messages', (table) => {
      table.increments('id').primary();
      table.string('sender_role').notNullable();
      table.string('sender_name').notNullable();
      table.string('target_role').nullable();
      table.integer('target_id').nullable();
      table.text('content').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('assistance_requests', (table) => {
      table.increments('id').primary();
      table.integer('table_id').unsigned().notNullable()
        .references('id').inTable('restaurant_tables').onDelete('CASCADE');
      table.string('customer_name').notNullable();
      table.enum('status', ['pending', 'accepted', 'resolved']).defaultTo('pending');
      table.string('assigned_waiter').nullable();
      table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('assistance_requests')
    .dropTableIfExists('messages');
};
