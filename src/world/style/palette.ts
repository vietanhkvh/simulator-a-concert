// PALETTE — token màu của PHONG CÁCH ĐANG BẬT (mặc định "Kẹo đêm", STYLE_GUIDE mục 2, 5). Không phụ thuộc three.js.
// Hex chỉ được viết ở themes/*.ts và ở src/ui/tokens.css. Hype nhận giá trị 0..1.
//
// ĐỔI PHONG CÁCH: theme.ts gọi applyPaletteTokens() — các object/mảng dưới đây GIỮ NGUYÊN danh tính và được ghi đè
// tại chỗ; các số lẻ (INK, SECRET_CORE…) là `export let` (live binding). Vì vậy KHÔNG chép token vào hằng cấp module
// (const X = PAL.berry[500] ở đầu file, chuỗi GLSL nướng sẵn màu…): đọc token bên trong hàm dựng. Xem docs/THEMES.md.
import { chibi } from './themes/chibi';
import type { Theme } from './themeTypes';

export type ColorName = 'night' | 'berry' | 'grape' | 'soda' | 'mint' | 'honey' | 'peach' | 'cream';
export type ShadeKey = 700 | 500 | 300 | 100;
export type Rgb = [number, number, number];

export const COLOR_NAMES: readonly ColorName[] = ['night', 'berry', 'grape', 'soda', 'mint', 'honey', 'peach', 'cream'];
export const SHADE_KEYS: readonly ShadeKey[] = [700, 500, 300, 100];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const T0: Theme = chibi;

/** 8 màu × 4 bậc dạng số 0xRRGGBB: `PAL.berry[500]`. */
export const PAL: Record<ColorName, Record<ShadeKey, number>> = clone(T0.pal);
/** Alias theo tên trong guide mục 5. */
export const PALETTE = PAL;

export const hexStr = (hex: number): string => '#' + (hex & 0xffffff).toString(16).padStart(6, '0');

/** Cùng bảng nhưng dạng chuỗi '#rrggbb' (cho CSS / canvas). */
export const PAL_HEX = Object.fromEntries(
  COLOR_NAMES.map((n) => [n, Object.fromEntries(SHADE_KEYS.map((s) => [s, hexStr(PAL[n][s])]))]),
) as Record<ColorName, Record<ShadeKey, string>>;

/** Ramp theo tên gốc của style sheet đang bật (vd. RAMPS.blood ở "Thép & Lửa"). Builder theo phong cách dùng. */
export const RAMPS: Record<string, Record<ShadeKey, number>> = clone(T0.ramps);

/** Màu thứ 9: viền nét. INK_SKY: viền vật thể trên trời (night-100). */
export let INK = T0.ink;
export let INK_HEX = hexStr(INK);
export let INK_SKY = T0.inkSky;

export let SECRET_CORE = T0.secretCore;
export let SECRET_RIM = T0.secretRim;

export const SKIN: number[] = [...T0.skin];
export const HAIR: number[] = [...T0.hair];
/** Màu áo khán giả: berry/grape/soda/mint/cream, 60% bậc 500/300 + 40% bậc 700 (chọn ở shader). */
export const CLOTH: number[] = [...T0.cloth];

export const MOTIF: { star: number; heart: number; bow: number } = { ...T0.motif };

export type ZoneName = 'arena' | 'stands' | 'outside' | 'balloon';
/** Độ bão hoà theo khu. Secret và cực quang giữ 1.0 (không gọi shade()). */
export const ZONE_SAT: Record<ZoneName, number> = { ...T0.zoneSat };
/** Khu 1 dịch hue 8° về `grape`. */
export const ZONE_HUE_SHIFT_DEG: Record<ZoneName, number> = { ...T0.zoneHueShiftDeg };
let ZONE_HUE_TARGET = T0.zoneHueTarget;

/** Màu vòm trời + sương mù (sky.ts, world.ts). */
export const SKY: Theme['sky'] = { ...T0.sky };

// ───────────── Chuyển đổi màu ─────────────
export function hexToRgb(hex: number | string): Rgb {
  const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const c255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
export function rgbToHex(rgb: Rgb): number {
  return (c255(rgb[0]) << 16) | (c255(rgb[1]) << 8) | c255(rgb[2]);
}
/** Trộn tuyến tính trong RGB; t=0 → a, t=1 → b. */
export function mixHex(a: number | string, b: number | string, t: number): number {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** [h 0..360, s 0..1, l 0..1] */
export function rgbToHsl([r, g, b]: Rgb): Rgb {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
export function hslToRgb([h, s, l]: Rgb): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1)), m = l - c / 2;
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
/** Xoay hue h về `target` theo cung ngắn nhất, lượng `deg` (độ). */
function hueToward(h: number, target: number, deg: number): number {
  const d = ((target - h + 540) % 360) - 180;
  return (h + Math.sign(d) * Math.min(Math.abs(d), deg) + 360) % 360;
}

/** Áp độ bão hoà của khu (và dịch hue khu 1) lên một màu. */
export function shade(hex: number | string, zone: ZoneName): number {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const shift = ZONE_HUE_SHIFT_DEG[zone];
  const h2 = s > 0 && shift ? hueToward(h, ZONE_HUE_TARGET, shift) : h;
  return rgbToHex(hslToRgb([h2, s * ZONE_SAT[zone], l]));
}

// ───────────── Tô bóng đồ chơi 2 bậc ─────────────
const floorLOf = (night700: number, lift: number) => rgbToHsl(hexToRgb(night700))[2] + lift;
export const toonRamp = {
  lit: 1.0,
  model: T0.shadow.model as Theme['shadow']['model'],
  /** Hệ số độ sáng (HSL L) của bậc bóng. */
  shadow: T0.shadow.shadow,
  /** Bóng không bao giờ tối hơn L này (≈ night-700, không về đen). */
  floorL: floorLOf(T0.pal.night[700], T0.shadow.floorLift),
  /** Bóng dịch hue về tím (độ) và tối thiểu bão hoà khi màu gốc xám. */
  hueTarget: T0.shadow.hueTarget,
  /** Xoay hue tối đa (độ), chỉ một phần, theo cung ngắn nhất; màu ấm xa tím gần như không xoay. */
  hueShiftDeg: T0.shadow.hueShiftDeg,
  minSat: T0.shadow.minSat,
  /** Lượng phủ lavender (RGB) lên bậc bóng: màu nhạt nhận đủ, màu bão hoà gần như không. */
  tint: T0.shadow.tint,
  tintHueOffset: T0.shadow.tintHueOffset,
  /** Ngưỡng mềm (tỉ lệ) nhân vật / đạo cụ. */
  softChar: [...T0.form.toy.softChar] as [number, number],
  softProp: [...T0.form.toy.softProp] as [number, number],
};
/** Sắc của bóng tính ngay trong shader (xem glShadow); null = giữ nguyên hệ số gốc của từng shader (chibi). */
let SHADOW_GL_BIAS: Rgb | null = T0.shadow.glBias ?? null;
const glVec = (v: Rgb) => `vec3(${v.map((x) => x.toFixed(4)).join(', ')})`;
/**
 * Hằng vec3 GLSL cho bậc bóng tính trong shader (`sh = c * mul + add`). `base` = hệ số gốc viết cho chibi (bóng ngả tím):
 * chibi trả lại đúng `base`; phong cách khác giữ độ tối trung bình của `base` (× tỉ lệ shadow so với chibi) nhưng đổi
 * sắc theo shadow.glBias (thép: lạnh · sơn mài: chàm · pixel: lam tím). Gọi BÊN TRONG hàm dựng chuỗi shader.
 */
export function glShadow(base: Rgb): string {
  if (!SHADOW_GL_BIAS) return glVec(base);
  const m = ((base[0] + base[1] + base[2]) / 3) * (toonRamp.shadow / 0.72);
  return glVec([m * SHADOW_GL_BIAS[0], m * SHADOW_GL_BIAS[1], m * SHADOW_GL_BIAS[2]]);
}
/** Token → hằng vec3 GLSL (giá trị sRGB 0..1). */
export const glHex = (hex: number): string => glVec(hexToRgb(hex));

/** Bảng "lùi một bậc ramp" cho mô hình bóng 'rampStep' (pixel): hex → bậc tối kế tiếp. */
const rampDown = new Map<number, number>();

/** Màu bậc bóng: tối hơn (L × 0,72), ngả nhẹ về tím, không xám hơn gốc, không tối hơn night-700.
 * Hue chỉ xoay một phần (≤ hueShiftDeg) theo cung ngắn nhất về grape và giảm dần về 0 với các màu ấm
 * nằm xa tím (vàng / cam / xanh lá: xoay kiểu gì cũng ra đỏ hoặc xanh rêu). Sắc tím "lavender" đến từ
 * một lớp trộn RGB nhẹ về grape, mạnh hơn với màu nhạt (kem, tóc vàng nhạt) vốn còn nhiều chỗ cho sắc độ.
 * "Không xám hơn" đo bằng độ bão hoà HSV (sắc độ / độ sáng): giữ HSV-S thì bản tối là "cùng màu, tối hơn";
 * giữ HSL-S như trước khiến màu nhạt (kem, mật ong nhạt) thành cam rực trong bóng. */
export function shadowOf(hex: number | string): number {
  const rgb = hexToRgb(hex);
  if (toonRamp.model === 'rampStep') { const d = rampDown.get(rgbToHex(rgb)); if (d !== undefined) return d; }
  const [h, s, l] = rgbToHsl(rgb);
  const mx = Math.max(...rgb), mn = Math.min(...rgb);
  const sv = mx > 0 ? (mx - mn) / mx : 0;
  const l2 = Math.max(toonRamp.floorL, l * toonRamp.shadow);
  // 1) hue: xoay một phần về grape, tắt dần khi cách tím > 60° (màu ấm: 0 từ 120°)
  let h2: number = toonRamp.hueTarget;
  if (s > 0) {
    const d = Math.abs(((toonRamp.hueTarget - h + 540) % 360) - 180);
    const w = 1 - smoothstep(60, 120, d);
    h2 = hueToward(h, toonRamp.hueTarget, Math.min(d * 0.3, toonRamp.hueShiftDeg) * w);
  }
  // 2) bản tối cùng sắc độ tương đối (HSV-S = sv), độ sáng l2; màu xám thuần nhận sắc tím tối thiểu
  const svT = s > 0 ? sv : toonRamp.minSat;
  const toHslS = (svv: number) => { const v = l2 / (1 - svv / 2); return Math.min(l2, 1 - l2) > 1e-6 ? Math.min(1, (v - l2) / Math.min(l2, 1 - l2)) : 0; };
  let out = hslToRgb([h2, toHslS(svT), l2]);
  // 3) phủ lavender nhẹ (cùng độ sáng), rồi trả lại sắc độ nếu lớp phủ làm xám đi
  const tint = hslToRgb([toonRamp.hueTarget + toonRamp.tintHueOffset, 0.5, l2]);
  const k = toonRamp.tint * (0.05 + 0.95 * Math.pow(1 - sv, 1.5));
  out = [out[0] + (tint[0] - out[0]) * k, out[1] + (tint[1] - out[1]) * k, out[2] + (tint[2] - out[2]) * k];
  const omx = Math.max(...out), omn = Math.min(...out);
  const osv = omx > 0 ? (omx - omn) / omx : 0;
  if (osv < svT && omx > omn) { const nmn = omx * (1 - svT); out = out.map((c) => omx - (omx - c) * (omx - nmn) / (omx - omn)) as Rgb; }
  return rgbToHex(out);
}

// ───────────── Hype ─────────────
export type HypeState = 'cool' | 'warm' | 'vivid';
export const HYPE_WARM_AT = 0.4;
export const HYPE_VIVID_AT = 0.8;
/** Vùng trộn mượt mỗi phía mốc: ±15% (guide ghi ±5% nhưng khi đó bước 0,01 nhảy > 0,05). */
export const HYPE_BLEND = 0.15;

export interface HypeStage {
  state: HypeState;
  from: number;
  to: number;
  /** Tỉ lệ đèn sân khấu bật. */
  lightFraction: number;
  primary: number;
  secondary: number;
  accent: number;
}
const HYPE_ORDER: readonly HypeState[] = ['cool', 'warm', 'vivid'];
const HYPE_RANGE: Record<HypeState, [number, number]> = { cool: [0, 0.4], warm: [0.4, 0.8], vivid: [0.8, 1] };
const stageOf = (t: Theme, k: HypeState): HypeStage => {
  const h = t.hype[k];
  return { state: k, from: HYPE_RANGE[k][0], to: HYPE_RANGE[k][1], lightFraction: h.lightFraction, primary: h.primary, secondary: h.secondary, accent: h.accent };
};
/** 3 bảng Hype dùng chung (đèn, lightstick, khán đài, trời); mốc 0 / 0,4 / 0,8. */
export const HYPE_STAGES: readonly [HypeStage, HypeStage, HypeStage] = [stageOf(T0, 'cool'), stageOf(T0, 'warm'), stageOf(T0, 'vivid')];
/** Tên ba trạng thái Hype của phong cách đang bật. */
export const HYPE_NAMES: [string, string, string] = [...T0.strings.hypeNames];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function hypeState(h: number): HypeState {
  return h < HYPE_WARM_AT ? 'cool' : h < HYPE_VIVID_AT ? 'warm' : 'vivid';
}

/** Trọng số trộn mượt [cool, warm, vivid], tổng = 1. */
export function hypeMix(h: number): [number, number, number] {
  const up1 = smoothstep(HYPE_WARM_AT - HYPE_BLEND, HYPE_WARM_AT + HYPE_BLEND, h);
  const up2 = smoothstep(HYPE_VIVID_AT - HYPE_BLEND, HYPE_VIVID_AT + HYPE_BLEND, h);
  return [1 - up1, up1 * (1 - up2), up1 * up2];
}

const stageRgb = () => HYPE_STAGES.map((s) => ({
  primary: hexToRgb(s.primary), secondary: hexToRgb(s.secondary), accent: hexToRgb(s.accent),
}));
let STAGE_RGB = stageRgb();

/** Bộ 3 màu theo Hype, [r,g,b] 0..1, nội suy mượt. */
export function hypeColors(h: number): { primary: Rgb; secondary: Rgb; accent: Rgb } {
  const w = hypeMix(h);
  const blend = (k: 'primary' | 'secondary' | 'accent'): Rgb => [
    STAGE_RGB[0]![k][0] * w[0] + STAGE_RGB[1]![k][0] * w[1] + STAGE_RGB[2]![k][0] * w[2],
    STAGE_RGB[0]![k][1] * w[0] + STAGE_RGB[1]![k][1] * w[1] + STAGE_RGB[2]![k][1] * w[2],
    STAGE_RGB[0]![k][2] * w[0] + STAGE_RGB[1]![k][2] * w[1] + STAGE_RGB[2]![k][2] * w[2],
  ];
  return { primary: blend('primary'), secondary: blend('secondary'), accent: blend('accent') };
}

export const AURORA_START = 0.4;
export const AURORA_FULL = 0.55;
/** 0 khi Hype ≤ 40%, tăng mượt tới 1 ở 55%. Cực quang chỉ hiện sau khi Hype qua 40%. */
export function auroraAmount(h: number): number {
  return smoothstep(AURORA_START, AURORA_FULL, h);
}
/** Công thức guide 2.3: auroraAmount × mix(0.6, 0.9, smoothstep(0.8, 1, h)). */
export function auroraAlpha(h: number): number {
  return auroraAmount(h) * (0.6 + 0.3 * smoothstep(0.8, 1, h));
}

// ───────────── Đổi phong cách ─────────────
/** (nội bộ — chỉ theme.ts gọi) Ghi token màu của `t` vào các object/mảng/biến ở trên, giữ nguyên danh tính. */
export function applyPaletteTokens(t: Theme): void {
  for (const n of COLOR_NAMES) for (const s of SHADE_KEYS) { PAL[n][s] = t.pal[n][s]; PAL_HEX[n][s] = hexStr(t.pal[n][s]); }
  for (const k of Object.keys(RAMPS)) delete RAMPS[k];
  for (const [k, r] of Object.entries(t.ramps)) RAMPS[k] = { ...r };
  INK = t.ink; INK_HEX = hexStr(t.ink); INK_SKY = t.inkSky;
  SECRET_CORE = t.secretCore; SECRET_RIM = t.secretRim;
  SKIN.splice(0, SKIN.length, ...t.skin);
  HAIR.splice(0, HAIR.length, ...t.hair);
  CLOTH.splice(0, CLOTH.length, ...t.cloth);
  Object.assign(MOTIF, t.motif);
  Object.assign(ZONE_SAT, t.zoneSat);
  Object.assign(ZONE_HUE_SHIFT_DEG, t.zoneHueShiftDeg);
  ZONE_HUE_TARGET = t.zoneHueTarget;
  Object.assign(SKY, t.sky);
  const sh = t.shadow;
  Object.assign(toonRamp, {
    model: sh.model, shadow: sh.shadow, floorL: floorLOf(t.pal.night[700], sh.floorLift), hueTarget: sh.hueTarget,
    hueShiftDeg: sh.hueShiftDeg, minSat: sh.minSat, tint: sh.tint, tintHueOffset: sh.tintHueOffset,
  });
  toonRamp.softChar.splice(0, 2, ...t.form.toy.softChar);
  toonRamp.softProp.splice(0, 2, ...t.form.toy.softProp);
  SHADOW_GL_BIAS = sh.glBias ?? null;
  rampDown.clear();
  if (sh.model === 'rampStep') {
    for (const r of [...Object.values(t.ramps), ...Object.values(t.pal)]) {
      if (!rampDown.has(r[100])) rampDown.set(r[100], r[300]);
      if (!rampDown.has(r[300])) rampDown.set(r[300], r[500]);
      if (!rampDown.has(r[500])) rampDown.set(r[500], r[700]);
    }
    for (const r of [...Object.values(t.ramps), ...Object.values(t.pal)]) if (!rampDown.has(r[700])) rampDown.set(r[700], mixHex(r[700], t.ink, 0.45));
  }
  HYPE_ORDER.forEach((k, i) => { Object.assign(HYPE_STAGES[i]!, stageOf(t, k)); HYPE_NAMES[i] = t.strings.hypeNames[i]!; });
  STAGE_RGB = stageRgb();
}
