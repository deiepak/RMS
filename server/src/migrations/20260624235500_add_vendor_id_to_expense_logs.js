/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('expense_logs');
  if (hasTable) {
    const hasColumn = await knex.schema.hasColumn('expense_logs', 'vendor_id');
    if (!hasColumn) {
      await knex.schema.alterTable('expense_logs', (table) => {
        table.integer('vendor_id').unsigned().nullable().references('id').inTable('vendors').onDelete('SET NULL');
      });
    }
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('expense_logs');
  if (hasTable) {
    const hasColumn = await knex.schema.hasColumn('expense_logs', 'vendor_id');
    if (hasColumn) {
      await knex.schema.alterTable('expense_logs', (table) => {
        table.dropColumn('vendor_id');
      });
    }
  }
};
