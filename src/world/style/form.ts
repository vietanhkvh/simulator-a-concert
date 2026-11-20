// FORM — hằng số hình khối chibi (STYLE_GUIDE mục 3, 5). Không phụ thuộc three.js.

export const HEADS_MESH = 2.3;
export const HEADS_BILLBOARD = 2.1;
/** Chiều cao nhân vật (m). */
export const CHAR_H = 1.5;
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
export const BEVEL_MIN = 0.12;
export const bevelMin = (shortestEdge: number) => shortestEdge * BEVEL_MIN;
/** Chi tiết nhỏ nhất ≥ 6% chiều lớn nhất. */
export const MIN_DETAIL = 0.06;

export const OUTLINE = { width: 0.025, secret: 0.035, minPx: 1.5, maxPx: 3, cullPx: 24 } as const;
/** Bề dày viền trên màn hình (px); 0 khi vật thể < 24 px. */
export function outlinePx(objectPx: number, isSecret: boolean): number {
  if (!(objectPx >= OUTLINE.cullPx)) return 0;
  const w = objectPx * (isSecret ? OUTLINE.secret : OUTLINE.width);
  return Math.min(OUTLINE.maxPx, Math.max(OUTLINE.minPx, w));
}

/** Phương tiện dài ≤ 2,2 × đường kính thân. */
export const VEHICLE_MAX_ASPECT = 2.2;
export const vehicleLengthMax = (bodyDiameter: number) => bodyDiameter * VEHICLE_MAX_ASPECT;
/** Khoảng cách LOD xa của khán giả (m, ±3). */
export const LOD_FAR = 35;

export const TOY = { softChar: [0.12, 0.18], softProp: [0.08, 0.12], rim: 0.35, rimHigh: 0.5, hi: 0.4, hiHigh: 0.3, hiArea: 0.08 } as const;
export const EMISSIVE = { arch: 0.15, trim: 0.6, stick: 1.0, secret: 1.6, outline: 0 } as const;

/** Squash & stretch: cặp [x, y] (scale ngang, dọc). */
export const SQUASH = {
  beat: { down: [0.94, 1.03], up: [1.05, 0.975] },
  jump: { crouch: [0.85, 1.08], stretch: [1.12, 0.94], land: [0.82, 1.1] },
  /** Mỗi pha (s). Nhảy khi Hype > jumpHype. */
  phase: 0.12,
  jumpHype: 0.6,
  headLagMs: [60, 80],
  headSwayDeg: 8,
  vehicleStretch: 1.1,
} as const;

export const POP = { peak: 1.15, sec: 0.25, peakAt: 0.15 } as const;
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
export const GLARE = { lyricsAdditiveMax: 0.35, flashPerSecMax: 3 } as const;
