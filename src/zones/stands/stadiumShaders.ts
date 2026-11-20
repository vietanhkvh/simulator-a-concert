// Shader của khán đài (phong cách "Kẹo đêm"): khán giả chấm kẹo + lightstick sao/tim, kết cấu, đồ trang trí.
// Mọi màu lấy từ PAL (qua shade() theo độ bão hoà khu khán đài) hoặc từ uniform Hype dùng chung.
import { PAL, hexToRgb, shade } from '../../world/style';

/** Màu token → chuỗi vec3 GLSL, đã áp độ bão hoà của khu khán đài (0.75). */
export const g3 = (hex: number): string => {
  const [r, g, b] = hexToRgb(shade(hex, 'stands'));
  return `vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)})`;
};

export const CROWD_VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uPhase; uniform float uRes;
uniform vec3 uHA; uniform vec3 uHB; uniform vec3 uHC; // primary / secondary / accent của Hype (đã nhân bão hoà khu)
// hiệu ứng tương tác (JS nới mềm): bao 0..1 + tuổi (s)
uniform float uCheer; uniform float uCheerAge; uniform float uWave; uniform float uWavePos;
uniform float uHeart; uniform float uHeartAge; uniform float uFlash; uniform float uPyro; uniform float uPyroAge;
attribute vec2 aSeed; // seed, góc chuẩn hoá 0..1
varying vec3 vCol; varying float vShape;
#define NIGHT100 ${g3(PAL.night[100])}
#define CREAM100 ${g3(PAL.cream[100])}
#define CREAM300 ${g3(PAL.cream[300])}
#define CREAM500 ${g3(PAL.cream[500])}
#define GRAPE700 ${g3(PAL.grape[700])}
#define SODA500 ${g3(PAL.soda[500])}
#define BERRY700 ${g3(PAL.berry[700])}
#define BERRY500 ${g3(PAL.berry[500])}
#define BERRY300 ${g3(PAL.berry[300])}
#define HONEY300 ${g3(PAL.honey[300])}
#define HONEY500 ${g3(PAL.honey[500])}
#define PEACH500 ${g3(PAL.peach[500])}
float h11(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float heartIn(vec2 q){ float a = q.x*q.x + q.y*q.y - 1.0; return step(a*a*a - q.x*q.x*q.y*q.y*q.y, 0.0); }
float thump(float t){ float x = mod(t, 0.85); return exp(-x * 14.0) + 0.7 * exp(-max(x - 0.24, 0.0) * 14.0) * step(0.24, x); }
void main(){
  float sd = aSeed.x, ang = aSeed.y;
  vec3 p = position;
  float sway = sin(uPhase * 3.14159 + sd * 1.2 + ang * 6.0) * (0.15 + 0.45 * uHype);
  p.x += sway * cos(ang * 4.5);
  p.z += sway * sin(ang * 4.5) * 0.5;
  p.y += uPulse * uHype * 0.35 * step(0.4, sd);
  // màu theo 3 bảng Hype dùng chung: thấp = thưa, mỗi người một màu; cao = sóng primary ↔ secondary + lấp lánh accent
  float pick = fract(sd * 7.13);
  vec3 mixedC = pick < 0.5 ? uHA : (pick < 0.82 ? uHB : uHC);
  float w = 0.5 + 0.5 * sin(ang * 40.0 - uTime * 2.2 + uPhase * 0.5);
  vec3 wave = mix(uHA, uHB, w);
  float u = smoothstep(0.35, 0.85, uHype);
  vec3 c = mix(mixedC, wave, u);
  c = mix(c, uHC, step(0.9, fract(sd * 23.1)) * smoothstep(0.7, 1.0, uHype) * 0.8);
  float tw = 0.55 + 0.45 * sin(uTime * (2.0 + sd * 5.0) + sd * 40.0);
  float b = mix(tw, 0.8 + 0.2 * w, u * 0.7) * (0.55 + 0.4 * uHype + 0.3 * uPulse);
  float lit = step(mix(0.72, 0.08, smoothstep(0.0, 0.55, uHype)), fract(sd * 13.7)); // thưa khi Hype thấp
  vec3 col = mix(NIGHT100 * 0.55, c * b * 1.15, lit);
  float hold = step(0.08, fract(sd * 13.7)); // vài chỗ không giơ lightstick
  col *= hold;
  float sz = 1.7 + 1.1 * fract(sd * 91.7);
  float y = position.y;
  float da = abs(ang - 0.5) * 2.0; // 0 giữa khán đài xa, 1 hai đầu (cạnh sân khấu)
  // lightstick đầu sao / tim: nhiều ở tầng dưới (gần), ít ở tầng trên
  float tier1 = 1.0 - step(14.0, y);
  float stick = step(mix(0.97, 0.88, tier1), fract(sd * 5.37)) * hold;
  vShape = stick * (1.0 + step(0.5, fract(sd * 3.1)));
  col = mix(col, c * (0.85 + 0.3 * uPulse) * 1.25, stick);
  sz = mix(sz, mix(4.4, 6.6, tier1), stick);
  // 4: đèn flash điện thoại — bầu trời sao kem, lightstick tối đi
  if (uFlash > 0.001) {
    float ph = step(0.42, fract(sd * 31.7));
    float tk = 0.5 + 0.5 * sin(uTime * (5.0 + sd * 9.0) + sd * 91.0);
    vec3 pc = CREAM300 * (0.4 + 0.7 * tk * tk);
    col = mix(col, mix(col * 0.22, pc, ph), uFlash);
    sz += uFlash * ph * (0.5 + 0.8 * tk);
  }
  // 2: sóng sân vận động — đáy grape-700, sườn soda-500, bọt cream-100
  if (uWave > 0.001) {
    float dd = ang - uWavePos;
    float crest = exp(-dd * dd / 0.0012);
    float swell = exp(-dd * dd / 0.012);
    vec3 deep = GRAPE700 * (0.75 + 0.3 * h11(sd * 9.0));
    vec3 wc = mix(deep, SODA500 * 1.15, swell);
    wc = mix(wc, CREAM100 * 1.2, crest);
    col = mix(col, wc * hold, uWave);
    p.y += uWave * (crest * 3.5 + swell * 0.8);
    sz += uWave * (crest * 2.0 + swell * 0.6);
  }
  // 3: thả tim — hồng dâu, nhịp tim đập đôi + 3 trái tim khổng lồ ghép bằng chấm
  if (uHeart > 0.001) {
    float th = thump(uHeartAge);
    float a = (ang - 0.5) * 2.0 * 2.2619; // rad
    float hx = min(min(abs(a), abs(a - 1.15)), abs(a + 1.15)) * 100.0;
    float hs = 0.85 + 0.15 * th;
    float inH = heartIn(vec2(hx / (21.0 * hs), (y - 17.5) / (11.0 * hs)));
    vec3 pink = mix(BERRY700, BERRY300, sd);
    vec3 hc = mix(pink * (0.35 + 0.5 * th), mix(BERRY500, BERRY300, 0.5 * th) * (0.95 + 0.45 * th), inH);
    col = mix(col, hc, uHeart);
    sz += uHeart * (inH * (0.9 + 0.8 * th) + 0.3 * th);
    p.y += uHeart * th * 0.6;
  }
  // 5: pháo hoa — sóng honey/peach lan từ phía sân khấu ra + chớp lấp lánh kem
  if (uPyro > 0.001) {
    float front = uPyroAge * 0.95;
    float wash = smoothstep(0.0, 0.25, front - (1.0 - da));
    float fl = 0.55 + 0.45 * sin(uTime * 23.0 + sd * 70.0);
    vec3 warm = mix(PEACH500, HONEY500, fl) * (0.6 + 0.3 * fl);
    float cell = floor(ang * 36.0) + floor(y / 8.0) * 50.0;
    float bt = fract(uTime * 0.9 + h11(cell));
    float burst = exp(-bt * 5.0) * step(0.55, h11(cell + 7.0)) * step(0.5, fract(sd * 17.3));
    float edge = exp(-pow((front - (1.0 - da)) * 6.0, 2.0));
    col = mix(col, warm, min(1.0, uPyro * wash * 1.5)) + CREAM300 * (burst * 1.2 * wash + edge * 0.4) * uPyro;
    sz += uPyro * (wash * 0.4 + burst * 2.0 * wash + edge * 0.8);
  }
  // 1: hò reo — xung sáng chạy quanh bowl + cả khán đài nhảy, nhấp nháy honey/kem
  if (uCheer > 0.001) {
    float r = fract(uCheerAge * 0.85);
    float race = exp(-pow((da - r) * 7.0, 2.0));
    float fk = step(0.5, h11(floor(uTime * 12.0) + sd * 311.0));
    vec3 gold = mix(HONEY300, CREAM100, fk);
    col = mix(col, gold * (0.5 + 0.35 * fk), uCheer * 0.85) + CREAM300 * race * 0.9 * uCheer;
    p.y += uCheer * (1.4 * abs(sin(uTime * 8.0 + sd * 20.0)) + race * 1.5);
    sz += uCheer * (0.5 + 0.5 * fk + 2.0 * race);
  }
  vCol = col;
  gl_PointSize = sz * uRes;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const CROWD_FRAG = /* glsl */ `
varying vec3 vCol; varying float vShape;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = length(q);
  vec3 c = vCol; float m;
  if (vShape < 0.5) { // chấm kẹo: tròn mềm, bóng 2 bậc nhẹ + đốm highlight
    if (d > 1.0) discard;
    m = smoothstep(1.0, 0.8, d);
    c = c * (1.0 - 0.34 * smoothstep(0.45, 0.8, d));
    c += vec3(1.0, 0.96, 0.9) * smoothstep(0.3, 0.1, length(q - vec2(-0.36, -0.4))) * 0.4;
  } else if (vShape < 1.5) { // sao 5 cánh đầu tròn
    float a = mod(atan(q.x, -q.y), 1.25664) - 0.62832;
    float R = 1.0 - 0.52 * abs(a) / 0.62832;
    m = smoothstep(R + 0.1, R - 0.1, d);
    if (m < 0.01) discard;
    c = c * (1.0 - 0.28 * smoothstep(0.3, 0.9, d)) + vec3(1.0, 0.96, 0.9) * smoothstep(0.28, 0.06, length(q - vec2(-0.2, -0.3))) * 0.45;
  } else { // tim mập
    vec2 h = vec2(q.x * 1.15, -q.y * 1.15 + 0.2);
    float a = dot(h, h) - 1.0;
    float f = a * a * a - h.x * h.x * h.y * h.y * h.y;
    m = smoothstep(0.08, -0.08, f);
    if (m < 0.01) discard;
    c = c * (1.0 - 0.28 * smoothstep(0.4, 1.0, d)) + vec3(1.0, 0.96, 0.9) * smoothstep(0.26, 0.06, length(q - vec2(-0.4, -0.35))) * 0.45;
  }
  gl_FragColor = vec4(c * m, 1.0);
}`;

export const STRUCT_VERT = /* glsl */ `
uniform vec3 uTrim; uniform vec3 uTint; uniform float uPulse;
attribute vec3 color; attribute float aKind;
varying vec3 vCol;
void main(){
  vCol = aKind > 0.5 ? uTrim * (0.95 + 0.2 * uPulse) : color * uTint;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const STRUCT_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){ gl_FragColor = vec4(vCol, 1.0); }`;

export const decorVert = (cx: number, cz: number) => /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uChase; uniform float uCheerFx;
attribute vec3 color; attribute vec2 aUv; attribute vec4 aInfo; // aInfo = kind (0 biển, 1 bóng, 2 cờ, 3 đặc), a, b, c
varying vec3 vCol; varying vec2 vUv; varying float vKind; varying float vI;
void main(){
  vec3 p = position; float kind = aInfo.x; float inten = 1.0;
  if (kind > 1.5 && kind < 2.5) { // cờ đuôi nheo phấp phới
    vec2 dir = normalize(p.xz - vec2(${cx.toFixed(2)}, ${cz.toFixed(2)}));
    vec2 tg = vec2(-dir.y, dir.x);
    float wv = aInfo.y, ph = aInfo.z;
    float sp = 2.2 + 1.4 * uHype;
    p.xz += dir * sin(uTime * sp + ph) * 0.4 * wv + tg * cos(uTime * sp * 0.8 + ph * 1.7) * 0.3 * wv;
    p.y -= abs(sin(uTime * sp + ph)) * 0.12 * wv;
  } else if (kind > 0.5 && kind < 1.5) { // bóng đèn dây: sóng sáng chạy dọc hàng, nhanh hơn khi Hype cao (uChase tích luỹ ở JS)
    float ch = 0.5 + 0.5 * sin(aInfo.y * 0.45 - uChase);
    inten = 0.4 + 0.85 * ch * ch + uCheerFx;
  }
  vCol = color; vUv = aUv; vKind = kind; vI = inten;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
export const DECOR_FRAG = /* glsl */ `
uniform sampler2D uTex; uniform float uPulse;
varying vec3 vCol; varying vec2 vUv; varying float vKind; varying float vI;
void main(){
  if (vKind < 0.5) { vec4 t = texture2D(uTex, vUv); if (t.a < 0.02) discard; gl_FragColor = vec4(t.rgb * t.a, t.a); }
  else if (vKind < 1.5) { // bóng tròn + quầng mềm
    float d = length(vUv);
    float core = smoothstep(0.46, 0.34, d);
    float halo = pow(smoothstep(1.0, 0.25, d), 2.0);
    vec3 c = mix(vCol, vec3(1.0, 0.96, 0.9), core * 0.45) * vI;
    gl_FragColor = vec4(c * (core + halo * 0.7), core * 0.95);
  } else if (vKind < 2.5) { // cờ: 2 bậc, phần đuôi tối hơn và ngả tím
    vec3 c = mix(vCol, vCol * vec3(0.72, 0.62, 0.95), step(0.55, vUv.y));
    gl_FragColor = vec4(c, 1.0);
  } else gl_FragColor = vec4(vCol, 1.0);
}`;
