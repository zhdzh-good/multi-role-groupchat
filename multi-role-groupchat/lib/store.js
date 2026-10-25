/**
 * Durable group storage under the plugin's own data directory.
 *
 * Layout (plan §8):
 *   groups/<gid>/group.json
 *   groups/<gid>/members/<cid>/card.json
 *   groups/<gid>/members/<cid>/setting/core.md
 *   groups/<gid>/members/<cid>/setting/extended.md
 *   groups/<gid>/events.jsonl
 *   groups/<gid>/export/script.md
 */

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_BUDGET,
  DEFAULT_POLICY,
  OWNER_NAME,
  SETTING_LIMITS,
  applyEvent,
  createState,
  normalizeBudget,
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
const SCHEMA_VERSION = 1;

/** Largest accepted single setting file; the plan warns well below this. */
const MAX_SETTING_CHARS = 20000;

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
    const group = normalizeGroup(groupRaw, gid);
    if (typeof groupRaw.schemaVersion === 'number' && groupRaw.schemaVersion > SCHEMA_VERSION) {
      throw new GroupChatError(
        `群 ${gid} 的 schemaVersion 是 ${groupRaw.schemaVersion}，高于本插件支持的 ${SCHEMA_VERSION}。请升级插件或迁移数据。`,
        409,
        'groupchat/schema-version',
      );
    }
    const members = [];
    for (const memberId of group.memberIds) {
      members.push(await readMember(dir, memberId));
    }
    const warnings = [];
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
      updatedAt: live.group.updatedAt ?? 0,
    };
  }

  /**
   * Create a group from the onboarding form.
   * @param {{name: string, brief?: string, members: Array<object>}} input - creation data.
   * @returns {Promise<object>} created live state.
   */
  async createGroup(input) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (name.length === 0) throw new GroupChatError('群名不能为空。');
    if ([...name].length > 40) throw new GroupChatError('群名最多 40 个字符。');
    const brief = typeof input.brief === 'string' ? input.brief : '';
    if ([...brief].length > 2000) throw new GroupChatError('群简介最多 2000 个字符。');
    const drafts = Array.isArray(input.members) ? input.members : [];
    if (drafts.length < 2 || drafts.length > 3) throw new GroupChatError('首版需要 2–3 个成员。');
    const seen = [];
    const members = [];
    for (const draft of drafts) {
      const validation = validateMemberName(draft?.name, seen);
      if (!validation.ok) throw new GroupChatError(validation.message);
      const id = makeId('c');
      const card = {
        schemaVersion: SCHEMA_VERSION,
        id,
        name: validation.name,
        avatar: null,
        public: {
          oneLiner: typeof draft.oneLiner === 'string' ? draft.oneLiner.trim() : '',
          relations: {},
        },
        extendedEnabled: false,
        model: null,
      };
      seen.push({ id, name: validation.name });
      members.push({ card, core: typeof draft.core === 'string' ? draft.core : '' });
    }
    const gid = makeId('g');
    const now = Math.floor(Date.now() / 1000);
    const owner = normalizeOwner(input.owner ?? {}, members.map((member) => ({ id: member.card.id, name: member.card.name })));
    const group = {
      schemaVersion: SCHEMA_VERSION,
      id: gid,
      name,
      brief,
      owner,
      memberIds: members.map((member) => member.card.id),
      policy: { ...DEFAULT_POLICY },
      model: null,
      budget: { ...DEFAULT_BUDGET },
      createdAt: now,
      updatedAt: now,
    };
    const dir = this.dirOf(gid);
    await fs.mkdir(path.join(dir, 'members'), { recursive: true });
    for (const member of members) {
      const memberDir = path.join(dir, 'members', member.card.id);
      await fs.mkdir(path.join(memberDir, 'setting'), { recursive: true });
      await writeJson(path.join(memberDir, 'card.json'), member.card);
      await writeText(path.join(memberDir, 'setting', 'core.md'), member.core);
      await writeText(path.join(memberDir, 'setting', 'extended.md'), '');
    }
    await writeText(path.join(dir, 'events.jsonl'), '');
    await writeJson(path.join(dir, 'group.json'), group);
    this.invalidate(gid);
    return this.load(gid);
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
   * Create or update one member. Passing `memberId` edits; omitting it adds.
   * @param {string} gid - group id.
   * @param {object} input - member fields.
   * @returns {Promise<object>} saved member document.
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
    if (ownerName !== OWNER_NAME && validation.name === ownerName) {
      throw new GroupChatError(`群主已经叫“${ownerName}”，成员不能与群主重名。`);
    }
    const oneLiner = typeof input?.oneLiner === 'string' ? input.oneLiner.trim() : existing?.public?.oneLiner ?? '';
    if ([...oneLiner].length > 400) throw new GroupChatError('一句话档案最多 400 个字符。');
    const relations = {};
    if (input?.relations !== undefined && typeof input.relations === 'object' && input.relations !== null) {
      for (const [otherId, text] of Object.entries(input.relations)) {
        if (otherId === memberId) continue;
        if (!live.members.some((member) => member.id === otherId) && otherId !== memberId) continue;
        if (typeof text !== 'string' || text.trim().length === 0) continue;
        if ([...text].length > 200) throw new GroupChatError('单条关系描述最多 200 个字符。');
        relations[otherId] = text.trim();
      }
    }
    const core = typeof input?.core === 'string' ? input.core : existing?.core ?? '';
    const extended = typeof input?.extended === 'string' ? input.extended : existing?.extended ?? '';
    if ([...core].length > MAX_SETTING_CHARS) throw new GroupChatError(`核心设定最多 ${MAX_SETTING_CHARS} 个字符。`);
    if ([...extended].length > MAX_SETTING_CHARS) throw new GroupChatError(`扩展设定最多 ${MAX_SETTING_CHARS} 个字符。`);
    const id = memberId ?? makeId('c');
    const card = {
      schemaVersion: SCHEMA_VERSION,
      id,
      name: validation.name,
      avatar: typeof input?.avatar === 'string' ? input.avatar : existing?.avatar ?? null,
      public: { oneLiner, relations },
      extendedEnabled: input?.extendedEnabled === undefined
        ? existing?.extendedEnabled === true
        : input.extendedEnabled === true,
      model: input?.model === undefined ? existing?.model ?? null : normalizeModel(input.model),
    };
    const memberDir = path.join(live.dir, 'members', id);
    await fs.mkdir(path.join(memberDir, 'setting'), { recursive: true });
    await writeJson(path.join(memberDir, 'card.json'), card);
    await writeText(path.join(memberDir, 'setting', 'core.md'), core);
    await writeText(path.join(memberDir, 'setting', 'extended.md'), extended);
    const member = { ...card, core, extended };
    const index = live.members.findIndex((candidate) => candidate.id === id);
    if (index >= 0) live.members[index] = member;
    else live.members.push(member);
    if (index < 0) {
      live.group.memberIds.push(id);
      live.group.updatedAt = Math.floor(Date.now() / 1000);
      await writeJson(path.join(live.dir, 'group.json'), live.group);
    }
    return member;
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
      extendedEnabled: member.extendedEnabled === true,
      model: member.model ?? null,
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
    warnings: live.warnings,
  };
}

/**
 * Read and normalize `group.json`.
 * @param {object} raw - decoded JSON.
 * @param {string} gid - expected id.
 * @returns {object} group document.
 */
function normalizeGroup(raw, gid) {
  const memberIds = Array.isArray(raw.memberIds) ? raw.memberIds.filter((id) => typeof id === 'string' && MEMBER_ID.test(id)) : [];
  return {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : SCHEMA_VERSION,
    id: gid,
    name: typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name : '未命名群聊',
    brief: typeof raw.brief === 'string' ? raw.brief : '',
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
 * the name degrades to the reserved `群主` instead of making the group
 * unreadable; long settings are preserved for the user to shorten.
 *
 * @param {unknown} raw - owner fields.
 * @param {Array<{id: string, name: string}>|null} members - members for collision checks, or null on load.
 * @returns {{name: string, oneLiner: string, setting: string, avatar: string|null, relations: Record<string,string>}} owner.
 */
export function normalizeOwner(raw, members = null) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const proposed = typeof source.name === 'string' ? source.name.trim() : '';
  let name = proposed.length === 0 ? OWNER_NAME : proposed;
  if (members !== null) {
    const validation = validateOwnerName(name, members);
    if (!validation.ok) throw new GroupChatError(validation.message);
    name = validation.name;
  } else if ([...name].length > 16 || /[\s@，。！？、,.!?:：;；]/.test(name)) {
    name = OWNER_NAME;
  }
  const oneLiner = typeof source.oneLiner === 'string' ? source.oneLiner.trim() : '';
  if (members !== null && [...oneLiner].length > 400) throw new GroupChatError('群主一句话档案最多 400 个字符。');
  const setting = typeof source.setting === 'string' ? source.setting : '';
  if (members !== null && [...setting].length > MAX_SETTING_CHARS) {
    throw new GroupChatError(`群主设定最多 ${MAX_SETTING_CHARS} 个字符。`);
  }
  const avatar = typeof source.avatar === 'string' && source.avatar.length > 0 ? source.avatar : null;
  const relations = {};
  if (source.relations !== null && typeof source.relations === 'object' && !Array.isArray(source.relations)) {
    for (const [memberId, text] of Object.entries(source.relations)) {
      if (typeof text !== 'string' || text.trim().length === 0) continue;
      if (members !== null && !members.some((member) => member.id === memberId)) continue;
      if ([...text].length > 200) {
        if (members !== null) throw new GroupChatError('单条群主关系描述最多 200 个字符。');
        continue;
      }
      relations[memberId] = text.trim();
    }
  }
  return { name, oneLiner, setting, avatar, relations };
}

/**
 * Normalize a model override.
 * @param {unknown} model - candidate.
 * @returns {{provider: string, model: string}|null} override, or null for inherit.
 */
export function normalizeModel(model) {
  if (model === null || model === undefined) return null;
  if (typeof model !== 'object') return null;
  const provider = typeof model.provider === 'string' ? model.provider.trim() : '';
  const id = typeof model.model === 'string' ? model.model.trim() : '';
  if (provider.length === 0 || id.length === 0) return null;
  return { provider, model: id };
}

/**
 * Read one member directory.
 * @param {string} groupDir - group directory.
 * @param {string} memberId - member id.
 * @returns {Promise<object>} member document with settings.
 */
async function readMember(groupDir, memberId) {
  if (!MEMBER_ID.test(memberId)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      id: String(memberId),
      name: '未知成员',
      avatar: null,
      public: { oneLiner: '', relations: {} },
      extendedEnabled: false,
      model: null,
      core: '',
      extended: '',
      missing: true,
    };
  }
  const dir = path.join(groupDir, 'members', memberId);
  const card = await readJson(path.join(dir, 'card.json'));
  const core = await readText(path.join(dir, 'setting', 'core.md'));
  const extended = await readText(path.join(dir, 'setting', 'extended.md'));
  if (card === null) {
    return {
      schemaVersion: SCHEMA_VERSION,
      id: memberId,
      name: '未知成员',
      avatar: null,
      public: { oneLiner: '', relations: {} },
      extendedEnabled: false,
      model: null,
      core,
      extended,
      missing: true,
    };
  }
  return {
    schemaVersion: typeof card.schemaVersion === 'number' ? card.schemaVersion : SCHEMA_VERSION,
    id: memberId,
    name: typeof card.name === 'string' && card.name.trim().length > 0 ? card.name : '未知成员',
    avatar: typeof card.avatar === 'string' ? card.avatar : null,
    public: {
      oneLiner: typeof card.public?.oneLiner === 'string' ? card.public.oneLiner : '',
      relations: typeof card.public?.relations === 'object' && card.public.relations !== null ? card.public.relations : {},
    },
    extendedEnabled: card.extendedEnabled === true,
    model: normalizeModel(card.model),
    core,
    extended,
    missing: false,
  };
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
