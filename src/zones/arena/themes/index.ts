// Gom sổ đăng ký của từng phong cách (khu 3). KHÔNG sửa file này khi thêm builder: sửa ./<id>/index.ts.
import type { ThemeId } from '../../../world/style';
import type { ArenaBuilders } from '../builders';
import { builders as lacquer } from './lacquer';
import { builders as pixel } from './pixel';
import { builders as steel } from './steel';

export const THEME_BUILDERS: Partial<Record<ThemeId, Partial<ArenaBuilders>>> = { lacquer, steel, pixel };
