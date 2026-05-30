/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('messages', (table) => {
    const clientType = knex.client.config.client;
    if (clientType === 'mysql' || clientType === 'mysql2') {
      table.specificType('audio_data', 'LONGTEXT').nullable();
    } else {
      table.text('audio_data', 'longtext').nullable();
    }
    // Make content nullable since voice messages might not have text
  });
  
  // Make content nullable
  const clientType = knex.client.config.client;
  if (clientType === 'mysql' || clientType === 'mysql2') {
    await knex.raw('ALTER TABLE messages MODIFY COLUMN content TEXT NULL');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('audio_data');
  });

  const clientType = knex.client.config.client;
  if (clientType === 'mysql' || clientType === 'mysql2') {
    await knex.raw('ALTER TABLE messages MODIFY COLUMN content TEXT NOT NULL');
  }
};
