/**
 * The native MindForge interchange format (`.mmforge`).
 *
 * Every other export format is an interchange with a third-party application
 * and loses fields the editor can set — icons, progress, dates, tags, images,
 * attachments. This one is the application's own: a versioned JSON envelope
 * carrying the tree verbatim, so export → re-import is lossless.
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

/**
 * Serializes a tree to the native format. The tree is carried verbatim —
 * no field is dropped, renamed, or re-typed.
 */
export function treeToMmforge(root: MindMapTreeNode): string {
  const envelope: MmforgeEnvelope = {
    format: MMFORGE_FORMAT,
    version: MMFORGE_VERSION,
    exported_at: new Date().toISOString(),
    root,
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
  if (!env.root || typeof env.root !== 'object' || !Array.isArray((env.root as MindMapTreeNode).children)) {
    throw new Error('Invalid .mmforge file: no root node');
  }

  const root = env.root as MindMapTreeNode;
  root.id = 'root';
  root.text = title || root.text;
  return root;
}
