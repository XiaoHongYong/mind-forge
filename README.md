# MindForge

Local-first desktop mind-mapping. Open and save ordinary files on your machine —
no account, no cloud, no telemetry.

Native lossless format: `.mmforge`. Also opens and exports FreeMind / FreePlane
(`.mm`), WiseMapping (`.wxml`), XMind (`.xmind`), and Markdown (`.md`).

## Architecture Overview

Core components:

1. `frontend_app/` — React + TypeScript editor and document session
2. `desktop/src-tauri/` — Rust desktop host and user-path file IO
3. Local filesystem — plaintext `.mmforge` / interchange files

High-level flow:

1. The app opens in the editor. Recent files and the document outline live in the left sidebar; New / Open / Save stay in the editor.
2. The editor holds a `DocumentSession` in memory.
3. Save writes the file back to the chosen path (or Save As).

Related notes:

- [`docs/file-document-architecture.md`](docs/file-document-architecture.md)
- [`docs/project-structure-and-build.md`](docs/project-structure-and-build.md)
- [`SECURITY.md`](SECURITY.md)

## Getting Started

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

Prerequisites:

- Node.js 20+
- pnpm 10+
- Rust stable toolchain
- platform prerequisites required by Tauri

Check prerequisites:

```powershell
node -v
pnpm -v
rustc -V
cargo -V
```

Install, build, and run:

```bash
pnpm --dir frontend_app install
pnpm --dir frontend_app build
pnpm --dir frontend_app tauri info
pnpm --dir frontend_app tauri:dev
pnpm --dir frontend_app tauri:build
```

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
  xattr -dr com.apple.quarantine "/Applications/MindForge Local-Only.app"
  ```

### Linux packaging

- Output: `desktop/src-tauri/target/release/bundle/appimage/*.AppImage`
- Build-host packages (Debian/Ubuntu):

  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev \
    libayatana-appindicator3-dev librsvg2-dev patchelf
  ```

- Tauri does not cross-compile Linux from macOS/Windows. From another OS:

  ```bash
  pnpm run build:linux
  ```

  Writes under `dist-linux/` (amd64; emulated on Apple Silicon).

### Windows notes

- Run commands from the repository root.
- If install fails with EACCES under `node_modules`:

```powershell
Remove-Item -Recurse -Force node_modules
pnpm --dir frontend_app install
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
| Zoom in | + / Alt+↓ | ⌘+ |
| Zoom out | - / Alt+↑ | ⌘− |
| Fit to window | F8 | ⌘⇧8 |
| Toggle colour tray | Ctrl+Shift+1 | ⌘⇧1 |
| Toggle icon tray | Ctrl+Shift+2 | ⌘⇧2 |
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
| Save | Ctrl+S | ⌘S |

Source of truth: `frontend_app/src/shortcuts/registry.ts`. The native menu bar
mirrors the unambiguous modifier-based subset. Copy, Cut, and Paste are the
exception: they are editor commands without a menu key equivalent, so a focused
text field still receives the key. Bare-letter shortcuts stay editor-only so
they do not steal typing focus.

## Validation

```bash
node scripts/version-check.js
node scripts/check_foss_saas_residue.mjs
node scripts/check_frontend_offline_parity.mjs
```

Workflow-style checks:

```powershell
.\scripts\test-workflow.ps1
```

```bash
./scripts/test-workflow.sh
```

## Release Outputs

Typical artifacts (plus `.sha256` checksums when published):

- macOS DMG (universal when built that way)
- Windows `.exe` installer
- Linux AppImage

Build workflow configuration lives in `.github/workflows/` when present.

## Contributing

- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`CREDITS.md`](CREDITS.md)

Expectations: focused changes, local-first / no telemetry, no secrets in logs,
clear notes for user-visible behavior.

## License

MindForge is released under the MIT license. See [`LICENSE`](LICENSE).
