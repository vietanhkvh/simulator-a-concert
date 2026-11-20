/**
 * HỢP ĐỒNG ĐÓNG BĂNG giữa các module (P0). Các gói P1–P6 KHÔNG tự sửa file này;
 * cần đổi thì báo Architect. Module chỉ import từ `core/`, không import module ngang hàng.
 */
import type * as THREE from 'three';

// ───────────────────────── Bài hát ─────────────────────────

export type NoteType = 'normal' | 'golden' | 'freestyle';

export interface Note {
  /** Beat UltraStar (đơn vị trong file .txt). */
  startBeat: number;
  lengthBeats: number;
  /** Nửa cung theo chuẩn UltraStar: 0 = C4 (MIDI 60). midi = pitch + 60. */
  pitch: number;
  /** Âm tiết, giữ nguyên dấu cách đầu/cuối của file gốc (dấu cách = ranh giới từ). */
  text: string;
  type: NoteType;
  /** Parser tính sẵn: sec = gapMs/1000 + beat * 60 / (bpm * 4). */
  startSec: number;
  endSec: number;
}

export interface Line {
  notes: Note[];
  startSec: number;
  endSec: number;
}

/** Một mục trong public/songs/manifest.json. */
export interface SongManifestEntry {
  id: string;
  title: string;
  artist: string;
  license: string;
  licenseUrl: string;
  /** Dòng ghi công hiện trên màn bắt đầu và màn kết quả. */
  attribution: string;
  sourceUrl: string;
  /** Đường dẫn tương đối so với gốc trang (không có dấu / đầu). */
  notesUrl: string;
  audioUrl: string;
  /** Tempo thật của bài (phách đen/phút) cho khán giả và đèn. KHÁC với #BPM của UltraStar. */
  visualBpm: number;
  /** Cộng thêm vào #GAP nếu nốt lệch so với audio (ms). */
  gapOffsetMs: number;
  notes?: string;
}

export interface SongManifest {
  songs: SongManifestEntry[];
}

export interface Song {
  title: string;
  artist: string;
  license: string;
  attribution: string;
  /** #BPM của UltraStar (đã đổi dấu phẩy thập phân). */
  bpm: number;
  /** #GAP + gapOffsetMs. */
  gapMs: number;
  visualBpm: number;
  audioUrl: string;
  lines: Line[];
  /** Thời điểm kết thúc nốt cuối (giây). Độ dài audio lấy từ AudioEngine.durationSec. */
  durationSec: number;
  /**
   * Nguồn/kiểu bài (bổ sung khi nhập file từ máy). Không có = 'ultrastar' (bài có sẵn).
   * 'ultrastar' có nốt; 'lrc' chỉ có lời theo câu; 'video' / 'audio' không có lời.
   */
  mode?: SongMode;
  /** false = không có nốt → không chấm cao độ (Hype theo giọng). Không có = true. */
  hasNotes?: boolean;
  /** Lời theo câu (chế độ 'lrc'). */
  lyrics?: LyricLine[];
}

export type SongMode = 'ultrastar' | 'lrc' | 'video' | 'audio';

/** Một câu lời từ file .lrc (đã cộng offset). endSec = mốc của câu kế tiếp. */
export interface LyricLine {
  startSec: number;
  endSec: number;
  text: string;
}

// ───────────────────────── Micro ─────────────────────────

export interface PitchSample {
  hz: number;
  /** MIDI dạng số thực: 69 + 12*log2(hz/440). */
  midi: number;
  /** 0..1 từ pitchy. */
  clarity: number;
  rms: number;
}

/** 'real' = micro thật; còn lại là micro giả bằng oscillator (?fakeMic=). */
export type MicMode = 'real' | 'perfect' | 'off' | 'octave';

export interface MicOptions {
  mode: MicMode;
  /**
   * Tần số mục tiêu tại thời điểm hiện tại (null = đang nghỉ). main.ts cung cấp;
   * chỉ micro giả dùng. Nhờ vậy module mic không biết gì về bài hát.
   */
  targetHz: () => number | null;
  /**
   * Bật khử vọng/khử ồn của trình duyệt. Dùng cho bài không có nốt (chỉ cần biết có đang hát
   * hay không) để tiếng nhạc lọt từ loa vào micro không bị tính là giọng hát.
   */
  voiceProcessing?: boolean;
  /** deviceId của micro người chơi chọn (bỏ trống = micro mặc định của hệ thống). */
  deviceId?: string;
  /**
   * Tên (label) của micro đã chọn: deviceId đổi giữa các phiên (Safari, Firefox, sau khi cấp quyền)
   * nên khi không thấy id thì tìm lại theo tên.
   */
  deviceLabel?: string;
  /** Gain phần mềm trước bộ phân tích (0.5–8, mặc định 2). */
  gain?: number;
  /** Báo trạng thái micro (mở được / lỗi / thiết bị bị rút…) để UI hiển thị. */
  onStatus?: (s: MicStatus) => void;
}

/** Trạng thái micro thật để hiển thị cho người chơi (tiếng Việt). */
export interface MicStatus {
  /** true = đang thu từ micro thật. */
  ok: boolean;
  /** Một dòng tiếng Việt mô tả trạng thái. */
  message: string;
  /** Tên thiết bị thực sự đang mở ('' nếu không có). */
  label: string;
  deviceId: string;
  /** Tần số lấy mẫu của micro (từ track.getSettings), null nếu trình duyệt không báo. */
  sampleRate: number | null;
  /** Tần số lấy mẫu của AudioContext dùng để phân tích. */
  ctxSampleRate: number | null;
  /** Không mở được thiết bị đã chọn nên đang dùng micro mặc định. */
  fellBack?: boolean;
  /** Phân tích trong AudioContext riêng (do lệch sample rate với context của game). */
  separateContext?: boolean;
  /** Mã lỗi DOMException (NotAllowedError, NotFoundError, …) nếu có. */
  error?: string;
}

export interface MicInput {
  /**
   * Bắt đầu thu. KHÔNG reject khi bị từ chối quyền / không có thiết bị: khi đó tự chuyển
   * sang micro giả 'perfect' và resolve với mode thực tế đang dùng.
   */
  start(ctx: AudioContext): Promise<MicMode>;
  /** Mẫu cao độ mới nhất đã lọc (clarity/RMS, trung vị 3 mẫu); null = im lặng. */
  read(): PitchSample | null;
  stop(): void;
  /** Mode thực tế đang dùng (sau start). */
  readonly mode: MicMode;
  /** Mức tín hiệu vào hiện tại (RMS sau gain, 0..1); 0 khi không thu. */
  level?(): number;
  /** Đổi gain phần mềm khi đang chạy. */
  setGain?(g: number): void;
  /** Trạng thái micro thật gần nhất (null nếu chưa start hoặc là micro giả). */
  readonly status?: MicStatus | null;
}

// ───────────────────────── Âm thanh ─────────────────────────

export interface AudioEngine {
  readonly ctx: AudioContext;
  /** Gọi trong cú bấm của người dùng để mở khóa AudioContext. */
  resume(): Promise<void>;
  load(buf: ArrayBuffer): Promise<void>;
  /**
   * (Bổ sung) Dùng <video>/<audio> làm nguồn nhạc thay cho buffer: âm thanh đi qua
   * createMediaElementSource → cùng analyser (level()), đồng hồ now() lấy từ el.currentTime.
   * Gọi load() sau đó sẽ quay lại chế độ buffer.
   */
  loadMedia?(el: HTMLMediaElement): Promise<void>;
  /** Phát sau leadInSec giây; trong lúc chờ now() âm. */
  play(leadInSec: number): void;
  stop(): void;
  /**
   * (Bổ sung) Tua tới giây `sec` của bài (kẹp vào [0, durationSec - 1]); now() liên tục từ vị trí mới.
   * Chạy được cả khi AudioContext đang treo (tạm dừng): resume thì phát tiếp từ vị trí mới.
   * Không làm `ended` bật. Không có tác dụng khi chưa play().
   */
  seek?(sec: number): void;
  /**
   * (Bổ sung) Dừng riêng nhạc ở vị trí hiện tại (AudioContext vẫn chạy cho tiếng đám đông / thử micro).
   * Trong lúc dừng now() đứng yên; seek() chỉ dời vị trí. resumeMusic() phát tiếp đúng vị trí đó.
   */
  pauseMusic?(): void;
  resumeMusic?(): void;
  readonly musicPaused?: boolean;
  /** (Bổ sung) Âm lượng nhạc 0..2 (1 = gốc). Không ảnh hưởng level(). */
  setVolume?(v: number): void;
  /**
   * Đồng hồ bài hát (giây) = ctx.currentTime - startAt - outputLatency.
   * Nguồn thời gian DUY NHẤT cho lời, nốt, beat, shader. Trả 0 khi chưa play.
   */
  now(): number;
  /** 0..1 âm lượng nhạc nền (AnalyserNode). */
  level(): number;
  readonly ended: boolean;
  /** Độ dài audio (giây), 0 khi chưa load. */
  readonly durationSec: number;
}

// ───────────────────────── Chấm điểm ─────────────────────────

export interface ScoreState {
  /** Điểm tích lũy (đơn vị tùy ScoringEngine). */
  score: number;
  /** 0..100: tỉ lệ đạt so với tối đa của phần bài ĐÃ QUA (cuối bài = điểm cuối). */
  percent: number;
  combo: number;
  /** 0..1, ĐÃ làm mượt (lerp ~0,5 s), dùng thẳng cho shader/HUD. */
  hype: number;
  activeNote: Note | null;
  /** Câu hiện tại hoặc câu sắp tới; -1 trước câu đầu. */
  lineIndex: number;
  lastHit: 'hit' | 'miss' | 'none';
  /** Lệch so với nốt mục tiêu sau khi bỏ quãng tám (cent, -600..600); null khi không có. */
  centsOff: number | null;
}

export interface ScoringEngine {
  reset(song: Song): void;
  /**
   * Gọi mỗi frame. pitch được coi là hát tại (songTime - latencySec).
   * dt (giây) dùng cho tích phân Hype.
   */
  update(songTime: number, pitch: PitchSample | null, latencySec: number, dt: number): ScoreState;
  /**
   * (Bổ sung) Báo bài vừa bị tua tới songTime (giây, cùng thang với update). Nốt bị nhảy qua không tính
   * là trượt; tua lùi thì nốt từ thời điểm mới trở đi được hát lại (xóa phần đã tính). Hype giữ nguyên.
   * update() cũng tự nhận ra khi đồng hồ nhảy > 1 s.
   */
  seek?(songTime: number, latencySec?: number): void;
}

// ───────────────────────── Frame ─────────────────────────

export type WaveMode = 0 | 1 | 2;

/** main.ts dựng 1 lần / frame rồi truyền cho mọi Updatable. Điểm ghép duy nhất. */
export interface FrameState {
  /** Giây từ frame trước (đã kẹp ≤ 0,1). */
  dt: number;
  /** Giây, từ AudioEngine.now(); âm khi đang đếm ngược. */
  songTime: number;
  /** Phách liên tục theo visualBpm: (songTime - gapSec) * visualBpm / 60. */
  beat: number;
  /** 1 tại đầu phách, giảm dần về 0. */
  beatPulse: number;
  /** 0..1 âm lượng nhạc nền. */
  level: number;
  /** 0..1 (đã mượt). */
  hype: number;
  /** 0 = đồng màu, 1 = sóng màu (main.ts đặt 1 khi hype > 0,7), 2 = dự trữ. */
  waveMode: WaveMode;
  pitch: PitchSample | null;
  activeNote: Note | null;
  lineIndex: number;
  score: ScoreState;
}

export interface Updatable {
  update(f: FrameState): void;
  dispose(): void;
}

// ───────────────────────── Render ─────────────────────────

export interface CrowdOptions {
  /** Demo 1: 2500 (đổi bằng ?crowd=). */
  count: number;
  rows: number;
  arcDeg: number;
}

export interface Stage extends Updatable {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** Gọi cuối mỗi frame, sau khi mọi Updatable đã update. */
  render(): void;
}

// ───────────────────────── UI ─────────────────────────

export interface Hud extends Updatable {
  /** Nhãn nhỏ góc màn hình, ví dụ "Chế độ xem"; null để ẩn. */
  setNotice(text: string | null): void;
  setVisible(v: boolean): void;
  /** false = chế độ không có nốt: ẩn %/điểm, hiện "—". Tùy chọn (bổ sung). */
  setPitchScore?(on: boolean): void;
}

export interface Teleprompter extends Updatable {
  setVisible(v: boolean): void;
  /** (Bổ sung) Thu nhỏ / mở rộng khung lời (nhớ trong localStorage). */
  setMinimized?(on: boolean): void;
  readonly minimized?: boolean;
}

/** (Bổ sung) Điều khiển tua cho thanh nhỏ trên khung lời / video. */
export interface PanelControls {
  /** Tua tới giây tuyệt đối. */
  seekTo(sec: number): void;
  /** Tua tương đối (± giây). */
  seekBy(deltaSec: number): void;
  /** Độ dài bài (giây). */
  duration(): number;
}

export interface ScreensOptions {
  /** Người dùng bấm "Bắt đầu" (hoặc "Hát lại"). Gọi trong chính sự kiện click. */
  onStart: () => void;
  /** Người chơi chọn/thả file từ máy (xử lý cục bộ, không upload). Tùy chọn (bổ sung). */
  onImport?: (files: File[]) => void;
  /** Nút "Về sảnh" trên màn kết quả (bổ sung). */
  onLobby?: () => void;
}

export interface Screens {
  /** Màn bắt đầu: tên bài, dòng ghi công, nhắc đeo tai nghe, nút Bắt đầu. */
  showStart(entry: SongManifestEntry): void;
  showLoading(text: string): void;
  /** Màn kết quả: điểm %, dòng ghi công, nút hát lại. */
  showResult(score: ScoreState, entry: SongManifestEntry, micMode: MicMode, opts?: { pitchScore?: boolean }): void;
  showError(text: string): void;
  hide(): void;
  dispose(): void;
}

// ───────────────────────── Trạng thái & sự kiện ─────────────────────────

export type GameState = 'menu' | 'loading' | 'intro' | 'countdown' | 'playing' | 'result';

export interface GameEvents {
  state: GameState;
  lineStart: number;
  noteHit: Note;
  noteMiss: Note;
  songEnd: ScoreState;
}

/**
 * Chữ ký factory mà mỗi gói phải export (tên file trong ngoặc):
 *   parseUltraStar(txt, entry): Song                        (song/ultrastar.ts)  — hàm thuần
 *   loadSong(entry): Promise<{ song: Song; audio: ArrayBuffer }> (song/loader.ts)
 *   createAudioEngine(): AudioEngine                         (audio/engine.ts)
 *   createMic(opts: MicOptions): MicInput                    (mic/input.ts)
 *   createScoring(): ScoringEngine                           (scoring/scoring.ts)
 *   createStage(canvas): Stage                               (render/stage.ts)
 *   createCrowd(scene, opts: CrowdOptions): Updatable        (render/crowd.ts)
 *   createLights(scene): Updatable                           (render/lights.ts)
 *   createTeleprompter(root, song): Teleprompter             (ui/teleprompter.ts)
 *   createHud(root): Hud                                     (ui/hud.ts)
 *   createScreens(root, opts: ScreensOptions): Screens       (ui/screens.ts)
 */
export type FactoryContract = never;
