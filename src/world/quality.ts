// Nối bộ điều tốc chất lượng (core/quality.ts, logic thuần) với renderer + world. main.ts:
//   const gfx = createQualityControl(params);            // trước createWorld (cần biết antialias)
//   createWorld(canvas, opts, undefined, gfx.rendererInit());
//   gfx.attach(world)                                     // sau mỗi lần dựng (lại) world
//   gfx.frame(active)                                     // mỗi frame, sau khi vẽ
// Chế độ: ?quality=auto|ultra|high|medium|low (ưu tiên, không lưu) > lựa chọn ở menu tạm dừng (localStorage) > 'auto'.
import {
  createGovernor, guessStartTier, isQualityMode, pixelRatioFor, TIER_SETTINGS, wantAntialias,
  type DeviceHints, type QualityMode, type QualityTier,
} from '../core/quality';
import type { World } from './world';

const KEY = 'cs-gfx-quality';

export interface QualityStatus {
  mode: QualityMode;
  tier: QualityTier;
  /** fps làm mượt của bộ điều tốc (0 khi chưa đo, vd. đang tạm dừng). */
  fps: number;
  pixelRatio: number;
  crowd: number;
  ceiling: QualityTier;
  antialias: boolean;
  /** Bậc đoán ban đầu từ thiết bị + chuỗi GPU. */
  guess: QualityTier;
  gpu: string;
}

export interface QualityControl {
  rendererInit(): { antialias: boolean; pixelRatio: number };
  attach(world: World): void;
  /** `active`: cảnh 3D vừa được vẽ trong frame chạy thật (không tạm dừng, không sảnh, tab hiện). */
  frame(active: boolean): void;
  readonly mode: QualityMode;
  /** Đổi chế độ (menu tạm dừng); `save` = nhớ trong localStorage. */
  setMode(mode: QualityMode, save?: boolean): void;
  /** Dev: chạy lại chế độ tự động từ một bậc. */
  resetAuto(tier: QualityTier): void;
  status(): QualityStatus;
}

function loadMode(): QualityMode | null {
  try { const v = localStorage.getItem(KEY); return isQualityMode(v) ? v : null; } catch { return null; }
}
function saveMode(m: QualityMode): void {
  try { localStorage.setItem(KEY, m); } catch { /* không có localStorage */ }
}

/** Chuỗi GPU qua một context thử (đóng ngay). '' nếu trình duyệt giấu. */
function probeGpu(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return s;
  } catch { return ''; }
}

function deviceHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  return {
    cores: nav.hardwareConcurrency || undefined,
    memoryGB: nav.deviceMemory,
    gpu: probeGpu(),
    mobile: nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent),
  };
}

export function createQualityControl(params: URLSearchParams): QualityControl {
  const urlMode = params.get('quality');
  let mode: QualityMode = isQualityMode(urlMode) ? urlMode : loadMode() ?? 'auto';
  const hints = deviceHints();
  const guess = guessStartTier(hints);
  const gov = createGovernor(mode === 'auto' ? guess : mode);
  const dpr = () => window.devicePixelRatio || 1;
  const initTier = gov.tier;
  const antialias = wantAntialias(initTier, pixelRatioFor(initTier, dpr()));
  let world: World | null = null;
  let applied = { pr: 0, crowd: -1, dpr: 0 };
  let last = 0;
  let fpsMs = 0; // frame time làm mượt để hiển thị (đo cả khi chọn tay)

  const tierNow = (): QualityTier => (mode === 'auto' ? gov.tier : mode);
  const apply = (why: string) => {
    if (!world) return;
    const t = tierNow();
    const pr = pixelRatioFor(t, dpr(), world.postFx() !== null);
    const crowd = TIER_SETTINGS[t].crowd;
    if (pr !== applied.pr) world.setPixelRatio(pr);
    // Luôn gọi: crowd.setQuality tắt bộ tự giảm cũ của khán giả (bộ điều tốc này thay nó).
    world.arena.crowd.setQuality?.(crowd);
    if (why !== 'world' && (pr !== applied.pr || crowd !== applied.crowd)) {
      console.info(`[quality] ${mode} → ${t} (${why}): pixelRatio ${pr}, crowd ${Math.round(crowd * 100)}%, ~${gov.fps.toFixed(1)} fps`);
    }
    applied = { pr, crowd, dpr: dpr() };
  };

  return {
    rendererInit: () => ({ antialias, pixelRatio: pixelRatioFor(initTier, dpr()) }),
    attach(w) {
      world = w;
      applied.pr = w.renderer.getPixelRatio();
      gov.hold(3); // world mới: shader biên dịch ở các frame đầu
      apply('world');
    },
    frame(active) {
      const now = performance.now();
      const ms = last ? now - last : 0;
      last = now;
      if (!active || !(ms > 0)) fpsMs = 0;
      else fpsMs = fpsMs ? fpsMs + (Math.min(ms, 1000) - fpsMs) * (1 - Math.exp(-ms / 1000)) : ms; // τ = 1 s
      if (applied.dpr && dpr() !== applied.dpr) apply('devicePixelRatio'); // kéo cửa sổ sang màn hình khác
      if (mode !== 'auto') return;
      if (gov.sample(ms, active)) apply('auto');
    },
    get mode() { return mode; },
    setMode(m, save = true) {
      mode = m;
      if (save) saveMode(m);
      if (m === 'auto') gov.reset(guess);
      apply('chọn tay');
    },
    resetAuto(t) {
      mode = 'auto';
      gov.reset(t);
      apply('reset');
    },
    status: () => ({
      mode, tier: tierNow(), fps: fpsMs ? +(1000 / fpsMs).toFixed(1) : 0, pixelRatio: applied.pr, crowd: applied.crowd,
      ceiling: gov.ceiling, antialias, guess, gpu: hints.gpu ?? '',
    }),
  };
}
