/**
 * Phần thuần của nhận diện cao độ (không đụng Web Audio) để test bằng Vitest.
 * pitchy (McLeod) → lọc clarity/RMS/dải tần → trung vị 3 mẫu.
 */
import { PitchDetector } from 'pitchy';
import { hzToMidi } from '../core/time';
import type { PitchSample } from '../core/types';

export const FFT_SIZE = 2048;
export const MIN_CLARITY = 0.85;
/** RMS dưới ngưỡng này coi là im lặng (biên độ float -1..1). */
export const MIN_RMS = 0.01;
export const MIN_HZ = 70;
export const MAX_HZ = 1000;

export function rms(buf: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return buf.length ? Math.sqrt(s / buf.length) : 0;
}

export interface Detector {
  /** Một mẫu thô đã lọc clarity/RMS/dải tần; null = im lặng hoặc không rõ. */
  detect(buf: Float32Array, sampleRate: number): PitchSample | null;
}

export function createDetector(size = FFT_SIZE): Detector {
  const pd = PitchDetector.forFloat32Array(size);
  pd.minVolumeAbsolute = 0; // tự gate RMS bên dưới
  return {
    detect(buf, sampleRate) {
      const level = rms(buf);
      if (level < MIN_RMS) return null;
      const [hz, clarity] = pd.findPitch(buf, sampleRate);
      if (!(clarity >= MIN_CLARITY) || !(hz >= MIN_HZ && hz <= MAX_HZ)) return null;
      return { hz, midi: hzToMidi(hz), clarity, rms: level };
    },
  };
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
