// Bảng màu dùng chung giữa lights.ts và các đồ trang trí sân khấu (stageDeco*.ts).
import * as THREE from 'three';

const hex = (h: number[]) => h.map((x) => new THREE.Color(x));
export const PALETTES: THREE.Color[][] = [
  hex([0x00e5ff, 0xff1fb4, 0x00e5ff, 0xff1fb4, 0x7a5cff]), // cyan + magenta
  hex([0xffb000, 0xff2a2a, 0xff6a00, 0xffd000, 0xff1f5a]), // hổ phách + đỏ
  hex([0x9dff00, 0x8a2bff, 0x30ff8a, 0xc23bff, 0xe6ff3a]), // chanh + tím
  [], // cầu vồng chase (tính bằng HSL)
  hex([0xff3d7f, 0x3d7bff, 0xffe14d, 0x2bffc6, 0xb04dff]), // pop nhiều màu
];
export const COOL = hex([0x2a5bff, 0x6a3dff, 0x1fb4ff, 0x4a6bff]);

export function palColor(p: number, k: number, beat: number, out: THREE.Color) {
  const pal = PALETTES[p]!;
  if (pal.length === 0) return out.setHSL((k * 0.11 + beat * 0.06) % 1, 1, 0.55);
  return out.copy(pal[((k % pal.length) + pal.length) % pal.length]!);
}

/** Trạng thái palette hiện tại; lights.ts cập nhật mỗi frame. */
export const livePal = { pCur: 0, pPrev: 4, mix: 1, vivid: 0.3, beat: 0 };

const A = new THREE.Color();
const B = new THREE.Color();
export function liveColor(k: number, out: THREE.Color, minVivid = 0.3) {
  palColor(livePal.pPrev, k, livePal.beat, B);
  palColor(livePal.pCur, k, livePal.beat, A);
  out.copy(B).lerp(A, livePal.mix);
  A.copy(COOL[((k % 4) + 4) % 4]!);
  out.lerpColors(A, out, Math.max(livePal.vivid, minVivid));
  return out;
}
