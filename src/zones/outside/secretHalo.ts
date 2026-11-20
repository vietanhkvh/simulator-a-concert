// Chữ ký secret dùng chung (STYLE_GUIDE · SECRET OBJECT): vành chấm mint (SECRET_RIM) ở 1,35 × bán kính,
// luôn quay mặt về camera, xoay chậm, 6 ngôi sao mật ong bo tròn chạy trên vành và lấp lánh, quầng sáng mềm.
// 1 draw call: một quad billboard, toàn bộ hình vẽ bằng fragment shader (không ghi buffer mỗi khung).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SECRET_HALO, SECRET_RIM, PAL, INK_SKY, popScale, hexToRgb, shadowOf, hypeColors } from '../../world/style';

/** Màu thô sRGB (shader secret ghi thẳng ra, không chuyển không gian màu — giống các shader outside khác). */
export const raw = (hex: number, out = new THREE.Color()) => { const [r, g, b] = hexToRgb(hex); return out.setRGB(r, g, b, THREE.LinearSRGBColorSpace); };

export interface SecretHalo {
  group: THREE.Group;
  /** t = seconds; radius in metres of the object it surrounds; appear 0..1 */
  update(t: number, radius: number, appear: number): void;
  dispose(): void;
}

/** Quad rộng hơn vành để chứa sao + quầng (đơn vị = bán kính vành). */
const EXTENT = 1.32;
const STARS = 6;
const DOTS = 30;

const VERT = /* glsl */ `
uniform float uR;
varying vec2 vP;
void main() {
  vP = position.xy * ${EXTENT.toFixed(2)};
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * ${EXTENT.toFixed(2)} * uR;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uAlpha;
uniform float uPx;
uniform vec3 uRim;
uniform vec3 uRimHi;
uniform vec3 uStar;
uniform vec3 uStarHi;
varying vec2 vP;
const float TAU = 6.2831853;
// iq: sdStar5 (r = bán kính ngoài, rf = tỉ lệ lõm)
float sdStar5(vec2 p, float r, float rf) {
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
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  float aa = max(uPx, 0.004);
  float r = length(vP);
  float ang = atan(vP.y, vP.x);
  // Quầng mềm hai phía vành
  float glow = exp(-pow((r - 1.0) / 0.11, 2.0)) * 0.32 + exp(-pow((r - 1.0) / 0.035, 2.0)) * 0.18;
  // Vành chấm: xoay chậm
  float cell = TAU / ${DOTS}.0;
  float a0 = ang - uTime * 0.25;
  float k = floor(a0 / cell + 0.5);
  float ac = k * cell + uTime * 0.25;
  vec2 c = vec2(cos(ac), sin(ac));
  float pulse = 0.5 + 0.5 * sin(uTime * 3.0 - k * 0.9);
  float dr = 0.034 + 0.008 * pulse;
  float dDot = length(vP - c) - dr;
  float dotA = 1.0 - smoothstep(-aa, aa, dDot);
  vec3 col = mix(uRim, uRimHi, pulse * 0.6);
  float alpha = dotA;
  vec3 outc = col * dotA;
  // Sao mật ong chạy trên vành
  for (int i = 0; i < ${STARS}; i++) {
    float fi = float(i);
    float a = fi * TAU / ${STARS}.0 + uTime * ${SECRET_HALO.spin.toFixed(2)} * 0.35 + 0.3 * sin(uTime * 0.7 + fi);
    float rr = 1.0 + 0.05 * sin(uTime * 1.3 + fi * 2.1);
    vec2 sc = vec2(cos(a), sin(a)) * rr;
    float tw = 0.5 + 0.5 * sin(uTime * (2.4 + fi * 0.37) + fi * 1.7);
    float sz = mix(0.075, 0.11, tw) * (fi == 0.0 || fi == 3.0 ? 1.15 : 1.0);
    vec2 q = rot(uTime * 0.8 + fi) * (vP - sc);
    float d = sdStar5(q, sz, 0.55) - sz * 0.18; // bo tròn đầu cánh
    float sa = 1.0 - smoothstep(-aa, aa, d);
    float sg = exp(-max(d, 0.0) / (0.05 + 0.04 * tw)) * 0.45 * (0.5 + tw);
    // điểm sáng nhỏ trên sao
    float hi = 1.0 - smoothstep(0.0, sz * 0.32, length(q - vec2(-sz * 0.18, sz * 0.2)));
    vec3 sCol = mix(uStar, uStarHi, 0.35 + 0.65 * hi);
    outc = mix(outc, sCol, sa);
    alpha = max(alpha, sa);
    glow += sg * (1.0 - sa);
  }
  // quầng: pha mint + chút mật ong
  vec3 gCol = mix(uRim, uStar, 0.15);
  outc += gCol * glow * (1.0 - alpha);
  alpha = alpha + glow * (1.0 - alpha);
  alpha *= uAlpha;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(outc * uAlpha, alpha); // premultiplied
}`;

export function createSecretHalo(): SecretHalo {
  const group = new THREE.Group();
  group.name = 'secret-halo';
  const geo = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    uTime: { value: 0 },
    uAlpha: { value: 0 },
    uR: { value: 1 },
    uPx: { value: 0.01 },
    uRim: { value: raw(SECRET_RIM) },
    uRimHi: { value: raw(PAL.mint[300]) },
    uStar: { value: raw(PAL.honey[500]) },
    uStarHi: { value: raw(PAL.cream[300]) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  group.add(mesh);
  group.visible = false;

  return {
    group,
    update(t, radius, appear) {
      const a = Math.max(0, Math.min(1, appear));
      group.visible = a > 0.001;
      if (!group.visible) return;
      // pop theo appear (0..1 ⇒ 0..POP.sec)
      const s = popScale(a * 0.25 + (a >= 1 ? 1 : 0));
      uniforms.uTime.value = t;
      uniforms.uAlpha.value = Math.min(1, a * 1.6);
      const breathe = 1 + 0.03 * Math.sin((t * Math.PI * 2) / SECRET_HALO.period);
      uniforms.uR.value = Math.max(0.01, radius * SECRET_HALO.scale * s * breathe);
      uniforms.uPx.value = 0.012;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

// ───────────── Bộ dựng mesh chibi cho secret (UFO / tên lửa) ─────────────
// Một geometry gộp: màu sáng (color) + màu bóng (aShade = shadowOf) + aPart (kind, id) + aPivot.
// Toon 2 bậc + rim + đốm highlight cream; viền ink = inverted hull dùng CHUNG geometry (+1 draw call).

/** Loại phần (aPart.x). */
export const PART = { solid: 0, light: 1, eye: 2, wave: 3, flat: 4, glow: 5, spin: 6 } as const;

export class PartBuilder {
  private parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, hex: number, kind: number = PART.solid, id = 0, pivot?: THREE.Vector3): this {
    const h = g.index ? g.toNonIndexed() : g;
    if (h !== g) g.dispose();
    if (h.getAttribute('uv')) h.deleteAttribute('uv');
    if (!h.getAttribute('normal')) h.computeVertexNormals();
    const n = h.getAttribute('position').count;
    const [r, gg, b] = hexToRgb(hex);
    const [sr, sg, sb] = hexToRgb(shadowOf(hex));
    const col = new Float32Array(n * 3), sh = new Float32Array(n * 3), pa = new Float32Array(n * 2), pv = new Float32Array(n * 3);
    const pvv = pivot ?? new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      col.set([r, gg, b], i * 3);
      sh.set([sr, sg, sb], i * 3);
      pa.set([kind, id], i * 2);
      pv.set([pvv.x, pvv.y, pvv.z], i * 3);
    }
    h.setAttribute('color', new THREE.BufferAttribute(col, 3));
    h.setAttribute('aShade', new THREE.BufferAttribute(sh, 3));
    h.setAttribute('aPart', new THREE.BufferAttribute(pa, 2));
    h.setAttribute('aPivot', new THREE.BufferAttribute(pv, 3));
    this.parts.push(h);
    return this;
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts)!;
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    return g;
  }
}

const TOON_VERT = /* glsl */ `
attribute vec3 color;
attribute vec3 aShade;
attribute vec2 aPart;
attribute vec3 aPivot;
uniform float uBlink;   // 1 = mở, 0 = nhắm
uniform float uWave;    // góc (rad) quanh trục z của pivot
uniform float uSpin;    // góc (rad) quanh trục y của pivot
uniform float uOutline; // > 0: pass viền (bán kính mở rộng, đơn vị object)
uniform float uViewH;
varying vec3 vN;
varying vec3 vV;
varying vec3 vCol;
varying vec3 vShade;
varying vec2 vPart;
varying vec3 vL;
void main() {
  vec3 p = position;
  vec3 n = normal;
  float k = aPart.x;
  if (abs(k - 2.0) < 0.1) { p.y = aPivot.y + (p.y - aPivot.y) * max(uBlink, 0.08); }
  if (abs(k - 3.0) < 0.1) {
    vec2 d = p.xy - aPivot.xy; float c = cos(uWave), s = sin(uWave);
    p.xy = aPivot.xy + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
    n.xy = vec2(c * n.x - s * n.y, s * n.x + c * n.y);
  }
  if (abs(k - 6.0) < 0.1) {
    vec2 d = p.xz - aPivot.xz; float c = cos(uSpin), s = sin(uSpin);
    p.xz = aPivot.xz + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
    n.xz = vec2(c * n.x - s * n.y, s * n.x + c * n.y);
  }
  vL = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  if (uOutline > 0.0) {
    // độ dày theo guide (object units) nhưng kẹp 1,5–3 px trên màn hình; mặt, má: không viền
    vec3 nv = normalize(normalMatrix * n);
    float scl = length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    float pxPerM = projectionMatrix[1][1] * uViewH * 0.5 / max(-mv.z, 0.1);
    float w = clamp(uOutline * scl, ${(1.5).toFixed(1)} / pxPerM, 3.0 / pxPerM);
    if (k > 1.9 && k < 2.1 || k > 3.9 && k < 4.1) w = -0.02 * scl;
    mv.xyz += nv * w;
  }
  vN = normalize(normalMatrix * n);
  vV = mv.xyz;
  vCol = color;
  vShade = aShade;
  vPart = aPart;
  gl_Position = projectionMatrix * mv;
}`;

const TOON_FRAG = /* glsl */ `
uniform float uTime;
uniform float uPulse;
uniform float uOutline;
uniform vec3 uInk;
uniform vec3 uRim;
uniform vec3 uHi;
uniform vec3 uChase[3];
uniform float uLights;
varying vec3 vN;
varying vec3 vV;
varying vec3 vCol;
varying vec3 vShade;
varying vec2 vPart;
varying vec3 vL;
void main() {
  if (uOutline > 0.0) { gl_FragColor = vec4(uInk, 1.0); return; }
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(-vV);
  vec3 L = normalize(vec3(-0.45, 0.75, 0.55));
  float k = vPart.x;
  float ndl = dot(n, L);
  float lit = smoothstep(-0.06, 0.08, ndl);
  vec3 c = mix(mix(vShade, vCol, 0.18), vCol, lit);
  float fr = 1.0 - max(dot(n, v), 0.0);
  float rim = smoothstep(0.62, 0.8, fr) * 0.35;
  float hi = smoothstep(0.955, 0.975, dot(n, normalize(L + v))) * 0.55;
  if (abs(k - 1.0) < 0.1) {
    // đèn kẹo chạy đuổi theo màu Hype
    float id = vPart.y;
    float on = pow(0.5 + 0.5 * cos((id - uTime * 0.45) * 6.2832 * 2.0), 3.0) * (0.8 + 0.2 * uPulse);
    int ci = int(mod(floor(id * uLights + 0.5), 3.0));
    vec3 lc = ci == 0 ? uChase[0] : (ci == 1 ? uChase[1] : uChase[2]);
    c = mix(mix(lc, uHi, 0.25) * 0.85, lc, lit * 0.5 + 0.5) * (0.8 + 0.45 * on) + uHi * on * 0.3;
    hi *= 1.4;
  } else if (abs(k - 2.0) < 0.1 || abs(k - 4.0) < 0.1) {
    c = vCol; rim = 0.0; hi = 0.0;
  } else if (abs(k - 5.0) < 0.1) {
    c = vCol * (1.05 + 0.25 * uPulse + 0.08 * sin(uTime * 9.0 + vPart.y * 7.0)); rim = 0.0;
  }
  c += uRim * rim;
  c = mix(c, uHi, hi);
  gl_FragColor = vec4(c, 1.0);
}`;

export interface ToonPair {
  body: THREE.Mesh;
  outline: THREE.Mesh;
  uniforms: {
    uTime: { value: number }; uPulse: { value: number }; uBlink: { value: number }; uWave: { value: number };
    uSpin: { value: number }; uViewH: { value: number }; uChase: { value: THREE.Color[] }; uLights: { value: number };
  };
}

/** Thân toon + viền ink (inverted hull) cùng một geometry. outlineW = độ dày viền (đơn vị object). */
export function makeToon(geo: THREE.BufferGeometry, outlineW: number, ink = INK_SKY): ToonPair {
  const shared = {
    uTime: { value: 0 }, uPulse: { value: 0 }, uBlink: { value: 1 }, uWave: { value: 0 }, uSpin: { value: 0 },
    uViewH: { value: 720 }, uLights: { value: 12 },
    uChase: { value: [raw(PAL.berry[500]), raw(PAL.honey[500]), raw(PAL.soda[500])] },
    uInk: { value: raw(ink) }, uRim: { value: raw(PAL.cream[300]) }, uHi: { value: raw(PAL.cream[100]) },
  };
  const mk = (w: number) => new THREE.ShaderMaterial({
    vertexShader: TOON_VERT, fragmentShader: TOON_FRAG, fog: false,
    uniforms: { ...shared, uOutline: { value: w } },
    side: w > 0 ? THREE.BackSide : THREE.FrontSide,
  });
  const body = new THREE.Mesh(geo, mk(0));
  const outline = new THREE.Mesh(geo, mk(outlineW));
  body.frustumCulled = outline.frustumCulled = false;
  return { body, outline, uniforms: shared };
}

/** Đặt màu chạy đuổi theo Hype (3 màu primary / secondary / accent). */
export function setChase(u: ToonPair['uniforms'], hype: number): void {
  const h = hypeColors(hype);
  u.uChase.value[0]!.setRGB(...h.primary, THREE.LinearSRGBColorSpace);
  u.uChase.value[1]!.setRGB(...h.secondary, THREE.LinearSRGBColorSpace);
  u.uChase.value[2]!.setRGB(...h.accent, THREE.LinearSRGBColorSpace);
}

/** Hình sao 5 cánh tròn đầu (extrude bo cạnh), nằm trong mặt XY, tâm gốc. */
export function starGeo(r: number, depth: number): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.5 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.5, bevelSize: r * 0.16, bevelSegments: 3, curveSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Fragment cho Points hình dạng chibi (premultiplied, viền sáng cộng). Varyings: vColor, vAlpha, vShape (0 chấm, 1 sao, 2 tim, 3 lấp lánh 4 cánh, 4 bông khói), vRot. */
export const SHAPE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying float vRot;
float dot2(vec2 v) { return dot(v, v); }
float sdStar5(vec2 p, float r, float rf) {
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
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
void main() {
  if (vAlpha < 0.004) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  p.y = -p.y;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float d;
  float aa = 0.07;
  vec3 col = vColor;
  if (vShape < 0.5) d = length(p) - 0.4;
  else if (vShape < 1.5) d = sdStar5(p * 1.05, 0.56, 0.52) - 0.07;
  else if (vShape < 2.5) d = sdHeart(vec2(p.x, p.y + 0.62) * 1.05) / 1.05 - 0.05;
  else if (vShape < 3.5) {
    vec2 q = abs(p);
    d = min(length(q * vec2(1.0, 0.16)) - 0.12, length(q * vec2(0.16, 1.0)) - 0.12);
    d = min(d, length(p) - 0.2);
  } else {
    // bông khói: tròn, tô 2 bậc (sáng trên-trái)
    d = length(p) - 0.9;
    aa = 0.05;
    float lit = smoothstep(0.05, 0.15, dot(normalize(p + 0.0001), vec2(-0.6, 0.8)) * 0.5 + 0.5 - length(p) * 0.35);
    col = mix(vColor * vec3(0.78, 0.74, 0.9), vColor, lit);
  }
  float fill = 1.0 - smoothstep(-aa, aa, d);
  float glow = vShape > 3.5 ? 0.0 : exp(-max(d, 0.0) * 7.0) * 0.55;
  float hi = vShape > 3.5 ? 0.0 : fill * (1.0 - smoothstep(0.0, 0.22, length(p - vec2(-0.16, 0.18)))) * 0.55;
  col = mix(col, vec3(1.0, 0.99, 0.97), hi);
  gl_FragColor = vec4((col * fill + vColor * glow * (1.0 - fill)) * vAlpha, fill * vAlpha);
}`;
