// STUB P0 — gói P3 thay: fetch notesUrl + audioUrl (đường dẫn tương đối), gọi parseUltraStar.
import type { Song, SongManifest, SongManifestEntry } from '../core/types';
import { parseUltraStar } from './ultrastar';

export async function loadManifest(url = 'songs/manifest.json'): Promise<SongManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url}: ${res.status}`);
  return (await res.json()) as SongManifest;
}

export async function loadSong(entry: SongManifestEntry): Promise<{ song: Song; audio: ArrayBuffer }> {
  return { song: parseUltraStar('', entry), audio: new ArrayBuffer(0) };
}
