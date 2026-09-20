# Contributing

Thanks for your interest in MindForge.

This repository is a local-only, offline-first, no-telemetry desktop mind-map
editor. Contributions should preserve that model.

## Workflow

1. Fork and create a feature branch.
2. Keep changes focused and minimal.
3. Add tests or validation notes when behavior changes.
4. Open a pull request with a clear summary.

## Coding Expectations

- Documents are plaintext files opened and saved on user-chosen paths.
- Do not introduce network requests, analytics, or telemetry for core editing.
- Avoid logs that expose document contents or secrets.
- Keep desktop Open / Save / Save As as the default persistence path.
- Stay consistent with `docs/file-document-architecture.md` and `SECURITY.md`.
- Ordinary docs under `docs/` use lowercase + kebab-case.

## Security-Relevant Changes

Changes affecting file IO, dialogs, or document persistence should:

- keep user-path writes behind dialog-chosen paths /
  `read_user_file` / `write_user_file`
- avoid plaintext leakage in logs or diagnostics
- include regression tests where practical
- document security-relevant behavior changes in the PR description

See `SECURITY.md` for the threat model.

## Commit Guidelines

- Use clear commit messages describing user-visible changes.
- Keep unrelated refactors out of feature fixes.
- Reference issues or docs when modifying security-sensitive areas.
