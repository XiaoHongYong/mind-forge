---
name: i18n-translate
description: >-
  Extracts MindForge UI i18n keys via scripts/i18n, reports pending zh-CN
  strings, and translates newly added English catalog entries. Use when the
  user asks to extract translations, sync locales, translate new i18n keys,
  fill zh-CN, or run i18n automation after UI string changes.
---

# i18n extract & translate

Local-only MindForge workflow. Do **not** send strings to a cloud TMS.

## When to use

- User added/changed UI copy and wants locales updated
- User asks to extract i18n / translate new keys / sync zh-CN
- After a PR touches `t('…')` / `i18n.t('…')` call sites

## Prerequisites

- Repo root is the MindForge workspace
- `pnpm` install already done under `frontend_app`
- Scripts: [`scripts/i18n/`](../../../scripts/i18n/)

## Workflow

Copy and track:

```
i18n progress:
- [ ] 1. Extract
- [ ] 2. Read pending report
- [ ] 3. Translate new/empty keys into zh-CN
- [ ] 4. Re-check pending + locale tests
```

### 1. Extract

From repo root:

```bash
node scripts/i18n/extract.mjs
```

This runs `i18next-cli extract` (+ sync), then writes
`scripts/i18n/.cache/pending.json` (gitignored).

To fail CI-style when anything is still pending:

```bash
node scripts/i18n/extract.mjs --fail-on-pending
```

### 2. Inspect pending

Prefer the cache the extract step just wrote:

```bash
node scripts/i18n/list-pending.mjs --from-cache --json
```

Or re-scan catalogs without extract:

```bash
node scripts/i18n/list-pending.mjs --json
```

Report fields:

| Field | Meaning |
|-------|---------|
| `newKeys` | Keys that appeared in `en.json` during this extract |
| `pending[].reason` | `missing` / `empty` / `same-as-en` |
| `pending[].en` | English source string (keep `{{placeholders}}`) |

Prioritize `newKeys` and `reason: missing|empty`. Treat `same-as-en` carefully:
product names (MindForge, FreeMind, …) may stay identical on purpose — skip those.

### 3. Translate

1. Read existing style from `frontend_app/src/i18n/locales/zh-CN.json`
   (concise UI Chinese; keep British “Colour”→“颜色” where already established).
2. Build a flat map of **only** keys you are filling:
   ```json
   { "toolbar.navigate": "导航", "editor.saved": "已保存" }
   ```
3. Apply:
   ```bash
   node scripts/i18n/apply-translations.mjs /tmp/zh-map.json
   ```
   Or edit `zh-CN.json` directly with the same key paths (nested JSON).

Rules:

- Preserve `{{var}}` / `{{count}}` interpolation tokens exactly
- Do not translate product/format brand names: MindForge, FreeMind, FreePlane, WiseMapping, XMind, Markdown (as format name)
- Do not invent keys — only translate keys already in `en.json`
- Source must keep extractable calls: static `t('a.b', { defaultValue: '…' })` only (no `` t(`a.${id}`) ``)

### 4. Verify

```bash
node scripts/i18n/list-pending.mjs
pnpm --dir frontend_app exec vitest run src/i18n/__tests__/locales.test.ts
```

Pending count should drop; locale key trees must stay identical.

## Researching the scripts

Before changing extract behavior, read:

1. `scripts/i18n/extract.mjs` — orchestration
2. `scripts/i18n/lib.mjs` — flatten / pending heuristics
3. `frontend_app/i18next.config.ts` — i18next-cli extract rules

If extract misses a key, fix the **call site** (static key + `defaultValue`), then re-run extract — do not hand-add orphan keys to JSON without a source reference.

## Out of scope

- Translating user document content / node text
- Rust menu label tables (labels come from frontend `menuLabels.ts` + IPC rebuild)
- Adding new locales beyond `en` / `zh-CN` unless the user explicitly asks
