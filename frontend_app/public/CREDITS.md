# MindForge Credits and Licenses

_Last updated: September 21, 2026_

Huge thanks to all people, communities, companies, maintainers, and contributors whose work made this project possible.

The OSS edition of MindForge stands on browser tooling, UI frameworks, desktop runtime work, Rust libraries, and community-maintained infrastructure.

This OSS edition contains no cloud code, no telemetry, and no dependencies on any hosted MindForge services.

## Project lineage

Special thanks to [MindMapVault](https://www.mindmapvault.com/) and the [MindMapVault FOSS](https://github.com/mindmapvault/mindmapvault-foss) project. The initial code in this repository was based on MindMapVault's open-source mind-map editor. MindForge has since diverged substantially (including a plaintext file-document model), but that starting point remains foundational. Thank you to the MindMapVault authors and community for releasing that work.

This file is a practical acknowledgement page plus a licensing summary for the main components used in this OSS repository. It is informational only and is not legal advice. Always review the upstream `LICENSE` files and official documentation for the exact versions you redistribute.

## Main OSS stack

| Component | What it is for | Used for here | License | What it usually requires |
| --- | --- | --- | --- | --- |
| React | UI library | Main app UI | MIT | Keep copyright and license notice in redistributions. |
| React DOM | Browser renderer for React | Browser rendering for the OSS app | MIT | Keep copyright and license notice in redistributions. |
| React Router DOM | Routing | Client-side navigation | MIT | Keep copyright and license notice in redistributions. |
| Zustand | State management | UI, theme, and document session state | MIT | Keep copyright and license notice in redistributions. |
| DOMPurify | HTML sanitization | Sanitizing rendered markdown content | MPL-2.0 OR Apache-2.0 | Apache path requires preserving notices; MPL path has file-level copyleft obligations on modified covered files. |
| marked | Markdown parser | Rendering markdown in notes / exports | MIT | Keep copyright and license notice in redistributions. |
| lucide-react | Icon library | App icons | ISC | Keep copyright and license notice in redistributions. |
| fflate | Zip codec | XMind import/export | MIT | Keep copyright and license notice in redistributions. |
| Tailwind CSS | Utility-first CSS framework | UI styling | MIT | Keep copyright and license notice in redistributions. |
| Vite | Frontend bundler and dev server | Building the OSS frontend | MIT | Keep copyright and license notice in redistributions. |
| TypeScript | Type system and compiler tooling | Type-checked frontend codebase | Apache-2.0 | Preserve notices and license text in redistributions. |

## Desktop OSS host stack

| Component | What it is for | Used for here | License | What it usually requires |
| --- | --- | --- | --- | --- |
| Tauri | Desktop application framework | Desktop shell for the OSS local edition | Apache-2.0 OR MIT | Preserve license and notice text; comply with the chosen license terms. |
| @tauri-apps/api | JS bindings for desktop features | Frontend bridge into the Tauri host | Apache-2.0 OR MIT | Preserve license and notice text; comply with the chosen license terms. |
| @tauri-apps/cli | Build and packaging CLI | Local development and packaging | Apache-2.0 OR MIT | Preserve license and notice text; comply with the chosen license terms. |
| tauri-plugin-fs | Filesystem access plugin | App-dir filesystem access | Apache-2.0 OR MIT | Preserve license and notice text; comply with the chosen license terms. |
| tauri-plugin-dialog | Native dialog plugin | Open / Save dialogs | Apache-2.0 OR MIT | Preserve license and notice text; comply with the chosen license terms. |
| tauri-plugin-shell | Shell/plugin utilities | Desktop shell integration where enabled | Apache-2.0 OR MIT | Preserve license and notice text; comply with the chosen license terms. |
| rfd | Native file dialog library | Cross-platform file-picker integration | MIT OR Apache-2.0 | Preserve license and notice text; comply with the chosen license terms. |

## Rust application ecosystem used by the desktop host

| Component | What it is for | Used for here | License | What it usually requires |
| --- | --- | --- | --- | --- |
| Rust | Systems language and toolchain | Desktop host and supporting crates | Apache-2.0 OR MIT | Preserve license and notice text; comply with the chosen license terms. |
| Serde | Serialization framework | Error / command payloads | MIT OR Apache-2.0 | Preserve license and notice text; comply with the chosen license terms. |
| thiserror | Error definitions | Desktop host error types | MIT OR Apache-2.0 | Preserve license and notice text; comply with the chosen license terms. |
| base64 | Encoding | Crossing binary payloads over IPC | MIT OR Apache-2.0 | Preserve license and notice text; comply with the chosen license terms. |

## Practical notes

- Most direct OSS dependencies used here are permissive licenses such as `MIT`, `Apache-2.0`, `ISC`, or dual `MIT OR Apache-2.0` terms.
- `DOMPurify` is published as `MPL-2.0 OR Apache-2.0`; teams should choose and comply with one of those paths deliberately.
- Documents are plaintext files on user-chosen paths; shared-machine privacy is an OS concern.

## How to update this file

When adding or updating dependencies, contributors should update this file to reflect new licenses or components.

## Thanks again

Thank you to the MindMapVault project, open-source maintainers, standards authors, UI framework contributors, package authors, Rust and JavaScript communities, and desktop/runtime teams whose work made this repository possible.
