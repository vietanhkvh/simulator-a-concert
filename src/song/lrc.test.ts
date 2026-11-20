import { describe, expect, it } from 'vitest';
import { LRC_LAST_LINE_SEC, lyricIndexAt, parseLrc } from './lrc';

describe('parseLrc', () => {
  it('đọc mốc thời gian, bỏ metadata, tính endSec từ câu kế tiếp', () => {
    const r = parseLrc('[ti:Bài test]\n[ar:Ca sĩ]\n[by:ai đó]\n[00:01.50]Câu một\n[00:04.00]Câu hai\n[01:02.25]Câu ba\n');
    expect(r.title).toBe('Bài test');
    expect(r.artist).toBe('Ca sĩ');
    expect(r.lines.map((l) => l.text)).toEqual(['Câu một', 'Câu hai', 'Câu ba']);
    expect(r.lines[0].startSec).toBeCloseTo(1.5);
    expect(r.lines[0].endSec).toBeCloseTo(4);
    expect(r.lines[2].startSec).toBeCloseTo(62.25);
    expect(r.lines[2].endSec).toBeCloseTo(62.25 + LRC_LAST_LINE_SEC);
  });

  it('nhiều mốc trên một dòng, sắp xếp lại theo thời gian', () => {
    const r = parseLrc('[00:10.00][00:30.00]Điệp khúc\n[00:20.00]Lời giữa\r\n');
    expect(r.lines.map((l) => [l.startSec, l.text])).toEqual([[10, 'Điệp khúc'], [20, 'Lời giữa'], [30, 'Điệp khúc']]);
  });

  it('[offset:] dương làm lời sớm hơn; dòng rỗng chỉ kết thúc câu trước', () => {
    const r = parseLrc('[offset:500]\n[00:02.00]A\n[00:03.00]\n[00:05.000]B');
    expect(r.offsetMs).toBe(500);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].startSec).toBeCloseTo(1.5);
    expect(r.lines[0].endSec).toBeCloseTo(2.5);
    expect(r.lines[1].startSec).toBeCloseTo(4.5);
  });

  it('chấp nhận [mm:ss] không phần thập phân và bỏ thẻ <mm:ss.xx> từng chữ', () => {
    const r = parseLrc('[00:07]Xin <00:07.50>chào');
    expect(r.lines[0]).toMatchObject({ startSec: 7, text: 'Xin chào' });
  });

  it('lyricIndexAt', () => {
    const { lines } = parseLrc('[00:01.00]A\n[00:02.00]\n[00:04.00]B');
    expect(lyricIndexAt(lines, 0.5)).toBe(-1);
    expect(lyricIndexAt(lines, 1.5)).toBe(0);
    expect(lyricIndexAt(lines, 3)).toBe(-1);
    expect(lyricIndexAt(lines, 4.1)).toBe(1);
  });
});
