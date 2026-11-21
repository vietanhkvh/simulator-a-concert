// Phụ trợ (không có `builders`) cho S4 "Thép & Lửa": bộ dựng hình khối phẳng mặt + shader "thép đẽo" dùng chung cho
// rồng cơ khí (secretDragon.ts) và cần cẩu cầu gương (secretUfo.ts).
// Một InstancedMesh vẽ MỌI bộ phận: hình học gộp có `aPart` (bộ phận) + `aMat` (chất liệu) mỗi đỉnh; mỗi instance có
// `aInfo = (bộ phận được vẽ, id rồng)` — đỉnh của bộ phận khác bị gom về ngoài clip ⇒ 1 draw call cho cả hai rồng.
// Tô phẳng: pháp tuyến mặt từ dFdx/dFdy (mỗi mặt một sắc + lệch ±6 % theo mặt), key lạnh `arc` từ trên-trái, rim lửa
// `flame` từ dưới, thép xước có highlight hẹp, không viền.
import * as THREE from 'three';
import { PAL, RAMPS, hexToRgb } from '../../../../world/style';

export type Ramp = Record<700 | 500 | 300 | 100, number>;
/** Đọc ramp của phong cách (gọi BÊN TRONG hàm dựng, sau applyTheme). */
export function sramp(name: string): Ramp {
  const fb: Record<string, Ramp> = { coal: PAL.night, steel: PAL.grape, arc: PAL.soda, tungsten: PAL.mint, blood: PAL.berry, ember: PAL.peach, flame: PAL.berry, whitehot: PAL.honey, paper: PAL.cream };
  return (RAMPS[name] as Ramp | undefined) ?? fb[name] ?? PAL.cream;
}
export const v3 = (hex: number) => new THREE.Vector3().fromArray(hexToRgb(hex));
export const gl3 = (hex: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)})`;
};

/** Chất liệu (aMat). */
export const M = { plate: 0, dark: 1, seam: 2, teeth: 3, eye: 4, blade: 5, chrome: 6, hazard: 7 } as const;

/** Gom tam giác không chỉ số (mỗi mặt phẳng tự có đỉnh riêng). */
export class Parts {
  pos: number[] = [];
  part: number[] = [];
  mat: number[] = [];
  curPart = 0;
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, mat: number) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) { this.part.push(this.curPart); this.mat.push(mat); }
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, mat: number) {
    this.tri(a, b, c, mat);
    this.tri(a, c, d, mat);
  }
  /** Nối các vòng (cùng số điểm) thành ống phẳng mặt; nắp hai đầu tuỳ chọn. `mats[i]` = chất liệu mặt i (theo cạnh vòng). */
  loft(rings: THREE.Vector3[][], mat: number | number[], caps = true, capMat?: number) {
    const n = rings[0]!.length;
    const mm = (i: number) => (Array.isArray(mat) ? mat[i % mat.length]! : mat);
    for (let r = 0; r + 1 < rings.length; r++) {
      const A = rings[r]!, B = rings[r + 1]!;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        this.quad(A[i]!, A[j]!, B[j]!, B[i]!, mm(i));
      }
    }
    if (caps) {
      const cm = capMat ?? mm(0);
      for (const R of [rings[0]!, rings[rings.length - 1]!]) {
        const c = R.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(n);
        for (let i = 0; i < n; i++) this.tri(c, R[i]!, R[(i + 1) % n]!, cm);
      }
    }
  }
  /** Hộp hướng theo trục từ a → b, tiết diện w × h (trục y phụ = `upHint`). */
  beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, mat: number, upHint = new THREE.Vector3(0, 1, 0)) {
    const f = new THREE.Vector3().subVectors(b, a).normalize();
    const u0 = Math.abs(f.dot(upHint)) > 0.95 ? new THREE.Vector3(1, 0, 0) : upHint;
    const s = new THREE.Vector3().crossVectors(u0, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, s);
    const ring = (o: THREE.Vector3, k = 1) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) =>
      o.clone().addScaledVector(s, (x! * w * k) / 2).addScaledVector(u, (y! * h * k) / 2));
    this.loft([ring(a), ring(b)], mat);
  }
  /** Chóp (gai/răng) đáy tam giác quanh `base`, đỉnh `tip`. */
  spike(base: THREE.Vector3, tip: THREE.Vector3, r: number, mat: number, sides = 3, rot = 0) {
    const f = new THREE.Vector3().subVectors(tip, base).normalize();
    const u0 = Math.abs(f.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const s = new THREE.Vector3().crossVectors(u0, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, s);
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      ring.push(base.clone().addScaledVector(s, Math.cos(a) * r).addScaledVector(u, Math.sin(a) * r));
    }
    for (let i = 0; i < sides; i++) this.tri(ring[i]!, ring[(i + 1) % sides]!, tip, mat);
    for (let i = 1; i + 1 < sides; i++) this.tri(ring[0]!, ring[i + 1]!, ring[i]!, mat);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const PARTS_VERT = /* glsl */ `
attribute float aPart; attribute float aMat; attribute vec2 aInfo;
varying vec3 vW; varying float vMat; varying float vId;
void main(){
  vMat = aMat; vId = aInfo.y;
  if (abs(aPart - aInfo.x) > 0.5) { vW = vec3(0.0); gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const PARTS_FRAG = /* glsl */ `
uniform vec3 uBase[2]; uniform vec3 uDark[2]; uniform float uSpec[2];
uniform vec3 uSeamLo; uniform vec3 uSeamHi; uniform float uHeat;
uniform vec3 uTeeth; uniform vec3 uEye; uniform vec3 uBlade; uniform vec3 uChrome; uniform vec3 uHaz;
uniform vec3 uKey; uniform vec3 uAmb; uniform vec3 uRim; uniform float uRimK; uniform float uFade;
varying vec3 vW; varying float vMat; varying float vId;
void main(){
  vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  int m = int(vMat + 0.5);
  int id = vId < 0.5 ? 0 : 1;
  vec3 base = uBase[0]; vec3 dark = uDark[0]; float spec = uSpec[0];
  if (id == 1) { base = uBase[1]; dark = uDark[1]; spec = uSpec[1]; }
  float tone = 0.94 + 0.12 * fract(sin(dot(floor(N * 9.0 + 0.5), vec3(12.99, 78.23, 37.71))) * 43758.55);
  vec3 alb = base; float emis = 0.0; vec3 ecol = vec3(0.0);
  if (m == 1) alb = dark;
  else if (m == 2) { emis = 1.0; ecol = mix(uSeamLo, uSeamHi, clamp(uHeat, 0.0, 1.0)) * (0.75 + 0.5 * uHeat); }
  else if (m == 3) { emis = 1.0; ecol = mix(uTeeth, uSeamHi, 0.25 + 0.3 * uHeat); }
  else if (m == 4) { emis = 1.0; ecol = uEye * (1.0 + 0.3 * uHeat); }
  else if (m == 5) { alb = uBlade; spec *= 0.5; }
  else if (m == 6) { alb = uChrome; spec = 1.0; }
  else if (m == 7) { alb = uHaz; spec = 0.2; }
  vec3 L1 = normalize(vec3(-0.35, 1.0, 0.25));
  vec3 L2 = normalize(vec3(0.3, -1.0, -0.2));
  float key = max(dot(N, L1), 0.0);
  float rim = max(dot(N, L2), 0.0);
  float sp = pow(max(dot(reflect(-L1, N), V), 0.0), 22.0) * spec;
  vec3 c = alb * tone * (uAmb + uKey * key * 0.95) + (alb * 0.8 + 0.12) * uRim * rim * uRimK * 0.75 + uKey * sp * 0.55;
  c = mix(c, ecol, emis);
  gl_FragColor = vec4(c * uFade, 1.0);
}`;

/** Vật liệu thép đẽo (dùng với InstancedMesh có thuộc tính instance `aInfo`). */
export function makeSteelMaterial() {
  const steel = sramp('steel'), coal = sramp('coal'), ember = sramp('ember'), flame = sramp('flame'), wh = sramp('whitehot');
  const blood = sramp('blood'), arc = sramp('arc'), paper = sramp('paper');
  const uniforms = {
    uBase: { value: [v3(steel[300]), v3(coal[100])] },
    uDark: { value: [v3(steel[500]), v3(coal[300])] },
    uSpec: { value: [0.9, 0.25] },
    uSeamLo: { value: v3(ember[500]) }, uSeamHi: { value: v3(flame[300]) }, uHeat: { value: 0 },
    uTeeth: { value: v3(blood[100]) }, uEye: { value: v3(wh[300]) }, uBlade: { value: v3(blood[300]) },
    uChrome: { value: v3(steel[100]) }, uHaz: { value: v3(wh[500]) },
    uKey: { value: v3(arc[500]) }, uAmb: { value: v3(steel[700]).multiplyScalar(0.55) }, uRim: { value: v3(flame[500]) },
    uRimK: { value: 0.6 }, uFade: { value: 1 },
  };
  void paper;
  const mat = new THREE.ShaderMaterial({ vertexShader: PARTS_VERT, fragmentShader: PARTS_FRAG, uniforms, side: THREE.DoubleSide, fog: false });
  return { mat, uniforms };
}

/** InstancedMesh của hình học gộp; `sel[i] = [bộ phận, id]`. */
export function makePartsMesh(geo: THREE.BufferGeometry, mat: THREE.Material, sel: [number, number][]) {
  const info = new Float32Array(sel.length * 2);
  sel.forEach(([p, id], i) => { info[i * 2] = p; info[i * 2 + 1] = id; });
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 2));
  const mesh = new THREE.InstancedMesh(geo, mat, sel.length);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

/** Mảng uniform vec3 lịch sử vị trí (đẩy mỗi `step` giây; slot 0 = mới nhất). */
export class History {
  readonly v: THREE.Vector3[];
  last = -1;
  constructor(readonly n: number, readonly step: number, readonly lanes: number) {
    this.v = Array.from({ length: n * lanes }, () => new THREE.Vector3());
  }
  reset(t: number, cur: THREE.Vector3[]) {
    for (let l = 0; l < this.lanes; l++) for (let k = 0; k < this.n; k++) this.v[l * this.n + k]!.copy(cur[l]!);
    this.last = t;
  }
  push(t: number, cur: THREE.Vector3[]) {
    if (this.last < 0 || t < this.last || t - this.last > 2) { this.reset(t, cur); return 0; }
    while (t - this.last >= this.step) {
      for (let l = 0; l < this.lanes; l++) {
        const o = l * this.n;
        for (let k = this.n - 1; k > 0; k--) this.v[o + k]!.copy(this.v[o + k - 1]!);
        this.v[o]!.copy(cur[l]!);
      }
      this.last += this.step;
    }
    return t - this.last;
  }
}

/** Điểm sáng vuông vát (tia lửa khối) cho Points. */
export const SPARK_SQ_FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){
  if (vAlpha < 0.004) discard;
  vec2 d = abs(gl_PointCoord - 0.5) * 2.0;
  float r = d.x + d.y; // hình thoi = tia lửa đẽo
  if (r > 1.0) discard;
  gl_FragColor = vec4(vColor * vAlpha * (1.0 - 0.5 * r), 1.0);
}`;
/** Khói: đĩa tối, mép cứng 2 bậc (blend thường). */
export const SMOKE_FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){
  if (vAlpha < 0.004) discard;
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = r < 0.6 ? 1.0 : 0.6;
  gl_FragColor = vec4(vColor, vAlpha * a);
}`;
