// STUB P0 — gói P5 thay: câu hiện tại tô theo âm tiết, câu kế tiếp, dải cao độ, đếm ngược khi nghỉ > 3 s.
import type { Song, Teleprompter } from '../core/types';

export function createTeleprompter(root: HTMLElement, song: Song): Teleprompter {
  const el = document.createElement('div');
  el.className = 'cs-stub';
  el.style.bottom = '12px';
  root.appendChild(el);
  return {
    update(f) {
      const line = song.lines[f.lineIndex];
      el.textContent = line ? line.notes.map((n) => n.text).join('') : '';
    },
    setVisible(v) {
      el.style.display = v ? '' : 'none';
    },
    dispose: () => el.remove(),
  };
}
