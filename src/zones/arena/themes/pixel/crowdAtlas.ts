// "Đêm Sao Điểm Ảnh" — atlas sprite khán giả (gói P2). File phụ trợ (không đăng ký builder).
// Vẽ bằng mã (không asset): 4 tầng cao 24 / 18 / 12 / 7 px × 32 cột:
//   0–17  người thường: 3 kiểu tóc × 6 dáng [sao thấp, giơ sao, giơ sao (lấp lánh), hai tay, ôm má, ôm má (há to)]
//   18–21 "Người thét" (Munch 1893): [yên, thét 1, thét 2, thét 3]
//   22–31 khách mời công cộng × [đứng, ôm má]: Mona Lisa · Cô gái đeo hoa tai ngọc trai · Vệ nữ trên vỏ sò · Nụ hôn · Quý bà che ô (Seurat)
// Texel: R = mã màu (0–30 = chỉ số bảng 31 màu, 32+ = vùng đổi màu theo người), A = 0 trong suốt.
// Ảnh gốc y hướng lên (hàng 0 = chân) → texelFetch(x, rowY + y) trong shader.
import * as THREE from 'three';
import { getTheme } from '../../../../world/style';

/** Chỉ số bảng 31 màu (thứ tự = uPal trong shader). */
export const C = {
  INK: 0, PHO7: 1, PHO5: 2, PHO3: 3, PHO1: 4, CROM7: 5, CROM5: 6, CROM3: 7, CROM1: 8,
  BACH7: 9, BACH5: 10, BACH3: 11, BACH1: 12, SON7: 13, SON5: 14, SON3: 15, SON1: 16,
  DAT7: 17, DAT5: 18, DAT3: 19, DAT1: 20, TIM7: 21, TIM5: 22, TIM3: 23, TIM1: 24,
  MAY7: 25, MAY5: 26, MAY3: 27, MAY1: 28, NGOC: 29, SEN: 30,
} as const;
/** Vùng đổi màu theo từng người (shader thay bằng chỉ số bảng). */
const V = { SKIN: 32, SKINSH: 33, HAIR: 34, CLOTH: 35, CLOTHSH: 36, PANTS: 37, STAR: 38, CORE: 39 } as const;

/** Bảng 31 màu theo thứ tự C, đọc từ theme đang bật (dự phòng hex của style sheet E). */
export function pixelPalette(): number[] {
  const t = getTheme();
  const R = t.ramps as Record<string, Record<100 | 300 | 500 | 700, number>>;
  const FB: Record<string, [number, number, number, number]> = {
    pho: [0x101a3a, 0x1f3a8a, 0x2f5fb8, 0x5b93d6], crom: [0xb3781a, 0xf2b824, 0xf7dc78, 0xfdf6d0],
    bach: [0x10261f, 0x1e5a46, 0x3f8f62, 0xa8c66c], son: [0x5a1420, 0xc8321e, 0xf0641e, 0xf8a04a],
    dat: [0x3b2416, 0x7a4526, 0xc98a56, 0xf0c79a], tim: [0x2a2350, 0x4a3f82, 0x7f6cc0, 0xb9a6e0],
    may: [0x3c4664, 0x6b7690, 0xa9cbe8, 0xe8f1f6],
  };
  const out: number[] = [t.singles?.ink ?? 0x0b0a1a];
  for (const k of ['pho', 'crom', 'bach', 'son', 'dat', 'tim', 'may']) {
    const r = R[k], fb = FB[k]!;
    out.push(r?.[700] ?? fb[0], r?.[500] ?? fb[1], r?.[300] ?? fb[2], r?.[100] ?? fb[3]);
  }
  out.push(t.singles?.ngoc ?? 0x39b6b0, t.singles?.sen ?? 0xe46a9a);
  return out;
}

export interface TierInfo { W: number; H: number; y: number; headTop: number }
export const TIERS: TierInfo[] = [
  { W: 16, H: 24, y: 0, headTop: 18 },
  { W: 12, H: 18, y: 24, headTop: 14 },
  { W: 8, H: 12, y: 42, headTop: 9 },
  { W: 5, H: 7, y: 54, headTop: 6 },
];
export const ATLAS_COLS = 32, ATLAS_W = 512, ATLAS_H = 64;
export const COL_SCREAMER = 18, COL_GUEST = 22, GUEST_COUNT = 5;

type R2 = [number, number];
interface Rig {
  W: number; H: number; tx: R2; ty: R2; legTop: number; legGap: [number, number, number]; // x0,x1,yTop
  hx: R2; hy: R2; aL: R2; aR: R2;
  down: { arm: R2; sleeve: R2; hand: R2 };
  up: { shoulder: R2; arm: R2; ax: R2; hand: R2; star: R2 };
  low: { arm: R2; hand: R2; star: R2 };
  cheek: { arm: R2; sleeve: R2; handL: number; handR: number; hy: R2; shL: number; shR: number };
  eyes: number[]; eyeY: number; mouthX: R2; mouthY0: R2; // [cheeks0 y0, cheeks1 y0], đỉnh miệng = mouthTop
  mouthTop: number; star: 'big' | 'plus' | 'dot'; lowStar: 'plus' | 'dot'; outline: boolean; shade: boolean;
}
const RIGS: Rig[] = [
  { // 24 px
    W: 16, H: 24, tx: [5, 10], ty: [5, 11], legTop: 4, legGap: [7, 8, 1], hx: [5, 10], hy: [12, 17], aL: [3, 4], aR: [11, 12],
    down: { arm: [6, 9], sleeve: [10, 11], hand: [4, 5] },
    up: { shoulder: [10, 11], arm: [12, 18], ax: [12, 13], hand: [17, 18], star: [13, 21] },
    low: { arm: [9, 11], hand: [8, 8], star: [13, 9] },
    cheek: { arm: [8, 9], sleeve: [10, 11], handL: 4, handR: 11, hy: [12, 14], shL: 5, shR: 10 },
    eyes: [6, 9], eyeY: 15, mouthX: [7, 8], mouthY0: [13, 12], mouthTop: 14, star: 'big', lowStar: 'plus', outline: true, shade: true,
  },
  { // 18 px
    W: 12, H: 18, tx: [3, 7], ty: [4, 8], legTop: 3, legGap: [5, 5, 1], hx: [3, 7], hy: [9, 13], aL: [2, 2], aR: [8, 8],
    down: { arm: [4, 6], sleeve: [7, 8], hand: [3, 3] },
    up: { shoulder: [7, 8], arm: [9, 14], ax: [9, 9], hand: [14, 14], star: [9, 16] },
    low: { arm: [6, 8], hand: [5, 5], star: [9, 5] },
    cheek: { arm: [6, 7], sleeve: [8, 8], handL: 2, handR: 8, hy: [9, 11], shL: 3, shR: 7 },
    eyes: [4, 6], eyeY: 11, mouthX: [5, 5], mouthY0: [10, 9], mouthTop: 10, star: 'plus', lowStar: 'plus', outline: true, shade: true,
  },
  { // 12 px
    W: 8, H: 12, tx: [2, 5], ty: [3, 5], legTop: 2, legGap: [3, 4, 0], hx: [2, 5], hy: [6, 8], aL: [1, 1], aR: [6, 6],
    down: { arm: [3, 5], sleeve: [5, 5], hand: [2, 2] },
    up: { shoulder: [5, 5], arm: [6, 8], ax: [6, 6], hand: [8, 8], star: [6, 10] },
    low: { arm: [4, 5], hand: [4, 4], star: [6, 4] },
    cheek: { arm: [4, 5], sleeve: [5, 5], handL: 1, handR: 6, hy: [6, 7], shL: -1, shR: -1 },
    eyes: [], eyeY: -1, mouthX: [3, 4], mouthY0: [6, 6], mouthTop: 6, star: 'plus', lowStar: 'dot', outline: false, shade: false,
  },
  { // 7 px
    W: 5, H: 7, tx: [1, 3], ty: [2, 3], legTop: 1, legGap: [2, 2, 0], hx: [1, 3], hy: [4, 5], aL: [0, 0], aR: [4, 4],
    down: { arm: [2, 3], sleeve: [3, 3], hand: [2, 2] },
    up: { shoulder: [3, 3], arm: [4, 5], ax: [4, 4], hand: [5, 5], star: [4, 6] },
    low: { arm: [3, 3], hand: [3, 3], star: [4, 3] },
    cheek: { arm: [3, 3], sleeve: [3, 3], handL: 0, handR: 4, hy: [4, 4], shL: -1, shR: -1 },
    eyes: [], eyeY: -1, mouthX: [2, 2], mouthY0: [4, 4], mouthTop: 4, star: 'dot', lowStar: 'dot', outline: false, shade: false,
  },
];

/** Tâm ngôi sao (px trong ô, y lên) theo tầng × dáng [thấp, giơ, giơ lấp lánh, hai tay] — cho quầng sao (STICK). */
export function starCentres(): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (const r of RIGS) {
    out.push(new THREE.Vector2(...r.low.star), new THREE.Vector2(...r.up.star), new THREE.Vector2(...r.up.star), new THREE.Vector2(...r.up.star));
  }
  return out;
}

class Sprite {
  g: Int16Array;
  constructor(public W: number, public H: number) { this.g = new Int16Array(W * H).fill(-1); }
  set(x: number, y: number, c: number) { if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.g[y * this.W + x] = c; }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.W && y < this.H ? this.g[y * this.W + x]! : -1; }
  rect(x0: number, y0: number, x1: number, y1: number, c: number) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  outline() {
    const add: number[] = [];
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (this.get(x, y) >= 0) continue;
      if (this.get(x - 1, y) > 0 || this.get(x + 1, y) > 0 || this.get(x, y - 1) > 0 || this.get(x, y + 1) > 0) add.push(x, y);
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i]!, add[i + 1]!, C.INK);
  }
}

const STARS: Record<string, string[]> = {
  big: ['..#..', '.###.', '##@##', '.###.', '.#.#.'],
  burst: ['#.#.#', '.###.', '##@##', '.###.', '#.#.#'],
  plus: ['.#.', '#@#', '.#.'],
  x: ['#.#', '.@.', '#.#'],
  dot: ['@'],
};
function star(s: Sprite, cx: number, cy: number, kind: string) {
  const rows = STARS[kind]!, h = rows.length, w = rows[0]!.length;
  rows.forEach((row, i) => {
    for (let j = 0; j < w; j++) {
      const ch = row[j];
      if (ch === '.') continue;
      s.set(cx - (w >> 1) + j, cy + (h >> 1) - i, ch === '@' ? V.CORE : V.STAR);
    }
  });
}

interface Cols { skin: number; skinSh: number; hair: number; cloth: number; clothSh: number; pants: number }
const VAR: Cols = { skin: V.SKIN, skinSh: V.SKINSH, hair: V.HAIR, cloth: V.CLOTH, clothSh: V.CLOTHSH, pants: V.PANTS };
type Pose = 'low' | 'up' | 'upAlt' | 'both' | 'cheek0' | 'cheek1' | 'folded' | 'none';

function body(s: Sprite, r: Rig, c: Cols, legs = true) {
  if (legs) {
    s.rect(r.tx[0], 0, r.tx[1], r.legTop, c.pants);
    s.rect(r.legGap[0], 0, r.legGap[1], r.legGap[2], -1);
  }
  s.rect(r.tx[0], r.ty[0], r.tx[1], r.ty[1], c.cloth);
  if (r.shade) s.rect(r.tx[1], r.ty[0], r.tx[1], r.ty[1], c.clothSh);
}
function head(s: Sprite, r: Rig, c: Cols) {
  s.rect(r.hx[0], r.hy[0], r.hx[1], r.hy[1], c.skin);
  if (r.shade) s.rect(r.hx[1], r.hy[0], r.hx[1], r.hy[1] - 1, c.skinSh);
}
function hair(s: Sprite, r: Rig, c: Cols, style: number) {
  const [x0, x1] = r.hx, [y0, y1] = r.hy;
  s.rect(x0, y1, x1, y1, c.hair);
  if (r.shade) { s.set(x0, y1 - 1, c.hair); s.set(x1, y1 - 1, c.hair); }
  if (style === 1) { // tóc dài
    s.rect(x0, Math.max(r.ty[1] - 1, 0), x0, y1, c.hair);
    s.rect(x1, Math.max(r.ty[1] - 1, 0), x1, y1, c.hair);
  } else if (style === 2) { // búi / mũ len
    s.rect(x0 + 1, y1 + 1, x1 - 1, y1 + 1, c.hair);
    if (r.shade) s.rect(x0 - 1, y1 - 1, x0, y1 - 1, c.hair);
  }
  void y0;
}
function eyes(s: Sprite, r: Rig, scream: boolean) {
  if (r.eyeY < 0) return;
  for (const x of r.eyes) { s.set(x, r.eyeY, C.INK); if (scream) s.set(x, r.eyeY + 1, C.INK); }
}
function arm(s: Sprite, r: Rig, c: Cols, side: 'L' | 'R', pose: 'down' | 'up' | 'low' | 'cheek') {
  const ax = side === 'L' ? r.aL : r.aR;
  if (pose === 'down') {
    s.rect(ax[0], r.down.arm[0], ax[1], r.down.arm[1], c.skin);
    s.rect(ax[0], r.down.sleeve[0], ax[1], r.down.sleeve[1], c.cloth);
    s.rect(ax[0], r.down.hand[0], ax[1], r.down.hand[1], c.skin);
  } else if (pose === 'low') {
    s.rect(ax[0], r.low.arm[0], ax[1], r.low.arm[1], c.cloth);
    s.rect(ax[0], r.low.hand[0], ax[1], r.low.hand[1], c.skin);
  } else if (pose === 'up') {
    const m = r.hx[0] + r.hx[1]; // gương qua trục giữa thân
    const bx: R2 = side === 'L' ? [m - r.up.ax[1], m - r.up.ax[0]] : r.up.ax;
    s.rect(ax[0], r.up.shoulder[0], ax[1], r.up.shoulder[1], c.cloth);
    s.rect(bx[0], r.up.arm[0], bx[1], r.up.arm[1], c.skin);
    s.rect(bx[0], r.up.hand[0], bx[1], r.up.hand[1], c.skin);
  } else {
    s.rect(ax[0], r.cheek.arm[0], ax[1], r.cheek.arm[1], c.skin);
    s.rect(ax[0], r.cheek.sleeve[0], ax[1], r.cheek.sleeve[1], c.cloth);
    const hx = side === 'L' ? r.cheek.handL : r.cheek.handR;
    const sx = side === 'L' ? r.cheek.shL : r.cheek.shR;
    s.rect(hx, r.cheek.hy[0], hx, r.cheek.hy[1], c.skin);
    if (sx >= 0) s.rect(sx, r.cheek.hy[0], sx, r.cheek.hy[1], c.skinSh);
  }
}
function mouthO(s: Sprite, r: Rig, big: boolean) {
  s.rect(r.mouthX[0], big ? r.mouthY0[1] : r.mouthY0[0], r.mouthX[1], r.mouthTop, C.INK);
}

function figure(s: Sprite, r: Rig, c: Cols, hairStyle: number, pose: Pose, opts: { legs?: boolean; hairFn?: () => void } = {}) {
  body(s, r, c, opts.legs !== false);
  head(s, r, c);
  if (opts.hairFn) opts.hairFn(); else hair(s, r, c, hairStyle);
  const ti = RIGS.indexOf(r);
  switch (pose) {
    case 'low': arm(s, r, c, 'L', 'down'); arm(s, r, c, 'R', 'low'); eyes(s, r, false); star(s, r.low.star[0], r.low.star[1], r.lowStar); break;
    case 'up': case 'upAlt':
      arm(s, r, c, 'L', 'down'); arm(s, r, c, 'R', 'up'); eyes(s, r, false);
      star(s, r.up.star[0], r.up.star[1], pose === 'up' ? r.star : r.star === 'big' ? 'burst' : r.star === 'plus' ? 'x' : 'dot'); break;
    case 'both':
      arm(s, r, c, 'L', 'up'); arm(s, r, c, 'R', 'up'); eyes(s, r, false);
      if (ti <= 1) mouthO(s, r, false);
      star(s, r.up.star[0], r.up.star[1], r.star); break;
    case 'cheek0': case 'cheek1':
      arm(s, r, c, 'L', 'cheek'); arm(s, r, c, 'R', 'cheek'); eyes(s, r, true); mouthO(s, r, pose === 'cheek1'); break;
    case 'folded':
      arm(s, r, c, 'L', 'down'); arm(s, r, c, 'R', 'down'); eyes(s, r, false);
      s.rect(r.tx[0], r.ty[0] + (ti === 0 ? 1 : 0), r.tx[1], r.ty[0] + (ti === 0 ? 1 : 0), c.skin); // tay khoanh trước bụng
      break;
    default: arm(s, r, c, 'L', 'down'); arm(s, r, c, 'R', 'down'); eyes(s, r, false);
  }
}

/** "Người thét": đầu trọc nhạt thuôn, hốc mắt, miệng O, hai tay ôm má, thân áo khoác gợn sóng lam sẫm. */
function screamer(s: Sprite, ti: number, frame: number) {
  const r = RIGS[ti]!;
  const [x0, x1] = r.hx;
  const wave = (y: number) => (frame === 0 ? 0 : Math.round(Math.sin(y * 0.9 + frame * 2.1) * (ti === 0 ? 1 : 0.6)));
  // thân áo khoác dài tới đất, gợn sóng theo hàng; sọc chéo pho-500 trôi theo khung
  for (let y = 0; y <= r.ty[1]; y++) {
    const o = wave(y), flare = y <= 1 && ti <= 1 ? 1 : 0;
    for (let x = r.tx[0] - 1 - flare + o; x <= r.tx[1] + 1 + flare + o; x++) {
      if (ti >= 2 && (x < r.tx[0] || x > r.tx[1])) continue;
      const stripe = ti <= 1 && (x + y + frame) % 4 === 0;
      s.set(x, y, stripe ? C.PHO5 : C.PHO7);
    }
  }
  // đầu: nhạt, thuôn, cao hơn 1 hàng
  const top = r.hy[1] + (ti <= 1 ? 1 : 0);
  s.rect(x0, r.hy[0], x1, top, C.DAT1);
  if (ti <= 1) { s.set(x0, top, -1); s.set(x1, top, -1); s.set(x0, r.hy[0], -1); s.set(x1, r.hy[0], -1); }
  if (r.shade) s.rect(x1, r.eyeY, x1, top - 1, C.BACH1); // bóng "xanh ốm" của Munch bên sọ
  // hốc mắt
  if (r.eyeY >= 0) for (const x of r.eyes) { s.set(x, r.eyeY + 1, C.INK); s.set(x, r.eyeY, ti === 0 ? C.DAT5 : C.INK); }
  // miệng O: yên = nhỏ, thét = to
  // miệng O luôn mở (dấu hiệu nhận ra); thét = to hơn 1 hàng
  if (frame === 0) s.rect(r.mouthX[0], r.mouthY0[0], r.mouthX[1], r.mouthTop, C.INK);
  else s.rect(r.mouthX[0], r.mouthY0[1], r.mouthX[1], r.mouthTop, C.INK);
  // tay áo + bàn tay ôm má (nhạt)
  for (const side of [0, 1]) {
    const ax = side === 0 ? r.aL : r.aR;
    s.rect(ax[0], r.cheek.arm[0], ax[1], r.cheek.sleeve[1], C.PHO7);
    const hx = side === 0 ? r.cheek.handL : r.cheek.handR;
    s.rect(hx, r.cheek.hy[0], hx, r.cheek.hy[1] + (ti === 0 ? 1 : 0), C.DAT1);
    const sx = side === 0 ? r.cheek.shL : r.cheek.shR;
    if (sx >= 0) s.rect(sx, r.cheek.hy[0], sx, r.cheek.hy[1], C.DAT3);
  }
  // đầu lắc 1 px khi thét (dịch cả khối đầu)
  if (frame === 2 && ti <= 1) {
    for (let y = r.hy[0]; y <= top; y++) {
      for (let x = r.W - 1; x > 0; x--) s.set(x, y, s.get(x - 1, y));
      s.set(0, y, -1);
    }
  }
  if (r.outline) s.outline();
}

/** Khách mời (tranh phạm vi công cộng). Dấu hiệu nhận ra ở 12 px: mỗi nhân vật một khối màu đặc trưng. */
function guest(s: Sprite, ti: number, g: number, cheeks: boolean) {
  const r = RIGS[ti]!;
  const [hx0, hx1] = r.hx, [hy0, hy1] = r.hy;
  const pose: Pose = cheeks ? 'cheek1' : 'folded';
  if (g === 0) { // Mona Lisa — da Vinci: tóc dài sẫm ôm mặt, váy lục-nâu sẫm, tay khoanh, nụ cười nhẹ
    const c: Cols = { skin: C.DAT1, skinSh: C.DAT3, hair: C.DAT7, cloth: C.BACH7, clothSh: C.INK, pants: C.BACH7 };
    figure(s, r, c, 1, pose, {
      hairFn: () => {
        s.rect(hx0, hy1, hx1, hy1, C.DAT7);
        s.rect(hx0, r.ty[1] - (ti <= 1 ? 2 : 0), hx0, hy1, C.DAT7); s.rect(hx1, r.ty[1] - (ti <= 1 ? 2 : 0), hx1, hy1, C.DAT7);
        if (ti === 0) s.rect(hx0 - 1, r.ty[1] - 2, hx0 - 1, hy1 - 1, C.DAT7), s.rect(hx1 + 1, r.ty[1] - 2, hx1 + 1, hy1 - 1, C.DAT7);
      },
    });
    if (!cheeks && ti === 0) { s.set(7, 13, C.DAT5); s.set(8, 13, C.DAT5); s.set(9, 14, C.DAT5); } // nụ cười
    if (ti === 0) s.rect(r.tx[0] + 1, r.ty[1], r.tx[1] - 1, r.ty[1], C.DAT5); // cổ áo
  } else if (g === 1) { // Cô gái đeo hoa tai ngọc trai — Vermeer: khăn xếp lam, đuôi khăn vàng, áo vàng nâu, ngọc trai
    const c: Cols = { skin: C.DAT1, skinSh: C.DAT3, hair: C.PHO3, cloth: C.CROM7, clothSh: C.DAT5, pants: C.DAT5 };
    figure(s, r, c, 0, pose, {
      hairFn: () => {
        s.rect(hx0, hy1 - (ti <= 1 ? 1 : 0), hx1, hy1, C.PHO3);
        if (ti <= 1) { s.rect(hx0 + 1, hy1 + 1, hx1 - 1, hy1 + 1, C.PHO1); s.set(hx0, hy1 - 2, C.PHO3); }
        if (ti <= 2) s.rect(hx1 + 1, r.ty[1] - (ti === 0 ? 2 : 0), hx1 + 1, hy1, C.CROM3); // đuôi khăn vàng sau gáy
        else s.set(hx1, hy1, C.CROM3);
      },
    });
    if (ti <= 1) s.set(hx0, hy0 + 1, C.MAY1); // ngọc trai
    if (ti === 0) s.rect(r.tx[0], r.ty[1], r.tx[1], r.ty[1], C.MAY3); // cổ áo trắng
  } else if (g === 2) { // Vệ nữ trên vỏ sò — Botticelli: tóc vàng dài tới hông, khăn choàng hồng, đứng trên vỏ sò
    const c: Cols = { skin: C.DAT1, skinSh: C.DAT3, hair: C.CROM7, cloth: C.SEN, clothSh: C.TIM3, pants: C.DAT1 };
    figure(s, r, c, 1, pose, {
      legs: true,
      hairFn: () => {
        s.rect(hx0, hy1, hx1, hy1, C.CROM5);
        const bot = Math.max(1, r.legTop);
        s.rect(hx0 - 1, bot, hx0 - 1, hy1, C.CROM7); s.rect(hx0, r.ty[1], hx0, hy1 - 1, C.CROM5);
        if (ti <= 1) { s.rect(hx1 + 1, bot + 1, hx1 + 1, hy1 - 1, C.CROM7); s.set(hx1, hy1 - 1, C.CROM5); }
      },
    });
    // vỏ sò dưới chân: quạt rộng có gân
    const w0 = Math.max(0, r.tx[0] - (ti <= 1 ? 3 : 1)), w1 = Math.min(r.W - 1, r.tx[1] + (ti <= 1 ? 3 : 1));
    const sh = ti <= 1 ? 1 : 0;
    s.rect(w0, 0, w1, sh, C.CROM3);
    for (let x = w0; x <= w1; x += 2) s.set(x, 0, C.DAT3);
  } else if (g === 3) { // Nụ hôn — Klimt: hai người chung áo choàng vàng, ô chữ nhật mực/kem, hoa sen
    const c: Cols = { skin: C.DAT1, skinSh: C.DAT3, hair: C.INK, cloth: C.CROM5, clothSh: C.CROM7, pants: C.CROM5 };
    // áo choàng vàng chung (rộng), hai đầu: người cao (tóc đen, cúi) + người thấp (tóc nâu cài hoa)
    const X0 = Math.max(0, r.tx[0] - (ti <= 1 ? 2 : 1)), X1 = Math.min(r.W - 1, r.tx[1] + (ti <= 1 ? 2 : 1));
    s.rect(X0, 0, X1, r.ty[1] + (ti <= 1 ? 1 : 0), C.CROM5);
    if (ti <= 1) for (let y = 1; y < r.ty[1]; y += 2) for (let x = X0 + 1; x <= X1 - 1; x += 3) s.set(x, y, x < (X0 + X1) / 2 ? C.INK : C.SEN);
    if (ti === 0) for (let y = 2; y < r.ty[1]; y += 3) s.set(X1 - 1, y, C.BACH1), s.set(X0 + 1, y + 1, C.MAY1);
    const hw = ti === 0 ? 4 : ti === 1 ? 3 : 1;
    const ah = ti === 0 ? 6 : ti === 1 ? 4 : 2; // chiều cao đầu
    // người thấp (trái), mặt ngửa
    const lx = X0 + (ti <= 1 ? 1 : 0), ly = r.ty[1] + (ti <= 1 ? 1 : 0);
    s.rect(lx, ly, lx + hw - 1, ly + ah - 2, C.DAT1);
    s.rect(lx, ly + ah - 2, lx + hw - 1, ly + ah - 2, C.DAT5);
    if (ti <= 1) s.set(lx, ly + ah - 2, C.SEN);
    // người cao (phải), tóc đen, cúi đầu về trái
    const rx = X1 - hw - (ti <= 1 ? 1 : 0) + 1, ry = ly + 1;
    s.rect(rx, ry, rx + hw - 1, ry + ah - 1, C.DAT3);
    s.rect(rx, ry + ah - 1, rx + hw - 1, ry + ah - 1, C.INK);
    s.rect(rx + hw - 1, ry, rx + hw - 1, ry + ah - 1, C.INK);
    if (cheeks) { // cả hai ôm má, miệng O
      s.set(lx - 1, ly + 1, C.DAT1); s.set(rx + hw, ry + 1, C.DAT3);
      if (ti <= 1) { s.set(lx + 1, ly + 1, C.INK); s.set(rx + 1, ry + 1, C.INK); }
      else { s.set(lx, ly, C.INK); }
    }
  } else { // Quý bà che ô — Seurat: váy tím sẫm chấm điểm, phồng sau lưng, ô vòm trên đầu
    const c: Cols = { skin: C.DAT1, skinSh: C.DAT3, hair: C.DAT7, cloth: C.TIM7, clothSh: C.INK, pants: C.TIM7 };
    figure(s, r, c, 2, cheeks ? 'cheek1' : 'none', { legs: true });
    s.rect(r.tx[0], 0, r.tx[1] + 1, r.legTop, C.TIM7); // váy dài
    if (ti <= 1) s.rect(r.tx[1] + 1, 1, r.tx[1] + 1 + (ti === 0 ? 1 : 0), r.ty[0] + 2, C.TIM7); // phồng sau
    if (ti <= 1) for (let y = 0; y <= r.ty[1]; y++) for (let x = r.tx[0]; x <= r.tx[1] + 1; x++) if ((x * 3 + y * 2) % 5 === 0 && s.get(x, y) === C.TIM7) s.set(x, y, C.TIM5);
    // ô vòm
    const top = r.H - 1, cx = (r.hx[0] + r.hx[1]) >> 1;
    const half = ti === 0 ? 6 : ti === 1 ? 5 : ti === 2 ? 3 : 2;
    s.rect(cx - half + 2, top, cx + half - 2, top, C.PHO5);
    s.rect(cx - half + 1, top - 1, cx + half - 1, top - 1, C.PHO5);
    if (ti <= 1) s.rect(cx - half, top - 2, cx + half, top - 2, C.PHO3);
    if (ti <= 1) for (let x = cx - half + 1; x <= cx + half; x += 3) s.set(x, top - 1, C.CROM3);
    if (ti <= 1) s.rect(cx, r.hy[1] + 2, cx, top - 3, C.DAT7); // cán ô
  }
  if (r.outline) s.outline();
}

/** Tạo DataTexture atlas (512 × 64). */
export function buildCrowdAtlas(): THREE.DataTexture {
  const data = new Uint8Array(ATLAS_W * ATLAS_H * 4);
  const put = (col: number, ti: number, s: Sprite) => {
    const T = TIERS[ti]!;
    for (let y = 0; y < T.H; y++) for (let x = 0; x < T.W; x++) {
      const v = s.get(x, y);
      if (v < 0) continue;
      const o = ((T.y + y) * ATLAS_W + col * T.W + x) * 4;
      data[o] = v; data[o + 3] = 255;
    }
  };
  const POSES: Pose[] = ['low', 'up', 'upAlt', 'both', 'cheek0', 'cheek1'];
  TIERS.forEach((T, ti) => {
    const r = RIGS[ti]!;
    for (let st = 0; st < 3; st++) POSES.forEach((p, pi) => {
      const s = new Sprite(T.W, T.H);
      figure(s, r, VAR, st, p);
      if (r.outline) s.outline();
      put(st * 6 + pi, ti, s);
    });
    for (let f = 0; f < 4; f++) { const s = new Sprite(T.W, T.H); screamer(s, ti, f); put(COL_SCREAMER + f, ti, s); }
    for (let g = 0; g < GUEST_COUNT; g++) for (let k = 0; k < 2; k++) {
      const s = new Sprite(T.W, T.H); guest(s, ti, g, k === 1); put(COL_GUEST + g * 2 + k, ti, s);
    }
  });
  const tex = new THREE.DataTexture(data, ATLAS_W, ATLAS_H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.flipY = false; tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Xuất atlas thành ảnh xem thử (dev): mã vùng → màu tạm. */
export function atlasPreviewRgba(): { data: Uint8ClampedArray; w: number; h: number } {
  const tex = buildCrowdAtlas();
  const src = tex.image.data as Uint8Array, pal = pixelPalette();
  const VARC = [0xf0c79a, 0xc98a56, 0x3b2416, 0x2f5fb8, 0x1f3a8a, 0x2a2350, 0xf7dc78, 0xfdf6d0];
  const out = new Uint8ClampedArray(ATLAS_W * ATLAS_H * 4);
  for (let y = 0; y < ATLAS_H; y++) for (let x = 0; x < ATLAS_W; x++) {
    const i = (y * ATLAS_W + x) * 4, o = ((ATLAS_H - 1 - y) * ATLAS_W + x) * 4;
    if (!src[i + 3]) { out.set([40, 40, 60, 255], o); continue; }
    const code = src[i]!, hex = code < 31 ? pal[code]! : VARC[code - 32]!;
    out.set([(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255], o);
  }
  tex.dispose();
  return { data: out, w: ATLAS_W, h: ATLAS_H };
}
