import { renderControls } from './controlsGuide';
import type { QualityMode, QualityTier } from '../core/quality';

/**
 * Bảng "xưởng" khi tạm dừng (dock bên phải, sân khấu vẫn thấy bên trái): tiếp tục / hát lại / kết thúc,
 * micro, âm thanh, khán giả (Hype xem trước + nút thử tương tác), góc máy, băng rôn cổ vũ, tua lời,
 * sự kiện bí mật. Chỉ là UI: mọi tác dụng đi qua callback do main.ts cung cấp.
 */

export type SecretKind = 'ufo' | 'rocket' | 'dragon' | 'jet';
export type EntrancePreview = 'jump' | 'lift' | 'cable';
export type TestKind = 'cheer' | 'wave' | 'heart' | 'flash' | 'fireworks' | 'sing';
export type VolumeKind = 'music' | 'crowd' | 'sing';
/** Id góc máy (danh sách thật lấy từ VIEW_MODES của khu sân trung tâm, truyền qua PauseMenuOptions.views). */
export type ViewName = 'singer' | 'aerial' | 'flycam' | 'pit' | 'crane' | 'wide';

export interface WorkshopSettings {
  /** null = theo mặc định (?latency= hoặc theo loại micro). */
  latencyMs: number | null;
  volume: Record<VolumeKind, number>;
  banners: string[];
  /** null = giữ mặc định của module sự kiện bí mật. */
  chances: Record<SecretKind, number> | null;
}

const KEY = 'cs-workshop';
export const BANNER_MAX_LINES = 6;
export const BANNER_MAX_CHARS = 24;

export function loadSettings(): WorkshopSettings {
  const def: WorkshopSettings = { latencyMs: null, volume: { music: 1, crowd: 1, sing: 1 }, banners: [], chances: null };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<WorkshopSettings> | null;
    if (!raw || typeof raw !== 'object') return def;
    const num = (v: unknown, d: number, lo: number, hi: number) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
    const vol = (raw.volume ?? {}) as Partial<Record<VolumeKind, number>>;
    const ch = raw.chances as Partial<Record<SecretKind, number>> | null | undefined;
    return {
      latencyMs: raw.latencyMs == null ? null : num(raw.latencyMs, 0, 0, 400),
      volume: { music: num(vol.music, 1, 0, 1.5), crowd: num(vol.crowd, 1, 0, 1.5), sing: num(vol.sing, 1, 0, 1.5) },
      banners: Array.isArray(raw.banners) ? cleanBanners(raw.banners.filter((s) => typeof s === 'string').join('\n')) : [],
      chances: ch && typeof ch === 'object'
        ? { ufo: num(ch.ufo, 0.25, 0, 1), rocket: num(ch.rocket, 0.2, 0, 1), dragon: num(ch.dragon, 0.1, 0, 1), jet: num(ch.jet, 0.15, 0, 1) }
        : null,
    };
  } catch {
    return def;
  }
}

export function saveSettings(s: WorkshopSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* không có localStorage */ }
}

export function cleanBanners(text: string): string[] {
  return text.split('\n').map((l) => l.trim().slice(0, BANNER_MAX_CHARS)).filter(Boolean).slice(0, BANNER_MAX_LINES);
}

export interface PauseMenuOptions {
  settings: WorkshopSettings;
  /** Giá trị bù trễ đang dùng (ms) để hiện trên slider. */
  latencyMs: number;
  onResume(): void;
  onRestart(): void;
  onEnd(): void;
  onLatency(ms: number): void;
  onVolume(kind: VolumeKind, v: number): void;
  onPreviewHype(h: number): void;
  getQuality(): number | null;
  setQuality(q: number): void;
  /** Chất lượng đồ hoạ (world/quality.ts): chế độ đang chọn + bậc đang dùng; set() lưu lựa chọn. */
  gfx?: { get(): { mode: QualityMode; tier: QualityTier }; set(mode: QualityMode): void };
  onTest(kind: TestKind): void;
  setView(v: ViewName): void;
  setMouseLook(on: boolean): void;
  onBanners(lines: string[]): void;
  onSecret(kind: SecretKind): void;
  onFlyby(): void;
  /** Xem thử màn chào sân (tùy chọn). */
  onEntrance?(kind: EntrancePreview): void;
  onChance(kind: SecretKind, v: number): void;
  seekBy(d: number): void;
  seekTo(sec: number): void;
  songTime(): number;
  duration(): number;
  /** Mở bảng developer (chế độ developer, ui/devPanel.ts). */
  onDevPanel?(): void;
  /** Danh sách góc máy (id + nhãn), mặc định VIEWS. */
  views?: readonly { id: string; label: string }[];
}

export interface PauseMenu {
  readonly el: HTMLElement;
  readonly isOpen: boolean;
  /** Tên phong cách đang bật (hiện dưới tiêu đề). */
  setThemeName(name: string): void;
  open(hype: number, micPanelEl: HTMLElement): void;
  close(): void;
  /** Mỗi frame khi mở: cập nhật thời gian/thanh tua. */
  update(): void;
  setViewState(v: string): void;
  setMouseLookState(on: boolean): void;
  setFlashState(on: boolean): void;
  /** Bật/tắt nút sự kiện bí mật / máy bay theo module có sẵn hay chưa. */
  setSecretAvailable(secret: boolean, flyby: boolean, chances?: Record<SecretKind, number>): void;
}

const VIEWS: [ViewName, string][] = [
  ['singer', 'Ca sĩ'], ['aerial', 'Trên không'], ['flycam', 'Flycam'], ['pit', 'Hố'], ['crane', 'Cần cẩu'], ['wide', 'Toàn cảnh'],
];
const GFX_OPTIONS: [QualityMode, string][] = [['auto', 'Tự động'], ['high', 'Cao'], ['medium', 'Vừa'], ['low', 'Thấp']];
const TIER_LABEL: Record<QualityTier, string> = { ultra: 'Rất cao', high: 'Cao', medium: 'Vừa', low: 'Thấp' };
const SECRET_LABEL: Record<string, string> = { ufo: 'UFO', rocket: 'Tên lửa', dragon: 'Rồng', jet: 'Máy bay phản lực' };
const SECRETS: [SecretKind, string][] = [['ufo', 'UFO'], ['rocket', 'Tên lửa'], ['dragon', 'Rồng'], ['jet', 'Máy bay phản lực']];

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createPauseMenu(root: HTMLElement, o: PauseMenuOptions): PauseMenu {
  const s = o.settings;
  const el = document.createElement('aside');
  el.className = 'cs-pm';
  el.hidden = true;
  el.dataset.nodrag = '';
  el.setAttribute('aria-label', 'Tạm dừng');
  const pct = (v: number) => Math.round(v * 100);
  el.innerHTML = `
    <div class="cs-pm-head">Tạm dừng <span class="cs-pm-sub">— chỉnh &amp; thử tùy ý</span></div>
    <div class="cs-pm-theme">Phong cách: <b></b> <span class="cs-pm-sub">(đổi ở sảnh)</span></div>
    <section class="cs-pm-sec cs-pm-main">
      <button type="button" class="cs-pm-btn cs-pm-primary" data-act="resume">▶ Tiếp tục</button>
      <button type="button" class="cs-pm-btn" data-act="restart">↺ Hát lại từ đầu</button>
      <button type="button" class="cs-pm-btn cs-pm-danger" data-act="end">■ Kết thúc buổi diễn</button>
      <button type="button" class="cs-pm-btn" data-act="dev">⚙ Mở bảng developer</button>
    </section>
    <section class="cs-pm-sec"><h3>Micro</h3>
      <div class="cs-pm-mic"></div>
      <label class="cs-pm-row">Bù trễ micro <input type="range" class="cs-pm-latency" min="0" max="400" step="5">
        <span class="cs-pm-val cs-pm-latency-val"></span></label>
    </section>
    <section class="cs-pm-sec"><h3>Âm thanh</h3>
      <label class="cs-pm-row">Nhạc <input type="range" data-vol="music" min="0" max="150" step="5" value="${pct(s.volume.music)}"><span class="cs-pm-val"></span></label>
      <label class="cs-pm-row">Tiếng đám đông <input type="range" data-vol="crowd" min="0" max="150" step="5" value="${pct(s.volume.crowd)}"><span class="cs-pm-val"></span></label>
      <label class="cs-pm-row">Khán giả hát theo <input type="range" data-vol="sing" min="0" max="150" step="5" value="${pct(s.volume.sing)}"><span class="cs-pm-val"></span></label>
      <div class="cs-pm-btns"><button type="button" class="cs-pm-btn" data-test="cheer">Nghe hò reo</button>
        <button type="button" class="cs-pm-btn" data-test="sing">Nghe hát theo</button></div>
    </section>
    <section class="cs-pm-sec cs-pm-gfx"><h3>Đồ hoạ</h3>
      <label class="cs-pm-row">Chất lượng đồ hoạ <select class="cs-pm-gfx-sel">${GFX_OPTIONS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
      <div class="cs-pm-note cs-pm-gfx-note"></div>
    </section>
    <section class="cs-pm-sec"><h3>Khán giả</h3>
      <label class="cs-pm-row">Hype xem trước <input type="range" class="cs-pm-hype" min="0" max="100" step="1"><span class="cs-pm-val cs-pm-hype-val"></span></label>
      <label class="cs-pm-row">Chất lượng vẽ <input type="range" class="cs-pm-quality" min="35" max="100" step="5"><span class="cs-pm-val cs-pm-quality-val"></span></label>
      <div class="cs-pm-btns">
        <button type="button" class="cs-pm-btn" data-test="cheer">Hò reo</button>
        <button type="button" class="cs-pm-btn" data-test="wave">Sóng lightstick</button>
        <button type="button" class="cs-pm-btn" data-test="heart">Thả tim</button>
        <button type="button" class="cs-pm-btn cs-pm-flash" data-test="flash">Đèn flash: tắt</button>
        <button type="button" class="cs-pm-btn" data-test="fireworks">Pháo hoa + pháo giấy</button>
      </div>
    </section>
    <section class="cs-pm-sec cs-pm-secret"><h3>Sự kiện bí mật</h3>
      <div class="cs-pm-btns">
        <span class="cs-pm-secret-btns" style="display:contents">${SECRETS.map(([k, n]) => `<button type="button" class="cs-pm-btn" data-secret="${k}">${n}</button>`).join('')}</span>
        <button type="button" class="cs-pm-btn" data-flyby>Máy bay kéo băng rôn</button>
      </div>
      <div class="cs-pm-note">Tỉ lệ xuất hiện khi Hype tối đa</div>
      <div class="cs-pm-chances">
        ${SECRETS.map(([k, n]) => `<label>${n} <input type="number" min="0" max="100" step="1" data-chance="${k}">%</label>`).join('')}
      </div>
    </section>
    <section class="cs-pm-sec cs-pm-entrance"><h3>Màn chào sân</h3>
      <div class="cs-pm-btns">
        <button type="button" class="cs-pm-btn" data-entrance="jump">Nhảy khỏi trực thăng</button>
        <button type="button" class="cs-pm-btn" data-entrance="lift">Bục nâng</button>
        <button type="button" class="cs-pm-btn" data-entrance="cable">Thả cáp</button>
      </div>
      <div class="cs-pm-note">Xem thử khi bài đang dừng; Enter để bỏ qua.</div>
    </section>
    <section class="cs-pm-sec"><h3>Góc máy &amp; điều khiển</h3>
      <div class="cs-pm-btns">${(o.views ? o.views.map((v) => [v.id, v.label] as const) : VIEWS).map(([v, n]) => `<button type="button" class="cs-pm-btn" data-view="${v}">${n}</button>`).join('')}</div>
      <button type="button" class="cs-pm-btn cs-pm-look">Chuột tự do: tắt</button>
      <div class="cs-pm-note">Di chuột để xoay, bấm M hoặc Esc để thoát. WASD để đi lại, kéo chuột để nhìn.</div>
    </section>
    <section class="cs-pm-sec"><h3>Băng rôn cổ vũ</h3>
      <textarea class="cs-pm-banners" rows="4" spellcheck="false"
        placeholder="Mỗi dòng một khẩu hiệu (tối đa ${BANNER_MAX_LINES} dòng, ${BANNER_MAX_CHARS} ký tự)"></textarea>
      <div class="cs-pm-note cs-pm-banner-note"></div>
    </section>
    <section class="cs-pm-sec cs-pm-guide"><h3>Phím điều khiển</h3>${renderControls()}</section>
    <section class="cs-pm-sec"><h3>Lời / tua</h3>
      <div class="cs-pm-row"><button type="button" class="cs-pm-btn" data-seek="-10">⏪ 10s</button>
        <span class="cs-pm-time"></span>
        <button type="button" class="cs-pm-btn" data-seek="10">10s ⏩</button></div>
      <input type="range" class="cs-pm-scrub" min="0" max="1000" step="1" value="0">
    </section>`;
  root.appendChild(el);
  const q = <T extends Element>(sel: string) => el.querySelector(sel) as T;
  const micSlot = q<HTMLDivElement>('.cs-pm-mic');
  const latency = q<HTMLInputElement>('.cs-pm-latency');
  const latencyVal = q<HTMLSpanElement>('.cs-pm-latency-val');
  const hype = q<HTMLInputElement>('.cs-pm-hype');
  const hypeVal = q<HTMLSpanElement>('.cs-pm-hype-val');
  const quality = q<HTMLInputElement>('.cs-pm-quality');
  const qualityVal = q<HTMLSpanElement>('.cs-pm-quality-val');
  const gfxSel = q<HTMLSelectElement>('.cs-pm-gfx-sel');
  const gfxNote = q<HTMLDivElement>('.cs-pm-gfx-note');
  const flashBtn = q<HTMLButtonElement>('.cs-pm-flash');
  const lookBtn = q<HTMLButtonElement>('.cs-pm-look');
  const banners = q<HTMLTextAreaElement>('.cs-pm-banners');
  const bannerNote = q<HTMLDivElement>('.cs-pm-banner-note');
  const timeEl = q<HTMLSpanElement>('.cs-pm-time');
  const scrub = q<HTMLInputElement>('.cs-pm-scrub');
  const secretSec = q<HTMLElement>('.cs-pm-secret');
  let open = false;
  let mouseLook = false;
  let scrubbing = false;
  let micHome: { parent: Node; next: Node | null } | null = null;
  let micEl: HTMLElement | null = null;

  latency.value = String(o.latencyMs);
  latencyVal.textContent = `${o.latencyMs} ms`;
  latency.addEventListener('input', () => {
    const v = Number(latency.value);
    latencyVal.textContent = `${v} ms`;
    o.onLatency(v);
  });
  el.querySelectorAll<HTMLInputElement>('[data-vol]').forEach((inp) => {
    const out = inp.nextElementSibling as HTMLElement;
    const show = () => { out.textContent = `${inp.value}%`; };
    show();
    inp.addEventListener('input', () => { show(); o.onVolume(inp.dataset.vol as VolumeKind, Number(inp.value) / 100); });
  });
  hype.addEventListener('input', () => {
    hypeVal.textContent = `${hype.value}%`;
    o.onPreviewHype(Number(hype.value) / 100);
  });
  q<HTMLElement>('.cs-pm-gfx').hidden = !o.gfx;
  const syncGfx = () => {
    if (!o.gfx) return;
    const g = o.gfx.get();
    // 'ultra' chỉ đặt được bằng ?quality=ultra: thêm lựa chọn tạm để hiện đúng.
    if (!gfxSel.querySelector(`option[value="${g.mode}"]`)) gfxSel.add(new Option(TIER_LABEL[g.mode as QualityTier] ?? g.mode, g.mode));
    gfxSel.value = g.mode;
    gfxNote.textContent = g.mode === 'auto'
      ? `Đang dùng: ${TIER_LABEL[g.tier]} — tự hạ khi máy chậm, tự nâng khi dư sức.`
      : `Cố định mức ${TIER_LABEL[g.tier]}.`;
  };
  gfxSel.addEventListener('change', () => {
    o.gfx?.set(gfxSel.value as QualityMode);
    syncGfx();
    // Mức chất lượng đổi số khán giả vẽ: cập nhật thanh "Chất lượng vẽ".
    const qv = o.getQuality();
    if (qv !== null) { quality.value = String(Math.round(qv * 100)); qualityVal.textContent = `${quality.value}%`; }
  });
  quality.addEventListener('input', () => {
    qualityVal.textContent = `${quality.value}%`;
    o.setQuality(Number(quality.value) / 100);
  });
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || !el.contains(b)) return;
    const d = b.dataset;
    if (d.act === 'resume') o.onResume();
    else if (d.act === 'restart') o.onRestart();
    else if (d.act === 'end') o.onEnd();
    else if (d.act === 'dev') o.onDevPanel?.();
    else if (d.test) o.onTest(d.test as TestKind);
    else if (d.view) o.setView(d.view as ViewName);
    else if (d.secret) o.onSecret(d.secret as SecretKind);
    else if (d.flyby !== undefined) o.onFlyby();
    else if (d.entrance) o.onEntrance?.(d.entrance as EntrancePreview);
    else if (d.seek) o.seekBy(Number(d.seek));
    else if (b === lookBtn) o.setMouseLook(!mouseLook);
  });
  el.addEventListener('change', (e) => {
    const inp = e.target as HTMLInputElement;
    if (!inp.dataset?.chance) return;
    const v = Math.max(0, Math.min(100, Math.round(Number(inp.value) || 0)));
    inp.value = String(v);
    o.onChance(inp.dataset.chance as SecretKind, v / 100);
  });
  banners.value = s.banners.join('\n');
  const showBannerNote = () => {
    const n = cleanBanners(banners.value).length;
    bannerNote.textContent = `${n}/${BANNER_MAX_LINES} khẩu hiệu — áp dụng ngay khi gõ`;
  };
  showBannerNote();
  banners.addEventListener('input', () => {
    // Giới hạn mỗi dòng 24 ký tự, tối đa 6 dòng ngay trong ô nhập.
    const lines = banners.value.split('\n');
    const capped = lines.slice(0, BANNER_MAX_LINES).map((l) => l.slice(0, BANNER_MAX_CHARS)).join('\n');
    if (capped !== banners.value) {
      const pos = banners.selectionStart;
      banners.value = capped;
      banners.selectionStart = banners.selectionEnd = Math.min(pos, capped.length);
    }
    showBannerNote();
    o.onBanners(cleanBanners(banners.value));
  });
  scrub.addEventListener('input', () => { scrubbing = true; });
  scrub.addEventListener('change', () => {
    scrubbing = false;
    const dur = o.duration();
    if (dur > 0) o.seekTo((Number(scrub.value) / 1000) * dur);
  });

  const api: PauseMenu = {
    el,
    get isOpen() { return open; },
    setThemeName(name) { (el.querySelector('.cs-pm-theme b') as HTMLElement).textContent = name; },
    open(h, micPanelEl) {
      open = true;
      el.hidden = false;
      hype.value = String(Math.round(h * 100));
      hypeVal.textContent = `${hype.value}%`;
      const qv = o.getQuality();
      quality.disabled = qv === null;
      if (qv !== null) quality.value = String(Math.round(qv * 100));
      qualityVal.textContent = qv === null ? '—' : `${quality.value}%`;
      syncGfx();
      // Mượn bảng micro (ui/micPanel.ts) vào trong menu; trả lại chỗ cũ khi đóng.
      if (micPanelEl.parentNode && micPanelEl.parentNode !== micSlot) {
        micHome = { parent: micPanelEl.parentNode, next: micPanelEl.nextSibling };
        micEl = micPanelEl;
        micSlot.appendChild(micPanelEl);
      }
      el.scrollTop = 0;
      api.update();
    },
    close() {
      if (!open) return;
      open = false;
      el.hidden = true;
      if (micEl && micHome) micHome.parent.insertBefore(micEl, micHome.next);
      micEl = null;
      micHome = null;
      const a = document.activeElement as HTMLElement | null;
      if (a && el.contains(a)) a.blur();
    },
    update() {
      if (!open) return;
      const t = o.songTime();
      const dur = o.duration();
      timeEl.textContent = `${fmt(t)} / ${fmt(dur)}`;
      if (!scrubbing && dur > 0) scrub.value = String(Math.round((t / dur) * 1000));
    },
    setViewState(v) {
      el.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    },
    setMouseLookState(on) {
      mouseLook = on;
      lookBtn.textContent = `Chuột tự do: ${on ? 'bật' : 'tắt'}`;
      lookBtn.classList.toggle('on', on);
    },
    setFlashState(on) {
      flashBtn.textContent = `Đèn flash: ${on ? 'bật' : 'tắt'}`;
      flashBtn.classList.toggle('on', on);
    },
    setSecretAvailable(secret, flyby, chances) {
      if (chances) {
        // Danh sách sự kiện theo SECRET_CHANCES của module (có 'jet' hay chưa).
        const keys = Object.keys(chances);
        q<HTMLElement>('.cs-pm-secret-btns').innerHTML = keys
          .map((k) => `<button type="button" class="cs-pm-btn" data-secret="${k}">${SECRET_LABEL[k] ?? k}</button>`).join('');
        q<HTMLElement>('.cs-pm-chances').innerHTML = keys
          .map((k) => `<label>${SECRET_LABEL[k] ?? k} <input type="number" min="0" max="100" step="1" data-chance="${k}">%</label>`).join('');
      }
      el.querySelectorAll<HTMLButtonElement>('[data-secret]').forEach((b) => { b.hidden = !secret; });
      el.querySelectorAll<HTMLInputElement>('[data-chance]').forEach((inp) => {
        (inp.parentElement as HTMLElement).hidden = !secret;
        if (chances) inp.value = String(Math.round((chances[inp.dataset.chance as SecretKind] ?? 0) * 100));
      });
      (q<HTMLElement>('.cs-pm-chances')).hidden = !secret;
      (q<HTMLElement>('.cs-pm-secret .cs-pm-note')).hidden = !secret;
      q<HTMLButtonElement>('[data-flyby]').hidden = !flyby;
      secretSec.hidden = !secret && !flyby;
    },
  };
  api.setSecretAvailable(false, false);
  return api;
}
