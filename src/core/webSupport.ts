/**
 * Độ bền khi chạy trên URL công khai: kiểm tra WebGL2, màn lỗi toàn trang, mất context WebGL, hộp lỗi toàn cục,
 * thông báo thiết bị cảm ứng / màn hình nhỏ, gỡ chỉ báo tải trong index.html.
 * Tự đủ style (không phụ thuộc style.css, vì có thể được dùng khi game chưa tải được); màu lấy từ biến --cs-*
 * của phong cách đang bật, có giá trị dự phòng.
 */

const CSS = `
.cs-ws-fatal{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;
  background:radial-gradient(ellipse at 50% 40%,#2a2350,#0a0818 75%);color:var(--cs-text,#fff4e6);font:16px/1.55 var(--cs-font-body,system-ui,'Segoe UI',Roboto,sans-serif);text-align:center}
.cs-ws-fatal>div{max-width:520px}
.cs-ws-fatal h1{margin:0 0 10px;font:800 clamp(24px,5vw,34px)/1.15 var(--cs-font-display,system-ui,sans-serif);color:var(--cs-peach-500,#ff8f7a)}
.cs-ws-fatal p{margin:0 0 10px;color:var(--cs-text-dim,#d8cffc)}
.cs-ws-btn{font:700 16px var(--cs-font-display,system-ui,sans-serif);min-height:44px;padding:6px 28px;margin-top:8px;cursor:pointer;color:var(--cs-btn-fg,#14102b);
  background:var(--cs-btn-bg,#ff7ab8);border:var(--cs-sticker-border,2px solid #2b1d5c);border-radius:var(--cs-r-pill,999px);box-shadow:var(--cs-sticker-shadow,0 4px 0 #a8326f)}
.cs-ws-btn:hover{background:var(--cs-btn-hover,#ff9ccd)}
.cs-ws-btn:focus-visible{outline:var(--cs-focus,2px solid #fff4e6);outline-offset:2px}
.cs-ws-toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:150;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;
  display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 12px;padding:8px 14px;color:var(--cs-text,#fff4e6);
  font:14px/1.4 var(--cs-font-body,system-ui,sans-serif);background:var(--cs-panel,rgba(20,16,43,.92));border:var(--cs-panel-border,2px solid #6b5bd2);
  border-radius:var(--cs-r-md,12px);box-shadow:var(--cs-sticker-shadow-panel,0 4px 0 #2b1d5c)}
.cs-ws-toast .cs-ws-btn{font-size:13px;min-height:32px;padding:2px 14px;margin:0}
.cs-ws-toast small{display:block;flex-basis:100%;text-align:center;color:var(--cs-text-mute,#9b8fd6);word-break:break-word}
.cs-ws-toast[hidden]{display:none}
.cs-ws-x{font:700 18px/1 system-ui,sans-serif;width:28px;height:28px;padding:0;cursor:pointer;color:var(--cs-text,#fff4e6);background:transparent;border:0}
`;

function ensureStyle(): void {
  if (document.getElementById('cs-ws-style')) return;
  const s = document.createElement('style');
  s.id = 'cs-ws-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const isDev = (): boolean => new URLSearchParams(location.search).get('dev') === '1';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function reloadButton(label = 'Tải lại trang'): HTMLButtonElement {
  const b = el('button', 'cs-ws-btn', label);
  b.type = 'button';
  b.addEventListener('click', () => location.reload());
  return b;
}

/** Gỡ chỉ báo tải trong index.html (gọi khi sảnh sẵn sàng hoặc khi hiện lỗi). An toàn khi gọi nhiều lần. */
export function hideBootLoader(): void {
  const b = document.getElementById('boot');
  if (!b || b.classList.contains('done')) return;
  b.classList.add('done');
  window.setTimeout(() => b.remove(), 500);
}

let fatalShown = false;
export function isFatalShown(): boolean { return fatalShown; }

/** Màn lỗi toàn trang (thay mọi thứ khác). */
export function showFatal(title: string, lines: string[], opts: { reload?: boolean } = {}): void {
  if (fatalShown) return;
  fatalShown = true;
  ensureStyle();
  hideBootLoader();
  document.querySelectorAll('.cs-ws-toast').forEach((t) => t.remove());
  toastEl = null;
  const root = el('div', 'cs-ws-fatal');
  root.setAttribute('role', 'alert');
  const box = el('div');
  box.appendChild(el('h1', undefined, title));
  for (const l of lines) box.appendChild(el('p', undefined, l));
  if (opts.reload !== false) box.appendChild(reloadButton());
  root.appendChild(box);
  document.body.appendChild(root);
}

/** Kiểm tra trình duyệt tạo được WebGL2 (three.js r163+ chỉ chạy bằng WebGL2). */
export function checkWebGL(): { ok: true } | { ok: false; reason: 'none' | 'webgl1-only' } {
  try {
    const c = document.createElement('canvas');
    const gl2 = c.getContext('webgl2');
    if (gl2) {
      gl2.getExtension('WEBGL_lose_context')?.loseContext(); // trả context thử ngay, tránh chiếm chỗ
      return { ok: true };
    }
    const gl1 = document.createElement('canvas').getContext('webgl');
    return { ok: false, reason: gl1 ? 'webgl1-only' : 'none' };
  } catch {
    return { ok: false, reason: 'none' };
  }
}

export function showNoWebGL(reason: 'none' | 'webgl1-only'): void {
  showFatal(
    'Trình duyệt chưa chạy được đồ họa 3D',
    [
      reason === 'webgl1-only'
        ? 'Trò chơi cần WebGL 2, nhưng trình duyệt của bạn chỉ hỗ trợ bản cũ hơn.'
        : 'Trò chơi cần WebGL 2 để vẽ sân khấu, nhưng trình duyệt không tạo được.',
      'Hãy thử: bật “tăng tốc phần cứng” trong cài đặt trình duyệt, cập nhật trình duyệt và trình điều khiển card đồ họa, hoặc mở bằng Chrome, Edge, Firefox hay Safari bản mới trên máy tính.',
    ],
  );
}

/** Mất context WebGL (card đồ họa reset, thiếu bộ nhớ…) → thông báo + nút tải lại. */
export function watchContextLoss(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('webglcontextlost', () => {
    console.error('[webgl] context bị mất');
    showFatal('Mất kết nối với card đồ họa', [
      'Hình ảnh 3D bị dừng do trình duyệt hoặc card đồ họa đặt lại (có thể do thiếu bộ nhớ hoặc nhiều tab nặng).',
      'Bấm nút bên dưới để tải lại trang. Điểm của lượt đang hát sẽ không được giữ.',
    ]);
  });
}

let toastEl: HTMLElement | null = null;
let toastTimer = 0;
/** Hộp lỗi toàn cục: không nuốt lỗi (vẫn ra console, không preventDefault); chỉ báo nhẹ + nút tải lại. */
export function installErrorBoundary(): void {
  const report = (kind: string, err: unknown, msg: string): void => {
    console.error(`[${kind}]`, err);
    if (fatalShown) return;
    if (/ResizeObserver loop/i.test(msg)) return; // vô hại, trình duyệt hay báo
    ensureStyle();
    if (!toastEl) {
      toastEl = el('div', 'cs-ws-toast');
      toastEl.setAttribute('role', 'alert');
      document.body.appendChild(toastEl);
    }
    toastEl.replaceChildren();
    toastEl.hidden = false;
    toastEl.appendChild(el('span', undefined, 'Đã xảy ra lỗi. Nếu trò chơi hoạt động lạ, hãy tải lại trang.'));
    toastEl.appendChild(reloadButton());
    const x = el('button', 'cs-ws-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Đóng thông báo lỗi');
    x.addEventListener('click', () => { if (toastEl) toastEl.hidden = true; });
    toastEl.appendChild(x);
    if (isDev()) toastEl.appendChild(el('small', undefined, msg.slice(0, 300)));
    clearTimeout(toastTimer);
    if (!isDev()) toastTimer = window.setTimeout(() => { if (toastEl) toastEl.hidden = true; }, 15000);
  };
  window.addEventListener('error', (e) => {
    // Lỗi tải tài nguyên (không có e.error) cũng đáng ghi nhận, nhưng chỉ khi có message.
    report('error', e.error ?? e.message, e.message || String(e.error ?? ''));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    report('unhandledrejection', r, r instanceof Error ? r.message : String(r));
  });
}

/** Thiết bị chỉ có cảm ứng / màn hình nhỏ: báo game dành cho máy tính, không chặn chơi. */
export function showDeviceNoticeIfNeeded(): void {
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  if (!touchOnly && innerWidth >= 720) return;
  try { if (sessionStorage.getItem('cs-device-notice') === '1') return; } catch { /* bỏ qua */ }
  ensureStyle();
  const n = el('div', 'cs-ws-toast cs-ws-notice');
  n.setAttribute('role', 'note');
  n.appendChild(el('span', undefined, 'Trò chơi được thiết kế cho máy tính, chơi bằng bàn phím và micro. Trên điện thoại hoặc máy tính bảng, trải nghiệm có thể bị hạn chế.'));
  const x = el('button', 'cs-ws-x', '×');
  x.type = 'button';
  x.setAttribute('aria-label', 'Đóng thông báo');
  x.addEventListener('click', () => {
    n.remove();
    try { sessionStorage.setItem('cs-device-notice', '1'); } catch { /* bỏ qua */ }
  });
  n.appendChild(x);
  document.body.appendChild(n);
}
