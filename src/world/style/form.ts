// FORM — hằng số hình khối của PHONG CÁCH ĐANG BẬT (mặc định chibi, STYLE_GUIDE mục 3, 5). Không phụ thuộc three.js.
// theme.ts gọi applyFormTokens(): số lẻ là `export let` (live binding), object được ghi đè tại chỗ — đừng chép vào
// hằng cấp module ở nơi khác (docs/THEMES.md).
import { chibi } from './themes/chibi';
import type { OutlineRule, ShadingModel, Theme } from './themeTypes';

const F0 = chibi.form;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** Chép sâu src vào dst, giữ nguyên danh tính mọi object/mảng lồng nhau. */
function deepAssign(dst: Record<string, unknown>, src: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(src)) {
    const d = dst[k];
    if (Array.isArray(v) && Array.isArray(d)) d.splice(0, d.length, ...v);
    else if (v && typeof v === 'object' && d && typeof d === 'object') deepAssign(d as Record<string, unknown>, v as Record<string, unknown>);
    else dst[k] = v;
  }
}

export let HEADS_MESH = F0.headsMesh;
export let HEADS_BILLBOARD = F0.headsBillboard;
/** Chiều cao nhân vật (m). */
export let CHAR_H = F0.charH;
/** Quy tắc viền và mô hình tô bóng của phong cách (builder mặc định chỉ biết 'ink' + 'toy2'). */
export let OUTLINE_RULE: OutlineRule = F0.outlineRule;
export let SHADING: ShadingModel = F0.shading;
/** Điểm mắt camera người chơi (m). */
export const EYE_Y = 1.65;

/** Tỉ lệ theo H (chiều cao nhân vật). */
export const BODY_RATIO = {
  headW: 0.46, headH: 0.42,
  torso: 0.3, arm: 0.26, hand: 0.11, leg: 0.22,
} as const;
/** Khán giả billboard: bán kính đầu theo chiều cao; chiều cao (m). */
export const CROWD = { headRadius: 0.24, heightMin: 1.25, heightMax: 1.45 } as const;

/** Bo tròn tối thiểu = 12% cạnh ngắn nhất. */
export let BEVEL_MIN = F0.bevelMin;
export const bevelMin = (shortestEdge: number) => shortestEdge * BEVEL_MIN;
/** Chi tiết nhỏ nhất ≥ 6% chiều lớn nhất. */
export let MIN_DETAIL = F0.minDetail;

export const OUTLINE = clone(F0.outline);
/** Bề dày viền trên màn hình (px); 0 khi vật thể < 24 px. */
export function outlinePx(objectPx: number, isSecret: boolean): number {
  if (!(objectPx >= OUTLINE.cullPx)) return 0;
  const w = objectPx * (isSecret ? OUTLINE.secret : OUTLINE.width);
  return Math.min(OUTLINE.maxPx, Math.max(OUTLINE.minPx, w));
}

/** Phương tiện dài ≤ 2,2 × đường kính thân. */
export let VEHICLE_MAX_ASPECT = F0.vehicleMaxAspect;
export const vehicleLengthMax = (bodyDiameter: number) => bodyDiameter * VEHICLE_MAX_ASPECT;
/** Khoảng cách LOD xa của khán giả (m, ±3). */
export const LOD_FAR = 35;

export const TOY = clone(F0.toy);
export const EMISSIVE = clone(F0.emissive);

/** Squash & stretch: cặp [x, y] (scale ngang, dọc). */
export const SQUASH = clone(F0.squash);

export const POP = clone(F0.pop);
/** Xuất hiện bằng "pop": 0 → 1,15 → 1,0 trong 0,25 s (t tính bằng giây). */
export function popScale(t: number): number {
  if (!(t > 0)) return 0;
  if (t >= POP.sec) return 1;
  if (t < POP.peakAt) {
    const u = t / POP.peakAt;
    return POP.peak * (1 - (1 - u) ** 3); // ease-out tới đỉnh
  }
  const u = (t - POP.peakAt) / (POP.sec - POP.peakAt);
  const s = u * u * (3 - 2 * u); // smoothstep hạ về 1
  return POP.peak + (1 - POP.peak) * s;
}

/** Chữ ký secret: vành sáng + sao quay quanh. */
export const SECRET_HALO = {
  scale: 1.35, width: 0.02, period: 1.6,
  stars: 5, starsMin: 4, starsMax: 6,
  /** Tốc độ quay của sao (rad/s). */
  spin: 1.2,
  outlineMul: 0.035 / 0.025,
} as const;

/** Mặt: 1 CanvasTexture 256 px, atlas 2×2. Kích thước theo H. */
export const FACE = {
  texPx: 256,
  atlas: 2,
  expressions: ['normal', 'sing', 'smile', 'surprise'] as const,
  eyeW: 0.075, eyeH: 0.11, eyeGap: 0.17,
  cheekR: 0.07,
  eyeBlinkSec: [3, 5],
} as const;
export type Expression = (typeof FACE.expressions)[number];

/** Giới hạn chói. */
export const GLARE = clone(F0.glare);

/** (nội bộ — chỉ theme.ts gọi) Ghi token hình khối của `t`, giữ nguyên danh tính các object. */
export function applyFormTokens(t: Theme): void {
  const f = t.form;
  HEADS_MESH = f.headsMesh; HEADS_BILLBOARD = f.headsBillboard; CHAR_H = f.charH;
  OUTLINE_RULE = f.outlineRule; SHADING = f.shading;
  BEVEL_MIN = f.bevelMin; MIN_DETAIL = f.minDetail; VEHICLE_MAX_ASPECT = f.vehicleMaxAspect;
  const pairs: [object, object][] = [[OUTLINE, f.outline], [TOY, f.toy], [EMISSIVE, f.emissive], [SQUASH, f.squash], [POP, f.pop], [GLARE, f.glare]];
  for (const [dst, src] of pairs) deepAssign(dst as Record<string, unknown>, src as Record<string, unknown>);
}
