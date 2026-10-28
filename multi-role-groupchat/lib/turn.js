/**
 * One owner turn under the smart-router protocol.
 *
 * 1. Append the owner message.
 * 2. Route it to a guaranteed addressee set (explicit @/name, pronoun, or a
 *    small model classifier; local rotation if all else fails).
 * 3. Let each remaining member reply with a configurable probability.
 * 4. Follow only explicit member-to-member handoffs, up to the depth limit.
 *
 * All persistence is injected so this module stays testable with a fake
 * generator and an in-memory message list.
 */

import {
  generationCap,
  normalizeReply,
  ownerDisplayName,
  parseMentions,
  speakerName,
} from './protocol.js';
import { resolveRoute } from './router.js';

/**
 * Run one turn.
 *
 * @param {object} input - turn inputs and I/O seams.
 * @param {object} input.group - group document.
 * @param {Array<object>} input.members - member documents.
 * @param {() => Array<object>} input.getActive - effective messages, including
 *   everything appended by this turn.
 * @param {(message: object) => void} input.appendMessage - persist a message and
 *   make it effective.
 * @param {(route: object) => void} [input.appendRoute] - persist the route event.
 * @param {(text: string, level?: 'info'|'warn', retry?: object) => object} input.appendNotice - persist a notice.
 * @param {() => object} input.getTotals - accumulated token usage.
 * @param {(request: object) => Promise<{text: string, usage: object|null}>} input.generate - model call.
 * @param {(request: object) => Promise<object|null>} [input.route] - model classifier.
 * @param {() => number} [input.random] - random source for bystander sampling.
 * @param {(event: object) => void} input.emit - stream one NDJSON event.
 * @param {AbortSignal} input.signal - cancellation for user stop and disconnect.
 * @param {string} input.userText - owner message body.
 * @param {string} input.turnId - id used as the turn id (the owner message id).
 * @param {() => number} [input.now] - epoch seconds.
 * @param {(prefix: string) => string} [input.makeId] - id generator.
 * @returns {Promise<{generated: number, reason: string}>} turn outcome.
 */
export async function runTurn(input) {
  const {
    group,
    members,
    getActive,
    appendMessage,
    appendRoute,
    appendNotice,
    getTotals,
    generate,
    emit,
    signal,
    userText,
    turnId,
  } = input;
  const now = input.now ?? (() => Math.floor(Date.now() / 1000));
  const makeId = input.makeId ?? makeMessageId;
  const random = input.random ?? Math.random;
  const memberMap = new Map(members.map((member) => [member.id, member]));
  const policy = group.policy;
  const budget = group.budget ?? {};
  const depth = policy.maxHandoffDepth;
  const ownerName = ownerDisplayName(group);

  const parsedUser = parseMentions(userText, members, { ownerName });
  const userMessage = {
    id: turnId,
    seq: -1,
    turnId,
    replyIndex: 0,
    ts: now(),
    role: 'user',
    memberId: null,
    text: userText,
    mentions: parsedUser.memberIds,
    mentionsOwner: parsedUser.owner,
    replyTo: null,
    status: 'active',
    supersedes: null,
    pinned: false,
    usage: null,
  };
  await appendMessage(userMessage);
  emit({ type: 'message', message: userMessage });

  const decision = await resolveRoute({
    group,
    members,
    activeMessages: getActive(),
    userText,
    classifier: input.route,
    signal,
  });
  if (signal.aborted) {
    emit({ type: 'stopped', reason: 'user' });
    return { generated: 0, reason: 'stopped' };
  }

  const maxTargets = Math.max(1, Math.min(3, Number(policy.maxMentionReplies) || 1));
  const targets = decision.targets
    .filter((id) => memberMap.has(id))
    .slice(0, maxTargets);
  const targetSet = new Set(targets);
  const chance = Math.min(100, Math.max(0, Number(policy.bystanderChance) || 0));
  const bystanders = [];
  if (decision.method !== 'owner') {
    for (const member of members) {
      if (targetSet.has(member.id)) continue;
      if (random() * 100 < chance) bystanders.push(member.id);
    }
  }

  const routeRecord = {
    turnId,
    ts: now(),
    targets,
    bystanders,
    method: decision.method,
    reason: decision.reason,
    confidence: decision.confidence,
    usage: decision.usage,
  };
  if (typeof appendRoute === 'function') await appendRoute(routeRecord);
  emit({ type: 'route', route: routeRecord });

  let last = userMessage;
  let generated = 0;

  const retryMeta = (member, replyTo, routeRole, replyIndex) => ({
    turnId,
    memberId: member.id,
    replyIndex,
    replyTo: replyTo === null ? null : replyTo.id,
    routeRole,
    attempts: 1,
    resolved: false,
  });

  const finish = (reason) => ({ generated, reason });

  const pauseForBudget = () => {
    const totals = getTotals();
    const inputOver = Number(budget.maxInputTokens) > 0
      && totals.inputTokens >= Number(budget.maxInputTokens);
    const text = inputOver
      ? `预算不足（输入 ${totals.inputTokens.toLocaleString('en-US')} / 上限 ${Number(budget.maxInputTokens).toLocaleString('en-US')}），已暂停。`
      : `预算不足（输出 ${totals.outputTokens.toLocaleString('en-US')} / 上限 ${Number(budget.maxOutputTokens ?? 0).toLocaleString('en-US')}），已暂停。`;
    const notice = appendNotice(text, 'warn');
    emit({ type: 'notice', notice });
    emit({ type: 'totals', totals });
    return finish('budget');
  };

  const budgetReason = () => {
    const totals = getTotals();
    const maxInput = Number(budget.maxInputTokens) || 0;
    const maxOutput = Number(budget.maxOutputTokens) || 0;
    if (maxInput > 0 && totals.inputTokens >= maxInput) return 'input';
    if (maxOutput > 0 && totals.outputTokens >= maxOutput) return 'output';
    return null;
  };

  const stopped = () => {
    emit({ type: 'stopped', reason: 'user' });
    return finish('stopped');
  };

  /**
   * Generate one member reply and append it when the model produced text.
   * @param {object} member - speaking member.
   * @param {object|null} replyTo - message answered by this reply.
   * @param {'addressed'|'bystander'|'handoff'} routeRole - why this member is speaking.
   * @returns {Promise<object|null>} appended message, or null when the turn ended.
   */
  const reply = async (member, replyTo, routeRole) => {
    const replyIndex = generated + 1;
    emit({
      type: 'generating',
      memberId: member.id,
      memberName: member.name,
      replyIndex,
      routeRole,
      turnId,
    });
    let result;
    try {
      result = await generate({
        member,
        activeMessages: getActive(),
        sourceUserText: userText,
        replyIndex,
        previousName: speakerName(replyTo ?? last, members, ownerName),
        routeRole,
        signal,
      });
    } catch (error) {
      if (signal.aborted) {
        emit({ type: 'stopped', reason: 'user' });
        return null;
      }
      const failure = error instanceof Error ? error.message : String(error);
      // Persist the failure so a reload still explains why the turn stopped;
      // the ephemeral `error` event alone disappears with the stream.
      let notice = null;
      try {
        notice = appendNotice(
          `${member.name} 回应失败：${failure}`,
          'warn',
          retryMeta(member, replyTo, routeRole, replyIndex),
        );
        emit({ type: 'notice', notice });
      } catch {
        /* A notice is best effort; the error event still reaches the UI. */
      }
      emit({
        type: 'error',
        message: failure,
        memberId: member.id,
        memberName: member.name,
      });
      return null;
    }
    if (signal.aborted) {
      emit({ type: 'stopped', reason: 'user' });
      return null;
    }
    const text = normalizeReply(result?.text, member.name);
    if (text.length === 0) {
      const notice = appendNotice(
        `${member.name} 没有产出内容，本轮已停止。`,
        'warn',
        retryMeta(member, replyTo, routeRole, replyIndex),
      );
      emit({ type: 'notice', notice });
      return null;
    }
    const mentions = parseMentions(text, members, { selfId: member.id, ownerName });
    const message = {
      id: makeId('m'),
      seq: -1,
      turnId,
      replyIndex,
      ts: now(),
      role: 'member',
      memberId: member.id,
      text,
      mentions: mentions.memberIds,
      mentionsOwner: mentions.owner,
      replyTo: replyTo === null ? null : replyTo.id,
      status: 'active',
      supersedes: null,
      pinned: false,
      usage: result?.usage ?? null,
    };
    await appendMessage(message);
    emit({ type: 'message', message });
    emit({ type: 'totals', totals: getTotals() });
    generated += 1;
    last = message;
    return message;
  };

  if (decision.method === 'owner' || (targets.length === 0 && bystanders.length === 0)) {
    return finish(decision.method === 'owner' ? 'owner' : 'no-speaker');
  }

  const initial = [
    ...targets.map((id) => ({ id, role: 'addressed' })),
    ...bystanders.map((id) => ({ id, role: 'bystander' })),
  ];
  const cap = generationCap(initial.length, policy);

  // Explicit member mentions are queued rather than followed only through the
  // last message. A single message can hand the floor to two people, and a
  // planned bystander must not erase an earlier handoff.
  const replied = new Set();
  const scheduled = new Set(initial.map((entry) => entry.id));
  const pending = [];
  let depthBlocked = false;
  const scheduleMentions = (message, nextDepth) => {
    for (const id of message.mentions) {
      if (id === message.memberId || !memberMap.has(id) || replied.has(id) || scheduled.has(id)) continue;
      if (nextDepth > depth) {
        depthBlocked = true;
        continue;
      }
      pending.push({ id, depth: nextDepth, from: message });
      scheduled.add(id);
    }
  };

  for (const entry of initial) {
    if (signal.aborted) return stopped();
    if (generated >= cap) return finish('cap');
    if (budgetReason() !== null) return pauseForBudget();
    const member = memberMap.get(entry.id);
    if (member === undefined) continue;
    const message = await reply(member, last, entry.role);
    if (message === null) return finish('interrupted');
    replied.add(entry.id);
    scheduleMentions(message, 1);
  }

  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    if (signal.aborted) return stopped();
    if (generated >= cap) return finish('cap');
    if (budgetReason() !== null) return pauseForBudget();
    const entry = pending[cursor];
    const member = memberMap.get(entry.id);
    if (member === undefined) continue;
    const message = await reply(member, entry.from, 'handoff');
    if (message === null) return finish('interrupted');
    replied.add(entry.id);
    scheduleMentions(message, entry.depth + 1);
  }

  if (signal.aborted) return stopped();
  if (budgetReason() !== null) return pauseForBudget();
  if (depthBlocked) return finish('cap');
  return finish(last.mentionsOwner ? 'owner' : 'settled');
}

/**
 * Default message id generator.
 * @param {string} prefix - id prefix such as `m`.
 * @returns {string} id.
 */
export function makeMessageId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
