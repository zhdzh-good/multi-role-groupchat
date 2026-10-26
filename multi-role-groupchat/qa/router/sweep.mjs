#!/usr/bin/env node
/**
 * Deterministic simulation for `bystanderChance` and `maxMentionReplies`.
 *
 * It does not call a model. It answers a narrower product question: with N
 * members, how many people actually speak per turn at each probability/cap?
 *
 *   node qa/router/sweep.mjs --out qa/reports/router-sweep.md
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DEFAULT_POLICY, generationCap } from '../../lib/protocol.js';

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
 * Tiny deterministic PRNG.
 * @param {number} seed - seed.
 * @returns {() => number} uniform [0,1) generator.
 */
function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulate one config.
 *
 * @param {{members: number, chance: number, maxTargets: number, depth: number, turns: number, seed: number}} input - simulation inputs.
 * @returns {{members: number, chance: number, maxTargets: number, averageSpeakers: number, targetReplyRate: number, bystanderReplyRate: number, allMembersRate: number, p95Speakers: number}} result.
 */
export function simulateConfig({ members, chance, maxTargets, depth, turns, seed }) {
  const random = mulberry32(seed);
  const speakers = [];
  let targetReplies = 0;
  let bystanderReplies = 0;
  let allMembers = 0;
  for (let turn = 0; turn < turns; turn += 1) {
    const targetCount = Math.min(members, 1 + Math.floor(random() * maxTargets));
    const targetSet = new Set();
    while (targetSet.size < targetCount) targetSet.add(Math.floor(random() * members));
    let initial = targetCount;
    let bystanders = 0;
    for (let member = 0; member < members; member += 1) {
      if (targetSet.has(member)) continue;
      if (random() * 100 < chance) {
        bystanders += 1;
        initial += 1;
      }
    }
    const cap = generationCap(initial, { ...DEFAULT_POLICY, maxHandoffDepth: depth });
    const actual = Math.min(initial, members, cap);
    speakers.push(actual);
    targetReplies += Math.min(targetCount, actual);
    bystanderReplies += Math.max(0, actual - Math.min(targetCount, actual));
    if (actual === members) allMembers += 1;
  }
  const sorted = [...speakers].sort((left, right) => left - right);
  return {
    members,
    chance,
    maxTargets,
    averageSpeakers: average(speakers),
    targetReplyRate: targetReplies / turns,
    bystanderReplyRate: bystanderReplies / turns,
    allMembersRate: allMembers / turns,
    p95Speakers: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
  };
}

/**
 * @param {number[]} values - samples.
 * @returns {number} mean.
 */
function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Render the sweep report.
 * @param {Array<object>} rows - simulation rows.
 * @returns {string} Markdown.
 */
function render(rows) {
  const lines = [
    '# 接话概率与目标数扫描',
    '',
    `- 生成时间：${new Date().toISOString()}`,
    '- 方法：固定种子模拟；每格 5,000 轮；目标数在 1..`maxMentionReplies` 间均匀抽样。',
    '- 不含接话链（handoff）与模型失败，只衡量“每轮实际发言人数”。',
    '',
    '## 2 人群',
    '',
    '| 接话概率 | 最多目标 | 平均发言人数 | 目标回应 | 旁听回应 | 全员发言率 | P95 发言人数 |',
    '|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const row of rows.filter((entry) => entry.members === 2)) {
    lines.push(tableRow(row));
  }
  lines.push(
    '',
    '## 3 人群',
    '',
    '| 接话概率 | 最多目标 | 平均发言人数 | 目标回应 | 旁听回应 | 全员发言率 | P95 发言人数 |',
    '|---:|---:|---:|---:|---:|---:|---:|',
  );
  for (const row of rows.filter((entry) => entry.members === 3)) {
    lines.push(tableRow(row));
  }
  const recommended = recommend(rows);
  lines.push(
    '',
    '## 建议',
    '',
    `- 默认 \`bystanderChance=30\` 在 2 人群平均 **${recommended.two.averageSpeakers.toFixed(2)}** 人/轮，在 3 人群平均 **${recommended.three.averageSpeakers.toFixed(2)}** 人/轮。`,
    `- \`maxMentionReplies=2\` 时，3 人群平均 **${recommended.three.averageSpeakers.toFixed(2)}** 人/轮；单目标请求仍由目标必答，旁听按概率加入。`,
    `- 如果希望 2 人群更像对聊，30% 合适；如果希望 3 人群更热闹，可试 40–50%，但全员发言率会明显上升。`,
    '- 概率是“每位剩余成员独立采样”，不是“整轮只加一个人”；因此 3 人群的方差高于 2 人群。',
    '',
  );
  return lines.join('\n');
}

/**
 * @param {object} row - simulation row.
 * @returns {string} table row.
 */
function tableRow(row) {
  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  return `| ${row.chance}% | ${row.maxTargets} | ${row.averageSpeakers.toFixed(2)} | ${row.targetReplyRate.toFixed(2)} | ${row.bystanderReplyRate.toFixed(2)} | ${pct(row.allMembersRate)} | ${row.p95Speakers} |`;
}

/**
 * Pick rows at 30% for the prose recommendation.
 * @param {Array<object>} rows - all rows.
 * @returns {object} selected rows.
 */
function recommend(rows) {
  const pick = (members, maxTargets) => rows.find((row) => row.members === members && row.chance === 30 && row.maxTargets === maxTargets);
  return {
    two: pick(2, 2),
    three: pick(3, 2),
  };
}

/**
 * CLI entry.
 * @returns {Promise<void>} completion.
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = [];
  for (const members of [2, 3]) {
    for (const chance of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
      for (const maxTargets of [1, 2, 3]) {
        if (maxTargets > members) continue;
        rows.push(simulateConfig({
          members,
          chance,
          maxTargets,
          depth: 2,
          turns: 5000,
          seed: 20261026 + members * 1000 + chance * 10 + maxTargets,
        }));
      }
    }
  }
  const report = render(rows);
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
    await writeFile(target, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
    console.log(`JSON 已写入 ${target}`);
  }
}

const isCli = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
