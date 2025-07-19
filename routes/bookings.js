const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const router = express.Router();

const db = new sqlite3.Database('./football_playground.db');

// Helper function to generate time slots
function generateTimeSlots(startTime, endTime, duration) {
  const slots = [];
  const start = moment(startTime, 'HH:mm');
  const end = moment(endTime, 'HH:mm');
  
  while (start.isBefore(end)) {
    const slotStart = start.format('HH:mm');
    const slotEnd = start.add(duration, 'minutes').format('HH:mm');
    
    if (start.isSameOrBefore(end)) {
      slots.push({ start: slotStart, end: slotEnd });
    }
  }
  
  return slots;
}

// Get available slots for a date
router.get('/slots/:date', (req, res) => {
  const date = req.params.date;
  
  // Get settings
  db.all('SELECT * FROM settings WHERE key IN ("start_time", "end_time", "slot_duration")', (err, settings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    
    const startTime = settingsMap.start_time || '13:00';
    const endTime = settingsMap.end_time || '24:00';
    const duration = parseInt(settingsMap.slot_duration || '90');
    
    // Generate all possible slots
    const allSlots = generateTimeSlots(startTime, endTime, duration);
    
    // Get booked slots for the date
    db.all('SELECT start_time, end_time, status FROM bookings WHERE date = ? AND status != "cancelled"', [date], (err, bookings) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const bookedSlots = bookings.map(booking => booking.start_time);
      
      // Mark slots as available or booked
      const slotsWithStatus = allSlots.map(slot => ({
        start: slot.start,
        end: slot.end,
        available: !bookedSlots.includes(slot.start)
      }));
      
      res.json(slotsWithStatus);
    });
  });
});

// Submit booking
router.post('/submit', (req, res) => {
  const { name, phone, date, start_time, end_time } = req.body;

  // Validate phone number (existing code with updated regex)
  const phoneRegex = /^(03|70|71|76|78|79|81)[0-9]{6}$/; // Ensure this is the updated regex
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'رقم الهاتف يجب أن يكون 8 أرقام بالضبط و يبدأ بـ 03، 70، 71، 76، 78، 79 أو 81' });
  }

  // Check if user is blacklisted (existing code)
  db.get('SELECT * FROM blacklist WHERE name = ? OR phone = ?', [name, phone], (err, blacklisted) => {
    if (err) {
      console.error('Database error checking blacklist:', err); // Add specific error logging
      return res.status(500).json({ error: 'Database error' });
    }

    if (blacklisted) {
      return res.status(403).json({ error: 'أنت غير مسموح لك بإجراء الحجوزات. يرجى التواصل مع الإدارة.' }); // More user-friendly message
    }

    // NEW: Check for existing booking by the same user on the same date
    db.get('SELECT * FROM bookings WHERE name = ? AND phone = ? AND date = ? AND status != "cancelled"',
      [name, phone, date], (err, existingBookingToday) => {
        if (err) {
          console.error('Database error checking for existing booking today:', err); // Add specific error logging
          return res.status(500).json({ error: 'Database error' });
        }

        if (existingBookingToday) {
          // If a booking already exists for this user on this date (and it's not cancelled)
          return res.status(400).json({ error: 'لديك حجز آخر مؤكد أو معلق في نفس التاريخ.' }); // Informative error
        }

        // Check if slot is still available (existing code)
        db.get('SELECT * FROM bookings WHERE date = ? AND start_time = ? AND status != "cancelled"', [date, start_time], (err, existing) => {
          if (err) {
            console.error('Database error checking slot availability:', err); // Add specific error logging
            return res.status(500).json({ error: 'Database error' });
          }

          if (existing) {
            return res.status(400).json({ error: 'هذا الموعد لم يعد متاحًا.' }); // Informative error
          }

          // Insert booking (existing code)
          db.run('INSERT INTO bookings (name, phone, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
            [name, phone, date, start_time, end_time], function(err) { // Use function(err) for 'this.lastID' if needed later
            if (err) {
              console.error('Database error inserting booking:', err); // Add specific error logging
              return res.status(500).json({ error: 'Database error' });
            }

            res.json({ message: 'تم إرسال طلبك بنجاح. سيتم التواصل معك قريباً لتأكيد الحجز.' }); // Updated message
          });
        });
      });
  });
  
  // Check if user is blacklisted
  db.get('SELECT * FROM blacklist WHERE name = ? OR phone = ?', [name, phone], (err, blacklisted) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (blacklisted) {
      return res.status(403).json({ error: 'You are not allowed to make bookings' });
    }
    
    // Check if slot is still available
    db.get('SELECT * FROM bookings WHERE date = ? AND start_time = ? AND status != "cancelled"', [date, start_time], (err, existing) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existing) {
        return res.status(400).json({ error: 'This slot is no longer available' });
      }
      
      // Insert booking
      db.run('INSERT INTO bookings (name, phone, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)', 
        [name, phone, date, start_time, end_time], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ message: 'تم إرسال طلبك بنجاح' });
      });
    });
  });
});

// Get booking details (for checking status)
router.get('/status/:phone', (req, res) => {
  const phone = req.params.phone;
  
  db.all('SELECT * FROM bookings WHERE phone = ? ORDER BY created_at DESC', [phone], (err, bookings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(bookings);
  });
});

module.exports = router; 