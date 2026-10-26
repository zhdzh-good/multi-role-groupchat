/**
 * Authenticated HTTP routes for the group-chat panel.
 *
 * Everything rides Connection's authenticated `/api` Fetch bridge, so the
 * browser's existing session cookie is the only credential involved. There is
 * no public route and no second server.
 */

import { budgetStop, formatTranscript, normalizeReply, ownerDisplayName, ownerProfile, parseMentions, speakerName } from './protocol.js';
import { createGenerator, createRouteClassifier } from './generate.js';
import {
  GROUP_FORMAT,
  PORTABLE_MAX_BYTES,
  PortableError,
  buildCharacterCard,
  buildGroupBundle,
  mapCharacterRelations,
  normalizeCharacterCard,
  normalizeGroupBundle,
  parsePortable,
  portableFilename,
  previewGroupBundle,
} from './portable.js';
import { GroupChatError, makeId } from './store.js';
import { runTurn } from './turn.js';

/** Longest accepted owner message body. */
const MAX_USER_TEXT = 8000;

/**
 * Register all routes on the plugin context.
 * @param {object} ctx - Host context with `connection`.
 * @param {import('./store.js').GroupStore} store - group store.
 * @returns {void}
 */
export function registerRoutes(ctx, store) {
  const register = (path, methods, handler) => {
    ctx.effect(
      () => ctx.connection.fetch.register({
        path,
        methods,
        requestBody: 'buffered',
        fetch: (request) => guard(handler, request),
      }),
      `groupchat: ${path}`,
    );
  };
  register('/api/groupchat.state', ['GET'], (request) => handleState(ctx, store, request));
  register('/api/groupchat.models', ['GET'], () => handleModels(ctx));
  register('/api/groupchat.group-create', ['POST'], (request) => handleGroupCreate(store, request));
  register('/api/groupchat.group-update', ['POST'], (request) => handleGroupUpdate(store, request));
  register('/api/groupchat.group-delete', ['POST'], (request) => handleGroupDelete(store, request));
  register('/api/groupchat.member-save', ['POST'], (request) => handleMemberSave(store, request));
  register('/api/groupchat.send', ['POST'], (request) => handleSend(ctx, store, request));
  register('/api/groupchat.stop', ['POST'], (request) => handleStop(store, request));
  register('/api/groupchat.rewrite', ['POST'], (request) => handleRewrite(ctx, store, request));
  register('/api/groupchat.pin', ['POST'], (request) => handlePin(store, request));
  register('/api/groupchat.export', ['POST'], (request) => handleExport(store, request));
  register('/api/groupchat.portable-export', ['POST'], (request) => handlePortableExport(store, request));
  register('/api/groupchat.portable-group-preview', ['POST'], (request) => handlePortableGroupPreview(request));
  register('/api/groupchat.portable-group-import', ['POST'], (request) => handlePortableGroupImport(store, request));
  register('/api/groupchat.portable-character-preview', ['POST'], (request) => handlePortableCharacterPreview(store, request));
}

/**
 * Turn any handler failure into a JSON response without leaking internals.
 * @param {(request: Request) => Promise<Response>} handler - route handler.
 * @param {Request} request - incoming request.
 * @returns {Promise<Response>} response.
 */
async function guard(handler, request) {
  try {
    return await handler(request);
  } catch (error) {
    const status = error instanceof GroupChatError || error instanceof PortableError ? error.status : 500;
    const code = error instanceof GroupChatError || error instanceof PortableError ? error.code : 'groupchat/internal';
    const message = error instanceof Error ? error.message : String(error);
    if (status >= 500) console.error('[multi-role-groupchat]', error);
    return json({ error: { code, message } }, status);
  }
}

/**
 * Read a JSON request body with a small size ceiling.
 * @param {Request} request - request.
 * @returns {Promise<object>} decoded object.
 */
async function readBody(request, maxLength = 1_000_000) {
  const text = await request.text();
  if (text.length > maxLength) throw new GroupChatError('请求体过大。', 413, 'groupchat/body-too-large');
  if (text.trim().length === 0) return {};
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new GroupChatError('请求体必须是对象。');
    }
    return value;
  } catch (error) {
    if (error instanceof GroupChatError) throw error;
    throw new GroupChatError('请求体不是有效 JSON。');
  }
}

/**
 * JSON response with no caching.
 * @param {unknown} value - body.
 * @param {number} [status] - status.
 * @returns {Response} response.
 */
function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
}

/**
 * Current Host default model selection.
 * @param {object} ctx - Host context.
 * @returns {{provider: string, model: string, reasoningEffort?: string}|null} selection.
 */
function defaultModelOf(ctx) {
  const service = ctx.get('agentDefaultModel');
  if (service === undefined || service === null) return null;
  try {
    const selection = service.currentSelection();
    if (selection === null || typeof selection !== 'object') return null;
    if (typeof selection.provider !== 'string' || typeof selection.model !== 'string') return null;
    return {
      provider: selection.provider,
      model: selection.model,
      ...(typeof selection.reasoningEffort === 'string' ? { reasoningEffort: selection.reasoningEffort } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * GET state: the group list, the Host default model, and one selected group.
 * @param {object} ctx - Host context.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} state.
 */
async function handleState(ctx, store, request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('groupId');
  const groups = await store.listGroups();
  let selected = null;
  let selectedId = null;
  if (requested !== null) {
    try {
      selected = await store.stateView(requested);
      selectedId = requested;
    } catch (error) {
      if (!(error instanceof GroupChatError) || error.status !== 404) throw error;
    }
  }
  if (selected === null && groups.length > 0) {
    selected = await store.stateView(groups[0].id);
    selectedId = groups[0].id;
  }
  return json({
    dataDir: store.root,
    defaultModel: defaultModelOf(ctx),
    groups,
    selectedId,
    selected,
  });
}

/**
 * GET the registered providers and their model catalogs, for override pickers.
 * @param {object} ctx - Host context.
 * @returns {Promise<Response>} catalog.
 */
async function handleModels(ctx) {
  const providers = [];
  for (const provider of ctx.llm.listProviders()) {
    let models = [];
    let error;
    try {
      models = (await ctx.llm.listModels(provider.id)).map((model) => ({
        id: model.id,
        name: typeof model.name === 'string' && model.name.length > 0 ? model.name : model.id,
      }));
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    }
    providers.push({ id: provider.id, name: provider.name ?? provider.id, models, ...(error === undefined ? {} : { error }) });
  }
  return json({ defaultModel: defaultModelOf(ctx), providers });
}

/**
 * POST create a group.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} created state.
 */
async function handleGroupCreate(store, request) {
  const body = await readBody(request);
  const live = await store.createGroup({
    name: body.name,
    brief: body.brief,
    members: body.members,
  });
  return json({ groupId: live.gid, state: await store.stateView(live.gid) });
}

/**
 * POST update group settings.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} updated state.
 */
async function handleGroupUpdate(store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string') throw new GroupChatError('缺少 groupId。');
  await store.updateGroup(body.groupId, {
    name: body.name,
    brief: body.brief,
    owner: body.owner,
    policy: body.policy,
    budget: body.budget,
    model: body.model,
  });
  return json({ state: await store.stateView(body.groupId) });
}

/**
 * POST delete one group after its full name is supplied as confirmation.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} deletion result.
 */
async function handleGroupDelete(store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string') throw new GroupChatError('缺少 groupId。');
  const live = await store.load(body.groupId);
  if (typeof body.confirmName !== 'string' || body.confirmName !== live.group.name) {
    throw new GroupChatError('群名不匹配，未删除。请输入完整群名确认。', 400, 'groupchat/confirm-mismatch');
  }
  await store.deleteGroup(body.groupId);
  return json({ deleted: true, groupId: body.groupId });
}

/**
 * POST create or edit one member.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} updated state.
 */
async function handleMemberSave(store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string') throw new GroupChatError('缺少 groupId。');
  const member = await store.saveMember(body.groupId, body);
  return json({ member, state: await store.stateView(body.groupId) });
}

/**
 * Reserve the single active turn for a group.
 * @param {object} store - group store.
 * @param {string} gid - group id.
 * @returns {Promise<object>} turn record.
 */
async function beginTurn(store, gid) {
  await store.load(gid);
  if (store.turns.has(gid)) throw new GroupChatError('这个群正在生成，请先停止或等待完成。', 409, 'groupchat/busy');
  const turn = {
    abort: new AbortController(),
    startedAt: Date.now(),
    memberId: null,
    memberName: null,
    phase: 'thinking',
    groupId: gid,
  };
  store.turns.set(gid, turn);
  return turn;
}

/**
 * POST send one owner message and stream the replies as NDJSON.
 * @param {object} ctx - Host context.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} stream response.
 */
async function handleSend(ctx, store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string') throw new GroupChatError('缺少 groupId。');
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length === 0) throw new GroupChatError('消息不能为空。');
  if ([...text].length > MAX_USER_TEXT) throw new GroupChatError(`消息最多 ${MAX_USER_TEXT} 个字符。`);
  const live = await store.load(body.groupId);
  if (live.members.length === 0) throw new GroupChatError('这个群还没有成员。');
  const turn = await beginTurn(store, body.groupId);
  const defaultModel = defaultModelOf(ctx);
  const turnId = makeId('m');
  return streamResponse(store, turn, request.signal, async ({ send, signal }) => {
    const generate = createGenerator(ctx, live, defaultModel);
    const classify = createRouteClassifier(ctx, live, defaultModel);
    const emit = (event) => {
      if (event.type === 'generating') {
        turn.phase = 'replying';
        turn.memberId = event.memberId;
        turn.memberName = event.memberName;
      }
      send(event);
    };
    await runTurn({
      group: live.group,
      members: live.members,
      getActive: () => live.state.active,
      appendMessage: (message) => store.appendMessage(body.groupId, message),
      appendRoute: (route) => store.appendRoute(body.groupId, route),
      appendNotice: (noticeText, level) => store.appendNotice(body.groupId, noticeText, level),
      getTotals: () => live.state.totals,
      generate,
      route: classify,
      emit,
      signal,
      userText: text,
      turnId,
      makeId,
    });
  });
}

/**
 * POST stop the active turn.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} stop result.
 */
async function handleStop(store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string') throw new GroupChatError('缺少 groupId。');
  const turn = store.turns.get(body.groupId);
  if (turn === undefined) return json({ stopped: false });
  turn.abort.abort();
  return json({ stopped: true });
}

/**
 * POST rewrite the newest effective member message.
 * @param {object} ctx - Host context.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} stream response.
 */
async function handleRewrite(ctx, store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string' || typeof body.messageId !== 'string') {
    throw new GroupChatError('缺少 groupId 或 messageId。');
  }
  const live = await store.load(body.groupId);
  const target = live.state.byId.get(body.messageId);
  if (target === undefined || target.status !== 'active') {
    throw new GroupChatError('消息不存在或已被重写。', 404, 'groupchat/message-not-found');
  }
  const latest = live.state.active[live.state.active.length - 1];
  if (latest === undefined || latest.id !== target.id) {
    throw new GroupChatError('首版只能重写最新一条有效消息。');
  }
  if (target.role !== 'member') throw new GroupChatError('只有成员回应可以重写。');
  const member = live.members.find((candidate) => candidate.id === target.memberId);
  if (member === undefined) throw new GroupChatError('该成员已不在群里，无法重写。', 409);
  const source = live.state.messages.find((message) => message.turnId === target.turnId && message.role === 'user');
  const turn = await beginTurn(store, body.groupId);
  const defaultModel = defaultModelOf(ctx);
  return streamResponse(store, turn, request.signal, async ({ send, signal }) => {
    const generate = createGenerator(ctx, live, defaultModel);
    const replyIndex = Math.max(1, target.replyIndex);
    const activeBefore = live.state.active.filter((message) => message.id !== target.id);
    const previous = activeBefore[activeBefore.length - 1];
    const over = budgetStop(live.state.totals, live.group.budget);
    if (over !== null) {
      const notice = store.appendNotice(
        body.groupId,
        `预算不足（${over === 'input' ? '输入' : '输出'} token 已达上限），已暂停重写。`,
        'warn',
      );
      send({ type: 'notice', notice });
      send({ type: 'totals', totals: live.state.totals });
      return;
    }
    turn.phase = 'replying';
    turn.memberId = member.id;
    turn.memberName = member.name;
    send({
      type: 'generating',
      memberId: member.id,
      memberName: member.name,
      replyIndex,
      turnId: target.turnId,
      rewrite: target.id,
    });
    const result = await generate({
      member,
      activeMessages: activeBefore,
      sourceUserText: source?.text ?? '（没有找到触发这条回应的用户消息）',
      replyIndex,
      previousName: previous === undefined
        ? ownerDisplayName(live.group)
        : speakerName(previous, live.members, ownerDisplayName(live.group)),
      signal,
    });
    const text = normalizeReply(result.text, member.name);
    if (text.length === 0) throw new Error(`${member.name} 没有产出内容，旧版本保持不变。`);
    const mentions = parseMentions(text, live.members, {
      selfId: member.id,
      ownerName: ownerDisplayName(live.group),
    });
    const replacement = {
      id: makeId('m'),
      turnId: target.turnId,
      replyIndex,
      ts: Math.floor(Date.now() / 1000),
      role: 'member',
      memberId: member.id,
      text,
      mentions: mentions.memberIds,
      mentionsOwner: mentions.owner,
      replyTo: target.replyTo,
      supersedes: target.id,
      usage: result.usage,
    };
    await store.appendMessage(body.groupId, replacement);
    await store.appendSupersede(body.groupId, target.id, replacement.id);
    if (target.pinned === true) await store.setPin(body.groupId, replacement.id, true);
    send({ type: 'supersede', target: target.id, by: replacement.id });
    send({ type: 'message', message: replacement });
    send({ type: 'totals', totals: live.state.totals });
  });
}

/**
 * POST toggle a pin.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} updated state.
 */
async function handlePin(store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string' || typeof body.messageId !== 'string') {
    throw new GroupChatError('缺少 groupId 或 messageId。');
  }
  await store.setPin(body.groupId, body.messageId, body.pinned === true);
  return json({ state: await store.stateView(body.groupId) });
}

/**
 * POST export Markdown to `export/script.md` and return it.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} export result.
 */
async function handleExport(store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string') throw new GroupChatError('缺少 groupId。');
  const live = await store.load(body.groupId);
  const markdown = formatTranscript({
    group: live.group,
    members: live.members,
    state: live.state,
    includeHistory: body.includeHistory === true,
  });
  const file = await store.writeExport(body.groupId, markdown);
  return json({ markdown, path: file, writtenAt: Math.floor(Date.now() / 1000) });
}

/**
 * POST export one group backup or one character card.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} portable JSON metadata and data.
 */
async function handlePortableExport(store, request) {
  const body = await readBody(request);
  if (typeof body.groupId !== 'string') throw new GroupChatError('缺少 groupId。');
  const live = await store.load(body.groupId);
  const scope = body.scope === 'owner' || body.scope === 'member' ? body.scope : 'group';
  const includeAvatars = body.includeAvatars !== false;
  let data;
  let filename;
  let kind;
  if (scope === 'group') {
    data = buildGroupBundle({ group: live.group, members: live.members, includeAvatars });
    filename = portableFilename(live.group.name, '.groupchat.json');
    kind = 'group';
  } else if (scope === 'owner') {
    data = buildCharacterCard({
      kind: 'owner',
      profile: ownerProfile(live.group),
      members: live.members,
      includeAvatar: includeAvatars,
    });
    filename = portableFilename(data.character.name, '.owner.character.json');
    kind = 'owner';
  } else {
    if (typeof body.memberId !== 'string') throw new GroupChatError('缺少 memberId。');
    const member = live.members.find((candidate) => candidate.id === body.memberId);
    if (member === undefined) throw new GroupChatError('成员不存在。', 404, 'groupchat/member-not-found');
    data = buildCharacterCard({
      kind: 'member',
      profile: member,
      members: live.members,
      includeAvatar: includeAvatars,
    });
    filename = portableFilename(member.name, '.member.character.json');
    kind = 'member';
  }
  const serialized = JSON.stringify(data);
  return json({
    kind,
    format: data.format,
    version: data.version,
    filename,
    bytes: Buffer.byteLength(serialized, 'utf8'),
    data,
  });
}

/**
 * POST validate a group backup and return a preview without writing data.
 * @param {Request} request - request.
 * @returns {Promise<Response>} preview.
 */
async function handlePortableGroupPreview(request) {
  const text = await readPortableText(request);
  const parsed = parsePortable(text, 'group');
  const normalized = normalizeGroupBundle(parsed.value);
  const preview = previewGroupBundle(normalized, { bytes: Buffer.byteLength(text, 'utf8') });
  return json({
    kind: 'group',
    format: GROUP_FORMAT,
    version: parsed.version,
    preview,
    warnings: [...parsed.warnings, ...normalized.warnings],
  });
}

/**
 * POST import a group backup as a new group.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} created group and state.
 */
async function handlePortableGroupImport(store, request) {
  const text = await readPortableText(request);
  const parsed = parsePortable(text, 'group');
  const normalized = normalizeGroupBundle(parsed.value);
  const live = await store.importGroup(normalized);
  return json({
    groupId: live.gid,
    state: await store.stateView(live.gid),
    warnings: [...parsed.warnings, ...normalized.warnings],
  });
}

/**
 * POST validate one character card and map its relations onto current members.
 * The browser fills the edit form; saving still goes through the normal routes.
 * @param {object} store - group store.
 * @param {Request} request - request.
 * @returns {Promise<Response>} normalized form fields.
 */
async function handlePortableCharacterPreview(store, request) {
  const body = await readBody(request, 6_000_000);
  if (typeof body.groupId !== 'string') throw new GroupChatError('缺少 groupId。');
  if (typeof body.text !== 'string' || body.text.trim().length === 0) {
    throw new GroupChatError('缺少角色卡内容。');
  }
  if (Buffer.byteLength(body.text, 'utf8') > PORTABLE_MAX_BYTES) {
    throw new PortableError('文件超过 4 MB，无法导入。', 'groupchat/portable-too-large', 413);
  }
  const target = body.target === 'owner' ? 'owner' : 'member';
  const live = await store.load(body.groupId);
  let memberId = null;
  if (target === 'member' && typeof body.memberId === 'string') {
    const member = live.members.find((candidate) => candidate.id === body.memberId);
    if (member === undefined) throw new GroupChatError('成员不存在。', 404, 'groupchat/member-not-found');
    memberId = member.id;
  }
  const parsed = parsePortable(body.text, 'character');
  const normalized = normalizeCharacterCard(parsed.value, target);
  const mapped = mapCharacterRelations(normalized.character, live.members, {
    kind: target,
    selfId: memberId,
  });
  const fields = target === 'owner'
    ? {
        name: normalized.character.name,
        oneLiner: normalized.character.oneLiner,
        setting: normalized.character.setting,
        avatar: normalized.character.avatar,
        relations: mapped.relations,
      }
    : {
        name: normalized.character.name,
        oneLiner: normalized.character.oneLiner,
        style: normalized.character.style,
        core: normalized.character.core,
        extended: normalized.character.extended,
        extendedEnabled: normalized.character.extendedEnabled,
        avatar: normalized.character.avatar,
        relations: mapped.relations,
        model: normalized.character.model,
      };
  const warnings = [...parsed.warnings, ...normalized.warnings, ...mapped.warnings];
  const ownerName = ownerDisplayName(live.group);
  const others = live.members.filter((member) => member.id !== memberId);
  if (target === 'owner') {
    if (others.some((member) => member.name === fields.name)) {
      warnings.push(`已有成员叫“${fields.name}”，保存会因重名失败。`);
    }
  } else {
    if (fields.name === ownerName) {
      warnings.push(`角色已经叫“${ownerName}”，保存会因重名失败。`);
    }
    if (others.some((member) => member.name === fields.name)) {
      warnings.push(`已有成员叫“${fields.name}”，保存会因重名失败。`);
    }
    if (memberId === null && live.members.length >= 3) {
      warnings.push('这个群已有 3 个成员，新增前需要先移除一个。');
    }
  }
  return json({
    kind: 'character',
    characterKind: target,
    fields,
    warnings,
  });
}

/**
 * Read and size-check a portable JSON payload.
 * @param {Request} request - request.
 * @returns {Promise<string>} JSON text.
 */
async function readPortableText(request) {
  const body = await readBody(request, 6_000_000);
  if (typeof body.text !== 'string' || body.text.trim().length === 0) {
    throw new GroupChatError('缺少导入文件内容。');
  }
  if (Buffer.byteLength(body.text, 'utf8') > PORTABLE_MAX_BYTES) {
    throw new PortableError('文件超过 4 MB，无法导入。', 'groupchat/portable-too-large', 413);
  }
  return body.text;
}

/**
 * Stream a turn as NDJSON over one authenticated POST response.
 *
 * The turn record owns the abort controller; the route's request signal stops
 * generation when the browser disconnects. A final `state` event lets the
 * client replace its incremental view with the authoritative one.
 *
 * @param {object} store - group store.
 * @param {object} turn - reserved turn record.
 * @param {AbortSignal} requestSignal - request lifetime.
 * @param {(io: {send: (event: object) => void, signal: AbortSignal}) => Promise<void>} run - body.
 * @returns {Response} streaming response.
 */
function streamResponse(store, turn, requestSignal, run) {
  const encoder = new TextEncoder();
  const signal = AbortSignal.any([requestSignal, turn.abort.signal]);
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await run({ send, signal });
        if (!closed && !signal.aborted) send({ type: 'state', state: await store.stateView(turn.groupId) });
      } catch (error) {
        if (signal.aborted) send({ type: 'stopped', reason: 'user' });
        else send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      } finally {
        if (store.turns.get(turn.groupId) === turn) store.turns.delete(turn.groupId);
        if (!closed) {
          send({ type: 'done' });
          try {
            controller.close();
          } catch {
            closed = true;
          }
        }
      }
    },
    cancel() {
      turn.abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
