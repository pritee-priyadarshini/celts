// routes/adminBulk.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { parse } = require('csv-parse/sync');

// Accept JSON array or CSV body (raw)
router.post('/users/bulk', protect, restrictTo(['admin']), async (req, res) => {
  try {
    let items = [];
    if (Array.isArray(req.body)) items = req.body;
    else if (typeof req.body === 'string' && req.headers['content-type'] && req.headers['content-type'].includes('text/csv')) {
      // parse CSV
      const records = parse(req.body, { columns: true, skip_empty_lines: true });
      items = records;
    } else {
      return res.status(400).json({ message: 'Send JSON array or CSV body' });
    }

    const created = [];
    for (const it of items) {
      if (!it.email || !it.name) continue;
      const exists = await User.findOne({ email: it.email });
      if (exists) continue;
      const u = await User.create({ name: it.name, email: it.email, password: it.password || 'Welcome@123', role: it.role || 'student' });
      created.push(u);
    }
    return res.json({ created: created.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
