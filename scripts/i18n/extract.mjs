#!/usr/bin/env node
/**
 * Extract UI translation keys and report strings that still need zh-CN work.
 *
 * Steps:
 *   1. Snapshot English keys
 *   2. Run i18next-cli extract (+ sync) in frontend_app
 *   3. Diff new keys / empty / same-as-en pending items
 *   4. Write scripts/i18n/.cache/pending.json for agents / CI
 *
 * Usage (repo root):
 *   node scripts/i18n/extract.mjs
 *   node scripts/i18n/extract.mjs --no-sync
 *   node scripts/i18n/extract.mjs --fail-on-pending
 *   pnpm i18n:extract
 */

import { spawnSync } from 'node:child_process';
import {
  FRONTEND_APP,
  PRIMARY,
  SECONDARY,
  analyzePending,
  flatten,
  loadLocale,
  writePendingReport,
} from './lib.mjs';

const args = new Set(process.argv.slice(2));
const noSync = args.has('--no-sync');
const failOnPending = args.has('--fail-on-pending');
const quiet = args.has('--quiet');

function run(cmd, cmdArgs, cwd) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: quiet ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    if (quiet && result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result;
}

function log(...parts) {
  if (!quiet) console.log(...parts);
}

const beforeEn = flatten(loadLocale(PRIMARY));

log('→ i18next-cli extract');
run('pnpm', ['exec', 'i18next-cli', 'extract'], FRONTEND_APP);

if (!noSync) {
  log('→ i18next-cli sync');
  run('pnpm', ['exec', 'i18next-cli', 'sync'], FRONTEND_APP);
}

const afterEn = flatten(loadLocale(PRIMARY));
const newKeys = Object.keys(afterEn)
  .filter((k) => !(k in beforeEn))
  .sort();

/** @type {Record<string, ReturnType<typeof analyzePending>>} */
const byLocale = {};
for (const lang of SECONDARY) {
  const zhFlat = flatten(loadLocale(lang));
  byLocale[lang] = analyzePending(afterEn, zhFlat);
}

const primaryPending = byLocale[SECONDARY[0]];
const report = {
  generatedAt: new Date().toISOString(),
  primary: PRIMARY,
  secondary: SECONDARY,
  totals: {
    enKeys: Object.keys(afterEn).length,
    newKeys: newKeys.length,
    pending: primaryPending.pending.length,
    missing: primaryPending.missing.length,
    empty: primaryPending.empty.length,
    sameAsEnglish: primaryPending.sameAsEnglish.length,
  },
  newKeys,
  pending: primaryPending.pending,
  byLocale,
};

const outPath = writePendingReport(report);

log('');
log(`English keys: ${report.totals.enKeys}`);
log(`New keys this run: ${report.totals.newKeys}`);
if (newKeys.length) {
  for (const k of newKeys.slice(0, 40)) log(`  + ${k}`);
  if (newKeys.length > 40) log(`  … ${newKeys.length - 40} more`);
}
log(`Pending zh-CN: ${report.totals.pending} (missing ${report.totals.missing}, empty ${report.totals.empty}, same-as-en ${report.totals.sameAsEnglish})`);
if (primaryPending.pending.length) {
  for (const row of primaryPending.pending.slice(0, 40)) {
    log(`  · [${row.reason}] ${row.key} = ${JSON.stringify(row.en)}`);
  }
  if (primaryPending.pending.length > 40) {
    log(`  … ${primaryPending.pending.length - 40} more`);
  }
}
log(`Report: ${outPath}`);

if (failOnPending && primaryPending.pending.length > 0) {
  process.exit(2);
}
