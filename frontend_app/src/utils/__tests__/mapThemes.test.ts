import { describe, expect, it } from 'vitest';
import {
  buildThemeColorMap,
  fadeColorByDepth,
  getThemeColors,
  mixTowardWhite,
  resolveNodeThemeColor,
  RAINBOW_THEME_ID,
} from '../mapThemes';

describe('mapThemes', () => {
  it('resolves preset and rainbow palettes', () => {
    expect(getThemeColors('ocean')?.[0]).toBe('#0ea5e9');
    expect(getThemeColors(RAINBOW_THEME_ID)?.length).toBeGreaterThan(0);
    expect(getThemeColors(null)).toBeNull();
    expect(getThemeColors('nope')).toBeNull();
  });

  it('mixes toward white', () => {
    expect(mixTowardWhite('#000000', 0)).toBe('#000000');
    expect(mixTowardWhite('#000000', 1)).toBe('#ffffff');
    expect(mixTowardWhite('#0066cc', 0.5)).toBe('#80b3e6');
  });

  it('fades by depth with full strength at depth 1', () => {
    const base = '#0ea5e9';
    expect(fadeColorByDepth(base, 1)).toBe(base);
    expect(fadeColorByDepth(base, 2)).not.toBe(base);
    // Deeper is closer to white (higher R channel for a mid blue).
    const d2 = fadeColorByDepth(base, 2);
    const d4 = fadeColorByDepth(base, 4);
    expect(parseInt(d4.slice(1, 3), 16)).toBeGreaterThan(parseInt(d2.slice(1, 3), 16));
  });

  it('maps branch index and depth without touching root', () => {
    const root = {
      id: 'root',
      children: [
        {
          id: 'a',
          children: [{ id: 'a1', children: [{ id: 'a1a', children: [] }] }],
        },
        { id: 'b', children: [] },
      ],
    };
    const colors = ['#ff0000', '#00ff00'] as const;
    const map = buildThemeColorMap(root, colors);

    expect(map.has('root')).toBe(false);
    expect(map.get('a')).toBe('#ff0000');
    expect(map.get('b')).toBe('#00ff00');
    expect(map.get('a1')).toBe(fadeColorByDepth('#ff0000', 2));
    expect(map.get('a1a')).toBe(fadeColorByDepth('#ff0000', 3));
  });

  it('cycles colours when there are more branches than palette entries', () => {
    const root = {
      id: 'root',
      children: [
        { id: '0', children: [] },
        { id: '1', children: [] },
        { id: '2', children: [] },
      ],
    };
    const map = buildThemeColorMap(root, ['#111111', '#222222']);
    expect(map.get('0')).toBe('#111111');
    expect(map.get('1')).toBe('#222222');
    expect(map.get('2')).toBe('#111111');
  });

  it('lets explicit node colour win over theme', () => {
    expect(resolveNodeThemeColor('#abc123', '#ff0000')).toBe('#abc123');
    expect(resolveNodeThemeColor(null, '#ff0000')).toBe('#ff0000');
    expect(resolveNodeThemeColor(undefined, null)).toBeNull();
  });
});
