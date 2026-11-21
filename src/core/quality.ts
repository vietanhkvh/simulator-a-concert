// BỘ ĐIỀU TỐC CHẤT LƯỢNG ĐỒ HOẠ — logic thuần (không DOM, không three), có kiểm thử ở quality.test.ts.
// Game chưa từng được đo trên GPU thật, nên tự đo frame time và tự chọn bậc:
//   ultra → high → medium → low   (rẻ nhất trước: tỉ lệ điểm ảnh renderer, rồi số khán giả sân được vẽ).
// Nối dây với renderer/world ở world/qualityControl.ts; main.ts chỉ gọi frame() mỗi frame.
//
// Nguyên tắc: hạ bậc sau ~2 s liên tục dưới mục tiêu; nâng bậc chỉ sau ~10 s dư sức; một bậc vừa nâng lên mà lại
// phải hạ trong thời gian thử thì bậc đó bị cấm suốt phiên (không bao giờ dao động lên–xuống mãi). Không đổi gì trong
// mấy giây đầu (biên dịch shader), khi tạm dừng, khi tab ẩn hay khi cảnh 3D không được vẽ mỗi frame.

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
/** Thấp → cao. */
export const QUALITY_TIERS: readonly QualityTier[] = ['low', 'medium', 'high', 'ultra'];
/** 'auto' = bộ điều tốc tự chọn; còn lại = cố định một bậc. */
export type QualityMode = 'auto' | QualityTier;
export const QUALITY_MODES: readonly QualityMode[] = ['auto', 'ultra', 'high', 'medium', 'low'];

export interface TierSettings {
  /** Trần tỉ lệ điểm ảnh renderer (thực tế = min(devicePixelRatio, trần)). */
  maxPixelRatio: number;
  /** Tỉ lệ khán giả sân được vẽ (crowd.setQuality → instanceCount, không dựng lại). */
  crowd: number;
}
/**
 * 'high' = đúng như game trước khi có bộ điều tốc (pixel ratio ≤ 1,5, đủ khán giả). 'ultra' chỉ nét hơn trên màn
 * mật độ cao (≤ 2), không đổi hình. medium/low: bớt điểm ảnh rồi thưa khán giả (thưa đều, không bỏ hàng sau).
 */
export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  ultra: { maxPixelRatio: 2, crowd: 1 },
  high: { maxPixelRatio: 1.5, crowd: 1 },
  medium: { maxPixelRatio: 1, crowd: 0.7 },
  low: { maxPixelRatio: 0.75, crowd: 0.4 },
};

export const isQualityMode = (v: unknown): v is QualityMode => typeof v === 'string' && (QUALITY_MODES as readonly string[]).includes(v);

/**
 * Tỉ lệ điểm ảnh renderer cho một bậc. `lowResPost` (phong cách pixel: cảnh vẽ vào đích thấp ≤ 270 dòng rồi phóng
 * nguyên lần) → núm này vô nghĩa với chi phí 3D, còn hạ nó chỉ làm trình duyệt phóng mờ ảnh pixel: giữ nguyên như bậc high.
 */
export function pixelRatioFor(tier: QualityTier, dpr: number, lowResPost = false): number {
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const cap = lowResPost ? TIER_SETTINGS.high.maxPixelRatio : TIER_SETTINGS[tier].maxPixelRatio;
  // Không vẽ nét hơn màn hình, nhưng bậc dưới 1 (0,75) vẫn được phép thấp hơn devicePixelRatio = 1.
  return Math.min(d, cap);
}

/** Khử răng cưa MSAA (chỉ chọn được lúc tạo context): vô ích khi pixel ratio ≥ 2, quá đắt ở bậc thấp. */
export function wantAntialias(tier: QualityTier, pixelRatio: number): boolean {
  return tier !== 'low' && pixelRatio < 2;
}

export interface DeviceHints {
  cores?: number;
  /** GB (navigator.deviceMemory, chỉ Chromium; làm tròn xuống, tối đa 8). */
  memoryGB?: number;
  /** Chuỗi GPU (WEBGL_debug_renderer_info hoặc gl.RENDERER), '' nếu không biết. */
  gpu?: string;
  mobile?: boolean;
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/i;
const DISCRETE_GPU = /nvidia|geforce|quadro|rtx|gtx|radeon (rx|pro|r9|hd [5-9]\d{3})|arc a\d/i;
const WEAK_GPU = /mali-[4t]|adreno \(tm\) [2-5]\d\d|powervr|intel.*hd graphics( [2-5]\d{2,3})?\b|gma/i;

/** Bậc khởi đầu từ thông tin thiết bị (đoán nhanh, bộ điều tốc sửa tiếp): máy yếu không bắt đầu ở ultra. */
export function guessStartTier(h: DeviceHints): QualityTier {
  const gpu = h.gpu ?? '';
  const cores = h.cores ?? 4;
  const mem = h.memoryGB ?? 8;
  if (SOFTWARE_GPU.test(gpu)) return 'low';
  if (cores <= 2 || mem <= 2) return 'low';
  if (h.mobile) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  if (WEAK_GPU.test(gpu) || cores <= 4 || mem <= 4) return 'medium';
  if (DISCRETE_GPU.test(gpu)) return 'ultra';
  // Đồ hoạ tích hợp đời mới (Iris Xe, Radeon Graphics, Apple) hoặc không rõ: như game gốc.
  return 'high';
}

export interface GovernorOptions {
  targetFps: number;
  /** Dưới mức sàn: hạ 2 bậc một lần (còn xa mục tiêu, hội tụ nhanh hơn). */
  floorFps: number;
  /** Hạ bậc khi fps < targetFps × downRatio liên tục downAfterSec giây. */
  downRatio: number;
  downAfterSec: number;
  /** Nâng bậc khi fps ≥ targetFps × upRatio liên tục upAfterSec giây. */
  upRatio: number;
  upAfterSec: number;
  /** Bậc vừa nâng mà phải hạ trong probationSec giây → cấm bậc đó (trần hạ xuống). */
  probationSec: number;
  /** Không đổi trong warmupSec giây đầu (biên dịch shader) — cũng dùng sau khi dựng lại world. */
  warmupSec: number;
  /** Sau mỗi lần đổi bậc / quay lại sau tạm dừng: bỏ qua mẫu trong settleSec giây. */
  settleSec: number;
  /** fps được đo theo từng đoạn ≥ periodSec giây (bỏ frame tệ nhất của đoạn: một lần khựng không quyết định). */
  periodSec: number;
  /** Một frame dài hơn mức này (ms) chỉ được tính bằng mức này vào thời gian tích luỹ. */
  maxSampleMs: number;
}
export const GOVERNOR_DEFAULTS: GovernorOptions = {
  targetFps: 60, floorFps: 30, downRatio: 0.85, downAfterSec: 2, upRatio: 0.95, upAfterSec: 10,
  probationSec: 20, warmupSec: 3, settleSec: 1, periodSec: 0.5, maxSampleMs: 1000,
};

export interface QualityGovernor {
  readonly tier: QualityTier;
  /** Bậc cao nhất còn được phép (hạ dần khi một lần nâng thử thất bại). */
  readonly ceiling: QualityTier;
  /** fps của đoạn đo gần nhất (0 khi chưa có). */
  readonly fps: number;
  /**
   * Một mẫu frame time (ms). active=false (tạm dừng, tab ẩn, cảnh không vẽ mỗi frame): bỏ mẫu, xoá bộ đếm.
   * Trả về bậc mới nếu vừa đổi, null nếu giữ nguyên.
   */
  sample(frameMs: number, active: boolean): QualityTier | null;
  /** Không đổi bậc trong `sec` giây mẫu tới (vd. sau khi dựng lại world). */
  hold(sec: number): void;
  /** Bắt đầu lại từ một bậc (xoá trần, xoá bộ đếm, có warmup). */
  reset(tier: QualityTier): void;
}

const idx = (t: QualityTier) => QUALITY_TIERS.indexOf(t);

export function createGovernor(start: QualityTier, options: Partial<GovernorOptions> = {}): QualityGovernor {
  const o: GovernorOptions = { ...GOVERNOR_DEFAULTS, ...options };
  let tier = start;
  let ceiling: QualityTier = 'ultra';
  let fps = 0;
  let holdSec = o.warmupSec;
  // Đoạn đo hiện tại.
  let pFrames = 0, pMs = 0, pWorst = 0;
  let slowFor = 0;
  let fastFor = 0;
  let sinceUp = Infinity; // giây kể từ lần nâng bậc gần nhất
  let wasActive = false;

  const clearCounters = () => { slowFor = fastFor = 0; pFrames = pMs = pWorst = 0; fps = 0; };
  const change = (to: QualityTier): QualityTier => {
    tier = to;
    const last = fps;
    clearCounters();
    fps = last; // giữ số đo đã dẫn tới quyết định (để ghi log)
    holdSec = Math.max(holdSec, o.settleSec);
    return to;
  };

  return {
    get tier() { return tier; },
    get ceiling() { return ceiling; },
    get fps() { return fps; },
    sample(frameMs, active) {
      if (!active || !(frameMs > 0)) {
        if (wasActive) clearCounters();
        wasActive = false;
        return null;
      }
      if (!wasActive) { wasActive = true; holdSec = Math.max(holdSec, o.settleSec); }
      const ms = Math.min(frameMs, o.maxSampleMs);
      sinceUp += ms / 1000;
      if (holdSec > 0) { holdSec -= ms / 1000; return null; }
      pFrames++;
      pMs += ms;
      pWorst = Math.max(pWorst, ms);
      if (pMs < o.periodSec * 1000) return null;
      // Hết một đoạn: fps bỏ frame tệ nhất (nếu đủ frame), thời gian đoạn cộng vào bộ đếm chậm / nhanh.
      const sec = pMs / 1000;
      fps = pFrames >= 3 ? ((pFrames - 1) * 1000) / (pMs - pWorst) : (pFrames * 1000) / pMs;
      pFrames = pMs = pWorst = 0;
      slowFor = fps < o.targetFps * o.downRatio ? slowFor + sec : 0;
      fastFor = fps >= o.targetFps * o.upRatio ? fastFor + sec : 0;
      const i = idx(tier);
      if (i > 0 && slowFor >= o.downAfterSec) {
        // Bậc này vừa được nâng lên thử mà không giữ nổi → cấm nó (trần = bậc dưới).
        if (sinceUp < o.probationSec) ceiling = QUALITY_TIERS[i - 1];
        sinceUp = Infinity;
        return change(QUALITY_TIERS[Math.max(0, i - (fps < o.floorFps ? 2 : 1))]);
      }
      if (fastFor >= o.upAfterSec && i < idx(ceiling)) {
        sinceUp = 0;
        return change(QUALITY_TIERS[i + 1]);
      }
      return null;
    },
    hold(sec) { holdSec = Math.max(holdSec, sec); clearCounters(); },
    reset(t) {
      tier = t;
      ceiling = 'ultra';
      sinceUp = Infinity;
      clearCounters();
      holdSec = o.warmupSec;
    },
  };
}
