# Security Policy

MindForge is a local-first desktop mind-map editor. Core open / edit / save /
export does not require a network and does not send telemetry.

## Posture

- Documents are plaintext files on user-chosen paths (native format `.mmforge`).
- There is no application-level document library, unlock password, or key store.
- Shared-machine privacy is an OS account / full-disk encryption concern.
- User-path IO goes through native dialogs and Tauri `read_user_file` /
  `write_user_file`; the webview filesystem ACL stays scoped to app directories.

## Reporting

Report vulnerabilities privately (do not open a public issue for active
exploits). Prefer GitHub Security Advisories for this repository when enabled,
or contact the maintainers listed on the repository with reproduction steps
and impact.

Architecture reference: `docs/file-document-architecture.md`.
