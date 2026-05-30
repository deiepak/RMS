/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Add fields to employees
  await knex.schema.alterTable('employees', (table) => {
    table.string('contact').nullable();
    table.date('join_date').nullable();
    table.decimal('monthly_salary', 10, 2).defaultTo(0);
  });

  // 2. Create employee_leaves
  await knex.schema.createTable('employee_leaves', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.enum('type', ['sick', 'vacation', 'unpaid', 'other']).notNullable();
    table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending');
    table.text('reason').nullable();
    table.timestamps(true, true);
  });

  // 3. Create employee_payments
  await knex.schema.createTable('employee_payments', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.string('payment_method').defaultTo('cash');
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  // 4. Create stock_requests
  await knex.schema.createTable('stock_requests', (table) => {
    table.increments('id').primary();
    table.string('item_name').notNullable();
    table.string('quantity').notNullable();
    table.text('notes').nullable();
    table.string('requested_by').notNullable(); // Just store the name or role of requester
    table.enum('status', ['pending', 'okay']).defaultTo('pending');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('stock_requests');
  await knex.schema.dropTableIfExists('employee_payments');
  await knex.schema.dropTableIfExists('employee_leaves');
  
  await knex.schema.alterTable('employees', (table) => {
    table.dropColumn('monthly_salary');
    table.dropColumn('join_date');
    table.dropColumn('contact');
  });
};
