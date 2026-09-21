import { describe, expect, it } from 'vitest';
import { panDeltaToReveal } from '../viewportPan';

const box = { x: 0, y: 0, w: 80, h: 36 };
const canvas = { width: 800, height: 600 };

describe('panDeltaToReveal', () => {
  it('shifts a node that sits on the left edge into the canvas', () => {
    const delta = panDeltaToReveal(box, { x: 10, y: 200 }, 1, canvas);
    expect(delta.x).toBe(50);
    expect(delta.y).toBe(0);
  });

  it('shifts a node whose right edge is past the canvas, even when a wider editor shell would still contain it', () => {
    // Left edge at 760, right edge at 840. Shell width 1100 (canvas plus a
    // 300px sidebar) would treat 840 as inside (1100 - 60). The canvas does not.
    const delta = panDeltaToReveal(box, { x: 760, y: 200 }, 1, canvas);
    expect(delta).toEqual({ x: 800 - 60 - (760 + 80), y: 0 });
    expect(delta.x).toBeLessThan(0);
  });

  it('shifts a node past the canvas bottom edge, even when the shell includes the status bar', () => {
    const delta = panDeltaToReveal(box, { x: 200, y: 560 }, 1, canvas);
    expect(delta.x).toBe(0);
    expect(delta.y).toBe(600 - 60 - (560 + 36));
  });

  it('leaves a node that is already inside the canvas', () => {
    expect(panDeltaToReveal(box, { x: 200, y: 200 }, 1, canvas)).toEqual({ x: 0, y: 0 });
  });
});
