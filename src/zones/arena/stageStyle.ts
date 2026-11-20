// Kẹo đêm — công cụ dựng kiến trúc sân khấu: vật liệu "đồ chơi" 2 bậc (tự chứa, không cần đèn), bộ dựng hình bo tròn
// gộp vertex-colour (không tăng draw call) và vài đoạn GLSL dùng chung (tim, sao, hộp bo).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BEVEL_MIN, INK, PAL, glShadow, hypeColors, mixHex, smoothstep, themed, toColor } from '../../world/style';

// ───────── uniform dùng chung cho mọi vật liệu toy (đèn viền theo Hype) ─────────
const shared = {
  uRim: { value: new THREE.Color() },
  uRimK: { value: 0.35 },
  uInk: { value: toColor(INK) },
};
const rimTmp = new THREE.Color();
/** Cập nhật màu rim theo Hype (rẻ; gọi mỗi frame từ bất kỳ module nào). */
export function updateToyHype(hype: number): void {
  const h = hypeColors(hype).primary;
  const hex = mixHex(PAL.cream[300], ((h[0] * 255) << 16) | ((h[1] * 255) << 8) | (h[2] * 255), 0.7);
  toColor(hex, rimTmp);
  shared.uRim.value.copy(rimTmp);
  shared.uRimK.value = 0.35 + 0.15 * smoothstep(0.7, 0.9, hype);
}
themed(() => { toColor(INK, shared.uInk.value); updateToyHype(0.3); });

const TOY_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aTrim;
varying vec3 vCol; varying float vTrim; varying vec3 vN; varying vec3 vV; varying vec3 vWN;
void main(){
  vCol = color; vTrim = aTrim;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vWN = normalize(mat3(modelMatrix) * normal);
  vV = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const TOY_FRAG = () => /* glsl */ `
uniform vec3 uRim; uniform float uRimK; uniform vec3 uInk;
varying vec3 vCol; varying float vTrim; varying vec3 vN; varying vec3 vV; varying vec3 vWN;
#include <common>
#include <fog_pars_fragment>
void main(){
  vec3 n = normalize(vWN);
  float d = dot(n, normalize(vec3(0.35, 0.8, 0.4)));
  float lit = smoothstep(-0.02, 0.18, d);              // ngưỡng mềm đạo cụ ~8–12%
  vec3 sh = vCol * ${glShadow([0.6, 0.52, 0.92])} + ${glShadow([0.015, 0.0, 0.05])}; // bóng dịch về tím (chibi) / theo phong cách
  vec3 c = mix(sh, vCol, lit);
  c = mix(c, vec3(1.0, 0.96, 0.9), smoothstep(0.93, 0.97, d) * 0.22); // đốm highlight kem
  float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 4.0);
  c += uRim * rim * uRimK * 0.7 * lit;
  c = mix(c, vCol * 1.35 + 0.05, vTrim * 0.7);       // trim phát sáng
  float ink = smoothstep(0.20, 0.07, ndv) * (1.0 - vTrim);
  c = mix(c, uInk, ink * 0.8);                         // viền mực rẻ (fresnel)
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export interface ToyMaterial { mat: THREE.ShaderMaterial; dispose(): void }
/** Vật liệu toy 2 bậc: cần attribute color (rgb) + aTrim (0/1). Dùng chung uniform rim/ink theo Hype. */
export function createToyMaterial(): ToyMaterial {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uRim: shared.uRim, uRimK: shared.uRimK, uInk: shared.uInk }]),
    vertexShader: TOY_VERT,
    fragmentShader: TOY_FRAG(),
    vertexColors: true,
    fog: true,
  });
  // UniformsUtils.merge clone → trỏ lại về uniform dùng chung
  mat.uniforms.uRim = shared.uRim; mat.uniforms.uRimK = shared.uRimK; mat.uniforms.uInk = shared.uInk;
  return { mat, dispose: () => mat.dispose() };
}

// ───────── bộ dựng hình gộp ─────────
const UP = new THREE.Vector3(0, 1, 0);
const _o = new THREE.Object3D();

export interface PartOpts { r?: number; trim?: boolean; rx?: number; ry?: number; rz?: number; m?: THREE.Matrix4 }

/** Gom nhiều hình (màu theo đỉnh, cờ trim) thành 1 geometry. */
export class Toy {
  readonly parts: THREE.BufferGeometry[] = [];
  private tc = new THREE.Color();

  add(g: THREE.BufferGeometry, hex: number, trim = false, m?: THREE.Matrix4): this {
    const h = g.index ? g.toNonIndexed() : g;
    if (h !== g) g.dispose();
    if (m) h.applyMatrix4(m);
    h.deleteAttribute('uv');
    const n = h.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    toColor(hex, this.tc);
    for (let i = 0; i < n; i++) { col[i * 3] = this.tc.r; col[i * 3 + 1] = this.tc.g; col[i * 3 + 2] = this.tc.b; }
    h.setAttribute('color', new THREE.BufferAttribute(col, 3));
    h.setAttribute('aTrim', new THREE.BufferAttribute(new Float32Array(n).fill(trim ? 1 : 0), 1));
    this.parts.push(h);
    return this;
  }
  private xf(x: number, y: number, z: number, o: PartOpts = {}, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
    _o.position.set(x, y, z); _o.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0); _o.scale.set(sx, sy, sz); _o.updateMatrix();
    const m = _o.matrix.clone();
    return o.m ? o.m.clone().multiply(m) : m;
  }
  /** Hộp bo tròn; bán kính mặc định ≈ 16% cạnh ngắn nhất (≥ BEVEL_MIN), tối đa nửa cạnh ngắn. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, hex: number, o: PartOpts = {}): this {
    const mn = Math.min(w, h, d);
    const r = Math.min(mn * 0.5, o.r ?? Math.max(mn * (BEVEL_MIN + 0.04), 0.01));
    return this.add(new RoundedBoxGeometry(w, h, d, 2, r), hex, o.trim, this.xf(x, y, z, o));
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, hex: number, o: PartOpts = {}, seg = 12): this {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), hex, o.trim, this.xf(x, y, z, o));
  }
  sphere(r: number, x: number, y: number, z: number, hex: number, o: PartOpts = {}, sx = 1, sy = 1, sz = 1): this {
    return this.add(new THREE.SphereGeometry(r, 12, 8), hex, o.trim, this.xf(x, y, z, o, sx, sy, sz));
  }
  /** Ống tròn đầu bo (capsule) nối a→b, đường kính dia. */
  tube(a: THREE.Vector3, b: THREE.Vector3, dia: number, hex: number, o: PartOpts = {}): this {
    const len = a.distanceTo(b);
    if (len < 1e-4) return this;
    const r = dia / 2;
    const g = len > 2.2 * r ? new THREE.CapsuleGeometry(r, len - 2 * r, 3, 10) : new THREE.SphereGeometry(r, 10, 8);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(g, hex, o.trim, m);
  }
  /** Ống có đai sọc: thân `body`, đai `stripe` dài `band` cách nhau `gap`. */
  tubeBands(a: THREE.Vector3, b: THREE.Vector3, dia: number, body: number, stripe: number, band = 0.22, gap = 0.9): this {
    this.tube(a, b, dia, body);
    const len = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    for (let s = gap * 0.55; s < len - band * 0.6; s += gap) {
      const p = a.clone().addScaledVector(dir, s);
      this.add(new THREE.CylinderGeometry(dia * 0.55, dia * 0.55, band, 10), stripe, false, new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
    }
    return this;
  }
  /** Ống sọc kẹo xen kẽ c1/c2 (đoạn dài `seg`). */
  candyTube(a: THREE.Vector3, b: THREE.Vector3, dia: number, c1: number, c2: number, seg = 0.45): this {
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / seg));
    const dir = b.clone().sub(a);
    for (let i = 0; i < n; i++) {
      const p0 = a.clone().addScaledVector(dir, i / n), p1 = a.clone().addScaledVector(dir, (i + 1) / n);
      this.tube(p0, p1, dia, i & 1 ? c2 : c1);
    }
    return this;
  }
  /** Ngôi sao 5 cánh tròn đầu nằm trong mặt phẳng XY (hướng ra +Z). */
  star(R: number, depth: number, x: number, y: number, z: number, hex: number, o: PartOpts = {}): this {
    return this.add(starGeo(R, depth), hex, o.trim, this.xf(x, y, z, o));
  }
  heart(S: number, depth: number, x: number, y: number, z: number, hex: number, o: PartOpts = {}): this {
    return this.add(heartGeo(S, depth), hex, o.trim, this.xf(x, y, z, o));
  }
  /** Nơ: 2 cánh cầu dẹt + nút tròn (mặt hướng +Z). */
  bow(s: number, x: number, y: number, z: number, hex: number, knot: number, o: PartOpts = {}): this {
    for (const sg of [-1, 1]) {
      this.add(new THREE.SphereGeometry(1, 12, 8), hex, o.trim, this.xf(x, y, z, o).multiply(new THREE.Matrix4().compose(
        new THREE.Vector3(sg * s * 0.62, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sg * 0.35)), new THREE.Vector3(s * 0.62, s * 0.4, s * 0.28))));
    }
    return this.sphere(s * 0.26, x, y, z, knot, o, 1, 1, 0.9);
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    return g;
  }
}

// ───────── hình phẳng bo tròn ─────────
/** Đa giác với góc bo tròn (cornerFrac = tỉ lệ cạnh được bo). */
export function roundedPoly(pts: [number, number][], cornerFrac = 0.22): THREE.Shape {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!, a = pts[(i + n - 1) % n]!, b = pts[(i + 1) % n]!;
    const p0: [number, number] = [p[0] + (a[0] - p[0]) * cornerFrac, p[1] + (a[1] - p[1]) * cornerFrac];
    const p1: [number, number] = [p[0] + (b[0] - p[0]) * cornerFrac, p[1] + (b[1] - p[1]) * cornerFrac];
    if (i === 0) s.moveTo(p0[0], p0[1]); else s.lineTo(p0[0], p0[1]);
    s.quadraticCurveTo(p[0], p[1], p1[0], p1[1]);
  }
  s.closePath();
  return s;
}
export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const x = -w / 2, y = -h / 2, s = new THREE.Shape();
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function extrudeCentered(shape: THREE.Shape, depth: number, bevel: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}
/** Tấm chữ nhật bo góc (r) dày `d`, mặt hướng ±Z, bo cạnh `bevel`. */
export function slabGeo(w: number, h: number, d: number, r: number, bevel = Math.min(d * 0.3, 0.1)): THREE.BufferGeometry {
  return extrudeCentered(roundedRectShape(w - 2 * bevel, h - 2 * bevel, Math.max(0.01, r - bevel)), d, bevel);
}
export function starGeo(R: number, depth: number): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i & 1 ? R * 0.52 : R;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  // hạ nhẹ tâm để sao cân giữa
  return extrudeCentered(roundedPoly(pts, 0.28), depth, Math.min(depth * 0.3, R * 0.08));
}
export function heartGeo(S: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const Y = (y: number) => 0.95 - y; // lật để thùy tròn ở trên, mũi nhọn (bo) ở dưới
  s.moveTo(0.25, Y(0.25));
  s.bezierCurveTo(0.25, Y(0.25), 0.2, Y(0), 0, Y(0));
  s.bezierCurveTo(-0.3, Y(0), -0.3, Y(0.35), -0.3, Y(0.35));
  s.bezierCurveTo(-0.3, Y(0.55), -0.1, Y(0.77), 0.25, Y(0.95));
  s.bezierCurveTo(0.6, Y(0.77), 0.8, Y(0.55), 0.8, Y(0.35));
  s.bezierCurveTo(0.8, Y(0.35), 0.8, Y(0), 0.5, Y(0));
  s.bezierCurveTo(0.35, Y(0), 0.25, Y(0.25), 0.25, Y(0.25));
  const g = extrudeCentered(s, depth / S, Math.min((depth / S) * 0.3, 0.05));
  g.scale(S, S, S);
  g.translate(-0.25 * S, -0.475 * S, 0);
  return g;
}

// ───────── GLSL dùng chung ─────────
export const GLSL_SHAPES = /* glsl */ `
float sdRoundRect(vec2 p, vec2 hs, float r){ vec2 d = abs(p) - hs + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float sdHeart(vec2 p){
  vec2 q = vec2(p.x, p.y - 0.5) * 1.2;
  vec2 r = vec2(q.x + q.y, q.y - q.x) * 0.70711;
  vec2 dd = abs(r) - vec2(0.35);
  float sq = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0);
  float c1 = length(q - vec2(-0.247, 0.247)) - 0.35;
  float c2 = length(q - vec2(0.247, 0.247)) - 0.35;
  return min(sq, min(c1, c2)) / 1.2;
}
float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float sdStar5(vec2 p, float r, float rf){
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float hash11(float n){ return fract(sin(n * 91.3) * 437.58); }
`;

/** Màu hype dạng [r,g,b] sRGB thô (cho shader tự xuất, không qua chuyển không gian màu). */
export const hypeRaw = hypeColors;

/** Nướng bóng 2 bậc vào vertex colour (cho mesh MeshBasic đổi màu theo Hype); bỏ aTrim. */
export function bakeToonShade(g: THREE.BufferGeometry, lo = 0.62): THREE.BufferGeometry {
  const n = g.getAttribute('normal');
  const arr = new Float32Array(n.count * 3);
  const L = new THREE.Vector3(0.35, 0.8, 0.4).normalize();
  for (let i = 0; i < n.count; i++) {
    const d = n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z;
    const k = d > 0.12 ? 1 : d > -0.05 ? 0.5 + (0.5 * (d + 0.05)) / 0.17 + lo * 0 : lo;
    const s = Math.max(lo, Math.min(1, k));
    arr[i * 3] = s * (d > 0.12 ? 1 : 0.9); arr[i * 3 + 1] = s * (d > 0.12 ? 1 : 0.82); arr[i * 3 + 2] = s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('aTrim');
  return g;
}

/** Khung vành bo tròn (có lỗ), mặt hướng ±Z. */
export function ringGeo(w: number, h: number, border: number, r: number, d: number): THREE.BufferGeometry {
  const sh = roundedRectShape(w, h, r);
  sh.holes.push(roundedRectShape(w - 2 * border, h - 2 * border, Math.max(0.05, r - border)));
  return extrudeCentered(sh, d, Math.min(d * 0.3, border * 0.3));
}
