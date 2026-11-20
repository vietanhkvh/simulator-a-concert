# Vòng 1 — Đề xuất của Architect

Phạm vi: demo 1 (16:00 ICT) = 1 bài CC, micro, chấm cao độ, màn nhắc lời, 1 sân khấu, khán giả billboard lắc lightstick, thanh Hype. Web tĩnh, không server.

## 1. Module và ranh giới

| Module | Trách nhiệm | KHÔNG làm |
|---|---|---|
| `core/` (types, EventBus, GameLoop) | Type dùng chung, bus sự kiện, vòng `requestAnimationFrame`, máy trạng thái `menu → loading → countdown → playing → result` | Không biết Three.js hay Web Audio |
| `song/` (UltraStarParser, SongLoader) | Đọc `.txt` UltraStar → `Song`; tải audio thành `ArrayBuffer` | Không phát nhạc |
| `audio/AudioEngine` | Giữ `AudioContext` duy nhất, phát nhạc nền, **đồng hồ bài hát** (nguồn thời gian duy nhất), `AnalyserNode` cho đèn | Không chấm điểm |
| `mic/` (MicInput, PitchDetector) | Xin quyền micro, đọc buffer, trả `PitchSample` (Hz, độ rõ, âm lượng) | Không biết bài hát |
| `scoring/` (ScoringEngine, HypeMeter) | So `PitchSample` với nốt hiện tại → điểm; tính Hype 0..1 | Không vẽ gì |
| `render/StageScene` | Renderer, camera góc nhìn ca sĩ, sàn + khung sân khấu, resize | Không vẽ khán giả |
| `render/CrowdRenderer` | 1 `InstancedMesh` billboard + lightstick, mọi chuyển động trong shader | Không đọc audio trực tiếp |
| `render/StageLights` | Chùm sáng additive, nháy theo beat/Hype | Không nguồn sáng thật, không bóng |
| `ui/` (Teleprompter, Hud, Screens) | DOM/CSS thuần: 2 dòng lời tô theo âm tiết, thanh cao độ, điểm, Hype, màn start/kết quả, hiệu chỉnh trễ | Không đụng canvas WebGL |
| `main.ts` | Khởi tạo và nối dây tất cả | Không chứa logic |

Nguyên tắc: module chỉ import từ `core/`; không module nào import module ngang hàng. Mọi nối dây nằm ở `main.ts`.

## 2. Interface (đặt tại `src/core/types.ts`, đóng băng trước khi chia việc)

```ts
export type NoteType = 'normal' | 'golden' | 'freestyle';
export interface Note { startBeat: number; lengthBeats: number; pitch: number; // nửa cung, 0 = C4 (chuẩn UltraStar)
  text: string; type: NoteType; startSec: number; endSec: number; }   // startSec/endSec parser tính sẵn
export interface Line { notes: Note[]; startSec: number; endSec: number; }
export interface Song { title: string; artist: string; license: string; bpm: number; gapMs: number;
  audioUrl: string; lines: Line[]; durationSec: number; }

export interface FrameState {            // GameLoop dựng 1 lần / frame, truyền cho mọi module
  dt: number;            // giây từ frame trước
  songTime: number;      // giây, từ AudioEngine; âm khi đang đếm ngược
  beat: number;          // beat liên tục (float) tính từ BPM + GAP
  beatPulse: number;     // 1 tại đầu phách, giảm dần về 0
  level: number;         // 0..1 âm lượng nhạc nền (Analyser)
  hype: number;          // 0..1
  pitch: PitchSample | null;
  activeNote: Note | null; lineIndex: number;
}
export interface PitchSample { hz: number; midi: number; clarity: number; rms: number; }

// song/
export function parseUltraStar(txt: string, audioUrl: string): Song;   // hàm thuần, test được bằng node
export function loadSong(txtUrl: string): Promise<{ song: Song; audio: ArrayBuffer }>;
// audio/
export interface AudioEngine { ctx: AudioContext; load(buf: ArrayBuffer): Promise<void>;
  play(leadInSec: number): void; stop(): void; now(): number; level(): number; readonly ended: boolean; }
// mic/
export interface MicInput { start(ctx: AudioContext): Promise<void>; read(): PitchSample | null; stop(): void; }
// scoring/
export interface ScoringEngine { reset(song: Song): void;
  update(songTime: number, pitch: PitchSample | null, latencySec: number): ScoreState; }
export interface ScoreState { score: number; combo: number; hype: number; activeNote: Note | null;
  lineIndex: number; lastHit: 'hit' | 'miss' | 'none'; centsOff: number | null; }
// render/ và ui/ — cùng một hợp đồng
export interface Updatable { update(f: FrameState): void; dispose(): void; }
export interface CrowdOptions { count: number; rows: number; arcDeg: number; }
export function createStage(canvas: HTMLCanvasElement): { scene: THREE.Scene; camera: THREE.Camera; render(): void } & Updatable;
export function createCrowd(scene: THREE.Scene, o: CrowdOptions): Updatable;
export function createLights(scene: THREE.Scene): Updatable;
export function createTeleprompter(root: HTMLElement, song: Song): Updatable;
export function createHud(root: HTMLElement): Updatable & { showResult(s: ScoreState): void };

// Sự kiện (EventBus): 'state' (GameState), 'lineStart' (index), 'noteHit' / 'noteMiss' (Note), 'songEnd'
```

Quy ước chốt cứng:
- **Thời gian:** `songTime = ctx.currentTime - startAt`. Không module nào dùng `performance.now()` hay `Date`.
- **Beat UltraStar:** `sec = gapMs/1000 + beat * 60 / (bpm * 4)`. BPM trong file có thể dùng dấu phẩy thập phân (`315,08`). Dòng `-` ngắt câu, `E` kết thúc.
- **Chấm cao độ:** so theo lớp nốt (bỏ qua quãng tám), sai lệch ≤ 1 nửa cung là trúng; `clarity < 0.85` hoặc `rms` thấp coi như im lặng.
- **Hype:** tăng khi trúng, giảm chậm khi trượt, làm mượt (lerp) trước khi đưa vào shader.

Luồng mỗi frame (trong `GameLoop`):
1. `songTime = audio.now()`, tính `beat`, `beatPulse`, `level`.
2. `pitch = mic.read()`.
3. `score = scoring.update(songTime, pitch, latency)` → `hype`, `activeNote`, `lineIndex`.
4. Dựng `FrameState`, gọi `update(f)` lần lượt: crowd → lights → teleprompter → hud → `stage.render()`.

Shader khán giả chỉ nhận uniform: `uTime, uBeat, uBeatPulse, uHype, uColorA, uColorB`. Thuộc tính mỗi instance: vị trí, `seed` (pha lệch), `section`.

## 3. Cấu trúc repo và gói việc

```
index.html  package.json  vite.config.ts  tsconfig.json
public/songs/<id>/{song.txt, instrumental.mp3, license.txt}   public/songs/manifest.json
src/main.ts
src/core/{types.ts, events.ts, loop.ts}
src/song/{ultrastar.ts, loader.ts, ultrastar.test.ts}
src/audio/engine.ts
src/mic/{input.ts, pitch.ts}
src/scoring/{scoring.ts, hype.ts}
src/render/{stage.ts, crowd.ts, crowd.vert.glsl, crowd.frag.glsl, lights.ts}
src/ui/{teleprompter.ts, hud.ts, screens.ts, style.css}
src/dev/mocks.ts          # FrameState giả (hype dao động, pitch giả) để mỗi gói tự chạy độc lập
docs/
```

| Gói | File sở hữu | Model | Ghi chú |
|---|---|---|---|
| P0 Khung + hợp đồng | config, `core/*`, `dev/mocks.ts`, `main.ts` khung, `public/songs/*` | Architect tự làm | Phải xong trước, ~20 phút. Các gói khác chỉ bắt đầu sau P0 |
| P1 Khán giả + lightstick | `render/crowd.*` | **Opus** | Khó: instancing, shader, 5.000 instance ≤ 2 draw call |
| P2 Micro + cao độ | `mic/*` | **Opus** | Khó: pitchy (McLeod), lọc nhiễu, làm mượt, đo độ trễ |
| P3 Parser + AudioEngine | `song/*`, `audio/*` | Sonnet | Parser có unit test chạy bằng node |
| P4 Chấm điểm + Hype | `scoring/*` | Sonnet | Hàm thuần, test bằng dữ liệu giả |
| P5 Teleprompter + HUD + màn hình | `ui/*` | Sonnet | DOM thuần, chạy với `mocks.ts` |
| P6 Sân khấu + đèn | `render/stage.ts`, `render/lights.ts` | Sonnet | Đơn giản, làm sau P0 |
| P7 Tích hợp + kiểm thử | `main.ts` | Architect | Nối dây, sửa lệch hợp đồng, build |

Mỗi gói chỉ sửa file của mình. Cần đổi `core/types.ts` thì báo Architect, không tự sửa.

## 4. Thứ tự tích hợp và rủi ro

Thứ tự: P0 → (P1…P6 song song) → ghép P3 + P5 (nhạc chạy, lời chạy đúng nhịp) → thêm P2 + P4 (micro, điểm, Hype) → thêm P1 + P6 (hình ảnh theo Hype) → build tĩnh, kiểm thử bằng Chromium headless.

| Rủi ro | Xử lý |
|---|---|
| Autoplay: `AudioContext` bị khóa tới khi có thao tác người dùng | Nút "Bắt đầu" tạo/resume context và xin micro trong cùng một cú bấm |
| Micro cần HTTPS hoặc `localhost`; trong iframe cần quyền `microphone` | Demo qua `vite preview` / hosting HTTPS. Nếu giao qua link nhúng mà micro bị chặn → có **chế độ không micro** (điểm tự chạy) để vẫn xem được hình ảnh |
| Độ trễ micro làm lệch điểm | Hằng số bù mặc định ~120 ms + thanh trượt trong màn start; cửa sổ chấm rộng |
| Nhạc nền lọt vào micro (dùng loa) | Khuyến nghị tai nghe; `echoCancellation: false` để không méo cao độ, ngưỡng `rms` |
| Kiểm thử tự động không có micro thật | Chromium cờ `--use-fake-device-for-media-stream` + file wav giả; parser/scoring test bằng node |
| Lệch hợp đồng giữa các gói | `tsc --noEmit` là cổng bắt buộc của mỗi gói; `FrameState` là điểm ghép duy nhất |
| Import `.glsl` | Dùng hậu tố `?raw` của Vite, không thêm plugin |
| Trễ deadline | Thứ tự cắt: đèn sân khấu → golden note → thanh cao độ. Không cắt: lời chạy, điểm, lightstick theo Hype |

## 5. Kiểm tra môi trường (kết quả thật, 20/11 ~11:40 ICT)

- Node v22.23.5, npm 10.9.9.
- npm registry **truy cập được**: `three` 0.187.0, `pitchy` 4.1.0, `vite` 8.3.8.
- `git clone --depth 1 https://github.com/UltraStar-Deluxe/songs` **thành công**: 578 MB, 42 bài trong `Creative Commons/`, 6 bài có sẵn bản instrumental + `instrumental.txt`. Tất cả `.txt` có nốt cao độ theo beat.

Đề xuất bài cho demo:

| | Bài chính | Bài dự phòng |
|---|---|---|
| Bài | Silver Note — *Chasing Marks* | Shearer — *Stay with me* |
| License | **CC BY 4.0** (dùng thương mại được, chỉ cần ghi công) | CC BY-NC-SA 2.0 (phi thương mại, phải bỏ khi thu tiền) |
| Audio dùng | `instrumental.mp3`, 4,68 MB, 192 kbps | `instrumental.ogg`, 5,34 MB |
| Nốt cao độ | Có: 241 nốt thường + 11 nốt đặc biệt, quãng pitch 7..31 | Có: 373 nốt |
| BPM / GAP | 260 / 7,66 s | 294,06 / 1,88 s |

Lưu ý về *Chasing Marks*:
- Là nhạc fan *My Little Pony* (tag `EDITION`, ảnh bìa/nền theo chủ đề đó). Demo **chỉ lấy `song.txt`/`instrumental.txt`, `instrumental.mp3`, `license.txt`**, không dùng ảnh bìa và ảnh nền (ảnh nền của bài cùng tác giả có license NC riêng).
- Header `song.txt` ghi `#MP3:song.mp3` nhưng file thật là `audio.ogg` → loader không tin header, `manifest.json` tự khai đường dẫn audio.
- Phải hiện dòng ghi công "Chasing Marks — Silver Note, CC BY 4.0" trên màn start/kết quả.
- Các bài loại: *Space Invaders* (BY-NC-**ND**, không cho phái sinh), các bài Shearer khác có đoạn dạo quá dài (GAP 11–29 s).

Tối ưu dung lượng (không bắt buộc cho demo 1): mã hóa lại sang Opus 96 kbps còn ~2,3 MB — cần kiểm tra `ffmpeg` có trong môi trường không.

## Câu hỏi cho PM và Game Dev
1. Demo giao bằng cách nào (link nhúng hay build tĩnh tự mở)? Quyết định việc micro có chạy trong iframe hay không.
2. Game Dev: xác nhận bộ uniform của shader khán giả ở mục 2 đủ cho wave/đổi màu về sau, hay cần thêm `uWavePhase` ngay từ đầu.
3. PM: đồng ý thứ tự cắt giảm ở mục 4 không.
