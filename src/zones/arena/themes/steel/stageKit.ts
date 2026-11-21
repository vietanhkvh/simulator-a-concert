// "Thép & Lửa" — bộ dựng hình gộp cho sân khấu rock (không có `builders`: file phụ trợ).
// Vật liệu ĐẼO PHẲNG: mỗi tam giác một pháp tuyến (geometry không chỉ số) → một sắc độ / mặt; ánh sáng tự tính trong shader
// (cảnh không có đèn thật): key hồ quang lạnh từ trên-trước + rim lửa ấm từ dưới mạnh dần theo Hype; jitter sắc độ từng mặt
// (thép xước); KHÔNG viền. Kênh w của màu: 0 = tô sáng · 1 = tự phát sáng · 2 = tô sáng × atlas (lưới thép, sọc cảnh báo,
// sao stencil, tia sét, chữ khu, mặt loa).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RAMPS, toColor } from '../../../../world/style';
import type { Uniforms } from '../../../../world/shared/glowPoints';

/** Ramp "Thép & Lửa" (đọc tại thời điểm gọi — token đổi tại chỗ khi đổi phong cách). */
export const R = () => ({
  coal: RAMPS.coal!, steel: RAMPS.steel!, arc: RAMPS.arc!, tung: RAMPS.tungsten!, blood: RAMPS.blood!,
  ember: RAMPS.ember!, flame: RAMPS.flame!, white: RAMPS.whitehot!, paper: RAMPS.paper!,
});

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const _o = new THREE.Object3D();

/** Ô atlas 4×4. */
export const CELL = {
  grating: 0, hazard: 1, plate: 2, star: 3, bolt: 4, cone: 5, grille: 6, hazRing: 7,
  letter: (i: number) => 8 + i, // A..H = 8..15
} as const;

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export class SKit {
  readonly parts: THREE.BufferGeometry[] = [];
  private c = new THREE.Color();
  /** Thêm hình: mode 0 tô sáng · 1 phát sáng · 2 tô sáng × atlas(cell). jit = biên độ jitter sắc độ mỗi mặt. */
  add(g: THREE.BufferGeometry, hex: number, m?: THREE.Matrix4, mode = 0, cell = -1, jit = 0.07): this {
    const h = g.index ? g.toNonIndexed() : g;
    if (h !== g) g.dispose();
    if (m) h.applyMatrix4(m);
    h.computeVertexNormals(); // không chỉ số → pháp tuyến mặt
    const n = h.getAttribute('position').count;
    const col = new Float32Array(n * 4);
    toColor(hex, this.c);
    for (let i = 0; i < n; i += 3) {
      const k = mode === 1 ? 1 : 1 + (rnd() - 0.5) * 2 * jit;
      for (let j = 0; j < 3 && i + j < n; j++) {
        const o = (i + j) * 4;
        col[o] = this.c.r * k; col[o + 1] = this.c.g * k; col[o + 2] = this.c.b * k; col[o + 3] = mode;
      }
    }
    let uv = h.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const out = new Float32Array(n * 2);
    if (uv && cell >= 0) {
      const cx = (cell % 4) / 4, cy = 1 - (Math.floor(cell / 4) + 1) / 4;
      for (let i = 0; i < n; i++) { out[i * 2] = cx + uv.getX(i) * 0.25 * 0.98 + 0.0025; out[i * 2 + 1] = cy + uv.getY(i) * 0.25 * 0.98 + 0.0025; }
    }
    uv = undefined;
    for (const key of Object.keys(h.attributes)) if (key !== 'position' && key !== 'normal') h.deleteAttribute(key);
    h.setAttribute('color', new THREE.BufferAttribute(col, 4));
    h.setAttribute('uv', new THREE.BufferAttribute(out, 2));
    this.parts.push(h);
    return this;
  }
  xf(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
    _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
    return _o.matrix.clone();
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, hex: number, ry = 0, mode = 0): this {
    return this.add(new THREE.BoxGeometry(w, h, d), hex, this.xf(x, y, z, 0, ry), mode);
  }
  /** Hộp vát cạnh (vát 4 cạnh dọc trục Z cục bộ, ~4 % bắt highlight). */
  cbox(w: number, h: number, d: number, x: number, y: number, z: number, hex: number, ry = 0, ch = 0.04): this {
    const c = Math.min(w, h) * ch + 0.01;
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + c, -h / 2); s.lineTo(w / 2 - c, -h / 2); s.lineTo(w / 2, -h / 2 + c); s.lineTo(w / 2, h / 2 - c);
    s.lineTo(w / 2 - c, h / 2); s.lineTo(-w / 2 + c, h / 2); s.lineTo(-w / 2, h / 2 - c); s.lineTo(-w / 2, -h / 2 + c);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -d / 2);
    return this.add(g, hex, this.xf(x, y, z, 0, ry));
  }
  /** Thanh vuông a→b (thép hộp), tiết diện w×h. */
  beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, hex: number, mode = 0): this {
    const len = a.distanceTo(b);
    if (len < 1e-4) return this;
    const dir = b.clone().sub(a).normalize();
    const side = new THREE.Vector3().crossVectors(UP, dir);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(dir, side).normalize();
    const m = new THREE.Matrix4().makeBasis(side, up, dir).setPosition(a.clone().add(b).multiplyScalar(0.5));
    return this.add(new THREE.BoxGeometry(w, h, len), hex, m, mode);
  }
  /** Ống tròn đẽo 6 cạnh a→b. */
  pipe(a: THREE.Vector3, b: THREE.Vector3, r: number, hex: number, seg = 6, mode = 0): this {
    const len = a.distanceTo(b);
    if (len < 1e-4) return this;
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
    return this.add(g, hex, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)), mode);
  }
  /** Tứ giác (a,b,c,d) với uv (0,0)(1,0)(1,1)(0,1). */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, hex: number, mode = 0, cell = -1, uvs?: [number, number, number, number]): this {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()], 3));
    const [u0, v0, u1, v1] = uvs ?? [0, 0, 1, 1];
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
    return this.add(g, hex, undefined, mode, cell, mode === 1 ? 0 : 0.03);
  }
  /** Tấm phẳng w×h tâm (x,y,z), mặt hướng -Z (về khán giả) rồi quay ry. Dùng atlas cell (tile lặp u/v lần không hỗ trợ → 1 ô). */
  decal(w: number, h: number, x: number, y: number, z: number, hex: number, cell: number, ry = 0, mode = 2): this {
    const g = new THREE.PlaneGeometry(w, h).rotateY(Math.PI);
    return this.add(g, hex, this.xf(x, y, z, 0, ry), mode, cell, 0.02);
  }
  /** Tấm nằm ngang (mặt trên) w×d. */
  floor(w: number, d: number, x: number, y: number, z: number, hex: number, cell: number, ry = 0, mode = 2): this {
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    return this.add(g, hex, this.xf(x, y, z, 0, ry), mode, cell, 0.02);
  }
  /** Giàn hộp thép a→b: 4 thanh chủ (cạnh s) + giằng chữ X trên 4 mặt mỗi khoang + thanh ngang. */
  truss(a: THREE.Vector3, b: THREE.Vector3, s: number, hex: number, hex2: number, bay = 1.2, chord = 0.07, lace = 0.035): this {
    const len = a.distanceTo(b);
    if (len < 1e-3) return this;
    const dir = b.clone().sub(a).normalize();
    let side = new THREE.Vector3().crossVectors(UP, dir);
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(dir, side).normalize();
    const h = s / 2;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => side.clone().multiplyScalar(i! * h).add(up.clone().multiplyScalar(j! * h)));
    for (const c of corners) this.beam(a.clone().add(c), b.clone().add(c), chord, chord, hex);
    const n = Math.max(1, Math.round(len / bay));
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n);
      for (let i = 0; i < 4; i++) this.beam(p.clone().add(corners[i]!), p.clone().add(corners[(i + 1) % 4]!), lace, lace, hex2);
      if (k === n) break;
      const p1 = a.clone().lerp(b, (k + 1) / n);
      for (let i = 0; i < 4; i++) {
        const c0 = corners[i]!, c1 = corners[(i + 1) % 4]!;
        this.beam(p.clone().add(c0), p1.clone().add(c1), lace, lace, hex2);
        this.beam(p.clone().add(c1), p1.clone().add(c0), lace, lace, hex2);
      }
    }
    return this;
  }
  /** Hàng đinh tán (hộp nhỏ 4 mặt) từ a→b, mặt hướng n. */
  rivets(a: THREE.Vector3, b: THREE.Vector3, step: number, hex: number, r = 0.035): this {
    const n = Math.max(1, Math.floor(a.distanceTo(b) / step));
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      this.add(new THREE.OctahedronGeometry(r, 0), hex, this.xf(p.x, p.y, p.z, 0, Math.PI / 4), 0, -1, 0.15);
    }
    return this;
  }
  /** Ngôi sao 5 cánh nhọn phẳng (mặt XY) tâm (x,y,z), mặt hướng -Z. */
  star(r: number, x: number, y: number, z: number, hex: number, mode = 1, ry = 0, rx = 0): this {
    const pos: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2 + Math.PI / 2, a1 = ((i + 1) / 10) * Math.PI * 2 + Math.PI / 2;
      const r0 = i % 2 ? r * 0.42 : r, r1 = i % 2 ? r : r * 0.42;
      pos.push(0, 0, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0, Math.cos(a0) * r0, Math.sin(a0) * r0, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return this.add(g, hex, this.xf(x, y, z, rx, ry), mode, -1, 0);
  }
  /** Tia sét phẳng (mặt XY), cao h, tâm (x,y,z). */
  bolt(h: number, x: number, y: number, z: number, hex: number, mode = 1, ry = 0, rx = 0): this {
    const P = BOLT_PTS.map(([px, py]) => [px * h, py * h] as const);
    const pos: number[] = [];
    // tam giác hoá đa giác lồi từng phần: 2 nửa tia sét
    const tris = [[0, 1, 2], [0, 2, 3], [3, 4, 5], [3, 5, 6], [3, 6, 0]];
    for (const t of tris) for (const i of t) pos.push(P[i]![0], P[i]![1], 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return this.add(g, hex, this.xf(x, y, z, rx, ry), mode, -1, 0);
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    return g;
  }
}
/** Đa giác tia sét (đơn vị cao 1, tâm 0). */
export const BOLT_PTS: [number, number][] = [[0.12, 0.5], [-0.22, -0.02], [0.02, -0.02], [-0.14, -0.5], [0.24, 0.08], [0.0, 0.08], [0.12, 0.5]];

// ───────── vật liệu đẽo phẳng ─────────
const FACET_VERT = /* glsl */ `
attribute vec4 color;
varying vec4 vCol; varying vec3 vN; varying vec2 vUv; varying float vY;
#include <fog_pars_vertex>
void main(){
  vCol = color; vUv = uv;
  vec4 wp = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp; n = mat3(instanceMatrix) * n;
  #endif
  wp = modelMatrix * wp;
  vN = normalize(mat3(modelMatrix) * n);
  vY = wp.y;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FACET_FRAG = /* glsl */ `
uniform float uHype; uniform float uPulse; uniform float uFire; uniform sampler2D uAtlas;
uniform vec3 uKey; uniform vec3 uRim; uniform vec3 uAmb;
varying vec4 vCol; varying vec3 vN; varying vec2 vUv; varying float vY;
#include <fog_pars_fragment>
void main(){
  vec3 base = vCol.rgb;
  vec3 col;
  if (vCol.a > 0.5 && vCol.a < 1.5) {
    col = base;
  } else {
    if (vCol.a > 1.5) base *= texture2D(uAtlas, vUv).rgb;
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    // key hồ quang lạnh: trái-trên-trước (khán giả ở -Z)
    float k = max(dot(n, normalize(vec3(-0.45, 0.8, -0.4))), 0.0);
    // rim lửa ấm từ dưới-trước (ống lửa ở mép sân khấu), mạnh dần theo Hype
    float r = max(dot(n, normalize(vec3(0.35, -0.55, -0.75))), 0.0);
    float side = max(dot(n, normalize(vec3(0.8, 0.1, 0.3))), 0.0);
    float fire = (0.25 + 0.9 * smoothstep(0.35, 1.0, uHype)) * (1.0 + 0.6 * uFire) * (0.85 + 0.25 * uPulse);
    float low = clamp(1.0 - vY / 14.0, 0.25, 1.0); // dưới ấm
    col = base * (uAmb + uKey * (0.25 + 1.05 * floor(k * 4.0 + 0.5) / 4.0))
        + uRim * base * (0.5 + 0.5 * length(base)) * (r * 1.6 + side * 0.35) * fire * low
        + uRim * 0.06 * r * fire * low;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export interface FacetMat { mat: THREE.ShaderMaterial; tex: THREE.Texture | null; dispose(): void }

/** Vật liệu đẽo phẳng dùng chung uniform world (uHype, uPulse) → vật tĩnh vẫn ấm lên theo Hype. */
export function facetMaterial(uniforms: Uniforms, opts: { atlas?: boolean; fog?: boolean; side?: THREE.Side } = {}): FacetMat {
  const P = R();
  const tex = opts.atlas ? makeAtlas() : null;
  const fog = opts.fog ?? true;
  const u: Uniforms = {
    ...(fog ? THREE.UniformsUtils.clone(THREE.UniformsLib.fog) : {}),
    uHype: uniforms.uHype ?? { value: 0 }, uPulse: uniforms.uPulse ?? { value: 0 },
    uFire: { value: 0 }, uAtlas: { value: tex },
    uKey: { value: toColor(P.arc[500]) }, uRim: { value: toColor(P.flame[500]) }, uAmb: { value: toColor(P.coal[100]).multiplyScalar(1.6) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: FACET_VERT, fragmentShader: FACET_FRAG, fog, side: opts.side ?? THREE.DoubleSide });
  return { mat, tex, dispose() { mat.dispose(); tex?.dispose(); } };
}

const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Atlas 4×4 ô 256 px: lưới thép, sọc cảnh báo, tấm đinh tán, sao stencil, tia sét, mặt loa, lưới ampli, vòng cảnh báo, chữ A–H. */
export function makeAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const P = R();
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S * 4;
  const g = cv.getContext('2d')!;
  const cell = (i: number, fn: () => void) => { g.save(); g.translate((i % 4) * S, Math.floor(i / 4) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(); g.restore(); };
  const plate = (c = '#d8d8d8') => {
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.12; g.fillStyle = '#000';
    for (let y = 0; y < S; y += 3) g.fillRect(0, y + ((y * 7) % 5), S, 1); // xước
    g.globalAlpha = 1;
  };
  const rivetRing = () => { g.fillStyle = '#f4f4f4'; for (const [x, y] of [[14, 14], [S - 14, 14], [14, S - 14], [S - 14, S - 14], [S / 2, 14], [S / 2, S - 14], [14, S / 2], [S - 14, S / 2]]) { g.beginPath(); g.arc(x!, y!, 5, 0, 7); g.fill(); } };
  const starPath = (cx: number, cy: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath();
  };
  // 0 lưới thép (grating): khung sáng, lỗ tối
  cell(CELL.grating, () => {
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#cfcfcf';
    for (let x = 0; x < S; x += 16) g.fillRect(x, 0, 4, S);
    for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 3);
  });
  // 1 sọc cảnh báo lửa/than
  cell(CELL.hazard, () => {
    g.fillStyle = '#141414'; g.fillRect(0, 0, S, S);
    g.fillStyle = hx(P.flame[500]);
    for (let x = -S; x < S * 2; x += 64) { g.beginPath(); g.moveTo(x, S); g.lineTo(x + 32, S); g.lineTo(x + 32 + S, 0); g.lineTo(x + S, 0); g.fill(); }
  });
  // 2 tấm thép đinh tán
  cell(CELL.plate, () => { plate('#c8c8c8'); g.strokeStyle = '#555'; g.lineWidth = 3; g.strokeRect(3, 3, S - 6, S - 6); rivetRing(); });
  // 3 sao stencil trên tấm thép
  cell(CELL.star, () => {
    plate('#b8b8b8'); rivetRing();
    starPath(S / 2, S / 2 + 8, S * 0.4); g.fillStyle = '#ffffff'; g.fill();
    g.fillStyle = '#b8b8b8'; g.fillRect(S / 2 - 3, 30, 6, S - 60); // cầu stencil
  });
  // 4 tia sét stencil
  cell(CELL.bolt, () => {
    plate('#a8a8a8'); rivetRing();
    g.fillStyle = hx(P.white[500]); g.beginPath();
    for (const [x, y] of BOLT_PTS) g.lineTo(S / 2 + x * S * 0.85, S / 2 - y * S * 0.85);
    g.fill();
  });
  // 5 mặt loa: 2 nón loa (vòng đen + củ chrome) trên lưới đen
  cell(CELL.cone, () => {
    g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#3b3b3b'; g.fillRect(8, 8, S - 16, S - 16);
    for (const cx of [S * 0.27, S * 0.73]) {
      g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(cx, S / 2, S * 0.22, 0, 7); g.fill();
      g.fillStyle = '#101010'; g.beginPath(); g.arc(cx, S / 2, S * 0.19, 0, 7); g.fill();
      g.fillStyle = '#262626'; g.beginPath(); g.arc(cx, S / 2, S * 0.12, 0, 7); g.fill();
      g.fillStyle = '#c8c8c8'; g.beginPath(); g.arc(cx, S / 2, S * 0.045, 0, 7); g.fill();
    }
  });
  // 6 lưới ampli
  cell(CELL.grille, () => {
    g.fillStyle = '#202020'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#3a3a3a'; for (let y = 6; y < S; y += 8) for (let x = 6; x < S; x += 8) g.fillRect(x + ((y / 8) % 2) * 4, y, 3, 3);
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, S, 10); g.fillRect(0, S - 10, S, 10);
  });
  // 7 vòng cảnh báo (B-stage)
  cell(CELL.hazRing, () => {
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, S, S);
    g.save(); g.translate(S / 2, S / 2);
    for (let i = 0; i < 24; i++) {
      g.fillStyle = i % 2 ? '#151515' : hx(P.flame[500]);
      g.beginPath(); g.arc(0, 0, S * 0.5, (i / 24) * 7 * 0.8976, ((i + 1) / 24) * 6.2832); g.arc(0, 0, S * 0.42, ((i + 1) / 24) * 6.2832, (i / 24) * 6.2832, true); g.fill();
    }
    g.restore();
  });
  // 8..15 chữ khu stencil
  for (let i = 0; i < 8; i++) cell(CELL.letter(i), () => {
    plate('#9a9a9a'); rivetRing();
    g.fillStyle = '#ffffff'; g.font = '900 190px "Arial Narrow", "Roboto Condensed", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(S, 0); g.scale(-1, 1); g.fillText('ABCDEFGH'[i]!, S / 2, S / 2 + 10); g.restore();
    g.fillStyle = '#9a9a9a'; g.fillRect(S / 2 - 3, 0, 6, S);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Đặt lại PRNG jitter (mỗi lần dựng ra hình như nhau). */
export function resetJitter(s = 1) { seed = s; }
