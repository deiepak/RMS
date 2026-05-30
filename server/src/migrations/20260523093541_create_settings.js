exports.up = function(knex) {
  return knex.schema.createTable('settings', table => {
    table.string('setting_key').primary();
    table.text('setting_value');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('settings');
};
