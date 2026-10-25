import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { registerRoutes } from '../lib/routes.js';
import { GroupStore } from '../lib/store.js';

/**
 * Fake Host context exposing Connection routes, llm streaming, and the default model.
 * @param {{texts?: string[], routeText?: string}} [options] - generated texts and classifier output.
 * @returns {{ctx: object, routes: Map<string, object>}} fixture.
 */
function fakeContext(options = {}) {
  const routes = new Map();
  const texts = [...(options.texts ?? ['你好。'])];
  const routeText = options.routeText ?? '{"targets":[],"reason":"","confidence":0}';
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
      async *stream(request) {
        const isRouter = request.system?.includes('群聊路由器') === true;
        const text = isRouter ? routeText : (texts.length > 0 ? texts.shift() : '……');
        yield { type: 'text-delta', text };
        yield {
          type: 'usage',
          usage: isRouter
            ? { inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }
            : { inputTokens: 10, outputTokens: 4, cacheReadTokens: 2, cacheWriteTokens: 0 },
        };
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
  assert.equal(routes.size, 11);

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

  const configured = await call(routes, '/api/groupchat.group-update', {
    body: { groupId, policy: { bystanderChance: 0 } },
  });
  assert.equal(configured.status, 200);

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
  assert.equal(messages.length, 2, 'user message plus the guaranteed addressee');
  assert.deepEqual(messages.slice(1).map((message) => message.memberId), [
    created.json.state.members[0].id,
  ]);
  assert.equal(messages[1].usage.inputTokens, 10);
  const finalState = events.find((event) => event.type === 'state');
  assert.ok(finalState, 'final state event');
  assert.equal(finalState.state.messages.length, 2);
  assert.equal(finalState.state.totals.outputTokens, 4);
  assert.equal(finalState.state.lastRoute.method, 'explicit');
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
  assert.equal(afterRewrite.state.messages.length, 2);
  assert.equal(afterRewrite.state.supersededCount, 1);
  assert.equal(afterRewrite.state.pinnedCount, 1, 'a pinned reply stays pinned through rewrite');
  assert.equal(afterRewrite.state.messages.at(-1).pinned, true);
  assert.notEqual(afterRewrite.state.messages.at(-1).id, latest);

  const exported = await call(routes, '/api/groupchat.export', { body: { groupId, includeHistory: true } });
  assert.equal(exported.status, 200);
  assert.match(exported.json.markdown, /# 旧城书店的晚上/);
  assert.match(exported.json.markdown, /## 历史版本/);
  assert.match(exported.json.path, /export\/script\.md$/);

  const stopped = await call(routes, '/api/groupchat.stop', { body: { groupId } });
  assert.equal(stopped.status, 200);
  assert.equal(stopped.json.stopped, false);
});

test('smart routing selects a model-chosen target and records route usage', async (t) => {
  const { routes } = await fixture(t, {
    routeText: '{"targets":["林晚"],"reason":"她有钥匙","confidence":0.9}',
    texts: ['我去开门。'],
  });
  const created = await call(routes, '/api/groupchat.group-create', {
    body: {
      name: '智能路由测试',
      members: [
        { name: '林晚', oneLiner: '店主', core: '说话短。' },
        { name: '周野', oneLiner: '电工', core: '嘴硬。' },
      ],
    },
  });
  const groupId = created.json.groupId;
  await call(routes, '/api/groupchat.group-update', {
    body: { groupId, policy: { bystanderChance: 0 } },
  });

  const sent = await call(routes, '/api/groupchat.send', { body: { groupId, text: '今天谁去开门？' } });
  assert.equal(sent.status, 200);
  const events = ndjson(sent.text);
  const route = events.find((event) => event.type === 'route');
  assert.ok(route);
  assert.equal(route.route.method, 'model');
  assert.deepEqual(route.route.targets, [created.json.state.members[0].id]);
  assert.equal(route.route.reason, '她有钥匙');
  assert.equal(route.route.usage.inputTokens, 3);

  const messages = events.filter((event) => event.type === 'message').map((event) => event.message);
  assert.equal(messages.length, 2);
  assert.equal(messages[1].memberId, created.json.state.members[0].id);
  const finalState = events.find((event) => event.type === 'state');
  assert.equal(finalState.state.totals.inputTokens, 13);
  assert.equal(finalState.state.totals.outputTokens, 5);
  assert.deepEqual(finalState.state.lastRoute.targets, [created.json.state.members[0].id]);
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


test('owner settings travel through the route and a custom owner name stops the turn', async (t) => {
  const { routes } = await fixture(t, { texts: ['@阿明 我说完了。', '不该出现'] });
  const created = await call(routes, '/api/groupchat.group-create', {
    body: {
      name: '群主路由测试',
      members: [{ name: '甲', core: '甲' }, { name: '乙', core: '乙' }],
    },
  });
  const groupId = created.json.groupId;
  const owner = {
    name: '阿明',
    oneLiner: '常客',
    setting: '你是每晚都来的客人。',
    avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lP1kAAAAAElFTkSuQmCC',
    relations: { [created.json.state.members[0].id]: '熟人' },
  };
  const updated = await call(routes, '/api/groupchat.group-update', { body: { groupId, owner } });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.json.state.owner, owner);

  const sent = await call(routes, '/api/groupchat.send', { body: { groupId, text: '@甲 你先说' } });
  assert.equal(sent.status, 200);
  const events = ndjson(sent.text);
  const messages = events.filter((event) => event.type === 'message').map((event) => event.message);
  assert.equal(messages.length, 2, 'owner message plus exactly one reply');
  assert.equal(messages[1].mentionsOwner, true);
  const finalState = events.find((event) => event.type === 'state');
  assert.equal(finalState.state.owner.name, '阿明');
  assert.equal(finalState.state.messages[0].memberName, '阿明');

  const exported = await call(routes, '/api/groupchat.export', { body: { groupId } });
  assert.match(exported.json.markdown, /- 角色：阿明/);
  assert.match(exported.json.markdown, /### 第 1 轮 · 阿明/);
});


test('deleting a group requires its exact name and removes its data', async (t) => {
  const { store, routes } = await fixture(t);
  const created = await call(routes, '/api/groupchat.group-create', {
    body: { name: '可删除群', members: [{ name: '甲', core: '' }, { name: '乙', core: '' }] },
  });
  const groupId = created.json.groupId;
  const wrong = await call(routes, '/api/groupchat.group-delete', {
    body: { groupId, confirmName: '错误名字' },
  });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.json.error.code, 'groupchat/confirm-mismatch');
  assert.equal((await store.listGroups()).length, 1);

  const deleted = await call(routes, '/api/groupchat.group-delete', {
    body: { groupId, confirmName: '可删除群' },
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.json, { deleted: true, groupId });
  assert.deepEqual(await store.listGroups(), []);
  const state = await call(routes, '/api/groupchat.state', { method: 'GET' });
  assert.equal(state.status, 200);
  assert.deepEqual(state.json.groups, []);
  assert.equal(state.json.selected, null);
});
