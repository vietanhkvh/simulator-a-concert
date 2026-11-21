import * as THREE from 'three';
/**
 * Nối dây toàn bộ game. Không chứa logic nghiệp vụ: chỉ khởi tạo module, dựng FrameState mỗi frame
 * và chuyển trạng thái menu → loading → countdown → playing → result.
 *
 * Tham số URL: ?fakeMic=perfect|off|octave  ?latency=<ms>  ?crowd=<số người>  ?dev=1|0 (chế độ developer)
 *   ?theme=chibi|lacquer|steel|pixel (phong cách; ưu tiên hơn lựa chọn đã lưu — docs/THEMES.md)
 *   ?quality=auto|ultra|high|medium|low (chất lượng đồ hoạ; ưu tiên hơn lựa chọn ở menu tạm dừng — world/quality.ts)
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
import { createWorld, rebuildWorld, type World } from './world/world';
import { isThemeCodeLoaded, loadThemeCode } from './world/shared/themeCode';
import { createQualityControl } from './world/quality';
import { isQualityMode } from './core/quality';
import {
  applyTheme, getActiveThemeId, getTheme, hexStr, isThemeId, listThemes, rememberTheme, resolveInitialThemeId, THEME_IDS, type ThemeId,
} from './world/style';
import { ENTRANCE_SEC, PLATFORMS, VIEW_MODES, type EntranceKind, type StageControls, type ViewMode } from './zones/arena';
import { createScoring } from './scoring/scoring';
import { createVoiceScoring } from './scoring/voice';
import { findChorusLines } from './song/chorus';
import { lyricIndexAt } from './song/lrc';
import { loadManifest, loadSong } from './song/loader';
import { loadLocalSong, songHasNotes } from './song/local';
import { createHud } from './ui/hud';
import { createHudMicMeter, createMicPanel } from './ui/micPanel';
import { createScreens, getLobbyEntrance, type LobbyEntrance } from './ui/screens';
import { createTeleprompter, createVideoPanel } from './ui/teleprompter';
import { hideBootLoader } from './core/webSupport';
import { createControlsGuide } from './ui/controlsGuide';
import {
  createPauseMenu, loadSettings, saveSettings, type SecretKind, type TestKind, type ViewName,
} from './ui/pauseMenu';
import { createDevPanel, devRequested, installDevLog, midiName, type DevEntrance, type DevHost, type DevMicMode } from './ui/devPanel';

// Chế độ developer: ghi nhật ký sự kiện/lỗi console ngay từ lúc tải (rẻ, không đổi gameplay).
installDevLog();

const LEAD_IN_SEC = 3;
const TAIL_SEC = 2;

const params = new URLSearchParams(location.search);
const fakeMicParam = params.get('fakeMic');
let requestedMic: MicMode =
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
// Cảnh 3D gồm ba khu (ngoài sân → khán đài → sân trung tâm), ghép ở world/world.ts.
// Phong cách (docs/THEMES.md): bật token + data-theme TRƯỚC khi dựng world. World được dựng cho phong cách đang bật
// và dựng lại (rebuildWorldNow) khi người chơi chọn phong cách khác ở sảnh rồi bấm Bắt đầu, hoặc từ bảng developer.
// Builder của phong cách không mặc định là chunk riêng (world/shared/themeCode.ts): chỉ tải phong cách đang chọn; tải lỗi → chibi.
applyTheme(await loadThemeCode(resolveInitialThemeId()).then(() => resolveInitialThemeId(), (err: unknown) => {
  console.warn('[theme] không tải được phong cách, dùng mặc định', err);
  return 'chibi' as const;
}));
// Chất lượng đồ hoạ (world/quality.ts): tự đo fps và hạ/nâng bậc; ?quality= hoặc menu tạm dừng để cố định.
const gfx = createQualityControl(params);
let world: World = createWorld(canvas, { crowdCount }, undefined, gfx.rendererInit());
let stage = world;
// Handle của khu sân trung tâm: khán giả sân, hiệu ứng, màn hình LED, đội quay phim, màn chào sân,
// điều khiển người chơi (phím V đổi góc nhìn xử lý trong khu). Gán lại trong bindWorld() sau mỗi lần dựng lại world.
let { crowd, led, confetti, emotes, stageFx, crew, entrance } = world.arena;
let controls: StageControls | null = world.arena.controls;
// Màn chào sân phát trước bài hát; ?entrance=jump|lift|cable|off.
const skipHint = document.createElement('div');
skipHint.className = 'cs-skip-hint';
skipHint.textContent = 'Enter: bỏ qua màn chào sân';
skipHint.hidden = true;
document.body.appendChild(skipHint);
const entranceParam = params.get('entrance');
/** ?entrance=jump|lift|cable|off (cũ: hero→jump, parachute→cable) ưu tiên hơn lựa chọn ở sảnh. */
function pickEntrance(): LobbyEntrance | null {
  if (devEntrance) { const k = devEntrance; devEntrance = null; return k; }
  if (entranceParam === 'off') return null;
  if (entranceParam === 'jump' || entranceParam === 'lift' || entranceParam === 'cable') return entranceParam;
  if (entranceParam === 'hero') return 'jump';
  if (entranceParam === 'parachute') return 'cable';
  return getLobbyEntrance();
}
/** Độ dài màn chào sân (giây), chịu được cả khi module entrance chưa có kiểu này. */
/** Chế độ developer: kiểu chào sân cho lần bắt đầu kế tiếp (ưu tiên hơn ?entrance=). */
let devEntrance: LobbyEntrance | null = null;
const entranceSec = (k: LobbyEntrance) => (ENTRANCE_SEC as Record<string, number>)[k] ?? 12;
// Màn đen chuyển cảnh (sảnh → sân khấu, kết quả → sảnh).
const fade = document.createElement('div');
fade.className = 'cs-fade';
document.body.appendChild(fade);
let fadeBusy = 0;
function fadeTo(opacity: number, ms: number): Promise<void> {
  fadeBusy++;
  fade.style.transitionDuration = `${ms}ms`;
  fade.style.opacity = String(opacity);
  return new Promise((r) => setTimeout(() => { fadeBusy--; r(); }, ms));
}
/** Đang trong màn chào sân thật (state 'intro'): hạn chót an toàn (performance.now ms). */
let introDeadline = 0;
let introKind: LobbyEntrance | null = null;
// Góc máy cho sự kiện bí mật: trên cao phía sau sân (z = -108), đủ xa để cả vùng diễn ra sự kiện (x ±45, y 22–60,
// z −15…−66) nằm trước ống kính. FOV giữ ≤ 52° để hai màn LED lớn (z = -75, y 15) nằm dưới mép khung, không lộ lưng màn hình.
const SECRET_CAM_HOME = new THREE.Vector3(0, 66, -108);
const SECRET_STAGE_AIM = new THREE.Vector3(0, 12, 0); // giữ sân khấu / khán giả một phần trong khung
const SECRET_EVENT_SIZE = 55; // kích thước điển hình của sự kiện (m)
const secretCamPos = SECRET_CAM_HOME.clone();
const secretCamTarget = new THREE.Vector3(0, 30, -30);
const secretCamPose = { position: secretCamPos, target: secretCamTarget, fov: 55 };
const secretGoal = new THREE.Vector3();
let secretViewAt = 0;
function secretView(): typeof secretCamPose | null {
  if (!secretPrevViewActive()) { secretViewAt = 0; return null; }
  const now = performance.now();
  const dt = secretViewAt ? Math.min(0.1, (now - secretViewAt) / 1000) : 0.016;
  secretViewAt = now;
  const k = 1 - Math.exp(-dt * 2.2); // làm mượt mọi thay đổi
  const focus = world.outside.getSecretFocus();
  // Điểm ngắm: nghiêng 70% về tâm sự kiện, 30% về sân khấu.
  // Giữ điểm ngắm trong lòng sân (x ±40, z −75…+15): sự kiện bay ra ngoài (máy bay, trực thăng) thì máy không quay theo
  // ra phía sau khán đài nữa.
  if (focus) {
    secretGoal.set(THREE.MathUtils.clamp(focus.x, -40, 40), THREE.MathUtils.clamp(focus.y, 8, 70), THREE.MathUtils.clamp(focus.z, -75, 15))
      .multiplyScalar(0.8).addScaledVector(SECRET_STAGE_AIM, 0.2);
  }
  else secretGoal.set(0, 30, -30);
  secretCamTarget.lerp(secretGoal, k);
  // Máy lệch ngang ngược phía tâm sự kiện một chút để có góc chéo, không bao giờ lùi ra sau hàng màn LED.
  const homeX = focus ? THREE.MathUtils.clamp(-focus.x * 0.35, -14, 14) : 0;
  secretGoal.set(homeX, SECRET_CAM_HOME.y, SECRET_CAM_HOME.z);
  secretCamPos.lerp(secretGoal, k * 0.6);
  const d = focus ? secretCamPos.distanceTo(focus) : 60;
  const fovGoal = THREE.MathUtils.clamp(2 * Math.atan((0.7 * SECRET_EVENT_SIZE) / Math.max(d, 1)) * 180 / Math.PI, 38, 52);
  secretCamPose.fov += (fovGoal - secretCamPose.fov) * k;
  return secretCamPose;
}
/** Nối lại mọi thứ main.ts giữ từ world (handle khu sân, điều khiển, góc máy, cài đặt đã lưu) sau khi world được dựng (lại). */
function bindWorld(w: World): void {
  world = w;
  stage = w;
  ({ crowd, led, confetti, emotes, stageFx, crew, entrance } = w.arena);
  controls = w.arena.controls;
  controls?.setViewProvider((m) => entrance.getView() ?? (m === 'wide' ? secretView() : null) ?? crew.getView(m), stage.scene);
  gfx.attach(w);
}
bindWorld(world);
window.addEventListener('cs-entrance', (e) => {
  const phase = (e as CustomEvent<{ phase: string }>).detail.phase;
  if (phase === 'land') {
    crowdAudio?.cheer(1);
    stageFx.pyro();
    emotes.burst(60);
  } else if (phase === 'end') {
    if (state === 'intro') { beginSong(); return; }
    const l = entrance.getLandingSpot();
    controls?.teleport(l.x, l.z, l.yaw, 0);
    controls?.setView('singer');
  }
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Enter' || isTypingTarget(e)) return;
  if (state === 'intro') { e.preventDefault(); skipIntro(); } else if (entrance.isPlaying()) entrance.skip();
});
function skipIntro(): void {
  if (state !== 'intro') return;
  if (entrance.isPlaying()) entrance.skip();
  beginSong();
}

// --- Sự kiện bí mật: chuyển sang góc toàn cảnh để thấy hết hiệu ứng, xong thì trả lại góc cũ ---
const secretBanner = document.createElement('div');
secretBanner.className = 'cs-secret-banner';
secretBanner.textContent = getTheme().strings.secretBanner;
secretBanner.hidden = true;
document.body.appendChild(secretBanner);
let secretPrevView: ViewName | null = null;
let secretCamOn = false;
function secretPrevViewActive(): boolean { return secretCamOn; }
let secretTimer = 0;
let bannerTimer = 0;
function restoreSecretView(): void {
  clearTimeout(secretTimer);
  if (secretPrevView && controls && controls.getViewMode() === 'wide') controls.setView(secretPrevView);
  secretPrevView = null;
  secretCamOn = false;
}
window.addEventListener('cs-secret', (e) => {
  const phase = (e as CustomEvent<{ phase: string }>).detail?.phase;
  if (phase === 'start') {
    if (!controls || pauseMenu.isOpen || state === 'intro' || entrance.isPlaying()) return;
    secretBanner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => { secretBanner.hidden = true; }, 2000);
    const cur = controls.getViewMode() as ViewName;
    secretCamOn = true;
    if (cur !== 'wide') { secretPrevView ??= cur; controls.setView('wide'); }
    clearTimeout(secretTimer);
    secretTimer = window.setTimeout(restoreSecretView, 30000);
  } else if (phase === 'end') {
    restoreSecretView();
  }
});
// Người chơi tự đổi góc máy trong lúc sự kiện → không trả lại nữa.
window.addEventListener('cs-view', (e) => {
  const m = (e as CustomEvent<{ mode: string }>).detail?.mode;
  if (secretPrevView && m !== 'wide') secretPrevView = null;
});
/** Màn chào sân đang chạy thì ẩn giao diện, chỉ để lại gợi ý bỏ qua (khu sân trung tâm tự cập nhật hình). */
function updateCinematicUi(): void {
  const cinematic = entrance.isPlaying();
  if (cinematic !== uiRoot.classList.contains('cs-cinematic')) {
    uiRoot.classList.toggle('cs-cinematic', cinematic);
    skipHint.hidden = !cinematic;
  }
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
  const ok = interactLocal(kind, test);
  if (ok) {
    const k = kind === 'fireworks' ? 'pyro' : kind;
    if (k !== 'sing') {
      const detail: { kind: string; on?: boolean } = { kind: k };
      if (k === 'flash') detail.on = flashOn;
      window.dispatchEvent(new CustomEvent('cs-interact', { detail }));
    }
  }
  return ok;
}
function interactLocal(kind: TestKind, test: boolean): boolean {
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

// --- API của khu ngoài sân (băng rôn, sự kiện bí mật, máy bay) — lấy qua world.outside ---
type OptionalApi = {
  setCheerBanners?: (lines: string[]) => void;
  triggerSecret?: (kind?: SecretKind, force?: boolean) => void;
  setSecretChances?: (c: Partial<Record<SecretKind, number>>) => void;
  SECRET_CHANCES?: Record<SecretKind, number>;
  triggerFlyby?: () => void;
};
const optional: OptionalApi = {
  setCheerBanners: (l) => world.outside.setCheerBanners(l),
  triggerSecret: (k, f) => world.outside.triggerSecret(k, f),
  setSecretChances: (c) => world.outside.setSecretChances(c),
  get SECRET_CHANCES() { return world.outside.secretChances; },
  triggerFlyby: () => world.outside.triggerFlyby(),
};
/** Tỉ lệ theo các khóa của SECRET_CHANCES (module quyết định có 'jet' chưa), giá trị lưu trong cài đặt được ưu tiên. */
function secretChances(): Record<SecretKind, number> {
  const base = (optional.SECRET_CHANCES ?? { ufo: 0.25, rocket: 0.2, dragon: 0.1 }) as Record<string, number>;
  const saved = (settings.chances ?? {}) as Record<string, number>;
  return Object.fromEntries(Object.keys(base).map((k) => [k, saved[k] ?? base[k]])) as Record<SecretKind, number>;
}
const optionalReady = Promise.resolve().then(() => {
  if (settings.banners.length) optional.setCheerBanners?.(settings.banners);
  if (settings.chances) optional.setSecretChances?.(settings.chances);
  pauseMenu.setSecretAvailable(
    !!optional.triggerSecret, !!optional.triggerFlyby,
    secretChances(),
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
const viewBtn = pill('cs-view-btn', 'Góc máy (V)', `Đổi góc máy: ${VIEW_MODES.map((v) => v.label.toLowerCase()).join(' → ')}`);
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
// Chip gợi ý điều khiển camera khi không ở góc ca sĩ (cạnh nút góc máy).
const viewHint = document.createElement('div');
viewHint.className = 'cs-view-hint';
viewHint.hidden = true;
uiRoot.append(topBar, lookHint, viewHint);
let hintMode = 'singer';
let hintFly = false;
function updateViewHint(): void {
  const on = hintMode !== 'singer' && state === 'playing';
  viewHint.hidden = !on;
  if (!on) return;
  const txt = 'Kéo chuột: xoay · Lăn: zoom · R/F: cao/thấp · 0: đặt lại' + (hintFly ? ' · WASD: bay · Shift: nhanh · G: thoát flycam' : ' · G: bay tự do');
  if (viewHint.textContent !== txt) viewHint.textContent = txt;
}
window.addEventListener('cs-view', (e) => { hintMode = String((e as CustomEvent<{ mode: string }>).detail?.mode ?? 'singer'); if (hintMode === 'singer') hintFly = false; updateViewHint(); });
window.addEventListener('cs-freefly', (e) => { hintFly = !!(e as CustomEvent<{ on: boolean }>).detail?.on; updateViewHint(); });
const VIEW_LABEL: Record<string, string> = Object.fromEntries(VIEW_MODES.map((v) => [v.id, v.label]));
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
  gfx: { get: () => ({ mode: gfx.mode, tier: gfx.status().tier }), set: (m) => gfx.setMode(m) },
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
  onEntrance: (k) => {
    if (!controls || state !== 'playing') return;
    controls.setView('crane');
    entrance.play(k as unknown as EntranceKind);
  },
  onChance: (k, v) => {
    const cur = settings.chances ?? { ...(optional.SECRET_CHANCES ?? { ufo: 0.25, rocket: 0.2, dragon: 0.1, jet: 0.15 }) };
    cur[k] = v;
    settings.chances = cur;
    saveSettings(settings);
    optional.setSecretChances?.({ [k]: v });
  },
  seekBy: (d) => panelControls.seekBy(d),
  seekTo: (sec) => panelControls.seekTo(sec),
  songTime: () => audio?.now() ?? 0,
  duration: () => songDuration(),
  onDevPanel: () => dev.show(),
  views: VIEW_MODES,
});
showView(controls?.getViewMode() ?? 'singer');
showLook(controls?.isMouseLook() ?? false);
pauseMenu.setThemeName(getTheme().strings.name);

// --- Phong cách: chọn ở sảnh (token + giao diện đổi ngay, world dựng lại khi bấm Bắt đầu) hoặc đổi ngay từ bảng developer ---
const buildTimes: Record<string, { buildMs: number; firstFrameMs: number }> = {};
/** Phong cách người chơi bấm sau cùng ở sảnh (chunk tải xong muộn không được ghi đè lựa chọn mới hơn). */
let themeWanted = '';
/** Chọn phong cách: bật token + CSS, ghi nhớ, cập nhật chữ theo phong cách. Chưa dựng lại world. */
function selectTheme(id: string, remember = true): boolean {
  if (!isThemeId(id)) return false;
  if (id !== getActiveThemeId()) applyTheme(id);
  if (remember) rememberTheme(id);
  secretBanner.textContent = getTheme().strings.secretBanner;
  pauseMenu.setThemeName(getTheme().strings.name);
  screens.syncTheme();
  return true;
}
/** World đang hiển thị được dựng cho phong cách khác phong cách đang bật? */
const worldStale = () => world.themeId !== getActiveThemeId();
/**
 * Huỷ world hiện tại và dựng world mới cho phong cách đang bật (cùng canvas + renderer), nối lại handle, khôi phục
 * vị trí/góc máy và các cài đặt runtime (đèn flash, chất lượng khán giả, video LED). Trả về thời gian (ms).
 */
function rebuildWorldNow(): { buildMs: number; firstFrameMs: number } {
  restoreSecretView();
  secretBanner.hidden = true;
  const prev = controls ? { view: controls.getViewMode(), pose: controls.getSingerPose(), yaw: controls.yaw, pitch: controls.pitch, look: controls.isMouseLook() } : null;
  const q = crowd.getQuality?.() ?? null;
  if (prev?.look) controls?.setMouseLook(false);
  bindWorld(rebuildWorld(world, canvas, { crowdCount }));
  if (prev && controls && (state === 'playing' || state === 'countdown')) {
    controls.teleport(prev.pose.position.x, prev.pose.position.z, prev.yaw, prev.pitch);
    controls.setView(prev.view);
  }
  if (q !== null) crowd.setQuality?.(q);
  crowd.setFlash(flashOn ? 1 : 0);
  ledVideo = null; // tick() gắn lại video cho màn LED mới
  showView(controls?.getViewMode() ?? 'singer');
  // Vẽ một frame ngay (dưới màn đen) để biên dịch shader, không khựng ở frame đầu sau khi sáng lại.
  const t1 = performance.now();
  if (lastFrame) world.update({ ...lastFrame, dt: 0 });
  stage.render();
  const times = { buildMs: Math.round(world.buildMs), firstFrameMs: Math.round(performance.now() - t1) };
  buildTimes[world.themeId] = times;
  return times;
}
/** Dev: dựng lại world `cycles` vòng qua mọi phong cách, so số geometry / texture / program của renderer trước–sau. */
function leakCheck(cycles = 3): unknown {
  if (state === 'loading' || state === 'intro') return { error: 'đang tải / chào sân' };
  const home = getActiveThemeId();
  const mem = () => { const i = stage.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0 }; };
  if (worldStale()) rebuildWorldNow();
  const before = mem();
  const perCycle: ReturnType<typeof mem>[] = [];
  const order = [...THEME_IDS.filter((t) => t !== home), home];
  for (let c = 0; c < cycles; c++) {
    for (const id of order) { applyTheme(id); rebuildWorldNow(); }
    perCycle.push(mem());
  }
  selectTheme(home, false);
  const after = mem();
  return { theme: home, cycles, before, after, perCycle, delta: { geometries: after.geometries - before.geometries, textures: after.textures - before.textures, programs: after.programs - before.programs } };
}

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
  if (state === 'intro') { skipIntro(); return; }
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
  void start(false);
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
  // Từ sảnh: có màn chào sân; "Hát lại" ở màn kết quả: không.
  onStart: () => void start(state === 'menu'),
  onLobby: () => void backToLobby(),
  themes: listThemes().map((t) => ({ id: t.id, name: t.strings.name, desc: t.strings.tagline, swatches: t.ui.swatches.map(hexStr) })),
  getTheme: () => getActiveThemeId(),
  // Phong cách chưa tải: thẻ hiện "Đang tải phong cách…" tới khi chunk về; lỗi → giữ phong cách hiện tại (screens báo).
  onTheme: (id) => {
    themeWanted = id;
    if (!isThemeId(id) || isThemeCodeLoaded(id)) { selectTheme(id); return; }
    return loadThemeCode(id).then(() => { if (themeWanted === id) selectTheme(id); });
  },
  onImport: (files) => {
    // Chạy trong chính sự kiện change/drop (cử chỉ người dùng) để mở khóa AudioContext/video.
    localFiles = files;
    void start(state === 'menu');
  },
});
/** Màn kết quả → sảnh, qua màn đen. */
async function backToLobby(): Promise<void> {
  if (state !== 'result' || fadeBusy) return;
  await fadeTo(1, 500);
  setState('menu');
  if (entry) screens.showStart(builtinEntry && !localFiles ? builtinEntry : entry);
  void fadeTo(0, 500);
}

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

async function start(withIntro = true): Promise<void> {
  if ((!entry && !localFiles) || state === 'loading' || state === 'intro' || state === 'countdown' || state === 'playing') return;
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
    teleprompter = null;
    hud.setPitchScore?.(hasNotes);
    scoring.reset(song);
    lastLine = -1;

    const entranceKind = withIntro && controls ? pickEntrance() : null;
    // Người chơi đã chọn phong cách khác ở sảnh: dựng lại cảnh 3D dưới màn đen (có thể mất một lúc).
    const stale = worldStale();
    if (!entranceKind) {
      if (stale) { await fadeTo(1, 300); rebuildWorldNow(); }
      screens.hide();
      beginSong();
      if (stale) void fadeTo(0, 600);
      return;
    }
    // Chuyển cảnh: sảnh tối dần → bật màn chào sân (chạy theo thời gian frame thật, chưa phát nhạc) → sáng dần.
    await fadeTo(1, 500);
    if (stale) rebuildWorldNow();
    screens.hide();
    introKind = entranceKind;
    introDeadline = performance.now() + (entranceSec(entranceKind) + 6) * 1000;
    setState('intro');
    controls?.setView('crane');
    entrance.play(entranceKind as unknown as EntranceKind);
    void fadeTo(0, 800);
  } catch (err) {
    console.error(err);
    releaseVideo();
    screens.showError(`Không bắt đầu được: ${err instanceof Error ? err.message : String(err)}`);
    setState('menu');
  }
}

/**
 * Sau màn chào sân (hoặc khi không có): đưa ca sĩ tới chỗ đáp, góc ca sĩ, hiện HUD/khung lời, phát nhạc
 * với LEAD_IN_SEC đếm ngược → 'countdown' → 'playing'.
 */
function beginSong(): void {
  if (state !== 'intro' && state !== 'loading') return;
  if (!audio || !song) return;
  if (state === 'intro' && controls) {
    const l = entrance.getLandingSpot();
    controls.teleport(l.x, l.z, l.yaw, 0);
    controls.setView('singer');
  }
  introKind = null;
  introDeadline = 0;
  teleprompter?.dispose();
  teleprompter = currentVideo ? createVideoPanel(uiRoot, currentVideo, panelControls) : createTeleprompter(uiRoot, song, panelControls);
  hud.setVisible(true);
  audio.play(LEAD_IN_SEC);
  setState('countdown');
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
  if (isTypingTarget(e)) return;
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

let lastRenderAt = 0;
let lastHudOverride = '';
function tick(dt: number): void {
  topBar.hidden = state !== 'playing';
  hintMode = controls?.getViewMode() ?? hintMode;
  updateViewHint();
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
  if (state === 'intro' && introDeadline && performance.now() > introDeadline) skipIntro();
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
    let pitch = devMicSilent ? null : mic.read();
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
  // Chế độ developer: khóa Hype hiển thị (hình + âm thanh); f.score (điểm, Hype của điểm) giữ nguyên.
  if (devHype !== null) f = { ...f, hype: devHype, waveMode: devHype > 0.7 || (state === 'playing' && performance.now() < waveUntil) ? 1 : 0 };
  // HUD: thanh Hype hiển thị giá trị đang bị khóa (dev) / xem trước (menu tạm dừng) kèm nhãn, không phải Hype thật.
  const hudOverride = devHype !== null ? `DEV|${devHype}` : paused ? `XEM|${previewHype}` : '';
  if (hudOverride !== lastHudOverride) {
    lastHudOverride = hudOverride;
    hud.setHypeOverride(devHype !== null ? devHype : paused ? previewHype : null, devHype !== null ? 'DEV' : 'XEM');
  }
  if (devCrowdSing && crowdSing) crowdSing.update(SING_TEST_NOTES[Math.floor(performance.now() / 500) % SING_TEST_NOTES.length], 0.8);
  dev.tick(dt);
  dev.setLobby(devLobbyLink && screens.isLobby());
  crowdAudio?.update(f);
  // Cập nhật cả ba khu (khán giả, đèn, hiệu ứng, camera, trời, khán đài…) trong một lời gọi.
  world.arena.setSong(state === 'countdown' || state === 'playing' ? song : null);
  world.update(f);
  updateCinematicUi();
  // Sảnh mờ đục che kín sân vận động: không vẽ 3D (tiết kiệm GPU), trừ khi đang chuyển cảnh; vẫn vẽ ~1 lần/giây để giữ ấm.
  const hidden = screens.isLobby() && !fadeBusy;
  // Tab ẩn: không vẽ (trình duyệt thường đã ngừng rAF, đây là chốt chặn khi nó vẫn gọi).
  if (!document.hidden && (!hidden || performance.now() - lastRenderAt > 1000)) {
    stage.render();
    lastRenderAt = performance.now();
  }
  // Bộ điều tốc chỉ đo khi cảnh được vẽ mỗi frame thật (không sảnh, không tạm dừng, tab hiện).
  gfx.frame(!hidden && !paused && !document.hidden);
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
  start: () => start(state === 'menu'),
  finish: () => { if (lastFrame) finish({ ...lastFrame.score }); },
  seek: (sec) => seekSong(sec),
};

// --- Chế độ developer (ui/devPanel.ts): bảng thử mọi tính năng + window.__dev cho kiểm thử tự động ---
let devHype: number | null = null;
let devMicSilent = false;
let devCrowdSing = false;
const TELEPORTS: Record<string, { x: number; z: number; yaw: number }> = {
  stage: { x: 0, z: 0, yaw: 0 },
  runwayEnd: { x: PLATFORMS.centre.x, z: PLATFORMS.centre.z, yaw: 0 },
  left: { x: PLATFORMS.left.x, z: PLATFORMS.left.z, yaw: 0 },
  right: { x: PLATFORMS.right.x, z: PLATFORMS.right.z, yaw: 0 },
  bstage: { x: PLATFORMS.bstage.x, z: PLATFORMS.bstage.z, yaw: 0 },
};
/** Bảng developer: chế độ + bậc chất lượng đồ hoạ, fps bộ điều tốc đo, tỉ lệ điểm ảnh. */
function gfxSnapshot(): Record<string, unknown> {
  const g = gfx.status();
  return { gfx: `${g.mode === 'auto' ? 'tự động' : 'cố định'} · ${g.tier}${g.ceiling !== 'ultra' ? ` (trần ${g.ceiling})` : ''}`, gfxFps: g.fps, pixelRatio: g.pixelRatio };
}
const devZone = (z: string) => (z === 'outside' ? world.outside : z === 'stands' ? world.stands : z === 'arena' ? world.arena : null);
const devHost: DevHost = {
  snapshot() {
    const f = lastFrame;
    const pose = controls?.getSingerPose();
    const pitch = f?.pitch ?? null;
    return {
      state, paused,
      songTime: +(audio?.now() ?? 0).toFixed(2), duration: +songDuration().toFixed(1),
      hype: f ? +f.hype.toFixed(3) : null, scoreHype: f ? +f.score.hype.toFixed(3) : null,
      score: f ? Math.round(f.score.score) : null,
      mic: mic?.mode ?? null, micReq: devMicSilent ? 'silent' : requestedMic,
      micLevel: mic?.level ? +mic.level().toFixed(3) : null,
      note: pitch ? `${midiName(pitch.midi)} ${pitch.hz.toFixed(0)}Hz` : null,
      view: controls?.getViewMode() ?? null, mouseLook: controls?.isMouseLook() ?? false,
      pos: pose ? { x: +pose.position.x.toFixed(2), z: +pose.position.z.toFixed(2) } : null,
      yawDeg: controls ? Math.round((controls.yaw * 180) / Math.PI) : null,
      crowd: crowdCount, crowdQ: crowd.getQuality ? +crowd.getQuality().toFixed(2) : null,
      ...gfxSnapshot(),
      secret: world.outside.getSecretFocus() ? 'đang diễn' : null,
      entrance: introKind ?? (entrance.isPlaying() ? 'preview' : null),
      ...world.stats(),
    };
  },
  startInstant() {
    if (state === 'menu' || state === 'result') void start(false);
  },
  startWithEntrance(k) {
    if (state !== 'menu' && state !== 'result') return;
    devEntrance = k;
    void start(true).finally(() => { devEntrance = null; });
  },
  restart: () => restartSong(),
  end: () => endConcert(),
  result() {
    if (state === 'playing' || state === 'countdown') endConcert();
    else if (state === 'menu' && entry) { screens.hide(); finish({ ...(lastFrame?.score ?? idleScore) }); }
  },
  seekBy: (d) => panelControls.seekBy(d),
  seekTo: (sec) => panelControls.seekTo(sec),
  chorusSec() {
    if (!song) return null;
    const i = [...chorusLines].sort((a, b) => a - b)[0];
    return i === undefined ? null : song.lines[i]?.startSec ?? null;
  },
  duration: () => songDuration(),
  setHypeLock(v) { devHype = v === null ? null : Math.max(0, Math.min(1, v)); },
  getHypeLock: () => devHype,
  setMicMode(m: DevMicMode) {
    devMicSilent = m === 'silent';
    requestedMic = m === 'silent' ? 'perfect' : m;
    if (audio && state !== 'menu' && state !== 'result') void reopenMic();
  },
  getMicMode: () => (devMicSilent ? 'silent' : requestedMic),
  setLatency(ms) {
    latencySec = Math.max(0, Math.min(400, ms)) / 1000;
    settings.latencyMs = Math.round(latencySec * 1000);
    saveSettings(settings);
  },
  getLatency: () => Math.round(latencySec * 1000),
  setSensitivity: (g) => mic?.setGain?.(g),
  interact: (k) => { interact(k, true); },
  pyro: () => stageFx.pyro(),
  confetti: () => confetti.burst(),
  emote: (k) => emotes.burst(60, k as Parameters<typeof emotes.burst>[1]),
  formation: (k) => emotes.formation?.(k as Parameters<typeof emotes.burst>[1]),
  emoteKinds: ['heart', 'star', 'note', 'fire', 'clap', 'face', 'hand', 'text', 'crown', 'party'],
  setCrowdSing(on) { devCrowdSing = on; if (!on) crowdSing?.update(null, 0); },
  getCrowdSing: () => devCrowdSing,
  secretKinds: () => Object.keys(secretChances()),
  secret: (k) => optional.triggerSecret?.(k as SecretKind, true),
  flyby: () => optional.triggerFlyby?.(),
  secretChances: () => secretChances(),
  setSecretChance(k, v) {
    const cur = { ...secretChances() };
    cur[k as SecretKind] = v;
    settings.chances = cur;
    saveSettings(settings);
    optional.setSecretChances?.({ [k]: v });
  },
  meteors: (n) => world.outside.triggerMeteors(n),
  entrancePreview(k: DevEntrance) {
    if (!controls || state === 'intro') return;
    controls.setView('crane');
    entrance.play(k as unknown as EntranceKind);
  },
  banners(lines) {
    settings.banners = lines;
    saveSettings(settings);
    optional.setCheerBanners?.(lines);
  },
  views: () => VIEW_MODES.map((v) => ({ id: v.id, label: v.label })),
  setView: (v) => controls?.setView(v as ViewMode),
  setMouseLook: (on) => controls?.setMouseLook(on),
  isMouseLook: () => controls?.isMouseLook() ?? false,
  teleportTargets: () => Object.keys(TELEPORTS),
  teleport(t) {
    const p = typeof t === 'string' ? TELEPORTS[t] : t;
    if (!p || !controls) return;
    controls.setView('singer');
    controls.teleport(p.x, p.z, p.yaw);
  },
  getLookSens: () => controls?.getLookSensitivity() ?? null,
  setLookSens: (v) => controls?.setLookSensitivity(v),
  setDebugCamera(p) {
    const fn = (controls as { setDebugCamera?: (p: unknown) => void } | null)?.setDebugCamera;
    if (typeof fn !== 'function') return false;
    fn(p);
    return true;
  },
  cameraPose: () => ({
    x: stage.camera.position.x, y: stage.camera.position.y, z: stage.camera.position.z,
    yaw: stage.camera.rotation.y, pitch: stage.camera.rotation.x,
  }),
  setZoneVisible: (z, on) => world.setZoneVisible(z, on),
  layers: (z) => devZone(z)?.debugLayers?.() ?? [],
  setLayerVisible: (z, n, on) => devZone(z)?.setLayerVisible?.(n, on) ?? false,
  isLayerVisible: (z, n) => devZone(z)?.isLayerVisible?.(n) ?? true,
  getCrowdQuality: () => crowd.getQuality?.() ?? null,
  setCrowdQuality: (q) => crowd.setQuality?.(q),
  reloadWithCrowd(n) {
    const u = new URL(location.href);
    u.searchParams.set('crowd', String(n));
    location.href = u.toString();
  },
  themes: () => listThemes().map((t) => ({ id: t.id, name: t.strings.name })),
  getTheme: () => getActiveThemeId(),
  setTheme(id) {
    if (!isThemeId(id) || state === 'loading' || state === 'intro') return false;
    const apply = () => { selectTheme(id); if (worldStale()) rebuildWorldNow(); };
    if (isThemeCodeLoaded(id)) apply();
    else void loadThemeCode(id).then(apply, (err: unknown) => console.warn('[theme] không tải được', id, err));
    return true;
  },
  // Dựng lại qua MỌI phong cách → tải đủ chunk phong cách trước.
  leakCheck: (cycles) => Promise.all(THEME_IDS.map((t) => loadThemeCode(t))).then(() => leakCheck(cycles)),
  buildTimes: () => ({ ...buildTimes }),
  quality: () => gfx.status(),
  setQualityMode: (m) => { if (isQualityMode(m)) gfx.setMode(m, false); },
  qualityReset: (t) => { if (isQualityMode(t) && t !== 'auto') gfx.resetAuto(t); },
};
const dev = createDevPanel(devHost, devRequested(params));
// ?dev=0: không hiện gì liên quan tới developer (cả link ở sảnh); phím ` / F2 vẫn bật được.
const devLobbyLink = params.get('dev') !== '0';
declare global {
  interface Window {
    /** Chế độ developer: các hành động của bảng developer (xem README "Chế độ developer"). */
    __dev: Record<string, unknown>;
  }
}
window.__dev = dev.api;

hud.setVisible(false);
createLoop(tick).start();

loadManifest()
  .then((m) => {
    builtinEntry = entry = m.songs[0] ?? null;
    if (!entry) throw new Error('manifest.json không có bài nào');
    screens.showStart(entry);
    hideBootLoader();
  })
  .catch((err) => {
    console.error(err);
    hideBootLoader();
    screens.showError(`Không tải được danh sách bài hát: ${err instanceof Error ? err.message : String(err)}`);
  });
