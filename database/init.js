const bcrypt = require('bcryptjs');

module.exports = (db) => {
  // Create tables
  db.serialize(() => {
    // Bookings table
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      paid INTEGER DEFAULT 0,
      collected_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Blacklist table
    db.run(`CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Settings table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Playground managers table
    db.run(`CREATE TABLE IF NOT EXISTS playground_managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Admin table
    db.run(`CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default settings
    const defaultSettings = [
      { key: 'rental_price', value: '50000' },
      { key: 'playground_manager_fee', value: '5000' },
      { key: 'start_time', value: '13:00' },
      { key: 'end_time', value: '24:00' },
      { key: 'slot_duration', value: '90' },
      { key: 'whatsapp_number', value: '1234567890' },
      { key: 'site_title', value: 'ملعب بلدية رومين' },
      { key: 'site_description', value: 'ملعب بلدية رومين - قرب ثانوية رومين الرسمية' },
      { key: 'currency', value: 'ليرة لبنانية' },
      { key: 'address', value: 'قرب ثانوية رومين الرسمية' }
    ];

    defaultSettings.forEach(setting => {
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [setting.key, setting.value]);
    });

    // Create default admin user (username: admin, password: admin123)
    const adminPasswordHash = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO admin (username, password_hash) VALUES (?, ?)`, ['admin', adminPasswordHash]);

    // Create default playground manager (username: manager, password: manager123)
    const managerPasswordHash = bcrypt.hashSync('manager123', 10);
    db.run(`INSERT OR IGNORE INTO playground_managers (username, password_hash, name) VALUES (?, ?, ?)`, 
      ['manager', managerPasswordHash, 'مدير الملعب']);

    console.log('✅ Database initialized successfully');
    console.log('📋 Default admin credentials: admin / admin123');
    console.log('👷 Default manager credentials: manager / manager123');
  });
}; 