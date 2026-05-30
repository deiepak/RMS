exports.up = async function(knex) {
  // Alter orders table
  await knex.schema.alterTable('orders', table => {
    table.integer('table_id').unsigned().nullable().alter();
    table.enum('order_type', ['table', 'counter', 'package']).defaultTo('table');
    table.string('order_name').nullable(); // e.g. "Counter Order 1"
  });

  // Create packages table
  await knex.schema.createTable('packages', table => {
    table.increments('id').primary();
    table.string('title').notNullable();
    table.string('customer_name').notNullable();
    table.string('contact').nullable();
    table.datetime('event_date').nullable();
    table.decimal('total_amount', 10, 2).defaultTo(0);
    table.enum('status', ['active', 'completed', 'cancelled']).defaultTo('active');
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  // Create package_items table
  await knex.schema.createTable('package_items', table => {
    table.increments('id').primary();
    table.integer('package_id').unsigned().notNullable().references('id').inTable('packages').onDelete('CASCADE');
    table.string('description').notNullable();
    table.decimal('quantity', 10, 2).defaultTo(1);
    table.decimal('price_per_unit', 10, 2).defaultTo(0);
    table.decimal('total', 10, 2).defaultTo(0);
    table.timestamps(true, true);
  });

  // Create package_payments table
  await knex.schema.createTable('package_payments', table => {
    table.increments('id').primary();
    table.integer('package_id').unsigned().notNullable().references('id').inTable('packages').onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.enum('payment_method', ['cash', 'card', 'online']).notNullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('package_payments');
  await knex.schema.dropTableIfExists('package_items');
  await knex.schema.dropTableIfExists('packages');
  
  await knex.schema.alterTable('orders', table => {
    table.integer('table_id').unsigned().notNullable().alter();
    table.dropColumn('order_type');
    table.dropColumn('order_name');
  });
};
