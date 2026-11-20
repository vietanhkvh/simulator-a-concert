/**
 * Cửa sổ nổi trên cảnh 3D cho khung lời / video: kéo thanh để di chuyển, kéo 8 mép/góc để đổi cỡ (tỉ lệ tự do).
 * Đổi cỡ là CẮT chứ không co giãn: nội dung giữ kích thước tự nhiên, neo góc trên-trái; kéo/cuộn trong khung để xem
 * phần khác (nhấp đúp để về góc), nút −/+ đổi tỉ lệ nội dung độc lập với cỡ cửa sổ.
 * Vị trí, cỡ, độ lệch và tỉ lệ nhớ trong localStorage theo loại khung.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface FloatLayout extends Rect {
  /** Độ lệch nội dung (px màn hình, đã nhân tỉ lệ). */
  px: number;
  py: number;
  /** Tỉ lệ nội dung. */
  z: number;
}

export const MIN_W = 160;
export const MIN_H = 60;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Kẹp cửa sổ vào màn hình (vw × vh), giữ cỡ tối thiểu. */
export function clampRect(r: Rect, vw: number, vh: number): Rect {
  const w = clamp(r.w, Math.min(MIN_W, vw), Math.max(MIN_W, vw));
  const h = clamp(r.h, Math.min(MIN_H, vh), Math.max(MIN_H, vh));
  return { w, h, x: clamp(r.x, 0, Math.max(0, vw - w)), y: clamp(r.y, 0, Math.max(0, vh - h)) };
}

/** Đổi cỡ từ hình chữ nhật gốc theo hướng `dir` (chứa n/s/e/w) và độ dời (dx, dy); mép đối diện đứng yên. */
export function resizeRect(start: Rect, dir: string, dx: number, dy: number, vw: number, vh: number): Rect {
  let { x, y, w, h } = start;
  const right = x + w;
  const bottom = y + h;
  if (dir.includes('e')) w = clamp(start.w + dx, MIN_W, vw - x);
  if (dir.includes('s')) h = clamp(start.h + dy, MIN_H, vh - y);
  if (dir.includes('w')) {
    x = clamp(start.x + dx, 0, right - MIN_W);
    w = right - x;
  }
  if (dir.includes('n')) {
    y = clamp(start.y + dy, 0, bottom - MIN_H);
    h = bottom - y;
  }
  return { x, y, w, h };
}

/** Kẹp độ lệch để không cuộn quá mép nội dung. */
export function clampPan(px: number, py: number, contentW: number, contentH: number, viewW: number, viewH: number) {
  return { px: clamp(px, 0, Math.max(0, contentW - viewW)), py: clamp(py, 0, Math.max(0, contentH - viewH)) };
}

export interface FloatWindowOptions {
  /** Khóa localStorage (mỗi loại khung một khóa). */
  storageKey: string;
  /** Lớp CSS thêm cho cửa sổ. */
  className: string;
  /** Bề rộng tự nhiên của nội dung (px, chưa nhân tỉ lệ). */
  baseWidth(): number;
  /** Bố cục mặc định khi biết chiều cao nội dung (px, chưa nhân tỉ lệ) và chiều cao thanh. */
  defaultLayout(contentH: number, barH: number): FloatLayout;
  /** Bố cục khi thu nhỏ (phím T). */
  minimizedLayout(contentH: number, barH: number): FloatLayout;
}

export interface FloatWindow {
  readonly el: HTMLElement;
  readonly content: HTMLElement;
  /** Gắn thanh điều khiển: thành tay nắm kéo, thêm nút −/+ và "Đặt lại". */
  attachBar(bar: HTMLElement): void;
  setMinimized(on: boolean): void;
  reset(): void;
  getLayout(): FloatLayout;
  dispose(): void;
}

function load(key: string): FloatLayout | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<FloatLayout>;
    const ok = (['x', 'y', 'w', 'h', 'px', 'py', 'z'] as const).every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
    return ok ? (o as FloatLayout) : null;
  } catch {
    return null;
  }
}

export function createFloatWindow(root: HTMLElement, opts: FloatWindowOptions): FloatWindow {
  const win = document.createElement('div');
  win.className = `cs-fw ${opts.className}`;
  win.dataset.nodrag = ''; // stageControls bỏ qua phần tử có [data-nodrag]
  const view = document.createElement('div');
  view.className = 'cs-fw-view';
  const content = document.createElement('div');
  content.className = 'cs-fw-content';
  view.appendChild(content);
  win.appendChild(view);
  const handles: HTMLElement[] = [];
  for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    const h = document.createElement('div');
    h.className = `cs-fw-h cs-fw-h-${dir}`;
    h.dataset.dir = dir;
    win.appendChild(h);
    handles.push(h);
  }
  root.appendChild(win);

  let bar: HTMLElement | null = null;
  let zoomLabel: HTMLElement | null = null;
  let barH = 0;
  let contentH = 0;
  let minimized = false;
  const saved = load(opts.storageKey);
  /** Chưa chỉnh tay: bố cục mặc định bám theo chiều cao nội dung. */
  let custom = !!saved;
  let lay: FloatLayout = saved ?? { x: 0, y: 0, w: 0, h: 0, px: 0, py: 0, z: 1 };
  let shown: FloatLayout = lay;
  let lastZoomText = '';

  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;
  const save = () => {
    try {
      localStorage.setItem(opts.storageKey, JSON.stringify(lay));
    } catch {
      /* không có localStorage */
    }
  };

  function measure(): void {
    barH = bar ? bar.offsetHeight : 0;
    contentH = content.offsetHeight;
  }

  /** Ghi style (không đọc layout). */
  function apply(): void {
    if (minimized) {
      shown = opts.minimizedLayout(contentH, barH);
    } else {
      if (!custom) {
        const d = opts.defaultLayout(contentH, barH);
        lay = { ...d, px: lay.px, py: lay.py };
      }
      const r = clampRect(lay, vw(), vh());
      const p = clampPan(lay.px, lay.py, opts.baseWidth() * lay.z, contentH * lay.z, r.w, r.h - barH);
      lay = { ...lay, ...r, ...p };
      shown = lay;
    }
    const s = win.style;
    s.left = `${Math.round(shown.x)}px`;
    s.top = `${Math.round(shown.y)}px`;
    s.width = `${Math.round(shown.w)}px`;
    s.height = `${Math.round(shown.h)}px`;
    content.style.width = `${Math.round(minimized ? shown.w / shown.z : opts.baseWidth())}px`;
    content.style.transform = `translate(${-Math.round(shown.px)}px, ${-Math.round(shown.py)}px) scale(${shown.z})`;
    const zt = `${Math.round(shown.z * 100)}%`;
    if (zoomLabel && zt !== lastZoomText) zoomLabel.textContent = lastZoomText = zt;
  }

  // Chiều cao nội dung đổi (đổi câu, video tải xong siêu dữ liệu) → chỉ khi đó mới đo lại.
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        measure();
        apply();
      })
    : null;
  ro?.observe(content);

  const onWinResize = () => {
    measure();
    apply();
    if (custom && !minimized) save();
  };
  window.addEventListener('resize', onWinResize);

  // Nuốt sự kiện của cửa sổ để camera không xoay / không vào pointer lock.
  const swallow = (e: Event) => e.stopPropagation();
  win.addEventListener('pointerdown', swallow);
  win.addEventListener('dblclick', swallow);
  win.addEventListener('click', swallow);
  win.addEventListener('wheel', swallow);
  win.addEventListener('contextmenu', swallow);

  /** Kéo bằng pointer capture; fn nhận độ dời từ lúc bấm. */
  function dragOn(target: HTMLElement, start: (e: PointerEvent) => boolean, move: (dx: number, dy: number) => void) {
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (minimized || !start(e)) return;
      e.preventDefault();
      const id = e.pointerId;
      const sx = e.clientX;
      const sy = e.clientY;
      try {
        target.setPointerCapture(id);
      } catch {
        /* bỏ qua */
      }
      win.classList.add('cs-fw-active');
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        move(ev.clientX - sx, ev.clientY - sy);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
        win.classList.remove('cs-fw-active');
        save();
      };
      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
      target.addEventListener('pointercancel', onUp);
    });
  }

  // Đổi cỡ.
  for (const h of handles) {
    let st: Rect = lay;
    dragOn(h, () => {
      st = { ...lay };
      custom = true;
      return true;
    }, (dx, dy) => {
      lay = { ...lay, ...resizeRect(st, h.dataset.dir ?? '', dx, dy, vw(), vh()) };
      apply();
    });
  }

  // Kéo nội dung để xem phần khác.
  let panStart = { px: 0, py: 0 };
  dragOn(view, () => {
    panStart = { px: lay.px, py: lay.py };
    custom = true;
    return true;
  }, (dx, dy) => {
    lay = { ...lay, px: panStart.px - dx, py: panStart.py - dy };
    apply();
  });
  let wheelSave = 0;
  view.addEventListener('wheel', (e) => {
    if (minimized) return;
    e.preventDefault();
    custom = true;
    if (e.ctrlKey) setZoom(lay.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    else {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      lay = { ...lay, px: lay.px + dx, py: lay.py + dy };
      apply();
    }
    clearTimeout(wheelSave);
    wheelSave = window.setTimeout(save, 300);
  }, { passive: false });
  view.addEventListener('dblclick', () => {
    if (minimized) return;
    lay = { ...lay, px: 0, py: 0 };
    apply();
    save();
  });

  function setZoom(z: number): void {
    const nz = clamp(Math.round(z * 100) / 100, ZOOM_MIN, ZOOM_MAX);
    const k = nz / lay.z;
    custom = true;
    lay = { ...lay, z: nz, px: lay.px * k, py: lay.py * k };
    apply();
  }

  function reset(): void {
    custom = false;
    lay = { ...opts.defaultLayout(contentH, barH) };
    apply();
    try {
      localStorage.removeItem(opts.storageKey);
    } catch {
      /* không có localStorage */
    }
  }

  const NOT_HANDLE = 'button,input,select,a,.cs-panel-prog';

  return {
    el: win,
    content,
    attachBar(b: HTMLElement) {
      bar = b;
      win.insertBefore(b, win.firstChild);
      b.classList.add('cs-fw-bar');
      const mk = (cls: string, text: string, title: string, fn: () => void, persist = true) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `cs-panel-btn ${cls}`;
        btn.textContent = text;
        btn.title = title;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
          btn.blur();
          if (persist) save();
        });
        return btn;
      };
      const zoomBox = document.createElement('span');
      zoomBox.className = 'cs-fw-zoom';
      zoomBox.append(
        mk('cs-zoom-out', '−', 'Thu nhỏ nội dung', () => setZoom(lay.z - 0.1)),
        (zoomLabel = document.createElement('span')),
        mk('cs-zoom-in', '+', 'Phóng to nội dung', () => setZoom(lay.z + 0.1)),
      );
      zoomLabel.className = 'cs-fw-zoom-val';
      b.appendChild(zoomBox);
      b.appendChild(mk('cs-fw-reset', 'Đặt lại', 'Đặt lại vị trí và cỡ khung (nhấp đúp thanh)', reset, false));
      let st: Rect = lay;
      dragOn(b, (e) => {
        const t = e.target as HTMLElement;
        if (t.closest(NOT_HANDLE)) return false;
        st = { ...lay };
        custom = true;
        return true;
      }, (dx, dy) => {
        lay = { ...lay, ...clampRect({ ...st, x: st.x + dx, y: st.y + dy }, vw(), vh()) };
        apply();
      });
      b.addEventListener('dblclick', (e) => {
        if ((e.target as HTMLElement).closest(NOT_HANDLE) || minimized) return;
        reset();
      });
      lastZoomText = '';
      measure();
      apply();
    },
    setMinimized(on: boolean) {
      minimized = on;
      win.classList.toggle('cs-min', on);
      content.classList.toggle('cs-min', on);
      measure();
      apply();
    },
    reset,
    getLayout: () => ({ ...shown }),
    dispose() {
      ro?.disconnect();
      window.removeEventListener('resize', onWinResize);
      clearTimeout(wheelSave);
      win.remove();
    },
  };
}
