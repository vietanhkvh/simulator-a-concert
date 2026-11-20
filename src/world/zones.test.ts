// Giữ ranh giới ba khu: file trong một khu chỉ được import từ chính khu đó, src/core và src/world;
// mã ngoài khu chỉ được import index của khu (zones/<khu>), không import file bên trong.
import { describe, expect, it } from 'vitest';

const zoneFiles = import.meta.glob('../zones/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const otherFiles = import.meta.glob(['../**/*.ts', '!../zones/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const importsOf = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('ranh giới khu (zones)', () => {
  it('có đủ ba khu', () => {
    const zones = new Set(Object.keys(zoneFiles).map((p) => p.split('/')[2]));
    expect([...zones].sort()).toEqual(['arena', 'outside', 'stands']);
  });

  it('khu không import chéo nhau, chỉ import core/world/chính nó', () => {
    const bad: string[] = [];
    for (const [path, src] of Object.entries(zoneFiles)) {
      for (const imp of importsOf(src)) {
        if (!imp.startsWith('.')) continue; // thư viện ngoài (three…)
        const ok = imp.startsWith('./') || imp.startsWith('../../core/') || imp.startsWith('../../world/');
        if (!ok) bad.push(`${path} → ${imp}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('mã ngoài khu chỉ import index của khu', () => {
    const bad: string[] = [];
    for (const [path, src] of Object.entries(otherFiles)) {
      for (const imp of importsOf(src)) {
        const m = imp.match(/zones\/(outside|stands|arena)(\/.*)?$/);
        if (m && m[2] && m[2] !== '/index') bad.push(`${path} → ${imp}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
