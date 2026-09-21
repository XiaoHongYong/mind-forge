export type { DocumentSession, RecentFileEntry } from './types';
export { createEmptyTree, titleFromPath, formatIdFromPath, newSessionId } from './types';
export { useDocumentStore } from './store';
export {
  newDocument,
  openDocumentFromPath,
  openDocumentViaDialog,
  restoreOrCreateNew,
  saveDocument,
  saveDocumentAs,
} from './io';
export {
  deleteUnsavedBackup,
  writeUnsavedBackup,
  readAppDataSlot,
  writeAppDataSlot,
  takeMatchingUnsavedBackup,
  takeUntitledUnsavedBackup,
  UNTITLED_BACKUP_KEY,
} from './unsavedBackup';
export {
  buildWorkspaceSnapshot,
  flushWorkspaceSave,
  installWorkspaceAutosave,
  restoreWorkspaceOnce,
  WORKSPACE_SLOT_KEY,
} from './workspace';
