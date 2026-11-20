/**
 * Bảng hướng dẫn điều khiển kiểu game: cột trái tên chức năng, cột phải phím (keycap). Dữ liệu một chỗ
 * (CONTROLS) dùng cho cả bảng trong lúc diễn, bảng trong menu tạm dừng và bảng README.
 * Phím H hoặc nút "?" để ẩn/hiện; lựa chọn được ghi nhớ. Lần đầu: hiện ~15 s rồi tự thu về nút "?".
 */

/** Một phím: chuỗi trong [] là keycap, phần còn lại là chữ thường. Ví dụ 'Giữ [C]', '[1] / [Space]'. */
export interface ControlRow { label: string; keys: string }
export interface ControlGroup { title: string; rows: ControlRow[] }

export const CONTROLS: ControlGroup[] = [
  {
    title: 'Di chuyển',
    rows: [
      { label: 'Di chuyển', keys: '[W][A][S][D] / mũi tên' },
      { label: 'Xoay góc nhìn', keys: 'Kéo chuột / [Q][E]' },
      { label: 'Chuột tự do', keys: '[M] / nhấp đúp' },
      { label: 'Đổi góc máy', keys: '[V]' },
    ],
  },
  {
    title: 'Khán giả',
    rows: [
      { label: 'Đưa micro cho khán giả', keys: 'Giữ [C]' },
      { label: 'Hò reo', keys: '[1] / [Space]' },
      { label: 'Sóng lightstick', keys: '[2]' },
      { label: 'Thả tim', keys: '[3]' },
      { label: 'Đèn flash', keys: '[4]' },
      { label: 'Pháo hoa', keys: '[5]' },
    ],
  },
  {
    title: 'Bài hát',
    rows: [
      { label: 'Tua lùi / tới 10 s', keys: '[[] / []]' },
      { label: 'Thu nhỏ khung lời', keys: '[T]' },
      { label: 'Tạm dừng / xưởng chỉnh', keys: '[Esc]' },
      { label: 'Bỏ qua màn chào sân', keys: '[Enter] / [Esc]' },
      { label: 'Chọn màn chào sân (ở sảnh)', keys: '[1][2][3] / mũi tên' },
      { label: 'Ẩn/hiện hướng dẫn', keys: '[H]' },
    ],
  },
];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** '[W][A] / mũi tên' → HTML có <kbd>. Keycap là chuỗi ngắn nhất trong ngoặc vuông (cho phép '[[]' và '[]]'). */
export function keysHtml(keys: string): string {
  return esc(keys).replace(/\[(.[^\]]*?)\]/g, (_m, k: string) => `<kbd class="cs-kc">${k}</kbd>`);
}

export function renderControls(): string {
  return CONTROLS.map((g) => `<div class="cs-cg-group"><div class="cs-cg-title">${esc(g.title)}</div>${
    g.rows.map((r) => `<div class="cs-cg-row"><span class="cs-cg-label">${esc(r.label)}</span><span class="cs-cg-dots"></span><span class="cs-cg-keys">${keysHtml(r.keys)}</span></div>`).join('')
  }</div>`).join('');
}

const KEY = 'cs-controls-guide'; // '1' hiện, '0' ẩn; trống = lần đầu
const FIRST_SHOW_MS = 15000;

export interface ControlsGuide {
  /** Gọi mỗi frame: playing = đang diễn (không tạm dừng). */
  setActive(playing: boolean): void;
  toggle(): void;
  readonly shown: boolean;
}

export function createControlsGuide(root: HTMLElement): ControlsGuide {
  const panel = document.createElement('div');
  panel.className = 'cs-cg';
  panel.dataset.nodrag = '';
  panel.innerHTML = `<div class="cs-cg-head">Điều khiển <button type="button" class="cs-cg-close" title="Ẩn (H)">×</button></div>${renderControls()}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cs-cg-toggle';
  btn.textContent = '?';
  btn.title = 'Hướng dẫn điều khiển (H)';
  root.append(panel, btn);
  let pref: string | null = null;
  try { pref = localStorage.getItem(KEY); } catch { /* */ }
  let shown = pref !== '0';
  let autoHideAt = pref === null ? -1 : 0; // -1 = chưa bắt đầu đếm lần đầu
  let active = false;
  const apply = () => {
    panel.hidden = !active || !shown;
    btn.hidden = !active || shown;
  };
  const set = (on: boolean, remember: boolean) => {
    shown = on;
    autoHideAt = 0;
    if (remember) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* */ } }
    apply();
  };
  btn.addEventListener('click', () => { set(true, true); btn.blur(); });
  (panel.querySelector('.cs-cg-close') as HTMLButtonElement).addEventListener('click', () => set(false, true));
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (e.code !== 'KeyH' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (active) set(!shown, true);
  });
  apply();
  return {
    setActive(playing) {
      if (playing && autoHideAt === -1) autoHideAt = performance.now() + FIRST_SHOW_MS;
      if (autoHideAt > 0 && performance.now() > autoHideAt) set(false, true);
      if (playing !== active) { active = playing; apply(); }
    },
    toggle() { set(!shown, true); },
    get shown() { return shown; },
  };
}
