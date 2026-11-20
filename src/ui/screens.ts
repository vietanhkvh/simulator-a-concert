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
  const credit = (text: string) => (text ? `<p class="cs-credit">${esc(text)}</p>` : '');

  /** Khu nhập bài từ máy: chọn nhiều file hoặc kéo-thả. File chỉ đọc cục bộ, không upload. */
  const addImport = (card: Element) => {
    if (!opts.onImport) return;
    const box = document.createElement('div');
    box.className = 'cs-import';
    box.id = 'cs-import';
    box.innerHTML = `<p class="cs-import-title">Hoặc hát bài của bạn</p>
      <p class="cs-import-help">Chọn file nhạc + UltraStar .txt (chấm cao độ), nhạc + .lrc (lời theo câu),
        một video karaoke, hoặc chỉ file nhạc để hát tự do. Có thể kéo-thả vào đây.</p>
      <label class="cs-import-pick">Chọn file từ máy…<input id="cs-import-input" type="file" multiple
        accept="audio/*,video/*,.mp3,.ogg,.oga,.opus,.wav,.m4a,.aac,.flac,.mp4,.webm,.mkv,.mov,.txt,.lrc"></label>
      <p class="cs-import-privacy">File của bạn không rời khỏi thiết bị.</p>`;
    const input = box.querySelector('input') as HTMLInputElement;
    const send = (list: FileList | null | undefined) => {
      const files = list ? Array.from(list) : [];
      if (files.length) opts.onImport?.(files);
    };
    input.addEventListener('change', () => {
      send(input.files);
      input.value = '';
    });
    box.addEventListener('dragover', (e) => {
      e.preventDefault();
      box.classList.add('drag');
    });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', (e) => {
      e.preventDefault();
      box.classList.remove('drag');
      send(e.dataTransfer?.files);
    });
    card.appendChild(box);
  };

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
      addImport(el.firstElementChild!);
      el.firstElementChild!.insertAdjacentHTML('beforeend', credit(e.attribution));
    },
    showLoading(text) {
      show(`<div class="cs-spinner"></div><p class="cs-loading">${esc(text)}</p>`);
    },
    showResult(s, e, micMode, ro) {
      const note = micMode === 'real' ? '' : `<p class="cs-hint-sub">Chế độ không dùng micro thật nên điểm chỉ mang tính tham khảo.</p>`;
      if (ro?.pitchScore === false) {
        const hype = Math.round(s.hype * 100);
        show(
          `<div class="cs-kicker">Kết quả</div>
           <h1 class="cs-percent" id="cs-result">—</h1>
           <div class="cs-grade">${hype >= 70 ? 'Khán giả phát cuồng!' : hype >= 40 ? 'Sân khấu đã nóng lên' : 'Cất giọng to hơn nữa nào'}</div>
           <p class="cs-hint-sub">Chế độ này không có nốt nhạc nên không chấm điểm cao độ; Hype tính theo giọng hát của bạn.</p>
           <div class="cs-stats"><div><b>${Math.round(s.score)} s</b><span>Thời gian hát</span></div>
             <div><b>${hype}%</b><span>Hype</span></div></div>
           <div class="cs-artist">${esc(e.title)}${e.artist ? ' — ' + esc(e.artist) : ''}</div>${note}`,
          'Hát lại',
        );
        addImport(el.firstElementChild!);
        el.firstElementChild!.insertAdjacentHTML('beforeend', credit(e.attribution));
        return;
      }
      show(
        `<div class="cs-kicker">Kết quả</div>
         <h1 class="cs-percent" id="cs-result">${s.percent.toFixed(0)}%</h1>
         <div class="cs-grade">${grade(s.percent)}</div>
         <div class="cs-stats"><div><b>${Math.round(s.score).toLocaleString('vi-VN')}</b><span>Điểm</span></div>
           <div><b>${Math.round(s.hype * 100)}%</b><span>Hype</span></div></div>
         <div class="cs-artist">${esc(e.title)}${e.artist ? ' — ' + esc(e.artist) : ''}</div>${note}`,
        'Hát lại',
      );
      addImport(el.firstElementChild!);
      el.firstElementChild!.insertAdjacentHTML('beforeend', credit(e.attribution));
    },
    showError(text) {
      show(`<h1 class="cs-title cs-err-title">Có lỗi</h1><p class="cs-hint" id="cs-error">${esc(text)}</p>`);
      addImport(el.firstElementChild!);
    },
    hide() {
      el.style.display = 'none';
    },
    dispose: () => el.remove(),
  };
}
