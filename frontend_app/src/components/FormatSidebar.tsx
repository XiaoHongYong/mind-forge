/**
 * Right-hand Format sidebar — Style (selected node) and Canvas (map) tabs.
 * MVP: fill / font size / bold / text colour + canvas bg / grid / layout / align.
 */

import { useCallback, useEffect, useId, useRef, useState, type JSX } from 'react';
import type { MapStyle, MindMapTreeNode, NodeShape } from '../types';
import { CANVAS_COLOR_PRESETS, COLOR_PALETTE, NODE_BASE_FONT_SIZE } from './MindMapConstants';
import { DynamicLucideIcon } from './DynamicLucideIcon';
import { CURATED_ICON_NAMES } from './lucideIconRegistry';
import {
  FONT_FAMILY_OPTIONS,
  MAP_COLOR_THEMES,
  RAINBOW_BRANCH_COLORS,
  RAINBOW_THEME_ID,
} from '../utils/mapThemes';
import './FormatSidebar.css';

export type FormatSidebarTab = 'style' | 'canvas';
export type RootLayoutMode = 'tree' | 'map';

const FONT_SIZE_OPTIONS = [10, 12, 13, 14, 16, 18, 20, 24] as const;
const EDGE_WIDTH_OPTIONS = [1, 1.5, 2, 2.5, 3, 4] as const;
type ShapeOptionId = NodeShape | 'auto';
const SHAPE_OPTIONS: { id: ShapeOptionId; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'ellipse', label: 'Ellipse' },
];
const SIDEBAR_ICON_PREVIEW = CURATED_ICON_NAMES.slice(0, 24);

function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Glyph for a topic outline shape (used in the shape dropdown). */
function ShapeGlyph({ kind, size = 18 }: { kind: ShapeOptionId; size?: number }): JSX.Element {
  const stroke = 'currentColor';
  const sw = 1.75;
  if (kind === 'auto') {
    // Dashed rounded rect = “follow default”
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4.5" y="6.5" width="15" height="11" rx="3" stroke={stroke} strokeWidth={sw} strokeDasharray="2.5 2" />
      </svg>
    );
  }
  if (kind === 'rounded') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4.5" y="6.5" width="15" height="11" rx="3.5" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (kind === 'rect') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4.5" y="6.5" width="15" height="11" rx="0.5" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (kind === 'capsule') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="8" width="17" height="8" rx="4" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="12" rx="7.5" ry="5.5" stroke={stroke} strokeWidth={sw} />
    </svg>
  );
}

/** Dropdown: trigger shows the current shape icon; panel is icon-only options. */
function ShapeDropdown({
  current,
  onSelect,
}: {
  current: ShapeOptionId;
  onSelect: (shape: NodeShape | null) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const currentLabel = SHAPE_OPTIONS.find((o) => o.id === current)?.label ?? 'Auto';

  const close = useCallback(() => setOpen(false), []);

  const updatePanelPos = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const estimatedH = 56;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < estimatedH && rect.top > spaceBelow;
    setPanelPos({
      top: openUp ? Math.max(8, rect.top - estimatedH - gap) : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 200),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onReposition = () => updatePanelPos();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onReposition);
    document.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onReposition);
      document.removeEventListener('scroll', onReposition, true);
    };
  }, [open, close, updatePanelPos]);

  useEffect(() => {
    if (!open || !panelRef.current || !triggerRef.current) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const h = panel.getBoundingClientRect().height;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < h && rect.top > spaceBelow;
    setPanelPos({
      top: openUp ? Math.max(8, rect.top - h - gap) : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 200),
    });
  }, [open]);

  const pick = (id: ShapeOptionId) => {
    onSelect(id === 'auto' ? null : id);
    close();
  };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 200) });
    }
    setOpen(true);
  };

  return (
    <div className="mm-fs-shape-dd" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`mm-fs-shape-dd-trigger${open ? ' mm-fs-shape-dd-trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Shape: ${currentLabel}`}
        title={currentLabel}
        onClick={toggle}
      >
        <span className="mm-fs-shape-dd-current" aria-hidden>
          <ShapeGlyph kind={current} size={20} />
        </span>
        <svg className="mm-fs-color-dd-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && panelPos && (
        <div
          ref={panelRef}
          className="mm-fs-color-dd-panel mm-fs-shape-dd-panel"
          id={listId}
          role="listbox"
          aria-label="Shape"
          style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
        >
          <div className="mm-fs-shape-dd-options">
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={current === opt.id}
                aria-label={opt.label}
                title={opt.label}
                className={`mm-fs-shape-opt${current === opt.id ? ' mm-fs-shape-opt--active' : ''}`}
                onClick={() => pick(opt.id)}
              >
                <ShapeGlyph kind={opt.id} size={22} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact dropdown colour control: trigger shows current colour, panel holds swatches. */
function ColorDropdown({
  label,
  current,
  onSelect,
  allowClear,
  clearLabel = 'Default',
  presets = COLOR_PALETTE,
  placeholderLabel = 'Default',
  placeholderSwatch,
}: {
  label: string;
  current: string | null;
  onSelect: (color: string | null) => void;
  allowClear?: boolean;
  clearLabel?: string;
  presets?: readonly string[];
  placeholderLabel?: string;
  /** Shown on the trigger when `current` is null (e.g. theme canvas default). */
  placeholderSwatch?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const close = useCallback(() => setOpen(false), []);

  const updatePanelPos = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const estimatedH = 120;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < estimatedH && rect.top > spaceBelow;
    setPanelPos({
      top: openUp ? Math.max(8, rect.top - estimatedH - gap) : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onReposition = () => updatePanelPos();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onReposition);
    // Sidebar body scrolls; reposition so the panel stays under the trigger.
    document.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onReposition);
      document.removeEventListener('scroll', onReposition, true);
    };
  }, [open, close, updatePanelPos]);

  // After paint, refine vertical placement using the real panel height.
  useEffect(() => {
    if (!open || !panelRef.current || !triggerRef.current) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const h = panel.getBoundingClientRect().height;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < h && rect.top > spaceBelow;
    setPanelPos({
      top: openUp ? Math.max(8, rect.top - h - gap) : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
    });
  }, [open]);

  const displayLabel = current ?? placeholderLabel;
  const triggerSwatch = current ?? placeholderSwatch ?? null;

  const pick = (color: string | null) => {
    onSelect(color);
    close();
  };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(true);
  };

  return (
    <div className="mm-fs-color-dd" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`mm-fs-color-dd-trigger${open ? ' mm-fs-color-dd-trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={toggle}
      >
        <span
          className={`mm-fs-color-dd-chip${triggerSwatch == null ? ' mm-fs-color-dd-chip--empty' : ''}`}
          style={triggerSwatch ? { background: triggerSwatch } : undefined}
          aria-hidden
        >
          {triggerSwatch == null && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="4" y1="4" x2="20" y2="20" /></svg>
          )}
        </span>
        <span className="mm-fs-color-dd-value">{displayLabel}</span>
        <svg className="mm-fs-color-dd-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && panelPos && (
        <div
          ref={panelRef}
          className="mm-fs-color-dd-panel"
          id={listId}
          role="listbox"
          aria-label={label}
          style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
        >
          <div className="mm-fs-swatches">
            {allowClear && (
              <button
                type="button"
                role="option"
                aria-selected={current == null}
                className={`mm-fs-swatch mm-fs-swatch--clear${current == null ? ' mm-fs-swatch--active' : ''}`}
                title={clearLabel}
                onClick={() => pick(null)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="4" y1="4" x2="20" y2="20" /></svg>
              </button>
            )}
            {presets.map((c) => (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={current?.toLowerCase() === c.toLowerCase()}
                className={`mm-fs-swatch${current?.toLowerCase() === c.toLowerCase() ? ' mm-fs-swatch--active' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => pick(c)}
              />
            ))}
            <label className="mm-fs-swatch mm-fs-swatch--custom" title="Custom colour">
              <input
                type="color"
                value={isHexColor(current) ? current : (placeholderSwatch && isHexColor(placeholderSwatch) ? placeholderSwatch : '#6366f1')}
                onChange={(e) => pick(e.target.value)}
                aria-label={`${label} custom colour`}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export interface FormatSidebarProps {
  selectedNode: MindMapTreeNode | null;
  /** True when the selected node is a direct child of root (side control applies). */
  isRootChild: boolean;
  activeTab: FormatSidebarTab;
  onActiveTabChange: (tab: FormatSidebarTab) => void;
  layoutMode: RootLayoutMode;
  canvasColor: string | null;
  themeMode: 'dark' | 'light';
  canvasGridVisible: boolean;
  mapStyle: MapStyle;
  zoom: number;
  focusMode: boolean;
  colourTrayEnabled: boolean;
  iconTrayEnabled: boolean;
  onSetFillColor: (color: string | null) => void;
  onSetTextColor: (color: string | null) => void;
  onSetFontSize: (size: number | null) => void;
  onSetFontWeight: (weight: 'normal' | 'bold' | null) => void;
  onSetShape: (shape: NodeShape | null) => void;
  onSetBorderColor: (color: string | null) => void;
  onSetEdgeColor: (color: string | null) => void;
  onSetEdgeWidth: (width: number | null) => void;
  onSetSide: (side: 'left' | 'right') => void;
  onToggleIcon: (iconName: string | null) => void;
  onOpenIconTray: () => void;
  onSetCanvasColor: (color: string | null) => void;
  onSetCanvasGridVisible: (visible: boolean) => void;
  onSetLayoutMode: (mode: RootLayoutMode) => void;
  onAutoAlign: () => void;
  onSetColorTheme: (themeId: string | null) => void;
  onSetMapStyle: (patch: Partial<MapStyle>) => void;
  onToggleFocusMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
  onClose: () => void;
}

export function FormatSidebar({
  selectedNode,
  isRootChild,
  activeTab,
  onActiveTabChange,
  layoutMode,
  canvasColor,
  themeMode,
  canvasGridVisible,
  mapStyle,
  zoom,
  focusMode,
  colourTrayEnabled,
  iconTrayEnabled,
  onSetFillColor,
  onSetTextColor,
  onSetFontSize,
  onSetFontWeight,
  onSetShape,
  onSetBorderColor,
  onSetEdgeColor,
  onSetEdgeWidth,
  onSetSide,
  onToggleIcon,
  onOpenIconTray,
  onSetCanvasColor,
  onSetCanvasGridVisible,
  onSetLayoutMode,
  onAutoAlign,
  onSetColorTheme,
  onSetMapStyle,
  onToggleFocusMode,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  onClose,
}: FormatSidebarProps): JSX.Element {
  const activeThemeId = mapStyle.colorThemeId ?? null;
  const docBase = mapStyle.defaultFontSize ?? NODE_BASE_FONT_SIZE;
  const effectiveFontSize = selectedNode?.fontSize ?? docBase;
  const isBold = selectedNode
    ? selectedNode.fontWeight === 'bold'
      || (selectedNode.fontWeight == null && selectedNode.id === 'root')
    : false;
  const boldIsExplicit = selectedNode?.fontWeight != null;
  const themeCanvasDefault = themeMode === 'dark' ? '#0f172a' : '#f1f5f9';
  const shapeValue: NodeShape | 'auto' = selectedNode?.shape ?? 'auto';
  const zoomPct = Math.round(zoom * 100);

  return (
    <aside className="mm-format-sidebar" aria-label="Format">
      <div className="mm-fs-header">
        <div className="mm-fs-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'style'}
            className={`mm-fs-tab${activeTab === 'style' ? ' mm-fs-tab--active' : ''}`}
            onClick={() => onActiveTabChange('style')}
          >
            Style
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'canvas'}
            className={`mm-fs-tab${activeTab === 'canvas' ? ' mm-fs-tab--active' : ''}`}
            onClick={() => onActiveTabChange('canvas')}
          >
            Canvas
          </button>
        </div>
        <button type="button" className="mm-fs-close" onClick={onClose} title="Close format panel" aria-label="Close format panel">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="mm-fs-body">
        {activeTab === 'style' && (
          selectedNode ? (
            <>
              <p className="mm-fs-hint mm-fs-hint--top">
                Colour / Icon trays stay available for quick edits
                {colourTrayEnabled || iconTrayEnabled ? ' (currently docked).' : '.'}
              </p>

              <section className="mm-fs-section">
                <h3 className="mm-fs-label">Shape</h3>
                <ShapeDropdown
                  current={shapeValue}
                  onSelect={onSetShape}
                />
              </section>

              <section className="mm-fs-section">
                <h3 className="mm-fs-label">Fill</h3>
                <ColorDropdown
                  label="Fill colour"
                  current={selectedNode.color ?? null}
                  onSelect={onSetFillColor}
                  allowClear
                  clearLabel="Default fill"
                  placeholderLabel="Default"
                />
                <div className="mm-fs-row mm-fs-row--color">
                  <span className="mm-fs-field-label">Border</span>
                  <ColorDropdown
                    label="Border colour"
                    current={selectedNode.borderColor ?? null}
                    onSelect={onSetBorderColor}
                    allowClear
                    clearLabel="Default border"
                    placeholderLabel="Default"
                  />
                </div>
              </section>

              <section className="mm-fs-section">
                <h3 className="mm-fs-label">Text</h3>
                <div className="mm-fs-row">
                  <label className="mm-fs-field-label" htmlFor="mm-fs-font-size">Size</label>
                  <select
                    id="mm-fs-font-size"
                    className="mm-fs-select"
                    value={selectedNode.fontSize ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      onSetFontSize(v === '' ? null : Number(v));
                    }}
                  >
                    <option value="">Doc default ({docBase})</option>
                    {FONT_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}px</option>
                    ))}
                    {selectedNode.fontSize != null
                      && !(FONT_SIZE_OPTIONS as readonly number[]).includes(selectedNode.fontSize) && (
                      <option value={selectedNode.fontSize}>{selectedNode.fontSize}px</option>
                    )}
                  </select>
                </div>
                <div className="mm-fs-row">
                  <span className="mm-fs-field-label">Weight</span>
                  <div className="mm-fs-btn-group">
                    <button
                      type="button"
                      className={`mm-fs-chip${selectedNode.fontWeight == null ? ' mm-fs-chip--active' : ''}`}
                      onClick={() => onSetFontWeight(null)}
                      title="Theme default"
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      className={`mm-fs-chip${boldIsExplicit && !isBold ? ' mm-fs-chip--active' : ''}`}
                      onClick={() => onSetFontWeight('normal')}
                      title="Regular"
                    >
                      Regular
                    </button>
                    <button
                      type="button"
                      className={`mm-fs-chip${boldIsExplicit && isBold ? ' mm-fs-chip--active' : ''}`}
                      style={{ fontWeight: 700 }}
                      onClick={() => onSetFontWeight('bold')}
                      title="Bold"
                    >
                      Bold
                    </button>
                  </div>
                </div>
                <p className="mm-fs-hint">Effective base size: {Math.round(effectiveFontSize)}px</p>
                <div className="mm-fs-row mm-fs-row--color">
                  <span className="mm-fs-field-label">Colour</span>
                  <ColorDropdown
                    label="Text colour"
                    current={selectedNode.textColor ?? null}
                    onSelect={onSetTextColor}
                    allowClear
                    clearLabel="Default text colour"
                    placeholderLabel="Default"
                  />
                </div>
              </section>

              {selectedNode.id !== 'root' && (
                <section className="mm-fs-section">
                  <h3 className="mm-fs-label">Branch</h3>
                  <div className="mm-fs-row mm-fs-row--color">
                    <span className="mm-fs-field-label">Line</span>
                    <ColorDropdown
                      label="Branch line colour"
                      current={selectedNode.edgeColor ?? null}
                      onSelect={onSetEdgeColor}
                      allowClear
                      clearLabel="Follow fill / map default"
                      placeholderLabel="Auto"
                    />
                  </div>
                  <div className="mm-fs-row">
                    <label className="mm-fs-field-label" htmlFor="mm-fs-edge-width">Width</label>
                    <select
                      id="mm-fs-edge-width"
                      className="mm-fs-select"
                      value={selectedNode.edgeWidth ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        onSetEdgeWidth(v === '' ? null : Number(v));
                      }}
                    >
                      <option value="">Default (2)</option>
                      {EDGE_WIDTH_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}px</option>
                      ))}
                    </select>
                  </div>
                </section>
              )}

              {isRootChild && (
                <section className="mm-fs-section">
                  <h3 className="mm-fs-label">Side</h3>
                  <div className="mm-fs-btn-group">
                    <button
                      type="button"
                      className={`mm-fs-chip${(selectedNode.side ?? 'right') === 'left' ? ' mm-fs-chip--active' : ''}`}
                      onClick={() => onSetSide('left')}
                    >
                      Left
                    </button>
                    <button
                      type="button"
                      className={`mm-fs-chip${(selectedNode.side ?? 'right') === 'right' ? ' mm-fs-chip--active' : ''}`}
                      onClick={() => onSetSide('right')}
                    >
                      Right
                    </button>
                  </div>
                  {layoutMode === 'tree' && (
                    <p className="mm-fs-hint">Choosing Left switches the map to Map layout.</p>
                  )}
                </section>
              )}

              <section className="mm-fs-section">
                <h3 className="mm-fs-label">Icons</h3>
                <div className="mm-fs-icon-grid">
                  <button
                    type="button"
                    className="mm-fs-icon-btn mm-fs-icon-btn--clear"
                    title="Clear icons"
                    onClick={() => onToggleIcon(null)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                  {SIDEBAR_ICON_PREVIEW.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`mm-fs-icon-btn${(selectedNode.icons ?? []).includes(name) ? ' mm-fs-icon-btn--active' : ''}`}
                      title={name}
                      onClick={() => onToggleIcon(name)}
                    >
                      <DynamicLucideIcon name={name} size={16} />
                    </button>
                  ))}
                </div>
                <button type="button" className="mm-fs-action mm-fs-action--ghost" onClick={onOpenIconTray}>
                  {iconTrayEnabled ? 'Focus icon tray' : 'Open icon tray'}
                </button>
              </section>
            </>
          ) : (
            <div className="mm-fs-empty">
              <p>Select a topic to edit its style.</p>
            </div>
          )
        )}

        {activeTab === 'canvas' && (
          <>
            <section className="mm-fs-section">
              <h3 className="mm-fs-label">Background</h3>
              <ColorDropdown
                label="Canvas background"
                current={canvasColor}
                onSelect={onSetCanvasColor}
                allowClear
                clearLabel="Match theme"
                presets={CANVAS_COLOR_PRESETS}
                placeholderLabel="Match theme"
                placeholderSwatch={themeCanvasDefault}
              />
              <p className="mm-fs-hint">Device preference — not stored in the document.</p>
            </section>

            <section className="mm-fs-section">
              <h3 className="mm-fs-label">Grid</h3>
              <label className="mm-fs-toggle">
                <input
                  type="checkbox"
                  checked={canvasGridVisible}
                  onChange={(e) => onSetCanvasGridVisible(e.target.checked)}
                />
                <span>Show dot grid</span>
              </label>
            </section>

            <section className="mm-fs-section">
              <h3 className="mm-fs-label">Colour theme</h3>
              <p className="mm-fs-hint" style={{ marginBottom: 8 }}>
                Colours branches by index; deeper nodes fade. Nodes with their own fill keep it.
              </p>
              <div className="mm-fs-theme-list">
                {MAP_COLOR_THEMES.map((theme) => {
                  const active = activeThemeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      className={`mm-fs-theme-btn${active ? ' mm-fs-theme-btn--active' : ''}`}
                      title={active ? `Clear ${theme.name}` : `Apply ${theme.name}`}
                      aria-pressed={active}
                      onClick={() => onSetColorTheme(active ? null : theme.id)}
                    >
                      <span className="mm-fs-theme-swatches" aria-hidden>
                        {theme.colors.slice(0, 5).map((c) => (
                          <span key={c} style={{ background: c }} />
                        ))}
                      </span>
                      <span>{theme.name}</span>
                    </button>
                  );
                })}
                {(() => {
                  const active = activeThemeId === RAINBOW_THEME_ID;
                  return (
                    <button
                      type="button"
                      className={`mm-fs-theme-btn${active ? ' mm-fs-theme-btn--active' : ''}`}
                      title={active ? 'Clear Rainbow' : 'Rainbow branches'}
                      aria-pressed={active}
                      onClick={() => onSetColorTheme(active ? null : RAINBOW_THEME_ID)}
                    >
                      <span className="mm-fs-theme-swatches" aria-hidden>
                        {RAINBOW_BRANCH_COLORS.slice(0, 5).map((c) => (
                          <span key={c} style={{ background: c }} />
                        ))}
                      </span>
                      <span>Rainbow</span>
                    </button>
                  );
                })()}
              </div>
            </section>

            <section className="mm-fs-section">
              <h3 className="mm-fs-label">Map defaults</h3>
              <div className="mm-fs-row">
                <label className="mm-fs-field-label" htmlFor="mm-fs-doc-font">Font</label>
                <select
                  id="mm-fs-doc-font"
                  className="mm-fs-select"
                  value={mapStyle.defaultFontFamily ?? FONT_FAMILY_OPTIONS[0].value}
                  onChange={(e) => onSetMapStyle({ defaultFontFamily: e.target.value })}
                >
                  {FONT_FAMILY_OPTIONS.map((f) => (
                    <option key={f.id} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="mm-fs-row">
                <label className="mm-fs-field-label" htmlFor="mm-fs-doc-size">Size</label>
                <select
                  id="mm-fs-doc-size"
                  className="mm-fs-select"
                  value={mapStyle.defaultFontSize ?? NODE_BASE_FONT_SIZE}
                  onChange={(e) => onSetMapStyle({ defaultFontSize: Number(e.target.value) })}
                >
                  {FONT_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}px</option>
                  ))}
                </select>
              </div>
              <div className="mm-fs-row mm-fs-row--color">
                <span className="mm-fs-field-label">Edge</span>
                <ColorDropdown
                  label="Default branch colour"
                  current={mapStyle.defaultEdgeColor ?? null}
                  onSelect={(c) => onSetMapStyle({ defaultEdgeColor: c })}
                  allowClear
                  clearLabel="Theme accent"
                  placeholderLabel="Theme accent"
                />
              </div>
              <p className="mm-fs-hint">Saved with the document.</p>
            </section>

            <section className="mm-fs-section">
              <h3 className="mm-fs-label">Layout</h3>
              <div className="mm-fs-btn-group">
                <button
                  type="button"
                  className={`mm-fs-chip${layoutMode === 'map' ? ' mm-fs-chip--active' : ''}`}
                  onClick={() => onSetLayoutMode('map')}
                >
                  Map
                </button>
                <button
                  type="button"
                  className={`mm-fs-chip${layoutMode === 'tree' ? ' mm-fs-chip--active' : ''}`}
                  onClick={() => onSetLayoutMode('tree')}
                >
                  Tree
                </button>
              </div>
              <button type="button" className="mm-fs-action" onClick={onAutoAlign}>
                Auto-align {selectedNode && selectedNode.id !== 'root' ? 'subtree' : 'all'}
              </button>
              <button
                type="button"
                className={`mm-fs-action${focusMode ? ' mm-fs-action--active' : ''}`}
                onClick={onToggleFocusMode}
              >
                Focus mode {focusMode ? 'on' : 'off'}
              </button>
            </section>

            <section className="mm-fs-section">
              <h3 className="mm-fs-label">Zoom</h3>
              <div className="mm-fs-zoom-row">
                <button type="button" className="mm-fs-chip" onClick={onZoomOut} title="Zoom out">−</button>
                <span className="mm-fs-zoom-pct">{zoomPct}%</span>
                <button type="button" className="mm-fs-chip" onClick={onZoomIn} title="Zoom in">+</button>
                <button type="button" className="mm-fs-chip" onClick={onZoomReset} title="Reset to 100%">100%</button>
                <button type="button" className="mm-fs-chip" onClick={onZoomFit} title="Fit view">Fit</button>
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

export default FormatSidebar;
