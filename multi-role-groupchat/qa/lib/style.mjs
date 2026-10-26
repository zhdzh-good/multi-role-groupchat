/**
 * Cheap, deterministic style fingerprints for role-drift review.
 *
 * This is not a judge. It gives reviewers one comparable number for “does the
 * late reply still look like the early one?” based on length, punctuation, and
 * address-term usage. Human rubric scores remain the source of truth.
 */

/**
 * Build a style fingerprint for one or more replies.
 *
 * @param {string[]} texts - character replies in chronological order.
 * @returns {{count: number, averageChars: number, questionRate: number, exclamationRate: number, ellipsisRate: number, shortSentenceRate: number, addressTerms: string[]}} fingerprint.
 */
export function styleFingerprint(texts) {
  const samples = (Array.isArray(texts) ? texts : []).filter((text) => typeof text === 'string' && text.trim().length > 0);
  const joined = samples.join('\n');
  const chars = [...joined];
  const sentences = joined
    .split(/[。！？!?…\n]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const shortSentences = sentences.filter((sentence) => [...sentence].length <= 12).length;
  return {
    count: samples.length,
    averageChars: samples.length === 0 ? 0 : chars.length / samples.length,
    questionRate: ratio(countMatches(joined, /[？?]/gu), sentences.length),
    exclamationRate: ratio(countMatches(joined, /[！!]/gu), sentences.length),
    ellipsisRate: ratio(countMatches(joined, /(?:…|\.{3})/gu), sentences.length),
    shortSentenceRate: ratio(shortSentences, sentences.length),
    addressTerms: addressTermsOf(joined),
  };
}

/**
 * Compare early and late fingerprints. A larger score means a larger drift.
 * Components are normalized to 0–1 before averaging.
 *
 * @param {ReturnType<typeof styleFingerprint>} early - earlier replies.
 * @param {ReturnType<typeof styleFingerprint>} late - later replies.
 * @returns {{score: number, averageCharsDelta: number, questionDelta: number, shortSentenceDelta: number, addressOverlap: number}} drift.
 */
export function driftScore(early, late) {
  if (early.count === 0 || late.count === 0) {
    return { score: 0, averageCharsDelta: 0, questionDelta: 0, shortSentenceDelta: 0, addressOverlap: 1 };
  }
  const averageCharsDelta = relativeDelta(early.averageChars, late.averageChars);
  const questionDelta = Math.abs(early.questionRate - late.questionRate);
  const shortSentenceDelta = Math.abs(early.shortSentenceRate - late.shortSentenceRate);
  const earlyTerms = new Set(early.addressTerms);
  const lateTerms = new Set(late.addressTerms);
  const shared = [...earlyTerms].filter((term) => lateTerms.has(term)).length;
  const union = new Set([...earlyTerms, ...lateTerms]).size;
  const addressOverlap = union === 0 ? 1 : shared / union;
  return {
    score: (averageCharsDelta + questionDelta + shortSentenceDelta + (1 - addressOverlap)) / 4,
    averageCharsDelta,
    questionDelta,
    shortSentenceDelta,
    addressOverlap,
  };
}

/**
 * Split replies into early and late halves and compare them.
 * @param {string[]} texts - replies in order.
 * @returns {ReturnType<typeof driftScore>|null} drift, or null when fewer than four replies exist.
 */
export function driftFromTexts(texts) {
  const samples = (Array.isArray(texts) ? texts : []).filter((text) => typeof text === 'string' && text.trim().length > 0);
  if (samples.length < 4) return null;
  const middle = Math.floor(samples.length / 2);
  return driftScore(styleFingerprint(samples.slice(0, middle)), styleFingerprint(samples.slice(middle)));
}

/**
 * Known Chinese address terms that often reveal a voice change.
 * @param {string} text - joined replies.
 * @returns {string[]} sorted unique terms.
 */
export function addressTermsOf(text) {
  const known = ['你', '您', '大家', '各位', '林老板', '老板', '先生', '小姐', '老师', '师傅', '哥', '姐'];
  return known.filter((term) => text.includes(term)).sort((left, right) => left.localeCompare(right));
}

/**
 * @param {number} part - numerator.
 * @param {number} total - denominator.
 * @returns {number} ratio, 0 when total is zero.
 */
function ratio(part, total) {
  return total === 0 ? 0 : part / total;
}

/**
 * @param {string} text - haystack.
 * @param {RegExp} pattern - global regex.
 * @returns {number} match count.
 */
function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

/**
 * @param {number} early - early value.
 * @param {number} late - late value.
 * @returns {number} absolute difference relative to the larger value.
 */
function relativeDelta(early, late) {
  const scale = Math.max(1, early, late);
  return Math.abs(early - late) / scale;
}
