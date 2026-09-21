import type { MindMapTree } from '../types';
import { isTauri } from '../storage';
import { openDocumentFromPath } from './io';
import { readFileBytes } from './fileAccess';
import { useDocumentStore } from './store';
import type { DocumentSession } from './types';
import { readAppDataSlot, sha256Hex, writeAppDataSlot } from './unsavedBackup';

/** App-data / localStorage key for the last open tab set. */
export const WORKSPACE_SLOT_KEY = '__mindforge_workspace__';
const LOCAL_KEY = 'mindforge:workspace';

export interface WorkspaceTabRecord {
  id: string;
  path: string | null;
  title: string;
  formatId: DocumentSession['formatId'];
  dirty: boolean;
  /** Untitled tabs always include the tree. Dirty file tabs include it too. */
  tree?: MindMapTree;
  /** SHA-256 of the file bytes when a dirty file tab was snapshotted. */
  sourceHash?: string;
}

export interface WorkspaceSnapshot {
  version: 1;
  activeId: string | null;
  tabs: WorkspaceTabRecord[];
}

function isTree(value: unknown): value is MindMapTree {
  if (!value || typeof value !== 'object') return false;
  const tree = value as MindMapTree;
  return tree.version === 'tree' && Boolean(tree.root);
}

export function buildWorkspaceSnapshot(
  sessions: DocumentSession[],
  activeId: string | null,
  sourceHashByPath: Record<string, string>,
): WorkspaceSnapshot {
  return {
    version: 1,
    activeId,
    tabs: sessions.map((session) => {
      const record: WorkspaceTabRecord = {
        id: session.id,
        path: session.path,
        title: session.title,
        formatId: session.formatId,
        dirty: session.dirty,
      };
      // Never-saved buffers must round-trip even when clean. Dirty files keep
      // their tree so unsaved edits survive quit.
      if (session.path == null || session.dirty) {
        record.tree = session.tree;
      }
      if (session.path && session.dirty && sourceHashByPath[session.path]) {
        record.sourceHash = sourceHashByPath[session.path];
      }
      return record;
    }),
  };
}

export function parseWorkspaceSnapshot(raw: string): WorkspaceSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    if (parsed.version !== 1 || !Array.isArray(parsed.tabs)) return null;
    const tabs: WorkspaceTabRecord[] = [];
    for (const tab of parsed.tabs) {
      if (!tab || typeof tab !== 'object') continue;
      if (typeof tab.id !== 'string' || !tab.id) continue;
      if (typeof tab.title !== 'string') continue;
      if (typeof tab.formatId !== 'string') continue;
      const path = tab.path == null ? null : typeof tab.path === 'string' ? tab.path : null;
      if (tab.path != null && path == null) continue;
      const record: WorkspaceTabRecord = {
        id: tab.id,
        path,
        title: tab.title,
        formatId: tab.formatId as DocumentSession['formatId'],
        dirty: Boolean(tab.dirty),
      };
      if (isTree(tab.tree)) record.tree = tab.tree;
      if (typeof tab.sourceHash === 'string' && tab.sourceHash) record.sourceHash = tab.sourceHash;
      if (record.path == null && !record.tree) continue;
      tabs.push(record);
    }
    const activeId = typeof parsed.activeId === 'string' ? parsed.activeId : null;
    return { version: 1, activeId, tabs };
  } catch {
    return null;
  }
}

/** Prefer the snapshot tree only when the file on disk is unchanged. */
export function mergeRestoredFileTab(
  tab: WorkspaceTabRecord,
  opened: DocumentSession,
  diskHash: string,
): DocumentSession {
  const base: DocumentSession = { ...opened, id: tab.id };
  if (
    tab.dirty
    && tab.tree
    && tab.sourceHash
    && diskHash
    && tab.sourceHash === diskHash
  ) {
    return {
      ...base,
      title: tab.title || base.title,
      tree: tab.tree,
      formatId: tab.formatId,
      dirty: true,
    };
  }
  return base;
}

function untitledFromTab(tab: WorkspaceTabRecord): DocumentSession | null {
  if (tab.path != null || !tab.tree) return null;
  return {
    id: tab.id,
    path: null,
    title: tab.title || 'Untitled',
    tree: tab.tree,
    formatId: tab.formatId,
    dirty: tab.dirty,
  };
}

async function sourceHashesFor(sessions: DocumentSession[]): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  if (!isTauri()) return hashes;
  for (const session of sessions) {
    if (!session.path || !session.dirty) continue;
    try {
      hashes[session.path] = await sha256Hex(await readFileBytes(session.path));
    } catch {
      // Leave the hash out; restore will keep the on-disk copy.
    }
  }
  return hashes;
}

export async function saveWorkspaceSnapshot(): Promise<void> {
  const { sessions, activeId } = useDocumentStore.getState();
  const snapshot = buildWorkspaceSnapshot(
    sessions,
    activeId,
    await sourceHashesFor(sessions),
  );
  const json = JSON.stringify(snapshot);
  try {
    localStorage.setItem(LOCAL_KEY, json);
  } catch {
    // Quota or private mode — desktop slot below may still succeed.
  }
  try {
    await writeAppDataSlot(WORKSPACE_SLOT_KEY, json);
  } catch {
    // Best-effort.
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleWorkspaceSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveWorkspaceSnapshot();
  }, 400);
}

export async function flushWorkspaceSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await saveWorkspaceSnapshot();
}

let autosaveInstalled = false;

/** Persist the tab set whenever it changes (open, close, activate, commit). */
export function installWorkspaceAutosave(): void {
  if (autosaveInstalled) return;
  autosaveInstalled = true;
  useDocumentStore.subscribe((state, prev) => {
    if (state.sessions === prev.sessions && state.activeId === prev.activeId) return;
    scheduleWorkspaceSave();
  });
}

async function readSnapshotRaw(): Promise<string | null> {
  const fromAppData = await readAppDataSlot(WORKSPACE_SLOT_KEY);
  if (fromAppData) return fromAppData;
  try {
    return localStorage.getItem(LOCAL_KEY);
  } catch {
    return null;
  }
}

async function restoreWorkspaceIntoStore(): Promise<boolean> {
  if (useDocumentStore.getState().sessions.length > 0) return true;
  const raw = await readSnapshotRaw();
  const snapshot = raw ? parseWorkspaceSnapshot(raw) : null;
  if (!snapshot || snapshot.tabs.length === 0) return false;

  const restored: DocumentSession[] = [];
  for (const tab of snapshot.tabs) {
    if (!tab.path) {
      const untitled = untitledFromTab(tab);
      if (untitled) restored.push(untitled);
      continue;
    }
    try {
      const opened = await openDocumentFromPath(tab.path);
      let diskHash = '';
      if (tab.dirty && tab.tree && tab.sourceHash && isTauri()) {
        try {
          diskHash = await sha256Hex(await readFileBytes(tab.path));
        } catch {
          diskHash = '';
        }
      }
      restored.push(mergeRestoredFileTab(tab, opened, diskHash));
    } catch {
      // File moved or unreadable — drop that tab.
    }
  }
  if (restored.length === 0) return false;
  useDocumentStore.getState().replaceSessions(restored, snapshot.activeId);
  return true;
}

let restoreOnce: Promise<boolean> | null = null;

/** Restore the previous tab set at most once per app launch. */
export function restoreWorkspaceOnce(): Promise<boolean> {
  if (!restoreOnce) restoreOnce = restoreWorkspaceIntoStore();
  return restoreOnce;
}
