// STUB P0 — gói P2 thay bằng micro thật + pitchy + fakeMic bằng oscillator.
import { hzToMidi } from '../core/time';
import type { MicInput, MicMode, MicOptions } from '../core/types';

export function createMic(opts: MicOptions): MicInput {
  let mode: MicMode = opts.mode === 'real' ? 'perfect' : opts.mode;
  return {
    async start() {
      return mode;
    },
    read() {
      if (mode === 'off') return null;
      const hz = opts.targetHz();
      if (hz === null) return null;
      const out = mode === 'octave' ? hz * 2 : hz;
      return { hz: out, midi: hzToMidi(out), clarity: 1, rms: 0.2 };
    },
    stop() {},
    get mode() {
      return mode;
    },
  };
}
