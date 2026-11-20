import { describe, expect, it } from 'vitest';
import { hzToMidi, noteAt, pitchToHz } from '../core/time';
import type { PitchSample, ScoreState } from '../core/types';
import { mockSong } from '../dev/mocks';
import { createHypeMeter } from './hype';
import { createScoring } from './scoring';

const sample = (midi: number): PitchSample => ({ hz: 440 * Math.pow(2, (midi - 69) / 12), midi, clarity: 1, rms: 0.1 });

/** offset: nửa cung lệch so với nốt mục tiêu; null = luôn im lặng. */
function run(offset: number | null, fps = 60, latency = 0) {
  const song = mockSong();
  const eng = createScoring();
  eng.reset(song);
  const dt = 1 / fps;
  let s!: ScoreState;
  let minH = 1, maxH = 0;
  for (let t = 0; t <= song.durationSec + 0.5; t += dt) {
    const n = noteAt(song, t - latency);
    const p = offset === null || !n ? null : sample(n.pitch + 60 + offset);
    s = eng.update(t, p, latency, dt);
    minH = Math.min(minH, s.hype);
    maxH = Math.max(maxH, s.hype);
  }
  return { s, minH, maxH };
}

describe('scoring', () => {
  it('perfect singing gives ~100%', () => {
    const { s } = run(0);
    expect(s.percent).toBeGreaterThan(98);
    expect(s.score).toBeGreaterThan(9800);
    expect(s.combo).toBe(32);
    expect(s.hype).toBeGreaterThan(0.9);
  });
  it('perfect with latency compensation still ~100%', () => {
    expect(run(0, 60, 0.12).s.percent).toBeGreaterThan(98);
  });
  it('silence gives 0 and hype decays', () => {
    const { s, minH } = run(null);
    expect(s.percent).toBe(0);
    expect(s.score).toBe(0);
    expect(minH).toBeLessThan(0.3);
  });
  it('one octave off (or two) still scores', () => {
    expect(run(12).s.percent).toBeGreaterThan(98);
    expect(run(-12).s.percent).toBeGreaterThan(98);
  });
  it('1 semitone off scores, 2 semitones off does not', () => {
    expect(run(1).s.percent).toBeGreaterThan(98);
    expect(run(2).s.percent).toBe(0);
    expect(run(-3).s.percent).toBe(0);
  });
  it('hype stays in [0,1]', () => {
    for (const o of [0, 3, null]) {
      const { minH, maxH } = run(o);
      expect(minH).toBeGreaterThanOrEqual(0);
      expect(maxH).toBeLessThanOrEqual(1);
    }
  });
  it('is independent of dt step size', () => {
    const a = run(0, 60).s, b = run(0, 30).s;
    expect(Math.abs(a.percent - b.percent)).toBeLessThan(1);
    expect(Math.abs(a.score - b.score)).toBeLessThan(300);
    const h1 = run(2, 60), h2 = run(2, 30);
    expect(Math.abs(h1.s.hype - h2.s.hype)).toBeLessThan(0.03);
  });
  it('half-sung note scores about half', () => {
    const song = mockSong();
    const eng = createScoring();
    eng.reset(song);
    let s!: ScoreState;
    for (let t = 0; t <= song.durationSec + 0.5; t += 1 / 60) {
      const n = noteAt(song, t);
      const sing = n && t < (n.startSec + n.endSec) / 2;
      s = eng.update(t, sing ? sample(n!.pitch + 60) : null, 0, 1 / 60);
    }
    expect(s.percent).toBeGreaterThan(45);
    expect(s.percent).toBeLessThan(55);
  });
  it('reports centsOff modulo octave and pitchToHz round trip', () => {
    const song = mockSong();
    const eng = createScoring();
    eng.reset(song);
    const n = song.lines[0].notes[0];
    const hz = pitchToHz(n.pitch) * Math.pow(2, 1 + 0.5 / 12);
    const s = eng.update(n.startSec + 0.1, { hz, midi: hzToMidi(hz), clarity: 1, rms: 0.1 }, 0, 1 / 60);
    expect(s.centsOff).toBe(50);
    expect(s.activeNote).toBe(n);
  });
});

describe('hype meter', () => {
  it('drifts toward 0.3 in rests', () => {
    const h = createHypeMeter();
    for (let i = 0; i < 600; i++) h.update('hit', 1 / 60);
    expect(h.raw).toBe(1);
    for (let i = 0; i < 60 * 60; i++) h.update('rest', 1 / 60);
    expect(h.raw).toBeCloseTo(0.3, 3);
  });
});

describe('scoring with seeks', () => {
  /** Hát đúng (sing=true) hoặc im lặng; jumps: {at: giây, to: giây} — đồng hồ nhảy khi t vượt `at`. */
  function runSeek(jumps: { at: number; to: number; sing?: boolean }[], firstSing = true, explicit = true) {
    const song = mockSong();
    const eng = createScoring();
    eng.reset(song);
    const dt = 1 / 60;
    let s!: ScoreState;
    let t = 0;
    let sing = firstSing;
    let steps = 0;
    const pending = [...jumps];
    let finishedNotes = 0;
    while (t <= song.durationSec + 0.5 && steps++ < 100000) {
      if (pending.length && t >= pending[0].at) {
        const j = pending.shift()!;
        t = j.to;
        if (j.sing !== undefined) sing = j.sing;
        if (explicit) eng.seek!(t, 0);
      }
      const n = noteAt(song, t);
      s = eng.update(t, sing && n ? sample(n.pitch + 60) : null, 0, dt);
      if (s.lastHit === 'miss') finishedNotes++;
      t += dt;
    }
    return { s, song, misses: finishedNotes };
  }

  for (const explicit of [true, false]) {
    const tag = explicit ? 'explicit seek()' : 'auto-detected jump';
    it(`forward seek: skipped notes are not misses (${tag})`, () => {
      const song = mockSong();
      const third = song.durationSec / 3;
      const { s } = runSeek([{ at: third, to: third * 2 }], true, explicit);
      expect(s.percent).toBeGreaterThan(98);
      expect(s.combo).toBeGreaterThan(0);
      expect(s.score).toBeLessThan(9000); // chỉ phần đã hát
    });
    it(`backward seek: notes re-sung replace earlier credit (${tag})`, () => {
      const song = mockSong();
      const half = song.durationSec / 2;
      // Im lặng nửa đầu, tua về 0 rồi hát đúng cả bài: phần im lặng bị xóa.
      const { s } = runSeek([{ at: half, to: 0, sing: true }], false, explicit);
      expect(s.percent).toBeGreaterThan(98);
      expect(s.score).toBeGreaterThan(9800);
    });
    it(`backward seek after singing does not double count (${tag})`, () => {
      const song = mockSong();
      const half = song.durationSec / 2;
      const { s } = runSeek([{ at: half, to: 1 }], true, explicit);
      expect(s.percent).toBeGreaterThan(98);
      expect(s.percent).toBeLessThanOrEqual(100);
      expect(s.score).toBeGreaterThan(9800);
      expect(s.score).toBeLessThanOrEqual(10000);
    });
  }
  it('hype is unchanged by a seek', () => {
    const song = mockSong();
    const eng = createScoring();
    eng.reset(song);
    let s!: ScoreState;
    for (let t = 0; t < 4; t += 1 / 60) {
      const n = noteAt(song, t);
      s = eng.update(t, n ? sample(n.pitch + 60) : null, 0, 1 / 60);
    }
    const before = s.hype;
    eng.seek!(song.durationSec / 2, 0);
    s = eng.update(song.durationSec / 2, null, 0, 0);
    expect(s.hype).toBeCloseTo(before, 6);
  });
});
