import type { FrameState } from '../core/types';

export interface CrowdAudio {
  update(f: FrameState): void;
  cheer(strength?: number): void;
  setVolume(v: number): void;
  dispose(): void;
}

const MASTER_DEFAULT = 0.2; // about -14 dBFS at max hype
const CHEER_COOLDOWN = 6;
const TC = 0.25;

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createCrowdAudio(ctx: AudioContext, destination?: AudioNode): CrowdAudio {
  const rnd = Math.random;
  let disposed = false;
  let volume = 1;
  let lastHype = 0;
  let lastPulse = 0;
  let lastCheerAt = -100;
  let lastModAt = -100;
  let lastClapAt = -100;
  const transient = new Set<AudioScheduledSourceNode>();

  // shared ~2 s noise buffer (pink-ish via simple filter, normalized)
  const len = Math.floor(ctx.sampleRate * 2);
  const noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, peak = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = b0 + b1 + b2 + w * 0.1848;
      peak = Math.max(peak, Math.abs(d[i]));
    }
    const fade = Math.floor(ctx.sampleRate * 0.02);
    for (let i = 0; i < len; i++) d[i] /= peak;
    // crossfade loop seam
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t;
    }
  }

  // output chain
  const master = ctx.createGain();
  master.gain.value = MASTER_DEFAULT;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 10;
  comp.ratio.value = 12;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(destination ?? ctx.destination);

  const bedGain = ctx.createGain();
  bedGain.gain.value = 0;
  bedGain.connect(master);
  const swellBus = ctx.createGain();
  swellBus.gain.value = 1;
  swellBus.connect(master);

  const loop = (): AudioBufferSourceNode => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    return s;
  };

  interface Layer { src: AudioBufferSourceNode; bp: BiquadFilterNode; g: GainNode; f: number; q: number; w: number }
  const layerDefs: Array<[number, number, number, number]> = [
    // freq, Q, weight, rate  (rumble, murmur, roar, hiss/air)
    [180, 0.6, 1.0, 0.9],
    [600, 0.8, 1.0, 1.0],
    [1500, 0.7, 0.7, 1.07],
    [3800, 0.6, 0.35, 1.13],
  ];
  const layers: Layer[] = layerDefs.map(([f, q, w, rate]) => {
    const src = loop();
    src.playbackRate.value = rate;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = w;
    src.connect(bp);
    bp.connect(g);
    g.connect(bedGain);
    try { src.start(0, rnd() * 1.5); } catch { /* ignore */ }
    return { src, bp, g, f, q, w };
  });

  function track(s: AudioScheduledSourceNode, stopAt: number, ...nodes: AudioNode[]) {
    transient.add(s);
    s.onended = () => {
      transient.delete(s);
      try { s.disconnect(); } catch { /* */ }
      nodes.forEach((n) => { try { n.disconnect(); } catch { /* */ } });
    };
    try { s.stop(stopAt); } catch { /* */ }
  }

  function cheer(strength = 1): void {
    if (disposed) return;
    try {
      const st = Math.min(1.5, Math.max(0.1, strength));
      const t = ctx.currentTime + 0.01;
      const dur = 1.5 + rnd() * 1.5;
      const peakAt = t + dur * 0.3;
      // noise swell
      const src = loop();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(700, t);
      bp.frequency.exponentialRampToValueAtTime(2200, peakAt);
      bp.frequency.exponentialRampToValueAtTime(900, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.9 * st, peakAt);
      g.gain.setTargetAtTime(0, peakAt, dur * 0.25);
      src.connect(bp); bp.connect(g); g.connect(swellBus);
      src.start(t, rnd() * 1.5);
      track(src, t + dur + 0.8, bp, g);
      // "woo" voices
      const n = 3 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const base = 330 + rnd() * 330;
        const t0 = t + rnd() * 0.3;
        o.frequency.setValueAtTime(base * 0.8, t0);
        o.frequency.exponentialRampToValueAtTime(base * (1.2 + rnd() * 0.3), t0 + dur * 0.4);
        o.frequency.exponentialRampToValueAtTime(base * 0.95, t0 + dur * 0.9);
        o.detune.value = (rnd() - 0.5) * 60;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 4;
        f.frequency.setValueAtTime(500, t0);
        f.frequency.linearRampToValueAtTime(1100, t0 + dur * 0.4); // oo -> ah
        f.frequency.linearRampToValueAtTime(700, t0 + dur * 0.9);
        const vg = ctx.createGain();
        vg.gain.setValueAtTime(0, t0);
        vg.gain.linearRampToValueAtTime(0.12 * st, t0 + dur * 0.3);
        vg.gain.setTargetAtTime(0, t0 + dur * 0.4, dur * 0.2);
        o.connect(f); f.connect(vg); vg.connect(swellBus);
        o.start(t0);
        track(o, t0 + dur + 0.8, f, vg);
      }
    } catch { /* never throw */ }
  }

  function clap(vel: number): void {
    try {
      const t = ctx.currentTime + 0.005 + rnd() * 0.02;
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      s.playbackRate.value = 0.9 + rnd() * 0.4;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400 + rnd() * 1800;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      const peak = (0.12 + rnd() * 0.1) * vel;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004);
      g.gain.setTargetAtTime(0, t + 0.006, 0.02);
      s.connect(bp); bp.connect(g); g.connect(master);
      s.start(t, rnd() * 1.8);
      track(s, t + 0.15, bp, g);
    } catch { /* */ }
  }

  function update(f: FrameState): void {
    if (disposed) return;
    try {
      const now = ctx.currentTime;
      const hype = Math.min(1, Math.max(0, f.hype));
      const lvl = smooth(0.05, 0.9, hype);
      const bright = smooth(0.2, 0.85, hype);
      bedGain.gain.setTargetAtTime(0.04 + 0.6 * lvl * lvl + 0.2 * lvl, now, 0.4);

      // slow random modulation of layers (~every 0.6 s)
      if (now - lastModAt > 0.6 || now < lastModAt) {
        lastModAt = now;
        layers.forEach((l, i) => {
          const tilt = i < 2 ? 1 - 0.5 * bright : 0.3 + 1.2 * bright; // low layers dominate quiet, highs open up
          const wob = 0.6 + rnd() * 0.8;
          l.g.gain.setTargetAtTime(l.w * tilt * wob, now, 0.5);
          l.bp.frequency.setTargetAtTime(l.f * (0.8 + 0.4 * rnd()) * (0.8 + 0.5 * bright), now, 0.6);
        });
      }

      // cheers
      const rising = lastHype < 0.7 && hype >= 0.7;
      if (rising && now - lastCheerAt > 2) {
        lastCheerAt = now;
        cheer(0.8 + 0.4 * hype);
      } else if (hype > 0.75 && now - lastCheerAt >= CHEER_COOLDOWN + rnd() * 2 && rnd() < 0.05) {
        lastCheerAt = now;
        cheer(0.6 + 0.5 * hype);
      }
      lastHype = hype;

      // claps on beat rising edge
      const edge = f.beatPulse > 0.8 && lastPulse < 0.5;
      lastPulse = f.beatPulse;
      if (edge && hype > 0.5 && now - lastClapAt > 0.15) {
        lastClapAt = now;
        const n = 1 + Math.floor(rnd() * 2);
        const v = smooth(0.5, 1, hype) * 0.8 + 0.2;
        for (let i = 0; i < n; i++) clap(v);
      }
    } catch { /* */ }
  }

  function setVolume(v: number): void {
    volume = Math.min(2, Math.max(0, Number.isFinite(v) ? v : 1));
    if (!disposed) {
      try { master.gain.setTargetAtTime(MASTER_DEFAULT * volume, ctx.currentTime, TC); } catch { /* */ }
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const s of transient) { try { s.stop(); } catch { /* */ } try { s.disconnect(); } catch { /* */ } }
    transient.clear();
    for (const l of layers) {
      try { l.src.stop(); } catch { /* */ }
      try { l.src.disconnect(); l.bp.disconnect(); l.g.disconnect(); } catch { /* */ }
    }
    for (const n of [bedGain, swellBus, master, comp]) { try { n.disconnect(); } catch { /* */ } }
  }

  void volume;
  return { update, cheer, setVolume, dispose };
}
