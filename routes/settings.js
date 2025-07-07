const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

const db = new sqlite3.Database('./football_playground.db');

// Get all settings
router.get('/', (req, res) => {
  db.all('SELECT * FROM settings', (err, settings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    
    res.json(settingsMap);
  });
});

// Get specific setting
router.get('/:key', (req, res) => {
  const { key } = req.params;
  
  db.get('SELECT value FROM settings WHERE key = ?', [key], (err, setting) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ value: setting.value });
  });
});

// Update setting (admin only)
router.post('/:key', (req, res) => {
  // Check if admin is authenticated
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  
  const { key } = req.params;
  const { value } = req.body;
  
  db.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [value, key], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ message: 'Setting updated successfully' });
  });
});

// Update multiple settings at once (admin only)
router.post('/', (req, res) => {
  // Check if admin is authenticated
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  
  const settings = req.body;
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    let hasError = false;
    let completed = 0;
    const total = Object.keys(settings).length;
    
    if (total === 0) {
      return res.status(400).json({ error: 'No settings provided' });
    }
    
    Object.entries(settings).forEach(([key, value]) => {
      db.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [value, key], (err) => {
        if (err && !hasError) {
          hasError = true;
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Database error' });
        }
        
        completed++;
        
        if (completed === total) {
          if (!hasError) {
            db.run('COMMIT');
            res.json({ message: 'Settings updated successfully' });
          }
        }
      });
    });
  });
});

module.exports = router; 