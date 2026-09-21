import { describe, expect, it } from 'vitest';
import type { MindMapTreeNode } from '../../../types';
import { findNode } from '../../MindMapHelpers';
import {
  clipboardPlainText,
  copyNodesToClipboard,
  nodesForClipboard,
  pasteClipboardNodes,
  readNodeClipboard,
} from '../nodeClipboard';

const node = (
  id: string,
  children: MindMapTreeNode[] = [],
  extra: Partial<MindMapTreeNode> = {},
): MindMapTreeNode => ({ id, text: id, children, ...extra });

/** root ─┬─ a ─┬─ a1
 *        │     └─ a2
 *        └─ b */
const sample = (): MindMapTreeNode =>
  node('root', [node('a', [node('a1'), node('a2')]), node('b')]);

describe('nodesForClipboard', () => {
  it('lists selected nodes in tree order and skips a child of a selected node', () => {
    const picked = nodesForClipboard(sample(), ['b', 'a', 'a1']);
    expect(picked.map((n) => n.id)).toEqual(['a', 'b']);
    expect(picked[0].children.map((n) => n.id)).toEqual(['a1', 'a2']);
  });

  it('returns detached clones', () => {
    const root = sample();
    const picked = nodesForClipboard(root, ['a']);
    picked[0].text = 'changed';
    expect(findNode(root, 'a')!.node.text).toBe('a');
  });

  it('skips ids that are not in the tree', () => {
    expect(nodesForClipboard(sample(), ['missing'])).toEqual([]);
  });
});

describe('clipboard store', () => {
  it('keeps the copied tree after the source is edited', () => {
    const source = node('a', [], { text: 'Alpha' });
    copyNodesToClipboard([source]);
    source.text = 'Beta';
    expect(readNodeClipboard()[0].text).toBe('Alpha');
    readNodeClipboard()[0].text = 'Gamma';
    expect(readNodeClipboard()[0].text).toBe('Alpha');
  });
});

describe('clipboardPlainText', () => {
  it('indents children', () => {
    expect(clipboardPlainText([node('a', [node('a1')]), node('b')])).toBe('a\n  a1\nb');
  });
});

describe('pasteClipboardNodes', () => {
  it('appends clones with new ids under the parent and opens it', () => {
    const root = sample();
    findNode(root, 'b')!.node.collapsed = true;
    const clip = nodesForClipboard(root, ['a']);
    const pasted = pasteClipboardNodes(root, 'b', clip)!;

    const parent = findNode(pasted.root, 'b')!.node;
    expect(parent.collapsed).toBe(false);
    expect(parent.children).toHaveLength(1);
    const copy = parent.children[0];
    expect(copy.id).not.toBe('a');
    expect(copy.text).toBe('a');
    expect(copy.children.map((n) => n.text)).toEqual(['a1', 'a2']);
    expect(copy.children.every((n) => n.id !== 'a1' && n.id !== 'a2')).toBe(true);
    expect(findNode(root, 'b')!.node.children).toHaveLength(0);
  });

  it('gives every paste its own ids', () => {
    const root = sample();
    const clip = nodesForClipboard(root, ['b']);
    const once = pasteClipboardNodes(root, 'a', clip)!;
    const twice = pasteClipboardNodes(once.root, 'a', clip)!;
    const children = findNode(twice.root, 'a')!.node.children;
    const copies = children.filter((n) => n.text === 'b');
    expect(copies).toHaveLength(2);
    expect(copies[0].id).not.toBe(copies[1].id);
  });

  it('drops free-drag offsets and keeps side only on a root child', () => {
    const clip = [node('a', [node('a1', [], { customX: 4 })], { customX: 8, customY: 9, side: 'left' })];
    const underRoot = pasteClipboardNodes(sample(), 'root', clip)!;
    const asRootChild = findNode(underRoot.root, underRoot.ids[0])!.node;
    expect(asRootChild.side).toBe('left');
    expect(asRootChild.customX).toBeUndefined();
    expect(asRootChild.children[0].customX).toBeUndefined();

    const nested = pasteClipboardNodes(sample(), 'b', clip)!;
    const asChild = findNode(nested.root, nested.ids[0])!.node;
    expect(asChild.side).toBeUndefined();
  });

  it('does not mutate the clipboard it was given', () => {
    const clip = [node('a', [], { customX: 3, side: 'left' })];
    const before = JSON.stringify(clip);
    pasteClipboardNodes(sample(), 'b', clip);
    expect(JSON.stringify(clip)).toBe(before);
  });

  it('returns null when there is nothing to paste or the parent is missing', () => {
    expect(pasteClipboardNodes(sample(), 'a', [])).toBeNull();
    expect(pasteClipboardNodes(sample(), 'missing', [node('a')])).toBeNull();
  });
});
