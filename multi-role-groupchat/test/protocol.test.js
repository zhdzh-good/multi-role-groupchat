import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BUDGET,
  DEFAULT_POLICY,
  applyEvent,
  buildPrompt,
  budgetStop,
  createState,
  formatTranscript,
  generationCap,
  normalizePolicy,
  normalizeReply,
  parseMentions,
  ownerDisplayName,
  ownerProfile,
  pickRotation,
  replayEvents,
  selectHistory,
  speakerName,
  validateMemberName,
  validateOwnerName,
} from '../lib/protocol.js';

const members = [
  { id: 'c_lin', name: '林晚' },
  { id: 'c_zhou', name: '周野' },
];

test('mentions match exact display names, ignore unknown and self', () => {
  assert.deepEqual(parseMentions('@林晚 你来，@周野 看着', members), { memberIds: ['c_lin', 'c_zhou'], owner: false });
  assert.deepEqual(parseMentions('@无名 在吗', members), { memberIds: [], owner: false });
  assert.deepEqual(parseMentions('@林晚 你来', members, { selfId: 'c_lin' }), { memberIds: [], owner: false });
  assert.deepEqual(parseMentions('@群主 回答我', members), { memberIds: [], owner: true });
  assert.deepEqual(parseMentions('@用户 回答我', members), { memberIds: [], owner: true });
  assert.deepEqual(parseMentions('@林晚晚 你', [{ id: 'c_a', name: '林晚' }, { id: 'c_b', name: '林晚晚' }]), {
    memberIds: ['c_b'],
    owner: false,
  });
  assert.deepEqual(parseMentions('林晚，你说呢', members), { memberIds: [], owner: false });
  assert.deepEqual(parseMentions('@林晚。', members), { memberIds: ['c_lin'], owner: false });
});

test('generation cap covers the routed set plus explicit handoffs', () => {
  assert.equal(generationCap(0, { ...DEFAULT_POLICY, maxHandoffDepth: 2 }), 3);
  assert.equal(generationCap(1, { ...DEFAULT_POLICY, maxHandoffDepth: 2 }), 3);
  assert.equal(generationCap(2, { ...DEFAULT_POLICY, maxHandoffDepth: 2 }), 4);
  assert.equal(generationCap(3, { ...DEFAULT_POLICY, maxHandoffDepth: 2 }), 5);
  assert.equal(generationCap(2, { ...DEFAULT_POLICY, maxHandoffDepth: 0 }), 2);
  assert.equal(generationCap(0, { ...DEFAULT_POLICY, maxHandoffDepth: 0 }), 1);
});

test('rotation picks the least recent speaker, excludes the previous, and breaks ties by id', () => {
  const messages = [
    { role: 'member', memberId: 'c_lin', ts: 100 },
    { role: 'member', memberId: 'c_zhou', ts: 50 },
  ];
  assert.equal(pickRotation(members, messages, null), 'c_zhou');
  assert.equal(pickRotation(members, messages, 'c_zhou'), 'c_lin');
  assert.equal(pickRotation(members, [], null), 'c_lin');
  assert.equal(pickRotation([{ id: 'c_lin' }], [{ role: 'member', memberId: 'c_lin', ts: 1 }], 'c_lin'), undefined);
});

test('history keeps pinned messages first and folds only the oldest unpinned', () => {
  const active = Array.from({ length: 30 }, (_, index) => ({
    id: `m_${index}`,
    ts: index,
    pinned: index === 2,
    role: 'member',
    memberId: index % 2 === 0 ? 'c_lin' : 'c_zhou',
    text: `t${index}`,
  }));
  const selection = selectHistory(active, { ...DEFAULT_POLICY, maxHistory: 24 });
  assert.equal(selection.pinned.length, 1);
  assert.equal(selection.window.length, 24);
  assert.equal(selection.folded.length, 5);
  assert.equal(selection.inPrompt[0].id, 'm_2');
  assert.equal(selection.inPrompt.at(-1).id, 'm_29');
});

test('replay applies messages, supersede, pin, notices, and cumulative usage', () => {
  const state = replayEvents([
    { type: 'message', id: 'm_1', turnId: 'm_1', ts: 1, role: 'user', text: '门怎么锁了？', usage: { inputTokens: 10, outputTokens: 0 } },
    {
      type: 'message',
      id: 'm_2',
      turnId: 'm_1',
      replyIndex: 1,
      ts: 2,
      role: 'member',
      memberId: 'c_lin',
      text: '后门我从里面锁的。',
      mentions: ['c_zhou'],
      mentionsOwner: false,
      usage: { inputTokens: 12, outputTokens: 8, cacheReadTokens: 7 },
    },
    { type: 'pin', target: 'm_2', pinned: true },
    { type: 'notice', text: '预算不足', level: 'warn', ts: 3 },
    { type: 'message', id: 'm_3', turnId: 'm_1', replyIndex: 1, ts: 4, role: 'member', memberId: 'c_lin', text: '重写版', supersedes: 'm_2' },
    { type: 'supersede', target: 'm_2', by: 'm_3' },
  ]);
  assert.equal(state.active.length, 2);
  assert.deepEqual(state.active.map((message) => message.id), ['m_1', 'm_3']);
  assert.equal(state.byId.get('m_2').status, 'superseded');
  assert.equal(state.byId.get('m_2').pinned, true);
  assert.equal(state.notices.length, 1);
  assert.equal(state.totals.inputTokens, 22);
  assert.equal(state.totals.outputTokens, 8);
  assert.equal(state.totals.cacheReadTokens, 7);
});

test('route events are replayed and their usage joins group totals', () => {
  const state = replayEvents([
    { type: 'message', id: 'm_1', turnId: 'm_1', ts: 1, role: 'user', text: '谁去开门？' },
    {
      type: 'route',
      id: 'r_1',
      turnId: 'm_1',
      ts: 2,
      targets: ['c_lin'],
      bystanders: ['c_zhou'],
      method: 'model',
      reason: '林晚有钥匙',
      confidence: 0.8,
      usage: { inputTokens: 30, outputTokens: 5, cacheReadTokens: 20, cacheWriteTokens: 0 },
    },
    {
      type: 'message',
      id: 'm_2',
      turnId: 'm_1',
      replyIndex: 1,
      ts: 3,
      role: 'member',
      memberId: 'c_lin',
      text: '我去。',
      usage: { inputTokens: 10, outputTokens: 4 },
    },
  ]);
  assert.equal(state.routes.length, 1);
  assert.deepEqual(state.routes[0].targets, ['c_lin']);
  assert.deepEqual(state.routes[0].bystanders, ['c_zhou']);
  assert.equal(state.routes[0].method, 'model');
  assert.equal(state.totals.inputTokens, 40);
  assert.equal(state.totals.outputTokens, 9);
  assert.equal(state.totals.cacheReadTokens, 20);
  const markdown = formatTranscript({ group: { name: '测试群' }, members, state });
  assert.match(markdown, /路由调用：1 次 · 输入 30 · 输出 5/);
});

test('prompt splits stable prefix from per-turn tail and omits the rewrite target', () => {
  const group = {
    name: '旧城书店的晚上',
    brief: '夜里十一点，旧城片区停电。',
    policy: { ...DEFAULT_POLICY, maxReplyChars: 300, maxHistory: 10 },
    model: null,
    budget: { ...DEFAULT_BUDGET },
  };
  const member = {
    id: 'c_lin',
    name: '林晚',
    core: '旧城书店店主。秘密：停电是自己拉的闸。',
    extended: '在这里长大。',
    extendedEnabled: true,
    public: { oneLiner: '说话短，不爱解释', relations: { c_zhou: '旧识，欠他人情' } },
  };
  const allMembers = [
    member,
    { id: 'c_zhou', name: '周野', public: { oneLiner: '电工', relations: {} } },
  ];
  const messages = [
    { id: 'm_1', turnId: 'm_1', ts: 1, role: 'user', memberId: null, text: '门怎么锁了？', pinned: false },
    { id: 'm_2', turnId: 'm_1', ts: 2, role: 'member', memberId: 'c_lin', text: '后门我从里面锁的……你别动。', pinned: false },
    { id: 'm_3', turnId: 'm_1', ts: 3, role: 'user', memberId: null, text: '那你来锁。', pinned: false },
    { id: 'm_4', turnId: 'm_1', ts: 4, role: 'member', memberId: 'c_lin', text: '旧版本', pinned: false },
  ];
  const prompt = buildPrompt({
    group,
    members: allMembers,
    activeMessages: messages,
    member,
    sourceUserText: '那你来锁。',
    replyIndex: 2,
    previousName: '周野',
    excludeId: 'm_4',
  });
  assert.match(prompt.system, /群简介：夜里十一点/);
  assert.match(prompt.system, /林晚：说话短，不爱解释（关系：周野：旧识，欠他人情）/);
  assert.match(prompt.system, /不替别人说话/);
  assert.doesNotMatch(prompt.system, /1792|第 \d+ 轮/);
  assert.equal(prompt.messages.length, 4);
  assert.match(prompt.messages[0].content[0].text, /^\[用户\] 门怎么锁了？$/);
  assert.match(prompt.messages[1].content[0].text, /^\[林晚\] 后门/);
  assert.doesNotMatch(JSON.stringify(prompt.messages), /旧版本/);
  const tail = prompt.messages.at(-1).content[0].text;
  assert.match(tail, /=== 你现在扮演：林晚 ===/);
  assert.match(tail, /=== 扩展背景 ===/);
  assert.match(tail, /用户刚说：那你来锁。/);
  assert.match(tail, /这是本次发言的第 2 条回应；上一条来自 周野。/);
});

test('prompt tells an addressee and a bystander how to respond', () => {
  const group = {
    name: '测试群',
    brief: '',
    policy: { ...DEFAULT_POLICY },
    budget: { ...DEFAULT_BUDGET },
  };
  const member = {
    id: 'c_lin',
    name: '林晚',
    core: '店主。',
    extended: '',
    extendedEnabled: false,
    public: { oneLiner: '店主', relations: {} },
  };
  const base = {
    group,
    members: [member, { id: 'c_zhou', name: '周野', public: { oneLiner: '电工', relations: {} } }],
    activeMessages: [{ id: 'm_1', turnId: 'm_1', ts: 1, role: 'user', text: '谁去开门？', pinned: false }],
    member,
    sourceUserText: '谁去开门？',
    replyIndex: 1,
    previousName: '用户',
  };
  const addressed = buildPrompt({ ...base, routeRole: 'addressed' });
  assert.match(addressed.messages.at(-1).content[0].text, /主要是对你说的/);
  const bystander = buildPrompt({ ...base, routeRole: 'bystander' });
  assert.match(bystander.messages.at(-1).content[0].text, /不是直接对你说的/);
  const handoff = buildPrompt({ ...base, routeRole: 'handoff' });
  assert.match(handoff.messages.at(-1).content[0].text, /把话交给了你/);
});

test('reply normalization strips only a leading speaker prefix', () => {
  assert.equal(normalizeReply('林晚：后门我锁的。', '林晚'), '后门我锁的。');
  assert.equal(normalizeReply('【林晚】后门我锁的。', '林晚'), '【林晚】后门我锁的。');
  assert.equal(normalizeReply('  嗯。 ', '林晚'), '嗯。');
});

test('budget stops at either ceiling and ignores zero ceilings', () => {
  const totals = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 };
  assert.equal(budgetStop(totals, { maxInputTokens: 99, maxOutputTokens: 1000 }), 'input');
  assert.equal(budgetStop(totals, { maxInputTokens: 1000, maxOutputTokens: 50 }), 'output');
  assert.equal(budgetStop(totals, { maxInputTokens: 0, maxOutputTokens: 0 }), null);
});

test('legacy policies gain smart routing defaults and clamp router fields', () => {
  assert.deepEqual(normalizePolicy({ replyMode: 'mention-or-rotate' }), { ...DEFAULT_POLICY });
  assert.equal(normalizePolicy({ maxMentionReplies: 0 }).maxMentionReplies, 1);
  assert.equal(normalizePolicy({ bystanderChance: 150 }).bystanderChance, 100);
  assert.equal(normalizePolicy({ smartRouting: false }).smartRouting, false);
});

test('member names are unique, bounded, and free of routing punctuation', () => {
  assert.deepEqual(validateMemberName('陈默', members), { ok: true, name: '陈默' });
  assert.equal(validateMemberName('林晚', members).ok, false);
  assert.equal(validateMemberName('群主', []).ok, false);
  assert.equal(validateMemberName('a b', []).ok, false);
  assert.equal(validateMemberName('一二三四五六七八九十一二三四五六七', []).ok, false);
  assert.equal(validateMemberName('林晚', members, 'c_lin').ok, true);
});

test('markdown export numbers turns, names speakers, and can append history', () => {
  const state = createState();
  applyEvent(state, { type: 'message', id: 'm_1', turnId: 'm_1', ts: 1792890000, role: 'user', text: '门怎么锁了？' });
  applyEvent(state, {
    type: 'message',
    id: 'm_2',
    turnId: 'm_1',
    replyIndex: 1,
    ts: 1792890010,
    role: 'member',
    memberId: 'c_lin',
    text: '后门我从里面锁的……你别动。',
    usage: { inputTokens: 1820, outputTokens: 64, cacheReadTokens: 1500 },
  });
  applyEvent(state, {
    type: 'message',
    id: 'm_3',
    turnId: 'm_2',
    replyIndex: 0,
    ts: 1792890020,
    role: 'user',
    text: '那你来锁。',
  });
  applyEvent(state, {
    type: 'message',
    id: 'm_4',
    turnId: 'm_3',
    replyIndex: 1,
    ts: 1792890030,
    role: 'member',
    memberId: 'c_lin',
    text: '旧版本',
    supersedes: 'm_2',
  });
  const markdown = formatTranscript({
    group: { name: '旧城书店的晚上', brief: '停电。' },
    members,
    state,
    includeHistory: true,
    exportedAt: 1792890100,
  });
  assert.match(markdown, /^# 旧城书店的晚上/m);
  assert.match(markdown, /第 1 轮 · 用户/);
  assert.match(markdown, /第 2 轮 · 用户/);
  assert.match(markdown, /Token 累计：输入 1,820/);
  assert.match(markdown, /## 历史版本/);
  assert.match(markdown, /旧版本/);
  assert.ok(!markdown.includes('林晚：后门'), 'speaker prefixes stay out of the body');
});


test('owner profile is injected into the prompt, labels, and export', () => {
  const group = {
    name: '旧城书店的晚上',
    brief: '停电。',
    owner: {
      name: '阿明',
      oneLiner: '每晚都来书店的常客',
      setting: '你是常客，和店主很熟，但不清楚停电的原因。',
      relations: { c_zhou: '一起修过电路' },
    },
    policy: { ...DEFAULT_POLICY, maxReplyChars: 300 },
    budget: { ...DEFAULT_BUDGET },
  };
  const ownerMessage = {
    id: 'm_1',
    turnId: 'm_1',
    ts: 1792890000,
    role: 'user',
    memberId: null,
    text: '门怎么锁了？',
    pinned: false,
  };
  const prompt = buildPrompt({
    group,
    members,
    activeMessages: [ownerMessage],
    member: { id: 'c_lin', name: '林晚', core: '店主', extended: '', extendedEnabled: false, public: { oneLiner: '店主', relations: {} } },
    sourceUserText: '门怎么锁了？',
    replyIndex: 1,
    previousName: '阿明',
  });
  assert.match(prompt.system, /角色档案：/);
  assert.match(prompt.system, /- 名字：阿明/);
  assert.match(prompt.system, /- 设定：你是常客/);
  assert.match(prompt.system, /- 与成员关系：周野：一起修过电路/);
  assert.match(prompt.messages[0].content[0].text, /^\[阿明\] 门怎么锁了？$/);
  const tail = prompt.messages.at(-1).content[0].text;
  assert.match(tail, /阿明刚说：门怎么锁了？/);
  assert.match(tail, /@阿明 表示等对方回答/);
  assert.equal(ownerDisplayName(group), '阿明');
  assert.equal(ownerProfile({ owner: { name: '群主' } }).name, '用户');
  assert.equal(ownerDisplayName({}), '用户');
  assert.deepEqual(ownerProfile(group).relations, { c_zhou: '一起修过电路' });
  assert.equal(speakerName(ownerMessage, members, '阿明'), '阿明');

  assert.deepEqual(parseMentions('@阿明 你说呢', members, { ownerName: '阿明' }), { memberIds: [], owner: true });
  assert.deepEqual(parseMentions('@群主 你说呢', members, { ownerName: '阿明' }), { memberIds: [], owner: true });
  assert.deepEqual(parseMentions('@阿明 你说呢', members), { memberIds: [], owner: false });

  const state = createState();
  applyEvent(state, {
    type: 'message',
    id: 'm_1',
    turnId: 'm_1',
    ts: 1792890000,
    role: 'user',
    text: '门怎么锁了？',
  });
  const markdown = formatTranscript({ group, members, state });
  assert.match(markdown, /- 角色：阿明/);
  assert.match(markdown, /### 第 1 轮 · 阿明/);
});

test('owner names stay unique against members and safe for @ routing', () => {
  assert.equal(validateOwnerName('群主', members).ok, false);
  assert.deepEqual(validateOwnerName('', members), { ok: true, name: '用户' });
  assert.deepEqual(validateOwnerName('用户', members), { ok: true, name: '用户' });
  assert.deepEqual(validateOwnerName('阿明', members), { ok: true, name: '阿明' });
  assert.equal(validateOwnerName('林晚', members).ok, false);
  assert.equal(validateOwnerName('a b', []).ok, false);
  assert.equal(validateOwnerName('一二三四五六七八九十一二三四五六七', []).ok, false);
});
