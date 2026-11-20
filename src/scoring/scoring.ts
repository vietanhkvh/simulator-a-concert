import { noteAt } from '../core/time';
import type { Note, PitchSample, ScoreState, ScoringEngine, Song } from '../core/types';
import { createHypeMeter } from './hype';

export const MAX_SCORE = 10000;
export const HIT_TOLERANCE_SEMITONES = 1.0;
export const NOTE_PASS_RATIO = 0.5;
export const GOLDEN_MULT = 2;
/** Đồng hồ nhảy hơn mức này (giây) so với dt thì coi là tua. */
export const SEEK_JUMP_SEC = 1;

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
  let expTime: number[] = []; // giây đã tính vào expected (chưa nhân trọng số) cho từng nốt
  let finished: boolean[] = [];
  let cursor = 0;
  let totalWeight = 0;
  let earned = 0; // giây có trọng số, hát đúng
  let expected = 0; // giây có trọng số, đã trôi qua
  let lastT: number | null = null; // t (đã bù trễ) của lần update trước
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

  /**
   * Tua tới t (đã bù trễ). Nốt kết thúc sau t: xóa phần đã tính (hát lại được, không cộng hai lần).
   * Nốt bị nhảy qua khi tua tới: expected không tăng nên không tính là trượt; cursor bỏ qua chúng.
   */
  function seekTo(t: number) {
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].endSec <= t) {
        finished[i] = true; // nhảy qua: không chốt combo / không tính trượt
        continue;
      }
      const w = weightOf(notes[i]);
      earned -= hitTime[i] * w;
      expected -= expTime[i] * w;
      hitTime[i] = 0;
      expTime[i] = 0;
      finished[i] = false;
    }
    earned = Math.max(0, earned);
    expected = Math.max(0, expected);
    cursor = 0;
    lastT = t;
  }

  return {
    reset(s) {
      song = s;
      notes = s.lines.flatMap((l) => l.notes).filter((n) => n.endSec > n.startSec).sort((a, b) => a.startSec - b.startSec);
      hitTime = notes.map(() => 0);
      expTime = notes.map(() => 0);
      lastT = null;
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
    seek(songTime, latencySec = 0) {
      seekTo(songTime - latencySec);
    },
    update(songTime, pitch, latencySec, dt) {
      if (!song) return state;
      const t = songTime - latencySec;
      if (lastT !== null && Math.abs(t - lastT - Math.max(0, dt)) > SEEK_JUMP_SEC) seekTo(t);
      lastT = t;
      const a = t - Math.max(0, dt);

      // Mỗi frame tính cho nốt đang vang tại t (lấy mẫu tức thời, không thiên lệch); nốt đã qua thì chốt combo.
      while (cursor < notes.length && notes[cursor].endSec <= a) cursor++;
      for (let i = cursor; i < notes.length && notes[i].startSec <= t; i++) {
        const n = notes[i];
        const active = t >= n.startSec && t < n.endSec;
        if (active && n.type !== 'freestyle') {
          const w = weightOf(n);
          expected += dt * w;
          expTime[i] += dt;
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
