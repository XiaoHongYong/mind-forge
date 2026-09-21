import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../io', () => ({
  newDocument: () => ({
    id: 'new-1',
    path: null,
    title: 'Untitled',
    tree: { version: 'tree', root: { id: 'root', text: 'Untitled', children: [], collapsed: false } },
    formatId: 'mmforge',
    dirty: false,
  }),
  restoreOrCreateNew: async () => ({
    id: 'restored-1',
    path: null,
    title: 'Untitled',
    tree: { version: 'tree', root: { id: 'root', text: 'Untitled', children: [], collapsed: false } },
    formatId: 'mmforge',
    dirty: false,
  }),
  openDocumentFromPath: async (path: string) => ({
    id: `open-${path}`,
    path,
    title: path.split('/').pop() ?? path,
    tree: { version: 'tree', root: { id: 'root', text: 'T', children: [], collapsed: false } },
    formatId: 'mmforge',
    dirty: false,
  }),
  openDocumentViaDialog: async () => null,
  saveDocument: async (session: { id: string }) => ({ ...session, dirty: false }),
  saveDocumentAs: async (session: { id: string }) => ({ ...session, dirty: false }),
}));

import { useDocumentStore } from '../store';

describe('document store tabs', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      sessions: [],
      activeId: null,
      session: null,
      recent: [],
    });
  });

  it('createNew appends a tab when sessions already exist', async () => {
    useDocumentStore.setState({
      sessions: [{
        id: 'a',
        path: '/tmp/a.mmforge',
        title: 'a',
        tree: { version: 'tree', root: { id: 'root', text: 'a', children: [], collapsed: false } },
        formatId: 'mmforge',
        dirty: false,
      }],
      activeId: 'a',
      session: null,
    });
    // Re-sync session convenience field
    useDocumentStore.setState((s) => ({
      session: s.sessions.find((x) => x.id === s.activeId) ?? null,
    }));

    await useDocumentStore.getState().createNew();
    const state = useDocumentStore.getState();
    expect(state.sessions).toHaveLength(2);
    expect(state.activeId).toBe('new-1');
    expect(state.session?.id).toBe('new-1');
  });

  it('openPath reuses an existing tab for the same path', async () => {
    const existing = {
      id: 'existing',
      path: '/tmp/map.mmforge',
      title: 'map',
      tree: { version: 'tree' as const, root: { id: 'root', text: 'map', children: [], collapsed: false } },
      formatId: 'mmforge' as const,
      dirty: false,
    };
    useDocumentStore.setState({
      sessions: [
        existing,
        {
          id: 'other',
          path: null,
          title: 'Untitled',
          tree: { version: 'tree', root: { id: 'root', text: 'U', children: [], collapsed: false } },
          formatId: 'mmforge',
          dirty: false,
        },
      ],
      activeId: 'other',
      session: null,
    });
    useDocumentStore.setState((s) => ({
      session: s.sessions.find((x) => x.id === s.activeId) ?? null,
    }));

    const opened = await useDocumentStore.getState().openPath('/tmp/map.mmforge');
    expect(opened.id).toBe('existing');
    expect(useDocumentStore.getState().sessions).toHaveLength(2);
    expect(useDocumentStore.getState().activeId).toBe('existing');
  });

  it('closeSession activates a neighbor and clears when empty', () => {
    useDocumentStore.setState({
      sessions: [
        {
          id: 'a',
          path: null,
          title: 'A',
          tree: { version: 'tree', root: { id: 'root', text: 'A', children: [], collapsed: false } },
          formatId: 'mmforge',
          dirty: false,
        },
        {
          id: 'b',
          path: null,
          title: 'B',
          tree: { version: 'tree', root: { id: 'root', text: 'B', children: [], collapsed: false } },
          formatId: 'mmforge',
          dirty: false,
        },
      ],
      activeId: 'a',
      session: null,
    });
    useDocumentStore.setState((s) => ({
      session: s.sessions.find((x) => x.id === s.activeId) ?? null,
    }));

    const next = useDocumentStore.getState().closeSession('a');
    expect(next?.id).toBe('b');
    expect(useDocumentStore.getState().sessions).toHaveLength(1);

    const empty = useDocumentStore.getState().closeSession('b');
    expect(empty).toBeNull();
    expect(useDocumentStore.getState().sessions).toHaveLength(0);
  });

  it('removeRecent drops one path and leaves the rest', () => {
    useDocumentStore.setState({
      recent: [
        { path: '/tmp/a.mmforge', title: 'A', openedAt: '2020-01-02T00:00:00.000Z' },
        { path: '/tmp/b.mmforge', title: 'B', openedAt: '2020-01-01T00:00:00.000Z' },
      ],
    });
    useDocumentStore.getState().removeRecent('/tmp/a.mmforge');
    expect(useDocumentStore.getState().recent.map((entry) => entry.path)).toEqual(['/tmp/b.mmforge']);
  });
});
