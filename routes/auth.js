const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { Admin, Manager } = require('../database/models');

// Admin login
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await Admin.findOne({ username });
    
    // // --- DEBUGGING LOGS ---
    // console.log('User found:', admin);
    // if (admin) {
    //     console.log('Stored hash:', admin.password_hash);
    //     console.log('Provided password:', password);
    // }
    // --- END DEBUGGING LOGS ---

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      console.log('Login failed: Invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.admin = { id: admin._id, username: admin.username };
    res.json({ message: 'Login successful', user: { id: admin._id, username: admin.username } });
  } catch (err) {
    console.error('Database error during login:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Manager login
router.post('/manager/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const manager = await Manager.findOne({ username });

    if (!manager || !bcrypt.compareSync(password, manager.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.manager = { id: manager._id, username: manager.username, name: manager.name };
    res.json({ message: 'Login successful', user: { id: manager._id, username: manager.username, name: manager.name } });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Check admin session
router.get('/admin/check', (req, res) => {
  if (req.session.admin) {
    res.json({ authenticated: true, user: { id: req.session.admin.id, username: req.session.admin.username } });
  } else {
    res.json({ authenticated: false });
  }
});

// Check manager session
router.get('/manager/check', (req, res) => {
  if (req.session.manager) {
    res.json({ authenticated: true, user: { id: req.session.manager.id, username: req.session.manager.username, name: req.session.manager.name } });
  } else {
    res.json({ authenticated: false });
  }
});

// Admin logout
router.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

// Manager logout
router.post('/manager/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;