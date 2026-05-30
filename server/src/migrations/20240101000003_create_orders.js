/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('orders', (table) => {
      table.increments('id').primary();
      table.integer('table_id').unsigned().notNullable()
        .references('id').inTable('restaurant_tables').onDelete('RESTRICT');
      table.enum('status', ['active', 'checkout_requested', 'completed', 'cancelled']).defaultTo('active');
      table.integer('promo_code_id').unsigned().nullable();
      table.decimal('subtotal', 10, 2).defaultTo(0);
      table.decimal('discount', 10, 2).defaultTo(0);
      table.decimal('tax', 10, 2).defaultTo(0);
      table.decimal('total', 10, 2).defaultTo(0);
      table.enum('payment_method', ['cash', 'card', 'online']).nullable();
      table.timestamps(true, true);
    })
    .createTable('order_items', (table) => {
      table.increments('id').primary();
      table.integer('order_id').unsigned().notNullable()
        .references('id').inTable('orders').onDelete('CASCADE');
      table.integer('menu_item_id').unsigned().notNullable()
        .references('id').inTable('menu_items').onDelete('RESTRICT');
      table.integer('quantity').unsigned().defaultTo(1);
      table.string('customer_name').nullable();
      table.enum('status', ['pending', 'accepted', 'rejected', 'preparing', 'prepared', 'picked_up', 'delivered'])
        .defaultTo('pending');
      table.string('reject_reason').nullable();
      table.string('assigned_waiter').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('order_items')
    .dropTableIfExists('orders');
};
