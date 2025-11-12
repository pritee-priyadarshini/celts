// utils/scoring.js
/**
 * Convert rawScore (0..total) to Band (1..9)
 * Simple mapping: percent -> linear 1..9
 */
function rawToBand(raw, total) {
  if (!total || total <= 0) return 1;
  const pct = raw / total; // 0..1
  const band = Math.round((pct * 8) + 1); // 1..9
  return Math.max(1, Math.min(9, band));
}

module.exports = { rawToBand };
