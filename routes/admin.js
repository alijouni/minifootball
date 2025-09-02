const express = require('express');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { Booking, Blacklist, Setting, Admin, Manager } = require('../database/models');

const requireAdmin = (req, res, next) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
};

// Get all bookings
router.get('/bookings', requireAdmin, async (req, res) => {
  try {
    const { date, status } = req.query;
    const filter = {};

    if (date) {
      filter.date = date;
    }
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter).sort({ date: -1, start_time: 1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update booking status
router.post('/bookings/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Booking.findByIdAndUpdate(id, { status, updated_at: new Date() });
    res.json({ message: 'Booking status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update booking payment status
router.post('/bookings/:id/payment', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { paid } = req.body;
    await Booking.findByIdAndUpdate(id, { paid, updated_at: new Date() });
    res.json({ message: 'Payment status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete booking
router.delete('/bookings/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Booking.findByIdAndDelete(id);
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get blacklist
router.get('/blacklist', requireAdmin, async (req, res) => {
  try {
    const blacklist = await Blacklist.find().sort({ created_at: -1 });
    res.json(blacklist);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Add to blacklist
router.post('/blacklist', requireAdmin, async (req, res) => {
  try {
    const { name, phone, reason } = req.body;
    if (phone && !/^[0-9]{8}$/.test(phone)) {
      return res.status(400).json({ error: 'رقم الهاتف يجب أن يكون 8 أرقام بالضبط' });
    }
    await Blacklist.create({ name, phone, reason });
    res.json({ message: 'Added to blacklist successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Remove from blacklist
router.delete('/blacklist/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Blacklist.findByIdAndDelete(id);
    res.json({ message: 'Removed from blacklist successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reports
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const { period, date } = req.query;
    let filter = {};

    if (period === 'daily' && date) {
      filter.date = date;
    } else if (period === 'weekly' && date) {
      const startOfWeek = moment(date).startOf('week').format('YYYY-MM-DD');
      const endOfWeek = moment(date).endOf('week').format('YYYY-MM-DD');
      filter.date = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (period === 'monthly' && date) {
      const startOfMonth = moment(date).startOf('month').format('YYYY-MM-DD');
      const endOfMonth = moment(date).endOf('month').format('YYYY-MM-DD');
      filter.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const stats = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total_bookings: { $sum: 1 },
          confirmed_bookings: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
          pending_bookings: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          paid_bookings: { $sum: { $cond: [{ $eq: ['$paid', 1] }, 1, 0] } },
        }
      }
    ]);

    const rentalPriceSetting = await Setting.findOne({ key: 'rental_price' });
    const rentalPrice = rentalPriceSetting ? parseFloat(rentalPriceSetting.value) : 0;
    const totalRevenue = (stats[0]?.confirmed_bookings || 0) * rentalPrice;

    res.json({ ...stats[0], total_revenue: totalRevenue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get dashboard stats
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');

    const todayBookings = await Booking.countDocuments({ date: today });
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const thisMonthBookings = await Booking.countDocuments({ date: { $gte: startOfMonth } });
    const blacklistCount = await Blacklist.countDocuments();

    res.json({
      today_bookings: todayBookings,
      pending_bookings: pendingBookings,
      this_month_bookings: thisMonthBookings,
      blacklist_count: blacklistCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get manager info
router.get('/manager-info', async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const manager = await Manager.findOne({});
    res.json(manager || {});
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Change admin password
router.post('/change-password', async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { current_password, new_username, new_password } = req.body;
    const admin = await Admin.findById(req.session.admin.id);

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (!bcrypt.compareSync(current_password, admin.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = bcrypt.hashSync(new_password, 10);
    await Admin.findByIdAndUpdate(admin._id, { username: new_username, password_hash: newPasswordHash });

    req.session.admin.username = new_username;

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Change manager password
router.post('/change-manager-password', async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { new_username, new_password, manager_name } = req.body;
    const newPasswordHash = bcrypt.hashSync(new_password, 10);
    const manager = await Manager.findOne({});

    if (manager) {
      await Manager.findByIdAndUpdate(manager._id, { username: new_username, password_hash: newPasswordHash, name: manager_name });
    } else {
      await Manager.create({ username: new_username, password_hash: newPasswordHash, name: manager_name });
    }
    
    res.json({ message: 'Manager password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;