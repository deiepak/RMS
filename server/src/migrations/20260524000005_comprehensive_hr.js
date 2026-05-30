/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Expand employees
  await knex.schema.alterTable('employees', (table) => {
    table.date('dob').nullable();
    table.text('address').nullable();
    table.string('emergency_contact_name').nullable();
    table.string('emergency_contact_phone').nullable();
    table.string('employment_type').defaultTo('full-time'); // full-time, part-time, contract
    table.decimal('hourly_rate', 10, 2).defaultTo(0);
  });

  // 2. Expand employee_payments for advanced payroll
  await knex.schema.alterTable('employee_payments', (table) => {
    table.decimal('bonus', 10, 2).defaultTo(0);
    table.decimal('deduction', 10, 2).defaultTo(0);
  });

  // 3. Create employee_attendance
  await knex.schema.createTable('employee_attendance', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.datetime('clock_in').notNullable();
    table.datetime('clock_out').nullable();
    table.decimal('total_hours', 10, 2).nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  // 4. Create employee_performance
  await knex.schema.createTable('employee_performance', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.enum('type', ['warning', 'commendation', 'incident']).notNullable();
    table.text('notes').notNullable();
    table.date('date').notNullable();
    table.timestamps(true, true);
  });

  // 5. Create employee_documents
  await knex.schema.createTable('employee_documents', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.string('document_name').notNullable();
    table.enum('status', ['missing', 'collected', 'verified']).defaultTo('missing');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('employee_documents');
  await knex.schema.dropTableIfExists('employee_performance');
  await knex.schema.dropTableIfExists('employee_attendance');

  await knex.schema.alterTable('employee_payments', (table) => {
    table.dropColumn('bonus');
    table.dropColumn('deduction');
  });

  await knex.schema.alterTable('employees', (table) => {
    table.dropColumn('dob');
    table.dropColumn('address');
    table.dropColumn('emergency_contact_name');
    table.dropColumn('emergency_contact_phone');
    table.dropColumn('employment_type');
    table.dropColumn('hourly_rate');
  });
};
