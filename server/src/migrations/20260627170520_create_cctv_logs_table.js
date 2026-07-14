/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('cctv_access_logs', (table) => {
    table.increments('id').primary();
    table.string('user_id').nullable();
    table.string('event_type').notNullable(); // 'view_page', 'view_camera', 'stream_failure', 'unauthorized_access'
    table.string('camera_id').nullable();
    table.text('description').nullable();
    table.string('ip_address').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('cctv_access_logs');
};
