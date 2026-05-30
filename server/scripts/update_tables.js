const knex = require('knex');
const config = require('../knexfile');
const db = knex(config.development);

const tables = [
  // Picnic Group (Gray)
  { number: 'PICNIC GROUP -01', capacity: 6, section: 'Picnic' },
  { number: 'GROUP -01 (PG -04)', capacity: 6, section: 'Picnic' },
  { number: 'GROUP -02 (PG -05)', capacity: 6, section: 'Picnic' },
  { number: 'PICNIC GROUP -02', capacity: 6, section: 'Picnic' },
  { number: 'PICNIC GROUP -03 (PG-03)', capacity: 6, section: 'Picnic' },
  
  // Upstairs (Teal)
  { number: 'GLASS ROUND TABLE', capacity: 4, section: 'Upstairs' },
  { number: 'UP -LEFT-01 (UP-L1)', capacity: 4, section: 'Upstairs' },
  { number: 'UP -LEFT-02 (UP-L2)', capacity: 4, section: 'Upstairs' },
  { number: 'UP -LEFT-03 (UP-L3)', capacity: 4, section: 'Upstairs' },
  { number: 'UP -LEFT-04 (UP-L4)', capacity: 4, section: 'Upstairs' },
  { number: 'UP- LONG TABLE -01', capacity: 8, section: 'Upstairs' },
  { number: 'UP- MARBLE -01 (UP-M1)', capacity: 4, section: 'Upstairs' },
  { number: 'UP- MARBLE -02 (UP-M2)', capacity: 4, section: 'Upstairs' },
  { number: 'UP- SWING -01 (UP-S1)', capacity: 4, section: 'Upstairs' },
  { number: 'UP -SWING -03 (UP-S3)', capacity: 4, section: 'Upstairs' },
  { number: 'UP -SWING -02 (UP-S2)', capacity: 4, section: 'Upstairs' },
  { number: 'UP-ROUND-01 (UP-R1)', capacity: 4, section: 'Upstairs' },
  { number: 'Square Table (UP-SQ1)', capacity: 4, section: 'Upstairs' },
  { number: 'UP EXTRA TABLE -01 (Z-01)', capacity: 4, section: 'Upstairs' },
  { number: 'UP EXTRA TABLE -02 (Z-02)', capacity: 4, section: 'Upstairs' },

  // Main Hall (Blue)
  { number: 'CORNER -01 (C1)', capacity: 4, section: 'Main Hall' },
  { number: 'CORNER -02 (C2)', capacity: 4, section: 'Main Hall' },
  { number: 'ROUND TABLE -01', capacity: 4, section: 'Main Hall' },
  { number: 'ROUND TABLE -02', capacity: 4, section: 'Main Hall' },
  { number: 'ROUND TABLE -03', capacity: 4, section: 'Main Hall' },
  { number: 'LEFT -01 (L1)', capacity: 4, section: 'Main Hall' },
  { number: 'LEFT -02 (L2)', capacity: 4, section: 'Main Hall' },
  { number: 'LEFT -03 (L3)', capacity: 4, section: 'Main Hall' },
  { number: 'LEFT -04 (L4)', capacity: 4, section: 'Main Hall' },
  { number: 'G-RIGHT-01 (R3)', capacity: 4, section: 'Main Hall' },
  { number: 'G-RIGHT-02 (T1)', capacity: 4, section: 'Main Hall' },
  { number: 'G-RIGHT-03 (t2)', capacity: 4, section: 'Main Hall' },
  { number: 'EXTRA TABLE -01 (Z-01)', capacity: 4, section: 'Main Hall' },
  { number: 'EXTRA TABLE -02 (Z-02)', capacity: 4, section: 'Main Hall' },
  { number: 'EXTRA TABLE -03 (Z-03)', capacity: 4, section: 'Main Hall' },

  // Garden / Outside (Teal bottom)
  { number: 'Garden Table -01 (G1)', capacity: 4, section: 'Garden' },
  { number: 'Garden Table -03 (G3)', capacity: 4, section: 'Garden' },
  { number: 'Garden Table -02 (G2)', capacity: 4, section: 'Garden' },
  { number: 'PAKING (PAKING -01)', capacity: 4, section: 'Parking' },
  { number: 'ROOM -01 (ROOM-01)', capacity: 6, section: 'Rooms' },
  { number: 'ROOM -02 (ROOM-02)', capacity: 6, section: 'Rooms' },
  { number: 'TENT -02 (TENT-02)', capacity: 4, section: 'Tents' },
  { number: 'TENT -01 (TENT-01)', capacity: 4, section: 'Tents' },
];

async function updateTables() {
  try {
    const existing = await db('restaurant_tables').orderBy('id');
    
    // Update existing tables to preserve foreign keys
    for (let i = 0; i < existing.length; i++) {
      if (i < tables.length) {
        await db('restaurant_tables')
          .where({ id: existing[i].id })
          .update({
            number: tables[i].number,
            capacity: tables[i].capacity,
            section: tables[i].section,
            sort_order: i + 1
          });
      }
    }
    
    // Insert the rest
    const remaining = tables.slice(existing.length);
    if (remaining.length > 0) {
      const toInsert = remaining.map((t, index) => ({ 
        ...t, 
        status: 'available',
        sort_order: existing.length + index + 1
      }));
      await db('restaurant_tables').insert(toInsert);
    }
    
    // Delete any excess existing tables
    if (existing.length > tables.length) {
      const idsToDelete = existing.slice(tables.length).map(t => t.id);
      await db('restaurant_tables').whereIn('id', idsToDelete).del();
    }
    
    console.log('Tables updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating tables:', error);
    process.exit(1);
  }
}

updateTables();
