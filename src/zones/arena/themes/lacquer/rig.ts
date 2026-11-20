// "Mực & Sơn mài" — rig người cao 7,5 đầu (H ≈ 1,72 m) cho ca sĩ / ban nhạc / quay phim (gói L4).
// Mỗi RigBatch = MỘT SkinnedMesh (1 draw call cho mọi nhân vật + đạo cụ gắn xương). Tô 2 bậc phẳng + dải loang
// ở chân, rim mực sáng (vỏ trứng) thay viền, khảm vàng = đỉnh phát sáng (kind 1), mặt = texture nét cọ (kind 2):
// mỗi mắt MỘT nét cọ cong, không mũi, má loang nhẹ; miệng = xương "mouth" co giãn theo âm lượng.
// Áo dài: tà trước / tà sau trên xương riêng, nối mềm với hông; tà trễ 150–250 ms bằng lò xo (updateCloth).
import * as THREE from 'three';
import { PAL, hexToRgb } from '../../../../world/style';

const V3 = THREE.Vector3;
export const clamp = THREE.MathUtils.clamp;

/** Chỉ số xương trong một nhân vật. */
export const B = {
  root: 0, hips: 1, chest: 2, neck: 3, head: 4, uaL: 5, faL: 6, hdL: 7, uaR: 8, faR: 9, hdR: 10,
  thL: 11, shL: 12, thR: 13, shR: 14, panF: 15, panB: 16, tail: 17, mouth: 18,
} as const;
const NB = 19;
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 1, 11, 1, 13, 1, 1, 4, 4];
/** Vị trí nghỉ (so với xương cha). Nhân vật nhìn về -Z, bên phải = +X. */
const REST: [number, number, number][] = [
  [0, 0, 0], [0, 0.98, 0], [0, 0.07, 0], [0, 0.36, 0], [0, 0.1, 0],
  [-0.165, 0.35, 0], [0, -0.29, 0], [0, -0.25, 0],
  [0.165, 0.35, 0], [0, -0.29, 0], [0, -0.25, 0],
  [-0.085, -0.06, 0], [0, -0.43, 0], [0.085, -0.06, 0], [0, -0.43, 0],
  [0, 0.0, -0.1], [0, 0.0, 0.1], [0, 0.04, 0.085], [0, -0.065, -0.088],
];
/** Toạ độ nghỉ tuyệt đối (khung nhân vật) của từng xương. */
export const REST_ABS: THREE.Vector3[] = (() => {
  const out: THREE.Vector3[] = [];
  REST.forEach((r, i) => { const p = new V3(...r); if (PARENT[i]! >= 0) p.add(out[PARENT[i]!]!); out.push(p); });
  return out;
})();
export const L_UA = 0.29, L_FA = 0.25;
export const HEAD_C = new V3(0, 1.6, 0);
const HEAD_R = new V3(0.082, 0.112, 0.094);

export type HairStyle = 'bun' | 'tail' | 'short' | 'bunTail';
export type HeadWear = 'khanVan' | 'khanDong' | 'nonLa' | 'none';
export interface RigLook {
  skin: number; hair: number; hairStyle: HairStyle; headWear: HeadWear; headCol: number;
  top: number; trim: number; pants: number; shoe: number;
  /** tà dài tới (m): áo dài 0,3 · áo the 0,55 */
  hemY?: number; lotus?: boolean;
}

type WFn = (p: THREE.Vector3) => [number, number, number]; // [xương A, xương B, trọng số B]

class GeoAcc {
  pos: number[] = []; nrm: number[] = []; col: number[] = []; k: number[] = []; si: number[] = []; sw: number[] = []; idx: number[] = [];
  add(g: THREE.BufferGeometry, col: number, kind: number, base: number, w: WFn | number, face = false) {
    const p = g.attributes.position!, n = g.attributes.normal!;
    const off = this.pos.length / 3;
    const [r, gg, b] = hexToRgb(col);
    const v = new V3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      this.pos.push(v.x, v.y, v.z);
      this.nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      this.col.push(r, gg, b);
      let fu = 0, fv = 0;
      if (face && v.z < HEAD_C.z) {
        fu = clamp((v.x - HEAD_C.x) / HEAD_R.x * 0.5 + 0.5, 0, 1);
        fv = clamp((v.y - HEAD_C.y) / HEAD_R.y * 0.5 + 0.5, 0, 1);
      }
      this.k.push(kind, v.y, fu, fv);
      if (typeof w === 'number') { this.si.push(base + w, 0, 0, 0); this.sw.push(1, 0, 0, 0); }
      else { const [a, bb, wb] = w(v); this.si.push(base + a, base + bb, 0, 0); this.sw.push(1 - wb, wb, 0, 0); }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(off + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(off + i);
    g.dispose();
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aK', new THREE.Float32BufferAttribute(this.k, 4));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    return g;
  }
}

// ── hình học cơ bản (khung nhân vật) ──
/** Ống thuôn nối a → b (bán kính ra ở a, rb ở b), dẹt theo z (flatZ). */
export function tube(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, seg = 10, flatZ = 1, hs = 1): THREE.BufferGeometry {
  const d = new V3().subVectors(b, a); const len = d.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, seg, hs, false);
  g.scale(1, 1, flatZ);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
export function ell(c: THREE.Vector3, rx: number, ry: number, rz: number, seg = 14): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7))).scale(rx, ry, rz).translate(c.x, c.y, c.z);
}
export function box(c: THREE.Vector3, sx: number, sy: number, sz: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(sx, sy, sz).translate(c.x, c.y, c.z);
}
/** Tà áo: lưới nx × ny thuôn + loe, z0 = mặt tà, dir = ±1 (phía loe ra). */
function panel(yTop: number, yBot: number, wTop: number, wBot: number, z0: number, dir: number, ny = 8): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1, 4, ny);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), t = 0.5 - p.getY(i); // t: 0 trên → 1 dưới
    const w = THREE.MathUtils.lerp(wTop, wBot, t);
    p.setXYZ(i, u * w, THREE.MathUtils.lerp(yTop, yBot, t), z0 + dir * (0.05 * t * t + Math.abs(u) * 0.04 * (1 - t * 0.5)));
  }
  g.computeVertexNormals();
  return g;
}
/** Hoa sen dẹt (5 cánh) nằm trên mặt phẳng XY, quay mặt về -Z. */
export function lotusGeo(c: THREE.Vector3, s: number, dir = -1): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  const petals: [number, number, number][] = [[0, 1, 0.32], [-0.55, 0.78, 0.26], [0.55, 0.78, 0.26], [-0.95, 0.38, 0.2], [0.95, 0.38, 0.2]];
  sh.moveTo(-0.9, 0); sh.lineTo(0.9, 0); sh.lineTo(0.7, -0.18); sh.lineTo(-0.7, -0.18); sh.lineTo(-0.9, 0);
  const geos: THREE.BufferGeometry[] = [new THREE.ShapeGeometry(sh)];
  for (const [x, y, w] of petals) {
    const p = new THREE.Shape();
    p.moveTo(0, 0); p.quadraticCurveTo(x * 0.5 - w, y * 0.5, x, y); p.quadraticCurveTo(x * 0.5 + w, y * 0.5, 0, 0);
    geos.push(new THREE.ShapeGeometry(p, 6));
  }
  const acc = new GeoAcc();
  const merged = new THREE.BufferGeometry();
  // gộp nhỏ: dùng GeoAcc tạm để có index chung
  for (const g of geos) acc.add(g, 0, 0, 0, 0);
  merged.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nrm, 3));
  merged.setIndex(acc.idx);
  merged.scale(s, s, s);
  if (dir < 0) merged.rotateY(Math.PI);
  return merged.translate(c.x, c.y, c.z);
}

/** Texture mặt: hai nét cọ mắt cong (mỗi mắt một nét), má loang nhẹ — không mũi, không mắt chibi. */
function faceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const [r, gg, b] = hexToRgb(PAL.berry[300]).map((v) => Math.round(v * 255));
  for (const x of [34, 94]) {
    const grd = g.createRadialGradient(x, 82, 0, x, 82, 16);
    grd.addColorStop(0, `rgba(${r},${gg},${b},0.32)`); grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grd; g.fillRect(x - 18, 64, 36, 36);
  }
  const [ir, ig, ib] = hexToRgb(PAL.night[700]).map((v) => Math.round(v * 255));
  g.fillStyle = `rgb(${ir},${ig},${ib})`;
  // nét cọ: đầu ấn dày, đuôi khô mảnh — một hình liềm cong mềm cho mỗi mắt
  for (const s of [-1, 1]) {
    const x0 = 64 + s * 13, x1 = 64 + s * 40, y = 62;
    g.beginPath();
    g.moveTo(x0, y);
    g.quadraticCurveTo((x0 + x1) / 2, y + 7.5, x1, y - 2);
    g.quadraticCurveTo((x0 + x1) / 2, y + 3.2, x0, y + 1.6);
    g.closePath(); g.fill();
  }
  // lông mày: nét mực rất nhạt, mảnh
  g.strokeStyle = `rgba(${ir},${ig},${ib},0.35)`; g.lineWidth = 1.6;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64 + s * 14, 50); g.quadraticCurveTo(64 + s * 28, 44, 64 + s * 41, 49); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute vec3 aCol;
attribute vec4 aK;
varying vec3 vCol;
varying vec4 vK;
varying vec3 vWN;
varying vec3 vV;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWN = normalize(mat3(modelMatrix) * objectNormal);
  vV = cameraPosition - wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  vCol = aCol; vK = aK;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
uniform sampler2D uFace;
uniform vec3 uRim;
uniform vec3 uWash;
uniform vec3 uLight;
uniform float uGlow;
uniform float uWashY;
varying vec3 vCol;
varying vec4 vK;
varying vec3 vWN;
varying vec3 vV;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 base = vCol;
  float kind = vK.x;
  if (kind > 0.5 && kind < 1.5) {
    gl_FragColor = vec4(base * uGlow, 1.0);
    #include <fog_fragment>
    return;
  }
  vec3 n = normalize(vWN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vV);
  // 2 bậc phẳng: bóng ×0,62 ngả chàm
  float d = dot(n, normalize(uLight));
  float lit = smoothstep(-0.05, 0.05, d);
  vec3 sh = base * 0.62 * vec3(0.86, 0.9, 1.12);
  vec3 col = mix(sh, base, lit);
  if (kind > 1.5) {
    col = mix(col, base, 0.75);
    vec4 fc = texture2D(uFace, vK.zw);
    col = mix(col, fc.rgb, fc.a * step(0.001, vK.z + vK.w));
  }
  // dải loang ở chân / gấu
  float w = smoothstep(uWashY, 0.0, vK.y);
  col = mix(col, uWash, w * 0.55);
  // rim mực sáng (vỏ trứng) ở đường bao — không viền đen
  float fr = 1.0 - abs(dot(n, v));
  col += uRim * smoothstep(0.72, 0.97, fr) * 0.22;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export interface RigChar {
  base: number;
  bones: THREE.Bone[];
  look: RigLook;
  /** lò xo tà áo / đuôi tóc */
  cloth: { fx: number; fvx: number; bx: number; bvx: number; sz: number; svz: number; tx: number; tvx: number };
  lastRoot: THREE.Vector3;
  vel: THREE.Vector3;
}

const W_LEG = (th: number, sh: number): WFn => (p) => [th, sh, clamp((0.53 - p.y) / 0.08, 0, 1)];
const W_TORSO: WFn = (p) => [B.hips, B.chest, clamp((p.y - 1.0) / 0.12, 0, 1)];

export class RigBatch {
  private acc = new GeoAcc();
  private bonesAll: THREE.Bone[] = [];
  readonly chars: RigChar[] = [];
  mesh: THREE.SkinnedMesh | null = null;
  private mat: THREE.ShaderMaterial | null = null;
  private faceTex: THREE.CanvasTexture | null = null;
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
    const c: RigChar = { base, bones, look, cloth: { fx: 0, fvx: 0, bx: 0, bvx: 0, sz: 0, svz: 0, tx: 0, tvx: 0 }, lastRoot: new V3(), vel: new V3() };
    this.chars.push(c);
    this.buildBody(c);
    return c;
  }

  /** Thêm hình (khung nghỉ của nhân vật) gắn vào xương `bone` (hoặc hàm trọng số). kind 0 tô · 1 phát sáng. */
  add(c: RigChar, g: THREE.BufferGeometry, col: number, bone: number | WFn, kind = 0) {
    this.acc.add(g, col, kind, c.base, bone);
  }

  private buildBody(c: RigChar) {
    const L = c.look, a = this.acc, o = c.base, R = REST_ABS;
    const hem = L.hemY ?? 0.3;
    // đầu + mặt
    a.add(ell(HEAD_C, HEAD_R.x, HEAD_R.y, HEAD_R.z, 18), L.skin, 2, o, B.head, true);
    a.add(ell(new V3(0, 1.535, -0.083), 0.016, 0.009, 0.006, 8), PAL.berry[700], 0, o, B.mouth);
    // cổ dài + cổ áo khảm
    a.add(tube(new V3(0, 1.36, 0.004), new V3(0, 1.53, 0.01), 0.036, 0.032, 10), L.skin, 0, o, (p) => [B.neck, B.head, clamp((p.y - 1.47) / 0.06, 0, 1)]);
    a.add(tube(new V3(0, 1.37, 0.004), new V3(0, 1.44, 0.006), 0.046, 0.042, 12, 1), L.top, 0, o, B.neck);
    a.add(new THREE.TorusGeometry(0.045, 0.006, 4, 16).rotateX(Math.PI / 2).translate(0, 1.44, 0.006), L.trim, 1, o, B.neck);
    // tóc
    const hairCap = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI, 0, Math.PI * 0.78).scale(HEAD_R.x * 1.08, HEAD_R.y * 1.06, HEAD_R.z * 1.1).translate(0, 1.605, 0.004);
    a.add(hairCap, L.hair, 0, o, B.head);
    a.add(new THREE.SphereGeometry(1, 16, 6, Math.PI, Math.PI, 0, Math.PI * 0.3).scale(HEAD_R.x * 1.07, HEAD_R.y * 1.06, HEAD_R.z * 1.08).translate(0, 1.607, 0), L.hair, 0, o, B.head);
    if (L.hairStyle === 'bun' || L.hairStyle === 'bunTail') a.add(ell(new V3(0, 1.53, 0.1), 0.05, 0.042, 0.045, 10), L.hair, 0, o, B.head);
    if (L.hairStyle === 'tail' || L.hairStyle === 'bunTail') {
      const t0 = R[B.tail]!;
      a.add(tube(new V3(0, t0.y - 0.02, t0.z + 0.02), new V3(0, 1.08, 0.13), 0.028, 0.012, 8, 0.7, 6), L.hair, 0, o,
        (p) => [B.head, B.tail, clamp((t0.y - p.y) / 0.08, 0, 1)]);
    }
    // khăn
    if (L.headWear === 'khanVan') {
      // khăn vấn: MỘT vành tròn dẹt quấn quanh đầu như vầng hào quang, nghiêng ra sau (không chồng cao thành mũ),
      // hai lớp quấn xoắn sát nhau + chỉ khảm vàng ở mép dưới
      const tilt = Math.PI / 2 - 0.55;
      a.add(new THREE.TorusGeometry(0.106, 0.026, 7, 28).scale(1, 1, 0.62).rotateX(tilt).scale(1, 1, 1.1).translate(0, 1.668, 0.016), L.headCol, 0, o, B.head);
      a.add(new THREE.TorusGeometry(0.1, 0.014, 5, 28).scale(1, 1, 0.7).rotateX(tilt).scale(1, 1, 1.1).translate(0, 1.687, 0.026), PAL.honey[700], 0, o, B.head);
      a.add(new THREE.TorusGeometry(0.118, 0.004, 4, 28).rotateX(tilt).scale(1, 1, 1.1).translate(0, 1.655, 0.012), L.trim, 1, o, B.head);
    } else if (L.headWear === 'khanDong') {
      for (let i = 0; i < 2; i++) a.add(new THREE.TorusGeometry(0.086, 0.02, 6, 20).rotateX(Math.PI / 2 - 0.15).scale(1, 1, 1.12).translate(0, 1.66 + i * 0.03, 0.008), L.headCol, 0, o, B.head);
      a.add(ell(new V3(0, 1.69, 0.008), 0.084, 0.03, 0.094, 12), L.headCol, 0, o, B.head);
    } else if (L.headWear === 'nonLa') {
      a.add(new THREE.ConeGeometry(0.24, 0.16, 22, 1, false).translate(0, 1.79, 0), L.headCol, 0, o, B.head);
    }
    // thân áo (ôm, dẹt)
    const torso = new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0.92), new THREE.Vector2(0.13, 0.93), new THREE.Vector2(0.125, 1.0), new THREE.Vector2(0.108, 1.08),
      new THREE.Vector2(0.125, 1.2), new THREE.Vector2(0.135, 1.3), new THREE.Vector2(0.15, 1.38), new THREE.Vector2(0.09, 1.43), new THREE.Vector2(0.04, 1.44),
    ], 16);
    torso.scale(1, 1, 0.66);
    a.add(torso, L.top, 0, o, W_TORSO);
    // tà trước / tà sau + gấu khảm vàng
    for (const [bone, z, dir] of [[B.panF, -0.075, -1], [B.panB, 0.075, 1]] as const) {
      const w: WFn = (p) => [B.hips, bone, clamp((0.96 - p.y) / 0.45, 0, 1)];
      a.add(panel(0.97, hem, 0.24, 0.34, z, dir), L.top, 0, o, w);
      const g = panel(hem + 0.022, hem, 0.338, 0.342, z + dir * 0.002, dir, 1);
      a.add(g, L.trim, 1, o, w);
      for (const s of [-1, 1]) a.add(tube(new V3(s * 0.12, 0.95, z), new V3(s * 0.17, hem + 0.01, z + dir * 0.09), 0.004, 0.004, 4), PAL.honey[700], 1, o, w);
    }
    if (L.lotus) {
      const w: WFn = (p) => [B.hips, B.panF, clamp((0.96 - p.y) / 0.45, 0, 1)];
      a.add(lotusGeo(new V3(0.02, hem + 0.12, -0.075 - 0.065 - 0.006), 0.075), L.trim, 1, o, w);
    }
    // quần lụa rộng
    for (const [th, sh, s] of [[B.thL, B.shL, -1], [B.thR, B.shR, 1]] as const) {
      a.add(tube(new V3(s * 0.075, 0.95, 0), new V3(s * 0.09, 0.04, 0), 0.075, 0.1, 10, 1, 6), L.pants, 0, o, W_LEG(th, sh));
      a.add(ell(new V3(s * 0.09, 0.03, -0.05), 0.04, 0.03, 0.09, 8), L.shoe, 0, o, sh);
    }
    // tay: tay áo dài + bàn tay thon
    for (const [ua, fa, hd, s] of [[B.uaL, B.faL, B.hdL, -1], [B.uaR, B.faR, B.hdR, 1]] as const) {
      const S = R[ua]!, E = R[fa]!, W = R[hd]!;
      a.add(ell(new V3(S.x - s * 0.02, S.y - 0.005, S.z), 0.048, 0.04, 0.045, 10), L.top, 0, o, (p) => [B.chest, ua, 0.5]);
      a.add(tube(S, E, 0.04, 0.034, 10), L.top, 0, o, ua);
      a.add(ell(E, 0.034, 0.034, 0.034, 8), L.top, 0, o, fa);
      a.add(tube(E, new V3(W.x, W.y + 0.01, W.z), 0.033, 0.03, 10), L.top, 0, o, fa);
      a.add(tube(new V3(W.x, W.y + 0.02, W.z), new V3(W.x, W.y + 0.004, W.z), 0.033, 0.033, 10), L.trim, 1, o, fa);
      a.add(tube(new V3(W.x, W.y + 0.01, W.z), new V3(W.x, W.y - 0.115, W.z), 0.028, 0.014, 8, 0.5), L.skin, 0, o, hd);
    }
  }

  build(scene: THREE.Scene, name: string): THREE.SkinnedMesh {
    const geo = this.acc.geometry();
    this.faceTex = faceTexture();
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, fog: true, side: THREE.DoubleSide,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uFace: { value: this.faceTex },
        uRim: { value: new V3(...hexToRgb(PAL.cream[500])) },
        uWash: { value: new V3(...hexToRgb(PAL.night[300])) },
        uLight: { value: new V3(-0.35, 0.8, -0.5) },
        uGlow: { value: 1.0 },
        uWashY: { value: 0.55 },
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

  setVisible(v: boolean) { if (this.mesh) this.mesh.visible = v; }

  dispose() {
    if (this.mesh) { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
    this.skeleton?.dispose();
    this.mat?.dispose(); this.faceTex?.dispose();
  }
}

// ── pose ──
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _d = new V3(), _p = new V3(), _u = new V3(), _f = new V3(), _e = new V3();
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
  _e.copy(_u).multiplyScalar(L_UA); // khuỷu (so với vai)
  _f.copy(_d).multiplyScalar(dist).sub(_e).normalize();
  _qi.copy(ua.quaternion).invert();
  _f.applyQuaternion(_qi);
  fa.quaternion.setFromUnitVectors(DOWN, _f);
  if (handDir) {
    // bàn tay (trục -Y) hướng theo handDir (khung ngực): q_hd = (q_ua·q_fa)⁻¹ · q(DOWN→handDir)
    _qi.copy(ua.quaternion).multiply(fa.quaternion).invert();
    _q.setFromUnitVectors(DOWN, _p.copy(handDir).normalize());
    hd.quaternion.copy(_qi).multiply(_q);
  } else hd.rotation.set(handFlex, 0, 0);
}

/**
 * Lò xo tới hạn ~ trễ `lagS` giây. Nghiệm giải tích (ổn định với mọi dt): Euler bán ẩn cũ phân kỳ khi ω·dt > ~0,8
 * (≤ 12 fps) → tà áo vẫy thành "cánh" cứng nằm ngang.
 */
export function spring(x: number, v: number, target: number, dt: number, lagS = 0.2): [number, number] {
  const w = 2 / lagS;
  const x0 = x - target;
  const e = Math.exp(-w * dt), k = v + w * x0;
  return [target + (x0 + k * dt) * e, (v - w * k * dt) * e];
}

/** Tà áo + đuôi tóc trễ 150–250 ms theo chuyển động thân và bước chân. Gọi sau khi đặt root/hông/chân. */
export function updateCloth(c: RigChar, dt: number, t: number, worldYaw: number) {
  if (dt <= 0) return;
  const root = c.bones[0]!, bn = c.bones, cl = c.cloth;
  _d.subVectors(root.position, c.lastRoot).divideScalar(dt);
  c.lastRoot.copy(root.position);
  c.vel.lerp(_d, 1 - Math.exp(-dt / 0.12));
  // vận tốc trong khung nhân vật (tiến = -Z)
  const cs = Math.cos(worldYaw), sn = Math.sin(worldYaw);
  const fwd = -c.vel.x * sn - c.vel.z * cs; // >0 khi đi về phía trước
  const lat = c.vel.x * cs - c.vel.z * sn;
  const thMax = Math.max(bn[B.thL]!.rotation.x, bn[B.thR]!.rotation.x, 0);
  const thMin = Math.min(bn[B.thL]!.rotation.x, bn[B.thR]!.rotation.x, 0);
  const hipSway = bn[B.hips]!.rotation.z;
  const breeze = Math.sin(t * 1.3 + c.base) * 0.04;
  const trail = clamp(fwd, -3, 3) * 0.16;
  [cl.fx, cl.fvx] = spring(cl.fx, cl.fvx, thMax * 0.95 - trail + breeze, dt, 0.2);
  [cl.bx, cl.bvx] = spring(cl.bx, cl.bvx, thMin * 0.8 - trail - Math.abs(trail) * 0.3 + breeze * 0.7, dt, 0.24);
  [cl.sz, cl.svz] = spring(cl.sz, cl.svz, -hipSway * 0.9 + clamp(lat, -3, 3) * 0.1, dt, 0.22);
  [cl.tx, cl.tvx] = spring(cl.tx, cl.tvx, -trail * 0.6 + bn[B.chest]!.rotation.x * -0.6 + Math.sin(t * 0.9 + c.base) * 0.03, dt, 0.25);
  // Tà rủ theo trọng lực: lắc ≤ ~15° (0,26 rad); chỉ được đẩy xa hơn khi đùi đẩy tới (không xuyên chân), không bao giờ ngang.
  const SW = 0.26;
  cl.sz = clamp(cl.sz, -SW, SW);
  cl.fx = clamp(cl.fx, -SW, Math.max(SW, thMax + 0.08));
  cl.bx = clamp(cl.bx, Math.min(-SW, thMin - 0.08), SW);
  bn[B.panF]!.rotation.set(Math.min(cl.fx, 1.05), 0, cl.sz);
  bn[B.panB]!.rotation.set(Math.max(cl.bx, -1.05), 0, cl.sz);
  bn[B.tail]!.rotation.set(clamp(cl.tx, -0.5, 0.6), 0, -bn[B.head]!.rotation.z * 0.7 + cl.sz * 0.5);
}

/** Bước chân / quỳ: đặt hông + gối. stepPhase rad, amt 0..1. */
export function legs(c: RigChar, stepPhase: number, amt: number, kneel = 0, lift = 0) {
  const bn = c.bones, s = Math.sin(stepPhase) * amt;
  const kL = Math.max(0, -Math.cos(stepPhase)) * amt, kR = Math.max(0, Math.cos(stepPhase)) * amt;
  bn[B.thL]!.rotation.set(s * 0.45 + kneel * 1.4 + lift * 0.4, 0, -0.03);
  bn[B.thR]!.rotation.set(-s * 0.45 + kneel * 0.1 + lift * 0.1, 0, 0.03);
  bn[B.shL]!.rotation.set(-kL * 0.7 - kneel * 1.5 - lift * 0.6, 0, 0);
  bn[B.shR]!.rotation.set(-kR * 0.7 - kneel * 1.6 - lift * 0.2, 0, 0);
}

export const easeInOut = (x: number) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const lerpExp = (a: number, b: number, dt: number, tau: number) => a + (b - a) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));
