#!/usr/bin/env node
/**
 * Check: ArkWeb bridge property names survive release obfuscation.
 *
 * Same idea as Android R8 / ProGuard keep rules: the page reaches the bridge
 * *by string name* (`javaScriptProxy`), so release builds with
 * `-enable-property-obfuscation` will rename anything missing from
 * `entry/obfuscation-rules.txt`. The injected `window.MindForgeNative` then
 * quietly loses that property — no build error, no runtime error, just a call
 * that stops resolving (e.g. a missing `deleteAppData` means unsaved-backup
 * slots are never cleared).
 *
 * Three lists must agree; drift *exits non-zero*. A warning is worthless here:
 * the bug is invisible until it is expensive.
 *
 *   1. BRIDGE_OBJECT_NAME (proxy object) + SYNC/ASYNC method names  (JS side)
 *   2. methods defined on the NativeBridge class                   (ArkTS side)
 *   3. the `-keep-property-name` block                             (what survives)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRIDGE = join(ROOT, 'ohos/entry/src/main/ets/web/NativeBridge.ets');
const RULES = join(ROOT, 'ohos/entry/obfuscation-rules.txt');

const errors = [];

/** Pulls a `export const NAME: Array<string> = ['a', 'b'];` string literal list. */
function readStringArray(source, name) {
  const match = new RegExp(`export const ${name}\\s*:\\s*Array<string>\\s*=\\s*\\[([^\\]]*)\\]`).exec(source);
  if (!match) {
    errors.push(`could not find ${name} in ${BRIDGE}`);
    return [];
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function readConst(source, name) {
  const match = new RegExp(`export const ${name}\\s*:\\s*string\\s*=\\s*'([^']+)'`).exec(source);
  if (!match) {
    errors.push(`could not find ${name} in ${BRIDGE}`);
    return '';
  }
  return match[1];
}

/** Method names defined directly on the class body, minus the constructor. */
function readClassMethods(source) {
  const body = /export class NativeBridge\s*\{([\s\S]*)\n\}/.exec(source);
  if (!body) {
    errors.push(`could not find the NativeBridge class body in ${BRIDGE}`);
    return [];
  }
  // Only top-level members: two-space indent (the class body's own methods).
  return [...body[1].matchAll(/^ {2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)]
    .map((m) => m[1])
    .filter((name) => name !== 'constructor');
}

function readKeptNames(rules) {
  const block = /-keep-property-name\s*\n([\s\S]*)$/.exec(rules);
  if (!block) {
    errors.push(`no -keep-property-name block in ${RULES}`);
    return [];
  }
  return block[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

const bridgeSource = readFileSync(BRIDGE, 'utf8');
const objectName = readConst(bridgeSource, 'BRIDGE_OBJECT_NAME');
const syncMethods = readStringArray(bridgeSource, 'SYNC_METHODS');
const asyncMethods = readStringArray(bridgeSource, 'ASYNC_METHODS');
const registered = [objectName, ...syncMethods, ...asyncMethods];
const defined = readClassMethods(bridgeSource);
const kept = new Set(readKeptNames(readFileSync(RULES, 'utf8')));

// A registered name with no method behind it is a call that fails at runtime.
for (const name of [...syncMethods, ...asyncMethods]) {
  if (!defined.includes(name)) {
    errors.push(`'${name}' is registered with the Web component but not defined on NativeBridge`);
  }
}

// A public method that is not registered is dead weight — or a typo.
const internals = new Set(['describe']);
for (const name of defined) {
  if (!internals.has(name) && !syncMethods.includes(name) && !asyncMethods.includes(name)) {
    errors.push(`NativeBridge.${name}() is defined but never registered with the Web component`);
  }
}

// The regression this check exists for: obfuscation eats a live property name.
for (const name of registered) {
  if (!kept.has(name)) {
    errors.push(`'${name}' is missing from -keep-property-name — a release build will rename it`);
  }
}

// A stale keep entry hides nothing dangerous, but it means the file drifted.
for (const name of kept) {
  if (!registered.includes(name)) {
    errors.push(`'${name}' is kept in obfuscation-rules but no longer part of the bridge`);
  }
}

if (errors.length > 0) {
  console.error('check-ohos-bridge: FAILED');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`check-ohos-bridge: ok — ${registered.length} names kept (${syncMethods.length} sync, ${asyncMethods.length} async)`);
