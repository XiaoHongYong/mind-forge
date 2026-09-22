# MindForge

Local desktop mind-mapping. Open and save ordinary files on your machine —
no account, no cloud, no telemetry.

Native lossless format: `.mmforge`. Also opens and exports FreeMind / FreePlane
(`.mm`), WiseMapping (`.wxml`), XMind (`.xmind`), and Markdown (`.md`).
PNG / PDF export are available from the File menu.

> 中文：[README.zh-CN.md](README.zh-CN.md)

## Features

- **File documents, not a vault** — New / Open / Save / Save As / Recent; paths
  stay on disk. Same absolute path opens as one tab (no duplicate buffers).
- **Multi-tab editor** — VS Code–style tabs with dirty indicators; session
  restore after quit (saved paths reopen; unsaved trees restore from app-data
  backups when the on-disk hash still matches).
- **Left sidebar** — Recent files and the live document outline (select /
  scroll with the canvas).
- **Right format panel** — Node fill / border / branch colour, fonts, map
  defaults, colour themes, structure (mind map ↔ org chart).
- **Node content** — Notes (Markdown), icons, checkbox, progress, date
  planning, URL, labels, images, file links, and attachments.
- **Find & replace** across the map; focus mode; colour / icon trays; zoom /
  fit; undo / redo; copy–cut–paste of subtrees.
- **UI language** — English and 简体中文 (follow system, or pin in Settings).
- **Keyboard layouts** — Closed `FreeMind` and `Mac` layouts (Settings →
  Interface); native menu bar mirrors the modifier-based subset.
- **Appearance** — Light / dark, accent colour, canvas background, toolbar
  density (Lean / Standard / Large).

## Architecture Overview

Core components:

1. `frontend_app/` — React + TypeScript editor, i18n, and document session
2. `desktop/src-tauri/` — Rust / Tauri 2 host and user-path file IO
3. Local filesystem — plaintext `.mmforge` / interchange files

High-level flow:

1. Launch opens the editor (no separate home screen). Recent files and the
   outline live in the left sidebar; New / Open / Save stay in the editor and
   native menus.
2. Each open buffer is a `DocumentSession` (one tab) held in memory.
3. Save writes bytes to the chosen path (or Save As). Export serializes to an
   interchange or image format via a target dialog.
4. Desktop file IO uses native dialogs plus Tauri `read_user_file` /
   `write_user_file`; the webview FS ACL stays scoped to app directories.

Related notes:

- [`docs/file-document-architecture.md`](docs/file-document-architecture.md)
- [`docs/project-structure-and-build.md`](docs/project-structure-and-build.md)
- [`scripts/README.md`](scripts/README.md) — i18n extract / cross-platform build
- [`SECURITY.md`](SECURITY.md)

## Getting Started

Prerequisites:

- Node.js 20+
- pnpm 10+
- Rust stable toolchain
- platform prerequisites required by Tauri 2

Check prerequisites:

```bash
node -v
pnpm -v
rustc -V
cargo -V
```

### One-command local run

From the repository root:

```bash
./run.sh              # Tauri desktop (dev); installs deps if needed
./run.sh app          # frontend Vite only
./run.sh --install    # force pnpm install first
```

Equivalent pnpm entries:

```bash
pnpm install
pnpm tauri:dev        # desktop
pnpm dev:app          # Vite only
pnpm build:app
pnpm test:app
pnpm tauri:build
```

### Cross-platform release build

`scripts/build/` probes Xcode / Android SDK·NDK / JDK / Rust / Docker and builds
targets that are ready on this machine (mac / windows / linux / android).
Android needs a one-time `tauri android init` (`--init-mobile`). iOS is not
supported. Windows packages need a Windows host or CI.

```bash
./run.sh build --detect          # probe only
./run.sh build                   # native desktop for this host
./run.sh build --all             # every target ready here
./run.sh build --targets mac,android --init-mobile
pnpm build:detect
pnpm build:all
```

Details: [`scripts/build/README.md`](scripts/build/README.md).

### UI i18n

```bash
pnpm i18n:extract                # extract keys + pending zh-CN report
pnpm i18n:pending                # list pending without re-extract
```

Agent workflow: [`.cursor/skills/i18n-translate/SKILL.md`](.cursor/skills/i18n-translate/SKILL.md).
More: [`scripts/README.md`](scripts/README.md).

### macOS packaging

- Output: `desktop/src-tauri/target/release/bundle/dmg/*.dmg` (host architecture)
- Requires macOS 10.15+. Apple Silicon is native (no Rosetta).
- Universal DMG (Apple Silicon + Intel):

  ```bash
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  pnpm --dir frontend_app tauri:build --target universal-apple-darwin
  ```

  Output: `desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg`

- Released DMGs are typically unsigned. After installing, clear quarantine if needed:

  ```bash
  xattr -dr com.apple.quarantine "/Applications/MindForge.app"
  ```

### Linux packaging

- Default Tauri targets include AppImage (`desktop/src-tauri/target/release/bundle/`).
- Snap metadata lives under `desktop/snap/`.
- Build-host packages (Debian/Ubuntu):

  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev \
    libayatana-appindicator3-dev librsvg2-dev patchelf
  ```

- On a non-Linux host, use the build script’s Linux path (Docker when available):

  ```bash
  ./run.sh build --targets linux
  ```

### Windows notes

- Run commands from the repository root.
- If install fails with EACCES under `node_modules`:

```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
```

- If pnpm ignores build scripts:

```powershell
pnpm approve-builds
```

## Keyboard Shortcuts

The editor ships two closed layouts — pick one in Settings → Interface, or let
it default per platform (`FreeMind` on Windows/Linux, `Mac` on macOS). `Mod`
resolves to ⌘ on macOS and Ctrl elsewhere. Press <kbd>F1</kbd> (FreeMind) /
<kbd>⌘/</kbd> (Mac) in the editor for the live table.

| Action | FreeMind (Windows/Linux) | Mac |
|---|---|---|
| **Nodes** | | |
| Add child | Tab / Insert | Tab |
| Add left child (root) | Shift+Tab | ⇧Tab |
| Add sibling | Enter | Enter |
| Delete node | Delete / Backspace | Delete / Backspace |
| Rename | F2 | ⌘Enter |
| Notes | F3 | ⌘⇧K |
| Edit notes | Ctrl+E | ⌘E |
| Add image | Alt+K | ⌥K |
| Link to file | Ctrl+K | ⌘K |
| Attach file | F6 | ⌘⇧O |
| Fold / Unfold | Space | Space |
| Reset position | R | R |
| Reset all positions | Ctrl+Shift+R | ⌘⇧R |
| Auto-align subtree | A | A |
| **Format** | | |
| Colour picker | F4 | B |
| Icons | I | I |
| Checkbox | C | C |
| Progress | P | P |
| Dates | D | D |
| URL | U | U |
| Labels | T | T |
| **View** | | |
| Go to root | Home | H |
| Focus mode | F5 / F | ⌘⇧F |
| Toggle structure | Ctrl+Shift+M | ⌘⇧M |
| Zoom in | + / Alt+↓ | ⌘+ |
| Zoom out | - / Alt+↑ | ⌘− |
| Fit to window | F8 | ⌘⇧8 |
| Toggle colour tray | Ctrl+Shift+1 | ⌘⇧1 |
| Toggle icon tray | Ctrl+Shift+2 | ⌘⇧2 |
| Toggle format sidebar | Ctrl+Shift+3 | ⌘⇧3 |
| **Edit** | | |
| Copy | Ctrl+C | ⌘C |
| Cut | Ctrl+X | ⌘X |
| Paste | Ctrl+V | ⌘V |
| Undo | F9 / Ctrl+Z | ⌘Z |
| Redo | F10 / Ctrl+Y / Ctrl+Shift+Z | ⌘⇧Z |
| **Find** | | |
| Search | Ctrl+F | ⌘F |
| Shortcuts (this table) | F1 | ⌘/ |
| **File** | | |
| Open | Ctrl+O | ⌘O |
| Save | Ctrl+S | ⌘S |

Source of truth: `frontend_app/src/shortcuts/registry.ts`. The native menu bar
mirrors the unambiguous modifier-based subset. Copy, Cut, and Paste are the
exception: they are editor commands without a menu key equivalent, so a focused
text field still receives the key. Bare-letter shortcuts stay editor-only so
they do not steal typing focus.

## Validation

```bash
pnpm test:app                    # frontend vitest
pnpm --dir frontend_app build    # typecheck + production bundle
```

Cross-layer changes: also run `cargo check` under `desktop/src-tauri`.

## Release Outputs

Typical artifacts (plus `.sha256` checksums when published):

- macOS DMG (universal when built that way)
- Windows NSIS `.exe` installer
- Linux AppImage (and Snap where configured)
- Android APK / AAB when mobile is initialized and built

Build workflow configuration lives in `.github/workflows/` when present.

## Contributing

- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`CREDITS.md`](CREDITS.md)

Expectations: focused changes, local / no telemetry, no secrets in logs,
clear notes for user-visible behavior. Keep frontend and desktop version /
bundle metadata in sync (currently `0.6.2`).

## License

MindForge is released under the MIT license. See [`LICENSE`](LICENSE).
