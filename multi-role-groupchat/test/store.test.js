import test from 'node:test';
import assert from 'node:assert/strict';
import { access, appendFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DEFAULT_BUDGET, DEFAULT_POLICY, formatTranscript } from '../lib/protocol.js';
import { GroupChatError, GroupStore, normalizeOwner } from '../lib/store.js';

/**
 * Create an isolated store rooted in a fresh temporary directory.
 * @param {object} t - node:test context.
 * @returns {Promise<{store: GroupStore, root: string}>} fixture.
 */
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupchat-test-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const store = new GroupStore(root);
  await store.init();
  return { store, root };
}

test('create, append, reload, supersede, pin, notice, export', async (t) => {
  const { store, root } = await fixture(t);
  const live = await store.createGroup({
    name: '旧城书店的晚上',
    brief: '夜里十一点，旧城片区停电。',
    members: [
      { name: '林晚', oneLiner: '旧城书店店主', core: '身份：店主。秘密：电闸是我拉的。' },
      { name: '周野', oneLiner: '电工', core: '身份：电工。' },
    ],
  });
  assert.match(live.gid, /^g_/);
  assert.equal(live.group.policy.maxHandoffDepth, DEFAULT_POLICY.maxHandoffDepth);
  assert.equal(live.group.budget.maxInputTokens, DEFAULT_BUDGET.maxInputTokens);
  assert.equal(live.members.length, 2);
  assert.equal(live.group.owner.name, '用户');
  assert.equal(live.group.owner.setting, '');
  assert.equal(normalizeOwner({ name: '群主' }, null).name, '用户');
  assert.equal(live.members[0].name, '林晚');
  assert.match(live.members[0].core, /电闸/);

  await store.appendMessage(live.gid, {
    id: 'm_1',
    turnId: 'm_1',
    replyIndex: 0,
    ts: 100,
    role: 'user',
    memberId: null,
    text: '门怎么锁了？',
    mentions: [],
    mentionsOwner: false,
    replyTo: null,
  });
  await store.appendMessage(live.gid, {
    id: 'm_2',
    turnId: 'm_1',
    replyIndex: 1,
    ts: 101,
    role: 'member',
    memberId: live.members[0].id,
    text: '后门我从里面锁的……你别动。',
    mentions: ['c_fake'],
    mentionsOwner: false,
    replyTo: 'm_1',
    usage: { inputTokens: 1820, outputTokens: 64, cacheReadTokens: 1500 },
  });
  const view = await store.stateView(live.gid);
  assert.equal(view.messages.length, 2);
  assert.equal(view.messages[1].memberName, '林晚');
  assert.equal(view.messages[1].usage.cacheReadTokens, 1500);
  assert.equal(view.totals.inputTokens, 1820);

  // A fresh store replays the same JSONL log.
  const reloaded = new GroupStore(root);
  const replayed = await reloaded.stateView(live.gid);
  assert.deepEqual(replayed.messages.map((message) => message.id), ['m_1', 'm_2']);
  assert.equal(replayed.messages[1].text, '后门我从里面锁的……你别动。');

  // Rewrite appends a replacement plus a supersede event; only the new version is effective.
  await reloaded.appendMessage(live.gid, {
    id: 'm_3',
    turnId: 'm_1',
    replyIndex: 1,
    ts: 102,
    role: 'member',
    memberId: live.members[0].id,
    text: '后门我锁的，别动。',
    mentions: [],
    mentionsOwner: false,
    replyTo: 'm_1',
    supersedes: 'm_2',
  });
  await reloaded.appendSupersede(live.gid, 'm_2', 'm_3');
  const rewritten = await reloaded.stateView(live.gid);
  assert.deepEqual(rewritten.messages.map((message) => message.id), ['m_1', 'm_3']);
  assert.equal(rewritten.supersededCount, 1);
  assert.equal(rewritten.totals.inputTokens, 1820, 'superseded versions still count toward usage');

  const exported = formatTranscript({
    group: rewritten.group,
    members: rewritten.members,
    state: (await reloaded.load(live.gid)).state,
    includeHistory: true,
  });
  assert.match(exported, /后门我锁的，别动。/);
  assert.match(exported, /## 历史版本/);
  assert.match(exported, /后门我从里面锁的……你别动。/);

  // Pin ceiling.
  await reloaded.updateGroup(live.gid, { policy: { ...DEFAULT_POLICY, maxPinned: 1 } });
  await reloaded.setPin(live.gid, 'm_1', true);
  await assert.rejects(
    reloaded.setPin(live.gid, 'm_3', true),
    (error) => error instanceof GroupChatError && error.status === 409,
  );

  // Notices are persisted (best effort) and replayed.
  reloaded.appendNotice(live.gid, '预算不足（测试），已暂停。', 'warn');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const third = new GroupStore(root);
  const withNotice = await third.stateView(live.gid);
  assert.equal(withNotice.notices.length, 1);
  assert.equal(withNotice.notices[0].level, 'warn');
  assert.equal(withNotice.pinnedCount, 1);

  // A torn final line is dropped with a warning instead of corrupting the group.
  const log = path.join(live.dir, 'events.jsonl');
  const before = await readFile(log, 'utf8');
  assert.ok(before.endsWith('\n'));
  await appendFile(log, '{"type":"message","id":"m_broken"');
  const fourth = new GroupStore(root);
  const recovered = await fourth.stateView(live.gid);
  assert.deepEqual(recovered.messages.map((message) => message.id), ['m_1', 'm_3']);
  assert.ok(recovered.warnings.some((warning) => warning.includes('不完整')));
});

test('members can be edited, added, and validated', async (t) => {
  const { store } = await fixture(t);
  const live = await store.createGroup({
    name: '测试群',
    members: [{ name: '甲', core: '' }, { name: '乙', core: '' }],
  });
  const first = live.members[0];
  const updated = await store.saveMember(live.gid, {
    memberId: first.id,
    name: '甲一',
    oneLiner: '改过了',
    core: '新核心',
    extended: '新扩展',
    extendedEnabled: true,
    model: { provider: 'deepseek', model: 'deepseek-chat' },
    relations: { [live.members[1].id]: '熟人' },
  });
  assert.equal(updated.name, '甲一');
  assert.equal(updated.extendedEnabled, true);
  assert.deepEqual(updated.model, { provider: 'deepseek', model: 'deepseek-chat' });
  assert.deepEqual(updated.public.relations, { [live.members[1].id]: '熟人' });

  // Avatars are opaque strings on the Host (the browser stores a 128×128 data URL).
  const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lP1kAAAAAElFTkSuQmCC';
  const withAvatar = await store.saveMember(live.gid, { memberId: first.id, name: '甲一', avatar });
  assert.equal(withAvatar.avatar, avatar);
  const reloadedAvatar = await new GroupStore(store.root).stateView(live.gid);
  assert.equal(reloadedAvatar.members.find((member) => member.id === first.id).avatar, avatar);
  // Removal is an empty string, which the UI renders as the initial fallback.
  const withoutAvatar = await store.saveMember(live.gid, { memberId: first.id, name: '甲一', avatar: '' });
  assert.equal(withoutAvatar.avatar, '');

  await assert.rejects(
    store.saveMember(live.gid, { memberId: live.members[1].id, name: '甲一' }),
    (error) => error instanceof GroupChatError && /重名/.test(error.message),
  );
  await assert.rejects(
    store.createGroup({ name: '少人', members: [{ name: '甲' }] }),
    (error) => error instanceof GroupChatError,
  );
  const added = await store.saveMember(live.gid, { name: '丙', oneLiner: '第三个' });
  assert.equal(added.name, '丙');
  assert.equal((await store.load(live.gid)).members.length, 3);
  await assert.rejects(
    store.saveMember(live.gid, { name: '丁' }),
    (error) => error instanceof GroupChatError && /最多 3/.test(error.message),
  );
});

test('unknown group and invalid ids are rejected', async (t) => {
  const { store } = await fixture(t);
  await assert.rejects(store.load('g_missing'), (error) => error instanceof GroupChatError && error.status === 404);
  await assert.rejects(store.load('../escape'), (error) => error instanceof GroupChatError && error.status === 400);
});


test('creation carries owner and member profile fields into management', async (t) => {
  const { store, root } = await fixture(t);
  const live = await store.createGroup({
    name: '创建字段测试',
    owner: {
      name: '管理员',
      oneLiner: '刚醒来的管理员',
      setting: '你在缘缘庄休养。',
    },
    members: [
      { name: '祀', oneLiner: '画境客栈主人', core: '档案定位：画师。' },
      { name: '佩丽卡', oneLiner: '监督', core: '档案定位：监督。' },
    ],
  });
  assert.equal(live.group.owner.name, '管理员');
  assert.equal(live.group.owner.oneLiner, '刚醒来的管理员');
  assert.equal(live.group.owner.setting, '你在缘缘庄休养。');
  const view = await new GroupStore(root).stateView(live.gid);
  assert.equal(view.owner.name, '管理员');
  assert.equal(view.owner.oneLiner, '刚醒来的管理员');
  assert.equal(view.owner.setting, '你在缘缘庄休养。');
  assert.equal(view.members[0].public.oneLiner, '画境客栈主人');
  assert.equal(view.members[0].core, '档案定位：画师。');
});

test('owner profile persists, validates, and labels owner messages', async (t) => {
  const { store, root } = await fixture(t);
  const live = await store.createGroup({
    name: '群主测试',
    members: [{ name: '甲', core: '' }, { name: '乙', core: '' }],
  });
  const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lP1kAAAAAElFTkSuQmCC';
  await store.updateGroup(live.gid, {
    owner: {
      name: '阿明',
      oneLiner: '每晚都来的人',
      setting: '你是常客，和甲很熟。',
      avatar,
      relations: { [live.members[0].id]: '老熟人' },
    },
  });
  const reloaded = new GroupStore(root);
  const view = await reloaded.stateView(live.gid);
  assert.deepEqual(view.owner, {
    name: '阿明',
    oneLiner: '每晚都来的人',
    setting: '你是常客，和甲很熟。',
    avatar,
    relations: { [live.members[0].id]: '老熟人' },
  });
  await reloaded.appendMessage(live.gid, {
    id: 'm_owner',
    turnId: 'm_owner',
    replyIndex: 0,
    ts: 10,
    role: 'user',
    memberId: null,
    text: '我来了。',
    mentions: [],
    mentionsOwner: false,
    replyTo: null,
  });
  const labeled = await reloaded.stateView(live.gid);
  assert.equal(labeled.messages[0].memberName, '阿明');

  await assert.rejects(
    reloaded.updateGroup(live.gid, { owner: { name: '甲' } }),
    (error) => error instanceof GroupChatError && /重名/.test(error.message),
  );
  await assert.rejects(
    reloaded.updateGroup(live.gid, { owner: { name: 'a b' } }),
    (error) => error instanceof GroupChatError,
  );
  await assert.rejects(
    reloaded.saveMember(live.gid, { memberId: live.members[1].id, name: '阿明' }),
    (error) => error instanceof GroupChatError && /角色/.test(error.message),
  );
  await assert.rejects(
    reloaded.updateGroup(live.gid, { owner: { name: '阿明', setting: 'x'.repeat(20001) } }),
    (error) => error instanceof GroupChatError && /角色设定/.test(error.message),
  );
});


test('deleteGroup removes the directory, rejects a live turn, and clears caches', async (t) => {
  const { store } = await fixture(t);
  const live = await store.createGroup({
    name: '待删除群',
    members: [{ name: '甲', core: '' }, { name: '乙', core: '' }],
  });
  await access(live.dir);
  store.turns.set(live.gid, { abort: new AbortController(), groupId: live.gid });
  await assert.rejects(
    store.deleteGroup(live.gid),
    (error) => error instanceof GroupChatError && error.status === 409,
  );
  await access(live.dir);
  store.turns.delete(live.gid);
  await store.deleteGroup(live.gid);
  await assert.rejects(access(live.dir));
  assert.deepEqual(await store.listGroups(), []);
  await assert.rejects(store.load(live.gid), (error) => error instanceof GroupChatError && error.status === 404);
});
