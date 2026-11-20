// "Mực & Sơn mài · bản Việt" — builder riêng của KHU 3 (sân trung tâm). KHÔNG cần sửa file này khi thêm builder:
// tạo ./<module>.ts trong thư mục này và `export const builders: Partial<ArenaBuilders> = { <khe>: hàmDựng }` — file được quét
// tự động. Khe nào không có file đăng ký sẽ dùng builder mặc định (../../builders.ts). Xem docs/THEMES.md.
import { collectBuilders } from '../../../../world/shared/builderRegistry';
import type { ArenaBuilders } from '../../builders';

const mods = import.meta.glob<{ builders?: Partial<ArenaBuilders> }>(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true });
export const builders: Partial<ArenaBuilders> = collectBuilders<ArenaBuilders>(mods, 'lacquer/arena');
