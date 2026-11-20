// "Thép & Lửa" — builder riêng của KHU 1 (ngoài sân). KHÔNG cần sửa file này khi thêm builder:
// tạo ./<module>.ts trong thư mục này và `export const builders: Partial<OutsideBuilders> = { <khe>: hàmDựng }` — file được quét
// tự động. Khe nào không có file đăng ký sẽ dùng builder mặc định (../../builders.ts). Xem docs/THEMES.md.
import { collectBuilders } from '../../../../world/shared/builderRegistry';
import type { OutsideBuilders } from '../../builders';

const mods = import.meta.glob<{ builders?: Partial<OutsideBuilders> }>(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true });
export const builders: Partial<OutsideBuilders> = collectBuilders<OutsideBuilders>(mods, 'steel/outside');
