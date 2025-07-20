const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const router = express.Router();

const db = new sqlite3.Database('./football_playground.db');

const telegramService = require('../services/telegramService');

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
  
  // Validate phone number (must be exactly 8 digits)
  const phoneRegex = /^[0-9]{8}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'رقم الهاتف يجب أن يكون 8 أرقام بالضبط' });
  }
  
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
            [name, phone, date, start_time, end_time], function(err) {
            if (err) {
              console.error('Database error inserting booking:', err);
              return res.status(500).json({ error: 'Database error' });
            }

            // Optional: Call SMS notification service
            // smsService.notifyAdminAndManager({ ... }).then(...).catch(...);

            // Optional: Call WhatsApp notification service
            // whatsappService.notifyAdminAndManagerWhatsApp({ ... }).then(...).catch(...);

            // NEW: Call Telegram notification service
            telegramService.notifyAdminAndManagerTelegram({
                name: name,
                phone: phone,
                date: date,
                start_time: start_time,
                end_time: end_time
            })
            .then(result => {
                console.log('Telegram notification initiated:', result);
            })
            .catch(telegramError => {
                console.error('Error sending Telegram notification:', telegramError);
                // IMPORTANT: Do NOT block the booking confirmation even if Telegram notification fails
            });

            res.json({ message: 'تم إرسال طلبك بنجاح. سيتم التواصل معك قريباً لتأكيد الحجز.' });
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