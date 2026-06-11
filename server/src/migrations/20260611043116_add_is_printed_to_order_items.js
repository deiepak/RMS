exports.up = function(knex) {
  return knex.schema.alterTable('order_items', function(table) {
    table.boolean('is_printed').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('order_items', function(table) {
    table.dropColumn('is_printed');
  });
};
