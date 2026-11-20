// "Mực & Sơn mài" — bộ dựng hình gộp cho sân khấu đình (không có `builders`: file phụ trợ).
// Tô 2 bậc phẳng theo pháp tuyến mặt (sáng / bóng ngả chàm qua shadowOf), không viền đen; viền là dải vàng quỳ.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RAMPS, shadowOf, toColor } from '../../../../world/style';

/** Ramp sơn mài (đọc tại thời điểm gọi — token đổi tại chỗ khi đổi phong cách). */
export const R = () => ({
  lac: RAMPS.lacquer!, son: RAMPS.son!, gold: RAMPS.gold!, jade: RAMPS.jade!, indigo: RAMPS.indigo!,
  amber: RAMPS.amber!, silk: RAMPS.silk!,
});

const UP = new THREE.Vector3(0, 1, 0);
const L = new THREE.Vector3(-0.35, 0.85, -0.4).normalize();
const _o = new THREE.Object3D();
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Gom hình → 1 geometry (position + color). `flat`: không tô bóng (vàng khảm, đèn). */
export class Kit {
  readonly parts: THREE.BufferGeometry[] = [];
  private c1 = new THREE.Color(); private c2 = new THREE.Color();
  add(g: THREE.BufferGeometry, hex: number, m?: THREE.Matrix4, flat = false): this {
    const h = g.index ? g.toNonIndexed() : g;
    if (h !== g) g.dispose();
    if (m) h.applyMatrix4(m);
    h.computeVertexNormals();
    const n = h.getAttribute('position').count, nr = h.getAttribute('normal');
    const col = new Float32Array(n * 3);
    toColor(hex, this.c1); toColor(shadowOf(hex), this.c2);
    for (let i = 0; i < n; i++) {
      const d = Math.abs(nr.getX(i) * L.x + nr.getY(i) * L.y + nr.getZ(i) * L.z);
      const c = flat || d > 0.42 ? this.c1 : this.c2;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    for (const k of Object.keys(h.attributes)) if (k !== 'position') h.deleteAttribute(k);
    h.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(h);
    return this;
  }
  xf(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
    _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
    return _o.matrix.clone();
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, hex: number, ry = 0, flat = false): this {
    return this.add(new THREE.BoxGeometry(w, h, d), hex, this.xf(x, y, z, 0, ry), flat);
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, hex: number, seg = 12, flat = false): this {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), hex, this.xf(x, y, z), flat);
  }
  sphere(r: number, x: number, y: number, z: number, hex: number, sx = 1, sy = 1, sz = 1, flat = false): this {
    return this.add(new THREE.SphereGeometry(r, 10, 7), hex, this.xf(x, y, z, 0, 0, 0, sx, sy, sz), flat);
  }
  /** Thanh tròn a→b (seg cạnh). */
  rod(a: THREE.Vector3, b: THREE.Vector3, r: number, hex: number, seg = 6, flat = false): this {
    const len = a.distanceTo(b);
    if (len < 1e-4) return this;
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
    return this.add(g, hex, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)), flat);
  }
  /** Thanh vuông a→b (dầm), tiết diện w×h, trục "lên" gần +Y. */
  beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, hex: number, flat = false): this {
    const len = a.distanceTo(b);
    if (len < 1e-4) return this;
    const dir = b.clone().sub(a).normalize();
    const side = new THREE.Vector3().crossVectors(UP, dir);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(dir, side).normalize();
    const m = new THREE.Matrix4().makeBasis(side, up, dir).setPosition(a.clone().add(b).multiplyScalar(0.5));
    return this.add(new THREE.BoxGeometry(w, h, len), hex, m, flat);
  }
  /** Đường gấp khúc bằng thanh tròn. */
  poly(pts: THREE.Vector3[], r: number, hex: number, flat = true, seg = 5): this {
    for (let i = 0; i + 1 < pts.length; i++) this.rod(pts[i]!, pts[i + 1]!, r, hex, seg, flat);
    return this;
  }
  /** Tứ giác (a,b,c,d) hai mặt, một màu. */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, hex: number, flat = false): this {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()], 3));
    return this.add(g, hex, undefined, flat);
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    return g;
  }
}

export function kitMaterial(fog = true): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog });
}

/**
 * Mái cong một tầng (4 mái dốc, góc "đầu đao" vểnh): mép ngoài nửa cạnh (ox, oz) ở yEave, đỉnh trong (ix, iz) ở yTop,
 * tâm (cx, cz). Vẽ ngói bằng sọc màu dọc theo mép; trả về đường mép (để khảm vàng + treo đèn).
 */
export function hipRoof(k: Kit, o: { cx: number; cz: number; ox: number; oz: number; ix: number; iz: number; yEave: number; yTop: number; curl: number; tile: number; tile2: number; nu?: number }): THREE.Vector3[][] {
  const NU = o.nu ?? 28, NS = 6;
  const edges: THREE.Vector3[][] = [];
  // 4 cạnh: (dirX, dirZ) pháp tuyến ra ngoài
  const sides: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const outer = (u: number, nx: number, nz: number): THREE.Vector3 => {
    // u ∈ [-1, 1] dọc cạnh
    const along = nz !== 0 ? o.ox : o.oz;
    const a = Math.abs(u);
    const ext = Math.pow(a, 6) * 0.9; // đầu đao vươn ra
    const tx = nz !== 0 ? u * along : 0, tz = nx !== 0 ? u * along : 0;
    const px = nz !== 0 ? tx : nx * o.ox, pz = nx !== 0 ? tz : nz * o.oz;
    const dx = nz !== 0 ? Math.sign(u) : nx, dz = nx !== 0 ? Math.sign(u) : nz;
    return V(o.cx + px + dx * ext * 0.7, o.yEave + o.curl * Math.pow(a, 5) + 0.25 * a * a, o.cz + pz + dz * ext * 0.7);
  };
  const inner = (u: number, nx: number, nz: number): THREE.Vector3 => {
    const px = nz !== 0 ? u * o.ix : nx * o.ix, pz = nx !== 0 ? u * o.iz : nz * o.iz;
    return V(o.cx + px, o.yTop, o.cz + pz);
  };
  for (const [nx, nz] of sides) {
    const grid: THREE.Vector3[][] = [];
    for (let i = 0; i <= NU; i++) {
      const u = -1 + (2 * i) / NU;
      const a = outer(u, nx, nz), b = inner(u, nx, nz);
      const row: THREE.Vector3[] = [];
      for (let s = 0; s <= NS; s++) {
        const t = s / NS;
        const p = a.clone().lerp(b, t);
        p.y = a.y + (b.y - a.y) * Math.pow(t, 1.7); // mái võng
        row.push(p);
      }
      grid.push(row);
    }
    for (let i = 0; i < NU; i++) for (let s = 0; s < NS; s++) {
      k.quad(grid[i]![s]!, grid[i + 1]![s]!, grid[i + 1]![s + 1]!, grid[i]![s + 1]!, (i & 1) ? o.tile : o.tile2);
    }
    edges.push(grid.map((r) => r[0]!));
    // sống mái góc (gờ hông) — chạy từ góc ngoài vào góc trong
    k.poly(grid[0]!.map((p) => p.clone().add(V(0, 0.12, 0))), 0.14, o.tile2, false);
  }
  return edges;
}

/** Đèn lồng Hội An (đơn vị: cao ≈ 1): thân dẹt đỏ son/cam, nắp + đáy vàng, tua. Gốc ở móc treo (y = 0), treo xuống -Y. */
export function lanternGeo(body: number, cap: number): THREE.BufferGeometry {
  const k = new Kit();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; pts.push(new THREE.Vector2(0.02 + Math.sin(a) * 0.36, -0.15 - (1 - Math.cos(a)) * 0.3)); }
  k.add(new THREE.LatheGeometry(pts, 10), body, undefined, true);
  k.cyl(0.14, 0.18, 0.08, 0, -0.14, 0, cap, 10, true);
  k.cyl(0.18, 0.12, 0.08, 0, -0.76, 0, cap, 10, true);
  k.rod(V(0, 0, 0), V(0, -0.12, 0), 0.015, cap, 4, true);
  k.add(new THREE.ConeGeometry(0.06, 0.32, 6).rotateX(Math.PI), cap, k.xf(0, -0.96, 0), true);
  return k.build();
}

/** Instanced đèn lồng lắc lư: mỗi đèn có điểm treo + cỡ + pha. */
export function createLanterns(scene: THREE.Scene, pts: { x: number; y: number; z: number; s: number }[], body: number, cap: number) {
  const geo = lanternGeo(body, cap);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, pts.length));
  mesh.count = pts.length;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), m = new THREE.Matrix4();
  const place = (t: number, amp: number) => {
    pts.forEach((l, i) => {
      e.set(Math.sin(t * 0.9 + i * 1.7) * amp, 0, Math.sin(t * 0.7 + i * 2.3) * amp * 0.8);
      q.setFromEuler(e);
      m.compose(p.set(l.x, l.y, l.z), q, s.setScalar(l.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0, 0.05);
  scene.add(mesh);
  return {
    mesh,
    /** Lắc chậm (0,6–1,2 s/nhịp) + sáng nhẹ theo phách. */
    update(t: number, glow: number) { place(t, 0.06); mat.color.setScalar(glow); },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}

/** GLSL: mặt trống đồng Đông Sơn trong toạ độ cực (r ∈ 0..1). uRot quay vành, uPulse/uHype nhịp tia. */
export const DRUM_GLSL = /* glsl */ `
#define TAU 6.2831853
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
float band(float r, float a, float b){ return step(a, r) * step(r, b); }
float ringL(float r, float c, float w){ return smoothstep(w, w*0.4, abs(r - c)); }
// chim Lạc: mỏ dài, mào, cánh xoè, đuôi — trong khung cục bộ (x dọc chiều bay, y hướng tâm)
float bird(vec2 p){
  float d = sdSeg(p, vec2(-0.5, 0.0), vec2(0.35, 0.05)) - 0.07;
  d = min(d, sdSeg(p, vec2(0.35, 0.05), vec2(0.95, -0.05)) - 0.025);
  d = min(d, sdSeg(p, vec2(0.25, 0.1), vec2(-0.05, 0.42)) - 0.025);
  d = min(d, sdSeg(p, vec2(0.0, 0.05), vec2(-0.45, 0.45)) - 0.05);
  d = min(d, sdSeg(p, vec2(-0.1, 0.0), vec2(-0.5, -0.4)) - 0.045);
  d = min(d, sdSeg(p, vec2(-0.5, 0.0), vec2(-0.85, 0.2)) - 0.035);
  d = min(d, sdSeg(p, vec2(-0.5, 0.0), vec2(-0.85, -0.15)) - 0.035);
  return d;
}
float deer(vec2 p){
  float d = sdSeg(p, vec2(-0.35, 0.0), vec2(0.3, 0.0)) - 0.09;
  d = min(d, sdSeg(p, vec2(0.3, 0.0), vec2(0.45, 0.3)) - 0.05);
  d = min(d, sdSeg(p, vec2(0.45, 0.3), vec2(0.6, 0.28)) - 0.05);
  d = min(d, sdSeg(p, vec2(0.45, 0.32), vec2(0.35, 0.6)) - 0.02);
  d = min(d, sdSeg(p, vec2(0.4, 0.48), vec2(0.55, 0.62)) - 0.02);
  d = min(d, sdSeg(p, vec2(-0.3, 0.0), vec2(-0.38, -0.4)) - 0.03);
  d = min(d, sdSeg(p, vec2(0.25, 0.0), vec2(0.32, -0.4)) - 0.03);
  return d;
}
// trả về (vàng, tia) — vàng: mức khảm 0..1, tia: phần ngôi sao 14 cánh (để nhịp)
vec2 drumFace(vec2 q, float t, float rot){
  float r = length(q);
  float a = atan(q.y, q.x);
  float g = 0.0, ray = 0.0;
  // ngôi sao 14 tia
  float f = abs(fract(a * 14.0 / TAU) - 0.5) * 2.0; // 0 giữa tia, 1 giữa khe
  float star = step(r, 0.06) + step(r, 0.27 - 0.2 * f) * step(0.06, r);
  ray = star;
  // lông công giữa các tia: vạch xiên
  float fea = band(r, 0.08, 0.26) * (1.0 - star) * step(0.5, fract((r * 60.0) + f * 3.0)) * step(0.35, f);
  g = max(star, fea * 0.55);
  // vạch tròn ngăn băng
  for (int i = 0; i < 9; i++) {
    float c = 0.28 + float(i) * 0.087;
    g = max(g, ringL(r, c, 0.006));
  }
  // băng 1: vòng tròn tiếp tuyến (quay ngược)
  float a1 = a - rot * 0.6;
  { float n = 40.0; float cell = fract(a1 * n / TAU) - 0.5; float d = length(vec2(cell * 0.051, r - 0.325));
    g = max(g, band(r, 0.29, 0.36) * smoothstep(0.007, 0.002, abs(d - 0.021))); }
  // băng 2: răng cưa
  { float s = fract(a * 72.0 / TAU); float zz = abs(s - 0.5) * 2.0; float yy = (r - 0.375) / 0.07; g = max(g, band(r, 0.375, 0.445) * smoothstep(0.08, 0.0, abs(yy - zz)) ); }
  // băng 3: hươu chạy (quay xuôi)
  { float n = 12.0; float aa = a + rot; float cell = fract(aa * n / TAU) - 0.5; vec2 lp = vec2(cell * 1.6, (r - 0.505) / 0.06 * 0.5 + 0.1);
    g = max(g, band(r, 0.455, 0.545) * smoothstep(0.03, 0.0, deer(lp))); }
  // băng 4: chim Lạc bay (quay ngược, rộng nhất)
  { float n = 18.0; float aa = a - rot * 1.3; float cell = fract(aa * n / TAU) - 0.5; vec2 lp = vec2(-cell * 2.2, (r - 0.635) / 0.075 * 0.45);
    g = max(g, band(r, 0.545, 0.72) * smoothstep(0.035, 0.0, bird(lp))); }
  // băng 5: vòng tròn chấm giữa
  { float n = 64.0; float aa = a + rot * 0.4; float cell = fract(aa * n / TAU) - 0.5; float d = length(vec2(cell * 0.075, r - 0.765));
    g = max(g, band(r, 0.73, 0.8) * max(smoothstep(0.006, 0.002, abs(d - 0.02)), smoothstep(0.008, 0.004, d))); }
  // băng 6: vạch xiên
  { g = max(g, band(r, 0.81, 0.885) * step(0.6, fract(a * 120.0 / TAU + r * 14.0)) * 0.8); }
  // băng 7 + vành
  { float n = 40.0; float cell = fract((a - rot * 0.2) * n / TAU) - 0.5; float yy = (r - 0.93) / 0.04;
    g = max(g, band(r, 0.895, 0.965) * smoothstep(0.1, 0.0, abs(abs(cell) * 2.0 - abs(yy)))); }
  g = max(g, ringL(r, 0.985, 0.012));
  return vec2(g, ray);
}`;
