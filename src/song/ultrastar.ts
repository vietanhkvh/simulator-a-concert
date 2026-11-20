// STUB P0 — gói P3 thay bằng parser thật. Hàm thuần, test bằng Vitest (ultrastar.test.ts).
import type { Song, SongManifestEntry } from '../core/types';
import { mockSong } from '../dev/mocks';

export function parseUltraStar(_txt: string, entry: SongManifestEntry): Song {
  return { ...mockSong(), title: entry.title, artist: entry.artist, attribution: entry.attribution };
}
