// Hệ phong cách: chibi giữ nguyên token trước khi có hệ phong cách; applyTheme khứ hồi; 4 phong cách đủ cấu trúc;
// tương phản WCAG của các cặp màu giao diện chính.
import { afterEach, describe, expect, it } from 'vitest';
import snapshot from './__fixtures__/chibi-tokens.json';
import * as F from './form';
import * as P from './palette';
import {
  applyTheme, getActiveThemeId, getTheme, listThemes, onThemeChange, resolveInitialThemeId, themed, THEME_IDS, type Theme,
} from './theme';

/** Mọi export không phải hàm của palette.ts + form.ts và vài giá trị suy ra — cùng dạng với fixture (dựng từ mã cũ). */
function dump() {
  const pick = (m: Record<string, unknown>) => Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v !== 'function'));
  const hs = [0, 0.1, 0.25, 0.4, 0.5, 0.65, 0.8, 0.9, 1];
  return JSON.parse(JSON.stringify({
    palette: pick(P as unknown as Record<string, unknown>), form: pick(F as unknown as Record<string, unknown>),
    derived: {
      hypeColors: hs.map((h) => P.hypeColors(h)),
      shadowOf: [0x000000, 0x808080, 0xffffff, ...Object.values(P.PAL).flatMap((m) => Object.values(m)), ...P.SKIN, ...P.HAIR].map((c) => P.shadowOf(c)),
      shade: (['arena', 'stands', 'outside', 'balloon'] as const).map((z) => Object.values(P.PAL).map((m) => P.shade(m[500], z))),
    },
  })) as { palette: Record<string, unknown>; form: Record<string, unknown>; derived: unknown };
}
/** Token mới thêm cùng hệ phong cách (không có trong mã cũ). */
const NEW_KEYS = { palette: ['RAMPS', 'SKY', 'HYPE_NAMES'], form: ['OUTLINE_RULE', 'SHADING'] };
const sameAsOld = (cur: ReturnType<typeof dump>) => {
  const old = snapshot as unknown as ReturnType<typeof dump>;
  for (const part of ['palette', 'form'] as const) {
    for (const [k, v] of Object.entries(old[part])) {
      if (part === 'palette' && k === 'toonRamp') { expect(cur.palette.toonRamp, k).toMatchObject(v as object); continue; }
      expect(cur[part][k], `${part}.${k}`).toEqual(v);
    }
    const extra = Object.keys(cur[part]).filter((k) => !(k in old[part]));
    expect(extra.sort()).toEqual([...NEW_KEYS[part]].sort());
  }
  expect(cur.derived).toEqual(old.derived);
};

afterEach(() => { applyTheme('chibi'); });

describe('phong cách: chibi giữ nguyên', () => {
  it('token mặc định = ảnh chụp token trước khi có hệ phong cách', () => {
    expect(getActiveThemeId()).toBe('chibi');
    sameAsOld(dump());
  });
  it('applyTheme khứ hồi (chibi → lacquer → steel → pixel → chibi) trả mọi token về như cũ, giữ danh tính object', () => {
    const before = dump();
    const ids = { PAL: P.PAL, berry: P.PAL.berry, HYPE: P.HYPE_STAGES, s0: P.HYPE_STAGES[0], SKIN: P.SKIN, TOY: F.TOY, beat: F.SQUASH.beat, OUTLINE: F.OUTLINE };
    for (const id of ['lacquer', 'steel', 'pixel'] as const) {
      applyTheme(id);
      expect(getActiveThemeId()).toBe(id);
      expect(dump()).not.toEqual(before);
      expect(P.PAL.berry[500]).toBe(getTheme().pal.berry[500]);
      expect(P.INK).toBe(getTheme().ink);
      expect(F.CHAR_H).toBe(getTheme().form.charH);
      expect(P.HYPE_STAGES[1].primary).toBe(getTheme().hype.warm.primary);
    }
    applyTheme('chibi');
    expect(dump()).toEqual(before);
    sameAsOld(dump());
    expect(P.PAL).toBe(ids.PAL); expect(P.PAL.berry).toBe(ids.berry); expect(P.HYPE_STAGES).toBe(ids.HYPE);
    expect(P.HYPE_STAGES[0]).toBe(ids.s0); expect(P.SKIN).toBe(ids.SKIN); expect(F.TOY).toBe(ids.TOY);
    expect(F.SQUASH.beat).toBe(ids.beat); expect(F.OUTLINE).toBe(ids.OUTLINE);
  });
  it('applyTheme không sửa dữ liệu gốc của phong cách', () => {
    const raw = JSON.stringify(listThemes());
    for (const id of THEME_IDS) applyTheme(id);
    expect(JSON.stringify(listThemes())).toBe(raw);
  });
  it('themed() / onThemeChange chạy lại khi đổi phong cách', () => {
    let n = 0, seen = '';
    themed(() => { n++; });
    const off = onThemeChange((id) => { seen = id; });
    expect(n).toBe(1);
    applyTheme('steel');
    expect(n).toBe(2); expect(seen).toBe('steel');
    off();
    applyTheme('pixel');
    expect(seen).toBe('steel');
  });
  it('resolveInitialThemeId: URL > localStorage > chibi', () => {
    expect(resolveInitialThemeId('?theme=steel', 'pixel')).toBe('steel');
    expect(resolveInitialThemeId('?theme=nope', 'pixel')).toBe('pixel');
    expect(resolveInitialThemeId('', 'lacquer')).toBe('lacquer');
    expect(resolveInitialThemeId('', 'bogus')).toBe('chibi');
    expect(resolveInitialThemeId('?x=1', null)).toBe('chibi');
  });
});

// ───────────── Cấu trúc ─────────────
const shape = (v: unknown): unknown => {
  if (Array.isArray(v)) return ['array', v.length, v.length ? shape(v[0]) : null];
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape((v as Record<string, unknown>)[k])]));
  return typeof v;
};
const isHex = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffff;
const lumOf = (hex: number) => {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = P.hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
/** Tỉ lệ tương phản WCAG 2.x. */
const contrast = (a: number, b: number) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe('phong cách: đủ cấu trúc', () => {
  const themes = listThemes();
  const ref = themes[0]!;
  // ramps / singles / secretSet khác tên giữa các phong cách là đúng thiết kế → so riêng.
  const core = (t: Theme) => ({ ...t, shadow: { ...t.shadow, glBias: null }, ramps: null, singles: null, ui: { ...t.ui, swatches: null }, features: { ...t.features, postFx: null } });

  it('có đủ 4 phong cách, id khớp, chibi là mặc định', () => {
    expect(themes.map((t) => t.id)).toEqual(['chibi', 'lacquer', 'steel', 'pixel']);
  });
  for (const t of themes) {
    describe(t.id, () => {
      it('cùng khóa / ramp / bậc / độ dài mảng với chibi', () => {
        expect(shape(core(t))).toEqual(shape(core(ref)));
        expect(Object.keys(t.pal).sort()).toEqual([...P.COLOR_NAMES].sort());
        for (const r of [...Object.values(t.pal), ...Object.values(t.ramps)]) expect(Object.keys(r).map(Number).sort((a, b) => a - b)).toEqual([100, 300, 500, 700]);
        expect([t.skin.length, t.hair.length, t.cloth.length, t.strings.cheers.length]).toEqual([5, 8, 5, 6]);
        expect(Object.keys(t.features.secretSet).sort()).toEqual(['dragon', 'jet', 'plane', 'rocket', 'ufo']);
      });
      it('mọi màu là hex hợp lệ', () => {
        const all: unknown[] = [
          ...Object.values(t.pal).flatMap((r) => Object.values(r)), ...Object.values(t.ramps).flatMap((r) => Object.values(r)),
          ...Object.values(t.singles), t.ink, t.inkSky, t.secretCore, t.secretRim, ...t.skin, ...t.hair, ...t.cloth,
          ...Object.values(t.motif), ...Object.values(t.sky), ...Object.values(t.hype).flatMap((h) => [h.primary, h.secondary, h.accent]),
          t.ui.bg, t.ui.text, t.ui.textDim, t.ui.btnBg, t.ui.btnFg, t.ui.subBg, t.ui.subFg, ...t.ui.swatches,
        ];
        for (const c of all) expect(isHex(c), String(c)).toBe(true);
        expect(t.ui.swatches.length).toBeGreaterThanOrEqual(5);
      });
      it('ramp 8 ô token sáng dần 700 → 100; trạng thái Hype tăng dần', () => {
        for (const [n, r] of Object.entries(t.pal)) {
          expect(lumOf(r[700]), n).toBeLessThanOrEqual(lumOf(r[500]));
          expect(lumOf(r[500]), n).toBeLessThanOrEqual(lumOf(r[300]));
          expect(lumOf(r[300]), n).toBeLessThanOrEqual(lumOf(r[100]));
        }
        const f = [t.hype.cool.lightFraction, t.hype.warm.lightFraction, t.hype.vivid.lightFraction];
        expect(f[0]!).toBeLessThan(f[1]!); expect(f[1]!).toBeLessThan(f[2]!); expect(f[2]).toBe(1);
        expect(t.strings.hypeNames).toEqual([t.hype.cool.name, t.hype.warm.name, t.hype.vivid.name]);
        for (const c of t.strings.cheers) { expect(c.length).toBeGreaterThan(0); expect(c.length).toBeLessThanOrEqual(24); }
        expect(t.strings.name.length).toBeGreaterThan(0); expect(t.strings.tagline.length).toBeGreaterThan(0);
        for (const z of Object.values(t.zoneSat)) { expect(z).toBeGreaterThan(0); expect(z).toBeLessThanOrEqual(1); }
      });
      it('sau applyTheme: HYPE_STAGES liền mạch 0 → 0,4 → 0,8 → 1, hypeColors liên tục, bóng không sáng hơn gốc', () => {
        applyTheme(t.id);
        expect(P.HYPE_STAGES.map((s) => [s.from, s.to])).toEqual([[0, 0.4], [0.4, 0.8], [0.8, 1]]);
        let prev = P.hypeColors(0);
        for (let i = 1; i <= 100; i++) {
          const cur = P.hypeColors(i / 100);
          for (const k of ['primary', 'secondary', 'accent'] as const) for (let c = 0; c < 3; c++) expect(Math.abs(cur[k][c]! - prev[k][c]!)).toBeLessThanOrEqual(0.06);
          prev = cur;
        }
        // (màu rất tối bị nâng lên sàn độ sáng của bóng — chỉ kiểm màu sáng hơn sàn)
        for (const r of Object.values(t.pal)) for (const c of [r[500], r[300], r[100]]) if (lumOf(c) > 0.05) expect(lumOf(P.shadowOf(c))).toBeLessThanOrEqual(lumOf(c) + 1e-6);
        expect(P.auroraAmount(0.4)).toBe(0); expect(P.auroraAmount(0.9)).toBe(1);
      });
      it('tương phản WCAG ≥ 4,5 cho các cặp giao diện chính', () => {
        const pairs: [string, number, number][] = [
          ['chữ / nền', t.ui.text, t.ui.bg], ['chữ phụ / nền', t.ui.textDim, t.ui.bg],
          ['nút chính', t.ui.btnFg, t.ui.btnBg], ['nút phụ', t.ui.subFg, t.ui.subBg],
        ];
        for (const [name, fg, bg] of pairs) expect(contrast(fg, bg), `${t.id} ${name}`).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});
