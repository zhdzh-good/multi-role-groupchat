/**
 * Minimal OpenAI-compatible chat client for opt-in QA runs.
 *
 * The deterministic suite never calls this module. Real-model runs require an
 * explicit API key in the environment; keys are never written to reports.
 */

/** Default endpoint used when the caller does not name another provider. */
export const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';

/** Default model used by the QA scripts. */
export const DEFAULT_MODEL = 'deepseek-chat';

/**
 * Resolve provider settings from environment variables and CLI flags.
 *
 * @param {{baseUrl?: string, model?: string, timeoutMs?: number, temperature?: number, maxTokens?: number}} [overrides] - CLI overrides.
 * @param {NodeJS.ProcessEnv} [env] - environment.
 * @returns {{baseUrl: string, model: string, apiKey: string, timeoutMs: number, temperature: number, maxTokens: number}} settings.
 */
export function providerSettings(overrides = {}, env = process.env) {
  const apiKey = env.GROUPCHAT_QA_API_KEY ?? env.DEEPSEEK_API_KEY ?? '';
  return {
    baseUrl: normalizeBaseUrl(overrides.baseUrl ?? env.GROUPCHAT_QA_BASE_URL ?? DEFAULT_BASE_URL),
    model: overrides.model ?? env.GROUPCHAT_QA_MODEL ?? DEFAULT_MODEL,
    apiKey,
    timeoutMs: overrides.timeoutMs ?? (Number(env.GROUPCHAT_QA_TIMEOUT_MS) || 90_000),
    temperature: overrides.temperature ?? 0,
    maxTokens: overrides.maxTokens ?? 400,
  };
}

/**
 * Require an API key, with an actionable error.
 * @param {{apiKey: string}} settings - provider settings.
 * @returns {void}
 */
export function requireApiKey(settings) {
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim().length > 0) return;
  throw new Error(
    '真实模型评测需要 API key：请设置 GROUPCHAT_QA_API_KEY（或 DEEPSEEK_API_KEY），'
    + '也可以只跑本地规则或 --dry-run。',
  );
}

/**
 * Create a chat-completion function.
 *
 * @param {{baseUrl: string, model: string, apiKey: string, timeoutMs?: number, temperature?: number, maxTokens?: number, retries?: number}} settings - provider settings.
 * @returns {(request: {system: string, messages: Array<object>, maxTokens?: number, temperature?: number, signal?: AbortSignal}) => Promise<{text: string, usage: object|null, latencyMs: number, model: string}>} client.
 */
export function createChatClient(settings) {
  const endpoint = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;
  const timeoutMs = settings.timeoutMs ?? 90_000;
  const retries = Number.isInteger(settings.retries) ? settings.retries : 1;
  return async function chat({ system, messages, maxTokens, temperature, signal }) {
    const body = {
      model: settings.model,
      messages: [
        { role: 'system', content: system },
        ...(Array.isArray(messages) ? messages : []).map(toProviderMessage),
      ],
      max_tokens: maxTokens ?? settings.maxTokens ?? 400,
      temperature: temperature ?? settings.temperature ?? 0,
      stream: false,
    };
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const started = performance.now();
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify(body),
        }, timeoutMs, signal);
        const text = await response.text();
        if (!response.ok) {
          const error = new Error(`模型请求失败：HTTP ${response.status} ${truncate(text, 400)}`);
          error.status = response.status;
          throw error;
        }
        let payload;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error(`模型返回不是 JSON：${truncate(text, 300)}`);
        }
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new Error('模型返回缺少 choices[0].message.content。');
        }
        return {
          text: content,
          usage: normalizeProviderUsage(payload?.usage),
          latencyMs: performance.now() - started,
          model: typeof payload?.model === 'string' ? payload.model : settings.model,
        };
      } catch (error) {
        lastError = error;
        const status = Number(error?.status);
        const retryable = status === 429 || status >= 500;
        if (!retryable || attempt >= retries) break;
        await delay(500 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };
}

/**
 * Normalize an OpenAI-compatible usage record into the plugin's shape.
 * @param {object|undefined} usage - provider usage.
 * @returns {{inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number}|null} usage.
 */
export function normalizeProviderUsage(usage) {
  if (usage === null || typeof usage !== 'object') return null;
  const inputTokens = positive(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = positive(usage.completion_tokens ?? usage.output_tokens);
  const cacheReadTokens = positive(usage.prompt_cache_hit_tokens ?? usage.cache_read_input_tokens);
  const cacheWriteTokens = positive(usage.cache_creation_input_tokens);
  if (inputTokens + outputTokens === 0 && cacheReadTokens + cacheWriteTokens === 0) return null;
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens };
}

/**
 * Flatten the plugin's content-part messages into provider strings.
 * @param {object} message - plugin message.
 * @returns {{role: string, content: string}} provider message.
 */
function toProviderMessage(message) {
  const role = message?.role === 'assistant' ? 'assistant' : 'user';
  if (typeof message?.content === 'string') return { role, content: message.content };
  const content = Array.isArray(message?.content)
    ? message.content
        .map((part) => (part?.type === 'text' && typeof part.text === 'string' ? part.text : ''))
        .filter((part) => part.length > 0)
        .join('\n')
    : '';
  return { role, content };
}

/**
 * Fetch with a timeout and optional caller signal.
 * @param {string} url - endpoint.
 * @param {object} init - fetch init.
 * @param {number} timeoutMs - timeout.
 * @param {AbortSignal|undefined} signal - external cancellation.
 * @returns {Promise<Response>} response.
 */
async function fetchWithTimeout(url, init, timeoutMs, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`请求超时（${timeoutMs} ms）`)), timeoutMs);
  const combined = signal === undefined
    ? controller.signal
    : AbortSignal.any([signal, controller.signal]);
  try {
    return await fetch(url, { ...init, signal: combined });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} value - base URL.
 * @returns {string} base URL without trailing slash or chat path.
 */
function normalizeBaseUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return DEFAULT_BASE_URL;
  return value.trim().replace(/\/+$/u, '').replace(/\/chat\/completions$/u, '');
}

/**
 * @param {unknown} value - candidate.
 * @returns {number} non-negative number.
 */
function positive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * @param {string} value - text.
 * @param {number} max - maximum length.
 * @returns {string} truncated text.
 */
function truncate(value, max) {
  const text = typeof value === 'string' ? value : String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * @param {number} ms - delay.
 * @returns {Promise<void>} resolves after the delay.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
