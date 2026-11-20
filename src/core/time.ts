import type { Note, Song } from './types';

/** Beat UltraStar → giây. */
export function beatToSec(beat: number, bpm: number, gapMs: number): number {
  return gapMs / 1000 + (beat * 60) / (bpm * 4);
}

/** Phách liên tục cho khán giả/đèn, theo tempo thật của bài. */
export function visualBeat(songTime: number, song: Pick<Song, 'gapMs' | 'visualBpm'>): number {
  return ((songTime - song.gapMs / 1000) * song.visualBpm) / 60;
}

/** 1 tại đầu phách, giảm theo hàm mũ về ~0 cuối phách. */
export function beatPulse(beat: number): number {
  const frac = beat - Math.floor(beat);
  return Math.exp(-4 * frac);
}

/** Nửa cung UltraStar (0 = C4) → Hz. */
export function pitchToHz(pitch: number): number {
  return 440 * Math.pow(2, (pitch + 60 - 69) / 12);
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** Nốt đang vang tại thời điểm t (giây); null nếu đang nghỉ. Tuyến tính, đủ nhanh cho demo. */
export function noteAt(song: Song, t: number): Note | null {
  for (const line of song.lines) {
    if (t < line.startSec) return null;
    if (t > line.endSec) continue;
    for (const n of line.notes) if (t >= n.startSec && t < n.endSec) return n;
  }
  return null;
}
