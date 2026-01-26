const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

const Submission = require('../models/Submission');
const TestSet = require('../models/TestSet');
const TestAttempt = require('../models/TestAttempt');
const Batch = require('../models/Batch');
const StudentStats = require('../models/StudentStats');
const { submissionQueue, addSubmissionJob } = require('../services/queue');
const uploadStudentMedia = require('../services/uploadStudentMedia');
const { paginate } = require("../utils/pagination");


function computeBandScore(earnedMarks, maxMarks) {
  if (!maxMarks || maxMarks <= 0) return 0;
  const raw = (earnedMarks / maxMarks) * 9;
  return Math.round(raw * 2) / 2;
}

async function updateStudentStatsForSkill({ student, skill, bandScore }) {
  if (bandScore == null) return;

  const batch = await Batch.findOne({ students: student._id }).select('_id name').lean();

  let stats = await StudentStats.findOne({ student: student._id });
  if (!stats) {
    stats = new StudentStats({
      student: student._id,
      name: student.name,
      email: student.email,
      systemId: student.systemId,
      batch: batch ? batch._id : null,
      batchName: batch ? batch.name : null,
    });
  } else {
    stats.name = student.name;
    stats.email = student.email;
    stats.systemId = student.systemId;
    if (batch) {
      stats.batch = batch._id;
      stats.batchName = batch.name;
    }
  }

  if (skill === 'reading') stats.readingBand = bandScore;
  if (skill === 'listening') stats.listeningBand = bandScore;
  if (skill === 'writing') stats.writingBand = bandScore;
  if (skill === 'speaking') stats.speakingBand = bandScore;

  // compute overall as average of available skills
  const values = [
    stats.readingBand,
    stats.listeningBand,
    stats.writingBand,
    stats.speakingBand,
  ].filter((v) => typeof v === 'number' && v > 0);

  stats.overallBand = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2 : null;

  await stats.save();
}

// GET /api/student/tests 
// Returns tests assigned to student's batches OR directly to student
router.get('/tests', protect, restrictTo(['student']), async (req, res) => {
  try {
    const studentId = req.user._id;

    // Find all batches this student belongs to
    const studentBatches = await Batch.find({ students: studentId })
      .select('_id name program year section')
      .lean();

    const batchIds = studentBatches.map((b) => b._id);

    // Tests assigned via batches or directly
    const orClauses = [{ assignedStudents: studentId }];
    if (batchIds.length > 0) {
      orClauses.push({ assignedBatches: { $in: batchIds } });
    }

    // const tests = await TestSet.find({ $or: orClauses })
    //   .sort({ createdAt: -1 })
    //   .lean();
    const paginated = await paginate(req, TestSet, {
      filter: { $or: orClauses },
      sort: { createdAt: -1 },
      defaultLimit: 20,
      maxLimit: 50,
    });
    const tests = paginated.data;

    // Get test attempts for this student
    const testAttempts = await TestAttempt.find({
      student: studentId,
      testSet: { $in: tests.map(t => t._id) }
    }).lean();

    // Get submissions for this student to check evaluation status
    const submissions = await Submission.find({
      student: studentId,
      testSet: { $in: tests.map(t => t._id) }
    }).select('testSet skill status bandScore totalMarks maxMarks').lean();

    // Create a map of testId -> attempt info
    const attemptMap = new Map();
    testAttempts.forEach(attempt => {
      const testId = String(attempt.testSet);
      const existing = attemptMap.get(testId);

      // Keep the latest attempt or the completed one
      if (!existing ||
        attempt.status === 'completed' ||
        (attempt.status !== 'started' && existing.status === 'started') ||
        attempt.createdAt > existing.createdAt) {
        attemptMap.set(testId, {
          status: attempt.status,
          attemptNumber: attempt.attemptNumber,
          isRetryAllowed: attempt.isRetryAllowed,
          completedAt: attempt.completedAt,
          startedAt: attempt.startedAt
        });
      }
    });

    // Create a map of testId -> submission status
    const submissionMap = new Map();
    submissions.forEach(submission => {
      const testId = String(submission.testSet);
      const existing = submissionMap.get(testId);

      // Collect all submissions for the test
      if (!existing) {
        submissionMap.set(testId, {
          hasSubmissions: true,
          allGraded: submission.status === 'graded',
          anyPending: submission.status === 'pending',
          anyFailed: submission.status === 'failed',
          submissions: [submission]
        });
      } else {
        existing.submissions.push(submission);
        existing.allGraded = existing.allGraded && submission.status === 'graded';
        existing.anyPending = existing.anyPending || submission.status === 'pending';
        existing.anyFailed = existing.anyFailed || submission.status === 'failed';
      }
    });

    const normalizedTests = tests.map((t) => {
      const now = new Date();
      let status = 'upcoming';

      // Determine status based on startTime and endTime
      if (t.startTime) {
        const startTime = new Date(t.startTime);
        const endTime = t.endTime ? new Date(t.endTime) : null;

        if (endTime && now > endTime) {
          status = 'completed';
        } else if (now >= startTime) {
          status = 'in-progress';
        } else {
          status = 'upcoming';
        }
      }

      // Check if student has attempted this test
      const testId = String(t._id);
      const attempt = attemptMap.get(testId);
      const submissionInfo = submissionMap.get(testId);
      let attemptStatus = null;
      let evaluationStatus = null;

      if (attempt) {
        if (attempt.status === 'completed' || attempt.status === 'violation_exit' || attempt.status === 'abandoned') {
          attemptStatus = 'attempted';

          // Check evaluation status for completed attempts
          if (submissionInfo && submissionInfo.hasSubmissions) {
            if (submissionInfo.anyPending) {
              evaluationStatus = 'under_evaluation';
            } else if (submissionInfo.allGraded) {
              evaluationStatus = 'evaluated';
            } else if (submissionInfo.anyFailed) {
              evaluationStatus = 'evaluation_failed';
            }
          }

          // Override test status if completed
          if (attempt.status === 'completed') {
            status = 'completed';
          }
        } else if (attempt.status === 'started') {
          attemptStatus = 'in-progress';
        }
      }

      return {
        _id: t._id,
        title: t.title,
        type: t.type,
        timeLimitMinutes: t.timeLimitMinutes || 0,
        scheduledDate: t.startTime ? new Date(t.startTime).toISOString() : (t.createdAt ? new Date(t.createdAt).toISOString() : null),
        status,
        attemptStatus,
        attemptInfo: attempt || null,
        evaluationStatus,
        bandScores: null,
      };
    });

    return res.json({
      tests: normalizedTests,
      batches: studentBatches.map((b) => ({
        _id: b._id,
        name: b.name,
      })),
    });
  } catch (err) {
    console.error('[GET /student/tests] server error:', err);
    return res.status(500).json({ message: 'Server error fetching tests' });
  }
});



// POST /api/student/submit/:testId/speaking
// Accepts multipart/form-data with MULTIPLE "media" files (one per speaking question)

router.post(
  "/submit/:testId/speaking",
  protect,
  restrictTo(["student"]),
  uploadStudentMedia.any(), 
  async (req, res) => {
    const { testId } = req.params;
    const skill = "speaking";

    try {
      if (!mongoose.Types.ObjectId.isValid(testId)) {
        return res.status(400).json({ message: "Invalid testId" });
      }

      const testSet = await TestSet.findById(testId);
      if (!testSet) {
        return res.status(404).json({ message: "Test not found" });
      }

      let responseObj = {};
      if (req.body.response) {
        try {
          responseObj = JSON.parse(req.body.response);
        } catch {
          responseObj = {};
        }
      }

      // Collect media paths PER QUESTION
      const mediaPaths = {};
      for (const file of req.files || []) {
        // file.fieldname = media_<questionKey>
        const key = file.fieldname.replace("media_", "");
        mediaPaths[key] = file.path;
      }

      const submission = await Submission.create({
        student: req.user._id,
        testSet: testSet._id,
        skill,
        response: responseObj,
        status: "pending",
        totalQuestions: testSet.questions.filter(q => q.questionType === "speaking").length,
        attemptedCount: Object.keys(mediaPaths).length,
        unattemptedCount:
          testSet.questions.filter(q => q.questionType === "speaking").length -
          Object.keys(mediaPaths).length,
        mediaPath: null, // not used anymore
        geminiEvaluation: null,
      });

      console.log(`[Submission] Speaking submission created - ID: ${submission._id}, Student: ${req.user.email}`);
      console.log(`[Submission] Media files received: ${Object.keys(mediaPaths).length}, Questions: ${testSet.questions.filter(q => q.questionType === "speaking").length}`);

      await addSubmissionJob({
        submissionId: submission._id.toString(),
        studentId: req.user._id.toString(),
        testId: testSet._id.toString(),
        skill,
        response: responseObj,
        mediaPaths, // PASS PER-QUESTION MEDIA
      });

      return res.status(202).json({
        message: "Speaking submission accepted for grading",
        submissionId: submission._id,
      });
    } catch (err) {
      console.error("Speaking submit error:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);





// Helper: can student start test?
async function canStudentStart(testSet, student) {
  if (!testSet.startTime) return true;

  const now = new Date();
  const startTime = new Date(testSet.startTime);

  // Allow access 10 minutes before scheduled time
  const tenMinBefore = new Date(startTime.getTime() - 10 * 60 * 1000);
  if (now < tenMinBefore) return false;

  // Check if test has ended
  if (testSet.endTime) {
    const endTime = new Date(testSet.endTime);
    if (now > endTime) return false;
  }

  return true;
}



// GET /api/student/tests/:id 
router.get('/tests/:id', protect, restrictTo(['student']), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid test id' });
  }

  try {
    const test = await TestSet.findById(id).lean();
    if (!test) return res.status(404).json({ message: 'Test not found' });

    // Check for existing attempts (optimized with lean())
    const existingAttempt = await TestAttempt.findOne({
      student: req.user._id,
      testSet: id,
      status: { $in: ['completed', 'abandoned', 'violation_exit'] }
    }).sort({ attemptNumber: -1 }).lean();

    // Check if student has completed this test already (optimized with lean())
    const completedSubmission = await Submission.findOne({
      student: req.user._id,
      testSet: id,
      status: { $in: ['graded', 'pending'] }
    }).lean();

    let canAttempt = true;
    let attemptInfo = null;

    if (existingAttempt && !existingAttempt.isRetryAllowed) {
      canAttempt = false;
      attemptInfo = {
        hasAttempted: true,
        lastAttemptStatus: existingAttempt.status,
        lastAttemptDate: existingAttempt.completedAt || existingAttempt.createdAt,
        exitReason: existingAttempt.exitReason,
        canRetry: false,
        message: 'You have already attempted this test. Contact admin if you need to retake it.'
      };
    } else if (completedSubmission && !existingAttempt?.isRetryAllowed) {
      canAttempt = false;
      attemptInfo = {
        hasAttempted: true,
        lastAttemptStatus: 'completed',
        lastAttemptDate: completedSubmission.createdAt,
        canRetry: false,
        submissionId: completedSubmission._id,
        message: 'You have already completed this test.'
      };
    }

    res.json({
      ...test,
      canAttempt,
      attemptInfo
    });
  } catch (err) {
    console.error('[GET /student/tests/:id] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


// GET /api/student/tests/:id/attempts - Get attempt history and lockdown status
router.get('/tests/:id/attempts', protect, restrictTo(['student']), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid test id' });
  }

  try {
    const attempts = await TestAttempt.find({
      student: req.user._id,
      testSet: id
    }).sort({ attemptNumber: -1 }).lean();

    if (!attempts.length) {
      return res.json({
        hasAttempts: false,
        hasCompletedAttempt: false,
        reattemptBlocked: false,
        attempts: []
      });
    }

    // Check for completed attempt and exam security lockdown
    const completedAttempt = attempts.find(a =>
      a.status === 'completed' || a.status === 'abandoned' || a.status === 'violation_exit'
    );

    let reattemptBlocked = false;
    let lockTimestamp = null;

    if (completedAttempt) {
      const ExamSecurity = require('../models/ExamSecurity');
      const examSecurity = await ExamSecurity.findOne({
        testAttempt: completedAttempt._id,
        student: req.user._id
      });

      if (examSecurity?.postExamSecurity?.reattemptBlocked) {
        reattemptBlocked = true;
        lockTimestamp = examSecurity.postExamSecurity.lockTimestamp;
      }
    }

    res.json({
      hasAttempts: true,
      hasCompletedAttempt: !!completedAttempt,
      reattemptBlocked,
      lockTimestamp,
      completedAt: completedAttempt?.completedAt || null,
      attempts: attempts.map(a => ({
        _id: a._id,
        attemptNumber: a.attemptNumber,
        status: a.status,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        isRetryAllowed: a.isRetryAllowed
      }))
    });

  } catch (err) {
    console.error('[GET /student/tests/:id/attempts] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/student/tests/:id/start - Start a test attempt
router.post('/tests/:id/start', protect, restrictTo(['student']), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid test id' });
  }

  try {
    const studentId = req.user._id;

    // Check if test exists
    const testSet = await TestSet.findById(id);
    if (!testSet) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Check if student can start this test
    const allowed = await canStudentStart(testSet, req.user);
    if (!allowed) {
      return res.status(403).json({ 
        message: 'Test is not available at this time',
        code: 'TEST_NOT_AVAILABLE'
      });
    }

    // Check for existing active attempt
    const existingAttempt = await TestAttempt.findOne({
      student: studentId,
      testSet: id,
      status: 'started'
    });

    if (existingAttempt) {
      return res.status(409).json({
        message: 'Test already in progress',
        code: 'TEST_IN_PROGRESS',
        existingAttempt: {
          attemptId: existingAttempt._id,
          startedAt: existingAttempt.startedAt
        }
      });
    }

    // Check if student has already completed this test (and retry is not allowed)
    const completedAttempt = await TestAttempt.findOne({
      student: studentId,
      testSet: id,
      status: { $in: ['completed', 'abandoned', 'violation_exit'] }
    }).sort({ attemptNumber: -1 });

    if (completedAttempt && !completedAttempt.isRetryAllowed) {
      return res.status(403).json({
        message: 'You have already attempted this test',
        code: 'TEST_ALREADY_COMPLETED',
        data: {
          lastAttempt: {
            status: completedAttempt.status,
            completedAt: completedAttempt.completedAt,
            canRetry: false
          }
        }
      });
    }

    // Determine attempt number
    const allAttempts = await TestAttempt.find({
      student: studentId,
      testSet: id
    }).sort({ attemptNumber: -1 });

    const attemptNumber = allAttempts.length > 0 ? allAttempts[0].attemptNumber + 1 : 1;

    // Create new test attempt
    const testAttempt = new TestAttempt({
      student: studentId,
      testSet: id,
      attemptNumber,
      status: 'started',
      startedAt: new Date()
    });

    await testAttempt.save();

    return res.status(201).json({
      message: 'Test attempt started successfully',
      attemptId: testAttempt._id,
      attemptNumber: testAttempt.attemptNumber,
      startedAt: testAttempt.startedAt
    });

  } catch (err) {
    console.error('[POST /student/tests/:id/start] error:', err);
    return res.status(500).json({ message: 'Server error starting test' });
  }
});

// POST /api/student/tests/:id/end - End a test attempt
router.post('/tests/:id/end', protect, restrictTo(['student']), async (req, res) => {
  const { id } = req.params;
  const { reason, submissionId, violations } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid test id' });
  }

  try {
    const attempt = await TestAttempt.findOne({
      student: req.user._id,
      testSet: id,
      status: 'started'
    }).sort({ createdAt: -1 });

    if (!attempt) {
      return res.status(404).json({ message: 'No active test attempt found' });
    }

    // Validate reason
    const validReasons = ['completed', 'fullscreen_exit', 'tab_switch', 'time_expired', 'violation', 'manual_exit'];
    if (reason && !validReasons.includes(reason)) {
      return res.status(400).json({ message: 'Invalid exit reason' });
    }

    const statusMap = {
      'completed': 'completed',
      'fullscreen_exit': 'violation_exit',
      'tab_switch': 'violation_exit',
      'time_expired': 'completed',
      'violation': 'violation_exit',
      'manual_exit': 'abandoned'
    };

    attempt.status = statusMap[reason] || 'abandoned';
    attempt.exitReason = reason;
    attempt.completedAt = new Date();

    // Add violations to the attempt record if provided
    if (violations && Array.isArray(violations) && violations.length > 0) {
      attempt.violations = violations.map(v => ({
        type: v.type,
        timestamp: new Date(v.timestamp || Date.now()),
        details: v.details || ''
      }));
    }

    if (submissionId && mongoose.Types.ObjectId.isValid(submissionId)) {
      attempt.submissionId = submissionId;
    }

    await attempt.save();

    res.json({
      message: 'Test attempt ended',
      status: attempt.status,
      reason: attempt.exitReason
    });

  } catch (err) {
    console.error('[POST /student/tests/:id/end] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/student/tests/:id/violation - Log a violation
router.post('/tests/:id/violation', protect, restrictTo(['student']), async (req, res) => {
  const { id } = req.params;
  const { type, details } = req.body;

  try {
    const attempt = await TestAttempt.findOne({
      student: req.user._id,
      testSet: id,
      status: 'started'
    }).sort({ createdAt: -1 });

    if (attempt) {
      attempt.violations.push({
        type,
        details,
        timestamp: new Date()
      });
      await attempt.save();
    }

    res.json({ message: 'Violation logged' });
  } catch (err) {
    console.error('[POST /student/tests/:id/violation] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


// POST /api/student/submit/:testId/:skill 
// Auto-grades reading/listening MCQs, stores summary and band score.
// Writing/speaking stay 'pending' for async/manual grading.
router.post('/submit/:testId/:skill', protect, restrictTo(['student']), [body('response').notEmpty()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { testId, skill } = req.params;
    if (!mongoose.Types.ObjectId.isValid(testId))
    return res.status(400).json({ message: 'Invalid testId' });

    try {
      const testSet = await TestSet.findById(testId);
    if (!testSet) return res.status(404).json({ message: 'Test not found' });

      const allowed = await canStudentStart(testSet, req.user);
      if (!allowed)
      return res
        .status(403)
        .json({ message: 'Not allowed to start/submit this test now (timing rules)' });

      const response = req.body.response;
    const autoGradable = skill === 'reading' || skill === 'listening';

      let earnedMarks = 0;
      let maxMarks = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let totalQuestions = 0;
      let attemptedCount = 0;
      let unattemptedCount = 0;
      let bandScore = null;

      // Auto grading for reading/listening (MCQ + MATCH)
      if (autoGradable) {
        const isArrayResp = Array.isArray(response);

        testSet.questions.forEach((q, idx) => {
          if (q.questionType !== "mcq" && q.questionType !== "match") return;

          totalQuestions += 1;

          const qMarks = q.marks || 1;
          maxMarks += qMarks;

          let studentAnswerIndex = null;

          if (isArrayResp) {
            const entry = response.find(
              (r) =>
                r.questionIndex === idx ||
                String(r.questionId) === String(q._id)
            );
          if (entry && typeof entry.answer === 'number') {
              studentAnswerIndex = entry.answer;
            }
        } else if (response && typeof response === 'object') {
            const keyByIndex = String(idx);
            const keyById = q._id ? String(q._id) : null;

            if (
              keyById &&
              response[keyById] &&
            typeof response[keyById].selectedIndex === 'number'
            ) {
              studentAnswerIndex = response[keyById].selectedIndex;
            } else if (
              response[keyByIndex] &&
            typeof response[keyByIndex].selectedIndex === 'number'
            ) {
              studentAnswerIndex = response[keyByIndex].selectedIndex;
            }
          }

        if (typeof studentAnswerIndex === 'number') {
            attemptedCount += 1;

            if (studentAnswerIndex === q.correctIndex) {
              correctCount += 1;
              earnedMarks += qMarks;
            } else {
              incorrectCount += 1;
            }
          } else {
            unattemptedCount += 1;
          }
        });

        bandScore = computeBandScore(earnedMarks, maxMarks || 0);
      }

      // Basic counts for writing/speaking (no auto grading here)
  
      if (!autoGradable && (skill === "writing" || skill === "speaking")) {
        // Collect all writing/speaking questions *with their original index*
        const skillQuestionsWithIndex = [];
        (testSet.questions || []).forEach((q, idx) => {
          if (
            (skill === "writing" && q.questionType === "writing") ||
            (skill === "speaking" && q.questionType === "speaking")
          ) {
            skillQuestionsWithIndex.push({ q, idx });
          }
        });

        totalQuestions = skillQuestionsWithIndex.length;

        attemptedCount = skillQuestionsWithIndex.reduce((count, item) => {
          const { q, idx } = item;
          const keyById = q._id ? String(q._id) : null;
          const keyByIndex = String(idx); // <-- global index in testSet.questions

          const ans =
            (keyById && response && response[keyById]) ||
            (response && response[keyByIndex]) ||
            null;

          if (skill === "writing") {
            if (
              ans &&
              typeof ans.text === "string" &&
              ans.text.trim().length > 0
            ) {
              return count + 1;
            }
          }

          if (skill === "speaking") {
            // For speaking, we treat as attempted if an uploadedUrl is present and non-empty.
            if (
              ans &&
              typeof ans.uploadedUrl === "string" &&
              ans.uploadedUrl.trim().length > 0
            ) {
              return count + 1;
            }
          }

          return count;
        }, 0);

        unattemptedCount = Math.max(totalQuestions - attemptedCount, 0);
      }


      // Build submission payload
      const submissionPayload = {
        student: req.user._id,
        testSet: testSet._id,
        skill,
        response,
        status: autoGradable ? 'graded' : 'pending',

        totalMarks: earnedMarks || 0,
        maxMarks: maxMarks || 0,
        correctCount,
        incorrectCount,
        totalQuestions,
        attemptedCount,
        unattemptedCount,
        bandScore: bandScore != null ? bandScore : null,
      };

      const submission = await Submission.create(submissionPayload);

      console.log(`[Submission] ${skill.toUpperCase()} submission created - ID: ${submission._id}, Student: ${req.user.email}`);
      console.log(`[Submission] Status: ${submission.status}, Auto-gradable: ${autoGradable}`);
      if (autoGradable) {
        console.log(`[Submission] Auto-graded - Band: ${submission.bandScore}, Marks: ${submission.totalMarks}/${submission.maxMarks}`);
      }

      let jobId = null;
      if (!autoGradable) {
        console.log(`[Submission] Queuing ${skill} test for async grading...`);
        const jobData = {
          submissionId: submission._id.toString(),
          studentId: req.user._id.toString(),
          testId: testSet._id.toString(),
          skill,
          response,
          mediaPaths: {}, 
        };
        const job = await addSubmissionJob(jobData);
        jobId = job.id || null;
        console.log(`[Submission] ✓ Job ${jobId} created for submission ${submission._id}`);
      }

    // Update StudentStats (only when we have a bandScore)
      if (bandScore != null) {
        await updateStudentStatsForSkill({
          student: req.user,
          skill,
          bandScore,
        });
      }

      const summary = autoGradable
        ? {
            submissionId: submission._id,
            testId: testSet._id,
            skill,
            totalMarks: submission.totalMarks,
            maxMarks: submission.maxMarks,
            totalQuestions: submission.totalQuestions,
            attemptedCount: submission.attemptedCount,
            unattemptedCount: submission.unattemptedCount,
            correctCount: submission.correctCount,
            incorrectCount: submission.incorrectCount,
            bandScore: submission.bandScore,
          }
        : null;

      return res.status(autoGradable ? 200 : 202).json({
        message: autoGradable
        ? 'Submission accepted and auto-graded'
        : 'Submission accepted for grading',
        submissionId: submission._id,
        jobId,
        summary,
      });
    } catch (err) {
      console.error("[POST /student/submit] error:", err);
      return res.status(500).json({ message: err.message || "Server error" });
    }
  }
);





// GET /api/student/submissions
// Returns ALL submissions grouped by test
router.get(
  "/submissions",
  protect,
  restrictTo(["student"]),
  async (req, res) => {
    try {
      const studentId = req.user._id;

      const subs = await Submission.find({ student: studentId })
        .populate("testSet", "title type")
        .sort({ createdAt: -1 })
        .lean();

      // group by testId
      const testMap = new Map();

      for (const sub of subs) {
        const testId = String(sub.testSet?._id || sub.testSet);
        if (!testMap.has(testId)) {
          testMap.set(testId, {
            testId,
            testTitle: sub.testSet?.title || "Untitled Test",
            testType: sub.testSet?.type,
            submissions: [],
          });
        }

        testMap.get(testId).submissions.push({
          submissionId: sub._id,
          skill: sub.skill,
          status: sub.status,
          bandScore: sub.bandScore ?? null,

          totalMarks: sub.totalMarks || 0,
          maxMarks: sub.maxMarks || 0,
          totalQuestions: sub.totalQuestions || 0,
          attemptedCount: sub.attemptedCount || 0,
          unattemptedCount: sub.unattemptedCount || 0,
          correctCount: sub.correctCount || 0,
          incorrectCount: sub.incorrectCount || 0,

          examinerSummary:
            sub.skill === "writing"
              ? sub.geminiWritingEvaluationSummary
              : sub.skill === "speaking"
              ? sub.geminiSpeakingEvaluationSummary
              : null,

          createdAt: sub.createdAt,
        });
      }

      return res.json([...testMap.values()]);
    } catch (err) {
      console.error("[GET /student/submissions] error:", err);
      res.status(500).json({ message: "Failed to load submissions" });
    }
  }
);





// GET /api/student/submissions/summary
// Returns latest submission per skill (reading/listening/writing/speaking)
router.get( '/submissions/summary', protect, restrictTo(['student']), async (req, res) => {
    try {
      const studentId = req.user._id;

      // Optional: load StudentStats (not strictly required here, but "uses both tables"
      // if you ever want to cross-check bands).
      const statsDoc = await StudentStats.findOne({ student: studentId }).lean();

      // Fetch *all* submissions for this student, newest first
      const subs = await Submission.find({ student: studentId })
        .populate('testSet', 'title type')
        .sort({ createdAt: -1 })
        .lean();

      // Pick the latest submission per skill
      const latestBySkill = {
        reading: null,
        listening: null,
        writing: null,
        speaking: null,
      };

      for (const sub of subs) {
        const skill = sub.skill; // 'reading' | 'listening' | 'writing' | 'speaking'
        if (!latestBySkill[skill]) {
          latestBySkill[skill] = sub;
        }
      }

      // Shape the response per skill
      const buildSummary = (skillKey) => {
        const sub = latestBySkill[skillKey];
        if (!sub) return null;

        return {
          skill: skillKey,
          submissionId: sub._id,
          testId: sub.testSet?._id || null,
          testTitle: sub.testSet?.title || null,
          status: sub.status,

          totalMarks: sub.totalMarks || 0,
          maxMarks: sub.maxMarks || 0,

          totalQuestions: sub.totalQuestions || 0,
          attemptedCount: sub.attemptedCount || 0,
          unattemptedCount: sub.unattemptedCount || 0,

          correctCount: sub.correctCount || 0,
          incorrectCount: sub.incorrectCount || 0,

          bandScore:
            typeof sub.bandScore === 'number' ? sub.bandScore : null,

          createdAt: sub.createdAt || null,
        };
      };

      const summary = {
        reading: buildSummary('reading'),
        listening: buildSummary('listening'),
        writing: buildSummary('writing'),
        speaking: buildSummary('speaking'),
      };

      return res.json(summary);
    } catch (err) {
      console.error('[GET /student/submissions/summary] error:', err);
      return res.status(500).json({
        message: 'Server error fetching submissions summary',
      });
    }
  }
);



// GET /api/student/submissions/:id 
router.get('/submissions/:id', protect, restrictTo(['student']), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid submission id' });
  }

  try {
    const sub = await Submission.findById(id)
      .populate('student', 'name email systemId')
      .populate('testSet', 'title type')
      .lean();

    if (!sub) return res.status(404).json({ message: 'Submission not found' });

    if (String(sub.student?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not allowed to view this submission' });
    }

    // Decide which summary to expose as the generic "examinerSummary"
    let examinerSummary = null;
    if (sub.skill === 'writing' && sub.geminiWritingEvaluationSummary) {
      examinerSummary = sub.geminiWritingEvaluationSummary;
    } else if (sub.skill === 'speaking' && sub.geminiSpeakingEvaluationSummary) {
      examinerSummary = sub.geminiSpeakingEvaluationSummary;
    } else if (sub.geminiEvaluation && sub.geminiEvaluation.examiner_summary) {
      // fallback to whatever is inside geminiEvaluation
      examinerSummary = sub.geminiEvaluation.examiner_summary;
    }


    return res.json({
      submissionId: sub._id,
      testId: sub.testSet?._id,
      testTitle: sub.testSet?.title,
      skill: sub.skill,
      status: sub.status,

      totalMarks: sub.totalMarks || 0,
      maxMarks: sub.maxMarks || 0,

      totalQuestions: sub.totalQuestions || 0,
      attemptedCount: sub.attemptedCount || 0,
      unattemptedCount: sub.unattemptedCount || 0,

      correctCount: sub.correctCount || 0,
      incorrectCount: sub.incorrectCount || 0,

      geminiEvaluation: sub.geminiEvaluation || null,
      geminiError: sub.geminiError || null,

      bandScore: sub.bandScore ?? null,
      geminiWritingEvaluationSummary: sub.geminiWritingEvaluationSummary ?? null,
      geminiSpeakingEvaluationSummary: sub.geminiSpeakingEvaluationSummary ?? null,
      examinerSummary,

      student: {
        _id: sub.student?._id,
        name: sub.student?.name,
        email: sub.student?.email,
        systemId: sub.student?.systemId,
      },
      createdAt: sub.createdAt,
    });
  } catch (err) {
    console.error('[GET /student/submissions/:id] error:', err);
    return res.status(500).json({ message: 'Server error fetching submission' });
  }
}
);

// Cleanup stale test attempts endpoint
router.post('/tests/:id/cleanup', protect, restrictTo(['student']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

  
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const startedAttempts = await TestAttempt.find({
      student: userId,
      testSet: id,
      status: 'started'
    });

    if (startedAttempts.length > 0) {
      // Mark all as abandoned
      await TestAttempt.updateMany(
        {
          student: userId,
          testSet: id,
          status: 'started'
        },
        {
          $set: {
            status: 'abandoned',
            completedAt: new Date(),
            exitReason: 'manual_exit'
          }
        }
      );

      // Also clean up associated device sessions
      const DeviceSession = require('../models/DeviceSession');
      await DeviceSession.updateMany(
        {
          user: userId,
          testSet: id,
          status: 'active'
        },
        {
          $set: {
            status: 'terminated',
            terminationReason: 'cleanup'
          }
        }
      );

      res.json({
        success: true,
        message: `Cleaned up ${startedAttempts.length} attempt(s)`,
        cleanedAttempts: startedAttempts.length
      });
    } else {
      res.json({
        success: true,
        message: 'No attempts to clean up',
        cleanedAttempts: 0
      });
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup attempts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
