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
    const capacities = [2, 2, 4, 4, 4, 6, 6, 8, 8, 10];
    const sections = [
      'Window', 'Window', 'Main Hall', 'Main Hall', 'Main Hall',
      'Main Hall', 'Garden', 'Garden', 'Private', 'Private',
    ];
    const tables = capacities.map((capacity, i) => ({
      number: i + 1,
      capacity,
      section: sections[i],
      status: 'available',
    }));
    await knex('restaurant_tables').insert(tables);
    console.log('✓ Seeded restaurant tables');
  }

  // ─── Menu Categories ───
  const catCount = await knex('menu_categories').count('id as count').first();
  if (catCount.count === 0) {
    await knex('menu_categories').insert([
      { name: 'Appetizers', name_np: 'खाजा', sort_order: 1 },
      { name: 'Mains', name_np: 'मुख्य', sort_order: 2 },
      { name: 'Dal & Curry', name_np: 'दाल र तरकारी', sort_order: 3 },
      { name: 'Rice & Bread', name_np: 'भात र रोटी', sort_order: 4 },
      { name: 'Beverages', name_np: 'पेय पदार्थ', sort_order: 5 },
      { name: 'Desserts', name_np: 'मिठाई', sort_order: 6 },
    ]);
    console.log('✓ Seeded menu categories');

    // Fetch inserted category IDs
    const categories = await knex('menu_categories').select('id', 'name');
    const catMap = {};
    categories.forEach((c) => { catMap[c.name] = c.id; });

    const placeholder = (name) =>
      `https://placehold.co/400x300/e94560/white?text=${encodeURIComponent(name)}`;

    // ─── Menu Items ───
    const menuItems = [
      // Appetizers
      { category_id: catMap['Appetizers'], name: 'Chicken Momo', name_np: 'चिकन मम', price: 250, is_veg: false, sort_order: 1 },
      { category_id: catMap['Appetizers'], name: 'Veg Momo', name_np: 'भेज मम', price: 200, is_veg: true, sort_order: 2 },
      { category_id: catMap['Appetizers'], name: 'Aloo Sadeko', name_np: 'आलु सडेको', price: 150, is_veg: true, sort_order: 3 },
      { category_id: catMap['Appetizers'], name: 'Chicken Sekuwa', name_np: 'चिकन सेकुवा', price: 350, is_veg: false, sort_order: 4 },
      { category_id: catMap['Appetizers'], name: 'Chatpate', name_np: 'चटपटे', price: 120, is_veg: true, sort_order: 5 },
      { category_id: catMap['Appetizers'], name: 'Pani Puri', name_np: 'पानी पुरी', price: 100, is_veg: true, sort_order: 6 },

      // Mains
      { category_id: catMap['Mains'], name: 'Chicken Chowmein', name_np: 'चिकन चाउमिन', price: 280, is_veg: false, sort_order: 1 },
      { category_id: catMap['Mains'], name: 'Veg Thukpa', name_np: 'भेज थुक्पा', price: 220, is_veg: true, sort_order: 2 },
      { category_id: catMap['Mains'], name: 'Buff Choila', name_np: 'बफ चोइला', price: 400, is_veg: false, sort_order: 3 },
      { category_id: catMap['Mains'], name: 'Newari Khaja Set', name_np: 'नेवारी खाजा सेट', price: 550, is_veg: false, sort_order: 4 },
      { category_id: catMap['Mains'], name: 'Gorkhali Lamb', name_np: 'गोरखाली खसी', price: 650, is_veg: false, sort_order: 5 },

      // Dal & Curry
      { category_id: catMap['Dal & Curry'], name: 'Dal Bhat Tarkari Set', name_np: 'दाल भात तरकारी सेट', price: 350, is_veg: true, sort_order: 1 },
      { category_id: catMap['Dal & Curry'], name: 'Chicken Curry', name_np: 'चिकन तरकारी', price: 380, is_veg: false, sort_order: 2 },
      { category_id: catMap['Dal & Curry'], name: 'Paneer Butter Masala', name_np: 'पनीर बटर मसला', price: 320, is_veg: true, sort_order: 3 },
      { category_id: catMap['Dal & Curry'], name: 'Mushroom Curry', name_np: 'च्याउ तरकारी', price: 280, is_veg: true, sort_order: 4 },

      // Rice & Bread
      { category_id: catMap['Rice & Bread'], name: 'Jeera Rice', name_np: 'जीरा भात', price: 180, is_veg: true, sort_order: 1 },
      { category_id: catMap['Rice & Bread'], name: 'Butter Naan', name_np: 'बटर नान', price: 80, is_veg: true, sort_order: 2 },
      { category_id: catMap['Rice & Bread'], name: 'Garlic Naan', name_np: 'लसुन नान', price: 100, is_veg: true, sort_order: 3 },
      { category_id: catMap['Rice & Bread'], name: 'Tandoori Roti', name_np: 'तन्दुरी रोटी', price: 60, is_veg: true, sort_order: 4 },
      { category_id: catMap['Rice & Bread'], name: 'Fried Rice', name_np: 'फ्राइड राइस', price: 220, is_veg: true, sort_order: 5 },

      // Beverages
      { category_id: catMap['Beverages'], name: 'Masala Tea', name_np: 'मसला चिया', price: 60, is_veg: true, sort_order: 1 },
      { category_id: catMap['Beverages'], name: 'Mango Lassi', name_np: 'आँप लस्सी', price: 150, is_veg: true, sort_order: 2 },
      { category_id: catMap['Beverages'], name: 'Fresh Lime Soda', name_np: 'फ्रेश लाइम सोडा', price: 120, is_veg: true, sort_order: 3 },
      { category_id: catMap['Beverages'], name: 'Black Coffee', name_np: 'ब्ल्याक कफी', price: 100, is_veg: true, sort_order: 4 },
      { category_id: catMap['Beverages'], name: 'Banana Shake', name_np: 'केरा शेक', price: 180, is_veg: true, sort_order: 5 },

      // Desserts
      { category_id: catMap['Desserts'], name: 'Gulab Jamun', name_np: 'गुलाब जामुन', price: 180, is_veg: true, sort_order: 1 },
      { category_id: catMap['Desserts'], name: 'Juju Dhau', name_np: 'जुजु धौ', price: 150, is_veg: true, sort_order: 2 },
      { category_id: catMap['Desserts'], name: 'Rasgulla', name_np: 'रसगुल्ला', price: 160, is_veg: true, sort_order: 3 },
      { category_id: catMap['Desserts'], name: 'Kheer', name_np: 'खीर', price: 140, is_veg: true, sort_order: 4 },
    ];

    // Add image_url and is_available to all items
    const itemsWithDefaults = menuItems.map((item) => ({
      ...item,
      image_url: placeholder(item.name),
      is_available: true,
    }));

    await knex('menu_items').insert(itemsWithDefaults);
    console.log('✓ Seeded menu items');
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
      { setting_key: 'restaurant_name', setting_value: 'Namaste Kitchen' },
      { setting_key: 'restaurant_address', setting_value: '123 Main Street, Kathmandu, Nepal' },
      { setting_key: 'restaurant_phone', setting_value: '+977-1-4123456' },
      { setting_key: 'restaurant_website', setting_value: 'www.namastekitchen.com' },
      { setting_key: 'tax_rate', setting_value: '13' },
      { setting_key: 'currency_symbol', setting_value: 'रू' },
    ]);
    console.log('✓ Seeded settings');
  }
};
