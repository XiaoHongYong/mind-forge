/**
 * Picks a local file a node can link to (from the recent-files list).
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';

export interface LinkableFile {
  path: string;
  title: string;
}

interface MindMapFileLinkDialogProps {
  open: boolean;
  /** Left out of the list: a node linking to its own file goes nowhere useful. */
  currentPath?: string | null;
  files: LinkableFile[];
  loading?: boolean;
  linkedPath?: string | null;
  onPick: (file: LinkableFile) => void;
  onRemove: () => void;
  onClose: () => void;
}

function MindMapFileLinkDialogInner({
  open,
  currentPath,
  files,
  loading = false,
  linkedPath,
  onPick,
  onRemove,
  onClose,
}: MindMapFileLinkDialogProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files
      .filter((f) => f.path !== currentPath)
      .filter((f) => !needle || (f.title || f.path).toLowerCase().includes(needle));
  }, [files, currentPath, query]);

  if (!open) return null;

  return (
    <>
      <div className="mm-overlay" onClick={onClose} />
      <div className="mm-vault-link-dialog">
        <div className="mm-date-header">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span>Link to a file</span>
          <button className="mm-btn-icon" onClick={onClose} style={{ marginLeft: 'auto' }} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mm-date-body">
          <input
            ref={searchRef}
            className="mm-date-input"
            placeholder="Search recent files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && matches.length === 1) onPick(matches[0]);
            }}
          />

          <div className="mm-vault-link-list">
            {loading && <p className="mm-vault-link-empty">Loading…</p>}
            {!loading && matches.length === 0 && (
              <p className="mm-vault-link-empty">
                {files.length <= (currentPath ? 1 : 0)
                  ? 'Open other files first to link to them.'
                  : 'No files match that search.'}
              </p>
            )}
            {!loading && matches.map((file) => (
              <button
                key={file.path}
                type="button"
                className={`mm-vault-link-item${file.path === linkedPath ? ' is-active' : ''}`}
                onClick={() => onPick(file)}
                title={file.path}
              >
                <span className="mm-vault-link-title">{file.title || file.path}</span>
              </button>
            ))}
          </div>

          {linkedPath && (
            <button type="button" className="mm-btn mm-btn--danger" style={{ marginTop: 8 }} onClick={onRemove}>
              Remove link
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export const MindMapFileLinkDialog = memo(MindMapFileLinkDialogInner);
