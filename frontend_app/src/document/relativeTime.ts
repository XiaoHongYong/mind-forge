/**
 * Relative "modified ago" labels for the Recent sidebar list.
 * Prefer `modifiedAt` (last save); fall back to `openedAt` for older entries.
 */

import i18n from '../i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** e.g. `Modified 3 days ago` / `3天前修改`. Invalid / future dates return an empty string. */
export function formatRelativeModified(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const delta = now - then;
  if (delta < 0) return '';
  if (delta < MINUTE) return i18n.t('relativeTime.justNow', { defaultValue: 'Modified just now' });
  if (delta < HOUR) return i18n.t('relativeTime.minutesAgo', { count: Math.floor(delta / MINUTE), defaultValue: 'Modified {{count}} minutes ago' });
  if (delta < DAY) return i18n.t('relativeTime.hoursAgo', { count: Math.floor(delta / HOUR), defaultValue: 'Modified {{count}} hours ago' });
  if (delta < MONTH) return i18n.t('relativeTime.daysAgo', { count: Math.floor(delta / DAY), defaultValue: 'Modified {{count}} days ago' });
  if (delta < YEAR) return i18n.t('relativeTime.monthsAgo', { count: Math.floor(delta / MONTH), defaultValue: 'Modified {{count}} months ago' });
  return i18n.t('relativeTime.yearsAgo', { count: Math.floor(delta / YEAR), defaultValue: 'Modified {{count}} years ago' });
}
