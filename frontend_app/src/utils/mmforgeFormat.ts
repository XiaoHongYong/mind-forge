/**
 * The native MindForge interchange format (`.mmforge`).
 *
 * Every other export format is an interchange with a third-party application
 * and loses fields the editor can set — icons, progress, dates, tags, images,
 * attachments. This one is the application's own: a versioned JSON envelope
 * carrying the tree, so export → re-import is lossless. Unset optional
 * fields are left out of the file; readers treat a missing field as the
 * editor default.
 *
 * It exists because of a concrete gap: a user could export a map, but no
 * importer could read the result back with its formatting intact.
 *
 * The envelope is versioned (`format` field) so a future change is an
 * explicit, detectable break rather than a silent mis-parse.
 */

import type { MindMapTreeNode } from '../types';

export const MMFORGE_FORMAT = 'mindforge-tree';
export const MMFORGE_VERSION = 1;

interface MmforgeEnvelope {
  format: typeof MMFORGE_FORMAT;
  version: number;
  exported_at: string;
  root: MindMapTreeNode;
}

/** True when a field holds only the editor default and should not be written. */
function isUnsetField(key: string, value: unknown): boolean {
  switch (key) {
    case 'notes':
    case 'color':
    case 'startDate':
    case 'endDate':
      return value == null || value === '';
    case 'collapsed':
      return value !== true;
    case 'icons':
    case 'urls':
    case 'attachments':
    case 'tags':
      return !Array.isArray(value) || value.length === 0;
    case 'checked':
    case 'progress':
      return value == null;
    default:
      return false;
  }
}

/**
 * Copy a node for serialization, dropping optional fields that have no value.
 * `checked: false` and `progress: 0` are real states and are kept.
 */
function compactNode(node: MindMapTreeNode): MindMapTreeNode {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'children') {
      const children = (node.children ?? []).map(compactNode);
      if (children.length > 0) out.children = children;
      continue;
    }
    if (isUnsetField(key, value)) continue;
    out[key] = value;
  }
  return out as unknown as MindMapTreeNode;
}

/** A missing `children` array means the node is a leaf. */
function restoreChildren(node: MindMapTreeNode): void {
  if (!Array.isArray(node.children)) node.children = [];
  else node.children.forEach(restoreChildren);
}

/**
 * Serializes a tree to the native format. Set values are kept as-is.
 * Empty notes, an expanded node, null colour/checkbox/progress/dates, and
 * empty lists (icons, URLs, children, attachments, tags) are omitted.
 */
export function treeToMmforge(root: MindMapTreeNode): string {
  const envelope: MmforgeEnvelope = {
    format: MMFORGE_FORMAT,
    version: MMFORGE_VERSION,
    exported_at: new Date().toISOString(),
    root: compactNode(root),
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Parses a `.mmforge` file back into a tree.
 *
 * The root is re-titled from the file name, matching the other importers.
 * Node ids are preserved as exported — they are stable within a document.
 */
export function mmforgeToTree(json: string, title: string): MindMapTreeNode {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid .mmforge file: not valid JSON');
  }

  const env = parsed as Partial<MmforgeEnvelope>;
  if (env?.format !== MMFORGE_FORMAT) {
    throw new Error('Invalid .mmforge file: missing format marker');
  }
  if (typeof env.version !== 'number' || env.version > MMFORGE_VERSION) {
    throw new Error(`Unsupported .mmforge version: ${String(env.version)}`);
  }
  if (!env.root || typeof env.root !== 'object') {
    throw new Error('Invalid .mmforge file: no root node');
  }
  const rootChildren = (env.root as MindMapTreeNode).children;
  if (rootChildren != null && !Array.isArray(rootChildren)) {
    throw new Error('Invalid .mmforge file: no root node');
  }

  const root = env.root as MindMapTreeNode;
  root.id = 'root';
  root.text = title || root.text;
  restoreChildren(root);
  return root;
}
