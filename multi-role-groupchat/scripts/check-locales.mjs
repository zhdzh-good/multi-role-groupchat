#!/usr/bin/env node
/**
 * Fail when the browser dictionaries or the plugin locale JSON files drift.
 *
 * The client keeps its zh/en dictionaries inline so the plugin stays a single
 * browser module. This script extracts their flat keys without executing the
 * module, then compares them with each other and with locale/*.json.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/**
 * Extract the keys of one `const <name> = { ... };` block.
 * @param {string} source - client.js text.
 * @param {'zh'|'en'} name - dictionary name.
 * @returns {string[]} keys in source order.
 */
export function dictionaryKeys(source, name) {
  const marker = `    const ${name} = {`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`找不到 ${name} 字典`);
  const end = source.indexOf('\n    };', start);
  if (end < 0) throw new Error(`找不到 ${name} 字典结尾`);
  const block = source.slice(start + marker.length, end);
  return [...block.matchAll(/^\s*'([^']+)':/gmu)].map((match) => match[1]);
}

/**
 * Compare two key lists.
 * @param {string[]} left - reference keys.
 * @param {string[]} right - candidate keys.
 * @param {string} leftName - reference label.
 * @param {string} rightName - candidate label.
 * @returns {string[]} problems.
 */
export function compareKeys(left, right, leftName, rightName) {
  const problems = [];
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  for (const key of leftSet) if (!rightSet.has(key)) problems.push(`${rightName} 缺少 ${key}（${leftName} 有）`);
  for (const key of rightSet) if (!leftSet.has(key)) problems.push(`${leftName} 缺少 ${key}（${rightName} 有）`);
  return problems;
}

/**
 * @param {string[]} keys - keys.
 * @returns {string[]} duplicate keys.
 */
function duplicates(keys) {
  return [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];
}

/**
 * Flatten a JSON object into dotted leaf paths.
 * @param {unknown} value - JSON value.
 * @param {string} [prefix] - path prefix.
 * @returns {string[]} leaf paths.
 */
function leafPaths(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return prefix === '' ? [] : [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, prefix === '' ? key : `${prefix}.${key}`));
}

/**
 * @returns {Promise<string[]>} problems.
 */
export async function checkLocales() {
  const problems = [];
  const client = await readFile(path.join(root, 'client.js'), 'utf8');
  const zh = dictionaryKeys(client, 'zh');
  const en = dictionaryKeys(client, 'en');
  for (const [name, keys] of [['zh', zh], ['en', en]]) {
    const dup = duplicates(keys);
    if (dup.length > 0) problems.push(`${name} 有重复 key：${dup.join(', ')}`);
  }
  problems.push(...compareKeys(zh, en, 'zh', 'en'));

  const files = {};
  for (const name of ['zh', 'en']) {
    files[name] = JSON.parse(await readFile(path.join(root, 'locale', `${name}.json`), 'utf8'));
  }
  const zhLeaves = leafPaths(files.zh);
  const enLeaves = leafPaths(files.en);
  problems.push(...compareKeys(zhLeaves, enLeaves, 'locale/zh.json', 'locale/en.json'));
  if (typeof files.zh.meta?.title !== 'string' || files.zh.meta.title.length === 0) {
    problems.push('locale/zh.json 缺少 meta.title');
  }
  if (typeof files.en.meta?.title !== 'string' || files.en.meta.title.length === 0) {
    problems.push('locale/en.json 缺少 meta.title');
  }
  return problems;
}

async function main() {
  const problems = await checkLocales();
  if (problems.length > 0) {
    console.error(`locale 对齐失败（${problems.length} 项）：`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }
  const client = await readFile(path.join(root, 'client.js'), 'utf8');
  console.log(`locale OK：zh ${dictionaryKeys(client, 'zh').length} keys，en ${dictionaryKeys(client, 'en').length} keys，locale/*.json 对齐`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
