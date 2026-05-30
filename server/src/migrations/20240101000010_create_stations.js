/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('stations', table => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('menu_items', table => {
    table.integer('station_id').unsigned().references('id').inTable('stations').onDelete('SET NULL');
  });

  await knex.schema.alterTable('employees', table => {
    table.integer('station_id').unsigned().references('id').inTable('stations').onDelete('SET NULL');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('employees', table => {
    table.dropForeign('station_id');
    table.dropColumn('station_id');
  });

  await knex.schema.alterTable('menu_items', table => {
    table.dropForeign('station_id');
    table.dropColumn('station_id');
  });

  await knex.schema.dropTableIfExists('stations');
};
