/**
 * Add price_at_order to order_items so we capture the historical price
 * instead of relying on the current menu_items.price
 */
exports.up = function (knex) {
  return knex.schema.alterTable('order_items', function (table) {
    table.decimal('price_at_order', 10, 2).nullable().after('quantity');
  }).then(async () => {
    // Backfill existing order_items with the current menu_items.price
    await knex.raw(`
      UPDATE order_items 
      SET price_at_order = (
        SELECT price FROM menu_items WHERE menu_items.id = order_items.menu_item_id
      )
      WHERE price_at_order IS NULL
    `);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('order_items', function (table) {
    table.dropColumn('price_at_order');
  });
};
