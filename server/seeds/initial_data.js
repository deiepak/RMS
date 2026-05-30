const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  // ─── Employees ───
  const employeeCount = await knex('employees').count('id as count').first();
  if (employeeCount.count === 0) {
    const salt = await bcrypt.genSalt(10);
    await knex('employees').insert([
      { name: 'Admin', role: 'admin', pin_hash: await bcrypt.hash('1234', salt) },
      { name: 'Kitchen Staff', role: 'kitchen', pin_hash: await bcrypt.hash('5678', salt) },
      { name: 'Waiter', role: 'waiter', pin_hash: await bcrypt.hash('9012', salt) },
    ]);
    console.log('✓ Seeded employees');
  }

  // ─── Tables ───
  const tableCount = await knex('restaurant_tables').count('id as count').first();
  if (tableCount.count === 0) {
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
    
    // Add default status and sort_order
    const tablesWithStatus = tables.map((t, index) => ({ 
      ...t, 
      status: 'available',
      sort_order: index + 1
    }));
    await knex('restaurant_tables').insert(tablesWithStatus);
    console.log('✓ Seeded restaurant tables');
  }

  // ─── Menu Categories & Items (Happy Hills Default Menu) ───
  const catCount = await knex('menu_categories').count('id as count').first();
  if (catCount.count === 0) {
    const categories = [
      { name: 'Soup', sort_order: 1 },
      { name: 'Chilly', sort_order: 2 },
      { name: 'Fries', sort_order: 3 },
      { name: 'Sandeko', sort_order: 4 },
      { name: 'Popcorn', sort_order: 5 },
      { name: 'Salad', sort_order: 6 },
      { name: 'Desert', sort_order: 7 },
      { name: 'Khaja Set', sort_order: 8 },
      { name: 'Momo', sort_order: 9 },
      { name: 'Chowmein', sort_order: 10 },
      { name: 'Thukpa', sort_order: 11 },
      { name: 'Happy Hills Special', sort_order: 12 },
      { name: 'Hot Beverage', sort_order: 13 },
      { name: 'Curry / Khana Set', sort_order: 14 },
      { name: 'Breakfast', sort_order: 15 },
      { name: 'Drinks', sort_order: 16 },
      { name: 'Burger', sort_order: 17 },
      { name: 'Hukka', sort_order: 18 },
      { name: 'Beer', sort_order: 19 },
      { name: 'Hard Drinks', sort_order: 20 },
    ];

    await knex('menu_categories').insert(categories);
    console.log('✓ Seeded menu categories');

    // Fetch inserted category IDs
    const cats = await knex('menu_categories').select('id', 'name');
    const catMap = {};
    cats.forEach((c) => { catMap[c.name] = c.id; });

    // ─── Menu Items ───
    const menuItems = [
      // ── Soup ──
      { category_id: catMap['Soup'], name: 'Veg Soup', price: 170, is_veg: true, sort_order: 1 },
      { category_id: catMap['Soup'], name: 'Mushroom Soup', price: 210, is_veg: true, sort_order: 2 },
      { category_id: catMap['Soup'], name: 'Chicken Soup', price: 210, is_veg: false, sort_order: 3 },
      { category_id: catMap['Soup'], name: 'Cream Soup', price: 220, is_veg: true, sort_order: 4 },
      { category_id: catMap['Soup'], name: 'Kodo Veg Soup', price: 210, is_veg: true, sort_order: 5 },
      { category_id: catMap['Soup'], name: 'Kodo Chicken Soup', price: 240, is_veg: false, sort_order: 6 },

      // ── Chilly ──
      { category_id: catMap['Chilly'], name: 'Chips Chilly', price: 250, is_veg: true, sort_order: 1 },
      { category_id: catMap['Chilly'], name: 'Mushroom Chilly', price: 300, is_veg: true, sort_order: 2 },
      { category_id: catMap['Chilly'], name: 'Chicken Chilly', price: 375, is_veg: false, sort_order: 3 },
      { category_id: catMap['Chilly'], name: 'Wings Chilly', price: 400, is_veg: false, sort_order: 4 },
      { category_id: catMap['Chilly'], name: 'Chicken Sausage Chilly', price: 350, is_veg: false, sort_order: 5 },
      { category_id: catMap['Chilly'], name: 'Paneer Chilly', price: 390, is_veg: true, sort_order: 6 },
      { category_id: catMap['Chilly'], name: 'Baby Corn Chilly', price: 300, is_veg: true, sort_order: 7 },

      // ── Fries ──
      { category_id: catMap['Fries'], name: 'Small French Fries', price: 190, is_veg: true, sort_order: 1 },
      { category_id: catMap['Fries'], name: 'Large French Fries', price: 220, is_veg: true, sort_order: 2 },
      { category_id: catMap['Fries'], name: 'Cheesy French Fries', price: 310, is_veg: true, sort_order: 3 },

      // ── Sandeko ──
      { category_id: catMap['Sandeko'], name: 'Wai Wai Sandeko', price: 160, is_veg: true, sort_order: 1 },
      { category_id: catMap['Sandeko'], name: 'Peanuts Sandeko', price: 220, is_veg: true, sort_order: 2 },
      { category_id: catMap['Sandeko'], name: 'Bhatmas Sandeko', price: 220, is_veg: true, sort_order: 3 },
      { category_id: catMap['Sandeko'], name: 'Chicken Sandeko', price: 375, is_veg: false, sort_order: 4 },
      { category_id: catMap['Sandeko'], name: 'Chips Sandeko', price: 220, is_veg: true, sort_order: 5 },
      { category_id: catMap['Sandeko'], name: 'Mix Veg Sandeko', price: 240, is_veg: true, sort_order: 6 },
      { category_id: catMap['Sandeko'], name: 'Mix Chicken Sandeko', price: 320, is_veg: false, sort_order: 7 },

      // ── Popcorn ──
      { category_id: catMap['Popcorn'], name: 'Small Chicken Popcorn', price: 280, is_veg: false, sort_order: 1 },
      { category_id: catMap['Popcorn'], name: 'Large Chicken Popcorn', price: 360, is_veg: false, sort_order: 2 },
      { category_id: catMap['Popcorn'], name: 'Fish Popcorn', price: 350, is_veg: false, sort_order: 3 },

      // ── Salad ──
      { category_id: catMap['Salad'], name: 'Green Salad', price: 180, is_veg: true, sort_order: 1 },
      { category_id: catMap['Salad'], name: 'Green Nepali Style Salad', price: 195, is_veg: true, sort_order: 2 },
      { category_id: catMap['Salad'], name: 'Fruit Salad', price: 300, is_veg: true, sort_order: 3 },
      { category_id: catMap['Salad'], name: 'Corn Salad', price: 200, is_veg: true, sort_order: 4 },
      { category_id: catMap['Salad'], name: 'Chicken Salad', price: 360, is_veg: false, sort_order: 5 },
      { category_id: catMap['Salad'], name: 'Paneer Salad', price: 360, is_veg: true, sort_order: 6 },

      // ── Desert ──
      { category_id: catMap['Desert'], name: 'Ice Cream (Single Scoop)', price: 90, is_veg: true, sort_order: 1 },
      { category_id: catMap['Desert'], name: 'Ice Cream (Double Scoop)', price: 150, is_veg: true, sort_order: 2 },
      { category_id: catMap['Desert'], name: 'Kulfi', price: 60, is_veg: true, sort_order: 3 },
      { category_id: catMap['Desert'], name: 'Corneto (Small)', price: 100, is_veg: true, sort_order: 4 },
      { category_id: catMap['Desert'], name: 'Corneto (Large)', price: 130, is_veg: true, sort_order: 5 },
      { category_id: catMap['Desert'], name: 'Cup Ice Cream', price: 70, is_veg: true, sort_order: 6 },

      // ── Khaja Set ──
      { category_id: catMap['Khaja Set'], name: 'Chicken Khaja Set', price: 450, is_veg: false, sort_order: 1 },
      { category_id: catMap['Khaja Set'], name: 'Mutton Khaja Set', price: 550, is_veg: false, sort_order: 2 },
      { category_id: catMap['Khaja Set'], name: 'Paneer Khaja Set', price: 450, is_veg: true, sort_order: 3 },

      // ── Momo (Chicken) ──
      { category_id: catMap['Momo'], name: 'Steam Chicken Momo', price: 220, is_veg: false, sort_order: 1 },
      { category_id: catMap['Momo'], name: 'Fry Chicken Momo', price: 240, is_veg: false, sort_order: 2 },
      { category_id: catMap['Momo'], name: 'Kothey Chicken Momo', price: 240, is_veg: false, sort_order: 3 },
      { category_id: catMap['Momo'], name: 'Jhol Chicken Momo', price: 260, is_veg: false, sort_order: 4 },
      { category_id: catMap['Momo'], name: 'Sandeko Chicken Momo', price: 260, is_veg: false, sort_order: 5 },
      { category_id: catMap['Momo'], name: 'C Chicken Momo', price: 270, is_veg: false, sort_order: 6 },
      { category_id: catMap['Momo'], name: 'Cheese Chicken Momo', price: 410, is_veg: false, sort_order: 7 },

      // ── Momo (Veg) ──
      { category_id: catMap['Momo'], name: 'Steam Veg Momo', price: 160, is_veg: true, sort_order: 8 },
      { category_id: catMap['Momo'], name: 'Fry Veg Momo', price: 200, is_veg: true, sort_order: 9 },
      { category_id: catMap['Momo'], name: 'Kothey Veg Momo', price: 200, is_veg: true, sort_order: 10 },
      { category_id: catMap['Momo'], name: 'Jhol Veg Momo', price: 200, is_veg: true, sort_order: 11 },
      { category_id: catMap['Momo'], name: 'Sandeko Veg Momo', price: 220, is_veg: true, sort_order: 12 },
      { category_id: catMap['Momo'], name: 'C Veg Momo', price: 240, is_veg: true, sort_order: 13 },
      { category_id: catMap['Momo'], name: 'Cheese Veg Momo', price: 330, is_veg: true, sort_order: 14 },

      // ── Chowmein ──
      { category_id: catMap['Chowmein'], name: 'Veg Chowmein', price: 170, is_veg: true, sort_order: 1 },
      { category_id: catMap['Chowmein'], name: 'Egg Chowmein', price: 200, is_veg: false, sort_order: 2 },
      { category_id: catMap['Chowmein'], name: 'Chicken Chowmein', price: 210, is_veg: false, sort_order: 3 },
      { category_id: catMap['Chowmein'], name: 'Mix Chowmein', price: 280, is_veg: false, sort_order: 4 },
      { category_id: catMap['Chowmein'], name: 'Keema Chowmein', price: 270, is_veg: false, sort_order: 5 },
      { category_id: catMap['Chowmein'], name: 'Chilli Garlic Chowmein', price: 240, is_veg: false, sort_order: 6 },
      { category_id: catMap['Chowmein'], name: 'Timur Chilli Garlic Chowmein', price: 250, is_veg: false, sort_order: 7 },
      { category_id: catMap['Chowmein'], name: 'Egg Volcano Chowmein', price: 250, is_veg: false, sort_order: 8 },

      // ── Thukpa ──
      { category_id: catMap['Thukpa'], name: 'Chicken Thukpa', price: 280, is_veg: false, sort_order: 1 },
      { category_id: catMap['Thukpa'], name: 'Veg Thukpa', price: 200, is_veg: true, sort_order: 2 },
      { category_id: catMap['Thukpa'], name: 'Mix Thukpa', price: 320, is_veg: false, sort_order: 3 },
      { category_id: catMap['Thukpa'], name: 'Egg Thukpa', price: 230, is_veg: false, sort_order: 4 },
      { category_id: catMap['Thukpa'], name: 'Waiwai Jhol Thukpa', price: 160, is_veg: false, sort_order: 5 },

      // ── Happy Hills Special ──
      { category_id: catMap['Happy Hills Special'], name: 'Crunchy Fried Chicken', price: 210, is_veg: false, sort_order: 1 },
      { category_id: catMap['Happy Hills Special'], name: 'Grilled Chicken', price: 490, is_veg: false, sort_order: 2 },
      { category_id: catMap['Happy Hills Special'], name: 'Cheesy Burger', price: 430, is_veg: false, sort_order: 3 },
      { category_id: catMap['Happy Hills Special'], name: 'Cheesy Wings', price: 460, is_veg: false, sort_order: 4 },
      { category_id: catMap['Happy Hills Special'], name: 'Chicken Sausage Fry', price: 200, is_veg: false, sort_order: 5 },
      { category_id: catMap['Happy Hills Special'], name: 'Chicken Fry Nepali Style', price: 380, is_veg: false, sort_order: 6 },
      { category_id: catMap['Happy Hills Special'], name: 'Wings Fry', price: 380, is_veg: false, sort_order: 7 },
      { category_id: catMap['Happy Hills Special'], name: 'Timur Chicken', price: 360, is_veg: false, sort_order: 8 },
      { category_id: catMap['Happy Hills Special'], name: 'Paneer Pakauda', price: 340, is_veg: true, sort_order: 9 },
      { category_id: catMap['Happy Hills Special'], name: 'Mushroom Fry', price: 270, is_veg: true, sort_order: 10 },
      { category_id: catMap['Happy Hills Special'], name: 'Fish Finger', price: 350, is_veg: false, sort_order: 11 },
      { category_id: catMap['Happy Hills Special'], name: 'Mustang Aalu', price: 220, is_veg: true, sort_order: 12 },

      // ── Hot Beverage ──
      { category_id: catMap['Hot Beverage'], name: 'Milk Coffee', price: 140, is_veg: true, sort_order: 1 },
      { category_id: catMap['Hot Beverage'], name: 'Black Coffee', price: 90, is_veg: true, sort_order: 2 },
      { category_id: catMap['Hot Beverage'], name: 'Milk Tea', price: 70, is_veg: true, sort_order: 3 },
      { category_id: catMap['Hot Beverage'], name: 'Black Tea', price: 50, is_veg: true, sort_order: 4 },
      { category_id: catMap['Hot Beverage'], name: 'Lemon Tea', price: 60, is_veg: true, sort_order: 5 },
      { category_id: catMap['Hot Beverage'], name: 'Hot Lemon with Honey', price: 120, is_veg: true, sort_order: 6 },
      { category_id: catMap['Hot Beverage'], name: 'Ginger Tea', price: 60, is_veg: true, sort_order: 7 },
      { category_id: catMap['Hot Beverage'], name: 'Hot Chocolate', price: 160, is_veg: true, sort_order: 8 },
      { category_id: catMap['Hot Beverage'], name: 'Masala Tea', price: 85, is_veg: true, sort_order: 9 },
      { category_id: catMap['Hot Beverage'], name: 'Hot Lemon', price: 60, is_veg: true, sort_order: 10 },
      { category_id: catMap['Hot Beverage'], name: 'Black Masala Tea', price: 55, is_veg: true, sort_order: 11 },

      // ── Curry / Khana Set ──
      { category_id: catMap['Curry / Khana Set'], name: 'Roti (MOQ - 6 pcs)', price: 30, is_veg: true, sort_order: 1 },
      { category_id: catMap['Curry / Khana Set'], name: 'Chicken Curry', price: 300, is_veg: false, sort_order: 2 },
      { category_id: catMap['Curry / Khana Set'], name: 'Mix Veg Curry', price: 250, is_veg: true, sort_order: 3 },
      { category_id: catMap['Curry / Khana Set'], name: 'Paneer Curry', price: 280, is_veg: true, sort_order: 4 },
      { category_id: catMap['Curry / Khana Set'], name: 'Mutton Curry', price: 420, is_veg: false, sort_order: 5 },
      { category_id: catMap['Curry / Khana Set'], name: 'Dal Fry', price: 180, is_veg: true, sort_order: 6 },
      { category_id: catMap['Curry / Khana Set'], name: 'Chicken Khana Set', price: 450, is_veg: false, sort_order: 7 },
      { category_id: catMap['Curry / Khana Set'], name: 'Veg Khana Set', price: 320, is_veg: true, sort_order: 8 },
      { category_id: catMap['Curry / Khana Set'], name: 'Local Chicken Khana Set', price: 550, is_veg: false, sort_order: 9 },
      { category_id: catMap['Curry / Khana Set'], name: 'Mutton Khana Set', price: 600, is_veg: false, sort_order: 10 },
      { category_id: catMap['Curry / Khana Set'], name: 'Fish Khana Set', price: 500, is_veg: false, sort_order: 11 },

      // ── Breakfast ──
      { category_id: catMap['Breakfast'], name: 'American Breakfast', price: 300, is_veg: false, sort_order: 1 },
      { category_id: catMap['Breakfast'], name: 'French Toast', price: 200, is_veg: true, sort_order: 2 },
      { category_id: catMap['Breakfast'], name: 'Egg Sandwich', price: 220, is_veg: false, sort_order: 3 },
      { category_id: catMap['Breakfast'], name: 'Chicken Sandwich', price: 230, is_veg: false, sort_order: 4 },
      { category_id: catMap['Breakfast'], name: 'Veg Sandwich', price: 220, is_veg: true, sort_order: 5 },
      { category_id: catMap['Breakfast'], name: 'Plain Omelette', price: 120, is_veg: false, sort_order: 6 },
      { category_id: catMap['Breakfast'], name: 'Masala Omlette', price: 150, is_veg: false, sort_order: 7 },
      { category_id: catMap['Breakfast'], name: 'Chana Aanda', price: 200, is_veg: false, sort_order: 8 },
      { category_id: catMap['Breakfast'], name: 'Boiled Egg', price: 60, is_veg: false, sort_order: 9 },
      { category_id: catMap['Breakfast'], name: 'Sausage Fry', price: 200, is_veg: false, sort_order: 10 },

      // ── Drinks ──
      { category_id: catMap['Drinks'], name: 'Water', price: 40, is_veg: true, sort_order: 1 },
      { category_id: catMap['Drinks'], name: 'Real Juice', price: 40, is_veg: true, sort_order: 2 },
      { category_id: catMap['Drinks'], name: 'Red Bull', price: 180, is_veg: true, sort_order: 3 },
      { category_id: catMap['Drinks'], name: 'Coke 500 ml', price: 150, is_veg: true, sort_order: 4 },
      { category_id: catMap['Drinks'], name: 'Coke 250 ml', price: 90, is_veg: true, sort_order: 5 },
      { category_id: catMap['Drinks'], name: 'Sprite with lemon', price: 120, is_veg: true, sort_order: 6 },
      { category_id: catMap['Drinks'], name: 'Sprite 250 ml', price: 90, is_veg: true, sort_order: 7 },
      { category_id: catMap['Drinks'], name: 'Fanta 250 ml', price: 90, is_veg: true, sort_order: 8 },
      { category_id: catMap['Drinks'], name: 'Plain Lassi', price: 150, is_veg: true, sort_order: 9 },
      { category_id: catMap['Drinks'], name: 'Banana Lassi', price: 180, is_veg: true, sort_order: 10 },
      { category_id: catMap['Drinks'], name: 'Sweet Lassi', price: 160, is_veg: true, sort_order: 11 },
      { category_id: catMap['Drinks'], name: 'Ice Cream Lassi', price: 200, is_veg: true, sort_order: 12 },
      { category_id: catMap['Drinks'], name: 'Xtreme', price: 200, is_veg: true, sort_order: 13 },
      { category_id: catMap['Drinks'], name: 'Iced Tea', price: 130, is_veg: true, sort_order: 14 },
      { category_id: catMap['Drinks'], name: 'Cold Coffee', price: 180, is_veg: true, sort_order: 15 },

      // ── Burger ──
      { category_id: catMap['Burger'], name: 'Veg. Burger with fries', price: 210, is_veg: true, sort_order: 1 },
      { category_id: catMap['Burger'], name: 'Grilled Burger', price: 290, is_veg: false, sort_order: 2 },
      { category_id: catMap['Burger'], name: 'Crunchy Fried Burger', price: 330, is_veg: false, sort_order: 3 },
      { category_id: catMap['Burger'], name: 'Smokey BBQ Burger', price: 340, is_veg: false, sort_order: 4 },
      { category_id: catMap['Burger'], name: 'Extra Cheese', price: 60, is_veg: true, sort_order: 5 },

      // ── Hukka ──
      { category_id: catMap['Hukka'], name: 'Normal Hukka', price: 395, is_veg: true, sort_order: 1 },
      { category_id: catMap['Hukka'], name: 'Cloud Hukka', price: 590, is_veg: true, sort_order: 2 },
      { category_id: catMap['Hukka'], name: 'Normal Coal', price: 50, is_veg: true, sort_order: 3 },
      { category_id: catMap['Hukka'], name: 'Cloud Coal', price: 75, is_veg: true, sort_order: 4 },
      { category_id: catMap['Hukka'], name: 'Ice Pipe', price: 60, is_veg: true, sort_order: 5 },

      // ── Beer ──
      { category_id: catMap['Beer'], name: 'Tuborg', price: 650, is_veg: true, sort_order: 1 },
      { category_id: catMap['Beer'], name: 'Gorkha Strong', price: 550, is_veg: true, sort_order: 2 },
      { category_id: catMap['Beer'], name: 'Carlsberg', price: 700, is_veg: true, sort_order: 3 },
      { category_id: catMap['Beer'], name: 'Tuborg Can', price: 550, is_veg: true, sort_order: 4 },

      // ── Hard Drinks ──
      { category_id: catMap['Hard Drinks'], name: 'Old Durbar 60ml', price: 295, is_veg: true, sort_order: 1 },
      { category_id: catMap['Hard Drinks'], name: 'Old Durbar Full', price: 3950, is_veg: true, sort_order: 2 },
      { category_id: catMap['Hard Drinks'], name: '8848 Vodka 60ml', price: 270, is_veg: true, sort_order: 3 },
      { category_id: catMap['Hard Drinks'], name: '8848 Vodka Full', price: 3150, is_veg: true, sort_order: 4 },
      { category_id: catMap['Hard Drinks'], name: 'Khukuri Rum 60ml', price: 285, is_veg: true, sort_order: 5 },
      { category_id: catMap['Hard Drinks'], name: 'Khukuri Rum Full', price: 3750, is_veg: true, sort_order: 6 },
      { category_id: catMap['Hard Drinks'], name: 'Wine Full', price: 3750, is_veg: true, sort_order: 7 },
    ];

    // Add is_available to all items
    const itemsWithDefaults = menuItems.map((item) => ({
      ...item,
      is_available: true,
    }));

    await knex('menu_items').insert(itemsWithDefaults);
    console.log(`✓ Seeded ${menuItems.length} menu items across ${categories.length} categories`);
  }

  // ─── Promo Codes ───
  const promoCount = await knex('promo_codes').count('id as count').first();
  if (promoCount.count === 0) {
    await knex('promo_codes').insert([
      { code: 'WELCOME10', type: 'percent', value: 10, min_order: 0, max_uses: 0, used_count: 0, is_active: true },
      { code: 'FLAT100', type: 'flat', value: 100, min_order: 500, max_uses: 0, used_count: 0, is_active: true },
    ]);
    console.log('✓ Seeded promo codes');
  }

  // ─── Settings ───
  const settingsCount = await knex('settings').count('setting_key as count').first();
  if (settingsCount.count === 0) {
    await knex('settings').insert([
      { setting_key: 'restaurant_name', setting_value: 'Happy Hills' },
      { setting_key: 'restaurant_address', setting_value: 'Kathmandu, Nepal' },
      { setting_key: 'restaurant_phone', setting_value: '+977-1-4123456' },
      { setting_key: 'restaurant_website', setting_value: '' },
      { setting_key: 'tax_rate', setting_value: '13' },
      { setting_key: 'currency_symbol', setting_value: 'रू' },
    ]);
    console.log('✓ Seeded settings');
  }
};
