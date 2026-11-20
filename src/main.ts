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
  PanelControls, SongManifestEntry, Teleprompter,
} from './core/types';
import { createMic } from './mic/input';
import { createConfetti } from './render/confetti';
import { createCrowd } from './render/crowd';
import { createEmotes } from './render/emotes';
import { createLedScreens } from './render/ledScreens';
import { createLights } from './render/lights';
import { createCameraCrew } from './render/cameraCrew';
import { createSinger } from './render/singer';
import { createStage } from './render/stage';
import { getControls } from './render/stageControls';
import { createStageFx } from './render/stageFx';
import { createScoring } from './scoring/scoring';
import { createVoiceScoring } from './scoring/voice';
import { findChorusLines } from './song/chorus';
import { lyricIndexAt } from './song/lrc';
import { loadManifest, loadSong } from './song/loader';
import { loadLocalSong, songHasNotes } from './song/local';
import { createHud } from './ui/hud';
import { createHudMicMeter, createMicPanel } from './ui/micPanel';
import { createScreens } from './ui/screens';
import { createTeleprompter, createVideoPanel } from './ui/teleprompter';
import { createControlsGuide } from './ui/controlsGuide';
import {
  createPauseMenu, loadSettings, saveSettings, type SecretKind, type TestKind, type ViewName,
} from './ui/pauseMenu';

const LEAD_IN_SEC = 3;
const TAIL_SEC = 2;

const params = new URLSearchParams(location.search);
const fakeMicParam = params.get('fakeMic');
const requestedMic: MicMode =
  fakeMicParam === 'perfect' || fakeMicParam === 'off' || fakeMicParam === 'octave' ? fakeMicParam : 'real';
// Micro giả trễ ~50 ms (cửa sổ phân tích), micro thật mặc định bù 120 ms.
// Chỉnh được trong menu tạm dừng (lưu localStorage); ?latency= vẫn được ưu tiên khi mở trang.
const settings = loadSettings();
let latencySec =
  Math.max(0, Math.min(400, Number(params.get('latency') ?? settings.latencyMs ?? (requestedMic === 'real' ? 120 : 50)) || 0)) / 1000;
const crowdCount = Math.max(100, Math.min(10000, Number(params.get('crowd') ?? 8000) || 8000));

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
// Hình ca sĩ + đội quay phim/flycam; phím V đổi góc nhìn (xử lý trong stageControls).
const singer = createSinger(stage.scene);
const crew = createCameraCrew(stage.scene);
const controls = getControls();
controls?.setViewProvider((m) => crew.getView(m), stage.scene);
function updateCrew(f: FrameState): void {
  if (!controls) return;
  const sp = controls.getSingerPose();
  crew.update(f, sp.position, sp.yaw);
  singer.update(f, sp.position, sp.yaw, controls.getViewMode() !== 'singer');
}

// --- Tương tác với khán giả bằng phím (chỉ khi đang diễn) ---
const INTERACT_COOLDOWN_SEC = 4;
let hypeBoost = 0; // cộng tạm vào Hype hiển thị, tự tắt dần
let waveUntil = 0; // performance.now() ms
let flashOn = false;
let lastInteract = -Infinity;
/** Phím game bị bỏ qua khi đang gõ trong ô nhập (menu tạm dừng, băng rôn…). */
function isTypingTarget(e: Event): boolean {
  const t = (e.target ?? document.activeElement) as HTMLElement | null;
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
// Bảng hướng dẫn phím kiểu game (ui/controlsGuide.ts), H hoặc nút "?" để ẩn/hiện.
const controlsGuide = createControlsGuide(uiRoot);
// --- Micro: bảng chọn/thử micro (ui/micPanel.ts), ví dụ nghe bằng tai nghe nhưng thu bằng micro của máy ---
const micPanel = createMicPanel(uiRoot);
const hudMicMeter = createHudMicMeter(uiRoot);

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
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && state === 'playing' && !paused && !isTypingTarget(e)) handoverHeld = true;
});
window.addEventListener('keyup', (e) => { if (e.code === 'KeyC') handoverHeld = false; });
window.addEventListener('blur', () => { handoverHeld = false; });

/** Kích hoạt một tương tác; `test` = bấm thử trong menu tạm dừng (bỏ qua thời gian chờ). */
function interact(kind: TestKind, test = false): boolean {
  const now = performance.now() / 1000;
  const ready = test || now - lastInteract >= INTERACT_COOLDOWN_SEC;
  switch (kind) {
    case 'cheer':
      if (!ready) return false;
      crowdAudio?.cheer(1);
      emotes.burst(50);
      hypeBoost = 0.35;
      break;
    case 'wave':
      waveUntil = performance.now() + 6000;
      return true;
    case 'heart':
      if (!ready) return false;
      emotes.burst(70, 'heart');
      crowdAudio?.cheer(0.5);
      hypeBoost = Math.max(hypeBoost, 0.15);
      break;
    case 'flash':
      flashOn = !flashOn;
      crowd.setFlash(flashOn ? 1 : 0);
      pauseMenu.setFlashState(flashOn);
      return true;
    case 'fireworks':
      if (!ready) return false;
      stageFx.pyro();
      confetti.burst();
      crowdAudio?.cheer(0.8);
      hypeBoost = Math.max(hypeBoost, 0.25);
      break;
    case 'sing':
      singTestUntil = performance.now() + 4000;
      return true;
  }
  if (!test) lastInteract = now;
  return true;
}
const KEY_INTERACT: Record<string, TestKind> = {
  Digit1: 'cheer', Space: 'cheer', Digit2: 'wave', Digit3: 'heart', Digit4: 'flash', Digit5: 'fireworks',
};
window.addEventListener('keydown', (e) => {
  if (paused || state !== 'playing' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e)) return;
  const kind = KEY_INTERACT[e.code];
  if (!kind) return;
  if (e.code === 'Space') e.preventDefault();
  interact(kind);
});

// --- Âm lượng: nhạc (AudioEngine.setVolume), tiếng đám đông (setVolume), khán giả hát theo (GainNode riêng) ---
let singVol: GainNode | null = null;
function applyVolumes(): void {
  audio?.setVolume?.(settings.volume.music);
  crowdAudio?.setVolume(settings.volume.crowd);
  if (singVol && audio) singVol.gain.setTargetAtTime(settings.volume.sing, audio.ctx.currentTime, 0.03);
}
/** Thử "khán giả hát theo" trong menu: hát một đoạn giai điệu ngắn tới thời điểm này (performance.now ms). */
let singTestUntil = 0;
const SING_TEST_NOTES = [262, 294, 330, 392, 330, 294];

// --- Module tùy chọn do agent khác thêm (băng rôn, sự kiện bí mật, máy bay): nạp có điều kiện ---
// import.meta.glob trả {} nếu file chưa có → build/tsc chạy được cả khi module/export chưa tồn tại.
type OptionalApi = {
  setCheerBanners?: (lines: string[]) => void;
  triggerSecret?: (kind?: SecretKind, force?: boolean) => void;
  setSecretChances?: (c: Partial<Record<SecretKind, number>>) => void;
  SECRET_CHANCES?: Record<SecretKind, number>;
  triggerFlyby?: () => void;
};
const optionalModules = import.meta.glob([
  './render/backdropBalloons.ts', './render/secretEvents.ts', './render/backdropFlyby.ts',
]);
const optional: OptionalApi = {};
const optionalReady = Promise.all(Object.values(optionalModules).map((load) => load().then(
  (m) => {
    const mod = m as OptionalApi;
    for (const k of ['setCheerBanners', 'triggerSecret', 'setSecretChances', 'triggerFlyby'] as const) {
      if (typeof mod[k] === 'function' && !optional[k]) (optional as Record<string, unknown>)[k] = mod[k];
    }
    if (mod.SECRET_CHANCES && typeof mod.SECRET_CHANCES === 'object') optional.SECRET_CHANCES = mod.SECRET_CHANCES;
  },
  (err) => console.warn('[workshop] không nạp được module tùy chọn', err),
))).then(() => {
  if (settings.banners.length) optional.setCheerBanners?.(settings.banners);
  if (settings.chances) optional.setSecretChances?.(settings.chances);
  pauseMenu.setSecretAvailable(
    !!optional.triggerSecret, !!optional.triggerFlyby,
    settings.chances ?? optional.SECRET_CHANCES ?? { ufo: 0.25, rocket: 0.2, dragon: 0.1 },
  );
});

// --- Tạm dừng = "xưởng chỉnh" (nút góc trên phải, hoặc phím Esc) ---
// Khi dừng: đồng hồ bài, chấm điểm, micro chấm điểm đứng yên; cảnh 3D vẫn chạy bằng "frame xem trước"
// (beat nội bộ theo BPM bài, Hype chọn trong menu) để thử tương tác. Chỉ nhạc dừng (AudioEngine.pauseMusic),
// AudioContext vẫn chạy để nghe thử tiếng đám đông / hát theo / thử micro.
let paused = false;
let previewHype = 0.5;
let previewTime = 0;
let pausedMicKey = '';
const micKey = () => { const m = micPanel.selection(); return `${m.deviceId ?? ''}|${m.deviceLabel ?? ''}`; };
const topBar = document.createElement('div');
topBar.className = 'cs-topbar';
topBar.dataset.nodrag = '';
const pill = (id: string, text: string, title: string) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = id;
  b.className = 'cs-pill';
  b.textContent = text;
  b.title = title;
  return b;
};
const viewBtn = pill('cs-view-btn', 'Góc máy (V)', 'Đổi góc máy: ca sĩ → flycam → hố → cần cẩu → toàn cảnh');
const lookBtn = pill('cs-look-btn', 'Chuột tự do (M)', 'Di chuột để xoay, bấm M hoặc Esc để thoát');
const endBtn = pill('cs-end-btn', 'Kết thúc', 'Kết thúc buổi diễn và xem kết quả');
const pauseBtn = pill('cs-pause', '❚❚ Tạm dừng', 'Tạm dừng / xưởng chỉnh (Esc)');
pauseBtn.classList.add('cs-pause-btn');
topBar.append(viewBtn, lookBtn, endBtn, pauseBtn);
topBar.hidden = true;
const lookHint = document.createElement('div');
lookHint.className = 'cs-look-hint';
lookHint.textContent = 'Chuột tự do — bấm M hoặc Esc để thoát';
lookHint.hidden = true;
uiRoot.append(topBar, lookHint);
const VIEW_LABEL: Record<string, string> = { singer: 'Ca sĩ', flycam: 'Flycam', pit: 'Hố', crane: 'Cần cẩu', wide: 'Toàn cảnh' };
function showView(mode: string): void {
  viewBtn.textContent = `Góc máy: ${VIEW_LABEL[mode] ?? mode} (V)`;
  pauseMenu.setViewState(mode);
}
let lookOffAt = -Infinity; // performance.now() lúc vừa thoát chuột tự do (Esc thoát pointer lock)
function showLook(on: boolean): void {
  lookBtn.classList.toggle('on', on);
  lookHint.hidden = !on || state !== 'playing';
  pauseMenu.setMouseLookState(on);
  if (!on) lookOffAt = performance.now();
}
window.addEventListener('cs-view', (e) => showView(String((e as CustomEvent<{ mode: string }>).detail?.mode ?? '')));
window.addEventListener('cs-mouselook', (e) => showLook(!!(e as CustomEvent<{ on: boolean }>).detail?.on));
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) lookOffAt = performance.now(); });
viewBtn.addEventListener('click', () => { controls?.cycleView(1); viewBtn.blur(); });
lookBtn.addEventListener('click', () => { controls?.setMouseLook(!controls.isMouseLook()); lookBtn.blur(); });
// Kết thúc có bước xác nhận: bấm lần 1 → "Bấm lần nữa để kết thúc" trong 3 s.
let endArmedUntil = 0;
endBtn.addEventListener('click', () => {
  endBtn.blur();
  if (performance.now() < endArmedUntil) { endConcert(); return; }
  endArmedUntil = performance.now() + 3000;
  endBtn.textContent = 'Bấm lần nữa để kết thúc';
  endBtn.classList.add('armed');
});

const pauseMenu = createPauseMenu(uiRoot, {
  settings,
  latencyMs: Math.round(latencySec * 1000),
  onResume: () => setPaused(false),
  onRestart: () => restartSong(),
  onEnd: () => endConcert(),
  onLatency: (ms) => {
    latencySec = ms / 1000;
    settings.latencyMs = ms;
    saveSettings(settings);
  },
  onVolume: (kind, v) => {
    settings.volume[kind] = v;
    saveSettings(settings);
    applyVolumes();
  },
  onPreviewHype: (h) => { previewHype = h; },
  getQuality: () => crowd.getQuality?.() ?? null,
  setQuality: (q) => crowd.setQuality?.(q),
  onTest: (k) => { interact(k, true); },
  setView: (v: ViewName) => controls?.setView(v),
  setMouseLook: (on) => controls?.setMouseLook(on),
  onBanners: (lines) => {
    settings.banners = lines;
    saveSettings(settings);
    void optionalReady.then(() => optional.setCheerBanners?.(lines));
  },
  onSecret: (k) => optional.triggerSecret?.(k, true),
  onFlyby: () => optional.triggerFlyby?.(),
  onChance: (k, v) => {
    const cur = settings.chances ?? { ...(optional.SECRET_CHANCES ?? { ufo: 0.25, rocket: 0.2, dragon: 0.1 }) };
    cur[k] = v;
    settings.chances = cur;
    saveSettings(settings);
    optional.setSecretChances?.({ [k]: v });
  },
  seekBy: (d) => panelControls.seekBy(d),
  seekTo: (sec) => panelControls.seekTo(sec),
  songTime: () => audio?.now() ?? 0,
  duration: () => songDuration(),
});
showView(controls?.getViewMode() ?? 'singer');
showLook(controls?.isMouseLook() ?? false);

/**
 * on=false, resumeAudio=false: rời chế độ tạm dừng mà không phát nhạc tiếp (hát lại / kết thúc).
 */
function setPaused(on: boolean, resumeAudio = true): void {
  if (on === paused || (on && state !== 'playing')) return;
  paused = on;
  pauseBtn.textContent = paused ? '▶ Tiếp tục' : '❚❚ Tạm dừng';
  if (paused) {
    previewHype = lastFrame?.hype ?? 0.5;
    previewTime = lastFrame?.songTime ?? 0;
    pausedMicKey = micKey();
    handoverHeld = false;
    crowdSinging = false;
    crowdSing?.update(null, 0);
    singBanner.hidden = true;
    pauseMenu.open(previewHype, micPanel.el);
    micPanel.setVisible(true);
    if (audio?.pauseMusic) {
      audio.pauseMusic(); // video (nếu có) cũng dừng trong pauseMusic
    } else {
      currentVideo?.pause();
      void audio?.ctx.suspend();
    }
  } else {
    micPanel.setVisible(false); // đóng luồng "Thử micro"
    pauseMenu.close();
    if (!resumeAudio) return;
    // Đổi micro trong lúc dừng → mở lại micro của game với thiết bị mới; độ nhạy áp dụng ngay.
    if (requestedMic === 'real' && mic && micKey() !== pausedMicKey && audio) void reopenMic();
    else mic?.setGain?.(micPanel.selection().gain);
    if (audio?.resumeMusic && audio.musicPaused) {
      void audio.resume().then(() => audio?.resumeMusic?.());
    } else {
      void audio?.ctx.resume().then(() => currentVideo?.play());
    }
  }
}
pauseBtn.addEventListener('click', () => { setPaused(!paused); pauseBtn.blur(); });
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat) return;
  // Esc khi đang ở chuột tự do: chỉ thoát chuột tự do. Ngay sau khi trình duyệt tự thoát pointer lock
  // bằng Esc (~300 ms) thì bỏ qua, để cùng một lần bấm không mở luôn menu tạm dừng.
  if (controls?.isMouseLook()) { controls.setMouseLook(false); return; }
  if (performance.now() - lookOffAt < 300) return;
  if (isTypingTarget(e) && !paused) return;
  setPaused(!paused);
});
// Chuyển tab khác thì tự tạm dừng để không mất điểm.
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

/** Hát lại bài hiện tại từ đầu (từ menu tạm dừng). */
function restartSong(): void {
  if (state !== 'playing' && state !== 'countdown') return;
  setPaused(false, false);
  audio?.stop();
  mic?.stop();
  crowdSing?.update(null, 0);
  singBanner.hidden = true;
  setState('menu');
  void start();
}
/** Kết thúc buổi diễn ngay: màn kết quả với điểm hiện có (như hết bài). */
function endConcert(): void {
  if (state !== 'playing' && state !== 'countdown') return;
  setPaused(false, false);
  finish({ ...(lastFrame?.score ?? idleScore) });
}

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
    if (!crowdSing) {
      singVol = audio.ctx.createGain();
      singVol.connect(audio.ctx.destination);
      crowdSing = createCrowdSing(audio.ctx, singVol);
    }
    applyVolumes();
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

    await openMic();

    teleprompter?.dispose();
    teleprompter = video ? createVideoPanel(uiRoot, video, panelControls) : createTeleprompter(uiRoot, song, panelControls);
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

/** Mở (lại) micro của game theo lựa chọn trong bảng micro. */
async function openMic(): Promise<void> {
  if (!audio) return;
  mic?.stop();
  micPanel.stopTest(); // đóng luồng "Thử micro" trước khi mở micro cho game
  const m = createMic({
    mode: requestedMic,
    voiceProcessing: !hasNotes,
    ...(requestedMic === 'real' ? micPanel.selection() : {}),
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
  mic = m;
  const micMode = await m.start(audio.ctx);
  if (mic !== m) return;
  hud.setNotice(
    micMode === 'real' ? null
      : requestedMic === 'real' ? `Chế độ xem — ${m.status?.message ?? 'không có micro'}` : `Micro giả: ${micMode}`,
  );
  micPanel.showStatus(m.status ?? null);
}
async function reopenMic(): Promise<void> {
  try { await openMic(); } catch (err) { console.error(err); }
}

// --- Tua bài (nút ⏪/⏩, thanh tiến độ, phím [ ]) và thu nhỏ khung lời (phím T) ---
const SEEK_STEP_SEC = 10;
function songDuration(): number {
  return (audio?.durationSec || song?.durationSec) ?? 0;
}
function seekSong(sec: number): void {
  if (!audio?.seek || !song || (state !== 'playing' && state !== 'countdown')) return;
  // Kẹp để không chạm điều kiện hết bài (cuối file hoặc nốt cuối + TAIL_SEC).
  const end = Math.min(audio.durationSec || Infinity, song.durationSec + TAIL_SEC);
  audio.seek(Math.max(0, Math.min(sec, end - 1)));
  const t = audio.now();
  scoring.seek?.(t, latencySec);
  lastLine = -1;
  if (paused && lastFrame) {
    // Đang tạm dừng: cập nhật khung lời ngay ở vị trí mới.
    lastFrame = { ...lastFrame, songTime: t, activeNote: hasNotes ? noteAt(song, t) : null };
    teleprompter?.update({ ...lastFrame, dt: 0 });
  }
}
const panelControls: PanelControls = {
  seekTo: (sec) => seekSong(sec),
  seekBy: (d) => seekSong((audio?.now() ?? 0) + d),
  duration: songDuration,
};
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || (state !== 'playing' && state !== 'countdown')) return;
  if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
    e.preventDefault();
    panelControls.seekBy(e.code === 'BracketLeft' ? -SEEK_STEP_SEC : SEEK_STEP_SEC);
  } else if (e.code === 'KeyT' && !e.repeat) {
    teleprompter?.setMinimized?.(!teleprompter.minimized);
  }
});

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
  setPaused(false, false);
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
  topBar.hidden = state !== 'playing';
  if (paused && (state !== 'playing' || !lastFrame)) setPaused(false); // trạng thái đổi (hết bài, chơi lại)
  micPanel.setVisible(state === 'menu' || state === 'result' || paused);
  if (state === 'countdown' || state === 'playing') hudMicMeter.update(mic);
  controlsGuide.setActive(state === 'playing' && !paused);
  lookHint.hidden = !(controls?.isMouseLook() ?? false) || state !== 'playing';
  if (endArmedUntil && performance.now() > endArmedUntil) {
    endArmedUntil = 0;
    endBtn.textContent = 'Kết thúc';
    endBtn.classList.remove('armed');
  }
  let f: FrameState;
  if (paused && lastFrame && song) {
    // Xưởng chỉnh: frame xem trước — không đụng đồng hồ bài, điểm hay khung lời.
    previewTime += dt;
    const beat = visualBeat(previewTime, song);
    f = {
      ...lastFrame, dt, beat, beatPulse: beatPulse(beat), level: 0.25 + 0.35 * previewHype * beatPulse(beat),
      hype: previewHype, waveMode: previewHype > 0.7 ? 1 : 0, pitch: null,
    };
    pauseMenu.update();
    // Thử "khán giả hát theo": vài nốt giai điệu.
    const singing = performance.now() < singTestUntil;
    const hz = SING_TEST_NOTES[Math.floor(previewTime * 2) % SING_TEST_NOTES.length];
    crowdSing?.update(singing ? hz : null, singing ? 0.8 : 0);
  } else if ((state === 'countdown' || state === 'playing') && song && audio && mic) {
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
  updateCrew(f);
  stage.render();
  // Frame xem trước không ghi đè lastFrame: đồng hồ/điểm/Hype thật giữ nguyên khi tiếp tục.
  if (!paused) lastFrame = f;
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
      /** Đang tạm dừng (xưởng chỉnh). */
      readonly paused: boolean;
      /** Đồng hồ bài đọc trực tiếp từ AudioEngine (không chờ frame). */
      readonly songClock: number;
      /** Nhập bài từ máy bằng code (giống chọn file). */
      importFiles(files: File[]): Promise<void>;
      bus: EventBus;
      start(): Promise<void>;
      /** Tua tới gần cuối bài cho kiểm thử nhanh (nếu AudioEngine hỗ trợ thì P7 nối thêm). */
      finish(): void;
      /** Tua tới giây `sec` của bài (như nút ⏪/⏩). */
      seek(sec: number): void;
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
  get paused() { return paused; },
  get songClock() { return audio?.now() ?? 0; },
  importFiles: (files) => { localFiles = files; return start(); },
  bus,
  start,
  finish: () => { if (lastFrame) finish({ ...lastFrame.score }); },
  seek: (sec) => seekSong(sec),
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
