# File Document Architecture

MindForge is a local-first mind-map editor. A document is a file on disk (or an
untitled buffer until the first Save As). Persistence is path-centric: Open,
Save, Save As, and Recent — no separate document library or sign-in.

## Product model

| Decision | Choice |
|---|---|
| Persistence | Path-centric documents on disk |
| At-rest crypto | None — files are plaintext |
| Native format | `.mmforge` (lossless JSON envelope) |
| Interchange | Open / Save As also support `.md`, `.mm`, `.wxml`, `.xmind` |
| Home | Recent files + New / Open |
| Accounts | None |
| Cross-map links | `NodeLink { type: 'file', path, label? }` |

## Runtime model

```text
HomePage (/)
  New  → untitled DocumentSession → /editor
  Open → dialog → parse by extension → DocumentSession → /editor
  Recent → openPath → /editor

EditorPage (/editor)
  DocumentSession in memory (zustand)
  Save     → write bytes to session.path (or Save As if untitled)
  Save As  → dialog → write → update path + recent
  Export   → serializers + destination dialog (interchange)
```

`DocumentSession` is the only live document:

```ts
{
  path: string | null;   // null = untitled / never saved
  title: string;
  tree: MindMapTree;
  formatId: 'mmforge' | 'md' | 'mm' | 'wxml' | 'xmind';
  dirty: boolean;
}
```

Routing never embeds absolute paths (length / encoding / privacy). The session
store holds the path.

## Unsaved backups

There is no autosave to the user file. Save is explicit. Undo history is kept
across Save, so edits from before the last Save remain undoable.

On leave/quit with dirty edits, the live tree is written to the app data
directory (`unsaved-backups/`):

| Kind | Key | Restore rule |
|---|---|---|
| Path-backed | hash of absolute path | Restore only if on-disk SHA-256 still matches the hash recorded at backup time; then mark dirty and delete the backup. A mismatched hash discards it. |
| Untitled (never saved) | `__mindforge_untitled__` | Payload has `path: null` and `neverSaved: true` (no associated file). Restored on the next New / empty editor session as a dirty untitled buffer, then deleted. |

A successful Save As clears the untitled slot. A successful in-place Save clears
that path's slot.

## Desktop file IO

| Shell | File IO |
|---|---|
| Desktop (Tauri) | Native open/save dialogs + `read_user_file` / `write_user_file` |

The webview `plugin-fs` ACL stays scoped to app directories. Only dialog-chosen
(or recently opened) absolute paths go through the Rust commands above.

| Command | Role |
|---|---|
| `read_user_file(path)` | Read bytes from a user-chosen absolute path |
| `write_user_file(path, data_base64)` | Atomic write to a user-chosen absolute path |

Recent files are tracked in the frontend (persisted preference store).

## Format pipeline

- **Open:** `IMPORT_FORMATS` parsers (bytes/text → tree)
- **Save / Save As (untitled):** prefer `.mmforge` (`treeToMmforge`)
- **Save in place:** serialize with the format implied by the path extension
- **Export menu:** interchange matrix (may be lossy)

Lossy formats (`.md`, `.mm`, …) may drop editor-only fields; `.mmforge` does not.

## Security posture

Privacy is OS-level: file permissions, optional full-disk encryption, and where
the user stores maps.
