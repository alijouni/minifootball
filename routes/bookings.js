const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const router = express.Router();
const telegramService = require('../services/telegramService'); // Adjust path as needed
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
  
 // New: Validate name to contain only letters (Arabic/English) and spaces
  const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    return res.status(400).json({ error: 'الاسم يجب أن يحتوي على حروف أبجدية فقط ومسافات.' });
  }


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

    // New check: Ensure user has only one booking per day based on phone number
    db.get('SELECT * FROM bookings WHERE phone = ? AND date = ? AND status != "cancelled"', 
      [phone, date], (err, existingUserBooking) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existingUserBooking) {
          return res.status(400).json({ error: 'لديك حجز واحد بالفعل في هذا التاريخ باستخدام رقم الهاتف هذا. لا يمكن إجراء أكثر من حجز واحد في اليوم.' });
        }
        
        // Original check: Check if slot is still available
        db.get('SELECT * FROM bookings WHERE date = ? AND start_time = ? AND status != "cancelled"', [date, start_time], (err, existingSlot) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (existingSlot) {
            return res.status(400).json({ error: 'هذا الموعد غير متاح حالياً.' });
          }
          
          // Insert booking
          db.run('INSERT INTO bookings (name, phone, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)', 
            [name, phone, date, start_time, end_time], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
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

                // Ensure an explicit return here for the success path
                return res.json({ message: 'تم إرسال طلبك بنجاح. سيتم التواصل معك قريباً لتأكيد الحجز.' });
              });
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