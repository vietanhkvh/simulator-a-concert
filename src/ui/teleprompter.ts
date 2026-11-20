/**
 * Màn nhắc lời HUD (P5): câu hiện tại tô theo âm tiết, câu kế tiếp mờ, dải cao độ và đếm ngược khi nghỉ dài.
 * DOM chỉ dựng lại khi đổi câu; mỗi frame chỉ đổi CSS variable / transform.
 */
import type { FrameState, Line, LyricLine, Note, Song, Teleprompter } from '../core/types';
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

export function createTeleprompter(root: HTMLElement, song: Song): Teleprompter {
  if (song.lyrics) return createLrcTeleprompter(root, song.lyrics);
  if (song.lines.length === 0) {
    // Hát tự do: không có lời.
    return { update() {}, setVisible() {}, dispose() {} };
  }
  const wrap = el('div', 'cs-tp');
  root.appendChild(wrap);

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
      wrap.style.display = v ? '' : 'none';
    },
    dispose: () => wrap.remove(),
  };
}

/**
 * Nhắc lời theo câu (.lrc): câu hiện tại tô dần từ mốc của nó tới mốc câu kế tiếp, câu kế tiếp mờ.
 * Không có dải cao độ.
 */
export function createLrcTeleprompter(root: HTMLElement, lyrics: LyricLine[]): Teleprompter {
  const wrap = el('div', 'cs-tp cs-tp-lrc');
  root.appendChild(wrap);
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
      wrap.style.display = v ? '' : 'none';
    },
    dispose: () => wrap.remove(),
  };
}

/**
 * Khung video karaoke ở giữa-dưới (chỗ teleprompter) để người chơi đọc lời in sẵn trong video.
 * Phần tử video do main.ts tạo; khung chỉ gắn vào DOM, không điều khiển phát.
 */
export function createVideoPanel(root: HTMLElement, video: HTMLVideoElement): Teleprompter {
  const wrap = el('div', 'cs-video-panel');
  video.classList.add('cs-video');
  wrap.appendChild(video);
  root.appendChild(wrap);
  return {
    update() {},
    setVisible(v) {
      wrap.style.display = v ? '' : 'none';
    },
    dispose: () => {
      if (video.parentElement === wrap) wrap.removeChild(video);
      wrap.remove();
    },
  };
}
