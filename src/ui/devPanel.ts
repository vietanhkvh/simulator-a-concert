// CHẾ ĐỘ DEVELOPER: bảng nổi (kéo được, thu gọn được) để thử nhanh mọi tính năng của game.
// Bật: ?dev=1 (nhớ trong localStorage tới khi ?dev=0), phím ` hoặc F2, link "DEV" nhỏ ở sảnh.
// Bảng chỉ GỌI các hành động do main.ts cung cấp (DevHost); không tự đổi luật chơi.
// Cùng các hành động đó lộ ra ở window.__dev cho kiểm thử tự động (xem README, mục "Chế độ developer").

export type DevMicMode = 'real' | 'perfect' | 'off' | 'octave' | 'silent';
export type DevEntrance = 'jump' | 'lift' | 'cable';
export type DevZone = 'outside' | 'stands' | 'arena' | 'glow';
export type DevInteract = 'cheer' | 'wave' | 'heart' | 'flash' | 'fireworks' | 'sing';

/** Hành động main.ts cung cấp cho bảng developer (và window.__dev). */
export interface DevHost {
  /** Số liệu tức thời (không gồm FPS — bảng tự đo). */
  snapshot(): Record<string, unknown>;
  startInstant(): void;
  startWithEntrance(kind: DevEntrance): void;
  restart(): void;
  end(): void;
  result(): void;
  seekBy(d: number): void;
  seekTo(sec: number): void;
  /** Giây bắt đầu điệp khúc đầu tiên (findChorusLines), null nếu không có. */
  chorusSec(): number | null;
  duration(): number;
  /** Khóa Hype hiển thị (0..1) cho mọi module hình/âm; null = bỏ khóa. Điểm không đổi. */
  setHypeLock(v: number | null): void;
  getHypeLock(): number | null;
  setMicMode(m: DevMicMode): void;
  getMicMode(): DevMicMode;
  setLatency(ms: number): void;
  getLatency(): number;
  setSensitivity(gain: number): void;
  interact(kind: DevInteract): void;
  pyro(): void;
  confetti(): void;
  emote(kind: string): void;
  formation(kind?: string): void;
  emoteKinds: readonly string[];
  setCrowdSing(on: boolean): void;
  getCrowdSing(): boolean;
  secretKinds(): string[];
  secret(kind: string): void;
  flyby(): void;
  secretChances(): Record<string, number>;
  setSecretChance(kind: string, v: number): void;
  meteors(count: number): void;
  entrancePreview(kind: DevEntrance): void;
  banners(lines: string[]): void;
  views(): string[];
  setView(v: string): void;
  setMouseLook(on: boolean): void;
  isMouseLook(): boolean;
  teleportTargets(): string[];
  teleport(target: string | { x: number; z: number; yaw?: number }): void;
  getLookSens(): number | null;
  setLookSens(v: number): void;
  /** Camera debug tùy ý; null = trả về. Không có hook thì không làm gì (trả false). */
  setDebugCamera(p: { x: number; y: number; z: number; tx: number; ty: number; tz: number; fov?: number } | null): boolean;
  /** Vị trí/hướng camera hiện tại (để bắt đầu bay tự do từ đó). */
  cameraPose(): { x: number; y: number; z: number; yaw: number; pitch: number };
  setZoneVisible(zone: DevZone, on: boolean): boolean;
  layers(zone: DevZone): string[];
  setLayerVisible(zone: DevZone, name: string, on: boolean): boolean;
  isLayerVisible(zone: DevZone, name: string): boolean;
  getCrowdQuality(): number | null;
  setCrowdQuality(q: number): void;
  reloadWithCrowd(n: number): void;
}

// ───────────── Nhật ký: sự kiện game + lỗi console (ghi từ lúc tải trang, kể cả khi chưa bật dev) ─────────────
export interface DevLogEntry { t: number; kind: string; text: string }
const LOG_MAX = 30;
const ERR_MAX = 50;
const log: DevLogEntry[] = [];
const errors: DevLogEntry[] = [];
const logListeners = new Set<() => void>();
const T0 = performance.now();
const stamp = () => Math.round(performance.now() - T0) / 1000;
function push(list: DevLogEntry[], max: number, kind: string, text: string): void {
  list.push({ t: stamp(), kind, text });
  if (list.length > max) list.splice(0, list.length - max);
  for (const l of logListeners) l();
}
export const DEV_EVENTS = ['cs-interact', 'cs-secret', 'cs-entrance', 'cs-view', 'cs-mouselook'] as const;
let logInstalled = false;
/** Gọi một lần khi tải trang: nghe sự kiện game và bắt console.error/warn + lỗi chưa xử lý. */
export function installDevLog(): void {
  if (logInstalled) return;
  logInstalled = true;
  for (const name of DEV_EVENTS) {
    window.addEventListener(name, (e) => {
      let d = '';
      try { d = JSON.stringify((e as CustomEvent).detail ?? null); } catch { d = '?'; }
      push(log, LOG_MAX, name, d);
    });
  }
  const fmt = (args: unknown[]) => args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ').slice(0, 400);
  for (const level of ['error', 'warn'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => { push(errors, ERR_MAX, level, fmt(args)); orig(...args); };
  }
  window.addEventListener('error', (e) => push(errors, ERR_MAX, 'error', `${e.message} @${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => push(errors, ERR_MAX, 'error', `unhandled: ${fmt([e.reason])}`));
}

// ───────────── Bật/tắt chế độ developer ─────────────
const DEV_KEY = 'cs-dev';
const POS_KEY = 'cs-dev-pos';
function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string | null): void {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ }
}
/** ?dev=1 bật và nhớ; ?dev=0 tắt và quên; không có tham số thì theo localStorage. */
export function devRequested(params: URLSearchParams): boolean {
  const p = params.get('dev');
  if (p === '1' || p === 'true') { lsSet(DEV_KEY, '1'); return true; }
  if (p === '0' || p === 'false') { lsSet(DEV_KEY, null); return false; }
  return lsGet(DEV_KEY) === '1';
}

export interface DevPanel {
  readonly enabled: boolean;
  readonly visible: boolean;
  /** Bật chế độ developer (hiện huy hiệu + bảng). */
  enable(): void;
  /** Tắt hẳn (ẩn mọi thứ, quên localStorage). */
  disable(): void;
  show(): void;
  hide(): void;
  toggle(): void;
  /** Mỗi frame (dt thật, giây). Đo FPS, cập nhật hype sweep, camera bay tự do, số liệu (~4 Hz). */
  tick(dt: number): void;
  /** Hiện link "DEV" ở sảnh. */
  setLobby(on: boolean): void;
  readonly api: Record<string, unknown>;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiName = (m: number) => `${NOTE_NAMES[((Math.round(m) % 12) + 12) % 12]}${Math.floor(Math.round(m) / 12) - 1}`;
const VIEW_LABEL: Record<string, string> = {
  singer: 'Ca sĩ', flycam: 'Flycam', pit: 'Hố', crane: 'Cần cẩu', wide: 'Toàn cảnh', aerial: 'Trên cao',
};
const SECRET_LABEL: Record<string, string> = { ufo: 'UFO', rocket: 'Tên lửa', dragon: 'Rồng', jet: 'Máy bay phản lực' };
const ENTRANCE_LABEL: Record<DevEntrance, string> = { jump: 'Nhảy trực thăng', lift: 'Bục nâng', cable: 'Thả cáp' };
const ZONE_LABEL: Record<DevZone, string> = { outside: 'Ngoài sân', stands: 'Khán đài', arena: 'Sân trung tâm', glow: 'Điểm sáng chung' };
/** Module có trong bản thiết kế nhưng không tách lớp riêng được nếu không sửa module. */
export const DEV_NOT_TOGGLEABLE = [
  'aurora (nằm trong sky)', 'lasers (nằm trong stageFx)', 'sao + khán giả chấm sáng (một draw call chung "glow")',
  'vật thể tạo muộn (pháo hoa/sự kiện bí mật tạo khi chạy)',
];

export function createDevPanel(host: DevHost, startEnabled: boolean): DevPanel {
  let enabled = false;
  let visible = false;

  // Huy hiệu DEV + link ở sảnh
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'cs-dev-badge';
  badge.textContent = 'DEV';
  badge.title = 'Chế độ developer — bấm để ẩn/hiện bảng (phím ` hoặc F2)';
  badge.hidden = true;
  badge.dataset.nodrag = '';
  const lobbyLink = document.createElement('button');
  lobbyLink.type = 'button';
  lobbyLink.className = 'cs-dev-lobby';
  lobbyLink.textContent = 'DEV';
  lobbyLink.title = 'Mở chế độ developer';
  lobbyLink.hidden = true;
  lobbyLink.dataset.nodrag = '';

  const el = document.createElement('aside');
  el.className = 'cs-dev';
  el.hidden = true;
  el.dataset.nodrag = '';
  el.setAttribute('aria-label', 'Bảng developer');
  const sec = (id: string, title: string, body: string, open = false) =>
    `<details class="cs-dev-sec" data-sec="${id}"${open ? ' open' : ''}><summary>${title}</summary><div class="cs-dev-body">${body}</div></details>`;
  const btn = (attrs: string, text: string) => `<button type="button" class="cs-dev-btn" ${attrs}>${esc(text)}</button>`;
  const entrances = (Object.keys(ENTRANCE_LABEL) as DevEntrance[]);
  const zones: DevZone[] = ['outside', 'stands', 'arena', 'glow'];
  el.innerHTML = `
    <div class="cs-dev-head"><b>DEV</b><span class="cs-dev-state"></span>
      <button type="button" class="cs-dev-x" data-act="collapse" title="Thu gọn">–</button>
      <button type="button" class="cs-dev-x" data-act="close" title="Ẩn bảng (\` hoặc F2)">×</button></div>
    <div class="cs-dev-scroll">
    ${sec('stats', 'Số liệu', `<pre class="cs-dev-stats"></pre>${btn('data-act="copy"', 'Copy stats (JSON)')}`, true)}
    ${sec('game', 'Trạng thái game', `
      <div class="cs-dev-btns">${btn('data-act="instant"', '▶ Bắt đầu ngay')}${entrances.map((k) => btn(`data-start="${k}"`, `▶ ${ENTRANCE_LABEL[k]}`)).join('')}</div>
      <div class="cs-dev-btns">${btn('data-act="restart"', '↺ Hát lại')}${btn('data-act="end"', '■ Kết thúc')}${btn('data-act="result"', 'Màn kết quả')}</div>
      <div class="cs-dev-btns">${[-30, -10, 10, 30].map((d) => btn(`data-seek="${d}"`, `${d > 0 ? '+' : ''}${d}s`)).join('')}
        ${btn('data-act="chorus"', '→ Điệp khúc')}${btn('data-act="nearend"', '→ Cuối −10s')}</div>`, true)}
    ${sec('hype', 'Hype', `
      <label class="cs-dev-row"><input type="checkbox" class="cs-dev-hlock"> Khóa Hype
        <input type="range" class="cs-dev-hype" min="0" max="100" step="1" value="50"><span class="cs-dev-hval">50%</span></label>
      <div class="cs-dev-btns">${[0, 20, 40, 60, 80, 95, 100].map((v) => btn(`data-hype="${v}"`, `${v}%`)).join('')}
        ${btn('data-act="sweep"', 'Quét 0→100 (20s)')}</div>
      <div class="cs-dev-note">Chỉ đổi Hype hiển thị (hình + âm thanh); điểm và Hype của điểm giữ nguyên.</div>`)}
    ${sec('mic', 'Micro', `
      <div class="cs-dev-btns">${(['real', 'perfect', 'off', 'octave', 'silent'] as DevMicMode[]).map((m) => btn(`data-mic="${m}"`, m)).join('')}</div>
      <label class="cs-dev-row">Bù trễ <input type="range" class="cs-dev-lat" min="0" max="400" step="5"><span class="cs-dev-latv"></span></label>
      <label class="cs-dev-row">Độ nhạy <input type="range" class="cs-dev-sens" min="25" max="400" step="5" value="100"><span class="cs-dev-sensv">100%</span></label>`)}
    ${sec('trig', 'Kích hoạt', `
      <div class="cs-dev-sub">Tương tác</div>
      <div class="cs-dev-btns">${btn('data-int="cheer"', 'Hò reo')}${btn('data-int="wave"', 'Sóng')}${btn('data-int="heart"', 'Thả tim')}
        ${btn('data-int="flash"', 'Flash bật/tắt')}${btn('data-int="fireworks"', 'Pháo hoa')}${btn('data-int="sing"', 'Hát theo (4s)')}</div>
      <div class="cs-dev-sub">Hiệu ứng sân khấu</div>
      <div class="cs-dev-btns">${btn('data-act="pyro"', 'Pyro')}${btn('data-act="confetti"', 'Pháo giấy')}${btn('data-act="formation"', 'Đội hình tim')}
        ${btn('data-act="lasers"', 'Laser (Hype 90%)')}<label class="cs-dev-chk"><input type="checkbox" class="cs-dev-sing"> Khán giả hát theo</label></div>
      <div class="cs-dev-btns">${host.emoteKinds.map((k) => btn(`data-emote="${k}"`, k)).join('')}</div>
      <div class="cs-dev-sub">Sự kiện bí mật</div>
      <div class="cs-dev-btns cs-dev-secrets"></div>
      <div class="cs-dev-chances"></div>
      <div class="cs-dev-btns">${btn('data-act="meteors"', 'Mưa sao băng')}${entrances.map((k) => btn(`data-prev="${k}"`, `Xem ${ENTRANCE_LABEL[k]}`)).join('')}</div>
      <label class="cs-dev-row">Băng rôn <input type="text" class="cs-dev-banner" placeholder="khẩu hiệu; cách nhau bằng |">${btn('data-act="banner"', 'Đặt')}</label>`)}
    ${sec('cam', 'Camera', `
      <div class="cs-dev-btns">${host.views().map((v) => btn(`data-view="${v}"`, VIEW_LABEL[v] ?? v)).join('')}
        ${btn('data-act="look"', 'Chuột tự do')}</div>
      <div class="cs-dev-btns">${host.teleportTargets().map((t) => btn(`data-tp="${t}"`, `⇢ ${t}`)).join('')}</div>
      <label class="cs-dev-row">Độ nhạy nhìn <input type="range" class="cs-dev-look" min="3" max="200" step="1"><span class="cs-dev-lookv"></span></label>
      <label class="cs-dev-chk"><input type="checkbox" class="cs-dev-fly"> Camera bay tự do (WASD, Q/E lên xuống, kéo chuột nhìn, Shift nhanh)</label>`)}
    ${sec('zones', 'Khu &amp; lớp', `
      <div class="cs-dev-zones">${zones.map((z) => `<label class="cs-dev-chk"><input type="checkbox" data-zone="${z}" checked> ${ZONE_LABEL[z]}</label>`).join('')}</div>
      <div class="cs-dev-layers"></div>
      <div class="cs-dev-note">Chưa bật/tắt riêng được: ${DEV_NOT_TOGGLEABLE.map(esc).join('; ')}.</div>
      <label class="cs-dev-row">Chất lượng khán giả <input type="range" class="cs-dev-q" min="30" max="100" step="5"><span class="cs-dev-qv"></span></label>
      <div class="cs-dev-btns">Số khán giả (tải lại): ${[400, 2000, 4000, 8000, 10000].map((n) => btn(`data-crowd="${n}"`, String(n))).join('')}</div>`)}
    ${sec('log', 'Nhật ký', `<pre class="cs-dev-log"></pre>${btn('data-act="clearlog"', 'Xóa')}`)}
    </div>`;
  document.body.append(el, badge, lobbyLink);

  const q = <T extends Element>(s: string) => el.querySelector(s) as T;
  const statsEl = q<HTMLPreElement>('.cs-dev-stats');
  const stateEl = q<HTMLSpanElement>('.cs-dev-state');
  const logEl = q<HTMLPreElement>('.cs-dev-log');
  const hlock = q<HTMLInputElement>('.cs-dev-hlock');
  const hype = q<HTMLInputElement>('.cs-dev-hype');
  const hval = q<HTMLSpanElement>('.cs-dev-hval');
  const lat = q<HTMLInputElement>('.cs-dev-lat');
  const latv = q<HTMLSpanElement>('.cs-dev-latv');
  const sens = q<HTMLInputElement>('.cs-dev-sens');
  const sensv = q<HTMLSpanElement>('.cs-dev-sensv');
  const look = q<HTMLInputElement>('.cs-dev-look');
  const lookv = q<HTMLSpanElement>('.cs-dev-lookv');
  const fly = q<HTMLInputElement>('.cs-dev-fly');
  const singChk = q<HTMLInputElement>('.cs-dev-sing');
  const quality = q<HTMLInputElement>('.cs-dev-q');
  const qualityV = q<HTMLSpanElement>('.cs-dev-qv');
  const layersEl = q<HTMLDivElement>('.cs-dev-layers');
  const secretsEl = q<HTMLDivElement>('.cs-dev-secrets');
  const chancesEl = q<HTMLDivElement>('.cs-dev-chances');

  // Sự kiện bí mật + tỉ lệ (theo khóa module có)
  secretsEl.innerHTML = host.secretKinds().map((k) => btn(`data-secret="${k}"`, SECRET_LABEL[k] ?? k)).join('') + btn('data-act="flyby"', 'Máy bay kéo băng rôn');
  const renderChances = () => {
    const c = host.secretChances();
    chancesEl.innerHTML = Object.keys(c).map((k) =>
      `<label>${esc(SECRET_LABEL[k] ?? k)} <input type="number" min="0" max="100" step="1" data-chance="${k}" value="${Math.round(c[k] * 100)}">%</label>`).join('');
  };
  renderChances();
  // Lớp của từng khu
  const renderLayers = () => {
    layersEl.innerHTML = (['outside', 'stands', 'arena'] as DevZone[]).map((z) =>
      `<div class="cs-dev-sub">${ZONE_LABEL[z]}</div><div class="cs-dev-zones">${host.layers(z).map((n) =>
        `<label class="cs-dev-chk"><input type="checkbox" data-layer="${z}:${n}"${host.isLayerVisible(z, n) ? ' checked' : ''}> ${esc(n)}</label>`).join('') || '<span class="cs-dev-note">—</span>'}</div>`).join('');
  };
  renderLayers();

  // ── Hype ──
  let sweep: { t: number; dur: number } | null = null;
  const setHype = (v: number | null) => {
    host.setHypeLock(v);
    hlock.checked = v !== null;
    if (v !== null) { hype.value = String(Math.round(v * 100)); hval.textContent = `${Math.round(v * 100)}%`; }
  };
  hlock.addEventListener('change', () => { sweep = null; setHype(hlock.checked ? Number(hype.value) / 100 : null); });
  hype.addEventListener('input', () => { sweep = null; hval.textContent = `${hype.value}%`; if (hlock.checked) host.setHypeLock(Number(hype.value) / 100); });

  // ── Micro ──
  const syncMic = () => {
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-mic]')) b.classList.toggle('on', b.dataset.mic === host.getMicMode());
    lat.value = String(host.getLatency());
    latv.textContent = `${host.getLatency()} ms`;
  };
  lat.addEventListener('input', () => { host.setLatency(Number(lat.value)); latv.textContent = `${lat.value} ms`; });
  sens.addEventListener('input', () => { host.setSensitivity(Number(sens.value) / 100); sensv.textContent = `${sens.value}%`; });

  // ── Camera ──
  const syncLook = () => {
    const s = host.getLookSens();
    look.disabled = s === null;
    if (s !== null) { look.value = String(Math.round(s * 10000)); lookv.textContent = s.toFixed(4); }
  };
  look.addEventListener('input', () => { host.setLookSens(Number(look.value) / 10000); syncLook(); });
  singChk.addEventListener('change', () => host.setCrowdSing(singChk.checked));
  quality.addEventListener('input', () => { host.setCrowdQuality(Number(quality.value) / 100); qualityV.textContent = `${quality.value}%`; });

  // Camera bay tự do: tự giữ vị trí + hướng, gọi host.setDebugCamera mỗi frame.
  const flyState = { on: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, keys: new Set<string>(), drag: -1, lx: 0, ly: 0 };
  const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const setFly = (on: boolean): boolean => {
    if (on) {
      const p = host.cameraPose();
      Object.assign(flyState, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch });
      if (!applyFly()) { fly.checked = false; return false; }
    } else {
      host.setDebugCamera(null);
    }
    flyState.on = on;
    flyState.keys.clear();
    fly.checked = on;
    return true;
  };
  function applyFly(): boolean {
    const cp = Math.cos(flyState.pitch);
    return host.setDebugCamera({
      x: flyState.x, y: flyState.y, z: flyState.z,
      tx: flyState.x - Math.sin(flyState.yaw) * cp, ty: flyState.y + Math.sin(flyState.pitch), tz: flyState.z - Math.cos(flyState.yaw) * cp,
      fov: 70,
    });
  }
  fly.addEventListener('change', () => setFly(fly.checked));
  // Bắt phím trước module điều khiển (capture trên window) để WASD/QE không di chuyển người chơi khi đang bay.
  window.addEventListener('keydown', (e) => {
    if (!flyState.on || isTyping(e.target) || !FLY_KEYS.has(e.code)) return;
    flyState.keys.add(e.code);
    e.stopPropagation();
    e.preventDefault();
  }, true);
  window.addEventListener('keyup', (e) => { if (flyState.keys.delete(e.code)) e.stopPropagation(); }, true);
  window.addEventListener('blur', () => flyState.keys.clear());
  window.addEventListener('pointerdown', (e) => {
    if (!flyState.on || (e.target as HTMLElement | null)?.closest?.('[data-nodrag], button, input, textarea, select')) return;
    flyState.drag = e.pointerId; flyState.lx = e.clientX; flyState.ly = e.clientY;
    e.stopPropagation();
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!flyState.on || flyState.drag !== e.pointerId) return;
    flyState.yaw -= (e.clientX - flyState.lx) * 0.004;
    flyState.pitch = Math.max(-1.5, Math.min(1.5, flyState.pitch - (e.clientY - flyState.ly) * 0.004));
    flyState.lx = e.clientX; flyState.ly = e.clientY;
    e.stopPropagation();
  }, true);
  window.addEventListener('pointerup', (e) => { if (flyState.drag === e.pointerId) { flyState.drag = -1; e.stopPropagation(); } }, true);
  const updateFly = (dt: number) => {
    if (!flyState.on) return;
    const k = flyState.keys;
    const sp = (k.has('ShiftLeft') || k.has('ShiftRight') ? 40 : 10) * dt;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const u = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    const cp = Math.cos(flyState.pitch);
    flyState.x += (-Math.sin(flyState.yaw) * cp * f + Math.cos(flyState.yaw) * r) * sp;
    flyState.z += (-Math.cos(flyState.yaw) * cp * f - Math.sin(flyState.yaw) * r) * sp;
    flyState.y += (Math.sin(flyState.pitch) * f + u) * sp;
    applyFly();
  };

  // ── Bấm nút ──
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    b.blur(); // để Space/Enter không bấm lại nút
    if (d.act) {
      switch (d.act) {
        case 'collapse': el.classList.toggle('collapsed'); break;
        case 'close': hide(); break;
        case 'copy': void navigator.clipboard?.writeText(JSON.stringify(stats(), null, 2)).catch(() => {}); break;
        case 'instant': host.startInstant(); break;
        case 'restart': host.restart(); break;
        case 'end': host.end(); break;
        case 'result': host.result(); break;
        case 'chorus': { const c = host.chorusSec(); if (c !== null) host.seekTo(c); break; }
        case 'nearend': host.seekTo(host.duration() - 10); break;
        case 'sweep': sweep = { t: 0, dur: 20 }; setHype(0); break;
        case 'pyro': host.pyro(); break;
        case 'confetti': host.confetti(); break;
        case 'formation': host.formation('heart'); break;
        case 'lasers': setHype(0.9); break;
        case 'flyby': host.flyby(); break;
        case 'meteors': host.meteors(12); break;
        case 'banner': host.banners(q<HTMLInputElement>('.cs-dev-banner').value.split('|').map((s) => s.trim()).filter(Boolean)); break;
        case 'look': host.setMouseLook(!host.isMouseLook()); break;
        case 'clearlog': log.length = 0; errors.length = 0; renderLog(); break;
      }
    } else if (d.start) host.startWithEntrance(d.start as DevEntrance);
    else if (d.seek) host.seekBy(Number(d.seek));
    else if (d.hype) { sweep = null; setHype(Number(d.hype) / 100); }
    else if (d.mic) { host.setMicMode(d.mic as DevMicMode); syncMic(); }
    else if (d.int) host.interact(d.int as DevInteract);
    else if (d.emote) host.emote(d.emote);
    else if (d.secret) host.secret(d.secret);
    else if (d.prev) host.entrancePreview(d.prev as DevEntrance);
    else if (d.view) { if (flyState.on) setFly(false); host.setView(d.view); }
    else if (d.tp) host.teleport(d.tp);
    else if (d.crowd) host.reloadWithCrowd(Number(d.crowd));
  });
  el.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.zone) { host.setZoneVisible(t.dataset.zone as DevZone, t.checked); renderLayers(); }
    else if (t.dataset.layer) { const [z, n] = t.dataset.layer.split(':'); host.setLayerVisible(z as DevZone, n, t.checked); }
    else if (t.dataset.chance) host.setSecretChance(t.dataset.chance, Math.max(0, Math.min(100, Number(t.value) || 0)) / 100);
  });
  // Đang gõ trong ô nhập của bảng: phím không tới game (trừ Esc).
  el.addEventListener('keydown', (e) => { if (isTyping(e.target) && e.code !== 'Escape') e.stopPropagation(); });

  // ── Kéo bảng theo thanh tiêu đề ──
  const head = q<HTMLDivElement>('.cs-dev-head');
  let dragId = -1, dx = 0, dy = 0;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragId = e.pointerId;
    const r = el.getBoundingClientRect();
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    const x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx));
    const y = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - dy));
    el.style.left = `${x}px`; el.style.top = `${y}px`;
  });
  head.addEventListener('pointerup', (e) => {
    if (e.pointerId !== dragId) return;
    dragId = -1;
    lsSet(POS_KEY, JSON.stringify({ x: el.style.left, y: el.style.top }));
  });
  try {
    const p = JSON.parse(lsGet(POS_KEY) ?? 'null') as { x: string; y: string } | null;
    if (p?.x && p?.y) { el.style.left = p.x; el.style.top = p.y; }
  } catch { /* ignore */ }

  // ── Nhật ký ──
  let logDirty = true;
  logListeners.add(() => { logDirty = true; });
  const line = (e: DevLogEntry) => `${e.t.toFixed(2).padStart(7)} ${e.kind} ${e.text}`;
  function renderLog(): void {
    logDirty = false;
    logEl.textContent = [
      ...log.map(line),
      errors.length ? `── lỗi/cảnh báo console (${errors.length}) ──` : '── không có lỗi console ──',
      ...errors.map(line),
    ].join('\n');
  }

  // ── Số liệu (FPS đo trong 3 s gần nhất) ──
  const frames: { at: number; ms: number }[] = [];
  function fpsStats() {
    const now = performance.now();
    while (frames.length && now - frames[0].at > 3000) frames.shift();
    if (frames.length < 2) return { fps: 0, frameMs: 0, low1Fps: 0 };
    const ms = frames.map((f) => f.ms);
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    const sorted = [...ms].sort((a, b) => b - a);
    const worst = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.01))];
    return { fps: +(1000 / avg).toFixed(1), frameMs: +avg.toFixed(1), low1Fps: +(1000 / worst).toFixed(1) };
  }
  function stats(): Record<string, unknown> {
    return { ...fpsStats(), ...host.snapshot(), hypeLock: host.getHypeLock(), freeFly: flyState.on };
  }
  const fmtVal = (v: unknown): string =>
    v === null || v === undefined ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : typeof v === 'object' ? JSON.stringify(v) : String(v);
  let lastFrameAt = 0;
  let statAcc = 0;
  function tick(dt: number): void {
    const now = performance.now();
    if (lastFrameAt) frames.push({ at: now, ms: now - lastFrameAt });
    lastFrameAt = now;
    if (sweep) {
      sweep.t += dt;
      const v = Math.min(1, sweep.t / sweep.dur);
      host.setHypeLock(v);
      hype.value = String(Math.round(v * 100)); hval.textContent = `${Math.round(v * 100)}%`;
      if (v >= 1) { sweep = null; setHype(null); }
    }
    updateFly(dt);
    if (!visible || el.classList.contains('collapsed')) return;
    statAcc += dt;
    if (statAcc < 0.25) return;
    statAcc = 0;
    const s = stats();
    stateEl.textContent = String(s.state ?? '');
    statsEl.textContent = Object.entries(s).map(([k, v]) => `${k.padEnd(13)} ${fmtVal(v)}`).join('\n');
    if (logDirty) renderLog();
    const qv = host.getCrowdQuality();
    if (qv !== null && document.activeElement !== quality) { quality.value = String(Math.round(qv * 100)); qualityV.textContent = `${Math.round(qv * 100)}%`; }
    if (hlock.checked !== (host.getHypeLock() !== null)) hlock.checked = host.getHypeLock() !== null;
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-view]')) b.classList.toggle('on', b.dataset.view === s.view);
  }

  function show(): void {
    if (!enabled) enable();
    visible = true;
    el.hidden = false;
    syncMic(); syncLook(); renderLayers(); renderLog();
    statAcc = 1;
  }
  function hide(): void { visible = false; el.hidden = true; }
  function enable(): void {
    if (enabled) return;
    enabled = true;
    badge.hidden = false;
    lobbyLink.hidden = true;
    lsSet(DEV_KEY, '1');
  }
  function disable(): void {
    hide();
    if (flyState.on) setFly(false);
    if (host.getHypeLock() !== null) setHype(null);
    enabled = false;
    badge.hidden = true;
    lsSet(DEV_KEY, null);
  }
  badge.addEventListener('click', () => { badge.blur(); if (visible) hide(); else show(); });
  lobbyLink.addEventListener('click', () => { lobbyLink.blur(); show(); });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'F2' || (e.code === 'Backquote' && !isTyping(e.target))) {
      e.preventDefault();
      if (visible) hide(); else show();
    }
  });

  const api: Record<string, unknown> = {
    ...host,
    stats,
    log: () => ({ events: [...log], errors: [...errors] }),
    sweepHype: (sec = 20) => { sweep = { t: 0, dur: sec }; setHype(0); },
    setFreeFly: (on: boolean) => setFly(on),
    isFreeFly: () => flyState.on,
    show, hide, toggle: () => (visible ? hide() : show()), enable, disable,
    notToggleable: DEV_NOT_TOGGLEABLE,
  };
  if (startEnabled) { enable(); show(); }
  return {
    get enabled() { return enabled; },
    get visible() { return visible; },
    enable, disable, show, hide,
    toggle: () => (visible ? hide() : show()),
    tick,
    setLobby(on) { lobbyLink.hidden = !on || enabled; },
    api,
  };
}
