// GLSL cho phi đội phản lực chibi (secretJet.ts).
import { PAL, hexToRgb } from '../../world/style';

const g3 = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;

const vert = /* glsl */ `
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
#ifdef HULL
  vec4 mv0 = viewMatrix * vec4(w, 1.0);
  float pix = 2.0 * max(-mv0.z, 0.1) / (projectionMatrix[1][1] * uViewH);
  float ow = clamp(uOutW, 1.5 * pix, 3.0 * pix) * step(24.0, uObjH / pix);
  if (aJ.y > 0.5 && aJ.y < 1.5) ow = 0.0;
  w += N * ow;
#endif
  vN = N; vW = w; vLN = normal; vCol = aCol; vShc = aSh; vJ = aJ;
  gl_Position = vis < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const frag = /* glsl */ `
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

const trailVert = /* glsl */ `
uniform float uT;
uniform float uLife;
uniform vec3 uHeart;
uniform float uBeat;
uniform float uDone;
attribute vec3 aTan; attribute vec3 aCol; attribute vec3 aEdge; attribute vec4 aInfo; // emit, side, jet, arc
varying vec3 vCol; varying vec3 vEdge; varying float vFade; varying float vSide; varying float vArc; varying float vAge;
void main() {
  float age = uT - aInfo.x;
  vec3 c = position;
  float a = max(age, 0.0);
  c += vec3(0.3 + 0.2 * sin(aInfo.x * 3.1 + aInfo.z), -0.1 + 0.08 * cos(aInfo.x * 2.3), 0.15 * sin(aInfo.x * 1.7)) * a;
  // tim hoàn thành: đập nhẹ theo phách
  if (aInfo.z < 1.5) c = uHeart + (c - uHeart) * (1.0 + uDone * (0.025 * sin(uT * 6.0) + 0.02 * uBeat));
  float w = 1.25 + a * 0.32;
  vec3 vd = normalize(cameraPosition - c);
  vec3 sd = cross(aTan, vd);
  float l = length(sd);
  sd = l > 1e-4 ? sd / l : vec3(0.0, 1.0, 0.0);
  c += sd * aInfo.y * w * 1.25;
  vSide = aInfo.y * 1.25;
  vArc = aInfo.w / w;
  vAge = age;
  vFade = age < 0.0 ? 0.0 : smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(uLife * 0.45, uLife, age));
  vCol = aCol; vEdge = aEdge;
  gl_Position = projectionMatrix * viewMatrix * vec4(c, 1.0);
}`;

const trailFrag = /* glsl */ `
varying vec3 vCol; varying vec3 vEdge; varying float vFade; varying float vSide; varying float vArc; varying float vAge;
void main() {
  if (vFade < 0.004) discard;
  // mép gợn mây: bướu tròn nối tiếp
  float ph = fract(vArc * 0.42);
  float bump = sqrt(max(1.0 - pow(ph * 2.0 - 1.0, 2.0), 0.0));
  float edge = (0.72 + 0.28 * bump) * (0.55 + 0.45 * vFade);
  float d = abs(vSide);
  float aa = fwidth(vSide) * 1.2;
  float a = 1.0 - smoothstep(edge - aa, edge + aa, d);
  if (a < 0.01) discard;
  vec3 cream = ${g3(PAL.cream[300])};
  vec3 col = mix(cream, vCol, smoothstep(0.2, 1.0, vAge));
  // phồng: giữa sáng, mép đậm kiểu sticker
  col = mix(col, cream, (1.0 - d / edge) * 0.35 * bump);
  col = mix(col, vEdge, smoothstep(edge - 0.2, edge - 0.06, d) * 0.75);
  gl_FragColor = vec4(col, a * (0.55 + 0.4 * vFade));
}`;

const ptsVert = /* glsl */ `
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
}`;

export const JET_GLSL = { vert, frag, trailVert, trailFrag, ptsVert };
