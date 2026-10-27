import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { GroupChatError, GroupStore } from '../lib/store.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupchat-characters-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const store = new GroupStore(root);
  await store.init();
  return { store, root };
}

test('characters are global nodes shared by multiple groups', async (t) => {
  const { store } = await fixture(t);
  const a = await store.saveCharacter({ name: '甲', oneLiner: '第一个角色', core: '甲的核心。' });
  const b = await store.saveCharacter({ name: '乙', oneLiner: '第二个角色', core: '乙的核心。' });
  const c = await store.saveCharacter({ name: '丙', oneLiner: '第三个角色', core: '丙的核心。' });

  const g1 = await store.createGroup({
    name: '群一',
    characterIds: [a.id, b.id],
    owner: { name: '我' },
  });
  const g2 = await store.createGroup({
    name: '群二',
    characterIds: [a.id, b.id],
    owner: { name: '我' },
  });
  assert.equal((await store.listGroups()).length, 2);
  assert.equal((await store.listCharacters()).length, 3);
  assert.deepEqual(g1.group.characterIds, [a.id, b.id]);
  assert.deepEqual(g2.group.characterIds, [a.id, b.id]);
  await assert.rejects(readdir(path.join(g1.dir, 'members')), { code: 'ENOENT' });

  const saved = await store.saveCharacter({ id: a.id, name: '甲改', oneLiner: '改过的角色' });
  assert.equal(saved.name, '甲改');
  assert.equal((await store.load(g2.gid)).members.find((member) => member.id === a.id).name, '甲改');
  assert.equal((await store.listCharacters()).find((character) => character.id === a.id).usageGroups.length, 2);

  await store.addGroupCharacters(g1.gid, [c.id]);
  await store.addGroupCharacters(g2.gid, [c.id]);
  assert.equal((await store.load(g1.gid)).members.length, 3);
  assert.equal((await store.load(g2.gid)).members.length, 3);

  await store.removeGroupCharacter(g1.gid, a.id);
  await store.removeGroupCharacter(g2.gid, a.id);
  await store.deleteCharacter(a.id);
  assert.equal((await store.listCharacters()).some((character) => character.id === a.id), false);
});

test('a character used by a group cannot be deleted', async (t) => {
  const { store } = await fixture(t);
  const a = await store.saveCharacter({ name: '甲' });
  const b = await store.saveCharacter({ name: '乙' });
  const g = await store.createGroup({ name: '群', characterIds: [a.id, b.id] });
  await assert.rejects(
    store.deleteCharacter(a.id),
    (error) => error instanceof GroupChatError && error.status === 409 && /还在群/.test(error.message),
  );
  await assert.rejects(store.removeGroupCharacter(g.gid, a.id), /2–3/);
});

test('renaming a shared character cannot collide inside an existing group', async (t) => {
  const { store } = await fixture(t);
  const a = await store.saveCharacter({ name: '甲' });
  const b = await store.saveCharacter({ name: '乙' });
  await store.createGroup({ name: '群', characterIds: [a.id, b.id] });
  await assert.rejects(store.saveCharacter({ id: a.id, name: '乙' }), /已经有角色叫/);
});

test('a v1 group migrates its per-group members into the global library', async (t) => {
  const { store, root } = await fixture(t);
  const gid = 'g_v1test01';
  const dir = path.join(root, 'groups', gid);
  const first = 'c_aaaa1111';
  const second = 'c_bbbb2222';
  for (const [id, name] of [[first, '甲'], [second, '乙']]) {
    const memberDir = path.join(dir, 'members', id);
    await mkdir(path.join(memberDir, 'setting'), { recursive: true });
    await writeFile(path.join(memberDir, 'card.json'), JSON.stringify({
      schemaVersion: 1,
      id,
      name,
      avatar: null,
      public: { oneLiner: `${name}的一句话`, relations: {} },
      privateRelations: {},
      extendedEnabled: false,
      style: '',
      model: null,
    }));
    await writeFile(path.join(memberDir, 'setting', 'core.md'), `${name}的核心。`);
    await writeFile(path.join(memberDir, 'setting', 'extended.md'), '');
    await writeFile(path.join(memberDir, 'setting', 'memory.md'), `${name}的记忆。`);
  }
  await writeFile(path.join(dir, 'events.jsonl'), `${JSON.stringify({
    type: 'message', id: 'm_1', turnId: 'm_1', ts: 1, role: 'user', text: '在吗？',
  })}\n`);
  await writeFile(path.join(dir, 'group.json'), JSON.stringify({
    schemaVersion: 1,
    id: gid,
    name: '旧群',
    brief: '旧数据。',
    owner: { name: '我', oneLiner: '', setting: '', avatar: null, relations: {} },
    memberIds: [first, second],
    policy: {},
    model: null,
    budget: {},
    createdAt: 1,
    updatedAt: 1,
  }));

  const live = await store.load(gid);
  assert.deepEqual(live.group.characterIds, [first, second]);
  assert.equal(live.members[0].name, '甲');
  assert.equal(live.members[0].core, '甲的核心。');
  assert.equal(live.members[0].memory, '甲的记忆。');
  assert.equal(live.state.active.length, 1);
  assert.equal((await store.listCharacters()).length, 2);
  const migrated = JSON.parse(await readFile(path.join(dir, 'group.json'), 'utf8'));
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.characterIds, [first, second]);
  assert.equal(migrated.migratedFromV1, true);
});
