const db = require('./server/src/config/db');

async function main() {
  const hasPhotoUrl = await db.schema.hasColumn('employees', 'photo_url');
  if (!hasPhotoUrl) {
    await db.schema.alterTable('employees', t => {
      t.string('photo_url').nullable();
      t.string('id_photo_url').nullable();
    });
    console.log("Added columns");
  } else {
    console.log("Columns already exist");
  }
  process.exit(0);
}

main().catch(console.error);
