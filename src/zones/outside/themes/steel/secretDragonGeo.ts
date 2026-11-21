// Phụ trợ S4: hình học rồng cơ khí (gộp, phẳng mặt). Hệ toạ độ cục bộ: +z = tiến (về phía đầu), +y = lưng, x = sườn.
// Bộ phận (aPart): 0 đốt thân · 1 đầu · 2 hàm dưới (gốc = bản lề) · 3 chân thuỷ lực · 4 đuôi chuỳ gai.
import * as THREE from 'three';
import { M, Parts } from './secretDragonKit';

export const P_SEG = 0, P_HEAD = 1, P_JAW = 2, P_LEG = 3, P_TAIL = 4;
/** Bản lề hàm trong hệ đầu. */
export const JAW_HINGE = new THREE.Vector3(0, -0.15, 0.9);
/** Miệng (gốc ngọn lửa) trong hệ đầu. */
export const MOUTH = new THREE.Vector3(0, -0.35, 4.4);
/** Gốc ống xả / sừng (phun tia lửa) trong hệ đầu. */
export const HORN_TIP = new THREE.Vector3(0, 2.3, -2.0);

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Vòng lục giác dẹt (tiết diện đốt): trên rộng tw, giữa mw, đáy bw. */
function hex(z: number, tw: number, ty: number, mw: number, my: number, bw: number, by: number) {
  return [V(tw, ty, z), V(-tw, ty, z), V(-mw, my, z), V(-bw, by, z), V(bw, by, z), V(mw, my, z)];
}

export function buildMechDragon(): THREE.BufferGeometry {
  const p = new Parts();
  // ── 0 đốt thân: tấm vỏ hình thang (sau nhỏ hơn trước) + khe lò (lõi lục giác dài hơn, lộ ra giữa hai tấm)
  //    + lưỡi lưng đỏ huyết vuốt ngược + bu-lông bản lề chrome hai bên
  p.curPart = P_SEG;
  const plateMats = [M.plate, M.plate, M.plate, M.dark, M.plate, M.plate];
  p.loft([hex(0.45, 0.62, 1.0, 1.12, 0.15, 0.78, -0.85), hex(-0.42, 0.52, 0.88, 0.98, 0.12, 0.66, -0.74)], plateMats, true, M.dark);
  p.loft([hex(0.55, 0.5, 0.86, 0.95, 0.12, 0.65, -0.72), hex(-0.55, 0.5, 0.86, 0.95, 0.12, 0.65, -0.72)], M.seam, false);
  // lưỡi lưng (lăng trụ tam giác mỏng)
  {
    const t = 0.09;
    const a = [V(0, 0.95, 0.3), V(0, 0.92, -0.32), V(0, 2.05, -0.5)];
    p.loft([a.map((q) => q.clone().setX(t)), a.map((q) => q.clone().setX(-t))], M.blade);
  }
  for (const s of [-1, 1]) {
    p.beam(V(s * 1.08, 0.15, 0.32), V(s * 1.24, 0.15, 0.32), 0.26, 0.26, M.chrome);
    p.beam(V(s * 1.08, 0.15, -0.3), V(s * 1.22, 0.15, -0.3), 0.2, 0.2, M.chrome);
    // rãnh tấm sườn (gờ nổi)
    p.beam(V(s * 1.0, -0.45, 0.34), V(s * 1.0, -0.45, -0.3), 0.16, 0.14, M.dark);
  }

  // ── 1 đầu: nêm góc cạnh (gốc = khớp cổ), mặt dưới phẳng nhường chỗ cho hàm
  p.curPart = P_HEAD;
  const hr = [
    hex(-0.6, 0.6, 0.95, 1.05, 0.15, 0.75, -0.75),
    hex(0.9, 0.85, 1.25, 1.35, 0.35, 1.0, -0.2),
    hex(2.4, 0.6, 0.95, 1.05, 0.25, 0.85, -0.25),
    hex(3.7, 0.35, 0.55, 0.7, 0.1, 0.6, -0.3),
    hex(4.6, 0.12, 0.2, 0.32, -0.05, 0.28, -0.3),
  ];
  p.loft(hr, [M.plate, M.dark, M.plate, M.dark, M.dark, M.plate], true, M.dark);
  // gờ mày sắc + tấm mắt vàng/trắng nung
  for (const s of [-1, 1]) {
    p.quad(V(s * 0.98, 0.98, 2.35), V(s * 1.12, 0.62, 2.45), V(s * 1.26, 0.6, 1.25), V(s * 0.96, 1.18, 1.05), M.eye);
    p.beam(V(s * 0.7, 1.3, 0.7), V(s * 0.55, 1.05, 2.6), 0.32, 0.22, M.dark);
    // sừng = ống xả vuốt ngược, miệng ống đỏ lò
    p.loft([
      [V(s * 0.45, 1.05, 0.6), V(s * 0.85, 1.05, 0.6), V(s * 0.85, 1.15, 1.1), V(s * 0.45, 1.15, 1.1)],
      [V(s * 0.6, 1.9, -0.6), V(s * 0.95, 1.9, -0.6), V(s * 0.95, 2.05, -0.2), V(s * 0.6, 2.05, -0.2)],
      [V(s * 0.72, 2.25, -2.0), V(s * 1.02, 2.25, -2.0), V(s * 1.02, 2.4, -1.7), V(s * 0.72, 2.4, -1.7)],
    ], M.chrome, false);
    p.quad(V(s * 0.72, 2.25, -2.0), V(s * 1.02, 2.25, -2.0), V(s * 1.02, 2.4, -1.7), V(s * 0.72, 2.4, -1.7), M.seam);
    // piston cổ (xi lanh + cần chrome) chạy về đốt đầu tiên
    p.beam(V(s * 0.95, -0.35, 0.4), V(s * 0.95, -0.35, -1.1), 0.34, 0.34, M.dark);
    p.beam(V(s * 0.95, -0.35, -1.1), V(s * 0.95, -0.35, -2.3), 0.16, 0.16, M.chrome);
    // răng trên: hàng tam giác đỏ nung chĩa xuống
    for (let k = 0; k < 6; k++) {
      const z = 1.6 + k * 0.5, w = 0.95 - k * 0.11;
      p.spike(V(s * w, -0.22, z), V(s * w * 0.95, -0.72 + k * 0.03, z + 0.05), 0.15, M.teeth, 3, 0.3);
    }
  }
  p.spike(V(0, -0.25, 4.45), V(0, -0.75, 4.55), 0.16, M.teeth);
  // mào sống mũi: gai đỏ huyết
  for (let k = 0; k < 3; k++) p.spike(V(0, 1.1 - k * 0.15, 1.2 + k * 0.9), V(0, 1.75 - k * 0.3, 0.9 + k * 0.9), 0.18, M.blade, 3, Math.PI / 2);

  // ── 2 hàm dưới (gốc = bản lề): nêm mỏng, lưỡi lò đỏ bên trong, răng chĩa lên
  p.curPart = P_JAW;
  const jr = [
    [V(0.85, 0.0, -0.3), V(-0.85, 0.0, -0.3), V(-0.75, -0.55, -0.3), V(0.75, -0.55, -0.3)],
    [V(0.75, -0.1, 1.8), V(-0.75, -0.1, 1.8), V(-0.6, -0.75, 1.6), V(0.6, -0.75, 1.6)],
    [V(0.3, -0.15, 3.6), V(-0.3, -0.15, 3.6), V(-0.2, -0.45, 3.5), V(0.2, -0.45, 3.5)],
  ];
  p.loft(jr, [M.seam, M.plate, M.dark, M.plate], true, M.dark);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const z = 0.9 + k * 0.55, w = 0.72 - k * 0.1;
      p.spike(V(s * w, -0.05, z), V(s * w * 0.9, 0.45 - k * 0.03, z + 0.05), 0.14, M.teeth, 3, 0.7);
    }
    p.beam(V(s * 0.9, -0.05, -0.3), V(s * 0.98, -0.05, -0.3), 0.36, 0.36, M.chrome); // chốt bản lề
  }

  // ── 3 chân thuỷ lực (gốc = hông, bên +x; bên kia lật x): đùi hộp, cần piston, cẳng, bàn vuốt 3 móng
  p.curPart = P_LEG;
  p.beam(V(0, 0, 0), V(0.35, -1.2, 0.35), 0.55, 0.5, M.dark);
  p.beam(V(0.35, -1.2, 0.35), V(0.3, -2.3, 0.0), 0.36, 0.36, M.chrome);
  p.beam(V(-0.05, -0.2, -0.3), V(0.25, -1.6, 0.05), 0.18, 0.18, M.chrome);
  p.spike(V(0.32, -2.3, 0.0), V(0.32, -2.55, 0.0), 0.45, M.plate, 4, Math.PI / 4);
  for (let k = -1; k <= 1; k++) p.spike(V(0.3 + k * 0.28, -2.45, 0.2), V(0.3 + k * 0.42, -2.75, 1.05), 0.12, M.chrome, 3, 0);

  // ── 4 đuôi: cần nối + chuỳ bát diện gai (gai đỏ huyết) + lưỡi hàn
  p.curPart = P_TAIL;
  p.beam(V(0, 0, 0.5), V(0, 0, -1.4), 0.5, 0.5, M.dark);
  const c = V(0, 0, -2.4), R = 1.05;
  const o = [V(R, 0, 0), V(0, R, 0), V(-R, 0, 0), V(0, -R, 0), V(0, 0, R), V(0, 0, -R)].map((q) => q.add(c));
  const F = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [1, 0, 5], [2, 1, 5], [3, 2, 5], [0, 3, 5]];
  F.forEach(([a, b, d], i) => p.tri(o[a]!, o[b]!, o[d]!, i % 2 ? M.plate : M.dark));
  for (const d of [V(1, 0.4, 0), V(-1, 0.4, 0), V(0, 1, -0.3), V(0, -1, -0.2), V(0.6, -0.5, -0.6), V(-0.6, -0.5, -0.6), V(0, 0.2, -1)]) {
    const n = d.normalize();
    p.spike(c.clone().addScaledVector(n, R * 0.55), c.clone().addScaledVector(n, R * 2.0), 0.28, M.blade, 3, 0.4);
  }
  return p.geometry();
}

/** Ngọn lửa khối 3 lớp: 9 khối lăng trụ 6 cạnh/lớp xoay lệch ngẫu nhiên dọc trục +z (dài 1 đơn vị, scale theo instance).
 *  aFl = (lớp 0 than hồng · 1 lửa · 2 lõi, chỉ số khối k/K, hạt ngẫu nhiên). */
export function buildFlameJet(): THREE.BufferGeometry {
  const K = 9;
  const pos: number[] = [], fl: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const LAYERS = [{ r: 1.0, l: 1.0 }, { r: 0.68, l: 0.84 }, { r: 0.36, l: 0.62 }];
  LAYERS.forEach((L, li) => {
    for (let k = 0; k < K; k++) {
      const u0 = (k / K) * L.l, u1 = ((k + 1) / K) * L.l * 1.04;
      const prof = (u: number) => (0.045 + 0.15 * Math.pow(u / L.l, 0.7)) * (u / L.l > 0.8 ? 1 - (u / L.l - 0.8) * 2.5 : 1);
      const r0 = prof(u0) * L.r * (0.9 + 0.25 * rnd()), r1 = prof(Math.min(u1, L.l)) * L.r * (0.9 + 0.25 * rnd());
      const rot = rnd() * Math.PI, ox = (rnd() - 0.5) * 0.03, oy = (rnd() - 0.5) * 0.03, hs = rnd();
      const ring = (z: number, r: number) => Array.from({ length: 6 }, (_, i) => {
        const a = rot + (i / 6) * Math.PI * 2;
        return [ox + Math.cos(a) * r, oy + Math.sin(a) * r * 0.85, z];
      });
      const A = ring(u0, r0), B = ring(u1, r1);
      const push = (q: number[]) => { pos.push(q[0]!, q[1]!, q[2]!); fl.push(li, k / K, hs); };
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        [A[i]!, A[j]!, B[j]!, A[i]!, B[j]!, B[i]!].forEach(push);
      }
      for (let i = 1; i < 5; i++) [B[0]!, B[i]!, B[i + 1]!].forEach(push);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFl', new THREE.Float32BufferAttribute(fl, 3));
  return g;
}
