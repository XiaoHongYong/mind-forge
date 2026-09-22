import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zhCN from '../locales/zh-CN.json';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flatten(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('locale catalogs', () => {
  it('keeps en and zh-CN key trees identical', () => {
    const enKeys = new Set(flatten(en as Record<string, unknown>));
    const zhKeys = new Set(flatten(zhCN as Record<string, unknown>));
    const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k)).sort();
    const extraInZh = [...zhKeys].filter((k) => !enKeys.has(k)).sort();
    expect({ missingInZh, extraInZh }).toEqual({ missingInZh: [], extraInZh: [] });
  });

  it('has no empty English values', () => {
    const empties = flatten(en as Record<string, unknown>).filter((path) => {
      const parts = path.split('.');
      let cur: unknown = en;
      for (const p of parts) cur = (cur as Record<string, unknown>)[p];
      return typeof cur !== 'string' || cur.trim() === '';
    });
    expect(empties).toEqual([]);
  });
});
