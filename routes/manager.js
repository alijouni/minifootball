const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const router = express.Router();

const db = new sqlite3.Database('./football_playground.db');

// Middleware to check manager authentication
const requireManager = (req, res, next) => {
  if (!req.session.manager) {
    return res.status(401).json({ error: 'Manager authentication required' });
  }
  next();
};

// Get matches for manager view
router.get('/matches', requireManager, (req, res) => {
  const { date } = req.query;
  const today = date || moment().format('YYYY-MM-DD');
  
  db.all(`
    SELECT * FROM bookings 
    WHERE date = ? AND status IN ('confirmed', 'pending')
    ORDER BY start_time ASC
  `, [today], (err, bookings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ matches: bookings });
  });
});

// Get manager statistics
router.get('/stats', requireManager, (req, res) => {
  const managerName = req.session.manager.name;
  
  db.get(`
    SELECT 
      COUNT(*) as totalHandled,
      COALESCE(SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END), 0) as totalPaid,
      COALESCE(SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END) * 
        (SELECT COALESCE(value, 10) FROM settings WHERE key = 'playground_manager_fee'), 0) as totalFees
    FROM bookings 
    WHERE collected_by = ?
  `, [managerName], (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(stats);
  });
});

// Mark payment as collected
router.post('/mark-paid/:id', requireManager, (req, res) => {
  const { id } = req.params;
  const managerName = req.session.manager.name;
  
  db.run(`
    UPDATE bookings 
    SET paid = 1, collected_by = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND status = 'confirmed'
  `, [managerName, id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Booking not found or already paid' });
    }
    res.json({ message: 'Payment marked as collected' });
  });
});

// Mark all today's payments as collected
router.post('/mark-all-paid', requireManager, (req, res) => {
  const { date } = req.body;
  const today = date || moment().format('YYYY-MM-DD');
  const managerName = req.session.manager.name;
  
  db.run(`
    UPDATE bookings 
    SET paid = 1, collected_by = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE date = ? AND status = 'confirmed' AND paid = 0
  `, [managerName, today], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ 
      message: 'All payments marked as collected',
      count: this.changes
    });
  });
});

// Get manager reports
router.get('/report', requireManager, (req, res) => {
  const { period, date } = req.query;
  const managerName = req.session.manager.name;
  
  let dateFilter = '';
  let params = [managerName];
  
  if (period === 'daily' && date) {
    dateFilter = 'AND date = ?';
    params.push(date);
  } else if (period === 'weekly' && date) {
    const startOfWeek = moment(date).startOf('week').format('YYYY-MM-DD');
    const endOfWeek = moment(date).endOf('week').format('YYYY-MM-DD');
    dateFilter = 'AND date BETWEEN ? AND ?';
    params.push(startOfWeek, endOfWeek);
  } else if (period === 'monthly' && date) {
    const startOfMonth = moment(date).startOf('month').format('YYYY-MM-DD');
    const endOfMonth = moment(date).endOf('month').format('YYYY-MM-DD');
    dateFilter = 'AND date BETWEEN ? AND ?';
    params.push(startOfMonth, endOfMonth);
  }
  
  db.get(`
    SELECT 
      COUNT(*) as matchesHandled,
      COUNT(CASE WHEN paid = 1 THEN 1 END) as paymentsCollected,
      COUNT(CASE WHEN paid = 1 THEN 1 END) * 
        (SELECT COALESCE(value, 10) FROM settings WHERE key = 'playground_manager_fee') as feesEarned
    FROM bookings 
    WHERE collected_by = ? ${dateFilter}
  `, params, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(stats);
  });
});

// Get bookings for manager view (legacy endpoint)
router.get('/bookings', requireManager, (req, res) => {
  const { date } = req.query;
  const today = date || moment().format('YYYY-MM-DD');
  
  db.all(`
    SELECT * FROM bookings 
    WHERE date = ? AND status = 'confirmed'
    ORDER BY start_time ASC
  `, [today], (err, bookings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(bookings);
  });
});

// Update booking status
router.post('/bookings/:id/status', requireManager, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Booking status updated successfully' });
  });
});

// Mark payment as collected (legacy endpoint)
router.post('/bookings/:id/collect', requireManager, (req, res) => {
  const { id } = req.params;
  const managerName = req.session.manager.name;
  
  db.run(`
    UPDATE bookings 
    SET paid = 1, collected_by = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [managerName, id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Payment marked as collected' });
  });
});

// Get manager dashboard stats (legacy endpoint)
router.get('/dashboard', requireManager, (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  const managerName = req.session.manager.name;
  
  db.all(`
    SELECT 
      (SELECT COUNT(*) FROM bookings WHERE date = ? AND status = 'confirmed') as today_matches,
      (SELECT COUNT(*) FROM bookings WHERE date = ? AND status = 'confirmed' AND paid = 0) as unpaid_matches,
      (SELECT COUNT(*) FROM bookings WHERE collected_by = ?) as total_handled,
      (SELECT COUNT(*) FROM bookings WHERE collected_by = ?) * 
        (SELECT COALESCE(value, 10) FROM settings WHERE key = 'playground_manager_fee') as total_fees_earned
  `, [today, today, managerName, managerName], (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(stats[0]);
  });
});

module.exports = router; 