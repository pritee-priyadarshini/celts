// services/gradingWorker.js

// const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai");
const { File } = require("openai/uploads");
const fs = require("fs");


const { submissionQueue } = require("./queue");
const Submission = require("../models/Submission");
const TestSet = require("../models/TestSet");
const Batch = require("../models/Batch");
const StudentStats = require("../models/StudentStats");

function applyStrictSpeakingPenalties(evaluation, totalQuestions) {
  let band = typeof evaluation.band_score === "number" ? evaluation.band_score : 0;

  // If many questions have coverage "minimal" or "none", clamp hard
  const perQ = Array.isArray(evaluation.per_question) ? evaluation.per_question : [];
  const minimalOrNoneCount = perQ.filter(q =>
    q.coverage === "minimal" || q.coverage === "none"
  ).length;

  if (totalQuestions > 0) {
    const ratio = minimalOrNoneCount / totalQuestions;

    // If 100% of questions are minimal/none -> cap band to <= 2
    if (ratio === 1) {
      band = Math.min(band, 2);
    }
    // If more than half not answered properly -> cap band to <= 3
    else if (ratio >= 0.5) {
      band = Math.min(band, 3);
    }
  }

  // If transcription is extremely short (e.g. < 15–20 words), cap band as well
  const wordCount = (evaluation.transcription || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount < 10) {
    band = Math.min(band, 2);
  } else if (wordCount < 20) {
    band = Math.min(band, 3);
  }

  // Round to nearest 0.5 just like before
  band = Math.round(band * 2) / 2;

  evaluation.band_score = band;
  evaluation.overall_band_score = band;
  return evaluation;
}


// StudentStats helper 
async function updateStudentStatsForSkill({
  student,
  skill,
  bandScore,
  geminiEvaluation = null,
}) {
  // We still allow updating marks even if bandScore is null
  const batch = await Batch.findOne({ students: student._id })
    .select("_id name")
    .lean();

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

  //Store latest band for this skill 
  if (bandScore != null && !Number.isNaN(bandScore)) {
    if (skill === "reading") stats.readingBand = bandScore;
    if (skill === "listening") stats.listeningBand = bandScore;
    if (skill === "writing") stats.writingBand = bandScore;
    if (skill === "speaking") stats.speakingBand = bandScore;
  }

  // Store latest examiner summary for writing 
  if (
    skill === "writing" &&
    geminiEvaluation &&
    typeof geminiEvaluation.examiner_summary === "string"
  ) {
    stats.writingExaminerSummary = geminiEvaluation.examiner_summary;
  }

  // Store latest examiner summary for writing 
  if (
    skill === "writing" &&
    geminiEvaluation &&
    typeof geminiEvaluation.examiner_summary === "string"
  ) {
    stats.writingExaminerSummary = geminiEvaluation.examiner_summary;
  }


  //Store latest examiner summary for speaking
  if (
    skill === "speaking" &&
    geminiEvaluation &&
    typeof geminiEvaluation.examiner_summary === "string"
  ) {
    stats.speakingExaminerSummary = geminiEvaluation.examiner_summary;
  }


  // Recompute overallBand as average of non-null skill bands
  const values = [
    stats.readingBand,
    stats.listeningBand,
    stats.writingBand,
    stats.speakingBand,
  ].filter((v) => typeof v === "number" && v > 0);

  stats.overallBand = values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2
    : null;

  await stats.save();
}

// Gemini client
// const ai = new GoogleGenAI({});
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });



// Helpers to extract response content
function extractAnswerForWritingQuestion(response, question, index) {
  if (!response || typeof response !== "object") return "";

  const keyById = question._id ? String(question._id) : null;
  const keyByIndex = String(index);

  let ans = null;

  if (keyById && response[keyById]) {
    ans = response[keyById];
  } else if (response[keyByIndex]) {
    ans = response[keyByIndex];
  }

  if (ans && typeof ans.text === "string" && ans.text.trim().length > 0) {
    return ans.text.trim();
  }

  return "";
}



// Gemini grading: Writing
// async function gradeWriting(essayText, testQuestion) {
//   const instruction = `
// You are an official IELTS Writing Task examiner.
// Evaluate the student's writing strictly according to IELTS criteria.

// Return ONLY valid JSON (no markdown, no explanation, no extra text).
// The JSON must have the shape:

// {
//   "band_score": number,
//   "criteria_breakdown": {
//     "task_response": { "score": number, "feedback": string },
//     "cohesion_coherence": { "score": number, "feedback": string },
//     "lexical_resource": { "score": number, "feedback": string },
//     "grammatical_range_accuracy": { "score": number, "feedback": string }
//   },
//   "examiner_summary": string
// }

// "band_score" must be between 1 and 9 (it may be .0 or .5).
// Be strict, but fair.
// `.trim();

//   const userPrompt = `
// IELTS QUESTION:
// ${testQuestion || "N/A"}

// STUDENT ANSWER:
// ${essayText || "(empty)"}
// `.trim();

//   const finalPrompt = `${instruction}\n\n${userPrompt}`;

//   const result = await ai.models.generateContent({
//     model: "gemini-2.5-flash",
//     contents: [
//       {
//         role: "user",
//         parts: [{ text: finalPrompt }],
//       },
//     ],
//     generationConfig: {
//       responseMimeType: "application/json",
//     },
//   });

//   console.log("---- GEMINI DEBUG (gradeWriting) ----");
//   console.log("candidates length:", result?.candidates?.length);
//   console.log("content0:", result?.candidates?.[0]?.content);
//   console.log("-------------------------------------");

//   const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

//   if (!rawText || typeof rawText !== "string") {
//     throw new Error("Gemini did not return valid JSON text");
//   }

//   const cleaned = rawText
//     .replace(/```json/g, "")
//     .replace(/```/g, "")
//     .trim();

//   let evaluation;
//   try {
//     evaluation = JSON.parse(cleaned);
//   } catch (err) {
//     console.error("Failed to parse Gemini JSON:", err.message);
//     console.error("Raw cleaned text was:", cleaned);
//     throw new Error("Gemini did not return valid JSON");
//   }

//   return evaluation;
// }





// OpenAI grading: Writing
async function gradeWriting(essayText, testQuestion) {
  const instruction = `
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
  "examiner_summary": string
}

Rules:
- "band_score" must be between 1 and 9.0 (it may be .0 or .5).
- Each criteria "score" must also be between 1 and 9.0 where possible.
- Feedback must be concise, IELTS-style, impersonal, and clearly linked to the band scores.
`.trim();

  const userPrompt = `
IELTS QUESTION:
${testQuestion || "N/A"}

CANDIDATE'S ANSWER:
${essayText || "(empty)"}
`.trim();

  const finalPrompt = `${instruction}\n\n${userPrompt}`;

  const result = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: finalPrompt }],
    response_format: { type: "json_object" },
  });

  const raw = result.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("ChatGPT did not return valid JSON");
  }

  return JSON.parse(raw);
}


// ---------------- Gemini grading: Speaking (placeholder) ----------------
// async function gradeSpeaking(audioPath) {
//   // Not implemented yet – avoid silently "grading" speaking
//   throw new Error(
//     "Speaking evaluation is not implemented yet in gradingWorker."
//   );
// }




//OpenAI grading: Speaking
async function gradeSpeaking({
  questions,
  mediaPath,
  audioUrl,
  videoUrl,
  manualTranscription,
}) {
  // We rely primarily on the local mediaPath saved by multer
  if (!mediaPath && !audioUrl && !videoUrl && !manualTranscription) {
    throw new Error(
      "No audio, video, or transcription provided for speaking evaluation."
    );
  }

  // TRANSCRIPTION
  let transcription = manualTranscription || "";

  if (!transcription && mediaPath) {
    try {
      const fileStream = fs.createReadStream(mediaPath);

      const t = await ai.audio.transcriptions.create({
        file: fileStream,
        model: "gpt-4o-mini-transcribe",
      });

      transcription = t.text;
    } catch (err) {
      console.error("Transcription failed:", err);
      throw err;
    }
  }

  if (!transcription || !transcription.trim()) {
    throw new Error("Transcription is empty; cannot grade speaking response.");
  }

  // EVALUATION PROMPT (STRICT IELTS, PER-QUESTION)
  const prompt = `
You are an official IELTS Speaking examiner.

Your job is to evaluate the candidate's speaking STRICTLY according to IELTS Speaking criteria.

RESTRICTIONS (VERY IMPORTANT):
- Do NOT address the candidate directly. Do NOT use "you" / "your".
  Instead, write in third person: "the candidate", "the speaker", "the response".
- Do NOT include greetings, motivational comments, praise, or sympathy.
  No "Dear student", "Good job", "Keep it up", etc.
- Do NOT speculate about the candidate's personal life, background, feelings, or abilities.
- Focus ONLY on what is evident from the spoken language in the transcription.
- Use a neutral, professional examiner tone at all times.

The speaking test consists of multiple questions. They are:

${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

TRANSCRIPTION OF THE CANDIDATE'S SPOKEN ANSWERS:
"${transcription}"

STRICT CHECKING INSTRUCTIONS:

1. For EACH question:
   - Determine whether the transcription actually addresses that question.
   - Classify coverage as:
       "full"     – the question is clearly answered with sufficient development.
       "partial"  – the question is somewhat addressed but lacks development or clarity.
       "minimal"  – only a few words/phrases related to the question; barely an answer.
       "none"     – the question is not answered at all.
   - If a question explicitly expects the candidate to speak for around 1–2 minutes
     (this may be indicated in the question text), then a response of only a
     very short sentence or a few seconds of speech should be treated as
     "minimal" or "partial" coverage and penalized accordingly. Keep the time limit a strict evaluation parameter.
     Make sure the candidate is following all the rules being stated in question.
     If time limit is too less give them a band score of less than 4.

2. For EACH question, assign a per-question band_score (1–9, can be .0 or .5)
   based on the candidate's performance relevant to that question, considering:
   - Fluency
   - Coherence
   - Vocabulary
   - Grammar
   - Pronunciation

3. Then compute an OVERALL band score for the whole speaking performance,
   taking into account:
   - Coverage of ALL questions (including missing or minimal answers).
   - The quality of language across the entire transcription.
   - Underlength responses or missing answers must reduce the overall band.

4. The examiner_summary must:
   - Be concise and IELTS-style.
   - Be fully impersonal (no "you").
   - Explicitly mention any questions that were not properly answered
     or where the response was much shorter than required.

Return ONLY valid json (no markdown, no explanation, no extra text).
The response MUST be a single json object with EXACTLY this structure:

{
  "band_score": number,
  "overall_band_score": number,
  "examiner_summary": string,
  "per_question": [
    {
      "question_index": number,
      "question_text": string,
      "coverage": "full" | "partial" | "minimal" | "none",
      "band_score": number,
      "notes": string
    }
  ],
  "criteria_breakdown": {
    "fluency": number,
    "coherence": number,
    "vocabulary": number,
    "grammar": number,
    "pronunciation": number
  }
}

Rules:
- "overall_band_score" must be between 1 and 9 (may be .0 or .5).
- "band_score" should normally be the same as "overall_band_score" (kept for backward compatibility).
- Each per_question.band_score and criteria_breakdown value must also be in the range 1–9 where possible.
`.trim();

  const result = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(result.choices[0].message.content || "{}");

  // Safety: normalize shape & ensure top-level band_score exists
  let overallBand = parsed.overall_band_score;
  if (typeof overallBand !== "number") {
    if (Array.isArray(parsed.per_question) && parsed.per_question.length > 0) {
      const bands = parsed.per_question
        .map((q) => (typeof q.band_score === "number" ? q.band_score : null))
        .filter((v) => v != null);
      if (bands.length > 0) {
        const avg = bands.reduce((a, b) => a + b, 0) / bands.length;
        overallBand = Math.round(avg * 2) / 2;
      } else {
        overallBand = 0;
      }
    } else {
      overallBand = 0;
    }
  }

  if (typeof parsed.band_score !== "number") {
    parsed.band_score = overallBand;
  }

  return {
    ...parsed,
    overall_band_score: overallBand,
    band_score: parsed.band_score,
    transcription,
  };
}





// Queue Processor 
submissionQueue.process(async (job) => {
  const { submissionId, studentId, testId, skill, response, mediaPath } = job.data;

  let submission;
  let testSet;

  try {
    submission = await Submission.findById(submissionId)
      .populate("student")
      .lean();
    testSet = await TestSet.findById(testId).lean();

    if (!submission || !testSet) {
      throw new Error(
        `Submission or TestSet ID ${submissionId}/${testId} not found.`
      );
    }
  } catch (dbError) {
    console.error(`[Worker] DB Fetch Error for job ${job.id}:`, dbError);
    throw dbError;
  }

  let evaluationResult = null;
  let finalBandScore = null;

  // We'll also compute marks for writing here:
  let totalMarksFromAI = 0;
  let maxMarksFromAI = 0;

  try {
    if (skill === "writing") {
      // MULTI-QUESTION WRITING SUPPORT 
      const writingQuestions = (testSet.questions || []).filter(
        (q) =>
          q.questionType === "writing" ||
          q.skill === "writing" ||
          q.type === "writing"
      );

      if (!writingQuestions.length) {
        throw new Error("No writing questions found in this testSet.");
      }

      // Evaluate each writing question separately
      const perTaskResults = [];

      for (let idx = 0; idx < writingQuestions.length; idx++) {
        const q = writingQuestions[idx];
        const prompt = q.prompt || "No prompt text";
        const answerText = extractAnswerForWritingQuestion(response, q, idx);

        const singleEval = await gradeWriting(answerText, prompt);

        // Extract numeric band for this task
        let taskBand = null;
        if (
          singleEval &&
          Object.prototype.hasOwnProperty.call(singleEval, "band_score")
        ) {
          const rawBand = singleEval.band_score;
          const numeric =
            typeof rawBand === "number"
              ? rawBand
              : Number.parseFloat(String(rawBand));
          taskBand = Number.isFinite(numeric) ? numeric : null;
        }

        // Compute marks for this question based on band (0–9 -> 0–marks)
        const qMaxMarks =
          typeof q.marks === "number" && q.marks > 0 ? q.marks : 0;
        let qEarnedMarks = 0;

        if (taskBand != null && qMaxMarks > 0) {
          qEarnedMarks = (taskBand / 9) * qMaxMarks;
        }

        maxMarksFromAI += qMaxMarks;
        totalMarksFromAI += qEarnedMarks;

        perTaskResults.push({
          questionId: q._id ? String(q._id) : `index-${idx}`,
          prompt,
          writingType: q.writingType || null,
          wordLimit: q.wordLimit || null,
          maxMarks: qMaxMarks,
          earnedMarks: qEarnedMarks,
          band_score: taskBand,
          evaluation: singleEval,
          answerSnippet: answerText ? answerText.slice(0, 400) : "",
        });
      }

      // Overall band from either:
      // 1) ratio of totalMarksFromAI / maxMarksFromAI -> 0–9
      // 2) average of per-question band scores if maxMarksFromAI=0
      if (maxMarksFromAI > 0) {
        const rawOverall = (totalMarksFromAI / maxMarksFromAI) * 9;
        finalBandScore = Math.round(rawOverall * 2) / 2;
      } else {
        const taskBands = perTaskResults
          .map((t) => t.band_score)
          .filter((b) => typeof b === "number" && !Number.isNaN(b));
        if (taskBands.length) {
          const rawOverall =
            taskBands.reduce((a, b) => a + b, 0) / taskBands.length;
          finalBandScore = Math.round(rawOverall * 2) / 2;
        } else {
          finalBandScore = null;
        }
      }

      // Build a combined evaluationResult keeping top-level fields
      // compatible with your frontend (band_score + examiner_summary).
      const taskSummaries = perTaskResults
        .map((t, idx) => {
          const taskSummary =
            t.evaluation?.examiner_summary ||
            t.evaluation?.summary ||
            "No summary.";
          return `Task ${idx + 1} (${t.writingType || "Writing"}): ${taskSummary
            }`;
        })
        .join("\n\n");

      evaluationResult = {
        band_score: finalBandScore,
        examiner_summary:
          taskSummaries ||
          "Multiple writing tasks evaluated. No detailed summaries available.",
        // For backward compatibility, just set criteria_breakdown from first task if present
        criteria_breakdown:
          perTaskResults[0]?.evaluation?.criteria_breakdown || null,
        tasks: perTaskResults,
      };
    } else if (skill === "speaking") {
    const speakingQuestions = (testSet.questions || []).filter(
      (q) => q.skill === "speaking" || q.questionType === "speaking" );
    const questions = speakingQuestions.map(
      (q) => q.prompt || q.text || "" );

    // Raw OpenAI evaluation
    evaluationResult = await gradeSpeaking({
      questions,
      mediaPath,
      audioUrl: response?.audioUrl || null,
      videoUrl: response?.videoUrl || null,
      manualTranscription: response?.transcription || null,
    });

    // Apply strict penalties for underlength / missing answers
    evaluationResult = applyStrictSpeakingPenalties(
      evaluationResult,
      speakingQuestions.length
    );

    finalBandScore = evaluationResult.band_score;
    } else {
      console.warn(
        `[Worker] Unsupported skill "${skill}" for submission ${submissionId}`
      );
      return;
    }

    // Extract band score for non-writing skills if needed
    if (skill !== "writing") {
      if (
        evaluationResult &&
        Object.prototype.hasOwnProperty.call(evaluationResult, "band_score")
      ) {
        const rawBand = evaluationResult.band_score;
        const numeric =
          typeof rawBand === "number"
            ? rawBand
            : Number.parseFloat(String(rawBand));
        finalBandScore = Number.isFinite(numeric) ? numeric : null;
      } else {
        finalBandScore = null;
      }
    }

    // Build update doc
    const updateDoc = {
      status: "graded",
      bandScore: finalBandScore,
      geminiEvaluation: evaluationResult,
      updatedAt: new Date(),
    };
    // Skill-specific summaries
    if (skill === "writing") {
      updateDoc.geminiWritingEvaluationSummary =
        evaluationResult && typeof evaluationResult.examiner_summary === "string"
          ? evaluationResult.examiner_summary
          : null;
    }

    if (skill === "speaking") {
      updateDoc.geminiSpeakingEvaluationSummary =
        evaluationResult && typeof evaluationResult.examiner_summary === "string"
          ? evaluationResult.examiner_summary
          : null;
    }

    // For writing, also update totalMarks / maxMarks of the submission
    if (skill === "writing") {
      updateDoc.totalMarks = Number.isFinite(totalMarksFromAI)
        ? Number(totalMarksFromAI.toFixed(2))
        : 0;
      updateDoc.maxMarks = maxMarksFromAI || 0;
    }

    await Submission.findByIdAndUpdate(submissionId, updateDoc);

    await updateStudentStatsForSkill({
      student: submission.student,
      skill,
      bandScore: finalBandScore,
      geminiEvaluation: evaluationResult,
    });

    if (mediaPath) {
      fs.unlink(mediaPath, (err) => {
        if (err) {
          console.error(`[Worker] Failed to delete media file ${mediaPath}:`, err.message);
        } else {
          console.log(`[Worker] Deleted media file ${mediaPath}`);
        }
      });
    }

    console.log(
      `[Worker] Successfully graded ${skill} submission ${submissionId}. Band: ${finalBandScore}`
    );
    return { bandScore: finalBandScore };

  } catch (error) {
    console.error(
      `[Worker] Failed to process job ${job.id} for submission ${submissionId}:`,
      error.message
    );

    if (mediaPath) {
      fs.unlink(mediaPath, (err) => {
        if (err) {
          console.error(`[Worker] Failed to delete media file after error ${mediaPath}:`, err.message);
        }
      });
    }
    throw error;
  }
}
);

console.log("CELTS Grading Worker started and listening for queue jobs...");
