// Gom sổ đăng ký của từng phong cách (khu 1). KHÔNG sửa file này khi thêm builder (sửa ./<id>/index.ts) hay thêm phong cách.
// Mỗi ./<id>/index.ts được tải LƯỜI (dynamic import, chunk theme-<id>) qua world/shared/themeCode.ts: chỉ phong cách đang
// chọn được tải; THEME_BUILDERS[id] có mặt sau khi loadThemeCode(id) xong.
import { registerThemeLoader } from '../../../world/shared/themeCode';
import type { ThemeId } from '../../../world/style';
import type { OutsideBuilders } from '../builders';

const loaders = import.meta.glob<{ builders: Partial<OutsideBuilders> }>('./*/index.ts');
export const THEME_BUILDERS: Partial<Record<ThemeId, Partial<OutsideBuilders>>> = {};
registerThemeLoader(async (id) => {
  const load = loaders[`./${id}/index.ts`];
  if (load && !THEME_BUILDERS[id]) THEME_BUILDERS[id] = (await load()).builders;
});
