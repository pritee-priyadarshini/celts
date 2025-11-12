// routes/admin.js
const express = require('express');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/secret', protect, restrictTo(['admin']), (req, res) => {
  res.json({ message: `Hello Admin ${req.user.name}`, user: { id: req.user._id, email: req.user.email } });
});

module.exports = router;
