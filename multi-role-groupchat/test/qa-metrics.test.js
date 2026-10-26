import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ms,
  percent,
  percentile,
  scoreSet,
  summarizeRows,
  unique,
} from '../qa/lib/metrics.mjs';

test('scoreSet handles exact, overlap, empty, and forbidden sets', () => {
  assert.deepEqual(scoreSet(['a', 'b'], ['a', 'b']), {
    precision: 1,
    recall: 1,
    f1: 1,
    exact: true,
    top1: true,
    truePositives: 2,
    falsePositives: 0,
    falseNegatives: 0,
  });

  const partial = scoreSet(['a', 'c'], ['a', 'b']);
  assert.equal(partial.exact, false);
  assert.equal(partial.top1, true);
  assert.equal(partial.precision, 0.5);
  assert.equal(partial.recall, 0.5);
  assert.equal(partial.f1, 0.5);

  const missed = scoreSet([], ['a']);
  assert.equal(missed.f1, 0);
  assert.equal(missed.falseNegatives, 1);

  const extra = scoreSet(['a'], []);
  assert.equal(extra.exact, false);
  assert.equal(extra.falsePositives, 1);

  const none = scoreSet([], []);
  assert.equal(none.exact, true);
  assert.equal(none.f1, 1);
});

test('percentile interpolates and ignores non-finite values', () => {
  assert.equal(percentile([], 50), 0);
  assert.equal(percentile([10], 95), 10);
  assert.equal(percentile([0, 10], 50), 5);
  assert.ok(Math.abs(percentile([0, 10, 20, 30], 95) - 28.5) < 1e-9);
  assert.equal(percentile([1, Number.NaN, 3], 50), 2);
});

test('summarizeRows reports micro, fallback, latency, tokens, and tags', () => {
  const rows = [
    {
      predicted: ['a'],
      expected: ['a'],
      scores: scoreSet(['a'], ['a']),
      method: 'explicit',
      tags: ['direct'],
      usage: { inputTokens: 10, outputTokens: 2 },
      latencyMs: 100,
    },
    {
      predicted: ['b'],
      expected: ['a'],
      scores: scoreSet(['b'], ['a']),
      method: 'fallback',
      tags: ['direct', 'ambiguous'],
      usage: { inputTokens: 30, outputTokens: 4 },
      latencyMs: 300,
    },
    {
      predicted: [],
      expected: [],
      scores: scoreSet([], []),
      method: 'owner',
      tags: ['owner'],
      usage: null,
      latencyMs: 0,
    },
  ];
  const summary = summarizeRows(rows);
  assert.equal(summary.total, 3);
  assert.equal(summary.top1, 2 / 3);
  assert.equal(summary.exact, 2 / 3);
  assert.equal(summary.precision, 0.5);
  assert.equal(summary.recall, 0.5);
  assert.equal(summary.f1, 0.5);
  assert.equal(summary.fallbackRate, 1 / 3);
  assert.equal(summary.modelRate, 0);
  assert.equal(summary.errors, 0);
  assert.equal(summary.latency.p50, 200);
  assert.equal(summary.latency.p95, 290);
  assert.equal(summary.tokens.inputP50, 10);
  assert.equal(summary.byTag.find((tag) => tag.tag === 'direct').total, 2);
  assert.equal(summary.byTag.find((tag) => tag.tag === 'direct').fallbackRate, 0.5);
  assert.equal(summary.byTag.find((tag) => tag.tag === 'ambiguous').total, 1);
});

test('formatting helpers stay stable', () => {
  assert.equal(percent(0.856, 1), '85.6%');
  assert.equal(ms(12.4), '12 ms');
  assert.equal(ms(1250), '1.25 s');
  assert.deepEqual(unique(['a', 'a', 2, 'b']), ['a', 'b']);
});
