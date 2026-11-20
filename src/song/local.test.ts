import { describe, expect, it } from 'vitest';
import { classifyFile, detectImport } from './local';

const f = (name: string, type = '') => ({ name, type });

describe('classifyFile', () => {
  it('theo đuôi và MIME', () => {
    expect(classifyFile(f('a.mp3'))).toBe('audio');
    expect(classifyFile(f('a.M4A', 'audio/x-m4a'))).toBe('audio');
    expect(classifyFile(f('a.webm', 'audio/webm'))).toBe('audio');
    expect(classifyFile(f('a.webm', 'video/webm'))).toBe('video');
    expect(classifyFile(f('a.mp4'))).toBe('video');
    expect(classifyFile(f('notes.txt', 'text/plain'))).toBe('ultrastar');
    expect(classifyFile(f('song.lrc'))).toBe('lrc');
    expect(classifyFile(f('cover.png', 'image/png'))).toBe('unknown');
  });
});

describe('detectImport', () => {
  it('audio + txt → ultrastar (ưu tiên hơn lrc)', () => {
    const a = f('x.mp3', 'audio/mpeg');
    const t = f('x.txt');
    const l = f('x.lrc');
    const p = detectImport([t, l, a]);
    expect(p.mode).toBe('ultrastar');
    if (p.mode === 'ultrastar') {
      expect(p.audio).toBe(a);
      expect(p.notes).toBe(t);
      expect(p.ignored).toEqual([l]);
    }
  });
  it('audio + lrc → lrc', () => {
    expect(detectImport([f('x.lrc'), f('x.ogg')]).mode).toBe('lrc');
  });
  it('video một mình → video', () => {
    expect(detectImport([f('k.mp4', 'video/mp4')]).mode).toBe('video');
  });
  it('audio một mình → audio (hát tự do)', () => {
    expect(detectImport([f('x.wav')]).mode).toBe('audio');
  });
  it('audio + video → dùng audio', () => {
    expect(detectImport([f('k.mp4'), f('x.mp3')]).mode).toBe('audio');
  });
  it('chỉ có lời hoặc file lạ → lỗi', () => {
    expect(detectImport([f('x.lrc')]).mode).toBe('error');
    expect(detectImport([f('x.png')]).mode).toBe('error');
    expect(detectImport([]).mode).toBe('error');
  });
});
