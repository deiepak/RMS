const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../uploads/employees');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const router = express.Router();

// All employee routes require admin auth
router.use(verifyToken, requireRole(['admin']));

// GET /api/employees
router.get('/', async (req, res) => {
  try {
    const employees = await db('employees')
      .leftJoin('stations', 'employees.station_id', 'stations.id')
      .select('employees.id', 'employees.name', 'employees.role', 'employees.station_id', 'stations.name as station_name', 'employees.is_active', 'employees.contact', 'employees.join_date', 'employees.monthly_salary', 'employees.dob', 'employees.address', 'employees.emergency_contact_name', 'employees.emergency_contact_phone', 'employees.employment_type', 'employees.hourly_rate', 'employees.access_pages', 'employees.photo_url', 'employees.id_photo_url', 'employees.created_at', 'employees.updated_at')
      .orderBy('employees.created_at');
    res.json(employees);
  } catch (err) {
    console.error('Employees list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/employees
router.post('/', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'id_photo', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, role, pin, station_id } = req.body;
    if (!name || !role || !pin) {
      return res.status(400).json({ error: 'name, role, and pin are required.' });
    }

    const pin_hash = await bcrypt.hash(String(pin), 10);
    const [id] = await db('employees').insert({ 
      name, 
      role, 
      pin_hash,
      station_id: station_id || null,
      contact: req.body.contact || null,
      join_date: req.body.join_date || null,
      monthly_salary: req.body.monthly_salary || 0,
      dob: req.body.dob || null,
      address: req.body.address || null,
      emergency_contact_name: req.body.emergency_contact_name || null,
      emergency_contact_phone: req.body.emergency_contact_phone || null,
      employment_type: req.body.employment_type || 'full-time',
      hourly_rate: req.body.hourly_rate || 0,
      access_pages: req.body.access_pages ? (typeof req.body.access_pages === 'string' ? req.body.access_pages : JSON.stringify(req.body.access_pages)) : null,
      photo_url: req.files && req.files['photo'] ? `/uploads/employees/${req.files['photo'][0].filename}` : null,
      id_photo_url: req.files && req.files['id_photo'] ? `/uploads/employees/${req.files['id_photo'][0].filename}` : null
    });

    const employee = await db('employees')
      .leftJoin('stations', 'employees.station_id', 'stations.id')
      .where({ 'employees.id': id })
      .select('employees.id', 'employees.name', 'employees.role', 'employees.station_id', 'stations.name as station_name', 'employees.is_active', 'employees.contact', 'employees.join_date', 'employees.monthly_salary', 'employees.dob', 'employees.address', 'employees.emergency_contact_name', 'employees.emergency_contact_phone', 'employees.employment_type', 'employees.hourly_rate', 'employees.access_pages', 'employees.photo_url', 'employees.id_photo_url', 'employees.created_at', 'employees.updated_at')
      .first();

    res.status(201).json(employee);
  } catch (err) {
    console.error('Employee create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/employees/:id
router.put('/:id', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'id_photo', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, role, is_active, station_id } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (station_id !== undefined) updates.station_id = station_id || null;
    if (req.body.contact !== undefined) updates.contact = req.body.contact;
    if (req.body.join_date !== undefined) updates.join_date = req.body.join_date;
    if (req.body.monthly_salary !== undefined) updates.monthly_salary = req.body.monthly_salary;
    if (req.body.dob !== undefined) updates.dob = req.body.dob;
    if (req.body.address !== undefined) updates.address = req.body.address;
    if (req.body.emergency_contact_name !== undefined) updates.emergency_contact_name = req.body.emergency_contact_name;
    if (req.body.emergency_contact_phone !== undefined) updates.emergency_contact_phone = req.body.emergency_contact_phone;
    if (req.body.employment_type !== undefined) updates.employment_type = req.body.employment_type;
    if (req.body.hourly_rate !== undefined) updates.hourly_rate = req.body.hourly_rate;
    if (req.body.access_pages !== undefined) updates.access_pages = req.body.access_pages ? (typeof req.body.access_pages === 'string' ? req.body.access_pages : JSON.stringify(req.body.access_pages)) : null;
    if (req.files && req.files['photo']) updates.photo_url = `/uploads/employees/${req.files['photo'][0].filename}`;
    if (req.files && req.files['id_photo']) updates.id_photo_url = `/uploads/employees/${req.files['id_photo'][0].filename}`;
    updates.updated_at = db.fn.now();

    const count = await db('employees').where({ id: req.params.id }).update(updates);
    if (count === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const employee = await db('employees')
      .leftJoin('stations', 'employees.station_id', 'stations.id')
      .where({ 'employees.id': req.params.id })
      .select('employees.id', 'employees.name', 'employees.role', 'employees.station_id', 'stations.name as station_name', 'employees.is_active', 'employees.contact', 'employees.join_date', 'employees.monthly_salary', 'employees.dob', 'employees.address', 'employees.emergency_contact_name', 'employees.emergency_contact_phone', 'employees.employment_type', 'employees.hourly_rate', 'employees.access_pages', 'employees.photo_url', 'employees.id_photo_url', 'employees.created_at', 'employees.updated_at')
      .first();

    res.json(employee);
  } catch (err) {
    console.error('Employee update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/employees/:id/pin - reset PIN
router.patch('/:id/pin', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'New PIN is required.' });
    }

    const pin_hash = await bcrypt.hash(String(pin), 10);
    const count = await db('employees')
      .where({ id: req.params.id })
      .update({ pin_hash, updated_at: db.fn.now() });

    if (count === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    res.json({ message: 'PIN updated successfully.' });
  } catch (err) {
    console.error('PIN reset error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/employees/:id - soft delete (deactivate)
router.delete('/:id', async (req, res) => {
  try {
    const count = await db('employees')
      .where({ id: req.params.id })
      .update({ is_active: false, updated_at: db.fn.now() });

    if (count === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    res.json({ message: 'Employee deactivated.' });
  } catch (err) {
    console.error('Employee delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// HR: Get employee detailed HR data
router.get('/:id/hr-data', async (req, res) => {
  try {
    const { id } = req.params;
    const leaves = await db('employee_leaves').where({ employee_id: id }).orderBy('created_at', 'desc');
    const payments = await db('employee_payments').where({ employee_id: id }).orderBy('created_at', 'desc');
    const attendance = await db('employee_attendance').where({ employee_id: id }).orderBy('clock_in', 'desc');
    const performance = await db('employee_performance').where({ employee_id: id }).orderBy('date', 'desc');
    const documents = await db('employee_documents').where({ employee_id: id }).orderBy('created_at', 'desc');
    res.json({ leaves, payments, attendance, performance, documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Add leave
router.post('/:id/leaves', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, type, reason } = req.body;
    const [leaveId] = await db('employee_leaves').insert({
      employee_id: id, start_date, end_date, type, reason, status: 'pending'
    });
    const leave = await db('employee_leaves').where({ id: leaveId }).first();
    res.status(201).json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Update leave status
router.put('/:id/leaves/:leaveId', async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status } = req.body;
    await db('employee_leaves').where({ id: leaveId }).update({ status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Add payment
router.post('/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_method, notes, bonus, deduction } = req.body;
    const [paymentId] = await db('employee_payments').insert({
      employee_id: id, amount, payment_method, notes, bonus, deduction
    });
    const payment = await db('employee_payments').where({ id: paymentId }).first();
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Clock In/Out (can be called by kitchen/waiter portal so we don't strictly require admin, but let's assume it's verified)
router.post('/:id/clock-in', async (req, res) => {
  try {
    const { id } = req.params;
    const [attId] = await db('employee_attendance').insert({
      employee_id: id, clock_in: new Date()
    });
    res.json({ success: true, id: attId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/clock-out', async (req, res) => {
  try {
    const { id } = req.params;
    // find latest open shift
    const openShift = await db('employee_attendance').where({ employee_id: id }).whereNull('clock_out').orderBy('clock_in', 'desc').first();
    if (!openShift) return res.status(400).json({ error: 'No open shift found' });
    
    const clock_out = new Date();
    const hours = (clock_out - new Date(openShift.clock_in)) / (1000 * 60 * 60);
    await db('employee_attendance').where({ id: openShift.id }).update({ clock_out, total_hours: hours.toFixed(2) });
    res.json({ success: true, hours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Add Performance Log
router.post('/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, notes, date } = req.body;
    const [perfId] = await db('employee_performance').insert({
      employee_id: id, type, notes, date
    });
    const perf = await db('employee_performance').where({ id: perfId }).first();
    res.json(perf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Add/Update Document
router.post('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const { document_name, status } = req.body;
    const [docId] = await db('employee_documents').insert({
      employee_id: id, document_name, status
    });
    const doc = await db('employee_documents').where({ id: docId }).first();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/documents/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const { status } = req.body;
    await db('employee_documents').where({ id: docId }).update({ status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
