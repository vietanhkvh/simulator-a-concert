// "Mực & Sơn mài" · khe `sky` (L5): vòm trời chàm, trăng khảm vỏ trứng + vòng ngọc nét cọ, mây cuộn viền vàng quỳ,
// 3 lớp núi đá vôi (Hạ Long) quanh chân trời, sao thưa + vảy vàng quỳ + vài sao 4 cánh, sao băng = nét cọ vàng, hạc thoáng qua trăng.
// Tất cả nằm trong MỘT draw call (vòm trời bám camera, shader tự vẽ); không máy bay, không sao băng đầu ngôi sao.
// Texture: trăng vỏ trứng + atlas 4 đám mây (canvas, dispose khi gỡ).
import * as THREE from 'three';
import { drawSize } from '../../../../world/shared/viewport';
import { hexToRgb, RAMPS, SKY } from '../../../../world/style';
import type { OutsideBuildContext, OutsideBuilders, SkyHandle } from '../../builders';

/** Hướng trăng (vector đơn vị): phương vị −12° (lệch trái), độ cao 34° — ngay trên khán đài xa nhìn từ ca sĩ. */
const MOON_AZ = -0.21, MOON_EL = THREE.MathUtils.degToRad(34);
export const LACQUER_MOON_DIR = new THREE.Vector3(
  Math.sin(MOON_AZ) * Math.cos(MOON_EL), Math.sin(MOON_EL), -Math.cos(MOON_AZ) * Math.cos(MOON_EL),
).normalize();
const DOME_R = 190;
const MOON_R = 0.11; // nửa cạnh ô trăng (rad) ≈ 6,3°
const CLOUD_N = 5;
export const COMET_POOL = 4;

const f = (x: number) => x.toFixed(4);
const rgb = (hex: number) => `vec3(${hexToRgb(hex).map(f).join(', ')})`;

/** Trăng vỏ trứng: nền kem, mảnh vỏ (voronoi) lệch sắc nhẹ, đường nứt nâu mảnh, viền ấm. */
export function createEggshellMoonTexture(): THREE.CanvasTexture {
  const S = 384;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const silk = RAMPS.silk!, gold = RAMPS.gold!;
  const cream = hexToRgb(silk[300]).map((x) => x * 255), warm = hexToRgb(gold[300]).map((x) => x * 255);
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const mk = (n: number) => {
    const s: { x: number; y: number; t: number }[] = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) s.push({ x: (i + 0.15 + rnd() * 0.7) / n, y: (j + 0.15 + rnd() * 0.7) / n, t: rnd() });
    return { n, s };
  };
  const big = mk(8), fine = mk(20);
  const vor = (set: ReturnType<typeof mk>, x: number, y: number) => {
    const ci = Math.floor(x * set.n), cj = Math.floor(y * set.n);
    let d1 = 9, d2 = 9, t = 0;
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      if (i < 0 || j < 0 || i >= set.n || j >= set.n) continue;
      const p = set.s[j * set.n + i]!;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < d1) { d2 = d1; d1 = d; t = p.t; } else if (d < d2) d2 = d;
    }
    return { e: (d2 - d1) * set.n, t };
  };
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = px / S, y = py / S, dx = x - 0.5, dy = y - 0.5, r = Math.hypot(dx, dy) * 2;
    const a = Math.min(1, Math.max(0, (1 - r) * S * 0.5));
    const vb = vor(big, x, y), vf = vor(fine, x, y);
    let k = 0.93 + vb.t * 0.1 + vf.t * 0.03;
    const rim = Math.pow(Math.max(0, r - 0.7) / 0.3, 1.6); // viền ấm
    const m = Math.min(1, rim * 0.85);
    const line = Math.max(0.0, 1 - vb.e / 0.035) * 0.62 + Math.max(0, 1 - vf.e / 0.04) * 0.3;
    const lit = 1 - 0.1 * (dx + 0.3) - 0.05 * dy; // lệch sáng về trái-trên
    let R = (cream[0]! * (1 - m) + warm[0]! * m) * k * lit, G = (cream[1]! * (1 - m) + warm[1]! * m) * k * lit, B = (cream[2]! * (1 - m) + warm[2]! * m * 0.8) * k * lit;
    const L = Math.min(0.85, line);
    R = R * (1 - L) + 120 * L; G = G * (1 - L) + 84 * L; B = B * (1 - L) + 52 * L;
    const o = (py * S + px) * 4;
    img.data[o] = Math.min(255, R); img.data[o + 1] = Math.min(255, G); img.data[o + 2] = Math.min(255, B); img.data[o + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Atlas 2×2 mây cuộn (mỗi ô 512×256): R = ruột mây (ngọc trai), G = nét viền + xoáy (vàng quỳ). */
export function createCurlCloudAtlas(): THREE.CanvasTexture {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  let seed = 777;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const circ = (x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const spiral = (cx: number, cy: number, r0: number, dir: number, turns: number) => {
    g.beginPath();
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = dir * t * turns * Math.PI * 2, r = r0 * (1 - 0.85 * t);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  };
  for (let n = 0; n < 4; n++) {
    const ox = (n % 2) * W, oy = Math.floor(n / 2) * H;
    g.save();
    g.beginPath(); g.rect(ox, oy, W, H); g.clip();
    g.translate(ox, oy);
    const base = H * 0.66;
    const cs: [number, number, number][] = [];
    const k = 6 + Math.floor(rnd() * 2);
    for (let i = 0; i < k; i++) {
      const u = (i + 0.5) / k, mid = 1 - Math.abs(u - 0.5) * 1.5;
      const r = 20 + mid * (34 + rnd() * 20);
      cs.push([W * (0.12 + 0.76 * u), base - r * (0.45 + rnd() * 0.35), r]);
    }
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgb(0,255,0)'; g.lineWidth = 7;
    for (const [x, y, r] of cs) { circ(x, y, r); g.stroke(); }
    g.fillStyle = 'rgb(210,0,0)';
    for (const [x, y, r] of cs) { circ(x, y, r - 4); g.fill(); }
    g.fillRect(W * 0.1, base - 30, W * 0.8, 30);
    // đuôi cuộn hai đầu: xoáy tròn viền vàng
    g.strokeStyle = 'rgb(0,255,0)'; g.lineWidth = 5;
    const L = cs[0]!, R = cs[cs.length - 1]!;
    g.fillStyle = 'rgb(210,0,0)';
    for (const [e, dir] of [[L, -1], [R, 1]] as const) {
      const ex = e[0] + dir * e[2] * 0.9, ey = base - 14 - rnd() * 8, er = 20 + rnd() * 10;
      circ(ex, ey, er); g.fill(); g.stroke();
      spiral(ex, ey, er * 0.8, -dir, 1.6);
    }
    // vài xoáy nhỏ trong thân mây
    g.lineWidth = 3.5;
    for (let i = 1; i < cs.length - 1; i += 2) spiral(cs[i]![0], cs[i]![1] + cs[i]![2] * 0.2, cs[i]![2] * 0.5, i % 4 === 1 ? 1 : -1, 1.3);
    // đáy phẳng: vạt viền vàng gợn nhẹ
    g.fillStyle = '#000'; g.fillRect(0, base + 1, W, H);
    g.strokeStyle = 'rgb(0,255,0)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(W * 0.1, base);
    for (let x = W * 0.1; x <= W * 0.9; x += 8) g.lineTo(x, base + Math.sin(x * 0.06 + n) * 2.5);
    g.stroke();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`;

const frag = () => {
  const I = RAMPS.indigo!, G = RAMPS.gold!, J = RAMPS.jade!, P = RAMPS.pearl!, S = RAMPS.silk!, A = RAMPS.amber!, L = RAMPS.lacquer!;
  const md = LACQUER_MOON_DIR;
  const mr = new THREE.Vector3().crossVectors(md, new THREE.Vector3(0, 1, 0)).normalize();
  const mu = new THREE.Vector3().crossVectors(mr, md).normalize();
  const vec = (v: THREE.Vector3) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
  // đám mây: [phương vị, độ cao(rad), nửa rộng, nửa cao, ô, tốc độ trôi (rad/s)]
  const clouds: number[][] = [
    [-0.95, 0.50, 0.34, 0.085, 0, 0.0016], [0.65, 0.62, 0.30, 0.075, 1, -0.0012], [1.55, 0.44, 0.36, 0.09, 2, 0.0010],
    [-2.2, 0.56, 0.30, 0.08, 3, -0.0014], [0.05, 0.84, 0.28, 0.07, 1, 0.0013],
  ];
  return /* glsl */ `
#define PI 3.14159265
const vec3 MD = ${vec(md)}; const vec3 MR = ${vec(mr)}; const vec3 MU = ${vec(mu)};
const float MOON_R = ${f(MOON_R)};
uniform float uTime; uniform float uHype; uniform float uGold; uniform float uMoonB;
uniform sampler2D uMoon; uniform sampler2D uCloud;
uniform vec4 uGl[16]; uniform vec4 uCom[${COMET_POOL}];
varying vec3 vDir;
float hash11(float p){ return fract(sin(p * 127.1) * 43758.5453); }
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wrapA(float a){ return mod(a + PI, 2.0 * PI) - PI; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// đỉnh núi đá vôi: tròn đầu, sườn dựng đứng; chu kỳ nguyên để khép vòng
float peaks(float x, float N, float seed){
  float i = floor(x), best = 0.0;
  for (int k = -1; k <= 1; k++) {
    float ci = i + float(k), cm = mod(ci, N);
    float h1 = hash11(cm + seed), h2 = hash11(cm * 1.7 + seed + 9.0), h3 = hash11(cm * 2.3 + seed + 3.0);
    float c = ci + 0.2 + 0.6 * h1, w = 0.2 + 0.36 * h2, hh = 0.3 + 0.7 * h3;
    float q = (x - c) / w;
    best = max(best, hh * pow(max(1.0 - q * q, 0.0), 0.55));
  }
  return best;
}
void main(){
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0)), h = max(d.y, 0.0);
  float az = atan(d.x, -d.z);
  float warm = smoothstep(0.35, 0.8, uHype), gold = smoothstep(0.75, 0.9, uHype);
  // chàm → sơn then ở đỉnh; chân trời ấm nhẹ
  vec3 zen = mix(${rgb(SKY.zenith)}, ${rgb(L[700])}, 0.65);
  vec3 mid = ${rgb(SKY.mid)};
  vec3 hor = mix(${rgb(SKY.horizon)}, ${rgb(I[500])}, 0.35);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.35, h));
  col = mix(col, zen, smoothstep(0.3, 0.95, h));
  float glow = exp(-h * 11.0) * (0.7 + 0.3 * sin(az * 2.0 + 1.0));
  col = mix(col, ${rgb(A[700])}, glow * (0.16 + 0.14 * warm));
  col += ${rgb(G[700])} * 0.05 * glow * gold;
  // sao thưa
  float ak = cos(clamp(el, -1.4, 1.4));
  vec2 sp = vec2(az * ak, el) * 34.0;
  vec2 cid = floor(sp), cf = fract(sp);
  float sh = hash21(cid);
  if (sh > 0.968 && el > 0.04) {
    vec2 pos = vec2(hash21(cid + 7.1), hash21(cid + 3.3)) * 0.6 + 0.2;
    float tw = 0.65 + 0.35 * sin(uTime * (0.8 + sh * 3.0) + sh * 90.0);
    col += ${rgb(S[300])} * smoothstep(0.1, 0.0, length(cf - pos)) * tw * 0.8 * smoothstep(0.04, 0.2, el);
  }
  // vảy vàng quỳ: mảnh nhỏ bất quy tắc, lấp lánh rất nhẹ, rơi chậm
  vec2 fp = vec2(az * ak, el + uTime * 0.0035) * 105.0;
  vec2 fid = floor(fp), ff = fract(fp) - 0.5;
  float fh = hash21(fid + 11.0);
  if (fh > 0.9 && el > 0.02) {
    vec2 off = (vec2(hash21(fid + 1.3), hash21(fid + 5.7)) - 0.5) * 0.4;
    float ang = fh * 40.0; vec2 q = ff - off;
    q = vec2(cos(ang) * q.x - sin(ang) * q.y, sin(ang) * q.x + cos(ang) * q.y);
    float shape = smoothstep(0.17, 0.12, abs(q.x)) * smoothstep(0.08, 0.05, abs(q.y + q.x * 0.35));
    float tw = pow(0.5 + 0.5 * sin(uTime * (1.2 + fh * 5.0) + fh * 200.0), 3.0);
    col += ${rgb(G[300])} * shape * (0.14 + 0.5 * tw) * smoothstep(0.02, 0.15, el) * (0.7 + 0.3 * gold);
  }
  // sao 4 cánh vàng
  for (int i = 0; i < 16; i++) {
    vec4 gl = uGl[i];
    vec2 l = vec2(wrapA(az - gl.x) * cos(gl.y), el - gl.y) / gl.z;
    if (abs(l.x) < 1.3 && abs(l.y) < 1.3) {
      float tw = 0.6 + 0.4 * sin(uTime * (0.7 + gl.w * 0.8) + gl.w * 30.0);
      float a = sqrt(abs(l.x)) + sqrt(abs(l.y));
      float st = smoothstep(1.0, 0.0, a) * tw + smoothstep(0.25, 0.0, length(l)) * 0.7;
      col += mix(${rgb(G[300])}, ${rgb(G[100])}, 0.5) * st * 0.9;
    }
  }
  // mây cuộn
  vec3 pearlC = mix(${rgb(P[300])}, ${rgb(I[300])}, 0.35);
  vec3 goldC = mix(${rgb(G[500])}, ${rgb(G[300])}, 0.4 + 0.4 * uGold);
  ${clouds.map((c) => `{
    float da = wrapA(az - (${f(c[0]!)} + uTime * ${f(c[5]!)})) * cos(${f(c[1]!)});
    vec2 l = vec2(da / ${f(c[2]!)}, (el - ${f(c[1]!)}) / ${f(c[3]!)});
    if (abs(l.x) < 1.0 && abs(l.y) < 1.0) {
      vec2 q = vec2(l.x * 0.5 + 0.5, l.y * 0.5 + 0.5);
      vec2 uv = (vec2(mod(${c[4]!.toFixed(1)}, 2.0), floor(${c[4]!.toFixed(1)} / 2.0)) + q) * 0.5;
      vec3 t = texture2D(uCloud, uv).rgb;
      float fill = t.r * (0.34 + 0.22 * q.y) * (0.8 + 0.3 * uHype);
      col = mix(col, pearlC, fill);
      col += goldC * t.g * (0.3 + 0.7 * uGold) * (0.55 + 0.25 * sin(uTime * 0.7 + ${f(c[0]!)} * 9.0)) * 0.7;
    }
  }`).join('\n')}
  // trăng vỏ trứng + quầng + vòng ngọc nét cọ (hở)
  float mf = dot(d, MD);
  if (mf > 0.9) {
    vec2 l = vec2(dot(d, MR), dot(d, MU)) / MOON_R;
    float r = length(l);
    float halo = exp(-max(r - 1.0, 0.0) * 1.6);
    col += mix(${rgb(S[700])}, ${rgb(G[300])}, 0.25 + 0.5 * warm + 0.25 * gold) * halo * (0.05 + 0.09 * uMoonB) * step(1.0, r);
    col += ${rgb(I[300])} * exp(-max(r - 1.0, 0.0) * 0.5) * 0.035 * smoothstep(3.0, 1.0, r);
    float a = atan(l.y, l.x);
    float u = fract((a - 0.5) / 6.2831853);
    float th = 0.07 * pow(sin(PI * u), 0.7) * (0.75 + 0.25 * sin(a * 7.0 + 1.3));
    float rr = r - (1.24 + 0.012 * sin(a * 3.0 + uTime * 0.2));
    float ring = smoothstep(th, th * 0.45, abs(rr)) * smoothstep(0.0, 0.07, u) * smoothstep(1.0, 0.93, u);
    ring *= 0.8 + 0.2 * sin(r * 90.0 + a * 11.0);
    col = mix(col, mix(${rgb(J[500])}, ${rgb(J[300])}, 0.5 + 0.5 * sin(a * 2.0)), ring * 0.8);
    if (r < 1.0) {
      vec4 m = texture2D(uMoon, l * 0.5 + 0.5);
      col = mix(col, m.rgb * uMoonB, m.a);
    }
  }
  // hạc xa lướt qua trăng (hiếm): 2 con, bóng đen cánh vỗ chậm
  {
    float ph = fract((uTime + 40.0) / 95.0), fl = ph / 0.17;
    if (fl < 1.0) {
      for (int k = 0; k < 2; k++) {
        float ff2 = fl - float(k) * 0.07;
        vec2 c0 = vec2(${f(MOON_AZ)} - 0.6 + 1.2 * ff2, ${f(MOON_EL)} + 0.015 + float(k) * 0.035 + 0.01 * sin(ff2 * 9.0));
        vec2 p = vec2(wrapA(az - c0.x) * cos(c0.y), el - c0.y) / 0.03;
        float fl2 = sin(uTime * 3.2 + float(k) * 1.7) * 0.55;
        float dd = min(min(sdSeg(p, vec2(-0.2, 0.0), vec2(0.8, 0.05)), sdSeg(p, vec2(0.0, 0.0), vec2(-0.45, 0.25 + fl2))),
                       min(sdSeg(p, vec2(-0.45, 0.25 + fl2), vec2(-0.95, 0.1 + fl2 * 1.3)), min(sdSeg(p, vec2(0.0, 0.0), vec2(-0.2, -0.3 - fl2)), sdSeg(p, vec2(-0.2, -0.3 - fl2), vec2(-0.7, -0.22 - fl2 * 1.2)))));
        col = mix(col, ${rgb(L[500])}, smoothstep(0.09, 0.04, dd) * 0.9 * smoothstep(0.0, 0.05, ff2) * smoothstep(1.0, 0.95, ff2) * step(0.0, ff2));
      }
    }
  }
  // sao băng = nét cọ vàng
  for (int i = 0; i < ${COMET_POOL}; i++) {
    vec4 c = uCom[i];
    float age = uTime - c.z;
    if (age > 0.0 && age < 1.9) {
      vec2 dir = vec2(cos(c.w), sin(c.w));
      vec2 p = vec2(wrapA(az - c.x) * cos(c.y), el - c.y) - dir * 0.2 * age;
      float along = dot(p, dir), perp = dot(p, vec2(-dir.y, dir.x));
      float u = -along / 0.34;
      float env = smoothstep(0.0, 0.15, age) * (1.0 - smoothstep(1.3, 1.9, age));
      if (u > -0.02 && u < 1.0) {
        float w = 0.0042 * pow(1.0 - max(u, 0.0), 0.8) + 0.0006;
        float bris = 0.75 + 0.25 * sin(perp * 900.0 + u * 20.0);
        float s = smoothstep(w, w * 0.3, abs(perp)) * pow(1.0 - max(u, 0.0), 1.4) * bris;
        col += mix(${rgb(G[500])}, ${rgb(G[100])}, 1.0 - u) * s * env * 1.1;
      }
      col += ${rgb(G[300])} * smoothstep(0.02, 0.0, length(p)) * env * 0.8;
    }
  }
  // núi đá vôi 3 lớp (xa nhạt → gần tối nhất) + sương giữa các lớp
  float xN = (az + PI) / (2.0 * PI);
  float dm = abs(wrapA(az - ${f(MOON_AZ)}));
  float calm = 1.0 - 0.8 * exp(-dm * dm / 0.12);
  float hF = 0.03 + 0.52 * peaks(xN * 34.0, 34.0, 1.0) * calm;
  float hM = 0.015 + 0.34 * peaks(xN * 48.0 + 0.5, 48.0, 5.0) * mix(1.0, calm, 0.5);
  float hN = 0.0 + 0.17 * peaks(xN * 70.0 + 0.3, 70.0, 11.0);
  vec3 haze = mix(${rgb(I[500])}, ${rgb(A[700])}, 0.18 + 0.12 * warm);
  float eF = smoothstep(0.0025, -0.0015, el - hF);
  vec3 cF = mix(${rgb(I[500])} * 0.62, haze * 0.8, exp(-max(el, 0.0) * 5.5) * 0.7);
  col = mix(col, cF, eF);
  float mist1 = exp(-max(hF - el, 0.0) * 9.0) * 0.0 + exp(-abs(el - 0.02) * 22.0) * 0.28;
  col = mix(col, haze * 0.95, mist1 * smoothstep(-0.02, 0.05, el) * 0.8);
  float eM = smoothstep(0.0025, -0.0015, el - hM);
  vec3 cM = mix(${rgb(I[700])} * 1.02, haze * 0.55, exp(-max(el, 0.0) * 7.0) * 0.6);
  col = mix(col, cM, eM);
  col = mix(col, haze * 0.7, exp(-abs(el - 0.01) * 26.0) * 0.28 * smoothstep(-0.02, 0.03, el) * (0.4 + 0.6 * eF));
  float eN = smoothstep(0.0025, -0.0015, el - hN);
  vec3 cN = ${rgb(L[500])} * 0.35 + ${rgb(I[700])} * 0.45;
  col = mix(col, cN, eN);
  col = mix(col, ${rgb(L[500])}, smoothstep(0.0, -0.06, el));
  gl_FragColor = vec4(col, 1.0);
}`;
};

export function createLacquerSky(ctx: OutsideBuildContext): SkyHandle & { moonPosition: THREE.Vector3 } {
  const { scene, uniforms } = ctx;
  uniforms.uPx = { value: 500 };
  uniforms.uRes = { value: 1 };
  const moonTex = createEggshellMoonTexture();
  const cloudTex = createCurlCloudAtlas();
  let seed = 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gl = Array.from({ length: 16 }, (_, i) => {
    const az = (i < 10 ? -1.7 + rnd() * 3.4 : (rnd() - 0.5) * 6.2), el = 0.28 + rnd() * 1.0;
    return new THREE.Vector4(az, el, 0.014 + rnd() * 0.02, rnd() * 6);
  });
  const com = Array.from({ length: COMET_POOL }, () => new THREE.Vector4(0, 0, -100, 0));
  const loc = { uGold: { value: 0.0 }, uMoonB: { value: 0.8 }, uMoon: { value: moonTex }, uCloud: { value: cloudTex }, uGl: { value: gl }, uCom: { value: com } };
  const geo = new THREE.SphereGeometry(DOME_R, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...loc }, vertexShader: VERT, fragmentShader: frag(),
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -20;
  dome.frustumCulled = false;
  const v2 = new THREE.Vector2();
  dome.onBeforeRender = (renderer, _s, camera) => {
    drawSize(renderer, v2);
    uniforms.uPx!.value = v2.y * camera.projectionMatrix.elements[5]! * 0.5;
    uniforms.uRes!.value = Math.max(0.6, v2.y / 720);
  };
  scene.add(dome);

  const queue: number[] = [];
  let slot = 0, now = 0, lastT = -1, prevH = -1, gold = 0, goldOn = false;
  const armed = [true, true, true];
  const TH = [0.4, 0.6, 0.8], BURST = [1, 2, 3];
  const spawn = (t: number) => {
    const c = com[slot]!; slot = (slot + 1) % COMET_POOL;
    const az = (rnd() < 0.7 ? 0 : Math.PI) + (rnd() - 0.5) * 2.2;
    c.set(az, 0.45 + rnd() * 0.7, t, Math.PI + 0.3 + rnd() * 0.7 + (rnd() < 0.5 ? 0 : 1.4)); // lướt xuống chéo
  };
  const burst = (n: number) => { for (let k = 0; k < n; k++) queue.push(now + (n > 1 ? (k / (n - 1)) * 1.8 : 0) + rnd() * 0.15); };
  const hook = { triggerMeteors: burst };
  (window as unknown as { __csSky?: unknown }).__csSky = hook;
  const moonPosition = LACQUER_MOON_DIR.clone().multiplyScalar(DOME_R);
  return {
    moonPosition,
    burstMeteors: burst,
    update(t) {
      now = t;
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const h = (uniforms.uHype?.value as number) ?? 0;
      if (prevH < 0) prevH = h;
      for (let i = 0; i < 3; i++) {
        if (h < TH[i]! - 0.05) armed[i] = true;
        if (armed[i] && prevH < TH[i]! && h >= TH[i]!) { armed[i] = false; burst(BURST[i]!); }
      }
      prevH = h;
      if (!goldOn && h > 0.8) goldOn = true; else if (goldOn && h < 0.76) goldOn = false;
      gold += ((goldOn ? 1 : 0) - gold) * Math.min(1, dt * 1.2);
      loc.uGold.value = gold;
      loc.uMoonB.value = 0.72 + 0.28 * Math.min(1, h / 0.5);
      if (dt > 0 && h >= 0.8 && Math.random() < 0.05 * dt) queue.push(t);
      for (let k = queue.length - 1; k >= 0; k--) if (queue[k]! <= t) { spawn(t); queue.splice(k, 1); }
    },
    dispose() {
      scene.remove(dome);
      geo.dispose(); mat.dispose(); moonTex.dispose(); cloudTex.dispose();
      const w = window as unknown as { __csSky?: unknown };
      if (w.__csSky === hook) delete w.__csSky;
    },
  };
}

export const builders: Partial<OutsideBuilders> = { sky: createLacquerSky };
