exports.up = async function(knex) {
  return knex.schema.alterTable('employees', (table) => {
    table.string('photo_url').nullable();
    table.string('id_photo_url').nullable();
  });
};

exports.down = async function(knex) {
  return knex.schema.alterTable('employees', (table) => {
    table.dropColumn('photo_url');
    table.dropColumn('id_photo_url');
  });
};
