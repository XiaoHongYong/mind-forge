import { isTauri } from '../storage';
import { getNativeMenuLabels } from './menuLabels';

/** Rebuild the desktop native menu with the current i18n labels. No-op in browser. */
export async function syncNativeMenu(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('rebuild_app_menu', { labels: getNativeMenuLabels() });
  } catch (err) {
    console.warn('Failed to rebuild native menu', err);
  }
}
