// PALETTE — token màu "Kẹo đêm" (STYLE_GUIDE mục 2, 5). Không phụ thuộc three.js.
// Hex chỉ được viết ở file này và ở src/ui/tokens.css. Hype nhận giá trị 0..1.

export type ColorName = 'night' | 'berry' | 'grape' | 'soda' | 'mint' | 'honey' | 'peach' | 'cream';
export type ShadeKey = 700 | 500 | 300 | 100;
export type Rgb = [number, number, number];

export const COLOR_NAMES: readonly ColorName[] = ['night', 'berry', 'grape', 'soda', 'mint', 'honey', 'peach', 'cream'];
export const SHADE_KEYS: readonly ShadeKey[] = [700, 500, 300, 100];

/** 8 màu × 4 bậc dạng số 0xRRGGBB: `PAL.berry[500]`. */
export const PAL: Record<ColorName, Record<ShadeKey, number>> = {
  night: { 700: 0x0a0818, 500: 0x14102b, 300: 0x2a2350, 100: 0x4a3f82 },
  berry: { 700: 0xb8326e, 500: 0xff5fa8, 300: 0xff94c4, 100: 0xffd0e4 },
  grape: { 700: 0x5238b8, 500: 0x8b6bff, 300: 0xb5a0ff, 100: 0xddd4ff },
  soda: { 700: 0x1c8fc0, 500: 0x45d9ff, 300: 0x8fe9ff, 100: 0xd2f7ff },
  mint: { 700: 0x1e9c84, 500: 0x4fe3c1, 300: 0x96f0da, 100: 0xd6faf1 },
  honey: { 700: 0xc48a12, 500: 0xffd45a, 300: 0xffe596, 100: 0xfff5d1 },
  peach: { 700: 0xc25a2e, 500: 0xff9a6b, 300: 0xffbe9e, 100: 0xffe2d4 },
  cream: { 700: 0xc9b8a6, 500: 0xfff4e6, 300: 0xfffaf3, 100: 0xffffff },
};
/** Alias theo tên trong guide mục 5. */
export const PALETTE = PAL;

export const hexStr = (hex: number): string => '#' + (hex & 0xffffff).toString(16).padStart(6, '0');

/** Cùng bảng nhưng dạng chuỗi '#rrggbb' (cho CSS / canvas). */
export const PAL_HEX = Object.fromEntries(
  COLOR_NAMES.map((n) => [n, Object.fromEntries(SHADE_KEYS.map((s) => [s, hexStr(PAL[n][s])]))]),
) as Record<ColorName, Record<ShadeKey, string>>;

/** Màu thứ 9: viền nét. INK_SKY: viền vật thể trên trời (night-100). */
export const INK = 0x2b1d5c;
export const INK_HEX = hexStr(INK);
export const INK_SKY = PAL.night[100];

export const SECRET_CORE = PAL.honey[300];
export const SECRET_RIM = PAL.mint[500];

export const SKIN: readonly number[] = [0xffe0c7, 0xf7cba4, 0xe0a57c, 0xb87a55, 0x8a5a3c];
export const HAIR: readonly number[] = [0x2a1f3d, 0x4a2f24, 0x6b4226, 0xc99a5b, 0xf6e0a8, 0xff94c4, 0x8fe9ff, 0xb5a0ff];
/** Màu áo khán giả: berry/grape/soda/mint/cream, 60% bậc 500/300 + 40% bậc 700 (chọn ở shader). */
export const CLOTH: readonly number[] = [PAL.berry[500], PAL.grape[500], PAL.soda[500], PAL.mint[500], PAL.cream[500]];

export const MOTIF = { star: PAL.honey[500], heart: PAL.berry[500], bow: PAL.soda[500] } as const;

export type ZoneName = 'arena' | 'stands' | 'outside' | 'balloon';
/** Độ bão hoà theo khu. Secret và cực quang giữ 1.0 (không gọi shade()). */
export const ZONE_SAT: Record<ZoneName, number> = { arena: 1.0, stands: 0.75, outside: 0.6, balloon: 0.8 };
/** Khu 1 dịch hue 8° về `grape`. */
export const ZONE_HUE_SHIFT_DEG: Record<ZoneName, number> = { arena: 0, stands: 0, outside: 8, balloon: 0 };
const GRAPE_HUE = 255;

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
  const h2 = s > 0 && shift ? hueToward(h, GRAPE_HUE, shift) : h;
  return rgbToHex(hslToRgb([h2, s * ZONE_SAT[zone], l]));
}

// ───────────── Tô bóng đồ chơi 2 bậc ─────────────
export const toonRamp = {
  lit: 1.0,
  /** Hệ số độ sáng (HSL L) của bậc bóng. */
  shadow: 0.72,
  /** Bóng không bao giờ tối hơn L này (≈ night-700, không về đen). */
  floorL: rgbToHsl(hexToRgb(PAL.night[700]))[2] + 0.06,
  /** Bóng dịch hue về tím (độ) và tối thiểu bão hoà khi màu gốc xám. */
  hueTarget: GRAPE_HUE,
  hueShiftDeg: 40,
  minSat: 0.25,
  /** Ngưỡng mềm (tỉ lệ) nhân vật / đạo cụ. */
  softChar: [0.12, 0.18] as const,
  softProp: [0.08, 0.12] as const,
} as const;

/** Màu bậc bóng: tối hơn, dịch về tím, không xám hơn gốc, không tối hơn night-700. */
export function shadowOf(hex: number | string): number {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const h2 = s > 0 ? hueToward(h, toonRamp.hueTarget, toonRamp.hueShiftDeg) : toonRamp.hueTarget;
  const s2 = Math.min(1, Math.max(s, toonRamp.minSat));
  const l2 = Math.max(toonRamp.floorL, l * toonRamp.shadow);
  return rgbToHex(hslToRgb([h2, s2, l2]));
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
/** 3 bảng Hype dùng chung (đèn, lightstick, khán đài, trời); mốc 0 / 0,4 / 0,8. */
export const HYPE_STAGES: readonly [HypeStage, HypeStage, HypeStage] = [
  { state: 'cool', from: 0, to: 0.4, lightFraction: 0.25, primary: PAL.grape[500], secondary: PAL.soda[700], accent: PAL.soda[300] },
  { state: 'warm', from: 0.4, to: 0.8, lightFraction: 0.6, primary: PAL.berry[500], secondary: PAL.soda[500], accent: PAL.grape[500] },
  { state: 'vivid', from: 0.8, to: 1, lightFraction: 1.0, primary: PAL.berry[500], secondary: PAL.honey[500], accent: PAL.peach[500] },
];

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

const STAGE_RGB = HYPE_STAGES.map((s) => ({
  primary: hexToRgb(s.primary), secondary: hexToRgb(s.secondary), accent: hexToRgb(s.accent),
}));

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
