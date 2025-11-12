// workers/aiWorker.js
require('dotenv').config();
const { submissionQueue, usingRedis } = require('../services/queue');
const Submission = require('../models/Submission');
const TestSet = require('../models/TestSet');
const { scoreSubmission } = require('../services/aiService');
const { transcribe } = require('../services/speechService');
const { rawToBand } = require('../utils/scoring');
const logger = require('../config/logger');

/**
 * Process submission data (job.data)
 * jobData: { submissionId, studentId, testId, skill, response }
 */
async function processSubmission(jobData) {
  const { submissionId, studentId, testId, skill, response } = jobData;
  try {
    const submission = await Submission.findById(submissionId);
    if (!submission) throw new Error('Submission not found');

    submission.status = 'processing';
    await submission.save();

    // Fetch test to compute objective grading if needed
    const testSet = await TestSet.findById(testId);
    if (!testSet) throw new Error('TestSet not found');

    if (skill === 'Listening' || skill === 'Reading') {
      // Expect response to be array of answers [{questionIndex, answer}] or mapping
      const answers = Array.isArray(response) ? response : [];
      const questions = testSet.questions.filter(q => q.skill === skill);
      let rawScore = 0;
      questions.forEach((q, idx) => {
        const studentAns = answers.find(a => a.questionIndex === idx || a.questionId === String(q._id));
        if (!studentAns) return;
        // Compare normalized strings
        if (String(studentAns.answer).trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase()) {
          rawScore += (q.marks || 1);
        }
      });
      const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);
      const band = rawToBand(rawScore, totalMarks);
      submission.rawScore = rawScore;
      submission.bandScore = band;
      submission.aiFeedback = `Objective grading complete: ${rawScore}/${totalMarks}`;
      submission.status = 'done';
      await submission.save();
      return submission;
    } else if (skill === 'Writing') {
      // Call AI directly
      const prompt = (testSet.questions.find(q => q.skill === 'Writing') || {}).promptDetails || '';
      const ai = await scoreSubmission('writing', prompt, response);
      submission.bandScore = ai.bandScore;
      submission.aiFeedback = ai.feedback;
      submission.aiLinguisticScore = ai.linguisticScore || 0;
      submission.status = 'done';
      await submission.save();
      return submission;
    } else if (skill === 'Speaking') {
      // response should be audioUrl or transcript
      let transcript = response;
      let acousticScore = null;
      if (typeof response === 'string' && response.startsWith('http')) {
        // we have an audio URL — transcribe
        const stt = await transcribe(response);
        transcript = stt.transcript;
        acousticScore = stt.acousticScore;
      }
      const prompt = (testSet.questions.find(q => q.skill === 'Speaking') || {}).promptDetails || '';
      const ai = await scoreSubmission('speaking', prompt, transcript, { acousticScore });
      submission.bandScore = ai.bandScore;
      submission.aiFeedback = ai.feedback;
      submission.aiLinguisticScore = ai.linguisticScore || 0;
      submission.aiAcousticScore = ai.acousticScore || acousticScore || 0;
      submission.status = 'done';
      await submission.save();
      return submission;
    }

    submission.status = 'failed';
    submission.aiFeedback = 'Unknown skill';
    await submission.save();
    return submission;
  } catch (err) {
    logger.error('processSubmission error', err);
    try {
      if (submissionId) {
        await Submission.findByIdAndUpdate(submissionId, { status: 'failed', aiFeedback: `Processing failed: ${err.message}` });
      }
    } catch (e) { logger.error('failed to mark submission failed', e); }
    throw err;
  }
}

/**
 * Inline processing helper used by fallback queue implementation.
 */
async function processSubmissionInline(data) {
  return processSubmission(data);
}

if (usingRedis) {
  submissionQueue.process(async (job) => {
    try {
      return await processSubmission(job.data);
    } catch (err) {
      throw err;
    }
  });

  submissionQueue.on('completed', (job, result) => {
    logger.info('Job completed', { jobId: job.id });
  });
  submissionQueue.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job.id, err: err.message });
  });

  // If invoked directly as worker script
  if (require.main === module) {
    console.log('AI Worker started and listening to queue...');
  }
}

module.exports = { processSubmissionInline, processSubmission };
