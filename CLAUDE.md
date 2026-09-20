# CLAUDE.md — mindforge

The agent contract for this repository lives in
**`docs/file-document-architecture.md`** (document open/save model) and
**`AGENTS.md`** (privacy / local-only rules). Read those before changing anything.

This file covers **how this code is tested, and why the obvious way does not work here.**

---

## The bug class this repo actually has

The editor is one codebase that can run in more than one shell:

| Shell | Router | Tauri IPC | Backend |
|---|---|---|---|
| `desktop/` (Tauri) | `BrowserRouter` | yes | no |
| Hosted sibling apps (if any) | `BrowserRouter` | no | yes |

A unit test renders a component **in isolation**, which means it supplies
whatever context the component asks for. So a component that calls
`useNavigate()` unconditionally can pass every unit test and then blank the
page in a shell that has no `<Router>` (or the wrong IPC).

**The lesson is not "write more unit tests."** Unit tests cannot see this class
by construction. Coverage of the editor logic is already good; what matters for
shell bugs is exercising the app *as that shell*.

Desktop uses a **plaintext file document** model: Home → Open/Save → Editor.
Shell smoke and E2E should exercise that flow (menus, open/save dialogs).

---

## The layers, and what each one is for

Add a test at the **cheapest layer that can see the bug**. Most defects here
belong to one specific layer and are invisible to the others.

| Layer | Catches | Cost |
|---|---|---|
| **Type check** (`tsc --noEmit`) | truncated JSX, bad props, missing imports | seconds |
| **Unit / component** (vitest) | logic, parsers, geometry, format round-trips | seconds |
| **Shell smoke** (Playwright, per shell) | missing context, missing IPC, blank screens | ~1 min |
| **Interaction** (Playwright) | panels that do not close each other, dialogs that trap focus | ~1 min |
| **Desktop E2E** (WebdriverIO + `@wdio/tauri-service`) | native menus, file dialogs, the real WebView | minutes |
| **Build gates** (scripts) | version skew, offline parity, format round-trip fidelity | seconds |

---

## What must run when

```
pre-commit (~10 s) tsc --noEmit + vitest on changed files
pre-push (~90 s) full vitest + round-trip gate + version gate
CI (minutes) the above + cargo check/test
release WebdriverIO against a real desktop build
```

---

## Rules that came from something going wrong

**A skipped test has not tested anything.** Prefer a failure over a skip when
the reason is "the selector was not found" — that is the bug.

**The smoke test's primary assertion is "nothing threw."** Collect `pageerror`
and `console.error`, click through the shell, assert the list is empty and
`#root` still has children (blank-screen detection).

**A gate that warns is not a gate.** If a check is worth running it is worth failing.

**Every new format needs a fidelity mask entry** in
`utils/__tests__/roundTrip.test.ts`, not a bespoke one-off test file.

**Compatibility is tested against real files** in `utils/__tests__/compat.test.ts`.

---

## Commands

```bash
pnpm install
pnpm dev:app          # frontend_app Vite
pnpm test:app         # vitest
pnpm check:roundtrip  # import/export fidelity gate
pnpm tauri:build      # desktop bundle
```
