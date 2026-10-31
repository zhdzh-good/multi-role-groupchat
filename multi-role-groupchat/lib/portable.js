/**
 * Portable group and character cards.
 *
 * A bundle deliberately contains no local ids, timestamps, pins, message log,
 * or export history. Relations are keyed by display name so a bundle can be
 * imported into a different install where every id changes.
 *
 * This module is pure: callers pass plain group/member documents in, and get a
 * JSON-safe object out. The route layer owns file size limits and HTTP errors;
 * this module owns schema and field validation.
 */

import {
  normalizeBudget,
  normalizeModel,
  normalizePolicy,
  validateMemberName,
  validateOwnerName,
} from './protocol.js';

/** Top-level format marker for a whole-group configuration. */
export const GROUP_FORMAT = 'groupchat.group';

/** Top-level format marker for a single owner/member card. */
export const CHARACTER_FORMAT = 'groupchat.character';

/** Supported portable schema version. */
export const PORTABLE_VERSION = 1;

/** Maximum accepted import file size in bytes. */
export const PORTABLE_MAX_BYTES = 4 * 1024 * 1024;

/** Largest accepted settings field, matching the store's write limit. */
const MAX_SETTING_CHARS = 20000;

/** Largest accepted one-line profile. */
const MAX_ONE_LINER_CHARS = 400;

/** Largest accepted voice/style note. */
const MAX_STYLE_CHARS = 300;

/** Largest accepted private memory note. */
const MAX_MEMORY_CHARS = 4000;

/** Largest accepted single relation description. */
const MAX_RELATION_CHARS = 200;

/** Largest accepted manual scene note. */
const MAX_SCENE_CHARS = 800;

/** Largest accepted avatar data URL, in characters. */
const MAX_AVATAR_CHARS = 300000;

/**
 * Validation/format error surfaced as a 400/409 response.
 */
export class PortableError extends Error {
  /**
   * @param {string} message - user-facing message.
   * @param {string} [code] - stable machine code.
   * @param {number} [status] - HTTP status.
   */
  constructor(message, code = 'groupchat/portable-invalid', status = 400) {
    super(message);
    this.name = 'PortableError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Build a portable, id-free group bundle.
 *
 * @param {object} input - export inputs.
 * @param {object} input.group - group document.
 * @param {Array<object>} input.members - member documents.
 * @param {boolean} [input.includeAvatars] - include data-URL avatars.
 * @param {boolean} [input.includePrivate] - include private memory/relations.
 * @param {number|string|Date} [input.exportedAt] - export time.
 * @returns {object} JSON-safe bundle.
 */
export function buildGroupBundle({ group, members, includeAvatars = true, includePrivate = false, exportedAt = Math.floor(Date.now() / 1000) }) {
  const owner = group.owner ?? { name: '用户' };
  return {
    format: GROUP_FORMAT,
    version: PORTABLE_VERSION,
    app: 'multi-role-groupchat',
    exportedAt: toIso(exportedAt),
    group: {
      name: group.name,
      brief: group.brief ?? '',
      scene: group.scene ?? '',
      owner: {
        name: owner.name,
        oneLiner: owner.oneLiner ?? '',
        setting: owner.setting ?? '',
        ...(includeAvatars && owner.avatar ? { avatar: owner.avatar } : {}),
        relations: relationNames(owner.relations, members, null),
      },
      policy: { ...normalizePolicy(group.policy) },
      budget: { ...normalizeBudget(group.budget) },
      model: normalizeModel(group.model),
    },
    members: members.map((member) => ({
      name: member.name,
      oneLiner: member.public?.oneLiner ?? '',
      style: member.style ?? '',
      ...(includePrivate ? {
        memory: member.memory ?? '',
        privateRelations: relationNames(member.privateRelations, members, member.id),
      } : {}),
      core: member.core ?? '',
      extended: member.extended ?? '',
      extendedEnabled: member.extendedEnabled === true,
      ...(includeAvatars && member.avatar ? { avatar: member.avatar } : {}),
      relations: relationNames(member.public?.relations, members, member.id),
      model: normalizeModel(member.model),
    })),
  };
}

/**
 * Build a single character card, with relations keyed by member names.
 *
 * @param {object} input - export inputs.
 * @param {'owner'|'member'} input.kind - character kind.
 * @param {object} input.profile - owner or member document.
 * @param {Array<object>} input.members - current members, used to name relations.
 * @param {boolean} [input.includeAvatar] - include the data-URL avatar.
 * @param {boolean} [input.includePrivate] - include private memory/relations.
 * @param {number|string|Date} [input.exportedAt] - export time.
 * @returns {object} JSON-safe character card.
 */
export function buildCharacterCard({ kind, profile, members, includeAvatar = true, includePrivate = false, exportedAt = Math.floor(Date.now() / 1000) }) {
  if (kind !== 'owner' && kind !== 'member') {
    throw new PortableError('角色卡类型必须是 owner 或 member。');
  }
  const avatar = includeAvatar && typeof profile?.avatar === 'string' && profile.avatar.length > 0
    ? { avatar: profile.avatar }
    : {};
  const character = kind === 'owner'
    ? {
        name: profile.name,
        oneLiner: profile.oneLiner ?? '',
        setting: profile.setting ?? '',
        ...avatar,
        relations: relationNames(profile.relations, members, null),
      }
    : {
        name: profile.name,
        oneLiner: profile.public?.oneLiner ?? '',
        style: profile.style ?? '',
        ...(includePrivate ? {
          memory: profile.memory ?? '',
          privateRelations: relationNames(profile.privateRelations, members, profile.id),
        } : {}),
        core: profile.core ?? '',
        extended: profile.extended ?? '',
        extendedEnabled: profile.extendedEnabled === true,
        ...avatar,
        relations: relationNames(profile.public?.relations, members, profile.id),
        model: normalizeModel(profile.model),
      };
  return {
    format: CHARACTER_FORMAT,
    version: PORTABLE_VERSION,
    app: 'multi-role-groupchat',
    exportedAt: toIso(exportedAt),
    kind,
    character,
  };
}

/**
 * Parse and classify a JSON bundle or character card.
 *
 * @param {string|object} input - raw JSON text or decoded object.
 * @param {'group'|'character'|null} [expectedKind] - required top-level kind.
 * @returns {{kind: 'group'|'character', version: number, value: object, warnings: string[]}} parsed envelope.
 */
export function parsePortable(input, expectedKind = null) {
  let value;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input.replace(/^\uFEFF/, ''));
    } catch {
      throw new PortableError('文件不是有效的 JSON。', 'groupchat/portable-json');
    }
  } else {
    value = input;
  }
  if (!isObject(value) || Array.isArray(value)) {
    throw new PortableError('文件顶层必须是 JSON 对象。', 'groupchat/portable-json');
  }

  const warnings = [];
  let kind;
  if (value.format === GROUP_FORMAT) {
    kind = 'group';
  } else if (value.format === CHARACTER_FORMAT) {
    kind = 'character';
  } else if (value.format !== undefined) {
    throw new PortableError(`不支持的文件格式：${String(value.format)}。`);
  } else if (isObject(value.group) && Array.isArray(value.members)) {
    kind = 'group';
    warnings.push('文件没有 format，按旧版群配置读取。');
  } else if (isObject(value.character) && (value.kind === 'owner' || value.kind === 'member')) {
    kind = 'character';
    warnings.push('文件没有 format，按旧版角色卡读取。');
  } else {
    throw new PortableError('无法识别文件：既不是群配置，也不是角色卡。');
  }

  if (expectedKind !== null && kind !== expectedKind) {
    throw new PortableError(
      expectedKind === 'group' ? '这是角色卡，不是群配置。' : '这是群配置，不是角色卡。',
      'groupchat/portable-wrong-kind',
    );
  }

  let version = value.version;
  if (version === undefined) {
    version = PORTABLE_VERSION;
    warnings.push('文件没有 version，按 v1 读取。');
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new PortableError('文件 version 必须是正整数。');
  }
  if (version > PORTABLE_VERSION) {
    throw new PortableError(
      `文件版本 ${version} 高于当前支持的 ${PORTABLE_VERSION}，请升级插件。`,
      'groupchat/portable-version',
      409,
    );
  }
  return { kind, version, value, warnings };
}

/**
 * Validate and normalize a group bundle for the store.
 *
 * Relations stay keyed by display name; `GroupStore.importGroup` maps them to
 * fresh ids after it creates the group.
 *
 * @param {object} value - parsed group envelope.
 * @returns {object} normalized group import descriptor.
 */
export function normalizeGroupBundle(value) {
  const warnings = [];
  const groupRaw = isObject(value?.group) ? value.group : null;
  if (groupRaw === null) throw new PortableError('群配置缺少 group 对象。');

  warnUnknown(value, ['format', 'version', 'app', 'exportedAt', 'group', 'members'], '群配置', warnings);
  warnUnknown(groupRaw, ['name', 'brief', 'scene', 'owner', 'policy', 'budget', 'model'], 'group', warnings);
  const name = requiredName(groupRaw.name, '群名', 40);
  const brief = stringField(groupRaw.brief, '群简介', 2000);
  const scene = stringField(groupRaw.scene, '场景', MAX_SCENE_CHARS).trim();
  const rawMembers = Array.isArray(value.members) ? value.members : null;
  if (rawMembers === null) throw new PortableError('群配置缺少 members 数组。');
  if (rawMembers.length < 2 || rawMembers.length > 3) {
    throw new PortableError('群配置需要 2–3 个成员。');
  }

  const seen = [];
  const entries = rawMembers.map((raw, index) => {
    if (!isObject(raw)) throw new PortableError(`第 ${index + 1} 个成员不是对象。`);
    const validation = validateMemberName(raw.name, seen);
    if (!validation.ok) throw new PortableError(`第 ${index + 1} 个成员：${validation.message}`);
    const entry = { id: `tmp_${index}`, name: validation.name, raw };
    seen.push(entry);
    return entry;
  });

  const ownerRaw = isObject(groupRaw.owner) ? groupRaw.owner : {};
  warnUnknown(ownerRaw, ['name', 'oneLiner', 'setting', 'avatar', 'relations'], '我的角色', warnings);
  const ownerValidation = validateOwnerName(ownerRaw.name, entries.map(({ id, name: memberName }) => ({ id, name: memberName })));
  if (!ownerValidation.ok) throw new PortableError(`我的角色：${ownerValidation.message}`);
  const memberNames = new Set(entries.map((entry) => entry.name));

  const owner = {
    name: ownerValidation.name,
    oneLiner: stringField(ownerRaw.oneLiner, '我的角色一句话', MAX_ONE_LINER_CHARS),
    setting: stringField(ownerRaw.setting, '我的角色设定', MAX_SETTING_CHARS),
    avatar: normalizeAvatar(ownerRaw.avatar, '我的角色', warnings),
    relations: normalizeNamedRelations(ownerRaw.relations, '我的角色', warnings, null, memberNames),
  };

  const members = entries.map(({ name: memberName, raw }) => {
    const displayed = `成员“${memberName}”`;
    warnUnknown(raw, ['name', 'oneLiner', 'style', 'memory', 'privateRelations', 'core', 'extended', 'extendedEnabled', 'avatar', 'relations', 'model'], displayed, warnings);
    const model = normalizeModel(raw.model);
    if (raw.model !== null && raw.model !== undefined && model === null) {
      warnings.push(`${displayed}的模型覆盖无法识别，已忽略。`);
    }
    return {
      name: memberName,
      oneLiner: stringField(raw.oneLiner, `${displayed}一句话`, MAX_ONE_LINER_CHARS),
      style: stringField(raw.style, `${displayed}说话方式`, MAX_STYLE_CHARS),
      memory: stringField(raw.memory, `${displayed}私有记忆`, MAX_MEMORY_CHARS),
      privateRelations: normalizeNamedRelations(raw.privateRelations, `${displayed}私人关系`, warnings, memberName, memberNames),
      core: stringField(raw.core, `${displayed}核心设定`, MAX_SETTING_CHARS),
      extended: stringField(raw.extended, `${displayed}扩展设定`, MAX_SETTING_CHARS),
      extendedEnabled: raw.extendedEnabled === true,
      avatar: normalizeAvatar(raw.avatar, displayed, warnings),
      relations: normalizeNamedRelations(raw.relations, displayed, warnings, memberName, memberNames),
      model,
    };
  });

  if (groupRaw.policy !== undefined && !isObject(groupRaw.policy)) {
    throw new PortableError('group.policy 必须是对象。');
  }
  if (groupRaw.budget !== undefined && !isObject(groupRaw.budget)) {
    throw new PortableError('group.budget 必须是对象。');
  }
  const model = normalizeModel(groupRaw.model);
  if (groupRaw.model !== null && groupRaw.model !== undefined && model === null) {
    warnings.push('群模型覆盖无法识别，已忽略。');
  }
  if (model !== null || members.some((member) => member.model !== null)) {
    warnings.push('群配置包含模型覆盖，导入后请确认目标环境已配置对应 provider。');
  }
  return {
    name,
    brief,
    scene,
    owner,
    members,
    policy: normalizePolicy(groupRaw.policy),
    budget: normalizeBudget(groupRaw.budget),
    model,
    warnings,
  };
}

/**
 * Validate and normalize a character card.
 *
 * @param {object} value - parsed character envelope.
 * @param {'owner'|'member'|null} [expectedKind] - required character kind.
 * @returns {{kind: 'owner'|'member', character: object, warnings: string[]}} normalized card.
 */
export function normalizeCharacterCard(value, expectedKind = null) {
  const kind = value?.kind;
  if (kind !== 'owner' && kind !== 'member') {
    throw new PortableError('角色卡的 kind 必须是 owner 或 member。');
  }
  if (expectedKind !== null && kind !== expectedKind) {
    throw new PortableError(
      expectedKind === 'owner' ? '这是成员卡，不是我的角色卡。' : '这是我的角色卡，不是成员卡。',
      'groupchat/portable-wrong-kind',
    );
  }
  const raw = value.character;
  if (!isObject(raw)) throw new PortableError('角色卡缺少 character 对象。');
  const warnings = [];
  warnUnknown(value, ['format', 'version', 'app', 'exportedAt', 'kind', 'character'], '角色卡', warnings);
  warnUnknown(
    raw,
    kind === 'owner'
      ? ['name', 'oneLiner', 'setting', 'avatar', 'relations']
      : ['name', 'oneLiner', 'style', 'memory', 'privateRelations', 'core', 'extended', 'extendedEnabled', 'avatar', 'relations', 'model'],
    kind === 'owner' ? '我的角色' : '成员卡',
    warnings,
  );
  const name = kind === 'owner'
    ? ownerNameOrThrow(raw.name)
    : memberNameOrThrow(raw.name);
  const avatar = normalizeAvatar(raw.avatar, kind === 'owner' ? '我的角色' : `成员“${name}”`, warnings);
  const relations = normalizeNamedRelations(
    raw.relations,
    kind === 'owner' ? '我的角色' : `成员“${name}”`,
    warnings,
    kind === 'member' ? name : null,
    null,
  );
  let character;
  if (kind === 'owner') {
    character = {
      name,
      oneLiner: stringField(raw.oneLiner, '我的角色一句话', MAX_ONE_LINER_CHARS),
      setting: stringField(raw.setting, '我的角色设定', MAX_SETTING_CHARS),
      avatar,
      relations,
    };
  } else {
    const model = normalizeModel(raw.model);
    if (raw.model !== null && raw.model !== undefined && model === null) {
      warnings.push('模型覆盖无法识别，已忽略。');
    }
    character = {
      name,
      oneLiner: stringField(raw.oneLiner, '成员一句话', MAX_ONE_LINER_CHARS),
      style: stringField(raw.style, '成员说话方式', MAX_STYLE_CHARS),
      memory: stringField(raw.memory, '成员私有记忆', MAX_MEMORY_CHARS),
      privateRelations: normalizeNamedRelations(raw.privateRelations, '成员私人关系', warnings, name, null),
      core: stringField(raw.core, '核心设定', MAX_SETTING_CHARS),
      extended: stringField(raw.extended, '扩展设定', MAX_SETTING_CHARS),
      extendedEnabled: raw.extendedEnabled === true,
      avatar,
      relations,
      model,
    };
    if (model !== null) warnings.push('角色卡包含模型覆盖，保存前请确认目标环境已配置对应 provider。');
  }
  return { kind, character, warnings };
}

/**
 * Map a character card's relation names onto the current group's ids.
 *
 * @param {object} character - normalized character.
 * @param {Array<object>} members - current members.
 * @param {{kind?: 'owner'|'member', selfId?: string|null}} [options] - target context.
 * @returns {{relations: Record<string,string>, privateRelations: Record<string,string>, warnings: string[]}} mapped relations.
 */
export function mapCharacterRelations(character, members, options = {}) {
  const kind = options.kind ?? 'member';
  const selfId = options.selfId ?? null;
  const byName = new Map(members.map((member) => [member.name, member.id]));
  const relations = {};
  const privateRelations = {};
  const warnings = [];
  for (const [name, text] of Object.entries(character.relations ?? {})) {
    if (kind === 'member' && (name === character.name || (selfId !== null && byName.get(name) === selfId))) {
      continue;
    }
    const id = byName.get(name);
    if (id === undefined) {
      warnings.push(`关系对象“${name}”不在当前群，已跳过。`);
      continue;
    }
    relations[id] = text;
  }
  for (const [name, text] of Object.entries(character.privateRelations ?? {})) {
    if (kind === 'member' && (name === character.name || (selfId !== null && byName.get(name) === selfId))) {
      continue;
    }
    const id = byName.get(name);
    if (id === undefined) {
      warnings.push(`私人关系对象“${name}”不在当前群，已跳过。`);
      continue;
    }
    privateRelations[id] = text;
  }
  return { relations, privateRelations, warnings };
}

/**
 * Build the summary shown before a group import is confirmed.
 *
 * @param {object} bundle - normalized group descriptor.
 * @param {{bytes?: number}} [meta] - extra summary data.
 * @returns {object} preview.
 */
export function previewGroupBundle(bundle, meta = {}) {
  const avatarCount = (bundle.owner.avatar ? 1 : 0)
    + bundle.members.filter((member) => member.avatar !== null).length;
  return {
    groupName: bundle.name,
    brief: bundle.brief,
    scene: bundle.scene ?? '',
    ownerName: bundle.owner.name,
    memberCount: bundle.members.length,
    members: bundle.members.map((member) => ({
      name: member.name,
      oneLiner: member.oneLiner,
      styleChars: [...member.style].length,
      privateMemoryChars: [...(member.memory ?? '')].length,
      privateRelationCount: Object.keys(member.privateRelations ?? {}).length,
      coreChars: [...member.core].length,
      extendedChars: [...member.extended].length,
      hasAvatar: member.avatar !== null,
      relationCount: Object.keys(member.relations).length,
    })),
    policy: bundle.policy,
    budget: bundle.budget,
    model: bundle.model,
    avatarCount,
    bytes: meta.bytes ?? 0,
  };
}

/**
 * Create a filesystem-safe download name.
 * @param {string} name - group or character name.
 * @param {string} suffix - file suffix such as `.groupchat.json`.
 * @returns {string} filename.
 */
export function portableFilename(name, suffix) {
  const base = [...String(name ?? 'groupchat')]
    .slice(0, 60)
    .join('')
    .replace(/[\\/:*?"<>|\r\n]/g, '_')
    .trim();
  return `${base.length > 0 ? base : 'groupchat'}${suffix}`;
}

/**
 * Pretty-print a portable bundle with a trailing newline.
 * @param {object} value - bundle.
 * @returns {string} JSON text.
 */
export function stringifyPortable(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Convert owner/member relation ids into display-name keys.
 * @param {Record<string,string>|null|undefined} relations - id-to-text map.
 * @param {Array<{id: string, name: string}>} members - members.
 * @param {string|null} selfId - self id to omit.
 * @returns {Record<string,string>} name-to-text map.
 */
function relationNames(relations, members, selfId) {
  const byId = new Map(members.map((member) => [member.id, member.name]));
  const result = {};
  for (const [id, text] of Object.entries(relations ?? {})) {
    if (id === selfId || typeof text !== 'string' || text.trim().length === 0) continue;
    const name = byId.get(id);
    if (name !== undefined) result[name] = text;
  }
  return result;
}

/**
 * Validate a relations object and keep only known member names.
 * @param {unknown} raw - candidate relations.
 * @param {string} label - field label for errors.
 * @param {string[]} warnings - collector.
 * @param {string|null} selfName - self name to omit.
 * @param {Set<string>|null} memberNames - allowed names; null skips membership checks.
 * @returns {Record<string,string>} normalized relations.
 */
function normalizeNamedRelations(raw, label, warnings, selfName, memberNames) {
  if (raw === undefined || raw === null) return {};
  if (!isObject(raw)) throw new PortableError(`${label}的关系必须是对象。`);
  const result = {};
  for (const [name, value] of Object.entries(raw)) {
    if (name === selfName) continue;
    if (typeof value !== 'string' || value.trim().length === 0) continue;
    if ([...value].length > MAX_RELATION_CHARS) {
      throw new PortableError(`${label}对“${name}”的关系描述最多 ${MAX_RELATION_CHARS} 个字符。`);
    }
    if (memberNames !== null && !memberNames.has(name)) {
      warnings.push(`${label}的关系对象“${name}”不在群内，已跳过。`);
      continue;
    }
    result[name] = value.trim();
  }
  return result;
}

/**
 * Accept only a small data-URL avatar and preserve existing client output.
 * @param {unknown} value - candidate.
 * @param {string} label - field label.
 * @param {string[]} warnings - collector.
 * @returns {string|null} avatar data URL.
 */
function normalizeAvatar(value, label, warnings) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    warnings.push(`${label}的头像不是文本，已忽略。`);
    return null;
  }
  if (value.length > MAX_AVATAR_CHARS) {
    throw new PortableError(`${label}的头像超过 ${Math.round(MAX_AVATAR_CHARS / 1024)} KB，无法导入。`);
  }
  if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) {
    warnings.push(`${label}的头像不是受支持的 PNG/JPEG/WebP data URL，已忽略。`);
    return null;
  }
  return value;
}

/**
 * @param {unknown} value - candidate.
 * @param {string} label - field label.
 * @param {number} max - maximum characters.
 * @returns {string} text.
 */
function stringField(value, label, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new PortableError(`${label}必须是文本。`);
  if ([...value].length > max) {
    throw new PortableError(`${label}最多 ${max} 个字符，当前 ${[...value].length} 个。`);
  }
  return value;
}

/**
 * @param {unknown} value - candidate.
 * @param {string} label - field label.
 * @param {number} max - maximum characters.
 * @returns {string} trimmed required text.
 */
function requiredName(value, label, max) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PortableError(`${label}不能为空。`);
  }
  if ([...value.trim()].length > max) {
    throw new PortableError(`${label}最多 ${max} 个字符。`);
  }
  return value.trim();
}

/**
 * @param {unknown} value - candidate.
 * @returns {string} validated member name.
 */
function memberNameOrThrow(value) {
  const validation = validateMemberName(value, []);
  if (!validation.ok) throw new PortableError(`成员名：${validation.message}`);
  return validation.name;
}

/**
 * @param {unknown} value - candidate.
 * @returns {string} validated owner name.
 */
function ownerNameOrThrow(value) {
  const validation = validateOwnerName(value, []);
  if (!validation.ok) throw new PortableError(`我的角色：${validation.message}`);
  return validation.name;
}


/**
 * Warn about fields a v1 reader does not understand instead of silently
 * dropping them.
 * @param {object} value - source object.
 * @param {string[]} allowed - known keys.
 * @param {string} label - field label.
 * @param {string[]} warnings - collector.
 * @returns {void}
 */
function warnUnknown(value, allowed, label, warnings) {
  const known = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) warnings.push(`${label}的未知字段“${key}”已忽略。`);
  }
}

/**
 * @param {unknown} value - candidate.
 * @returns {boolean} plain object.
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {number|string|Date} value - epoch seconds, ISO string, or Date.
 * @returns {string} ISO timestamp.
 */
function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}
