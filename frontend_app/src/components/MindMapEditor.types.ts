import type { ExportFormat } from '../utils/exportFormats';
import type { MindMapTree, NodeAttachmentRef } from '../types';
import type { LinkableFile } from './MindMapFileLinkDialog';

export interface MindMapEditorProps {
  initialTree: MindMapTree | null;
  initialShowShortcuts?: boolean;
  disableAutoPanToSelection?: boolean;
  externalNodeAttachments?: Record<string, NodeAttachmentRef[]>;
  title: string;
  onSave: (tree: MindMapTree, title: string) => Promise<void>;
  saving: boolean;
  saveMsg: string;
  error: string;
  onBack?: () => void;
  onDownloadJson?: (tree: MindMapTree, title: string) => void;
  /** The formats the export menu offers. One entry per format. */
  exportFormats?: ExportFormat[];
  onExport?: (format: ExportFormat, tree: MindMapTree, baseName: string) => void | Promise<void>;
  versionLabel?: string;
  versionTooltip?: string;
  onTreeChange?: (tree: MindMapTree) => void;
  onSelectionChange?: (nodeId: string | null) => void;
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
}
