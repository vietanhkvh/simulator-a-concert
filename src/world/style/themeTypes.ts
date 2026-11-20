// THEME — kiểu dữ liệu của một phong cách (docs/THEMES.md). Chỉ có kiểu: không import giá trị, không phụ thuộc three.js.
import type { ColorName, HypeState, ShadeKey, ZoneName } from './palette';

export type ThemeId = 'chibi' | 'lacquer' | 'steel' | 'pixel';
export const THEME_IDS: readonly ThemeId[] = ['chibi', 'lacquer', 'steel', 'pixel'];

/** Một ramp màu 4 bậc: 700 bóng · 500 thân · 300 sáng · 100 highlight. */
export type Ramp = Record<ShadeKey, number>;

/** Mô hình tô bóng mà builder theo phong cách nên dùng (builder mặc định luôn tô 'toy2'). */
export type ShadingModel = 'toy2' | 'facet' | 'brush' | 'pixel';
/** Quy tắc viền: mực (chibi) · không viền (thép) · khảm vàng (sơn mài) · viền chọn lọc 1 px (pixel). */
export type OutlineRule = 'ink' | 'none' | 'goldInlay' | 'pixel1';
export type SkyFeature = 'aurora' | 'lanterns' | 'searchlights' | 'vangogh';
export type HeartFigure = 'heart' | 'vietnamS' | 'lightning' | 'brushHeart';
export type SecretKindId = 'ufo' | 'rocket' | 'dragon' | 'jet' | 'plane';

/** Quy tắc màu bóng (palette.shadowOf). 'tint' = thuật toán chung có tham số; 'rampStep' = lùi một bậc ramp (pixel). */
export interface ShadowRule {
  model: 'tint' | 'rampStep';
  /** Hệ số độ sáng (HSL L) của bậc bóng. */
  shadow: number;
  /** Bóng dịch hue về đây (độ) tối đa hueShiftDeg; màu xa hueTarget > 120° không xoay. */
  hueTarget: number;
  hueShiftDeg: number;
  /** Độ bão hoà tối thiểu cho màu xám. */
  minSat: number;
  /** Lượng phủ màu (hue = hueTarget + tintHueOffset) lên bậc bóng của màu nhạt. */
  tint: number;
  tintHueOffset: number;
  /** Cộng vào L của night-700 làm sàn độ sáng của bóng. */
  floorLift: number;
  /** Sắc của bóng tính trong shader của builder mặc định (palette.glShadow), trung bình ≈ 1. Bỏ trống = giữ hệ số gốc (chibi). */
  glBias?: [number, number, number];
}

export interface SkyTokens {
  zenith: number; mid: number;
  /** Chân trời = mix(mix(mid, horizon, 0.7), haze, 0.18). */
  horizon: number; haze: number;
  /** Quầng ấm sau sân vận động. */
  glow: number;
  /** Sương mù + nền scene. */
  fog: number;
}

export interface FormTokens {
  headsMesh: number; headsBillboard: number;
  /** Chiều cao nhân vật mesh (m). */
  charH: number;
  /** Bo tròn tối thiểu (tỉ lệ cạnh ngắn nhất); 0 = cạnh sắc. */
  bevelMin: number;
  minDetail: number;
  vehicleMaxAspect: number;
  outlineRule: OutlineRule;
  outline: { width: number; secret: number; minPx: number; maxPx: number; cullPx: number };
  shading: ShadingModel;
  toy: { softChar: [number, number]; softProp: [number, number]; rim: number; rimHigh: number; hi: number; hiHigh: number; hiArea: number };
  emissive: { arch: number; trim: number; stick: number; secret: number; outline: number };
  /** Cảm giác chuyển động. */
  squash: {
    beat: { down: [number, number]; up: [number, number] };
    jump: { crouch: [number, number]; stretch: [number, number]; land: [number, number] };
    phase: number; jumpHype: number; headLagMs: [number, number]; headSwayDeg: number; vehicleStretch: number;
  };
  pop: { peak: number; sec: number; peakAt: number };
  glare: { lyricsAdditiveMax: number; flashPerSecMax: number };
}

export interface HypeStageTokens { name: string; lightFraction: number; primary: number; secondary: number; accent: number }

export interface ThemeFeatures {
  /** Thứ xuất hiện trên trời khi Hype > 40 % (khe 'skyFeature'). */
  skyFeature: SkyFeature;
  /** Biến thể builder cho từng sự kiện bí mật ('default' = builder chibi). */
  secretSet: Record<SecretKindId, string>;
  crowdVariant: string; standCrowdVariant: string;
  rigVariant: string; stageVariant: string;
  /** Vật mang băng rôn cổ vũ (khe 'bannerCarriers'). Vật kéo băng rôn bay ngang (khe 'flyby') = secretSet.plane. */
  bannerCarrier: string;
  heartFigure: HeartFigure;
  /** Hậu kỳ: 'pixelate' vẽ cảnh 3D vào đích thấp rồi phóng nguyên lần (nearest). */
  postFx: { kind: 'none' } | { kind: 'pixelate'; width: number; height: number };
  /** Giá trị data-theme trên <html> (khối biến CSS trong ui/tokens.css). */
  ui: string;
}

export interface ThemeStrings {
  /** Tên hiển thị + mô tả một dòng cho thẻ ở sảnh. */
  name: string; tagline: string;
  /** Tên ba trạng thái Hype [0–40, 40–80, 80–100]. */
  hypeNames: [string, string, string];
  /** 6 khẩu hiệu cổ vũ mặc định (mỗi chuỗi ≤ 24 ký tự). */
  cheers: [string, string, string, string, string, string];
  secretBanner: string;
}

/** Cặp màu giao diện chính (kiểm WCAG ≥ 4,5 trong theme.test.ts); trùng với khối CSS của phong cách. */
export interface UiTokens {
  bg: number; text: number; textDim: number;
  btnBg: number; btnFg: number;
  subBg: number; subFg: number;
  /** Dải màu thẻ ở sảnh. */
  swatches: number[];
}

export interface Theme {
  id: ThemeId;
  strings: ThemeStrings;
  /** Ramp theo tên gốc của style sheet (builder theo phong cách dùng trực tiếp). */
  ramps: Record<string, Ramp>;
  /** Màu lẻ theo tên gốc của style sheet. */
  singles: Record<string, number>;
  /** Ramp gán vào 8 ô token hiện có (builder mặc định đọc qua PAL). */
  pal: Record<ColorName, Ramp>;
  ink: number; inkSky: number;
  secretCore: number; secretRim: number;
  /** 5 tông da, 8 màu tóc, 5 màu áo khán giả (số lượng cố định: shader khán giả dùng mảng cỡ này). */
  skin: number[]; hair: number[]; cloth: number[];
  motif: { star: number; heart: number; bow: number };
  zoneSat: Record<ZoneName, number>;
  zoneHueShiftDeg: Record<ZoneName, number>;
  /** Hue đích của dịch hue theo khu. */
  zoneHueTarget: number;
  shadow: ShadowRule;
  hype: Record<HypeState, HypeStageTokens>;
  sky: SkyTokens;
  form: FormTokens;
  features: ThemeFeatures;
  ui: UiTokens;
}
