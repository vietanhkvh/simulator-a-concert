// "Đêm Sao Điểm Ảnh" — builder riêng của KHU 2 (khán đài). KHÔNG cần sửa file này khi thêm builder:
// tạo ./<module>.ts trong thư mục này và `export const builders: Partial<StandsBuilders> = { <khe>: hàmDựng }` — file được quét
// tự động. Khe nào không có file đăng ký sẽ dùng builder mặc định (../../builders.ts). Xem docs/THEMES.md.
import { collectBuilders } from '../../../../world/shared/builderRegistry';
import type { StandsBuilders } from '../../builders';

const mods = import.meta.glob<{ builders?: Partial<StandsBuilders> }>(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true });
export const builders: Partial<StandsBuilders> = collectBuilders<StandsBuilders>(mods, 'pixel/stands');
