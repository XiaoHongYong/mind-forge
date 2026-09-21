import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DocumentSession, RecentFileEntry } from './types';
import {
  openDocumentFromPath,
  openDocumentViaDialog,
  restoreOrCreateNew,
  saveDocument,
  saveDocumentAs,
} from './io';
import type { MindMapTree } from '../types';
import { titleFromPath } from './types';

const MAX_RECENT = 20;

interface DocumentStore {
  session: DocumentSession | null;
  recent: RecentFileEntry[];
  setSession: (session: DocumentSession | null) => void;
  markDirty: (dirty: boolean) => void;
  updateTree: (tree: MindMapTree) => void;
  updateTitle: (title: string) => void;
  createNew: () => Promise<DocumentSession>;
  openViaDialog: () => Promise<DocumentSession | null>;
  openPath: (path: string) => Promise<DocumentSession>;
  save: (tree: MindMapTree, title: string) => Promise<DocumentSession>;
  saveAs: (tree: MindMapTree, title: string) => Promise<DocumentSession>;
  rememberPath: (path: string, title: string) => void;
  clearRecent: () => void;
}

function pushRecent(list: RecentFileEntry[], path: string, title: string): RecentFileEntry[] {
  const next: RecentFileEntry = {
    path,
    title: title || titleFromPath(path),
    openedAt: new Date().toISOString(),
  };
  return [next, ...list.filter((e) => e.path !== path)].slice(0, MAX_RECENT);
}

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      session: null,
      recent: [],

      setSession: (session) => set({ session }),

      markDirty: (dirty) => {
        const session = get().session;
        if (!session) return;
        set({ session: { ...session, dirty } });
      },

      updateTree: (tree) => {
        const session = get().session;
        if (!session) return;
        set({ session: { ...session, tree, dirty: true } });
      },

      updateTitle: (title) => {
        const session = get().session;
        if (!session) return;
        set({ session: { ...session, title, dirty: true } });
      },

      createNew: async () => {
        const session = await restoreOrCreateNew();
        set({ session });
        return session;
      },

      openViaDialog: async () => {
        const session = await openDocumentViaDialog();
        if (!session) return null;
        set((state) => ({
          session,
          recent: session.path
            ? pushRecent(state.recent, session.path, session.title)
            : state.recent,
        }));
        return session;
      },

      openPath: async (path) => {
        const session = await openDocumentFromPath(path);
        set((state) => ({
          session,
          recent: pushRecent(state.recent, path, session.title),
        }));
        return session;
      },

      save: async (tree, title) => {
        const current = get().session;
        if (!current) throw new Error('No document open');
        const saved = await saveDocument(current, tree, title);
        set((state) => ({
          session: saved,
          recent: saved.path
            ? pushRecent(state.recent, saved.path, saved.title)
            : state.recent,
        }));
        return saved;
      },

      saveAs: async (tree, title) => {
        const current = get().session;
        if (!current) throw new Error('No document open');
        const saved = await saveDocumentAs(current, tree, title);
        set((state) => ({
          session: saved,
          recent: saved.path
            ? pushRecent(state.recent, saved.path, saved.title)
            : state.recent,
        }));
        return saved;
      },

      rememberPath: (path, title) => {
        set((state) => ({ recent: pushRecent(state.recent, path, title) }));
      },

      clearRecent: () => set({ recent: [] }),
    }),
    {
      name: 'mindforge:recent-files',
      partialize: (state) => ({ recent: state.recent }),
    },
  ),
);
