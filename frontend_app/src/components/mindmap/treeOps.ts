/**
 * The tree operations.
 *
 * Every one of these takes a root and returns a *new* root, or null when the
 * operation does not apply — the node is missing, the move would go off the
 * end, the drop would put a node inside itself. Nothing here touches React,
 * so the editor's callbacks are the pure operation plus whatever selection or
 * focus should follow it.
 *
 * These are the operations that can lose a subtree, which is why they are the
 * ones with tests. Everything works on a deep clone: no caller ever sees a
 * half-applied edit, and an operation that bails out has changed nothing.
 */

import type { MindMapTreeNode, UrlEntry } from '../../types';
import { cloneTree, findNode, isDescendant, uid } from '../MindMapHelpers';
import { estimateSubtreeHeight } from '@mindforge/mindmap-core';

/** A node with every field present, so nothing downstream has to guard. */
export const createNode = (over: Partial<MindMapTreeNode> = {}): MindMapTreeNode => ({
  id: uid(),
  text: '',
  children: [],
  collapsed: false,
  notes: '',
  color: null,
  icons: [],
  checked: null,
  progress: null,
  startDate: null,
  endDate: null,
  urls: [],
  tags: [],
  ...over,
});

/**
 * A dragged node keeps its own position, and so does everything under it.
 * Inserting into such a branch has to clear those or the new node lands in
 * the middle of stale offsets — laid out by the tree, next to siblings that
 * are not.
 */
export const clearBranchCustomPositions = (node: MindMapTreeNode): void => {
  node.customX = undefined;
  node.customY = undefined;
  node.children.forEach(clearBranchCustomPositions);
};

/**
 * The shape almost every edit takes: clone, find, change the node, hand back
 * the new root. `edit` returning false means "nothing to do", and the caller
 * gets null rather than a pointless new tree.
 */
export const editNode = (
  root: MindMapTreeNode,
  nodeId: string,
  edit: (node: MindMapTreeNode) => boolean | void,
): MindMapTreeNode | null => {
  const next = cloneTree(root);
  const found = findNode(next, nodeId);
  if (!found) return null;
  return edit(found.node) === false ? null : next;
};

// ── Structure ───────────────────────────────────────────────────

export interface Insertion {
  root: MindMapTreeNode;
  /** The node that was added — the caller usually wants to select and edit it. */
  node: MindMapTreeNode;
  /** Which side of the root the insertion landed on, if it is a root child. */
  side: 'left' | 'right' | null;
}

export const addChild = (
  root: MindMapTreeNode,
  parentId: string,
  side?: 'left' | 'right',
): Insertion | null => {
  const next = cloneTree(root);
  const found = findNode(next, parentId);
  if (!found) return null;

  const resolvedSide: 'left' | 'right' | null =
    parentId === 'root' ? (side ?? 'right') : null;
  const node = createNode(resolvedSide ? { side: resolvedSide } : {});
  found.node.children.push(node);
  // A node added to a collapsed parent would otherwise be invisible.
  found.node.collapsed = false;
  clearBranchCustomPositions(found.node);

  return { root: next, node, side: resolvedSide };
};

export const addSibling = (root: MindMapTreeNode, nodeId: string): Insertion | null => {
  if (nodeId === 'root') return null;
  const next = cloneTree(root);
  const found = findNode(next, nodeId);
  if (!found || !found.parent) return null;

  const node = createNode();
  found.parent.children.splice(found.index + 1, 0, node);
  clearBranchCustomPositions(found.parent);

  return {
    root: next,
    node,
    side: found.parent.id === 'root' ? (found.node.side === 'left' ? 'left' : 'right') : null,
  };
};

export interface Removal {
  root: MindMapTreeNode;
  /** What to select once the node is gone. */
  parentId: string;
}

export const removeNode = (root: MindMapTreeNode, nodeId: string): Removal | null => {
  if (nodeId === 'root') return null;
  const next = cloneTree(root);
  const found = findNode(next, nodeId);
  if (!found || !found.parent) return null;
  found.parent.children.splice(found.index, 1);
  return { root: next, parentId: found.parent.id };
};

/** Swap a node with the sibling above or below it. */
export const moveSibling = (
  root: MindMapTreeNode,
  nodeId: string,
  direction: 'up' | 'down',
): MindMapTreeNode | null => {
  if (nodeId === 'root') return null;
  const next = cloneTree(root);
  const found = findNode(next, nodeId);
  if (!found || !found.parent) return null;

  const siblings = found.parent.children;
  const targetIdx = direction === 'up' ? found.index - 1 : found.index + 1;
  if (targetIdx < 0 || targetIdx >= siblings.length) return null;

  [siblings[found.index], siblings[targetIdx]] = [siblings[targetIdx], siblings[found.index]];
  return next;
};

/**
 * Move a node under a new parent, optionally at a child index (omit to append).
 *
 * Refuses to drop a node into its own subtree: that would splice the node out
 * of the tree and then push it into a branch that is no longer reachable from
 * the root, silently deleting it and everything under it.
 *
 * The moved subtree and both parents it touched have their free-drag offsets
 * cleared, so the layout places them again instead of leaving a hole.
 */
export const reparentNode = (
  root: MindMapTreeNode,
  nodeId: string,
  newParentId: string,
  side?: 'left' | 'right',
  /** Index among the new parent's children. Omit to append. */
  index?: number,
): MindMapTreeNode | null => {
  if (nodeId === 'root' || nodeId === newParentId) return null;
  if (isDescendant(root, nodeId, newParentId)) return null;

  const next = cloneTree(root);
  const found = findNode(next, nodeId);
  if (!found || !found.parent) return null;
  const target = findNode(next, newParentId);
  if (!target) return null;

  const oldParent = found.parent;
  const [removed] = oldParent.children.splice(found.index, 1);
  // The branch is going back under automatic layout, including anything that
  // was free-dragged beneath the moved node.
  clearBranchCustomPositions(removed);
  // `side` only applies to root children; drop a stale value when nesting deeper.
  if (newParentId === 'root') removed.side = side ?? 'right';
  else delete removed.side;

  let insertAt = index ?? target.node.children.length;
  // The node was removed first. An index that counted it has to step back.
  if (oldParent.id === target.node.id && found.index < insertAt) insertAt -= 1;
  insertAt = Math.max(0, Math.min(insertAt, target.node.children.length));
  target.node.children.splice(insertAt, 0, removed);
  target.node.collapsed = false;

  // Both branches the move disturbed: the gap that closed, and the slot that
  // opened. A parent that is the root realigns the whole map, because every
  // topic hangs off it.
  clearBranchCustomPositions(oldParent);
  if (oldParent.id !== target.node.id) clearBranchCustomPositions(target.node);
  return next;
};

/**
 * A copy of a node and everything under it, with fresh ids throughout.
 *
 * Ids only — attachments are the caller's problem, because copying the stored
 * files is asynchronous and can fail. Reassigning node ids while leaving
 * attachment ids alone would leave two nodes pointing at one stored file, and
 * deleting either node's file would then break the other.
 */
export const cloneSubtreeWithNewIds = (node: MindMapTreeNode): MindMapTreeNode => {
  const clone = cloneTree(node);
  const reassign = (n: MindMapTreeNode) => {
    n.id = uid();
    n.children.forEach(reassign);
  };
  reassign(clone);
  return clone;
};

/** Put an already-built node in directly after `nodeId`, among its siblings. */
export const insertAfter = (
  root: MindMapTreeNode,
  nodeId: string,
  node: MindMapTreeNode,
): MindMapTreeNode | null => {
  const next = cloneTree(root);
  const found = findNode(next, nodeId);
  if (!found || !found.parent) return null;
  found.parent.children.splice(found.index + 1, 0, node);
  return next;
};

/** Every node carrying at least one attachment, itself included. */
export const nodesWithAttachments = (node: MindMapTreeNode): MindMapTreeNode[] => {
  const out: MindMapTreeNode[] = [];
  const walk = (n: MindMapTreeNode) => {
    if ((n.attachments ?? []).length > 0) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
};

/**
 * The same edit applied to several nodes in one pass, for the multi-select
 * actions. One clone for the whole batch, and ids that are no longer in the
 * tree are skipped rather than aborting the rest.
 */
export const editNodes = (
  root: MindMapTreeNode,
  nodeIds: Iterable<string>,
  edit: (node: MindMapTreeNode) => void,
): MindMapTreeNode => {
  const next = cloneTree(root);
  for (const id of nodeIds) {
    const found = findNode(next, id);
    if (found) edit(found.node);
  }
  return next;
};

/**
 * Remove several nodes at once. The root is never removed, and `parentId` is
 * the parent of the last node actually taken out — what the caller should
 * select once the selection it had is gone.
 */
export const removeNodes = (root: MindMapTreeNode, nodeIds: Iterable<string>): Removal | null => {
  const ids = new Set(nodeIds);
  ids.delete('root');
  if (ids.size === 0) return null;

  const next = cloneTree(root);
  let parentId = 'root';
  for (const id of ids) {
    // A node already gone because an ancestor of it was removed first is not
    // an error — it went where it was always going.
    const found = findNode(next, id);
    if (!found?.parent) continue;
    parentId = found.parent.id;
    found.parent.children.splice(found.index, 1);
  }
  return { root: next, parentId };
};

// ── Root layout mode ────────────────────────────────────────────

/** How root children fan out: all to the right, or balanced left/right. */
export type RootLayoutMode = 'tree' | 'map';

/**
 * Clockwise reading order around the root: right top→bottom, then left
 * bottom→top. Left children are stored top→bottom in the tree, so reverse them.
 */
export const clockwiseRootSequence = (root: MindMapTreeNode): MindMapTreeNode[] => {
  const rights = root.children.filter((child) => child.side !== 'left');
  const lefts = root.children.filter((child) => child.side === 'left');
  return [...rights, ...lefts.slice().reverse()];
};

/**
 * Assign root children clockwise by expanded subtree height: compute every
 * child's height first, then pick the split that keeps left and right as even
 * as possible. Topics after the cut continue on the left from bottom toward top.
 */
export const applyClockwiseMapLayout = (root: MindMapTreeNode): MindMapTreeNode => {
  const next = cloneTree(root);
  const sequence = clockwiseRootSequence(next);
  if (sequence.length === 0) return next;

  const heights = sequence.map((child) => estimateSubtreeHeight(child, 1));
  const totalH = heights.reduce((sum, h) => sum + h, 0);

  // rightCount in 1..n: how many leading topics stay on the right.
  // Prefer the cut whose |right − left| is smallest; on a tie, keep more on
  // the right so the clockwise arc still starts there.
  let bestRightCount = sequence.length;
  let bestDiff = totalH;
  let cum = 0;
  for (let rightCount = 1; rightCount <= sequence.length; rightCount++) {
    cum += heights[rightCount - 1];
    const diff = Math.abs(cum - (totalH - cum));
    if (diff < bestDiff || (diff === bestDiff && rightCount > bestRightCount)) {
      bestDiff = diff;
      bestRightCount = rightCount;
    }
  }

  const rights = sequence.slice(0, bestRightCount);
  const leftsClockwise = sequence.slice(bestRightCount);
  for (const child of rights) child.side = 'right';
  for (const child of leftsClockwise) child.side = 'left';

  // leftsClockwise is bottom→top; the tree lays left children out top→bottom.
  const lefts = leftsClockwise.slice().reverse();
  next.children = [...rights, ...lefts];
  return next;
};

/**
 * Which side a new root child should start on before a full clockwise rebalance.
 * Kept for callers that only need a hint; map mode prefers `applyClockwiseMapLayout`.
 */
export const pickBalancedSide = (root: MindMapTreeNode): 'left' | 'right' => {
  const rights = root.children.filter((child) => child.side !== 'left');
  const lefts = root.children.filter((child) => child.side === 'left');
  const rightH = rights.reduce((sum, child) => sum + estimateSubtreeHeight(child, 1), 0);
  const leftH = lefts.reduce((sum, child) => sum + estimateSubtreeHeight(child, 1), 0);
  // Empty leaf at depth 1 — same size class as other root children.
  const newH = estimateSubtreeHeight(createNode({ text: ' ' }), 1);
  const half = (rightH + leftH + newH) / 2;
  return rightH < half ? 'right' : 'left';
};

/**
 * Rewrite root children's `side` for the chosen layout, and clear free-drag
 * offsets so the automatic layout can take over.
 */
export const applyRootLayoutMode = (
  root: MindMapTreeNode,
  mode: RootLayoutMode,
): MindMapTreeNode => {
  const next = cloneTree(root);
  clearBranchCustomPositions(next);

  if (mode === 'tree') {
    for (const child of next.children) child.side = 'right';
    return next;
  }

  return applyClockwiseMapLayout(next);
};

/** Infer map vs tree from an explicit view_state value, else from existing sides. */
export const inferRootLayoutMode = (
  root: MindMapTreeNode,
  saved?: RootLayoutMode | null,
): RootLayoutMode => {
  if (saved === 'map' || saved === 'tree') return saved;
  return root.children.some((child) => child.side === 'left') ? 'map' : 'tree';
};

// ── Positions ───────────────────────────────────────────────────

/**
 * Hand a branch back to the layout. `nodeId` of null does the whole tree; a
 * node id does that node and everything under it.
 */
export const resetPositions = (
  root: MindMapTreeNode,
  nodeId: string | null,
): MindMapTreeNode | null => {
  const next = cloneTree(root);
  if (nodeId === null || nodeId === 'root') {
    clearBranchCustomPositions(next);
    return next;
  }
  const found = findNode(next, nodeId);
  if (!found) return null;
  clearBranchCustomPositions(found.node);
  return next;
};

// ── Field edits ─────────────────────────────────────────────────

/** The next value round a cycle, starting over from whatever is unrecognised. */
export const nextInCycle = <T,>(cycle: T[], current: T): T =>
  cycle[(cycle.indexOf(current) + 1) % cycle.length];

/** null → unchecked → checked → unchecked. Once a node has a box it keeps it. */
export const toggleChecked = (checked: boolean | null | undefined): boolean =>
  checked === false ? true : false;

/** Toggling an icon that is already on removes it; null clears them all. */
export const toggleIcon = (icons: string[] | undefined, iconName: string | null): string[] => {
  if (iconName === null) return [];
  const next = [...(icons ?? [])];
  const idx = next.indexOf(iconName);
  if (idx >= 0) next.splice(idx, 1);
  else next.push(iconName);
  return next;
};

export const addUrl = (urls: UrlEntry[] | undefined, entry: UrlEntry): UrlEntry[] =>
  [...(urls ?? []), entry];

export const removeUrl = (urls: UrlEntry[] | undefined, index: number): UrlEntry[] => {
  const next = [...(urls ?? [])];
  next.splice(index, 1);
  return next;
};
