// Hình khối đôi rồng Lý (L2) — một BufferGeometry chung cho cả con (thân + đầu + chân + vây + bờm + râu + ngọc).
// Mỗi đỉnh: aP (toạ độ soạn), aN (pháp tuyến cục bộ), aK = (kind, mode, flutter, uv).
//   mode 0 "bám thân": s = −aP.z, lệch (aP.x, aP.y) trong khung thân tại s (vây, chân, bờm dọc cổ).
//   mode 1 "ống thân": như 0 nhưng (aP.x, aP.y) nhân bán kính R(s) (thân tròn trơn).
//   mode 2 "đầu cứng": khung tại s = 0, lệch aP (z = phía trước).
// kind: 0 thân · 1 da đầu · 2 son (mào, vây, lửa khuỷu, lưỡi) · 3 bờm/râu · 4 lòng miệng · 5 ngọc · 6 mắt · 7 móng/nanh/ánh mắt.
import * as THREE from 'three';

export const R0 = 0.86; // bán kính cổ (m)
export const LB = 34; // chiều dài thân (m)
const sm = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
/** Bán kính thân tại s (khớp GLSL radAt): cổ hơi khoẻ, thon đều về đuôi, dày–mỏng như nét cọ. */
export const radAt = (s: number) =>
  R0 * (0.84 + 0.16 * sm(0, 2.5, s)) * (1 - 0.88 * Math.pow(Math.min(1, Math.max(0, s / LB)), 1.15)) * (1 + 0.07 * Math.sin(s * 0.55 + 1.3));

/** Ngẩng đầu: xoay quanh trục ngang (mũi lên). */
export const HEAD_PITCH = -0.24;
const PITCH = new THREE.Matrix4().makeRotationX(HEAD_PITCH);
/** Ngọc trước miệng (toạ độ đầu, sau khi ngẩng). */
export const PEARL_LOCAL = new THREE.Vector3(0, -0.8, 3.05).applyMatrix4(PITCH);

class GB {
  p: number[] = []; n: number[] = []; k: number[] = []; idx: number[] = [];
  private v(p: THREE.Vector3, n: THREE.Vector3, k: [number, number, number, number]) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.k.push(...k);
    return this.p.length / 3 - 1;
  }
  /** Ống dọc đường cong (khung vận chuyển song song), bán kính r(u), dẹt theo x cục bộ nếu flat < 1. */
  tube(pts: THREE.Vector3[], r: (u: number) => number, o: { kind: number; mode: number; flut?: (u: number) => number; seg?: number; rad?: number; flat?: number; xf?: THREE.Matrix4 }) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const seg = o.seg ?? 16, rad = o.rad ?? 7;
    const fr = curve.computeFrenetFrames(seg, false);
    const base = this.p.length / 3;
    const P = new THREE.Vector3(), N = new THREE.Vector3(), Q = new THREE.Vector3();
    const nm = o.xf ? new THREE.Matrix3().getNormalMatrix(o.xf) : null;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      curve.getPointAt(u, P);
      const rr = r(u);
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2;
        N.copy(fr.normals[i]!).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i]!, Math.sin(a));
        if (o.flat !== undefined) { N.x *= o.flat; }
        Q.copy(P).addScaledVector(N, rr);
        N.normalize();
        if (o.flat !== undefined) N.x /= o.flat * o.flat, N.normalize();
        if (o.xf) { Q.applyMatrix4(o.xf); N.applyMatrix3(nm!).normalize(); }
        this.v(Q, N, [o.kind, o.mode, o.flut ? o.flut(u) : 0, u]);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = base + i * (rad + 1) + j, b = a + rad + 1;
      this.idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  ellipsoid(m: THREE.Matrix4, kind: number, mode = 2, ws = 16, hs = 12) {
    const g = new THREE.SphereGeometry(1, ws, hs);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const base = this.p.length / 3;
    const pa = g.getAttribute('position'), na = g.getAttribute('normal');
    const P = new THREE.Vector3(), N = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      P.fromBufferAttribute(pa, i).applyMatrix4(m);
      N.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      this.v(P, N, [kind, mode, 0, (pa.getY(i) + 1) * 0.5]);
    }
    const ix = g.index!;
    for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
    g.dispose();
  }
  /** Thân: ống đơn vị (mode 1), z = −s. */
  body(rings: number, rad: number) {
    const base = this.p.length / 3;
    const s0 = -0.3;
    for (let i = 0; i <= rings; i++) {
      const s = s0 + ((LB - s0) * i) / rings;
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2 - Math.PI / 2;
        const c = Math.cos(a), sn = Math.sin(a);
        this.v(new THREE.Vector3(c, sn, -s), new THREE.Vector3(c, sn, 0), [0, 1, 0, s / LB]);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < rad; j++) {
      const a = base + i * (rad + 1) + j, b = a + rad + 1;
      this.idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('aP', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); // chỉ để three tính bounding (frustumCulled = false)
    g.setAttribute('aN', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aK', new THREE.Float32BufferAttribute(this.k, 4));
    g.setIndex(this.idx);
    return g;
  }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const M = (t: THREE.Vector3, sc: THREE.Vector3, rx = 0, ry = 0, rz = 0) =>
  PITCH.clone().multiply(new THREE.Matrix4().compose(t, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), sc));
const taper = (a: number, b: number, p = 1) => (u: number) => a + (b - a) * Math.pow(u, p);

export function buildLyDragon(): THREE.BufferGeometry {
  const g = new GB();
  // ── thân tròn trơn
  g.body(240, 14);

  // ── vây lưng: hàng răng lửa nhỏ liền mạch (son), nghiêng về sau
  for (let s = 0.9; s < LB * 0.86; s += 0.42) {
    const r = radAt(s);
    const h = 0.18 + 0.5 * (r / R0);
    g.tube([V(0, r * 0.86, -s), V(0, r + h * 0.55, -(s + 0.12)), V(0, r + h, -(s + 0.42))], taper(0.15 * (r / R0) + 0.04, 0.012), { kind: 2, mode: 0, seg: 3, rad: 5, flat: 0.35 });
  }
  // ── bốn chân mảnh, ba móng, túm lửa khuỷu
  for (const [s0, hind] of [[4.6, 0], [LB * 0.43, 1]] as const) {
    const r = radAt(s0);
    for (const sx of [-1, 1]) {
      const z0 = -s0;
      const fz = hind ? -1 : 1; // chân sau duỗi ra sau
      const P0 = V(sx * r * 0.55, -r * 0.55, z0), P1 = V(sx * (r + 0.45), -(r + 0.35), z0 + 0.35 * fz);
      const P2 = V(sx * (r + 0.75), -(r + 1.25), z0 - 0.35 * fz), P3 = V(sx * (r + 0.85), -(r + 2.0), z0 + 0.45 * fz);
      g.tube([P0, P1, P2, P3], taper(0.26 * r, 0.1), { kind: 0, mode: 0, seg: 10, rad: 7 });
      // 3 móng xoè, cong xuống
      for (let c = -1; c <= 1; c++) {
        const d = V(sx * 0.22 * c + sx * 0.08, 0, fz * 0.5).normalize();
        const a = P3.clone(), b = P3.clone().addScaledVector(d, 0.42).add(V(0, -0.05, 0)), e = P3.clone().addScaledVector(d, 0.68).add(V(0, -0.38, 0));
        g.tube([a, b, e], taper(0.085, 0.012), { kind: 7, mode: 0, seg: 5, rad: 5 });
      }
      // túm lửa khuỷu
      g.tube([P2, P2.clone().add(V(sx * 0.15, 0.25, -0.55 * fz)), P2.clone().add(V(sx * 0.3, 0.6, -1.05 * fz))], taper(0.13, 0.015), { kind: 2, mode: 0, seg: 6, rad: 5, flat: 0.5, flut: (u) => u * 0.6 });
    }
  }
  // ── bờm dọc gáy (bám thân): dải dài bay ngược
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) {
      const s0 = 0.4 + i * 0.5, r = radAt(s0);
      const pts = [V(sx * r * 0.45, r * 0.85, -s0)];
      for (let k = 1; k <= 6; k++) {
        const s = s0 + k * 1.15;
        const rr = radAt(s);
        pts.push(V(sx * (rr * 0.6 + 0.25 * k * (0.7 + 0.2 * i)), rr * 0.9 + 0.35 + 0.18 * k - 0.1 * i, -s));
      }
      g.tube(pts, taper(0.16, 0.02), { kind: 3, mode: 0, seg: 18, rad: 5, flat: 0.55, flut: (u) => u * 1.2 });
    }
  }

  // ── ĐẦU (mode 2) — dài, thanh, không sừng
  const E = (t: THREE.Vector3, s: THREE.Vector3, kind: number, rx = 0, ry = 0, rz = 0) => g.ellipsoid(M(t, s, rx, ry, rz), kind);
  E(V(0, 0.18, 0.35), V(0.9, 0.8, 1.25), 1); // sọ
  E(V(0, 0.62, 0.95), V(0.62, 0.32, 0.7), 1); // gờ trán
  E(V(0, 0.14, 1.95), V(0.56, 0.4, 1.22), 1, 0.06); // mõm trên
  E(V(0, -0.58, 1.55), V(0.46, 0.2, 1.15), 1, 0.42); // hàm dưới há
  E(V(0, -0.18, 1.75), V(0.4, 0.3, 0.95), 4, 0.2); // lòng miệng
  // môi trên vươn dài cong lên như vòi
  g.tube([V(0, 0.2, 2.6), V(0, 0.32, 3.3), V(0, 0.62, 3.78), V(0, 1.0, 3.8), V(0, 1.16, 3.48), V(0, 0.98, 3.26)], taper(0.34, 0.08, 0.8), { kind: 1, mode: 2, seg: 22, rad: 9, xf: PITCH });
  // lưỡi mảnh
  g.tube([V(0, -0.3, 1.9), V(0, -0.28, 2.8), V(0, -0.05, 3.15), V(0, 0.22, 3.05)], taper(0.08, 0.02), { kind: 2, mode: 2, seg: 10, rad: 5, xf: PITCH });
  for (const sx of [-1, 1]) {
    // nanh nhỏ
    g.tube([V(sx * 0.3, 0.0, 2.6), V(sx * 0.3, -0.22, 2.68), V(sx * 0.28, -0.38, 2.6)], taper(0.07, 0.01), { kind: 7, mode: 2, seg: 4, rad: 5, xf: PITCH });
    // mắt hạnh nhân xếch + ánh vàng
    E(V(sx * 0.6, 0.55, 1.12), V(0.13, 0.15, 0.36), 6, 0, sx * 0.3, sx * 0.32);
    E(V(sx * 0.7, 0.62, 1.3), V(0.055, 0.055, 0.055), 7);
    // nét mày: một nét cọ son vút ra sau thành lửa
    g.tube([V(sx * 0.48, 0.78, 1.5), V(sx * 0.7, 0.92, 0.95), V(sx * 0.82, 1.2, 0.3), V(sx * 0.78, 1.55, -0.35)], taper(0.09, 0.015), { kind: 2, mode: 2, seg: 10, rad: 5, xf: PITCH, flat: 0.6 });
    // lửa mang tai
    for (let i = 0; i < 2; i++) {
      g.tube([V(sx * 0.75, -0.25 - i * 0.3, 0.35), V(sx * (1.0 + i * 0.1), -0.45 - i * 0.3, -0.35), V(sx * (1.15 + i * 0.1), -0.25 - i * 0.45, -1.15)], taper(0.15, 0.015), { kind: 2, mode: 2, seg: 8, rad: 5, xf: PITCH, flat: 0.45, flut: (u) => u * 0.4 });
    }
    // bờm sau đầu: dải dài bay ngược
    for (let i = 0; i < 5; i++) {
      const y0 = 0.35 + i * 0.16, x0 = sx * (0.35 + i * 0.07);
      g.tube([V(x0, y0, -0.2 + i * 0.05), V(sx * (0.6 + i * 0.06), y0 + 0.7, -1.8), V(sx * (0.85 + i * 0.07), y0 + 0.55, -3.4), V(sx * (1.0 + i * 0.1), y0 + 0.9 - i * 0.12, -5.2 - i * 0.2)],
        taper(0.14, 0.015), { kind: 3, mode: 2, seg: 18, rad: 5, xf: PITCH, flat: 0.6, flut: (u) => u * 1.3 });
    }
    // râu dài từ mép mõm, bay ngược
    g.tube([V(sx * 0.45, -0.02, 2.75), V(sx * 1.2, -0.35, 2.1), V(sx * 2.0, -0.95, 0.4), V(sx * 2.55, -0.55, -1.8), V(sx * 3.0, -1.25, -4.2)], taper(0.075, 0.015), { kind: 3, mode: 2, seg: 24, rad: 5, xf: PITCH, flut: (u) => u * 1.4 });
  }
  // râu cằm
  for (const sx of [-0.25, 0, 0.25]) g.tube([V(sx, -0.95, 1.2), V(sx * 1.4, -1.6, 0.6), V(sx * 1.8, -1.95, -0.4)], taper(0.09, 0.015), { kind: 3, mode: 2, seg: 10, rad: 5, xf: PITCH, flut: (u) => u });
  // MÀO LỬA son: nhiều lưỡi lửa vút cao trên mũi, cong ra sau
  const crest: [number, number, number, number][] = [[0, 2.35, 2.75, 0.3], [0, 2.0, 3.25, 0.28], [0, 1.65, 3.55, 0.26], [0, 1.3, 3.8, 0.22], [0.22, 1.85, 2.9, 0.18], [-0.22, 1.85, 2.9, 0.18]];
  crest.forEach(([x, zb, ht, rw], i) => {
    g.tube([V(x, 0.5, zb), V(x * 1.2, 0.5 + ht * 0.45, zb - 0.15 - 0.1 * i), V(x * 1.4, 0.5 + ht * 0.85, zb - 0.6 - 0.15 * i), V(x * 1.5, 0.5 + ht, zb - 1.15 - 0.2 * i), V(x * 1.5, 0.35 + ht * 0.92, zb - 1.5 - 0.2 * i)],
      taper(rw, 0.02, 0.9), { kind: 2, mode: 2, seg: 16, rad: 7, xf: PITCH, flat: 0.42, flut: (u) => u * u * 0.35 });
  });
  // ngọc trước miệng
  g.ellipsoid(new THREE.Matrix4().compose(PEARL_LOCAL, new THREE.Quaternion(), V(0.5, 0.5, 0.5)), 5, 2, 20, 14);
  return g.build();
}
