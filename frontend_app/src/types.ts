import type { NodeLink } from '@mindforge/mindmap-core';
export type { NodeLink };

// ── Mind map document model ───────────────────────────────────────────────────

export interface UrlEntry {
  url: string;
  label: string;
}

export interface NodeAttachmentRef {
  attachment_id: string;
  preview_attachment_id?: string | null;
  name: string;
  content_type: string;
  size_bytes: number;
  preview_content_type?: string | null;
  preview_kind?: 'image' | 'card';
  uploaded_at: string;
  /** Inline payload (base64) stored inside the document. */
  inline_data_base64?: string;
  /** Optional inline preview payload (base64). */
  inline_preview_data_base64?: string;
}

export interface MindMapTreeNode {
  id: string;
  text: string;
  notes?: string;
  collapsed?: boolean;
  color?: string | null;
  link?: NodeLink | null;
  children: MindMapTreeNode[];
  /** Lucide icon names rendered inside the node (multi-select). */
  icons?: string[];
  /** null = no checkbox, false = unchecked, true = checked. */
  checked?: boolean | null;
  /** Manual progress percentage: 0 | 25 | 50 | 75 | 100 | null. */
  progress?: number | null;
  /** ISO datetime-local for start-date planning. */
  startDate?: string | null;
  /** ISO datetime-local for end-date planning. */
  endDate?: string | null;
  /** Custom URL links rendered as footer strips. */
  urls?: UrlEntry[];
  /** Attachment references stored inside the document tree. */
  attachments?: NodeAttachmentRef[];
  /** Only meaningful for root's direct children: 'left' or 'right'. */
  side?: 'left' | 'right';
  /** Free-drag position override (layout skips normal calculation). */
  customX?: number;
  /** Free-drag position override (layout skips normal calculation). */
  customY?: number;
  /** User-defined tags on this node (e.g. ['work', 'urgent']). */
  tags?: string[];
  /** Picture drawn on the node itself. Optional, so older maps load unchanged. */
  image?: NodeImage | null;
}

/**
 * A picture shown on the node, on the canvas.
 *
 * The thumbnail lives here, inside the map JSON, so PNG/PDF export and offline
 * rendering need no special handling. The full-resolution original is typically
 * the matching attachment (`attachment_id`).
 */
export interface NodeImage {
  /** WebP data URI, fits a 64×64 box at its own aspect ratio. */
  thumb: string;
  /** Rendered glyph dimensions. Stored so layout never decodes the image. */
  w: number;
  h: number;
  /** Attachment holding the full-resolution original. */
  attachment_id?: string | null;
  /** Original filename — preview modal title and download name. */
  name?: string;
}

export interface MindMapTree {
  version: 'tree';
  root: MindMapTreeNode;
  view_state?: {
    pan_x?: number;
    pan_y?: number;
    zoom?: number;
    focus_mode?: boolean;
    focus_anchor_id?: string | null;
    selected_node_id?: string;
    /**
     * How root children are placed: `tree` keeps them all on the right;
     * `map` balances them left and right around the centre (XMind-style).
     */
    layout_mode?: 'tree' | 'map';
  };
}
