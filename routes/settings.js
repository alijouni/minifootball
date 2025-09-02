const express = require('express');
const router = express.Router();
const { Setting } = require('../database/models');

const requireAdmin = (req, res, next) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
};

router.get('/', async (req, res) => {
  try {
    const settings = await Setting.find();
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    res.json(settingsMap);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await Setting.findOne({ key });
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ value: setting.value });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await Setting.findOneAndUpdate({ key }, { value, updated_at: new Date() }, { upsert: true });
    res.json({ message: 'Setting updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const settings = req.body;
    const operations = Object.entries(settings).map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { $set: { value, updated_at: new Date() } },
        upsert: true
      }
    }));
    await Setting.bulkWrite(operations);
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;