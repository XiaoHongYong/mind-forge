import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../document';
import { DEFAULT_WINDOW_CAPTION, setWindowCaption } from '../platform/windowCaption';
import { isTauri } from '../storage';

export function HomePage() {
  const navigate = useNavigate();
  const recent = useDocumentStore((s) => s.recent);
  const createNew = useDocumentStore((s) => s.createNew);
  const openViaDialog = useDocumentStore((s) => s.openViaDialog);
  const openPath = useDocumentStore((s) => s.openPath);
  const clearRecent = useDocumentStore((s) => s.clearRecent);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void setWindowCaption(DEFAULT_WINDOW_CAPTION);
  }, []);

  const goEditor = useCallback(() => navigate('/editor'), [navigate]);

  const handleNew = useCallback(() => {
    createNew();
    goEditor();
  }, [createNew, goEditor]);

  const handleOpen = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const session = await openViaDialog();
      if (session) goEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file');
    } finally {
      setBusy(false);
    }
  }, [goEditor, openViaDialog]);

  const handleRecent = useCallback(async (path: string) => {
    setBusy(true);
    setError('');
    try {
      await openPath(path);
      goEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open recent file');
    } finally {
      setBusy(false);
    }
  }, [goEditor, openPath]);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">MindForge</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Open a local mind map file, or start a new one.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={handleNew}
            disabled={busy}
          >
            New
          </button>
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            onClick={() => void handleOpen()}
            disabled={busy}
          >
            Open…
          </button>
        </div>

        {!isTauri() && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            Browser mode uses a file picker and Save As download. Desktop saves in place.
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Recent</h2>
            {recent.length > 0 && (
              <button
                type="button"
                className="text-xs underline"
                style={{ color: 'var(--text-muted)' }}
                onClick={clearRecent}
              >
                Clear
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recent files yet.</p>
          ) : (
            <ul className="space-y-1">
              {recent.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                    onClick={() => void handleRecent(entry.path)}
                    disabled={busy || !isTauri()}
                    title={entry.path}
                  >
                    <div className="font-medium truncate">{entry.title}</div>
                    <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{entry.path}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isTauri() && recent.length > 0 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Re-opening by path needs the desktop app.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
