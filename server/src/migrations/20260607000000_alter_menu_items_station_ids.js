/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Add new JSON column
  await knex.schema.alterTable('menu_items', table => {
    table.json('station_ids').nullable();
  });

  // 2. Migrate data
  await knex.raw('UPDATE menu_items SET station_ids = JSON_ARRAY(station_id) WHERE station_id IS NOT NULL');

  // 3. Drop old column and foreign key
  await knex.schema.alterTable('menu_items', table => {
    table.dropForeign('station_id');
    table.dropColumn('station_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('menu_items', table => {
    table.integer('station_id').unsigned().references('id').inTable('stations').onDelete('SET NULL');
  });

  // 2. Migrate data back (take first element)
  await knex.raw('UPDATE menu_items SET station_id = JSON_EXTRACT(station_ids, "$[0]") WHERE station_ids IS NOT NULL AND JSON_LENGTH(station_ids) > 0');

  await knex.schema.alterTable('menu_items', table => {
    table.dropColumn('station_ids');
  });
};
