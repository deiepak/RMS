const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Get all settings (Public - needed for customer portal)
router.get('/', async (req, res) => {
  try {
    const settings = await db('settings').select('*');
    
    // Convert array of {setting_key, setting_value} into an object
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.setting_key] = s.setting_value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings (Admin only)
router.put('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const updates = req.body; // Expects an object: { restaurant_name: '...', tax_rate: '...' }
    
    // Update or insert each setting
    const queries = Object.keys(updates).map(key => {
      const value = updates[key] !== null ? String(updates[key]) : '';
      return db.raw(
        'INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()',
        [key, value]
      );
    });

    await Promise.all(queries);

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
