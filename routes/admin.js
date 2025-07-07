const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const bcrypt = require('bcryptjs');
const router = express.Router();

const db = new sqlite3.Database('./football_playground.db');

// Middleware to check admin authentication
const requireAdmin = (req, res, next) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
};

// Get all bookings
router.get('/bookings', requireAdmin, (req, res) => {
  const { date, status } = req.query;
  let query = 'SELECT * FROM bookings';
  const params = [];
  
  const conditions = [];
  if (date) {
    conditions.push('date = ?');
    params.push(date);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY date DESC, start_time ASC';
  
  db.all(query, params, (err, bookings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(bookings);
  });
});

// Update booking status
router.post('/bookings/:id/status', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.run('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Booking status updated successfully' });
  });
});

// Update booking payment status
router.post('/bookings/:id/payment', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { paid } = req.body;
  
  db.run('UPDATE bookings SET paid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [paid, id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Payment status updated successfully' });
  });
});

// Delete booking
router.delete('/bookings/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM bookings WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Booking deleted successfully' });
  });
});

// Get blacklist
router.get('/blacklist', requireAdmin, (req, res) => {
  db.all('SELECT * FROM blacklist ORDER BY created_at DESC', (err, blacklist) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(blacklist);
  });
});

// Add to blacklist
router.post('/blacklist', requireAdmin, (req, res) => {
  const { name, phone, reason } = req.body;
  
  // Validate phone number if provided (must be exactly 8 digits)
  if (phone && !/^[0-9]{8}$/.test(phone)) {
    return res.status(400).json({ error: 'رقم الهاتف يجب أن يكون 8 أرقام بالضبط' });
  }
  
  db.run('INSERT INTO blacklist (name, phone, reason) VALUES (?, ?, ?)', [name, phone, reason], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Added to blacklist successfully' });
  });
});

// Remove from blacklist
router.delete('/blacklist/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM blacklist WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Removed from blacklist successfully' });
  });
});

// Get reports
router.get('/reports', requireAdmin, (req, res) => {
  const { period, date } = req.query;
  
  let dateFilter = '';
  let params = [];
  
  if (period === 'daily' && date) {
    dateFilter = 'WHERE date = ?';
    params.push(date);
  } else if (period === 'weekly' && date) {
    const startOfWeek = moment(date).startOf('week').format('YYYY-MM-DD');
    const endOfWeek = moment(date).endOf('week').format('YYYY-MM-DD');
    dateFilter = 'WHERE date BETWEEN ? AND ?';
    params.push(startOfWeek, endOfWeek);
  } else if (period === 'monthly' && date) {
    const startOfMonth = moment(date).startOf('month').format('YYYY-MM-DD');
    const endOfMonth = moment(date).endOf('month').format('YYYY-MM-DD');
    dateFilter = 'WHERE date BETWEEN ? AND ?';
    params.push(startOfMonth, endOfMonth);
  }
  
  // Get booking statistics
  db.all(`
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
      COUNT(CASE WHEN paid = 1 THEN 1 END) as paid_bookings,
      SUM(CASE WHEN status = 'confirmed' AND paid = 1 THEN 
        (SELECT value FROM settings WHERE key = 'rental_price') 
        ELSE 0 END) as total_revenue
    FROM bookings ${dateFilter}
  `, params, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(stats[0]);
  });
});

// Get dashboard stats
router.get('/dashboard', requireAdmin, (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  
  db.all(`
    SELECT 
      (SELECT COUNT(*) FROM bookings WHERE date = ?) as today_bookings,
      (SELECT COUNT(*) FROM bookings WHERE status = 'pending') as pending_bookings,
      (SELECT COUNT(*) FROM bookings WHERE date >= ?) as this_month_bookings,
      (SELECT COUNT(*) FROM blacklist) as blacklist_count
  `, [today, moment().startOf('month').format('YYYY-MM-DD')], (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(stats[0]);
  });
});

// Get manager info
router.get('/manager-info', (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  db.get('SELECT username, name FROM playground_managers LIMIT 1', (err, manager) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(manager || {});
  });
});

// Change admin password
router.post('/change-password', (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { current_password, new_username, new_password } = req.body;
  
  // Get current admin
  db.get('SELECT * FROM admin WHERE id = ?', [req.session.admin.id], (err, admin) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    // Verify current password
    if (!bcrypt.compareSync(current_password, admin.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newPasswordHash = bcrypt.hashSync(new_password, 10);
    
    // Update admin
    db.run('UPDATE admin SET username = ?, password_hash = ? WHERE id = ?', 
      [new_username, newPasswordHash, admin.id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Update session
      req.session.admin.username = new_username;
      
      res.json({ message: 'Password changed successfully' });
    });
  });
});

// Change manager password
router.post('/change-manager-password', (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { new_username, new_password, manager_name } = req.body;
  
  // Hash new password
  const newPasswordHash = bcrypt.hashSync(new_password, 10);
  
  // Update manager
  db.run('UPDATE playground_managers SET username = ?, password_hash = ?, name = ? WHERE id = 1', 
    [new_username, newPasswordHash, manager_name], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ message: 'Manager password changed successfully' });
  });
});

module.exports = router; 