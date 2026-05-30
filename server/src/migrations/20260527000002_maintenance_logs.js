/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('maintenance_logs', (table) => {
    table.increments('id').primary();
    table.string('item_name').notNullable();
    table.text('description').nullable();
    table.enum('status', ['pending', 'repaired']).defaultTo('pending');
    table.integer('repaired_by_vendor_id').unsigned().nullable()
      .references('id').inTable('vendors').onDelete('SET NULL');
    table.decimal('repair_cost', 10, 2).nullable();
    table.timestamp('repaired_at').nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('maintenance_logs');
};
