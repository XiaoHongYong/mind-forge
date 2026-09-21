import { describe, expect, it } from 'vitest';
import type { MindMapTreeNode } from '../../../types';
import {
  DRAG_THRESHOLD,
  DROP_PAD_Y,
  SIBLING_BAND,
  collectDropNodes,
  dragDelta,
  entryCentre,
  marqueeBounds,
  nodesInMarquee,
  passedDragThreshold,
  resolveDropIntent,
  subtreeIds,
  type DropNode,
  type DropTree,
  type Layout,
} from '../dragSelection';

/**
 * These pin the arithmetic that decides when a press became a drag, what it is
 * over, and what a marquee caught. All three were inline numbers in the pointer
 * handlers with nothing asserting them.
 */

const entry = (x: number, y: number, w = 80, h = 36) =>
  ({ x, y, w, h, visualTopExtra: 0, subtreeH: h, direction: 'right' as const, scale: 1, depth: 2, node: {} as MindMapTreeNode, parts: {} as never });

const layout = (entries: Record<string, ReturnType<typeof entry>>): Layout =>
  entries as unknown as Layout;

describe('dragDelta', () => {
  it('measures in map units, so a drag feels the same at any zoom', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 160, y: 140 };
    expect(dragDelta(from, to, 1)).toEqual({ x: 60, y: 40 });
    // Zoomed in 2x, the same pointer travel is half as far across the map.
    expect(dragDelta(from, to, 2)).toEqual({ x: 30, y: 20 });
  });
});

describe('passedDragThreshold', () => {
  it('ignores a wobble and accepts real movement on either axis', () => {
    expect(passedDragThreshold({ x: DRAG_THRESHOLD, y: 0 })).toBe(false);
    expect(passedDragThreshold({ x: DRAG_THRESHOLD + 0.1, y: 0 })).toBe(true);
    expect(passedDragThreshold({ x: 0, y: -(DRAG_THRESHOLD + 0.1) })).toBe(true);
  });
});

const dropNode = (over: Partial<DropNode> & Pick<DropNode, 'id'>): DropNode => ({
  x: 0,
  y: 0,
  w: 80,
  h: 40,
  parentId: 'root',
  index: 0,
  childCount: 0,
  side: 'right',
  ...over,
});

describe('resolveDropIntent', () => {
  const node = dropNode({ id: 'a', x: 100, y: 100, childCount: 2 });
  const band = node.h * SIBLING_BAND;

  it('adopts the node as a child when the pointer is in the middle', () => {
    const intent = resolveDropIntent([node], { x: 140, y: 120 }, new Set());
    expect(intent).toEqual({ kind: 'child', parentId: 'a', index: 2, anchorId: 'a' });
  });

  it('inserts a sibling above or below from the outer bands', () => {
    expect(resolveDropIntent([node], { x: 140, y: node.y + band - 1 }, new Set())?.kind).toBe('before');
    expect(resolveDropIntent([node], { x: 140, y: node.y + node.h - band + 1 }, new Set())).toMatchObject({
      kind: 'after',
      parentId: 'root',
      index: 1,
      side: 'right',
    });
  });

  it('treats the gap just above a node as insert-before', () => {
    const intent = resolveDropIntent([node], { x: 140, y: node.y - DROP_PAD_Y + 1 }, new Set());
    expect(intent?.kind).toBe('before');
    expect(intent?.index).toBe(0);
  });

  it('makes a child of the root on the side the pointer is on', () => {
    const root = dropNode({ id: 'root', parentId: null, side: null, x: 0, y: 0, w: 120, h: 48, childCount: 3 });
    expect(resolveDropIntent([root], { x: 20, y: 24 }, new Set())).toMatchObject({
      kind: 'child', parentId: 'root', index: 3, side: 'left',
    });
    expect(resolveDropIntent([root], { x: 100, y: 24 }, new Set())?.side).toBe('right');
  });

  it('skips the dragged branch and prefers the smaller node when boxes overlap', () => {
    const parent = dropNode({ id: 'parent', x: 0, y: 0, w: 200, h: 80, childCount: 1 });
    const child = dropNode({ id: 'child', x: 40, y: 20, w: 40, h: 20, parentId: 'parent', childCount: 0 });
    expect(resolveDropIntent([parent, child], { x: 50, y: 30 }, new Set(['child']))?.parentId).toBe('parent');
    expect(resolveDropIntent([parent, child], { x: 50, y: 30 }, new Set())?.anchorId).toBe('child');
  });

  it('returns null over empty space', () => {
    expect(resolveDropIntent([node], { x: 900, y: 900 }, new Set())).toBeNull();
  });
});

describe('collectDropNodes', () => {
  it('records parent, index, and which side a root child is on', () => {
    const tree: DropTree = {
      id: 'root',
      children: [
        { id: 'left', side: 'left', children: [{ id: 'leaf', children: [] }] },
        { id: 'right', children: [] },
      ],
    };
    const nodes = collectDropNodes(tree, layout({
      root: entry(0, 0),
      left: entry(0, 40),
      leaf: entry(0, 80),
      right: entry(100, 40),
    }));
    expect(nodes.map((n) => [n.id, n.parentId, n.index, n.side])).toEqual([
      ['root', null, 0, null],
      ['left', 'root', 0, 'left'],
      ['leaf', 'left', 0, null],
      ['right', 'root', 1, 'right'],
    ]);
  });
});

describe('subtreeIds', () => {
  it('lists the node and everything under it', () => {
    expect(subtreeIds({ id: 'a', children: [{ id: 'a1', children: [{ id: 'a2' }] }] }))
      .toEqual(['a', 'a1', 'a2']);
    expect(subtreeIds(null)).toEqual([]);
  });
});

describe('entryCentre', () => {
  it('is the middle of the laid-out box', () => {
    expect(entryCentre({ x: 10, y: 20, w: 80, h: 36 })).toEqual({ x: 50, y: 38 });
  });
});

describe('nodesInMarquee', () => {
  const l = layout({
    inside: entry(100, 100),  // centre (140, 118)
    outside: entry(900, 900),
    grazed: entry(180, 100),  // centre (220, 118): the box overlaps, the centre does not
  });

  it('catches a node whose centre is inside', () => {
    expect(nodesInMarquee(l, { startX: 0, startY: 0, curX: 200, curY: 200 }))
      .toEqual(new Set(['inside']));
  });

  /**
   * The decision that makes sweeping a dense branch predictable: overlapping
   * the rectangle is not enough, the centre has to be in it.
   */
  it('does not catch a node it merely grazed', () => {
    const caught = nodesInMarquee(l, { startX: 0, startY: 0, curX: 200, curY: 200 });
    expect(caught.has('grazed')).toBe(false);
  });

  it('works whichever way the rectangle was dragged out', () => {
    const forward = nodesInMarquee(l, { startX: 0, startY: 0, curX: 200, curY: 200 });
    const backward = nodesInMarquee(l, { startX: 200, startY: 200, curX: 0, curY: 0 });
    expect(backward).toEqual(forward);
  });
});

describe('marqueeBounds', () => {
  it('normalises a rectangle dragged up and to the left', () => {
    expect(marqueeBounds({ startX: 100, startY: 80, curX: 20, curY: 10 }))
      .toEqual({ x: 20, y: 10, w: 80, h: 70 });
  });
});
