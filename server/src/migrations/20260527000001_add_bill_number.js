/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('stock_transactions', (table) => {
    table.string('bill_number').nullable();
  });

  await knex.schema.alterTable('vendor_ledgers', (table) => {
    table.string('bill_number').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('stock_transactions', (table) => {
    table.dropColumn('bill_number');
  });

  await knex.schema.alterTable('vendor_ledgers', (table) => {
    table.dropColumn('bill_number');
  });
};
