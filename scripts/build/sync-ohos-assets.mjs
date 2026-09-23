#!/usr/bin/env node
/**
 * Copies the built frontend into the HarmonyOS shell's `rawfile` bundle.
 *
 * `ohos/entry/src/main/ets/web/AssetServer.ets` serves everything under
 * `resources/rawfile/www` from memory, so this directory is the app's entire UI.
 * It is generated, never edited, and gitignored.
 *
 * The target is wiped first on purpose. Vite emits content-hashed chunk names,
 * so syncing without clearing would leave the previous build's chunks behind and
 * steadily inflate the HAP — with the stale copies still being served by URL if
 * anything ever requested one.
 *
 * Usage (repository root):
 *   node scripts/build/sync-ohos-assets.mjs
 *   node scripts/build/sync-ohos-assets.mjs --check   # verify, do not write
 *
 * pnpm:
 *   pnpm sync:ohos
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(REPO_ROOT, 'frontend_app', 'dist');
const DEST = join(REPO_ROOT, 'ohos', 'entry', 'src', 'main', 'resources', 'rawfile', 'www');

/**
 * Files that belong to a web host, not to a HAP.
 *
 * `frontend_app/public/` is shared with the Cloudflare Pages deployment, so the
 * build copies its routing config through. ArkWeb never reads any of it — the
 * shell serves its own bundle — and shipping them would suggest a routing layer
 * exists that does not. `CREDITS.md` is deliberately *not* excluded: attribution
 * should travel with the binary.
 */
const EXCLUDE = new Set(['_redirects', '_headers', '_routes.json']);

const checkOnly = process.argv.includes('--check');

function fail(message) {
  console.error(`sync-ohos-assets: ${message}`);
  process.exit(1);
}

if (!existsSync(SRC)) {
  fail(`frontend build not found at ${relative(REPO_ROOT, SRC)} — run \`pnpm build:app\` first`);
}

if (!existsSync(join(SRC, 'index.html'))) {
  fail(`${relative(REPO_ROOT, SRC)} has no index.html — the build looks incomplete`);
}

/** Every shippable file under `dir`, as paths relative to it. */
function walk(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walk(join(dir, entry.name), rel));
    } else if (!EXCLUDE.has(rel)) {
      out.push(rel);
    }
  }
  return out;
}

if (checkOnly) {
  if (!existsSync(DEST)) {
    fail('rawfile/www is missing — run `pnpm sync:ohos`');
  }
  const expected = new Set(walk(SRC));
  const actual = new Set(walk(DEST));
  const missing = [...expected].filter((f) => !actual.has(f));
  const stale = [...actual].filter((f) => !expected.has(f));
  if (missing.length || stale.length) {
    for (const f of missing) console.error(`  missing in HAP bundle: ${f}`);
    for (const f of stale) console.error(`  stale in HAP bundle:   ${f}`);
    fail(`${missing.length} missing, ${stale.length} stale — run \`pnpm sync:ohos\``);
  }
  console.log(`sync-ohos-assets: up to date (${expected.size} files)`);
  process.exit(0);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

// Copied file by file rather than wholesale, so EXCLUDE is applied. `cpSync` on
// a directory has no filter of its own.
for (const rel of walk(SRC)) {
  const target = join(DEST, rel);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(SRC, rel), target);
}

const files = walk(DEST);
const bytes = files.reduce((sum, f) => sum + statSync(join(DEST, f)).size, 0);

// index.html must land at the root: AssetServer maps it to `/index.html`, which
// is the URL the Web component is created with.
if (!files.includes('index.html')) {
  fail('index.html did not land at the bundle root');
}

console.log(
  `sync-ohos-assets: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB → ` +
    relative(REPO_ROOT, DEST)
);
