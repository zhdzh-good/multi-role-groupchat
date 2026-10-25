import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BUDGET, DEFAULT_POLICY } from '../lib/protocol.js';
import {
  ROUTER_PROMPT_MARKER,
  buildRouterPrompt,
  directNameTargets,
  explicitRoute,
  isContinuationCue,
  parseRouteResponse,
  resolveRoute,
} from '../lib/router.js';

const members = [
  { id: 'c_lin', name: '林晚', public: { oneLiner: '书店店主' } },
  { id: 'c_zhou', name: '周野', public: { oneLiner: '电工' } },
];

const group = {
  id: 'g_test',
  name: '旧城书店',
  brief: '停电的晚上。',
  policy: { ...DEFAULT_POLICY },
  budget: { ...DEFAULT_BUDGET },
  owner: { name: '阿明', oneLiner: '常客', setting: '秘密：不要告诉别人', relations: {} },
};

/**
 * @param {Array<{role?: string, memberId?: string|null, text?: string}>} rows - conversation rows.
 * @returns {Array<object>} active messages.
 */
function messages(rows) {
  return rows.map((row, index) => ({
    id: `m_${index}`,
    turnId: 't_1',
    ts: index,
    role: row.role ?? (row.memberId === null ? 'user' : 'member'),
    memberId: row.memberId ?? null,
    text: row.text ?? '',
    mentions: [],
    mentionsOwner: false,
    pinned: false,
  }));
}

test('explicit routes cover @, direct names, and plural address', () => {
  assert.deepEqual(explicitRoute('@林晚 你来', members, '阿明').targets, ['c_lin']);
  assert.deepEqual(explicitRoute('林晚，你怎么看？', members, '阿明').targets, ['c_lin']);
  assert.deepEqual(explicitRoute('林晚 你来', members, '阿明').targets, ['c_lin']);
  assert.deepEqual(explicitRoute('你们俩说说', members, '阿明').targets, ['c_lin', 'c_zhou']);
  assert.deepEqual(explicitRoute('大家早', members, '阿明').targets, ['c_lin', 'c_zhou']);
});

test('third-person name mentions are not treated as direct address', () => {
  assert.deepEqual(directNameTargets('林晚刚才说得对。', members), []);
  assert.deepEqual(directNameTargets('我觉得林晚，你说得对', members), ['c_lin']);
  assert.deepEqual(directNameTargets('林晚呢？', members), ['c_lin']);
  assert.deepEqual(directNameTargets('我想听听你的意见，林晚', members), ['c_lin']);
});

test('a second-person message replies to the most recent member speaker', async () => {
  const active = messages([
    { memberId: null, text: '门怎么锁了？' },
    { memberId: 'c_zhou', text: '后门我锁的。' },
    { memberId: null, text: '你觉得呢？' },
  ]);
  const route = await resolveRoute({
    group,
    members,
    activeMessages: active,
    userText: '你觉得呢？',
    classifier: async () => {
      throw new Error('classifier must not be called');
    },
  });
  assert.equal(route.method, 'pronoun');
  assert.deepEqual(route.targets, ['c_zhou']);
});

test('short continuations go back to the last speaker without a classifier call', async () => {
  assert.equal(isContinuationCue('嗯'), true);
  assert.equal(isContinuationCue('然后呢？'), true);
  assert.equal(isContinuationCue('今天谁去开门？'), false);
  const active = messages([
    { memberId: null, text: '门怎么锁了？' },
    { memberId: 'c_lin', text: '后门我锁的。' },
    { memberId: null, text: '继续' },
  ]);
  const route = await resolveRoute({
    group,
    members,
    activeMessages: active,
    userText: '继续',
    classifier: async () => {
      throw new Error('classifier must not be called');
    },
  });
  assert.equal(route.method, 'continuation');
  assert.deepEqual(route.targets, ['c_lin']);
});

test('a message addressed only to the owner produces no member targets', async () => {
  const active = messages([
    { memberId: 'c_lin', text: '我先说。' },
    { memberId: null, text: '@阿明 我等你' },
  ]);
  const route = await resolveRoute({ group, members, activeMessages: active, userText: '@阿明 我等你' });
  assert.equal(route.method, 'owner');
  assert.deepEqual(route.targets, []);
});

test('the classifier is used only when local routing cannot decide', async () => {
  let calls = 0;
  const classifier = async () => {
    calls += 1;
    return {
      targets: ['c_zhou'],
      reason: '电工更合适',
      confidence: 0.7,
      usage: { inputTokens: 5, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    };
  };
  const active = messages([{ memberId: null, text: '谁去看看电闸？' }]);
  const route = await resolveRoute({
    group,
    members,
    activeMessages: active,
    userText: '谁去看看电闸？',
    classifier,
  });
  assert.equal(calls, 1);
  assert.equal(route.method, 'model');
  assert.deepEqual(route.targets, ['c_zhou']);
  assert.equal(route.usage.inputTokens, 5);
});

test('a classifier failure falls back to the least recent member', async () => {
  const active = messages([
    { memberId: 'c_zhou', text: '我刚说过了。' },
    { memberId: 'c_lin', text: '我也说过了。' },
    { memberId: null, text: '谁去开门？' },
  ]);
  const route = await resolveRoute({
    group,
    members,
    activeMessages: active,
    userText: '谁去开门？',
    classifier: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(route.method, 'fallback');
  assert.deepEqual(route.targets, ['c_zhou']);
});

test('parseRouteResponse accepts fenced JSON, names, and caps the list', () => {
  const parsed = parseRouteResponse(
    '```json\n{"targets":["林晚","c_zhou","林晚"],"reason":"ok","confidence":1.8}\n```',
    members,
    1,
  );
  assert.deepEqual(parsed.targets, ['c_lin']);
  assert.equal(parsed.confidence, 1);
  assert.equal(parsed.reason, 'ok');
  assert.equal(parseRouteResponse('not json', members), null);
  assert.deepEqual(parseRouteResponse('{"targets":[]}', members).targets, []);
});

test('the router prompt lists public profiles and excludes secret core settings', () => {
  const withSecrets = members.map((member) => ({
    ...member,
    core: `${member.name}的秘密：不要告诉别人`,
  }));
  const prompt = buildRouterPrompt({
    group,
    members: withSecrets,
    activeMessages: messages([
      { memberId: null, text: '谁去开门？' },
      { memberId: 'c_lin', text: '我不知道。' },
    ]),
    userText: '谁去开门？',
  });
  assert.match(prompt.system, new RegExp(ROUTER_PROMPT_MARKER));
  assert.match(prompt.system, /id=c_lin/);
  assert.match(prompt.system, /书店店主/);
  assert.doesNotMatch(prompt.system, /秘密：不要告诉别人/);
  assert.match(prompt.messages[0].content[0].text, /用户最新消息/);
  assert.equal(prompt.maxTargets, 2);
});
