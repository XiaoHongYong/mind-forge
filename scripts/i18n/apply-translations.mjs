#!/usr/bin/env node
/**
 * Apply translations from a JSON map into zh-CN.json.
 *
 * Input file shape:
 *   { "toolbar.navigate": "导航", "editor.saved": "已保存" }
 *
 * Usage:
 *   node scripts/i18n/apply-translations.mjs path/to/map.json
 *   node scripts/i18n/apply-translations.mjs --stdin < map.json
 */

import { readFileSync } from 'node:fs';
import { loadLocale, saveLocale, setDeep } from './lib.mjs';

const args = process.argv.slice(2);
const useStdin = args.includes('--stdin');
const fileArg = args.find((a) => !a.startsWith('--'));

let raw;
if (useStdin) {
  raw = readFileSync(0, 'utf8');
} else if (fileArg) {
  raw = readFileSync(fileArg, 'utf8');
} else {
  console.error('Usage: apply-translations.mjs <map.json> | --stdin');
  process.exit(1);
}

const map = JSON.parse(raw);
if (!map || typeof map !== 'object' || Array.isArray(map)) {
  console.error('Input must be a JSON object of key → translated string');
  process.exit(1);
}

const zh = loadLocale('zh-CN');
let count = 0;
for (const [key, value] of Object.entries(map)) {
  if (typeof value !== 'string') {
    console.error(`Skip non-string value for ${key}`);
    continue;
  }
  setDeep(zh, key, value);
  count += 1;
}
saveLocale('zh-CN', zh);
console.log(`Applied ${count} translation(s) to zh-CN.json`);
