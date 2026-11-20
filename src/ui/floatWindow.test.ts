import { describe, expect, it } from 'vitest';
import { clampPan, clampRect, MIN_H, MIN_W, resizeRect } from './floatWindow';

describe('floatWindow geometry', () => {
  it('clamps the window into the viewport with a minimum size', () => {
    expect(clampRect({ x: -50, y: 900, w: 20, h: 10 }, 1000, 800)).toEqual({ x: 0, y: 800 - MIN_H, w: MIN_W, h: MIN_H });
    expect(clampRect({ x: 10, y: 10, w: 5000, h: 5000 }, 1000, 800)).toEqual({ x: 0, y: 0, w: 1000, h: 800 });
  });

  it('resizes freely from any edge keeping the opposite edge fixed', () => {
    const r = { x: 100, y: 100, w: 400, h: 300 };
    expect(resizeRect(r, 'se', -100, -250, 1000, 800)).toEqual({ x: 100, y: 100, w: 300, h: MIN_H });
    expect(resizeRect(r, 'nw', 50, 40, 1000, 800)).toEqual({ x: 150, y: 140, w: 350, h: 260 });
    expect(resizeRect(r, 'w', 1000, 0, 1000, 800)).toEqual({ x: 500 - MIN_W, y: 100, w: MIN_W, h: 300 });
    expect(resizeRect(r, 'e', 5000, 0, 1000, 800).w).toBe(900);
  });

  it('keeps the pan inside the content', () => {
    expect(clampPan(-10, 900, 720, 405, 250, 120)).toEqual({ px: 0, py: 285 });
    expect(clampPan(50, 50, 100, 100, 250, 120)).toEqual({ px: 0, py: 0 });
  });
});
