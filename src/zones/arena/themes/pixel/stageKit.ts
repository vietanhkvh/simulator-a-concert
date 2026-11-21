// "Đêm Sao Điểm Ảnh" — bộ dựng hình gộp cho sân khấu khung tranh (không có `builders`: file phụ trợ).
// Vật liệu PIXEL: màu phẳng theo bảng 31 màu, tô sáng 3 bậc cứng (sáng / thân / bóng lùi về lam), không gradient mượt;
// atlas canvas 128 px (ô 16 px, lấy mẫu nearest) vẽ tay từng điểm ảnh: ván gỗ, chuỗi hạt vàng 4 px, vệt cọ, hoa thị,
// huy hiệu sao, toan, bảng pha màu, hoa hướng dương, hai bức tranh nhỏ. Viền mực 1 texel: mesh mặt sau đẩy 1 px theo
// pháp tuyến trong không gian màn hình (theo cỡ đích thấp `viewHeightPx`). Kênh w của màu: 0 tô sáng · 1 phẳng (tự sáng)
// · 2 tô sáng × atlas · 3 phẳng × atlas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RAMPS, getTheme, toColor } from '../../../../world/style';
import { viewHeightPx } from '../../../../world/shared/viewport';

/** Ramp pixel đọc tại thời điểm gọi (token đổi tại chỗ khi đổi phong cách). */
export const R = () => {
  const t = getTheme();
  return {
    pho: RAMPS.pho!, crom: RAMPS.crom!, bach: RAMPS.bach!, son: RAMPS.son!, dat: RAMPS.dat!, tim: RAMPS.tim!, may: RAMPS.may!,
    ink: t.ink, ngoc: t.singles.ngoc ?? 0x39b6b0, sen: t.singles.sen ?? 0xe46a9a,
  };
};
export type PixelPal = ReturnType<typeof R>;

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const _o = new THREE.Object3D();

/** Ô atlas (đơn vị ô 16 px; lưới 8 × 8): [cx, cy, w, h]. */
export const CELL = {
  plank: [0, 0, 1, 1], bead: [1, 0, 1, 1], stroke: [2, 0, 1, 1], facade: [3, 0, 1, 1], weave: [4, 0, 1, 1],
  star: [5, 0, 1, 1], rosette: [6, 0, 1, 1], crate: [7, 0, 1, 1],
  palette: [0, 1, 2, 2], sunflower: [2, 1, 2, 2], paintSun: [4, 1, 2, 2], paintWave: [6, 1, 2, 2],
  bucket: [0, 3, 1, 1], keys: [1, 3, 1, 1], strokeEdge: [2, 3, 1, 1], plaque: [3, 3, 2, 1],
} as const;
export type Cell = readonly [number, number, number, number];
const N_CELL = 8;

export class PKit {
  readonly parts: THREE.BufferGeometry[] = [];
  private c = new THREE.Color();
  /** mode 0 tô sáng · 1 phẳng · 2 tô sáng × atlas · 3 phẳng × atlas. uv của hình (0..1) ánh vào ô `cell`. */
  add(g: THREE.BufferGeometry, hex: number, m?: THREE.Matrix4, mode = 0, cell?: Cell): this {
    const h = g.index ? g.toNonIndexed() : g;
    if (h !== g) g.dispose();
    if (m) h.applyMatrix4(m);
    h.computeVertexNormals();
    const n = h.getAttribute('position').count;
    const col = new Float32Array(n * 4);
    toColor(hex, this.c);
    for (let i = 0; i < n; i++) { col[i * 4] = this.c.r; col[i * 4 + 1] = this.c.g; col[i * 4 + 2] = this.c.b; col[i * 4 + 3] = mode; }
    const uv = h.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const out = new Float32Array(n * 2);
    if (uv && cell) {
      const [cx, cy, cw, ch] = cell;
      const u0 = cx / N_CELL, v0 = 1 - (cy + ch) / N_CELL, du = cw / N_CELL, dv = ch / N_CELL, e = 0.25 / 128;
      for (let i = 0; i < n; i++) {
        const u = Math.min(1, Math.max(0, uv.getX(i))), v = Math.min(1, Math.max(0, uv.getY(i)));
        out[i * 2] = u0 + e + u * (du - 2 * e); out[i * 2 + 1] = v0 + e + v * (dv - 2 * e);
      }
    }
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
  /** Thanh hộp a→b tiết diện w×h. */
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
  /** Trụ ít cạnh (đọc như khối pixel) tâm (x,y,z). */
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, hex: number, seg = 8, rx = 0, rz = 0, mode = 0): this {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), hex, this.xf(x, y, z, rx, 0, rz), mode);
  }
  /** Tấm đứng w×h tâm (x,y,z), mặt hướng -Z (về khán giả) rồi quay ry. */
  decal(w: number, h: number, x: number, y: number, z: number, cell: Cell, ry = 0, mode = 2, hex = 0xffffff): this {
    return this.add(new THREE.PlaneGeometry(w, h).rotateY(Math.PI), hex, this.xf(x, y, z, 0, ry), mode, cell);
  }
  /** Tấm nằm (mặt trên) w×d, quay ry. */
  floor(w: number, d: number, x: number, y: number, z: number, cell: Cell, ry = 0, mode = 2, hex = 0xffffff): this {
    return this.add(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), hex, this.xf(x, y, z, 0, ry), mode, cell);
  }
  /** Tứ giác a,b,c,d với uv (u0,v0)…(u1,v1). */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, hex: number, mode = 0, cell?: Cell, uvs: [number, number, number, number] = [0, 0, 1, 1]): this {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()], 3));
    const [u0, v0, u1, v1] = uvs;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
    return this.add(g, hex, undefined, mode, cell);
  }
  /** Sao 5 cánh phẳng (mặt XY, hướng -Z) tâm (x,y,z). */
  star(r: number, x: number, y: number, z: number, hex: number, mode = 1, ry = 0, rx = 0): this {
    const pos: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2 + Math.PI / 2, a1 = ((i + 1) / 10) * Math.PI * 2 + Math.PI / 2;
      const r0 = i % 2 ? r * 0.45 : r, r1 = i % 2 ? r : r * 0.45;
      pos.push(0, 0, 0, Math.cos(a0) * r0, Math.sin(a0) * r0, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return this.add(g, hex, this.xf(x, y, z, rx, ry), mode);
  }
  /**
   * Khung tranh mạ vàng quanh ô (w × h) tâm (cx, cy), mặt trước ở z = fz hướng -Z. Bản khung t, sâu d:
   * gờ ngoài crôm-700 · băng hạt vàng (atlas) · gờ trong crôm-300 · 4 khối góc có hoa thị. seg = độ dài một ô hạt (m).
   */
  frame(w: number, h: number, t: number, d: number, cx: number, cy: number, fz: number, P: PixelPal, opts: { seg?: number; corners?: boolean; skipBottom?: boolean; back?: boolean } = {}): this {
    const seg = opts.seg ?? t * 1.2;
    const z = fz + d / 2;
    const ow = w + 2 * t, oh = h + 2 * t;
    const bars: [number, number, number, number, boolean][] = [ // x, y, len, thick, horizontal
      [cx, cy + h / 2 + t / 2, ow, t, true], [cx - w / 2 - t / 2, cy, oh, t, false], [cx + w / 2 + t / 2, cy, oh, t, false],
    ];
    if (!opts.skipBottom) bars.push([cx, cy - h / 2 - t / 2, ow, t, true]);
    for (const [x, y, len, th, hz] of bars) {
      this.box(hz ? len : th, hz ? th : len, d, x, y, z, P.crom[500]);
      // băng hạt ở giữa mặt trước: các ô dài `seg`
      const n = Math.max(1, Math.round(len / seg)), sl = len / n, bw = th * 0.5;
      for (let i = 0; i < n; i++) {
        const o = -len / 2 + sl * (i + 0.5);
        for (const [zz, ry] of opts.back ? [[fz - 0.012, 0], [fz + d + 0.012, Math.PI]] : [[fz - 0.012, 0]]) {
          if (hz) this.decal(sl, bw, x + o, y, zz!, CELL.bead, ry);
          else this.decal(sl, bw, x, y + o, zz!, CELL.bead, ry).parts[this.parts.length - 1]!.applyMatrix4(rotAbout(x, y + o, zz!));
        }
      }
      // gờ trong sáng (mép ô tranh) + gờ ngoài tối
      const lip = th * 0.16;
      if (hz) {
        const sy = y > cy ? -1 : 1;
        this.box(len - 2 * th + 2 * lip, lip, d * 0.5, x, y + sy * (th / 2 - lip / 2), fz - 0.02 + d * 0.25, P.crom[300]);
        this.box(len, lip, d * 0.4, x, y - sy * (th / 2 - lip / 2), fz - 0.03 + d * 0.2, P.crom[700]);
      } else {
        const sx = x > cx ? -1 : 1;
        this.box(lip, len - 2 * th + 2 * lip, d * 0.5, x + sx * (th / 2 - lip / 2), y, fz - 0.02 + d * 0.25, P.crom[300]);
        this.box(lip, len, d * 0.4, x - sx * (th / 2 - lip / 2), y, fz - 0.03 + d * 0.2, P.crom[700]);
      }
    }
    if (opts.corners !== false) {
      const cs = t * 1.25;
      for (const sx of [-1, 1]) for (const sy of opts.skipBottom ? [1] : [-1, 1]) {
        const x = cx + sx * (w / 2 + t / 2), y = cy + sy * (h / 2 + t / 2);
        this.box(cs, cs, d * 1.15, x, y, z - d * 0.1, P.crom[700]);
        this.decal(cs * 0.92, cs * 0.92, x, y, fz - d * 0.15 - 0.02, CELL.rosette);
        if (opts.back) this.decal(cs * 0.92, cs * 0.92, x, y, fz + d * 0.975 + 0.02, CELL.rosette, Math.PI);
      }
    }
    return this;
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    return g;
  }
}
/** Xoay 90° quanh trục Z tại (x,y,z) — băng hạt chạy dọc thanh đứng. */
function rotAbout(x: number, y: number, z: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(-x, -y, -z));
}

// ───────── vật liệu pixel ─────────
const VERT = /* glsl */ `
attribute vec4 color;
varying vec4 vCol; varying vec3 vN; varying vec2 vUv;
#include <fog_pars_vertex>
void main(){
  vCol = color; vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
uniform sampler2D uAtlas; uniform float uGlow; uniform float uFogK;
varying vec4 vCol; varying vec3 vN; varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
  vec3 base = vCol.rgb;
  float m = vCol.a;
  if (m > 1.5) base *= texture2D(uAtlas, vUv).rgb;
  vec3 col = base;
  if (m < 0.5 || (m > 1.5 && m < 2.5)) {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float d = dot(n, normalize(vec3(-0.35, 0.8, -0.5)));
    // 3 bậc cứng; bóng lùi về lam/tím (ramp dịch sắc)
    float s = d > 0.42 ? 1.0 : d > -0.05 ? 0.8 : 0.62; // mặt trước (hướng khán giả) = bậc sáng
    col = base * s * mix(vec3(1.0), vec3(0.8, 0.86, 1.18), (1.0 - s) * 1.6);
  } else {
    col = base * uGlow;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #ifdef USE_FOG
    // sương theo bậc (4 mức) và nhẹ hơn cảnh chung: khung vàng vẫn đọc ra vàng ở xa
    #ifdef FOG_EXP2
      float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogF = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    fogF = floor(fogF * uFogK * 4.0 + 0.5) / 4.0;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogF);
  #endif
}`;
const OUT_VERT = /* glsl */ `
uniform float uPx;
#include <fog_pars_vertex>
void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec4 c = projectionMatrix * mvPosition;
  vec4 c2 = projectionMatrix * (mvPosition + vec4(normalize(normalMatrix * normal) * 0.2, 0.0));
  vec2 d = c2.xy / max(c2.w, 1e-3) - c.xy / max(c.w, 1e-3);
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  if (dot(d, d) > 1e-10) {
    d = normalize(d * vec2(aspect, 1.0));
    c.xy += d * vec2(1.0 / aspect, 1.0) * uPx * c.w;
  }
  gl_Position = c;
  #include <fog_vertex>
}`;
const OUT_FRAG = /* glsl */ `
uniform vec3 uInk; uniform float uFogK;
#include <fog_pars_fragment>
void main(){
  gl_FragColor = vec4(uInk, 1.0);
  #include <colorspace_fragment>
  #ifdef USE_FOG
    // sương theo bậc (4 mức) và nhẹ hơn cảnh chung: khung vàng vẫn đọc ra vàng ở xa
    #ifdef FOG_EXP2
      float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogF = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    fogF = floor(fogF * uFogK * 4.0 + 0.5) / 4.0;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogF);
  #endif
}`;

export interface PixelMat { mat: THREE.ShaderMaterial; tex: THREE.Texture | null; dispose(): void }

export function pixelMaterial(opts: { atlas?: THREE.Texture | null; fog?: boolean; side?: THREE.Side } = {}): PixelMat {
  const fog = opts.fog ?? true;
  const u = {
    ...(fog ? THREE.UniformsUtils.clone(THREE.UniformsLib.fog) : {}),
    uAtlas: { value: opts.atlas ?? null }, uGlow: { value: 1 }, uFogK: { value: 0.55 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, fog, side: opts.side ?? THREE.DoubleSide });
  return { mat, tex: opts.atlas ?? null, dispose() { mat.dispose(); } };
}

/** Viền mực 1 texel (mặt sau đẩy 1 px màn hình). Trả mesh dùng chung geometry; nhớ dispose material. */
export function inkOutline(geo: THREE.BufferGeometry, fog = true): { mesh: THREE.Mesh; dispose(): void } {
  const P = R();
  const u = { ...(fog ? THREE.UniformsUtils.clone(THREE.UniformsLib.fog) : {}), uPx: { value: 2 / 240 }, uInk: { value: toColor(P.ink) }, uFogK: { value: 0.55 } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: OUT_VERT, fragmentShader: OUT_FRAG, fog, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.onBeforeRender = () => { u.uPx.value = 2 / Math.max(120, viewHeightPx()); };
  return { mesh, dispose() { mat.dispose(); } };
}

// ───────── atlas vẽ tay ─────────
const hx = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

/** Atlas 128 × 128 (ô 16 px), nearest. Mỗi điểm ảnh vẽ bằng fillRect nguyên — không khử răng cưa. */
export function makeAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const P = R();
  const S = 16, cv = document.createElement('canvas');
  cv.width = cv.height = S * N_CELL;
  const g = cv.getContext('2d')!;
  let ox = 0, oy = 0;
  const at = (c: Cell) => { ox = c[0] * S; oy = c[1] * S; };
  const px = (x: number, y: number, col: number, w = 1, h = 1) => { g.fillStyle = hx(col); g.fillRect(ox + x, oy + y, w, h); };
  const fill = (c: Cell, col: number) => { at(c); px(0, 0, col, c[2] * S, c[3] * S); };
  const disc = (cx: number, cy: number, r: number, col: number) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) px(x, y, col);
  };
  // ván gỗ (sàn): 4 tấm dọc, mạch tối, thớ sáng lệch
  fill(CELL.plank, P.dat[500]);
  for (let i = 0; i < 4; i++) {
    px(i * 4 + 3, 0, P.dat[700], 1, 16);
    const j = (i * 5) % 16;
    px(i * 4 + 1, j, P.dat[300], 1, 3);
    px(i * 4, (j + 9) % 16, P.dat[700], 1, 1);
  }
  px(0, 15, P.dat[700], 3, 1); px(8, 7, P.dat[700], 3, 1);
  // chuỗi hạt vàng 4 px
  fill(CELL.bead, P.crom[500]);
  px(0, 0, P.crom[700], 16, 2); px(0, 14, P.crom[700], 16, 2); px(0, 2, P.crom[300], 16, 1);
  for (let i = 0; i < 4; i++) {
    const x = i * 4;
    px(x + 1, 5, P.crom[300], 2, 1); px(x, 6, P.crom[300], 1, 3); px(x + 1, 6, P.crom[100], 1, 1);
    px(x + 1, 7, P.crom[500], 2, 2); px(x + 3, 7, P.crom[700], 1, 3); px(x + 1, 10, P.crom[700], 2, 1);
  }
  px(0, 12, P.crom[300], 16, 1);
  // vệt cọ vàng (dọc theo v): sợi lông cọ sáng/tối chạy dài, đầu vệt so le
  fill(CELL.stroke, P.crom[500]);
  const lanes = [P.crom[300], P.crom[500], P.crom[700], P.crom[300], P.crom[100], P.crom[500], P.crom[300], P.crom[700]];
  for (let i = 0; i < 16; i++) {
    const c = lanes[(i * 3) % lanes.length]!;
    const y0 = (i * 7) % 16, l = 5 + ((i * 5) % 7);
    px(i, y0, c, 1, Math.min(l, 16 - y0));
    if (y0 + l > 16) px(i, 0, c, 1, y0 + l - 16);
  }
  // mép vệt cọ (dùng cho mép runway): lông cọ tơi ra
  // (u = 0 liền với thân vệt, u = 1 là đầu lông cọ so le trên nền gỗ tối)
  fill(CELL.strokeEdge, P.dat[700]);
  for (let y = 0; y < 16; y++) px(0, y, [P.crom[500], P.crom[300], P.crom[700]][(y * 5) % 3]!, 6 + ((y * 7) % 9), 1);
  // mặt tiền sân khấu: ô tím chiều + viền crôm-700
  fill(CELL.facade, P.tim[700]);
  px(0, 0, P.crom[700], 16, 1); px(0, 15, P.ink, 16, 1); px(0, 0, P.crom[700], 1, 16); px(15, 0, P.ink, 1, 16);
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (((x + y) & 1) === 0 && Math.abs(x - 7.5) + Math.abs(y - 7.5) < 5) px(x, y, P.tim[500]);
  px(7, 7, P.crom[500], 2, 2);
  // toan (vải bố): kem + caro mây
  fill(CELL.weave, P.crom[100]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x + y * 3) % 4) === 0) px(x, y, P.may[300]);
  // huy hiệu sao: nền lam Phổ, sao crôm
  fill(CELL.star, P.pho[500]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x + 0.5 - 8, dy = 8.5 - (y + 0.5);
    const a = Math.atan2(dx, dy), r = Math.hypot(dx, dy);
    const k = Math.PI * 2 / 5, m = Math.abs(((a % k) + k) % k - k / 2);
    const rr = 7 * (0.42 + 0.58 * Math.pow(m / (k / 2), 1.6)); // a = 0 (lên trên) là đỉnh cánh
    if (r < rr) px(x, y, r < rr - 1.5 ? P.crom[500] : P.crom[700]);
  }
  px(7, 4, P.crom[100], 1, 2);
  px(0, 0, P.crom[700], 16, 1); px(0, 15, P.crom[700], 16, 1); px(0, 0, P.crom[700], 1, 16); px(15, 0, P.crom[700], 1, 16);
  // hoa thị (khối góc): 8 cánh crôm-300 quanh nhuỵ son
  fill(CELL.rosette, P.crom[700]);
  px(1, 1, P.crom[500], 14, 14);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    disc(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 2.1, i & 1 ? P.crom[300] : P.crom[100]);
  }
  disc(8, 8, 2.4, P.crom[700]); px(7, 7, P.crom[100], 1, 1); // (son chỉ dùng khi Hype ≥ 80 %)
  px(1, 14, P.crom[700], 14, 1); px(14, 1, P.crom[700], 1, 14);
  // thùng gỗ / loa ampli: ván + nẹp crôm-700
  at(CELL.crate);
  px(0, 0, P.dat[700], 16, 16); px(1, 1, P.dat[500], 14, 14);
  for (let y = 4; y < 16; y += 5) px(1, y, P.dat[700], 14, 1);
  px(2, 2, P.dat[300], 5, 1); px(9, 7, P.dat[300], 4, 1); px(3, 12, P.dat[300], 6, 1);
  px(0, 0, P.crom[700], 2, 2); px(14, 0, P.crom[700], 2, 2); px(0, 14, P.crom[700], 2, 2); px(14, 14, P.crom[700], 2, 2);
  // thùng sơn: thiếc mây + băng nhãn + vệt sơn rỉ
  at(CELL.bucket);
  px(0, 0, P.may[300], 16, 16); px(0, 0, P.may[100], 16, 2); px(0, 14, P.may[500], 16, 2);
  px(0, 6, P.sen, 16, 5); px(0, 6, P.tim[300], 16, 1);
  for (const [x, l] of [[2, 5], [6, 3], [9, 7], [13, 4]] as const) px(x, 2, P.crom[500], 2, l);
  // phím đàn: trắng kem + phím đen mực
  at(CELL.keys);
  px(0, 0, P.crom[100], 16, 16);
  for (let x = 1; x < 16; x += 2) px(x, 0, P.may[300], 1, 16);
  for (const x of [1, 3, 7, 9, 11, 15]) px(x, 0, P.ink, 1, 10);
  // nhãn bảo tàng (plaque) 32 × 16: crôm + viền + dòng chữ giả
  at(CELL.plaque);
  px(0, 0, P.crom[700], 32, 16); px(1, 1, P.crom[500], 30, 14); px(1, 1, P.crom[300], 30, 1);
  for (const [x, y, w] of [[4, 5, 24], [6, 9, 20]] as const) for (let i = 0; i < w; i += 2) if ((i * 7) % 5 !== 0) px(x + i, y, P.ink, 1, 2);
  // bảng pha màu (B-stage) 32 × 32: gỗ đất-300, viền đất-500, lỗ ngón cái, 8 đốm sơn
  at(CELL.palette);
  px(0, 0, P.pho[700], 32, 32);
  disc(16, 16, 16, P.dat[500]); disc(16, 16, 15, P.dat[300]);
  for (let i = 0; i < 6; i++) px(5 + i * 4, 20 + (i % 3), P.dat[100], 3, 1); // thớ gỗ
  disc(21, 22, 3.2, P.dat[500]); disc(21, 22, 2.4, P.ink); // lỗ ngón cái
  const blobs = [P.sen, P.crom[500], P.ngoc, P.pho[300], P.bach[300], P.tim[300], P.crom[100], P.dat[100]];
  blobs.forEach((c, i) => {
    const a = -2.6 + (i / 8) * 4.4, x = 16 + Math.cos(a) * 10.5, y = 16 + Math.sin(a) * 10.5;
    disc(x, y, 2.6, c); px(Math.round(x - 1), Math.round(y - 1), P.crom[100]);
  });
  disc(12, 13, 2.2, P.sen); disc(13.5, 14.5, 1.6, P.crom[300]); // vệt trộn giữa
  // hướng dương (bục giữa) 32 × 32: cánh crôm răng cưa, nhuỵ đất chấm
  at(CELL.sunflower);
  px(0, 0, P.pho[700], 32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = x + 0.5 - 16, dy = y + 0.5 - 16, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const pet = 12.5 + 3 * Math.abs(Math.cos(a * 7));
    if (r < 7) px(x, y, ((x + y) & 1) && r > 3 ? P.dat[700] : P.dat[500]);
    else if (r < 8) px(x, y, P.dat[700]);
    else if (r < pet - 1.2) px(x, y, Math.cos(a * 14) > 0.3 ? P.crom[300] : P.crom[500]);
    else if (r < pet) px(x, y, P.crom[700]);
    else if (r < 16) px(x, y, P.bach[500]);
  }
  // tranh nhỏ "Hướng dương" (Van Gogh, công cộng) 32 × 32: nền vàng, bình, 5 bông
  at(CELL.paintSun);
  px(0, 0, P.crom[300], 32, 20); px(0, 20, P.crom[500], 32, 12); px(0, 20, P.crom[700], 32, 1);
  px(11, 18, P.crom[700], 10, 10); px(12, 19, P.crom[500], 8, 8); px(12, 22, P.pho[300], 8, 1);
  for (const [x, y, r] of [[10, 10, 3.6], [19, 7, 3.8], [24, 13, 3.2], [15, 14, 3], [6, 16, 2.8]] as const) {
    disc(x, y, r, P.crom[700]); disc(x, y, r - 0.9, P.crom[500]); disc(x, y, r * 0.45, P.dat[500]);
    px(Math.round(x), Math.round(y + r), P.bach[300], 1, 3);
  }
  // tranh nhỏ "Sóng lừng ngoài khơi Kanagawa" (Hokusai, công cộng) 32 × 32
  at(CELL.paintWave);
  px(0, 0, P.crom[100], 32, 32); px(0, 0, P.may[300], 32, 6);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const crest = 9 + 9 * Math.exp(-((x - 10) ** 2) / 40) - x * 0.05;
    const wave = y > 32 - crest - 6 * Math.sin(x * 0.18);
    if (y > 24 - Math.sin(x * 0.5) * 1.5) px(x, y, ((x + y) % 3) ? P.pho[500] : P.pho[300]);
    else if (wave && x < 22) px(x, y, ((x * 3 + y) % 5) === 0 ? P.crom[100] : (y < 18 ? P.pho[300] : P.pho[500]));
  }
  for (const [x, y] of [[4, 9], [7, 7], [10, 7], [13, 8], [15, 10], [6, 11]] as const) px(x, y, P.crom[100], 2, 2); // bọt sóng móng vuốt
  px(24, 18, P.may[500], 5, 3); px(25, 17, P.may[500], 3, 1); px(26, 16, P.crom[100], 1, 1); // núi Phú Sĩ nhỏ
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** Bayer 4×4 (GLSL) trên lưới điểm ảnh đích: 0..15/16. */
export const GLSL_BAYER = /* glsl */ `
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
`;
