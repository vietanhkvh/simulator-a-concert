// STUB P0 — gói P4 thay bằng ScoringEngine + HypeMeter thật (hype.ts cùng thư mục).
import { noteAt } from '../core/time';
import type { ScoreState, ScoringEngine, Song } from '../core/types';

export function createScoring(): ScoringEngine {
  let song: Song | null = null;
  const state: ScoreState = {
    score: 0, percent: 0, combo: 0, hype: 0.3, activeNote: null, lineIndex: -1, lastHit: 'none', centsOff: null,
  };
  return {
    reset(s) {
      song = s;
      Object.assign(state, { score: 0, percent: 0, combo: 0, hype: 0.3, activeNote: null, lineIndex: -1 });
    },
    update(songTime, pitch, _latencySec, dt) {
      if (!song) return state;
      state.activeNote = noteAt(song, songTime);
      state.lineIndex = song.lines.findIndex((l) => songTime <= l.endSec);
      if (state.activeNote) state.hype = Math.min(1, Math.max(0, state.hype + (pitch ? 0.25 : -0.15) * dt));
      return state;
    },
  };
}
