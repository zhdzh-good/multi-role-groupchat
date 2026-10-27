/**
 * Durable group storage under the plugin's own data directory.
 *
 * Layout:
 *   characters/<cid>/card.json
 *   characters/<cid>/setting/core.md
 *   characters/<cid>/setting/extended.md
 *   characters/<cid>/setting/memory.md
 *   groups/<gid>/group.json          # characterIds + owner + policy
 *   groups/<gid>/events.jsonl
 *   groups/<gid>/export/script.md
 *
 * Legacy v1 groups keep `groups/<gid>/members/` on disk for rollback after
 * their first load moves the records into the global character library.
 */

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_OWNER_NAME,
  SETTING_LIMITS,
  applyEvent,
  createState,
  normalizeBudget,
  normalizeModel,
  normalizePolicy,
  normalizeUsage,
  ownerDisplayName,
  ownerProfile,
  replayEvents,
  selectHistory,
  speakerName,
  validateMemberName,
  validateOwnerName,
} from './protocol.js';

const GROUP_ID = /^g_[A-Za-z0-9]{4,40}$/;
const MEMBER_ID = /^c_[A-Za-z0-9]{4,40}$/;
const CHARACTER_ID = MEMBER_ID;
const SCHEMA_VERSION = 2;

/** Largest accepted single setting file; the plan warns well below this. */
const MAX_SETTING_CHARS = 20000;

/** Optional voice/style note injected only for the speaking member. */
const MAX_STYLE_CHARS = 300;

/** Private, manually curated memory; never enters shared prompts or exports by default. */
const MAX_MEMORY_CHARS = 4000;

/**
 * The plugin's data directory. `DSH_HOME` is set by a profile-launched
 * Harness; the fallback keeps a bare `dsh` launch working.
 * @returns {string} absolute directory.
 */
export function defaultDataDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'plugin-data', 'multi-role-groupchat');
}

/**
 * Error with an HTTP-ish status used by the route layer.
 */
export class GroupChatError extends Error {
  /**
   * @param {string} message - user-facing message.
   * @param {number} [status] - HTTP status code.
   * @param {string} [code] - stable machine code.
   */
  constructor(message, status = 400, code = 'groupchat/invalid') {
    super(message);
    this.name = 'GroupChatError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Create one random id.
 * @param {string} prefix - `g`, `c`, `m`, `e`, or `n`.
 * @returns {string} id.
 */
export function makeId(prefix) {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

/**
 * Filesystem-backed store for groups, members, and event logs.
 */
export class GroupStore {
  /**
   * @param {string} [root] - data directory.
   */
  constructor(root = defaultDataDir()) {
    this.root = root;
    this.groups = new Map();
    this.loading = new Map();
    this.queues = new Map();
    this.turns = new Map();
  }

  /** @returns {Promise<void>} creates the data layout. */
  async init() {
    await fs.mkdir(path.join(this.root, 'groups'), { recursive: true });
    await fs.mkdir(path.join(this.root, 'characters'), { recursive: true });
  }

  /** @returns {string} global character directory. */
  charactersDir() {
    return path.join(this.root, 'characters');
  }

  /**
   * Global character directory for one id.
   * @param {string} cid - character id.
   * @returns {string} directory.
   */
  characterDir(cid) {
    if (!CHARACTER_ID.test(cid)) throw new GroupChatError('角色 id 无效。', 400, 'groupchat/bad-character-id');
    return path.join(this.charactersDir(), cid);
  }

  /**
   * Groups directory for one id.
   * @param {string} gid - group id.
   * @returns {string} directory.
   */
  dirOf(gid) {
    if (!GROUP_ID.test(gid)) throw new GroupChatError('群 id 无效。', 400, 'groupchat/bad-group-id');
    return path.join(this.root, 'groups', gid);
  }

  /**
   * List every global character with the groups that reference it.
   * @returns {Promise<Array<object>>} characters sorted by name.
   */
  async listCharacters() {
    await this.init();
    const usage = await this.#characterUsageMap();
    const entries = await fs.readdir(this.charactersDir(), { withFileTypes: true });
    const characters = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !CHARACTER_ID.test(entry.name)) continue;
      const character = await readCharacter(this.charactersDir(), entry.name);
      if (character.missing) continue;
      characters.push({
        ...character,
        usageGroups: usage.get(entry.name) ?? [],
      });
    }
    characters.sort((left, right) => left.name.localeCompare(right.name, 'zh') || left.id.localeCompare(right.id));
    return characters;
  }

  /**
   * Map character id to the groups that reference it.
   * @returns {Promise<Map<string, Array<{id: string, name: string}>>>} usage map.
   */
  async #characterUsageMap() {
    const result = new Map();
    const groupsDir = path.join(this.root, 'groups');
    let entries;
    try {
      entries = await fs.readdir(groupsDir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return result;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !GROUP_ID.test(entry.name)) continue;
      const raw = await readJson(path.join(groupsDir, entry.name, 'group.json'));
      if (raw === null) continue;
      const ids = Array.isArray(raw.characterIds)
        ? raw.characterIds
        : Array.isArray(raw.memberIds) ? raw.memberIds : [];
      for (const id of ids) {
        if (typeof id !== 'string' || !CHARACTER_ID.test(id)) continue;
        const list = result.get(id) ?? [];
        list.push({ id: entry.name, name: typeof raw.name === 'string' ? raw.name : '未命名群聊' });
        result.set(id, list);
      }
    }
    return result;
  }

  /**
   * Delete one global character. Characters used by a group are protected.
   * @param {string} cid - character id.
   * @returns {Promise<void>} completion.
   */
  async deleteCharacter(cid) {
    const character = await readCharacter(this.charactersDir(), cid);
    if (character.missing) throw new GroupChatError('角色不存在。', 404, 'groupchat/character-not-found');
    const usage = (await this.#characterUsageMap()).get(cid) ?? [];
    if (usage.length > 0) {
      throw new GroupChatError(
        `角色“${character.name}”还在群 ${usage.map((group) => group.name).join('、')} 里，请先从这些群移除。`,
        409,
        'groupchat/character-in-use',
      );
    }
    await fs.rm(this.characterDir(cid), { recursive: true, force: true });
    this.groups.clear();
  }

  /**
   * List groups with summary counts and token totals.
   * @returns {Promise<Array<object>>} summaries sorted by recent activity.
   */
  async listGroups() {
    await this.init();
    const entries = await fs.readdir(path.join(this.root, 'groups'), { withFileTypes: true });
    const summaries = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !GROUP_ID.test(entry.name)) continue;
      try {
        const state = await this.load(entry.name);
        summaries.push(this.summaryOf(state));
      } catch (error) {
        this.logWarn(`群 ${entry.name} 无法读取：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    summaries.sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
    return summaries;
  }

  /**
   * Load one group into memory, replaying its event log once.
   * @param {string} gid - group id.
   * @returns {Promise<object>} live state.
   */
  async load(gid) {
    const cached = this.groups.get(gid);
    if (cached !== undefined) return cached;
    const pending = this.loading.get(gid);
    if (pending !== undefined) return pending;
    const task = this.#load(gid).finally(() => {
      this.loading.delete(gid);
    });
    this.loading.set(gid, task);
    return task;
  }

  /**
   * @param {string} gid - group id.
   * @returns {Promise<object>} live state.
   */
  async #load(gid) {
    const dir = this.dirOf(gid);
    const groupRaw = await readJson(path.join(dir, 'group.json'));
    if (groupRaw === null) throw new GroupChatError(`群 ${gid} 不存在。`, 404, 'groupchat/group-not-found');
    if (typeof groupRaw.schemaVersion === 'number' && groupRaw.schemaVersion > SCHEMA_VERSION) {
      throw new GroupChatError(
        `群 ${gid} 的 schemaVersion 是 ${groupRaw.schemaVersion}，高于本插件支持的 ${SCHEMA_VERSION}。请升级插件或迁移数据。`,
        409,
        'groupchat/schema-version',
      );
    }
    const warnings = [];
    let group = normalizeGroup(groupRaw, gid);
    if (!Array.isArray(groupRaw.characterIds) || groupRaw.characterIds.length === 0 || group.schemaVersion < 2) {
      const migration = await this.#migrateGroupV1(gid, dir, group);
      group = migration.group;
      warnings.push(...migration.warnings);
    }
    const members = [];
    for (const characterId of group.characterIds) {
      members.push(await readCharacter(this.charactersDir(), characterId));
    }
    const events = await readEvents(path.join(dir, 'events.jsonl'), warnings);
    const state = replayEvents(events);
    const live = {
      gid,
      dir,
      group,
      members,
      state,
      warnings,
    };
    this.groups.set(gid, live);
    return live;
  }

  /**
   * Move a v1 group's per-group member directories into the global character
   * library. The old files are left in place for rollback; the group document
   * switches to `characterIds` only after every character write succeeds.
   * @param {string} gid - group id.
   * @param {string} dir - group directory.
   * @param {object} group - normalized v1 group.
   * @returns {Promise<{group: object, warnings: string[]}>} migrated group.
   */
  async #migrateGroupV1(gid, dir, group) {
    const warnings = [];
    const characterIds = [];
    const legacyDir = path.join(dir, 'members');
    for (const memberId of group.memberIds) {
      const legacy = await readCharacterAt(legacyDir, memberId);
      if (legacy.missing) {
        warnings.push(`迁移时找不到成员 ${memberId}，已跳过。`);
        continue;
      }
      const existing = await readCharacter(this.charactersDir(), memberId);
      if (existing.missing) {
        await writeCharacterAt(this.characterDir(memberId), legacy);
      } else if (existing.name !== legacy.name) {
        warnings.push(`角色 ${memberId} 已存在且名字不同，复用全局档案“${existing.name}”。`);
      }
      characterIds.push(memberId);
    }
    if (characterIds.length === 0) {
      throw new GroupChatError(`群 ${gid} 没有可迁移的成员。`, 409, 'groupchat/migration-empty');
    }
    const next = {
      ...group,
      schemaVersion: SCHEMA_VERSION,
      characterIds,
      memberIds: characterIds,
      migratedFromV1: true,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    await writeJson(path.join(dir, 'group.json'), next);
    return { group: next, warnings };
  }

  /**
   * Invalidate one cached group (used after deleting or external edits).
   * @param {string} gid - group id.
   * @returns {void}
   */
  invalidate(gid) {
    this.groups.delete(gid);
  }

  /**
   * Summary row for the group switcher.
   * @param {object} live - live state.
   * @returns {object} summary.
   */
  summaryOf(live) {
    const last = live.state.active[live.state.active.length - 1];
    return {
      id: live.group.id,
      name: live.group.name,
      brief: live.group.brief,
      memberCount: live.members.length,
      messageCount: live.state.active.length,
      totals: live.state.totals,
      lastMessageAt: last?.ts ?? 0,
      lastMessageText: previewText(last?.text),
      lastMessageSpeaker: last === undefined ? '' : speakerName(last, live.members, ownerDisplayName(live.group)),
      updatedAt: live.group.updatedAt ?? 0,
    };
  }

  /**
   * Create a group from the onboarding form.
   * @param {{name: string, brief?: string, members: Array<object>, owner?: object, policy?: object, budget?: object, model?: object|null}} input - creation data.
   * @returns {Promise<object>} created live state.
   */
  async createGroup(input) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (name.length === 0) throw new GroupChatError('群名不能为空。');
    if ([...name].length > 40) throw new GroupChatError('群名最多 40 个字符。');
    const brief = typeof input.brief === 'string' ? input.brief : '';
    if ([...brief].length > 2000) throw new GroupChatError('群简介最多 2000 个字符。');

    const requestedIds = Array.isArray(input?.characterIds)
      ? [...new Set(input.characterIds.filter((id) => typeof id === 'string' && CHARACTER_ID.test(id)))]
      : [];
    const drafts = Array.isArray(input?.members) ? input.members : [];
    if (requestedIds.length === 0 && (drafts.length < 2 || drafts.length > 3)) {
      throw new GroupChatError('首版需要 2–3 个成员。');
    }
    if (requestedIds.length > 0 && (requestedIds.length < 2 || requestedIds.length > 3)) {
      throw new GroupChatError('一个群需要 2–3 个角色。');
    }

    const characters = [];
    const createdCharacterIds = [];
    if (requestedIds.length > 0) {
      for (const id of requestedIds) {
        const character = await readCharacter(this.charactersDir(), id);
        if (character.missing) throw new GroupChatError(`角色 ${id} 不存在。`, 404, 'groupchat/character-not-found');
        characters.push(character);
      }
    } else {
      const seen = [];
      for (const draft of drafts) {
        const validation = validateMemberName(draft?.name, seen);
        if (!validation.ok) throw new GroupChatError(validation.message);
        const id = makeId('c');
        const character = characterFromDraft(draft, id, validation.name);
        characters.push(character);
        createdCharacterIds.push(id);
        seen.push({ id, name: validation.name });
      }
    }

    const owner = normalizeOwner(
      input.owner ?? {},
      characters.map((character) => ({ id: character.id, name: character.name })),
    );
    const seenNames = new Set();
    for (const character of characters) {
      if (seenNames.has(character.name)) throw new GroupChatError(`角色名“${character.name}”重复。`);
      if (character.name === owner.name) throw new GroupChatError(`角色已经叫“${owner.name}”，成员不能与角色重名。`);
      seenNames.add(character.name);
    }

    const gid = makeId('g');
    const now = Math.floor(Date.now() / 1000);
    const characterIds = characters.map((character) => character.id);
    const group = {
      schemaVersion: SCHEMA_VERSION,
      id: gid,
      name,
      brief,
      owner,
      characterIds,
      memberIds: characterIds,
      policy: normalizePolicy(input.policy),
      model: normalizeModel(input.model),
      budget: normalizeBudget(input.budget),
      createdAt: now,
      updatedAt: now,
    };
    const dir = this.dirOf(gid);
    try {
      await fs.mkdir(dir, { recursive: true });
      for (const character of characters) {
        if (createdCharacterIds.includes(character.id)) {
          await writeCharacterAt(this.characterDir(character.id), character);
        }
      }
      await writeText(path.join(dir, 'events.jsonl'), '');
      await writeJson(path.join(dir, 'group.json'), group);
    } catch (error) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      for (const id of createdCharacterIds) {
        await fs.rm(this.characterDir(id), { recursive: true, force: true }).catch(() => {});
      }
      throw error;
    }
    this.groups.clear();
    return this.load(gid);
  }

  /**
   * Create a new group from a normalized portable import descriptor.
   *
   * Relations arrive keyed by member display name; this method creates the
   * group first (which assigns fresh ids), then maps relations onto those ids.
   * The group is removed if a later write fails, so a rejected import never
   * leaves a half-created group behind.
   *
   * @param {object} input - normalized import descriptor from `portable.js`.
   * @returns {Promise<object>} imported live state.
   */
  async importGroup(input) {
    const memberDrafts = input.members.map((member) => ({
      name: member.name,
      oneLiner: member.oneLiner,
      core: member.core,
      style: member.style ?? '',
      memory: member.memory ?? '',
    }));
    const live = await this.createGroup({
      name: input.name,
      brief: input.brief,
      owner: {
        name: input.owner.name,
        oneLiner: input.owner.oneLiner,
        setting: input.owner.setting,
        avatar: input.owner.avatar,
        relations: {},
      },
      members: memberDrafts,
      policy: input.policy,
      budget: input.budget,
      model: input.model,
    });
    const importedCharacterIds = live.members.map((member) => member.id);
    try {
      const byName = new Map(live.members.map((member) => [member.name, member.id]));
      for (const member of input.members) {
        await this.saveMember(live.gid, {
          memberId: byName.get(member.name),
          name: member.name,
          oneLiner: member.oneLiner,
          avatar: member.avatar,
          relations: mapRelationNames(member.relations, byName, member.name),
          privateRelations: mapRelationNames(member.privateRelations, byName, member.name),
          style: member.style ?? '',
          memory: member.memory ?? '',
          core: member.core,
          extended: member.extended,
          extendedEnabled: member.extendedEnabled,
          model: member.model,
        });
      }
      await this.updateGroup(live.gid, {
        owner: {
          name: input.owner.name,
          oneLiner: input.owner.oneLiner,
          setting: input.owner.setting,
          avatar: input.owner.avatar,
          relations: mapRelationNames(input.owner.relations, byName, null),
        },
      });
      return this.load(live.gid);
    } catch (error) {
      await this.deleteGroup(live.gid).catch(() => {});
      for (const id of importedCharacterIds) await this.deleteCharacter(id).catch(() => {});
      throw error;
    }
  }

  /**
   * Merge editable group fields.
   * @param {string} gid - group id.
   * @param {object} patch - name, brief, policy, model, budget.
   * @returns {Promise<object>} updated live state.
   */
  async updateGroup(gid, patch) {
    const live = await this.load(gid);
    const group = live.group;
    if (patch?.name !== undefined) {
      const name = typeof patch.name === 'string' ? patch.name.trim() : '';
      if (name.length === 0) throw new GroupChatError('群名不能为空。');
      if ([...name].length > 40) throw new GroupChatError('群名最多 40 个字符。');
      group.name = name;
    }
    if (patch?.brief !== undefined) {
      if (typeof patch.brief !== 'string') throw new GroupChatError('群简介必须是文本。');
      if ([...patch.brief].length > 2000) throw new GroupChatError('群简介最多 2000 个字符。');
      group.brief = patch.brief;
    }
    if (patch?.owner !== undefined) {
      const candidate = { ...ownerProfile(group), ...(patch.owner ?? {}) };
      group.owner = normalizeOwner(candidate, live.members);
    }
    if (patch?.policy !== undefined) group.policy = normalizePolicy(patch.policy);
    if (patch?.budget !== undefined) group.budget = normalizeBudget(patch.budget);
    if (patch?.model !== undefined) group.model = normalizeModel(patch.model);
    group.updatedAt = Math.floor(Date.now() / 1000);
    await writeJson(path.join(live.dir, 'group.json'), group);
    return live;
  }

  /**
   * Permanently delete one group directory after its writes settle.
   *
   * Active generations are refused rather than silently aborted: deleting the
   * directory under a writer would leave the turn's own append queue pointing
   * at a missing path.
   *
   * @param {string} gid - group id.
   * @returns {Promise<void>} completion after the directory is gone.
   */
  async deleteGroup(gid) {
    const live = await this.load(gid);
    if (this.turns.has(gid)) {
      throw new GroupChatError('这个群正在生成，请先停止当前回应再删除。', 409, 'groupchat/busy');
    }
    const queue = this.queues.get(gid);
    if (queue !== undefined) {
      await queue.catch(() => {});
    }
    await fs.rm(live.dir, { recursive: true, force: true });
    this.groups.delete(gid);
    this.queues.delete(gid);
    this.loading.delete(gid);
  }

  /**
   * Create or update one global character. Characters are library assets; a
   * group only stores their ids, so editing here affects every group that
   * references the character.
   * @param {object} input - character fields; `id` edits, omission creates.
   * @returns {Promise<object>} saved character document.
   */
  async saveCharacter(input) {
    const id = typeof input?.id === 'string' && CHARACTER_ID.test(input.id) ? input.id : null;
    const existing = id === null ? null : await readCharacter(this.charactersDir(), id);
    if (id !== null && existing?.missing) throw new GroupChatError('角色不存在。', 404, 'groupchat/character-not-found');

    const validation = validateMemberName(input?.name ?? existing?.name, [], id);
    if (!validation.ok) throw new GroupChatError(validation.message);

    // A rename must not collide with another character or the owner in any
    // group that already references this character.
    if (id !== null && validation.name !== existing.name) {
      const usage = (await this.#characterUsageMap()).get(id) ?? [];
      for (const group of usage) {
        const raw = await readJson(path.join(this.dirOf(group.id), 'group.json'));
        if (raw === null) continue;
        const ids = Array.isArray(raw.characterIds) ? raw.characterIds : raw.memberIds ?? [];
        for (const otherId of ids) {
          if (otherId === id) continue;
          const other = await readCharacter(this.charactersDir(), otherId);
          if (!other.missing && other.name === validation.name) {
            throw new GroupChatError(`群“${group.name}”里已经有角色叫“${validation.name}”。`);
          }
        }
        const ownerName = ownerDisplayName({ owner: raw.owner });
        if (ownerName === validation.name) throw new GroupChatError(`群“${group.name}”的角色叫“${ownerName}”，成员不能重名。`);
      }
    }

    const oneLiner = typeof input?.oneLiner === 'string' ? input.oneLiner.trim() : existing?.public?.oneLiner ?? '';
    if ([...oneLiner].length > 400) throw new GroupChatError('一句话档案最多 400 个字符。');
    const style = typeof input?.style === 'string' ? input.style.trim() : existing?.style ?? '';
    if ([...style].length > MAX_STYLE_CHARS) throw new GroupChatError(`说话方式最多 ${MAX_STYLE_CHARS} 个字符。`);
    const memory = typeof input?.memory === 'string' ? input.memory : existing?.memory ?? '';
    if ([...memory].length > MAX_MEMORY_CHARS) throw new GroupChatError(`私有记忆最多 ${MAX_MEMORY_CHARS} 个字符。`);
    const core = typeof input?.core === 'string' ? input.core : existing?.core ?? '';
    const extended = typeof input?.extended === 'string' ? input.extended : existing?.extended ?? '';
    if ([...core].length > MAX_SETTING_CHARS) throw new GroupChatError(`核心设定最多 ${MAX_SETTING_CHARS} 个字符。`);
    if ([...extended].length > MAX_SETTING_CHARS) throw new GroupChatError(`扩展设定最多 ${MAX_SETTING_CHARS} 个字符。`);

    const validIds = await this.#characterIdSet();
    const relations = {};
    const relationSource = input?.relations === undefined ? existing?.public?.relations : input.relations;
    if (relationSource !== null && typeof relationSource === 'object' && !Array.isArray(relationSource)) {
      for (const [otherId, text] of Object.entries(relationSource)) {
        if (otherId === id || !validIds.has(otherId)) continue;
        if (typeof text !== 'string' || text.trim().length === 0) continue;
        if ([...text].length > 200) throw new GroupChatError('单条关系描述最多 200 个字符。');
        relations[otherId] = text.trim();
      }
    }
    const privateRelations = {};
    const privateSource = input?.privateRelations === undefined ? existing?.privateRelations : input.privateRelations;
    if (privateSource !== null && typeof privateSource === 'object' && !Array.isArray(privateSource)) {
      for (const [otherId, text] of Object.entries(privateSource)) {
        if (otherId === id || !validIds.has(otherId)) continue;
        if (typeof text !== 'string' || text.trim().length === 0) continue;
        if ([...text].length > 200) throw new GroupChatError('单条私人关系描述最多 200 个字符。');
        privateRelations[otherId] = text.trim();
      }
    }

    const character = {
      schemaVersion: SCHEMA_VERSION,
      id: id ?? makeId('c'),
      name: validation.name,
      avatar: typeof input?.avatar === 'string' ? input.avatar : existing?.avatar ?? null,
      public: { oneLiner, relations },
      privateRelations,
      style,
      extendedEnabled: input?.extendedEnabled === undefined
        ? existing?.extendedEnabled === true
        : input.extendedEnabled === true,
      model: input?.model === undefined ? existing?.model ?? null : normalizeModel(input.model),
      core,
      extended,
      memory,
      missing: false,
    };
    await writeCharacterAt(this.characterDir(character.id), character);
    this.groups.clear();
    return character;
  }

  /**
   * Character ids currently available in the global library.
   * @returns {Promise<Set<string>>} ids.
   */
  async #characterIdSet() {
    await this.init();
    const entries = await fs.readdir(this.charactersDir(), { withFileTypes: true });
    return new Set(entries.filter((entry) => entry.isDirectory() && CHARACTER_ID.test(entry.name)).map((entry) => entry.name));
  }

  /**
   * Add existing characters to a group.
   * @param {string} gid - group id.
   * @param {string[]} ids - character ids.
   * @returns {Promise<object>} updated live state.
   */
  async addGroupCharacters(gid, ids) {
    const live = await this.load(gid);
    const current = [...live.group.characterIds];
    for (const id of Array.isArray(ids) ? ids : []) {
      if (typeof id !== 'string' || !CHARACTER_ID.test(id) || current.includes(id)) continue;
      current.push(id);
    }
    return this.#setGroupCharacters(gid, current);
  }

  /**
   * Remove one character from a group. The global character is not deleted.
   * @param {string} gid - group id.
   * @param {string} cid - character id.
   * @returns {Promise<object>} updated live state.
   */
  async removeGroupCharacter(gid, cid) {
    const live = await this.load(gid);
    const current = live.group.characterIds.filter((id) => id !== cid);
    return this.#setGroupCharacters(gid, current);
  }

  /**
   * Replace a group's character roster after validating count, uniqueness,
   * names, and the owner collision.
   * @param {string} gid - group id.
   * @param {string[]} ids - character ids.
   * @returns {Promise<object>} updated live state.
   */
  async #setGroupCharacters(gid, ids) {
    const live = await this.load(gid);
    const unique = [...new Set(ids)];
    if (unique.length < 2 || unique.length > 3) throw new GroupChatError('一个群需要 2–3 个角色。');
    const characters = [];
    for (const id of unique) {
      const character = await readCharacter(this.charactersDir(), id);
      if (character.missing) throw new GroupChatError(`角色 ${id} 不存在。`, 404, 'groupchat/character-not-found');
      characters.push(character);
    }
    const seen = new Set();
    const ownerName = ownerDisplayName(live.group);
    for (const character of characters) {
      if (seen.has(character.name)) throw new GroupChatError(`角色名“${character.name}”重复。`);
      if (character.name === ownerName) throw new GroupChatError(`角色已经叫“${ownerName}”，成员不能与角色重名。`);
      seen.add(character.name);
    }
    live.group.characterIds = unique;
    live.group.memberIds = unique;
    live.group.updatedAt = Math.floor(Date.now() / 1000);
    await writeJson(path.join(live.dir, 'group.json'), live.group);
    this.groups.clear();
    return this.load(gid);
  }

  /**
   * Create or update one member in a group's roster. Kept as the group-scoped
   * compatibility API; the character itself is global.
   * @param {string} gid - group id.
   * @param {object} input - member fields.
   * @returns {Promise<object>} saved character document.
   */
  async saveMember(gid, input) {
    const live = await this.load(gid);
    const memberId = typeof input?.memberId === 'string' ? input.memberId : null;
    const existing = memberId === null ? undefined : live.members.find((member) => member.id === memberId);
    if (memberId !== null && existing === undefined) {
      throw new GroupChatError('成员不存在。', 404, 'groupchat/member-not-found');
    }
    if (memberId === null && live.members.length >= 3) {
      throw new GroupChatError('首版一个群最多 3 个成员。');
    }
    const others = live.members.filter((member) => member.id !== memberId);
    const validation = validateMemberName(input?.name ?? existing?.name, others, memberId);
    if (!validation.ok) throw new GroupChatError(validation.message);
    const ownerName = ownerDisplayName(live.group);
    if (validation.name === ownerName) {
      throw new GroupChatError(`角色已经叫“${ownerName}”，成员不能与角色重名。`);
    }
    const saved = await this.saveCharacter({
      ...input,
      ...(memberId === null ? {} : { id: memberId }),
      name: validation.name,
    });
    if (memberId === null) {
      live.group.characterIds.push(saved.id);
      live.group.memberIds = [...live.group.characterIds];
      live.group.updatedAt = Math.floor(Date.now() / 1000);
      await writeJson(path.join(live.dir, 'group.json'), live.group);
      this.groups.clear();
    }
    return saved;
  }

  /**
   * Append a message and make it effective.
   * @param {string} gid - group id.
   * @param {object} message - message event data.
   * @returns {Promise<object>} stored message.
   */
  async appendMessage(gid, message) {
    const live = await this.load(gid);
    const event = {
      type: 'message',
      id: message.id,
      turnId: message.turnId,
      replyIndex: message.replyIndex,
      ts: message.ts,
      role: message.role,
      memberId: message.memberId,
      text: message.text,
      mentions: message.mentions,
      mentionsOwner: message.mentionsOwner === true,
      replyTo: message.replyTo,
      status: 'active',
      supersedes: message.supersedes ?? null,
      usage: normalizeUsage(message.usage),
    };
    await this.#append(live, event);
    return event;
  }

  /**
   * Append a supersede event.
   * @param {string} gid - group id.
   * @param {string} target - superseded message.
   * @param {string} by - replacement message.
   * @returns {Promise<void>} completion.
   */
  async appendSupersede(gid, target, by) {
    const live = await this.load(gid);
    await this.#append(live, { type: 'supersede', id: makeId('e'), ts: Math.floor(Date.now() / 1000), target, by });
  }

  /**
   * Append one routing decision. Route usage is counted in group totals even
   * though it is not a visible chat message.
   * @param {string} gid - group id.
   * @param {object} route - targets, bystanders, method, reason, confidence, usage.
   * @returns {Promise<object>} stored event.
   */
  async appendRoute(gid, route) {
    const live = await this.load(gid);
    const event = {
      type: 'route',
      id: makeId('r'),
      ts: Number.isFinite(route?.ts) ? route.ts : Math.floor(Date.now() / 1000),
      turnId: typeof route?.turnId === 'string' ? route.turnId : null,
      targets: Array.isArray(route?.targets) ? route.targets.filter((id) => typeof id === 'string') : [],
      bystanders: Array.isArray(route?.bystanders) ? route.bystanders.filter((id) => typeof id === 'string') : [],
      method: typeof route?.method === 'string' ? route.method : 'unknown',
      reason: typeof route?.reason === 'string' ? route.reason : '',
      confidence: Number.isFinite(route?.confidence) ? route.confidence : null,
      usage: normalizeUsage(route?.usage),
    };
    await this.#append(live, event);
    return event;
  }

  /**
   * Toggle one message's pin, enforcing the pinned ceiling.
   * @param {string} gid - group id.
   * @param {string} target - message id.
   * @param {boolean} pinned - desired state.
   * @returns {Promise<object>} stored event.
   */
  async setPin(gid, target, pinned) {
    const live = await this.load(gid);
    const message = live.state.byId.get(target);
    if (message === undefined) throw new GroupChatError('消息不存在。', 404, 'groupchat/message-not-found');
    if (message.status !== 'active') throw new GroupChatError('只能钉住有效消息。');
    if (pinned === true) {
      const count = live.state.active.filter((candidate) => candidate.pinned).length;
      if (count >= live.group.policy.maxPinned) {
        throw new GroupChatError(`钉住上限是 ${live.group.policy.maxPinned} 条，请先取消一条。`, 409, 'groupchat/pin-limit');
      }
    }
    const event = {
      type: 'pin',
      id: makeId('e'),
      ts: Math.floor(Date.now() / 1000),
      target,
      pinned: pinned === true,
    };
    await this.#append(live, event);
    return event;
  }

  /**
   * Append one notice. Notices are best effort: the in-memory view updates
   * synchronously, and a failed write is logged rather than failing the turn.
   * @param {string} gid - group id.
   * @param {string} text - notice body.
   * @param {'info'|'warn'} [level] - severity.
   * @returns {object} notice view.
   */
  appendNotice(gid, text, level = 'info') {
    const live = this.groups.get(gid);
    if (live === undefined) throw new GroupChatError('群未加载。', 409);
    const event = {
      type: 'notice',
      id: makeId('n'),
      ts: Math.floor(Date.now() / 1000),
      text,
      level,
    };
    applyEvent(live.state, event);
    this.#enqueue(live, JSON.stringify(event)).catch((error) => {
      this.logWarn(`写入 notice 失败：${error instanceof Error ? error.message : String(error)}`);
    });
    return live.state.notices[live.state.notices.length - 1];
  }

  /**
   * Effective message view for the browser.
   * @param {string} gid - group id.
   * @returns {Promise<object>} state payload.
   */
  async stateView(gid) {
    const live = await this.load(gid);
    return buildStateView(live, this.turns.get(gid));
  }

  /**
   * Resolve one member for generation.
   * @param {string} gid - group id.
   * @param {string} memberId - member id.
   * @returns {Promise<{live: object, member: object}>} resolved member.
   */
  async member(gid, memberId) {
    const live = await this.load(gid);
    const member = live.members.find((candidate) => candidate.id === memberId);
    if (member === undefined) throw new GroupChatError('成员不存在。', 404, 'groupchat/member-not-found');
    return { live, member };
  }

  /**
   * Write one exported Markdown document.
   * @param {string} gid - group id.
   * @param {string} markdown - document.
   * @returns {Promise<string>} absolute file path.
   */
  async writeExport(gid, markdown) {
    const live = await this.load(gid);
    await fs.mkdir(path.join(live.dir, 'export'), { recursive: true });
    const target = path.join(live.dir, 'export', 'script.md');
    await writeText(target, markdown);
    return target;
  }

  /**
   * @param {object} live - live state.
   * @param {object} event - stored event.
   * @returns {Promise<void>} completion after the line is durable.
   */
  async #append(live, event) {
    const line = JSON.stringify(event);
    await this.#enqueue(live, line);
    applyEvent(live.state, event);
  }

  /**
   * Serialize appends per group and fsync them into the log.
   * @param {object} live - live state.
   * @param {string} line - one JSON line without the newline.
   * @returns {Promise<void>} completion.
   */
  #enqueue(live, line) {
    const key = live.gid;
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        await fs.appendFile(path.join(live.dir, 'events.jsonl'), `${line}\n`, 'utf8');
      });
    this.queues.set(key, next);
    return next;
  }

  /**
   * @param {string} message - warning text.
   * @returns {void}
   */
  logWarn(message) {
    console.warn(`[multi-role-groupchat] ${message}`);
  }
}

/**
 * Build the browser state payload for one loaded group.
 * @param {object} live - live state.
 * @param {object|undefined} turn - active turn, when one is running.
 * @returns {object} payload.
 */
export function buildStateView(live, turn) {
  const selection = selectHistory(live.state.active, live.group.policy);
  const ownerName = ownerDisplayName(live.group);
  const owner = ownerProfile(live.group);
  const folded = new Set(selection.folded.map((message) => message.id));
  let turnNumber = 0;
  let turnId = null;
  const messages = live.state.active.map((message) => {
    if (message.turnId !== turnId) {
      turnNumber += 1;
      turnId = message.turnId;
    }
    return {
      ...message,
      memberName: speakerName(message, live.members, ownerName),
      folded: folded.has(message.id),
      turn: turnNumber,
    };
  });
  const latest = live.state.active[live.state.active.length - 1];
  const pinnedCount = live.state.active.filter((message) => message.pinned).length;
  return {
    group: live.group,
    owner,
    members: live.members.map((member) => ({
      id: member.id,
      name: member.name,
      avatar: member.avatar ?? null,
      public: member.public ?? { oneLiner: '', relations: {} },
      privateRelations: member.privateRelations ?? {},
      extendedEnabled: member.extendedEnabled === true,
      model: member.model ?? null,
      style: typeof member.style === 'string' ? member.style : '',
      memory: typeof member.memory === 'string' ? member.memory : '',
      core: member.core ?? '',
      extended: member.extended ?? '',
    })),
    messages,
    notices: live.state.notices.slice(-20),
    totals: live.state.totals,
    foldedCount: folded.size,
    pinnedCount,
    supersededCount: live.state.messages.length - live.state.active.length,
    latestMessageId: latest?.id ?? null,
    latestMemberMessageId: latest?.role === 'member' ? latest.id : null,
    activeTurn: turn === undefined ? null : {
      startedAt: turn.startedAt,
      memberId: turn.memberId ?? null,
      memberName: turn.memberName ?? null,
      phase: turn.phase ?? 'thinking',
    },
    policy: live.group.policy,
    budget: live.group.budget,
    lastRoute: live.state.routes[live.state.routes.length - 1] ?? null,
    warnings: live.warnings,
  };
}

/**
 * Build a global character from an onboarding/import draft.
 * @param {object} draft - name, oneLiner, core, style, memory, extended fields.
 * @param {string} id - new character id.
 * @param {string} name - validated display name.
 * @returns {object} character document.
 */
function characterFromDraft(draft, id, name) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    avatar: null,
    public: {
      oneLiner: typeof draft?.oneLiner === 'string' ? draft.oneLiner.trim() : '',
      relations: {},
    },
    privateRelations: {},
    style: typeof draft?.style === 'string' ? draft.style.trim().slice(0, MAX_STYLE_CHARS) : '',
    extendedEnabled: false,
    model: null,
    core: typeof draft?.core === 'string' ? draft.core : '',
    extended: typeof draft?.extended === 'string' ? draft.extended : '',
    memory: typeof draft?.memory === 'string' ? draft.memory : '',
    missing: false,
  };
}

/**
 * Map name-keyed relations onto ids for one group.
 * @param {Record<string,string>|null|undefined} relations - name-to-text map.
 * @param {Map<string,string>} byName - member name to id.
 * @param {string|null} selfName - member name to omit.
 * @returns {Record<string,string>} id-to-text map.
 */
function mapRelationNames(relations, byName, selfName) {
  const result = {};
  for (const [name, text] of Object.entries(relations ?? {})) {
    if (name === selfName) continue;
    const id = byName.get(name);
    if (id !== undefined) result[id] = text;
  }
  return result;
}

/**
 * One-line preview for the group rail.
 * @param {unknown} text - message text.
 * @returns {string} compact preview.
 */
function previewText(text) {
  if (typeof text !== 'string') return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const chars = [...clean];
  return chars.length > 72 ? `${chars.slice(0, 72).join('')}…` : clean;
}

/**
 * Read and normalize `group.json`.
 * @param {object} raw - decoded JSON.
 * @param {string} gid - expected id.
 * @returns {object} group document.
 */
function normalizeGroup(raw, gid) {
  const memberIds = Array.isArray(raw.memberIds) ? raw.memberIds.filter((id) => typeof id === 'string' && MEMBER_ID.test(id)) : [];
  const characterIds = Array.isArray(raw.characterIds)
    ? raw.characterIds.filter((id) => typeof id === 'string' && CHARACTER_ID.test(id))
    : memberIds;
  return {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : SCHEMA_VERSION,
    id: gid,
    name: typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name : '未命名群聊',
    brief: typeof raw.brief === 'string' ? raw.brief : '',
    characterIds,
    memberIds,
    owner: normalizeOwner(raw.owner ?? {}, null),
    policy: normalizePolicy(raw.policy),
    model: normalizeModel(raw.model),
    budget: normalizeBudget(raw.budget),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
}

/**
 * Normalize the owner profile.
 *
 * With a member list this is the write path: invalid names and oversize fields
 * are rejected with a user-facing message. Without it (loading existing data)
 * the name degrades to the default `用户` instead of making the group
 * unreadable; long settings are preserved for the user to shorten.
 *
 * @param {unknown} raw - owner fields.
 * @param {Array<{id: string, name: string}>|null} members - members for collision checks, or null on load.
 * @returns {{name: string, oneLiner: string, setting: string, avatar: string|null, relations: Record<string,string>}} owner.
 */
export function normalizeOwner(raw, members = null) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const proposed = typeof source.name === 'string' ? source.name.trim() : '';
  let name = proposed.length === 0 ? DEFAULT_OWNER_NAME : proposed;
  if (members !== null) {
    const validation = validateOwnerName(name, members);
    if (!validation.ok) throw new GroupChatError(validation.message);
    name = validation.name;
  } else if (name === '群主' || [...name].length > 16 || /[\s@，。！？、,.!?:：;；]/.test(name)) {
    name = DEFAULT_OWNER_NAME;
  }
  const oneLiner = typeof source.oneLiner === 'string' ? source.oneLiner.trim() : '';
  if (members !== null && [...oneLiner].length > 400) throw new GroupChatError('角色一句话档案最多 400 个字符。');
  const setting = typeof source.setting === 'string' ? source.setting : '';
  if (members !== null && [...setting].length > MAX_SETTING_CHARS) {
    throw new GroupChatError(`角色设定最多 ${MAX_SETTING_CHARS} 个字符。`);
  }
  const avatar = typeof source.avatar === 'string' && source.avatar.length > 0 ? source.avatar : null;
  const relations = {};
  if (source.relations !== null && typeof source.relations === 'object' && !Array.isArray(source.relations)) {
    for (const [memberId, text] of Object.entries(source.relations)) {
      if (typeof text !== 'string' || text.trim().length === 0) continue;
      if (members !== null && !members.some((member) => member.id === memberId)) continue;
      if ([...text].length > 200) {
        if (members !== null) throw new GroupChatError('单条角色关系描述最多 200 个字符。');
        continue;
      }
      relations[memberId] = text.trim();
    }
  }
  return { name, oneLiner, setting, avatar, relations };
}


/**
 * Read one character directory.
 * @param {string} parentDir - `characters/` directory.
 * @param {string} characterId - character id.
 * @returns {Promise<object>} character document with settings.
 */
async function readCharacter(parentDir, characterId) {
  if (!CHARACTER_ID.test(characterId)) {
    return missingCharacter(String(characterId));
  }
  const dir = path.join(parentDir, characterId);
  const card = await readJson(path.join(dir, 'card.json'));
  const core = await readText(path.join(dir, 'setting', 'core.md'));
  const extended = await readText(path.join(dir, 'setting', 'extended.md'));
  const memory = await readText(path.join(dir, 'setting', 'memory.md'));
  if (card === null) {
    return { ...missingCharacter(characterId), core, extended, memory };
  }
  return {
    schemaVersion: typeof card.schemaVersion === 'number' ? card.schemaVersion : SCHEMA_VERSION,
    id: characterId,
    name: typeof card.name === 'string' && card.name.trim().length > 0 ? card.name : '未知成员',
    avatar: typeof card.avatar === 'string' ? card.avatar : null,
    public: {
      oneLiner: typeof card.public?.oneLiner === 'string' ? card.public.oneLiner : '',
      relations: typeof card.public?.relations === 'object' && card.public.relations !== null ? card.public.relations : {},
    },
    privateRelations: typeof card.privateRelations === 'object' && card.privateRelations !== null ? card.privateRelations : {},
    extendedEnabled: card.extendedEnabled === true,
    style: typeof card.style === 'string' ? card.style : '',
    model: normalizeModel(card.model),
    core,
    extended,
    memory,
    missing: false,
  };
}

/**
 * Alias used by the v1 migration for a legacy `members/` directory.
 * @type {typeof readCharacter}
 */
const readCharacterAt = readCharacter;

/**
 * Placeholder for a missing or malformed character record.
 * @param {string} id - character id.
 * @returns {object} placeholder.
 */
function missingCharacter(id) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: String(id),
    name: '未知成员',
    avatar: null,
    public: { oneLiner: '', relations: {} },
    privateRelations: {},
    extendedEnabled: false,
    style: '',
    model: null,
    core: '',
    memory: '',
    extended: '',
    missing: true,
  };
}

/**
 * Persist one character's card and setting files.
 * @param {string} dir - character directory.
 * @param {object} character - character document.
 * @returns {Promise<void>} completion.
 */
async function writeCharacterAt(dir, character) {
  const card = {
    schemaVersion: SCHEMA_VERSION,
    id: character.id,
    name: character.name,
    avatar: character.avatar ?? null,
    public: {
      oneLiner: character.public?.oneLiner ?? '',
      relations: character.public?.relations ?? {},
    },
    privateRelations: character.privateRelations ?? {},
    style: character.style ?? '',
    extendedEnabled: character.extendedEnabled === true,
    model: normalizeModel(character.model),
  };
  await fs.mkdir(path.join(dir, 'setting'), { recursive: true });
  await writeJson(path.join(dir, 'card.json'), card);
  await writeText(path.join(dir, 'setting', 'core.md'), character.core ?? '');
  await writeText(path.join(dir, 'setting', 'extended.md'), character.extended ?? '');
  await writeText(path.join(dir, 'setting', 'memory.md'), character.memory ?? '');
}

/**
 * Read events.jsonl, dropping a torn final line and warning about bad lines.
 * @param {string} file - log path.
 * @param {string[]} warnings - collector.
 * @returns {Promise<Array<object>>} events.
 */
async function readEvents(file, warnings) {
  let content;
  try {
    content = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const events = [];
  const torn = content.length > 0 && !content.endsWith('\n');
  const lines = content.split('\n');
  if (torn) {
    lines.pop();
    warnings.push('事件日志末尾有不完整行，已丢弃。');
  }
  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      warnings.push(`事件日志第 ${index + 1} 行无法解析，已跳过。`);
    }
  }
  return events;
}

/**
 * Read JSON, returning null when the file is absent.
 * @param {string} file - path.
 * @returns {Promise<object|null>} decoded value.
 */
async function readJson(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw new GroupChatError(`${path.basename(file)} 不是有效 JSON。`, 409, 'groupchat/bad-json');
    throw error;
  }
}

/**
 * Read a text file, returning '' when absent.
 * @param {string} file - path.
 * @returns {Promise<string>} text.
 */
async function readText(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

/**
 * Write UTF-8 text durably enough for a local profile: temp file plus rename.
 * @param {string} file - destination.
 * @param {string} content - text.
 * @returns {Promise<void>} completion.
 */
async function writeText(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
  await fs.writeFile(temporary, content, 'utf8');
  await fs.rename(temporary, file);
}

/**
 * Write normalized JSON.
 * @param {string} file - destination.
 * @param {object} value - JSON value.
 * @returns {Promise<void>} completion.
 */
async function writeJson(file, value) {
  await writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

export { SCHEMA_VERSION, SETTING_LIMITS, createState };
