// "Đêm Sao Điểm Ảnh" — bảng 31 màu cho khán đài (file phụ trợ, không đăng ký builder). Thứ tự = chỉ số P.
import { getTheme } from '../../../../world/style';

export const P = {
  INK: 0, PHO7: 1, PHO5: 2, PHO3: 3, PHO1: 4, CROM7: 5, CROM5: 6, CROM3: 7, CROM1: 8,
  BACH7: 9, BACH5: 10, BACH3: 11, BACH1: 12, SON7: 13, SON5: 14, SON3: 15, SON1: 16,
  DAT7: 17, DAT5: 18, DAT3: 19, DAT1: 20, TIM7: 21, TIM5: 22, TIM3: 23, TIM1: 24,
  MAY7: 25, MAY5: 26, MAY3: 27, MAY1: 28, NGOC: 29, SEN: 30,
} as const;

/** 31 màu (hex) theo thứ tự P, đọc từ theme đang bật; dự phòng hex của style sheet E. */
export function pal31(): number[] {
  const t = getTheme();
  const R = t.ramps as Record<string, Record<100 | 300 | 500 | 700, number>>;
  const FB: Record<string, number[]> = {
    pho: [0x101a3a, 0x1f3a8a, 0x2f5fb8, 0x5b93d6], crom: [0xb3781a, 0xf2b824, 0xf7dc78, 0xfdf6d0],
    bach: [0x10261f, 0x1e5a46, 0x3f8f62, 0xa8c66c], son: [0x5a1420, 0xc8321e, 0xf0641e, 0xf8a04a],
    dat: [0x3b2416, 0x7a4526, 0xc98a56, 0xf0c79a], tim: [0x2a2350, 0x4a3f82, 0x7f6cc0, 0xb9a6e0],
    may: [0x3c4664, 0x6b7690, 0xa9cbe8, 0xe8f1f6],
  };
  const out = [t.singles?.ink ?? 0x0b0a1a];
  for (const k of ['pho', 'crom', 'bach', 'son', 'dat', 'tim', 'may']) {
    const r = R[k], fb = FB[k]!;
    out.push(r?.[700] ?? fb[0]!, r?.[500] ?? fb[1]!, r?.[300] ?? fb[2]!, r?.[100] ?? fb[3]!);
  }
  out.push(t.singles?.ngoc ?? 0x39b6b0, t.singles?.sen ?? 0xe46a9a);
  return out;
}

/** sRGB 0..1 của một chỉ số bảng. */
export function palRgb(pal: number[], i: number): [number, number, number] {
  const h = pal[i]!;
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}
