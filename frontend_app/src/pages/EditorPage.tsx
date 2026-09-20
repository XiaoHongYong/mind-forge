import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DesktopMindMapEditor } from '../components/MindMapEditor';
import type { LinkableFile } from '../components/MindMapFileLinkDialog';
import { useDocumentStore } from '../document';
import { newDocument } from '../document/io';
import type { MindMapTree, NodeAttachmentRef } from '../types';
import { fromBase64, toBase64 } from '../utils/base64';
import { createFilePreview } from '../utils/filePreview';
import { downloadBlob } from '../utils/download';
import { buildExportFileBaseName as buildExportName } from '../utils/exportFileName';
import { EXPORT_FORMATS, type ExportFormat } from '../utils/exportFormats';

export function EditorPage() {
  const navigate = useNavigate();
  const session = useDocumentStore((s) => s.session);
  const recent = useDocumentStore((s) => s.recent);
  const setSession = useDocumentStore((s) => s.setSession);
  const save = useDocumentStore((s) => s.save);
  const saveAs = useDocumentStore((s) => s.saveAs);
  const openViaDialog = useDocumentStore((s) => s.openViaDialog);
  const createNew = useDocumentStore((s) => s.createNew);
  const openPath = useDocumentStore((s) => s.openPath);
  const updateTitle = useDocumentStore((s) => s.updateTitle);

  const [editorKey, setEditorKey] = useState(0);
  const [title, setTitle] = useState(session?.title ?? 'Untitled');
  const [savedTitle, setSavedTitle] = useState(session?.title ?? 'Untitled');
  const [initialTree, setInitialTree] = useState<MindMapTree | null>(session?.tree ?? null);
  const [currentTree, setCurrentTree] = useState<MindMapTree | null>(session?.tree ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const previewBlobUrlCacheRef = useRef<Record<string, string>>({});

  const syncFromSession = useCallback((next = useDocumentStore.getState().session) => {
    if (!next) return;
    setTitle(next.title);
    setSavedTitle(next.title);
    setInitialTree(next.tree);
    setCurrentTree(next.tree);
    setEditorKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!session) {
      setSession(newDocument());
    }
  }, [session, setSession]);

  useEffect(() => {
    if (session && !initialTree) {
      syncFromSession(session);
    }
  }, [session, initialTree, syncFromSession]);

  useEffect(() => () => {
    Object.values(previewBlobUrlCacheRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const linkableFiles = useMemo<LinkableFile[]>(
    () =>
      recent
        .filter((e) => e.path !== session?.path)
        .map((e) => ({ path: e.path, title: e.title })),
    [recent, session?.path],
  );

  const handleSave = useCallback(async (tree: MindMapTree, currentTitle: string) => {
    setSaving(true);
    setError('');
    setSaveMsg('');
    try {
      const saved = await save(tree, currentTitle || title);
      setTitle(saved.title);
      setSavedTitle(saved.title);
      setCurrentTree(saved.tree);
      setInitialTree(saved.tree);
      setSaveMsg(saved.path ? 'Saved' : 'Downloaded');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [save, title]);

  const handleSaveAs = useCallback(async () => {
    if (!currentTree) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveAs(currentTree, title);
      setTitle(saved.title);
      setSavedTitle(saved.title);
      setCurrentTree(saved.tree);
      setInitialTree(saved.tree);
      setSaveMsg(saved.path ? 'Saved' : 'Downloaded');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save As failed');
    } finally {
      setSaving(false);
    }
  }, [currentTree, saveAs, title]);

  const handleNew = useCallback(() => {
    createNew();
    syncFromSession();
  }, [createNew, syncFromSession]);

  const handleOpen = useCallback(async () => {
    const opened = await openViaDialog();
    if (opened) syncFromSession(opened);
  }, [openViaDialog, syncFromSession]);

  const handleRenameTitle = useCallback(() => {
    const next = title.trim();
    if (!next) return;
    updateTitle(next);
    setSavedTitle(next);
    setSaveMsg('Title updated');
    setTimeout(() => setSaveMsg(''), 2000);
  }, [title, updateTitle]);

  const handleExport = useCallback(async (format: ExportFormat, tree: MindMapTree, baseName: string) => {
    const blob = await format.serialize(tree.root, baseName);
    const name = buildExportName({ baseTitle: baseName, title, fallback: 'map' });
    void downloadBlob(blob, `${name}${format.extension}`);
  }, [title]);

  const saveBytesToFile = useCallback((bytes: Uint8Array, fileName: string, contentType: string) => {
    const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    void downloadBlob(new Blob([payload], { type: contentType }), fileName);
  }, []);

  const uploadNodeFiles = useCallback(async (_nodeId: string, files: File[]): Promise<NodeAttachmentRef[]> => {
    const created: NodeAttachmentRef[] = [];
    for (const file of files) {
      const plaintext = new Uint8Array(await file.arrayBuffer());
      const preview = await createFilePreview(file);
      created.push({
        attachment_id: `local-${crypto.randomUUID()}`,
        preview_attachment_id: null,
        name: file.name,
        content_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        preview_content_type: preview.contentType,
        preview_kind: preview.kind,
        uploaded_at: new Date().toISOString(),
        inline_data_base64: toBase64(plaintext),
        inline_preview_data_base64: toBase64(preview.bytes),
      });
    }
    setSaveMsg(`${files.length} attachment${files.length === 1 ? '' : 's'} added`);
    setTimeout(() => setSaveMsg(''), 3000);
    return created;
  }, []);

  const handleOpenNodeAttachment = useCallback(async (attachment: NodeAttachmentRef) => {
    if (!attachment.inline_data_base64) return;
    saveBytesToFile(
      fromBase64(attachment.inline_data_base64),
      attachment.name,
      attachment.content_type || 'application/octet-stream',
    );
  }, [saveBytesToFile]);

  const handleFetchNodeAttachmentContent = useCallback(async (attachment: NodeAttachmentRef) => {
    if (!attachment.inline_data_base64) return null;
    const bytes = fromBase64(attachment.inline_data_base64);
    const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const contentType = attachment.content_type || 'application/octet-stream';
    return { name: attachment.name, contentType, blob: new Blob([payload], { type: contentType }) };
  }, []);

  const handleLoadNodeAttachmentPreview = useCallback(async (attachment: NodeAttachmentRef) => {
    const isImageAttachment = (attachment.content_type ?? '').startsWith('image/');
    const previewSourceId = attachment.attachment_id;
    const cached = previewBlobUrlCacheRef.current[previewSourceId];
    if (cached) return cached;
    const payloadBase64 = isImageAttachment
      ? attachment.inline_data_base64
      : attachment.inline_preview_data_base64;
    if (!payloadBase64) return null;
    const bytes = fromBase64(payloadBase64);
    const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([payload], {
      type: isImageAttachment
        ? (attachment.content_type || 'image/png')
        : (attachment.preview_content_type || 'image/svg+xml'),
    });
    const previewUrl = URL.createObjectURL(blob);
    previewBlobUrlCacheRef.current[previewSourceId] = previewUrl;
    return previewUrl;
  }, []);

  const handleDeleteNodeAttachment = useCallback(async (attachment: NodeAttachmentRef) => {
    const cachedPreviewUrl = previewBlobUrlCacheRef.current[attachment.attachment_id];
    if (cachedPreviewUrl) {
      URL.revokeObjectURL(cachedPreviewUrl);
      delete previewBlobUrlCacheRef.current[attachment.attachment_id];
    }
  }, []);

  const handleOpenFileLink = useCallback(async (path: string) => {
    try {
      const opened = await openPath(path);
      syncFromSession(opened);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open linked file');
    }
  }, [openPath, syncFromSession]);

  if (!session || !initialTree) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <DesktopMindMapEditor
        key={editorKey}
        documentPath={session.path}
        linkableFiles={linkableFiles}
        linkableFilesLoading={false}
        onRequestLinkableFiles={() => undefined}
        onOpenFileLink={(path) => { void handleOpenFileLink(path); }}
        onNewDocument={handleNew}
        onOpenDocument={() => { void handleOpen(); }}
        onSaveAsDocument={() => { void handleSaveAs(); }}
        initialTree={initialTree}
        title={title}
        onTitleChange={(next) => {
          setTitle(next);
          updateTitle(next);
        }}
        onSave={handleSave}
        saving={saving}
        saveMsg={saveMsg}
        error={error}
        titleChanged={title.trim() !== savedTitle}
        onRenameTitle={handleRenameTitle}
        renamingTitle={false}
        onBack={() => navigate('/')}
        exportFormats={EXPORT_FORMATS}
        onExport={handleExport}
        versionLabel={session.path ? fileName(session.path) : 'Untitled'}
        versionTooltip={session.path ?? 'Not saved yet'}
        onTreeChange={setCurrentTree}
        onNodeFileDrop={(nodeId, files) => uploadNodeFiles(nodeId, files)}
        onOpenNodeAttachment={(attachment) => { void handleOpenNodeAttachment(attachment); }}
        onFetchNodeAttachmentContent={(attachment) => handleFetchNodeAttachmentContent(attachment)}
        onDeleteNodeAttachment={(attachment) => { void handleDeleteNodeAttachment(attachment); }}
        onLoadNodeAttachmentPreview={(attachment) => handleLoadNodeAttachmentPreview(attachment)}
      />
    </div>
  );
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}
