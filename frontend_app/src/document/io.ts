import type { MindMapTree, MindMapTreeNode } from '../types';
import { EXPORT_FORMATS, type ExportFormatId } from '../utils/exportFormats';
import {
  IMPORT_FORMATS,
  type ImportFormatId,
  vaultTitleFromFileName,
} from '../utils/importFormats';
import {
  createEmptyTree,
  exportFormatIdForPath,
  formatIdFromPath,
  titleFromPath,
  type DocumentSession,
} from './types';
import {
  fileToBytes,
  pickBrowserFile,
  pickOpenPath,
  pickSavePath,
  readFileBytes,
  writeFileBytes,
} from './fileAccess';
import { isTauri } from '../storage';
import { downloadBlob } from '../utils/download';
import { deleteUnsavedBackup, takeMatchingUnsavedBackup, takeUntitledUnsavedBackup, sessionFromUntitledBackup } from './unsavedBackup';

function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

async function parseBytes(
  bytes: Uint8Array,
  formatId: ImportFormatId,
  title: string,
  fileName: string,
): Promise<MindMapTreeNode> {
  const format = IMPORT_FORMATS.find((f) => f.id === formatId);
  if (!format) throw new Error(`Unsupported format: ${formatId}`);

  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]);
  const file = new File([blob], fileName);
  return format.parse(file, title);
}

export async function openDocumentFromPath(path: string): Promise<DocumentSession> {
  const bytes = await readFileBytes(path);
  const formatId = formatIdFromPath(path);
  const title = titleFromPath(path);
  const root = await parseBytes(bytes, formatId, title, fileNameFromPath(path));
  const session: DocumentSession = {
    path,
    title,
    tree: { version: 'tree', root },
    formatId,
    dirty: false,
  };

  const backup = await takeMatchingUnsavedBackup(path, bytes);
  if (!backup) return session;

  return {
    ...session,
    title: backup.title || title,
    tree: backup.tree,
    formatId: backup.formatId || formatId,
    dirty: true,
  };
}

export async function openDocumentViaDialog(): Promise<DocumentSession | null> {
  if (isTauri()) {
    const path = await pickOpenPath();
    if (!path) return null;
    return openDocumentFromPath(path);
  }

  const accept = IMPORT_FORMATS.map((f) => f.accept).join(',');
  const file = await pickBrowserFile(accept);
  if (!file) return null;
  const format =
    IMPORT_FORMATS.find((f) => f.extensions.test(file.name)) ?? IMPORT_FORMATS[0];
  const title = vaultTitleFromFileName(file.name, format.extensions);
  const root = await format.parse(file, title);
  return {
    path: null,
    title,
    tree: { version: 'tree', root },
    formatId: format.id,
    dirty: true,
  };
}

export function newDocument(title = 'Untitled'): DocumentSession {
  return {
    path: null,
    title,
    tree: createEmptyTree(title),
    formatId: 'mmforge',
    dirty: false,
  };
}

/**
 * Prefer restoring a never-saved untitled backup; otherwise start blank.
 * Marks the session dirty and path-less when a backup is applied.
 */
export async function restoreOrCreateNew(title = 'Untitled'): Promise<DocumentSession> {
  const backup = await takeUntitledUnsavedBackup();
  if (backup) return sessionFromUntitledBackup(backup);
  return newDocument(title);
}

async function serializeSession(
  tree: MindMapTree,
  title: string,
  formatId: ExportFormatId,
): Promise<Uint8Array> {
  const format = EXPORT_FORMATS.find((f) => f.id === formatId);
  if (!format) throw new Error(`Unsupported export format: ${formatId}`);
  const blob = await format.serialize(tree.root, title);
  return new Uint8Array(await blob.arrayBuffer());
}

function defaultSaveName(title: string, formatId: ExportFormatId): string {
  const format = EXPORT_FORMATS.find((f) => f.id === formatId);
  const safe = (title || 'Untitled').replace(/[^\w.\-]+/g, '_');
  return `${safe}${format?.extension ?? '.mmforge'}`;
}

/** Save in place, or Save As when untitled / browser. Returns updated session. */
export async function saveDocument(
  session: DocumentSession,
  tree: MindMapTree,
  title: string,
): Promise<DocumentSession> {
  if (session.path && isTauri()) {
    const formatId = exportFormatIdForPath(session.path);
    const bytes = await serializeSession(tree, title, formatId);
    await writeFileBytes(session.path, bytes);
    await deleteUnsavedBackup(session.path);
    return { ...session, path: session.path, title, tree, formatId, dirty: false };
  }
  return saveDocumentAs(session, tree, title);
}

export async function saveDocumentAs(
  session: DocumentSession,
  tree: MindMapTree,
  title: string,
): Promise<DocumentSession> {
  const formatId: ExportFormatId =
    session.formatId === 'mm'
      ? 'freemind'
      : session.formatId === 'wxml'
        ? 'wisemapping'
        : (session.formatId as ExportFormatId);
  const suggested = defaultSaveName(title, formatId);

  if (isTauri()) {
    const path = await pickSavePath(session.path ?? suggested);
    if (!path) return session;
    const resolvedFormat = exportFormatIdForPath(path);
    const bytes = await serializeSession(tree, title, resolvedFormat);
    await writeFileBytes(path, bytes);
    // Save As always clears the untitled slot; also drop any previous path slot.
    await deleteUnsavedBackup(null);
    if (session.path && session.path !== path) {
      await deleteUnsavedBackup(session.path);
    }
    await deleteUnsavedBackup(path);
    return {
      path,
      title: titleFromPath(path) || title,
      tree,
      formatId: resolvedFormat,
      dirty: false,
    };
  }

  const bytes = await serializeSession(tree, title, formatId);
  await downloadBlob(new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]), suggested);
  return {
    ...session,
    title,
    tree,
    formatId,
    dirty: false,
  };
}

export { fileToBytes };
