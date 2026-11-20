// GLSL cho phi đội phản lực chibi (secretJet.ts).
import { PAL, hexToRgb } from '../../world/style';

const g3 = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;

const vert = () => /* glsl */ `
uniform mat4 uM[3];
uniform float uVis[3];
uniform float uT;
uniform float uViewH;
uniform float uOutW;
uniform float uObjH;
attribute vec3 aSh;
attribute vec3 aCol;
attribute vec4 aJ;
varying vec3 vN;
varying vec3 vW;
varying vec3 vLN;
varying vec3 vCol;
varying vec3 vShc;
varying vec4 vJ;
void main() {
  int j = int(aJ.x + 0.5);
  mat4 M = uM[0];
  float vis = uVis[0];
  if (j == 1) { M = uM[1]; vis = uVis[1]; } else if (j == 2) { M = uM[2]; vis = uVis[2]; }
  vec3 l = position;
  if (aJ.y > 0.5 && aJ.y < 1.5) {
    // lửa đuôi: nhấp nháy, kéo dài
    float fl = 1.0 + 0.22 * sin(uT * 37.0 + float(j) * 2.0) + 0.12 * sin(uT * 23.0);
    l.z = -2.05 + (l.z + 2.05) * fl;
    l.xy *= 1.0 + 0.08 * sin(uT * 29.0 + float(j));
  }
  vec3 w = (M * vec4(l, 1.0)).xyz;
  vec3 N = normalize(mat3(M) * normal);
  // xa dần: thu nhỏ quanh tâm máy bay trước khi chạm mặt cắt xa của camera (không "pop")
  float kd = 1.0 - smoothstep(150.0, 205.0, length(cameraPosition - M[3].xyz));
  w = M[3].xyz + (w - M[3].xyz) * kd;
#ifdef HULL
  vec4 mv0 = viewMatrix * vec4(w, 1.0);
  float pix = 2.0 * max(-mv0.z, 0.1) / (projectionMatrix[1][1] * uViewH);
  float ow = clamp(uOutW * kd, 1.5 * pix, 3.0 * pix) * step(24.0, kd * uObjH / pix);
  if (aJ.y > 0.5 && aJ.y < 1.5) ow = 0.0;
  w += N * ow;
#endif
  vN = N; vW = w; vLN = normal; vCol = aCol; vShc = aSh; vJ = aJ;
  gl_Position = (vis < 0.5 || kd < 0.002) ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const frag = () => /* glsl */ `
uniform vec3 uInk;
uniform vec3 uRimC;
uniform vec3 uFace;
uniform float uT;
varying vec3 vN;
varying vec3 vW;
varying vec3 vLN;
varying vec3 vCol;
varying vec3 vShc;
varying vec4 vJ;
const vec3 L = normalize(vec3(0.35, 0.85, 0.4));
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
void main() {
#ifdef HULL
  gl_FragColor = vec4(uInk, 1.0);
  return;
#endif
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  vec3 base = vCol, sh = vShc;
  float kind = vJ.y;
  if (kind > 0.5 && kind < 1.5) {
    // lửa tròn: lõi kem sáng → viền đào
    float fr = max(dot(n, v), 0.0);
    gl_FragColor = vec4(mix(${g3(PAL.peach[500])}, ${g3(PAL.honey[300])} * 1.15, smoothstep(0.3, 0.9, fr)), 1.0);
    return;
  }
  if (kind > 1.5 && kind < 2.5) {
    // mặt phi công: 2 mắt chấm + má hồng + miệng cười nhỏ
    vec2 uv = vJ.zw;
    float front = step(0.0, vLN.z);
    float eye = 0.0;
    for (int s = -1; s <= 1; s += 2) {
      vec2 e = uv - vec2(float(s) * 0.33, 0.05);
      eye = max(eye, 1.0 - smoothstep(0.1, 0.13, length(e * vec2(1.0, 0.8))));
    }
    float cheek = 0.0;
    for (int s = -1; s <= 1; s += 2) cheek = max(cheek, 1.0 - smoothstep(0.1, 0.14, length(uv - vec2(float(s) * 0.5, -0.22))));
    vec2 m = uv - vec2(0.0, -0.18);
    float mouth = (1.0 - smoothstep(0.03, 0.05, abs(length(m) - 0.13))) * step(m.y, -0.04);
    base = mix(base, ${g3(PAL.berry[300])}, cheek * front);
    base = mix(base, uFace, max(eye, mouth) * front);
    sh = mix(sh, base, 0.5);
  }
  if (kind > 2.5 && kind < 3.5 && vLN.y > 0.0) {
    // phù hiệu: đĩa kem + sao mật ong
    vec2 uv = vJ.zw;
    float disc = 1.0 - smoothstep(0.92, 1.0, length(uv));
    float star = 1.0 - smoothstep(-0.03, 0.03, sdStar5(vec2(uv.x, -uv.y), 0.72, 0.5) - 0.06);
    base = mix(base, ${g3(PAL.cream[500])}, disc);
    base = mix(base, ${g3(PAL.honey[500])}, star * disc);
    sh = mix(sh, mix(${g3(PAL.cream[700])}, ${g3(PAL.honey[700])}, star), disc);
  }
  float ndl = dot(n, L) * 0.5 + 0.5;
  vec3 c = mix(sh, base, smoothstep(0.3, 0.4, ndl));
  float hiK = kind > 3.5 ? 0.85 : 0.4; // kính bóng hơn
  float hi = smoothstep(0.94, 0.96, dot(n, normalize(L + v)));
  c = mix(c, ${g3(PAL.cream[100])}, hi * hiK);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  c += uRimC * rim * 0.35;
  gl_FragColor = vec4(c, 1.0);
}`;

// Quad trái tim + mũi tên trong mặt phẳng tim (SDF, xem secretJetHeart.ts). Xuất màu premultiplied.
const heartVert = () => /* glsl */ `
uniform vec3 uC; uniform vec3 uEX; uniform vec3 uEY;
uniform float uScale; uniform vec3 uDrift;
uniform vec4 uBox; // u0, v0, u1-u0, v1-v0
varying vec2 vP; varying vec2 vUv;
void main() {
  vP = position.xy;
  vUv = (position.xy - uBox.xy) / uBox.zw;
  vec3 w = uC + (uEX * position.x + uEY * position.y) * uScale + uDrift;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const heartFrag = () => /* glsl */ `
uniform sampler2D uSdf;
uniform vec4 uBox;
uniform float uT;
uniform vec4 uSpd;   // tốc độ vẽ tim, tốc độ mũi tên, thời điểm "xong" của tim, của mũi tên
uniform vec2 uDiss;  // mức tan (0..1) của tim, của mũi tên
uniform float uFill; // độ hiện của màng tô
uniform float uWob;
varying vec2 vP; varying vec2 vUv;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { return 0.6 * vnoise(p) + 0.4 * vnoise(p * 2.03 + 7.1); }
// 1 lớp nét khói kiểu sticker: viền mực đều theo pixel + đường sáng bên trong + thân phồng mây.
// trả về premultiplied rgba
vec4 strokeLayer(float d, float te, float spd, float w0, float wg, float diss, vec3 fresh, vec3 body, vec3 deep, vec3 ink, vec2 p) {
  float age = uT - te;
  float ahead = max(-age, 0.0) * spd;          // đoạn chưa vẽ → đầu nét tròn
  float w = (w0 + wg * clamp(age, 0.0, 12.0)) * (1.0 - 0.35 * diss);
  float r = length(vec2(ahead, d)) / w;
  float px = clamp(fwidth(r), 1e-4, 0.25); // kẹp: chỗ trường thời gian gián đoạn không được loang viền
  float n = fbm(p * 0.22 + vec2(uT * 0.05, -uT * 0.03));
  float edge = 1.0 - diss * (0.5 + 0.5 * n);    // tan từ mép vào
  float a = 1.0 - smoothstep(edge - px, edge + px * 0.5, r);
  if (a <= 0.0 || r > 2.0) return vec4(0.0);
  float bw = clamp(2.6 * px, 0.06, 0.42);       // viền ~2,6 px, kẹp theo bề rộng nét
  float inner = edge - bw;
  float ol = smoothstep(inner - px, inner, r);
  // thân: kem khi mới → màu khói, phồng mây mịn
  float puff = fbm(p * 0.45 + vec2(uT * 0.12, uT * 0.04));
  vec3 c = mix(fresh, body, smoothstep(0.15, 1.6, age));
  c = mix(c, deep, smoothstep(0.35, 0.95, r / max(inner, 0.05)) * 0.35);
  c = mix(c, fresh, (1.0 - r / max(inner, 0.05)) * (0.18 + 0.3 * smoothstep(0.45, 0.8, puff)));
  // đường sáng mảnh bên trong viền
  float hl = 1.0 - smoothstep(0.0, px * 1.3 + 0.025, abs(r - (inner - 0.13)));
  c = mix(c, ${g3(PAL.cream[100])}, hl * 0.55);
  c = mix(c, ink, ol);
  float alpha = a * (1.0 - smoothstep(0.7, 1.0, diss)) * mix(0.93, 1.0, ol);
  return vec4(c * alpha, alpha);
}
void main() {
  vec2 p = vP;
  p += uWob * vec2(sin(p.y * 0.31 + uT * 0.7), cos(p.x * 0.27 + uT * 0.55)) * 0.35;
  vec4 S = texture2D(uSdf, (p - uBox.xy) / uBox.zw);
  vec4 res = vec4(0.0);
  // ── màng tô bên trong tim: gradient berry-300 → kem ở tâm, chấm lấp lánh, vệt óng chậm
  if (uFill > 0.001) {
    float inside = 1.0 - smoothstep(-0.6, 0.0, S.r);
    vec2 q = (p - vec2(0.0, -2.0)) / vec2(19.0, 17.0);
    float g = smoothstep(0.05, 1.0, length(q));
    vec3 fc = mix(${g3(PAL.cream[300])}, ${g3(PAL.berry[300])}, g);
    float fa = mix(0.3, 0.4, g);
    float band = p.x * 0.55 + p.y * 0.85 - (mod(uT * 7.0, 110.0) - 55.0);
    float sh = exp(-band * band / 30.0) * 0.22;
    fc = mix(fc, ${g3(PAL.cream[100])}, sh);
    fa += sh * 0.25;
    vec2 cell = floor(p / 2.4), fp = fract(p / 2.4) - 0.5;
    float hsh = hash21(cell);
    vec2 off = (vec2(hash21(cell + 3.1), hash21(cell + 9.7)) - 0.5) * 0.5;
    float tw = (0.25 + 0.75 * pow(0.5 + 0.5 * sin(uT * (1.4 + hsh * 2.0) + hsh * 40.0), 2.0)) * step(0.5, hsh);
    float dd = length(fp - off) * 2.4;
    float spx = min(fwidth(dd), 0.15); // kẹp: không loang ở mép ô lưới
    float dot0 = (1.0 - smoothstep(0.14, 0.14 + spx * 1.5, dd)) + 0.45 * (1.0 - smoothstep(0.0, 0.7, dd));
    vec2 cr = abs(fp - off) * 2.4;
    dot0 += (1.0 - smoothstep(0.0, spx * 1.5 + 0.03, min(cr.x, cr.y))) * (1.0 - smoothstep(0.0, 0.6, dd)) * 0.6;
    fc = mix(fc, ${g3(PAL.honey[100])}, clamp(dot0 * tw, 0.0, 1.0));
    fa = mix(fa, 0.85, clamp(dot0 * tw, 0.0, 1.0) * 0.6);
    fa *= inside * uFill;
    fa += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
    fa = max(fa, 0.0);
    res = vec4(fc * fa * 1.45, fa * 0.9); // hơi cộng sáng: màng hồng-kem nổi trên nền đêm, không cháy trắng
  }
  // ── nét tim
  vec4 h = strokeLayer(abs(S.r), S.g, uSpd.x, 1.15, 0.07, uDiss.x,
    ${g3(PAL.cream[300])}, ${g3(PAL.berry[300])}, ${g3(PAL.berry[500])}, ${g3(PAL.berry[700])}, p);
  res = h + res * (1.0 - h.a);
  // ── mũi tên
  vec4 ar = strokeLayer(S.b, S.a, uSpd.y, 0.8, 0.05, uDiss.y,
    ${g3(PAL.cream[300])}, ${g3(PAL.soda[300])}, ${g3(PAL.soda[500])}, ${g3(PAL.soda[700])}, p);
  res = ar + res * (1.0 - ar.a);
  if (res.a < 0.002) discard;
  gl_FragColor = res;
}`;

const ptsVert = () => /* glsl */ `
uniform float uT;
uniform float uPx;
uniform vec3 uHeart;
uniform float uDone;
attribute vec4 aSeed; // emit, type, rnd, rnd
attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot;
void main() {
  float age = uT - aSeed.x;
  vec3 p = position;
  float alpha, size;
  vColor = aColor;
  if (aSeed.y < 0.5) {
    // sao nhỏ rơi khỏi khói
    float life = 1.6 + aSeed.z * 1.6;
    p += vec3(0.3, -0.9 - aSeed.w, 0.0) * age + (vec3(aSeed.z, aSeed.w, fract(aSeed.z * 7.0)) - 0.5) * 2.5 * min(age, 1.0);
    alpha = (age < 0.0 || age > life) ? 0.0 : 1.0 - smoothstep(life * 0.6, life, age);
    alpha *= 0.7 + 0.3 * sin(age * 14.0 + aSeed.w * 20.0);
    size = 0.9 + 0.7 * aSeed.w;
    vShape = 1.0;
    vRot = age * 2.0 + aSeed.z * 6.0;
  } else {
    // tim mini bay lên từ trái tim đã vẽ xong
    float life = 4.0;
    p.y += age * 2.2;
    p.x += sin(age * 2.0 + aSeed.z * 6.0) * 1.2;
    p = uHeart + (p - uHeart) * (1.0 + uDone * 0.02 * sin(uT * 6.0));
    alpha = (age < 0.0 || age > life) ? 0.0 : smoothstep(0.0, 0.3, age) * (1.0 - smoothstep(life * 0.6, life, age));
    size = (2.4 + 1.6 * aSeed.w) * smoothstep(0.0, 0.3, age);
    vShape = 2.0;
    vRot = sin(age * 2.5 + aSeed.w * 6.0) * 0.3;
  }
  vAlpha = alpha;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = alpha < 0.004 ? 0.0 : clamp(uPx * projectionMatrix[1][1] * 0.5 * size / -mv.z, 1.5, 200.0);
  if (alpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

/** Getter: chuỗi GLSL dựng lúc đọc để lấy màu của phong cách đang bật. */
export const JET_GLSL = {
  get vert() { return vert(); }, get frag() { return frag(); }, get heartVert() { return heartVert(); },
  get heartFrag() { return heartFrag(); }, get ptsVert() { return ptsVert(); },
};
