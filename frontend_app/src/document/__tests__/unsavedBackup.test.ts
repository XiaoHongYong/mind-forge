import { describe, expect, it } from 'vitest';
import {
  shouldRestoreUnsavedBackup,
  UNTITLED_BACKUP_KEY,
} from '../unsavedBackup';

describe('shouldRestoreUnsavedBackup', () => {
  it('restores when hashes match', () => {
    expect(shouldRestoreUnsavedBackup('abc', 'abc')).toBe(true);
  });

  it('rejects when the file changed on disk', () => {
    expect(shouldRestoreUnsavedBackup('abc', 'def')).toBe(false);
  });

  it('rejects an empty recorded hash', () => {
    expect(shouldRestoreUnsavedBackup('', '')).toBe(false);
  });
});

describe('UNTITLED_BACKUP_KEY', () => {
  it('is a stable non-path sentinel for never-saved buffers', () => {
    expect(UNTITLED_BACKUP_KEY).toBe('__mindforge_untitled__');
    expect(UNTITLED_BACKUP_KEY.includes('/') || UNTITLED_BACKUP_KEY.includes('\\')).toBe(false);
  });
});
