import { describe, expect, it } from 'vitest';
import type { Line, Song, SongManifestEntry } from '../core/types';
import { parseUltraStar } from './ultrastar';
import { findChorusLines } from './chorus';
import realTxt from '../../public/songs/chasing-marks/notes.txt?raw';

function line(text: string, t: number): Line {
  const note = { startBeat: 0, lengthBeats: 1, pitch: 0, text, type: 'normal' as const, startSec: t, endSec: t + 1 };
  return { notes: [note], startSec: t, endSec: t + 1 };
}
function song(texts: string[]): Song {
  return { title: '', artist: '', license: '', attribution: '', bpm: 120, gapMs: 0, visualBpm: 120, audioUrl: '', durationSec: 100, lines: texts.map((t, i) => line(t, i)) };
}
const entry: SongManifestEntry = {
  id: 't', title: 'T', artist: 'A', license: 'L', licenseUrl: '', attribution: 'a',
  sourceUrl: '', notesUrl: 'n.txt', audioUrl: 'a.mp3', visualBpm: 130, gapOffsetMs: 0,
};

describe('findChorusLines', () => {
  it('finds a repeated 2-line block (gap line between filled)', () => {
    const s = song(['one two three', 'we sing~ along', 'Hold, on tight', 'four five six', 'We sing along!', 'hold on tight', 'seven eight nine']);
    expect([...findChorusLines(s)].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('falls back to last third when nothing repeats', () => {
    const s = song(['a b', 'c d', 'e f', 'g h', 'i j', 'k l']);
    expect([...findChorusLines(s)]).toEqual([4, 5]);
  });
  it('empty song gives empty set', () => {
    expect(findChorusLines(song([])).size).toBe(0);
  });
  it('real song', () => {
    const s = parseUltraStar(realTxt, entry);
    const c = findChorusLines(s);
    expect(c.size).toBeGreaterThan(0);
    expect(c.size).toBeLessThan(s.lines.length);
  });
});
