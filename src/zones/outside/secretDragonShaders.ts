// GLSL cho rồng chibi (secretDragon.ts). Đường bay = DataTexture, thân tham số hoá theo khoảng cách s sau đầu.
import { PAL, hexToRgb } from '../../world/style';

const g3 = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;

const COMMON = /* glsl */ `
uniform sampler2D uPath;
uniform float uLen;
uniform float uSpeed;
uniform float uLoopD;
uniform float uLb;
uniform float uT;
uniform float uPop;
float sm01(float a, float b, float x) { return smoothstep(a, b, x); }
vec3 pathAt(float d) {
  float x = clamp(d / uLen, 0.0, 1.0) * 511.0;
  int a = int(floor(x));
  int b = min(a + 1, 511);
  return mix(texelFetch(uPath, ivec2(a, 0), 0).xyz, texelFetch(uPath, ivec2(b, 0), 0).xyz, fract(x));
}
void pathFrame(float d, out vec3 T, out vec3 sd, out vec3 up) {
  T = normalize(pathAt(d + 1.0) - pathAt(d - 1.0) + vec3(1e-4, 0.0, 0.0));
  sd = normalize(cross(vec3(0.0, 1.0, 0.0), T) + vec3(0.0, 0.0, 1e-4));
  up = cross(T, sd);
}
float radAt(float s) {
  return 1.3 * (0.8 + 0.2 * smoothstep(0.0, 3.0, s)) * (1.0 - 0.66 * smoothstep(uLb * 0.3, uLb, s));
}
vec3 bodyPos(float s, float t) {
  float d = uSpeed * t - s;
  vec3 T, sd, up;
  pathFrame(d, T, sd, up);
  float env = 0.25 + 0.75 * smoothstep(0.0, 6.0, s);
  float ph = s * 0.42 - t * 4.2;
  vec3 p = pathAt(d) + sd * sin(ph) * 1.6 * env + up * cos(ph * 0.7 + 1.0) * 0.9 * env;
  float u = clamp((d - uLoopD) / 18.0, 0.0, 1.0);
  float th = 6.2831853 * u * u * (3.0 - 2.0 * u);
  return p - T * 5.5 * sin(th) + up * 5.5 * (1.0 - cos(th));
}
void frameAt(float s, float t, out vec3 P, out vec3 T, out vec3 sd, out vec3 up) {
  P = bodyPos(s, t);
  T = normalize(bodyPos(s - 0.5, t) - bodyPos(s + 0.5, t) + vec3(1e-5, 0.0, 0.0));
  vec3 pT, psd, pup;
  pathFrame(uSpeed * t - s, pT, psd, pup);
  sd = normalize(cross(vec3(0.0, 1.0, 0.0), pT) + vec3(0.0, 0.0, 1e-4));
  up = normalize(cross(T, sd));
  sd = normalize(cross(up, T));
}
`;

const VERT = /* glsl */ `
${COMMON}
uniform float uViewH;
uniform float uMouth;
uniform float uBlink;
uniform float uOutW;
uniform float uObjH;
attribute vec4 aC;
attribute vec4 aS;
#ifdef BODY
attribute vec2 aInst;
#endif
varying vec3 vN;
varying vec3 vW;
varying vec3 vLN;
varying vec4 vS;
varying float vSeg;
varying float vKind;
void main() {
  vec3 l = position;
  vec3 n = normal;
  float kind = aC.w;
  float show = 1.0;
#ifdef BODY
  float s = aInst.x;
  float k = aInst.y;
  float part = aS.y;
  float r = radAt(s) * uPop;
  if (part > 0.5 && part < 1.5) show = (mod(k, 2.0) < 0.5 && k > 0.5 && k < float(NSEG) - 3.5) ? 1.0 : 0.0;
  else if (part > 1.5 && part < 3.5) {
    show = (abs(k - float(LEG1)) < 0.5 || abs(k - float(LEG2)) < 0.5) ? 1.0 : 0.0;
    float side = sign(aC.x);
    float a = sin(uT * 7.0 + k * 0.7 + side * 1.6) * 0.55;
    float c = cos(a), sn = sin(a);
    vec3 q = l - aC.xyz;
    q.yz = vec2(c * q.y - sn * q.z, sn * q.y + c * q.z);
    n.yz = vec2(c * n.y - sn * n.z, sn * n.y + c * n.z);
    l = aC.xyz + q;
  } else if (part > 3.5) show = k > float(NSEG) - 1.5 ? 1.0 : 0.0;
  if (part > 0.5 && part < 1.5) l.z += sin(uT * 5.0 - k * 0.6) * 0.08 * l.y;
  l *= show;
  if (part > 3.5) {
    l *= uPop * 0.95;
    l.x += sin(uT * 4.0 + l.z) * 0.12 * l.z;
  } else l *= r;
  float d = uSpeed * uT - s;
  vec3 c0 = pathAt(d);
  float turn = length(normalize(pathAt(d + 4.0) - c0) - normalize(c0 - pathAt(d - 4.0)));
  float sq = min(0.2, turn * 0.3);
  l.z *= 1.0 - sq;
  l.xy *= 1.0 + sq * 0.5;
  vec3 P, T, sd, up;
  frameAt(s, uT, P, T, sd, up);
  vec3 w = P + sd * l.x + up * l.y + T * l.z;
  vec3 N = normalize(sd * n.x + up * n.y + T * n.z);
  vSeg = s - l.z;
#else
  vec3 cc = aC.xyz;
  if (kind > 0.5 && kind < 1.5) l.y = cc.y + (l.y - cc.y) * (1.0 - 0.9 * uBlink);
  else if (kind > 1.5 && kind < 2.5) l = cc + (l - cc) * max(uMouth, 0.001);
  else if (kind > 2.5 && kind < 3.5) {
    float side = sign(cc.x);
    float a = (sin(uT * 4.0 + side) * 0.22 + 0.1) * side;
    vec3 q = l - cc;
    float c = cos(a), sn = sin(a);
    q.xy = vec2(c * q.x - sn * q.y, sn * q.x + c * q.y);
    l = cc + q;
  } else if (kind > 3.5 && kind < 4.5) {
    float dd = length(l - cc);
    l.y += sin(uT * 5.0 - dd * 2.2) * 0.16 * dd;
    l.z += cos(uT * 4.0 - dd * 2.0) * 0.08 * dd;
  } else if (kind > 4.5) l.y += sin(uT * 3.0) * 0.12;
  vec3 w = (modelMatrix * vec4(l, 1.0)).xyz;
  vec3 N = normalize(mat3(modelMatrix) * n);
  vSeg = 0.0;
#endif
#ifdef HULL
  vec4 mv0 = viewMatrix * vec4(w, 1.0);
  float pix = 2.0 * max(-mv0.z, 0.1) / (projectionMatrix[1][1] * uViewH);
  float ow = clamp(uOutW, 1.5 * pix, 3.0 * pix) * step(24.0, uObjH / pix) * show;
  if (kind > 1.5 && kind < 2.5) ow *= uMouth;
  w += N * ow;
#endif
  vN = N;
  vW = w;
  vLN = n;
  vS = aS;
  vKind = kind;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uT;
uniform float uPulse;
uniform vec3 uCol[11];
uniform vec3 uSh[11];
uniform vec3 uRimC;
uniform vec3 uInk;
uniform vec3 uCore;
uniform vec3 uRimS;
uniform vec2 uLook;
uniform float uBlink;
varying vec3 vN;
varying vec3 vW;
varying vec3 vLN;
varying vec4 vS;
varying float vSeg;
varying float vKind;
const vec3 L = normalize(vec3(0.35, 0.85, 0.4));
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 toy(vec3 base, vec3 sh, vec3 n, vec3 v) {
  float ndl = dot(n, L) * 0.5 + 0.5;
  vec3 c = mix(sh, base, smoothstep(0.4, 0.52, ndl));
  float hi = smoothstep(0.955, 0.972, dot(n, normalize(L + v)));
  c = mix(c, ${g3(PAL.cream[100])}, hi * 0.4);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  return c + uRimC * rim * (0.35 + 0.15 * uPulse);
}
void main() {
#ifdef HULL
  gl_FragColor = vec4(uInk, 1.0);
  return;
#endif
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  if (!gl_FrontFacing) n = -n;
  int slot = int(vS.x + 0.5);
  vec3 base = uCol[slot];
  vec3 sh = uSh[slot];
  vec3 c;
#ifdef BODY
  if (vS.y < 0.5) {
    vec3 ln = normalize(vLN);
    float ang = atan(ln.x, ln.y);
    // vảy bán nguyệt so le
    vec2 g = vec2(ang / 6.2832 * 14.0, vSeg * 2.0);
    g.x += 0.5 * mod(floor(g.y), 2.0);
    vec2 f = fract(g) - vec2(0.5, 0.0);
    float scl = 1.0 - smoothstep(0.03, 0.08, abs(length(f * vec2(1.0, 0.8)) - 0.55));
    base = mix(base, sh, scl * 0.3);
    // đốm
    vec2 g2 = vec2(ang / 6.2832 * 7.0, vSeg * 0.8);
    vec2 id = floor(g2);
    vec2 c2 = fract(g2) - 0.5 - (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.3;
    float spot = step(0.42, hash(id)) * (1.0 - smoothstep(0.2, 0.25, length(c2 * vec2(1.0, 1.2)))) * smoothstep(-0.2, 0.05, ln.y);
    base = mix(base, uCol[2], spot);
    sh = mix(sh, uSh[2], spot);
    // bụng kem có vạch
    float belly = smoothstep(-0.32, -0.5, ln.y);
    float line = 1.0 - smoothstep(0.05, 0.1, abs(fract(vSeg * 1.4) - 0.5));
    base = mix(base, mix(uCol[1], uSh[1], line * 0.6), belly);
    sh = mix(sh, uSh[1], belly);
  }
  c = toy(base, sh, n, v);
#else
  if (vKind > 0.5 && vKind < 1.5) {
    // mắt: lòng trắng kem, tròng to, đồng tử, 2 đốm sáng
    vec2 e = vS.zw - uLook;
    float di = length(e * vec2(1.0, 0.92));
    vec3 iris = mix(uCol[7], ${g3(PAL.grape[500])}, smoothstep(0.0, -0.7, e.y) * 0.75);
    c = mix(uCol[10], iris, 1.0 - smoothstep(0.7, 0.74, di));
    c = mix(c, ${g3(PAL.night[700])}, 1.0 - smoothstep(0.34, 0.38, length(e)));
    float h1 = 1.0 - smoothstep(0.17, 0.2, length(e - vec2(-0.24, 0.27)));
    float h2 = 1.0 - smoothstep(0.08, 0.1, length(e - vec2(0.24, -0.26)));
    c = mix(c, uCol[10], max(h1, h2));
    c = mix(c, uCol[7], smoothstep(0.5, 0.7, uBlink));
    c += uRimC * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.2;
  } else if (vKind > 1.5 && vKind < 2.5) {
    // miệng há: lòng berry-700, lưỡi berry-500
    c = mix(uCol[8], ${g3(PAL.berry[500])}, smoothstep(-0.2, -0.45, vS.w));
  } else if (vKind > 4.5) {
    // ngọc phát sáng: lõi SECRET_CORE (emissive 1,6), vành SECRET_RIM
    float fr = max(dot(n, v), 0.0);
    c = mix(uRimS * 1.2, uCore * 1.6, smoothstep(0.25, 0.8, fr));
    float sw = 0.5 + 0.5 * sin(atan(n.y, n.x) * 3.0 + uT * 4.0 + fr * 6.0);
    c += ${g3(PAL.cream[100])} * (smoothstep(0.93, 0.98, dot(n, normalize(L + v))) * 0.9 + sw * 0.12);
  } else if (slot == 5) {
    c = mix(sh, base, 0.85) + uRimC * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.2;
  } else {
    c = toy(base, sh, n, v);
  }
#endif
  gl_FragColor = vec4(c, 1.0);
}`;

const PTS = /* glsl */ `
${COMMON}
uniform float uPx;
uniform float uBreathT;
uniform vec3 uPearl;
attribute vec4 aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying float vRot;
void main() {
  vec3 p; float alpha = 0.0; float size = 0.5;
  vec3 rd = normalize(aSeed.xyz - 0.5 + 1e-4);
  vColor = aColor;
  vRot = (aSeed.x - 0.5) * 1.2;
  if (aSeed.w < 0.55) {
    // lấp lánh rơi từ thân
    float te = aSeed.w / 0.55 * 24.0;
    float age = uT - te;
    float life = 1.1 + aSeed.x * 1.3;
    float s = aSeed.y * uLb;
    p = bodyPos(s, te) + rd * (radAt(s) * 1.05 + age * 0.9) - vec3(0.0, 0.7 * age * age, 0.0);
    alpha = (age < 0.0 || age > life) ? 0.0 : 1.0 - smoothstep(life * 0.5, life, age);
    alpha *= 0.65 + 0.35 * sin(age * 20.0 + aSeed.z * 30.0);
    size = 0.35 + 0.4 * aSeed.z;
    vShape = aSeed.z < 0.4 ? 1.0 : 0.0;
    if (vShape > 0.5) vColor = ${g3(PAL.honey[500])};
    vRot += age * 2.0;
  } else if (aSeed.w < 0.97) {
    // hơi thở: tim / sao / lấp lánh, bắn tới trước + chếch lên
    float te = uBreathT + (aSeed.w - 0.55) / 0.42 * 2.0;
    float age = uT - te;
    vec3 P, T, sd, up;
    frameAt(-0.6, te, P, T, sd, up);
    vec3 mouth = P + T * 2.6 - up * 0.95;
    vec3 dir = normalize(T + up * 0.6 + rd * 0.6);
    float sp = 8.0 + aSeed.z * 7.0;
    p = mouth + dir * sp * (1.0 - exp(-age * 1.6)) / 1.6 + vec3(0.0, 0.7 * age, 0.0);
    p += vec3(sin(age * 3.0 + aSeed.x * 20.0), 0.0, cos(age * 2.5 + aSeed.y * 20.0)) * 0.4 * age;
    float life = 2.4 + aSeed.x * 1.2;
    alpha = (age < 0.0 || age > life) ? 0.0 : 1.0 - smoothstep(life * 0.6, life, age);
    float grow = smoothstep(0.0, 0.25, age);
    float kx = fract(aSeed.y * 7.13);
    if (kx < 0.4) { vShape = 2.0; size = 1.0 + 0.6 * aSeed.z; vColor = mix(${g3(PAL.berry[500])}, ${g3(PAL.berry[300])}, step(0.5, aSeed.z)); }
    else if (kx < 0.75) { vShape = 1.0; size = 0.9 + 0.5 * aSeed.z; vColor = mix(${g3(PAL.honey[500])}, ${g3(PAL.honey[300])}, step(0.5, aSeed.z)); }
    else { vShape = 0.0; size = 0.6 + 0.3 * aSeed.z; }
    size *= grow;
    vRot += sin(age * 3.0 + aSeed.x * 6.0) * 0.4;
  } else if (aSeed.w < 0.985) {
    // sao nhỏ quay quanh ngọc
    float a = uT * 2.4 + aSeed.x * 6.2832;
    float rr = 1.15 + 0.15 * sin(uT * 3.0 + aSeed.y * 9.0);
    p = uPearl + vec3(cos(a) * rr, sin(a * 2.0 + aSeed.z * 6.0) * 0.35, sin(a) * rr);
    alpha = uPop;
    size = 0.38;
    vShape = 1.0;
    vColor = ${g3(PAL.honey[500])};
    vRot = a;
  } else {
    // quầng ngọc
    p = uPearl;
    alpha = 0.55 * uPop;
    size = 3.4 + 0.4 * sin(uT * 4.0);
    vShape = 3.0;
    vColor = ${g3(PAL.honey[300])};
  }
  vAlpha = alpha;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = alpha < 0.004 ? 0.0 : clamp(uPx * projectionMatrix[1][1] * 0.5 * size / -mv.z, 1.5, 200.0);
}`;

/** Fragment cho hạt: 0 lấp lánh 4 cánh · 1 sao 5 cánh tròn · 2 tim mập · 3 quầng mềm. */
export const DRAGON_PTS_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying float vRot;
float dot2(vec2 v) { return dot(v, v); }
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - 0.35355;
  return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
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
  if (vAlpha < 0.004) discard;
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  q.y = -q.y;
  float c = cos(vRot), s = sin(vRot);
  q = mat2(c, -s, s, c) * q;
  vec3 col = vColor;
  float a;
  if (vShape < 0.5) {
    float x = abs(q.x), y = abs(q.y);
    a = max(exp(-x * 9.0) * (1.0 - y), exp(-y * 9.0) * (1.0 - x));
    a = max(a, 1.0 - smoothstep(0.12, 0.3, length(q)));
    col = mix(col, vec3(1.0), 1.0 - smoothstep(0.0, 0.25, length(q)));
  } else if (vShape < 1.5) {
    float d = sdStar5(q, 0.68, 0.5) - 0.12;
    a = 1.0 - smoothstep(-0.04, 0.03, d);
    col = mix(col * 0.78, col, smoothstep(-0.1, -0.16, d));
    col = mix(col, vec3(1.0), (1.0 - smoothstep(0.08, 0.16, length(q - vec2(-0.16, 0.2)))) * 0.6);
  } else if (vShape < 2.5) {
    float d = sdHeart(vec2(q.x * 0.82, q.y * 0.82 + 0.5)) - 0.04;
    a = 1.0 - smoothstep(-0.03, 0.03, d);
    col = mix(col * 0.78, col, smoothstep(-0.06, -0.12, d));
    col = mix(col, vec3(1.0), (1.0 - smoothstep(0.08, 0.16, length(q - vec2(-0.32, 0.28)))) * 0.6);
  } else {
    a = exp(-dot(q, q) * 3.5) * (1.0 - smoothstep(0.85, 1.0, length(q)));
  }
  a *= vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;

export const DRAGON_GLSL = { vert: VERT, frag: FRAG, pts: PTS };
