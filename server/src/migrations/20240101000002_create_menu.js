/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('menu_categories', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('name_np').nullable();
      table.integer('sort_order').unsigned().defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('menu_items', (table) => {
      table.increments('id').primary();
      table.integer('category_id').unsigned().notNullable()
        .references('id').inTable('menu_categories').onDelete('CASCADE');
      table.string('name').notNullable();
      table.string('name_np').nullable();
      table.text('description').nullable();
      table.text('description_np').nullable();
      table.decimal('price', 10, 2).notNullable();
      table.string('image_url').nullable();
      table.boolean('is_veg').defaultTo(false);
      table.boolean('is_available').defaultTo(true);
      table.integer('sort_order').unsigned().defaultTo(0);
      table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('menu_items')
    .dropTableIfExists('menu_categories');
};
