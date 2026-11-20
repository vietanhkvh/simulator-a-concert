/**
 * Nhập bài từ máy người chơi. MỌI THỨ XỬ LÝ CỤC BỘ: File API (file.text()/arrayBuffer()) và object URL,
 * không upload, không gửi request mạng nào cho file của người dùng.
 */
import type { Song, SongManifestEntry, SongMode } from '../core/types';
import { parseLrc } from './lrc';
import { parseUltraStar } from './ultrastar';

export const DEFAULT_VISUAL_BPM = 120;

export type FileKind = 'audio' | 'video' | 'ultrastar' | 'lrc' | 'unknown';

const AUDIO_EXT = ['mp3', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac', 'flac', 'weba'];
const VIDEO_EXT = ['mp4', 'webm', 'm4v', 'mov', 'mkv', 'ogv'];

export interface FileLike {
  name: string;
  type: string;
}

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function classifyFile(f: FileLike): FileKind {
  const e = ext(f.name);
  const type = (f.type || '').toLowerCase();
  if (e === 'lrc') return 'lrc';
  if (e === 'txt' || type === 'text/plain') return 'ultrastar';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (VIDEO_EXT.includes(e)) return 'video';
  if (AUDIO_EXT.includes(e)) return 'audio';
  return 'unknown';
}

export type ImportPlan<T extends FileLike> =
  | { mode: 'ultrastar'; audio: T; notes: T; ignored: T[] }
  | { mode: 'lrc'; audio: T; lrc: T; ignored: T[] }
  | { mode: 'video'; video: T; ignored: T[] }
  | { mode: 'audio'; audio: T; ignored: T[] }
  | { mode: 'error'; message: string };

/**
 * Hàm thuần: nhận diện tổ hợp file.
 *   audio + .txt → 'ultrastar' (ưu tiên hơn .lrc nếu có cả hai)
 *   audio + .lrc → 'lrc'
 *   video (không có audio) → 'video'
 *   audio → 'audio' (hát tự do)
 */
export function detectImport<T extends FileLike>(files: readonly T[]): ImportPlan<T> {
  const by: Record<FileKind, T[]> = { audio: [], video: [], ultrastar: [], lrc: [], unknown: [] };
  for (const f of files) by[classifyFile(f)].push(f);
  const pick = (k: FileKind) => by[k][0];
  const ignoredExcept = (...used: T[]) => files.filter((f) => !used.includes(f));
  const audio = pick('audio');
  if (audio) {
    const notes = pick('ultrastar');
    if (notes) return { mode: 'ultrastar', audio, notes, ignored: ignoredExcept(audio, notes) };
    const lrc = pick('lrc');
    if (lrc) return { mode: 'lrc', audio, lrc, ignored: ignoredExcept(audio, lrc) };
    return { mode: 'audio', audio, ignored: ignoredExcept(audio) };
  }
  const video = pick('video');
  if (video) return { mode: 'video', video, ignored: ignoredExcept(video) };
  if (by.ultrastar.length || by.lrc.length) {
    return { mode: 'error', message: 'Cần chọn thêm file nhạc (mp3, ogg, wav, m4a…) đi kèm file lời.' };
  }
  return { mode: 'error', message: 'Không nhận ra file. Hãy chọn file nhạc/video, có thể kèm UltraStar .txt hoặc .lrc.' };
}

export function baseName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

/** Mục manifest giả cho bài nhập từ máy (để tái dùng parser và màn kết quả). */
export function localEntry(title: string, artist: string): SongManifestEntry {
  return {
    id: 'local', title, artist, license: '', licenseUrl: '', attribution: 'Bài nhập từ máy của bạn',
    sourceUrl: '', notesUrl: '', audioUrl: '', visualBpm: DEFAULT_VISUAL_BPM, gapOffsetMs: 0,
  };
}

function emptySong(mode: SongMode, title: string, artist: string): Song {
  return {
    title, artist, license: '', attribution: 'Bài nhập từ máy của bạn', bpm: 120, gapMs: 0,
    visualBpm: DEFAULT_VISUAL_BPM, audioUrl: '', lines: [], durationSec: 0, mode, hasNotes: false,
  };
}

export interface LocalSong {
  song: Song;
  entry: SongManifestEntry;
  /** Audio để decodeAudioData (chế độ ultrastar/lrc/audio). */
  audio?: ArrayBuffer;
  /** File video (chế độ video); main.ts tạo <video> bằng object URL. */
  video?: File;
}

/** Song có chấm cao độ hay không (bài có sẵn luôn có). */
export function songHasNotes(song: Song): boolean {
  return song.hasNotes !== false && song.lines.length > 0;
}

export async function loadLocalSong(files: File[]): Promise<LocalSong> {
  const plan = detectImport(files);
  if (plan.mode === 'error') throw new Error(plan.message);
  if (plan.mode === 'video') {
    const song = emptySong('video', baseName(plan.video.name), '');
    return { song, entry: localEntry(song.title, ''), video: plan.video };
  }
  const audio = await plan.audio.arrayBuffer();
  const fallbackTitle = baseName(plan.audio.name);
  if (plan.mode === 'ultrastar') {
    const txt = await plan.notes.text();
    const parsed = parseUltraStar(txt, localEntry('', ''));
    if (parsed.lines.length === 0) throw new Error(`File ${plan.notes.name} không phải UltraStar hoặc không có nốt.`);
    const song: Song = {
      ...parsed, title: parsed.title || fallbackTitle, attribution: 'Bài nhập từ máy của bạn',
      visualBpm: DEFAULT_VISUAL_BPM, mode: 'ultrastar', hasNotes: true,
    };
    return { song, entry: localEntry(song.title, song.artist), audio };
  }
  if (plan.mode === 'lrc') {
    const lrc = parseLrc(await plan.lrc.text());
    if (lrc.lines.length === 0) throw new Error(`File ${plan.lrc.name} không có dòng lời nào có mốc thời gian.`);
    const song = emptySong('lrc', lrc.title || fallbackTitle, lrc.artist || '');
    song.lyrics = lrc.lines;
    song.durationSec = lrc.lines[lrc.lines.length - 1].endSec;
    return { song, entry: localEntry(song.title, song.artist), audio };
  }
  const song = emptySong('audio', fallbackTitle, '');
  return { song, entry: localEntry(song.title, ''), audio };
}
