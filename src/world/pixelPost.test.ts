import { describe, expect, it } from 'vitest';
import { nearestPaletteIndex, pixelPalette } from './shared/pixelPost';

describe('pixelPost', () => {
  it('palette has 31 distinct colours', () => {
    const p = pixelPalette();
    expect(p.length).toBe(31);
    expect(new Set(p.map((c) => c.join())).size).toBe(31);
  });
  it('nearest colour of a palette colour is itself', () => {
    const p = pixelPalette();
    p.forEach((c, i) => expect(nearestPaletteIndex(c, p)).toBe(i));
  });
});
