require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const moment = require('moment');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
    if (path.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

// Session configuration
app.use(session({
  secret: 'football-playground-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Database connection
const db = new sqlite3.Database('./football_playground.db');

// Initialize database
require('./database/init')(db);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/manager', require('./routes/manager'));

app.use('/api/settings', require('./routes/settings'));

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Protected routes - require authentication
app.get('/admin', (req, res) => {
  if (!req.session.admin) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  if (!req.session.admin) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/manager', (req, res) => {
  if (!req.session.manager) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'manager.html'));
});

app.get('/manager.html', (req, res) => {
  if (!req.session.manager) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'manager.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📄 Public site: http://localhost:${PORT}`);
  console.log(`⚙️  Admin panel: http://localhost:${PORT}/admin`);
  console.log(`👷 Manager panel: http://localhost:${PORT}/manager`);
});

module.exports = app; 