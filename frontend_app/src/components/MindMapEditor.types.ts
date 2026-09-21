import type { ReactNode } from 'react';
import type { ExportFormat } from '../utils/exportFormats';
import type { MindMapTree, NodeAttachmentRef } from '../types';
import type { LinkableFile } from './MindMapFileLinkDialog';

export interface MindMapEditorProps {
  initialTree: MindMapTree | null;
  /** When true, the freshly opened tree is already dirty (e.g. restored backup). */
  initialDirty?: boolean;
  initialShowShortcuts?: boolean;
  disableAutoPanToSelection?: boolean;
  externalNodeAttachments?: Record<string, NodeAttachmentRef[]>;
  title: string;
  onSave: (tree: MindMapTree, title: string) => Promise<void>;
  saving: boolean;
  saveMsg: string;
  error: string;
  onDownloadJson?: (tree: MindMapTree, title: string) => void;
  /** The formats the export menu offers. One entry per format. */
  exportFormats?: ExportFormat[];
  onExport?: (format: ExportFormat, tree: MindMapTree, baseName: string) => void | Promise<void>;
  versionLabel?: string;
  versionTooltip?: string;
  onTreeChange?: (tree: MindMapTree) => void;
  onSelectionChange?: (nodeId: string | null) => void;
  /**
   * Ask the canvas to select this node. `token` must change on each request
   * so selecting the same id again still focuses it.
   */
  focusNodeRequest?: { nodeId: string; token: number } | null;
  /** In-progress rename text, so the outline can follow the caret before commit. */
  onEditingTextChange?: (nodeId: string | null, text: string) => void;
  onNodeFileDrop?: (nodeId: string, files: File[]) => Promise<NodeAttachmentRef[]>;
  onOpenNodeAttachment?: (attachment: NodeAttachmentRef) => Promise<void> | void;
  onFetchNodeAttachmentContent?: (attachment: NodeAttachmentRef) => Promise<{ name: string; contentType: string; blob: Blob } | null>;
  onDeleteNodeAttachment?: (attachment: NodeAttachmentRef) => Promise<void> | void;
  onLoadNodeAttachmentPreview?: (attachment: NodeAttachmentRef) => Promise<string | null>;
  /** Absolute path of the open document, if saved. */
  documentPath?: string | null;
  /** Recent files this map can link a node to. */
  linkableFiles?: LinkableFile[];
  linkableFilesLoading?: boolean;
  onRequestLinkableFiles?: () => void;
  /** Follows a node's file link. Navigation belongs to the page. */
  onOpenFileLink?: (path: string) => void;
  onNewDocument?: () => void;
  onOpenDocument?: () => void;
  onSaveAsDocument?: () => void;
  /** Panel under the toolbar, to the left of the canvas (recent files / outline). */
  sidePanel?: ReactNode;
  /** App View menu: show the recent list or the outline. */
  onShowDocumentPanel?: (tab: 'recent' | 'outline') => void;
  /** Fired whenever the editor's dirty flag changes. */
  onDirtyChange?: (dirty: boolean) => void;
}
