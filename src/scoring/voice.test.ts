import { describe, expect, it } from 'vitest';
import type { PitchSample, Song } from '../core/types';
import { createVoiceScoring } from './voice';

const voice: PitchSample = { hz: 220, midi: 57, clarity: 1, rms: 0.2 };
const base: Song = {
  title: '', artist: '', license: '', attribution: '', bpm: 120, gapMs: 0, visualBpm: 120, audioUrl: '',
  lines: [], durationSec: 60, hasNotes: false, mode: 'audio',
};

describe('voice scoring', () => {
  it('hype tăng khi hát, giảm khi im', () => {
    const s = createVoiceScoring();
    s.reset(base);
    let h = 0;
    for (let i = 0; i < 300; i++) h = s.update(i / 60, voice, 0, 1 / 60).hype;
    expect(h).toBeGreaterThan(0.6);
    // Im lặng ngắn (dưới 4 s) không trừ Hype đáng kể...
    const peak = h;
    for (let i = 300; i < 480; i++) h = s.update(i / 60, null, 0, 1 / 60).hype;
    expect(h).toBeGreaterThan(peak - 0.1);
    // ...im lặng dài thì Hype giảm dần.
    for (let i = 480; i < 2100; i++) h = s.update(i / 60, null, 0, 1 / 60).hype;
    expect(h).toBeLessThan(0.5);
  });
  it('lrc: ngoài câu lời không tính', () => {
    const s = createVoiceScoring();
    s.reset({ ...base, mode: 'lrc', lyrics: [{ startSec: 100, endSec: 110, text: 'a' }] });
    let st = s.update(0, voice, 0, 1 / 60);
    for (let i = 1; i < 300; i++) st = s.update(i / 60, voice, 0, 1 / 60);
    expect(st.score).toBe(0);
    expect(st.hype).toBeCloseTo(0.3, 2);
  });
});
