// "Đêm Sao Điểm Ảnh" — bộ dựng dùng chung của gói P5 (file phụ trợ, KHÔNG đăng ký builder).
// Mọi vật thể P5 vẽ bằng một kiểu duy nhất hợp ảnh 427×240:
//   • tô PHẲNG một màu mỗi mảng (bậc ramp của sheet E §2), bóng = MỘT bậc cứng (mặt quay xuống), không gradient;
//   • viền mực 1 TEXEL đích thấp: mesh thứ hai cùng hình học, mỗi đỉnh đẩy ra ngoài đúng `uInkPx` pixel theo hướng `aOut`
//     chiếu lên màn (mở rộng kiểu Chebyshev: ±1 px cả x lẫn y → viền đều cả cạnh dài), lùi sâu `uInkBack` m để mảng gần
//     vẫn thắng (viền xuất hiện ở silhouette và chỗ mảng chồng mảng xa);
//   • ẩn dần bằng dither Bayer 4×4 cố định theo màn hình (không alpha mượt);
//   • chuyển động: mỗi mảng thuộc một NHÓM g, đỉnh nhân `uM[g]` (CPU đặt mỗi frame, ma trận 0 = ẩn nhóm);
//     tuỳ chọn BOARD: toạ độ nhóm là toạ độ "bảng" quay về camera quanh trục X (đọc xuôi từ mắt ca sĩ lẫn máy toàn cảnh).
// Hạt (pháo, sơn bắn) = Points vuông 1–3 px, màu đổi theo bậc cứng.
import * as THREE from 'three';
import { RAMPS, getTheme, hexToRgb } from '../../../../world/style';
import { viewHeightPx } from '../../../../world/shared/viewport';

export type Ramp = Record<100 | 300 | 500 | 700, number>;
const FALLBACK: Ramp = { 100: 0xe8f1f6, 300: 0xa9cbe8, 500: 0x6b7690, 700: 0x3c4664 };
/** Ramp của sheet E (pho crom bach son dat tim may) — đọc LÚC GỌI. */
export const pr = (name: 'pho' | 'crom' | 'bach' | 'son' | 'dat' | 'tim' | 'may'): Ramp => (RAMPS[name] ?? FALLBACK) as Ramp;
/** Màu lẻ: mực, ngọc, sen. */
export const single = (k: 'ink' | 'ngoc' | 'sen'): number => {
  const t = getTheme();
  return k === 'ink' ? t.ink : t.singles[k] ?? 0x39b6b0;
};
export const gl3 = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;

export const MODE = { shaded: 0, flat: 1, fade2: 2, tex: 3, brush: 4 } as const;

export interface PartOpts {
  /** Nhóm chuyển động (chỉ số uM). */
  g?: number;
  /** 0 tô 2 bậc · 1 phẳng (phát sáng) · 2 phẳng + ẩn theo uFade2 · 3 lấy màu texture · 4 nét cọ (dải lông theo uv.y). */
  mode?: number;
  /** Tham số hiện dần: mảng chỉ hiện khi rev ≤ uRev (âm = luôn hiện). Bỏ qua nếu hình học có sẵn `aRev`. */
  rev?: number;
  /** Tâm đẩy viền (toạ độ sau m); mặc định tâm hộp bao. 'none' = không viền. */
  out?: THREE.Vector3 | 'none';
  /** Ô atlas (u0, u1, v0, v1) cho mode 3. */
  uv?: [number, number, number, number];
}

/** Gom mảng → một BufferGeometry (position, uv, aCol, aOut, aF = nhóm, mode, rev, 0). */
export class Parts {
  private list: THREE.BufferGeometry[] = [];
  add(src: THREE.BufferGeometry, color: number, m: THREE.Matrix4 | null = null, o: PartOpts = {}): this {
    const g0 = src.index ? src.toNonIndexed() : src.clone();
    if (src !== g0) src.dispose();
    if (m) g0.applyMatrix4(m);
    const pos = g0.attributes.position as THREE.BufferAttribute;
    const n = pos.count;
    if (!g0.attributes.uv) g0.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (o.uv) {
      const uv = g0.attributes.uv as THREE.BufferAttribute, [u0, u1, v0, v1] = o.uv;
      for (let i = 0; i < n; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    const c = hexToRgb(color), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set(c, i * 3);
    g0.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    if (!g0.attributes.aOut) {
      const out = new Float32Array(n * 3);
      if (o.out !== 'none') {
        let ctr = o.out as THREE.Vector3 | undefined;
        if (!ctr) { g0.computeBoundingBox(); ctr = g0.boundingBox!.getCenter(new THREE.Vector3()); }
        const v = new THREE.Vector3();
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(pos, i).sub(ctr);
          const L = v.length();
          if (L > 1e-5) v.multiplyScalar(1 / L);
          out.set([v.x, v.y, v.z], i * 3);
        }
      }
      g0.setAttribute('aOut', new THREE.BufferAttribute(out, 3));
    }
    const rev = g0.attributes.aRev as THREE.BufferAttribute | undefined;
    const f = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) f.set([o.g ?? 0, o.mode ?? 0, rev ? rev.getX(i) : o.rev ?? -1, 0], i * 4);
    g0.setAttribute('aF', new THREE.BufferAttribute(f, 4));
    for (const k of Object.keys(g0.attributes)) if (!['position', 'uv', 'aCol', 'aOut', 'aF'].includes(k)) g0.deleteAttribute(k);
    this.list.push(g0);
    return this;
  }
  build(): THREE.BufferGeometry {
    const out = mergeSimple(this.list);
    this.list.forEach((g) => g.dispose());
    this.list = [];
    return out;
  }
}

/** Gộp hình học không chỉ mục có cùng bộ thuộc tính (không cần BufferGeometryUtils). */
function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const names = ['position', 'uv', 'aCol', 'aOut', 'aF'];
  for (const nm of names) {
    const size = (list[0]!.attributes[nm] as THREE.BufferAttribute).itemSize;
    const total = list.reduce((s, g) => s + g.attributes[nm]!.count, 0);
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const g of list) { const a = g.attributes[nm] as THREE.BufferAttribute; arr.set(a.array as Float32Array, off); off += a.count * size; }
    out.setAttribute(nm, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/** Dải băng (nét cọ) dọc polyline trong mặt phẳng z = 0: aOut = pháp tuyến ngang hai mép + hai đầu; aRev = tham số dọc. */
export function ribbon(pts: THREE.Vector2[], width: (u: number) => number, revOf: (u: number) => number = (u) => u, z = 0): THREE.BufferGeometry {
  const n = pts.length;
  const P: number[] = [], O: number[] = [], RV: number[] = [], UV: number[] = [];
  const nrm = (i: number) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(n - 1, i + 1)]!;
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    return [-dy / L, dx / L, dx / L, dy / L];
  };
  for (let i = 0; i < n - 1; i++) {
    const ua = i / (n - 1), ub = (i + 1) / (n - 1);
    const [nax, nay, tax, tay] = nrm(i), [nbx, nby, tbx, tby] = nrm(i + 1);
    const wa = width(ua) / 2, wb = width(ub) / 2;
    const a = pts[i]!, b = pts[i + 1]!;
    const endA = i === 0 ? -1 : 0, endB = i + 1 === n - 1 ? 1 : 0;
    const v = [
      [a.x + nax * wa, a.y + nay * wa, nax + tax * endA, nay + tay * endA, ua, 1],
      [a.x - nax * wa, a.y - nay * wa, -nax + tax * endA, -nay + tay * endA, ua, 0],
      [b.x + nbx * wb, b.y + nby * wb, nbx + tbx * endB, nby + tby * endB, ub, 1],
      [b.x - nbx * wb, b.y - nby * wb, -nbx + tbx * endB, -nby + tby * endB, ub, 0],
    ];
    for (const k of [0, 1, 2, 2, 1, 3]) {
      const q = v[k]!;
      P.push(q[0]!, q[1]!, z); O.push(q[2]!, q[3]!, 0); RV.push(revOf(q[4]!)); UV.push(q[4]!, q[5]!);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aOut', new THREE.Float32BufferAttribute(O, 3));
  g.setAttribute('aRev', new THREE.Float32BufferAttribute(RV, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  return g;
}

/** Bảng quay về camera quanh trục X tại uC (như lacquer/steel): từ ca sĩ (nhìn −Z) hay máy toàn cảnh (nhìn +Z) đều đứng, không gương. */
const BOARD_GLSL = /* glsl */ `
uniform vec3 uC;
vec3 board(vec3 p) {
  vec3 f = cameraPosition - uC; f.x = 0.0; f = normalize(f);
  vec3 ey = normalize(vec3(0.0, 1.0, 0.0) - f * f.y);
  vec3 ex = cross(ey, f);
  return uC + ex * p.x + ey * p.y + f * p.z;
}`;
/** Cơ sở bảng nhìn từ `cam` (CPU, để tính focus). */
export function boardBasis(c: THREE.Vector3, cam: THREE.Vector3) {
  const f = new THREE.Vector3(0, cam.y - c.y, cam.z - c.z).normalize();
  const ey = new THREE.Vector3(0, 1, 0).addScaledVector(f, -f.y).normalize();
  return { ex: new THREE.Vector3().crossVectors(ey, f), ey, f };
}
/** Máy toàn cảnh của sự kiện bí mật (main.ts SECRET_CAM_HOME). */
export const FOCUS_CAM = new THREE.Vector3(0, 66, -108);

export const BAYER_GLSL = /* glsl */ `
float bayer4(vec2 fc) {
  vec2 p = mod(floor(fc), 4.0);
  float i = p.x + p.y * 4.0;
  // bảng Bayer 4×4 (0..15) theo hàng
  float b = i < 0.5 ? 0.0 : i < 1.5 ? 8.0 : i < 2.5 ? 2.0 : i < 3.5 ? 10.0 :
            i < 4.5 ? 12.0 : i < 5.5 ? 4.0 : i < 6.5 ? 14.0 : i < 7.5 ? 6.0 :
            i < 8.5 ? 3.0 : i < 9.5 ? 11.0 : i < 10.5 ? 1.0 : i < 11.5 ? 9.0 :
            i < 12.5 ? 15.0 : i < 13.5 ? 7.0 : i < 14.5 ? 13.0 : 5.0;
  return (b + 0.5) / 16.0;
}`;

const VERT = (ng: number, isBoard: boolean, ink: boolean) => /* glsl */ `
uniform mat4 uM[${ng}];
uniform float uPxH; uniform float uInkPx; uniform float uInkBack;
attribute vec3 aCol; attribute vec3 aOut; attribute vec4 aF;
varying vec3 vCol; varying vec3 vW; varying vec2 vUv; varying vec3 vF;
${isBoard ? BOARD_GLSL : ''}
vec3 toWorld(vec3 p, mat4 m) {
  vec3 q = (m * vec4(p, 1.0)).xyz;
  ${isBoard ? 'q = board(q);' : ''}
  return q;
}
void main() {
  mat4 m = uM[int(aF.x + 0.5)];
  vCol = aCol; vUv = uv; vF = aF.yzw;
  if (m[3][3] < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 w = toWorld(position, m);
  vW = w;
  vec4 vp = viewMatrix * vec4(w, 1.0);
  ${ink ? `
  vec4 c0 = projectionMatrix * vp;
  vec4 c2 = projectionMatrix * viewMatrix * vec4(toWorld(position + aOut * 0.05, m), 1.0);
  vp.xyz += normalize(vp.xyz) * uInkBack;
  vec4 c = projectionMatrix * vp;
  float H = uPxH, W = H * projectionMatrix[1][1] / projectionMatrix[0][0];
  vec2 s = (c2.xy / c2.w - c0.xy / c0.w) * vec2(W, H);
  float L = length(s);
  if (L > 1e-6 && c.w > 0.0) c.xy += clamp(s / L * 3.0, -1.0, 1.0) * (2.0 * uInkPx) / vec2(W, H) * c.w;
  gl_Position = c;` : `
  gl_Position = projectionMatrix * vp;`}
}`;

const FRAG = (ink: boolean, inkHex: number) => /* glsl */ `
uniform float uRev; uniform float uFade; uniform float uFade2; uniform sampler2D uMap; uniform vec3 uLight;
varying vec3 vCol; varying vec3 vW; varying vec2 vUv; varying vec3 vF;
${BAYER_GLSL}
void main() {
  float mode = vF.x;
  if (vF.y > uRev) discard;
  float fd = (mode > 1.5 && mode < 2.5) ? min(uFade, uFade2) : uFade;
  if (fd <= bayer4(gl_FragCoord.xy)) discard;
  ${ink ? `gl_FragColor = vec4(${gl3(inkHex)}, 1.0);` : `
  vec3 c = vCol;
  if (mode > 3.5) {
    // nét cọ: sợi lông = dải dọc theo chiều dài, mỗi dải một bậc (tối / thân / sáng), không chuyển sắc
    float b = floor(vUv.y * 7.0);
    float h = fract(sin(b * 12.9898 + floor(vUv.x * 3.0) * 0.7) * 43758.5453);
    c = h < 0.25 ? c * vec3(0.66, 0.62, 0.78) : h > 0.78 ? min(c * 1.3 + vec3(0.08, 0.06, 0.02), vec3(1.0)) : c;
  }
  else if (mode > 2.5) { vec4 tx = texture2D(uMap, vUv); if (tx.a < 0.5) discard; c = tx.rgb; }
  else if (mode < 0.5) {
    vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
    if (dot(n, uLight) < -0.05) c *= vec3(0.62, 0.66, 0.86);
  }
  gl_FragColor = vec4(c, 1.0);`}
}`;

export interface PixelUniforms {
  uM: { value: THREE.Matrix4[] };
  uPxH: { value: number }; uInkPx: { value: number }; uInkBack: { value: number };
  uRev: { value: number }; uFade: { value: number }; uFade2: { value: number };
  uMap: { value: THREE.Texture | null }; uLight: { value: THREE.Vector3 }; uC: { value: THREE.Vector3 };
  [k: string]: THREE.IUniform;
}

export interface PixelMesh {
  fill: THREE.Mesh; ink: THREE.Mesh; u: PixelUniforms;
  /** Ma trận nhóm g (ghi trực tiếp). */
  m(g: number): THREE.Matrix4;
  hide(g: number): void;
  /** Gọi mỗi frame: cập nhật cỡ pixel đích. */
  tick(): void;
  dispose(): void;
}

/** Hai mesh (tô + viền mực) dùng chung một hình học; thêm cả hai vào `parent`. */
export function makePixelMesh(geo: THREE.BufferGeometry, ng: number, parent: THREE.Object3D, o: { board?: boolean; map?: THREE.Texture | null; renderOrder?: number; inkPx?: number; inkBack?: number } = {}): PixelMesh {
  const u: PixelUniforms = {
    uM: { value: Array.from({ length: ng }, () => new THREE.Matrix4()) },
    uPxH: { value: viewHeightPx() }, uInkPx: { value: o.inkPx ?? 1 }, uInkBack: { value: o.inkBack ?? 0.6 },
    uRev: { value: 1e9 }, uFade: { value: 1 }, uFade2: { value: 1 },
    uMap: { value: o.map ?? null }, uLight: { value: new THREE.Vector3(-0.3, 0.9, 0.3).normalize() }, uC: { value: new THREE.Vector3() },
  };
  const inkHex = single('ink');
  const mk = (ink: boolean) => new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VERT(ng, !!o.board, ink), fragmentShader: FRAG(ink, inkHex), fog: false, side: THREE.DoubleSide,
  });
  const fillMat = mk(false), inkMat = mk(true);
  const fill = new THREE.Mesh(geo, fillMat), ink = new THREE.Mesh(geo, inkMat);
  fill.frustumCulled = ink.frustumCulled = false;
  fill.renderOrder = ink.renderOrder = o.renderOrder ?? 0;
  parent.add(ink, fill);
  return {
    fill, ink, u,
    m: (g) => u.uM.value[g]!,
    hide: (g) => { u.uM.value[g]!.elements.fill(0); },
    tick: () => { u.uPxH.value = viewHeightPx(); },
    dispose() {
      fill.removeFromParent(); ink.removeFromParent();
      geo.dispose(); fillMat.dispose(); inkMat.dispose();
    },
  };
}

// ───────────── Hạt vuông (Points) ─────────────
/**
 * Hạt bay đạn đạo: aP (x, y, z, t0), aV (vx, vy, vz, sống), aC0/aC1 (màu đầu/cuối — đổi CỨNG ở 55 % đời), aS (cỡ px, cản, trọng lực, nhấp).
 * uT = giây sự kiện. Hạt chưa sinh hoặc hết đời bị đẩy ra ngoài clip.
 */
const SPARK_VERT = /* glsl */ `
uniform float uT; uniform float uPxScale;
attribute vec4 aP; attribute vec4 aV; attribute vec3 aC0; attribute vec3 aC1; attribute vec4 aS;
varying vec3 vC;
void main() {
  float age = uT - aP.w;
  if (age < 0.0 || age > aV.w) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  float k = aS.y;
  float d = k > 0.0 ? (1.0 - exp(-k * age)) / k : age;
  vec3 p = aP.xyz + aV.xyz * d + vec3(0.0, -0.5 * aS.z * age * age, 0.0);
  float u = age / aV.w;
  vC = u < 0.55 ? aC0 : aC1;
  float sz = aS.x * (u < 0.8 ? 1.0 : 0.5);
  // nhấp nháy theo bậc (≤ 3 Hz): hạt có aS.w > 0 tắt nửa chu kỳ cuối đời
  if (aS.w > 0.0 && u > 0.6 && fract(age * 2.5 + aS.w) < 0.4) sz = 0.0;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = floor(max(sz * uPxScale, 0.0) + 0.5);
}`;
const SPARK_FRAG = /* glsl */ `
varying vec3 vC;
void main() { gl_FragColor = vec4(vC, 1.0); }`;

export interface Sparks {
  pts: THREE.Points;
  u: { uT: { value: number }; uPxScale: { value: number } };
  /** Ghi hạt i. */
  set(i: number, p: THREE.Vector3, t0: number, v: THREE.Vector3, life: number, c0: number, c1: number, size: number, drag: number, grav: number, blink?: number): void;
  /** Đánh dấu buffer cần tải lại. */
  commit(): void;
  readonly count: number;
  dispose(): void;
}

export function makeSparks(count: number, parent: THREE.Object3D): Sparks {
  const aP = new Float32Array(count * 4), aV = new Float32Array(count * 4), aC0 = new Float32Array(count * 3), aC1 = new Float32Array(count * 3), aS = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) aP[i * 4 + 3] = 1e9;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const attrs = { aP: new THREE.BufferAttribute(aP, 4), aV: new THREE.BufferAttribute(aV, 4), aC0: new THREE.BufferAttribute(aC0, 3), aC1: new THREE.BufferAttribute(aC1, 3), aS: new THREE.BufferAttribute(aS, 4) };
  for (const [k, a] of Object.entries(attrs)) { a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); }
  const u = { uT: { value: 0 }, uPxScale: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, fog: false, depthWrite: false, transparent: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  parent.add(pts);
  return {
    pts, u, count,
    set(i, p, t0, v, life, c0, c1, size, drag, grav, blink = 0) {
      aP.set([p.x, p.y, p.z, t0], i * 4); aV.set([v.x, v.y, v.z, life], i * 4);
      aC0.set(hexToRgb(c0), i * 3); aC1.set(hexToRgb(c1), i * 3); aS.set([size, drag, grav, blink], i * 4);
    },
    commit() { for (const a of Object.values(attrs)) a.needsUpdate = true; },
    dispose() { pts.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}

// ───────────── Tiện ích ─────────────
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const sm = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
/** Ma trận dịch + xoay Euler + tỉ lệ (tạo mới, chỉ dùng lúc dựng). */
export const TRS = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | THREE.Vector3 = 1) =>
  new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), typeof s === 'number' ? V3(s, s, s) : s);
/** Phiến phẳng dày `d` từ đa giác 2D (mặt XY, z ∈ [−d/2, d/2]). */
export function slab(pts: THREE.Vector2[], d: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: d, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  return g;
}
/** Elip (đa giác n cạnh). */
export const ellipse = (rx: number, ry: number, n = 16, cx = 0, cy = 0) =>
  Array.from({ length: n }, (_, i) => V2(cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry));
