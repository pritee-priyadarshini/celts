const OpenAI = require("openai");
const fs = require("fs");

const { submissionQueue } = require("./queue");
const Submission = require("../models/Submission");
const TestSet = require("../models/TestSet");
const Batch = require("../models/Batch");
const StudentStats = require("../models/StudentStats");

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function roundHalf(v) {
  return Math.round(v * 2) / 2;
}

function safeParseJson(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function fileExistsSync(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function updateStudentStats({ student, skill, bandScore, examinerSummary }) {
  const batch = await Batch.findOne({ students: student._id }).lean();
  let stats = await StudentStats.findOne({ student: student._id });

  if (!stats) {
    stats = new StudentStats({
      student: student._id,
      name: student.name,
      email: student.email,
      systemId: student.systemId,
    });
  }

  if (batch) {
    stats.batch = batch._id;
    stats.batchName = batch.name;
  }

  if (skill === "writing") {
    stats.writingBand = bandScore;
    stats.writingExaminerSummary = examinerSummary;
  }

  if (skill === "speaking") {
    stats.speakingBand = bandScore;
    stats.speakingExaminerSummary = examinerSummary;
  }

  const vals = [
    stats.readingBand,
    stats.listeningBand,
    stats.writingBand,
    stats.speakingBand,
  ].filter((n) => typeof n === "number");

  stats.overallBand = vals.length
    ? roundHalf(vals.reduce((a, b) => a + b, 0) / vals.length)
    : null;

  await stats.save();
}


async function getTranscription({ mediaPath }) {
  if (!mediaPath || !fileExistsSync(mediaPath)) {
    throw new Error("Invalid mediaPath for transcription");
  }

  const stream = fs.createReadStream(mediaPath);
  const resp = await ai.audio.transcriptions.create({
    file: stream,
    model: "gpt-4o-mini-transcribe",
  });

  if (!resp?.text?.trim()) {
    throw new Error("Empty transcription");
  }

  return resp.text.trim();
}


async function gradeWriting({ answerText, questionText, imageUrls = [] }) {
  let prompt = `
You are an official IELTS Writing Task examiner.

Your job is to evaluate the candidate's writing STRICTLY according to official IELTS Writing band descriptors for Task 1 / Task 2, focusing on:

- Task Response / Task Achievement
- Coherence and Cohesion
- Lexical Resource
- Grammatical Range and Accuracy

RESTRICTIONS (VERY IMPORTANT):
- Do NOT address the candidate directly. Do NOT use "you" / "your".
  Instead, write in third person: "the candidate", "the response", "the essay", "the writer".
- Do NOT include greetings, motivational comments, praise, or sympathy.
  No "Dear student", "Good job", "Keep it up", etc.
- Do NOT speculate about the candidate's personal life, background, feelings, or abilities.
- Focus ONLY on what is visible in the writing and how it matches IELTS band descriptors.
- Use a neutral, professional examiner tone at all times.

STRICTNESS RULES (MUST FOLLOW):
- If the answer is extremely short or clearly far below the minimum length implied in the task
  (for example when the question says "at least 150 words" or "at least 250 words"),
  the band score must be very low, usually Band 4.0 or below, regardless of language quality.
- If the answer does NOT address the question at all (off-topic, memorised answer, or random sentences),
  Task Response / Task Achievement must be Band 3.0 or below and the overall band must be heavily limited.
- If the answer only partially addresses the task (for example:
  - ignoring one part of a two-part question,
  - missing an overview in Task 1,
  - not presenting or supporting a clear position in Task 2),
  Task Response / Task Achievement must be clearly penalised.
- Grammar and vocabulary scores must not be higher than the level actually demonstrated in the text.
  Occasional complex sentences with frequent basic errors should not receive high bands.
- Coherence and Cohesion must reflect paragraphing, logical progression, and use of cohesive devices.
  Overuse or mechanical use of linking words must be penalised.


QUESTION:
${questionText}
`;

  if (imageUrls.length) {
    prompt += `\nREFERENCE IMAGES:\n`;
    imageUrls.forEach((u, i) => {
      prompt += `\n![image-${i + 1}](${u})`;
    });
  }

  prompt += `

CANDIDATE ANSWER:
${answerText || "(empty)"}

Return ONLY valid json (no markdown, no explanation, no extra text).
The response MUST be a single json object with the exact shape:

{
  "band_score": number,
  "criteria_breakdown": {
    "task_response": { "score": number, "feedback": string },
    "cohesion_coherence": { "score": number, "feedback": string },
    "lexical_resource": { "score": number, "feedback": string },
    "grammatical_range_accuracy": { "score": number, "feedback": string }
  },
  "examiner_summary": string,
}

Rules:
- "band_score" must be between 1 and 9.0 (it may be .0 or .5).
- Each criteria "score" must also be between 1 and 9.0 where possible.
- Feedback must be concise, IELTS-style, impersonal, and clearly linked to the band scores.

The "examiner_summary" MUST be an in-depth evaluation that:
These must be written as clear, actionable examiner advice.
- Explicitly comments on Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy to improve score in which fields and how
- Suggestions must be IELTS-specific, not generic study tips.
- Do NOT repeat the same text from examiner_summary.
- Do NOT mention band numbers directly.
- Examples of acceptable guidance:
  - "Include a clear overview paragraph summarising main trends."
  - "Develop ideas with specific examples instead of general statements."
  - "Use a wider range of complex sentence structures with fewer errors."
  - "Avoid memorised phrases; use topic-specific vocabulary."
- Write in third person only ("the candidate should…").
`.trim();

  const res = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const parsed = safeParseJson(res.choices[0].message.content);
  if (!parsed) throw new Error("Invalid JSON from writing evaluator");

  return parsed;
}



async function gradeSpeaking({ questions = [], mediaPath }) {
  if (!Array.isArray(questions) || !questions.length) {
    throw new Error("gradeSpeaking: no questions provided");
  }

  const audioPaths = Array.isArray(mediaPath)
    ? mediaPath
    : mediaPath
      ? questions.map(() => mediaPath)
      : [];

  const perQuestion = [];
  const allTranscriptions = [];
  const bandScores = [];

  const criteriaTotals = {
    fluency: [],
    coherence: [],
    vocabulary: [],
    grammar: [],
    pronunciation: [],
  };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const audio = audioPaths[i];

    if (!audio) {
      perQuestion.push({
        question_index: i,
        question_text: q.prompt || q.text || "",
        coverage: "none",
        band_score: 0,
        notes: "There is no response provided for this question.",
      });
      continue;
    }

    const transcription = await getTranscription({ mediaPath: audio });

    allTranscriptions.push(
      `--- Answer for Question ${i + 1} ---\n${transcription}`
    );

    const prompt = `
You are an official IELTS Speaking examiner.

Your job is to evaluate the candidate's speaking STRICTLY according to IELTS Speaking criteria.

RESTRICTIONS (VERY IMPORTANT):
- Do NOT address the candidate directly. Do NOT use "you" / "your".
- Do NOT include praise or speculation.
- Focus ONLY on spoken language.

QUESTION:
${q.prompt || q.text}

TRANSCRIPTION:
"${transcription}"

Return ONLY valid json:

{
  "coverage": "full" | "partial" | "minimal" | "none",
  "band_score": number,
  "notes": string,
  "criteria_breakdown": {
    "fluency": number,
    "coherence": number,
    "vocabulary": number,
    "grammar": number,
    "pronunciation": number
  },
  "examiner_summary": string,
}
  Rules:
- "band_score" must be between 1 and 9.0 (it may be .0 or .5).
- Each criteria "score" must also be between 1 and 9.0 where possible.
- Feedback must be concise, IELTS-style, impersonal, and clearly linked to the band scores.

The "examiner_summary" MUST be an in-depth evaluation that:
- Mentions the overall band clearly.
- Explicitly comments on fluency, vocabulary, grammer and pronunciation
- Is written in paragraphs or clear sentences, not bullet points, but still concise and focused.
- Each suggestion must describe what the candidate should SAY or DO differently.
- Advice must be practical and speaking-focused.
- Avoid generic advice like "practice more".
- Examples:
  - "Extend answers by explaining reasons and giving examples."
  - "Reduce pauses by using simple fillers such as 'well' or 'actually'."
  - "Use a wider range of topic-specific vocabulary instead of repetition."
  - "Improve pronunciation of word endings and sentence stress."
- Write in third person only.
`.trim();

    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const parsed = safeParseJson(res.choices[0].message.content);
    if (!parsed || typeof parsed.band_score !== "number") {
      throw new Error(`Invalid speaking evaluation for question ${i + 1}`);
    }

    if (parsed.criteria_breakdown) {
      criteriaTotals.fluency.push(parsed.criteria_breakdown.fluency);
      criteriaTotals.coherence.push(parsed.criteria_breakdown.coherence);
      criteriaTotals.vocabulary.push(parsed.criteria_breakdown.vocabulary);
      criteriaTotals.grammar.push(parsed.criteria_breakdown.grammar);
      criteriaTotals.pronunciation.push(parsed.criteria_breakdown.pronunciation);
    }

    perQuestion.push({
      question_index: i,
      question_text: q.prompt || q.text || "",
      coverage: parsed.coverage,
      band_score: parsed.band_score,
      notes: parsed.notes || "",
    });

    bandScores.push(parsed.band_score);
  }

  const overallBand =
    bandScores.length > 0
      ? roundHalf(bandScores.reduce((a, b) => a + b, 0) / bandScores.length)
      : 0;

  const avg = (arr) =>
    arr.length ? roundHalf(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const overallCriteria = {
    fluency: avg(criteriaTotals.fluency),
    coherence: avg(criteriaTotals.coherence),
    vocabulary: avg(criteriaTotals.vocabulary),
    grammar: avg(criteriaTotals.grammar),
    pronunciation: avg(criteriaTotals.pronunciation),
  };

  return {
    band_score: overallBand,
    overall_band_score: overallBand,
    criteria_breakdown: overallCriteria,
    per_question: perQuestion,
    transcription: allTranscriptions.join("\n\n"),
    examiner_summary: parsed.examiner_summary,
  };
}



function applyStrictSpeakingPenalties(evaluation, totalQuestions) {
  let band = evaluation.band_score ?? 0;

  const perQ = evaluation.per_question || [];
  const bad = perQ.filter((q) => q.coverage === "minimal" || q.coverage === "none").length;

  if (totalQuestions && bad / totalQuestions >= 0.5) band = Math.min(band, 3);
  if (bad === totalQuestions) band = Math.min(band, 2);

  const wc = (evaluation.transcription || "").split(/\s+/).length;
  if (wc < 10) band = Math.min(band, 2);
  else if (wc < 20) band = Math.min(band, 3);

  band = roundHalf(band);
  evaluation.band_score = band;
  evaluation.overall_band_score = band;
  return evaluation;
}


function buildDetailedWritingSummary(perTasks, overallBand) {
  const lines = [];
  lines.push(`Overall Writing Band: ${overallBand}`);

  perTasks.forEach((t, i) => {
    const cb = t.evaluation.criteria_breakdown;
    lines.push("");
    lines.push(`Task ${i + 1}`);
    lines.push(`Question: ${t.prompt}`);
    lines.push(`Estimated Band for this Task: ${t.band_score}`);
    lines.push(`- Task Response: ${cb.task_response.score} – ${cb.task_response.feedback}`);
    lines.push(`- Coherence and Cohesion: ${cb.cohesion_coherence.score} – ${cb.cohesion_coherence.feedback}`);
    lines.push(`- Lexical Resource: ${cb.lexical_resource.score} – ${cb.lexical_resource.feedback}`);
    lines.push(`- Grammatical Range and Accuracy: ${cb.grammatical_range_accuracy.score} – ${cb.grammatical_range_accuracy.feedback}`);
    lines.push("");
    lines.push(`Task-Level Examiner Comments: ${t.evaluation.examiner_summary}`);
  });

  return lines.join("\n");
}

function buildDetailedSpeakingSummary(evaluation, totalQuestions) {
  const lines = [];
  lines.push(`Overall Speaking Band: ${evaluation.band_score}`);
  lines.push("");

  const cb = evaluation.criteria_breakdown || {};
  lines.push("Criterion-wise Scores and Comments:");
  lines.push(`- Fluency: ${cb.fluency}`);
  lines.push(`- Coherence: ${cb.coherence}`);
  lines.push(`- Vocabulary: ${cb.vocabulary}`);
  lines.push(`- Grammar: ${cb.grammar}`);
  lines.push(`- Pronunciation: ${cb.pronunciation}`);

  lines.push("");
  lines.push(`Per-Question Coverage (total questions: ${totalQuestions}):`);
  evaluation.per_question.forEach((q) => {
    lines.push("");
    lines.push(`Question ${q.question_index + 1}: ${q.question_text}`);
    lines.push(`- Coverage: ${q.coverage} | Estimated band: ${q.band_score}`);
    if (q.notes) lines.push(`- Notes: ${q.notes}`);
  });

  lines.push("");
  lines.push("Transcription (used for assessment):");
  lines.push(evaluation.transcription);

  lines.push("");
  lines.push("Global Examiner Comments:");
  lines.push(evaluation.examiner_summary);

  return lines.join("\n");
}


async function gradeSubmission(jobData) {
  const { submissionId, testId, skill, response, mediaPaths } = jobData;

  console.log(`\n========================================`);
  console.log(`[Worker] Starting grading process`);
  console.log(`[Worker] Submission ID: ${submissionId}`);
  console.log(`[Worker] Test ID: ${testId}`);
  console.log(`[Worker] Skill: ${skill}`);
  console.log(`[Worker] Response keys: ${response ? Object.keys(response).join(', ') : 'none'}`);
  console.log(`[Worker] MediaPaths keys: ${mediaPaths ? Object.keys(mediaPaths).join(', ') : 'none'}`);
  console.log(`========================================\n`);

  const submission = await Submission.findById(submissionId).populate("student");
  if (!submission) {
    console.error(`[Worker] ERROR: Submission ${submissionId} not found in database`);
    throw new Error(`Submission ${submissionId} not found`);
  }
  console.log(`[Worker] ✓ Submission found - Status: ${submission.status}, Student: ${submission.student?.name}`);
  
  const testSet = await TestSet.findById(testId);
  if (!testSet) {
    console.error(`[Worker] ERROR: TestSet ${testId} not found in database`);
    throw new Error(`TestSet ${testId} not found`);
  }
  console.log(`[Worker] ✓ TestSet found - Title: ${testSet.title}, Total questions: ${testSet.questions?.length}`);

  let finalBand = null;
  let totalMarks = 0;
  let maxMarks = 0;

  if (skill === "writing") {
    const questions = testSet.questions.filter(q => q.questionType === "writing");
    console.log(`[Worker] Found ${questions.length} writing questions to grade`);
    
    if (questions.length === 0) {
      throw new Error(`No writing questions found in test ${testId}`);
    }
    
    const tasks = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      // Find question index in original testSet.questions array
      const questionIndex = testSet.questions.findIndex(tq => 
        (tq._id && q._id && String(tq._id) === String(q._id)) || tq === q
      );
      
      // Try to get answer by ID first, then by index (matches frontend qKey logic)
      const keyById = q._id ? String(q._id) : null;
      const keyByIndex = questionIndex >= 0 ? String(questionIndex) : null;
      
      const answerObj = (keyById && response?.[keyById]) || 
                        (keyByIndex && response?.[keyByIndex]) || 
                        null;
      
      const ans = answerObj?.text || "";
      console.log(`[Worker] Grading writing question ${q._id || questionIndex}, answer length: ${ans.length}`);

      const images = [];
      if (Array.isArray(q.imageUrls)) images.push(...q.imageUrls);
      if (q.imageUrl) images.push(q.imageUrl);

      const evalRes = await gradeWriting({
        answerText: ans,
        questionText: q.prompt,
        imageUrls: images,
      });

      const band = evalRes.band_score;
      const earned = q.marks ? (band / 9) * q.marks : 0;

      totalMarks += earned;
      maxMarks += q.marks || 0;

      tasks.push({
        prompt: q.prompt,
        band_score: band,
        evaluation: evalRes,
      });
    }

    finalBand = maxMarks ? roundHalf((totalMarks / maxMarks) * 9) : null;
    //const summary = buildDetailedWritingSummary(tasks, finalBand);
    const summary = tasks.map((t, i) => `Task ${i + 1}:\n${t.evaluation.examiner_summary}`).join("\n\n");

    console.log(`[Worker] Writing evaluation complete. Band: ${finalBand}, Total: ${totalMarks}/${maxMarks}`);

    await Submission.findByIdAndUpdate(submissionId, {
      status: "graded",
      bandScore: finalBand,
      totalMarks,
      maxMarks,
      geminiEvaluation: { band_score: finalBand, tasks },
      geminiWritingEvaluationSummary: summary,
    });

    await updateStudentStats({
      student: submission.student,
      skill,
      bandScore: finalBand,
      examinerSummary: summary,
    });
  }

  if (skill === "speaking") {
    const questions = testSet.questions.filter(q => q.questionType === "speaking");
    
    // Build media paths array with fallback logic (matches frontend qKey logic)
    const mediaPathsArray = questions.map(q => {
      // Find question index in original testSet.questions array
      const questionIndex = testSet.questions.findIndex(tq => 
        (tq._id && q._id && String(tq._id) === String(q._id)) || tq === q
      );
      
      const keyById = q._id ? String(q._id) : null;
      const keyByIndex = questionIndex >= 0 ? String(questionIndex) : null;
      
      // Try to get media path by ID first, then by index
      return (keyById && mediaPaths?.[keyById]) || 
             (keyByIndex && mediaPaths?.[keyByIndex]) || 
             null;
    });

    let evaluation = await gradeSpeaking({
      questions,
      mediaPath: mediaPathsArray,
    });
    evaluation = applyStrictSpeakingPenalties(evaluation, questions.length);

    finalBand = evaluation.band_score;
    const summary = buildDetailedSpeakingSummary(evaluation, questions.length);

    await Submission.findByIdAndUpdate(submissionId, {
      status: "graded",
      bandScore: finalBand,
      geminiEvaluation: evaluation,
      geminiSpeakingEvaluationSummary: summary,
    });

    await updateStudentStats({
      student: submission.student,
      skill,
      bandScore: finalBand,
      examinerSummary: summary,
    });
  }

  console.log(`\n========================================`);
  console.log(`[Worker] ✓✓✓ GRADING COMPLETED SUCCESSFULLY ✓✓✓`);
  console.log(`[Worker] Submission ID: ${submissionId}`);
  console.log(`[Worker] Skill: ${skill.toUpperCase()}`);
  console.log(`[Worker] Final Band Score: ${finalBand}`);
  console.log(`[Worker] Status updated to: graded`);
  console.log(`========================================\n`);
  return { submissionId, skill, finalBand };
}


const CONCURRENCY_LIMIT = 5; 

submissionQueue.process(CONCURRENCY_LIMIT, async (job) => {
  try {
    const startTime = Date.now();
    console.log(`[Worker] Starting job ${job.id} for submission ${job.data.submissionId}`);
    
    const result = await gradeSubmission(job.data);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Worker] Completed job ${job.id} in ${duration}s`);
    
    return result;
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error.message);
    console.error(`[Worker] Full error:`, error);
    
    // Update submission to failed status
    try {
      await Submission.findByIdAndUpdate(job.data.submissionId, {
        status: 'failed',
        geminiError: error.message || 'Grading failed',
      });
      console.error(`[Worker] Marked submission ${job.data.submissionId} as failed`);
    } catch (updateError) {
      console.error(`[Worker] Failed to update submission status:`, updateError.message);
    }
    
    throw error; 
  }
});

console.log(`CELTS Grading Worker started with concurrency limit: ${CONCURRENCY_LIMIT}`);

module.exports = { gradeSubmission };
