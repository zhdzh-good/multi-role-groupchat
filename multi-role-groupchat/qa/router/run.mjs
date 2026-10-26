#!/usr/bin/env node
/**
 * Router QA runner.
 *
 * Local mode is free and deterministic:
 *   node qa/router/run.mjs --mode local --out qa/reports/router-local.md
 *
 * Real-model modes are opt-in and require an API key:
 *   GROUPCHAT_QA_API_KEY=... node qa/router/run.mjs --mode hybrid
 *   GROUPCHAT_QA_API_KEY=... node qa/router/run.mjs --mode model
 *
 * The report records target-level metrics, fallback rate, tokens, latency, and
 * per-tag failures. It never writes the API key.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildRouterPrompt,
  chooseFallbackTarget,
  parseRouteResponse,
  resolveRoute,
} from '../../lib/router.js';
import { hydrateRouterCase } from '../lib/fixtures.mjs';
import { ms, percent, scoreSet, summarizeRows } from '../lib/metrics.mjs';
import {
  createChatClient,
  providerSettings,
  requireApiKey,
} from '../lib/provider.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultCases = path.join(here, 'cases.json');

/**
 * Parse `--key=value` / `--flag` arguments.
 * @param {string[]} argv - process arguments.
 * @returns {Record<string, string|boolean>} options.
 */
function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq >= 0) {
      options[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

/**
 * Create a model classifier that also exposes raw text and latency.
 * @param {object} client - chat client.
 * @param {(request: object) => Promise<{targets: string[], reason: string, confidence: number|null, usage: object|null}>} classify - classifier.
 * @returns {(request: object) => Promise<object>} classifier.
 */
function createClassifier(client) {
  return async function classify({ group, members, activeMessages, userText, signal }) {
    const prompt = buildRouterPrompt({ group, members, activeMessages, userText });
    const result = await client({
      system: prompt.system,
      messages: prompt.messages,
      maxTokens: 256,
      temperature: 0,
      signal,
    });
    const parsed = parseRouteResponse(result.text, members, prompt.maxTargets);
    return {
      targets: parsed?.targets ?? [],
      reason: parsed?.reason ?? 'router-invalid-json',
      confidence: parsed?.confidence ?? null,
      usage: result.usage,
      raw: result.text,
      modelLatencyMs: result.latencyMs,
    };
  };
}

/**
 * Evaluate one mode for one hydrated case.
 * @param {object} testCase - hydrated case.
 * @param {'local'|'hybrid'|'model'} mode - evaluation mode.
 * @param {((request: object) => Promise<object>)|null} classify - model classifier.
 * @returns {Promise<object>} result row.
 */
async function evaluateCase(testCase, mode, classify) {
  const started = performance.now();
  let decision;
  let error = null;
  let raw = null;
  try {
    if (mode === 'local') {
      decision = await resolveRoute({
        group: testCase.group,
        members: testCase.members,
        activeMessages: testCase.activeMessages,
        userText: testCase.text,
      });
    } else if (mode === 'hybrid') {
      decision = await resolveRoute({
        group: testCase.group,
        members: testCase.members,
        activeMessages: testCase.activeMessages,
        userText: testCase.text,
        classifier: classify,
      });
    } else {
      const direct = await classify({
        group: testCase.group,
        members: testCase.members,
        activeMessages: testCase.activeMessages,
        userText: testCase.text,
      });
      raw = direct.raw ?? null;
      if (direct.targets.length === 0) {
        decision = {
          targets: [],
          method: 'model-empty',
          reason: direct.reason,
          confidence: direct.confidence,
          usage: direct.usage,
        };
      } else {
        decision = {
          targets: direct.targets,
          method: 'model',
          reason: direct.reason,
          confidence: direct.confidence,
          usage: direct.usage,
        };
      }
    }
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason);
    const fallback = chooseFallbackTarget({
      members: testCase.members,
      activeMessages: testCase.activeMessages,
    });
    decision = {
      targets: fallback === undefined ? [] : [fallback],
      method: 'fallback',
      reason: 'classifier-error',
      confidence: null,
      usage: null,
    };
  }
  const latencyMs = performance.now() - started;
  const scores = scoreSet(decision.targets, testCase.expected);
  const forbiddenHits = decision.targets.filter((id) => testCase.forbiddenIds.includes(id));
  return {
    id: testCase.id,
    world: testCase.world,
    text: testCase.text,
    expected: testCase.expected,
    predicted: decision.targets,
    method: decision.method,
    reason: decision.reason,
    confidence: decision.confidence,
    usage: decision.usage ?? null,
    latencyMs,
    raw,
    error,
    forbiddenHits,
    scores,
    tags: Array.isArray(testCase.tags) ? testCase.tags : [],
    deterministic: testCase.deterministic === true,
  };
}

/**
 * Render a Markdown report.
 * @param {object} input - report data.
 * @returns {string} Markdown.
 */
function renderReport({ mode, model, data, rows, summary, generatedAt }) {
  const lines = [
    `# 路由器 QA · ${mode}`,
    '',
    `- 生成时间：${generatedAt}`,
    `- 模式：\`${mode}\`${model ? ` · 模型：\`${model}\`` : ''}`,
    `- 样本：${summary.total} 条（确定性本地样本 ${rows.filter((row) => row.deterministic).length} 条）`,
    '',
    '## 总览',
    '',
    '| 指标 | 数值 |',
    '|---|---|',
    `| top-1 目标命中 | ${percent(summary.top1)} |`,
    `| 目标集合完全命中 | ${percent(summary.exact)} |`,
    `| 目标集合 micro P / R / F1 | ${summary.precision.toFixed(3)} / ${summary.recall.toFixed(3)} / ${summary.f1.toFixed(3)} |`,
    `| 兜底率 | ${percent(summary.fallbackRate)} |`,
    `| 模型调用率 | ${percent(summary.modelRate)} |`,
    `| 禁用目标命中 | ${summary.forbiddenHits} 次 |`,
    `| 错误 | ${summary.errors} 次 |`,
    `| 延迟 P50 / P95 | ${ms(summary.latency.p50)} / ${ms(summary.latency.p95)} |`,
    `| 输入 token P50 / P95 | ${summary.tokens.inputP50.toFixed(0)} / ${summary.tokens.inputP95.toFixed(0)} |`,
    `| 输出 token P50 / P95 | ${summary.tokens.outputP50.toFixed(0)} / ${summary.tokens.outputP95.toFixed(0)} |`,
    '',
    '## 按标签',
    '',
    '| 标签 | n | top-1 | F1 | 兜底率 | 禁用命中 |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const tag of summary.byTag) {
    lines.push(`| ${tag.tag} | ${tag.total} | ${percent(tag.top1)} | ${tag.f1.toFixed(3)} | ${percent(tag.fallbackRate)} | ${tag.forbiddenHits} |`);
  }
  lines.push('', '## 失败样本', '');
  const failures = rows.filter((row) => row.scores.top1 === false || row.forbiddenHits.length > 0 || row.error !== null);
  if (failures.length === 0) {
    lines.push('无。');
  } else {
    lines.push('| id | 消息 | 期望 | 实际 | 方法 | 标签 | 备注 |', '|---|---|---|---|---|---|---|');
    for (const row of failures.slice(0, 40)) {
      const note = row.error !== null
        ? row.error
        : row.forbiddenHits.length > 0
          ? `禁用：${row.forbiddenHits.join(',')}`
          : row.reason;
      lines.push(
        `| ${cell(row.id)} | ${cell(row.text)} | ${cell(namesOf(row.expected, data, row.world))} | ${cell(namesOf(row.predicted, data, row.world))} | ${cell(row.method)} | ${cell(row.tags.join(','))} | ${cell(note)} |`,
      );
    }
    if (failures.length > 40) lines.push('', `仅展示前 40 条，共 ${failures.length} 条失败。`);
  }
  lines.push(
    '',
    '## 复现',
    '',
    '```bash',
    mode === 'local'
      ? 'node qa/router/run.mjs --mode local'
      : 'GROUPCHAT_QA_API_KEY=... node qa/router/run.mjs --mode ' + mode,
    '```',
    '',
    '> 本地规则是免费回归门禁；hybrid/model 需要真实模型与 key。不要把 key 写进报告或提交记录。',
    '',
  );
  return lines.join('\n');
}

/**
 * Map member ids back to display names for the report.
 * @param {string[]} ids - member ids.
 * @param {object} data - fixture data.
 * @returns {string} comma-separated names.
 */
function namesOf(ids, data, worldKey) {
  if (!Array.isArray(ids) || ids.length === 0) return '（无）';
  const world = data.worlds[worldKey];
  return ids.map((id) => {
    const match = /^c_(\d+)$/u.exec(id);
    if (match === null || world === undefined) return id;
    return world.members[Number(match[1])]?.name ?? id;
  }).join('、');
}

/**
 * Escape a Markdown table cell.
 * @param {unknown} value - cell.
 * @returns {string} escaped text.
 */
function cell(value) {
  return String(value ?? '').replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
}

/**
 * Run the CLI.
 * @returns {Promise<void>} completion.
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const mode = typeof options.mode === 'string' ? options.mode : 'local';
  if (!['local', 'hybrid', 'model'].includes(mode)) {
    throw new Error('--mode 只能是 local、hybrid 或 model。');
  }
  const data = JSON.parse(await readFile(typeof options.cases === 'string' ? options.cases : defaultCases, 'utf8'));
  let cases = data.cases.map((entry) => hydrateRouterCase(data, entry));
  if (typeof options.tag === 'string') cases = cases.filter((entry) => (entry.tags ?? []).includes(options.tag));
  if (options.limit !== undefined) cases = cases.slice(0, Math.max(0, Number(options.limit)));
  if (cases.length === 0) throw new Error('没有匹配的样本。');

  let classify = null;
  let model = null;
  if (mode !== 'local') {
    const settings = providerSettings({
      baseUrl: typeof options['base-url'] === 'string' ? options['base-url'] : undefined,
      model: typeof options.model === 'string' ? options.model : undefined,
      timeoutMs: options['timeout-ms'] !== undefined ? Number(options['timeout-ms']) : undefined,
    });
    requireApiKey(settings);
    model = settings.model;
    classify = createClassifier(createChatClient(settings));
  }

  const rows = [];
  for (const [index, testCase] of cases.entries()) {
    rows.push(await evaluateCase(testCase, mode, classify));
    if ((index + 1) % 10 === 0 || index + 1 === cases.length) {
      process.stderr.write(`\r${index + 1}/${cases.length}`);
    }
  }
  process.stderr.write('\n');
  const summary = summarizeRows(rows);
  const generatedAt = new Date().toISOString();
  const report = renderReport({ mode, model, data, rows, summary, generatedAt });

  if (typeof options.out === 'string') {
    const target = path.resolve(options.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, report, 'utf8');
    console.log(`报告已写入 ${target}`);
  } else {
    console.log(report);
  }
  if (typeof options.json === 'string') {
    const target = path.resolve(options.json);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify({ mode, model, generatedAt, summary, rows }, null, 2)}\n`, 'utf8');
    console.log(`JSON 已写入 ${target}`);
  }

  const failures = rows.filter((row) => row.scores.top1 === false || row.forbiddenHits.length > 0 || row.error !== null);
  console.log(
    `top-1 ${percent(summary.top1)} · F1 ${summary.f1.toFixed(3)} · 兜底 ${percent(summary.fallbackRate)} · 失败 ${failures.length}/${rows.length}`,
  );
  if (options.strict === true) {
    const minTop1 = numberOption(options['min-top1'], 0.85);
    const minF1 = numberOption(options['min-f1'], 0.85);
    const maxFallback = numberOption(options['max-fallback'], 0.1);
    if (summary.top1 < minTop1 || summary.f1 < minF1 || summary.fallbackRate > maxFallback) {
      process.exitCode = 1;
      console.error(
        `未达到门槛：top-1 ≥ ${minTop1}, F1 ≥ ${minF1}, 兜底 ≤ ${maxFallback}。`,
      );
    }
  }
}

/**
 * @param {unknown} value - option.
 * @param {number} fallback - default.
 * @returns {number} number.
 */
function numberOption(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const isCli = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
