// Giữ ranh giới ba khu: file trong một khu chỉ được import từ chính khu đó, src/core và src/world;
// mã ngoài khu chỉ được import index của khu (zones/<khu>), không import file bên trong.
// Phong cách: file trong zones/<khu>/themes/<id>/ không được import thư mục của phong cách khác; mã mặc định của khu
// không import thẳng thư mục phong cách (chỉ qua themes/index.ts, và chỉ builders.ts dùng nó).
import { describe, expect, it } from 'vitest';

const zoneFiles = import.meta.glob('../zones/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const otherFiles = import.meta.glob(['../**/*.ts', '!../zones/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const importsOf = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
/** Ghép đường dẫn tương đối: ('../zones/arena/themes/steel/x.ts', '../../builders') → 'zones/arena/builders' (gốc = src). */
function resolve(file: string, imp: string): string {
  const parts = file.replace(/^\.\.\//, '').split('/').slice(0, -1);
  for (const seg of imp.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return parts.join('/');
}
const THEME_DIR = /^zones\/(outside|stands|arena)\/themes\/([^/]+)\//;

describe('ranh giới khu (zones)', () => {
  it('có đủ ba khu', () => {
    const zones = new Set(Object.keys(zoneFiles).map((p) => p.split('/')[2]));
    expect([...zones].sort()).toEqual(['arena', 'outside', 'stands']);
  });

  it('khu không import chéo nhau, chỉ import core/world/chính nó', () => {
    const bad: string[] = [];
    for (const [path, src] of Object.entries(zoneFiles)) {
      const zone = path.split('/')[2]!;
      for (const imp of importsOf(src)) {
        if (!imp.startsWith('.')) continue; // thư viện ngoài (three…)
        const to = resolve(path, imp);
        const ok = to.startsWith(`zones/${zone}/`) || to.startsWith('core/') || to.startsWith('world/');
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

  it('phong cách không import thư mục của phong cách khác; mã mặc định không import thẳng thư mục phong cách', () => {
    const bad: string[] = [];
    let themeFiles = 0;
    for (const [path, src] of Object.entries(zoneFiles)) {
      const self = resolve(path, './x'); // 'zones/<khu>/…/x'
      const own = self.match(THEME_DIR)?.[2] ?? null; // id phong cách của file (null = mã mặc định / themes/index.ts)
      const isAggregator = /^zones\/[^/]+\/themes\/x$/.test(self);
      if (own) themeFiles++;
      for (const imp of importsOf(src)) {
        if (!imp.startsWith('.')) continue;
        const target = resolve(path, imp).match(THEME_DIR)?.[2] ?? null;
        if (!target) continue;
        if (own ? target !== own : !isAggregator) bad.push(`${path} → ${imp}`);
      }
      // chỉ builders.ts của khu được dùng themes/index.ts
      if (!own && !isAggregator && !path.endsWith('/builders.ts'))
        for (const imp of importsOf(src)) if (imp.startsWith('.') && /^zones\/[^/]+\/themes$/.test(resolve(path, imp))) bad.push(`${path} → ${imp} (chỉ builders.ts)`);
    }
    expect(bad).toEqual([]);
    expect(themeFiles).toBeGreaterThanOrEqual(9); // 3 khu × 3 phong cách có index.ts
  });
});
