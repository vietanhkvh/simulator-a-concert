/**
 * Bảng micro (góc trên phải, ở màn hình bắt đầu / kết quả): chọn thiết bị, "Thử micro" với vạch mức
 * tín hiệu + nốt đang hát, độ nhạy (gain phần mềm) và một dòng trạng thái. Mục đích chính là để người
 * chơi tự chẩn đoán được (ví dụ: nghe bằng tai nghe nhưng thu bằng micro của máy).
 *
 * Không xin quyền bằng getUserMedia({audio:true}) (sẽ mở micro mặc định — thường là tai nghe Bluetooth,
 * làm tai nghe tụt chất lượng): quyền được xin bằng chính thiết bị đang chọn khi bấm "Thử micro".
 */
import type { MicInput, MicStatus } from '../core/types';
import { createMic } from '../mic/input';
import { clampSensitivity, DEFAULT_SENSITIVITY, MAX_SENSITIVITY, MIN_SENSITIVITY } from '../mic/pitch';

const KEY_ID = 'cs-mic-device';
const KEY_LABEL = 'cs-mic-label';
const KEY_GAIN = 'cs-mic-gain';
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function load(k: string): string {
  try { return localStorage.getItem(k) ?? ''; } catch { return ''; }
}
function save(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* không có localStorage */ }
}

export function noteName(midi: number): string {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** RMS → 0..1 theo dB (−60 dBFS … 0 dBFS). */
export function levelToMeter(rmsLevel: number): number {
  if (!(rmsLevel > 0)) return 0;
  return Math.max(0, Math.min(1, (20 * Math.log10(rmsLevel) + 60) / 60));
}

export interface MicSelection {
  deviceId?: string;
  deviceLabel?: string;
  gain: number;
}

export interface MicPanel {
  readonly el: HTMLElement;
  setVisible(v: boolean): void;
  /** Đóng luồng thử micro (gọi trước khi vào game). */
  stopTest(): void;
  selection(): MicSelection;
  /** Hiện trạng thái micro của lượt chơi vừa rồi. */
  showStatus(s: MicStatus | null): void;
}

export function createMicPanel(root: HTMLElement): MicPanel {
  const el = document.createElement('div');
  el.className = 'cs-mic-panel';
  el.innerHTML = `
    <label class="cs-mic-row">Micro <select id="cs-mic-select"></select></label>
    <div class="cs-mic-row">
      <button type="button" class="cs-mic-test">Thử micro</button>
      <div class="cs-mic-meter" title="Mức tín hiệu vào"><div class="cs-mic-meter-fill"></div></div>
      <span class="cs-mic-note"></span>
    </div>
    <label class="cs-mic-row">Độ nhạy
      <input type="range" class="cs-mic-gain" min="${MIN_SENSITIVITY}" max="${MAX_SENSITIVITY}" step="0.25">
      <span class="cs-mic-gain-val"></span></label>
    <div class="cs-mic-status"></div>`;
  root.appendChild(el);
  const select = el.querySelector('select') as HTMLSelectElement;
  const testBtn = el.querySelector('.cs-mic-test') as HTMLButtonElement;
  const fill = el.querySelector('.cs-mic-meter-fill') as HTMLDivElement;
  const noteEl = el.querySelector('.cs-mic-note') as HTMLSpanElement;
  const slider = el.querySelector('.cs-mic-gain') as HTMLInputElement;
  const gainVal = el.querySelector('.cs-mic-gain-val') as HTMLSpanElement;
  const statusEl = el.querySelector('.cs-mic-status') as HTMLDivElement;

  let gain = clampSensitivity(load(KEY_GAIN) || DEFAULT_SENSITIVITY);
  slider.value = String(gain);
  gainVal.textContent = `${gain}×`;

  let testMic: MicInput | null = null;
  let testCtx: AudioContext | null = null;
  let raf = 0;
  let testSeq = 0;

  function setStatusText(text: string, bad = false): void {
    statusEl.textContent = text;
    statusEl.title = text;
    statusEl.classList.toggle('bad', bad);
  }

  async function refresh(): Promise<void> {
    const savedId = load(KEY_ID);
    const savedLabel = load(KEY_LABEL);
    const current = select.value || savedId;
    let devs: MediaDeviceInfo[] = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'); } catch { /* không hỗ trợ */ }
    const def = devs.find((d) => d.deviceId === 'default');
    const inputs = devs.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
    const hasLabels = devs.some((d) => d.label);
    select.replaceChildren(new Option(
      `Mặc định của hệ thống${def?.label ? ` (${def.label.replace(/^(Default|Mặc định)\s*-\s*/i, '')})` : ''}`, ''));
    inputs.forEach((d, i) => select.add(new Option(d.label || `Micro ${i + 1}`, d.deviceId)));
    let pick = '';
    if (current && inputs.some((d) => d.deviceId === current)) {
      pick = current;
    } else if (savedLabel && hasLabels) {
      // id đổi (Safari/Firefox, sau khi cấp quyền): tìm lại theo tên.
      const byLabel = inputs.find((d) => d.label === savedLabel);
      if (byLabel) {
        pick = byLabel.deviceId;
        save(KEY_ID, pick);
      }
    }
    if (!pick && current && !hasLabels) {
      // Chưa có quyền nên chưa liệt kê được: giữ lựa chọn cũ thay vì âm thầm về mặc định.
      select.add(new Option(savedLabel || 'Micro đã chọn trước đây', current));
      pick = current;
    }
    select.value = pick;
    if (!hasLabels && !testMic && !statusEl.classList.contains('bad')) {
      setStatusText('Bấm “Thử micro” để cho phép và hiện tên các micro');
    } else if (current && !pick && savedLabel) {
      setStatusText(`Không thấy “${savedLabel}” — sẽ dùng micro mặc định`, true);
    }
  }

  function stopTest(): void {
    testSeq++;
    cancelAnimationFrame(raf);
    testMic?.stop();
    testMic = null;
    if (testCtx) void testCtx.close().catch(() => {});
    testCtx = null;
    testBtn.textContent = 'Thử micro';
    el.classList.remove('testing');
    fill.style.transform = 'scaleX(0)';
    noteEl.textContent = '';
  }

  async function startTest(): Promise<void> {
    stopTest();
    const seq = ++testSeq;
    testBtn.textContent = 'Dừng thử';
    el.classList.add('testing');
    setStatusText('Đang mở micro…');
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      setStatusText('Trình duyệt không hỗ trợ Web Audio', true);
      stopTest();
      return;
    }
    testCtx = ctx;
    void ctx.resume().catch(() => {});
    const sel = selection();
    const mic = createMic({
      mode: 'real', targetHz: () => null, voiceProcessing: false, ...sel,
      onStatus: (s) => { if (seq === testSeq) setStatusText(s.message, !s.ok || !!s.fellBack); },
    });
    testMic = mic;
    const mode = await mic.start(ctx);
    if (seq !== testSeq) { mic.stop(); return; }
    if (mode !== 'real') {
      const msg = mic.status?.message ?? 'Không mở được micro';
      stopTest();
      setStatusText(msg, true);
      return;
    }
    await refresh(); // sau khi có quyền mới có tên/id thật
    // Thiết bị thật sự mở được → chọn đúng nó trong danh sách (nếu đã chọn cụ thể).
    const st = mic.status;
    if (st && sel.deviceId && st.deviceId && [...select.options].some((o) => o.value === st.deviceId)) {
      select.value = st.deviceId;
    }
    let lastNote = 0;
    const loop = (): void => {
      if (seq !== testSeq) return;
      const p = mic.read();
      fill.style.transform = `scaleX(${levelToMeter(mic.level?.() ?? 0).toFixed(3)})`;
      const now = performance.now();
      if (p) {
        noteEl.textContent = `${noteName(p.midi)} · ${Math.round(p.hz)} Hz`;
        noteEl.classList.add('on');
        lastNote = now;
      } else if (now - lastNote > 400) {
        noteEl.classList.remove('on');
        if (now - lastNote > 2000) noteEl.textContent = 'hãy hát…';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function selection(): MicSelection {
    const id = select.value;
    const opt = select.selectedOptions[0];
    const label = id ? (load(KEY_LABEL) || opt?.text || '') : '';
    return { deviceId: id || undefined, deviceLabel: label || undefined, gain };
  }

  select.addEventListener('change', () => {
    const opt = select.selectedOptions[0];
    save(KEY_ID, select.value);
    save(KEY_LABEL, select.value && opt && !/^Micro( \d+| đã chọn)/.test(opt.text) ? opt.text : '');
    statusEl.classList.remove('bad');
    if (testMic) void startTest();
    else setStatusText(select.value ? `Đã chọn: ${opt?.text ?? ''} — bấm “Thử micro” để kiểm tra` : 'Dùng micro mặc định của hệ thống');
  });
  testBtn.addEventListener('click', () => { if (testMic) stopTest(); else void startTest(); });
  slider.addEventListener('input', () => {
    gain = clampSensitivity(slider.value);
    gainVal.textContent = `${gain}×`;
    save(KEY_GAIN, String(gain));
    testMic?.setGain?.(gain);
  });
  navigator.mediaDevices?.addEventListener?.('devicechange', () => void refresh());
  void refresh();

  return {
    el,
    setVisible(v) {
      if (el.hidden === !v) return;
      el.hidden = !v;
      if (!v) stopTest();
    },
    stopTest,
    selection,
    showStatus(s) {
      if (s) setStatusText(s.message, !s.ok || !!s.fellBack);
    },
  };
}

/**
 * Vạch mức tín hiệu nhỏ cạnh huy hiệu micro của HUD + tooltip tên thiết bị. Gọi update() mỗi frame.
 */
export function createHudMicMeter(root: HTMLElement): { update(mic: MicInput | null): void } {
  let bar: HTMLDivElement | null = null;
  let fillEl: HTMLDivElement | null = null;
  let lastTitle = '';
  let lastW = -1;
  return {
    update(mic) {
      const badge = root.querySelector('.cs-hud-mic') as HTMLElement | null;
      if (!badge) return;
      if (!bar || bar.parentElement !== badge) {
        bar = document.createElement('div');
        bar.className = 'cs-hud-mic-level';
        fillEl = document.createElement('div');
        bar.appendChild(fillEl);
        badge.appendChild(bar);
      }
      const real = mic?.mode === 'real';
      bar.hidden = !real;
      const st = mic?.status ?? null;
      const title = st ? st.message : '';
      if (title !== lastTitle) {
        lastTitle = title;
        badge.title = title;
        const text = badge.querySelector('span');
        if (text && st && real) text.textContent = !st.ok ? 'Micro mất tín hiệu' : st.fellBack ? 'Micro mặc định (!)' : 'Micro thật';
      }
      if (real && fillEl) {
        const w = Math.round(levelToMeter(mic?.level?.() ?? 0) * 100) / 100;
        if (w !== lastW) {
          lastW = w;
          fillEl.style.transform = `scaleX(${w})`;
        }
      }
    },
  };
}
