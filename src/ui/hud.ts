// STUB P0 — gói P5 thay: điểm, thanh Hype, nhãn thông báo.
import type { Hud } from '../core/types';

export function createHud(root: HTMLElement): Hud {
  const el = document.createElement('div');
  el.className = 'cs-stub';
  el.style.top = '12px';
  root.appendChild(el);
  let notice: string | null = null;
  return {
    update(f) {
      el.textContent =
        `t=${f.songTime.toFixed(2)} hype=${f.hype.toFixed(2)} score=${f.score.percent.toFixed(0)}%` +
        (notice ? `\n${notice}` : '');
    },
    setNotice(text) {
      notice = text;
    },
    setVisible(v) {
      el.style.display = v ? '' : 'none';
    },
    dispose: () => el.remove(),
  };
}
