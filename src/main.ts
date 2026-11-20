/**
 * Nối dây toàn bộ game. Không chứa logic nghiệp vụ: chỉ khởi tạo module, dựng FrameState mỗi frame
 * và chuyển trạng thái menu → loading → countdown → playing → result.
 *
 * Tham số URL: ?fakeMic=perfect|off|octave  ?latency=<ms>  ?crowd=<số người>
 */
import { createCrowdAudio, type CrowdAudio } from './audio/crowdAudio';
import { createCrowdSing, type CrowdSing } from './audio/crowdSing';
import { createAudioEngine } from './audio/engine';
import { EventBus } from './core/events';
import { createLoop } from './core/loop';
import { beatPulse, noteAt, pitchToHz, visualBeat } from './core/time';
import type {
  AudioEngine, FrameState, GameState, MicInput, MicMode, ScoreState, ScoringEngine, Song,
  SongManifestEntry, Teleprompter,
} from './core/types';
import { createMic } from './mic/input';
import { createConfetti } from './render/confetti';
import { createCrowd } from './render/crowd';
import { createEmotes } from './render/emotes';
import { createLedScreens } from './render/ledScreens';
import { createLights } from './render/lights';
import { createStage } from './render/stage';
import { createStageFx } from './render/stageFx';
import { createScoring } from './scoring/scoring';
import { createVoiceScoring } from './scoring/voice';
import { findChorusLines } from './song/chorus';
import { lyricIndexAt } from './song/lrc';
import { loadManifest, loadSong } from './song/loader';
import { loadLocalSong, songHasNotes } from './song/local';
import { createHud } from './ui/hud';
import { createScreens } from './ui/screens';
import { createTeleprompter, createVideoPanel } from './ui/teleprompter';

const LEAD_IN_SEC = 3;
const TAIL_SEC = 2;

const params = new URLSearchParams(location.search);
const fakeMicParam = params.get('fakeMic');
const requestedMic: MicMode =
  fakeMicParam === 'perfect' || fakeMicParam === 'off' || fakeMicParam === 'octave' ? fakeMicParam : 'real';
// Micro giả trễ ~50 ms (cửa sổ phân tích), micro thật mặc định bù 120 ms.
const latencySec =
  Math.max(0, Number(params.get('latency') ?? (requestedMic === 'real' ? 120 : 50)) || 0) / 1000;
const crowdCount = Math.max(100, Math.min(10000, Number(params.get('crowd') ?? 2500) || 2500));

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const bus = new EventBus();
const stage = createStage(canvas);
const crowd = createCrowd(stage.scene, { count: crowdCount, rows: 40, arcDeg: 120 });
const lights = createLights(stage.scene);
const led = createLedScreens(stage.scene);
const confetti = createConfetti(stage.scene);
const emotes = createEmotes(stage.scene);
const stageFx = createStageFx(stage.scene);

// --- Tương tác với khán giả bằng phím (chỉ khi đang diễn) ---
const INTERACT_COOLDOWN_SEC = 4;
let hypeBoost = 0; // cộng tạm vào Hype hiển thị, tự tắt dần
let waveUntil = 0; // performance.now() ms
let flashOn = false;
let lastInteract = -Infinity;
const hint = document.createElement('div');
hint.className = 'cs-keys-hint';
hint.textContent =
  'WASD / mũi tên: đi lại  ·  Kéo chuột: xoay  ·  Giữ C: đưa micro cho khán giả  ·  1: hò reo  ·  2: sóng  ·  3: tim  ·  4: flash  ·  5: pháo hoa';
hint.hidden = true;
uiRoot.appendChild(hint);
// --- Chọn micro (ví dụ: nghe bằng tai nghe nhưng thu bằng micro của máy) ---
const MIC_KEY = 'cs-mic-device';
const micPicker = document.createElement('label');
micPicker.className = 'cs-mic-picker';
micPicker.append('Micro: ');
const micSelect = document.createElement('select');
micSelect.id = 'cs-mic-select';
micPicker.appendChild(micSelect);
uiRoot.appendChild(micPicker);
let micLabelsAsked = false;
async function refreshMics(): Promise<void> {
  let saved = '';
  try { saved = localStorage.getItem(MIC_KEY) ?? ''; } catch { /* không có localStorage */ }
  const current = micSelect.value || saved;
  let inputs: MediaDeviceInfo[] = [];
  try {
    inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
  } catch { /* trình duyệt không hỗ trợ */ }
  micSelect.replaceChildren(new Option('Mặc định của hệ thống', ''));
  inputs.forEach((d, i) => { if (d.deviceId) micSelect.add(new Option(d.label || `Micro ${i + 1}`, d.deviceId)); });
  micSelect.value = [...micSelect.options].some((o) => o.value === current) ? current : '';
}
// Tên thiết bị chỉ hiện sau khi được cấp quyền micro: xin quyền một lần khi người chơi mở danh sách.
micSelect.addEventListener('pointerdown', () => {
  if (micLabelsAsked || !navigator.mediaDevices?.getUserMedia) return;
  micLabelsAsked = true;
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((s) => { s.getTracks().forEach((t) => t.stop()); return refreshMics(); })
    .catch(() => { /* bị từ chối: giữ danh sách hiện có */ });
});
micSelect.addEventListener('change', () => {
  try { localStorage.setItem(MIC_KEY, micSelect.value); } catch { /* bỏ qua */ }
});
navigator.mediaDevices?.addEventListener?.('devicechange', () => void refreshMics());
void refreshMics();

// --- Fan hát theo điệp khúc + hỏi–đáp (giữ C để đưa micro cho khán giả) ---
const HANDOVER_MAX_SEC = 10; // giữ C tối đa bấy nhiêu giây, sau đó phải chờ hồi
let crowdSing: CrowdSing | null = null;
let chorusLines = new Set<number>();
let handoverHeld = false;
let handoverEnergy = HANDOVER_MAX_SEC;
let crowdSinging = false; // khán giả đang hát thay (hỏi–đáp)
const singBanner = document.createElement('div');
singBanner.className = 'cs-sing-banner';
singBanner.hidden = true;
uiRoot.appendChild(singBanner);
window.addEventListener('keydown', (e) => { if (e.code === 'KeyC' && state === 'playing') handoverHeld = true; });
window.addEventListener('keyup', (e) => { if (e.code === 'KeyC') handoverHeld = false; });
window.addEventListener('blur', () => { handoverHeld = false; });

// --- Tạm dừng (nút góc trên phải, hoặc phím Esc) ---
let paused = false;
const pauseBtn = document.createElement('button');
pauseBtn.id = 'cs-pause';
pauseBtn.className = 'cs-pause-btn';
pauseBtn.type = 'button';
pauseBtn.hidden = true;
const pauseVeil = document.createElement('div');
pauseVeil.className = 'cs-pause-veil';
pauseVeil.textContent = 'Tạm dừng';
pauseVeil.hidden = true;
uiRoot.append(pauseVeil, pauseBtn);
function setPaused(on: boolean): void {
  if (on === paused || (on && state !== 'playing')) return;
  paused = on;
  pauseBtn.textContent = paused ? '▶ Tiếp tục' : '❚❚ Tạm dừng';
  pauseVeil.hidden = !paused;
  // Treo AudioContext: nhạc, đồng hồ bài hát, micro và tiếng đám đông cùng dừng.
  if (paused) {
    currentVideo?.pause();
    void audio?.ctx.suspend();
  } else {
    void audio?.ctx.resume().then(() => currentVideo?.play());
  }
}
pauseBtn.textContent = '❚❚ Tạm dừng';
pauseBtn.addEventListener('click', () => { setPaused(!paused); pauseBtn.blur(); });
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !e.repeat) setPaused(!paused); });
// Chuyển tab khác thì tự tạm dừng để không mất điểm.
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

window.addEventListener('keydown', (e) => {
  if (paused || state !== 'playing' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const now = performance.now() / 1000;
  const ready = now - lastInteract >= INTERACT_COOLDOWN_SEC;
  switch (e.code) {
    case 'Digit1':
    case 'Space': // "Make some noise!"
      e.preventDefault();
      if (!ready) return;
      crowdAudio?.cheer(1);
      emotes.burst(50);
      hypeBoost = 0.35;
      break;
    case 'Digit2':
      waveUntil = performance.now() + 6000;
      return;
    case 'Digit3':
      if (!ready) return;
      emotes.burst(70, 'heart');
      crowdAudio?.cheer(0.5);
      hypeBoost = Math.max(hypeBoost, 0.15);
      break;
    case 'Digit4':
      flashOn = !flashOn;
      crowd.setFlash(flashOn ? 1 : 0);
      return;
    case 'Digit5':
      if (!ready) return;
      stageFx.pyro();
      confetti.burst();
      crowdAudio?.cheer(0.8);
      hypeBoost = Math.max(hypeBoost, 0.25);
      break;
    default:
      return;
  }
  lastInteract = now;
});
let crowdAudio: CrowdAudio | null = null;
let ledVideo: HTMLVideoElement | null = null;
const hud = createHud(uiRoot);
const noteScoring: ScoringEngine = createScoring();
const voiceScoring: ScoringEngine = createVoiceScoring();
let scoring: ScoringEngine = noteScoring;
const screens = createScreens(uiRoot, {
  onStart: () => void start(),
  onImport: (files) => {
    // Chạy trong chính sự kiện change/drop (cử chỉ người dùng) để mở khóa AudioContext/video.
    localFiles = files;
    void start();
  },
});

let state: GameState = 'menu';
let entry: SongManifestEntry | null = null;
/** Bài có sẵn từ manifest (để quay lại khi cần). */
let builtinEntry: SongManifestEntry | null = null;
/** File người chơi nhập từ máy (null = chơi bài có sẵn). Chỉ đọc cục bộ, không upload. */
let localFiles: File[] | null = null;
/** Bài hiện tại có nốt để chấm cao độ không (false với .lrc / video / chỉ audio). */
let hasNotes = true;
/**
 * Video karaoke đang phát (chế độ nhập video), null nếu không có. Cũng lộ ra ở window.__game.video.
 * Âm thanh của video đi qua Web Audio (AudioEngine.loadMedia) nên đồng hồ/level vẫn dùng AudioEngine.
 */
export let currentVideo: HTMLVideoElement | null = null;
let song: Song | null = null;
let audio: AudioEngine | null = null;
let mic: MicInput | null = null;
let teleprompter: Teleprompter | null = null;
let idleTime = 0;
let lastFrame: FrameState | null = null;
let lastLine = -1;

const idleScore: ScoreState = {
  score: 0, percent: 0, combo: 0, hype: 0.3, activeNote: null, lineIndex: -1, lastHit: 'none', centsOff: null,
};

function setState(s: GameState): void {
  state = s;
  bus.emit('state', s);
}

async function start(): Promise<void> {
  if ((!entry && !localFiles) || state === 'loading' || state === 'countdown' || state === 'playing') return;
  setState('loading');
  try {
    // Tạo/mở khóa AudioContext ngay trong cú bấm của người dùng.
    audio ??= createAudioEngine();
    crowdAudio ??= createCrowdAudio(audio.ctx);
    crowdSing ??= createCrowdSing(audio.ctx);
    const resumed = audio.resume();
    // Video mới mỗi lần chơi (createMediaElementSource chỉ gọi được 1 lần / phần tử).
    releaseVideo();
    let video: HTMLVideoElement | null = null;
    if (localFiles) {
      const files = localFiles;
      const plan = await loadLocalSong(files);
      if (plan.video) {
        video = document.createElement('video');
        video.playsInline = true;
        video.preload = 'auto';
        video.src = URL.createObjectURL(plan.video); // object URL cục bộ, không upload
        // Mở khóa phát trong cử chỉ người dùng (Safari/Chrome), rồi dừng ngay.
        video.muted = true;
        video.play().then(() => video?.pause(), () => {});
      }
      await resumed;
      screens.showLoading('Đang đọc file từ máy…');
      song = plan.song;
      entry = plan.entry;
      if (video) {
        video.pause();
        video.muted = false;
        if (!audio.loadMedia) throw new Error('AudioEngine không hỗ trợ video');
        await audio.loadMedia(video);
        currentVideo = video;
      } else if (plan.audio) {
        await audio.load(plan.audio);
      }
    } else {
      await resumed;
      screens.showLoading('Đang tải bài hát…');
      entry = builtinEntry;
      if (!entry) throw new Error('Không có bài hát');
      const loaded = await loadSong(entry);
      song = loaded.song;
      await audio.load(loaded.audio);
    }
    hasNotes = songHasNotes(song);
    // Không có nốt: bài kéo dài hết file audio/video.
    if (!hasNotes) song.durationSec = Math.max(song.durationSec, audio.durationSec);
    scoring = hasNotes ? noteScoring : voiceScoring;
    chorusLines = hasNotes ? findChorusLines(song) : new Set();
    handoverEnergy = HANDOVER_MAX_SEC;

    mic?.stop();
    mic = createMic({
      mode: requestedMic,
      voiceProcessing: !hasNotes,
      deviceId: micSelect.value || undefined,
      targetHz: () => {
        if (!song || !audio) return null;
        const t = audio.now();
        if (!hasNotes) {
          // Micro giả trong chế độ không có nốt: "hát" một cao độ cố định trong câu lời (hoặc suốt bài).
          // Không có micro thật (chế độ xem) thì không tự "hát": Hype giữ mức nền.
          if (t < 0 || requestedMic === 'real') return null;
          if (song.lyrics) return lyricIndexAt(song.lyrics, t) >= 0 ? 220 : null;
          return 220;
        }
        const n = noteAt(song, t);
        return n && n.type !== 'freestyle' ? pitchToHz(n.pitch) : null;
      },
    });
    const micMode = await mic.start(audio.ctx);
    hud.setNotice(
      micMode === 'real' ? null : requestedMic === 'real' ? 'Chế độ xem (không có micro)' : `Micro giả: ${micMode}`,
    );

    teleprompter?.dispose();
    teleprompter = video ? createVideoPanel(uiRoot, video) : createTeleprompter(uiRoot, song);
    hud.setPitchScore?.(hasNotes);
    scoring.reset(song);
    lastLine = -1;

    screens.hide();
    hud.setVisible(true);
    audio.play(LEAD_IN_SEC);
    setState('countdown');
  } catch (err) {
    console.error(err);
    releaseVideo();
    screens.showError(`Không bắt đầu được: ${err instanceof Error ? err.message : String(err)}`);
    setState('menu');
  }
}

function releaseVideo(): void {
  if (!currentVideo) return;
  currentVideo.pause();
  URL.revokeObjectURL(currentVideo.src);
  currentVideo = null;
  if (teleprompter) {
    teleprompter.dispose();
    teleprompter = null;
  }
}

function finish(score: ScoreState): void {
  audio?.stop();
  mic?.stop();
  teleprompter?.setVisible(false);
  hud.setVisible(false);
  setState('result');
  crowdSing?.update(null, 0);
  singBanner.hidden = true;
  crowdAudio?.cheer(1);
  confetti.burst();
  bus.emit('songEnd', score);
  if (entry) screens.showResult(score, entry, mic?.mode ?? 'real', { pitchScore: hasNotes });
}

function tick(dt: number): void {
  pauseBtn.hidden = state !== 'playing';
  micPicker.hidden = !(state === 'menu' || state === 'result');
  if (paused) {
    if (state === 'playing' && lastFrame) {
      // Đứng hình: vẫn vẽ lại (đổi kích thước cửa sổ, camera theo chuột) nhưng không chạy game.
      stage.update({ ...lastFrame, dt: 0 });
      stage.render();
      return;
    }
    setPaused(false); // trạng thái đổi (hết bài, chơi lại) thì bỏ tạm dừng
  }
  let f: FrameState;
  if ((state === 'countdown' || state === 'playing') && song && audio && mic) {
    const songTime = audio.now();
    if (state === 'countdown' && songTime >= 0) setState('playing');
    let pitch = mic.read();
    // Hỏi–đáp: giữ C thì khán giả hát thay ca sĩ (chỉ bài có nốt, cần Hype ≥ 0,15, có giới hạn thời gian).
    const targetNote = hasNotes ? noteAt(song, songTime - latencySec) : null;
    crowdSinging = handoverHeld && hasNotes && state === 'playing' && handoverEnergy > 0 && (lastFrame?.hype ?? 0) >= 0.15;
    handoverEnergy = crowdSinging
      ? Math.max(0, handoverEnergy - dt)
      : Math.min(HANDOVER_MAX_SEC, handoverEnergy + (handoverHeld ? 0 : dt * 0.5));
    if (crowdSinging && targetNote && targetNote.type !== 'freestyle') {
      const hz = pitchToHz(targetNote.pitch);
      pitch = { hz, midi: 69 + 12 * Math.log2(hz / 440), clarity: 1, rms: 0.2 };
    }
    const score = scoring.update(songTime, pitch, latencySec, dt);
    // Fan hát theo: ở điệp khúc khi Hype đủ cao thì hát nền; hỏi–đáp thì hát to.
    const inChorus = chorusLines.has(score.lineIndex);
    const singNote = hasNotes ? noteAt(song, songTime) : null;
    const singAmount = crowdSinging ? 1 : inChorus ? Math.min(0.6, Math.max(0, (score.hype - 0.45) / 0.4) * 0.6) : 0;
    crowdSing?.update(singNote && singNote.type !== 'freestyle' ? pitchToHz(singNote.pitch) : null, singAmount);
    singBanner.hidden = singAmount <= 0.05;
    if (!singBanner.hidden) {
      singBanner.textContent = crowdSinging
        ? `Khán giả đang hát thay bạn!  (${Math.ceil(handoverEnergy)}s)`
        : 'Điệp khúc — khán giả hát theo';
      singBanner.classList.toggle('handover', crowdSinging);
    }
    const beat = visualBeat(songTime, song);
    f = {
      dt, songTime, beat, beatPulse: beatPulse(beat), level: audio.level(), hype: score.hype,
      waveMode: score.hype > 0.7 ? 1 : 0, pitch, activeNote: score.activeNote, lineIndex: score.lineIndex, score,
    };
    if (score.lineIndex !== lastLine) {
      lastLine = score.lineIndex;
      if (lastLine >= 0) bus.emit('lineStart', lastLine);
    }
    teleprompter?.update(f);
    hud.update(f);
    if (audio.ended || songTime > Math.min(audio.durationSec || Infinity, song.durationSec + TAIL_SEC)) {
      finish({ ...score });
    }
  } else {
    // Menu / kết quả: khán giả vẫn nhún nhẹ theo đồng hồ nội bộ.
    idleTime += dt;
    const beat = (idleTime * 100) / 60;
    const hype = state === 'result' && lastFrame ? lastFrame.hype : 0.3;
    f = {
      dt, songTime: 0, beat, beatPulse: beatPulse(beat), level: 0.2, hype, waveMode: hype > 0.7 ? 1 : 0,
      pitch: null, activeNote: null, lineIndex: -1, score: lastFrame?.score ?? idleScore,
    };
  }
  if (ledVideo !== currentVideo) {
    ledVideo = currentVideo;
    led.setVideo(ledVideo);
  }
  // Tương tác: Hype hiển thị được cộng tạm (không đổi điểm), sóng lightstick theo phím W.
  hypeBoost = Math.max(0, hypeBoost - dt * 0.12);
  if (state !== 'playing') crowdSinging = false;
  if (crowdSinging) hypeBoost = Math.max(hypeBoost, 0.2);
  hint.hidden = state !== 'playing';
  if (state === 'playing') {
    const waving = performance.now() < waveUntil;
    if (hypeBoost > 0 || waving) {
      const hype = Math.min(1, f.hype + hypeBoost);
      f = { ...f, hype, waveMode: waving || hype > 0.7 ? 1 : 0 };
    }
  }
  crowd.update(f);
  lights.update(f);
  emotes.update(f);
  stageFx.update(f);
  led.update(f, state === 'countdown' || state === 'playing' ? song : null);
  confetti.update(f);
  crowdAudio?.update(f);
  stage.update(f);
  stage.render();
  lastFrame = f;
}

// Hook cho kiểm thử tự động (Playwright) và debug.
declare global {
  interface Window {
    __game: {
      readonly state: GameState;
      readonly frame: FrameState | null;
      readonly song: Song | null;
      readonly micMode: MicMode | null;
      readonly drawCalls: number;
      /** Video karaoke đang dùng (chế độ nhập video) hoặc null. Cho màn LED 3D. */
      readonly video: HTMLVideoElement | null;
      /** false khi bài không có nốt (không chấm cao độ). */
      readonly hasNotes: boolean;
      /** Nhập bài từ máy bằng code (giống chọn file). */
      importFiles(files: File[]): Promise<void>;
      bus: EventBus;
      start(): Promise<void>;
      /** Tua tới gần cuối bài cho kiểm thử nhanh (nếu AudioEngine hỗ trợ thì P7 nối thêm). */
      finish(): void;
    };
  }
}
window.__game = {
  get state() { return state; },
  get frame() { return lastFrame; },
  get song() { return song; },
  get micMode() { return mic?.mode ?? null; },
  get drawCalls() { return stage.renderer.info.render.calls; },
  get video() { return currentVideo; },
  get hasNotes() { return hasNotes; },
  importFiles: (files) => { localFiles = files; return start(); },
  bus,
  start,
  finish: () => { if (lastFrame) finish({ ...lastFrame.score }); },
};

hud.setVisible(false);
createLoop(tick).start();

loadManifest()
  .then((m) => {
    builtinEntry = entry = m.songs[0] ?? null;
    if (!entry) throw new Error('manifest.json không có bài nào');
    screens.showStart(entry);
  })
  .catch((err) => {
    console.error(err);
    screens.showError(`Không tải được danh sách bài hát: ${err instanceof Error ? err.message : String(err)}`);
  });
