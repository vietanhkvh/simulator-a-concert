// GLSL cho ĐÔI rồng chibi (secretDragon.ts). Đường bay = DataTexture (4 hàng: [vị trí A, up A, vị trí B, up B]);
// up đã được "vận chuyển song song" + nghiêng (bank) giới hạn ±35° trên CPU ⇒ đầu/thân không bao giờ lộn ngược.
// Thân tham số hoá theo khoảng cách s sau đầu; id rồng (0/1) đi theo instance.
// Defines từ TS: SC (tỉ lệ, float), NSF (số mẫu − 1, float), NSEG, LEG1, LEG2, NSLOT.
import { PAL, hexToRgb } from '../../world/style';

const g3 = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;

const COMMON = () => /* glsl */ `
uniform sampler2D uPath;
uniform float uLen;
uniform float uSpeed;
uniform float uLb;
uniform float uT;
uniform float uPop;
vec3 rowAt(int row, float d) {
  float x = clamp(d / uLen, 0.0, 1.0) * NSF;
  int a = int(floor(x));
  int b = min(a + 1, int(NSF));
  return mix(texelFetch(uPath, ivec2(a, row), 0).xyz, texelFetch(uPath, ivec2(b, row), 0).xyz, fract(x));
}
vec3 pathAt(float id, float d) { return rowAt(int(id + 0.5) * 2, d); }
vec3 upAt(float id, float d) { return rowAt(int(id + 0.5) * 2 + 1, d); }
void pathFrame(float id, float d, out vec3 T, out vec3 sd, out vec3 up) {
  T = normalize(pathAt(id, d + 1.0) - pathAt(id, d - 1.0) + vec3(1e-4, 0.0, 0.0));
  up = upAt(id, d);
  sd = normalize(cross(up, T) + vec3(0.0, 0.0, 1e-5));
  up = cross(T, sd);
}
float radAt(float s) {
  return SC * 1.3 * (0.8 + 0.2 * smoothstep(0.0, 3.0 * SC, s)) * (1.0 - 0.66 * smoothstep(uLb * 0.3, uLb, s));
}
vec3 bodyPos(float id, float s, float t) {
  float d = uSpeed * t - s;
  vec3 T, sd, up;
  pathFrame(id, d, T, sd, up);
  float env = 0.25 + 0.75 * smoothstep(0.0, 6.0 * SC, s);
  float ph = s * 0.42 / SC - t * 4.2 + id * 1.9;
  return pathAt(id, d) + (sd * sin(ph) * 1.6 + up * cos(ph * 0.7 + 1.0) * 0.9) * SC * env;
}
void frameAt(float id, float s, float t, out vec3 P, out vec3 T, out vec3 sd, out vec3 up) {
  P = bodyPos(id, s, t);
  T = normalize(bodyPos(id, s - 0.5, t) - bodyPos(id, s + 0.5, t) + vec3(1e-5, 0.0, 0.0));
  vec3 u0 = upAt(id, uSpeed * t - s);
  sd = normalize(cross(u0, T) + vec3(0.0, 0.0, 1e-5));
  up = normalize(cross(T, sd));
}
`;

const VERT = () => /* glsl */ `
${COMMON()}
uniform float uViewH;
uniform vec2 uMouth;
uniform vec2 uBlink;
uniform float uOutW;
uniform float uObjH;
#ifdef HEAD
uniform mat4 uHeadM[2];
attribute float aId;
#endif
attribute vec4 aC;
attribute vec4 aS;
#ifdef BODY
attribute vec3 aInst;
#endif
varying vec3 vN;
varying vec3 vW;
varying vec3 vLN;
varying vec4 vS;
varying float vSeg;
varying float vKind;
varying float vId;
void main() {
  vec3 l = position;
  vec3 n = normal;
  float kind = aC.w;
  float show = 1.0;
#ifdef BODY
  float s = aInst.x;
  float k = aInst.y;
  float id = aInst.z;
  float part = aS.y;
  float r = radAt(s) * uPop;
  if (part > 0.5 && part < 1.5) show = (mod(k, 2.0) < 0.5 && k > 0.5 && k < float(NSEG) - 3.5) ? 1.0 : 0.0;
  else if (part > 1.5 && part < 3.5) {
    show = (abs(k - float(LEG1)) < 0.5 || abs(k - float(LEG2)) < 0.5) ? 1.0 : 0.0;
    float side = sign(aC.x);
    float a = sin(uT * 7.0 + k * 0.7 + side * 1.6 + id * 2.0) * 0.55;
    float c = cos(a), sn = sin(a);
    vec3 q = l - aC.xyz;
    q.yz = vec2(c * q.y - sn * q.z, sn * q.y + c * q.z);
    n.yz = vec2(c * n.y - sn * n.z, sn * n.y + c * n.z);
    l = aC.xyz + q;
  } else if (part > 3.5) show = k > float(NSEG) - 1.5 ? 1.0 : 0.0;
  if (part > 0.5 && part < 1.5) l.z += sin(uT * 5.0 - k * 0.6) * 0.08 * l.y;
  l *= show;
  if (part > 3.5) {
    l *= uPop * 0.95 * SC;
    l.x += sin(uT * 4.0 + l.z / SC + id) * 0.12 * l.z;
  } else l *= r;
  float d = uSpeed * uT - s;
  vec3 c0 = pathAt(id, d);
  float turn = length(normalize(pathAt(id, d + 4.0 * SC) - c0) - normalize(c0 - pathAt(id, d - 4.0 * SC)));
  float sq = min(0.2, turn * 0.3);
  l.z *= 1.0 - sq;
  l.xy *= 1.0 + sq * 0.5;
  vec3 P, T, sd, up;
  frameAt(id, s, uT, P, T, sd, up);
  vec3 w = P + sd * l.x + up * l.y + T * l.z;
  vec3 N = normalize(sd * n.x + up * n.y + T * n.z);
  vSeg = (s - l.z) / SC;
  float mouth = 0.0;
#else
  float id = aId;
  bool b1 = id > 0.5;
  float blink = b1 ? uBlink.y : uBlink.x;
  float mouth = b1 ? uMouth.y : uMouth.x;
  mat4 M = b1 ? uHeadM[1] : uHeadM[0];
  vec3 cc = aC.xyz;
  if (kind > 0.5 && kind < 1.5) l.y = cc.y + (l.y - cc.y) * (1.0 - 0.9 * blink);
  else if (kind > 1.5 && kind < 2.5) l = cc + (l - cc) * max(mouth, 0.001);
  else if (kind > 2.5 && kind < 3.5) {
    float side = sign(cc.x);
    float a = (sin(uT * 4.0 + side + id * 1.3) * 0.22 + 0.1) * side;
    vec3 q = l - cc;
    float c = cos(a), sn = sin(a);
    q.xy = vec2(c * q.x - sn * q.y, sn * q.x + c * q.y);
    l = cc + q;
  } else if (kind > 3.5 && kind < 4.5) {
    float dd = length(l - cc);
    l.y += sin(uT * 5.0 - dd * 2.2 + id) * 0.16 * dd;
    l.z += cos(uT * 4.0 - dd * 2.0) * 0.08 * dd;
  } else if (kind > 4.5) l.y += sin(uT * 3.0 + id * 1.5) * 0.12;
  vec3 w = (M * vec4(l, 1.0)).xyz;
  vec3 N = normalize(mat3(M) * n);
  vSeg = 0.0;
#endif
#ifdef HULL
  vec4 mv0 = viewMatrix * vec4(w, 1.0);
  float pix = 2.0 * max(-mv0.z, 0.1) / (projectionMatrix[1][1] * uViewH);
  float ow = clamp(uOutW, 1.5 * pix, 3.0 * pix) * step(24.0, uObjH / pix) * show;
  if (kind > 1.5 && kind < 2.5) ow *= mouth;
  w += N * ow;
#endif
  vN = N;
  vW = w;
  vLN = n;
  vS = aS;
  vKind = kind;
  vId = id;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const FRAG = () => /* glsl */ `
uniform float uT;
uniform float uPulse;
uniform vec3 uCol[NSLOT * 2];
uniform vec3 uSh[NSLOT * 2];
uniform vec3 uRimC;
uniform vec3 uInk;
uniform vec3 uCore;
uniform vec3 uRimS;
uniform vec4 uLook;
uniform vec2 uBlink;
varying vec3 vN;
varying vec3 vW;
varying vec3 vLN;
varying vec4 vS;
varying float vSeg;
varying float vKind;
varying float vId;
const vec3 L = normalize(vec3(0.35, 0.85, 0.4));
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 toy(vec3 base, vec3 sh, vec3 n, vec3 v) {
  float ndl = dot(n, L) * 0.5 + 0.5;
  vec3 c = mix(sh, base, smoothstep(0.3, 0.42, ndl));
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
  int o = vId > 0.5 ? NSLOT : 0;
  int slot = int(vS.x + 0.5);
  vec3 base = uCol[slot + o];
  vec3 sh = uSh[slot + o];
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
    base = mix(base, uCol[2 + o], spot);
    sh = mix(sh, uSh[2 + o], spot);
    // bụng kem có vạch
    float belly = smoothstep(-0.32, -0.5, ln.y);
    float line = 1.0 - smoothstep(0.05, 0.1, abs(fract(vSeg * 1.4) - 0.5));
    base = mix(base, mix(uCol[1 + o], uSh[1 + o], line * 0.6), belly);
    sh = mix(sh, mix(uSh[1 + o], uCol[1 + o], 0.5), belly);
  }
  c = toy(base, sh, n, v);
#else
  if (vKind > 0.5 && vKind < 1.5) {
    // mắt: lòng trắng kem, tròng to, đồng tử, 2 đốm sáng
    vec2 e = vS.zw - (vId > 0.5 ? uLook.zw : uLook.xy);
    float di = length(e * vec2(1.0, 0.92));
    vec3 iris = mix(uCol[7 + o], ${g3(PAL.grape[500])}, smoothstep(0.0, -0.7, e.y) * 0.75);
    c = mix(uCol[10 + o], iris, 1.0 - smoothstep(0.7, 0.74, di));
    c = mix(c, ${g3(PAL.night[700])}, 1.0 - smoothstep(0.34, 0.38, length(e)));
    float h1 = 1.0 - smoothstep(0.17, 0.2, length(e - vec2(-0.24, 0.27)));
    float h2 = 1.0 - smoothstep(0.08, 0.1, length(e - vec2(0.24, -0.26)));
    c = mix(c, uCol[10 + o], max(h1, h2));
    c = mix(c, uCol[7 + o], smoothstep(0.5, 0.7, vId > 0.5 ? uBlink.y : uBlink.x));
    c += uRimC * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.2;
  } else if (vKind > 1.5 && vKind < 2.5) {
    // miệng há: lòng berry-700, lưỡi berry-500
    c = mix(uCol[8 + o], ${g3(PAL.berry[500])}, smoothstep(-0.2, -0.45, vS.w));
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

// Hạt (1 Points cho cả đôi): aSeed.x < 0,5 ⇒ rồng 0, ngược lại rồng 1 (rx = fract(2x) là số ngẫu nhiên).
// aSeed.w: < 0,5 lấp lánh rơi từ thân · < 0,86 hơi thở → trái tim lớn trên trời (luồng chéo nhau)
// · < 0,96 lấp lánh "chào nhau" khi hai rồng lướt qua · < 0,99 sao quanh ngọc · còn lại quầng ngọc.
const PTS = () => /* glsl */ `
${COMMON()}
uniform float uPx;
uniform float uBreathT;
uniform vec3 uHeart;
uniform vec4 uCross;
uniform vec3 uPearl[2];
attribute vec4 aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying float vRot;
vec2 heartXY(float th) {
  float s = sin(th);
  return vec2(16.0 * s * s * s, 13.0 * cos(th) - 5.0 * cos(2.0 * th) - 2.0 * cos(3.0 * th) - cos(4.0 * th) + 4.0);
}
void main() {
  vec3 p = vec3(0.0); float alpha = 0.0; float size = 0.5;
  float id = step(0.5, aSeed.x);
  float rx = fract(aSeed.x * 2.0);
  vec3 rd = normalize(vec3(rx, aSeed.y, aSeed.z) - 0.5 + 1e-4);
  vColor = aColor;
  vRot = (rx - 0.5) * 1.2;
  vShape = 0.0;
  if (aSeed.w < 0.5) {
    // lấp lánh rơi từ thân
    float te = aSeed.w / 0.5 * 24.0;
    float age = uT - te;
    float life = 1.1 + rx * 1.3;
    float s = aSeed.y * uLb;
    p = bodyPos(id, s, te) + rd * (radAt(s) * 1.05 + age * 0.9) - vec3(0.0, 0.7 * age * age, 0.0);
    alpha = (age < 0.0 || age > life) ? 0.0 : 1.0 - smoothstep(life * 0.5, life, age);
    alpha *= 0.65 + 0.35 * sin(age * 20.0 + aSeed.z * 30.0);
    size = (0.35 + 0.4 * aSeed.z) * SC;
    vShape = aSeed.z < 0.4 ? 1.0 : 0.0;
    if (vShape > 0.5) vColor = ${g3(PAL.honey[500])};
    vRot += age * 2.0;
  } else if (aSeed.w < 0.86) {
    // hơi thở: bắn từ miệng lên trời, hai luồng chéo nhau thành một trái tim lớn (mặt XY, nhìn được từ cả hai phía)
    float f = (aSeed.w - 0.5) / 0.36;
    float te = uBreathT + f * 1.5;
    float age = uT - te;
    vec3 P, T, sd, up;
    frameAt(id, -0.6 * SC, te, P, T, sd, up);
    vec3 mouth = P + (T * 2.6 - up * 0.95) * SC;
    float side = mouth.x < uHeart.x ? 1.0 : -1.0; // rồng bên trái vẽ nửa phải ⇒ luồng chéo
    float th = aSeed.y * 3.14159;
    bool edge = aSeed.z < 0.8;
    vec2 hx = heartXY(th);
    hx.x *= side;
    if (!edge) hx *= 0.25 + 0.6 * sqrt(aSeed.z);
    vec3 tgt = uHeart + vec3(hx * 0.62, (rx - 0.5) * 1.5);
    float fl = 1.15 + rx * 0.3;
    float u = clamp(age / fl, 0.0, 1.0);
    u = 1.0 - (1.0 - u) * (1.0 - u);
    vec3 ctrl = mix(mouth, tgt, 0.5) + vec3(-side * 6.0, 4.0, 0.0) + rd * 2.0;
    p = mix(mix(mouth, ctrl, u), mix(ctrl, tgt, u), u);
    float hold = uBreathT + 4.4;
    float gone = max(0.0, uT - hold);
    p += vec3(sin(uT * 2.0 + rx * 20.0), cos(uT * 1.7 + aSeed.y * 20.0), 0.0) * 0.18 * u;
    p += (normalize(tgt - uHeart + rd) * 4.0 * gone - vec3(0.0, 1.2 * gone * gone, 0.0));
    float life = 6.2 + rx * 0.6 - f * 1.5;
    alpha = (age < 0.0 || age > life) ? 0.0 : 1.0 - smoothstep(life - 1.2, life, age);
    float grow = smoothstep(0.0, 0.3, age) * (1.0 + 0.12 * sin(uT * 6.0 + aSeed.y * 9.0) * u);
    float kx = fract(aSeed.y * 7.13 + rx);
    if (edge && kx < 0.62) { vShape = 2.0; size = 1.25 + 0.5 * aSeed.z; vColor = mix(${g3(PAL.berry[500])}, ${g3(PAL.berry[300])}, step(0.5, rx)); }
    else if (kx < 0.85) { vShape = 1.0; size = 1.0 + 0.5 * aSeed.z; vColor = mix(${g3(PAL.honey[500])}, ${g3(PAL.honey[300])}, step(0.5, rx)); }
    else { vShape = 0.0; size = 0.8 + 0.4 * aSeed.z; vColor = ${g3(PAL.cream[100])}; }
    size *= grow;
    vRot += sin(age * 3.0 + rx * 6.0) * 0.4;
  } else if (aSeed.w < 0.96) {
    // chào nhau: chùm lấp lánh nổ ra giữa hai đầu khi lướt qua
    float f = (aSeed.w - 0.86) / 0.1;
    int ci = int(min(3.0, floor(f * 4.0)));
    float tc = ci == 0 ? uCross.x : ci == 1 ? uCross.y : ci == 2 ? uCross.z : uCross.w;
    float age = uT - tc + 0.15;
    float d = uSpeed * tc + 0.6 * SC;
    vec3 c = (pathAt(0.0, d) + pathAt(1.0, d)) * 0.5;
    float sp = 6.0 + 6.0 * aSeed.z;
    p = c + rd * sp * (1.0 - exp(-age * 2.2)) / 2.2 + vec3(0.0, 0.6 * age, 0.0);
    float life = 1.4 + rx * 0.8;
    alpha = (age < 0.0 || age > life) ? 0.0 : 1.0 - smoothstep(life * 0.45, life, age);
    alpha *= 0.7 + 0.3 * sin(age * 18.0 + rx * 20.0);
    vShape = aSeed.y < 0.5 ? 0.0 : 1.0;
    size = (0.7 + 0.6 * aSeed.z) * smoothstep(0.0, 0.12, age);
    vRot += age * 3.0;
  } else if (aSeed.w < 0.99) {
    // sao nhỏ quay quanh ngọc
    vec3 pc = id > 0.5 ? uPearl[1] : uPearl[0];
    float a = uT * 2.4 * (id > 0.5 ? -1.0 : 1.0) + rx * 6.2832;
    float rr = (1.15 + 0.15 * sin(uT * 3.0 + aSeed.y * 9.0)) * SC;
    p = pc + vec3(cos(a) * rr, sin(a * 2.0 + aSeed.z * 6.0) * 0.35, sin(a) * rr);
    alpha = uPop;
    size = 0.38 * SC;
    vShape = 1.0;
    vColor = ${g3(PAL.honey[500])};
    vRot = a;
  } else {
    // quầng ngọc
    p = id > 0.5 ? uPearl[1] : uPearl[0];
    alpha = 0.55 * uPop;
    size = (3.4 + 0.4 * sin(uT * 4.0)) * SC;
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

/** Getter: chuỗi GLSL dựng lúc đọc để lấy màu của phong cách đang bật. */
export const DRAGON_GLSL = { get vert() { return VERT(); }, get frag() { return FRAG(); }, get pts() { return PTS(); } };
