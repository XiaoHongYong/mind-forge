import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DocumentSession, RecentFileEntry } from './types';
import {
  newDocument,
  openDocumentFromPath,
  openDocumentViaDialog,
  restoreOrCreateNew,
  saveDocument,
  saveDocumentAs,
} from './io';
import type { MindMapTree } from '../types';
import { titleFromPath } from './types';

const MAX_RECENT = 20;

export interface ActiveCommit {
  tree?: MindMapTree;
  title?: string;
  dirty?: boolean;
}

interface DocumentStore {
  /** Open buffers in tab order. */
  sessions: DocumentSession[];
  activeId: string | null;
  /** Convenience: the active session (or null). Kept in sync with sessions/activeId. */
  session: DocumentSession | null;
  recent: RecentFileEntry[];

  /** Replace the entire open set (bootstrap / clear). */
  setSession: (session: DocumentSession | null) => void;
  /** Replace every open tab (workspace restore). */
  replaceSessions: (sessions: DocumentSession[], activeId: string | null) => void;
  /** Write tree/title/dirty back into the active buffer without remounting. */
  commitActive: (patch: ActiveCommit) => void;
  activate: (id: string) => void;
  /** Remove a tab. Returns the next active session (or null if none left). */
  closeSession: (id: string) => DocumentSession | null;

  markDirty: (dirty: boolean) => void;
  updateTree: (tree: MindMapTree) => void;
  updateTitle: (title: string) => void;

  /** Open a new untitled buffer as a tab (does not replace existing tabs). */
  createNew: () => Promise<DocumentSession>;
  /** Open via dialog; reuses an existing tab when the same path is already open. */
  openViaDialog: () => Promise<DocumentSession | null>;
  openPath: (path: string) => Promise<DocumentSession>;
  save: (tree: MindMapTree, title: string) => Promise<DocumentSession>;
  saveAs: (tree: MindMapTree, title: string) => Promise<DocumentSession>;
  rememberPath: (path: string, title: string) => void;
  /** Drop one path from the recent list. Does not close an open tab. */
  removeRecent: (path: string) => void;
  clearRecent: () => void;
}

function pushRecent(
  list: RecentFileEntry[],
  path: string,
  title: string,
  opts?: { touchModified?: boolean },
): RecentFileEntry[] {
  const now = new Date().toISOString();
  const prev = list.find((entry) => entry.path === path);
  const touchModified = opts?.touchModified === true;
  const next: RecentFileEntry = {
    path,
    title: title || titleFromPath(path),
    openedAt: now,
    // Open/reopen only moves the entry to the top. Preserve the last save
    // time so the sidebar “修改” label does not jump on a click.
    modifiedAt: touchModified
      ? now
      : (prev?.modifiedAt ?? prev?.openedAt ?? now),
  };
  return [next, ...list.filter((e) => e.path !== path)].slice(0, MAX_RECENT);
}

function withActive(
  sessions: DocumentSession[],
  activeId: string | null,
): Pick<DocumentStore, 'sessions' | 'activeId' | 'session'> {
  const session = activeId
    ? sessions.find((s) => s.id === activeId) ?? null
    : null;
  return {
    sessions,
    activeId: session ? activeId : null,
    session,
  };
}

function upsertSession(
  sessions: DocumentSession[],
  next: DocumentSession,
): Pick<DocumentStore, 'sessions' | 'activeId' | 'session'> {
  if (next.path) {
    const existing = sessions.find((s) => s.path === next.path);
    if (existing) {
      const merged = { ...existing, ...next, id: existing.id };
      const updated = sessions.map((s) => (s.id === existing.id ? merged : s));
      return withActive(updated, existing.id);
    }
  }
  return withActive([...sessions, next], next.id);
}

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      session: null,
      recent: [],

      setSession: (session) => {
        if (!session) {
          set({ sessions: [], activeId: null, session: null });
          return;
        }
        set(withActive([session], session.id));
      },

      replaceSessions: (sessions, activeId) => {
        const fallback = sessions[0]?.id ?? null;
        const nextActive = activeId && sessions.some((s) => s.id === activeId)
          ? activeId
          : fallback;
        set(withActive(sessions, nextActive));
      },

      commitActive: (patch) => {
        const { activeId, sessions } = get();
        if (!activeId) return;
        const updated = sessions.map((s) =>
          s.id === activeId ? { ...s, ...patch } : s,
        );
        set(withActive(updated, activeId));
      },

      activate: (id) => {
        const { sessions } = get();
        if (!sessions.some((s) => s.id === id)) return;
        set(withActive(sessions, id));
      },

      closeSession: (id) => {
        const { sessions, activeId } = get();
        const index = sessions.findIndex((s) => s.id === id);
        if (index < 0) return get().session;
        const nextSessions = sessions.filter((s) => s.id !== id);
        if (nextSessions.length === 0) {
          set({ sessions: [], activeId: null, session: null });
          return null;
        }
        let nextActive = activeId;
        if (activeId === id) {
          const neighbor = nextSessions[Math.min(index, nextSessions.length - 1)];
          nextActive = neighbor.id;
        }
        const state = withActive(nextSessions, nextActive);
        set(state);
        return state.session;
      },

      markDirty: (dirty) => {
        get().commitActive({ dirty });
      },

      updateTree: (tree) => {
        get().commitActive({ tree, dirty: true });
      },

      updateTitle: (title) => {
        get().commitActive({ title, dirty: true });
      },

      createNew: async () => {
        // Only restore untitled backup when there are no open tabs yet,
        // so opening "New" while editing does not steal a crash-recovery slot.
        const session = get().sessions.length === 0
          ? await restoreOrCreateNew()
          : newDocument();
        set((state) => upsertSession(state.sessions, session));
        return get().session!;
      },

      openViaDialog: async () => {
        const session = await openDocumentViaDialog();
        if (!session) return null;
        set((state) => ({
          ...upsertSession(state.sessions, session),
          recent: session.path
            ? pushRecent(state.recent, session.path, session.title)
            : state.recent,
        }));
        return get().session!;
      },

      openPath: async (path) => {
        const existing = get().sessions.find((s) => s.path === path);
        if (existing) {
          set(withActive(get().sessions, existing.id));
          set((state) => ({
            recent: pushRecent(state.recent, path, existing.title),
          }));
          return existing;
        }
        const session = await openDocumentFromPath(path);
        set((state) => ({
          ...upsertSession(state.sessions, session),
          recent: pushRecent(state.recent, path, session.title),
        }));
        return get().session!;
      },

      save: async (tree, title) => {
        const current = get().session;
        if (!current) throw new Error('No document open');
        const saved = await saveDocument(current, tree, title);
        set((state) => {
          const updated = state.sessions.map((s) =>
            s.id === saved.id ? saved : s,
          );
          return {
            ...withActive(updated, saved.id),
            recent: saved.path
              ? pushRecent(state.recent, saved.path, saved.title, { touchModified: true })
              : state.recent,
          };
        });
        return saved;
      },

      saveAs: async (tree, title) => {
        const current = get().session;
        if (!current) throw new Error('No document open');
        const saved = await saveDocumentAs(current, tree, title);
        set((state) => {
          // If Save As landed on a path already open in another tab, close the duplicate.
          const withoutDup = state.sessions.filter(
            (s) => s.id === saved.id || !saved.path || s.path !== saved.path,
          );
          const updated = withoutDup.map((s) =>
            s.id === saved.id ? saved : s,
          );
          return {
            ...withActive(updated, saved.id),
            recent: saved.path
              ? pushRecent(state.recent, saved.path, saved.title, { touchModified: true })
              : state.recent,
          };
        });
        return saved;
      },

      rememberPath: (path, title) => {
        set((state) => ({ recent: pushRecent(state.recent, path, title, { touchModified: true }) }));
      },

      removeRecent: (path) => {
        set((state) => ({ recent: state.recent.filter((entry) => entry.path !== path) }));
      },

      clearRecent: () => set({ recent: [] }),
    }),
    {
      name: 'mindforge:recent-files',
      partialize: (state) => ({ recent: state.recent }),
    },
  ),
);
