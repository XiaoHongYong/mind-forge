import { useEffect, useState } from 'react';
import { SettingsModal, type SettingsTab } from './SettingsModal';
import { APP_VERSION, WHATS_NEW_SEEN_KEY } from '../changelog';

interface ThemePanelProps {
  initialTab?: SettingsTab;
  /** Open the What's New tab once per release. Set on one mount point only. */
  autoOpenWhatsNew?: boolean;
  /** Render as a labelled `.mm-btn` matching the editor toolbar's own buttons. */
  toolbarButton?: boolean;
  /** Render the gear button. Off when Settings is opened only from the app menu. */
  showButton?: boolean;
}

/**
 * Settings entry point. Renders a gear button that opens the tabbed
 * {@link SettingsModal} (Appearance / Interface / What's New / Help).
 */
export function ThemePanel({ initialTab = 'appearance', autoOpenWhatsNew = false, toolbarButton = false, showButton = true }: ThemePanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (!autoOpenWhatsNew) return;
    if (localStorage.getItem(WHATS_NEW_SEEN_KEY) === APP_VERSION) return;
    localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
    setTab('changelog');
    setOpen(true);
  }, [autoOpenWhatsNew]);

  // The native "Settings…" app-menu item (desktop/src-tauri/src/lib.rs) has
  // no view into React state, so it emits this event instead of calling in directly.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const fn = await listen('menu:command', (event) => {
          if (event.payload === 'app.settings') { setTab(initialTab); setOpen(true); }
        });
        if (cancelled) fn();
        else unlisten = fn;
      } catch {
        // Not running inside Tauri — no menu to bridge.
      }
    })();
    return () => { cancelled = true; unlisten?.(); };
  }, [initialTab]);

  return (
    <>
      {showButton && (
      <button
        type="button"
        onClick={() => { setTab(initialTab); setOpen(true); }}
        title="Settings"
        aria-label="Settings"
        data-label={toolbarButton ? 'Settings' : undefined}
        style={toolbarButton ? undefined : { color: 'var(--text-secondary)' }}
        className={toolbarButton ? 'mm-btn mm-essential' : 'rounded-lg p-1.5 transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'}
      >
        <svg className={toolbarButton ? undefined : 'h-5 w-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={toolbarButton ? 2 : 1.8}>
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      )}

      <SettingsModal open={open} onClose={() => setOpen(false)} initialTab={tab} />
    </>
  );
}

export default ThemePanel;
