import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildRouterPrompt,
  directNameTargets,
  explicitRoute,
  isContinuationCue,
  parseRouteResponse,
  resolveRoute,
} from '../lib/router.js';
import { hydrateRouterCase } from '../qa/lib/fixtures.mjs';

const data = JSON.parse(
  await readFile(new URL('../qa/router/cases.json', import.meta.url), 'utf8'),
);
const cases = data.cases.map((entry) => hydrateRouterCase(data, entry));

test('router fixture is large enough, schema-valid, and free of duplicate ids', () => {
  assert.ok(cases.length >= 50 && cases.length <= 100, `expected 50–100 cases, got ${cases.length}`);
  assert.ok(new Set(cases.map((entry) => entry.id)).size === cases.length);

  for (const world of Object.values(data.worlds)) {
    assert.ok(world.members.length >= 2 && world.members.length <= 3);
    assert.equal(new Set(world.members.map((member) => member.name)).size, world.members.length);
    assert.equal(world.members.some((member) => member.name === world.owner), false);
  }

  for (const entry of data.cases) {
    const world = data.worlds[entry.world];
    assert.ok(world, `${entry.id}: unknown world`);
    assert.ok(Array.isArray(entry.tags) && entry.tags.length > 0, `${entry.id}: tags`);
    assert.ok(typeof entry.text === 'string' && entry.text.length > 0, `${entry.id}: text`);
    const names = new Set(world.members.map((member) => member.name));
    for (const target of entry.targets ?? []) assert.ok(names.has(target), `${entry.id}: target ${target}`);
    for (const forbidden of entry.forbidden ?? []) {
      assert.ok(names.has(forbidden), `${entry.id}: forbidden ${forbidden}`);
      assert.equal((entry.targets ?? []).includes(forbidden), false, `${entry.id}: target/forbidden overlap`);
    }
    for (const row of entry.history ?? []) {
      assert.ok(row.speaker === world.owner || names.has(row.speaker), `${entry.id}: speaker ${row.speaker}`);
    }
  }
});

test('every deterministic case is resolved by local rules, including negations and emoji', async () => {
  const deterministic = cases.filter((entry) => entry.deterministic);
  assert.ok(deterministic.length >= 60);
  for (const entry of deterministic) {
    const route = await resolveRoute({
      group: entry.group,
      members: entry.members,
      activeMessages: entry.activeMessages,
      userText: entry.text,
    });
    assert.notEqual(route.method, 'fallback', `${entry.id}: unexpectedly fell back`);
    assert.deepEqual(route.targets, entry.expected, `${entry.id}: ${entry.text}`);
    assert.equal(route.targets.some((id) => entry.forbiddenIds.includes(id)), false, `${entry.id}: forbidden target`);
  }
});

test('local routing never selects a forbidden target across the whole fixture', async () => {
  for (const entry of cases) {
    const route = await resolveRoute({
      group: entry.group,
      members: entry.members,
      activeMessages: entry.activeMessages,
      userText: entry.text,
    });
    assert.equal(
      route.targets.some((id) => entry.forbiddenIds.includes(id)),
      false,
      `${entry.id}: ${route.targets.join(',')}`,
    );
  }
});

test('owner-direct, plural, negation, emoji, and mixed continuation rules', () => {
  const members = [
    { id: 'c_lin', name: '林晚' },
    { id: 'c_zhou', name: '周野' },
  ];
  assert.equal(explicitRoute('阿明，你怎么看', members, '阿明').ownerOnly, true);
  assert.equal(explicitRoute('阿明呢？', members, '阿明').ownerOnly, true);
  assert.equal(explicitRoute('阿明刚才说得对', members, '阿明').ownerOnly, false);
  assert.deepEqual(explicitRoute('你俩商量一下', members, '阿明').targets, ['c_lin', 'c_zhou']);
  assert.deepEqual(directNameTargets('林晚🙂 你怎么看', members), ['c_lin']);
  assert.deepEqual(directNameTargets('林晚……你怎么看', members), ['c_lin']);
  assert.deepEqual(directNameTargets('我不是问周野，我是问林晚，你怎么看', members), ['c_lin']);
  assert.deepEqual(directNameTargets('周野，不是问你，林晚你说', members), ['c_lin']);
  assert.equal(isContinuationCue('好，继续'), true);
  assert.equal(isContinuationCue('好，继续讨论一下预算'), false);
});

test('the router prompt never carries private cores and stays parseable under fences', () => {
  const entry = cases.find((candidate) => candidate.id === 'model-who-door');
  const prompt = buildRouterPrompt({
    group: entry.group,
    members: entry.members.map((member, index) => ({
      ...member,
      core: `秘密${index}：不要告诉别人`,
    })),
    activeMessages: entry.activeMessages,
    userText: entry.text,
  });
  assert.match(prompt.system, /id=c_0/);
  assert.doesNotMatch(prompt.system, /秘密0/);
  const parsed = parseRouteResponse(
    '说明\n```json\n{"targets":["c_1","c_1","c_404"],"reason":"ok","confidence":2}\n```\n结束',
    entry.members,
    3,
  );
  assert.deepEqual(parsed.targets, ['c_1']);
  assert.equal(parsed.confidence, 1);
});
