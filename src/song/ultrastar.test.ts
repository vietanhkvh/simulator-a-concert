import { describe, expect, it } from 'vitest';
import type { SongManifestEntry } from '../core/types';
import { parseUltraStar } from './ultrastar';
import realTxt from '../../public/songs/chasing-marks/notes.txt?raw';

const entry: SongManifestEntry = {
  id: 't', title: 'T', artist: 'A', license: 'L', licenseUrl: '', attribution: 'attr',
  sourceUrl: '', notesUrl: 'n.txt', audioUrl: 'a.mp3', visualBpm: 130, gapOffsetMs: 0,
};

const sample = `#TITLE:X\r\n#BPM:120,5\r\n#GAP:1000\r\n: 0 4 0 Hel\r\n* 4 4 2 lo \r\n- 8\r\nF 8 2 5  yo\r\nR 10 2 5 ~\r\nE\r\n: 99 1 1 ignored\r\n`;

describe('parseUltraStar', () => {
  it('parses headers, types, text, lines', () => {
    const s = parseUltraStar(sample, entry);
    expect(s.bpm).toBe(120.5);
    expect(s.gapMs).toBe(1000);
    expect(s.lines).toHaveLength(2);
    expect(s.lines[0].notes.map((n) => n.type)).toEqual(['normal', 'golden']);
    expect(s.lines[1].notes.map((n) => n.type)).toEqual(['freestyle', 'freestyle']);
    expect(s.lines[0].notes[1].text).toBe('lo ');
    expect(s.lines[1].notes[0].text).toBe(' yo');
    expect(s.lines[0].notes[1].pitch).toBe(2);
  });
  it('computes seconds and applies gapOffsetMs', () => {
    const s = parseUltraStar(sample, { ...entry, gapOffsetMs: 500 });
    expect(s.gapMs).toBe(1500);
    const n = s.lines[0].notes[1];
    expect(n.startSec).toBeCloseTo(1.5 + (4 * 60) / (120.5 * 4), 9);
    expect(n.endSec).toBeCloseTo(1.5 + (8 * 60) / (120.5 * 4), 9);
    expect(s.durationSec).toBeCloseTo(s.lines[1].endSec, 9);
  });
  it('handles empty input', () => {
    expect(parseUltraStar('', entry).lines).toEqual([]);
  });
});

describe('chasing-marks notes.txt', () => {
  const txt: string = realTxt;
  const s = parseUltraStar(txt, entry);
  const notes = s.lines.flatMap((l) => l.notes);
  it('has 241 notes, BPM 260, GAP 7664', () => {
    expect(notes).toHaveLength(241);
    expect(s.bpm).toBe(260);
    expect(s.gapMs).toBe(7664);
  });
  it('has monotonic times', () => {
    for (let i = 1; i < notes.length; i++) expect(notes[i].startSec).toBeGreaterThanOrEqual(notes[i - 1].startSec);
    for (const n of notes) expect(n.endSec).toBeGreaterThan(n.startSec);
    for (let i = 1; i < s.lines.length; i++) expect(s.lines[i].startSec).toBeGreaterThanOrEqual(s.lines[i - 1].startSec);
  });
  it('ends near 180.7 s', () => {
    expect(s.durationSec).toBeGreaterThan(180.5);
    expect(s.durationSec).toBeLessThan(180.9);
  });
  it('keeps word-boundary spaces', () => {
    expect(notes[0].text).toBe('You');
    expect(notes[1].text).toBe(" don't");
  });
});
