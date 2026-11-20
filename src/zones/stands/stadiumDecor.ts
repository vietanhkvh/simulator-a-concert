// Đồ trang trí khán đài gộp thành 1 mesh: bảng khu A–H, bóng đèn dây, cờ đuôi nheo + dây cờ.
import * as THREE from 'three';
import { INK_HEX, PAL, PAL_HEX, hexToRgb, shade, shadowOf } from '../../world/style';

type V3 = number[];
export interface DecorTier { rf: number; y0: number; yf0: number }

const sh = (hex: number): V3 => hexToRgb(shade(hex, 'stands'));
const BULB_COLS = () => [PAL.berry[500], PAL.honey[500], PAL.soda[500], PAL.mint[500], PAL.peach[500], PAL.grape[300]].map(sh);
const FLAG_COLS = () => [PAL.berry[500], PAL.soda[500], PAL.honey[500], PAL.mint[500], PAL.grape[500], PAL.peach[500]].map(sh);
const LETTERS = 'ABCDEFGH';
export const SIGN_W = 4.4, SIGN_H = 2.0;
const CELL_W = 440, CELL_H = 200;

/** Atlas 4×2 ô: chữ kem trên bảng berry / grape, viền ink, đốm highlight kem. */
export function makeSignAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = CELL_W * 4; cv.height = CELL_H * 2;
  const g = cv.getContext('2d');
  if (!g) return null;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  for (let k = 0; k < 8; k++) {
    const ox = (k % 4) * CELL_W, oy = Math.floor(k / 4) * CELL_H;
    const base = k % 2 === 0 ? PAL.berry[700] : PAL.grape[700];
    const dark = '#' + shadowOf(base).toString(16).padStart(6, '0');
    g.save();
    rr(ox + 8, oy + 8, CELL_W - 16, CELL_H - 16, 62); g.clip();
    g.fillStyle = k % 2 === 0 ? PAL_HEX.berry[700] : PAL_HEX.grape[700]; g.fillRect(ox, oy, CELL_W, CELL_H);
    g.fillStyle = dark; g.fillRect(ox, oy + CELL_H * 0.66, CELL_W, CELL_H);
    g.restore();
    rr(ox + 8, oy + 8, CELL_W - 16, CELL_H - 16, 62);
    g.lineWidth = 10; g.strokeStyle = INK_HEX; g.stroke();
    rr(ox + 20, oy + 20, CELL_W - 40, CELL_H - 40, 50);
    g.lineWidth = 4; g.strokeStyle = PAL_HEX.cream[500]; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;
    g.fillStyle = PAL_HEX.cream[100]; g.globalAlpha = 0.4; g.beginPath(); g.ellipse(ox + 58, oy + 50, 16, 9, -0.5, 0, 6.3); g.fill(); g.globalAlpha = 1;
    g.font = '900 172px "Baloo 2", "Arial Rounded MT Bold", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 34; g.strokeStyle = INK_HEX; g.strokeText(LETTERS[k], ox + CELL_W / 2, oy + CELL_H / 2 + 8);
    g.fillStyle = PAL_HEX.cream[500]; g.fillText(LETTERS[k], ox + CELL_W / 2, oy + CELL_H / 2 + 8);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

export interface DecorOpts {
  P: (r: number, a: number, y: number) => V3;
  A0: number; A1: number; tiers: readonly DecorTier[];
  signSections: number; signR: (T: DecorTier) => number;
  roofBulb: { r: number; y: number };
}

export function buildDecor(o: DecorOpts): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], uv: number[] = [], info: number[] = [];
  const tri = (p: V3[], c: V3, u: number[][], inf: number[][]) => {
    for (let i = 0; i < 3; i++) { pos.push(...p[i]); col.push(...c); uv.push(...u[i]); info.push(...inf[i]); }
  };
  const quad = (p: V3[], c: V3, u: number[][], inf: number[]) => {
    tri([p[0], p[1], p[2]], c, [u[0], u[1], u[2]], [inf, inf, inf]);
    tri([p[0], p[2], p[3]], c, [u[0], u[2], u[3]], [inf, inf, inf]);
  };
  const { P, A0, A1 } = o;
  const arc = A1 - A0;
  const tang = (a: number): V3 => [Math.cos(a), 0, Math.sin(a)];

  // 1) bóng đèn dây dọc mép lan can mỗi tầng + mép mái
  const rows = [...o.tiers.map((T) => ({ r: T.rf - 0.56, y: T.y0 - 0.3 })), o.roofBulb];
  rows.forEach((row, ti) => {
    const n = Math.round((row.r * arc) / 1.6);
    for (let i = 0; i < n; i++) {
      const a = A0 + (arc * i) / (n - 1);
      const c = P(row.r, a, row.y), t = tang(a), s = 0.55;
      const cc = BULB_COLS()[(i + ti * 2) % BULB_COLS().length];
      const q = (sx: number, sy: number): V3 => [c[0] + t[0] * sx * s, c[1] + sy * s, c[2] + t[2] * sx * s];
      quad([q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)], cc, [[-1, -1], [1, -1], [1, 1], [-1, 1]], [1, i, 0, ti]);
    }
  });

  // 2) biển khu A–H trên mặt trước từng tầng
  const dA = arc / o.signSections;
  o.tiers.forEach((T, ti) => {
    // biển lớn hơn ở mọi tầng (tầng 2/3 ở xa hơn nên to hơn nữa); nhô khỏi gờ tầng ~0,5 m để không dính tường
    const w = SIGN_W * (ti === 0 ? 2.1 : ti === 1 ? 2.3 : 2.5), h = SIGN_H * (ti === 0 ? 1.6 : ti === 1 ? 1.5 : 1.5);
    const r = o.signR(T) - 0.5, top = T.y0 - 0.7, bot = top - h;
    for (let k = 0; k < o.signSections; k++) {
      const ac = A0 + dA * (k + 0.5), half = w / 2 / r;
      const u0 = (k % 4) / 4, u1 = u0 + 0.25, vb = 1 - (Math.floor(k / 4) + 1) / 2, vt = vb + 0.5;
      const SEG = 4;
      for (let j = 0; j < SEG; j++) {
        const f0 = j / SEG, f1 = (j + 1) / SEG;
        const a0 = ac - half + 2 * half * f0, a1 = ac - half + 2 * half * f1;
        quad([P(r, a0, bot), P(r, a1, bot), P(r, a1, top), P(r, a0, top)], [1, 1, 1],
          [[u0 + (u1 - u0) * f0, vb], [u0 + (u1 - u0) * f1, vb], [u0 + (u1 - u0) * f1, vt], [u0 + (u1 - u0) * f0, vt]], [0, 0, 0, 0]);
      }
    }
  });

  // 3) cột cờ + dây + cờ đuôi nheo phía trên mép mái
  const R = o.roofBulb.r - 1.7, yBase = 35.4, yPole = 38.9;
  const nSpan = Math.round((R * arc) / 9);
  const stringC = sh(PAL.cream[700]), poleC = sh(PAL.night[100]);
  const ys = (f: number) => yPole - 0.35 - 0.95 * 4 * f * (1 - f); // dây võng
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let s = 0; s <= nSpan; s++) {
    const a = A0 + (arc * s) / nSpan, t = tang(a), c = P(R, a, yBase);
    quad([[c[0] - t[0] * 0.14, yBase, c[2] - t[2] * 0.14], [c[0] + t[0] * 0.14, yBase, c[2] + t[2] * 0.14],
      [c[0] + t[0] * 0.14, yPole, c[2] + t[2] * 0.14], [c[0] - t[0] * 0.14, yPole, c[2] - t[2] * 0.14]], poleC, [[0, 0], [0, 0], [0, 0], [0, 0]], [3, 0, 0, 0]);
  }
  for (let s = 0; s < nSpan; s++) {
    const aS = A0 + (arc * s) / nSpan, aE = A0 + (arc * (s + 1)) / nSpan;
    const M = 6;
    for (let m = 0; m < M; m++) { // dây
      const f0 = m / M, f1 = (m + 1) / M;
      const a0 = aS + (aE - aS) * f0, a1 = aS + (aE - aS) * f1;
      quad([P(R, a0, ys(f0) - 0.05), P(R, a1, ys(f1) - 0.05), P(R, a1, ys(f1) + 0.05), P(R, a0, ys(f0) + 0.05)], stringC, [[0, 0], [0, 0], [0, 0], [0, 0]], [3, 0, 0, 0]);
    }
    const NF = 4;
    for (let j = 0; j < NF; j++) {
      const fc = (j + 0.5) / NF, hw = 0.42 / NF; // nửa bề rộng cờ theo phần của nhịp
      const aL = aS + (aE - aS) * (fc - hw), aR = aS + (aE - aS) * (fc + hw), aM = aS + (aE - aS) * fc;
      const ph = rnd() * 6.3;
      const cc = FLAG_COLS()[(s * 2 + j) % FLAG_COLS().length];
      const inf = (w: number) => [2, w, ph, 0];
      tri([P(R, aL, ys(fc - hw) - 0.04), P(R, aR, ys(fc + hw) - 0.04), P(R, aM, ys(fc) - 1.55)], cc, [[0, 0], [1, 0], [0.5, 1]], [inf(0), inf(0), inf(1)]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
  return g;
}
