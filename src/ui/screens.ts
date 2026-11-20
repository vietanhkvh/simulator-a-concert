/** Màn bắt đầu / tải / kết quả / lỗi (P5). Luôn hiện dòng ghi công. */
import type { Screens, ScreensOptions } from '../core/types';
import './style.css';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function grade(p: number): string {
  if (p >= 90) return 'Huyền thoại sân khấu!';
  if (p >= 75) return 'Khán giả phát cuồng!';
  if (p >= 50) return 'Khá lắm, còn bùng nổ hơn được nữa';
  if (p >= 20) return 'Khởi động tốt, hát lại nào';
  return 'Khán giả đang chờ bạn cất giọng';
}

export function createScreens(root: HTMLElement, opts: ScreensOptions): Screens {
  const el = document.createElement('div');
  el.className = 'cs-screen';
  root.appendChild(el);

  const show = (inner: string, button?: string) => {
    el.style.display = '';
    el.innerHTML = `<div class="cs-card">${inner}</div>`;
    if (button) {
      const b = document.createElement('button');
      b.id = 'cs-start';
      b.className = 'cs-btn';
      b.type = 'button';
      b.textContent = button;
      b.addEventListener('click', () => opts.onStart());
      el.firstElementChild!.appendChild(b);
      b.focus({ preventScroll: true });
    }
  };
  const credit = (text: string) => `<p class="cs-credit">${esc(text)}</p>`;

  return {
    showStart(e) {
      show(
        `<div class="cs-kicker">Simulator A Concert</div>
         <h1 class="cs-title">${esc(e.title)}</h1>
         <div class="cs-artist">${esc(e.artist)}</div>
         <p class="cs-hint"><span class="cs-hint-ico">&#9835;</span> Hãy đeo tai nghe để micro không thu lại tiếng nhạc.</p>
         <p class="cs-hint-sub">Cho phép dùng micro khi trình duyệt hỏi. Không có micro vẫn xem được ở chế độ xem.</p>`,
        'Bắt đầu',
      );
      el.firstElementChild!.insertAdjacentHTML('beforeend', credit(e.attribution));
    },
    showLoading(text) {
      show(`<div class="cs-spinner"></div><p class="cs-loading">${esc(text)}</p>`);
    },
    showResult(s, e, micMode) {
      const note = micMode === 'real' ? '' : `<p class="cs-hint-sub">Chế độ không dùng micro thật nên điểm chỉ mang tính tham khảo.</p>`;
      show(
        `<div class="cs-kicker">Kết quả</div>
         <h1 class="cs-percent" id="cs-result">${s.percent.toFixed(0)}%</h1>
         <div class="cs-grade">${grade(s.percent)}</div>
         <div class="cs-stats"><div><b>${Math.round(s.score).toLocaleString('vi-VN')}</b><span>Điểm</span></div>
           <div><b>${Math.round(s.hype * 100)}%</b><span>Hype</span></div></div>
         <div class="cs-artist">${esc(e.title)} — ${esc(e.artist)}</div>${note}`,
        'Hát lại',
      );
      el.firstElementChild!.insertAdjacentHTML('beforeend', credit(e.attribution));
    },
    showError(text) {
      show(`<h1 class="cs-title cs-err-title">Có lỗi</h1><p class="cs-hint">${esc(text)}</p>`);
    },
    hide() {
      el.style.display = 'none';
    },
    dispose: () => el.remove(),
  };
}
