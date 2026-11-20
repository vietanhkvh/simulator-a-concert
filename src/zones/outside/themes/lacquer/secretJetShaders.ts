// "Mực & Sơn mài" · secretJet — shader (chuỗi có màu token là HÀM, đọc token lúc dựng: docs/THEMES.md mục 1).
// Mọi vật của màn (quad chữ S, hạc, đèn, ấn ký) khai báo vị trí trong toạ độ PHẲNG (u đông, v bắc, w về phía người xem)
// và đổi ra world bằng FIG_BASIS: mặt phẳng quay về camera QUANH TRỤC X (bảng dọc theo trục dài sân) → từ sân khấu
// (nhìn −Z) hay từ máy toàn cảnh (nhìn +Z) đều thấy bắc ở trên, đông bên phải, không bao giờ bị lật gương.
import { hexToRgb, RAMPS } from '../../../../world/style';

const g = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;

export const FIG_BASIS = /* glsl */ `
uniform vec3 uC;
vec3 figWorld(vec3 p) {
  vec3 f = cameraPosition - uC; f.x = 0.0; f = normalize(f);
  vec3 ey = normalize(vec3(0.0, 1.0, 0.0) - f * f.y);
  vec3 ex = cross(ey, f);
  return uC + ex * p.x + ey * p.y + f * p.z;
}`;

// ───────── Quad chữ S (SDF) ─────────
export const QUAD_VERT = /* glsl */ `
${FIG_BASIS}
uniform float uLift;
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * viewMatrix * vec4(figWorld(vec3(position.xy + vec2(0.0, uLift), 0.0)), 1.0);
}`;

export const quadFrag = () => {
  const R = RAMPS;
  return /* glsl */ `
precision highp float;
uniform sampler2D uSdf;
uniform vec4 uBox;     // u0, v0, w, h
uniform float uHead;   // tham số s đầu nét (0 bắc → 1 Cà Mau)
uniform float uFill;   // độ sáng lòng chữ S
uniform float uGlow;   // quầng + độ rực của nét sau khi hoàn thành
uniform float uDiss;   // tan từ dưới lên
uniform float uT;
varying vec2 vP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec4 sd = texture2D(uSdf, (vP - uBox.xy) / uBox.zw);
  float d = sd.r, s = sd.g, wf = sd.b;
  float aa = max(fwidth(d), 0.015);
  // nét cọ: dày–mỏng theo hướng, đầu nét phình như mực đang loang, khô nhẹ ở mép
  float behind = uHead - s;
  float shown = smoothstep(-0.002, 0.004, behind) * step(0.0005, uHead);
  float blot = exp(-max(behind, 0.0) * 70.0) * step(0.0, behind);
  float hw = 0.08 + 0.2 * wf + 0.2 * blot;
  hw *= 0.92 + 0.16 * noise(vec2(s * 90.0, 0.5));
  float stroke = (1.0 - smoothstep(hw - aa, hw + aa, abs(d))) * shown;
  // khảm vàng đứt đoạn ngay ngoài mép nét
  float eo = hw + 0.1;
  float edge = (1.0 - smoothstep(0.035 - aa, 0.035 + aa, abs(d - eo))) * step(0.0, d) * shown;
  float dash = smoothstep(0.2, 0.26, fract(s * 64.0 + sd.a * 0.5)) * (1.0 - smoothstep(0.86, 0.92, fract(s * 64.0 + sd.a * 0.5)));
  edge *= dash;
  // lòng chữ S: màng sáng mờ vàng quỳ-100, sáng hơn sát mép, vảy vàng lấp lánh
  float inside = 1.0 - smoothstep(-aa, aa, d);
  vec2 fc = fract(vP * 2.0) - 0.5;
  float flake = step(0.93, hash(floor(vP * 2.0))) * smoothstep(0.22, 0.05, length(fc)) * (0.5 + 0.5 * sin(uT * 3.0 + hash(floor(vP * 2.0) + 7.0) * 30.0));
  float fill = inside * uFill * (0.16 + 0.26 * exp(d * 0.7) + 0.35 * flake + 0.05 * noise(vP * 0.6 + uT * 0.2));
  // quầng cam đèn lồng ngoài mép
  float halo = step(0.0, d) * exp(-max(d - hw, 0.0) * 1.3) * 0.22 * uGlow * shown;
  vec3 cStroke = mix(${g(R.gold![300]!)}, ${g(R.silk![100]!)}, 0.3 + 0.4 * uGlow);
  vec3 col = mix(${g(R.gold![100]!)}, ${g(R.amber![300]!)}, 0.35) * fill + ${g(R.amber![500]!)} * halo;
  float a = fill * 0.12 + halo * 0.25;
  col = mix(col, cStroke * (1.0 + 0.25 * blot), stroke);
  a = mix(a, 1.0, stroke);
  col = mix(col, ${g(R.gold![500]!)} * 1.15, edge * (1.0 - stroke));
  a = max(a, edge);
  // tan từ dưới lên: mặt tan nhấp nhô, mép tan ửng cam
  float front = mix(uBox.y - 2.0, uBox.y + uBox.w + 4.0, uDiss) + (noise(vP * 0.45) - 0.5) * 6.0;
  float keep = smoothstep(front - 0.6, front + 1.4, vP.y);
  col += ${g(R.amber![300]!)} * (1.0 - smoothstep(0.0, 1.0, abs(vP.y - front - 0.4))) * a * step(0.001, uDiss) * 0.6;
  a *= keep; col *= keep;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;
};

// ───────── Hạc (InstancedBufferGeometry: hình phẳng mũi +x, đập cánh trong vertex shader) ─────────
export const CRANE_VERT = /* glsl */ `
${FIG_BASIS}
attribute vec3 aCol;
attribute vec3 aW;        // loại (0 thân, 1 cánh xa, 2 cánh gần), toạ độ vai (x, y)
attribute vec4 aI0;       // u, v, cos(hướng), sin(hướng)
attribute vec4 aI1;       // pha đập cánh, biên độ, tỉ lệ (âm = lật ngang), alpha
varying vec3 vCol;
varying float vA;
void main() {
  vec2 p = position.xy;
  if (aW.x > 0.5) {
    vec2 r = p - aW.yz;
    float ph = aI1.x + (aW.x < 1.5 ? 0.6 : 0.0);
    float amp = mix(0.32, cos(ph), aI1.y);      // 1 = cánh giơ cao, âm = cánh đập xuống
    r.y *= amp;
    r.x -= 0.18 * abs(r.y) * (1.0 - amp);
    p = aW.yz + r;
  }
  float sc = aI1.z;
  p.x *= sign(sc);
  p *= abs(sc);
  vec2 dir = aI0.zw;
  p = vec2(p.x * dir.x - p.y * dir.y, p.x * dir.y + p.y * dir.x);
  vCol = aCol; vA = aI1.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(figWorld(vec3(aI0.xy + p, 1.6)), 1.0);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

export const CRANE_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() { gl_FragColor = vec4(vCol, 1.0) * vA; }`;

// ───────── Points: sông đèn trời + đèn thả + 2 cụm đảo + sao vàng nền son ─────────
export const ptsVert = (spineN: number) => /* glsl */ `
${FIG_BASIS}
uniform float uT;
uniform float uPx;
uniform float uRiver;   // 0..1 sông đèn chảy vào
uniform float uIsle;    // 0..1 hai cụm đảo
uniform float uStar;
uniform float uHead;
uniform float uDiss;
uniform float uDrawT;   // thời lượng vạch nét (s)
uniform vec3 uSpine[${spineN}];
attribute vec4 aSeed;   // loại (0 sông, 1 đèn thả, 2 đảo, 3 sao), s1, s2, s3
varying float vA;
varying float vKind;
varying float vWarm;
varying float vTw;
vec3 spineAt(float s) {
  float f = clamp(s, 0.0, 1.0) * ${(spineN - 1).toFixed(1)};
  int k = int(min(floor(f), ${(spineN - 2).toFixed(1)}));
  vec3 a = uSpine[0], b = uSpine[1];
  for (int i = 0; i < ${spineN - 1}; i++) { if (i == k) { a = uSpine[i]; b = uSpine[i + 1]; } }
  return mix(a, b, f - float(k));
}
void main() {
  float kind = aSeed.x;
  vec3 p = position;
  float a = 0.0, size = 0.5, minPx = 2.0;
  vWarm = fract(aSeed.y * 13.7 + aSeed.z * 3.1);
  vTw = 1.0;
  if (kind < 0.5) {
    // sông đèn trời: trôi theo sống chữ S từ bắc xuống nam, nhấp nhô và bay lên nhẹ
    float s = fract(aSeed.y + uT * (0.035 + 0.02 * aSeed.w));
    vec3 sp = spineAt(s);
    float lat = (aSeed.z * 2.0 - 1.0);
    p = vec3(sp.x + lat * abs(lat) * sp.z * 0.7 + sin(uT * 0.6 + aSeed.w * 30.0) * 0.25,
             sp.y + 0.35 * sin(uT * 0.8 + aSeed.y * 40.0) + s * 0.0, 0.4 + aSeed.w * 1.0);
    float env = smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.93, 1.0, s));
    // chảy vào từ mũi bắc
    float arrive = smoothstep(s * 0.9, s * 0.9 + 0.1, uRiver * 1.05);
    a = env * arrive;
    size = 0.5 + 0.25 * aSeed.w; minPx = 3.0;
  } else if (kind < 1.5) {
    // đèn hạc thả dọc đường bay (bay lên rồi tắt dần)
    float age = uT - (3.4 + aSeed.w * uDrawT);
    p.y += max(age, 0.0) * 0.55;
    p.x += sin(age * 0.9 + aSeed.y * 20.0) * 0.3 * max(age, 0.0) * 0.3;
    a = smoothstep(0.0, 0.4, age) * (1.0 - smoothstep(3.5, 6.0, age));
    size = 0.5; minPx = 2.5;
  } else if (kind < 2.5) {
    // đảo: lấp lánh lần lượt
    float on = smoothstep(aSeed.y, aSeed.y + 0.18, uIsle);
    vTw = 0.8 + 0.2 * sin(uT * (3.0 + 2.0 * aSeed.z) + aSeed.z * 50.0);
    a = on * (1.0 + 0.6 * exp(-(uIsle - aSeed.y) * 8.0) * step(aSeed.y, uIsle));
    size = 0.9; minPx = 6.0;
  } else {
    a = uStar; size = 2.4; minPx = 16.0;
  }
  // tan: đèn bay lên, toả ra
  float dz = uDiss * uDiss;
  p.y += dz * (14.0 + 22.0 * fract(aSeed.z * 7.7)) * (kind > 2.5 ? 0.3 : 1.0);
  p.x += dz * (fract(aSeed.w * 5.3) - 0.5) * 8.0;
  a *= 1.0 - smoothstep(0.55, 1.0, uDiss) * (kind < 1.5 ? 1.0 : 1.4);
  vA = clamp(a, 0.0, 1.6);
  vKind = kind;
  vec4 mv = viewMatrix * vec4(figWorld(p), 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * projectionMatrix[1][1] * 0.5 * uPx / max(-mv.z, 1.0);
  gl_PointSize = vA < 0.004 ? 0.0 : clamp(px, minPx, 160.0);
}`;

export const ptsFrag = () => {
  const R = RAMPS;
  return /* glsl */ `
varying float vA;
varying float vKind;
varying float vWarm;
varying float vTw;
float star5(vec2 p, float r) {
  // SDF sao năm cánh (Inigo Quilez), đỉnh hướng lên
  const vec2 k1 = vec2(0.809016994, -0.587785252);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = 0.381966 * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
void main() {
  if (vA < 0.004) discard;
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  q.y = -q.y;
  vec3 col; float a;
  if (vKind < 1.5) {
    // đèn trời giấy: thân trụ bo, miệng dưới sáng, quầng cam
    float body = smoothstep(0.5, 0.36, length(vec2(q.x * 1.3, q.y * 0.95)));
    float mouth = smoothstep(0.3, 0.0, length(vec2(q.x * 1.6, q.y + 0.3)));
    float halo = smoothstep(1.0, 0.0, length(q));
    vec3 shell = mix(${g(R.amber![500]!)}, ${g(R.son![300]!)}, vWarm * 0.5);
    col = shell * body * (0.8 + 0.3 * (0.5 + q.y * 0.5)) + ${g(R.gold![100]!)} * mouth * body + ${g(R.amber![700]!)} * halo * halo * 0.6;
    a = max(body, halo * halo * 0.5);
  } else if (vKind < 2.5) {
    float r = length(q);
    float core = smoothstep(0.42, 0.22, r);
    float halo = smoothstep(1.0, 0.0, r);
    col = ${g(R.gold![100]!)} * core * 1.2 + ${g(R.amber![500]!)} * halo * halo * 0.9;
    a = max(core, halo * halo * 0.7);
    col *= vTw; a *= vTw;
  } else {
    float r = length(q);
    float aa = 0.03;
    float disc = 1.0 - smoothstep(0.62 - aa, 0.62 + aa, r);
    float rim = (1.0 - smoothstep(0.03 - aa, 0.03 + aa, abs(r - 0.66)));
    float st = 1.0 - smoothstep(-aa, aa, star5(q, 0.46));
    float halo = smoothstep(1.0, 0.55, r) * 0.5;
    col = ${g(R.son![500]!)} * disc;
    col = mix(col, ${g(R.gold![300]!)} * 1.1, st);
    col = mix(col, ${g(R.gold![500]!)}, rim * (1.0 - disc));
    col += ${g(R.amber![500]!)} * halo * (1.0 - disc) * 0.6;
    a = max(max(disc, rim), halo * 0.6);
  }
  gl_FragColor = vec4(col * vA, min(a * vA, 1.0));
}`;
};

// ───────── Ấn ký secret của phong cách: vòng cọ ngọc bích hở 40° + triện son ─────────
export const SIGIL_VERT = /* glsl */ `
${FIG_BASIS}
uniform vec2 uAt;
uniform float uR;
varying vec2 vQ;
void main() {
  vQ = position.xy * 1.25;
  vec4 mv = viewMatrix * vec4(figWorld(vec3(uAt, 1.2)), 1.0);
  mv.xy += position.xy * 1.25 * uR;
  gl_Position = projectionMatrix * mv;
}`;

export const sigilFrag = () => {
  const R = RAMPS;
  return /* glsl */ `
uniform float uA;
uniform float uT;
varying vec2 vQ;
float hash(float x) { return fract(sin(x * 91.7) * 43758.5453); }
void main() {
  float r = length(vQ);
  float ang = atan(vQ.y, vQ.x);                 // −π..π
  float aa = fwidth(r) * 1.2;
  // hở 40° ở góc trên phải; nét dày ở đáy, thanh dần về hai đầu (cọ nhấc)
  float a0 = radians(25.0) + uT * 0.25;
  float rel = mod(ang - a0 + 6.2831853, 6.2831853);  // 0 → 2π
  float span = 6.2831853 - radians(40.0);
  float k = rel / span;
  float on = step(k, 1.0);
  float w = 0.035 + 0.075 * sin(clamp(k, 0.0, 1.0) * 3.14159) * (0.8 + 0.2 * sin(k * 19.0));
  float ring = (1.0 - smoothstep(w - aa, w + aa, abs(r - 0.82))) * on;
  float dry = step(0.25, hash(floor(k * 60.0) + floor((r - 0.82) * 40.0)));
  ring *= mix(1.0, dry, smoothstep(0.75, 1.0, k));
  vec3 col = mix(${g(R.jade![500]!)}, ${g(R.jade![300]!)}, smoothstep(0.82, 0.9, r));
  // triện son: ô vuông đỏ với hai nét khắc sáng (không chữ)
  vec2 sq = vQ - vec2(0.62, -0.66);
  float box = max(abs(sq.x), abs(sq.y));
  float seal = 1.0 - smoothstep(0.17 - aa, 0.17 + aa, box);
  float carve = (1.0 - smoothstep(0.012, 0.03, abs(box - 0.12))) + (1.0 - smoothstep(0.012, 0.03, abs(sq.x))) * step(abs(sq.y), 0.08);
  vec3 sc = mix(${g(R.son![500]!)}, ${g(R.son![100]!)}, clamp(carve, 0.0, 1.0) * 0.7);
  float glow = exp(-abs(r - 0.82) * 9.0) * 0.25 * on;
  vec3 c = col * ring + ${g(R.jade![300]!)} * glow * (1.0 - ring);
  float a = max(ring, glow * 0.6);
  c = mix(c, sc, seal); a = max(a, seal);
  if (a * uA < 0.003) discard;
  gl_FragColor = vec4(c, a) * uA;
}`;
};
