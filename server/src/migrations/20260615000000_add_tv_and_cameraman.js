/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw("ALTER TABLE employees MODIFY COLUMN role ENUM('admin', 'kitchen', 'waiter', 'cameraman', 'tv') NOT NULL");

  await knex.schema.createTable('tv_content', (table) => {
    table.increments('id').primary();
    table.enum('type', ['photo', 'video']).notNullable();
    table.string('file_url').notNullable();
    table.integer('duration_seconds').notNullable().defaultTo(0);
    table.integer('occurrences_per_hour').notNullable().defaultTo(1);
    table.integer('display_order').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tv_content');
  await knex.raw("ALTER TABLE employees MODIFY COLUMN role ENUM('admin', 'kitchen', 'waiter') NOT NULL");
};
