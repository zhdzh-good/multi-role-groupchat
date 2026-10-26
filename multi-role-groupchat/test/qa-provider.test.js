import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  normalizeProviderUsage,
  providerSettings,
  requireApiKey,
} from '../qa/lib/provider.mjs';

test('providerSettings reads env and normalizes the base URL', () => {
  const settings = providerSettings({}, {
    GROUPCHAT_QA_API_KEY: 'secret',
    GROUPCHAT_QA_BASE_URL: 'https://example.com/v1/',
    GROUPCHAT_QA_MODEL: 'qa-model',
    GROUPCHAT_QA_TIMEOUT_MS: '1234',
  });
  assert.equal(settings.apiKey, 'secret');
  assert.equal(settings.baseUrl, 'https://example.com/v1');
  assert.equal(settings.model, 'qa-model');
  assert.equal(settings.timeoutMs, 1234);

  const fallback = providerSettings({}, {});
  assert.equal(fallback.baseUrl, DEFAULT_BASE_URL);
  assert.equal(fallback.model, DEFAULT_MODEL);
  assert.equal(fallback.apiKey, '');
});

test('requireApiKey is actionable and accepts the DeepSeek fallback', () => {
  assert.throws(() => requireApiKey({ apiKey: '' }), /GROUPCHAT_QA_API_KEY/);
  assert.doesNotThrow(() => requireApiKey({ apiKey: 'x' }));
  const settings = providerSettings({}, { DEEPSEEK_API_KEY: 'deepseek-key' });
  assert.equal(settings.apiKey, 'deepseek-key');
});

test('normalizeProviderUsage maps OpenAI-style counters without inventing writes', () => {
  assert.deepEqual(normalizeProviderUsage({
    prompt_tokens: 100,
    completion_tokens: 20,
    prompt_cache_hit_tokens: 70,
    prompt_cache_miss_tokens: 30,
  }), {
    inputTokens: 100,
    outputTokens: 20,
    cacheReadTokens: 70,
    cacheWriteTokens: 0,
  });
  assert.equal(normalizeProviderUsage(null), null);
  assert.equal(normalizeProviderUsage({}), null);
});
