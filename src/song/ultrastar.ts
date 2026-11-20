import type { Line, Note, NoteType, Song, SongManifestEntry } from '../core/types';

const NOTE_TYPES: Record<string, NoteType> = {
  ':': 'normal',
  '*': 'golden',
  F: 'freestyle',
  R: 'freestyle', // rap: không chấm cao độ, coi như tự do
};

function parseNum(s: string | undefined, fallback: number): number {
  if (s === undefined) return fallback;
  const n = Number(s.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

/** Hàm thuần: UltraStar .txt -> Song. sec = gapMs/1000 + beat * 60 / (bpm * 4). */
export function parseUltraStar(txt: string, entry: SongManifestEntry): Song {
  const headers: Record<string, string> = {};
  const lines: Line[] = [];
  let current: Note[] = [];

  let bpm = 120;
  let gapMs = 0;
  let timingReady = false;
  const prepareTiming = () => {
    if (timingReady) return;
    bpm = parseNum(headers.BPM, 120);
    if (!(bpm > 0)) bpm = 120;
    gapMs = parseNum(headers.GAP, 0) + (entry.gapOffsetMs ?? 0);
    timingReady = true;
  };
  const sec = (beat: number) => gapMs / 1000 + (beat * 60) / (bpm * 4);

  const flush = () => {
    if (current.length === 0) return;
    lines.push({
      notes: current,
      startSec: current[0].startSec,
      endSec: Math.max(...current.map((n) => n.endSec)),
    });
    current = [];
  };

  for (const raw of txt.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.replace(/\r$/, '');
    if (line === '') continue;
    const c = line[0];
    if (c === '#') {
      const i = line.indexOf(':');
      if (i > 0) headers[line.slice(1, i).trim().toUpperCase()] = line.slice(i + 1).trim();
      continue;
    }
    if (c === 'E') break;
    if (c === '-') {
      flush();
      continue;
    }
    if (c in NOTE_TYPES) {
      prepareTiming();
      // "<type> <start> <len> <pitch> <text>": text giữ nguyên dấu cách sau trường pitch.
      const m = /^(\S)\s+(-?\d+)\s+(\d+)\s+(-?\d+) ?(.*)$/.exec(line);
      if (!m) continue;
      const startBeat = Number(m[2]);
      const lengthBeats = Number(m[3]);
      current.push({
        startBeat,
        lengthBeats,
        pitch: Number(m[4]),
        text: m[5],
        type: NOTE_TYPES[c],
        startSec: sec(startBeat),
        endSec: sec(startBeat + lengthBeats),
      });
    }
  }
  flush();
  prepareTiming();

  const durationSec = lines.length ? lines[lines.length - 1].endSec : 0;
  return {
    title: entry.title || headers.TITLE || '',
    artist: entry.artist || headers.ARTIST || '',
    license: entry.license,
    attribution: entry.attribution,
    bpm,
    gapMs,
    visualBpm: entry.visualBpm,
    audioUrl: entry.audioUrl,
    lines,
    durationSec,
  };
}
