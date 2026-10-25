import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BUDGET, DEFAULT_POLICY } from '../lib/protocol.js';
import { runTurn } from '../lib/turn.js';

const members = [
  { id: 'c_lin', name: '林晚', public: { oneLiner: '', relations: {} }, core: '', extended: '', extendedEnabled: false, model: null },
  { id: 'c_zhou', name: '周野', public: { oneLiner: '', relations: {} }, core: '', extended: '', extendedEnabled: false, model: null },
];

/**
 * Minimal in-memory harness matching the store's injected seams.
 * @param {{userText: string, texts?: string[], policy?: object, budget?: object, members?: Array<object>, route?: Function, random?: Function, routeUsage?: object|null}} input - harness inputs.
 * @returns {object} harness.
 */
function harness({
  userText,
  texts = [],
  policy = {},
  budget = {},
  members: list = members,
  route,
  random = () => 1,
  routeUsage = null,
}) {
  const messages = [];
  const notices = [];
  const events = [];
  const calls = [];
  const routeCalls = [];
  const routes = [];
  const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const group = {
    id: 'g_test',
    name: '测试群',
    brief: '',
    memberIds: list.map((member) => member.id),
    policy: { ...DEFAULT_POLICY, ...policy },
    model: null,
    budget: { ...DEFAULT_BUDGET, ...budget },
  };
  const result = {
    group,
    members: list,
    messages,
    notices,
    events,
    calls,
    routeCalls,
    routes,
    getActive: () => messages,
    appendMessage: async (message) => {
      message.seq = messages.length;
      messages.push(message);
      if (message.usage !== null && message.usage !== undefined) {
        totals.inputTokens += message.usage.inputTokens;
        totals.outputTokens += message.usage.outputTokens;
        totals.cacheReadTokens += message.usage.cacheReadTokens;
        totals.cacheWriteTokens += message.usage.cacheWriteTokens;
      }
    },
    appendRoute: async (record) => {
      routes.push(record);
      const usage = record.usage ?? routeUsage;
      if (usage !== null && usage !== undefined) {
        totals.inputTokens += usage.inputTokens ?? 0;
        totals.outputTokens += usage.outputTokens ?? 0;
        totals.cacheReadTokens += usage.cacheReadTokens ?? 0;
        totals.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
      }
    },
    appendNotice: (text, level = 'info') => {
      const notice = { id: `n_${notices.length}`, ts: 0, text, level };
      notices.push(notice);
      return notice;
    },
    getTotals: () => totals,
    generate: async (request) => {
      calls.push({ ...request, signal: undefined });
      return {
        text: texts.shift() ?? '……',
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
      };
    },
    emit: (event) => events.push(event),
    signal: new AbortController().signal,
    userText,
    turnId: 'm_user',
    now: () => 1000 + messages.length,
    makeId: (prefix) => `${prefix}_${messages.length}_${calls.length}`,
    random,
  };
  if (typeof route === 'function') {
    result.route = async (request) => {
      const call = { ...request, signal: undefined };
      routeCalls.push(call);
      return route(call);
    };
  }
  return result;
}

test('an explicit @ target answers once and no bystander is forced', async () => {
  const io = harness({
    userText: '@林晚 你来',
    texts: ['先看看。'],
    policy: { bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.equal(outcome.reason, 'settled');
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin']);
  assert.deepEqual(io.calls.map((call) => call.routeRole), ['addressed']);
  assert.equal(io.messages.length, 2);
  assert.equal(io.routes[0].method, 'explicit');
  assert.deepEqual(io.routes[0].targets, ['c_lin']);
  assert.deepEqual(io.routes[0].bystanders, []);
});

test('two explicit targets both answer and stop after their replies', async () => {
  const io = harness({
    userText: '@林晚 @周野 你们说',
    texts: ['一', '二'],
    policy: { bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 2);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou']);
});

test('the classifier chooses an addressee when the message has no @ or name', async () => {
  const io = harness({
    userText: '今天谁去开门？',
    texts: ['我去吧。'],
    route: async () => ({
      targets: ['c_lin'],
      reason: '林晚有钥匙',
      confidence: 0.82,
      usage: { inputTokens: 7, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }),
    policy: { bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(io.routeCalls.length, 1);
  assert.equal(outcome.generated, 1);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin']);
  assert.equal(io.routes[0].method, 'model');
  assert.equal(io.routes[0].reason, '林晚有钥匙');
  assert.equal(io.routes[0].confidence, 0.82);
  assert.equal(io.routes[0].usage.inputTokens, 7);
  assert.deepEqual(io.getTotals(), {
    inputTokens: 17,
    outputTokens: 7,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
});

test('bystander chance 100 makes every remaining member chime in once', async () => {
  const io = harness({
    userText: '@林晚 你怎么看',
    texts: ['我先说。', '我也说一句。'],
    policy: { bystanderChance: 100 },
    random: () => 0,
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 2);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou']);
  assert.deepEqual(io.calls.map((call) => call.routeRole), ['addressed', 'bystander']);
});

test('bystander chance 0 leaves the other members silent', async () => {
  const io = harness({
    userText: '@林晚 只有你',
    texts: ['好。', '不该出现'],
    policy: { bystanderChance: 0 },
    random: () => 0,
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin']);
});

test('bystander sampling is per member and uses the injected random source', async () => {
  const three = [
    members[0],
    members[1],
    { id: 'c_chen', name: '陈默', public: { oneLiner: '', relations: {} }, core: '', extended: '', extendedEnabled: false, model: null },
  ];
  const rolls = [0.1, 0.9];
  const io = harness({
    userText: '@林晚 在吗',
    texts: ['一', '二'],
    members: three,
    policy: { bystanderChance: 50 },
    random: () => rolls.shift() ?? 1,
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 2);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou']);
  assert.deepEqual(io.routes[0].bystanders, ['c_zhou']);
});

test('a member handoff continues explicitly, and @角色名 ends the turn', async () => {
  const io = harness({
    userText: '@林晚 你来',
    texts: ['@周野 你说呢。', '@群主 我等你回答。', '不该出现'],
    policy: { bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 2);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou']);
  assert.deepEqual(io.calls.map((call) => call.routeRole), ['addressed', 'handoff']);
  assert.equal(io.messages.at(-1).mentionsOwner, true);
  assert.equal(outcome.reason, 'owner');
});

test('a custom owner name is a valid handoff target', async () => {
  const io = harness({
    userText: '@林晚 你先说',
    texts: ['@阿明 我说完了。', '不该出现'],
    policy: { bystanderChance: 0 },
  });
  io.group.owner = { name: '阿明', oneLiner: '常客', setting: '', avatar: null, relations: {} };
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.equal(outcome.reason, 'owner');
  assert.equal(io.messages.at(-1).mentionsOwner, true);
});

test('a message addressed only to the owner gets no AI reply', async () => {
  const io = harness({ userText: '@用户 我先歇一下', texts: ['不该出现'] });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 0);
  assert.equal(outcome.reason, 'owner');
  assert.equal(io.messages.length, 1);
});

test('unknown @ names fall back to one local speaker and never throw', async () => {
  const io = harness({ userText: '@无名 在吗？', texts: ['一'], policy: { bystanderChance: 0 } });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin']);
  assert.deepEqual(io.messages[0].mentions, []);
  assert.equal(io.routes[0].method, 'fallback');
});

test('a classifier failure falls back locally without stopping the turn', async () => {
  const io = harness({
    userText: '今天谁去开门？',
    texts: ['我去。'],
    route: async () => {
      throw new Error('router unavailable');
    },
    policy: { bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.equal(io.routes[0].method, 'fallback');
  assert.equal(io.routes[0].usage, null);
});

test('an empty or invalid classifier result still accounts for its usage', async () => {
  const io = harness({
    userText: '今天谁去开门？',
    texts: ['我去。'],
    route: async () => ({
      targets: [],
      reason: 'router-invalid-json',
      usage: { inputTokens: 9, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }),
    policy: { bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.equal(io.routes[0].method, 'fallback');
  assert.equal(io.routes[0].usage.inputTokens, 9);
  assert.equal(io.getTotals().inputTokens, 19);
});

test('a single-member group generates the routed reply and stops', async () => {
  const io = harness({
    userText: '@林晚 你说',
    texts: ['一', '二'],
    members: [members[0]],
    policy: { bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.equal(outcome.reason, 'settled');
});

test('depth zero prevents even an explicit handoff', async () => {
  const io = harness({
    userText: '@林晚 你来',
    texts: ['@周野 你说呢。', '不该出现'],
    policy: { maxHandoffDepth: 0, bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.equal(outcome.reason, 'cap');
});

test('budget exhaustion pauses before the next generation and records a notice', async () => {
  const io = harness({
    userText: '@林晚 你来',
    texts: ['一', '二', '三'],
    budget: { maxOutputTokens: 5 },
    policy: { bystanderChance: 0 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.reason, 'budget');
  assert.equal(io.calls.length, 1);
  assert.equal(io.notices.length, 1);
  assert.match(io.notices[0].text, /预算不足/);
  assert.ok(io.events.some((event) => event.type === 'notice'));
});

test('a stopped signal is reported without appending a partial message', async () => {
  const controller = new AbortController();
  const io = harness({ userText: '@林晚 在吗', texts: ['一'], policy: { bystanderChance: 0 } });
  io.signal = controller.signal;
  io.generate = async () => {
    controller.abort();
    const error = new Error('已停止。');
    error.name = 'AbortError';
    throw error;
  };
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 0);
  assert.equal(io.messages.length, 1);
  assert.ok(io.events.some((event) => event.type === 'stopped'));
});
