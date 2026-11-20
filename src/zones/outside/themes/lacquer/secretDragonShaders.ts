// GLSL cho đôi rồng Lý (L2). Không có màu nào chép cứng: mọi màu là uniform đọc token lúc dựng.
import { LB, R0 } from './secretDragonGeo';

const f = (x: number) => x.toFixed(4);

/** Đường bay + khung thân (khớp CPU trong secretDragon.ts). */
export const PATH_GLSL = (ns: number) => /* glsl */ `
uniform sampler2D uPath;
uniform vec2 uLen;
uniform vec2 uD;
uniform float uT;
#define NS ${ns}
#define LB ${f(LB)}
#define R0 ${f(R0)}
#define WK ${f((2 * Math.PI) / 9.5)}
#define WW 2.0
#define AL 1.25
#define AV 0.55
float sm01(float a, float b, float x) { return smoothstep(a, b, x); }
vec3 rowAt(int row, float d, float len) {
  float x = clamp(d / len, 0.0, 1.0) * float(NS - 1);
  int a = int(floor(x)); int b = min(a + 1, NS - 1);
  return mix(texelFetch(uPath, ivec2(a, row), 0).xyz, texelFetch(uPath, ivec2(b, row), 0).xyz, x - float(a));
}
float lenOf(int id) { return id == 0 ? uLen.x : uLen.y; }
vec3 pathPos(int id, float d) {
  float len = lenOf(id); float ds = len / float(NS - 1);
  if (d < 0.0) { vec3 p0 = rowAt(id * 2, 0.0, len); return p0 + (p0 - rowAt(id * 2, ds, len)) * (-d / ds); }
  if (d > len) { vec3 p1 = rowAt(id * 2, len, len); return p1 + (p1 - rowAt(id * 2, len - ds, len)) * ((d - len) / ds); }
  return rowAt(id * 2, d, len);
}
vec3 pathUp(int id, float d) { return normalize(rowAt(id * 2 + 1, d, lenOf(id))); }
float radAt(float s) {
  return R0 * (0.84 + 0.16 * sm01(0.0, 2.5, s)) * (1.0 - 0.88 * pow(clamp(s / LB, 0.0, 1.0), 1.15)) * (1.0 + 0.07 * sin(s * 0.55 + 1.3));
}
vec3 centerAt(int id, float s) {
  float dd = (id == 0 ? uD.x : uD.y) - s;
  vec3 p = pathPos(id, dd);
  vec3 t = normalize(pathPos(id, dd + 0.7) - pathPos(id, dd - 0.7) + vec3(0.0, 1e-5, 0.0));
  vec3 up = pathUp(id, dd);
  vec3 sd = normalize(cross(up, t) + vec3(1e-5, 0.0, 0.0));
  vec3 u = cross(t, sd);
  float env = 0.15 + 0.85 * sm01(0.0, 7.0, s);
  float ph = s * WK - uT * WW;
  float sg = id == 0 ? 1.0 : -1.0;
  return p + sd * (sg * sin(ph) * AL * env) + u * (cos(ph * 0.8 + 1.0) * AV * env);
}
void frameAt(int id, float s, out vec3 C, out vec3 T, out vec3 S, out vec3 U) {
  C = centerAt(id, s);
  T = normalize(centerAt(id, s - 0.45) - centerAt(id, s + 0.45) + vec3(0.0, 1e-5, 0.0));
  vec3 up = pathUp(id, (id == 0 ? uD.x : uD.y) - s);
  S = normalize(cross(up, T) + vec3(1e-5, 0.0, 0.0));
  U = cross(T, S);
}
`;

export const BODY_VERT = (ns: number) => /* glsl */ `
${PATH_GLSL(ns)}
attribute vec3 aP;
attribute vec3 aN;
attribute vec4 aK;
attribute float aId;
uniform float uViewH;
varying vec3 vN;
varying vec4 vK;
varying float vS;
varying float vAng;
varying float vLy;
varying float vDD;
varying float vId;
varying vec3 vW;
void main() {
  int id = int(aId + 0.5);
  float mode = aK.y;
  float s = mode > 1.5 ? 0.0 : -aP.z;
  vec3 C, T, S, U;
  frameAt(id, s, C, T, S, U);
  vec3 loc = mode > 1.5 ? aP : vec3(aP.xy, 0.0);
  if (mode > 0.5 && mode < 1.5) loc.xy *= radAt(s);
  float w = aK.z;
  loc += vec3(sin(uT * 2.1 + aK.w * 5.0 + aP.x * 0.7) * 0.32, sin(uT * 1.7 + aK.w * 4.0 + 1.0) * 0.26, 0.0) * w;
  vec3 n = normalize(S * aN.x + U * aN.y + T * aN.z);
  vec3 wp = C + S * loc.x + U * loc.y + T * loc.z;
#ifdef HULL
  if (aK.x > 4.5 && aK.x < 6.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float dist = length(cameraPosition - wp);
  wp += n * (1.7 * 2.0 * dist / (uViewH * projectionMatrix[1][1]));
#endif
  vN = n; vK = aK; vS = s; vAng = atan(aP.y, aP.x); vLy = aN.y; vId = aId; vW = wp;
  vDD = (id == 0 ? uD.x : uD.y) - (mode > 1.5 ? 0.0 : -aP.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

export const BODY_FRAG = /* glsl */ `
uniform vec3 uBody[2]; uniform vec3 uBodySh[2]; uniform vec3 uBodyHi[2];
uniform vec3 uBelly; uniform vec3 uBellySh;
uniform vec3 uRed; uniform vec3 uRedSh; uniform vec3 uRedHi;
uniform vec3 uMane[2]; uniform vec3 uManeSh[2];
uniform vec3 uMouth; uniform vec3 uPearlC; uniform vec3 uEye; uniform vec3 uClaw;
uniform vec3 uEdge[2];
uniform vec2 uFade;
uniform float uGlow;
varying vec3 vN; varying vec4 vK; varying float vS; varying float vAng; varying float vLy; varying float vDD; varying float vId; varying vec3 vW;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  int id = int(vId + 0.5);
  float kind = vK.x;
  bool tube = vK.y > 0.5 && vK.y < 1.5;
  // nét cọ "vẽ ra": mép lộ ra có sợi lông cọ
  float bristle = h21(vec2(floor(vAng * 4.5) + vId * 13.0, floor(vS * 0.7)));
  if (vDD < bristle * 1.6) discard;
  // đuôi bút khô: các sợi tách dần
  if (tube || kind > 1.5 && kind < 2.5 && vK.y < 0.5) {
    float tailF = smoothstep(0.7, 1.0, vS / LBF);
    float br = h21(vec2(floor(vAng * 3.2) + vId * 7.0, 1.0));
    if (br < tailF * 1.25 - 0.2 + 0.12 * sin(vS * 3.0 + br * 9.0)) discard;
  }
  // tan dần cuối màn (bút khô bốc hơi)
  float fd = id == 0 ? uFade.x : uFade.y;
  if (fd > 0.0 && h21(vec2(floor(vS * 6.0) + vAng * 0.0, floor(vAng * 6.0)) + vK.w) < fd) discard;
#ifdef HULL
  gl_FragColor = vec4(uEdge[id], 1.0);
  return;
#endif
  vec3 N = normalize(vN);
  vec3 L = normalize(vec3(0.25, 1.0, -0.2));
  float nl = dot(N, L);
  float lit = step(-0.08, nl);
  vec3 V = normalize(cameraPosition - vW);
  float sheen = step(0.965, dot(N, normalize(L + V)));
  vec3 col;
  if (kind < 1.5) {
    bool belly = vLy < -0.45 && kind < 0.5 && tube;
    if (belly) {
      col = mix(uBellySh, uBelly, lit);
      if (fract(vS * 2.4) < 0.1) col = mix(col, uBellySh, 0.75); // vạch bụng mảnh
    } else {
      col = mix(uBodySh[id], uBody[id], lit);
      col = mix(col, uBodyHi[id], sheen * lit);
    }
    if (tube && abs(vLy + 0.45) < 0.07) col = uEdge[id]; // chỉ khảm vàng viền bụng
  } else if (kind < 2.5) {
    col = mix(uRedSh, uRed, lit);
    col = mix(col, uRedHi, smoothstep(0.55, 0.95, vK.w) * 0.8);
  } else if (kind < 3.5) {
    col = mix(uManeSh[id], uMane[id], lit);
  } else if (kind < 4.5) {
    col = uMouth;
  } else if (kind < 5.5) {
    col = uPearlC * (1.0 + 0.35 * uGlow);
  } else if (kind < 6.5) {
    col = uEye;
  } else {
    col = mix(uClaw * 0.7, uClaw, lit);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/** Vệt mực loang sau đuôi: dải ruy-băng quay về camera dọc đường bay. */
export const TRAIL_VERT = (ns: number) => /* glsl */ `
${PATH_GLSL(ns)}
attribute vec2 aUV;
attribute float aId;
uniform float uTL;
varying vec2 vUV; varying float vD; varying float vId;
void main() {
  int id = int(aId + 0.5);
  float dTail = (id == 0 ? uD.x : uD.y) - LB * 0.9;
  float d = dTail - aUV.x * uTL;
  vec3 p = pathPos(id, d);
  vec3 t = normalize(pathPos(id, d + 1.0) - pathPos(id, d - 1.0) + vec3(0.0, 1e-5, 0.0));
  vec3 side = normalize(cross(t, normalize(cameraPosition - p)) + vec3(0.0, 1e-5, 0.0));
  float w = 0.5 + 3.2 * aUV.x;
  p += side * aUV.y * w;
  vUV = aUV; vD = d; vId = aId;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
export const TRAIL_FRAG = /* glsl */ `
uniform vec3 uTrailC[2];
uniform vec2 uTrailA;
varying vec2 vUV; varying float vD; varying float vId;
float h11(float x) { return fract(sin(x * 91.7) * 43758.5); }
float n11(float x) { float i = floor(x); float f = fract(x); return mix(h11(i), h11(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main() {
  if (vD < 0.0) discard;
  int id = int(vId + 0.5);
  float v = vUV.y;
  float edge = 1.0 - smoothstep(0.45, 1.0, abs(v));
  float streak = 0.45 + 0.55 * n11(v * 9.0 + vId * 31.0 + vUV.x * 2.0);
  float dry = step(n11(v * 14.0 + 3.0 + vId * 5.0), 1.15 - vUV.x * 0.9);
  float along = pow(1.0 - vUV.x, 1.4) * smoothstep(0.0, 0.04, vUV.x);
  float a = (id == 0 ? uTrailA.x : uTrailA.y) * edge * streak * dry * along * 0.3 * smoothstep(0.0, 20.0, vD);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uTrailC[id], a);
}`;

/** Trăng–ngọc khảm vỏ trứng + chữ ký: vòng cọ hở ~320° màu ngọc + triện son. Billboard một quad. */
export const MOON_VERT = /* glsl */ `
uniform vec3 uMoon; uniform float uSize;
varying vec2 vP;
void main() {
  vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 u = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vP = position.xy * uSize;
  gl_Position = projectionMatrix * viewMatrix * vec4(uMoon + (r * position.x + u * position.y) * uSize, 1.0);
}`;
export const MOON_FRAG = /* glsl */ `
uniform float uT; uniform float uMoonA; uniform float uRing; uniform float uSeal; uniform float uFlare;
uniform float uRM; uniform float uRR; uniform float uSize;
uniform vec3 uShell; uniform vec3 uShellHi; uniform vec3 uCrack; uniform vec3 uGold; uniform vec3 uGlowC;
uniform vec3 uJade; uniform vec3 uJadeSh; uniform vec3 uSeal1; uniform vec3 uSeal2;
varying vec2 vP;
vec2 h22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 voro(vec2 x) {
  vec2 n = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0; vec2 cid = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 o = h22(n + g); vec2 r = g + o - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; cid = n + g; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d2) - sqrt(d1), h21(cid), 0.0);
}
void over(inout vec4 acc, vec3 c, float a) { acc.rgb = mix(acc.rgb, c, a); acc.a = a + acc.a * (1.0 - a); }
void main() {
  float r = length(vP);
  float th = atan(vP.y, vP.x);
  vec4 acc = vec4(0.0);
  // quầng sáng
  float glow = exp(-max(r - uRM, 0.0) / (1.6 + 2.5 * uFlare)) * (0.35 + 0.65 * uFlare);
  float rays = pow(abs(cos(th * 7.0 + uT * 0.25)), 24.0) * exp(-max(r - uRM, 0.0) / 4.0) * uFlare;
  acc = vec4(uGlowC, clamp((glow * 0.55 + rays * 0.5) * uMoonA * step(uRM, r), 0.0, 1.0));
  // đĩa trăng khảm vỏ trứng
  if (r < uRM) {
    vec3 v = voro(vP * 1.35 + 3.0);
    vec3 c = mix(uShell, uShellHi, step(0.55, v.y));
    c = mix(c, uCrack, (1.0 - smoothstep(0.03, 0.09, v.x)) * 0.85);
    if (dot(vP, normalize(vec2(-0.6, -0.8))) > uRM * 0.55) c = mix(c, uCrack, 0.18);
    c = mix(c, uShellHi, uFlare * 0.45);
    float a = smoothstep(uRM, uRM - 0.08, r) * uMoonA;
    over(acc, c, a);
  }
  // viền khảm vàng
  over(acc, uGold, (1.0 - smoothstep(0.05, 0.14, abs(r - uRM))) * uMoonA);
  // vòng cọ hở 320°: đầu nét ấn đậm, đuôi khô
  float th0 = 1.25;
  float u = mod(th0 - th, 6.2832) / 5.585; // vẽ theo chiều kim đồng hồ từ th0
  if (u <= 1.0 && u <= uRing) {
    float rr = uRR + 0.18 * sin(u * 7.0) + 0.1 * sin(u * 19.0);
    float w = 0.16 + 0.42 * pow(sin(3.1416 * pow(u, 0.75)), 0.8) + 0.12 * smoothstep(0.08, 0.0, u);
    float x = (r - rr) / w;
    float m = 1.0 - smoothstep(0.85, 1.0, abs(x));
    float dry = step(h21(vec2(floor(x * 7.0 + 7.0), 3.0)), 1.6 - u * 1.4 + 0.25 * sin(u * 40.0));
    float tip = smoothstep(uRing, uRing - 0.03, u);
    vec3 c = mix(uJadeSh, uJade, step(-0.15, x));
    over(acc, c, m * dry * mix(1.0, tip, step(uRing, 0.999)));
  }
  // triện son ở chỗ hở
  if (uSeal > 0.0) {
    float tg = th0 + (6.2832 - 5.585) * 0.5;
    vec2 c = uRR * vec2(cos(tg), sin(tg)) * 1.04;
    float hs = 0.62 * (1.0 + 0.6 * (1.0 - uSeal));
    vec2 q = (vP - c) / hs;
    q = mat2(0.985, -0.17, 0.17, 0.985) * q;
    vec2 aq = abs(q);
    float box = step(max(aq.x, aq.y), 1.0);
    float rough = step(0.12, h21(floor(q * 9.0 + 20.0)));
    float carve = step(max(aq.x, aq.y), 0.78) * step(0.66, max(aq.x, aq.y));
    float glyph = step(aq.x, 0.09) * step(aq.y, 0.6) + step(abs(q.y - 0.3), 0.07) * step(aq.x, 0.5) + step(abs(q.y + 0.25), 0.07) * step(aq.x, 0.42);
    vec3 col = mix(uSeal1, uSeal2, clamp(carve + glyph, 0.0, 1.0));
    over(acc, col, box * mix(1.0, rough, 0.35) * uSeal);
  }
  acc *= 1.0 - smoothstep(uSize * 0.55, uSize * 0.97, max(abs(vP.x), abs(vP.y)));
  if (acc.a < 0.003) discard;
  gl_FragColor = vec4(acc.rgb, acc.a);
}`;

/** Hạt: quầng ngọc ở miệng (2) + vảy vàng quỳ rơi khi chầu nguyệt. */
export const PTS_VERT = /* glsl */ `
attribute vec4 aSeed; attribute vec3 aColor;
uniform float uT; uniform float uPx; uniform vec3 uPearl[2]; uniform float uPearlA; uniform vec3 uMoon; uniform float uRain;
varying vec3 vColor; varying float vAlpha; varying float vKind; varying float vRot;
void main() {
  vec3 p; float size; vAlpha = 0.0; vKind = aSeed.w; vRot = 0.0;
  if (aSeed.w < 0.5) {
    p = uPearl[int(aSeed.x + 0.5)];
    size = 3.2; vAlpha = uPearlA;
  } else {
    float ts = 10.8 + aSeed.x * 4.6;
    float age = uT - ts;
    float life = 4.5 + aSeed.z;
    p = uMoon + vec3((aSeed.y - 0.5) * 28.0, (aSeed.z - 0.5) * 8.0 + 1.0, (fract(aSeed.x * 7.31) - 0.5) * 9.0);
    p += vec3(sin(age * 1.3 + aSeed.y * 20.0) * 0.9, -age * (2.2 + aSeed.z * 1.6), cos(age * 1.1 + aSeed.x * 9.0) * 0.5);
    size = 0.45 + 0.35 * aSeed.z;
    vAlpha = (age > 0.0 && age < life) ? smoothstep(0.0, 0.4, age) * smoothstep(life, life - 1.2, age) * uRain : 0.0;
    vAlpha *= 0.6 + 0.4 * sin(age * 7.0 + aSeed.y * 30.0);
    vRot = aSeed.y * 6.0 + age * 2.5;
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAlpha > 0.003 ? max(2.0, size * projectionMatrix[1][1] * uPx * 0.5 / max(-mv.z, 0.1)) : 0.0;
  vColor = aColor;
}`;
export const PTS_FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha; varying float vKind; varying float vRot;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a;
  if (vKind < 0.5) {
    float r = length(d) * 2.0;
    a = smoothstep(1.0, 0.0, r); a = a * a * 0.8 + 0.5 * smoothstep(0.3, 0.0, r);
  } else {
    float c = cos(vRot), s = sin(vRot);
    d = mat2(c, -s, s, c) * d;
    a = step(abs(d.x) * 1.7 + abs(d.y), 0.5);
  }
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}`;
