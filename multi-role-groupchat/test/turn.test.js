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
 * @param {{userText: string, texts?: string[], policy?: object, budget?: object, members?: Array<object>}} input - harness inputs.
 * @returns {object} harness.
 */
function harness({ userText, texts = [], policy = {}, budget = {}, members: list = members }) {
  const messages = [];
  const notices = [];
  const events = [];
  const calls = [];
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
    now: () => 1000 + calls.length,
    makeId: (prefix) => `${prefix}_${messages.length}_${calls.length}`,
  };
  return result;
}

test('one mention then two handoffs: three generations, last speaker excluded', async () => {
  const io = harness({ userText: '@林晚 你来', texts: ['先看看。', '我也说一句。', '那我来。'] });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 3);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou', 'c_lin']);
  assert.deepEqual(io.calls.map((call) => call.replyIndex), [1, 2, 3]);
  assert.deepEqual(io.calls.map((call) => call.previousName), ['群主', '林晚', '周野']);
  assert.equal(io.messages.length, 4);
  const replies = io.messages.filter((message) => message.role === 'member');
  assert.deepEqual(replies.map((message) => message.replyIndex), [1, 2, 3]);
  assert.equal(replies[1].replyTo, replies[0].id);
  assert.equal(replies[0].turnId, 'm_user');
});

test('two mentions plus two handoffs reach four generations', async () => {
  const io = harness({ userText: '@林晚 @周野 你们说', texts: ['一', '二', '三', '四', '五'] });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 4);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou', 'c_lin', 'c_zhou']);
});

test('no mention rotates three times under the plan default', async () => {
  const io = harness({ userText: '门怎么锁了？', texts: ['一', '二', '三', '四'] });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 3);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou', 'c_lin']);
});

test('a member mention hands over, and @群主 ends the turn immediately', async () => {
  const io = harness({ userText: '@林晚 你来', texts: ['@周野 你说呢。', '@群主 我等你回答。', '不该出现'] });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 2);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou']);
  assert.equal(io.messages.at(-1).mentionsOwner, true);
  assert.equal(outcome.reason, 'owner');
});

test('unknown @ names keep rotation routing and never throw', async () => {
  const io = harness({ userText: '@无名 在吗？', texts: ['一', '二', '三'] });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 3);
  assert.deepEqual(io.calls.map((call) => call.member.id), ['c_lin', 'c_zhou', 'c_lin']);
  assert.deepEqual(io.messages[0].mentions, []);
});

test('a single-member group generates the mentioned reply and stops', async () => {
  const io = harness({ userText: '@林晚 你说', texts: ['一', '二'], members: [members[0]] });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
  assert.equal(outcome.reason, 'no-speaker');
});

test('budget exhaustion pauses before the next generation and records a notice', async () => {
  const io = harness({
    userText: '门怎么锁了？',
    texts: ['一', '二', '三'],
    budget: { maxOutputTokens: 5 },
  });
  const outcome = await runTurn(io);
  assert.equal(outcome.reason, 'budget');
  assert.equal(io.calls.length, 1);
  assert.equal(io.notices.length, 1);
  assert.match(io.notices[0].text, /预算不足/);
  assert.ok(io.events.some((event) => event.type === 'notice'));
});

test('depth zero lets one rotation happen without any handoff', async () => {
  const io = harness({ userText: '在吗', texts: ['一', '二'], policy: { maxHandoffDepth: 0 } });
  const outcome = await runTurn(io);
  assert.equal(outcome.generated, 1);
});

test('a stopped signal is reported without appending a partial message', async () => {
  const controller = new AbortController();
  const io = harness({ userText: '在吗', texts: ['一'] });
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
