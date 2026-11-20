// GLSL của bầu trời "Kẹo đêm" (sky.ts). Màu lấy từ token palette, áp bão hoà khu "outside"
// (trừ cực quang — guide: cực quang giữ 1,0). Shader ghi thẳng giá trị sRGB (không có colorspace_fragment).
import * as THREE from 'three';

import { hexToRgb, INK_SKY, PAL, shade } from '../../world/style';
import { MOON_CELLS } from './skyMoon';

const f = (x: number) => x.toFixed(4);
/** Token → hằng vec3 GLSL; `raw` = không áp bão hoà khu. */
const v3 = (hex: number, raw = false) => {
  const [r, g, b] = hexToRgb(raw ? hex : shade(hex, 'outside'));
  return `vec3(${f(r)}, ${f(g)}, ${f(b)})`;
};

export const MW_N = new THREE.Vector3(0.75, 0.5, 0.45).normalize();
/** Hướng trăng: trên-trái phía trước, tránh các dải cực quang. */
export const MOON_DIR = new THREE.Vector3(-0.5, 0.74, -0.72).normalize();
const MOON_R = 0.1; // nửa cạnh ô trăng (rad)

const SDF_STAR = /* glsl */ `
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
}`;

export const SKY_VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`;

const md = MOON_DIR;
const mr = new THREE.Vector3().crossVectors(md, new THREE.Vector3(0, 1, 0)).normalize();
const mu = new THREE.Vector3().crossVectors(mr, md).normalize();
const vec = (v: THREE.Vector3) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;

export const SKY_FRAG = /* glsl */ `
const vec3 MW_N = ${vec(MW_N)};
const vec3 MD = ${vec(md)}; const vec3 MR = ${vec(mr)}; const vec3 MU = ${vec(mu)};
uniform float uTime; uniform float uHype; uniform float uAur; uniform float uWake;
uniform sampler2D uMoon;
varying vec3 vDir;
vec4 cell(vec2 l, float c){
  vec2 q = clamp(l * 0.5 + 0.5, 0.004, 0.996);
  return texture2D(uMoon, vec2((c + q.x) / ${MOON_CELLS}.0, q.y));
}
void main(){
  vec3 d = normalize(vDir);
  float el = d.y;
  float h = max(el, 0.0);
  float az = atan(d.x, -d.z);
  // night-700 (đỉnh) → night-500 → chút grape gần chân trời
  vec3 zen = ${v3(PAL.night[700])};
  vec3 mid = ${v3(PAL.night[500])};
  vec3 hor = mix(mix(${v3(PAL.night[500])}, ${v3(PAL.night[300])}, 0.7), ${v3(PAL.grape[700])}, 0.18);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.3, h));
  col = mix(col, zen, smoothstep(0.3, 0.95, h));
  // ánh đèn thành phố cam đào rất thấp
  float glow = exp(-h * 18.0) * (0.75 + 0.25 * sin(az * 3.0 + 1.0));
  col = mix(col, ${v3(PAL.peach[700])}, glow * 0.4);
  // cực quang hắt nhẹ lên nền trời (chỉ khi có cực quang)
  col += ${v3(PAL.mint[700], true)} * 0.05 * uAur * smoothstep(0.05, 0.45, h) * (0.6 + 0.4 * sin(az * 2.0 + uTime * 0.05));
  col = mix(col, ${v3(PAL.night[500])}, smoothstep(0.0, -0.08, el));
  // dải Ngân Hà mờ
  float mw = dot(d, MW_N);
  float band = exp(-mw * mw / 0.018);
  float nz = 0.5 + 0.5 * sin(d.x * 9.0 + sin(d.z * 7.0) * 1.7) * sin(d.y * 11.0 + d.z * 5.0 + 1.3);
  float core = exp(-mw * mw / 0.004);
  col += (${v3(PAL.night[100])} * 0.22 * (0.35 + 0.8 * nz) * band + ${v3(PAL.grape[300])} * 0.05 * core * nz) * smoothstep(0.02, 0.25, el);
  // trăng chibi (atlas: 0 ngủ, 1 thức, 2 "z")
  float mf = dot(d, MD);
  if (mf > 0.95) {
    float sw = sin(uTime * 0.6) * 0.06 * (1.0 - uWake) + sin(uTime * 2.2) * 0.04 * uWake;
    vec2 l = vec2(dot(d, MR), dot(d, MU)) / ${f(MOON_R)};
    vec2 lr = vec2(cos(sw) * l.x - sin(sw) * l.y, sin(sw) * l.x + cos(sw) * l.y);
    float inq = step(max(abs(lr.x), abs(lr.y)), 1.0);
    vec4 a = cell(lr, 0.0), b = cell(lr, 1.0);
    vec4 m = mix(a, b, uWake) * inq;
    col = mix(col, m.rgb, m.a);
    // "z z" bay lên khi ngủ
    for (int k = 0; k < 2; k++) {
      float ph = fract(uTime / 3.4 + float(k) * 0.5);
      vec2 zp = vec2(0.6, 0.55) + vec2(0.5, 0.8) * ph + vec2(sin(ph * 6.28) * 0.06, 0.0);
      float zs = 0.2 + 0.16 * ph;
      vec2 zl = (l - zp) / zs;
      float zin = step(max(abs(zl.x), abs(zl.y)), 1.0);
      vec4 z = cell(zl, 2.0) * zin;
      float za = smoothstep(0.0, 0.15, ph) * (1.0 - smoothstep(0.65, 1.0, ph)) * (1.0 - uWake);
      col = mix(col, z.rgb, z.a * za);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export const AURORA_VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uGrow;
attribute vec3 aCurt; // s (m dọc dải), u (0..1), id
varying vec2 vUv; varying float vS; varying float vId; varying float vG;
void main(){
  vUv = vec2(aCurt.y, uv.y); vS = aCurt.x; vId = aCurt.z;
  // "bung rèm": mỗi dải mọc từ chân lên, lệch nhau một chút
  float g = clamp(uGrow * 1.35 - vId * 0.1 - abs(aCurt.y - 0.5) * 0.15, 0.0, 1.0);
  g = 1.0 - pow(1.0 - g, 3.0);
  vG = g;
  vec3 p = position;
  float t = uTime * (0.4 + 0.5 * uHype);
  vec2 radial = normalize(p.xz + vec2(0.0001));
  float fold = sin(vS * 0.03 + t * 0.10 + vId * 2.0) * 9.0 + sin(vS * 0.083 - t * 0.07 + vId) * 4.0;
  p.xz += radial * fold;
  p.y += sin(vS * 0.045 + t * 0.15 + vId * 3.0) * 4.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const AURORA_FRAG = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uAur;
varying vec2 vUv; varying float vS; varying float vId; varying float vG;
float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
void main(){
  float y = vUv.y;
  if (y > vG) discard;
  float t = uTime * (0.4 + 0.9 * uHype);
  float s = vS;
  float x = s * 0.07 + t * 0.25 + vId * 13.0;
  // tia mềm, ít gắt hơn (kẹo)
  float rays = n1(x * 2.2) * 0.55 + n1(x * 5.1 - t * 0.6) * 0.3 + n1(x * 11.0 + t * 1.2) * 0.15;
  rays = 0.35 + 0.9 * rays * rays;
  float big = smoothstep(0.15, 0.7, n1(s * 0.013 - t * 0.05 + vId * 5.0)) * 0.8 + 0.2;
  float bottom = smoothstep(0.0, 0.08, y);
  float body = exp(-y * 2.2) * 0.85 + 0.15;
  float top = smoothstep(1.0, 0.6, y);
  // mép đang mọc lên: mềm + sáng nhẹ
  float lead = smoothstep(vG, vG - 0.12, y) + (1.0 - vG) * exp(-pow((vG - y) * 18.0, 2.0)) * 0.6;
  float I = bottom * top * body * rays * big * lead;
  // 40–80%: mint → soda; ≥ 80%: đủ mint → soda → grape → berry
  float hi = smoothstep(0.72, 0.95, uHype);
  float k = y * mix(1.0, 1.25, hi) + n1(s * 0.02 + t * 0.05) * 0.18;
  vec3 c0 = ${v3(PAL.mint[500], true)}, c1 = ${v3(PAL.soda[300], true)}, c2 = ${v3(PAL.grape[300], true)}, c3 = ${v3(PAL.berry[300], true)};
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.5, k));
  c = mix(c, mix(c1, c2, smoothstep(0.45, 0.8, k)), hi);
  c = mix(c, mix(c, c3, smoothstep(0.75, 1.1, k)), hi);
  float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
  float amp = 0.9 * pow(uAur, 0.6) * (0.8 + 0.25 * hi) * (1.0 + 0.2 * uPulse * hi);
  gl_FragColor = vec4(c * I * edge * amp, 1.0);
}`;

export const STAR_VERT = (R: number) => /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uRes;
attribute vec3 color; attribute float aSize; attribute vec3 aTw; // tốc độ, pha, hero
varying vec3 vCol; varying float vHero; varying float vRot;
void main(){
  vec3 wp = position * ${R}.0 + cameraPosition;
  float sp = aTw.x * (1.0 + 0.6 * uHype);
  float tw = 0.75 + 0.25 * sin(uTime * sp + aTw.y) + (0.12 + 0.2 * uHype) * sin(uTime * sp * 2.7 + aTw.y * 3.1);
  tw = max(tw, 0.2);
  float hz = smoothstep(0.0, 0.1, position.y);
  vHero = aTw.z;
  float sc = 1.0;
  if (vHero > 0.5) { sc = 0.9 + 0.12 * sin(uTime * sp * 0.7 + aTw.y); tw = 0.85 + 0.15 * sin(uTime * sp + aTw.y); }
  vCol = color * tw * hz * (1.0 + 0.3 * uHype + 0.08 * uPulse * uHype);
  vRot = sin(uTime * 0.5 + aTw.y) * 0.12;
  gl_PointSize = aSize * uRes * sc * (1.0 + 0.08 * uHype);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

// Blend premultiplied (ONE, ONE_MINUS_SRC_ALPHA): sao thường alpha 0 → cộng; sao hero có thân đặc + viền INK_SKY.
export const STAR_FRAG = /* glsl */ `
varying vec3 vCol; varying float vHero; varying float vRot;
${SDF_STAR}
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  if (vHero > 0.5) {
    float c = cos(vRot), s = sin(vRot);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float dd = sdStar5(q * 1.0 + vec2(0.0, 0.04), 0.5, 0.52) - 0.09;
    float aa = 0.04;
    float fill = smoothstep(aa, -aa, dd);
    float ink = smoothstep(aa, -aa, dd - 0.06) - fill;
    float gl = exp(-max(dd, 0.0) * 9.0) * 0.28 * (1.0 - fill - ink);
    vec3 body = vCol * (0.85 + 0.35 * smoothstep(0.35, -0.2, q.y - q.x * 0.3));
    vec2 hp = q - vec2(-0.12, 0.17);
    body = mix(body, ${v3(PAL.cream[100])}, smoothstep(0.075, 0.04, length(hp * vec2(1.0, 1.5))) * 0.85);
    vec3 col = body * fill + ${v3(INK_SKY)} * ink + vCol * gl;
    float a = fill + ink;
    if (a + gl < 0.01) discard;
    gl_FragColor = vec4(col, a);
  } else {
    float a = exp(-dot(p, p) * 3.4) * 1.05;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vCol * a, 0.0);
  }
}`;

export const MET_VERT = (R: number) => /* glsl */ `
uniform float uTime;
attribute vec3 aP0; attribute vec3 aT; attribute vec4 aLife; // bắt đầu, thời lượng, độ dài cung, độ dài đuôi
attribute vec2 aLook; // nửa rộng (rad), độ sáng
varying vec2 vQ; varying float vA; varying float vFlare; varying float vBr; varying float vT; varying float vSpin;
void main(){
  float u = (uTime - aLife.x) / aLife.y;
  vFlare = smoothstep(0.7, 0.9, u) * (1.0 - smoothstep(0.9, 1.0, u));
  if (u < 0.0 || u > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(0.0); vA = 0.0; vFlare = 0.0; vBr = 0.0; vT = 1.0; vSpin = 0.0; return; }
  float e = u * (2.0 - u) * 0.35 + u * 0.65;
  float head = aLife.z * e;
  float W = aLook.x;
  float tail = min(head, aLife.w * (1.0 - 0.5 * smoothstep(0.6, 1.0, u)));
  tail = max(tail, W * 1.5);
  // position.x: -1 = trước đầu sao, 0..1 dọc đuôi
  float pw = 1.0 + 0.5 * vFlare;
  float a = position.x < 0.0 ? head + W * 1.15 * pw : head - position.x * tail;
  vec3 dir = aP0 * cos(a) + aT * sin(a);
  vec3 side = cross(aP0, aT);
  vec3 wp = (dir + side * position.y * W * pw) * ${R}.0 + cameraPosition;
  vT = tail / W;
  vQ = vec2(position.x < 0.0 ? -1.15 * pw : position.x * vT, position.y * pw);
  vA = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.92, 1.0, u));
  vBr = aLook.y;
  vSpin = uTime * 2.2 + aLife.x * 7.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

export const MET_FRAG = /* glsl */ `
varying vec2 vQ; varying float vA; varying float vFlare; varying float vBr; varying float vT; varying float vSpin;
${SDF_STAR}
void main(){
  float L = vQ.x, Y = vQ.y;
  float x = clamp(L / vT, 0.0, 1.0);
  // ruy băng thon: kem → mật ong
  float hw = 0.36 * pow(1.0 - x, 0.9) + 0.02;
  float rib = smoothstep(hw + 0.05, hw - 0.05, abs(Y)) * step(0.0, L) * pow(1.0 - x, 1.1);
  vec3 rc = mix(${v3(PAL.cream[100])}, ${v3(PAL.honey[300])}, smoothstep(0.0, 0.6, x));
  // vài chấm lấp lánh
  float sp = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 c = vec2(vT * (0.28 + 0.22 * fk), (mod(fk, 2.0) - 0.5) * 0.9);
    vec2 dq = vec2(L, Y) - c;
    float r = 0.17 * (1.0 - 0.2 * fk) * (0.8 + 0.4 * sin(vSpin * 1.7 + fk * 2.0));
    sp += smoothstep(r, r * 0.3, length(dq)) * (1.0 - 0.25 * fk);
  }
  // đầu ngôi sao tròn
  float c = cos(vSpin), s = sin(vSpin);
  vec2 q = vec2(c * L - s * Y, s * L + c * Y) * (1.0 - 0.25 * vFlare);
  float dd = sdStar5(q, 0.6, 0.55) - 0.12;
  float star = smoothstep(0.05, -0.05, dd);
  float halo = exp(-max(dd, 0.0) * 10.0) * 0.3 * smoothstep(1.0, 0.7, abs(Y));
  vec3 col = rc * rib * 0.8 + ${v3(PAL.honey[300])} * sp * 0.9;
  vec3 sc = mix(${v3(PAL.honey[300])}, ${v3(PAL.cream[100])}, smoothstep(-0.05, -0.3, dd));
  col = mix(col, sc, star) + ${v3(PAL.honey[500])} * halo * (1.0 - star);
  float a = vA * min(vBr * (1.0 + 0.3 * vFlare), 1.0);
  gl_FragColor = vec4(col * a, 1.0);
}`;

// Máy bay chở khách mập (mũi +X): thân capsule, cánh ngắn dày, tô 2 bậc night-100 / night-300, cửa sổ mật ong mờ.
export const PLANE_VERT = /* glsl */ `
uniform vec4 uPlane[2]; uniform vec2 uPlaneVis;
attribute vec3 aInfo; // id máy bay, 1 = vệt khói, 1 = thân (có cửa sổ)
varying float vA; varying float vTrail; varying vec2 vUv2; varying vec3 vN; varying vec3 vL; varying float vBody;
void main(){
  vec4 pl = aInfo.x < 0.5 ? uPlane[0] : uPlane[1];
  float c = cos(pl.w), s = sin(pl.w);
  vec3 p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z) + pl.xyz;
  vN = vec3(c * normal.x - s * normal.z, normal.y, s * normal.x + c * normal.z);
  vL = position;
  vA = aInfo.x < 0.5 ? uPlaneVis.x : uPlaneVis.y;
  vTrail = aInfo.y; vBody = aInfo.z; vUv2 = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const PLANE_FRAG = /* glsl */ `
varying float vA; varying float vTrail; varying vec2 vUv2; varying vec3 vN; varying vec3 vL; varying float vBody;
void main(){
  if (vTrail > 0.5) {
    // vệt khói chấm tròn
    float u = vUv2.x;
    float cell = fract(u * 34.0) - 0.5;
    float r = mix(0.32, 0.12, u);
    float dot0 = smoothstep(r, r - 0.08, length(vec2(cell, (vUv2.y - 0.5) * 0.9)));
    float a = dot0 * 0.45 * pow(1.0 - u, 1.3) * smoothstep(0.0, 0.03, u) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(${v3(PAL.soda[100])}, a);
    return;
  }
  vec3 n = normalize(vN);
  float lit = smoothstep(0.05, 0.25, n.y * 0.8 + 0.2);
  vec3 col = mix(${v3(PAL.night[300])}, ${v3(PAL.night[100])}, lit);
  // viền sáng nhẹ phía trên (đọc được hình trên nền trời tối)
  col += ${v3(PAL.grape[300])} * 0.18 * smoothstep(0.6, 0.95, n.y);
  if (vBody > 0.5) {
    float win = step(abs(vL.y - 0.25), 0.22) * step(abs(vL.x), 1.6) * step(0.5, abs(n.z));
    float w = smoothstep(0.35, 0.2, length(vec2(fract(vL.x * 1.4) - 0.5, (vL.y - 0.25) * 2.0)));
    col = mix(col, ${v3(PAL.honey[300])} * 0.8, win * w);
  }
  gl_FragColor = vec4(col, vA);
}`;
