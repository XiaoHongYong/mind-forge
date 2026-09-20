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

/** Outline shape for a topic bubble. */
export type NodeShape = 'rounded' | 'rect' | 'capsule' | 'ellipse';

/**
 * Document-level map appearance defaults (saved with the file).
 * Device preferences like canvas background stay in the theme store.
 */
export interface MapStyle {
  /** Body font family for nodes without an override. */
  defaultFontFamily?: string | null;
  /** Body font size (px at hierarchy scale 1) when a node has no `fontSize`. */
  defaultFontSize?: number | null;
  /** Edge colour when a child has neither `edgeColor` nor `color`. */
  defaultEdgeColor?: string | null;
}

export interface MindMapTreeNode {
  id: string;
  text: string;
  notes?: string;
  collapsed?: boolean;
  color?: string | null;
  /**
   * Body text size in px at hierarchy scale 1. When omitted, layout uses
   * `NODE_BASE_FONT_SIZE` and depth-derived defaults.
   */
  fontSize?: number | null;
  /** Explicit weight; when omitted, root/L1/deeper defaults apply. */
  fontWeight?: 'normal' | 'bold' | null;
  /** Explicit text colour; when omitted, coloured fills use white, else theme. */
  textColor?: string | null;
  /**
   * Node outline shape. When omitted, hierarchy defaults apply
   * (rounded rectangle with depth-scaled corner radius).
   */
  shape?: NodeShape | null;
  /** Stroke colour independent of fill; selection/drop still override. */
  borderColor?: string | null;
  /** Colour of the edge coming into this node from its parent. */
  edgeColor?: string | null;
  /** Width of the edge coming into this node (px in canvas space). */
  edgeWidth?: number | null;
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
  /** Document-level style defaults for the map. */
  map_style?: MapStyle;
}
