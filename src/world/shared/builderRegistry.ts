// Gom builder theo phong cách: mỗi file trong zones/<khu>/themes/<id>/ tự khai `export const builders = { <khe>: fn }`;
// index.ts của thư mục quét mọi file bằng import.meta.glob rồi gọi hàm này → thêm builder KHÔNG phải sửa file chung.
export function collectBuilders<T extends object>(mods: Record<string, { builders?: Partial<T> }>, label: string): Partial<T> {
  const out: Partial<T> = {};
  const from: Record<string, string> = {};
  for (const file of Object.keys(mods).sort()) {
    const b = mods[file]?.builders;
    if (!b) continue; // file phụ trợ (shader, hình học dùng chung của phong cách)
    for (const slot of Object.keys(b)) {
      if (from[slot]) console.warn(`[theme ${label}] khe '${slot}' được đăng ký hai lần: ${from[slot]} và ${file} (dùng file sau)`);
      from[slot] = file;
    }
    Object.assign(out, b);
  }
  return out;
}
