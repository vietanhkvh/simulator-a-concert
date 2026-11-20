/**
 * Nối dây toàn bộ game. Không chứa logic nghiệp vụ: chỉ khởi tạo module, dựng FrameState mỗi frame
 * và chuyển trạng thái menu → loading → countdown → playing → result.
 *
 * Tham số URL: ?fakeMic=perfect|off|octave  ?latency=<ms>  ?crowd=<số người>
 */
import { createAudioEngine } from './audio/engine';
import { EventBus } from './core/events';
import { createLoop } from './core/loop';
import { beatPulse, noteAt, pitchToHz, visualBeat } from './core/time';
import type {
  AudioEngine, FrameState, GameState, MicInput, MicMode, ScoreState, ScoringEngine, Song,
  SongManifestEntry, Teleprompter,
} from './core/types';
import { createMic } from './mic/input';
import { createCrowd } from './render/crowd';
import { createLights } from './render/lights';
import { createStage } from './render/stage';
import { createScoring } from './scoring/scoring';
import { loadManifest, loadSong } from './song/loader';
import { createHud } from './ui/hud';
import { createScreens } from './ui/screens';
import { createTeleprompter } from './ui/teleprompter';

const LEAD_IN_SEC = 3;
const TAIL_SEC = 2;

const params = new URLSearchParams(location.search);
const fakeMicParam = params.get('fakeMic');
const requestedMic: MicMode =
  fakeMicParam === 'perfect' || fakeMicParam === 'off' || fakeMicParam === 'octave' ? fakeMicParam : 'real';
const latencySec = Math.max(0, Number(params.get('latency') ?? 120) || 0) / 1000;
const crowdCount = Math.max(100, Math.min(10000, Number(params.get('crowd') ?? 2500) || 2500));

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const bus = new EventBus();
const stage = createStage(canvas);
const crowd = createCrowd(stage.scene, { count: crowdCount, rows: 40, arcDeg: 120 });
const lights = createLights(stage.scene);
const hud = createHud(uiRoot);
const scoring: ScoringEngine = createScoring();
const screens = createScreens(uiRoot, { onStart: () => void start() });

let state: GameState = 'menu';
let entry: SongManifestEntry | null = null;
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
  if (!entry || state === 'loading' || state === 'countdown' || state === 'playing') return;
  setState('loading');
  try {
    // Tạo/mở khóa AudioContext ngay trong cú bấm của người dùng.
    audio ??= createAudioEngine();
    await audio.resume();
    screens.showLoading('Đang tải bài hát…');

    const loaded = await loadSong(entry);
    song = loaded.song;
    await audio.load(loaded.audio);

    mic?.stop();
    mic = createMic({
      mode: requestedMic,
      targetHz: () => {
        const n = song && audio ? noteAt(song, audio.now()) : null;
        return n && n.type !== 'freestyle' ? pitchToHz(n.pitch) : null;
      },
    });
    const micMode = await mic.start(audio.ctx);
    hud.setNotice(
      micMode === 'real' ? null : requestedMic === 'real' ? 'Chế độ xem (không có micro)' : `Micro giả: ${micMode}`,
    );

    teleprompter?.dispose();
    teleprompter = createTeleprompter(uiRoot, song);
    scoring.reset(song);
    lastLine = -1;

    screens.hide();
    hud.setVisible(true);
    audio.play(LEAD_IN_SEC);
    setState('countdown');
  } catch (err) {
    console.error(err);
    screens.showError(`Không bắt đầu được: ${err instanceof Error ? err.message : String(err)}`);
    setState('menu');
  }
}

function finish(score: ScoreState): void {
  audio?.stop();
  mic?.stop();
  teleprompter?.setVisible(false);
  hud.setVisible(false);
  setState('result');
  bus.emit('songEnd', score);
  if (entry) screens.showResult(score, entry, mic?.mode ?? 'real');
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
  crowd.update(f);
  lights.update(f);
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
  bus,
  start,
  finish: () => { if (lastFrame) finish({ ...lastFrame.score }); },
};

hud.setVisible(false);
createLoop(tick).start();

loadManifest()
  .then((m) => {
    entry = m.songs[0] ?? null;
    if (!entry) throw new Error('manifest.json không có bài nào');
    screens.showStart(entry);
  })
  .catch((err) => {
    console.error(err);
    screens.showError(`Không tải được danh sách bài hát: ${err instanceof Error ? err.message : String(err)}`);
  });
