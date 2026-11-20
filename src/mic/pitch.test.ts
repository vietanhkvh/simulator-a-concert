import { describe, expect, it } from 'vitest';
import { hzToMidi } from '../core/time';
import type { PitchSample } from '../core/types';
import { createMic } from './input';
import {
  ABS_MIN_RMS, applyGain, clampSensitivity, createDetector, createMedianFilter, createNoiseGate, fakeHz, FFT_SIZE,
  MIN_RMS, rms, VOICED_REPORT_RMS,
} from './pitch';
import { VOICE_MIN_RMS, isVoiced } from '../scoring/voice';

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
  it('sine below absolute RMS gate → null', () => {
    expect(det.detect(sine(440, 0.001), SR)).toBeNull();
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

// Micro tích hợp của laptop ở xa miệng: giọng hát chỉ khoảng −40 dBFS (RMS ≈ 0.007–0.01).
describe('quiet built-in mic', () => {
  const dbfs = (db: number) => Math.pow(10, db / 20) * Math.SQRT2; // biên độ sine cho RMS = db dBFS
  it('−43 dBFS RMS sine (peak −40 dBFS) was below the old fixed gate but is detected now', () => {
    const b = sine(220, dbfs(-43));
    expect(rms(b)).toBeLessThan(MIN_RMS);
    const s = createDetector().detect(b, SR);
    expect(s).not.toBeNull();
    expect(Math.abs(s!.midi - hzToMidi(220))).toBeLessThan(0.1);
    // Mẫu hợp lệ phải vượt cổng VOICE_MIN_RMS của chế độ chấm theo giọng → Hype tăng.
    expect(s!.rms).toBeGreaterThanOrEqual(VOICE_MIN_RMS);
    expect(isVoiced(s)).toBe(true);
  });
  it('−40 dBFS sine at 16 kHz (Bluetooth / separate context) is detected', () => {
    const s = createDetector().detect(sine(220, dbfs(-40), 0, 16000), 16000);
    expect(s).not.toBeNull();
    expect(Math.abs(s!.midi - hzToMidi(220))).toBeLessThan(0.15);
  });
  it('−40 dBFS sine with background noise and 4× software gain', () => {
    const b = sine(220, dbfs(-40));
    const n = noise(0.002, 7);
    for (let i = 0; i < b.length; i++) b[i] += n[i];
    applyGain(b, 4);
    expect(rms(b)).toBeGreaterThan(0.02);
    expect(createDetector().detect(b, SR)).not.toBeNull();
  });
  it('voiced samples report at least VOICED_REPORT_RMS, loud ones keep real rms', () => {
    const det = createDetector();
    expect(det.detect(sine(300, 0.3), SR)!.rms).toBeCloseTo(0.3 / Math.SQRT2, 2);
    expect(det.detect(sine(300, dbfs(-45)), SR)!.rms).toBe(VOICED_REPORT_RMS);
    expect(det.level).toBeCloseTo(Math.pow(10, -45 / 20), 3);
  });
});

describe('adaptive noise gate', () => {
  it('rises slowly with sustained noise, falls fast in quiet', () => {
    const g = createNoiseGate();
    expect(g.threshold).toBeCloseTo(ABS_MIN_RMS * 1.5, 6);
    for (let i = 0; i < 300; i++) g.observe(0.004); // ồn quạt ~5 s ở 60 fps
    expect(g.threshold).toBeGreaterThan(0.01 - 1e-9);
    expect(g.threshold).toBeLessThanOrEqual(MIN_RMS);
    for (let i = 0; i < 20; i++) g.observe(0.0005);
    expect(g.threshold).toBe(ABS_MIN_RMS);
  });
  it('noise frames raise the gate; a voice slightly above noise is still detected', () => {
    const det = createDetector();
    for (let i = 0; i < 200; i++) det.detect(noise(0.004, i + 1), SR);
    expect(det.gate.floor).toBeGreaterThan(0.0015);
    expect(det.detect(noise(0.004, 999), SR)).toBeNull();
    expect(det.detect(sine(220, 0.02), SR)).not.toBeNull();
  });
  it('sustained singing does not raise the gate', () => {
    const det = createDetector();
    const before = det.gate.threshold;
    for (let i = 0; i < 300; i++) det.detect(sine(220, 0.05, i), SR);
    expect(det.gate.threshold).toBe(before);
  });
});

describe('clampSensitivity', () => {
  it('clamps to 0.5–8 and defaults to 2', () => {
    expect(clampSensitivity('3')).toBe(3);
    expect(clampSensitivity(100)).toBe(8);
    expect(clampSensitivity(0.1)).toBe(0.5);
    expect(clampSensitivity('')).toBe(2);
    expect(clampSensitivity('abc')).toBe(2);
  });
});

describe('mic errors', async () => {
  const { isMissingDeviceError, micErrorMessage, normLabel } = await import('./input');
  it('classifies stale deviceId errors', () => {
    expect(isMissingDeviceError({ name: 'OverconstrainedError' })).toBe(true);
    expect(isMissingDeviceError({ name: 'NotAllowedError' })).toBe(false);
    expect(micErrorMessage({ name: 'NotAllowedError' })).toMatch(/chặn quyền/);
  });
  it('matches labels ignoring the Default - prefix', () => {
    expect(normLabel('Default - MacBook Pro Microphone (Built-in)')).toBe('macbook pro microphone (built-in)');
  });
});
