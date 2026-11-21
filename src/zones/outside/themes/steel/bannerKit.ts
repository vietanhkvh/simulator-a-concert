// "Thép & Lửa" — tiện ích dùng chung của gói S5 (file phụ trợ, KHÔNG đăng ký builder):
// chữ STENCIL (sans condensed đậm hệ thống, có dấu tiếng Việt), băng rôn vải đen dải đỏ mép rách, cờ tour,
// màu token đọc LÚC GỌI, GLSL tô mặt phẳng (pháp tuyến phẳng từ đạo hàm: phím lạnh trên / viền lửa ấm dưới),
// hệ "bảng quay về camera quanh trục X" (FIG_BASIS) và chữ ký secret "vòng tia lửa" (1 quad, vẽ hết trong fragment).
import * as THREE from 'three';
import { hexStr, hexToRgb, RAMPS } from '../../../../world/style';

/** Sans condensed đậm của hệ thống (đủ dấu tiếng Việt: Roboto Condensed / Arial Narrow / DejaVu Sans Condensed / Noto Sans). */
export const STENCIL = '"Oswald", "Roboto Condensed", "Arial Narrow", "Liberation Sans Narrow", "DejaVu Sans Condensed", "Noto Sans", "DejaVu Sans", Arial, sans-serif';

type Ramp = Record<100 | 300 | 500 | 700, number>;
const FALLBACK: Ramp = { 100: 0xc3c9d4, 300: 0x8e96a6, 500: 0x5b6270, 700: 0x2c3038 };
/** Ramp của phong cách steel (coal steel arc tungsten blood ember flame whitehot paper) — đọc lúc gọi. */
export const ramp = (name: string): Ramp => (RAMPS[name] ?? FALLBACK) as Ramp;
export const css = (hex: number) => hexStr(hex);
export const gl3 = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;
export const rgb3 = (hex: number): [number, number, number] => hexToRgb(hex);

/** Tô mặt phẳng: pháp tuyến từ đạo hàm vị trí thế giới; phím lạnh (hồ quang) từ trên, viền lửa (ember) từ dưới. */
export const FACET_GLSL = () => /* glsl */ `
vec3 facet(vec3 base, vec3 wp) {
  vec3 n = normalize(cross(dFdx(wp), dFdy(wp)));
  float key = clamp(dot(n, normalize(vec3(-0.35, 0.9, 0.3))), 0.0, 1.0);
  float fill = clamp(dot(n, normalize(vec3(0.6, 0.2, 0.75))), 0.0, 1.0);
  float rim = clamp(-n.y, 0.0, 1.0);
  vec3 c = base * (0.3 + 0.62 * key + 0.18 * fill) * mix(vec3(1.0), ${gl3(ramp('arc')[500])}, 0.25 * key);
  c += ${gl3(ramp('ember')[300])} * rim * rim * 0.28 * (0.4 + 0.6 * dot(base, vec3(0.33)));
  return c;
}`;

/** Bảng quay mặt về camera QUANH TRỤC X (như lacquer): từ sân khấu (nhìn −Z) hay máy toàn cảnh (nhìn +Z) đều đứng, không gương. */
export const FIG_BASIS = /* glsl */ `
uniform vec3 uC;
vec3 figWorld(vec3 p) {
  vec3 f = cameraPosition - uC; f.x = 0.0; f = normalize(f);
  vec3 ey = normalize(vec3(0.0, 1.0, 0.0) - f * f.y);
  vec3 ex = cross(ey, f);
  return uC + ex * p.x + ey * p.y + f * p.z;
}
mat3 figMat() {
  vec3 f = cameraPosition - uC; f.x = 0.0; f = normalize(f);
  vec3 ey = normalize(vec3(0.0, 1.0, 0.0) - f * f.y);
  return mat3(cross(ey, f), ey, f);
}`;
/** Cơ sở của bảng (CPU) khi nhìn từ `cam` — để tính focus(). */
export function figBasis(c: THREE.Vector3, cam: THREE.Vector3) {
  const f = new THREE.Vector3(0, cam.y - c.y, cam.z - c.z).normalize();
  const ey = new THREE.Vector3(0, 1, 0).addScaledVector(f, -f.y).normalize();
  return { ex: new THREE.Vector3().crossVectors(ey, f), ey, f };
}
/** Máy toàn cảnh của sự kiện bí mật (main.ts SECRET_CAM_HOME). */
export const FOCUS_CAM = new THREE.Vector3(0, 66, -108);

const words = (s: string) => s.trim().toUpperCase().split(/\s+/).filter(Boolean);

/**
 * Chữ stencil trắng căn giữa trong hộp (cx, cy, maxW, maxH): 1 hoặc 2 dòng (chọn cách cho chữ to nhất), dãn ngang 0,88
 * (condensed), cầu nối stencil = khe ngang mảnh màu nền cắt qua thân chữ. Chừa chỗ dấu phía trên (≈ 0,32 em).
 */
export function drawStencil(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, maxH: number, ink: string, bg: string): number {
  const ws = words(text);
  if (!ws.length) return 0;
  const SQ = 0.86, probe = 100;
  ctx.save();
  ctx.font = `800 ${probe}px ${STENCIL}`;
  let best = { em: 0, lines: [ws.join(' ')] };
  for (let nl = 1; nl <= Math.min(2, ws.length); nl++) {
    let lines: string[] = [ws.join(' ')];
    if (nl === 2) {
      let bw = 1e9;
      for (let k = 1; k < ws.length; k++) {
        const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' ');
        const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
        if (w < bw) { bw = w; lines = [a, b]; }
      }
    }
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) * SQ / probe;
    const lineH = 1.22;
    const em = Math.min(maxW / w, maxH / (nl * lineH));
    if (em > best.em * 1.08) best = { em, lines };
  }
  const em = Math.floor(best.em);
  ctx.font = `800 ${em}px ${STENCIL}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const lineH = em * 1.22;
  const top = cy - (best.lines.length * lineH) / 2;
  best.lines.forEach((l, i) => {
    const base = top + lineH * (i + 1) - em * 0.2;
    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(SQ, 1);
    ctx.fillStyle = ink;
    ctx.fillText(l, 0, 0);
    ctx.restore();
    // cầu nối stencil: khe ngang mảnh ở 0,4 chiều cao chữ hoa
    const w = ctx.measureText(l).width * SQ;
    ctx.fillStyle = bg;
    ctx.fillRect(cx - w / 2 - 4, base - em * 0.72 * 0.4 - em * 0.022, w + 8, Math.max(2, em * 0.045));
  });
  ctx.restore();
  return em;
}

/** Hạt giả ngẫu nhiên có hạt giống (cho mép rách lặp lại được). */
function rnd(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** Mép dưới rách tả tơi: polyline zig-zag ngẫu nhiên (px). */
function raggedBottom(ctx: CanvasRenderingContext2D, x0: number, w: number, yb: number, depth: number, seed: number) {
  const r = rnd(seed);
  let x = x0 + w;
  ctx.lineTo(x, yb - depth * (0.3 + 0.7 * r()));
  while (x > x0) {
    x -= w * (0.012 + 0.03 * r());
    ctx.lineTo(Math.max(x, x0), yb - depth * (r() < 0.25 ? 0.95 * r() : 0.15 + 0.85 * r()));
  }
  ctx.lineTo(x0, yb - depth * 0.6);
}

/**
 * Băng rôn vải đen (blimp / trực thăng): dải đỏ trên + đường chỉ, khoen đinh tán hai góc, chữ stencil trắng,
 * mép dưới rách (`torn`). Nền ngoài hình trong suốt (alpha < 0,5 → discard trong shader).
 */
export function drawClothBanner(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, text: string, seed: number, torn = true): void {
  const coal = ramp('coal'), blood = ramp('blood'), paper = ramp('paper'), steel = ramp('steel');
  ctx.save();
  ctx.clearRect(x0, y0, w, h);
  const tear = torn ? h * 0.1 : 0;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0);
  if (torn) raggedBottom(ctx, x0, w, y0 + h, tear, seed); else { ctx.lineTo(x0 + w, y0 + h); ctx.lineTo(x0, y0 + h); }
  ctx.closePath();
  ctx.fillStyle = css(coal[300]); ctx.fill();
  ctx.clip();
  // vải: sợi ngang mờ + loang
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = y0; y < y0 + h; y += 6) ctx.fillRect(x0, y, w, 2);
  // dải đỏ trên + chỉ trắng
  const band = h * 0.15;
  ctx.fillStyle = css(blood[300]); ctx.fillRect(x0, y0, w, band);
  ctx.fillStyle = css(blood[500]); ctx.fillRect(x0, y0 + band * 0.82, w, band * 0.18);
  ctx.strokeStyle = css(paper[500]); ctx.lineWidth = Math.max(2, h * 0.006); ctx.setLineDash([h * 0.03, h * 0.02]);
  ctx.beginPath(); ctx.moveTo(x0, y0 + band * 0.4); ctx.lineTo(x0 + w, y0 + band * 0.4); ctx.stroke();
  ctx.setLineDash([]);
  // dải đỏ mảnh sát mép rách + sờn sáng ở mép
  if (torn) { ctx.fillStyle = css(blood[500]); ctx.fillRect(x0, y0 + h - tear * 2.1, w, h * 0.025); }
  // khoen + đinh tán hai góc
  ctx.fillStyle = css(steel[100]);
  for (const gx of [x0 + band * 0.55, x0 + w - band * 0.55]) { ctx.beginPath(); ctx.arc(gx, y0 + band * 0.5, band * 0.26, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = css(coal[700]);
  for (const gx of [x0 + band * 0.55, x0 + w - band * 0.55]) { ctx.beginPath(); ctx.arc(gx, y0 + band * 0.5, band * 0.12, 0, Math.PI * 2); ctx.fill(); }
  // chữ
  const top = y0 + band * 1.05, bot = y0 + h - tear * 1.05;
  drawStencil(ctx, text, x0 + w / 2, (top + bot - tear * 1.2) / 2, w * 0.92, (bot - top - tear * 1.2) * 0.96, css(paper[300]), css(coal[300]));
  ctx.restore();
}

/** Cờ tour: nền đen, sọc chéo cảnh báo đỏ hai mép, tia sét đỏ nhỏ hai bên, chữ stencil trắng; mép dưới tua rách nhẹ. */
export function drawTourFlag(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, text: string, seed: number): void {
  const coal = ramp('coal'), blood = ramp('blood'), paper = ramp('paper');
  ctx.save();
  ctx.clearRect(x0, y0, w, h);
  const tear = h * 0.06;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0);
  raggedBottom(ctx, x0, w, y0 + h, tear, seed);
  ctx.closePath();
  ctx.fillStyle = css(coal[500]); ctx.fill();
  ctx.clip();
  // khung đỏ trên + dưới, sọc chéo ở hai mép
  const b = h * 0.075;
  ctx.fillStyle = css(blood[300]);
  ctx.fillRect(x0, y0, w, b);
  ctx.fillRect(x0, y0 + h - tear - b * 0.9, w, b * 0.9);
  const sw = w * 0.045;
  for (const ex of [x0, x0 + w - sw]) {
    ctx.save(); ctx.beginPath(); ctx.rect(ex, y0, sw, h); ctx.clip();
    for (let k = -2; k < h / (sw * 0.7) + 2; k++) {
      ctx.fillStyle = k % 2 ? css(blood[300]) : css(paper[500]);
      ctx.beginPath();
      const y = y0 + k * sw * 0.7;
      ctx.moveTo(ex, y); ctx.lineTo(ex + sw, y - sw * 0.7); ctx.lineTo(ex + sw, y); ctx.lineTo(ex, y + sw * 0.7); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // khung chữ
  const top = y0 + b * 1.3, bot = y0 + h - tear - b * 1.2;
  drawStencil(ctx, text, x0 + w / 2, (top + bot) / 2, w - sw * 2 - w * 0.05, (bot - top) * 0.96, css(paper[300]), css(coal[500]));
  ctx.restore();
}

/** Chữ ký secret "vòng tia lửa": vòng chấm lửa xoay + tàn bắn ra (billboard trên tâm uAt, 1 draw call). `fig` → toạ độ bảng. */
export interface FireRing { mesh: THREE.Mesh; u: { uAt: { value: THREE.Vector3 }; uR: { value: number }; uA: { value: number }; uT: { value: number } }; dispose(): void }
export function createFireRing(fig: { uC: { value: THREE.Vector3 } } | null): FireRing {
  const fl = ramp('flame'), wh = ramp('whitehot'), em = ramp('ember');
  const u = { uAt: { value: new THREE.Vector3() }, uR: { value: 6 }, uA: { value: 0 }, uT: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: fig ? { ...u, uC: fig.uC } : u,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */ `
${fig ? FIG_BASIS : ''}
uniform vec3 uAt; uniform float uR; varying vec2 vP;
void main(){
  vP = position.xy * 1.4;
  vec3 c = ${fig ? 'figWorld(uAt)' : 'uAt'};
  vec4 mv = viewMatrix * vec4(c, 1.0); mv.xy += position.xy * 1.4 * uR;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uA; uniform float uT; varying vec2 vP;
float h1(float n){ return fract(sin(n * 91.345) * 47453.13); }
void main(){
  float r = length(vP); float a = atan(vP.y, vP.x);
  float N = 28.0;
  float k = (a + 3.14159) / 6.28318 * N + uT * 1.6;
  float id = floor(k); float f = fract(k) - 0.5;
  float rr = 1.0 + 0.05 * sin(id * 2.7 + uT * 6.0);
  float spark = exp(-(f * f) * 60.0) * exp(-pow((r - rr) * 14.0, 2.0));
  float tw = 0.55 + 0.45 * step(0.35, h1(id + floor(uT * 3.0)));
  // tàn bắn ra ngoài
  float out1 = exp(-(f * f) * 140.0) * smoothstep(1.05, 1.15, r) * smoothstep(1.45, 1.15, r) * step(0.7, h1(id * 3.1));
  float ring = exp(-pow((r - 1.0) * 6.0, 2.0)) * 0.12;
  vec3 c = mix(${gl3(fl[500])}, ${gl3(wh[100])}, clamp(spark * 1.2, 0.0, 1.0)) * (spark * tw * 1.6 + out1 * 0.9) + ${gl3(em[300])} * ring;
  gl_FragColor = vec4(c * uA, 1.0);
}`,
  });
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  return { mesh, u, dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); } };
}

/** Gộp mảnh geometry có thuộc tính màu `aCol` + `aK` (loại) vào danh sách; giữ position/normal/uv. */
export function pushPart(out: THREE.BufferGeometry[], g: THREE.BufferGeometry, m: THREE.Matrix4 | null, col: number, kind = 0, extra?: Record<string, number[]>): void {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
  if (!ng.attributes.normal) ng.computeVertexNormals();
  if (m) ng.applyMatrix4(m);
  const n = ng.attributes.position.count, c = rgb3(col);
  const cc = new Float32Array(n * 3), kk = new Float32Array(n);
  for (let i = 0; i < n; i++) { cc.set(c, i * 3); kk[i] = kind; }
  ng.setAttribute('aCol', new THREE.BufferAttribute(cc, 3));
  ng.setAttribute('aK', new THREE.BufferAttribute(kk, 1));
  if (extra) for (const [k, v] of Object.entries(extra)) {
    const a = new Float32Array(n * v.length);
    for (let i = 0; i < n; i++) a.set(v, i * v.length);
    ng.setAttribute(k, new THREE.BufferAttribute(a, v.length));
  }
  const keep = ['position', 'normal', 'uv', 'aCol', 'aK', ...(extra ? Object.keys(extra) : [])];
  for (const k of Object.keys(ng.attributes)) if (!keep.includes(k)) ng.deleteAttribute(k);
  out.push(ng);
}

/** Ngôi sao 5 cánh (Shape, bán kính r, tâm 0). */
export function starShape(r: number, inner = 0.42): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * inner : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}
/** Tia sét nhỏ (biểu tượng), cao 2·r. */
export function boltShape(r: number): THREE.Shape {
  const P: [number, number][] = [[-0.1, 1], [0.45, 1], [0.12, 0.15], [0.48, 0.15], [-0.32, -1], [-0.04, -0.12], [-0.4, -0.12]];
  const s = new THREE.Shape();
  P.forEach(([x, y], i) => (i ? s.lineTo(x * r, y * r) : s.moveTo(x * r, y * r)));
  s.closePath();
  return s;
}
