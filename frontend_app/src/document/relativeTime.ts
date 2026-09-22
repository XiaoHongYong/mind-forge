/**
 * Relative "modified ago" labels for the Recent sidebar list.
 * Prefer `modifiedAt` (last save); fall back to `openedAt` for older entries.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** e.g. `3天前修改`, `刚刚修改`. Invalid / future dates return an empty string. */
export function formatRelativeModified(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const delta = now - then;
  if (delta < 0) return '';
  if (delta < MINUTE) return '刚刚修改';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}分钟前修改`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}小时前修改`;
  if (delta < MONTH) return `${Math.floor(delta / DAY)}天前修改`;
  if (delta < YEAR) return `${Math.floor(delta / MONTH)}个月前修改`;
  return `${Math.floor(delta / YEAR)}年前修改`;
}
