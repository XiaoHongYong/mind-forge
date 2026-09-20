import { isTauri } from '../storage';

export const DEFAULT_WINDOW_CAPTION = 'MindForge — Local Mind Maps';

/** Sets the OS window caption (Tauri) and `document.title` (browser). */
export async function setWindowCaption(caption: string): Promise<void> {
  const next = caption.trim() || DEFAULT_WINDOW_CAPTION;
  if (typeof document !== 'undefined') {
    document.title = next;
  }
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTitle(next);
  } catch {
    // Ignore — browser / non-window shells have no caption to update.
  }
}

/** Document name for the caption: `MyMap.mm — MindForge`. */
export function documentWindowCaption(fileLabel: string): string {
  const label = fileLabel.trim() || 'Untitled';
  return `${label} — MindForge`;
}
