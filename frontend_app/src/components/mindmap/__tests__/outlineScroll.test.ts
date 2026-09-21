import { describe, expect, it } from 'vitest';
import { scrollDeltaToReveal } from '../outlineScroll';

describe('scrollDeltaToReveal', () => {
  const top = 100;
  const bottom = 400;

  it('scrolls up when the row is above the outline', () => {
    expect(scrollDeltaToReveal(top, bottom, 40, 70)).toBe(-60);
  });

  it('scrolls down when the row is below the outline', () => {
    expect(scrollDeltaToReveal(top, bottom, 420, 450)).toBe(50);
  });

  it('leaves a row that is already visible', () => {
    expect(scrollDeltaToReveal(top, bottom, 180, 210)).toBe(0);
  });
});
