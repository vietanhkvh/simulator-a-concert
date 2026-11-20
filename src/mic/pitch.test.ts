import { describe, expect, it } from 'vitest';
import { hzToMidi } from '../core/time';
import type { PitchSample } from '../core/types';
import { createMic } from './input';
import { createDetector, createMedianFilter, fakeHz, FFT_SIZE, rms } from './pitch';

const SR = 48000;

function sine(hz: number, amp = 0.3, phase = 0, sr = SR): Float32Array {
  const b = new Float32Array(FFT_SIZE);
  for (let i = 0; i < b.length; i++) b[i] = amp * Math.sin(phase + (2 * Math.PI * hz * i) / sr);
  return b;
}

function noise(amp: number, seed = 1): Float32Array {
  const b = new Float32Array(FFT_SIZE);
  let x = seed;
  for (let i = 0; i < b.length; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    b[i] = amp * ((x / 2147483648) * 2 - 1);
  }
  return b;
}

const sample = (hz: number): PitchSample => ({ hz, midi: hzToMidi(hz), clarity: 1, rms: 0.2 });

describe('detector', () => {
  const det = createDetector();
  for (const hz of [82.41, 110, 196, 261.63, 440, 659.25, 880]) {
    it(`sine ${hz} Hz → within 0.1 semitone`, () => {
      const s = det.detect(sine(hz, 0.3, 0.7), SR);
      expect(s).not.toBeNull();
      expect(Math.abs(s!.midi - hzToMidi(hz))).toBeLessThan(0.1);
      expect(s!.clarity).toBeGreaterThan(0.85);
    });
  }
  it('works at 44.1 kHz', () => {
    const s = det.detect(sine(330, 0.3, 0, 44100), 44100);
    expect(Math.abs(s!.midi - hzToMidi(330))).toBeLessThan(0.1);
  });
  it('silence → null', () => {
    expect(det.detect(new Float32Array(FFT_SIZE), SR)).toBeNull();
  });
  it('quiet sine below RMS gate → null', () => {
    expect(det.detect(sine(440, 0.005), SR)).toBeNull();
  });
  it('white noise → null (low clarity)', () => {
    expect(det.detect(noise(0.3), SR)).toBeNull();
  });
  it('out of range (40 Hz) → null', () => {
    expect(det.detect(sine(40, 0.3), SR)).toBeNull();
  });
  it('rms of sine ≈ amp/√2', () => {
    expect(rms(sine(440, 0.4))).toBeCloseTo(0.4 / Math.SQRT2, 2);
  });
});

describe('median filter', () => {
  it('removes a single octave jump', () => {
    const f = createMedianFilter();
    f(sample(220));
    f(sample(220));
    expect(f(sample(440))!.hz).toBe(220);
    expect(f(sample(220))!.hz).toBe(220);
  });
  it('null input → null output immediately', () => {
    const f = createMedianFilter();
    f(sample(220));
    expect(f(null)).toBeNull();
    expect(f(sample(300))!.hz).toBe(300);
  });
});

describe('fakeHz', () => {
  it('modes', () => {
    expect(fakeHz('perfect', 440)).toBe(440);
    expect(fakeHz('perfect', null)).toBeNull();
    expect(hzToMidi(fakeHz('off', 440)!) - 69).toBeCloseTo(3, 6);
    expect(fakeHz('octave', 300)).toBe(600);
    expect(fakeHz('octave', 600)).toBe(300);
  });
});

describe('createMic (no Web Audio available)', () => {
  it('fake perfect reads target without start', () => {
    let t: number | null = 261.63;
    const mic = createMic({ mode: 'perfect', targetHz: () => t });
    expect(Math.abs(mic.read()!.midi - 60)).toBeLessThan(0.3);
    t = null;
    expect(mic.read()).toBeNull();
  });
  it('real mode without mic falls back to perfect and does not reject', async () => {
    const mic = createMic({ mode: 'real', targetHz: () => 440 });
    const mode = await mic.start({} as AudioContext);
    expect(mode).toBe('perfect');
    expect(mic.mode).toBe('perfect');
    expect(mic.read()!.hz).toBe(440);
    mic.stop();
    expect(mic.read()).toBeNull();
  });
  it('octave/off fake modes', async () => {
    const mic = createMic({ mode: 'octave', targetHz: () => 220 });
    expect(await mic.start({} as AudioContext)).toBe('octave');
    expect(mic.read()!.hz).toBe(440);
    const off = createMic({ mode: 'off', targetHz: () => 440 });
    expect(off.read()!.midi).toBeCloseTo(72, 6);
  });
});
