import type { Song, SongManifest, SongManifestEntry } from '../core/types';
import { parseUltraStar } from './ultrastar';

export async function loadManifest(url = 'songs/manifest.json'): Promise<SongManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url}: ${res.status}`);
  return (await res.json()) as SongManifest;
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url}: ${res.status}`);
  return res;
}

export async function loadSong(entry: SongManifestEntry): Promise<{ song: Song; audio: ArrayBuffer }> {
  const [txt, audio] = await Promise.all([
    fetchOk(entry.notesUrl).then((r) => r.text()),
    fetchOk(entry.audioUrl).then((r) => r.arrayBuffer()),
  ]);
  const song = parseUltraStar(txt, entry);
  if (song.lines.length === 0) throw new Error(`File nốt rỗng hoặc sai định dạng: ${entry.notesUrl}`);
  return { song, audio };
}
