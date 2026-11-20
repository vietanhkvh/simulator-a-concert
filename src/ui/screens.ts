// STUB P0 — gói P5 thay: màn bắt đầu (nhắc đeo tai nghe), tải, kết quả, lỗi; luôn hiện dòng ghi công.
import type { Screens, ScreensOptions } from '../core/types';
import './style.css';

export function createScreens(root: HTMLElement, opts: ScreensOptions): Screens {
  const el = document.createElement('div');
  el.className = 'cs-screen';
  root.appendChild(el);
  const show = (html: string, button?: string) => {
    el.style.display = '';
    el.innerHTML = html;
    if (button) {
      const b = document.createElement('button');
      b.id = 'cs-start';
      b.textContent = button;
      b.addEventListener('click', opts.onStart);
      el.appendChild(b);
    }
  };
  return {
    showStart: (e) => show(`<h1>${e.title}</h1><p>${e.attribution}</p>`, 'Bắt đầu'),
    showLoading: (text) => show(`<p>${text}</p>`),
    showResult: (s, e) => show(`<h1 id="cs-result">${s.percent.toFixed(0)}%</h1><p>${e.attribution}</p>`, 'Hát lại'),
    showError: (text) => show(`<p>${text}</p>`),
    hide() {
      el.style.display = 'none';
    },
    dispose: () => el.remove(),
  };
}
