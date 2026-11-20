// Khung nhân vật chibi dùng chung (ca sĩ, ban nhạc; sau này quay phim / phi công).
// STYLE_GUIDE mục 3: 2,3 đầu, không cổ, tay 1 đoạn + bàn tay cầu, chân ngắn, mặt là CanvasTexture atlas 2×2,
// khối tròn (cầu / capsule / lathe), viền ink bằng inverted hull, tô bóng đồ chơi 2 bậc + đốm highlight + rim theo Hype.
// Nhiều nhân vật gộp vào MỘT ChibiBatch → 3 draw call (thân, mặt, viền) cho cả nhóm. Không có đèn thật: hướng sáng cố định.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  EMISSIVE, INK, OUTLINE, PAL, PAL_HEX, INK_HEX, SQUASH, TOY, hypeColors, rgbToColor, shadowOf, smoothstep,
} from '../../world/style';

export type HairStyle = 'bob' | 'short' | 'spiky' | 'pony' | 'buns' | 'long';
export type Accessory = 'none' | 'bow' | 'cap' | 'headphones' | 'glasses';
export type HeldItem = 'none' | 'mic' | 'stick';
export type Expr = 'smile' | 'sing' | 'wink' | 'excited';
const EXPR_CELL: Record<Expr, [number, number]> = { smile: [0, 0], sing: [1, 0], wink: [0, 1], excited: [1, 1] };

export interface ChibiLook {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  /** Áo (thân + tay áo), quần, giày, trim (phát sáng nhẹ: cổ tay, thắt lưng). */
  top: number;
  bottom: number;
  shoe: number;
  trim: number;
  accessory?: Accessory;
  accColor?: number;
  motif?: 'star' | 'heart' | 'none';
  motifColor?: number;
  skirt?: boolean;
  heldL?: HeldItem;
  heldR?: HeldItem;
  itemColor?: number;
}

export interface ChibiChar {
  index: number;
  look: ChibiLook;
  /** Vị trí gốc (chân) lúc dựng. */
  base: THREE.Vector3;
  root: THREE.Bone; body: THREE.Bone; upper: THREE.Bone; head: THREE.Bone;
  legL: THREE.Bone; legR: THREE.Bone; shL: THREE.Bone; shR: THREE.Bone; handL: THREE.Bone; handR: THREE.Bone;
}

// ───────── Tỉ lệ (khung gốc nhân vật: chân ở y=0, nhìn -Z, +X = tay phải nhân vật) — tổng cao ≈ 1,6 m ─────────
export const RIG = {
  H: 1.6,
  hipY: 0.4, hipX: 0.1, legR: 0.088,
  waistY: 0.42,
  headPivotY: 0.84, headY: 1.15, headRx: 0.37, headRy: 0.34, headRz: 0.35,
  shY: 0.79, shX: 0.235, arm: 0.33, armR: 0.072, handR: 0.088,
  torsoR: 0.25,
} as const;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const KEY = new THREE.Vector3(-0.3, 0.9, -0.55).normalize(); // đèn chính cố định: trên-trước-trái (phía khán giả)

// Mặt: mảnh cầu ôm đầu; ánh xạ toạ độ mặt (m, nhìn từ trước: x sang phải người xem, y lên) → ô atlas.
const FACE_A = 0.95; // nửa góc ngang (rad)
const FACE_T0 = 0.95, FACE_T1 = 2.25; // góc cực (rad, từ đỉnh)
const FACE_K = 1.012;
const CELL = 256;
const EYE_C = -0.035, EYE_HH = 0.082, EYE_X = 0.135, EYE_HW = 0.056;
const MOUTH_C = -0.155, MOUTH_HH = 0.06;
function faceUV(xm: number, ym: number): [number, number] {
  const rx = RIG.headRx * FACE_K, ry = RIG.headRy * FACE_K;
  const th = Math.acos(THREE.MathUtils.clamp(ym / ry, -1, 1));
  const ph = Math.asin(THREE.MathUtils.clamp(xm / (rx * Math.sin(th)), -1, 1));
  return [(ph + FACE_A) / (2 * FACE_A), (th - FACE_T0) / (FACE_T1 - FACE_T0)];
}
const fpx = (xm: number, ym: number): [number, number] => { const [u, v] = faceUV(xm, ym); return [u * CELL, v * CELL]; };

/** Atlas 2×2 dùng chung (512 px: 4 ô 256 px — rõ ở góc máy cận). */
let atlasTex: THREE.CanvasTexture | null = null;
let atlasRefs = 0;
function faceAtlas(): THREE.CanvasTexture {
  atlasRefs++;
  if (atlasTex) return atlasTex;
  const c = document.createElement('canvas');
  c.width = c.height = CELL * 2;
  const g = c.getContext('2d')!;
  const ell = (cx: number, cy: number, hw: number, hh: number) => {
    const [x, y] = fpx(cx, cy);
    const [x0] = fpx(cx - hw, cy), [x1] = fpx(cx + hw, cy);
    const [, y0] = fpx(cx, cy + hh), [, y1] = fpx(cx, cy - hh);
    g.beginPath();
    g.ellipse(x, y, Math.max(1, (x1 - x0) / 2), Math.max(1, (y1 - y0) / 2), 0, 0, Math.PI * 2);
  };
  const eye = (sx: number, big = 1) => {
    const ex = sx * EYE_X;
    g.fillStyle = INK_HEX;
    ell(ex, EYE_C, EYE_HW * big, EYE_HH * big); g.fill();
    g.fillStyle = PAL_HEX.grape[700];
    ell(ex, EYE_C - 0.03 * big, EYE_HW * 0.62 * big, EYE_HH * 0.4 * big); g.fill();
    g.fillStyle = PAL_HEX.cream[100];
    ell(ex - 0.018, EYE_C + 0.03 * big, 0.022 * big, 0.026 * big); g.fill();
    ell(ex + 0.022, EYE_C - 0.035 * big, 0.01 * big, 0.011 * big); g.fill();
  };
  const arcEye = (sx: number) => { // ^ cười tít
    const ex = sx * EYE_X;
    const [a0x, a0y] = fpx(ex - EYE_HW, EYE_C - 0.02), [mx, my] = fpx(ex, EYE_C + 0.05), [a1x, a1y] = fpx(ex + EYE_HW, EYE_C - 0.02);
    g.strokeStyle = INK_HEX; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a0x, a0y); g.quadraticCurveTo(mx, my - (a0y - my) * 0.6, a1x, a1y); g.stroke();
  };
  const cheeks = () => {
    g.fillStyle = PAL_HEX.berry[300];
    g.globalAlpha = 0.85;
    for (const s of [-1, 1]) { ell(s * 0.215, -0.115, 0.05, 0.03); g.fill(); }
    g.globalAlpha = 1;
  };
  const smileMouth = () => {
    const [ax, ay] = fpx(-0.04, MOUTH_C + 0.012), [bx, by] = fpx(0.04, MOUTH_C + 0.012), [mx, my] = fpx(0, MOUTH_C - 0.03);
    g.strokeStyle = INK_HEX; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, bx, by); g.stroke();
  };
  const openMouth = (hw: number, hh: number, dShape: boolean) => {
    g.fillStyle = PAL_HEX.berry[700];
    if (dShape) {
      const [ax, ay] = fpx(-hw, MOUTH_C + hh * 0.6), [bx] = fpx(hw, MOUTH_C + hh * 0.6), [, by] = fpx(0, MOUTH_C - hh * 1.3);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, ay); g.quadraticCurveTo(bx, by, (ax + bx) / 2, by); g.quadraticCurveTo(ax, by, ax, ay); g.fill();
      g.strokeStyle = INK_HEX; g.lineWidth = 4; g.stroke();
      g.fillStyle = PAL_HEX.berry[300];
      ell(0, MOUTH_C - hh * 0.75, hw * 0.5, hh * 0.35); g.fill();
    } else {
      ell(0, MOUTH_C, hw, hh); g.fill();
      g.strokeStyle = INK_HEX; g.lineWidth = 4; g.stroke();
      g.fillStyle = PAL_HEX.berry[300];
      ell(0, MOUTH_C - hh * 0.45, hw * 0.6, hh * 0.4); g.fill();
    }
  };
  const cells: [Expr, () => void][] = [
    ['smile', () => { eye(-1); eye(1); cheeks(); smileMouth(); }],
    ['sing', () => { eye(-1); eye(1); cheeks(); openMouth(0.034, 0.05, false); }],
    ['wink', () => { eye(-1); arcEye(1); cheeks(); openMouth(0.045, 0.028, true); }],
    ['excited', () => { eye(-1, 1.1); eye(1, 1.1); cheeks(); openMouth(0.055, 0.035, true); }],
  ];
  for (const [name, draw] of cells) {
    const [col, row] = EXPR_CELL[name];
    g.save(); g.translate(col * CELL, row * CELL);
    g.beginPath(); g.rect(2, 2, CELL - 4, CELL - 4); g.clip();
    draw();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  atlasTex = t;
  return t;
}
function releaseAtlas() { if (--atlasRefs <= 0 && atlasTex) { atlasTex.dispose(); atlasTex = null; atlasRefs = 0; } }

// ───────── Shader ─────────
const BODY_VS = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute vec3 aCol;
attribute vec3 aShade;
attribute float aEmit;
varying vec3 vCol; varying vec3 vShade; varying float vEmit; varying vec3 vWN; varying vec3 vWP;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  #include <fog_vertex>
  vCol = aCol; vShade = aShade; vEmit = aEmit;
  vWN = normalize(mat3(modelMatrix) * objectNormal);
  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
}`;
const BODY_FS = /* glsl */ `
uniform vec3 uKey; uniform vec3 uRim; uniform float uRimK; uniform float uHiK; uniform vec3 uHi; uniform float uPulse; uniform float uTrimK;
varying vec3 vCol; varying vec3 vShade; varying float vEmit; varying vec3 vWN; varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 n = normalize(vWN);
  vec3 v = normalize(cameraPosition - vWP);
  float ndl = dot(n, uKey);
  float lit = smoothstep(-0.09, 0.09, ndl);           // 2 bậc, ngưỡng mềm ~15%
  vec3 c = mix(vShade, vCol, lit);   // bóng: shadowOf (tối hơn, ngả lavender, không ngả đỏ/cam)
  float hi = smoothstep(0.985, 0.992, dot(n, normalize(uKey + v)));   // đốm highlight cố định
  c = mix(c, uHi, hi * uHiK * lit);
  float rim = smoothstep(0.62, 0.9, 1.0 - max(dot(n, v), 0.0));
  c += uRim * rim * uRimK;
  c = mix(c, vCol * (1.0 + uTrimK * (0.55 + 0.45 * uPulse)), vEmit);   // trim phát sáng, không đổ bóng
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const FACE_VS = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute float aChar;
uniform vec4 uExpr[NCHAR];
varying vec2 vUv; varying vec4 vEx;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  #include <fog_vertex>
  vUv = uv;
  vEx = uExpr[int(aChar + 0.5)];
}`;
const FACE_FS = /* glsl */ `
uniform sampler2D uMap; uniform vec4 uBands; uniform float uDim;
varying vec2 vUv; varying vec4 vEx;
#include <common>
#include <fog_pars_fragment>
// nén một dải dọc quanh tâm c (nửa cao h) theo hệ số k (1 = nguyên, 0 = khép thành vạch)
float band(float y, float c, float h, float k, inout float cut) {
  if (abs(y - c) > h) return y;
  float y2 = c + (y - c) / max(k, 0.04);
  if (abs(y2 - c) > h) cut = 1.0;
  return y2;
}
void main() {
  float y = 1.0 - vUv.y;           // 0 = mép trên của ô
  float cut = 0.0;
  y = band(y, uBands.x, uBands.y, 1.0 - vEx.z * 0.94, cut);
  y = band(y, uBands.z, uBands.w, vEx.w, cut);
  vec2 uv = vec2((vEx.x + vUv.x) * 0.5, 1.0 - (vEx.y + y) * 0.5);
  vec4 t = texture2D(uMap, uv);
  if (cut > 0.5) t.a = 0.0;
  if (t.a < 0.02) discard;
  gl_FragColor = vec4(t.rgb * uDim, t.a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const OUT_VS = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
uniform vec2 uRes; uniform float uW; uniform float uCharH; uniform vec2 uPx; uniform float uCullPx;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  #include <fog_vertex>
  vec3 vn = normalize(normalMatrix * objectNormal);
  vec2 d = (projectionMatrix * vec4(vn, 0.0)).xy;
  float dl = length(d);
  d = dl > 1e-5 ? d / dl : vec2(0.0);
  float s = projectionMatrix[1][1] * uRes.y * 0.5 / max(gl_Position.w, 1e-3);
  float px = clamp(uW * s, uPx.x, uPx.y);
  if (uCharH * s < uCullPx) px = 0.0;
  gl_Position.xy += d * px * 2.0 / uRes * gl_Position.w;
}`;
const OUT_FS = /* glsl */ `
uniform vec3 uInk;
#include <common>
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uInk, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ───────── Hình khối ─────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
/** Biến đổi hình học tại chỗ: scale → xoay (Euler XYZ) → dịch. */
export function xf(g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  return g.applyMatrix4(_m);
}
export const sphere = (r = 1, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
export const capsule = (r: number, len: number, seg = 12) => new THREE.CapsuleGeometry(r, len, 4, seg);
export const lathe = (pts: [number, number][], seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
export const torus = (r: number, tube: number, arc = Math.PI * 2, rs = 8, ts = 20) => new THREE.TorusGeometry(r, tube, rs, ts, arc);
/** Sao 5 cánh bo tròn (mặt nhìn +Z của shape → xoay khi dùng). */
export function starGeo(r: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.5 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.6, bevelSize: r * 0.16, bevelSegments: 2, curveSegments: 4 });
  return g.translate(0, 0, -depth / 2);
}
/** Tim mập. */
export function heartGeo(r: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -r);
  s.bezierCurveTo(r * 0.9, -r * 0.2, r * 1.2, r * 0.75, r * 0.5, r * 0.8);
  s.bezierCurveTo(r * 0.15, r * 0.82, 0, r * 0.5, 0, r * 0.4);
  s.bezierCurveTo(0, r * 0.5, -r * 0.15, r * 0.82, -r * 0.5, r * 0.8);
  s.bezierCurveTo(-r * 1.2, r * 0.75, -r * 0.9, -r * 0.2, 0, -r);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.6, bevelSize: r * 0.14, bevelSegments: 2, curveSegments: 8 });
  return g.translate(0, 0, -depth / 2);
}

interface Part { geo: THREE.BufferGeometry; bone: number; color: number; emit: number }

export interface ChibiBatchOpts {
  /** Số nhân vật tối đa (kích thước mảng uniform biểu cảm). */
  maxChars?: number;
  name?: string;
}

/**
 * Lô nhân vật chibi: addChar() nhiều lần → part() thêm khối riêng (nhạc cụ, ghế) → build(scene).
 * Toàn bộ dùng 1 Skeleton; 3 draw call: thân (toy shader), mặt (atlas), viền (inverted hull).
 */
export class ChibiBatch {
  readonly chars: ChibiChar[] = [];
  readonly bones: THREE.Bone[] = [];
  private rests: THREE.Vector3[] = [];
  private parts: Part[] = [];
  private faces: THREE.BufferGeometry[] = [];
  private disposables: { dispose(): void }[] = [];
  private exprU: THREE.Vector4[] = [];
  private blink: { next: number; t: number }[] = [];
  private uBody: Record<string, THREE.IUniform> = {};
  private uOut: Record<string, THREE.IUniform> = {};
  readonly group = new THREE.Group();
  meshes: THREE.SkinnedMesh[] = [];
  private maxChars: number;
  private scene: THREE.Scene | null = null;
  private tmpRgb = new THREE.Color();

  constructor(opts: ChibiBatchOpts = {}) {
    this.maxChars = opts.maxChars ?? 8;
    this.group.name = opts.name ?? 'chibi';
  }

  private bone(parent: THREE.Bone | null, base: THREE.Vector3, x: number, y: number, z: number): THREE.Bone {
    const b = new THREE.Bone();
    const pr = parent ? this.rests[parent.userData.i as number]! : null;
    const ax = base.x + x, ay = base.y + y, az = base.z + z;
    b.position.set(ax - (pr ? pr.x : 0), ay - (pr ? pr.y : 0), az - (pr ? pr.z : 0));
    if (parent) parent.add(b); else this.group.add(b);
    b.userData.i = this.bones.length;
    this.bones.push(b);
    this.rests.push(new THREE.Vector3(ax, ay, az));
    return b;
  }

  /** Thêm khối (toạ độ khung gốc nhân vật, lúc dựng) gắn cứng vào bone. emit: 0..1 (trim phát sáng). */
  part(c: ChibiChar, bone: THREE.Bone, geo: THREE.BufferGeometry, color: number, emit = 0): void {
    geo.translate(c.base.x, c.base.y, c.base.z);
    this.parts.push({ geo, bone: bone.userData.i as number, color, emit });
  }

  addChar(look: ChibiLook, x: number, y: number, z: number): ChibiChar {
    if (this.chars.length >= this.maxChars) throw new Error('ChibiBatch: quá số nhân vật');
    const base = new THREE.Vector3(x, y, z);
    const R = RIG;
    const root = this.bone(null, base, 0, 0, 0);
    const body = this.bone(root, base, 0, 0, 0);
    const legL = this.bone(body, base, -R.hipX, R.hipY, 0);
    const legR = this.bone(body, base, R.hipX, R.hipY, 0);
    const upper = this.bone(body, base, 0, R.waistY, 0);
    const head = this.bone(upper, base, 0, R.headPivotY, 0);
    const shL = this.bone(upper, base, -R.shX, R.shY, 0);
    const shR = this.bone(upper, base, R.shX, R.shY, 0);
    const handL = this.bone(upper, base, -R.shX, R.shY - R.arm, 0);
    const handR = this.bone(upper, base, R.shX, R.shY - R.arm, 0);
    const c: ChibiChar = { index: this.chars.length, look, base, root, body, upper, head, legL, legR, shL, shR, handL, handR };
    this.chars.push(c);
    this.exprU.push(new THREE.Vector4(0, 0, 0, 1));
    this.blink.push({ next: 1.5 + Math.random() * 3, t: -1 });
    this.buildBody(c);
    return c;
  }

  private buildBody(c: ChibiChar): void {
    const L = c.look, R = RIG;
    const P = (bone: THREE.Bone, g: THREE.BufferGeometry, col: number, emit = 0) => this.part(c, bone, g, col, emit);
    // chân + giày
    for (const [s, leg] of [[-1, c.legL], [1, c.legR]] as [number, THREE.Bone][]) {
      P(leg, xf(capsule(R.legR, 0.2), s * R.hipX, 0.25, 0), L.bottom);
      P(leg, xf(sphere(0.1, 16, 10), s * R.hipX, 0.065, -0.035, 1.08, 0.66, 1.42), L.shoe);
    }
    // thân hình đậu: hông (quần) + áo
    P(c.body, xf(lathe([[0, 0.33], [0.15, 0.345], [0.22, 0.38], [0.245, 0.43], [0.245, 0.5], [0, 0.5]]), 0, 0, 0, 1, 1, 0.86), L.skirt ? L.top : L.bottom);
    if (L.skirt) P(c.body, xf(lathe([[0.2, 0.52], [0.28, 0.42], [0.31, 0.35], [0.29, 0.33], [0, 0.33]]), 0, 0, 0, 1, 1, 0.9), L.top);
    P(c.upper, xf(lathe([[0, 0.44], [0.243, 0.46], [R.torsoR, 0.56], [0.24, 0.68], [0.215, 0.78], [0.16, 0.86], [0, 0.89]]), 0, 0, 0, 1, 1, 0.86), L.top);
    P(c.upper, xf(torus(0.245, 0.026, Math.PI * 2, 8, 24), 0, 0.49, 0, 1, 1, 0.87, Math.PI / 2), L.trim, 1); // thắt lưng sọc trim
    // motif ngực
    if (L.motif === 'star') P(c.upper, xf(starGeo(0.085, 0.03), 0, 0.66, -0.205, 1, 1, 1, 0.12, Math.PI), L.motifColor ?? PAL.honey[500], 0.5);
    if (L.motif === 'heart') P(c.upper, xf(heartGeo(0.075, 0.03), 0, 0.66, -0.205, 1, 1, 1, 0.12, Math.PI), L.motifColor ?? PAL.berry[500], 0.5);
    // tay 1 đoạn + bàn tay cầu + cổ tay trim
    for (const [s, sh, hand, held] of [[-1, c.shL, c.handL, L.heldL], [1, c.shR, c.handR, L.heldR]] as [number, THREE.Bone, THREE.Bone, HeldItem | undefined][]) {
      P(sh, xf(capsule(R.armR, R.arm - 0.08), s * R.shX, R.shY - R.arm / 2 + 0.01, 0), L.top);
      P(sh, xf(torus(R.armR * 0.95, 0.022, Math.PI * 2, 6, 16), s * R.shX, R.shY - R.arm + 0.075, 0, 1, 1, 1, Math.PI / 2), L.trim, 1);
      P(hand, xf(sphere(R.handR, 14, 10), s * R.shX, R.shY - R.arm, 0), L.skin);
      const hx = s * R.shX, hy = R.shY - R.arm;
      if (held === 'mic') { // micro mập honey: cán đi theo -Y của bàn tay, đầu to
        const ic = L.itemColor ?? PAL.honey[500];
        P(hand, xf(capsule(0.036, 0.13, 10), hx, hy - 0.05, 0), PAL.honey[700]);
        P(hand, xf(sphere(0.078, 16, 12), hx, hy - 0.2, 0), ic);
        P(hand, xf(torus(0.07, 0.016, Math.PI * 2, 6, 18), hx, hy - 0.165, 0, 1, 1, 1, Math.PI / 2), PAL.soda[500], 1);
      } else if (held === 'stick') { // dùi trống tròn đầu
        P(hand, xf(capsule(0.02, 0.36, 6), hx, hy - 0.16, 0), PAL.cream[500]);
        P(hand, xf(sphere(0.034, 10, 8), hx, hy - 0.36, 0), L.itemColor ?? PAL.honey[500]);
      }
    }
    // đầu
    const hy = R.headY;
    P(c.head, xf(sphere(1, 30, 22), 0, hy, 0, R.headRx, R.headRy, R.headRz), L.skin);
    this.buildHair(c, hy);
    this.buildAccessory(c, hy);
    // mảnh mặt (UV = ô atlas); nằm ngay trên da đầu
    const fg = new THREE.SphereGeometry(1, 24, 18, -Math.PI / 2 - FACE_A, FACE_A * 2, FACE_T0, FACE_T1 - FACE_T0);
    xf(fg, 0, hy, 0, R.headRx * FACE_K, R.headRy * FACE_K, R.headRz * FACE_K);
    fg.translate(c.base.x, c.base.y, c.base.z);
    const n = fg.getAttribute('position').count;
    fg.deleteAttribute('normal');
    fg.setAttribute('aChar', new THREE.BufferAttribute(new Float32Array(n).fill(c.index), 1));
    this.skin(fg, c.head.userData.i as number);
    this.faces.push(fg);
  }

  private buildHair(c: ChibiChar, hy: number): void {
    const L = c.look, R = RIG, col = L.hair;
    const P = (g: THREE.BufferGeometry) => this.part(c, c.head, g, col);
    const k = 1.07;
    const cap = (thetaLen: number) => new THREE.SphereGeometry(1, 30, 14, 0, Math.PI * 2, 0, thetaLen);
    P(xf(cap(1.08), 0, hy, 0, R.headRx * k, R.headRy * k, R.headRz * k));
    // tóc sau gáy: nửa sau (+Z), dài theo kiểu
    const backLen = L.hairStyle === 'long' ? 2.5 : L.hairStyle === 'bob' ? 2.15 : L.hairStyle === 'short' || L.hairStyle === 'spiky' ? 1.75 : 1.95;
    const bob = L.hairStyle === 'bob' || L.hairStyle === 'long';
    const ph0 = bob ? -0.3 : 0.2;
    P(xf(new THREE.SphereGeometry(1, 24, 14, ph0, Math.PI - 2 * ph0, 0, backLen), 0, hy, 0, R.headRx * (bob ? 1.1 : 1.06), R.headRy * 1.065, R.headRz * 1.075));
    if (L.hairStyle === 'long') { // tóc mai hai bên má
      for (const s of [-1, 1]) P(xf(sphere(1, 14, 10), s * 0.33, hy - 0.12, 0.02, 0.085, 0.2, 0.16, 0, 0, s * 0.12));
    }
    // mái lệch phồng phía trước
    P(xf(sphere(1, 16, 10), -0.12, hy + 0.24, -0.2, 0.2, 0.1, 0.12, 0.5, 0, 0.35));
    P(xf(sphere(1, 16, 10), 0.13, hy + 0.25, -0.19, 0.17, 0.09, 0.11, 0.5, 0, -0.3));
    if (L.hairStyle === 'spiky') {
      for (const [x, z, rz, rx] of [[-0.2, 0, 0.7, 0], [-0.08, -0.08, 0.25, -0.3], [0.08, -0.06, -0.25, -0.3], [0.2, 0.02, -0.7, 0], [0, 0.14, 0, 0.5]] as [number, number, number, number][]) {
        P(xf(sphere(1, 10, 8), x, hy + 0.36, z, 0.075, 0.13, 0.075, rx, 0, rz));
      }
    }
    if (L.hairStyle === 'pony') {
      P(xf(sphere(0.07, 10, 8), 0, hy + 0.12, 0.38));
      P(xf(sphere(1, 14, 10), 0, hy - 0.08, 0.44, 0.1, 0.2, 0.1, -0.35));
    }
    if (L.hairStyle === 'buns') for (const s of [-1, 1]) P(xf(sphere(0.115, 14, 10), s * 0.24, hy + 0.27, 0.06));
  }

  private buildAccessory(c: ChibiChar, hy: number): void {
    const L = c.look, R = RIG;
    const ac = L.accColor ?? MOTIF_BOW;
    const P = (g: THREE.BufferGeometry, col = ac, emit = 0) => this.part(c, c.head, g, col, emit);
    switch (L.accessory) {
      case 'bow': { // nơ soda trên đỉnh lệch phải người xem
        const bx = -0.19, by = hy + 0.33, bz = -0.1, tilt = -0.3;
        for (const s of [-1, 1]) {
          const ox = s * 0.1 * Math.cos(tilt), oy = s * 0.1 * Math.sin(tilt);
          P(xf(new THREE.ConeGeometry(0.075, 0.17, 14, 1), bx + ox, by + oy, bz, 1, 1, 0.55, 0, 0, tilt + (s > 0 ? Math.PI / 2 : -Math.PI / 2)));
          P(xf(sphere(1, 12, 8), bx + ox * 1.45, by + oy * 1.45, bz, 0.055, 0.075, 0.042, 0, 0, tilt));
        }
        P(xf(sphere(0.045, 10, 8), bx, by, bz - 0.01), PAL.soda[700]);
        break;
      }
      case 'cap': {
        P(xf(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, 1.25), 0, hy + 0.02, 0, R.headRx * 1.1, R.headRy * 1.12, R.headRz * 1.1));
        P(xf(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 20), 0, hy + 0.17, -0.34, 1.05, 1, 0.9, -0.18), L.trim);
        P(xf(sphere(0.035, 8, 6), 0, hy + 0.41, 0), L.trim);
        break;
      }
      case 'headphones': {
        P(xf(torus(0.405, 0.032, Math.PI, 8, 24), 0, hy + 0.02, 0, 1, 0.98, 1));
        for (const s of [-1, 1]) {
          P(xf(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 18), s * 0.39, hy - 0.02, 0, 1, 1, 1, 0, 0, Math.PI / 2));
          P(xf(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16), s * 0.435, hy - 0.02, 0, 1, 1, 1, 0, 0, Math.PI / 2), L.trim, 1);
        }
        break;
      }
      case 'glasses': {
        for (const s of [-1, 1]) P(xf(torus(0.083, 0.015, Math.PI * 2, 6, 20), s * EYE_X, hy + EYE_C, -0.345, 1, 1.05, 1, 0, s * 0.35), INK);
        P(xf(capsule(0.012, 0.06, 6), 0, hy + EYE_C + 0.015, -0.365, 1, 1, 1, 0, 0, Math.PI / 2), INK);
        break;
      }
      default: break;
    }
  }

  private skin(g: THREE.BufferGeometry, bone: number): void {
    const n = g.getAttribute('position').count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  }

  /** Gộp + tạo 3 SkinnedMesh (thân, mặt, viền) và thêm vào scene. */
  build(scene: THREE.Scene): void {
    this.scene = scene;
    const col = new THREE.Color(), sh = new THREE.Color();
    const geos: THREE.BufferGeometry[] = [];
    for (const p of this.parts) {
      let g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      if (g !== p.geo) p.geo.dispose();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.clearGroups();
      const n = g.getAttribute('position').count;
      const a = new Float32Array(n * 3), b = new Float32Array(n * 3), e = new Float32Array(n).fill(p.emit);
      col.setHex(p.color); sh.setHex(shadowOf(p.color));
      for (let i = 0; i < n; i++) { a.set([col.r, col.g, col.b], i * 3); b.set([sh.r, sh.g, sh.b], i * 3); }
      g.setAttribute('aCol', new THREE.BufferAttribute(a, 3));
      g.setAttribute('aShade', new THREE.BufferAttribute(b, 3));
      g.setAttribute('aEmit', new THREE.BufferAttribute(e, 1));
      this.skin(g, p.bone);
      geos.push(g);
    }
    const bodyGeo = mergeGeometries(geos, false)!;
    geos.forEach((g) => g.dispose());
    const faceGeo = mergeGeometries(this.faces, false)!;
    this.faces.forEach((g) => g.dispose());
    this.disposables.push(bodyGeo, faceGeo);

    const fogU = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    this.uBody = {
      ...fogU,
      uKey: { value: KEY.clone() },
      uRim: { value: new THREE.Color() },
      uRimK: { value: TOY.rim },
      uHiK: { value: TOY.hi },
      uHi: { value: new THREE.Color(PAL.cream[100]) },
      uPulse: { value: 0 },
      uTrimK: { value: EMISSIVE.trim * 0.5 },
    };
    const bodyMat = new THREE.ShaderMaterial({ uniforms: this.uBody, vertexShader: BODY_VS, fragmentShader: BODY_FS, fog: true });
    const atlas = faceAtlas();
    const [, ec] = faceUV(0, EYE_C), [, et] = faceUV(0, EYE_C + EYE_HH + 0.01);
    const [, mc] = faceUV(0, MOUTH_C), [, mt] = faceUV(0, MOUTH_C + MOUTH_HH);
    const faceMat = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uMap: { value: atlas },
        uExpr: { value: this.exprU },
        uBands: { value: new THREE.Vector4(ec, ec - et, mc, mc - mt) },
        uDim: { value: 1 },
      },
      defines: { NCHAR: this.maxChars },
      vertexShader: FACE_VS, fragmentShader: FACE_FS, fog: true, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    while (this.exprU.length < this.maxChars) this.exprU.push(new THREE.Vector4(0, 0, 0, 1));
    this.uOut = {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uRes: { value: new THREE.Vector2(1280, 720) },
      uW: { value: OUTLINE.width * RIG.H },
      uCharH: { value: RIG.H },
      uPx: { value: new THREE.Vector2(OUTLINE.minPx, OUTLINE.maxPx) },
      uCullPx: { value: OUTLINE.cullPx },
      uInk: { value: new THREE.Color(INK) },
    };
    const outMat = new THREE.ShaderMaterial({ uniforms: this.uOut, vertexShader: OUT_VS, fragmentShader: OUT_FS, fog: true, side: THREE.BackSide });
    this.disposables.push(bodyMat, faceMat, outMat);

    this.group.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.bones); // inverse bind = thế đứng lúc dựng (mesh ở gốc)
    this.disposables.push(skeleton);
    const body = new THREE.SkinnedMesh(bodyGeo, bodyMat);
    const face = new THREE.SkinnedMesh(faceGeo, faceMat);
    const out = new THREE.SkinnedMesh(bodyGeo, outMat);
    body.name = this.group.name + 'Body'; face.name = this.group.name + 'Face'; out.name = this.group.name + 'Outline';
    face.renderOrder = 1;
    const res = new THREE.Vector2();
    out.onBeforeRender = (r) => { r.getDrawingBufferSize(res); (this.uOut.uRes!.value as THREE.Vector2).copy(res); };
    body.add(this.group);
    for (const m of [body, face, out]) { m.frustumCulled = false; scene.add(m); }
    body.updateMatrixWorld(true);
    for (const m of [body, face, out]) m.bind(skeleton, new THREE.Matrix4());
    this.meshes = [body, face, out];
  }

  /** Màu rim theo Hype + nhịp. */
  setHype(hype: number, pulse: number): void {
    const hc = hypeColors(hype);
    const rim = this.uBody.uRim!.value as THREE.Color;
    rgbToColor(hc.primary, rim).lerp(this.tmpRgb.setHex(PAL.cream[300]), 0.3);
    const high = hype > 0.8;
    this.uBody.uRimK!.value = high ? TOY.rimHigh : TOY.rim;
    this.uBody.uHiK!.value = high ? TOY.hiHigh : TOY.hi;
    this.uBody.uPulse!.value = pulse;
  }

  /** Biểu cảm + tự chớp mắt (dt giây) + độ mở miệng (0..1, chỉ dùng cho 'sing'). */
  setFace(c: ChibiChar, expr: Expr, dt: number, mouthOpen = 1): void {
    const b = this.blink[c.index]!;
    b.next -= dt;
    if (b.next <= 0 && b.t < 0) { b.t = 0; b.next = 3 + Math.random() * 2; }
    let blink = 0;
    if (b.t >= 0) { b.t += dt; blink = Math.sin(Math.min(1, b.t / 0.14) * Math.PI); if (b.t >= 0.14) b.t = -1; }
    const [cx, cy] = EXPR_CELL[expr];
    const eyesShut = expr === 'wink';
    this.exprU[c.index]!.set(cx, cy, eyesShut ? 0 : blink, expr === 'sing' ? THREE.MathUtils.clamp(mouthOpen, 0.25, 1) : 1);
  }

  setVisible(v: boolean): void { for (const m of this.meshes) m.visible = v; }

  dispose(): void {
    if (this.scene) for (const m of this.meshes) this.scene.remove(m);
    for (const d of this.disposables) d.dispose();
    releaseAtlas();
  }
}
const MOTIF_BOW = PAL.soda[500];

// ───────── Tư thế ─────────
const _d = new THREE.Vector3(), _t = new THREE.Vector3(), _iu = new THREE.Vector3();
const SH_LOCAL = [new THREE.Vector3(-RIG.shX, RIG.shY - RIG.waistY, 0), new THREE.Vector3(RIG.shX, RIG.shY - RIG.waistY, 0)];
/**
 * Đặt tay (side 0 = trái nhân vật -X, 1 = phải +X) hướng về điểm `target` (khung local của `upper`).
 * Tay co giãn 0,75–1,3 lần (cao su). itemDir: hướng -Y của bàn tay (đồ cầm), mặc định theo tay.
 */
export function aimArm(c: ChibiChar, side: 0 | 1, target: THREE.Vector3, itemDir?: THREE.Vector3): void {
  const sp = SH_LOCAL[side]!;
  _d.copy(target).sub(sp);
  let len = _d.length();
  if (len < 1e-4) { _d.set(0, -1, 0); len = RIG.arm; } else _d.divideScalar(len);
  len = THREE.MathUtils.clamp(len, RIG.arm * 0.75, RIG.arm * 1.3);
  const sh = side ? c.shR : c.shL, hand = side ? c.handR : c.handL;
  sh.quaternion.setFromUnitVectors(DOWN, _d);
  sh.scale.set(1, len / RIG.arm, 1);
  // hand.position là toạ độ local của upper (bone hand con trực tiếp của upper)
  hand.position.copy(sp).addScaledVector(_d, len);
  hand.quaternion.setFromUnitVectors(DOWN, itemDir ? _iu.copy(itemDir).normalize() : _d);
}
/** Như aimArm nhưng toạ độ thế giới (với tới đạo cụ cố định). Cập nhật ma trận cha trước. */
export function aimArmWorld(c: ChibiChar, side: 0 | 1, world: THREE.Vector3, itemDirWorld?: THREE.Vector3): void {
  c.upper.updateWorldMatrix(true, false);
  _t.copy(world);
  c.upper.worldToLocal(_t);
  if (itemDirWorld) {
    _q.setFromRotationMatrix(c.upper.matrixWorld).invert();
    const d = _iu.copy(itemDirWorld).applyQuaternion(_q);
    aimArm(c, side, _t, d.clone());
  } else aimArm(c, side, _t);
}
/** Tay theo hướng: out = dang ra ngoài thân, up = lên, fwd = ra trước (không cần chuẩn hoá). */
export function armDir(c: ChibiChar, side: 0 | 1, out: number, up: number, fwd: number, itemDir?: THREE.Vector3): void {
  _t.set((side ? 1 : -1) * out, up, -fwd).normalize().multiplyScalar(RIG.arm).add(SH_LOCAL[side]!);
  aimArm(c, side, _t, itemDir);
}

// ───────── Hoạt ảnh ─────────
/** Squash nhún theo phách (SQUASH.beat): trả [sx, sy]; amt 0..1. */
export function beatSquash(beat: number, amt: number): [number, number] {
  const ph = beat - Math.floor(beat);
  const k = 0.5 + 0.5 * Math.cos(ph * Math.PI * 2); // 1 tại phách (nén) → 0 giữa phách (giãn)
  const sx = THREE.MathUtils.lerp(SQUASH.beat.up[0], SQUASH.beat.down[0], k);
  const sy = THREE.MathUtils.lerp(SQUASH.beat.up[1], SQUASH.beat.down[1], k);
  return [1 + (sx - 1) * amt, 1 + (sy - 1) * amt];
}
/**
 * Cú nhảy chibi dài `beats` phách bắt đầu ở phách nguyên: nén (crouch) → giãn bay lên → tiếp đất nén.
 * u: 0..1 tiến độ trong cú nhảy; trả { y, sx, sy }.
 */
export function jumpCurve(u: number, height: number, out: { y: number; sx: number; sy: number }) {
  const J = SQUASH.jump;
  const c = 0.18, l = 0.82;
  let sx = 1, sy = 1, y = 0;
  if (u < c) { const k = Math.sin((u / c) * Math.PI); sx = 1 + (J.crouch[1] - 1) * k; sy = 1 + (J.crouch[0] - 1) * k; }
  else if (u < l) {
    const a = (u - c) / (l - c);
    y = height * 4 * a * (1 - a);
    const k = Math.max(0, 1 - a * 2.2);
    sx = 1 + (J.stretch[1] - 1) * k; sy = 1 + (J.stretch[0] - 1) * k;
  } else { const k = Math.sin(((u - l) / (1 - l)) * Math.PI); sx = 1 + (J.land[1] - 1) * k; sy = 1 + (J.land[0] - 1) * k; }
  out.y = y; out.sx = sx; out.sy = sy;
  return out;
}
/** Biểu cảm mặc định theo Hype. */
export function exprByHype(hype: number, beat: number, seed: number): Expr {
  if (hype > 0.8) return Math.floor(beat / 4 + seed) % 4 === 3 ? 'wink' : 'excited';
  if (hype > 0.4) return Math.floor(beat / 8 + seed) % 3 === 2 ? 'excited' : 'smile';
  return 'smile';
}
/** Theo dõi trễ (đầu lắc trễ 60–80 ms). */
export const lag = (cur: number, target: number, dt: number, sec = 0.07) => cur + (target - cur) * (1 - Math.exp(-dt / sec));
export { smoothstep };
