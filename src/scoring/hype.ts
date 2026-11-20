/** Hype meter thuần: không phụ thuộc DOM/audio, tích phân theo dt nên không đổi theo FPS. */
export type HypeInput = 'hit' | 'miss' | 'rest';

export const HYPE_START = 0.3;
export const HYPE_RISE = 0.25; // /s khi đúng
export const HYPE_FALL = 0.15; // /s khi sai hoặc im lặng trong nốt
export const HYPE_DRIFT = 0.02; // /s về 0,3 trong đoạn nghỉ
export const HYPE_SMOOTH_TAU = 0.5; // s

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface HypeMeter {
  reset(): void;
  /** Trả về hype đã làm mượt (0..1). */
  update(input: HypeInput, dt: number): number;
  readonly raw: number;
  readonly value: number;
}

export function createHypeMeter(): HypeMeter {
  let raw = HYPE_START;
  let smooth = HYPE_START;
  return {
    reset() {
      raw = HYPE_START;
      smooth = HYPE_START;
    },
    update(input, dt) {
      if (!(dt > 0)) return smooth;
      if (input === 'hit') raw += HYPE_RISE * dt;
      else if (input === 'miss') raw -= HYPE_FALL * dt;
      else {
        const diff = HYPE_START - raw;
        const step = HYPE_DRIFT * dt;
        raw += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
      }
      raw = clamp01(raw);
      smooth = clamp01(smooth + (raw - smooth) * (1 - Math.exp(-dt / HYPE_SMOOTH_TAU)));
      return smooth;
    },
    get raw() {
      return raw;
    },
    get value() {
      return smooth;
    },
  };
}
