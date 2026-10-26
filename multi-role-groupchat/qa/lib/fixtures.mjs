/**
 * Shared fixture hydration for router and roleplay QA runners/tests.
 *
 * Keeping this deterministic means a fixture can be scored by the local test
 * suite without importing a CLI module (which would run `main()`).
 */

import { DEFAULT_POLICY } from '../../lib/protocol.js';

/**
 * Hydrate one router case into the shapes expected by `resolveRoute`.
 *
 * @param {object} data - whole cases fixture.
 * @param {object} entry - one case.
 * @returns {object} hydrated case.
 */
export function hydrateRouterCase(data, entry) {
  const world = data.worlds[entry.world];
  if (world === undefined) throw new Error(`未知 world：${entry.world}`);
  const members = world.members.map((member, index) => ({
    id: `c_${index}`,
    name: member.name,
    public: { oneLiner: member.oneLiner, relations: {} },
    core: '',
    extended: '',
    extendedEnabled: false,
    model: null,
  }));
  const byName = new Map(members.map((member) => [member.name, member.id]));
  const activeMessages = (entry.history ?? []).map((row, index) => ({
    id: `m_${index}`,
    turnId: 'qa_turn',
    replyIndex: 0,
    ts: index,
    role: row.speaker === world.owner ? 'user' : 'member',
    memberId: byName.get(row.speaker) ?? null,
    text: row.text,
    mentions: [],
    mentionsOwner: false,
    replyTo: null,
    status: 'active',
    supersedes: null,
    pinned: false,
    usage: null,
  }));
  activeMessages.push({
    id: 'm_user',
    turnId: 'qa_turn',
    replyIndex: 0,
    ts: activeMessages.length,
    role: 'user',
    memberId: null,
    text: entry.text,
    mentions: [],
    mentionsOwner: false,
    replyTo: null,
    status: 'active',
    supersedes: null,
    pinned: false,
    usage: null,
  });
  const group = {
    id: `qa_${entry.world}`,
    name: world.name,
    brief: world.brief,
    owner: { name: world.owner, oneLiner: world.ownerOneLiner, setting: '', avatar: null, relations: {} },
    memberIds: members.map((member) => member.id),
    // Keep the evaluation cap at 3 so plural cases score the intended target
    // set; production's default cap is covered by its own unit tests.
    policy: { ...DEFAULT_POLICY, maxMentionReplies: 3, bystanderChance: 0 },
    budget: { maxInputTokens: 0, maxOutputTokens: 0 },
    model: null,
    createdAt: 0,
    updatedAt: 0,
  };
  return {
    ...entry,
    group,
    members,
    activeMessages,
    expected: (entry.targets ?? []).map((name) => {
      const id = byName.get(name);
      if (id === undefined) throw new Error(`${entry.id}: 未知 target ${name}`);
      return id;
    }),
    forbiddenIds: (entry.forbidden ?? []).map((name) => {
      const id = byName.get(name);
      if (id === undefined) throw new Error(`${entry.id}: 未知 forbidden ${name}`);
      return id;
    }),
  };
}

/**
 * Hydrate one roleplay world into group/member documents.
 * @param {object} world - world fixture.
 * @returns {{group: object, members: Array<object>, byName: Map<string, string>, ownerName: string}} hydrated world.
 */
export function hydrateRoleplayWorld(world) {
  const members = world.members.map((member, index) => ({
    id: `c_${index}`,
    name: member.name,
    avatar: null,
    public: {
      oneLiner: member.oneLiner,
      relations: mapRelations(member.relations, member.name, world.members),
    },
    core: member.core,
    extended: member.extended ?? '',
    extendedEnabled: member.extendedEnabled === true,
    model: null,
  }));
  const byName = new Map(members.map((member) => [member.name, member.id]));
  const group = {
    id: `qa_${world.name}`,
    name: world.name,
    brief: world.brief,
    owner: {
      name: world.owner.name,
      oneLiner: world.owner.oneLiner,
      setting: world.owner.setting,
      avatar: null,
      relations: {},
    },
    memberIds: members.map((member) => member.id),
    policy: { ...DEFAULT_POLICY, maxReplyChars: 300, bystanderChance: 0 },
    budget: { maxInputTokens: 0, maxOutputTokens: 0 },
    model: null,
    createdAt: 0,
    updatedAt: 0,
  };
  return { group, members, byName, ownerName: world.owner.name };
}

/**
 * Map name-keyed fixture relations onto member ids.
 * @param {Record<string,string>|undefined} relations - name map.
 * @param {string} selfName - speaker name.
 * @param {Array<{name: string}>} members - member fixtures.
 * @returns {Record<string,string>} id map.
 */
export function mapRelations(relations, selfName, members) {
  const byName = new Map(members.map((member, index) => [member.name, `c_${index}`]));
  const result = {};
  for (const [name, text] of Object.entries(relations ?? {})) {
    if (name === selfName) continue;
    const id = byName.get(name);
    if (id !== undefined) result[id] = text;
  }
  return result;
}

/**
 * Build the initial message list from a scenario opening.
 * @param {object} scenario - scenario fixture.
 * @param {ReturnType<typeof hydrateRoleplayWorld>} hydrated - world.
 * @returns {Array<object>} active messages.
 */
export function roleplayOpeningMessages(scenario, hydrated) {
  return scenario.opening.map((row, index) => {
    const isOwner = row.speaker === hydrated.ownerName;
    return {
      id: `m_open_${index}`,
      turnId: 'opening',
      replyIndex: 0,
      ts: index,
      role: isOwner ? 'user' : 'member',
      memberId: isOwner ? null : hydrated.byName.get(row.speaker) ?? null,
      text: row.text,
      mentions: [],
      mentionsOwner: false,
      replyTo: null,
      status: 'active',
      supersedes: null,
      pinned: false,
      usage: null,
    };
  });
}
