import { describe, expect, it } from 'vitest';
import type { MindMapTreeNode } from '../../types';
import { mmforgeToTree, treeToMmforge } from '../mmforgeFormat';

function node(partial: Partial<MindMapTreeNode> & { id: string; text: string }): MindMapTreeNode {
  return {
    notes: '',
    collapsed: false,
    color: null,
    icons: [],
    checked: null,
    progress: null,
    startDate: null,
    endDate: null,
    urls: [],
    children: [],
    ...partial,
  };
}

describe('treeToMmforge', () => {
  it('omits optional fields that have no value', () => {
    const json = treeToMmforge(node({ id: 'root', text: 'Topic' }));
    const saved = JSON.parse(json) as { root: Record<string, unknown> };
    expect(saved.root).toEqual({ id: 'root', text: 'Topic' });
  });

  it('omits empty children, attachments, and tags', () => {
    const json = treeToMmforge(node({
      id: 'root',
      text: 'Topic',
      attachments: [],
      tags: [],
      children: [node({ id: 'leaf', text: 'Leaf', attachments: [], tags: [] })],
    }));
    const saved = JSON.parse(json) as { root: Record<string, unknown> };
    expect(saved.root.children).toEqual([{ id: 'leaf', text: 'Leaf' }]);
    expect(JSON.stringify(saved.root)).not.toContain('attachments');
    expect(JSON.stringify(saved.root)).not.toContain('tags');
  });

  it('keeps set values, including an unchecked box and zero progress', () => {
    const json = treeToMmforge(node({
      id: 'root',
      text: 'Topic',
      notes: 'hello',
      collapsed: true,
      color: '#ef4444',
      icons: ['Target'],
      checked: false,
      progress: 0,
      startDate: '2026-05-01T09:00',
      endDate: '2026-05-18T18:00',
      urls: [{ label: 'Docs', url: 'https://example.com' }],
    }));
    const saved = JSON.parse(json) as { root: Record<string, unknown> };
    expect(saved.root).toMatchObject({
      notes: 'hello',
      collapsed: true,
      color: '#ef4444',
      icons: ['Target'],
      checked: false,
      progress: 0,
      startDate: '2026-05-01T09:00',
      endDate: '2026-05-18T18:00',
      urls: [{ label: 'Docs', url: 'https://example.com' }],
    });
  });

  it('still reads a file that omitted the empty fields', () => {
    const json = treeToMmforge(node({
      id: 'root',
      text: 'Topic',
      children: [node({ id: 'child', text: 'Child', notes: 'kept' })],
    }));
    const back = mmforgeToTree(json, 'Topic');
    expect(back.notes).toBeUndefined();
    expect(back.children[0].notes).toBe('kept');
    expect(back.children[0].text).toBe('Child');
    expect(back.children[0].children).toEqual([]);
  });
});
