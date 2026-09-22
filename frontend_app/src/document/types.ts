import type { MindMapTree } from '../types';
import type { ExportFormatId } from '../utils/exportFormats';
import type { ImportFormatId } from '../utils/importFormats';

/** Live editing session — path is null until the first successful Save As. */
export interface DocumentSession {
  /** Stable tab id for the lifetime of this open buffer (not persisted). */
  id: string;
  path: string | null;
  title: string;
  tree: MindMapTree;
  /** Format used when serializing Save / inferred from path on Open. */
  formatId: ExportFormatId | ImportFormatId;
  dirty: boolean;
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

export interface RecentFileEntry {
  path: string;
  title: string;
  /** Last time this path was opened or brought to the front of Recent. */
  openedAt: string;
  /**
   * Last time the document was saved to this path. Opening alone must not
   * bump this — the sidebar shows it as “N天前修改”. Older persisted
   * entries may omit it; fall back to `openedAt` when displaying.
   */
  modifiedAt?: string;
}

export function createEmptyTree(title = 'Central Topic'): MindMapTree {
  return {
    version: 'tree',
    root: {
      id: 'root',
      text: title,
      children: [],
      collapsed: false,
    },
  };
}

export function titleFromPath(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path;
  return base.replace(/\.[^.]+$/, '') || 'Untitled';
}

export function formatIdFromPath(path: string): ImportFormatId {
  const lower = path.toLowerCase();
  if (lower.endsWith('.mmforge')) return 'mmforge';
  if (lower.endsWith('.md')) return 'md';
  if (lower.endsWith('.mm')) return 'mm';
  if (lower.endsWith('.wxml') || lower.endsWith('.xml')) return 'wxml';
  if (lower.endsWith('.xmind')) return 'xmind';
  return 'mmforge';
}

/** Map an open format onto the matching export serializer id. */
export function exportFormatIdForPath(path: string): ExportFormatId {
  const id = formatIdFromPath(path);
  if (id === 'mm') return 'freemind';
  if (id === 'wxml') return 'wisemapping';
  return id;
}
