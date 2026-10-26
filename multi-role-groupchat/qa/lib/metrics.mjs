/**
 * Pure metrics for the plugin's QA harnesses.
 *
 * Every function here is deterministic and network-free: the runner scripts
 * own model calls, while this module owns scoring so the numbers are testable
 * with `node --test`.
 */

/**
 * Score one predicted target set against the expected set.
 *
 * @param {string[]} predicted - member ids chosen by the router.
 * @param {string[]} expected - human-labelled member ids.
 * @returns {{precision: number, recall: number, f1: number, exact: boolean, top1: boolean, truePositives: number, falsePositives: number, falseNegatives: number}} scores.
 */
export function scoreSet(predicted, expected) {
  const wanted = unique(expected);
  const got = unique(predicted);
  if (wanted.length === 0 && got.length === 0) {
    return {
      precision: 1,
      recall: 1,
      f1: 1,
      exact: true,
      top1: true,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
    };
  }
  if (wanted.length === 0) {
    return {
      precision: 0,
      recall: 1,
      f1: 0,
      exact: false,
      top1: false,
      truePositives: 0,
      falsePositives: got.length,
      falseNegatives: 0,
    };
  }
  if (got.length === 0) {
    return {
      precision: 0,
      recall: 0,
      f1: 0,
      exact: false,
      top1: false,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: wanted.length,
    };
  }
  const truePositives = got.filter((id) => wanted.includes(id)).length;
  const precision = truePositives / got.length;
  const recall = truePositives / wanted.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    precision,
    recall,
    f1,
    exact: got.length === wanted.length && truePositives === wanted.length,
    top1: got[0] === wanted[0],
    truePositives,
    falsePositives: got.length - truePositives,
    falseNegatives: wanted.length - truePositives,
  };
}

/**
 * Linear-interpolated percentile; returns 0 for an empty list.
 * @param {number[]} values - samples.
 * @param {number} percentile - 0–100.
 * @returns {number} percentile value.
 */
export function percentile(values, percentileValue) {
  const samples = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (samples.length === 0) return 0;
  const clamped = Math.min(100, Math.max(0, percentileValue));
  if (samples.length === 1) return samples[0];
  const position = (clamped / 100) * (samples.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return samples[lower];
  const weight = position - lower;
  return samples[lower] * (1 - weight) + samples[upper] * weight;
}

/**
 * Summarize router evaluation rows.
 *
 * Each row may contain `scores`, `method`, `tags`, `usage`, `latencyMs`,
 * `forbiddenHits`, and `error`.
 *
 * @param {Array<object>} rows - evaluated cases.
 * @returns {object} aggregate metrics plus per-tag breakdown.
 */
export function summarizeRows(rows) {
  const total = rows.length;
  const totalTp = rows.reduce((sum, row) => sum + (row.scores?.truePositives ?? 0), 0);
  const totalPredicted = rows.reduce(
    (sum, row) => sum + (row.predicted?.length ?? 0),
    0,
  );
  const totalExpected = rows.reduce(
    (sum, row) => sum + (row.expected?.length ?? 0),
    0,
  );
  const precision = totalPredicted === 0 ? (totalExpected === 0 ? 1 : 0) : totalTp / totalPredicted;
  const recall = totalExpected === 0 ? (totalPredicted === 0 ? 1 : 0) : totalTp / totalExpected;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const latencies = rows.map((row) => row.latencyMs ?? 0).filter((value) => value > 0);
  const inputTokens = rows.map((row) => row.usage?.inputTokens ?? 0);
  const outputTokens = rows.map((row) => row.usage?.outputTokens ?? 0);
  const methodCounts = {};
  for (const row of rows) {
    const method = typeof row.method === 'string' ? row.method : 'unknown';
    methodCounts[method] = (methodCounts[method] ?? 0) + 1;
  }
  const tags = new Map();
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      if (typeof tag !== 'string') continue;
      const bucket = tags.get(tag) ?? [];
      bucket.push(row);
      tags.set(tag, bucket);
    }
  }
  const byTag = [...tags.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tag, bucket]) => ({
      tag,
      ...summarizeRowsShallow(bucket),
    }));
  return {
    total,
    top1: total === 0 ? 0 : rows.filter((row) => row.scores?.top1 === true).length / total,
    exact: total === 0 ? 0 : rows.filter((row) => row.scores?.exact === true).length / total,
    precision,
    recall,
    f1,
    fallbackRate: total === 0 ? 0 : (methodCounts.fallback ?? 0) / total,
    modelRate: total === 0 ? 0 : (methodCounts.model ?? 0) / total,
    localRate: total === 0 ? 0 : 1 - ((methodCounts.fallback ?? 0) + (methodCounts.model ?? 0)) / total,
    forbiddenHits: rows.reduce((sum, row) => sum + (row.forbiddenHits?.length ?? 0), 0),
    errors: rows.filter((row) => typeof row.error === 'string' && row.error.length > 0).length,
    methodCounts,
    latency: {
      count: latencies.length,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
    },
    tokens: {
      inputP50: percentile(inputTokens, 50),
      inputP95: percentile(inputTokens, 95),
      outputP50: percentile(outputTokens, 50),
      outputP95: percentile(outputTokens, 95),
    },
    byTag,
  };
}

/**
 * Aggregate without recursing into tags (used by the per-tag breakdown).
 * @param {Array<object>} rows - rows.
 * @returns {object} shallow aggregate.
 */
function summarizeRowsShallow(rows) {
  const total = rows.length;
  const totalTp = rows.reduce((sum, row) => sum + (row.scores?.truePositives ?? 0), 0);
  const totalPredicted = rows.reduce((sum, row) => sum + (row.predicted?.length ?? 0), 0);
  const totalExpected = rows.reduce((sum, row) => sum + (row.expected?.length ?? 0), 0);
  const precision = totalPredicted === 0 ? (totalExpected === 0 ? 1 : 0) : totalTp / totalPredicted;
  const recall = totalExpected === 0 ? (totalPredicted === 0 ? 1 : 0) : totalTp / totalExpected;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    total,
    top1: total === 0 ? 0 : rows.filter((row) => row.scores?.top1 === true).length / total,
    exact: total === 0 ? 0 : rows.filter((row) => row.scores?.exact === true).length / total,
    precision,
    recall,
    f1,
    fallbackRate: total === 0 ? 0 : rows.filter((row) => row.method === 'fallback').length / total,
    forbiddenHits: rows.reduce((sum, row) => sum + (row.forbiddenHits?.length ?? 0), 0),
    errors: rows.filter((row) => typeof row.error === 'string' && row.error.length > 0).length,
  };
}

/**
 * Format a ratio as a percentage.
 * @param {number} value - 0–1.
 * @param {number} [digits] - decimal places.
 * @returns {string} percentage.
 */
export function percent(value, digits = 1) {
  if (!Number.isFinite(value)) return '–';
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Format a millisecond duration.
 * @param {number} value - milliseconds.
 * @returns {string} duration.
 */
export function ms(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 ms';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

/**
 * De-duplicate an id list while preserving order.
 * @param {unknown} values - candidate list.
 * @returns {string[]} unique strings.
 */
export function unique(values) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value === 'string' && !result.includes(value)) result.push(value);
  }
  return result;
}
