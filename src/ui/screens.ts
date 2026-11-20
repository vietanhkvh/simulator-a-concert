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

/** Kiểu màn chào sân chọn ở sảnh. */
export type LobbyEntrance = 'jump' | 'lift' | 'cable';
const ENTRANCE_KEY = 'cs-entrance-style';
const SKIP_KEY = 'cs-entrance-skip';
const ENTRANCES: { kind: LobbyEntrance; name: string; desc: string; svg: string }[] = [
  {
    kind: 'jump', name: 'Nhảy khỏi trực thăng', desc: 'Lao ra từ trực thăng rồi đáp đất kiểu siêu anh hùng.',
    svg: '<path d="M8 14h26l4-4h10M14 14v4h16v-4M20 8h24" /><circle cx="40" cy="30" r="3"/><path d="M40 33v8m-5-4h10m-8 10 3-6 3 6"/>',
  },
  {
    kind: 'lift', name: 'Bục nâng từ dưới sân khấu', desc: 'Đứng trên bục, từ từ trồi lên giữa ánh đèn.',
    svg: '<path d="M4 34h56M18 34v16h28V34"/><circle cx="32" cy="12" r="3"/><path d="M32 15v9m-5-5h10m-8 11 3-6 3 6M32 40v-6m-4 2 4-4 4 4"/>',
  },
  {
    kind: 'cable', name: 'Thả cáp từ trực thăng', desc: 'Treo dây cáp, được hạ chậm xuống từ trên trời.',
    svg: '<path d="M12 8h26l4-4h8M18 8v4h14V8M25 12v20"/><circle cx="25" cy="35" r="3"/><path d="M25 38v8m-5-4h10m-8 10 3-6 3 6M4 58h56"/>',
  },
];
function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } }
/** Lựa chọn ở sảnh: kiểu chào sân (null = bỏ qua màn chào sân). */
export function getLobbyEntrance(): LobbyEntrance | null {
  if (lsGet(SKIP_KEY) === '1') return null;
  const v = lsGet(ENTRANCE_KEY);
  return v === 'lift' || v === 'cable' ? v : 'jump';
}

export function createScreens(root: HTMLElement, opts: ScreensOptions): Screens & { isLobby(): boolean } {
  const el = document.createElement('div');
  el.className = 'cs-screen';
  root.appendChild(el);
  let lobby = false;

  /** Ba thẻ chọn màn chào sân (radio; phím 1/2/3, mũi tên) + ô "Bỏ qua". */
  const addEntrancePicker = (card: Element) => {
    const box = document.createElement('div');
    box.className = 'cs-entr';
    const cur = lsGet(ENTRANCE_KEY);
    const sel = ENTRANCES.some((x) => x.kind === cur) ? cur : 'jump';
    box.innerHTML = `<p class="cs-import-title">Chọn màn chào sân</p>
      <div class="cs-entr-cards" role="radiogroup" aria-label="Màn chào sân">${ENTRANCES.map((x, i) => `
        <button type="button" role="radio" class="cs-entr-card" data-kind="${x.kind}" aria-checked="${x.kind === sel}">
          <span class="cs-entr-num">${i + 1}</span>
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${x.svg}</svg>
          <b>${x.name}</b><span>${x.desc}</span></button>`).join('')}</div>
      <label class="cs-entr-skip"><input type="checkbox" ${lsGet(SKIP_KEY) === '1' ? 'checked' : ''}> Bỏ qua màn chào sân</label>`;
    const cards = Array.from(box.querySelectorAll<HTMLButtonElement>('.cs-entr-card'));
    const pick = (i: number) => {
      cards.forEach((c, j) => c.setAttribute('aria-checked', String(i === j)));
      lsSet(ENTRANCE_KEY, cards[i].dataset.kind!);
    };
    cards.forEach((c, i) => c.addEventListener('click', () => pick(i)));
    const skip = box.querySelector('input') as HTMLInputElement;
    skip.addEventListener('change', () => lsSet(SKIP_KEY, skip.checked ? '1' : '0'));
    const onKey = (e: KeyboardEvent) => {
      if (!box.isConnected) { window.removeEventListener('keydown', onKey); return; }
      if (el.style.display === 'none' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const i = cards.findIndex((c) => c.getAttribute('aria-checked') === 'true');
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') pick(Number(e.code.slice(5)) - 1);
      else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { e.preventDefault(); pick((i + 1) % 3); }
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { e.preventDefault(); pick((i + 2) % 3); }
    };
    window.addEventListener('keydown', onKey);
    card.appendChild(box);
  };

  const show = (inner: string, button?: string) => {
    el.style.display = '';
    el.classList.toggle('cs-lobby', lobby);
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

  const addLobbyBtn = () => {
    if (!opts.onLobby) return;
    const b = document.createElement('button');
    b.id = 'cs-lobby-btn';
    b.type = 'button';
    b.className = 'cs-btn cs-btn-sub';
    b.textContent = 'Về sảnh';
    b.addEventListener('click', () => opts.onLobby?.());
    el.querySelector('#cs-start')?.after(b);
  };

  return {
    isLobby: () => lobby && el.style.display !== 'none',
    showStart(e) {
      lobby = true;
      show(
        `<div class="cs-kicker">Simulator A Concert</div>
         <h1 class="cs-title">${esc(e.title)}</h1>
         <div class="cs-artist">${esc(e.artist)}</div>
         <p class="cs-hint"><span class="cs-hint-ico">&#9835;</span> Hãy đeo tai nghe để micro không thu lại tiếng nhạc.</p>
         <p class="cs-hint-sub">Cho phép dùng micro khi trình duyệt hỏi. Không có micro vẫn xem được ở chế độ xem.</p>`,
        'Bắt đầu',
      );
      const startBtn = el.querySelector('#cs-start')!;
      const picker = document.createElement('div');
      el.firstElementChild!.insertBefore(picker, startBtn);
      addEntrancePicker(picker);
      addImport(el.firstElementChild!);
      el.firstElementChild!.insertAdjacentHTML('beforeend', credit(e.attribution));
    },
    showLoading(text) {
      show(`<div class="cs-spinner"></div><p class="cs-loading">${esc(text)}</p>`);
    },
    showResult(s, e, micMode, ro) {
      lobby = false;
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
        addLobbyBtn();
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
      addLobbyBtn();
      addImport(el.firstElementChild!);
      el.firstElementChild!.insertAdjacentHTML('beforeend', credit(e.attribution));
    },
    showError(text) {
      show(`<h1 class="cs-title cs-err-title">Có lỗi</h1><p class="cs-hint" id="cs-error">${esc(text)}</p>`);
      addImport(el.firstElementChild!);
    },
    hide() {
      el.style.display = 'none';
      lobby = false;
    },
    dispose: () => el.remove(),
  };
}
