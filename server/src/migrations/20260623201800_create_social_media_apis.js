/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('social_configs', (table) => {
    table.increments('id').primary();
    table.enum('platform', ['facebook', 'instagram', 'whatsapp', 'tiktok']).notNullable();
    table.string('config_key').notNullable();
    table.text('config_value');
    table.timestamps(true, true);
    table.unique(['platform', 'config_key']);
  });

  await knex.schema.createTable('social_posts', (table) => {
    table.increments('id').primary();
    table.text('content');
    table.string('media_url');
    table.json('platforms_selected'); 
    table.enum('status', ['draft', 'scheduled', 'published', 'failed']).defaultTo('draft');
    table.dateTime('scheduled_for').nullable();
    table.json('external_post_ids').nullable(); 
    table.text('error_message').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('social_messages', (table) => {
    table.increments('id').primary();
    table.enum('platform', ['facebook', 'instagram', 'whatsapp']).notNullable();
    table.string('sender_id').notNullable(); 
    table.string('receiver_id').notNullable(); 
    table.text('message_content').nullable();
    table.string('media_url').nullable();
    table.enum('direction', ['incoming', 'outgoing']).notNullable();
    table.enum('status', ['unread', 'read', 'replied', 'failed']).defaultTo('unread');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('social_messages');
  await knex.schema.dropTableIfExists('social_posts');
  await knex.schema.dropTableIfExists('social_configs');
};
