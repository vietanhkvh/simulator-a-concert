// "Thép & Lửa" — rig người đẽo mặt phẳng tỉ lệ thật (≈ 7,5 đầu, H ≈ 1,78 m) cho ca sĩ / ban nhạc / quay phim (gói S2).
// STYLE_C §4: bo = 0, KHÔNG viền, mặt = 3 mặt phẳng (trán + 2 má) + dải bóng hốc mắt + nêm mũi, KHÔNG vẽ mắt; tóc = 5–9
// khối đẽo; mỗi mặt một sắc độ (pháp tuyến phẳng lấy từ đạo hàm vị trí trong fragment → mặt phẳng luôn đọc được),
// key hồ quang lạnh từ trên-trước, rim lửa từ dưới (0,6 × Hype), bóng dịch lạnh / sáng dịch ấm; đinh tán chrome lấp lánh.
// Mỗi RigBatch = MỘT SkinnedMesh (1 draw call cho mọi nhân vật + đạo cụ gắn xương).
import * as THREE from 'three';
import { RAMPS, hexToRgb } from '../../../../world/style';

const V3 = THREE.Vector3;
export const clamp = THREE.MathUtils.clamp;

/** Chỉ số xương trong một nhân vật. */
export const B = {
  root: 0, hips: 1, chest: 2, neck: 3, head: 4, uaL: 5, faL: 6, hdL: 7, uaR: 8, faR: 9, hdR: 10,
  thL: 11, shL: 12, thR: 13, shR: 14, jaw: 15, hair: 16, fgL: 17, hnL: 18, fgR: 19, hnR: 20, prop: 21,
} as const;
const NB = 22;
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 1, 11, 1, 13, 4, 4, 7, 7, 10, 10, 0];
/** Vị trí nghỉ (so với xương cha). Nhân vật nhìn về -Z, bên phải khán giả nhìn = -X. */
const REST: [number, number, number][] = [
  [0, 0, 0], [0, 0.94, 0], [0, 0.18, 0], [0, 0.33, 0], [0, 0.1, 0],
  [-0.2, 0.31, 0], [0, -0.29, 0], [0, -0.26, 0],
  [0.2, 0.31, 0], [0, -0.29, 0], [0, -0.26, 0],
  [-0.1, -0.04, 0], [0, -0.44, 0], [0.1, -0.04, 0], [0, -0.44, 0],
  [0, 0.07, 0.0], [0, 0.17, 0.05],
  [0, -0.085, 0], [0, -0.085, 0], [0, -0.085, 0], [0, -0.085, 0],
  [0, 0, 0],
];
export const REST_ABS: THREE.Vector3[] = (() => {
  const out: THREE.Vector3[] = [];
  REST.forEach((r, i) => { const p = new V3(...r); if (PARENT[i]! >= 0) p.add(out[PARENT[i]!]!); out.push(p); });
  return out;
})();
export const L_UA = 0.29, L_FA = 0.26;
/** Tâm hộp sọ (khung nhân vật). */
export const HEAD_C = new V3(0, 1.665, 0);

export type HairStyle = 'long' | 'mohawk' | 'short' | 'pony' | 'bandana' | 'cap';
export type TopStyle = 'jacket' | 'vest' | 'tee' | 'tank' | 'bare';
export type Decal = 'bolt' | 'star' | 'flame' | 'none';
export interface RigLook {
  skin: number; hair: number; hairStyle: HairStyle; headCol?: number;
  top: TopStyle; topCol: number; shirtCol: number; decal: Decal; decalCol?: number;
  pants: number; ripped?: boolean; boots: number;
  belt?: boolean; wristbands?: boolean; shades?: boolean; beard?: boolean; laminate?: boolean;
}

type WFn = (p: THREE.Vector3) => [number, number, number];
/** kind: 0 tô phẳng · 1 chrome (đinh tán, khoá — lấp lánh) · 2 phát sáng · 3 da / leather (highlight rộng). */
export const K = { matte: 0, chrome: 1, glow: 2, leather: 3 } as const;

class GeoAcc {
  pos: number[] = []; nrm: number[] = []; col: number[] = []; k: number[] = []; si: number[] = []; sw: number[] = [];
  add(src: THREE.BufferGeometry, col: number, kind: number, base: number, w: WFn | number) {
    const g = src.index ? src.toNonIndexed() : src;
    g.computeVertexNormals();
    const p = g.attributes.position!, n = g.attributes.normal!;
    const [r, gg, b] = hexToRgb(col);
    const v = new V3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      this.pos.push(v.x, v.y, v.z);
      this.nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      // mỗi mặt một sắc độ hơi lệch (±4 %) → tấm da / thép không phẳng lì
      const tri = Math.floor((this.pos.length / 3 - 1) / 3);
      const j = 1 + (((tri * 2654435761) >>> 0) % 1000 / 1000 - 0.5) * 0.08;
      this.col.push(r * j, gg * j, b * j);
      this.k.push(kind, v.y);
      if (typeof w === 'number') { this.si.push(base + w, 0, 0, 0); this.sw.push(1, 0, 0, 0); }
      else { const [a, bb, wb] = w(v); this.si.push(base + a, base + bb, 0, 0); this.sw.push(1 - wb, wb, 0, 0); }
    }
    if (g !== src) g.dispose();
    src.dispose();
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aK', new THREE.Float32BufferAttribute(this.k, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    return g;
  }
}

// ── hình học cơ bản (low-poly, khung nhân vật) ──
const UP = new V3(0, 1, 0);
/** Lăng trụ thuôn nối a → b (seg cạnh), dẹt theo z, xoay `rot` quanh trục. */
export function prism(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, seg = 6, flatZ = 1, rot = 0): THREE.BufferGeometry {
  const d = new V3().subVectors(b, a); const len = d.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, seg, 1, false, rot);
  g.scale(1, 1, flatZ);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
export function gem(c: THREE.Vector3, rx: number, ry: number, rz: number, ws = 6, hs = 4): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz).translate(c.x, c.y, c.z);
}
export function box(c: THREE.Vector3, sx: number, sy: number, sz: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(sx, sy, sz).translate(c.x, c.y, c.z);
}
/** Tứ giác a b c d (ngược chiều kim đồng hồ nhìn từ phía mặt). */
export function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()], 3));
  return g;
}
/** Đinh tán chrome (bát diện nhỏ). */
export function stud(c: THREE.Vector3, r = 0.009): THREE.BufferGeometry {
  return new THREE.OctahedronGeometry(r, 0).translate(c.x, c.y, c.z);
}
/** Hình phẳng (Shape) đặt ở c, nhìn về -Z (hoặc +Z), cỡ s. */
export function shapeGeo(sh: THREE.Shape, c: THREE.Vector3, s: number, faceBack = false): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(sh).scale(s, s, s);
  if (!faceBack) g.rotateY(Math.PI);
  return g.translate(c.x, c.y, c.z);
}
export function boltShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.15, 1); s.lineTo(-0.45, -0.05); s.lineTo(-0.02, -0.05); s.lineTo(-0.2, -1); s.lineTo(0.45, 0.15); s.lineTo(0.03, 0.15); s.lineTo(0.3, 1);
  s.lineTo(0.15, 1);
  return s;
}
export function starShape(n = 5, ri = 0.42): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2, r = i % 2 ? ri : 1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
function flameShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -1); s.lineTo(0.6, -0.5); s.lineTo(0.5, 0.2); s.lineTo(0.2, -0.1); s.lineTo(0.25, 0.6); s.lineTo(0, 1);
  s.lineTo(-0.25, 0.4); s.lineTo(-0.2, 0.0); s.lineTo(-0.5, 0.3); s.lineTo(-0.6, -0.5); s.lineTo(0, -1);
  return s;
}

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute vec3 aCol;
attribute vec2 aK;
varying vec3 vCol;
varying vec2 vK;
varying vec3 vWP;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  vCol = aCol; vK = aK;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
uniform vec3 uKey;
uniform vec3 uKeyCol;
uniform vec3 uAmb;
uniform vec3 uFire;
uniform float uRim;
uniform float uGlow;
varying vec3 vCol;
varying vec2 vK;
varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 base = vCol;
  float kind = vK.x;
  if (kind > 1.5 && kind < 2.5) {
    gl_FragColor = vec4(base * uGlow, 1.0);
    #include <fog_fragment>
    return;
  }
  // pháp tuyến PHẲNG theo mặt tam giác (đạo hàm vị trí) → mỗi mặt một sắc độ
  vec3 n = normalize(cross(dFdx(vWP), dFdy(vWP)));
  vec3 v = normalize(cameraPosition - vWP);
  if (dot(n, v) < 0.0) n = -n;
  float d = max(dot(n, uKey), 0.0);
  // Lambert phẳng: bóng ngả lạnh (uAmb xanh thép), sáng ngả ấm nhẹ (uKeyCol)
  vec3 col = base * (uAmb + uKeyCol * d);
  // rim lửa từ dưới + viền ngược (không viền đen): mặt hướng xuống / mép bóng bắt ánh lửa
  float under = clamp(-n.y * 0.9 + 0.15, 0.0, 1.0);
  float fr = pow(1.0 - abs(dot(n, v)), 2.0);
  col += uFire * uRim * (base * 0.9 * under + 0.35 * fr * (0.4 + under));
  if (kind > 0.5 && kind < 1.5) {
    // chrome: highlight hẹp, lấp lánh theo mặt
    vec3 r = reflect(-v, n);
    float s = pow(max(dot(r, uKey), 0.0), 10.0);
    col = base * (0.35 + 0.5 * d) + vec3(1.0, 0.97, 0.92) * s * 1.4 + uFire * uRim * under * 0.5;
  } else if (kind > 2.5) {
    // da: highlight rộng, mờ
    vec3 h = normalize(uKey + v);
    col += uKeyCol * pow(max(dot(n, h), 0.0), 6.0) * 0.12;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export interface RigChar {
  base: number;
  bones: THREE.Bone[];
  look: RigLook;
  /** lò xo tóc (pitch / roll) */
  hair: { x: number; vx: number; z: number; vz: number; px: number; pz: number };
}

const W_LEG = (th: number, sh: number): WFn => (p) => [th, sh, clamp((0.52 - p.y) / 0.1, 0, 1)];
const W_TORSO: WFn = (p) => [B.hips, B.chest, clamp((p.y - 1.0) / 0.12, 0, 1)];

export class RigBatch {
  private acc = new GeoAcc();
  private bonesAll: THREE.Bone[] = [];
  readonly chars: RigChar[] = [];
  mesh: THREE.SkinnedMesh | null = null;
  private mat: THREE.ShaderMaterial | null = null;
  private skeleton: THREE.Skeleton | null = null;

  addChar(look: RigLook): RigChar {
    const base = this.bonesAll.length;
    const bones: THREE.Bone[] = [];
    for (let i = 0; i < NB; i++) {
      const b = new THREE.Bone();
      b.position.set(...REST[i]!);
      if (PARENT[i]! >= 0) bones[PARENT[i]!]!.add(b);
      bones.push(b);
    }
    this.bonesAll.push(...bones);
    const c: RigChar = { base, bones, look, hair: { x: 0, vx: 0, z: 0, vz: 0, px: 0, pz: 0 } };
    this.chars.push(c);
    this.buildBody(c);
    return c;
  }

  /** Thêm hình (khung nghỉ của nhân vật) gắn vào xương `bone` (hoặc hàm trọng số). */
  add(c: RigChar, g: THREE.BufferGeometry, col: number, bone: number | WFn, kind = 0) {
    this.acc.add(g, col, kind, c.base, bone);
  }

  private buildBody(c: RigChar) {
    const L = c.look, o = c.base, R = REST_ABS;
    const a = (g: THREE.BufferGeometry, col: number, w: WFn | number, kind = 0) => this.acc.add(g, col, kind, o, w);
    const S = RAMPS.steel!, CO = RAMPS.coal!;
    const dark = CO[700];
    const chrome = S[100];
    const C = HEAD_C;
    const skinSh = mulHex(L.skin, 0.78);
    // ── đầu: hộp sọ thấp đa giác + mặt 3 mặt phẳng ──
    a(gem(new V3(0, C.y + 0.005, 0.012), 0.088, 0.112, 0.1, 7, 5), L.skin, B.head);
    const fz = -0.093;
    // trán (1 mặt phẳng nghiêng ra sau; tóc dài / mũ che phần trên)
    a(quad(new V3(-0.074, 1.688, fz), new V3(0.074, 1.688, fz), new V3(0.06, 1.735, fz + 0.022), new V3(-0.06, 1.735, fz + 0.022)), L.skin, B.head);
    // 2 má: mỗi bên MỘT mặt phẳng chéo (từ sống mũi ra mang tai)
    for (const s of [-1, 1]) {
      const pts = [new V3(0, 1.688, fz - 0.004), new V3(0, 1.608, fz + 0.004), new V3(s * 0.078, 1.612, fz + 0.06), new V3(s * 0.084, 1.688, fz + 0.045)];
      a(s < 0 ? quad(pts[0]!, pts[1]!, pts[2]!, pts[3]!) : quad(pts[0]!, pts[3]!, pts[2]!, pts[1]!), mulHex(L.skin, s < 0 ? 0.92 : 1), B.head);
      // dải bóng hốc mắt (KHÔNG vẽ mắt): tứ giác tối bám mặt má, ngay dưới mày
      const e = [new V3(0, 1.69, fz - 0.009), new V3(0, 1.664, fz - 0.009), new V3(s * 0.07, 1.664, fz + 0.046), new V3(s * 0.074, 1.69, fz + 0.038)];
      a(s < 0 ? quad(e[0]!, e[1]!, e[2]!, e[3]!) : quad(e[0]!, e[3]!, e[2]!, e[1]!), L.shades ? CO[700] : mulHex(L.skin, 0.32), B.head, L.shades ? K.chrome : K.matte);
    }
    // gờ mày (bậc tối ngắn) + nêm mũi
    a(new THREE.ConeGeometry(0.018, 0.07, 3).rotateY(Math.PI).translate(0, 1.645, fz - 0.016), skinSh, B.head);
    // miệng (tứ giác tối, lộ ra khi hàm hạ) + hàm (xương jaw)
    a(quad(new V3(-0.034, 1.578, fz + 0.012), new V3(0.034, 1.578, fz + 0.012), new V3(0.034, 1.61, fz + 0.006), new V3(-0.034, 1.61, fz + 0.006)), RAMPS.blood![700], B.head);
    a(prism(new V3(0, 1.612, -0.012), new V3(0, 1.548, -0.035), 0.07, 0.034, 6, 1.25, Math.PI / 6), mulHex(L.skin, 0.96), B.jaw);
    if (L.beard) a(prism(new V3(0, 1.6, -0.02), new V3(0, 1.525, -0.05), 0.075, 0.03, 5, 1.3, Math.PI / 5), mulHex(L.hair, 0.9), B.jaw);
    // tai
    for (const s of [-1, 1]) a(box(new V3(s * 0.088, 1.655, 0.012), 0.016, 0.05, 0.03), skinSh, B.head);
    // cổ
    a(prism(new V3(0, 1.43, 0.005), new V3(0, 1.6, 0.01), 0.05, 0.045, 6), skinSh, (p) => [B.neck, B.head, clamp((p.y - 1.52) / 0.06, 0, 1)]);
    this.hair(c, a);

    // ── thân: ngực + hông là lăng trụ 8 mặt thuôn, mặt phẳng ở chính diện ──
    const bare = L.top === 'bare';
    const torsoCol = bare ? L.skin : L.top === 'jacket' || L.top === 'vest' ? L.topCol : L.shirtCol;
    a(prism(new V3(0, 0.99, 0.0), new V3(0, 1.43, 0.0), 0.15, 0.205, 8, 0.62, Math.PI / 8), torsoCol, W_TORSO, L.top === 'jacket' || L.top === 'vest' ? K.leather : K.matte);
    a(prism(new V3(0, 1.4, 0.0), new V3(0, 1.47, 0.0), 0.205, 0.08, 8, 0.62, Math.PI / 8), torsoCol, B.chest, L.top === 'jacket' ? K.leather : K.matte);
    a(prism(new V3(0, 0.84, 0.0), new V3(0, 1.0, 0.0), 0.165, 0.152, 8, 0.66, Math.PI / 8), L.pants, B.hips);
    // mặt trước ngực (để dán áo / decal): z mặt phẳng chính diện
    const zf = (y: number) => -(0.15 + (0.205 - 0.15) * (y - 0.99) / 0.44) * Math.cos(Math.PI / 8) * 0.62 - 0.004;
    if (L.top === 'jacket' || L.top === 'vest') {
      // áo sơ mi lộ giữa hai vạt áo da
      const w0 = 0.055, w1 = 0.07;
      a(quad(new V3(-w0, 1.0, zf(1.0)), new V3(w0, 1.0, zf(1.0)), new V3(w1, 1.41, zf(1.41)), new V3(-w1, 1.41, zf(1.41))), L.shirtCol, W_TORSO);
      // ve áo: 2 tam giác chéo + cổ áo dựng
      for (const s of [-1, 1]) {
        const p0 = new V3(s * 0.04, 1.44, zf(1.41) - 0.012), p1 = new V3(s * 0.11, 1.43, zf(1.41) - 0.006), p2 = new V3(s * 0.062, 1.25, zf(1.25) - 0.008);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(s < 0 ? [...p0.toArray(), ...p2.toArray(), ...p1.toArray()] : [...p0.toArray(), ...p1.toArray(), ...p2.toArray()], 3));
        a(g, mulHex(L.topCol, 0.8), B.chest, K.leather);
        a(prism(new V3(s * 0.07, 1.42, 0.03), new V3(s * 0.085, 1.5, 0.04), 0.04, 0.03, 4, 1, 0.4), mulHex(L.topCol, 1.1), B.chest, K.leather);
        if (L.top === 'jacket') for (let i = 0; i < 4; i++) a(stud(new V3(s * (0.13 + i * 0.018), 1.455 - i * 0.004, zf(1.44) + 0.04 - i * 0.004), 0.008), chrome, B.chest, K.chrome);
        // khoá kéo bên vạt
        a(box(new V3(s * 0.078, 1.2, zf(1.2) - 0.002), 0.006, 0.36, 0.004), chrome, W_TORSO, K.chrome);
      }
    }
    if (L.decal !== 'none') {
      const sh = L.decal === 'bolt' ? boltShape() : L.decal === 'star' ? starShape() : flameShape();
      const y = 1.27;
      const g = shapeGeo(sh, new V3(0, y, zf(y) - 0.006), L.top === 'jacket' || L.top === 'vest' ? 0.06 : 0.08);
      g.rotateX(-0.12); g.translate(0, y * 0.12 * 0, 0);
      a(g, L.decalCol ?? RAMPS.blood![100], W_TORSO);
    }
    if (L.laminate) {
      a(prism(new V3(-0.06, 1.44, -0.06), new V3(0, 1.22, zf(1.22) - 0.01), 0.003, 0.003, 3), dark, B.chest);
      a(prism(new V3(0.06, 1.44, -0.06), new V3(0, 1.22, zf(1.22) - 0.01), 0.003, 0.003, 3), dark, B.chest);
      a(box(new V3(0, 1.17, zf(1.17) - 0.012), 0.07, 0.095, 0.004), RAMPS.paper![500], B.chest);
      a(box(new V3(0, 1.19, zf(1.19) - 0.016), 0.06, 0.02, 0.003), RAMPS.flame![500], B.chest);
    }
    // thắt lưng + đinh tán
    if (L.belt) {
      a(prism(new V3(0, 0.955, 0), new V3(0, 1.005, 0), 0.158, 0.155, 8, 0.67, Math.PI / 8), dark, B.hips, K.leather);
      a(box(new V3(0, 0.98, -0.11), 0.05, 0.04, 0.008), chrome, B.hips, K.chrome);
      for (let i = -4; i <= 4; i++) if (i !== 0) {
        const ang = i * 0.3;
        a(stud(new V3(Math.sin(ang) * 0.165, 0.98, -Math.cos(ang) * 0.11), 0.009), chrome, B.hips, K.chrome);
      }
    }

    // ── tay: 2 đoạn có khuỷu, bàn tay = găng đẽo + ngón tấm ──
    const sleeve = L.top === 'jacket' ? L.topCol : L.top === 'tee' ? L.shirtCol : L.skin;
    for (const [ua, fa, hd, fg, hn, s] of [[B.uaL, B.faL, B.hdL, B.fgL, B.hnL, -1], [B.uaR, B.faR, B.hdR, B.fgR, B.hnR, 1]] as const) {
      const Sh = R[ua]!, E = R[fa]!, W = R[hd]!;
      const shCol = L.top === 'tank' || L.top === 'bare' || L.top === 'vest' ? L.skin : sleeve;
      a(gem(new V3(Sh.x - s * 0.005, Sh.y - 0.01, 0), 0.07, 0.065, 0.065, 6, 4), L.top === 'vest' ? L.topCol : shCol, (p) => [B.chest, ua, clamp((Sh.y - p.y) / 0.08, 0, 1) * 0.7 + 0.15]);
      if (L.top === 'tee') {
        a(prism(Sh, new V3(E.x, E.y + 0.16, E.z), 0.064, 0.058, 6), L.shirtCol, ua);
        a(prism(new V3(E.x, E.y + 0.17, E.z), E, 0.05, 0.044, 6), L.skin, ua);
      } else a(prism(Sh, E, 0.06, 0.046, 6), L.top === 'jacket' ? sleeve : L.skin, ua, L.top === 'jacket' ? K.leather : 0);
      a(gem(E, 0.046, 0.046, 0.046, 5, 3), L.top === 'jacket' ? sleeve : L.skin, fa, L.top === 'jacket' ? K.leather : 0);
      a(prism(E, new V3(W.x, W.y + 0.005, W.z), 0.046, 0.034, 6), L.top === 'jacket' ? sleeve : L.skin, fa, L.top === 'jacket' ? K.leather : 0);
      if (L.top === 'jacket') a(prism(new V3(W.x, W.y + 0.06, W.z), new V3(W.x, W.y + 0.01, W.z), 0.042, 0.042, 6), mulHex(sleeve, 1.15), fa, K.leather);
      if (L.wristbands) {
        a(prism(new V3(W.x, W.y + 0.065, W.z), new V3(W.x, W.y + 0.005, W.z), 0.04, 0.04, 6), dark, fa, K.leather);
        for (let i = 0; i < 3; i++) a(stud(new V3(W.x - s * 0.0, W.y + 0.035, W.z - 0.04 + i * 0.0), 0.007).rotateY(0).translate(0, 0, 0), chrome, fa, K.chrome);
      }
      // găng tay đẽo: lòng bàn tay (lòng hướng vào trong = -s·X), ngón cái, 4 ngón trên 2 xương (giữa+áp út · trỏ+út)
      a(box(new V3(W.x, W.y - 0.045, W.z), 0.034, 0.09, 0.08), L.skin, hd);
      a(prism(new V3(W.x - s * 0.01, W.y - 0.02, W.z - 0.035), new V3(W.x - s * 0.03, W.y - 0.075, W.z - 0.055), 0.013, 0.01, 4), skinSh, hd);
      const fy = W.y - 0.09;
      for (const z of [-0.008, 0.012]) a(box(new V3(W.x, fy - 0.035, W.z + z), 0.024, 0.07, 0.018), L.skin, fg);
      a(box(new V3(W.x, fy - 0.036, W.z - 0.029), 0.024, 0.072, 0.018), L.skin, hn);
      a(box(new V3(W.x, fy - 0.03, W.z + 0.032), 0.022, 0.058, 0.016), skinSh, hn);
    }

    // ── chân: đùi + ống quyển 6 cạnh, gối, bốt to ──
    for (const [th, sh, s] of [[B.thL, B.shL, -1], [B.thR, B.shR, 1]] as const) {
      const Hh = R[th]!, Kn = R[sh]!;
      a(prism(new V3(Hh.x, Hh.y + 0.03, 0), Kn, 0.088, 0.064, 6, 1, Math.PI / 6), L.pants, W_LEG(th, sh));
      a(gem(Kn, 0.064, 0.06, 0.064, 6, 3), L.pants, sh);
      a(prism(Kn, new V3(Kn.x, 0.2, 0), 0.06, 0.05, 6, 1, Math.PI / 6), L.pants, sh);
      if (L.ripped) {
        a(quad(new V3(Kn.x - 0.03, Kn.y - 0.02, -0.066), new V3(Kn.x + 0.03, Kn.y - 0.025, -0.064), new V3(Kn.x + 0.022, Kn.y + 0.025, -0.068), new V3(Kn.x - 0.024, Kn.y + 0.02, -0.068)), L.skin, sh);
        a(quad(new V3(Hh.x - s * 0.02, 0.7, -0.077), new V3(Hh.x + s * 0.0 + 0.02, 0.7, -0.077), new V3(Hh.x + 0.016, 0.74, -0.08), new V3(Hh.x - 0.018, 0.735, -0.08)).translate(0, 0, 0), L.skin, W_LEG(th, sh));
      }
      // bốt: cổ bốt + mũi bốt to (0,16 H)
      a(prism(new V3(Kn.x, 0.3, 0), new V3(Kn.x, 0.06, 0), 0.058, 0.062, 6, 1, Math.PI / 6), L.boots, sh, K.leather);
      const foot = new THREE.BufferGeometry().copy(new THREE.CylinderGeometry(0.05, 0.065, 0.27, 5, 1, false, Math.PI).rotateX(Math.PI / 2).scale(1, 0.85, 1));
      a(foot.translate(Kn.x + s * 0.004, 0.058, -0.06), L.boots, sh, K.leather);
      a(box(new V3(Kn.x + s * 0.004, 0.012, -0.06), 0.12, 0.024, 0.29), dark, sh);
      a(stud(new V3(Kn.x + s * 0.06, 0.2, 0), 0.01), chrome, sh, K.chrome);
    }
  }

  private hair(c: RigChar, a: (g: THREE.BufferGeometry, col: number, w: WFn | number, kind?: number) => void) {
    const L = c.look, C = HEAD_C, col = L.hair, col2 = mulHex(L.hair, 0.82);
    const wHair: WFn = (p) => [B.head, B.hair, clamp((1.68 - p.y) / 0.14, 0, 1)];
    const cap = (h = 0.56, cc = col) => a(new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI * h).scale(0.096, 0.124, 0.112).translate(0, C.y + 0.012, 0.01), cc, B.head);
    if (L.hairStyle === 'long') {
      cap();
      // tóc mái rẽ ngôi: 2 khối nghiêng che thái dương
      // 7 khối dài: 2 bên má + 5 sau lưng (trên xương tóc → vung khi head-bang)
      for (const s of [-1, 1]) a(prism(new V3(s * 0.09, 1.72, 0.0), new V3(s * 0.105, 1.4, 0.01), 0.024, 0.012, 4, 2.2, 0.4), s < 0 ? col : col2, wHair);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.045, z = 0.07 + (2 - Math.abs(i - 2)) * 0.012;
        a(prism(new V3(x * 0.9, 1.74, z), new V3(x * 1.35, 1.3 - Math.abs(i - 2) * 0.03, z + 0.035), 0.045, 0.014, 4, 0.5, 0.4 * (i - 2)), i % 2 ? col2 : col, wHair);
      }
    } else if (L.hairStyle === 'mohawk') {
      cap(0.5, mulHex(L.skin, 0.75));
      for (let i = 0; i < 6; i++) {
        const z = -0.08 + i * 0.038, y = C.y + 0.1 - Math.pow((i - 2) / 3.5, 2) * 0.05;
        a(prism(new V3(0, y, z), new V3(0, y + 0.13 - Math.abs(i - 2) * 0.012, z + 0.03), 0.026, 0.002, 3, 2.4), i % 2 ? col : col2, i > 3 ? wHair : B.head);
      }
    } else if (L.hairStyle === 'short') {
      cap(0.5);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        a(prism(new V3(Math.sin(ang) * 0.05, C.y + 0.09, Math.cos(ang) * 0.05), new V3(Math.sin(ang) * 0.1, C.y + 0.13, Math.cos(ang) * 0.1), 0.03, 0.004, 3), i % 2 ? col : col2, B.head);
      }
    } else if (L.hairStyle === 'pony') {
      cap(0.55);
      a(gem(new V3(0, C.y + 0.04, 0.1), 0.03, 0.03, 0.03, 5, 3), col2, B.head);
      a(prism(new V3(0, C.y + 0.04, 0.11), new V3(0, 1.36, 0.16), 0.035, 0.01, 5, 0.7), col, wHair);
    } else if (L.hairStyle === 'bandana') {
      const bc = L.headCol ?? RAMPS.blood![300];
      cap(0.5, bc);
      a(prism(new V3(0, C.y + 0.035, 0.005), new V3(0, C.y + 0.065, 0.005), 0.104, 0.1, 7, 1.12), mulHex(bc, 0.85), B.head);
      a(gem(new V3(0, C.y + 0.03, 0.12), 0.025, 0.02, 0.02, 4, 2), bc, B.head);
      for (const s of [-1, 1]) a(prism(new V3(0, C.y + 0.03, 0.125), new V3(s * 0.03, C.y - 0.09, 0.14), 0.018, 0.006, 3, 0.4), mulHex(bc, 0.8), wHair);
      // tóc dài lộ dưới khăn
      for (let i = 0; i < 3; i++) a(prism(new V3((i - 1) * 0.06, 1.66, 0.08), new V3((i - 1) * 0.08, 1.42, 0.1), 0.04, 0.012, 4, 0.5), col, wHair);
    } else {
      // mũ lưỡi trai đen (đội quay phim)
      const cc = L.headCol ?? RAMPS.coal![300];
      a(new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.1, 0.09, 0.115).translate(0, C.y + 0.035, 0.008), cc, B.head);
      a(box(new V3(0, C.y + 0.035, -0.15), 0.15, 0.012, 0.1).rotateX(0), cc, B.head);
      a(box(new V3(0, C.y + 0.02, 0.06), 0.17, 0.06, 0.08), col, B.head);
    }
  }

  build(scene: THREE.Scene, name: string): THREE.SkinnedMesh {
    const geo = this.acc.geometry();
    const A = RAMPS.arc!, F = RAMPS.flame!, S = RAMPS.steel!;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, fog: true, side: THREE.DoubleSide,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uKey: { value: new V3(0.42, 0.8, -0.45).normalize() },
        uKeyCol: { value: new V3(...hexToRgb(A[300])).lerp(new V3(...hexToRgb(RAMPS.tungsten![300])), 0.4).multiplyScalar(0.95) },
        uAmb: { value: new V3(...hexToRgb(S[700])).multiplyScalar(1.5) },
        uFire: { value: new V3(...hexToRgb(F[500])) },
        uRim: { value: 0.6 },
        uGlow: { value: 1.3 },
      },
    });
    const mesh = new THREE.SkinnedMesh(geo, this.mat);
    for (const c of this.chars) mesh.add(c.bones[0]!);
    mesh.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.bonesAll);
    mesh.bind(this.skeleton);
    mesh.frustumCulled = false;
    mesh.name = name;
    scene.add(mesh);
    this.mesh = mesh;
    return mesh;
  }

  /** Rim lửa từ dưới: 0,6 cơ bản, mạnh lên theo Hype + phách. */
  setHype(hype: number, pulse = 0) {
    if (!this.mat) return;
    this.mat.uniforms.uRim!.value = 0.35 + 0.45 * hype + 0.15 * pulse * hype;
  }

  setVisible(v: boolean) { if (this.mesh) this.mesh.visible = v; }

  dispose() {
    if (this.mesh) { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
    this.skeleton?.dispose();
    this.mat?.dispose();
  }
}

export function mulHex(hex: number, k: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k)), g = Math.min(255, Math.round(((hex >> 8) & 255) * k)), b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// ── pose ──
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _d = new V3(), _p = new V3(), _u = new V3(), _f = new V3(), _e = new V3();
const _m = new THREE.Matrix4();
const DOWN = new V3(0, -1, 0);

/** Đưa tay `side` (-1 trái, 1 phải) tới `target` (khung ngực), khuỷu ngả về `pole` (khung ngực). IK 2 đoạn. */
export function aimArm(c: RigChar, side: -1 | 1, target: THREE.Vector3, pole: THREE.Vector3, handFlex = 0, handDir?: THREE.Vector3) {
  const ua = c.bones[side < 0 ? B.uaL : B.uaR]!, fa = c.bones[side < 0 ? B.faL : B.faR]!, hd = c.bones[side < 0 ? B.hdL : B.hdR]!;
  _d.subVectors(target, ua.position);
  const dist = clamp(_d.length(), 0.08, L_UA + L_FA - 0.002);
  _d.normalize();
  const cosA = clamp((L_UA * L_UA + dist * dist - L_FA * L_FA) / (2 * L_UA * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_p.lengthSq() < 1e-6) _p.set(side, 0, 0.3);
  _p.normalize();
  _u.copy(_d).multiplyScalar(cosA).addScaledVector(_p, sinA).normalize();
  ua.quaternion.setFromUnitVectors(DOWN, _u);
  _e.copy(_u).multiplyScalar(L_UA);
  _f.copy(_d).multiplyScalar(dist).sub(_e).normalize();
  _qi.copy(ua.quaternion).invert();
  _f.applyQuaternion(_qi);
  fa.quaternion.setFromUnitVectors(DOWN, _f);
  if (handDir) {
    _qi.copy(ua.quaternion).multiply(fa.quaternion).invert();
    _q.setFromUnitVectors(DOWN, _p.copy(handDir).normalize());
    hd.quaternion.copy(_qi).multiply(_q);
  } else hd.rotation.set(handFlex, 0, 0);
}

/** Đổi điểm thế giới → khung ngực của nhân vật (cần ma trận đã cập nhật: gọi syncChest trước). */
export function worldToChest(c: RigChar, p: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const ch = c.bones[B.chest]!;
  _m.copy(ch.matrixWorld).invert();
  return out.copy(p).applyMatrix4(_m);
}
/** Cập nhật ma trận thế giới từ gốc tới ngực + xương prop (sau khi đặt root / hông / ngực / prop). */
export function syncChest(c: RigChar) { c.bones[B.root]!.updateMatrixWorld(true); }

export type HandPose = 'fist' | 'horns' | 'open' | 'grip' | 'point';
/** Bàn tay: nắm đấm / tay sừng (trỏ + út duỗi) / xoè / nắm cầm (dùi, cần đàn, chân mic). */
export function hand(c: RigChar, side: -1 | 1, pose: HandPose, k = 1) {
  const fg = c.bones[side < 0 ? B.fgL : B.fgR]!, hn = c.bones[side < 0 ? B.hnL : B.hnR]!;
  const s = -side; // gập vào lòng (lòng hướng vào giữa thân)
  const curl = pose === 'open' ? 0.15 : pose === 'grip' ? 1.45 : 2.2;
  const curlH = pose === 'horns' || pose === 'open' ? 0.05 : pose === 'point' ? 0.1 : curl;
  fg.rotation.set(0, 0, s * curl * k);
  hn.rotation.set(0, 0, s * curlH * k);
}

/** Đường bao "nặng": đỉnh ở 60 ms, hồi trong 240 ms (u = giây kể từ cú đánh). */
export function heavy(u: number): number {
  if (u < 0) return 0;
  if (u < 0.06) { const x = u / 0.06; return 1 - (1 - x) * (1 - x); }
  const r = (u - 0.06) / 0.24;
  return r >= 1 ? 0 : (1 - r) * (1 - r) * (1 + 2 * r);
}

/** Chân: bước đi (stepPhase rad, amt), thế đứng rộng (wide rad), khuỵu gối (bend 0..1). */
export function legs(c: RigChar, stepPhase: number, amt: number, wide = 0.12, bend = 0) {
  const bn = c.bones, s = Math.sin(stepPhase) * amt;
  const kL = Math.max(0, -Math.cos(stepPhase)) * amt, kR = Math.max(0, Math.cos(stepPhase)) * amt;
  bn[B.thL]!.rotation.set(s * 0.5 + bend * 0.45, 0, -wide);
  bn[B.thR]!.rotation.set(-s * 0.5 + bend * 0.45, 0, wide);
  bn[B.shL]!.rotation.set(-kL * 0.8 - bend * 0.9, 0, wide * 0.9);
  bn[B.shR]!.rotation.set(-kR * 0.8 - bend * 0.9, 0, -wide * 0.9);
  // hạ hông theo độ dạng chân + khuỵu
  bn[B.hips]!.position.y = REST[B.hips]![1] - (1 - Math.cos(wide)) * 0.9 - bend * 0.11 - Math.abs(s) * 0.02;
}

/** Lò xo tới hạn, nghiệm giải tích (ổn định mọi dt). */
export function spring(x: number, v: number, target: number, dt: number, lagS = 0.2): [number, number] {
  const w = 2 / lagS;
  const x0 = x - target;
  const e = Math.exp(-w * dt), k = v + w * x0;
  return [target + (x0 + k * dt) * e, (v - w * k * dt) * e];
}

/** Tóc trễ theo đầu: head-bang → tóc quất xuống rồi vung ngược (lò xo hơi thiếu tắt). Gọi sau khi đặt đầu/cổ/ngực. */
export function updateHair(c: RigChar, dt: number) {
  if (dt <= 0) return;
  const bn = c.bones, h = c.hair;
  const pitch = bn[B.head]!.rotation.x + bn[B.neck]!.rotation.x + bn[B.chest]!.rotation.x;
  const roll = bn[B.head]!.rotation.z + bn[B.neck]!.rotation.z;
  const vp = (pitch - h.px) / dt, vr = (roll - h.pz) / dt;
  h.px = pitch; h.pz = roll;
  // gia tốc góc của đầu đẩy tóc ngược chiều; trọng lực kéo tóc rủ thẳng (bù góc cúi)
  // bán ẩn + bước con ≤ 1/120 s → ổn định cả khi khung hình chậm (dt 0,1 s)
  const w = 16, z = 0.35, n = Math.ceil(dt * 120), sdt = dt / n;
  const kx = clamp(vp, -12, 12) * 6, kz = clamp(vr, -12, 12) * 4;
  for (let i = 0; i < n; i++) {
    h.vx += (-w * w * (h.x - (-pitch * 0.55)) - 2 * z * w * h.vx - kx) * sdt;
    h.vz += (-w * w * (h.z - (-roll * 0.5)) - 2 * z * w * h.vz - kz) * sdt;
    h.x += h.vx * sdt; h.z += h.vz * sdt;
  }
  h.x = clamp(h.x, -1.4, 1.2); h.z = clamp(h.z, -0.8, 0.8);
  bn[B.hair]!.rotation.set(h.x, 0, h.z);
}

export const easeInOut = (x: number) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const lerpExp = (a: number, b: number, dt: number, tau: number) => a + (b - a) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));
