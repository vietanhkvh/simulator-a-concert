// Tải LƯỜI mã builder của phong cách (docs/THEMES.md mục 5): mỗi khu (zones/<khu>/themes/index.ts) đăng ký một hàm tải
// bằng registerThemeLoader; loadThemeCode(id) gọi cả ba song song (Vite gom thành một chunk theme-<id>). Phong cách mặc định
// (builder mặc định của khu) không cần tải. PHẢI chờ loadThemeCode(id) xong trước applyTheme(id) + dựng lại world, nếu không
// pickBuilder lặng lẽ rơi về builder mặc định.
import { DEFAULT_THEME, type ThemeId } from '../style';

type Loader = (id: ThemeId) => Promise<void>;
const loaders: Loader[] = [];
const loaded = new Set<ThemeId>([DEFAULT_THEME]);
const pending = new Map<ThemeId, Promise<void>>();

/** Gọi một lần ở cấp module bởi themes/index.ts của mỗi khu. */
export function registerThemeLoader(fn: Loader): void { loaders.push(fn); }

export function isThemeCodeLoaded(id: ThemeId): boolean { return loaded.has(id); }

/** Tải mã phong cách `id` (một lần; lỗi mạng → reject và cho thử lại ở lần gọi sau). */
export function loadThemeCode(id: ThemeId): Promise<void> {
  if (loaded.has(id)) return Promise.resolve();
  let p = pending.get(id);
  if (!p) {
    p = Promise.all(loaders.map((l) => l(id))).then(
      () => { loaded.add(id); pending.delete(id); },
      (e: unknown) => { pending.delete(id); throw e; },
    );
    pending.set(id, p);
  }
  return p;
}
