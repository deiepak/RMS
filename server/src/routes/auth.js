const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { role, pin } = req.body;
    if (!role || !pin) {
      return res.status(400).json({ error: 'Role and PIN are required.' });
    }

    const employees = await db('employees').where({ role, is_active: true });
    
    if (!employees || employees.length === 0) {
      return res.status(401).json({ error: 'No active employees found for this role.' });
    }

    let matchedEmployee = null;
    for (const emp of employees) {
      const validPin = await bcrypt.compare(String(pin), emp.pin_hash);
      if (validPin) {
        matchedEmployee = emp;
        break;
      }
    }

    if (!matchedEmployee) {
      return res.status(401).json({ error: 'Invalid PIN.' });
    }

    const token = jwt.sign(
      { 
        id: matchedEmployee.id, 
        role: matchedEmployee.role, 
        name: matchedEmployee.name,
        station_id: matchedEmployee.station_id || null,
        access_pages: matchedEmployee.access_pages
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { 
        id: matchedEmployee.id, 
        role: matchedEmployee.role, 
        name: matchedEmployee.name,
        station_id: matchedEmployee.station_id || null,
        access_pages: matchedEmployee.access_pages
      },
    });
  } catch (err) {
    console.error('Auth login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/verify
router.get('/verify', verifyToken, async (req, res) => {
  try {
    const emp = await db('employees').where({ id: req.user.id, is_active: true }).first();
    if (!emp) {
      return res.status(401).json({ error: 'User no longer active.' });
    }
    res.json({ 
      valid: true, 
      user: {
        id: emp.id,
        role: emp.role,
        name: emp.name,
        station_id: emp.station_id || null,
        access_pages: emp.access_pages
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify user.' });
  }
});

module.exports = router;
