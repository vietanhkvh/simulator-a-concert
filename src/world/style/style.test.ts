import { describe, expect, it } from 'vitest';
import {
  PAL, PAL_HEX, auroraAmount, hexToRgb, hypeColors, hypeMix, hypeState, mixHex, outlinePx, popScale,
  rgbToHsl, shadowOf, shade, ZONE_SAT,
} from './index';

const lum = (hex: number) => { const [r, g, b] = hexToRgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

describe('palette', () => {
  it('hex string matches number', () => {
    expect(PAL_HEX.berry[500]).toBe('#ff5fa8');
    expect(hexToRgb(PAL.night[700])[2]).toBeCloseTo(0x18 / 255);
    expect(mixHex(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
  it('hypeState thresholds', () => {
    expect(hypeState(0.39)).toBe('cool'); expect(hypeState(0.4)).toBe('warm'); expect(hypeState(0.8)).toBe('vivid');
  });
  it('hypeMix sums to 1', () => {
    for (let h = 0; h <= 1; h += 0.01) expect(hypeMix(h).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it('hypeColors continuous (no jump > 0.05 per 0.01)', () => {
    let prev = hypeColors(0);
    for (let i = 1; i <= 100; i++) {
      const cur = hypeColors(i / 100);
      for (const k of ['primary', 'secondary', 'accent'] as const)
        for (let c = 0; c < 3; c++) expect(Math.abs(cur[k][c]! - prev[k][c]!)).toBeLessThanOrEqual(0.05);
      prev = cur;
    }
  });
  it('auroraAmount gating and monotonic', () => {
    for (let h = 0; h <= 0.4; h += 0.01) expect(auroraAmount(h)).toBe(0);
    expect(auroraAmount(0.4)).toBe(0);
    for (let h = 0.55; h <= 1.0001; h += 0.01) expect(auroraAmount(h)).toBe(1);
    let p = 0;
    for (let i = 0; i <= 100; i++) { const a = auroraAmount(i / 100); expect(a).toBeGreaterThanOrEqual(p); p = a; }
  });
  it('shade applies zone saturation', () => {
    const s0 = rgbToHsl(hexToRgb(PAL.berry[500]))[1];
    expect(rgbToHsl(hexToRgb(shade(PAL.berry[500], 'arena')))[1]).toBeCloseTo(s0, 1);
    expect(rgbToHsl(hexToRgb(shade(PAL.berry[500], 'stands')))[1]).toBeCloseTo(s0 * ZONE_SAT.stands, 1);
  });
  it('shadowOf: not darker than night-700, not greyer, shifts toward purple', () => {
    const inputs = [0x000000, 0x808080, 0xffffff, ...Object.values(PAL).flatMap((m) => Object.values(m))];
    for (const c of inputs) {
      const o = shadowOf(c);
      expect(lum(o)).toBeGreaterThanOrEqual(lum(PAL.night[700]));
      // "không xám hơn" đo bằng HSV-S (sắc độ / độ sáng). HSL-S cũ buộc màu nhạt (kem, tóc vàng) thành cam rực trong bóng.
      expect(hsvS(o)).toBeGreaterThanOrEqual(hsvS(c) - 0.02);
    }
    expect(lum(shadowOf(PAL.peach[500]))).toBeLessThan(lum(PAL.peach[500]));
    // màu ấm không bị xoay về đỏ / cam (lỗi "mật ong → đỏ", "tóc vàng ngả cam"); màu lạnh / hồng ngả về tím.
    const hue = (x: number) => rgbToHsl(hexToRgb(x))[0];
    const towardRed = (c: number) => { const d = ((hue(c) - hue(shadowOf(c)) + 540) % 360) - 180; return d; };
    for (const c of [PAL.honey[500], PAL.honey[700], PAL.peach[500]]) expect(towardRed(c)).toBeLessThan(6);
    // màu nhạt: bóng ngả lavender (xanh tím tăng so với đỏ), không ngả cam
    const br = (x: number) => { const v = hexToRgb(x); return v[2] / Math.max(v[0], 1e-3); };
    for (const c of [PAL.honey[300], PAL.cream[500], PAL.cream[300], 0xf6e0a8]) expect(br(shadowOf(c))).toBeGreaterThanOrEqual(br(c) - 0.005);
    for (const c of [PAL.soda[500], PAL.mint[500]]) expect(hue(shadowOf(c))).toBeGreaterThan(hue(c));
    // L ≈ 0,72 × gốc
    const L = (x: number) => rgbToHsl(hexToRgb(x))[2];
    expect(L(shadowOf(PAL.honey[500])) / L(PAL.honey[500])).toBeCloseTo(0.72, 1);
  });
});

function hsvS(x: number): number { const c = hexToRgb(x); const mx = Math.max(...c), mn = Math.min(...c); return mx > 0 ? (mx - mn) / mx : 0; }

describe('form', () => {
  it('popScale curve', () => {
    expect(popScale(0)).toBe(0);
    let max = 0;
    for (let t = 0; t <= 0.25; t += 0.001) max = Math.max(max, popScale(t));
    expect(max).toBeCloseTo(1.15, 2);
    expect(popScale(0.25)).toBe(1); expect(popScale(1)).toBe(1);
  });
  it('outlinePx clamps and culls', () => {
    expect(outlinePx(23, false)).toBe(0);
    expect(outlinePx(24, false)).toBe(1.5);
    expect(outlinePx(80, false)).toBeCloseTo(2);
    expect(outlinePx(80, true)).toBeCloseTo(2.8);
    expect(outlinePx(2000, true)).toBe(3);
  });
});
