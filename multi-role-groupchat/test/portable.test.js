import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DEFAULT_BUDGET, DEFAULT_POLICY } from '../lib/protocol.js';
import {
  CHARACTER_FORMAT,
  GROUP_FORMAT,
  PortableError,
  buildCharacterCard,
  buildGroupBundle,
  mapCharacterRelations,
  normalizeCharacterCard,
  normalizeGroupBundle,
  parsePortable,
  previewGroupBundle,
  stringifyPortable,
} from '../lib/portable.js';
import { GroupStore } from '../lib/store.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lP1kAAAAAElFTkSuQmCC';

const members = [
  {
    id: 'c_lin',
    name: '林晚',
    avatar: PNG,
    public: { oneLiner: '书店店主', relations: { c_zhou: '旧识' } },
    style: '句子短，叫阿明“你”。',
    memory: '阿明最近失业了，但我不想点破。',
    privateRelations: { c_zhou: '我其实还没完全信任他。' },
    core: '店主，话少。',
    extended: '在这里长大。',
    extendedEnabled: true,
    model: { provider: 'fake', model: 'fake-1' },
  },
  {
    id: 'c_zhou',
    name: '周野',
    avatar: null,
    public: { oneLiner: '电工', relations: { c_lin: '欠一个人情' } },
    core: '电工。',
    extended: '',
    extendedEnabled: false,
    model: null,
  },
];

const group = {
  name: '旧城书店',
  brief: '停电的晚上。',
  owner: {
    name: '阿明',
    oneLiner: '常客',
    setting: '每晚都来书店。',
    avatar: PNG,
    relations: { c_lin: '熟客' },
  },
  policy: { ...DEFAULT_POLICY, bystanderChance: 55 },
  budget: { ...DEFAULT_BUDGET, maxOutputTokens: 1234 },
  model: { provider: 'fake', model: 'fake-1' },
};

test('group bundles omit local ids and key relations by display name', () => {
  const bundle = buildGroupBundle({ group, members, exportedAt: new Date('2026-10-26T00:00:00Z') });
  assert.equal(bundle.format, GROUP_FORMAT);
  assert.equal(bundle.version, 1);
  assert.equal(bundle.group.name, '旧城书店');
  assert.equal(bundle.group.owner.name, '阿明');
  assert.deepEqual(bundle.group.owner.relations, { 林晚: '熟客' });
  assert.deepEqual(bundle.members[0].relations, { 周野: '旧识' });
  assert.equal(bundle.members[0].style, '句子短，叫阿明“你”。');
  assert.equal('memory' in bundle.members[0], false);
  assert.equal('privateRelations' in bundle.members[0], false);
  assert.equal(bundle.members[0].avatar, PNG);
  assert.equal(JSON.stringify(bundle).includes('c_lin'), false);
  assert.equal(JSON.stringify(bundle).includes('c_zhou'), false);

  const withoutAvatars = buildGroupBundle({ group, members, includeAvatars: false, exportedAt: 1 });
  assert.equal('avatar' in withoutAvatars.group.owner, false);
  assert.equal('avatar' in withoutAvatars.members[0], false);
  assert.equal(JSON.stringify(withoutAvatars).includes(PNG), false);
});

test('group import normalization preserves policy, relations, and warnings', () => {
  const bundle = buildGroupBundle({ group, members });
  bundle.group.owner.relations.不存在 = '应被跳过';
  bundle.members[0].avatar = 'https://example.com/a.png';
  bundle.unknown = 'ignored';
  const normalized = normalizeGroupBundle(bundle);
  assert.equal(normalized.name, '旧城书店');
  assert.equal(normalized.policy.bystanderChance, 55);
  assert.equal(normalized.budget.maxOutputTokens, 1234);
  assert.equal(normalized.owner.relations.林晚, '熟客');
  assert.deepEqual(normalized.owner.relations, { 林晚: '熟客' });
  assert.equal(normalized.members[0].relations.周野, '旧识');
  assert.equal(normalized.members[0].style, '句子短，叫阿明“你”。');
  assert.equal(normalized.members[0].avatar, null);
  assert.ok(normalized.warnings.some((warning) => warning.includes('不在群内')));
  assert.ok(normalized.warnings.some((warning) => warning.includes('头像')));
  assert.ok(normalized.warnings.some((warning) => warning.includes('未知字段')));
  const preview = previewGroupBundle(normalized, { bytes: 1234 });
  assert.equal(preview.groupName, '旧城书店');
  assert.equal(preview.memberCount, 2);
  assert.equal(preview.members[0].relationCount, 1);
  assert.equal(preview.members[0].styleChars, 11);
  assert.equal(preview.members[0].privateMemoryChars, 0);
  assert.equal(preview.members[0].privateRelationCount, 0);
  assert.equal(preview.bytes, 1234);
});

test('parsePortable classifies bundles, character cards, and legacy files', () => {
  const bundle = buildGroupBundle({ group, members });
  const parsed = parsePortable(stringifyPortable(bundle), 'group');
  assert.equal(parsed.kind, 'group');
  assert.equal(parsed.warnings.length, 0);

  const legacy = { group: { name: '旧群' }, members: [] };
  const legacyParsed = parsePortable(legacy, 'group');
  assert.equal(legacyParsed.kind, 'group');
  assert.ok(legacyParsed.warnings.some((warning) => warning.includes('旧版')));

  const card = buildCharacterCard({ kind: 'member', profile: members[0], members });
  assert.equal(card.format, CHARACTER_FORMAT);
  assert.deepEqual(card.character.relations, { 周野: '旧识' });
  assert.equal(card.character.style, '句子短，叫阿明“你”。');
  assert.equal('memory' in card.character, false);
  assert.equal('privateRelations' in card.character, false);
  assert.equal(parsePortable(card, 'character').kind, 'character');

  assert.throws(() => parsePortable('not json'), PortableError);
  assert.throws(() => parsePortable({ ...bundle, version: 2 }, 'group'), /高于当前支持/);
  assert.throws(() => parsePortable(card, 'group'), /角色卡，不是群配置/);
});

test('private memory and relations are opt-in and round-trip by display name', () => {
  const bundle = buildGroupBundle({ group, members, includePrivate: true });
  assert.equal(bundle.members[0].memory, '阿明最近失业了，但我不想点破。');
  assert.deepEqual(bundle.members[0].privateRelations, { 周野: '我其实还没完全信任他。' });
  const normalized = normalizeGroupBundle(bundle);
  assert.equal(normalized.members[0].memory, '阿明最近失业了，但我不想点破。');
  assert.equal(normalized.members[0].privateRelations.周野, '我其实还没完全信任他。');
  const preview = previewGroupBundle(normalized);
  assert.equal(preview.members[0].privateMemoryChars, 15);
  assert.equal(preview.members[0].privateRelationCount, 1);

  const card = buildCharacterCard({ kind: 'member', profile: members[0], members, includePrivate: true });
  assert.equal(card.character.memory, '阿明最近失业了，但我不想点破。');
  assert.deepEqual(card.character.privateRelations, { 周野: '我其实还没完全信任他。' });
  const cardNormalized = normalizeCharacterCard(card, 'member');
  const mapped = mapCharacterRelations(cardNormalized.character, members, { kind: 'member', selfId: 'c_lin' });
  assert.deepEqual(mapped.privateRelations, { c_zhou: '我其实还没完全信任他。' });
  assert.deepEqual(mapped.warnings, []);
});

test('group validation rejects unsafe names and oversized fields', () => {
  const base = buildGroupBundle({ group, members });
  const duplicate = structuredClone(base);
  duplicate.members[1].name = duplicate.members[0].name;
  assert.throws(() => normalizeGroupBundle(duplicate), /重名|已有成员/);

  const collision = structuredClone(base);
  collision.group.owner.name = collision.members[0].name;
  assert.throws(() => normalizeGroupBundle(collision), /重名|成员不能/);

  const tooFew = structuredClone(base);
  tooFew.members = [tooFew.members[0]];
  assert.throws(() => normalizeGroupBundle(tooFew), /2–3/);

  const tooLong = structuredClone(base);
  tooLong.members[0].core = '长'.repeat(20001);
  assert.throws(() => normalizeGroupBundle(tooLong), /20000/);

  const badAvatar = structuredClone(base);
  badAvatar.members[0].avatar = `data:image/png;base64,${'A'.repeat(300001)}`;
  assert.throws(() => normalizeGroupBundle(badAvatar), /头像超过/);
});

test('character cards validate kind and map relation names onto ids', () => {
  const card = buildCharacterCard({ kind: 'owner', profile: group.owner, members });
  const normalized = normalizeCharacterCard(card, 'owner');
  assert.equal(normalized.kind, 'owner');
  assert.deepEqual(normalized.character.relations, { 林晚: '熟客' });
  assert.throws(() => normalizeCharacterCard(card, 'member'), /我的角色卡/);

  const memberCard = buildCharacterCard({ kind: 'member', profile: members[0], members });
  const memberNormalized = normalizeCharacterCard(memberCard, 'member');
  const mapped = mapCharacterRelations(memberNormalized.character, members, { kind: 'member', selfId: 'c_lin' });
  assert.deepEqual(mapped.relations, { c_zhou: '旧识' });
  assert.deepEqual(mapped.privateRelations, {});
  const withUnknown = mapCharacterRelations(
    { ...memberNormalized.character, relations: { 周野: '旧识', 无名: '不存在' } },
    members,
    { kind: 'member', selfId: 'c_lin' },
  );
  assert.deepEqual(withUnknown.relations, { c_zhou: '旧识' });
  assert.ok(withUnknown.warnings.some((warning) => warning.includes('无名')));
});

test('store.importGroup creates fresh ids and remaps name-keyed relations', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupchat-portable-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const store = new GroupStore(root);
  await store.init();
  const source = await store.createGroup({
    name: group.name,
    brief: group.brief,
    owner: { name: group.owner.name, oneLiner: group.owner.oneLiner, setting: group.owner.setting },
    members: members.map((member) => ({
      name: member.name,
      oneLiner: member.public.oneLiner,
      style: member.style,
      memory: member.memory,
      core: member.core,
    })),
    policy: group.policy,
    budget: group.budget,
    model: group.model,
  });
  await store.saveMember(source.gid, {
    memberId: source.members[0].id,
    name: '林晚',
    oneLiner: '书店店主',
    avatar: PNG,
    relations: { [source.members[1].id]: '旧识' },
    style: '句子短，叫阿明“你”。',
    memory: '阿明最近失业了，但我不想点破。',
    privateRelations: { [source.members[1].id]: '我其实还没完全信任他。' },
    core: '店主，话少。',
    extended: '在这里长大。',
    extendedEnabled: true,
    model: { provider: 'fake', model: 'fake-1' },
  });
  await store.updateGroup(source.gid, {
    owner: { ...group.owner, relations: { [source.members[0].id]: '熟客' } },
  });
  const sourceLive = await store.load(source.gid);
  const bundle = buildGroupBundle({ group: sourceLive.group, members: sourceLive.members, includePrivate: true });
  const imported = await store.importGroup(normalizeGroupBundle(bundle));

  assert.notEqual(imported.gid, source.gid);
  assert.notEqual(imported.members[0].id, sourceLive.members[0].id);
  assert.equal(imported.group.name, '旧城书店');
  assert.equal(imported.group.policy.bystanderChance, 55);
  assert.equal(imported.group.budget.maxOutputTokens, 1234);
  assert.deepEqual(imported.group.model, { provider: 'fake', model: 'fake-1' });
  assert.equal(imported.members[0].public.relations[imported.members[1].id], '旧识');
  assert.equal(imported.group.owner.relations[imported.members[0].id], '熟客');
  assert.equal(imported.members[0].avatar, PNG);
  assert.equal(imported.members[0].extended, '在这里长大。');
  assert.equal(imported.members[0].style, '句子短，叫阿明“你”。');
  assert.equal(imported.members[0].memory, '阿明最近失业了，但我不想点破。');
  assert.equal(imported.members[0].privateRelations[imported.members[1].id], '我其实还没完全信任他。');
  assert.equal(imported.members[0].extendedEnabled, true);
  assert.equal((await store.listGroups()).length, 2);
});

test('a failed group import removes the half-created group', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupchat-portable-fail-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const store = new GroupStore(root);
  await store.init();
  const normalized = normalizeGroupBundle(buildGroupBundle({ group, members }));
  store.saveMember = async () => {
    throw new Error('simulated write failure');
  };
  await assert.rejects(store.importGroup(normalized), /simulated write failure/);
  assert.deepEqual(await store.listGroups(), []);
});
