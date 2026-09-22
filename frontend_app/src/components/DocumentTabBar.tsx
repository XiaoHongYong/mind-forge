import { useCallback, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
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

function tabLabel(session: DocumentSession, untitled: string): string {
  if (session.path) {
    return session.path.split(/[/\\]/).pop() ?? session.path;
  }
  return session.title || untitled;
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
  const { t } = useTranslation();
  const [hoverCloseId, setHoverCloseId] = useState<string | null>(null);
  const untitled = t('common.untitled', { defaultValue: 'Untitled' });

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

  const leftLabel = leftSidebarOpen
    ? t('tabs.hideLeftSidebar', { defaultValue: 'Hide left sidebar' })
    : t('tabs.showLeftSidebar', { defaultValue: 'Show left sidebar' });
  const rightLabel = rightSidebarOpen
    ? t('tabs.hideRightSidebar', { defaultValue: 'Hide right sidebar' })
    : t('tabs.showRightSidebar', { defaultValue: 'Show right sidebar' });

  return (
    <div className="mm-doc-tabs" role="tablist" aria-label={t('tabs.openDocuments', { defaultValue: 'Open documents' })}>
      <div className="mm-doc-tabs-scroll">
        {sessions.map((session) => {
          const active = session.id === activeId;
          const label = tabLabel(session, untitled);
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
                title={t('tabs.close', { defaultValue: 'Close' })}
                onClick={(e) => handleCloseClick(e, session.id)}
                onMouseEnter={() => setHoverCloseId(session.id)}
                onMouseLeave={() => setHoverCloseId((cur) => (cur === session.id ? null : cur))}
              >
                {showCloseIcon
                  ? <X size={12} strokeWidth={2} />
                  : <span className="mm-doc-tab-dirty" aria-label={t('tabs.unsaved', { defaultValue: 'Unsaved' })} />}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mm-doc-tab-new"
        onClick={onNew}
        title={t('tabs.newFile', { defaultValue: 'New file' })}
        aria-label={t('tabs.newFile', { defaultValue: 'New file' })}
      >
        <Plus size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`mm-doc-tab-toggle${leftSidebarOpen ? ' is-active' : ''}`}
        onClick={onToggleLeftSidebar}
        title={leftLabel}
        aria-label={leftLabel}
        aria-pressed={leftSidebarOpen}
      >
        <PanelLeft size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`mm-doc-tab-toggle${rightSidebarOpen ? ' is-active' : ''}`}
        onClick={onToggleRightSidebar}
        title={rightLabel}
        aria-label={rightLabel}
        aria-pressed={rightSidebarOpen}
      >
        <PanelRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
