import type { MindMapTree } from '../types';
import { isTauri } from '../storage';
import { readFileBytes } from './fileAccess';
import type { DocumentSession } from './types';

/**
 * Stable key for the single untitled (never-saved) backup slot.
 * Not a filesystem path — only used to name the backup file in app data.
 */
export const UNTITLED_BACKUP_KEY = '__mindforge_untitled__';

/** On-disk payload written under the app data directory. */
export interface UnsavedBackupPayload {
  /** Absolute path, or null when the buffer was never saved to a file. */
  path: string | null;
  /** True when there is no associated file (untitled / never saved). */
  neverSaved: boolean;
  /** SHA-256 hex of the document file bytes when backed up; empty if neverSaved. */
  sourceHash: string;
  title: string;
  formatId: DocumentSession['formatId'];
  tree: MindMapTree;
  createdAt: string;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Pure gate used by open + tests: restore only when the file is unchanged. */
export function shouldRestoreUnsavedBackup(
  sourceHash: string,
  currentFileHash: string,
): boolean {
  return sourceHash.length > 0 && sourceHash === currentFileHash;
}

function backupKeyFor(path: string | null): string {
  return path && path.trim() ? path.trim() : UNTITLED_BACKUP_KEY;
}

function parseBackupPayload(raw: string): UnsavedBackupPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<UnsavedBackupPayload> & {
      path?: string | null;
    };
    const path = parsed.path === undefined
      ? null
      : parsed.path === null || parsed.path === ''
        ? null
        : typeof parsed.path === 'string'
          ? parsed.path
          : null;
    // Legacy path-backed payloads omit neverSaved; treat null/empty path as untitled.
    const neverSaved = typeof parsed.neverSaved === 'boolean'
      ? parsed.neverSaved
      : path === null;
    const sourceHash = typeof parsed.sourceHash === 'string' ? parsed.sourceHash : '';

    if (
      typeof parsed.title !== 'string'
      || typeof parsed.formatId !== 'string'
      || !parsed.tree
      || parsed.tree.version !== 'tree'
      || !parsed.tree.root
    ) {
      return null;
    }
    if (!neverSaved && (path === null || !sourceHash)) {
      return null;
    }
    if (neverSaved && path !== null) {
      return null;
    }

    return {
      path,
      neverSaved,
      sourceHash,
      title: parsed.title,
      formatId: parsed.formatId as DocumentSession['formatId'],
      tree: parsed.tree,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
    };
  } catch {
    return null;
  }
}

async function invokeWrite(key: string, payloadJson: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('write_unsaved_backup', { path: key, payloadJson });
}

async function invokeRead(key: string): Promise<string | null> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string | null>('read_unsaved_backup', { path: key });
}

async function invokeDelete(key: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('delete_unsaved_backup', { path: key });
}

/** Persist the live (unsaved) session. `path: null` = never saved / no file. */
export async function writeUnsavedBackup(input: {
  path: string | null;
  title: string;
  tree: MindMapTree;
  formatId: DocumentSession['formatId'];
}): Promise<void> {
  if (!isTauri()) return;

  const neverSaved = !input.path;
  let sourceHash = '';
  if (input.path) {
    const diskBytes = await readFileBytes(input.path);
    sourceHash = await sha256Hex(diskBytes);
  }

  const payload: UnsavedBackupPayload = {
    path: input.path,
    neverSaved,
    sourceHash,
    title: input.title,
    formatId: input.formatId,
    tree: input.tree,
    createdAt: new Date().toISOString(),
  };
  await invokeWrite(backupKeyFor(input.path), JSON.stringify(payload));
}

export async function deleteUnsavedBackup(path: string | null): Promise<void> {
  if (!isTauri()) return;
  try {
    await invokeDelete(backupKeyFor(path));
  } catch {
    // Best-effort: a missing backup is fine.
  }
}

/**
 * If a path-backed backup exists and the on-disk file still matches the hash
 * recorded at exit, return it (and delete the backup). Otherwise discard a
 * stale backup.
 */
export async function takeMatchingUnsavedBackup(
  path: string,
  diskBytes: Uint8Array,
): Promise<UnsavedBackupPayload | null> {
  if (!isTauri() || !path) return null;

  let raw: string | null;
  try {
    raw = await invokeRead(path);
  } catch {
    return null;
  }
  if (!raw) return null;

  const backup = parseBackupPayload(raw);
  if (!backup || backup.neverSaved) {
    await deleteUnsavedBackup(path);
    return null;
  }

  const currentHash = await sha256Hex(diskBytes);
  if (!shouldRestoreUnsavedBackup(backup.sourceHash, currentHash)) {
    await deleteUnsavedBackup(path);
    return null;
  }

  await deleteUnsavedBackup(path);
  return backup;
}

/**
 * Take the untitled (never-saved) backup if present. Always deletes the slot
 * after a successful read so it is not restored twice.
 */
export async function takeUntitledUnsavedBackup(): Promise<UnsavedBackupPayload | null> {
  if (!isTauri()) return null;

  let raw: string | null;
  try {
    raw = await invokeRead(UNTITLED_BACKUP_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const backup = parseBackupPayload(raw);
  await deleteUnsavedBackup(null);
  if (!backup || !backup.neverSaved) return null;
  return backup;
}

/** Build a dirty untitled session from a never-saved backup. */
export function sessionFromUntitledBackup(backup: UnsavedBackupPayload): DocumentSession {
  return {
    path: null,
    title: backup.title || 'Untitled',
    tree: backup.tree,
    formatId: backup.formatId || 'mmforge',
    dirty: true,
  };
}
