const express = require('express');
const moment = require('moment');
const router = express.Router();
const telegramService = require('../services/telegramService');
const { Booking, Blacklist, Setting } = require('../database/models');

function generateTimeSlots(startTime, endTime, duration) {
  const slots = [];
  const start = moment(startTime, 'HH:mm');
  const end = moment(endTime, 'HH:mm');
  
  while (start.isBefore(end)) {
    const slotStart = start.format('HH:mm');
    const slotEnd = start.clone().add(duration, 'minutes').format('HH:mm');
    
    if (start.isSameOrBefore(end)) {
      slots.push({ start: slotStart, end: slotEnd });
    }
    start.add(duration, 'minutes');
  }
  
  return slots;
}

const requireAdmin = (req, res, next) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }
    next();
};

router.get('/slots/:date', async (req, res) => {
  try {
    const date = req.params.date;
    
    const settings = await Setting.find({ key: { $in: ["start_time", "end_time", "slot_duration"] } });
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    
    const startTime = settingsMap.start_time || '13:00';
    const endTime = settingsMap.end_time || '24:00';
    const duration = parseInt(settingsMap.slot_duration || '90');
    
    const allSlots = generateTimeSlots(startTime, endTime, duration);
    
    const bookings = await Booking.find({ date, status: { $ne: 'cancelled' } });
    const bookedSlots = bookings.map(booking => booking.start_time);
    
    const slotsWithStatus = allSlots.map(slot => ({
      start: slot.start,
      end: slot.end,
      available: !bookedSlots.includes(slot.start)
    }));
    
    res.json(slotsWithStatus);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/submit', async (req, res) => {
  const { name, phone, date, start_time, end_time } = req.body;
  
  const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    return res.status(400).json({ error: 'الاسم يجب أن يحتوي على حروف أبجدية فقط ومسافات.' });
  }

  const phoneRegex = /^[0-9]{8}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'رقم الهاتف يجب أن يكون 8 أرقام بالضبط' });
  }
  
  try {
    const blacklisted = await Blacklist.findOne({ $or: [{ name }, { phone }] });
    if (blacklisted) {
      return res.status(403).json({ error: 'للأسف لا يمكنك تأكيد أي حجز يرجى مراجعة الادارة' });
    }

    const existingUserBooking = await Booking.findOne({ phone, date, status: { $ne: 'cancelled' } });
    if (existingUserBooking) {
      return res.status(400).json({ error: 'لديك حجز واحد بالفعل في هذا التاريخ باستخدام رقم الهاتف هذا. لا يمكن إجراء أكثر من حجز واحد في اليوم.' });
    }
    
    const existingSlot = await Booking.findOne({ date, start_time, status: { $ne: 'cancelled' } });
    if (existingSlot) {
      return res.status(400).json({ error: 'هذا الموعد غير متاح حالياً.' });
    }
    
    await Booking.create({ name, phone, date, start_time, end_time });
    
    telegramService.notifyAdminAndManagerTelegram({
      name, phone, date, start_time, end_time
    });

    return res.json({ message: 'تم إرسال طلبك بنجاح. سيتم التواصل معك قريباً لتأكيد الحجز.' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/submit-admin', requireAdmin, async (req, res) => {
    const { name, phone, date, start_time, end_time, status } = req.body;

    const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/;
    if (!nameRegex.test(name)) {
        return res.status(400).json({ error: 'الاسم يجب أن يحتوي على حروف أبجدية فقط ومسافات.' });
    }

    const phoneRegex = /^[0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'رقم الهاتف يجب أن يكون 8 أرقام بالضبط' });
    }

    try {
        const existingSlot = await Booking.findOne({ date, start_time, status: { $ne: 'cancelled' } });
        if (existingSlot) {
            return res.status(400).json({ error: 'هذا الموعد غير متاح حالياً.' });
        }

        const bookingStatus = status || 'confirmed';
        await Booking.create({ name, phone, date, start_time, end_time, status: bookingStatus, paid: 1, collected_by: 'Admin' });
        
        res.json({ message: 'تم إضافة الحجز بنجاح' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/status/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    const bookings = await Booking.find({ phone }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;