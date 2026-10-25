/**
 * Model call for one member reply: build the plan's prompt and consume the
 * Harness `llm.stream` waterfall into text plus usage.
 */

import { buildPrompt } from './protocol.js';

/**
 * Create the generator bound to one loaded group.
 *
 * @param {object} ctx - Host context with the `llm` service.
 * @param {object} live - loaded group state.
 * @param {{provider: string, model: string, reasoningEffort?: string}|null} defaultModel - Host default selection.
 * @returns {(request: object) => Promise<{text: string, usage: object|null}>} generator.
 */
export function createGenerator(ctx, live, defaultModel) {
  return async function generate({ member, activeMessages, sourceUserText, replyIndex, previousName, signal }) {
    const prompt = buildPrompt({
      group: live.group,
      members: live.members,
      activeMessages,
      member,
      sourceUserText,
      replyIndex,
      previousName,
    });
    const target = member.model ?? live.group.model ?? defaultModel;
    if (target === null || target === undefined || !target.provider || !target.model) {
      throw new Error('没有可用模型：请先在设置里选择默认模型，或为该群/成员指定模型覆盖。');
    }
    const maxTokens = Math.min(4000, Math.max(256, Math.ceil(live.group.policy.maxReplyChars * 2.5)));
    const isDefaultTarget = member.model === null && live.group.model === null;
    const options = {
      provider: target.provider,
      model: target.model,
      system: prompt.system,
      messages: prompt.messages,
      maxTokens,
      ...(signal === undefined ? {} : { signal }),
    };
    if (target.reasoningEffort !== undefined && isDefaultTarget) {
      options.reasoningEffort = target.reasoningEffort;
    }
    let text = '';
    let usage = null;
    for await (const chunk of ctx.llm.stream(options)) {
      if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') {
        text += chunk.text;
      } else if (chunk?.type === 'usage' && chunk.usage !== undefined) {
        usage = {
          inputTokens: numberOrZero(chunk.usage.inputTokens),
          outputTokens: numberOrZero(chunk.usage.outputTokens),
          cacheReadTokens: numberOrZero(chunk.usage.cacheReadTokens),
          cacheWriteTokens: numberOrZero(chunk.usage.cacheWriteTokens),
        };
      } else if (chunk?.type === 'finish') {
        const reason = chunk.reason;
        if (reason?.kind === 'aborted') {
          const error = new Error('已停止。');
          error.name = 'AbortError';
          throw error;
        }
        if (reason?.kind === 'error') {
          const failure = reason.failure ?? {};
          const message = typeof failure.message === 'string' && failure.message.length > 0
            ? failure.message
            : '模型调用失败。';
          throw new Error(message);
        }
      }
    }
    return { text, usage };
  };
}

/**
 * @param {unknown} value - candidate.
 * @returns {number} non-negative number.
 */
function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
