import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_BUDGET,
  DEFAULT_POLICY,
  buildPrompt,
  formatTranscript,
  generationCap,
  selectHistory,
} from '../lib/protocol.js';
import { registerRoutes } from '../lib/routes.js';
import { GroupStore, makeId } from '../lib/store.js';
import { runTurn } from '../lib/turn.js';

/**
 * Deterministic 32-bit PRNG for reproducible stress runs.
 * @param {number} seed - seed.
 * @returns {() => number} values in [0, 1).
 */
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} ms - delay.
 * @returns {Promise<void>} completion.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll until a condition holds.
 * @param {() => boolean} condition - predicate.
 * @param {number} [timeoutMs] - budget.
 * @returns {Promise<void>} completion.
 */
async function waitFor(condition, timeoutMs = 2000) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('waitFor timed out');
    await sleep(5);
  }
}

/**
 * Create an isolated store and three members.
 * @param {object} t - test context.
 * @param {object} [policy] - policy overrides.
 * @param {object} [budget] - budget overrides.
 * @returns {Promise<object>} fixture.
 */
async function fixture(t, policy = {}, budget = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupchat-stability-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const store = new GroupStore(root);
  await store.init();
  const live = await store.createGroup({
    name: '稳定性测试群',
    brief: '用来压测接话、重放与预算。',
    members: [
      { name: '甲', oneLiner: '说话短', core: '身份：甲。秘密：不主动说。' },
      { name: '乙', oneLiner: '爱追问', core: '身份：乙。秘密：怕冷。' },
      { name: '丙', oneLiner: '负责总结', core: '身份：丙。秘密：记性很好。' },
    ],
  });
  await store.updateGroup(live.gid, {
    policy: { ...DEFAULT_POLICY, maxHistory: 12, maxPinned: 5, ...policy },
    budget: { ...DEFAULT_BUDGET, maxInputTokens: 1_000_000, maxOutputTokens: 1_000_000, ...budget },
  });
  return { store, live: await store.load(live.gid), root };
}

/**
 * Sum usage from every message (including superseded versions).
 * @param {Array<object>} messages - all messages.
 * @returns {object} totals.
 */
function usageSum(messages) {
  const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  for (const message of messages) {
    if (message.usage === null || message.usage === undefined) continue;
    totals.inputTokens += message.usage.inputTokens;
    totals.outputTokens += message.usage.outputTokens;
    totals.cacheReadTokens += message.usage.cacheReadTokens;
    totals.cacheWriteTokens += message.usage.cacheWriteTokens;
  }
  return totals;
}

/**
 * Assert the invariants every turn must preserve.
 * @param {object} live - loaded group.
 * @param {string} gid - group id.
 * @param {number} expectedCap - generation cap for the turn.
 * @param {number} generated - actual generations.
 * @returns {void}
 */
function assertTurnInvariants(live, gid, expectedCap, generated) {
  assert.ok(generated <= expectedCap, `generated ${generated} exceeds cap ${expectedCap}`);
  const ids = new Set();
  for (const message of live.state.messages) {
    assert.ok(!ids.has(message.id), `duplicate message id ${message.id}`);
    ids.add(message.id);
    assert.ok(message.text.length > 0, 'messages are never empty');
    for (const memberId of message.mentions) {
      assert.ok(live.members.some((member) => member.id === memberId), `unknown mention ${memberId}`);
    }
  }
  const activeIds = new Set(live.state.active.map((message) => message.id));
  assert.equal(activeIds.size, live.state.active.length, 'active view holds each message once');
  const pinned = live.state.active.filter((message) => message.pinned);
  assert.ok(pinned.length <= live.group.policy.maxPinned, 'pin ceiling holds');
  const selection = selectHistory(live.state.active, live.group.policy);
  assert.equal(selection.folded.length + selection.window.length + selection.pinned.length, live.state.active.length);
  // Owner mentions no longer force the turn to end before already-planned
  // bystanders or an explicit member handoff in the same message. The turn
  // engine's own tests pin that behavior; here we only keep the structural
  // invariants below.
  const byTurn = new Map();
  for (const message of live.state.active) {
    if (message.role !== 'member') continue;
    const replies = byTurn.get(message.turnId) ?? [];
    replies.push(message);
    byTurn.set(message.turnId, replies);
  }
  for (const [turnId, replies] of byTurn) {
    assert.deepEqual(
      replies.map((message) => message.replyIndex),
      replies.map((_, index) => index + 1),
      'replyIndex is dense and 1-based inside a turn',
    );
    const user = live.state.active.find((message) => message.turnId === turnId && message.role === 'user');
    assert.ok(user !== undefined, 'every reply belongs to a turn with an owner message');
    replies.forEach((message, index) => {
      const replied = live.state.byId.get(message.replyTo);
      assert.ok(replied !== undefined, 'replyTo points at a stored message');
      assert.equal(replied.turnId, turnId, 'replyTo stays inside the turn');
      assert.ok(replied.seq < message.seq, 'replyTo points backwards');
      if (index === 0) assert.equal(message.replyTo, user.id, 'the first reply answers the owner');
      if (index > 0) {
        assert.notEqual(message.memberId, replies[index - 1].memberId, 'the same member never speaks twice in a row');
      }
    });
  }
  const totals = usageSum(live.state.messages);
  assert.deepEqual(live.state.totals, totals, 'totals equal every stored usage record');
  assert.ok(live.gid === gid);
}

const STRESS_TURNS = Number(process.env.GROUPCHAT_STRESS_TURNS ?? 80);
const STRESS_SEED = Number(process.env.GROUPCHAT_STRESS_SEED ?? 20251025);
const STRESS_DEPTH = Number(process.env.GROUPCHAT_STRESS_DEPTH ?? 2);
const STRESS_MENTIONS = Number(process.env.GROUPCHAT_STRESS_MENTIONS ?? 2);

test(`randomized ${STRESS_TURNS}-turn conversation keeps log, view, pins, and totals consistent`, async (t) => {
  const { store, live } = await fixture(t, {
    maxMentionReplies: STRESS_MENTIONS,
    maxHandoffDepth: STRESS_DEPTH,
    maxHistory: 12,
  });
  const random = rng(STRESS_SEED);
  const events = [];
  let idCounter = 0;
  let clock = 1_700_000_000;
  let turns = 0;
  let totalGenerated = 0;
  let errors = 0;
  let emptyReplies = 0;

  const generate = async ({ member, signal }) => {
    signal.throwIfAborted();
    const roll = random();
    if (roll < 0.025) {
      errors += 1;
      throw new Error('模拟 provider 失败');
    }
    if (roll < 0.05) {
      emptyReplies += 1;
      return { text: '   ', usage: null };
    }
    const others = live.members.filter((candidate) => candidate.id !== member.id);
    let text = `第 ${turns} 轮，我是${member.name}。`;
    const target = random();
    if (target < 0.28) {
      text += ` @${others[Math.floor(random() * others.length)].name} 你怎么看？`;
    } else if (target < 0.38) {
      text += ' @群主 我等你回答。';
    } else if (target < 0.46) {
      text += ` @${member.name} 自言自语一句。`;
    } else if (target < 0.52) {
      text += ' @不存在的人 在吗？';
    } else if (target < 0.6) {
      text += ` ${'长'.repeat(Math.floor(random() * 240))}`;
    }
    return {
      text,
      usage: {
        inputTokens: 40 + Math.floor(random() * 40),
        outputTokens: 10 + Math.floor(random() * 40),
        cacheReadTokens: random() < 0.5 ? 20 : 0,
        cacheWriteTokens: 0,
      },
    };
  };

  for (let index = 0; index < STRESS_TURNS; index += 1) {
    turns += 1;
    const roll = random();
    let userText;
    if (roll < 0.34) {
      userText = `第 ${index} 条：你们在吗？`;
    } else if (roll < 0.62) {
      userText = `@${live.members[Math.floor(random() * live.members.length)].name} 说说第 ${index} 件事。`;
    } else if (roll < 0.82) {
      const a = live.members[Math.floor(random() * live.members.length)].name;
      const b = live.members[Math.floor(random() * live.members.length)].name;
      userText = `@${a} @${b} 你们俩聊聊第 ${index} 件事。`;
    } else if (roll < 0.9) {
      userText = `@群主 第 ${index} 条只是叫一下群主。`;
    } else {
      userText = `@路人 第 ${index} 条 @${live.members[0].name} 混着未知名字。`;
    }
    const turnId = `u_${index}`;
    const beforeActive = live.state.active.length;
    const outcome = await runTurn({
      group: live.group,
      members: live.members,
      getActive: () => live.state.active,
      appendMessage: (message) => store.appendMessage(live.gid, message),
      appendNotice: (text, level) => store.appendNotice(live.gid, text, level),
      getTotals: () => live.state.totals,
      generate,
      random,
      emit: (event) => events.push(event),
      signal: new AbortController().signal,
      userText,
      turnId,
      now: () => {
        clock += 1;
        return clock;
      },
      makeId: (prefix) => `${prefix}_stress_${++idCounter}`,
    });
    totalGenerated += outcome.generated;
    const cap = generationCap(live.members.length, live.group.policy);
    assertTurnInvariants(live, live.gid, cap, outcome.generated);
    assert.ok(live.state.active.length >= beforeActive + 1, 'the owner message is always appended');
    assert.equal(live.state.active.some((message) => message.id === turnId), true);

    if (random() < 0.3 && live.state.active.length > 0) {
      const target = live.state.active[Math.floor(random() * live.state.active.length)];
      const next = !target.pinned;
      const pinnedCount = live.state.active.filter((message) => message.pinned).length;
      if (!next || pinnedCount < live.group.policy.maxPinned) {
        await store.setPin(live.gid, target.id, next);
      }
    }

    if ((index + 1) % 10 === 0) {
      await sleep(15);
      const disk = new GroupStore(live.dir.split('/groups/')[0]);
      const replayed = await disk.stateView(live.gid);
      assert.deepEqual(
        replayed.messages.map((message) => ({
          id: message.id,
          text: message.text,
          pinned: message.pinned,
          mentions: message.mentions,
          mentionsOwner: message.mentionsOwner,
          status: message.status,
        })),
        live.state.active.map((message) => ({
          id: message.id,
          text: message.text,
          pinned: message.pinned,
          mentions: message.mentions,
          mentionsOwner: message.mentionsOwner,
          status: message.status,
        })),
        `restart replay matches live view after turn ${index + 1}`,
      );
      assert.deepEqual(replayed.totals, live.state.totals);
    }
  }

  assert.ok(errors > 0, 'the stress run exercised provider failures');
  assert.ok(emptyReplies > 0, 'the stress run exercised empty replies');
  assert.ok(totalGenerated > 0);
  await sleep(30);

  const raw = await readFile(path.join(live.dir, 'events.jsonl'), 'utf8');
  assert.ok(raw.endsWith('\n'));
  const lines = raw.trim().split('\n');
  for (const line of lines) JSON.parse(line);
  const storedEvents = lines.map((line) => JSON.parse(line));
  const messageEvents = storedEvents.filter((event) => event.type === 'message');
  assert.equal(messageEvents.length, live.state.messages.length);
  const ids = new Set(messageEvents.map((event) => event.id));
  assert.equal(ids.size, messageEvents.length, 'JSONL never repeats a message id');

  const finalReplay = new GroupStore(live.dir.split('/groups/')[0]);
  const replayed = await finalReplay.stateView(live.gid);
  assert.equal(replayed.messages.length, live.state.active.length);
  assert.deepEqual(replayed.totals, live.state.totals);
  const folded = selectHistory(live.state.active, live.group.policy);
  assert.equal(replayed.foldedCount, folded.folded.length);
  t.diagnostic(
    `stress seed=${STRESS_SEED} depth=${STRESS_DEPTH} mentions=${STRESS_MENTIONS}: `
    + `turns=${turns} messages=${live.state.messages.length} generated=${totalGenerated} `
    + `errors=${errors} empty=${emptyReplies} active=${live.state.active.length} folded=${folded.folded.length}`,
  );
});

test('aborted generation leaves no partial message and produces a stopped event', async (t) => {
  const { store, live } = await fixture(t);
  const controller = new AbortController();
  const events = [];
  const task = runTurn({
    group: live.group,
    members: live.members,
    getActive: () => live.state.active,
    appendMessage: (message) => store.appendMessage(live.gid, message),
    appendNotice: (text, level) => store.appendNotice(live.gid, text, level),
    getTotals: () => live.state.totals,
    generate: ({ signal }) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ text: '迟到的回复', usage: null }), 200);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            const error = new Error('已停止。');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      }),
    emit: (event) => events.push(event),
    signal: controller.signal,
    userText: '@甲 你来一下',
    turnId: 'u_abort',
    now: () => 1,
    makeId: (prefix) => `${prefix}_abort_1`,
  });
  await sleep(10);
  controller.abort();
  const outcome = await task;
  assert.equal(outcome.generated, 0);
  assert.equal(live.state.messages.length, 1);
  assert.equal(live.state.messages[0].role, 'user');
  assert.equal(live.state.active.length, 1);
  assert.ok(events.some((event) => event.type === 'stopped'));
  assert.equal(events.some((event) => event.type === 'message' && event.message.role === 'member'), false);
});

test('budget ceiling pauses before the next generation and blocks later turns', async (t) => {
  const { store, live } = await fixture(t, {}, { maxOutputTokens: 100, maxInputTokens: 1_000_000 });
  const generate = async () => ({
    text: '这条回复会消耗预算。',
    usage: { inputTokens: 10, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
  });
  const first = await runTurn({
    group: live.group,
    members: live.members,
    getActive: () => live.state.active,
    appendMessage: (message) => store.appendMessage(live.gid, message),
    appendNotice: (text, level) => store.appendNotice(live.gid, text, level),
    getTotals: () => live.state.totals,
    generate,
    emit: () => {},
    signal: new AbortController().signal,
    userText: '你们聊',
    turnId: 'u_budget_1',
    now: () => 10,
    makeId: (prefix) => `${prefix}_budget_1`,
  });
  assert.equal(first.reason, 'budget');
  assert.equal(first.generated, 1);
  assert.equal(live.state.totals.outputTokens, 100);
  assert.ok(live.state.notices.some((notice) => /预算不足/.test(notice.text)));

  const second = await runTurn({
    group: live.group,
    members: live.members,
    getActive: () => live.state.active,
    appendMessage: (message) => store.appendMessage(live.gid, message),
    appendNotice: (text, level) => store.appendNotice(live.gid, text, level),
    getTotals: () => live.state.totals,
    generate,
    emit: () => {},
    signal: new AbortController().signal,
    userText: '继续',
    turnId: 'u_budget_2',
    now: () => 20,
    makeId: (prefix) => `${prefix}_budget_2`,
  });
  assert.equal(second.reason, 'budget');
  assert.equal(second.generated, 0);
  await sleep(40);
  const replayed = await new GroupStore(live.dir.split('/groups/')[0]).stateView(live.gid);
  assert.ok(replayed.notices.length >= 2);
  assert.equal(replayed.totals.outputTokens, 100);
});

test('prompt prefix is cache-stable across a growing conversation and bounded after folding', () => {
  const group = {
    name: '缓存测试',
    brief: '稳定前缀。',
    policy: { ...DEFAULT_POLICY, maxHistory: 500, maxPinned: 10, maxReplyChars: 300 },
    model: null,
    budget: { ...DEFAULT_BUDGET },
  };
  const members = [
    {
      id: 'c_a',
      name: '甲',
      core: '甲的核心。',
      extended: '',
      extendedEnabled: false,
      public: { oneLiner: '甲的一句话', relations: { c_b: '旧识' } },
    },
    {
      id: 'c_b',
      name: '乙',
      core: '乙的核心。',
      extended: '',
      extendedEnabled: false,
      public: { oneLiner: '乙的一句话', relations: {} },
    },
  ];
  const messages = [];
  let tick = 1;
  const systems = new Set();
  let previousHistory = [];
  for (let turn = 0; turn < 20; turn += 1) {
    messages.push({
      id: `m_${tick}`,
      turnId: `t_${turn}`,
      replyIndex: 0,
      ts: tick,
      role: 'user',
      memberId: null,
      text: `问题 ${turn}`,
      mentions: [],
      mentionsOwner: false,
      pinned: false,
      usage: null,
    });
    tick += 1;
    messages.push({
      id: `m_${tick}`,
      turnId: `t_${turn}`,
      replyIndex: 1,
      ts: tick,
      role: 'member',
      memberId: 'c_a',
      text: `回答 ${turn}`,
      mentions: [],
      mentionsOwner: false,
      pinned: false,
      usage: null,
    });
    tick += 1;
    const prompt = buildPrompt({
      group,
      members,
      activeMessages: messages,
      member: members[1],
      sourceUserText: `问题 ${turn}`,
      replyIndex: 1,
      previousName: '甲',
    });
    const history = prompt.messages.slice(0, -1).map((message) => message.content[0].text);
    systems.add(prompt.system);
    assert.deepEqual(history.slice(0, previousHistory.length), previousHistory);
    previousHistory = history;
  }
  assert.equal(systems.size, 1, 'system prefix is byte-identical across 20 turns');
  const system = [...systems][0];
  assert.doesNotMatch(system, /\d{4}-\d{2}-\d{2}|第\s*\d+\s*轮|m_\d+/);

  const folded = buildPrompt({
    group: { ...group, policy: { ...group.policy, maxHistory: 10 } },
    members,
    activeMessages: messages,
    member: members[1],
    sourceUserText: '问题 19',
    replyIndex: 1,
    previousName: '甲',
  });
  assert.equal(folded.messages.length, 10 + 1);
  assert.equal(folded.folded.length, messages.length - 10);
});

test('repeated rewrites keep one effective message, preserve pins, and stay out of prompts', async (t) => {
  const { store, live } = await fixture(t);
  const texts = ['第一版', '第二版', '第三版', '第四版', '第五版', '第六版'];
  let cursor = 0;
  const gid = live.gid;

  /**
   * @param {object} message - replacement message.
   * @param {object|null} target - superseded message.
   * @returns {Promise<object>} appended replacement.
   */
  const rewriteOnce = async (target) => {
    const replacement = {
      id: makeId('m'),
      turnId: target.turnId,
      replyIndex: target.replyIndex,
      ts: Math.floor(Date.now() / 1000),
      role: 'member',
      memberId: target.memberId,
      text: texts[cursor] ?? '更多版本',
      mentions: [],
      mentionsOwner: false,
      replyTo: target.replyTo,
      supersedes: target.id,
      usage: { inputTokens: 5, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
    };
    cursor += 1;
    await store.appendMessage(gid, replacement);
    await store.appendSupersede(gid, target.id, replacement.id);
    const current = store.groups.get(gid)?.state.byId.get(target.id);
    if (current?.pinned === true) await store.setPin(gid, replacement.id, true);
    return replacement;
  };

  await store.appendMessage(gid, {
    id: 'u_rewrite',
    turnId: 'u_rewrite',
    replyIndex: 0,
    ts: 1,
    role: 'user',
    memberId: null,
    text: '重写测试',
    mentions: [],
    mentionsOwner: false,
    replyTo: null,
  });
  await store.appendMessage(gid, {
    id: 'm_rewrite_0',
    turnId: 'u_rewrite',
    replyIndex: 1,
    ts: 2,
    role: 'member',
    memberId: live.members[0].id,
    text: '原始版本',
    mentions: [],
    mentionsOwner: false,
    replyTo: 'u_rewrite',
    usage: { inputTokens: 5, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
  });
  await store.setPin(gid, 'm_rewrite_0', true);

  let latest = await store.load(gid);
  const original = latest.state.byId.get('m_rewrite_0');
  let target = original;
  for (let index = 0; index < 5; index += 1) {
    target = await rewriteOnce(target);
    latest = await store.load(gid);
    assert.equal(latest.state.active.length, 2, 'one user message and one effective reply');
    assert.equal(latest.state.active.at(-1).id, target.id);
    assert.equal(latest.state.active.at(-1).pinned, true, 'pin survives a rewrite');
    assert.equal(latest.state.active.at(-1).text, texts[cursor - 1]);
    const prompt = buildPrompt({
      group: latest.group,
      members: latest.members,
      activeMessages: latest.state.active,
      member: latest.members[0],
      sourceUserText: '重写测试',
      replyIndex: 1,
      previousName: '群主',
    });
    for (let version = 0; version < cursor - 1; version += 1) {
      if (texts[version] === undefined) continue;
      assert.doesNotMatch(JSON.stringify(prompt.messages), new RegExp(texts[version]));
    }
  }
  assert.equal(latest.state.messages.length, 7);
  assert.equal(latest.state.active.length, 2);
  assert.equal(latest.state.messages.filter((message) => message.status === 'superseded').length, 5);
  const exported = await store.writeExport(gid, formatTranscript({
    group: latest.group,
    members: latest.members,
    state: latest.state,
    includeHistory: true,
  }));
  const markdown = await readFile(exported, 'utf8');
  assert.match(markdown, /## 历史版本/);
  assert.match(markdown, /原始版本/);
  for (const text of texts.slice(0, cursor - 1)) assert.ok(markdown.includes(text));
  assert.equal(markdown.match(/## 历史版本/g)?.length, 1);
});

test('route-level concurrency: one active turn, concurrent pin, stop, and a clean next send', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupchat-concurrency-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const store = new GroupStore(root);
  await store.init();
  const config = { slow: true };
  const routes = new Map();
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
      async *stream(options) {
        if (options.system?.includes('群聊路由器')) {
          yield { type: 'text-delta', text: '{"targets":[],"reason":"","confidence":0}' };
          yield { type: 'usage', usage: { inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
          yield { type: 'finish', reason: { kind: 'stop' } };
          return;
        }
        yield { type: 'text-delta', text: '部分' };
        if (config.slow) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 5000);
            options.signal?.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
              },
              { once: true },
            );
          });
        }
        yield { type: 'text-delta', text: '完整' };
        yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 0 } };
        yield { type: 'finish', reason: { kind: 'stop' } };
      },
    },
  };
  registerRoutes(ctx, store);
  const request = (routePath, body) =>
    routes.get(routePath).fetch(new Request(`http://127.0.0.1:3080${routePath}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }));

  const created = await (await request('/api/groupchat.group-create', {
    name: '并发测试',
    members: [{ name: '甲', core: '甲' }, { name: '乙', core: '乙' }],
  })).json();
  const gid = created.groupId;

  const first = await request('/api/groupchat.send', { groupId: gid, text: '@甲 你们好' });
  await waitFor(() => store.turns.size === 1);
  const second = await request('/api/groupchat.send', { groupId: gid, text: '插队' });
  assert.equal(second.status, 409);
  const busy = await second.json();
  assert.equal(busy.error.code, 'groupchat/busy');

  await waitFor(() => (store.groups.get(gid)?.state.active.length ?? 0) >= 1);
  const userMessage = store.groups.get(gid).state.active[0];
  const pin = await request('/api/groupchat.pin', { groupId: gid, messageId: userMessage.id, pinned: true });
  assert.equal(pin.status, 200);
  assert.equal((await pin.json()).state.pinnedCount, 1);

  const stop = await request('/api/groupchat.stop', { groupId: gid });
  assert.equal(stop.status, 200);
  assert.equal((await stop.json()).stopped, true);
  const firstText = await first.text();
  const firstEvents = firstText.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(firstEvents.some((event) => event.type === 'message' && event.message.role === 'member'), false);
  assert.ok(firstEvents.some((event) => event.type === 'stopped'));
  await waitFor(() => store.turns.size === 0);
  const afterStop = await store.stateView(gid);
  assert.equal(afterStop.messages.filter((message) => message.role === 'member').length, 0);
  assert.equal(afterStop.messages[0].pinned, true);

  config.slow = false;
  const third = await request('/api/groupchat.send', { groupId: gid, text: '重新开始' });
  assert.equal(third.status, 200);
  const thirdEvents = (await third.text()).trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(thirdEvents.some((event) => event.type === 'message' && event.message.role === 'member'));
  const finalState = thirdEvents.find((event) => event.type === 'state');
  assert.ok(finalState.state.messages.length >= 3);
  assert.equal(store.turns.size, 0);
});

test('persistence stress: 200 messages replay identically and bad lines are tolerated', async (t) => {
  const { store, live } = await fixture(t, { maxHistory: 20 });
  for (let index = 0; index < 200; index += 1) {
    const member = live.members[index % live.members.length];
    await store.appendMessage(live.gid, {
      id: `m_persist_${index}`,
      turnId: `u_${Math.floor(index / 3)}`,
      replyIndex: index % 3,
      ts: 1700000000 + index,
      role: index % 3 === 0 ? 'user' : 'member',
      memberId: index % 3 === 0 ? null : member.id,
      text: `第 ${index} 条消息`,
      mentions: [],
      mentionsOwner: false,
      replyTo: index === 0 ? null : `m_persist_${index - 1}`,
      usage: index % 3 === 0 ? null : { inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheWriteTokens: 0 },
    });
  }
  const view = await store.stateView(live.gid);
  assert.equal(view.messages.length, 200);
  const before = performance.now();
  const replayed = await new GroupStore(live.dir.split('/groups/')[0]).stateView(live.gid);
  const replayMs = performance.now() - before;
  assert.equal(replayed.messages.length, 200);
  assert.equal(replayed.messages[0].text, '第 0 条消息');
  assert.equal(replayed.messages.at(-1).text, '第 199 条消息');
  assert.deepEqual(replayed.totals, view.totals);
  assert.ok(replayMs < 2000, `200-message replay should stay fast, took ${replayMs.toFixed(0)}ms`);

  const log = path.join(live.dir, 'events.jsonl');
  const original = await readFile(log, 'utf8');
  await appendFile(
    log,
    `${JSON.stringify({ type: 'message', id: 'm_persist_0', text: 'duplicate' })}\n`
      + '{"type":"future-event","data":{"ignored":true}}\n'
      + '{"type":"message","id":"m_torn"',
  );
  const third = new GroupStore(live.dir.split('/groups/')[0]);
  const recovered = await third.stateView(live.gid);
  assert.equal(recovered.messages.length, 200);
  assert.equal(recovered.messages.filter((message) => message.id === 'm_persist_0').length, 1);
  assert.ok(recovered.messages.every((message) => message.id !== 'm_torn'));
  assert.ok(recovered.warnings.some((warning) => warning.includes('不完整')));
  assert.ok(original.length > 0);
});


test('two groups generate independently; stopping one does not abort the other', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupchat-multigroup-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const store = new GroupStore(root);
  await store.init();
  const config = { slow: true };
  const routes = new Map();
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
      async *stream(options) {
        if (options.system?.includes('群聊路由器')) {
          yield { type: 'text-delta', text: '{"targets":[],"reason":"","confidence":0}' };
          yield { type: 'usage', usage: { inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
          yield { type: 'finish', reason: { kind: 'stop' } };
          return;
        }
        yield { type: 'text-delta', text: '部分' };
        if (config.slow) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 5000);
            options.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            }, { once: true });
          });
        }
        yield { type: 'text-delta', text: '完整' };
        yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 0 } };
        yield { type: 'finish', reason: { kind: 'stop' } };
      },
    },
  };
  registerRoutes(ctx, store);
  const post = (routePath, body) =>
    routes.get(routePath).fetch(new Request(`http://127.0.0.1:3080${routePath}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }));
  const create = async (name) => {
    const response = await post('/api/groupchat.group-create', {
      name,
      members: [{ name: `${name}甲`, core: '甲' }, { name: `${name}乙`, core: '乙' }],
    });
    return (await response.json()).groupId;
  };
  const firstGroup = await create('甲群');
  const secondGroup = await create('乙群');
  const firstStream = await post('/api/groupchat.send', { groupId: firstGroup, text: '甲群的问题' });
  const secondStream = await post('/api/groupchat.send', { groupId: secondGroup, text: '乙群的问题' });
  assert.equal(firstStream.status, 200);
  assert.equal(secondStream.status, 200);
  await waitFor(() => store.turns.size === 2);
  assert.deepEqual([...store.turns.keys()].sort(), [firstGroup, secondGroup].sort());

  const stopFirst = await post('/api/groupchat.stop', { groupId: firstGroup });
  assert.equal(stopFirst.status, 200);
  await waitFor(() => store.turns.size === 1);
  assert.equal(store.turns.has(secondGroup), true, 'the other group keeps generating');
  assert.equal(store.turns.has(firstGroup), false);
  const firstEvents = (await firstStream.text()).trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(firstEvents.some((event) => event.type === 'stopped'));

  const stopSecond = await post('/api/groupchat.stop', { groupId: secondGroup });
  assert.equal(stopSecond.status, 200);
  await waitFor(() => store.turns.size === 0);
  await secondStream.text();

  const firstState = await store.stateView(firstGroup);
  const secondState = await store.stateView(secondGroup);
  assert.equal(firstState.messages.length, 1);
  assert.equal(secondState.messages.length, 1);
  assert.equal(firstState.messages[0].text, '甲群的问题');
  assert.equal(secondState.messages[0].text, '乙群的问题');
  assert.equal(firstState.messages[0].turnId.startsWith('m_'), true);
  assert.notEqual(firstState.messages[0].turnId, secondState.messages[0].turnId);
});
