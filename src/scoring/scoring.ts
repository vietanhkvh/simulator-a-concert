import { noteAt } from '../core/time';
import type { Note, PitchSample, ScoreState, ScoringEngine, Song } from '../core/types';
import { createHypeMeter } from './hype';

export const MAX_SCORE = 10000;
export const HIT_TOLERANCE_SEMITONES = 1.0;
export const NOTE_PASS_RATIO = 0.5;
export const GOLDEN_MULT = 2;

/** Độ lệch (nửa cung) sau khi bỏ quãng tám, trong [-6, 6). */
export function pitchClassDiff(midi: number, notePitch: number): number {
  const x = midi - (notePitch + 60);
  return ((((x % 12) + 12) % 12) + 6) % 12 - 6;
}

const weightOf = (n: Note) => (n.type === 'golden' ? GOLDEN_MULT : 1);

function isHit(n: Note, pitch: PitchSample | null): boolean {
  if (!pitch) return false;
  if (n.type === 'freestyle') return true;
  return Math.abs(pitchClassDiff(pitch.midi, n.pitch)) <= HIT_TOLERANCE_SEMITONES + 1e-9;
}

export function createScoring(): ScoringEngine {
  const hype = createHypeMeter();
  let song: Song | null = null;
  let notes: Note[] = [];
  let hitTime: number[] = [];
  let finished: boolean[] = [];
  let cursor = 0;
  let totalWeight = 0;
  let earned = 0; // giây có trọng số, hát đúng
  let expected = 0; // giây có trọng số, đã trôi qua
  const state: ScoreState = {
    score: 0, percent: 0, combo: 0, hype: 0.3, activeNote: null, lineIndex: -1, lastHit: 'none', centsOff: null,
  };

  function finishNote(i: number) {
    finished[i] = true;
    const n = notes[i];
    if (n.type === 'freestyle') return;
    const ratio = hitTime[i] / Math.max(1e-6, n.endSec - n.startSec);
    if (ratio >= NOTE_PASS_RATIO) {
      state.combo += 1;
      state.lastHit = 'hit';
    } else {
      state.combo = 0;
      state.lastHit = 'miss';
    }
  }

  return {
    reset(s) {
      song = s;
      notes = s.lines.flatMap((l) => l.notes).filter((n) => n.endSec > n.startSec).sort((a, b) => a.startSec - b.startSec);
      hitTime = notes.map(() => 0);
      finished = notes.map(() => false);
      cursor = 0;
      totalWeight = notes.reduce((a, n) => (n.type === 'freestyle' ? a : a + (n.endSec - n.startSec) * weightOf(n)), 0);
      earned = 0;
      expected = 0;
      hype.reset();
      Object.assign(state, {
        score: 0, percent: 0, combo: 0, hype: hype.value, activeNote: null, lineIndex: -1, lastHit: 'none', centsOff: null,
      });
    },
    update(songTime, pitch, latencySec, dt) {
      if (!song) return state;
      const t = songTime - latencySec;
      const a = t - Math.max(0, dt);

      // Mỗi frame tính cho nốt đang vang tại t (lấy mẫu tức thời, không thiên lệch); nốt đã qua thì chốt combo.
      while (cursor < notes.length && notes[cursor].endSec <= a) cursor++;
      for (let i = cursor; i < notes.length && notes[i].startSec <= t; i++) {
        const n = notes[i];
        const active = t >= n.startSec && t < n.endSec;
        if (active && n.type !== 'freestyle') {
          const w = weightOf(n);
          expected += dt * w;
          if (isHit(n, pitch)) {
            hitTime[i] += dt;
            earned += dt * w;
          }
        }
        if (!finished[i] && n.endSec <= t) finishNote(i);
      }

      // Hype: theo nốt đang vang tại thời điểm đã bù trễ.
      const scoringNote = noteAt(song, t);
      const mode = !scoringNote ? 'rest' : isHit(scoringNote, pitch) ? 'hit' : 'miss';
      state.hype = hype.update(mode, dt);

      // Hiển thị: nốt tại songTime (khớp lời/nhắc lời).
      const shown = noteAt(song, songTime);
      state.activeNote = shown;
      state.lineIndex = song.lines.findIndex((l) => songTime <= l.endSec);
      if (state.lineIndex < 0 && song.lines.length > 0) state.lineIndex = song.lines.length - 1;
      state.centsOff = shown && pitch && shown.type !== 'freestyle' ? Math.round(pitchClassDiff(pitch.midi, shown.pitch) * 100) : null;

      state.score = totalWeight > 0 ? Math.min(MAX_SCORE, (earned / totalWeight) * MAX_SCORE) : 0;
      state.percent = expected > 0 ? Math.min(100, (earned / expected) * 100) : 0;
      return state;
    },
  };
}
