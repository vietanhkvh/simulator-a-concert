import type { AudioEngine } from '../core/types';

export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const gain = ctx.createGain();
  gain.connect(analyser);
  analyser.connect(ctx.destination);
  const levelBuf = new Float32Array(analyser.fftSize);

  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  let startAt: number | null = null;
  let hasEnded = false;
  let smoothed = 0;

  const latency = () => {
    const c = ctx as AudioContext & { outputLatency?: number };
    const l = c.outputLatency;
    return typeof l === 'number' && Number.isFinite(l) && l > 0 ? l : (ctx.baseLatency ?? 0);
  };

  const killSource = () => {
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      /* chưa start / đã dừng */
    }
    source.disconnect();
    source = null;
  };

  return {
    ctx,
    resume: async () => {
      if (ctx.state !== 'running') await ctx.resume();
    },
    async load(buf) {
      // decodeAudioData có thể detach buffer; truyền bản sao để gọi lại được.
      buffer = await ctx.decodeAudioData(buf.slice(0));
    },
    play(leadInSec) {
      if (!buffer) throw new Error('AudioEngine.play: chưa load audio');
      killSource();
      hasEnded = false;
      const when = ctx.currentTime + Math.max(0, leadInSec);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      src.onended = () => {
        if (source === src) hasEnded = true;
      };
      src.start(when);
      source = src;
      startAt = when;
    },
    stop() {
      killSource();
      startAt = null;
      hasEnded = false;
    },
    now: () => (startAt === null ? 0 : ctx.currentTime - startAt - latency()),
    level() {
      analyser.getFloatTimeDomainData(levelBuf);
      let s = 0;
      for (let i = 0; i < levelBuf.length; i++) s += levelBuf[i] * levelBuf[i];
      const rms = Math.sqrt(s / levelBuf.length);
      const target = Math.min(1, rms * 3);
      smoothed = target > smoothed ? target : smoothed * 0.9 + target * 0.1;
      return smoothed;
    },
    get ended() {
      return hasEnded;
    },
    get durationSec() {
      return buffer ? buffer.duration : 0;
    },
  };
}
