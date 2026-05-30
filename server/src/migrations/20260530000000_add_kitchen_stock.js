exports.up = function(knex) {
  return knex.schema.alterTable('stock_items', table => {
    table.string('department').defaultTo('general'); // 'general' or 'kitchen'
  }).then(() => {
    return knex('settings').insert({
      setting_key: 'date_format',
      setting_value: 'AD'
    }).catch(() => {
      // Ignore if it already exists or settings table issue
    });
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('stock_items', table => {
    table.dropColumn('department');
  });
};
