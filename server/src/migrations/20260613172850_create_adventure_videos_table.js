exports.up = function(knex) {
  return knex.schema.createTable('adventure_videos', function(table) {
    table.increments('id').primary();
    table.integer('order_id').unsigned().references('id').inTable('orders').onDelete('CASCADE');
    table.string('phone_number', 15).notNullable();
    table.boolean('is_sent').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('sent_at').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('adventure_videos');
};
