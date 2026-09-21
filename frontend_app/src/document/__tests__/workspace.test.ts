import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../storage', () => ({
  isTauri: () => false,
}));

vi.mock('../io', () => ({
  openDocumentFromPath: async (path: string) => ({
    id: `opened-${path}`,
    path,
    title: 'from-disk',
    tree: { version: 'tree', root: { id: 'root', text: 'disk', children: [], collapsed: false } },
    formatId: 'mmforge',
    dirty: false,
  }),
}));

import { useDocumentStore } from '../store';
import {
  buildWorkspaceSnapshot,
  mergeRestoredFileTab,
  parseWorkspaceSnapshot,
  restoreWorkspaceOnce,
  type WorkspaceTabRecord,
} from '../workspace';
import type { DocumentSession } from '../types';

const tree = {
  version: 'tree' as const,
  root: { id: 'root', text: 'Hello', children: [], collapsed: false },
};

function session(partial: Partial<DocumentSession> & Pick<DocumentSession, 'id'>): DocumentSession {
  return {
    path: null,
    title: 'Untitled',
    tree,
    formatId: 'mmforge',
    dirty: false,
    ...partial,
  };
}

describe('workspace snapshot', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
      clear: () => { memory.clear(); },
    });
    useDocumentStore.setState({
      sessions: [],
      activeId: null,
      session: null,
      recent: [],
    });
  });

  it('keeps untitled trees and omits clean file trees', () => {
    const snapshot = buildWorkspaceSnapshot(
      [
        session({ id: 'u', title: 'Draft', dirty: false }),
        session({ id: 'f', path: '/tmp/a.mmforge', title: 'a', dirty: false }),
        session({ id: 'd', path: '/tmp/b.mmforge', title: 'b', dirty: true }),
      ],
      'd',
      { '/tmp/b.mmforge': 'abc' },
    );
    expect(snapshot.activeId).toBe('d');
    expect(snapshot.tabs[0].tree).toBeTruthy();
    expect(snapshot.tabs[1].tree).toBeUndefined();
    expect(snapshot.tabs[2].tree?.root.text).toBe('Hello');
    expect(snapshot.tabs[2].sourceHash).toBe('abc');
    expect(parseWorkspaceSnapshot(JSON.stringify(snapshot))?.tabs).toHaveLength(3);
  });

  it('applies a dirty file tree only when the disk hash still matches', () => {
    const tab: WorkspaceTabRecord = {
      id: 'keep',
      path: '/tmp/a.mmforge',
      title: 'Edited',
      formatId: 'mmforge',
      dirty: true,
      tree,
      sourceHash: 'same',
    };
    const opened = session({ id: 'other', path: '/tmp/a.mmforge', title: 'from-disk' });
    expect(mergeRestoredFileTab(tab, opened, 'same').tree.root.text).toBe('Hello');
    expect(mergeRestoredFileTab(tab, opened, 'same').dirty).toBe(true);
    expect(mergeRestoredFileTab(tab, opened, 'changed').title).toBe('from-disk');
  });

  it('restores file tabs and untitled documents into the store', async () => {
    const snapshot = buildWorkspaceSnapshot(
      [
        session({ id: 'file', path: '/tmp/map.mmforge', title: 'map', dirty: false }),
        session({ id: 'new', title: 'Scratch', dirty: true }),
      ],
      'new',
      {},
    );
    localStorage.setItem('mindforge:workspace', JSON.stringify(snapshot));

    const restored = await restoreWorkspaceOnce();
    expect(restored).toBe(true);
    const state = useDocumentStore.getState();
    expect(state.sessions.map((s) => s.id)).toEqual(['file', 'new']);
    expect(state.activeId).toBe('new');
    expect(state.sessions[0].path).toBe('/tmp/map.mmforge');
    expect(state.sessions[0].title).toBe('from-disk');
    expect(state.sessions[1].title).toBe('Scratch');
    expect(state.sessions[1].path).toBeNull();
    expect(state.sessions[1].dirty).toBe(true);
  });
});
