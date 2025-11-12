// services/aiService.js
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;
let fetchImpl;
if (typeof fetch !== 'undefined') fetchImpl = fetch;
else fetchImpl = require('node-fetch');

async function fetchWithRetry(url, options = {}, retries = 0) {
  try {
    const res = await fetchImpl(url, options);
    if (res.status === 429 && retries < MAX_RETRIES) {
      const delay = INITIAL_DELAY * 2 ** retries + Math.random() * 1000;
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries + 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = INITIAL_DELAY * 2 ** retries + Math.random() * 1000;
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries + 1);
    }
    throw err;
  }
}

/**
 * scoreSubmission(type, prompt, submission, opts)
 * type: 'writing'|'speaking'
 * submission: text or transcript
 * opts: { acousticScore } optional
 */
const scoreSubmission = async (type, prompt, submission, opts = {}) => {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_URL) {
    // return mock result for dev
    return {
      bandScore: Math.floor(Math.random() * 5) + 5,
      feedback: `[MOCK] ${type} feedback.`,
      linguisticScore: 7,
      acousticScore: opts.acousticScore || (type === 'speaking' ? 7 : undefined)
    };
  }

  const systemInstruction = type === 'writing'
    ? 'You are a CELTS examiner for Writing. Return a single JSON object with bandScore, feedback, linguisticScore.'
    : 'You are a CELTS examiner for Speaking. Return a single JSON object with bandScore, feedback, linguisticScore, acousticScore.';

  const userQuery = type === 'writing'
    ? `Prompt: ${prompt}\nStudent submission: ${submission}`
    : `Prompt: ${prompt}\nStudent transcript: ${submission}\nAcousticScore: ${opts.acousticScore || 0}`;

  let apiUrl = process.env.GEMINI_API_URL;
  const key = process.env.GEMINI_API_KEY;
  if (!apiUrl.includes(key) && apiUrl.includes('?')) apiUrl = `${apiUrl}&key=${encodeURIComponent(key)}`;
  else if (!apiUrl.includes(key) && !apiUrl.includes('key=')) apiUrl = `${apiUrl}${key}`;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: { responseMimeType: 'application/json' }
  };

  try {
    const res = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.candidates?.[0]?.text || null;
    if (!candidateText) throw new Error('Empty response from Gemini');
    const parsed = JSON.parse(candidateText);
    // Normalize
    parsed.bandScore = Math.max(1, Math.min(9, Number(parsed.bandScore || parsed.score || 3)));
    return parsed;
  } catch (err) {
    console.error('AI scoring error:', err.message);
    return { bandScore: 3, feedback: `AI Scoring failed: ${err.message}`, linguisticScore: 3, acousticScore: opts.acousticScore || 3 };
  }
};

module.exports = { scoreSubmission };
