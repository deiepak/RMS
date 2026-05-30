/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('vendor_ledgers', (table) => {
    table.integer('linked_bill_id').unsigned().nullable()
      .references('id').inTable('vendor_ledgers').onDelete('SET NULL');
  });

  await knex.schema.alterTable('messages', (table) => {
    table.json('target_stations').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('vendor_ledgers', (table) => {
    table.dropForeign(['linked_bill_id']);
    table.dropColumn('linked_bill_id');
  });

  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('target_stations');
  });
};
