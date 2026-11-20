/**
 * P2 — Micro: getUserMedia (tắt echoCancellation/noiseSuppression/autoGainControl) → AnalyserNode → pitchy.
 * Micro giả (perfect/off/octave): OscillatorNode theo targetHz() → cùng AnalyserNode → cùng đường nhận diện.
 * Không nối gì ra ctx.destination (tránh hú, micro giả cũng im lặng).
 * Nếu AudioContext chưa chạy (bị treo) thì micro giả tổng hợp mẫu trực tiếp từ targetHz() để vẫn xác định được.
 */
import { hzToMidi } from '../core/time';
import type { MicInput, MicMode, MicOptions, PitchSample } from '../core/types';
import { createDetector, createMedianFilter, fakeHz, FFT_SIZE } from './pitch';

type FakeMode = Exclude<MicMode, 'real'>;

export function createMic(opts: MicOptions): MicInput {
  let mode: MicMode = opts.mode;
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;
  let source: AudioNode | null = null;
  let osc: OscillatorNode | null = null;
  let oscGain: GainNode | null = null;
  let stopped = false;
  const buf = new Float32Array(FFT_SIZE);
  const detector = createDetector(FFT_SIZE);
  const median = createMedianFilter(3);

  function makeAnalyser(c: AudioContext): AnalyserNode {
    const a = c.createAnalyser();
    a.fftSize = FFT_SIZE;
    a.smoothingTimeConstant = 0;
    return a;
  }

  function startFake(c: AudioContext, m: FakeMode): void {
    mode = m;
    try {
      analyser = makeAnalyser(c);
      osc = c.createOscillator();
      osc.type = 'sine';
      oscGain = c.createGain();
      oscGain.gain.value = 0;
      osc.connect(oscGain).connect(analyser);
      osc.start();
    } catch {
      teardownNodes(); // read() sẽ tổng hợp trực tiếp
    }
  }

  function teardownNodes(): void {
    try { osc?.stop(); } catch { /* đã dừng */ }
    osc?.disconnect();
    oscGain?.disconnect();
    source?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    osc = oscGain = null;
    source = null;
    stream = null;
    analyser = null;
  }

  function synth(m: FakeMode): PitchSample | null {
    const hz = fakeHz(m, opts.targetHz());
    return hz === null ? null : { hz, midi: hzToMidi(hz), clarity: 1, rms: 0.2 };
  }

  return {
    async start(c: AudioContext): Promise<MicMode> {
      ctx = c;
      stopped = false;
      if (opts.mode !== 'real') {
        startFake(c, opts.mode);
        return mode;
      }
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no getUserMedia');
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          video: false,
        });
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return mode;
        }
        stream = s;
        analyser = makeAnalyser(c);
        source = c.createMediaStreamSource(s);
        source.connect(analyser); // KHÔNG nối ra loa
        mode = 'real';
      } catch (err) {
        console.warn('[mic] không dùng được micro, chuyển sang micro giả perfect:', err);
        teardownNodes();
        startFake(c, 'perfect');
      }
      return mode;
    },

    read(): PitchSample | null {
      if (stopped) return null;
      if (mode !== 'real') {
        // Micro giả: cập nhật oscillator theo nốt mục tiêu rồi đi qua đường nhận diện thật.
        if (!ctx || !analyser || !osc || !oscGain || ctx.state !== 'running') return synth(mode);
        const hz = fakeHz(mode, opts.targetHz());
        const t = ctx.currentTime;
        if (hz === null) {
          oscGain.gain.setValueAtTime(0, t);
        } else {
          osc.frequency.setValueAtTime(hz, t);
          oscGain.gain.setValueAtTime(0.3, t);
        }
      }
      if (!ctx || !analyser) return null;
      analyser.getFloatTimeDomainData(buf);
      return median(detector.detect(buf, ctx.sampleRate));
    },

    stop(): void {
      stopped = true;
      teardownNodes();
    },

    get mode() {
      return mode;
    },
  };
}
