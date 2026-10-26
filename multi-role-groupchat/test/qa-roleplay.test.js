import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildPrompt } from '../lib/protocol.js';
import { evaluateReply } from '../qa/roleplay/run.mjs';
import {
  hydrateRoleplayWorld,
  roleplayOpeningMessages,
} from '../qa/lib/fixtures.mjs';

const data = JSON.parse(
  await readFile(new URL('../qa/roleplay/scenarios.json', import.meta.url), 'utf8'),
);

test('roleplay fixture has 20–50 scenarios and every secret belongs to the target core', () => {
  assert.ok(data.scenarios.length >= 20 && data.scenarios.length <= 50);
  assert.equal(new Set(data.scenarios.map((scenario) => scenario.id)).size, data.scenarios.length);
  for (const scenario of data.scenarios) {
    const world = data.worlds[scenario.world];
    assert.ok(world, `${scenario.id}: world`);
    assert.ok(world.members.length >= 2 && world.members.length <= 3);
    for (const turn of scenario.turns) {
      const member = world.members.find((candidate) => candidate.name === turn.target);
      assert.ok(member, `${scenario.id}: target ${turn.target}`);
      for (const secret of turn.expect?.secrets ?? []) {
        assert.ok(member.core.includes(secret), `${scenario.id}: secret not in ${member.name} core`);
      }
    }
    for (const row of scenario.opening) {
      assert.ok(
        row.speaker === world.owner.name || world.members.some((member) => member.name === row.speaker),
        `${scenario.id}: opening speaker ${row.speaker}`,
      );
    }
  }
});

test('roleplay prompts are layered, cache-stable, and keep secrets out of the system prefix', () => {
  for (const scenario of data.scenarios) {
    const hydrated = hydrateRoleplayWorld(data.worlds[scenario.world]);
    const active = roleplayOpeningMessages(scenario, hydrated);
    const systems = new Set();
    const allSecrets = scenario.turns.flatMap((turn) => turn.expect?.secrets ?? []);
    for (const [index, turn] of scenario.turns.entries()) {
      const member = hydrated.members.find((candidate) => candidate.name === turn.target);
      active.push({
        id: `m_user_${index}`,
        turnId: `turn_${index}`,
        replyIndex: 0,
        ts: active.length,
        role: 'user',
        memberId: null,
        text: turn.user,
        mentions: [],
        mentionsOwner: false,
        pinned: false,
      });
      const prompt = buildPrompt({
        group: hydrated.group,
        members: hydrated.members,
        activeMessages: active,
        member,
        sourceUserText: turn.user,
        replyIndex: 1,
        previousName: hydrated.ownerName,
        routeRole: 'addressed',
      });
      systems.add(prompt.system);
      const tail = prompt.messages.at(-1).content[0].text;
      for (const heading of ['角色核心', '你与在场者的关系', '本场状态', '本轮任务', '角色提醒']) {
        assert.match(tail, new RegExp(`=== ${heading} ===`), `${scenario.id}: ${heading}`);
      }
      assert.ok(tail.includes(member.core), `${scenario.id}: own core missing`);
      assert.ok(prompt.messages.length >= 2, `${scenario.id}: history missing`);
      for (const secret of allSecrets) assert.equal(prompt.system.includes(secret), false);
      assert.equal(prompt.system.includes('秘密：'), false);
      for (const other of hydrated.members.filter((candidate) => candidate.id !== member.id)) {
        assert.equal(tail.includes(other.core), false, `${scenario.id}: leaked ${other.name} core`);
      }
      // Keep the synthetic history growing so later turns exercise folding and
      // the "你最近说过" block.
      active.push({
        id: `m_reply_${index}`,
        turnId: `turn_${index}`,
        replyIndex: 1,
        ts: active.length,
        role: 'member',
        memberId: member.id,
        text: '（模拟回复）',
        mentions: [],
        mentionsOwner: false,
        pinned: false,
      });
    }
    assert.equal(systems.size, 1, `${scenario.id}: system prefix changed across turns`);
  }
});

test('objective reply checks catch secrets, length, impersonation, and missing terms', () => {
  const members = [
    { id: 'c_lin', name: '林晚' },
    { id: 'c_zhou', name: '周野' },
  ];
  const member = members[0];
  const expect = {
    terms: ['蜡烛', '闸'],
    voice: ['你'],
    avoid: ['我是AI'],
    maxChars: 20,
    secrets: ['停电是你自己拉的闸'],
    minTermScore: 0.5,
  };
  const good = evaluateReply({ text: '蜡烛还有半根。你听见闸响了吗？', expect, member, members });
  assert.equal(good.pass, true);
  assert.equal(good.termScore, 1);

  const leak = evaluateReply({ text: '停电是你自己拉的闸。', expect, member, members });
  assert.equal(leak.pass, false);
  assert.deepEqual(leak.secretHits, ['停电是你自己拉的闸']);

  const long = evaluateReply({ text: '蜡烛。闸。'.repeat(10), expect, member, members });
  assert.equal(long.lengthOk, false);

  const impersonation = evaluateReply({ text: '周野：我去看看。', expect, member, members });
  assert.equal(impersonation.impersonation, true);

  const missing = evaluateReply({ text: '嗯。', expect, member, members });
  assert.equal(missing.termOk, false);
});
