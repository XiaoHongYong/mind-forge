/**
 * Left dock: recent files, and the outline of the focused document.
 * Outline selection follows the canvas, and canvas edits refresh the tree.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { RecentFileEntry } from '../document/types';
import { findNodePath } from './MindMapHelpers';
import type { MindMapTree, MindMapTreeNode } from '../types';
import './DocumentSidebar.css';

export type DocumentSidebarTab = 'recent' | 'outline';

const SIDEBAR_WIDTH_KEY = 'mindforge:doc-sidebar-width';
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;

function clampWidth(value: number, max = MAX_WIDTH): number {
  return Math.min(max, Math.max(MIN_WIDTH, value));
}

function widthLimit(): number {
  if (typeof window === 'undefined') return MAX_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - 280));
}

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (raw == null || raw === '') return DEFAULT_WIDTH;
    const value = Number(raw);
    if (Number.isFinite(value)) return clampWidth(value, widthLimit());
  } catch {
    /* private mode or a blocked storage */
  }
  return DEFAULT_WIDTH;
}

export interface DocumentSidebarProps {
  tab: DocumentSidebarTab;
  onTabChange: (tab: DocumentSidebarTab) => void;
  recent: RecentFileEntry[];
  recentBusy?: boolean;
  recentError?: string;
  canReopenByPath: boolean;
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  tree: MindMapTree | null;
  /** Remounts the outline when the focused document changes. */
  documentId?: string | null;
  selectedNodeId: string | null;
  /** Text currently being typed on the canvas, before it is committed. */
  editing?: { nodeId: string; text: string } | null;
  onSelectNode: (nodeId: string) => void;
  onClose?: () => void;
}

function firstLine(text: string): string {
  const line = text.split('\n')[0]?.trim() ?? '';
  return line || 'Untitled';
}

export function DocumentSidebar({
  tab,
  onTabChange,
  recent,
  recentBusy = false,
  recentError = '',
  canReopenByPath,
  onOpenRecent,
  onRemoveRecent,
  tree,
  documentId = null,
  selectedNodeId,
  editing = null,
  onSelectNode,
  onClose,
}: DocumentSidebarProps) {
  const [width, setWidth] = useState(readStoredWidth);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onResize = () => {
      const next = clampWidth(widthRef.current, widthLimit());
      if (next !== widthRef.current) setWidth(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const persistWidth = (value: number) => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(value));
    } catch {
      /* ignore */
    }
  };

  const applyWidth = (value: number) => {
    const next = clampWidth(value, widthLimit());
    widthRef.current = next;
    setWidth(next);
    return next;
  };

  const orderedRecent = useMemo(
    () => [...recent].sort((a, b) => (a.openedAt < b.openedAt ? 1 : a.openedAt > b.openedAt ? -1 : 0)),
    [recent],
  );

  return (
    <aside
      className={`mm-doc-side${resizing ? ' is-resizing' : ''}`}
      aria-label="Documents"
      style={{ width, flexBasis: width }}
    >
      <div className="mm-doc-side-tabs" role="tablist" aria-label="Sidebar">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'recent'}
          className={`mm-doc-side-tab${tab === 'recent' ? ' is-active' : ''}`}
          onClick={() => onTabChange('recent')}
        >
          Recent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'outline'}
          className={`mm-doc-side-tab${tab === 'outline' ? ' is-active' : ''}`}
          onClick={() => onTabChange('outline')}
        >
          Outline
        </button>
        {onClose && (
          <button
            type="button"
            className="mm-doc-side-close"
            onClick={onClose}
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div
        className="mm-doc-side-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { startX: event.clientX, startW: widthRef.current };
          setResizing(true);
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          applyWidth(drag.startW + event.clientX - drag.startX);
        }}
        onPointerUp={(event) => {
          if (!dragRef.current) return;
          dragRef.current = null;
          setResizing(false);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          persistWidth(widthRef.current);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setResizing(false);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }}
        onDoubleClick={() => persistWidth(applyWidth(DEFAULT_WIDTH))}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 32 : 16;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            persistWidth(applyWidth(widthRef.current - step));
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            persistWidth(applyWidth(widthRef.current + step));
          } else if (event.key === 'Home') {
            event.preventDefault();
            persistWidth(applyWidth(DEFAULT_WIDTH));
          }
        }}
      />

      {tab === 'recent' ? (
        <div className="mm-doc-side-body" role="tabpanel">
          {orderedRecent.length === 0 ? (
            <p className="mm-doc-side-empty">No recent files yet.</p>
          ) : (
            <ul className="mm-doc-side-recent">
              {orderedRecent.map((entry) => (
                <li key={entry.path} className="mm-doc-side-recent-row">
                  <button
                    type="button"
                    className="mm-doc-side-recent-open"
                    title={entry.path}
                    disabled={recentBusy || !canReopenByPath}
                    onClick={() => onOpenRecent(entry.path)}
                  >
                    <span className="mm-doc-side-recent-title">{entry.title}</span>
                    <span className="mm-doc-side-recent-path">{entry.path}</span>
                  </button>
                  <button
                    type="button"
                    className="mm-doc-side-recent-remove"
                    aria-label={`Remove ${entry.title} from recent`}
                    title="Remove from recent"
                    onClick={() => onRemoveRecent(entry.path)}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!canReopenByPath && orderedRecent.length > 0 && (
            <p className="mm-doc-side-hint">Re-opening by path needs the desktop app.</p>
          )}
          {recentError && <p className="mm-doc-side-error">{recentError}</p>}
        </div>
      ) : (
        <div className="mm-doc-side-body" role="tabpanel">
          {tree?.root ? (
            <OutlineTree
              key={documentId ?? 'outline'}
              root={tree.root}
              selectedNodeId={selectedNodeId}
              editing={editing}
              onSelectNode={onSelectNode}
            />
          ) : (
            <p className="mm-doc-side-empty">No document open.</p>
          )}
        </div>
      )}
    </aside>
  );
}

function OutlineTree({
  root,
  selectedNodeId,
  editing,
  onSelectNode,
}: {
  root: MindMapTreeNode;
  selectedNodeId: string | null;
  editing: { nodeId: string; text: string } | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingScrollId = useRef<string | null>(null);
  const seenSelection = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedNodeId) return;
    const selectionChanged = seenSelection.current !== selectedNodeId;
    if (selectionChanged) {
      seenSelection.current = selectedNodeId;
      pendingScrollId.current = selectedNodeId;
    }
    if (!selectionChanged && !pendingScrollId.current) return;
    const ancestorIds = findNodePath(root, selectedNodeId).slice(0, -1).map((node) => node.id);
    if (ancestorIds.length === 0) return;
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ancestorIds) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [root, selectedNodeId]);

  useLayoutEffect(() => {
    const id = pendingScrollId.current;
    if (!id) return;
    const row = rowRefs.current.get(id);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest' });
    pendingScrollId.current = null;
  }, [collapsed, root, selectedNodeId]);

  const toggle = (nodeId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <div className="mm-doc-side-outline" role="tree" aria-label="Document outline">
        <OutlineNode
          node={root}
          depth={0}
          collapsed={collapsed}
          selectedNodeId={selectedNodeId}
          editing={editing}
          onToggle={toggle}
          onSelect={onSelectNode}
          rowRefs={rowRefs}
        />
    </div>
  );
}

function OutlineNode({
  node,
  depth,
  collapsed,
  selectedNodeId,
  editing,
  onToggle,
  onSelect,
  rowRefs,
}: {
  node: MindMapTreeNode;
  depth: number;
  collapsed: Set<string>;
  selectedNodeId: string | null;
  editing: { nodeId: string; text: string } | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  rowRefs: MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const selected = node.id === selectedNodeId;
  const label = firstLine(editing?.nodeId === node.id ? editing.text : node.text);

  return (
    <div role="none">
      <div
        role="treeitem"
        aria-selected={selected}
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        data-outline-id={node.id}
        ref={(el) => {
          if (el) rowRefs.current.set(node.id, el);
          else rowRefs.current.delete(node.id);
        }}
        className={`mm-doc-side-outline-row${selected ? ' is-selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="mm-doc-side-outline-chevron"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            onClick={() => onToggle(node.id)}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="mm-doc-side-outline-chevron mm-doc-side-outline-chevron--spacer" />
        )}
        <button
          type="button"
          className="mm-doc-side-outline-label"
          title={editing?.nodeId === node.id ? editing.text : node.text}
          onClick={() => onSelect(node.id)}
        >
          {label}
        </button>
      </div>
      {hasChildren && !isCollapsed && children.map((child) => (
          <OutlineNode
            key={child.id}
            node={child}
            depth={depth + 1}
            collapsed={collapsed}
            selectedNodeId={selectedNodeId}
            editing={editing}
            onToggle={onToggle}
            onSelect={onSelect}
            rowRefs={rowRefs}
          />
      ))}
    </div>
  );
}
