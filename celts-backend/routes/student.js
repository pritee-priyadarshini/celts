// routes/student.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const Submission = require('../models/Submission');
const TestSet = require('../models/TestSet');
const { submissionQueue } = require('../services/queue');
const mongoose = require('mongoose');

// Pre-checks: student must be allowed to start test (time window)
async function canStudentStart(testSet, student) {
  // If testSet.startTime defined: allow only if now >= startTime - 10min and <= endTime
  if (!testSet.startTime) return true;
  const now = new Date();
  const tenMinBefore = new Date(testSet.startTime.getTime() - 10 * 60 * 1000);
  if (now < tenMinBefore) return false; // too early
  if (testSet.endTime && now > testSet.endTime) return false; // too late
  return true;
}

/**
 * Submit for a skill. For Listening/Reading: response = [{questionIndex, answer}, ...]
 * For Writing: response = string
 * For Speaking: response = audio URL (string) or transcript
 */
router.post('/submit/:testId/:skill', protect, restrictTo(['student']), [
  body('response').notEmpty()
], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { testId, skill } = req.params;
  if (!mongoose.Types.ObjectId.isValid(testId)) return res.status(400).json({ message: 'Invalid testId' });
  try {
    const testSet = await TestSet.findById(testId);
    if (!testSet) return res.status(404).json({ message: 'Test not found' });
    const allowed = await canStudentStart(testSet, req.user);
    if (!allowed) return res.status(403).json({ message: 'Not allowed to start/submit this test now (timing rules)' });

    const submission = await Submission.create({
      student: req.user._id, testSet: testSet._id, skill, response: req.body.response, status: 'pending'
    });

    // Enqueue job
    const jobData = { submissionId: submission._id.toString(), studentId: req.user._id.toString(), testId: testSet._id.toString(), skill, response: req.body.response };
    const job = await submissionQueue.add(jobData);

    return res.status(202).json({ message: 'Submission accepted', submissionId: submission._id, jobId: job.id || null });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
