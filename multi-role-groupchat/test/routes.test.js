import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { registerRoutes } from '../lib/routes.js';
import { GroupStore } from '../lib/store.js';

/**
 * Fake Host context exposing Connection routes, llm streaming, and the default model.
 * @param {{texts?: string[]}} [options] - generated texts.
 * @returns {{ctx: object, routes: Map<string, object>}} fixture.
 */
function fakeContext(options = {}) {
  const routes = new Map();
  const texts = [...(options.texts ?? ['你好。'])];
  const ctx = {
    effect: (callback) => callback(),
    get: (key) => (key === 'agentDefaultModel'
      ? { currentSelection: () => ({ provider: 'fake', model: 'fake-1' }) }
      : undefined),
    logger: { warn: () => {} },
    connection: {
      fetch: {
        register: (route) => {
          routes.set(route.path, route);
          return async () => {};
        },
      },
    },
    llm: {
      listProviders: () => [{ id: 'fake', name: 'Fake' }],
      listModels: async () => [{ id: 'fake-1', name: 'Fake One' }],
      async *stream() {
        const text = texts.length > 0 ? texts.shift() : '……';
        yield { type: 'text-delta', text };
        yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 2, cacheWriteTokens: 0 } };
        yield { type: 'finish', reason: { kind: 'stop' } };
      },
    },
  };
  return { ctx, routes };
}

/**
 * @param {Map<string, object>} routes - registered routes.
 * @param {string} path - route path.
 * @param {{method?: string, body?: object, query?: string}} [options] - call options.
 * @returns {Promise<{status: number, json: any, text: string, response: Response}>} response.
 */
async function call(routes, path, options = {}) {
  const route = routes.get(path);
  assert.ok(route, `route ${path} is registered`);
  const method = options.method ?? (route.methods.includes('POST') ? 'POST' : 'GET');
  const request = new Request(`http://127.0.0.1:3080${path}${options.query ?? ''}`, {
    method,
    ...(options.body === undefined ? {} : {
      body: JSON.stringify(options.body),
      headers: { 'content-type': 'application/json' },
    }),
  });
  const response = await route.fetch(request);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text, response };
}

/**
 * @param {string} text - NDJSON body.
 * @returns {Array<object>} events.
 */
function ndjson(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

/**
 * Create a temporary store and wire the routes.
 * @param {object} t - test context.
 * @param {{texts?: string[]}} [options] - generation texts.
 * @returns {Promise<object>} fixture.
 */
async function fixture(t, options) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupchat-routes-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const store = new GroupStore(root);
  await store.init();
  const { ctx, routes } = fakeContext(options);
  registerRoutes(ctx, store);
  return { store, routes, root };
}

test('routes expose state, creation, sending, pinning, rewriting, and export', async (t) => {
  const { routes } = await fixture(t, { texts: ['你好。', '我也在。', '那好吧。'] });
  assert.equal(routes.size, 10);

  const created = await call(routes, '/api/groupchat.group-create', {
    body: {
      name: '旧城书店的晚上',
      brief: '停电。',
      members: [
        { name: '林晚', oneLiner: '店主', core: '说话短。' },
        { name: '周野', oneLiner: '电工', core: '嘴硬。' },
      ],
    },
  });
  assert.equal(created.status, 200);
  assert.match(created.json.groupId, /^g_/);
  assert.equal(created.json.state.members.length, 2);
  const groupId = created.json.groupId;

  const state = await call(routes, '/api/groupchat.state', { method: 'GET', query: `?groupId=${groupId}` });
  assert.equal(state.status, 200);
  assert.equal(state.json.selectedId, groupId);
  assert.deepEqual(state.json.defaultModel, { provider: 'fake', model: 'fake-1' });
  assert.equal(state.json.selected.messages.length, 0);

  const models = await call(routes, '/api/groupchat.models', { method: 'GET' });
  assert.equal(models.status, 200);
  assert.equal(models.json.providers[0].models[0].id, 'fake-1');

  const sent = await call(routes, '/api/groupchat.send', { body: { groupId, text: '@林晚 门怎么锁了？' } });
  assert.equal(sent.status, 200);
  const events = ndjson(sent.text);
  assert.equal(events[0].type, 'message');
  assert.equal(events[0].message.role, 'user');
  assert.deepEqual(events[0].message.mentions, [created.json.state.members[0].id]);
  const messages = events.filter((event) => event.type === 'message').map((event) => event.message);
  assert.equal(messages.length, 4, 'user message plus three generations');
  assert.deepEqual(messages.slice(1).map((message) => message.memberId), [
    created.json.state.members[0].id,
    created.json.state.members[1].id,
    created.json.state.members[0].id,
  ]);
  assert.equal(messages[1].usage.inputTokens, 10);
  const finalState = events.find((event) => event.type === 'state');
  assert.ok(finalState, 'final state event');
  assert.equal(finalState.state.messages.length, 4);
  assert.equal(finalState.state.totals.outputTokens, 12);
  assert.equal(events.at(-1).type, 'done');

  const latest = finalState.state.latestMemberMessageId;
  const pinned = await call(routes, '/api/groupchat.pin', { body: { groupId, messageId: latest, pinned: true } });
  assert.equal(pinned.status, 200);
  assert.equal(pinned.json.state.pinnedCount, 1);
  assert.equal(pinned.json.state.messages.find((message) => message.id === latest).pinned, true);

  const rewritten = await call(routes, '/api/groupchat.rewrite', { body: { groupId, messageId: latest } });
  assert.equal(rewritten.status, 200);
  const rewriteEvents = ndjson(rewritten.text);
  assert.ok(rewriteEvents.some((event) => event.type === 'supersede' && event.target === latest));
  const replacement = rewriteEvents.find((event) => event.type === 'message' && event.message.supersedes === latest);
  assert.ok(replacement);
  const afterRewrite = rewriteEvents.find((event) => event.type === 'state');
  assert.equal(afterRewrite.state.messages.length, 4);
  assert.equal(afterRewrite.state.supersededCount, 1);

  const exported = await call(routes, '/api/groupchat.export', { body: { groupId, includeHistory: true } });
  assert.equal(exported.status, 200);
  assert.match(exported.json.markdown, /# 旧城书店的晚上/);
  assert.match(exported.json.markdown, /## 历史版本/);
  assert.match(exported.json.path, /export\/script\.md$/);

  const stopped = await call(routes, '/api/groupchat.stop', { body: { groupId } });
  assert.equal(stopped.status, 200);
  assert.equal(stopped.json.stopped, false);
});

test('routes reject invalid input without leaking internals', async (t) => {
  const { routes } = await fixture(t);
  const noName = await call(routes, '/api/groupchat.group-create', { body: { name: '', members: [] } });
  assert.equal(noName.status, 400);
  assert.equal(noName.json.error.code, 'groupchat/invalid');
  const oneMember = await call(routes, '/api/groupchat.group-create', {
    body: { name: 'x', members: [{ name: '甲' }] },
  });
  assert.equal(oneMember.status, 400);
  const badJson = await call(routes, '/api/groupchat.state', { method: 'GET', query: '?groupId=../x' });
  assert.equal(badJson.status, 400);
  const missingGroup = await call(routes, '/api/groupchat.send', { body: { groupId: 'g_missing', text: '在吗' } });
  assert.equal(missingGroup.status, 404);
  const emptyText = await call(routes, '/api/groupchat.send', { body: { groupId: 'g_missing', text: '' } });
  assert.equal(emptyText.status, 400);
});
