# Project Structure And Build Guide

How the repository is organized and how to build the desktop app.

## Top-Level Structure

- `frontend_app/`
  - React + TypeScript UI
  - Home (recent files), editor, document open/save, format codecs
- `desktop/src-tauri/`
  - Rust Tauri host
  - user-path file IO (`read_user_file` / `write_user_file`) and packaging
- `docs/`
  - architecture and third-party format specs (see `file-document-architecture.md`)
- `scripts/`
  - version / offline / round-trip gates and desktop setup helpers
- `packages/mindmap-core/`, `packages/connectors/`
  - shared layout geometry and connector registry types

## Main Runtime Flow

1. Home: New / Open / Recent
2. Editor edits an in-memory `DocumentSession`
3. Save writes plaintext bytes to the user-chosen path (or Save As)
4. Tauri dialogs supply paths; the webview fs ACL stays scoped to app dirs

Canonical design: [`file-document-architecture.md`](file-document-architecture.md).

## Build Prerequisites

- Node.js 20+
- pnpm 10+
- Rust stable toolchain
- Tauri OS dependencies for your platform

## Release Validation

Run these gates before tagging a release. All must pass.

```bash
# Import/export fidelity
node scripts/check_import_export_roundtrip.mjs

# Full frontend unit suite
pnpm --dir frontend_app test

# Offline / no-SaaS residue scan
node scripts/check_frontend_offline_parity.mjs --foss-root=.
```

When a format learns a new field, raise that format's fidelity mask in
`frontend_app/src/utils/__tests__/roundTrip.test.ts` so the gate enforces it.

## Build Commands

One-command setup (Windows PowerShell):

```powershell
.\scripts\setup-desktop.ps1
```

One-command setup (Linux/macOS/WSL shell):

```bash
bash scripts/setup-desktop.sh
```

Optional modes:

```powershell
.\scripts\setup-desktop.ps1 -Mode dev
.\scripts\setup-desktop.ps1 -Mode build
```

```bash
bash scripts/setup-desktop.sh dev
bash scripts/setup-desktop.sh build
```

From the repository root:

```bash
pnpm --dir frontend_app install
pnpm --dir frontend_app build
pnpm --dir frontend_app tauri info
pnpm --dir frontend_app tauri:dev
pnpm --dir frontend_app tauri:build
```

## Desktop Outputs

- Windows: EXE and NSIS installer
- Linux: AppImage / deb / snap (see packaging configs)
- macOS: DMG

## WSL Note For Linux Builds

Linux desktop builds are most reliable from a native WSL path, not `/mnt/c`.

Recommended pattern:

- sync the repository to a native WSL folder
- run `pnpm install` and `pnpm --dir frontend_app tauri:build` there
