import { useCallback, useState, type MouseEvent } from 'react';
import { PanelLeft, PanelRight, Plus, X } from 'lucide-react';
import type { DocumentSession } from '../document/types';
import './DocumentTabBar.css';

export interface DocumentTabBarProps {
  sessions: DocumentSession[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  leftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
  rightSidebarOpen: boolean;
  onToggleRightSidebar: () => void;
}

function tabLabel(session: DocumentSession): string {
  if (session.path) {
    return session.path.split(/[/\\]/).pop() ?? session.path;
  }
  return session.title || 'Untitled';
}

export function DocumentTabBar({
  sessions,
  activeId,
  onActivate,
  onClose,
  onNew,
  leftSidebarOpen,
  onToggleLeftSidebar,
  rightSidebarOpen,
  onToggleRightSidebar,
}: DocumentTabBarProps) {
  const [hoverCloseId, setHoverCloseId] = useState<string | null>(null);

  const handleCloseClick = useCallback((e: MouseEvent, id: string) => {
    e.stopPropagation();
    onClose(id);
  }, [onClose]);

  const handleAuxClick = useCallback((e: MouseEvent, id: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose(id);
    }
  }, [onClose]);

  if (sessions.length === 0) return null;

  return (
    <div className="mm-doc-tabs" role="tablist" aria-label="Open documents">
      <div className="mm-doc-tabs-scroll">
        {sessions.map((session) => {
          const active = session.id === activeId;
          const label = tabLabel(session);
          const showCloseIcon = !session.dirty || hoverCloseId === session.id;
          return (
            <button
              key={session.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={session.path ?? label}
              className={`mm-doc-tab${active ? ' is-active' : ''}${session.dirty ? ' is-dirty' : ''}`}
              onClick={() => onActivate(session.id)}
              onAuxClick={(e) => handleAuxClick(e, session.id)}
            >
              <span className="mm-doc-tab-label">{label}</span>
              <span
                className="mm-doc-tab-close"
                role="presentation"
                title="Close"
                onClick={(e) => handleCloseClick(e, session.id)}
                onMouseEnter={() => setHoverCloseId(session.id)}
                onMouseLeave={() => setHoverCloseId((cur) => (cur === session.id ? null : cur))}
              >
                {showCloseIcon
                  ? <X size={12} strokeWidth={2} />
                  : <span className="mm-doc-tab-dirty" aria-label="Unsaved" />}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mm-doc-tab-new"
        onClick={onNew}
        title="New file"
        aria-label="New file"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`mm-doc-tab-toggle${leftSidebarOpen ? ' is-active' : ''}`}
        onClick={onToggleLeftSidebar}
        title={leftSidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'}
        aria-label={leftSidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'}
        aria-pressed={leftSidebarOpen}
      >
        <PanelLeft size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`mm-doc-tab-toggle${rightSidebarOpen ? ' is-active' : ''}`}
        onClick={onToggleRightSidebar}
        title={rightSidebarOpen ? 'Hide right sidebar' : 'Show right sidebar'}
        aria-label={rightSidebarOpen ? 'Hide right sidebar' : 'Show right sidebar'}
        aria-pressed={rightSidebarOpen}
      >
        <PanelRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
