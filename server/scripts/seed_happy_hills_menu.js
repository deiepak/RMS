const knex = require('knex');
const knexConfig = require('../knexfile');

const db = knex(knexConfig.development);

const categories = [
  'Soup',
  'Chilly',
  'Fries',
  'Sandeko',
  'Popcorn',
  'Salad',
  'Desert',
  'Khaja Set',
  'Momo',
  'Chowmein',
  'Thukpa',
  'Happy Hills Special',
  'Hot Beverage',
  'Breakfast',
  'Drinks',
  'Burger',
  'Hukka',
  'Beer',
  'Hard Drinks'
];

const menuItems = [
  // Soup
  { category: 'Soup', name: 'Veg Soup', price: 170, is_veg: true },
  { category: 'Soup', name: 'Mushroom Soup', price: 210, is_veg: true },
  { category: 'Soup', name: 'Chicken Soup', price: 210, is_veg: false },
  { category: 'Soup', name: 'Cream Soup', price: 220, is_veg: true },
  { category: 'Soup', name: 'Kodo Veg Soup', price: 210, is_veg: true },
  { category: 'Soup', name: 'Kodo Chicken Soup', price: 240, is_veg: false },

  // Chilly
  { category: 'Chilly', name: 'Chips Chilly', price: 250, is_veg: true },
  { category: 'Chilly', name: 'Mushroom Chilly', price: 300, is_veg: true },
  { category: 'Chilly', name: 'Chicken Chilly', price: 375, is_veg: false },
  { category: 'Chilly', name: 'Wings Chilly', price: 400, is_veg: false },
  { category: 'Chilly', name: 'Chicken Sausage Chilly', price: 350, is_veg: false },
  { category: 'Chilly', name: 'Paneer Chilly', price: 390, is_veg: true },
  { category: 'Chilly', name: 'Baby Corn Chilly', price: 300, is_veg: true },

  // Fries
  { category: 'Fries', name: 'Small French Fries', price: 190, is_veg: true },
  { category: 'Fries', name: 'Large French Fries', price: 220, is_veg: true },
  { category: 'Fries', name: 'Cheesy French Fries', price: 310, is_veg: true },

  // Sandeko
  { category: 'Sandeko', name: 'Wai Wai Sandeko', price: 160, is_veg: true },
  { category: 'Sandeko', name: 'Peanuts Sandeko', price: 220, is_veg: true },
  { category: 'Sandeko', name: 'Bhatmas Sandeko', price: 220, is_veg: true },
  { category: 'Sandeko', name: 'Chicken Sandeko', price: 375, is_veg: false },
  { category: 'Sandeko', name: 'Chips Sandeko', price: 220, is_veg: true },
  { category: 'Sandeko', name: 'Mix Veg Sandeko', price: 240, is_veg: true },
  { category: 'Sandeko', name: 'Mix Chicken Sandeko', price: 320, is_veg: false },

  // Popcorn
  { category: 'Popcorn', name: 'Small Chicken Popcorn', price: 280, is_veg: false },
  { category: 'Popcorn', name: 'Large Chicken Popcorn', price: 360, is_veg: false },
  { category: 'Popcorn', name: 'Fish Popcorn', price: 350, is_veg: false },

  // Salad
  { category: 'Salad', name: 'Green Salad', price: 180, is_veg: true },
  { category: 'Salad', name: 'Green Nepali Style Salad', price: 195, is_veg: true },
  { category: 'Salad', name: 'Fruit Salad', price: 300, is_veg: true },
  { category: 'Salad', name: 'Corn Salad', price: 200, is_veg: true },
  { category: 'Salad', name: 'Chicken Salad', price: 360, is_veg: false },
  { category: 'Salad', name: 'Paneer Salad', price: 360, is_veg: true },

  // Desert
  { category: 'Desert', name: 'Ice Cream (Single Scoop)', price: 90, is_veg: true },
  { category: 'Desert', name: 'Ice Cream (Double Scoop)', price: 150, is_veg: true },
  { category: 'Desert', name: 'Kulfi', price: 60, is_veg: true },
  { category: 'Desert', name: 'Corneto (Small)', price: 100, is_veg: true },
  { category: 'Desert', name: 'Corneto (Large)', price: 130, is_veg: true },
  { category: 'Desert', name: 'Cup Ice Cream', price: 70, is_veg: true },

  // Khaja Set
  { category: 'Khaja Set', name: 'Chicken Khaja Set', price: 450, is_veg: false },
  { category: 'Khaja Set', name: 'Mutton Khaja Set', price: 550, is_veg: false },
  { category: 'Khaja Set', name: 'Paneer Khaja Set', price: 450, is_veg: true },

  // Momo - Chicken
  { category: 'Momo', name: 'Steam Chicken Momo', price: 220, is_veg: false },
  { category: 'Momo', name: 'Fry Chicken Momo', price: 240, is_veg: false },
  { category: 'Momo', name: 'Kothey Chicken Momo', price: 240, is_veg: false },
  { category: 'Momo', name: 'Jhol Chicken Momo', price: 260, is_veg: false },
  { category: 'Momo', name: 'Sandeko Chicken Momo', price: 260, is_veg: false },
  { category: 'Momo', name: 'C Chicken Momo', price: 270, is_veg: false },
  { category: 'Momo', name: 'Cheese Chicken Momo', price: 410, is_veg: false },

  // Momo - Veg
  { category: 'Momo', name: 'Steam Veg Momo', price: 160, is_veg: true },
  { category: 'Momo', name: 'Fry Veg Momo', price: 200, is_veg: true },
  { category: 'Momo', name: 'Kothey Veg Momo', price: 200, is_veg: true },
  { category: 'Momo', name: 'Jhol Veg Momo', price: 200, is_veg: true },
  { category: 'Momo', name: 'Sandeko Veg Momo', price: 220, is_veg: true },
  { category: 'Momo', name: 'C Veg Momo', price: 240, is_veg: true },
  { category: 'Momo', name: 'Cheese Veg Momo', price: 330, is_veg: true },

  // Chowmein
  { category: 'Chowmein', name: 'Veg Chowmein', price: 170, is_veg: true },
  { category: 'Chowmein', name: 'Egg Chowmein', price: 200, is_veg: false },
  { category: 'Chowmein', name: 'Chicken Chowmein', price: 210, is_veg: false },
  { category: 'Chowmein', name: 'Mix Chowmein', price: 280, is_veg: false },
  { category: 'Chowmein', name: 'Keema Chowmein', price: 270, is_veg: false },
  { category: 'Chowmein', name: 'Chilli Garlic Chowmein', price: 240, is_veg: false },
  { category: 'Chowmein', name: 'Timur Chilli Garlic Chowmein', price: 250, is_veg: false },
  { category: 'Chowmein', name: 'Egg Volcano Chowmein', price: 250, is_veg: false },

  // Thukpa
  { category: 'Thukpa', name: 'Chicken Thukpa', price: 280, is_veg: false },
  { category: 'Thukpa', name: 'Veg Thukpa', price: 200, is_veg: true },
  { category: 'Thukpa', name: 'Mix Thukpa', price: 320, is_veg: false },
  { category: 'Thukpa', name: 'Egg Thukpa', price: 230, is_veg: false },
  { category: 'Thukpa', name: 'Waiwai Jhol Thukpa', price: 160, is_veg: false },

  // Happy Hills Special
  { category: 'Happy Hills Special', name: 'Crunchy Fried Chicken', price: 210, is_veg: false },
  { category: 'Happy Hills Special', name: 'Grilled Chicken', price: 490, is_veg: false },
  { category: 'Happy Hills Special', name: 'Cheesy Burger', price: 430, is_veg: false },
  { category: 'Happy Hills Special', name: 'Cheesy Wings', price: 460, is_veg: false },
  { category: 'Happy Hills Special', name: 'Chicken Sausage Fry', price: 200, is_veg: false },
  { category: 'Happy Hills Special', name: 'Chicken Fry Nepali Style', price: 380, is_veg: false },
  { category: 'Happy Hills Special', name: 'Wings Fry', price: 380, is_veg: false },
  { category: 'Happy Hills Special', name: 'Timur Chicken', price: 360, is_veg: false },
  { category: 'Happy Hills Special', name: 'Paneer Pakauda', price: 340, is_veg: true },
  { category: 'Happy Hills Special', name: 'Mushroom Fry', price: 270, is_veg: true },
  { category: 'Happy Hills Special', name: 'Fish Finger', price: 350, is_veg: false },
  { category: 'Happy Hills Special', name: 'Mustang Aalu', price: 220, is_veg: true },

  // Hot Beverage
  { category: 'Hot Beverage', name: 'Milk Coffee', price: 140, is_veg: true },
  { category: 'Hot Beverage', name: 'Black Coffee', price: 90, is_veg: true },
  { category: 'Hot Beverage', name: 'Milk Tea', price: 70, is_veg: true },
  { category: 'Hot Beverage', name: 'Black Tea', price: 50, is_veg: true },
  { category: 'Hot Beverage', name: 'Lemon Tea', price: 60, is_veg: true },
  { category: 'Hot Beverage', name: 'Hot Lemon with Honey', price: 120, is_veg: true },
  { category: 'Hot Beverage', name: 'Ginger Tea', price: 60, is_veg: true },
  { category: 'Hot Beverage', name: 'Hot Chocolate', price: 160, is_veg: true },
  { category: 'Hot Beverage', name: 'Masala Tea', price: 85, is_veg: true },
  { category: 'Hot Beverage', name: 'Hot Lemon', price: 60, is_veg: true },
  { category: 'Hot Beverage', name: 'Black Masala Tea', price: 55, is_veg: true },

  // Breakfast
  { category: 'Breakfast', name: 'American Breakfast', price: 300, is_veg: false },
  { category: 'Breakfast', name: 'French Toast', price: 200, is_veg: true },
  { category: 'Breakfast', name: 'Egg Sandwich', price: 220, is_veg: false },
  { category: 'Breakfast', name: 'Chicken Sandwich', price: 230, is_veg: false },
  { category: 'Breakfast', name: 'Veg Sandwich', price: 220, is_veg: true },
  { category: 'Breakfast', name: 'Plain Omelette', price: 120, is_veg: false },
  { category: 'Breakfast', name: 'Masala Omlette', price: 150, is_veg: false },
  { category: 'Breakfast', name: 'Chana Aanda', price: 200, is_veg: false },
  { category: 'Breakfast', name: 'Boiled Egg', price: 60, is_veg: false },
  { category: 'Breakfast', name: 'Sausage Fry', price: 200, is_veg: false },

  // Drinks
  { category: 'Drinks', name: 'Water', price: 40, is_veg: true },
  { category: 'Drinks', name: 'Real Juice', price: 40, is_veg: true },
  { category: 'Drinks', name: 'Red Bull', price: 180, is_veg: true },
  { category: 'Drinks', name: 'Coke 500 ml', price: 150, is_veg: true },
  { category: 'Drinks', name: 'Coke 250 ml', price: 90, is_veg: true },
  { category: 'Drinks', name: 'Sprite with lemon', price: 120, is_veg: true },
  { category: 'Drinks', name: 'Sprite 250 ml', price: 90, is_veg: true },
  { category: 'Drinks', name: 'Fanta 250 ml', price: 90, is_veg: true },
  { category: 'Drinks', name: 'Plain Lassi', price: 150, is_veg: true },
  { category: 'Drinks', name: 'Banana Lassi', price: 180, is_veg: true },
  { category: 'Drinks', name: 'Sweet Lassi', price: 160, is_veg: true },
  { category: 'Drinks', name: 'Ice Cream Lassi', price: 200, is_veg: true },
  { category: 'Drinks', name: 'Xtreme', price: 200, is_veg: true },
  { category: 'Drinks', name: 'Iced Tea', price: 130, is_veg: true },
  { category: 'Drinks', name: 'Cold Coffee', price: 180, is_veg: true },

  // Burger
  { category: 'Burger', name: 'Veg. Burger with fries', price: 210, is_veg: true },
  { category: 'Burger', name: 'Grilled Burger', price: 290, is_veg: false },
  { category: 'Burger', name: 'Crunchy Fried Burger', price: 330, is_veg: false },
  { category: 'Burger', name: 'Smokey BBQ Burger', price: 340, is_veg: false },
  { category: 'Burger', name: 'Extra Cheese', price: 60, is_veg: true },

  // Hukka
  { category: 'Hukka', name: 'Normal Hukka', price: 395, is_veg: true },
  { category: 'Hukka', name: 'Cloud Hukka', price: 590, is_veg: true },
  { category: 'Hukka', name: 'Normal Coal', price: 50, is_veg: true },
  { category: 'Hukka', name: 'Cloud Coal', price: 75, is_veg: true },
  { category: 'Hukka', name: 'Ice Pipe', price: 60, is_veg: true },

  // Beer
  { category: 'Beer', name: 'Tuborg', price: 650, is_veg: true },
  { category: 'Beer', name: 'Gorkha Strong', price: 550, is_veg: true },
  { category: 'Beer', name: 'Carlsberg', price: 700, is_veg: true },
  { category: 'Beer', name: 'Tuborg Can', price: 550, is_veg: true },

  // Hard Drinks
  { category: 'Hard Drinks', name: 'Old Durbar 60ml', price: 295, is_veg: true },
  { category: 'Hard Drinks', name: 'Old Durbar Full', price: 3950, is_veg: true },
  { category: 'Hard Drinks', name: '8848 Vodka 60ml', price: 270, is_veg: true },
  { category: 'Hard Drinks', name: '8848 Vodka Full', price: 3150, is_veg: true },
  { category: 'Hard Drinks', name: 'Khukuri Rum 60ml', price: 285, is_veg: true },
  { category: 'Hard Drinks', name: 'Khukuri Rum Full', price: 3750, is_veg: true },
  { category: 'Hard Drinks', name: 'Wine Full', price: 3750, is_veg: true }
];

async function seedMenu() {
  try {
    console.log('Starting menu seeding...');

    // 1. Soft delete all existing menu items so they don't show up in the POS
    console.log('Archiving existing menu items...');
    await db('menu_items').update({ is_available: false });

    // 2. We don't delete categories, we just append or find existing ones.
    const categoryMap = {}; // name -> id

    console.log('Inserting/finding categories...');
    for (let i = 0; i < categories.length; i++) {
      const catName = categories[i];
      // Check if it exists
      const existing = await db('menu_categories').where({ name: catName }).first();
      if (existing) {
        categoryMap[catName] = existing.id;
        // Optionally update sort_order
        await db('menu_categories').where({ id: existing.id }).update({ sort_order: i + 1 });
      } else {
        const [id] = await db('menu_categories').insert({
          name: catName,
          sort_order: i + 1
        });
        categoryMap[catName] = id;
      }
    }

    // 3. Insert new menu items
    console.log(`Inserting ${menuItems.length} new menu items...`);
    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const categoryId = categoryMap[item.category];
      
      if (!categoryId) {
        console.error(`Category ID not found for ${item.category}`);
        continue;
      }

      await db('menu_items').insert({
        category_id: categoryId,
        name: item.name,
        price: item.price,
        is_veg: item.is_veg,
        is_available: true,
        sort_order: i + 1
      });
    }

    console.log('✅ Menu seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding menu:', error);
    process.exit(1);
  }
}

seedMenu();
