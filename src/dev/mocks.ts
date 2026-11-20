/**
 * Dữ liệu giả để mỗi gói tự chạy độc lập trước khi ghép.
 * Ví dụ trong file của bạn (tạm thời, khi tự thử): updatable.update(mockFrame(t, dt)).
 */
import { beatPulse, beatToSec, visualBeat } from '../core/time';
import type { FrameState, Line, Note, ScoreState, Song, SongManifestEntry } from '../core/types';

export const mockEntry: SongManifestEntry = {
  id: 'mock',
  title: 'Mock Song',
  artist: 'Nobody',
  license: 'CC0',
  licenseUrl: '',
  attribution: 'Mock Song — Nobody, CC0',
  sourceUrl: '',
  notesUrl: '',
  audioUrl: '',
  visualBpm: 120,
  gapOffsetMs: 0,
};

/** Bài giả: 8 câu, mỗi câu 4 nốt, BPM UltraStar 240, GAP 2 s. */
export function mockSong(): Song {
  const bpm = 240;
  const gapMs = 2000;
  const words = ['La', ' la', ' la', ' laa'];
  const lines: Line[] = [];
  for (let l = 0; l < 8; l++) {
    const notes: Note[] = words.map((text, i) => {
      const startBeat = l * 32 + i * 6;
      const lengthBeats = i === 3 ? 8 : 5;
      return {
        startBeat,
        lengthBeats,
        pitch: [0, 2, 4, 7][(i + l) % 4],
        text,
        type: l === 3 && i === 3 ? 'golden' : 'normal',
        startSec: beatToSec(startBeat, bpm, gapMs),
        endSec: beatToSec(startBeat + lengthBeats, bpm, gapMs),
      };
    });
    lines.push({ notes, startSec: notes[0].startSec, endSec: notes[3].endSec });
  }
  return {
    title: mockEntry.title,
    artist: mockEntry.artist,
    license: mockEntry.license,
    attribution: mockEntry.attribution,
    bpm,
    gapMs,
    visualBpm: mockEntry.visualBpm,
    audioUrl: '',
    lines,
    durationSec: lines[lines.length - 1].endSec,
  };
}

export function mockScore(hype: number): ScoreState {
  return {
    score: Math.round(hype * 5000),
    percent: hype * 100,
    combo: Math.round(hype * 10),
    hype,
    activeNote: null,
    lineIndex: 0,
    lastHit: 'none',
    centsOff: null,
  };
}

/** FrameState giả: hype dao động 0..1 chu kỳ 12 s, không có pitch. */
export function mockFrame(songTime: number, dt = 1 / 60, song: Song = mockSong()): FrameState {
  const hype = 0.5 + 0.5 * Math.sin((songTime / 12) * Math.PI * 2);
  const beat = visualBeat(songTime, song);
  const score = mockScore(hype);
  return {
    dt,
    songTime,
    beat,
    beatPulse: beatPulse(beat),
    level: 0.4 + 0.3 * beatPulse(beat),
    hype,
    waveMode: hype > 0.7 ? 1 : 0,
    pitch: null,
    activeNote: null,
    lineIndex: 0,
    score,
  };
}
