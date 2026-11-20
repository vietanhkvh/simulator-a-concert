/**
 * Màn nhắc lời HUD (P5): câu hiện tại tô theo âm tiết, câu kế tiếp mờ, dải cao độ và đếm ngược khi nghỉ dài.
 * DOM chỉ dựng lại khi đổi câu; mỗi frame chỉ đổi CSS variable / transform.
 */
import type { FrameState, Line, LyricLine, Note, PanelControls, Song, Teleprompter } from '../core/types';
import { createFloatWindow, type FloatLayout, type FloatWindow } from './floatWindow';
import './style.css';

const REST_COUNTDOWN_SEC = 3; // nghỉ dài hơn mức này thì hiện thanh đếm ngược
const COUNTDOWN_MAX_SEC = 6; // thanh đầy khi còn tối đa chừng này giây
const HOLD_SEC = 0.5; // giữ câu vừa hát xong thêm chút trước khi chuyển
const LANE_PRE_SEC = 0.6;
const LANE_POST_SEC = 0.3;
const MIN_RANGE = 8; // nửa cung tối thiểu của dải cao độ

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
}

const MIN_KEY = 'cs-panel-min';
const SEEK_STEP_SEC = 10;

function loadMinimized(): boolean {
  try {
    return localStorage.getItem(MIN_KEY) === '1';
  } catch {
    return false;
  }
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Thanh tiêu đề của cửa sổ nổi khung lời / video (kéo để di chuyển): tua ±10 s, giờ hiện tại / độ dài, thanh tiến độ bấm để tua,
 * nút Thu nhỏ / Mở rộng (lớp `cs-min` trên khung, nhớ trong localStorage).
 */
function attachPanelBar(fw: FloatWindow, controls: PanelControls | undefined) {
  const bar = el('div', 'cs-panel-bar');
  const mkBtn = (cls: string, text: string, title: string) => {
    const b = el('button', `cs-panel-btn ${cls}`, bar);
    b.type = 'button';
    b.textContent = text;
    b.title = title;
    return b;
  };
  const back = mkBtn('cs-seek-back', '⏪ 10s', 'Lùi 10 giây (phím [)');
  const fwd = mkBtn('cs-seek-fwd', '10s ⏩', 'Tới 10 giây (phím ])');
  const time = el('span', 'cs-panel-time', bar);
  const prog = el('div', 'cs-panel-prog', bar);
  const progFill = el('div', 'cs-panel-prog-fill', prog);
  const toggle = mkBtn('cs-panel-toggle', '', 'Thu nhỏ / mở rộng khung lời (phím T)');
  if (!controls) {
    back.hidden = fwd.hidden = true;
    prog.hidden = true;
  }
  let minimized = false;
  let lastText = '';
  let lastFrac = -1;
  const setMinimized = (on: boolean) => {
    minimized = on;
    fw.setMinimized(on);
    toggle.textContent = on ? '⤢ Mở rộng' : '⤡ Thu nhỏ';
    try {
      localStorage.setItem(MIN_KEY, on ? '1' : '0');
    } catch {
      /* không có localStorage */
    }
  };
  fw.attachBar(bar);
  setMinimized(loadMinimized());
  const click = (b: HTMLButtonElement, fn: () => void) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
      b.blur(); // không để Space/Enter bấm lại nút
    });
  click(back, () => controls?.seekBy(-SEEK_STEP_SEC));
  click(fwd, () => controls?.seekBy(SEEK_STEP_SEC));
  click(toggle, () => setMinimized(!minimized));
  prog.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!controls) return;
    const r = prog.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
    controls.seekTo(frac * controls.duration());
  });
  return {
    update(t: number) {
      const d = controls?.duration() ?? 0;
      const text = d > 0 ? `${fmtTime(t)} / ${fmtTime(d)}` : fmtTime(t);
      if (text !== lastText) {
        lastText = text;
        time.textContent = text;
      }
      const frac = d > 0 ? Math.max(0, Math.min(1, t / d)) : 0;
      if (Math.abs(frac - lastFrac) > 0.001) {
        lastFrac = frac;
        progFill.style.transform = `scaleX(${frac.toFixed(4)})`;
      }
    },
    setMinimized,
    get minimized() {
      return minimized;
    },
  };
}

const vw = () => window.innerWidth;
const vh = () => window.innerHeight;
/** Bề rộng tự nhiên của bố cục lời (như trước: min(1080px, 92vw)). */
const tpBaseWidth = () => Math.min(1080, 0.92 * vw());

/** Cửa sổ nổi cho khung lời: nội dung `.cs-tp` giữ bề rộng tự nhiên, cửa sổ chỉ cắt. */
function createTpWindow(root: HTMLElement, extraCls: string): { fw: FloatWindow; wrap: HTMLElement } {
  const fw = createFloatWindow(root, {
    storageKey: 'cs-fw-lyrics',
    className: 'cs-fw-tp',
    baseWidth: tpBaseWidth,
    defaultLayout(contentH, barH): FloatLayout {
      const w = tpBaseWidth();
      const h = Math.max(60, barH + contentH);
      return { x: (vw() - w) / 2, y: vh() - h - 0.035 * vh(), w, h, px: 0, py: 0, z: 1 };
    },
    minimizedLayout(contentH, barH): FloatLayout {
      const w = Math.min(640, 0.8 * vw());
      const h = barH + contentH;
      return { x: (vw() - w) / 2, y: vh() - h - 0.015 * vh(), w, h, px: 0, py: 0, z: 1 };
    },
  });
  const wrap = fw.content;
  wrap.classList.add('cs-tp');
  if (extraCls) wrap.classList.add(extraCls);
  return { fw, wrap };
}

interface NoteView {
  note: Note;
  fill: HTMLElement | null;
  prog: number;
}
interface SylView {
  note: Note;
  span: HTMLElement;
  prog: number;
}

export function createTeleprompter(root: HTMLElement, song: Song, controls?: PanelControls): Teleprompter {
  if (song.lyrics) return createLrcTeleprompter(root, song.lyrics, controls);
  if (song.lines.length === 0) {
    // Hát tự do: không có lời, chỉ có thanh tua.
    const { fw } = createTpWindow(root, 'cs-tp-free');
    const bar = attachPanelBar(fw, controls);
    return {
      update: (f: FrameState) => bar.update(f.songTime),
      setVisible(v) {
        fw.el.style.display = v ? '' : 'none';
      },
      setMinimized: bar.setMinimized,
      get minimized() {
        return bar.minimized;
      },
      dispose: () => fw.dispose(),
    };
  }
  const { fw, wrap } = createTpWindow(root, '');
  const bar = attachPanelBar(fw, controls);

  const countdown = el('div', 'cs-tp-count', wrap);
  const countFill = el('div', 'cs-tp-count-fill', countdown);

  const lane = el('div', 'cs-tp-lane', wrap);
  const laneNotes = el('div', 'cs-tp-lane-notes', lane);
  const playhead = el('div', 'cs-tp-playhead', lane);
  const marker = el('div', 'cs-tp-marker', lane);

  const curEl = el('div', 'cs-tp-cur', wrap);
  const nextEl = el('div', 'cs-tp-next', wrap);

  let shown = -2;
  let sylViews: SylView[] = [];
  let noteViews: NoteView[] = [];
  let laneT0 = 0;
  let laneT1 = 1;
  let laneMin = 0;
  let laneMax = 1;
  let restFrom = 0;
  let markerY = 0.5;
  let countVisible = false;
  let markerVisible = false;
  let lastScale = -1;

  function renderText(target: HTMLElement, line: Line | undefined, withSyl: boolean): void {
    target.textContent = '';
    if (withSyl) sylViews = [];
    if (!line) return;
    const n = line.notes.length;
    line.notes.forEach((note, i) => {
      let text = note.text;
      if (i === 0) text = text.replace(/^\s+/, '');
      if (i === n - 1) text = text.replace(/\s+$/, '');
      const span = el('span', withSyl ? 'cs-syl' : 'cs-syl-plain', target);
      span.textContent = text;
      if (withSyl) {
        if (note.type === 'golden') span.classList.add('golden');
        sylViews.push({ note, span, prog: 0 });
      }
    });
  }

  function buildLane(line: Line | undefined): void {
    laneNotes.textContent = '';
    noteViews = [];
    if (!line) return;
    laneT0 = line.startSec - LANE_PRE_SEC;
    laneT1 = line.endSec + LANE_POST_SEC;
    let lo = Infinity;
    let hi = -Infinity;
    for (const nt of line.notes) {
      if (nt.type === 'freestyle') continue;
      lo = Math.min(lo, nt.pitch);
      hi = Math.max(hi, nt.pitch);
    }
    if (!isFinite(lo)) {
      lo = 0;
      hi = 0;
    }
    const mid = (lo + hi) / 2;
    const half = Math.max(MIN_RANGE, hi - lo + 4) / 2;
    laneMin = mid - half;
    laneMax = mid + half;
    const span = laneT1 - laneT0;
    for (const nt of line.notes) {
      const bar = el('div', 'cs-tp-note', laneNotes);
      if (nt.type === 'golden') bar.classList.add('golden');
      const p = nt.type === 'freestyle' ? mid : nt.pitch;
      if (nt.type === 'freestyle') {
        bar.classList.add('freestyle');
        bar.style.top = '15%';
        bar.style.height = '70%';
      } else {
        bar.style.top = `${(1 - (p - laneMin) / (laneMax - laneMin)) * 100 - 6}%`;
      }
      bar.style.left = `${((nt.startSec - laneT0) / span) * 100}%`;
      bar.style.width = `${((nt.endSec - nt.startSec) / span) * 100}%`;
      const fill = el('div', 'cs-tp-note-fill', bar);
      noteViews.push({ note: nt, fill, prog: 0 });
    }
  }

  /** Câu hiển thị: câu đầu tiên chưa kết thúc (kèm thời gian giữ). */
  function pickLine(t: number): number {
    const L = song.lines;
    for (let i = 0; i < L.length; i++) if (t < L[i].endSec + HOLD_SEC) return i;
    return L.length - 1;
  }

  function setLine(i: number): void {
    shown = i;
    const line = song.lines[i];
    renderText(curEl, line, true);
    renderText(nextEl, song.lines[i + 1], false);
    buildLane(line);
    restFrom = i > 0 ? song.lines[i - 1].endSec : Math.min(0, line ? line.startSec - COUNTDOWN_MAX_SEC : 0);
    lastScale = -1;
  }

  function setProg(v: { prog: number }, target: HTMLElement, p: number): void {
    if (Math.abs(p - v.prog) < 0.004 && p !== 0 && p !== 1) return;
    if (p === v.prog) return;
    v.prog = p;
    target.style.setProperty('--p', `${(p * 100).toFixed(1)}%`);
  }

  return {
    update(f: FrameState) {
      const t = f.songTime;
      bar.update(t);
      if (song.lines.length === 0) return;
      const idx = pickLine(t);
      if (idx !== shown) setLine(idx);
      const line = song.lines[idx];

      // Tô âm tiết.
      for (const s of sylViews) {
        const d = s.note.endSec - s.note.startSec;
        const p = t <= s.note.startSec ? 0 : t >= s.note.endSec ? 1 : (t - s.note.startSec) / (d || 1);
        setProg(s, s.span, p);
      }

      // Dải cao độ.
      const span = laneT1 - laneT0;
      for (const nv of noteViews) {
        const d = nv.note.endSec - nv.note.startSec;
        const p = t <= nv.note.startSec ? 0 : t >= nv.note.endSec ? 1 : (t - nv.note.startSec) / (d || 1);
        if (nv.fill && p !== nv.prog) {
          nv.prog = p;
          nv.fill.style.transform = `scaleX(${p.toFixed(3)})`;
        }
      }
      const px = Math.max(0, Math.min(1, (t - laneT0) / span));
      playhead.style.transform = `translateX(${(px * lane.clientWidth).toFixed(1)}px)`;

      // Dấu cao độ người chơi, gập về quãng tám gần nốt mục tiêu.
      let target: Note | null = f.activeNote && f.activeNote.type !== 'freestyle' ? f.activeNote : null;
      if (!target && line) {
        for (const nt of line.notes) {
          if (nt.type === 'freestyle') continue;
          target = nt;
          if (nt.endSec > t) break;
        }
      }
      const showMarker = !!(f.pitch && target && t >= laneT0 && t <= laneT1);
      if (showMarker !== markerVisible) {
        markerVisible = showMarker;
        marker.style.opacity = showMarker ? '1' : '0';
      }
      if (showMarker && f.pitch && target) {
        const tm = target.pitch + 60;
        const folded = f.pitch.midi - 12 * Math.round((f.pitch.midi - tm) / 12);
        let y = 1 - (folded - 60 - laneMin) / (laneMax - laneMin);
        y = Math.max(0, Math.min(1, y));
        markerY += (y - markerY) * Math.min(1, f.dt * 18);
        marker.style.transform = `translate(${(px * lane.clientWidth).toFixed(1)}px, ${(markerY * lane.clientHeight).toFixed(1)}px)`;
      }

      // Đếm ngược khi nghỉ dài.
      const restLen = line.startSec - restFrom;
      const wait = line.startSec - t;
      const showCount = t < line.startSec && restLen > REST_COUNTDOWN_SEC && wait > 0;
      if (showCount !== countVisible) {
        countVisible = showCount;
        countdown.style.opacity = showCount ? '1' : '0';
      }
      if (showCount) {
        const sc = Math.max(0, Math.min(1, wait / Math.min(restLen, COUNTDOWN_MAX_SEC)));
        if (Math.abs(sc - lastScale) > 0.002) {
          lastScale = sc;
          countFill.style.transform = `scaleX(${sc.toFixed(3)})`;
        }
      }
    },
    setVisible(v) {
      fw.el.style.display = v ? '' : 'none';
    },
    setMinimized: bar.setMinimized,
    get minimized() {
      return bar.minimized;
    },
    dispose: () => fw.dispose(),
  };
}

/**
 * Nhắc lời theo câu (.lrc): câu hiện tại tô dần từ mốc của nó tới mốc câu kế tiếp, câu kế tiếp mờ.
 * Không có dải cao độ.
 */
export function createLrcTeleprompter(root: HTMLElement, lyrics: LyricLine[], controls?: PanelControls): Teleprompter {
  const { fw, wrap } = createTpWindow(root, 'cs-tp-lrc');
  const bar = attachPanelBar(fw, controls);
  const countdown = el('div', 'cs-tp-count', wrap);
  const countFill = el('div', 'cs-tp-count-fill', countdown);
  const curEl = el('div', 'cs-tp-cur', wrap);
  const cur = el('span', 'cs-syl', curEl);
  const nextEl = el('div', 'cs-tp-next', wrap);
  let shown = -2;
  let lastP = -1;
  let countVisible = false;

  /** Câu hiển thị: câu cuối cùng đã bắt đầu; trước câu đầu thì -1 (chỉ hiện câu sắp tới). */
  function pick(t: number): number {
    let i = -1;
    while (i + 1 < lyrics.length && lyrics[i + 1].startSec <= t) i++;
    return i;
  }

  return {
    update(f: FrameState) {
      const t = f.songTime;
      bar.update(t);
      const idx = pick(t);
      const line = idx >= 0 ? lyrics[idx] : undefined;
      const active = !!line && t < line.endSec;
      const curIdx = active ? idx : -1;
      if (curIdx !== shown) {
        shown = curIdx;
        cur.textContent = active && line ? line.text : '';
        nextEl.textContent = lyrics[idx + 1]?.text ?? '';
        lastP = -1;
      }
      if (active && line) {
        const p = Math.max(0, Math.min(1, (t - line.startSec) / Math.max(0.05, line.endSec - line.startSec)));
        if (Math.abs(p - lastP) > 0.003) {
          lastP = p;
          cur.style.setProperty('--p', `${(p * 100).toFixed(1)}%`);
        }
      }
      // Đếm ngược khi sắp tới câu kế tiếp sau một quãng nghỉ.
      const next = lyrics[idx + 1];
      const wait = next ? next.startSec - t : Infinity;
      const showCount = !active && wait > 0 && wait < 6;
      if (showCount !== countVisible) {
        countVisible = showCount;
        countdown.style.opacity = showCount ? '1' : '0';
      }
      if (showCount) countFill.style.transform = `scaleX(${Math.min(1, wait / 6).toFixed(3)})`;
    },
    setVisible(v) {
      fw.el.style.display = v ? '' : 'none';
    },
    setMinimized: bar.setMinimized,
    get minimized() {
      return bar.minimized;
    },
    dispose: () => fw.dispose(),
  };
}

/**
 * Khung video karaoke (cửa sổ nổi, mặc định giữa-dưới) để người chơi đọc lời in sẵn trong video.
 * Video giữ cỡ tự nhiên 720 px × tỉ lệ; cửa sổ chỉ cắt, nút −/+ đổi tỉ lệ.
 * Phần tử video do main.ts tạo; khung chỉ gắn vào DOM, không điều khiển phát.
 */
export function createVideoPanel(root: HTMLElement, video: HTMLVideoElement, controls?: PanelControls): Teleprompter {
  const BASE_W = 720; // bề rộng "đầy đủ" của video (px, tỉ lệ 100%)
  const fw = createFloatWindow(root, {
    storageKey: 'cs-fw-video',
    className: 'cs-video-panel',
    baseWidth: () => BASE_W,
    defaultLayout(contentH, barH): FloatLayout {
      const ch = contentH || BASE_W * (9 / 16);
      // Như trước: rộng tối đa 60vw, video cao tối đa 42vh — thu tỉ lệ cho vừa nhưng vẫn thấy cả video.
      const z = Math.max(0.5, Math.min(1, (0.6 * vw()) / BASE_W, (0.42 * vh()) / ch));
      const w = BASE_W * z;
      const h = barH + ch * z;
      return { x: (vw() - w) / 2, y: vh() - h - 0.025 * vh(), w, h, px: 0, py: 0, z };
    },
    minimizedLayout(contentH, barH): FloatLayout {
      const w = 220;
      const z = w / BASE_W;
      const h = barH + (contentH || BASE_W * (9 / 16)) * z;
      return { x: vw() - w - 16, y: vh() - h - 16, w, h, px: 0, py: 0, z };
    },
  });
  const bar = attachPanelBar(fw, controls);
  video.classList.add('cs-video');
  fw.content.appendChild(video);
  return {
    update: (f: FrameState) => bar.update(f.songTime),
    setMinimized: bar.setMinimized,
    get minimized() {
      return bar.minimized;
    },
    setVisible(v) {
      fw.el.style.display = v ? '' : 'none';
    },
    dispose: () => {
      if (video.parentElement === fw.content) fw.content.removeChild(video);
      fw.dispose();
    },
  };
}
