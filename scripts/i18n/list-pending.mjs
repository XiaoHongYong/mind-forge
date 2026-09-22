#!/usr/bin/env node
/**
 * List pending zh-CN translations without re-running extract.
 *
 * Usage:
 *   node scripts/i18n/list-pending.mjs
 *   node scripts/i18n/list-pending.mjs --json
 *   node scripts/i18n/list-pending.mjs --from-cache
 */

import {
  PRIMARY,
  SECONDARY,
  analyzePending,
  flatten,
  loadLocale,
  readPendingReport,
  writePendingReport,
} from './lib.mjs';

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const fromCache = args.has('--from-cache');

let report;
if (fromCache) {
  report = readPendingReport();
  if (!report) {
    console.error('No cache at scripts/i18n/.cache/pending.json — run extract.mjs first.');
    process.exit(1);
  }
} else {
  const enFlat = flatten(loadLocale(PRIMARY));
  /** @type {Record<string, ReturnType<typeof analyzePending>>} */
  const byLocale = {};
  for (const lang of SECONDARY) {
    byLocale[lang] = analyzePending(enFlat, flatten(loadLocale(lang)));
  }
  const primaryPending = byLocale[SECONDARY[0]];
  report = {
    generatedAt: new Date().toISOString(),
    primary: PRIMARY,
    secondary: SECONDARY,
    totals: {
      enKeys: Object.keys(enFlat).length,
      newKeys: 0,
      pending: primaryPending.pending.length,
      missing: primaryPending.missing.length,
      empty: primaryPending.empty.length,
      sameAsEnglish: primaryPending.sameAsEnglish.length,
    },
    newKeys: [],
    pending: primaryPending.pending,
    byLocale,
  };
  writePendingReport(report);
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log(`Pending zh-CN: ${report.totals.pending}`);
for (const row of report.pending) {
  console.log(`[${row.reason}] ${row.key}\t${JSON.stringify(row.en)}`);
}
process.exit(report.totals.pending > 0 ? 2 : 0);
