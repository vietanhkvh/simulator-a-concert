/**
 * P2 — Micro: getUserMedia → GainNode (độ nhạy phần mềm) → AnalyserNode → pitchy.
 * Micro giả (perfect/off/octave): OscillatorNode theo targetHz() → cùng AnalyserNode → cùng đường nhận diện.
 * Không nối gì ra ctx.destination (tránh hú, micro giả cũng im lặng).
 * Nếu AudioContext chưa chạy (bị treo) thì micro giả tổng hợp mẫu trực tiếp từ targetHz() để vẫn xác định được.
 *
 * Micro thật — các điểm dễ hỏng trên máy người chơi:
 * - deviceId đã lưu có thể không còn đúng (Safari/Firefox đổi id mỗi phiên hoặc sau khi cấp quyền) →
 *   `exact` ném OverconstrainedError. Khi đó tìm lại theo tên, rồi mới dùng micro mặc định và BÁO RA.
 * - Không xin quyền bằng getUserMedia({audio:true}) trước: việc đó mở micro mặc định (thường là tai nghe
 *   Bluetooth → tai nghe tụt xuống chất lượng đàm thoại). Mở thẳng thiết bị đã chọn.
 * - Firefox ném lỗi khi nối MediaStreamSource vào AudioContext có sample rate khác thiết bị (tai nghe
 *   Bluetooth ép 16 kHz) → phân tích trong một AudioContext riêng cho micro.
 */
import { hzToMidi } from '../core/time';
import type { MicInput, MicMode, MicOptions, MicStatus, PitchSample } from '../core/types';
import { clampSensitivity, createDetector, createMedianFilter, fakeHz, FFT_SIZE } from './pitch';

type FakeMode = Exclude<MicMode, 'real'>;

/** Lỗi "không có thiết bị với id này" (id cũ / thiết bị đã rút). */
export function isMissingDeviceError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? '';
  return name === 'OverconstrainedError' || name === 'NotFoundError' || name === 'ConstraintNotSatisfiedError'
    || name === 'DevicesNotFoundError';
}

/** Lý do không mở được micro, bằng tiếng Việt. */
export function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Trình duyệt chặn quyền micro (bấm biểu tượng ổ khóa cạnh địa chỉ để cho phép)';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'Không tìm thấy micro';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'Micro đang bị ứng dụng khác chiếm hoặc hệ điều hành chặn';
    case 'NoGetUserMedia':
      return 'Trình duyệt không hỗ trợ micro (cần HTTPS hoặc localhost)';
    case 'ConnectError':
      return 'Không nối được micro vào bộ phân tích âm thanh';
    default:
      return `Không mở được micro${err instanceof Error && err.message ? `: ${err.message}` : ''}`;
  }
}

/** Bỏ tiền tố "Default - " / "Mặc định - " của Chrome/Edge để so tên thiết bị. */
export function normLabel(l: string): string {
  return l.replace(/^(default|communications|mặc định|liên lạc)\s*[-–:]\s*/i, '').trim().toLowerCase();
}

async function findDeviceByLabel(label: string): Promise<string | null> {
  try {
    const want = normLabel(label);
    if (!want) return null;
    const devs = await navigator.mediaDevices.enumerateDevices();
    const hit = devs.find((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default'
      && d.deviceId !== 'communications' && normLabel(d.label) === want);
    return hit?.deviceId ?? null;
  } catch {
    return null;
  }
}

function namedError(name: string): Error {
  const e = new Error(name);
  e.name = name;
  return e;
}

export function createMic(opts: MicOptions): MicInput {
  let mode: MicMode = opts.mode;
  let ctx: AudioContext | null = null;
  /** Context dùng để phân tích (ctx của game hoặc context riêng cho micro). */
  let actx: AudioContext | null = null;
  let ownCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;
  let source: AudioNode | null = null;
  let gainNode: GainNode | null = null;
  /** Gain 0 → destination: giữ cho đồ thị micro luôn được "kéo" (Safari/WebKit trả toàn 0 nếu nhánh không tới destination). */
  let sink: GainNode | null = null;
  let silentSince = 0;
  let silentReported = false;
  let osc: OscillatorNode | null = null;
  let oscGain: GainNode | null = null;
  let stopped = false;
  let gain = clampSensitivity(opts.gain ?? 2);
  let status: MicStatus | null = null;
  let reopenTries = 0;
  const buf = new Float32Array(FFT_SIZE);
  const detector = createDetector(FFT_SIZE);
  const median = createMedianFilter(3);

  function setStatus(s: MicStatus): void {
    status = s;
    try { opts.onStatus?.(s); } catch { /* UI lỗi không làm hỏng micro */ }
  }

  function makeAnalyser(c: AudioContext): AnalyserNode {
    const a = c.createAnalyser();
    a.fftSize = FFT_SIZE;
    a.smoothingTimeConstant = 0;
    return a;
  }

  function startFake(c: AudioContext, m: FakeMode): void {
    mode = m;
    try {
      actx = c;
      analyser = makeAnalyser(c);
      osc = c.createOscillator();
      osc.type = 'sine';
      oscGain = c.createGain();
      oscGain.gain.value = 0;
      osc.connect(oscGain).connect(analyser);
      osc.start();
    } catch {
      teardownNodes(); // read() sẽ tổng hợp trực tiếp
    }
  }

  function teardownNodes(): void {
    try { osc?.stop(); } catch { /* đã dừng */ }
    try { osc?.disconnect(); oscGain?.disconnect(); source?.disconnect(); gainNode?.disconnect(); sink?.disconnect(); } catch { /* bỏ qua */ }
    stream?.getTracks().forEach((t) => { t.onended = null; t.onmute = null; t.onunmute = null; t.stop(); });
    if (ownCtx) void ownCtx.close().catch(() => {});
    osc = oscGain = null;
    source = null;
    gainNode = null;
    sink = null;
    silentSince = 0;
    silentReported = false;
    stream = null;
    analyser = null;
    ownCtx = null;
    actx = null;
  }

  function constraints(deviceId?: string): MediaStreamConstraints {
    return {
      audio: {
        echoCancellation: !!opts.voiceProcessing,
        noiseSuppression: !!opts.voiceProcessing,
        // Tự chỉnh âm lượng (nhiều trình duyệt bỏ qua) — có thêm gain phần mềm phía sau.
        autoGainControl: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
      video: false,
    };
  }

  /** Mở đúng thiết bị đã chọn; id cũ → tìm theo tên → mặc định (fellBack). */
  async function openStream(): Promise<{ s: MediaStream; fellBack: boolean }> {
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) throw namedError('NoGetUserMedia');
    const want = opts.deviceId;
    if (!want) return { s: await md.getUserMedia(constraints()), fellBack: false };
    try {
      return { s: await md.getUserMedia(constraints(want)), fellBack: false };
    } catch (err) {
      if (!isMissingDeviceError(err)) throw err;
      console.warn('[mic] không mở được deviceId đã chọn, tìm theo tên:', err);
    }
    if (opts.deviceLabel) {
      const id = await findDeviceByLabel(opts.deviceLabel);
      if (id && id !== want) {
        try { return { s: await md.getUserMedia(constraints(id)), fellBack: false }; } catch (err) {
          if (!isMissingDeviceError(err)) throw err;
        }
      }
    }
    // Chưa có quyền thì enumerateDevices không có tên/id: mở mặc định (xin quyền) rồi tìm lại theo tên.
    const s = await md.getUserMedia(constraints());
    if (opts.deviceLabel) {
      const id = await findDeviceByLabel(opts.deviceLabel);
      const cur = s.getAudioTracks()[0]?.getSettings().deviceId;
      if (id && id !== cur) {
        try {
          const s2 = await md.getUserMedia(constraints(id));
          s.getTracks().forEach((t) => t.stop());
          return { s: s2, fellBack: false };
        } catch { /* giữ micro mặc định */ }
      }
    }
    return { s, fellBack: true };
  }

  function connectGraph(c: AudioContext, s: MediaStream): void {
    const src = c.createMediaStreamSource(s); // Firefox: ném lỗi nếu sample rate khác thiết bị
    const g = c.createGain();
    g.gain.value = gain;
    const a = makeAnalyser(c);
    src.connect(g);
    g.connect(a);
    // Không nghe thấy gì (gain 0) nhưng giữ nhánh phân tích được xử lý ở mọi trình duyệt.
    const z = c.createGain();
    z.gain.value = 0;
    a.connect(z);
    z.connect(c.destination);
    sink = z;
    source = src;
    gainNode = g;
    analyser = a;
    actx = c;
  }

  function attach(c: AudioContext, s: MediaStream): boolean {
    try {
      connectGraph(c, s);
      return false;
    } catch (err) {
      console.warn('[mic] không nối micro vào AudioContext của game (lệch sample rate?), dùng context riêng:', err);
      try { source?.disconnect(); gainNode?.disconnect(); } catch { /* bỏ qua */ }
    }
    const rate = s.getAudioTracks()[0]?.getSettings().sampleRate;
    const tries: (AudioContextOptions | undefined)[] = rate ? [{ sampleRate: rate }, undefined] : [undefined];
    let last: unknown = null;
    for (const o of tries) {
      let own: AudioContext | null = null;
      try {
        own = new AudioContext(o);
        connectGraph(own, s);
        ownCtx = own;
        void own.resume().catch(() => {});
        return true;
      } catch (err) {
        last = err;
        void own?.close().catch(() => {});
      }
    }
    console.warn('[mic] context riêng cũng lỗi:', last);
    throw namedError('ConnectError');
  }

  function describe(s: MediaStream, fellBack: boolean, separate: boolean): MicStatus {
    const track = s.getAudioTracks()[0];
    const st = (track?.getSettings?.() ?? {}) as MediaTrackSettings;
    const label = track?.label || 'Micro';
    const sr = typeof st.sampleRate === 'number' ? st.sampleRate : null;
    const rate = sr ?? actx?.sampleRate ?? null;
    const msg = (fellBack ? 'Không tìm thấy thiết bị đã chọn — dùng micro mặc định: ' : 'Đang dùng: ')
      + label + (rate ? ` · ${Math.round(rate / 100) / 10} kHz` : '');
    console.info(
      `[mic] mở "${label}" (deviceId ${st.deviceId ?? '?'}${opts.deviceId ? `, chọn ${opts.deviceId}` : ', mặc định'})`
      + ` · track sampleRate=${st.sampleRate ?? '?'} echoCancellation=${st.echoCancellation ?? '?'}`
      + ` noiseSuppression=${st.noiseSuppression ?? '?'} autoGainControl=${st.autoGainControl ?? '?'}`
      + ` · ctx ${actx?.sampleRate ?? '?'} Hz${separate ? ' (context riêng)' : ''} · gain ${gain}×${fellBack ? ' · ĐÃ DÙNG MẶC ĐỊNH' : ''}`,
    );
    return {
      ok: true, message: msg, label, deviceId: st.deviceId ?? '', sampleRate: sr, ctxSampleRate: actx?.sampleRate ?? null,
      fellBack, separateContext: separate,
    };
  }

  function watchTrack(s: MediaStream): void {
    const track = s.getAudioTracks()[0];
    if (!track) return;
    track.onended = () => {
      if (stopped || stream !== s) return;
      setStatus({ ...(status as MicStatus), ok: false, message: 'Micro bị ngắt (rút thiết bị?) — đang thử mở lại…' });
      if (reopenTries++ < 3) setTimeout(() => void reopen(), 500);
    };
    track.onmute = () => {
      if (stopped || stream !== s || !status) return;
      setStatus({ ...status, ok: false, message: `Micro "${track.label}" đang bị hệ thống/ứng dụng khác tắt tiếng` });
    };
    track.onunmute = () => {
      if (stopped || stream !== s || !status) return;
      setStatus({ ...status, ok: true, message: status.message.replace(/^Micro ".*" đang bị.*$/, `Đang dùng: ${track.label}`) });
    };
  }

  async function openReal(c: AudioContext): Promise<void> {
    const { s, fellBack } = await openStream();
    if (stopped) {
      s.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = s;
    const separate = attach(c, s);
    mode = 'real';
    watchTrack(s);
    const d = describe(s, fellBack, separate);
    const tr = s.getAudioTracks()[0];
    setStatus(tr?.muted ? { ...d, ok: false, message: `Micro "${d.label}" đang bị hệ thống tắt tiếng (muted)` } : d);
  }

  async function reopen(): Promise<void> {
    if (stopped || !ctx) return;
    teardownNodes();
    try {
      await openReal(ctx);
    } catch (err) {
      teardownNodes();
      setStatus({
        ok: false, message: `${micErrorMessage(err)} — micro đã mất`, label: '', deviceId: '', sampleRate: null,
        ctxSampleRate: null, error: (err as { name?: string })?.name,
      });
    }
  }

  /** Báo "không có tín hiệu" nếu luồng toàn 0 quá 3 s (thiết bị sai / bị tắt tiếng / OS chặn). */
  function checkSilence(level: number): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (level > 1e-5) {
      silentSince = 0;
      if (silentReported && status) {
        silentReported = false;
        setStatus({ ...status, ok: true, message: status.message.replace(/^Không có tín hiệu từ /, 'Đang dùng: ').replace(/ — .*$/, '') });
      }
      return;
    }
    if (!silentSince) silentSince = now;
    if (!silentReported && status && now - silentSince > 3000) {
      silentReported = true;
      setStatus({ ...status, ok: false,
        message: `Không có tín hiệu từ ${status.label} — kiểm tra micro có bị tắt tiếng / quyền micro của hệ điều hành` });
    }
  }

  function synth(m: FakeMode): PitchSample | null {
    const hz = fakeHz(m, opts.targetHz());
    return hz === null ? null : { hz, midi: hzToMidi(hz), clarity: 1, rms: 0.2 };
  }

  return {
    async start(c: AudioContext): Promise<MicMode> {
      ctx = c;
      stopped = false;
      if (opts.mode !== 'real') {
        startFake(c, opts.mode);
        return mode;
      }
      try {
        await openReal(c);
      } catch (err) {
        console.warn('[mic] không dùng được micro, chuyển sang chế độ xem (micro giả perfect):', err);
        teardownNodes();
        setStatus({
          ok: false, message: micErrorMessage(err), label: '', deviceId: '', sampleRate: null, ctxSampleRate: null,
          error: (err as { name?: string })?.name,
        });
        startFake(c, 'perfect');
      }
      return mode;
    },

    read(): PitchSample | null {
      if (stopped) return null;
      if (mode !== 'real') {
        // Micro giả: cập nhật oscillator theo nốt mục tiêu rồi đi qua đường nhận diện thật.
        if (!actx || !analyser || !osc || !oscGain || actx.state !== 'running') return synth(mode);
        const hz = fakeHz(mode, opts.targetHz());
        const t = actx.currentTime;
        if (hz === null) {
          oscGain.gain.setValueAtTime(0, t);
        } else {
          osc.frequency.setValueAtTime(hz, t);
          oscGain.gain.setValueAtTime(0.3, t);
        }
      }
      if (!actx || !analyser) return null;
      analyser.getFloatTimeDomainData(buf);
      const out = median(detector.detect(buf, actx.sampleRate));
      if (mode === 'real') checkSilence(detector.level);
      return out;
    },

    level(): number {
      return stopped || !analyser ? 0 : detector.level;
    },

    setGain(g: number): void {
      gain = clampSensitivity(g);
      if (gainNode) gainNode.gain.value = gain;
    },

    stop(): void {
      stopped = true;
      teardownNodes();
    },

    get mode() {
      return mode;
    },

    get status() {
      return status;
    },
  };
}
