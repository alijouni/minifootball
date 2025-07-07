const express = require('express');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

const db = new sqlite3.Database('./football_playground.db');

// Admin login
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM admin WHERE username = ?', [username], (err, admin) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.admin = admin;
    res.json({ message: 'Login successful', user: { id: admin.id, username: admin.username } });
  });
});

// Manager login
router.post('/manager/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM playground_managers WHERE username = ?', [username], (err, manager) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!manager || !bcrypt.compareSync(password, manager.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.manager = manager;
    res.json({ message: 'Login successful', user: { id: manager.id, username: manager.username, name: manager.name } });
  });
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