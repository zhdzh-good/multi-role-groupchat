/**
 * Pure group-chat protocol: mention parsing, routing, prompt assembly, event
 * replay, and Markdown export.
 *
 * Everything in this module is deterministic and free of I/O so the same code
 * can be exercised directly by `node --test`.
 */

/** Legacy `@群主` alias kept only for existing logs and old prompts. */
export const OWNER_NAME = '群主';

/** Fallback character name for an owner that has not been named yet. */
export const DEFAULT_OWNER_NAME = '用户';

/** Default owner profile; old groups without an `owner` field load as this. */
export const DEFAULT_OWNER = Object.freeze({
  name: DEFAULT_OWNER_NAME,
  oneLiner: '',
  setting: '',
  avatar: null,
  relations: Object.freeze({}),
});

/** Default group policy from the implementation plan. */
export const DEFAULT_POLICY = Object.freeze({
  replyMode: 'smart-router',
  smartRouting: true,
  maxMentionReplies: 2,
  bystanderChance: 30,
  maxHandoffDepth: 2,
  maxHistory: 24,
  maxPinned: 10,
  maxReplyChars: 300,
});

/** Default group budget from the implementation plan. */
export const DEFAULT_BUDGET = Object.freeze({
  maxInputTokens: 200000,
  maxOutputTokens: 8000,
});

/** Speaker rules, verbatim from the plan §4.2. */
export const REPLY_RULES = [
  '你是群里的成员，消息对全群可见。',
  '只演你自己：不替别人说话、不替别人行动、不描写别人的内心。',
  '可以依据自己的完整设定行动，但不得主动披露设定中标为秘密的内容。',
  '对其他成员的了解，只能来自公开档案和群里实际出现过的消息。',
  '回应 1–2 段，不超过 {maxReplyChars} 字。',
  '可以把话交给别人：在正文里写 @名字（成员或{ownerName}）。@{ownerName} 表示你在等对方回答。',
  '不要解释规则、不要跳出角色、不要复述或总结刚才说过的话。',
].join('\n');

/** Characters that terminate an `@` candidate in the plan §3.3 grammar. */
const MENTION_PATTERN = /@([^\s@，。！？、,.!?:：;；]{1,16})/g;

/** Per-member markdown limits used for save warnings, not silent truncation. */
export const SETTING_LIMITS = Object.freeze({ core: 4000, extended: 8000 });

/**
 * Parse `@` references from one body of text.
 *
 * Exact display-name matching is intentional: `@林晚，你说呢` resolves through
 * the candidate `林晚` because the comma terminates the candidate, while
 * `@林晚晚` does not resolve unless such a member exists. Unknown names are
 * kept in the text and never change routing.
 *
 * @param {string} text - message body.
 * @param {Array<{id: string, name: string}>} members - current members.
 * @param {{selfId?: string|null, ownerName?: string}} [options] - speaking member
 *   (ignored as a target) and the owner's custom display name.
 * @returns {{memberIds: string[], owner: boolean}} routing result.
 */
export function parseMentions(text, members, options = {}) {
  const byName = new Map();
  for (const member of members) {
    if (typeof member?.name !== 'string') continue;
    byName.set(member.name, member.id);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const ownerNames = new Set([OWNER_NAME]);
  const explicitOwner = typeof options.ownerName === 'string' ? options.ownerName.trim() : '';
  ownerNames.add(explicitOwner.length > 0 ? explicitOwner : DEFAULT_OWNER_NAME);
  const memberIds = [];
  let owner = false;
  const source = typeof text === 'string' ? text : '';
  for (const match of source.matchAll(MENTION_PATTERN)) {
    const candidate = match[1];
    if (ownerNames.has(candidate)) {
      owner = true;
      continue;
    }
    let matchedName;
    for (const name of names) {
      if (candidate === name) {
        matchedName = name;
        break;
      }
    }
    if (matchedName === undefined) continue;
    const id = byName.get(matchedName);
    if (id === undefined || id === options.selfId) continue;
    if (!memberIds.includes(id)) memberIds.push(id);
  }
  return { memberIds, owner };
}

/**
 * The single routing target of a message: the first parsed member mention.
 * @param {{memberIds: string[]}} parsed - output of {@link parseMentions}.
 * @returns {string|undefined} member id, when a valid target exists.
 */
export function mentionTarget(parsed) {
  return parsed.memberIds[0];
}

/**
 * Generation cap for one user message under the router protocol.
 *
 * The initial routed set (addressees plus sampled bystanders) always gets to
 * answer, then each explicit member-to-member handoff consumes one depth slot.
 * The routed set itself is capped by the number of members and
 * `maxMentionReplies`.
 *
 * @param {number} initialCount - planned addressees plus bystanders.
 * @param {typeof DEFAULT_POLICY} policy - group policy.
 * @returns {number} maximum member generations for the turn.
 */
export function generationCap(initialCount, policy) {
  const depth = clampInt(policy?.maxHandoffDepth, 0, 3, DEFAULT_POLICY.maxHandoffDepth);
  return Math.max(1, clampInt(initialCount, 0, 10, 1)) + depth;
}

/**
 * Pick the next speaker by rotation: the member who spoke least recently,
 * excluding the previous speaker, ties broken by id for reproducibility.
 *
 * @param {Array<{id: string}>} members - current members.
 * @param {Array<{memberId?: string|null, ts: number}>} activeMessages - effective messages.
 * @param {string|null} excludeMemberId - previous speaker.
 * @returns {string|undefined} member id.
 */
export function pickRotation(members, activeMessages, excludeMemberId = null) {
  const candidates = members.filter((member) => member.id !== excludeMemberId);
  if (candidates.length === 0) return undefined;
  const lastSpoke = new Map();
  for (const message of activeMessages) {
    if (message.role !== 'member' || typeof message.memberId !== 'string') continue;
    const previous = lastSpoke.get(message.memberId) ?? -Infinity;
    if (message.ts > previous) lastSpoke.set(message.memberId, message.ts);
  }
  candidates.sort((left, right) => {
    const leftAt = lastSpoke.get(left.id) ?? -Infinity;
    const rightAt = lastSpoke.get(right.id) ?? -Infinity;
    if (leftAt !== rightAt) return leftAt - rightAt;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return candidates[0]?.id;
}

/**
 * Split effective messages into the pinned prefix and the newest unpinned
 * window, reporting what the prompt folded away.
 *
 * @param {Array<object>} activeMessages - effective messages in conversation order.
 * @param {{maxHistory: number}} policy - group policy.
 * @param {string|null} [excludeId] - message to omit (the rewrite target).
 * @returns {{pinned: object[], window: object[], folded: object[], inPrompt: object[]}} selection.
 */
export function selectHistory(activeMessages, policy, excludeId = null) {
  const maxHistory = clampInt(policy?.maxHistory, 1, 200, DEFAULT_POLICY.maxHistory);
  const visible = excludeId === null ? activeMessages : activeMessages.filter((message) => message.id !== excludeId);
  const pinned = visible.filter((message) => message.pinned === true);
  const unpinned = visible.filter((message) => message.pinned !== true);
  const window = unpinned.slice(Math.max(0, unpinned.length - maxHistory));
  const folded = unpinned.slice(0, Math.max(0, unpinned.length - maxHistory));
  return { pinned, window, folded, inPrompt: [...pinned, ...window] };
}

/**
 * Render one history line for the prompt: `[林晚] 正文`.
 * Newlines inside a message are preserved so multi-paragraph replies stay
 * readable to the model.
 *
 * @param {{role: string, memberId?: string|null, text: string}} message - message.
 * @param {Array<{id: string, name: string}>} members - current members.
 * @returns {string} prompt line.
 */
export function historyLine(message, members, ownerName = DEFAULT_OWNER_NAME) {
  return `[${speakerName(message, members, ownerName)}] ${message.text}`;
}

/**
 * Display name for a message speaker, falling back for a member that has left.
 * @param {{role: string, memberId?: string|null}} message - message.
 * @param {Array<{id: string, name: string}>} members - current members.
 * @returns {string} display name.
 */
export function speakerName(message, members, ownerName = DEFAULT_OWNER_NAME) {
  if (message.role === 'user') return ownerName;
  return members.find((member) => member.id === message.memberId)?.name ?? '已离开的成员';
}

/**
 * Stable system prefix from the plan §4.1. It contains no timestamps, turn
 * numbers, or random ids, so it can be reused as a provider cache prefix.
 *
 * @param {object} group - group document with `brief` and `policy`.
 * @param {Array<object>} members - member documents, with `public.relations`.
 * @returns {string} system prompt prefix.
 */
export function buildSystemPrefix(group, members) {
  const owner = ownerProfile(group);
  const rules = REPLY_RULES
    .replaceAll(
      '{maxReplyChars}',
      String(clampInt(group?.policy?.maxReplyChars, 20, 4000, DEFAULT_POLICY.maxReplyChars)),
    )
    .replaceAll('{ownerName}', owner.name);
  const ownerRelations = Object.entries(owner.relations ?? {})
    .map(([otherId, text]) => {
      const other = members.find((candidate) => candidate.id === otherId);
      return other === undefined ? null : `${other.name}：${text}`;
    })
    .filter((entry) => entry !== null);
  const ownerLines = [
    '角色档案：',
    `- 名字：${owner.name}`,
    `- 一句话：${owner.oneLiner.trim().length > 0 ? owner.oneLiner.trim() : '（未填写）'}`,
    `- 设定：${owner.setting.trim().length > 0 ? owner.setting.trim() : '（未填写）'}`,
  ];
  if (ownerRelations.length > 0) ownerLines.push(`- 与成员关系：${ownerRelations.join('；')}`);
  const profiles = members.map((member) => {
    const oneLiner = typeof member.public?.oneLiner === 'string' && member.public.oneLiner.trim().length > 0
      ? member.public.oneLiner.trim()
      : '（未填写）';
    const relations = Object.entries(member.public?.relations ?? {})
      .map(([otherId, text]) => {
        const other = members.find((candidate) => candidate.id === otherId);
        return other === undefined ? null : `${other.name}：${text}`;
      })
      .filter((entry) => entry !== null);
    const relationText = relations.length === 0 ? '' : `（关系：${relations.join('；')}）`;
    return `- ${member.name}：${oneLiner}${relationText}`;
  });
  return [
    `群简介：${typeof group?.brief === 'string' && group.brief.trim().length > 0 ? group.brief.trim() : '（未填写）'}`,
    '',
    ...ownerLines,
    '',
    '成员公开档案：',
    ...(profiles.length === 0 ? ['（无）'] : profiles),
    '',
    '规则：',
    rules,
  ].join('\n');
}

/**
 * Build the full request for one member's reply.
 *
 * @param {object} input - prompt inputs.
 * @param {object} input.group - group document.
 * @param {Array<object>} input.members - member documents.
 * @param {Array<object>} input.activeMessages - effective messages before this reply.
 * @param {object} input.member - speaking member.
 * @param {string} input.sourceUserText - the user message that triggered this turn.
 * @param {number} input.replyIndex - 1-based reply index within the turn.
 * @param {string} input.previousName - display name of the previous message's speaker.
 * @param {'addressed'|'bystander'|'handoff'|null} [input.routeRole] - why this member replies.
 * @param {string|null} [input.excludeId] - rewrite target to omit from history.
 * @returns {{system: string, messages: Array<object>, folded: object[]}} request pieces.
 */
export function buildPrompt(input) {
  const { group, members, member, sourceUserText, replyIndex, previousName, routeRole = null, excludeId = null } = input;
  const selection = selectHistory(input.activeMessages, group.policy, excludeId);
  const owner = ownerProfile(group);
  const messages = selection.inPrompt.map((message) => ({
    role: 'user',
    content: [{ type: 'text', text: historyLine(message, members, owner.name) }],
  }));
  const tail = [
    `=== 你现在扮演：${member.name} ===`,
    trimToFallback(member.core, '（未填写核心设定，请按公开档案扮演）'),
  ];
  if (member.extendedEnabled === true && typeof member.extended === 'string' && member.extended.trim().length > 0) {
    tail.push('=== 扩展背景 ===', member.extended.trim());
  }
  tail.push(
    '=== 本次回应 ===',
    `${owner.name}刚说：${sourceUserText}`,
    `这是本次发言的第 ${replyIndex} 条回应；上一条来自 ${previousName}。`,
  );
  if (routeRole === 'addressed') {
    tail.push('这句话主要是对你说的；先直接回应，不要替别人回答。');
  } else if (routeRole === 'bystander') {
    tail.push('这句话不是直接对你说的；你可以自然补一句，也可以只回应你在意的部分，不要抢话。');
  } else if (routeRole === 'handoff') {
    tail.push('上一条把话交给了你；顺着接下去。');
  }
  tail.push(`直接回应，或用 @名字 把话交给别人；@${owner.name} 表示等对方回答。`);
  messages.push({ role: 'user', content: [{ type: 'text', text: tail.join('\n\n') }] });
  return { system: buildSystemPrefix(group, members), messages, folded: selection.folded };
}

/**
 * Create an empty replay state.
 * @returns {object} mutable replay state.
 */
export function createState() {
  return {
    messages: [],
    byId: new Map(),
    active: [],
    notices: [],
    routes: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  };
}

/**
 * Apply one stored event to a replay state. Unknown event types are ignored so
 * a newer writer never breaks an older reader.
 *
 * @param {object} state - replay state from {@link createState}.
 * @param {object} event - stored JSONL event.
 * @returns {object} the same state.
 */
export function applyEvent(state, event) {
  if (event === null || typeof event !== 'object') return state;
  if (event.type === 'message') {
    if (typeof event.id !== 'string' || state.byId.has(event.id)) return state;
    const message = {
      id: event.id,
      seq: state.messages.length,
      turnId: event.turnId ?? event.id,
      replyIndex: Number.isInteger(event.replyIndex) ? event.replyIndex : 0,
      ts: Number.isFinite(event.ts) ? event.ts : 0,
      role: event.role === 'user' ? 'user' : 'member',
      memberId: typeof event.memberId === 'string' ? event.memberId : null,
      text: typeof event.text === 'string' ? event.text : '',
      mentions: Array.isArray(event.mentions) ? event.mentions.filter((id) => typeof id === 'string') : [],
      mentionsOwner: event.mentionsOwner === true,
      replyTo: typeof event.replyTo === 'string' ? event.replyTo : null,
      status: event.status === 'superseded' ? 'superseded' : 'active',
      supersedes: typeof event.supersedes === 'string' ? event.supersedes : null,
      pinned: false,
      usage: normalizeUsage(event.usage),
    };
    state.messages.push(message);
    state.byId.set(message.id, message);
    addUsage(state.totals, message.usage);
    if (message.supersedes !== null) markSuperseded(state, message.supersedes, message.id);
    if (message.status !== 'superseded') state.active.push(message);
    return state;
  }
  if (event.type === 'supersede') {
    if (typeof event.target === 'string') markSuperseded(state, event.target, typeof event.by === 'string' ? event.by : null);
    return state;
  }
  if (event.type === 'pin') {
    const message = state.byId.get(event.target);
    if (message !== undefined) message.pinned = event.pinned !== false;
    return state;
  }
  if (event.type === 'notice') {
    state.notices.push({
      id: typeof event.id === 'string' ? event.id : `n_${state.notices.length}`,
      ts: Number.isFinite(event.ts) ? event.ts : 0,
      text: typeof event.text === 'string' ? event.text : '',
      level: event.level === 'warn' ? 'warn' : 'info',
    });
    return state;
  }
  if (event.type === 'route') {
    const route = {
      id: typeof event.id === 'string' ? event.id : `r_${state.routes.length}`,
      turnId: typeof event.turnId === 'string' ? event.turnId : null,
      ts: Number.isFinite(event.ts) ? event.ts : 0,
      targets: Array.isArray(event.targets) ? event.targets.filter((id) => typeof id === 'string') : [],
      bystanders: Array.isArray(event.bystanders) ? event.bystanders.filter((id) => typeof id === 'string') : [],
      method: typeof event.method === 'string' ? event.method : 'unknown',
      reason: typeof event.reason === 'string' ? event.reason : '',
      confidence: Number.isFinite(event.confidence) ? event.confidence : null,
      usage: normalizeUsage(event.usage),
    };
    state.routes.push(route);
    addUsage(state.totals, route.usage);
    return state;
  }
  return state;
}

/**
 * Replay a full events file.
 * @param {Array<object>} events - stored events in file order.
 * @returns {object} replay state.
 */
export function replayEvents(events) {
  const state = createState();
  for (const event of events) applyEvent(state, event);
  return state;
}

/**
 * Mark a message superseded, removing it from the effective view.
 * @param {object} state - replay state.
 * @param {string} target - superseded message id.
 * @param {string|null} by - replacement message id.
 * @returns {void}
 */
function markSuperseded(state, target, by) {
  const message = state.byId.get(target);
  if (message === undefined) return;
  message.status = 'superseded';
  message.supersededBy = by;
  const index = state.active.indexOf(message);
  if (index >= 0) state.active.splice(index, 1);
}

/**
 * Add one usage record to group totals.
 * @param {object} totals - accumulator.
 * @param {{inputTokens?: number, outputTokens?: number, cacheReadTokens?: number, cacheWriteTokens?: number}|null} usage - record.
 * @returns {object} totals.
 */
export function addUsage(totals, usage) {
  if (usage === null || usage === undefined) return totals;
  totals.inputTokens += nonNegative(usage.inputTokens);
  totals.outputTokens += nonNegative(usage.outputTokens);
  totals.cacheReadTokens += nonNegative(usage.cacheReadTokens);
  totals.cacheWriteTokens += nonNegative(usage.cacheWriteTokens);
  return totals;
}

/**
 * Normalize an optional usage record.
 * @param {unknown} usage - stored value.
 * @returns {{inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number}|null} record.
 */
export function normalizeUsage(usage) {
  if (usage === null || typeof usage !== 'object') return null;
  const record = {
    inputTokens: nonNegative(usage.inputTokens),
    outputTokens: nonNegative(usage.outputTokens),
    cacheReadTokens: nonNegative(usage.cacheReadTokens),
    cacheWriteTokens: nonNegative(usage.cacheWriteTokens),
  };
  return record.inputTokens + record.outputTokens > 0 ? record : null;
}

/**
 * Whether the group budget forbids another generation.
 * @param {object} totals - accumulated usage.
 * @param {{maxInputTokens: number, maxOutputTokens: number}} budget - group budget.
 * @returns {string|null} reason, or null when generation may proceed.
 */
export function budgetStop(totals, budget) {
  const maxInput = nonNegative(budget?.maxInputTokens);
  const maxOutput = nonNegative(budget?.maxOutputTokens);
  if (maxInput > 0 && totals.inputTokens >= maxInput) return 'input';
  if (maxOutput > 0 && totals.outputTokens >= maxOutput) return 'output';
  return null;
}

/**
 * Strip a leading `林晚：` speaker prefix a model sometimes adds.
 * @param {string} text - model output.
 * @param {string} name - speaking member's display name.
 * @returns {string} cleaned reply.
 */
export function normalizeReply(text, name) {
  let value = typeof text === 'string' ? text.trim() : '';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  value = value.replace(new RegExp(`^[\\[（(]?${escaped}[\\]）)]?\\s*[:：]\\s*`), '');
  return value.trim();
}

/**
 * Read the owner profile from a group, falling back to the reserved default.
 * @param {object} group - group document.
 * @returns {{name: string, oneLiner: string, setting: string, avatar: string|null, relations: Record<string,string>}} owner.
 */
export function ownerProfile(group) {
  const raw = group?.owner;
  const proposed = typeof raw?.name === 'string' ? raw.name.trim() : '';
  const name = proposed.length === 0 || proposed === OWNER_NAME ? DEFAULT_OWNER_NAME : proposed;
  return {
    name,
    oneLiner: typeof raw?.oneLiner === 'string' ? raw.oneLiner : '',
    setting: typeof raw?.setting === 'string' ? raw.setting : '',
    avatar: typeof raw?.avatar === 'string' && raw.avatar.length > 0 ? raw.avatar : null,
    relations: raw?.relations !== null && typeof raw?.relations === 'object' && !Array.isArray(raw.relations)
      ? raw.relations
      : {},
  };
}

/**
 * Display name used for the owner in history, prompts, exports, and the UI.
 * @param {object} group - group document.
 * @returns {string} owner display name.
 */
export function ownerDisplayName(group) {
  return ownerProfile(group).name;
}

/**
 * Validate the owner's character name. The old title `群主` is rejected so the
 * user gives the role a real name; an empty value falls back to `用户`.
 * @param {string} rawName - proposed name.
 * @param {Array<{name: string}>} members - current members.
 * @returns {{ok: true, name: string}|{ok: false, message: string}} validation.
 */
export function validateOwnerName(rawName, members) {
  const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
  const name = trimmed.length === 0 ? DEFAULT_OWNER_NAME : trimmed;
  if (name === OWNER_NAME) return { ok: false, message: '请给角色起一个名字，不要使用“群主”。' };
  if ([...name].length > 16) return { ok: false, message: '角色名最多 16 个字符，否则 @ 解析会不可靠。' };
  if (/[\s@，。！？、,.!?:：;；]/.test(name)) return { ok: false, message: '角色名不能包含空白、@ 或标点。' };
  if (members.some((member) => member.name === name)) {
    return { ok: false, message: `已有成员叫“${name}”，角色与成员不能重名。` };
  }
  return { ok: true, name };
}

/**
 * Validate a member display name for `@` routing.
 * @param {string} rawName - proposed name.
 * @param {Array<{id: string, name: string}>} members - current members.
 * @param {string|null} [ownId] - member being edited.
 * @returns {{ok: true, name: string}|{ok: false, message: string}} validation.
 */
export function validateMemberName(rawName, members, ownId = null) {
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (name.length === 0) return { ok: false, message: '成员名不能为空。' };
  if ([...name].length > 16) return { ok: false, message: '成员名最多 16 个字符，否则 @ 解析会不可靠。' };
  if (name === OWNER_NAME) return { ok: false, message: '“群主”是保留名。' };
  if (/[\s@，。！？、,.!?:：;；]/.test(name)) return { ok: false, message: '成员名不能包含空白、@ 或标点。' };
  if (members.some((member) => member.id !== ownId && member.name === name)) {
    return { ok: false, message: `已有成员叫“${name}”，重名会让 @ 路由不确定。` };
  }
  return { ok: true, name };
}

/**
 * Format an effective conversation as Markdown.
 *
 * @param {object} input - export inputs.
 * @param {object} input.group - group document.
 * @param {Array<object>} input.members - member documents.
 * @param {object} input.state - replay state with all messages and totals.
 * @param {boolean} [input.includeHistory] - append superseded versions.
 * @param {number} [input.exportedAt] - epoch seconds of the export.
 * @returns {string} Markdown document.
 */
export function formatTranscript({ group, members, state, includeHistory = false, exportedAt = Math.floor(Date.now() / 1000) }) {
  const owner = ownerProfile(group);
  const lines = [`# ${group.name}`, ''];
  if (typeof group.brief === 'string' && group.brief.trim().length > 0) lines.push(`> ${group.brief.trim()}`, '');
  const routes = Array.isArray(state.routes) ? state.routes : [];
  const routeInput = routes.reduce((sum, route) => sum + (route.usage?.inputTokens ?? 0), 0);
  const routeOutput = routes.reduce((sum, route) => sum + (route.usage?.outputTokens ?? 0), 0);
  lines.push(
    `- 角色：${owner.name}`,
    `- 成员：${members.map((member) => member.name).join('、') || '（无）'}`,
    `- 导出时间：${new Date(exportedAt * 1000).toISOString()}`,
    `- Token 累计：输入 ${state.totals.inputTokens.toLocaleString('en-US')} · 输出 ${state.totals.outputTokens.toLocaleString('en-US')} · 缓存读 ${state.totals.cacheReadTokens.toLocaleString('en-US')} · 缓存写 ${state.totals.cacheWriteTokens.toLocaleString('en-US')}`,
    ...(routes.length === 0
      ? []
      : [`- 路由调用：${routes.length} 次 · 输入 ${routeInput.toLocaleString('en-US')} · 输出 ${routeOutput.toLocaleString('en-US')}`]),
    '',
    '## 群聊记录',
    '',
  );
  let turn = 0;
  let lastTurnId = null;
  for (const message of state.active) {
    if (message.turnId !== lastTurnId) {
      turn += 1;
      lastTurnId = message.turnId;
    }
    const speaker = speakerName(message, members, owner.name);
    const time = new Date(message.ts * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
    lines.push(`### 第 ${turn} 轮 · ${speaker}`, '', `_${time}_`, '', message.text, '');
    if (message.usage !== null) {
      lines.push(
        `_tokens: 输入 ${message.usage.inputTokens} · 输出 ${message.usage.outputTokens} · 缓存读 ${message.usage.cacheReadTokens} · 缓存写 ${message.usage.cacheWriteTokens}_`,
        '',
      );
    }
  }
  if (state.active.length === 0) lines.push('（暂无有效消息）', '');
  if (includeHistory) {
    const superseded = state.messages.filter((message) => message.status === 'superseded');
    if (superseded.length > 0) {
      lines.push('## 历史版本', '');
      for (const message of superseded) {
        const speaker = speakerName(message, members, owner.name);
        const time = new Date(message.ts * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
        lines.push(`### ${speaker} · 已被重写`, '', `_${time}_`, '', message.text, '');
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Clamp an integer with a fallback for absent/invalid input.
 * @param {unknown} value - candidate.
 * @param {number} min - minimum.
 * @param {number} max - maximum.
 * @param {number} fallback - used when the value is not finite.
 * @returns {number} clamped integer.
 */
export function clampInt(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Normalize a user-supplied policy object.
 * @param {object} [policy] - partial policy.
 * @returns {typeof DEFAULT_POLICY} full policy.
 */
export function normalizePolicy(policy) {
  return {
    replyMode: 'smart-router',
    smartRouting: policy?.smartRouting !== false,
    maxMentionReplies: clampInt(policy?.maxMentionReplies, 1, 3, DEFAULT_POLICY.maxMentionReplies),
    bystanderChance: clampInt(policy?.bystanderChance, 0, 100, DEFAULT_POLICY.bystanderChance),
    maxHandoffDepth: clampInt(policy?.maxHandoffDepth, 0, 3, DEFAULT_POLICY.maxHandoffDepth),
    maxHistory: clampInt(policy?.maxHistory, 1, 200, DEFAULT_POLICY.maxHistory),
    maxPinned: clampInt(policy?.maxPinned, 0, 30, DEFAULT_POLICY.maxPinned),
    maxReplyChars: clampInt(policy?.maxReplyChars, 20, 4000, DEFAULT_POLICY.maxReplyChars),
  };
}

/**
 * Normalize a user-supplied budget object.
 * @param {object} [budget] - partial budget.
 * @returns {typeof DEFAULT_BUDGET} full budget.
 */
export function normalizeBudget(budget) {
  return {
    maxInputTokens: clampInt(budget?.maxInputTokens, 0, 10_000_000, DEFAULT_BUDGET.maxInputTokens),
    maxOutputTokens: clampInt(budget?.maxOutputTokens, 0, 1_000_000, DEFAULT_BUDGET.maxOutputTokens),
  };
}

/**
 * Trim a string, falling back to placeholder text when empty.
 * @param {unknown} value - candidate.
 * @param {string} fallback - text for an empty value.
 * @returns {string} text.
 */
function trimToFallback(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Coerce one usage field to a non-negative number.
 * @param {unknown} value - candidate.
 * @returns {number} number.
 */
function nonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
