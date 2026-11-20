/**
 * Chấm "theo giọng" cho bài không có nốt (nhập .lrc / video / chỉ audio): không có điểm cao độ.
 * Hype tăng khi micro bắt được giọng có cao độ (hoặc đủ to), giảm khi im lặng.
 * Chế độ lrc: chỉ tính trong lúc có câu lời; ngoài câu thì Hype trôi về mức nền.
 */
import type { PitchSample, ScoreState, ScoringEngine, Song } from '../core/types';
import { lyricIndexAt } from '../song/lrc';
import { createHypeMeter } from './hype';

export const VOICE_MIN_RMS = 0.01;

export function isVoiced(p: PitchSample | null): boolean {
  return !!p && p.hz > 0 && p.rms >= VOICE_MIN_RMS;
}

export function createVoiceScoring(): ScoringEngine {
  const hype = createHypeMeter();
  let song: Song | null = null;
  let voicedSec = 0;
  const state: ScoreState = {
    score: 0, percent: 0, combo: 0, hype: 0.3, activeNote: null, lineIndex: -1, lastHit: 'none', centsOff: null,
  };
  return {
    reset(s) {
      song = s;
      voicedSec = 0;
      hype.reset();
      Object.assign(state, {
        score: 0, percent: 0, combo: 0, hype: hype.value, activeNote: null, lineIndex: -1, lastHit: 'none', centsOff: null,
      });
    },
    update(songTime, pitch, latencySec, dt) {
      if (!song) return state;
      const t = songTime - latencySec;
      const lyrics = song.lyrics;
      const inLine = lyrics ? lyricIndexAt(lyrics, t) >= 0 : t >= 0;
      const voiced = isVoiced(pitch);
      let mode: 'hit' | 'miss' | 'rest';
      if (!inLine) mode = 'rest';
      else mode = voiced ? 'hit' : 'miss';
      if (mode === 'hit' && dt > 0) voicedSec += dt;
      state.hype = hype.update(mode, dt);
      state.score = voicedSec; // giây đã hát (không phải điểm cao độ)
      state.percent = 0;
      state.lineIndex = lyrics ? lyrics.findIndex((l) => songTime < l.endSec) : -1;
      state.lastHit = mode === 'hit' ? 'hit' : 'none';
      return state;
    },
  };
}
