/**
 * The geometry behind dragging a node and sweeping a selection.
 *
 * The state these serve — which node is selected, which are multi-selected,
 * what is mid-drag — stays in the editor, because it is read from ninety-odd
 * places and moving `useState` to another file would not make any of them
 * simpler. What comes out here is the arithmetic: the thresholds and hit tests
 * that decide when a drag has started, what it is over, and what a marquee
 * caught. Those were inline numbers nothing pinned.
 */

import type { LayoutEntry } from '@mindforge/mindmap-core';
import type { MindMapTreeNode } from '../../types';

export type Layout = Record<string, LayoutEntry<MindMapTreeNode>>;

/**
 * How far the pointer travels before a press becomes a drag, in map units.
 * Without it, a click that wobbles by a pixel moves the node.
 */
export const DRAG_THRESHOLD = 4;

/**
 * Extra hit area around a node, in map units. The vertical pad covers the gap
 * between siblings, so a pointer resting between two topics still picks one.
 */
export const DROP_PAD_X = 20;
export const DROP_PAD_Y = 12;

/**
 * Fraction of a node's height, at the top and at the bottom, that inserts the
 * dragged node as a sibling. The middle band makes it a child — the same
 * split XMind uses when a topic is dragged over another.
 */
export const SIBLING_BAND = 0.28;

export interface Point {
  x: number;
  y: number;
}

/** The centre of a laid-out node. */
export const entryCentre = (entry: { x: number; y: number; w: number; h: number }): Point => ({
  x: entry.x + entry.w / 2,
  y: entry.y + entry.h / 2,
});

/**
 * How far the pointer has moved since the drag began, in map units rather than
 * screen pixels — so a drag feels the same at any zoom.
 */
export const dragDelta = (
  from: Point,
  to: Point,
  zoom: number,
): Point => ({ x: (to.x - from.x) / zoom, y: (to.y - from.y) / zoom });

/** Whether the pointer has moved far enough for this to be a drag at all. */
export const passedDragThreshold = (delta: Point): boolean =>
  Math.abs(delta.x) > DRAG_THRESHOLD || Math.abs(delta.y) > DRAG_THRESHOLD;

/** A node the drop hit-test can see: its box, plus where it sits in the tree. */
export interface DropNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  parentId: string | null;
  /** Index among the parent's children. */
  index: number;
  childCount: number;
  /** Set for children of the root; null everywhere else. */
  side: 'left' | 'right' | null;
}

/**
 * Where a dragged node would land.
 *
 * `child` appends it under `parentId`. `before` / `after` insert it next to
 * `anchorId`, which is how a topic is ordered among siblings.
 */
export interface DropIntent {
  kind: 'child' | 'before' | 'after';
  parentId: string;
  index: number;
  anchorId: string;
  side?: 'left' | 'right';
}

export interface DropTree {
  id: string;
  children: DropTree[];
  side?: 'left' | 'right';
}

export interface Subtree {
  id: string;
  children?: readonly Subtree[];
}

/** Every id in a subtree, the node itself first. */
export const subtreeIds = (node: Subtree | null | undefined): string[] => {
  if (!node) return [];
  const ids = [node.id];
  for (const child of node.children ?? []) ids.push(...subtreeIds(child));
  return ids;
};

/** Flatten a tree against the current layout. Nodes the layout skipped are omitted. */
export const collectDropNodes = (root: DropTree, layout: Layout): DropNode[] => {
  const out: DropNode[] = [];
  const walk = (node: DropTree, parentId: string | null, index: number) => {
    const box = layout[node.id];
    if (box) {
      out.push({
        id: node.id,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        parentId,
        index,
        childCount: node.children.length,
        side: parentId === 'root' ? (node.side === 'left' ? 'left' : 'right') : null,
      });
    }
    node.children.forEach((child, childIndex) => walk(child, node.id, childIndex));
  };
  walk(root, null, 0);
  return out;
};

const hitContains = (node: DropNode, pointer: Point): boolean =>
  pointer.x >= node.x - DROP_PAD_X
  && pointer.x <= node.x + node.w + DROP_PAD_X
  && pointer.y >= node.y - DROP_PAD_Y
  && pointer.y <= node.y + node.h + DROP_PAD_Y;

/**
 * Which structural slot the pointer is over, or null when it is over empty map.
 *
 * `forbidden` is the dragged node and everything under it: dropping there would
 * put a branch inside itself. The root has no siblings, so a hit on it is
 * always "become a child", and the side follows which half of the root the
 * pointer is in. Anywhere else, the top and bottom bands insert a sibling and
 * the middle band adopts the node as a child.
 */
export const resolveDropIntent = (
  nodes: readonly DropNode[],
  pointer: Point,
  forbidden: ReadonlySet<string>,
): DropIntent | null => {
  let best: DropNode | null = null;
  let bestArea = Infinity;
  let bestDist = Infinity;
  for (const node of nodes) {
    if (forbidden.has(node.id)) continue;
    if (!hitContains(node, pointer)) continue;
    const area = node.w * node.h;
    const dist = Math.abs(pointer.y - (node.y + node.h / 2));
    if (area < bestArea - 0.5 || (Math.abs(area - bestArea) <= 0.5 && dist < bestDist)) {
      best = node;
      bestArea = area;
      bestDist = dist;
    }
  }
  if (!best) return null;

  if (best.parentId === null) {
    const centreX = best.x + best.w / 2;
    return {
      kind: 'child',
      parentId: best.id,
      index: best.childCount,
      anchorId: best.id,
      side: pointer.x < centreX ? 'left' : 'right',
    };
  }

  const band = Math.min(best.h * SIBLING_BAND, best.h * 0.45);
  let kind: DropIntent['kind'] = 'child';
  if (pointer.y < best.y + band) kind = 'before';
  else if (pointer.y > best.y + best.h - band) kind = 'after';

  if (kind === 'child') {
    return {
      kind: 'child',
      parentId: best.id,
      index: best.childCount,
      anchorId: best.id,
    };
  }

  return {
    kind,
    parentId: best.parentId,
    index: kind === 'before' ? best.index : best.index + 1,
    anchorId: best.id,
    side: best.side ?? undefined,
  };
};

export const sameDropIntent = (a: DropIntent | null, b: DropIntent | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind
    && a.parentId === b.parentId
    && a.index === b.index
    && a.anchorId === b.anchorId
    && a.side === b.side;
};

export interface Marquee {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

/** A marquee as a rectangle, however it was dragged out. */
export const marqueeBounds = (marquee: Marquee) => ({
  x: Math.min(marquee.startX, marquee.curX),
  y: Math.min(marquee.startY, marquee.curY),
  w: Math.abs(marquee.curX - marquee.startX),
  h: Math.abs(marquee.curY - marquee.startY),
});

/**
 * The nodes a marquee caught.
 *
 * A node is caught when its *centre* falls inside — not when it overlaps. So
 * a rectangle drawn across the edge of a wide node does not select it, which
 * is what makes sweeping through a dense branch predictable rather than
 * catching every node the sweep grazed.
 */
export const nodesInMarquee = (layout: Layout, marquee: Marquee): Set<string> => {
  const { x, y, w, h } = marqueeBounds(marquee);
  const caught = new Set<string>();
  for (const [id, entry] of Object.entries(layout)) {
    const centre = entryCentre(entry);
    if (centre.x >= x && centre.x <= x + w && centre.y >= y && centre.y <= y + h) caught.add(id);
  }
  return caught;
};
