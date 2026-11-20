// THEME — sổ đăng ký phong cách + đổi phong cách lúc chạy (docs/THEMES.md).
//   applyTheme(id) ghi token của phong cách vào palette.ts / form.ts TẠI CHỖ (danh tính object giữ nguyên) và đặt
//   data-theme trên <html>. Sau đó world phải được dựng lại (main.ts: rebuildWorld) để builder đọc token mới.
import { applyFormTokens } from './form';
import { applyPaletteTokens } from './palette';
import { chibi } from './themes/chibi';
import { lacquer } from './themes/lacquer';
import { pixel } from './themes/pixel';
import { steel } from './themes/steel';
import { THEME_IDS, type Theme, type ThemeId } from './themeTypes';

export { THEME_IDS };
export type * from './themeTypes';

const REGISTRY: Record<ThemeId, Theme> = { chibi, lacquer, steel, pixel };
export const DEFAULT_THEME: ThemeId = 'chibi';
export const THEME_STORAGE_KEY = 'cs-theme';

let activeId: ThemeId = DEFAULT_THEME;
const listeners = new Set<(id: ThemeId) => void>();

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);
/** Dữ liệu gốc (chỉ đọc) của phong cách đang bật, hoặc của `id`. */
export function getTheme(id: ThemeId = activeId): Theme { return REGISTRY[id]; }
export function getActiveThemeId(): ThemeId { return activeId; }
export function listThemes(): Theme[] { return THEME_IDS.map((id) => REGISTRY[id]); }

/** Bật phong cách: ghi token tại chỗ + data-theme. KHÔNG dựng lại world (việc của nơi gọi). Trả về id đã bật. */
export function applyTheme(id: ThemeId): ThemeId {
  const t = REGISTRY[isThemeId(id) ? id : DEFAULT_THEME];
  activeId = t.id;
  applyPaletteTokens(t);
  applyFormTokens(t);
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = t.features.ui;
  listeners.forEach((cb) => cb(t.id));
  return t.id;
}
/** Nghe đổi phong cách (UI cập nhật nhãn…); trả về hàm huỷ. */
export function onThemeChange(cb: (id: ThemeId) => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }

/** Phong cách lúc mở trang: URL `?theme=` > localStorage > 'chibi'. */
export function resolveInitialThemeId(search?: string, stored?: string | null): ThemeId {
  let q: string | null = null;
  try { q = new URLSearchParams(search ?? (typeof location !== 'undefined' ? location.search : '')).get('theme'); } catch { /* bỏ qua */ }
  if (isThemeId(q)) return q;
  let s = stored;
  if (s === undefined) { try { s = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null; } catch { s = null; } }
  return isThemeId(s) ? s : DEFAULT_THEME;
}
/** Ghi nhớ lựa chọn của người chơi. */
export function rememberTheme(id: ThemeId): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch { /* bỏ qua */ }
}

/**
 * Cho bộ nhớ đệm cấp module phụ thuộc token (bảng màu cục bộ, THREE.Color dùng chung…): chạy `sync` ngay và chạy lại
 * mỗi lần đổi phong cách. Dùng khi không tiện chuyển phép tính vào trong hàm dựng.
 */
export function themed(sync: () => void): void { sync(); listeners.add(sync); }
