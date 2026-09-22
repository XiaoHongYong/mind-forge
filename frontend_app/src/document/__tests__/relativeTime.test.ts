import { describe, expect, it, beforeAll } from 'vitest';
import i18n from '../../i18n';
import { formatRelativeModified } from '../relativeTime';

describe('formatRelativeModified', () => {
  const now = Date.parse('2026-09-22T08:00:00.000Z');

  beforeAll(async () => {
    await i18n.changeLanguage('zh-CN');
  });

  it('returns empty for invalid timestamps', () => {
    expect(formatRelativeModified('', now)).toBe('');
    expect(formatRelativeModified('not-a-date', now)).toBe('');
  });

  it('says 刚刚修改 within a minute', () => {
    expect(formatRelativeModified('2026-09-22T07:59:30.000Z', now)).toBe('刚刚修改');
  });

  it('uses minutes, hours, and days', () => {
    expect(formatRelativeModified('2026-09-22T07:45:00.000Z', now)).toBe('15分钟前修改');
    expect(formatRelativeModified('2026-09-22T05:00:00.000Z', now)).toBe('3小时前修改');
    expect(formatRelativeModified('2026-09-19T08:00:00.000Z', now)).toBe('3天前修改');
  });

  it('uses months and years for older entries', () => {
    expect(formatRelativeModified('2026-07-22T08:00:00.000Z', now)).toBe('2个月前修改');
    expect(formatRelativeModified('2024-09-22T08:00:00.000Z', now)).toBe('2年前修改');
  });

  it('renders English when the active language is en', async () => {
    await i18n.changeLanguage('en');
    expect(formatRelativeModified('2026-09-22T07:59:30.000Z', now)).toBe('Modified just now');
    expect(formatRelativeModified('2026-09-22T07:45:00.000Z', now)).toBe('Modified 15 minutes ago');
    await i18n.changeLanguage('zh-CN');
  });
});
