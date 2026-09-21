/**
 * Copy, cut, and paste for topic subtrees.
 *
 * The system clipboard only carries plain text (so a paste into another app
 * still reads as an outline). The structure that paste puts back into the map
 * lives here, in memory: a later edit of the live tree must not change what
 * was copied, and each paste gets its own ids.
 */

import type { MindMapTreeNode } from '../../types';
import { cloneTree, findNode } from '../MindMapHelpers';
import { clearBranchCustomPositions, cloneSubtreeWithNewIds } from './treeOps';

let slots: MindMapTreeNode[] = [];
let clipboardGesture = false;

/**
 * A keydown and the copy/cut/paste event it causes are one gesture. The second
 * caller in the same turn is ignored; the flag drops before the next gesture.
 */
export function guardClipboardGesture(run: () => void): void {
  if (clipboardGesture) return;
  clipboardGesture = true;
  try {
    run();
  } finally {
    queueMicrotask(() => { clipboardGesture = false; });
  }
}

export function hasNodeClipboard(): boolean {
  return slots.length > 0;
}

/** Remember a detached copy. Later edits of `nodes` do not change the clipboard. */
export function copyNodesToClipboard(nodes: MindMapTreeNode[]): void {
  slots = nodes.map((node) => cloneTree(node));
}

/** A detached copy of whatever was stored, so a caller can mutate the result. */
export function readNodeClipboard(): MindMapTreeNode[] {
  return slots.map((node) => cloneTree(node));
}

/**
 * Selected nodes in tree order. A node already inside another selected node is
 * left out — it travels with that ancestor, and listing it again would paste
 * the same subtree twice.
 */
export function nodesForClipboard(root: MindMapTreeNode, selectedIds: Iterable<string>): MindMapTreeNode[] {
  const ids = new Set(selectedIds);
  const out: MindMapTreeNode[] = [];
  const walk = (node: MindMapTreeNode, underSelected: boolean) => {
    const selected = ids.has(node.id);
    if (selected && !underSelected) out.push(cloneTree(node));
    for (const child of node.children) walk(child, underSelected || selected);
  };
  walk(root, false);
  return out;
}

/** Indented outline, one line per node, for the system clipboard. */
export function clipboardPlainText(nodes: MindMapTreeNode[]): string {
  const lines: string[] = [];
  const walk = (node: MindMapTreeNode, depth: number) => {
    lines.push(`${'  '.repeat(depth)}${node.text}`);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  nodes.forEach((node) => walk(node, 0));
  return lines.join('\n');
}

export interface PastedNodes {
  root: MindMapTreeNode;
  /** Ids of the nodes that were inserted, in clipboard order. */
  ids: string[];
}

/**
 * Append `clip` as children of `parentId`. Each paste rewrites ids, drops
 * free-drag offsets, and opens a collapsed parent so the new nodes are visible.
 * `side` is kept only when the parent is the root.
 */
export function pasteClipboardNodes(
  root: MindMapTreeNode,
  parentId: string,
  clip: MindMapTreeNode[],
): PastedNodes | null {
  if (clip.length === 0) return null;
  const next = cloneTree(root);
  const found = findNode(next, parentId);
  if (!found) return null;

  const ids: string[] = [];
  for (const src of clip) {
    const clone = cloneSubtreeWithNewIds(src);
    clearBranchCustomPositions(clone);
    if (parentId === 'root') clone.side = src.side === 'left' ? 'left' : 'right';
    else delete clone.side;
    found.node.children.push(clone);
    ids.push(clone.id);
  }
  found.node.collapsed = false;
  clearBranchCustomPositions(found.node);
  return { root: next, ids };
}
