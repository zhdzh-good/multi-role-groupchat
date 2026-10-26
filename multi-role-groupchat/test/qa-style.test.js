import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addressTermsOf,
  driftFromTexts,
  driftScore,
  styleFingerprint,
} from '../qa/lib/style.mjs';

test('styleFingerprint measures length, questions, short sentences, and address terms', () => {
  const profile = styleFingerprint(['你来了。', '闸在哪？', '林老板，别动。']);
  assert.equal(profile.count, 3);
  assert.ok(profile.averageChars > 0);
  assert.equal(profile.questionRate, 1 / 3);
  assert.ok(profile.shortSentenceRate > 0.5);
  assert.ok(profile.addressTerms.includes('你'));
  assert.ok(profile.addressTerms.includes('林老板'));
});

test('driftScore is low for similar voices and high for a changed voice', () => {
  const early = styleFingerprint(['你来了。', '闸在哪？', '别动。']);
  const same = styleFingerprint(['你来了。', '闸在哪？', '别动。']);
  const changed = styleFingerprint([
    '亲爱的朋友，我想我们需要认真谈一谈这个复杂的问题，因为我认为……',
    '请不要担心，我会一直在这里陪伴着你，并且解释所有细节！',
    '这真是一个令人无比激动的夜晚，我们应该好好庆祝一下！',
  ]);
  const low = driftScore(early, same);
  const high = driftScore(early, changed);
  assert.equal(low.score, 0);
  assert.equal(low.addressOverlap, 1);
  assert.ok(high.score > low.score);
  assert.ok(high.averageCharsDelta > 0);
});

test('driftFromTexts needs at least four replies and splits early/late', () => {
  assert.equal(driftFromTexts(['一', '二', '三']), null);
  const drift = driftFromTexts(['你来了。', '闸在哪？', '别动。', '你听见了吗？']);
  assert.ok(drift !== null);
  assert.ok(drift.score >= 0 && drift.score <= 1);
});

test('addressTermsOf returns stable unique terms', () => {
  const terms = addressTermsOf('林老板，你听我说。');
  assert.ok(terms.includes('林老板'));
  assert.ok(terms.includes('你'));
  assert.deepEqual(addressTermsOf('今天下雨。'), []);
});
