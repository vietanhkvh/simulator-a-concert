import type { Song } from '../core/types';

function normalise(s: string): string {
  return s.toLowerCase().replace(/[~.,!?;:"'()\[\]\-–—…]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Indices of lyric lines that belong to a chorus: lines whose normalised text repeats in the song. */
export function findChorusLines(song: Song): Set<number> {
  const out = new Set<number>();
  const lines = song.lines ?? [];
  const n = lines.length;
  if (n === 0) return out;
  const texts = lines.map((l) => normalise(l.notes.map((x) => x.text).join('')));
  const counts = new Map<string, number>();
  for (const t of texts) {
    if (t.split(' ').filter(Boolean).length >= 2) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  for (let i = 0; i < n; i++) if ((counts.get(texts[i]) ?? 0) >= 2) out.add(i);
  // consecutive-pair blocks: a line next to a repeated line whose pair also occurs elsewhere
  for (let i = 0; i + 1 < n; i++) {
    for (let j = 0; j + 1 < n; j++) {
      if (Math.abs(i - j) >= 2 && texts[i] && texts[i] === texts[j] && texts[i + 1] === texts[j + 1]) {
        out.add(i);
        out.add(i + 1);
      }
    }
  }
  // a single line sandwiched between two chorus lines
  for (let i = 1; i < n - 1; i++) {
    if (!out.has(i) && out.has(i - 1) && out.has(i + 1)) out.add(i);
  }
  if (out.size === 0) {
    for (let i = Math.floor((n * 2) / 3); i < n; i++) out.add(i);
  }
  return out;
}
