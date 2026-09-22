import { isTauri } from '../storage';
import { fromBase64, toBase64 } from '../utils/base64';
import i18n from '../i18n';

function openFilters() {
  return [
    {
      name: i18n.t('filters.mindMaps', { defaultValue: 'Mind maps' }),
      extensions: ['mmforge', 'md', 'mm', 'wxml', 'xml', 'xmind'],
    },
  ];
}

function saveFilters() {
  return [
    { name: i18n.t('filters.mindforge', { defaultValue: 'MindForge' }), extensions: ['mmforge'] },
    { name: i18n.t('filters.markdown', { defaultValue: 'Markdown' }), extensions: ['md'] },
    { name: i18n.t('filters.freemindFreeplane', { defaultValue: 'FreeMind / FreePlane' }), extensions: ['mm'] },
    { name: i18n.t('filters.wisemapping', { defaultValue: 'WiseMapping' }), extensions: ['wxml'] },
    { name: i18n.t('filters.xmind', { defaultValue: 'XMind' }), extensions: ['xmind'] },
  ];
}

export async function readFileBytes(path: string): Promise<Uint8Array> {
  if (!isTauri()) {
    throw new Error('Reading absolute paths requires the desktop app');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const bytes = await invoke<number[]>('read_user_file', { path });
  return new Uint8Array(bytes);
}

export async function writeFileBytes(path: string, bytes: Uint8Array): Promise<void> {
  if (!isTauri()) {
    throw new Error('Writing absolute paths requires the desktop app');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('write_user_file', { path, dataBase64: toBase64(bytes) });
}

/** Native open dialog → absolute path, or null if cancelled. */
export async function pickOpenPath(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    filters: openFilters(),
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

/** Native save dialog → absolute path, or null if cancelled. */
export async function pickSavePath(defaultPath: string): Promise<string | null> {
  if (!isTauri()) return null;
  const { save } = await import('@tauri-apps/plugin-dialog');
  const selected = await save({
    defaultPath,
    filters: saveFilters(),
  });
  return selected ?? null;
}

/** Browser fallback: open via hidden file input. */
export function pickBrowserFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export { fromBase64, toBase64 };
