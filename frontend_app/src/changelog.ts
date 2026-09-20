/**
 * Single source of truth for the in-app changelog / "What's New".
 *
 * Changelog hygiene (keep these in sync on every release):
 *   1. Bump `version` in package.json.
 *   2. Set `APP_VERSION` below to the same value.
 *   3. Prepend a new entry to CHANGELOG with that version + today's date.
 *   4. Use the categories: 'feature' | 'improvement' | 'fix'. Keep lines short
 *      and user-facing (what changed for the user, not the implementation).
 *
 * The newest version must be the first array element, and `APP_VERSION` must
 * equal `CHANGELOG[0].version`.
 */

export const APP_VERSION = '0.6.2';

/**
 * localStorage key recording the last version whose "What's New" the user saw.
 * The popup tracks APP_VERSION, so the version is never hardcoded twice.
 */
export const WHATS_NEW_SEEN_KEY = 'mindforge-whats-new-seen';

export type ChangeKind = 'feature' | 'improvement' | 'fix';

export interface ChangeItem {
  kind: ChangeKind;
  title: string;
  desc?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string; // ISO yyyy-mm-dd
  highlights?: string;
  items: ChangeItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1',
    date: '2026-09-20',
    highlights: 'Initial release.',
    items: [
      {
        kind: 'feature',
        title: '',
        desc: '',
      },
    ],
  },
];
