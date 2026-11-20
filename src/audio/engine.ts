// STUB P0 — gói P3 thay bằng AudioEngine thật (decode, phát, đồng hồ, analyser).
import type { AudioEngine } from '../core/types';

export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  let startAt: number | null = null;
  const fakeDuration = 20;
  return {
    ctx,
    resume: () => ctx.resume(),
    async load() {},
    play(leadInSec) {
      startAt = ctx.currentTime + leadInSec;
    },
    stop() {
      startAt = null;
    },
    now: () => (startAt === null ? 0 : ctx.currentTime - startAt),
    level: () => 0.3,
    get ended() {
      return startAt !== null && ctx.currentTime - startAt > fakeDuration;
    },
    durationSec: fakeDuration,
  };
}
