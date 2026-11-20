import type { LyricLine } from '../core/types';

/** Câu cuối không có mốc kế tiếp: giữ chừng này giây. */
export const LRC_LAST_LINE_SEC = 5;

export interface LrcResult {
  lines: LyricLine[];
  title?: string;
  artist?: string;
  offsetMs: number;
}

const META_RE = /^\[([a-zA-Z#]+):(.*)\]\s*$/;

/**
 * Hàm thuần: .lrc → câu lời theo thời gian (giây, đã cộng [offset:], sắp xếp).
 * Hỗ trợ nhiều mốc trên một dòng `[00:10.00][01:20.00]lời`; bỏ thẻ metadata ([ar:], [ti:], [by:]...).
 * Theo chuẩn LRC, offset dương = lời hiện SỚM hơn.
 */
export function parseLrc(text: string): LrcResult {
  const raw: { t: number; text: string }[] = [];
  const meta: Record<string, string> = {};
  for (const line0 of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = line0.trim();
    if (!line) continue;
    const times: number[] = [];
    let rest = line;
    // Các mốc thời gian phải nằm liền nhau ở đầu dòng.
    for (;;) {
      const m = /^\[(\d{1,3}):(\d{1,2}(?:[.,:]\d{1,3})?)\]/.exec(rest);
      if (!m) break;
      const sec = Number(m[2].replace(/[,:]/, '.'));
      times.push(Number(m[1]) * 60 + sec);
      rest = rest.slice(m[0].length);
    }
    if (times.length === 0) {
      const mm = META_RE.exec(line);
      if (mm) meta[mm[1].toLowerCase()] = mm[2].trim();
      continue;
    }
    // Bỏ thẻ thời gian từng chữ kiểu Enhanced LRC <mm:ss.xx>.
    const lyric = rest.replace(/<\d{1,3}:\d{1,2}(?:[.,]\d{1,3})?>/g, '').trim();
    for (const t of times) raw.push({ t, text: lyric });
  }
  const offsetMs = Number(meta.offset ?? 0) || 0;
  raw.sort((a, b) => a.t - b.t);
  const shift = -offsetMs / 1000;
  const lines: LyricLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const startSec = Math.max(0, raw[i].t + shift);
    const endSec = i + 1 < raw.length ? Math.max(startSec, raw[i + 1].t + shift) : startSec + LRC_LAST_LINE_SEC;
    // Dòng rỗng chỉ đánh dấu chỗ kết thúc câu trước; không giữ làm câu.
    if (raw[i].text) lines.push({ startSec, endSec, text: raw[i].text });
  }
  return { lines, title: meta.ti || undefined, artist: meta.ar || undefined, offsetMs };
}

/** Câu đang hát tại t (-1 nếu không có). */
export function lyricIndexAt(lines: LyricLine[], t: number): number {
  for (let i = 0; i < lines.length; i++) {
    if (t < lines[i].startSec) return -1;
    if (t < lines[i].endSec) return i;
  }
  return -1;
}
