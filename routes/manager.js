const express = require('express');
const moment = require('moment');
const router = express.Router();
const { Booking, Setting, Manager } = require('../database/models');

const requireManager = (req, res, next) => {
  if (!req.session.manager) {
    return res.status(401).json({ error: 'Manager authentication required' });
  }
  next();
};

router.get('/matches', requireManager, async (req, res) => {
  try {
    const { date } = req.query;
    const today = date || moment().format('YYYY-MM-DD');
    const bookings = await Booking.find({ date: today, status: { $in: ['confirmed', 'pending'] } }).sort({ start_time: 1 });
    res.json({ matches: bookings });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/stats', requireManager, async (req, res) => {
  try {
    const managerName = req.session.manager.name;
    const stats = await Booking.aggregate([
      { $match: { collected_by: managerName } },
      {
        $group: {
          _id: null,
          totalHandled: { $sum: 1 },
          totalPaid: { $sum: { $cond: [{ $eq: ['$paid', 1] }, 1, 0] } }
        }
      }
    ]);
    const managerFeeSetting = await Setting.findOne({ key: 'playground_manager_fee' });
    const managerFee = managerFeeSetting ? parseFloat(managerFeeSetting.value) : 10;
    const totalFees = (stats[0]?.totalPaid || 0) * managerFee;

    res.json({
      totalHandled: stats[0]?.totalHandled || 0,
      totalPaid: stats[0]?.totalPaid || 0,
      totalFees
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/mark-paid/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const managerName = req.session.manager.name;
    const result = await Booking.findOneAndUpdate(
      { _id: id, status: 'confirmed', paid: 0 },
      { paid: 1, collected_by: managerName, updated_at: new Date() },
      { new: true }
    );
    if (!result) {
      return res.status(404).json({ error: 'Booking not found or already paid' });
    }
    res.json({ message: 'Payment marked as collected' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/mark-all-paid', requireManager, async (req, res) => {
  try {
    const { date } = req.body;
    const today = date || moment().format('YYYY-MM-DD');
    const managerName = req.session.manager.name;

    const result = await Booking.updateMany(
      { date: today, status: 'confirmed', paid: 0 },
      { paid: 1, collected_by: managerName, updated_at: new Date() }
    );
    res.json({
      message: 'All payments marked as collected',
      count: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/report', requireManager, async (req, res) => {
  try {
    const { period, date } = req.query;
    const managerName = req.session.manager.name;
    let filter = { collected_by: managerName };

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
          matchesHandled: { $sum: 1 },
          paymentsCollected: { $sum: { $cond: [{ $eq: ['$paid', 1] }, 1, 0] } }
        }
      }
    ]);

    const managerFeeSetting = await Setting.findOne({ key: 'playground_manager_fee' });
    const managerFee = managerFeeSetting ? parseFloat(managerFeeSetting.value) : 10;
    const feesEarned = (stats[0]?.paymentsCollected || 0) * managerFee;

    res.json({
      matchesHandled: stats[0]?.matchesHandled || 0,
      paymentsCollected: stats[0]?.paymentsCollected || 0,
      feesEarned
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/bookings', requireManager, async (req, res) => {
  try {
    const { date } = req.query;
    const today = date || moment().format('YYYY-MM-DD');
    const bookings = await Booking.find({ date: today, status: 'confirmed' }).sort({ start_time: 1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/bookings/:id/status', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Booking.findByIdAndUpdate(id, { status, updated_at: new Date() });
    res.json({ message: 'Booking status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/bookings/:id/collect', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const managerName = req.session.manager.name;
    await Booking.findByIdAndUpdate(id, { paid: 1, collected_by: managerName, updated_at: new Date() });
    res.json({ message: 'Payment marked as collected' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/dashboard', requireManager, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const managerName = req.session.manager.name;

    const todayMatches = await Booking.countDocuments({ date: today, status: 'confirmed' });
    const unpaidMatches = await Booking.countDocuments({ date: today, status: 'confirmed', paid: 0 });
    const totalHandled = await Booking.countDocuments({ collected_by: managerName });
    const managerFeeSetting = await Setting.findOne({ key: 'playground_manager_fee' });
    const managerFee = managerFeeSetting ? parseFloat(managerFeeSetting.value) : 10;
    const totalFeesEarned = totalHandled * managerFee;

    res.json({
      today_matches: todayMatches,
      unpaid_matches: unpaidMatches,
      total_handled: totalHandled,
      total_fees_earned: totalFeesEarned
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;