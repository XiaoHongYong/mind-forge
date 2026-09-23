# Project Structure And Build Guide

How the repository is organized and how to build the desktop app.

## Top-Level Structure

- `frontend_app/`
  - React + TypeScript UI
  - Home (recent files), editor, document open/save, format codecs
- `desktop/src-tauri/`
  - Rust Tauri host
  - user-path file IO (`read_user_file` / `write_user_file`) and packaging
- `ohos/`
  - HarmonyOS NEXT shell: ArkTS + ArkWeb hosting the same frontend bundle
  - selector / file IO / app-data slots behind a JS bridge (`web/NativeBridge.ets`)
  - see `docs/harmonyos-architecture.md`
- `docs/`
  - architecture and third-party format specs (see `file-document-architecture.md`)
- `scripts/`
  - version / offline / round-trip checks and desktop setup helpers
- `packages/mindmap-core/`, `packages/connectors/`
  - shared layout geometry and connector registry types

## Main Runtime Flow

1. Home: New / Open / Recent
2. Editor edits an in-memory `DocumentSession`
3. Save writes plaintext bytes to the user-chosen path (or Save As)
4. Tauri dialogs supply paths; the webview fs ACL stays scoped to app dirs

Canonical design: [`file-document-architecture.md`](file-document-architecture.md).
Shell-specific: [`harmonyos-architecture.md`](harmonyos-architecture.md).

## Build Prerequisites

- Node.js 20+
- pnpm 10+
- Rust stable toolchain
- Tauri OS dependencies for your platform

## Release Validation

Run these checks before tagging a release. All must pass.

```bash
# Import/export fidelity
node scripts/check_import_export_roundtrip.mjs

# Full frontend unit suite
pnpm --dir frontend_app test

# Offline / no-SaaS residue scan
node scripts/check_frontend_offline_parity.mjs --foss-root=.
```

When a format learns a new field, raise that format's fidelity mask in
`frontend_app/src/utils/__tests__/roundTrip.test.ts` so the check enforces it.

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

## HarmonyOS Build

Prerequisites:

- DevEco Studio (it ships the SDK, `hvigor`, and `hdc` — no separate install)
- `DEVECO_SDK_HOME` pointing at `<DevEco>/sdk`; the scripts derive it from
  `$DEVECO_STUDIO_HOME` or the standard install locations

```bash
pnpm build:ohos        # frontend build + sync bundle into resources/rawfile/www
pnpm check:ohos        # bundle is up to date + bridge property names survive obfuscation
./run.sh ohos          # build + sync + assembleHap
./run.sh ohos --run    # also install and start on a connected device
```

The HAP builds but **cannot be signed from the command line**: signing material
is per-developer and requires a Huawei account login. `ohos/build-profile.json5`
keeps `signingConfigs` empty (and gitignored). Sign once in DevEco Studio, then
`--deploy` / `--run` work. Details: [`ohos/README.md`](../ohos/README.md).

`pnpm check:ohos` is the CI check. It also enforces that every bridge property
name (`BRIDGE_OBJECT_NAME` plus each method in `SYNC_METHODS` /
`ASYNC_METHODS`) appears in `ohos/entry/obfuscation-rules.txt`
`-keep-property-name` — same idea as Android R8 keep rules. A release build
renames anything missing, and the injected object silently loses that member.

## WSL Note For Linux Builds

Linux desktop builds are most reliable from a native WSL path, not `/mnt/c`.

Recommended pattern:

- sync the repository to a native WSL folder
- run `pnpm install` and `pnpm --dir frontend_app tauri:build` there
