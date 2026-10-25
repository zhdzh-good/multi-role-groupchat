/**
 * One user turn: append the owner message, generate the mentioned replies, then
 * run the handoff loop exactly as the plan's §3.1 flow describes.
 *
 * All persistence is injected so this module stays pure enough to test with a
 * fake generator and in-memory message list.
 */

import {
  OWNER_NAME,
  generationCap,
  normalizeReply,
  ownerDisplayName,
  parseMentions,
  pickRotation,
  speakerName,
} from './protocol.js';

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
 * @param {(text: string, level?: 'info'|'warn') => object} input.appendNotice - persist a notice.
 * @param {() => object} input.getTotals - accumulated token usage.
 * @param {(request: object) => Promise<{text: string, usage: object|null}>} input.generate - model call.
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

  const cap = generationCap(parsedUser.memberIds.length, policy);
  const initialTargets = parsedUser.memberIds
    .filter((id) => memberMap.has(id))
    .slice(0, policy.maxMentionReplies);
  const rotating = initialTargets.length === 0;
  let last = userMessage;
  let generated = 0;
  let handoff = 0;

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
   * @returns {Promise<object|null>} appended message, or null when the turn ended.
   */
  const reply = async (member, replyTo) => {
    const replyIndex = generated + 1;
    emit({
      type: 'generating',
      memberId: member.id,
      memberName: member.name,
      replyIndex,
      turnId,
    });
    let result;
    try {
      result = await generate({
        member,
        activeMessages: getActive(),
        sourceUserText: userText,
        replyIndex,
        previousName: speakerName(last, members, ownerName),
        signal,
      });
    } catch (error) {
      if (signal.aborted) {
        emit({ type: 'stopped', reason: 'user' });
        return null;
      }
      emit({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
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
      const notice = appendNotice(`${member.name} 没有产出内容，本轮已停止。`, 'warn');
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

  for (const targetId of initialTargets) {
    if (signal.aborted) return stopped();
    if (generated >= cap) return finish('cap');
    if (budgetReason() !== null) return pauseForBudget();
    const member = memberMap.get(targetId);
    if (member === undefined) continue;
    const message = await reply(member, last);
    if (message === null) return finish('interrupted');
    if (message.mentionsOwner) return finish('owner');
  }

  while (!signal.aborted) {
    if (last.mentionsOwner) return finish('owner');
    if (generated >= cap) return finish('cap');
    if (budgetReason() !== null) return pauseForBudget();
    const mentioned = last.mentions.find((id) => id !== last.memberId && memberMap.has(id));
    let targetId;
    if (rotating) {
      targetId = pickRotation(members, getActive(), last.memberId);
      if (targetId === undefined) return finish('no-speaker');
    } else if (mentioned !== undefined) {
      if (handoff >= depth) return finish('cap');
      handoff += 1;
      targetId = mentioned;
    } else {
      if (handoff >= depth) return finish('cap');
      targetId = pickRotation(members, getActive(), last.memberId);
      if (targetId === undefined) return finish('no-speaker');
      handoff += 1;
    }
    const member = memberMap.get(targetId);
    if (member === undefined) return finish('no-speaker');
    const message = await reply(member, last);
    if (message === null) return finish('interrupted');
  }
  return stopped();
}

/**
 * Default message id generator.
 * @param {string} prefix - id prefix such as `m`.
 * @returns {string} id.
 */
export function makeMessageId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
