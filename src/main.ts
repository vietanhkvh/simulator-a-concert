/**
 * Nối dây toàn bộ game. Không chứa logic nghiệp vụ: chỉ khởi tạo module, dựng FrameState mỗi frame
 * và chuyển trạng thái menu → loading → countdown → playing → result.
 *
 * Tham số URL: ?fakeMic=perfect|off|octave  ?latency=<ms>  ?crowd=<số người>
 */
import { createCrowdAudio, type CrowdAudio } from './audio/crowdAudio';
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
import { createLedScreens } from './render/ledScreens';
import { createLights } from './render/lights';
import { createStage } from './render/stage';
import { createScoring } from './scoring/scoring';
import { createVoiceScoring } from './scoring/voice';
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

    mic?.stop();
    mic = createMic({
      mode: requestedMic,
      targetHz: () => {
        if (!song || !audio) return null;
        const t = audio.now();
        if (!hasNotes) {
          // Micro giả trong chế độ không có nốt: "hát" một cao độ cố định trong câu lời (hoặc suốt bài).
          if (t < 0) return null;
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
  crowdAudio?.cheer(1);
  confetti.burst();
  bus.emit('songEnd', score);
  if (entry) screens.showResult(score, entry, mic?.mode ?? 'real', { pitchScore: hasNotes });
}

function tick(dt: number): void {
  let f: FrameState;
  if ((state === 'countdown' || state === 'playing') && song && audio && mic) {
    const songTime = audio.now();
    if (state === 'countdown' && songTime >= 0) setState('playing');
    const pitch = mic.read();
    const score = scoring.update(songTime, pitch, latencySec, dt);
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
  crowd.update(f);
  lights.update(f);
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
