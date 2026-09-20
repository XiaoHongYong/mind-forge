# Agent Guidelines for MindForge

Concise rules for AI agents working on this local-first desktop app.

Key links:
- Architecture: [docs/file-document-architecture.md](docs/file-document-architecture.md)
- Desktop host: [desktop/src-tauri/](desktop/src-tauri/)
- Frontend app: [frontend_app/](frontend_app/)

Top rules:
- Ordinary docs under `docs/` use lowercase + kebab-case (see `.cursor/rules/docs-naming.mdc`).
- Local-only: do not introduce cloud, telemetry, or remote account features.
- Documents are plaintext files on user-chosen paths (Open / Save / Recent).
- File IO for user paths goes through Tauri `read_user_file` / `write_user_file`
  (dialog-chosen paths), not a widened webview fs ACL.
- Never suggest logging document contents or embedding secrets in the repo.

Testing and release hygiene:
- Run `pnpm --dir frontend_app build` and `cargo check` in `desktop/src-tauri`
  when making cross-cutting changes.
- Keep versions and packaging metadata consistent across frontend and desktop.
