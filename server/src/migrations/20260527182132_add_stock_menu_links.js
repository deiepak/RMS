exports.up = function(knex) {
  return knex.schema.createTable('stock_menu_links', table => {
    table.increments('id').primary();
    table.integer('stock_id').unsigned().notNullable().references('id').inTable('stock_items').onDelete('CASCADE');
    table.integer('menu_item_id').unsigned().notNullable().references('id').inTable('menu_items').onDelete('CASCADE');
    table.decimal('quantity_consumed', 10, 2).notNullable().defaultTo(1);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('stock_menu_links');
};
