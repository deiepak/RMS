const crypto = require('crypto');

exports.up = async function(knex) {
  // 1. Add qr_token column (nullable initially to allow backfill)
  await knex.schema.alterTable('restaurant_tables', function(table) {
    table.string('qr_token', 64).unique().nullable();
  });

  // 2. Backfill existing tables with unique UUIDs
  const tables = await knex('restaurant_tables').select('id');
  for (const t of tables) {
    const token = crypto.randomUUID();
    await knex('restaurant_tables').where({ id: t.id }).update({ qr_token: token });
  }

  // 3. Alter column to be notNullable
  await knex.schema.alterTable('restaurant_tables', function(table) {
    table.string('qr_token', 64).notNullable().alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('restaurant_tables', function(table) {
    table.dropColumn('qr_token');
  });
};
