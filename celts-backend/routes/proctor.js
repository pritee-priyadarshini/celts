// routes/proctor.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const ProctorLog = require('../models/ProctorLog');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Student posts proctoring events
router.post('/log', protect, restrictTo(['student']), [
  body('eventType').isIn(['webcam_snapshot','tab_switch','warning','face_missing','screen_share','proctor_note']),
  body('testSet').optional().isMongoId()
], async (req, res) => {
  const errs = validationResult(req); if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const { eventType, eventData, testSet } = req.body;
    const log = await ProctorLog.create({ student: req.user._id, testSet, eventType, eventData });
    return res.json({ message: 'logged', log });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Faculty/admin read logs for a test
router.get('/logs/:testId', protect, restrictTo(['faculty','admin']), async (req, res) => {
  try {
    const logs = await ProctorLog.find({ testSet: req.params.testId }).populate('student','name email').sort({ createdAt: -1 });
    return res.json(logs);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;
