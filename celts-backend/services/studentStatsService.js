// services/studentStatsService.js
const StudentStats = require('../models/StudentStats');
const User = require('../models/User');

/**
 * Update StudentStats when a submission is graded.
 *
 * Expected submission shape:
 * - submission.student (ObjectId)
 * - submission.skill: 'reading' | 'listening' | 'writing' | 'speaking'
 * - submission.totalMarks
 * - submission.maxMarks
 * - submission.bandScore
 * - submission.geminiEvaluation (for writing)
 */
async function updateStudentStatsFromSubmission(submission) {
  try {
    if (!submission || !submission.student || !submission.skill) return;

    const studentId = submission.student;
    const skill = submission.skill; // 'reading', 'listening', 'writing', 'speaking'
    const bandScore = submission.bandScore;
    const totalMarks = submission.totalMarks || 0;
    const maxMarks = submission.maxMarks || 0;

    // Snapshot basic user info for analytics
    const studentDoc = await User.findById(studentId).lean();
    const existingStats = await StudentStats.findOne({ student: studentId });

    const updates = {};

    if (studentDoc) {
      updates.name = studentDoc.name;
      updates.email = studentDoc.email;
      updates.systemId = studentDoc.systemId;

      if (studentDoc.batch) {
        updates.batch = studentDoc.batch;
      }
      if (studentDoc.batchName) {
        updates.batchName = studentDoc.batchName;
      }
    }

    // Dynamic field names based on skill
    const bandField = `${skill}Band`;              // e.g. 'writingBand'
    const totalMarksField = `${skill}TotalMarks`;  // e.g. 'writingTotalMarks'
    const maxMarksField = `${skill}MaxMarks`;      // e.g. 'writingMaxMarks'

    const prevTotal =
      (existingStats && existingStats[totalMarksField]) || 0;
    const prevMax =
      (existingStats && existingStats[maxMarksField]) || 0;

    // accumulate marks per skill
    updates[totalMarksField] = prevTotal + totalMarks;
    updates[maxMarksField] = prevMax + maxMarks;

    // latest band for this skill
    if (typeof bandScore === 'number') {
      updates[bandField] = bandScore;
    }

    // store examiner summary for writing (latest)
    if (
      skill === 'writing' &&
      submission.geminiEvaluation &&
      typeof submission.geminiEvaluation.examiner_summary === 'string'
    ) {
      updates.writingExaminerSummary =
        submission.geminiEvaluation.examiner_summary;
    }

    // recompute overallBand as average of non-null skill bands
    const merged = existingStats ? existingStats.toObject() : {};
    const combined = { ...merged, ...updates };

    const bandFields = [
      'readingBand',
      'listeningBand',
      'writingBand',
      'speakingBand',
    ];

    const nonNullBands = bandFields
      .map((f) => combined[f])
      .filter((v) => typeof v === 'number');

    if (nonNullBands.length > 0) {
      updates.overallBand =
        nonNullBands.reduce((sum, v) => sum + v, 0) / nonNullBands.length;
    }

    await StudentStats.findOneAndUpdate(
      { student: studentId },
      { $set: updates },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('[StudentStats] Failed to update from submission:', err);
  }
}

module.exports = { updateStudentStatsFromSubmission };
