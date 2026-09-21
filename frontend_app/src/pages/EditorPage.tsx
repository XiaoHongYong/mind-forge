import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentTabBar } from '../components/DocumentTabBar';
import { DesktopMindMapEditor } from '../components/MindMapEditor';
import type { LinkableFile } from '../components/MindMapFileLinkDialog';
import { useDocumentStore, writeUnsavedBackup, restoreOrCreateNew, deleteUnsavedBackup, flushWorkspaceSave, restoreWorkspaceOnce } from '../document';
import type { DocumentSession } from '../document/types';
import { documentWindowCaption, setWindowCaption } from '../platform/windowCaption';
import { isTauri } from '../storage';
import type { MindMapTree, NodeAttachmentRef } from '../types';
import { fromBase64, toBase64 } from '../utils/base64';
import { createFilePreview } from '../utils/filePreview';
import { downloadBlob } from '../utils/download';
import { buildExportFileBaseName as buildExportName } from '../utils/exportFileName';
import { EXPORT_FORMATS, type ExportFormat } from '../utils/exportFormats';

export function EditorPage() {
  const navigate = useNavigate();
  const session = useDocumentStore((s) => s.session);
  const sessions = useDocumentStore((s) => s.sessions);
  const activeId = useDocumentStore((s) => s.activeId);
  const recent = useDocumentStore((s) => s.recent);
  const setSession = useDocumentStore((s) => s.setSession);
  const commitActive = useDocumentStore((s) => s.commitActive);
  const activate = useDocumentStore((s) => s.activate);
  const closeSession = useDocumentStore((s) => s.closeSession);
  const markDirty = useDocumentStore((s) => s.markDirty);
  const save = useDocumentStore((s) => s.save);
  const saveAs = useDocumentStore((s) => s.saveAs);
  const openViaDialog = useDocumentStore((s) => s.openViaDialog);
  const createNew = useDocumentStore((s) => s.createNew);
  const openPath = useDocumentStore((s) => s.openPath);
  const [editorKey, setEditorKey] = useState(0);
  const [title, setTitle] = useState(session?.title ?? 'Untitled');
  const [initialTree, setInitialTree] = useState<MindMapTree | null>(session?.tree ?? null);
  const [initialDirty, setInitialDirty] = useState(Boolean(session?.dirty));
  const [currentTree, setCurrentTree] = useState<MindMapTree | null>(session?.tree ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const previewBlobUrlCacheRef = useRef<Record<string, string>>({});
  const dirtyRef = useRef(Boolean(session?.dirty));
  const activeIdRef = useRef(activeId);
  const syncedSessionIdRef = useRef<string | null>(session?.id ?? null);
  const backupStateRef = useRef<{
    path: string | null;
    title: string;
    tree: MindMapTree | null;
    formatId: DocumentSession['formatId'];
  }>({
    path: session?.path ?? null,
    title: session?.title ?? 'Untitled',
    tree: session?.tree ?? null,
    formatId: session?.formatId ?? 'mmforge',
  });

  activeIdRef.current = activeId;

  const captionLabel = session?.path ? fileName(session.path) : (title || 'Untitled');

  useEffect(() => {
    void setWindowCaption(documentWindowCaption(captionLabel));
  }, [captionLabel]);

  useEffect(() => {
    backupStateRef.current = {
      path: session?.path ?? null,
      title,
      tree: currentTree,
      formatId: session?.formatId ?? 'mmforge',
    };
  }, [session?.path, session?.formatId, title, currentTree]);

  const flushUnsavedBackup = useCallback(async () => {
    const state = backupStateRef.current;
    if (!dirtyRef.current || !state.tree || !isTauri()) return;
    try {
      await writeUnsavedBackup({
        path: state.path,
        title: state.title,
        tree: state.tree,
        formatId: state.formatId,
      });
    } catch {
      // Best-effort: never block leave/quit on backup failure.
    }
  }, []);

  /** Persist the live editor buffer into the active store session before switching. */
  const commitEditorToStore = useCallback(() => {
    commitActive({
      tree: currentTree ?? undefined,
      title,
      dirty: dirtyRef.current,
    });
  }, [commitActive, currentTree, title]);

  const syncFromSession = useCallback((next = useDocumentStore.getState().session) => {
    if (!next) return;
    setTitle(next.title);
    setInitialTree(next.tree);
    setInitialDirty(Boolean(next.dirty));
    setCurrentTree(next.tree);
    dirtyRef.current = Boolean(next.dirty);
    setEditorKey((k) => k + 1);
    setError('');
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      if (cancelled) return;
      unlisten = await getCurrentWindow().onCloseRequested(async () => {
        commitActive({
          tree: backupStateRef.current.tree ?? undefined,
          title: backupStateRef.current.title,
          dirty: dirtyRef.current,
        });
        await flushWorkspaceSave();
        await flushUnsavedBackup();
      });
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [commitActive, flushUnsavedBackup]);

  useEffect(() => {
    if (sessions.length === 0) {
      let cancelled = false;
      void (async () => {
        await restoreWorkspaceOnce();
        if (cancelled || useDocumentStore.getState().sessions.length > 0) return;
        const next = await restoreOrCreateNew();
        if (!cancelled) setSession(next);
      })();
      return () => { cancelled = true; };
    }
  }, [sessions.length, setSession]);

  // Keep the active buffer in the store so a quit restores unsaved trees.
  useEffect(() => {
    if (!currentTree) return;
    const timer = setTimeout(() => {
      commitActive({
        tree: currentTree,
        title,
        dirty: dirtyRef.current,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [commitActive, currentTree, title]);

  // Sync editor when the active tab changes (skip the first paint — state is already seeded).
  useEffect(() => {
    if (!session) return;
    if (syncedSessionIdRef.current === session.id) return;
    syncedSessionIdRef.current = session.id;
    syncFromSession(session);
  }, [session, syncFromSession]);

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

  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
    markDirty(dirty);
  }, [markDirty]);

  const handleSave = useCallback(async (tree: MindMapTree, currentTitle: string) => {
    setSaving(true);
    setError('');
    setSaveMsg('');
    try {
      const saved = await save(tree, currentTitle || title);
      setTitle(saved.title);
      setCurrentTree(saved.tree);
      // Do not touch initialTree / editorKey — undo history must survive Save.
      dirtyRef.current = false;
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
      setCurrentTree(saved.tree);
      dirtyRef.current = false;
      setSaveMsg(saved.path ? 'Saved' : 'Downloaded');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save As failed');
    } finally {
      setSaving(false);
    }
  }, [currentTree, saveAs, title]);

  const handleNew = useCallback(async () => {
    commitEditorToStore();
    await flushUnsavedBackup();
    await createNew();
    // session?.id effect remounts the editor for the new tab
  }, [commitEditorToStore, createNew, flushUnsavedBackup]);

  const handleOpen = useCallback(async () => {
    commitEditorToStore();
    await flushUnsavedBackup();
    await openViaDialog();
  }, [commitEditorToStore, flushUnsavedBackup, openViaDialog]);

  const handleActivateTab = useCallback(async (id: string) => {
    if (id === activeIdRef.current) return;
    commitEditorToStore();
    await flushUnsavedBackup();
    activate(id);
  }, [activate, commitEditorToStore, flushUnsavedBackup]);

  const handleCloseTab = useCallback(async (id: string) => {
    const target = useDocumentStore.getState().sessions.find((s) => s.id === id);
    if (!target) return;

    if (id === activeIdRef.current) {
      commitEditorToStore();
    }

    const fresh = useDocumentStore.getState().sessions.find((s) => s.id === id) ?? target;
    if (fresh.dirty) {
      const label = fresh.path ? fileName(fresh.path) : (fresh.title || 'Untitled');
      const discard = window.confirm(
        `"${label}" has unsaved changes. Close without saving?`,
      );
      if (!discard) return;
      try {
        await deleteUnsavedBackup(fresh.path);
      } catch {
        // Best-effort.
      }
    }

    const next = closeSession(id);
    await flushWorkspaceSave();
    if (!next) {
      navigate('/');
      return;
    }
  }, [closeSession, commitEditorToStore, navigate]);

  const handleBack = useCallback(async () => {
    commitEditorToStore();
    await flushWorkspaceSave();
    await flushUnsavedBackup();
    navigate('/');
  }, [commitEditorToStore, flushUnsavedBackup, navigate]);

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
      commitEditorToStore();
      await flushUnsavedBackup();
      await openPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open linked file');
    }
  }, [commitEditorToStore, flushUnsavedBackup, openPath]);

  // Ctrl/Cmd+W closes the active tab.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== 'w') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) {
        return;
      }
      e.preventDefault();
      if (activeIdRef.current) void handleCloseTab(activeIdRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCloseTab]);

  if (!session || !initialTree) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <DocumentTabBar
        sessions={sessions}
        activeId={activeId}
        onActivate={(id) => { void handleActivateTab(id); }}
        onClose={(id) => { void handleCloseTab(id); }}
        onNew={() => { void handleNew(); }}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DesktopMindMapEditor
          key={editorKey}
          documentPath={session.path}
          linkableFiles={linkableFiles}
          linkableFilesLoading={false}
          onRequestLinkableFiles={() => undefined}
          onOpenFileLink={(path) => { void handleOpenFileLink(path); }}
          onNewDocument={() => { void handleNew(); }}
          onOpenDocument={() => { void handleOpen(); }}
          onSaveAsDocument={() => { void handleSaveAs(); }}
          initialTree={initialTree}
          initialDirty={initialDirty}
          title={title}
          onSave={handleSave}
          saving={saving}
          saveMsg={saveMsg}
          error={error}
          onBack={() => { void handleBack(); }}
          onDirtyChange={handleDirtyChange}
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
    </div>
  );
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}
