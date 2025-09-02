const mongoose = require('mongoose');

// Bookings Schema
const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  date: { type: String, required: true },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  status: { type: String, default: 'pending' },
  paid: { type: Number, default: 0 },
  collected_by: { type: String },
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

// Blacklist Schema
const blacklistSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String },
  reason: { type: String },
}, { timestamps: true });

const Blacklist = mongoose.model('Blacklist', blacklistSchema);

// Settings Schema
const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: String, required: true },
}, { timestamps: true });

const Setting = mongoose.model('Setting', settingSchema);

// Playground Managers Schema
const managerSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  name: { type: String, required: true },
}, { timestamps: true });

const Manager = mongoose.model('Manager', managerSchema);

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
}, { collection: 'admins', timestamps: true });
const Admin = mongoose.model('Admin', adminSchema);

module.exports = {
  Booking,
  Blacklist,
  Setting,
  Manager,
  Admin
};