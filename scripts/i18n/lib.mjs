/**
 * Shared helpers for MindForge i18n automation scripts.
 * Locale files: frontend_app/src/i18n/locales/{en,zh-CN}.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '../..');
export const FRONTEND_APP = join(REPO_ROOT, 'frontend_app');
export const LOCALES_DIR = join(FRONTEND_APP, 'src/i18n/locales');
export const PENDING_PATH = join(HERE, '.cache/pending.json');

export const PRIMARY = 'en';
export const SECONDARY = ['zh-CN'];

/** Product / format names that stay identical across locales (not "missing"). */
const INTENTIONAL_SAME = new Set([
  'MindForge',
  'FreeMind',
  'FreePlane',
  'WiseMapping',
  'XMind',
  'Markdown',
  'PNG',
  'PDF',
  'URL',
  'English',
  '中文',
  '100%',
  'Mac',
  'GitHub',
  'FreeMind / FreePlane',
]);

const BRAND_PREFIXES = [
  'MindForge',
  'FreeMind',
  'FreePlane',
  'WiseMapping',
  'XMind',
  'Markdown',
];

export function flatten(obj, prefix = '') {
  /** @type {Record<string, string>} */
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = value == null ? '' : String(value);
    }
  }
  return out;
}

export function unflatten(flat) {
  const root = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return root;
}

export function loadLocale(lang) {
  const path = join(LOCALES_DIR, `${lang}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveLocale(lang, data) {
  const path = join(LOCALES_DIR, `${lang}.json`);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function setDeep(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function looksIntentionalSame(enValue, zhValue) {
  if (enValue !== zhValue) return false;
  const trimmed = enValue.trim();
  if (!trimmed) return true;
  if (INTENTIONAL_SAME.has(trimmed)) return true;
  // Pure punctuation / symbols / extensions
  if (!/[A-Za-z\u4e00-\u9fff]/.test(trimmed)) return true;
  // Already contains Chinese
  if (/[\u4e00-\u9fff]/.test(zhValue)) return true;
  // Brand (+ optional extension hint), e.g. "MindForge (.mmforge)"
  if (BRAND_PREFIXES.some((b) => (
    trimmed === b
    || trimmed.startsWith(`${b} `)
    || trimmed.startsWith(`${b}(`)
    || trimmed.startsWith(`${b} (`)
  ))) {
    return true;
  }
  return false;
}

/**
 * Compare primary vs secondary catalogs.
 * @returns {{ missing: string[], empty: string[], sameAsEnglish: string[], pending: Array<{key:string, en:string, reason:string}> }}
 */
export function analyzePending(primaryFlat, secondaryFlat) {
  /** @type {Array<{key:string, en:string, reason:string}>} */
  const pending = [];
  const missing = [];
  const empty = [];
  const sameAsEnglish = [];

  for (const [key, enValue] of Object.entries(primaryFlat)) {
    if (!(key in secondaryFlat)) {
      missing.push(key);
      pending.push({ key, en: enValue, reason: 'missing' });
      continue;
    }
    const zh = secondaryFlat[key];
    if (!zh.trim()) {
      empty.push(key);
      pending.push({ key, en: enValue, reason: 'empty' });
      continue;
    }
    if (zh === enValue && !looksIntentionalSame(enValue, zh)) {
      sameAsEnglish.push(key);
      pending.push({ key, en: enValue, reason: 'same-as-en' });
    }
  }

  pending.sort((a, b) => a.key.localeCompare(b.key));
  return { missing, empty, sameAsEnglish, pending };
}

export function writePendingReport(report) {
  mkdirSync(dirname(PENDING_PATH), { recursive: true });
  writeFileSync(PENDING_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return PENDING_PATH;
}

export function readPendingReport() {
  try {
    return JSON.parse(readFileSync(PENDING_PATH, 'utf8'));
  } catch {
    return null;
  }
}
