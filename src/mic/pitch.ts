/**
 * Phần thuần của nhận diện cao độ (không đụng Web Audio) để test bằng Vitest.
 * pitchy (McLeod) → lọc clarity/RMS/dải tần → trung vị 3 mẫu.
 */
import { PitchDetector } from 'pitchy';
import { hzToMidi } from '../core/time';
import type { PitchSample } from '../core/types';

export const FFT_SIZE = 2048;
export const MIN_CLARITY = 0.85;
/**
 * Ngưỡng RMS cố định cũ (0.01). Micro tích hợp của laptop ở xa miệng thường chỉ cho RMS 0.003–0.015
 * (−50…−36 dBFS) nên bị coi là im lặng, trong khi micro tai nghe sát miệng vượt dễ dàng. Giờ dùng
 * cổng thích nghi theo nền ồn (xem createNoiseGate); hằng này chỉ còn là trần của cổng.
 */
export const MIN_RMS = 0.01;
/** Cổng tuyệt đối thấp nhất (≈ −54 dBFS): dưới mức này coi là im lặng dù nền ồn thấp đến đâu. */
export const ABS_MIN_RMS = 0.002;
/** Cổng = nền ồn × hệ số này (≈ +10 dB trên nền ồn). */
export const NOISE_GATE_RATIO = 3;
/**
 * RMS tối thiểu báo ra cho một mẫu đã qua cổng thích nghi + clarity. Phía chấm điểm (voice.ts) còn
 * một ngưỡng cố định VOICE_MIN_RMS = 0.02; quyết định "có giọng" đã được đưa ra ở đây nên mẫu hợp lệ
 * luôn báo RMS ≥ mức này để micro nhỏ vẫn làm Hype tăng. `level` trong mẫu giữ giá trị đo thật.
 */
export const VOICED_REPORT_RMS = 0.03;
export const MIN_HZ = 70;
export const MAX_HZ = 1000;

export function rms(buf: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return buf.length ? Math.sqrt(s / buf.length) : 0;
}

export interface NoiseGate {
  /** Ngưỡng RMS hiện tại. */
  readonly threshold: number;
  readonly floor: number;
  /** Cập nhật nền ồn bằng một khung KHÔNG có cao độ rõ (giọng hát không làm nền ồn tăng). */
  observe(level: number): void;
}

/**
 * Nền ồn thích nghi: giảm nhanh khi khung yên hơn, tăng chậm (~vài giây) khi ồn kéo dài.
 * Ngưỡng = clamp(nền × NOISE_GATE_RATIO, ABS_MIN_RMS, MIN_RMS).
 */
export function createNoiseGate(initialFloor = 0.001): NoiseGate {
  let floor = initialFloor;
  return {
    get floor() { return floor; },
    get threshold() { return Math.min(MIN_RMS, Math.max(ABS_MIN_RMS, floor * NOISE_GATE_RATIO)); },
    observe(level) {
      if (!(level >= 0)) return;
      floor += (level - floor) * (level < floor ? 0.3 : 0.02);
    },
  };
}

export interface Detector {
  /** Một mẫu thô đã lọc clarity/RMS/dải tần; null = im lặng hoặc không rõ. */
  detect(buf: Float32Array, sampleRate: number): PitchSample | null;
  /** RMS của khung cuối cùng (sau gain phần mềm), 0..1. */
  readonly level: number;
  readonly gate: NoiseGate;
}

export function createDetector(size = FFT_SIZE): Detector {
  const pd = PitchDetector.forFloat32Array(size);
  pd.minVolumeAbsolute = 0; // tự gate RMS bên dưới
  const gate = createNoiseGate();
  let last = 0;
  return {
    get level() { return last; },
    gate,
    detect(buf, sampleRate) {
      const level = rms(buf);
      last = level;
      if (level < gate.threshold) {
        gate.observe(level);
        return null;
      }
      const [hz, clarity] = pd.findPitch(buf, sampleRate);
      if (!(clarity >= MIN_CLARITY) || !(hz >= MIN_HZ && hz <= MAX_HZ)) {
        gate.observe(level);
        return null;
      }
      return { hz, midi: hzToMidi(hz), clarity, rms: Math.max(level, VOICED_REPORT_RMS) };
    },
  };
}

/** Nhân buffer với gain phần mềm (dùng khi không có GainNode, và trong test). */
export function applyGain(buf: Float32Array, gain: number): Float32Array {
  if (gain !== 1) for (let i = 0; i < buf.length; i++) buf[i] *= gain;
  return buf;
}

/** Độ nhạy micro (gain phần mềm) cho phép, lưu ở localStorage. */
export const MIN_SENSITIVITY = 0.5;
export const MAX_SENSITIVITY = 8;
export const DEFAULT_SENSITIVITY = 2;
export function clampSensitivity(g: unknown): number {
  const n = Number(g);
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, n)) : DEFAULT_SENSITIVITY;
}

/** Trung vị theo hz của tối đa 3 mẫu gần nhất; mẫu null hiện tại → null ngay (dứt tiếng không trễ). */
export function createMedianFilter(n = 3): (s: PitchSample | null) => PitchSample | null {
  const hist: (PitchSample | null)[] = [];
  return (s) => {
    hist.push(s);
    if (hist.length > n) hist.shift();
    if (!s) return null;
    const valid = hist.filter((x): x is PitchSample => x !== null).sort((a, b) => a.hz - b.hz);
    // 3 mẫu → lấy giữa; 2 mẫu → không có trung vị rõ ràng, giữ mẫu hiện tại.
    return valid.length === 3 ? valid[1] : s;
  };
}

/** Tần số micro giả theo mode; null = không phát. Quãng tám: lên 8 nếu còn trong dải, không thì xuống. */
export function fakeHz(mode: 'perfect' | 'off' | 'octave', target: number | null): number | null {
  if (target === null || !(target > 0)) return null;
  if (mode === 'off') return target * Math.pow(2, 3 / 12);
  if (mode === 'octave') return target * 2 <= MAX_HZ ? target * 2 : target / 2;
  return target;
}
