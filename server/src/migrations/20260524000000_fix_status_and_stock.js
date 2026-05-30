/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Alter orders table to modify enum and add waiter_name
  // MySQL does not easily support modifying enums using standard knex schema building in a cross-compatible way.
  // Instead, we can change the column to a simple string to avoid future enum issues, or use raw queries.
  // Using raw query for MySQL to alter the enum:
  
  const clientType = knex.client.config.client;

  if (clientType === 'mysql' || clientType === 'mysql2') {
    await knex.raw("ALTER TABLE orders MODIFY COLUMN status ENUM('active', 'checkout_requested', 'payment_ready', 'completed', 'cancelled') DEFAULT 'active'");
  } else {
    // For SQLite or Postgres, we'll just drop constraints or ignore enum enforcement
  }

  await knex.schema.alterTable('orders', (table) => {
    table.string('waiter_name').nullable();
  });

  // Create stock_transactions table
  await knex.schema.createTable('stock_transactions', (table) => {
    table.increments('id').primary();
    table.integer('stock_item_id').unsigned().notNullable()
      .references('id').inTable('stock_items').onDelete('CASCADE');
    table.enum('transaction_type', ['purchase', 'damage', 'consume']).notNullable();
    table.decimal('quantity', 10, 2).notNullable();
    table.integer('vendor_id').unsigned().nullable()
      .references('id').inTable('vendors').onDelete('SET NULL');
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  // Create vendor_ledgers table
  await knex.schema.createTable('vendor_ledgers', (table) => {
    table.increments('id').primary();
    table.integer('vendor_id').unsigned().notNullable()
      .references('id').inTable('vendors').onDelete('CASCADE');
    table.enum('transaction_type', ['purchase', 'payment']).notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.enum('payment_method', ['cash', 'bank', 'online', 'cheque']).nullable();
    table.string('reference_id').nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('vendor_ledgers');
  await knex.schema.dropTableIfExists('stock_transactions');
  
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('waiter_name');
  });

  const clientType = knex.client.config.client;
  if (clientType === 'mysql' || clientType === 'mysql2') {
    await knex.raw("ALTER TABLE orders MODIFY COLUMN status ENUM('active', 'checkout_requested', 'completed', 'cancelled') DEFAULT 'active'");
  }
};
