export interface CrowdSing {
  /** Call once per frame. hz = melody pitch the crowd should sing now (null = rest); amount 0..1. */
  update(hz: number | null, amount: number): void;
  dispose(): void;
}

const MASTER = 0.12;
const VOICES = 10;
const LO = 130;
const HI = 520;

/** Fold hz into [LO, HI) by octaves. */
function fold(hz: number): number {
  let h = hz;
  while (h >= HI) h /= 2;
  while (h < LO) h *= 2;
  return h;
}

interface Voice {
  osc: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  octave: number;
  detune: number;
  glide: number;
  lag: number;
}

export function createCrowdSing(ctx: AudioContext, destination?: AudioNode): CrowdSing {
  const rnd = Math.random;
  let disposed = false;
  let lastHz = 220;
  let lastAmount = 0;
  let pendingHz: number | null = null;
  const voices: Voice[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  master.connect(comp);
  comp.connect(destination ?? ctx.destination);

  // vowel formants "ah" + "oh" blend (parallel band-pass)
  const bus = ctx.createGain();
  bus.gain.value = 1;
  const formants: Array<[number, number, number]> = [
    [700, 5, 1.0],
    [1150, 7, 0.6],
    [2600, 9, 0.25],
  ];
  const wander = ctx.createGain();
  void wander;
  for (const [f, q, g] of formants) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const fg = ctx.createGain();
    fg.gain.value = g * 2.2;
    bus.connect(bp);
    bp.connect(fg);
    fg.connect(master);
  }

  try {
    for (let i = 0; i < VOICES; i++) {
      const osc = ctx.createOscillator();
      osc.type = i % 3 === 0 ? 'square' : 'sawtooth';
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.2 + rnd() * 2.2;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 8 + rnd() * 10; // cents
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      const g = ctx.createGain();
      g.gain.value = 0.55 / Math.sqrt(VOICES);
      osc.connect(g);
      g.connect(bus);
      const v: Voice = {
        osc, lfo, lfoGain,
        octave: i % 2 === 0 ? 1 : 0.5,
        detune: (rnd() * 2 - 1) * 25,
        glide: 0.04 + rnd() * 0.08,
        lag: rnd() * 0.06,
      };
      osc.detune.value = 0;
      osc.frequency.value = fold(lastHz) * v.octave;
      voices.push(v);
      osc.start();
      lfo.start();
      sources.push(osc, lfo);
    }
    // breath noise
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    src.connect(bp);
    bp.connect(ng);
    ng.connect(master);
    src.start();
    sources.push(src);
  } catch {
    /* never throw */
  }

  function setPitch(hz: number): void {
    const base = fold(hz);
    const now = ctx.currentTime;
    for (const v of voices) {
      try {
        const target = base * v.octave * Math.pow(2, v.detune / 1200);
        v.glide = Math.min(0.12, Math.max(0.04, v.glide + (rnd() - 0.5) * 0.02));
        v.osc.frequency.setTargetAtTime(target, now + v.lag, v.glide / 3);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    update(hz, amount) {
      if (disposed) return;
      try {
        const a = Math.min(1, Math.max(0, amount));
        const sing = hz !== null && hz > 0;
        if (sing && (pendingHz === null || Math.abs(Math.log2(hz! / pendingHz)) > 0.01)) {
          pendingHz = hz!;
          lastHz = hz!;
          setPitch(hz!);
        }
        const target = sing ? a * MASTER : 0;
        const rising = target > lastAmount;
        if (Math.abs(target - lastAmount) > 0.002 || target === 0) {
          master.gain.setTargetAtTime(target, ctx.currentTime, rising ? 0.05 : 0.13);
        }
        lastAmount = target;
      } catch {
        /* suspended or closed context: ignore */
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const t of timers) clearTimeout(t);
      try {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      } catch { /* ignore */ }
      const stopAt = ctx.currentTime + 0.4;
      for (const s of sources) {
        try { s.stop(stopAt); } catch { /* ignore */ }
      }
      setTimeout(() => {
        try { master.disconnect(); comp.disconnect(); bus.disconnect(); } catch { /* ignore */ }
      }, 600);
    },
  };
}
