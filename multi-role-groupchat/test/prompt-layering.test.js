import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BUDGET, DEFAULT_POLICY, buildPrompt } from '../lib/protocol.js';

const members = [
  {
    id: 'c_lin',
    name: '林晚',
    core: '店主。秘密：闸是我拉的。',
    extended: '在这里长大。',
    extendedEnabled: true,
    style: '句子短，少用感叹号，叫阿明“你”。',
    memory: '阿明最近失业了，但我不想点破。',
    privateRelations: { c_zhou: '我欠他一个人情，不想让阿明知道。' },
    public: { oneLiner: '书店店主', relations: { c_zhou: '旧识' } },
  },
  {
    id: 'c_zhou',
    name: '周野',
    core: '电工。秘密：我知道闸是林晚拉的。',
    extended: '',
    extendedEnabled: false,
    public: { oneLiner: '电工', relations: { c_lin: '老同学' } },
  },
];

const group = {
  name: '旧城书店',
  brief: '停电的晚上。',
  owner: { name: '阿明', oneLiner: '常客', setting: '最近失业。', avatar: null, relations: {} },
  policy: { ...DEFAULT_POLICY, maxHistory: 10 },
  budget: { ...DEFAULT_BUDGET },
};

const messages = [
  { id: 'm_1', turnId: 't', ts: 1, role: 'user', memberId: null, text: '门怎么锁了？', pinned: false },
  { id: 'm_2', turnId: 't', ts: 2, role: 'member', memberId: 'c_zhou', text: '后门我锁的。', pinned: false },
  { id: 'm_3', turnId: 't', ts: 3, role: 'member', memberId: 'c_lin', text: '别动，我来。', pinned: false },
  { id: 'm_4', turnId: 't', ts: 4, role: 'user', memberId: null, text: '林晚，你怎么看？', pinned: false },
];

test('the prompt tail layers core, voice, relations, recent lines, scene, task, and reminder', () => {
  const prompt = buildPrompt({
    group,
    members,
    activeMessages: messages,
    member: members[0],
    sourceUserText: '林晚，你怎么看？',
    replyIndex: 1,
    previousName: '阿明',
    routeRole: 'addressed',
  });
  const tail = prompt.messages.at(-1).content[0].text;
  for (const heading of [
    '角色核心',
    '扩展背景',
    '说话方式',
    '你与在场者的关系',
    '你最近说过',
    '只有你知道',
    '你私下的关系',
    '本场状态',
    '本轮任务',
    '角色提醒',
  ]) {
    assert.match(tail, new RegExp(`=== ${heading} ===`), heading);
  }
  assert.match(tail, /句子短，少用感叹号/);
  assert.match(tail, /- 周野：旧识/);
  assert.match(tail, /- 别动，我来。/);
  assert.doesNotMatch(tail, /后门我锁的/);
  assert.match(tail, /阿明最近失业了/);
  assert.match(tail, /我欠他一个人情/);
  assert.match(tail, /主要是对你说的/);
  assert.match(tail, /角色提醒/);
  assert.match(tail, /保持林晚的称呼、语气和立场/);
});

test('private material stays out of the shared system prefix while public data remains', () => {
  const prompt = buildPrompt({
    group,
    members,
    activeMessages: messages,
    member: members[0],
    sourceUserText: '林晚，你怎么看？',
    replyIndex: 1,
    previousName: '阿明',
    routeRole: 'addressed',
  });
  assert.match(prompt.system, /群简介：停电的晚上/);
  assert.match(prompt.system, /林晚：书店店主/);
  assert.doesNotMatch(prompt.system, /闸是我拉的/);
  assert.doesNotMatch(prompt.system, /阿明最近失业了/);
  assert.doesNotMatch(prompt.system, /我欠他一个人情/);
  assert.doesNotMatch(prompt.system, /句子短/);
});

test('one member\'s private memory and relations never enter another member\'s tail', () => {
  const prompt = buildPrompt({
    group,
    members,
    activeMessages: messages,
    member: members[1],
    sourceUserText: '周野，你说。',
    replyIndex: 1,
    previousName: '阿明',
    routeRole: 'addressed',
  });
  const tail = prompt.messages.at(-1).content[0].text;
  assert.doesNotMatch(prompt.system, /阿明最近失业了/);
  assert.doesNotMatch(prompt.system, /我欠他一个人情/);
  assert.doesNotMatch(tail, /阿明最近失业了/);
  assert.doesNotMatch(tail, /我欠他一个人情/);
  assert.match(tail, /电工。秘密：我知道闸是林晚拉的。/);
});

test('the system prefix stays byte-identical while the tail changes by role and turn', () => {
  const base = {
    group,
    members,
    activeMessages: messages,
    member: members[0],
    sourceUserText: '林晚，你怎么看？',
    replyIndex: 1,
    previousName: '阿明',
  };
  const addressed = buildPrompt({ ...base, routeRole: 'addressed' });
  const bystander = buildPrompt({ ...base, routeRole: 'bystander' });
  const handoff = buildPrompt({ ...base, routeRole: 'handoff', replyIndex: 3, previousName: '周野' });
  assert.equal(addressed.system, bystander.system);
  assert.equal(addressed.system, handoff.system);
  assert.notEqual(addressed.messages.at(-1).content[0].text, bystander.messages.at(-1).content[0].text);
  assert.match(bystander.messages.at(-1).content[0].text, /不是直接对你说的/);
  assert.match(handoff.messages.at(-1).content[0].text, /把话交给了你/);
});

test('a rewritten message is excluded from history and from the recent-voice block', () => {
  const withOld = messages.map((message) => (message.id === 'm_3' ? { ...message, text: '旧版本' } : message));
  const prompt = buildPrompt({
    group,
    members,
    activeMessages: withOld,
    member: members[0],
    sourceUserText: '林晚，你怎么看？',
    replyIndex: 1,
    previousName: '阿明',
    excludeId: 'm_3',
  });
  assert.doesNotMatch(JSON.stringify(prompt.messages), /旧版本/);
  assert.doesNotMatch(JSON.stringify(prompt.messages), /别动，我来/);
});
