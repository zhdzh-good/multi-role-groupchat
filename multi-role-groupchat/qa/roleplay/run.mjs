#!/usr/bin/env node
/**
 * Role-fidelity QA runner.
 *
 * Dry-run is free and checks fixture/prompt structure:
 *   node qa/roleplay/run.mjs --dry-run --out qa/reports/roleplay-dry-run.md
 *
 * Real runs are opt-in and require an API key:
 *   GROUPCHAT_QA_API_KEY=... node qa/roleplay/run.mjs --model deepseek-chat
 *
 * The runner does not pretend to be a judge model. It catches objective
 * failures (secret leak, length, impersonation, missing expected terms) and
 * leaves character/relevance scores as blank human rubric columns.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildPrompt, normalizeReply } from '../../lib/protocol.js';
import {
  hydrateRoleplayWorld,
  roleplayOpeningMessages,
} from '../lib/fixtures.mjs';
import { ms, percentile } from '../lib/metrics.mjs';
import { createChatClient, providerSettings, requireApiKey } from '../lib/provider.mjs';
import { driftFromTexts, styleFingerprint } from '../lib/style.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultScenarios = path.join(here, 'scenarios.json');

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
 * Evaluate one reply without a judge model.
 *
 * @param {object} input - evaluation inputs.
 * @param {string} input.text - normalized reply.
 * @param {object} input.expect - scenario expectations.
 * @param {object} input.member - speaking member.
 * @param {Array<object>} input.members - all members.
 * @returns {object} objective checks.
 */
export function evaluateReply({ text, expect, member, members }) {
  const chars = [...text].length;
  const terms = Array.isArray(expect.terms) ? expect.terms : [];
  const voice = Array.isArray(expect.voice) ? expect.voice : [];
  const avoid = Array.isArray(expect.avoid) ? expect.avoid : [];
  const secrets = Array.isArray(expect.secrets) ? expect.secrets : [];
  const termHits = terms.filter((term) => text.includes(term));
  const voiceHits = voice.filter((term) => text.includes(term));
  const avoidHits = avoid.filter((term) => text.includes(term));
  const secretHits = secrets.filter((term) => text.includes(term));
  const impersonation = members
    .filter((candidate) => candidate.id !== member.id)
    .some((candidate) => new RegExp(`^(?:\\[?${escapeRegExp(candidate.name)}\\]?\\s*[:：])`, 'u').test(text.trim()));
  const maxChars = Number.isFinite(expect.maxChars) ? expect.maxChars : 300;
  const minTermScore = Number.isFinite(expect.minTermScore) ? expect.minTermScore : 0.5;
  const voiceMin = Number.isFinite(expect.voiceMin) ? expect.voiceMin : 0;
  const termScore = terms.length === 0 ? null : termHits.length / terms.length;
  const voiceScore = voice.length === 0 ? null : voiceHits.length / voice.length;
  const lengthOk = chars <= maxChars;
  const termOk = termScore === null || termScore >= minTermScore;
  const voiceOk = voiceScore === null || voiceScore >= voiceMin;
  const pass = lengthOk && termOk && voiceOk && avoidHits.length === 0 && secretHits.length === 0 && !impersonation;
  return {
    chars,
    maxChars,
    termHits,
    termScore,
    voiceHits,
    voiceScore,
    avoidHits,
    secretHits,
    impersonation,
    lengthOk,
    termOk,
    voiceOk,
    pass,
  };
}

/**
 * Run one scenario.
 *
 * @param {object} scenario - scenario fixture.
 * @param {object} data - whole fixture.
 * @param {object|null} client - chat client, or null for dry-run.
 * @param {{dryRun: boolean, temperature: number, maxTokens: number}} options - run settings.
 * @returns {Promise<object>} scenario result.
 */
async function runScenario(scenario, data, client, options) {
  const world = data.worlds[scenario.world];
  if (world === undefined) throw new Error(`${scenario.id}: 未知 world ${scenario.world}`);
  const hydrated = hydrateRoleplayWorld(world);
  const active = roleplayOpeningMessages(scenario, hydrated);
  const outputs = [];
  const promptChecks = [];
  const systems = new Set();
  for (const [index, turn] of scenario.turns.entries()) {
    const targetName = turn.target;
    const member = hydrated.members.find((candidate) => candidate.name === targetName);
    if (member === undefined) throw new Error(`${scenario.id}: 未知 target ${targetName}`);
    const userMessage = {
      id: `m_user_${index}`,
      turnId: `qa_turn_${index}`,
      replyIndex: 0,
      ts: active.length,
      role: 'user',
      memberId: null,
      text: turn.user,
      mentions: [],
      mentionsOwner: false,
      replyTo: null,
      status: 'active',
      supersedes: null,
      pinned: false,
      usage: null,
    };
    active.push(userMessage);
    const prompt = buildPrompt({
      group: hydrated.group,
      members: hydrated.members,
      activeMessages: active,
      member,
      sourceUserText: turn.user,
      replyIndex: 1,
      previousName: hydrated.ownerName,
      routeRole: 'addressed',
    });
    systems.add(prompt.system);
    const tail = prompt.messages.at(-1)?.content?.[0]?.text ?? '';
    const allSecrets = scenario.turns.flatMap((entry) => entry.expect?.secrets ?? []);
    const leakedSecrets = allSecrets.filter((secret) => prompt.system.includes(secret));
    promptChecks.push({
      turn: index + 1,
      systemChars: [...prompt.system].length,
      tailChars: [...tail].length,
      historyMessages: prompt.messages.length - 1,
      systemLeakedSecrets: leakedSecrets,
      hasLayering: ['角色核心', '本场状态', '本轮任务', '角色提醒'].every((heading) => tail.includes(`=== ${heading} ===`)),
    });
    if (options.dryRun) {
      outputs.push({
        turn: index + 1,
        user: turn.user,
        target: targetName,
        text: '（dry-run：未调用模型）',
        dryRun: true,
        usage: null,
        latencyMs: 0,
        checks: null,
        expect: turn.expect ?? {},
      });
      continue;
    }
    const started = performance.now();
    const result = await client({
      system: prompt.system,
      messages: prompt.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
    const latencyMs = performance.now() - started;
    const text = normalizeReply(result.text, member.name);
    const checks = evaluateReply({ text, expect: turn.expect ?? {}, member, members: hydrated.members });
    active.push({
      id: `m_reply_${index}`,
      turnId: `qa_turn_${index}`,
      replyIndex: 1,
      ts: active.length,
      role: 'member',
      memberId: member.id,
      text,
      mentions: [],
      mentionsOwner: false,
      replyTo: userMessage.id,
      status: 'active',
      supersedes: null,
      pinned: false,
      usage: result.usage,
    });
    outputs.push({
      turn: index + 1,
      user: turn.user,
      target: targetName,
      text,
      dryRun: false,
      usage: result.usage,
      latencyMs,
      checks,
      expect: turn.expect ?? {},
    });
  }
  const generated = outputs.filter((output) => output.dryRun === false);
  const targets = new Set(generated.map((output) => output.target));
  const targetTexts = generated.map((output) => output.text);
  const drift = targets.size === 1 ? driftFromTexts(targetTexts) : null;
  return {
    id: scenario.id,
    title: scenario.title,
    tags: scenario.tags ?? [],
    rubric: scenario.rubric ?? '',
    world: scenario.world,
    target: scenario.turns[0]?.target ?? '',
    outputs,
    promptChecks,
    systemStable: systems.size === 1,
    drift,
    fingerprint: targetTexts.length > 0 ? styleFingerprint(targetTexts) : null,
  };
}

/**
 * Summarize scenario results.
 * @param {Array<object>} scenarios - results.
 * @param {boolean} dryRun - whether outputs are placeholders.
 * @returns {object} summary.
 */
function summarize(scenarios, dryRun) {
  const allOutputs = scenarios.flatMap((scenario) => scenario.outputs);
  const outputs = allOutputs.filter((output) => output.dryRun === false);
  const checks = outputs.map((output) => output.checks).filter(Boolean);
  const latencies = outputs.map((output) => output.latencyMs ?? 0).filter((value) => value > 0);
  const inputTokens = outputs.map((output) => output.usage?.inputTokens ?? 0);
  const outputTokens = outputs.map((output) => output.usage?.outputTokens ?? 0);
  const driftScores = scenarios.map((scenario) => scenario.drift?.score).filter((value) => Number.isFinite(value));
  return {
    scenarios: scenarios.length,
    outputs: allOutputs.length,
    generated: outputs.length,
    dryRun,
    passRate: checks.length === 0 ? 0 : checks.filter((check) => check.pass).length / checks.length,
    passed: checks.filter((check) => check.pass).length,
    failed: checks.filter((check) => !check.pass).length,
    secretLeaks: checks.reduce((sum, check) => sum + check.secretHits.length, 0),
    lengthViolations: checks.filter((check) => !check.lengthOk).length,
    avoidViolations: checks.reduce((sum, check) => sum + check.avoidHits.length, 0),
    impersonations: checks.filter((check) => check.impersonation).length,
    termFailures: checks.filter((check) => !check.termOk).length,
    averageChars: checks.length === 0 ? 0 : checks.reduce((sum, check) => sum + check.chars, 0) / checks.length,
    latency: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    tokens: {
      inputP50: percentile(inputTokens, 50),
      inputP95: percentile(inputTokens, 95),
      outputP50: percentile(outputTokens, 50),
      outputP95: percentile(outputTokens, 95),
    },
    promptChecks: scenarios.flatMap((scenario) => scenario.promptChecks),
    systemStable: scenarios.every((scenario) => scenario.systemStable),
    driftAverage: driftScores.length === 0 ? null : driftScores.reduce((sum, value) => sum + value, 0) / driftScores.length,
    driftMax: driftScores.length === 0 ? null : Math.max(...driftScores),
  };
}

/**
 * Render a Markdown report.
 * @param {object} input - report data.
 * @returns {string} Markdown.
 */
function renderReport({ results, summary, model, dryRun, generatedAt }) {
  const lines = [
    `# 角色贴合度 QA${dryRun ? ' · dry-run' : ''}`,
    '',
    `- 生成时间：${generatedAt}`,
    `- 样本：${summary.scenarios} 个场景 / ${summary.outputs} 条回应${model ? ` · 模型：\`${model}\`` : ''}`,
    `- 模式：${dryRun ? '只构建 prompt，不调用模型' : '真实模型生成 + 客观检查'}`,
    '',
    '## 总览',
    '',
    '| 指标 | 数值 |',
    '|---|---|',
    `| 客观检查通过率 | ${dryRun ? '–' : `${(summary.passRate * 100).toFixed(1)}% (${summary.passed}/${summary.generated})`} |`,
    `| 秘密泄露 | ${summary.secretLeaks} |`,
    `| 超长 | ${summary.lengthViolations} |`,
    `| 禁用词命中 | ${summary.avoidViolations} |`,
    `| 代演（以他人名字开头） | ${summary.impersonations} |`,
    `| 期望词不足 | ${summary.termFailures} |`,
    `| 平均长度 | ${summary.averageChars.toFixed(0)} 字 |`,
    `| 延迟 P50 / P95 | ${ms(summary.latency.p50)} / ${ms(summary.latency.p95)} |`,
    `| 输入 token P50 / P95 | ${summary.tokens.inputP50.toFixed(0)} / ${summary.tokens.inputP95.toFixed(0)} |`,
    `| 输出 token P50 / P95 | ${summary.tokens.outputP50.toFixed(0)} / ${summary.tokens.outputP95.toFixed(0)} |`,
    `| system 前缀稳定 | ${summary.systemStable ? '是' : '否'} |`,
    `| 漂移均值 / 最大值 | ${summary.driftAverage === null ? '样本不足' : `${summary.driftAverage.toFixed(3)} / ${summary.driftMax.toFixed(3)}`} |`,
    '',
    '## Prompt 检查',
    '',
    '| 场景 | 轮 | system 字数 | tail 字数 | 历史条数 | system 泄露 secret | 分层标题 |',
    '|---|---:|---:|---:|---:|---|---|',
  ];
  for (const scenario of results) {
    for (const check of scenario.promptChecks) {
      lines.push(
        `| ${cell(scenario.id)} | ${check.turn} | ${check.systemChars} | ${check.tailChars} | ${check.historyMessages} | ${check.systemLeakedSecrets.length === 0 ? '否' : '是'} | ${check.hasLayering ? '是' : '否'} |`,
      );
    }
  }
  lines.push('', '## 场景明细', '');
  for (const scenario of results) {
    lines.push(`### ${scenario.id} · ${scenario.title}`, '', `> ${scenario.rubric}`, '');
    if (scenario.drift !== null) {
      lines.push(
        `漂移：${scenario.drift.score.toFixed(3)}（长度差 ${scenario.drift.averageCharsDelta.toFixed(2)} · 问句差 ${scenario.drift.questionDelta.toFixed(2)} · 短句差 ${scenario.drift.shortSentenceDelta.toFixed(2)} · 称呼重叠 ${scenario.drift.addressOverlap.toFixed(2)}）`,
        '',
      );
    }
    for (const output of scenario.outputs) {
      const check = output.checks;
      const flags = check === null
        ? 'dry-run'
        : check.pass
          ? 'pass'
          : [
              check.secretHits.length > 0 ? 'secret-leak' : '',
              !check.lengthOk ? 'too-long' : '',
              check.avoidHits.length > 0 ? 'avoid' : '',
              check.impersonation ? 'impersonation' : '',
              !check.termOk ? 'terms' : '',
            ].filter(Boolean).join(', ');
      lines.push(
        `#### 第 ${output.turn} 轮 · ${output.target} · ${flags}`,
        '',
        `用户：${output.user}`,
        '',
        `> ${output.text.replace(/\n/gu, '\n> ')}`,
        '',
      );
      if (check !== null) {
        const expectedTerms = Array.isArray(output.expect?.terms) ? output.expect.terms.length : 0;
        lines.push(
          `- 长度：${check.chars}/${check.maxChars}`,
          `- 期望词：${check.termHits.length}/${expectedTerms}${check.termScore === null ? '（未配置）' : ` · ${(check.termScore * 100).toFixed(0)}%`}`,
          `- 说话标记：${check.voiceScore === null ? '（未配置）' : `${(check.voiceScore * 100).toFixed(0)}%`}`,
          `- 禁用/秘密：${check.avoidHits.length} / ${check.secretHits.length}`,
          '',
        );
      }
    }
  }
  lines.push(
    '## 人工评分表',
    '',
    '真实运行后请按场景填写；1–5 分，角色感与相关性越高越好，出戏填“是/否”。',
    '',
    '| 场景 | 角色感 /5 | 相关性 /5 | 出戏 | 备注 |',
    '|---|---:|---:|---|---|',
  );
  for (const scenario of results) {
    lines.push(`| ${cell(scenario.id)} |  |  |  | ${cell(scenario.rubric)} |`);
  }
  lines.push(
    '',
    '## 复现',
    '',
    '```bash',
    dryRun
      ? 'node qa/roleplay/run.mjs --dry-run'
      : 'GROUPCHAT_QA_API_KEY=... node qa/roleplay/run.mjs --model deepseek-chat',
    '```',
    '',
    '> 客观检查只能抓泄露、长度、代演和词面；角色感/相关性仍需人工评分。',
    '',
  );
  return lines.join('\n');
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
 * Escape a literal for a regex.
 * @param {string} value - literal.
 * @returns {string} escaped.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * CLI entry.
 * @returns {Promise<void>} completion.
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dryRun = options['dry-run'] === true || options.dryRun === true;
  const data = JSON.parse(await readFile(typeof options.scenarios === 'string' ? options.scenarios : defaultScenarios, 'utf8'));
  let scenarios = data.scenarios;
  if (typeof options.scenario === 'string') scenarios = scenarios.filter((scenario) => scenario.id === options.scenario);
  if (typeof options.tag === 'string') scenarios = scenarios.filter((scenario) => (scenario.tags ?? []).includes(options.tag));
  if (options.limit !== undefined) scenarios = scenarios.slice(0, Math.max(0, Number(options.limit)));
  if (scenarios.length === 0) throw new Error('没有匹配的场景。');

  let client = null;
  let model = null;
  if (!dryRun) {
    const settings = providerSettings({
      baseUrl: typeof options['base-url'] === 'string' ? options['base-url'] : undefined,
      model: typeof options.model === 'string' ? options.model : undefined,
      temperature: options.temperature !== undefined ? Number(options.temperature) : 0.8,
      maxTokens: options['max-tokens'] !== undefined ? Number(options['max-tokens']) : 500,
    });
    requireApiKey(settings);
    model = settings.model;
    client = createChatClient(settings);
  }

  const results = [];
  for (const [index, scenario] of scenarios.entries()) {
    results.push(await runScenario(scenario, data, client, {
      dryRun,
      temperature: options.temperature !== undefined ? Number(options.temperature) : 0.8,
      maxTokens: options['max-tokens'] !== undefined ? Number(options['max-tokens']) : 500,
    }));
    if ((index + 1) % 5 === 0 || index + 1 === scenarios.length) {
      process.stderr.write(`\r${index + 1}/${scenarios.length}`);
    }
  }
  process.stderr.write('\n');
  const summary = summarize(results, dryRun);
  const generatedAt = new Date().toISOString();
  const report = renderReport({ results, summary, model, dryRun, generatedAt });
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
    await writeFile(target, `${JSON.stringify({ generatedAt, model, dryRun, summary, results }, null, 2)}\n`, 'utf8');
    console.log(`JSON 已写入 ${target}`);
  }
  console.log(
    dryRun
      ? `dry-run 完成：${summary.scenarios} 个场景，${summary.outputs} 条 prompt；system 稳定 ${summary.systemStable ? '是' : '否'}`
      : `客观检查通过 ${summary.passed}/${summary.outputs} · 泄露 ${summary.secretLeaks} · 超长 ${summary.lengthViolations} · 代演 ${summary.impersonations}`,
  );
}

const isCli = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
