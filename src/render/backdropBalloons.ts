// Khinh khí cầu mang băng rôn cổ vũ (khẩu hiệu fan) lơ lửng trên khán giả.
// Toàn bộ khinh khí cầu + giỏ + dây = 1 mesh; băng rôn = 1 mesh (CanvasTexture atlas). Bập bềnh + đung đưa trong shader.
// setCheerBanners() đổi khẩu hiệu lúc chạy; triggerFlyby() yêu cầu màn bay chào mừng (backdropFlyby.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Uniforms } from './backdropSky';

export const DEFAULT_CHEERS = ['MÃI YÊU ♥', 'HÁT NỮA ĐI!', 'ENCORE!', 'CHÁY HẾT MÌNH', 'WE LOVE YOU', 'NGÔI SAO ĐÊM NAY'];
let cheerTexts: string[] = DEFAULT_CHEERS.slice();
const cheerListeners = new Set<() => void>();
let flybyRequested = false;

/** Khẩu hiệu hiện tại (luôn đủ 6). */
export function getCheerTexts(): string[] { return cheerTexts.slice(); }
/** Đăng ký vẽ lại khi khẩu hiệu đổi; trả về hàm huỷ đăng ký. */
export function onCheerChange(cb: () => void): () => void { cheerListeners.add(cb); return () => { cheerListeners.delete(cb); }; }

/** Thay khẩu hiệu trên 6 khinh khí cầu (tối đa 6 chuỗi, mỗi chuỗi ≤ 24 ký tự; thiếu → mặc định). Gọi được trước/sau khi tạo backdrop. */
export function setCheerBanners(texts: string[]): void {
  const src = Array.isArray(texts) ? texts : [];
  cheerTexts = DEFAULT_CHEERS.map((d, i) => {
    const s = typeof src[i] === 'string' ? src[i].trim().slice(0, 24).trim() : '';
    return s || d;
  });
  cheerListeners.forEach((cb) => cb());
}

/** Kích hoạt màn bay chào mừng (máy bay kéo băng rôn + khinh khí cầu) ngay lập tức. Gọi lúc nào cũng được. */
export function triggerFlyby(): void { flybyRequested = true; }
/** (nội bộ) backdropFlyby đọc + xoá yêu cầu. */
export function consumeFlybyRequest(): boolean { const r = flybyRequested; flybyRequested = false; return r; }

if (typeof window !== 'undefined' && (import.meta.env.DEV || location.search.includes('debugSky'))) {
  (window as unknown as { __debugSky: unknown }).__debugSky = { setCheerBanners, triggerFlyby, getCheerTexts };
}

export const CHEER_FONT = '"Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.42);
  ctx.bezierCurveTo(cx - s * 0.62, cy - s * 0.02, cx - s * 0.48, cy - s * 0.58, cx, cy - s * 0.26);
  ctx.bezierCurveTo(cx + s * 0.48, cy - s * 0.58, cx + s * 0.62, cy - s * 0.02, cx, cy + s * 0.42);
  ctx.closePath();
}

/** Vẽ chữ ở giữa (cx, cy), '♥' được vẽ bằng path trái tim; tự thu nhỏ cho vừa maxW. */
export function drawCheerText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, size: number) {
  const segs = text.split('♥');
  let fs = size;
  const measure = () => {
    ctx.font = `900 ${fs}px ${CHEER_FONT}`;
    let w = 0;
    segs.forEach((sg, i) => { w += ctx.measureText(sg).width; if (i < segs.length - 1) w += fs * 0.95; });
    return w;
  };
  let w = measure();
  if (w > maxW) { fs = Math.floor(fs * maxW / w); w = measure(); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  let x = cx - w / 2;
  const ty = cy + fs * 0.06;
  segs.forEach((sg, i) => {
    if (sg) {
      ctx.lineWidth = fs * 0.16; ctx.strokeStyle = 'rgba(20,4,30,0.95)';
      ctx.strokeText(sg, x, ty);
      ctx.fillStyle = '#ffffff'; ctx.fillText(sg, x, ty);
      x += ctx.measureText(sg).width;
    }
    if (i < segs.length - 1) {
      const hx = x + fs * 0.475, hy = cy;
      heartPath(ctx, hx, hy, fs * 0.82);
      ctx.lineWidth = fs * 0.12; ctx.strokeStyle = 'rgba(20,4,30,0.95)'; ctx.stroke();
      ctx.fillStyle = '#ff2d6f'; ctx.fill();
      x += fs * 0.95;
    }
  });
}

const PENNANT = ['#ffd23f', '#2ec4ff', '#ff3b6b', '#35e0b0', '#ffffff', '#9b2cff'];
/** Băng rôn lễ hội: dải màu đuôi én, viền trắng, cờ đuôi nheo + tua rua. Nền trong suốt (shader bỏ alpha thấp). */
export function drawCheerBanner(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, text: string, band: string) {
  ctx.clearRect(x0, y0, w, h);
  const bt = y0 + h * 0.12, bb = y0 + h * 0.78, bh = bb - bt, notch = bh * 0.35;
  const bl = x0 + w * 0.035, br = x0 + w * 0.965;
  // dải chính (đuôi én hai đầu)
  ctx.beginPath();
  ctx.moveTo(bl, bt); ctx.lineTo(br, bt); ctx.lineTo(br - notch, (bt + bb) / 2); ctx.lineTo(br, bb);
  ctx.lineTo(bl, bb); ctx.lineTo(bl + notch, (bt + bb) / 2); ctx.closePath();
  const gr = ctx.createLinearGradient(0, bt, 0, bb);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.12, band); gr.addColorStop(0.85, band); gr.addColorStop(1, '#1a0526');
  ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = h * 0.035; ctx.strokeStyle = '#ffe680'; ctx.stroke();
  // cờ đuôi nheo dưới dải
  const n = 14, pw = (br - bl - notch * 2) / n;
  for (let i = 0; i < n; i++) {
    const px = bl + notch + i * pw;
    ctx.beginPath(); ctx.moveTo(px + 2, bb); ctx.lineTo(px + pw - 2, bb); ctx.lineTo(px + pw / 2, y0 + h * 0.97); ctx.closePath();
    ctx.fillStyle = PENNANT[i % PENNANT.length]; ctx.fill();
  }
  // tua rua vàng ở hai đầu
  for (const tx of [bl + notch * 0.2, br - notch * 0.2]) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(tx, bt, h * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(tx, bb, h * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(tx - h * 0.02, bb, h * 0.04, h * 0.16);
    ctx.beginPath(); ctx.moveTo(tx - h * 0.06, bb + h * 0.14); ctx.lineTo(tx + h * 0.06, bb + h * 0.14); ctx.lineTo(tx, y0 + h * 0.99); ctx.closePath(); ctx.fill();
  }
  drawCheerText(ctx, text, (bl + br) / 2, (bt + bb) / 2, (br - bl) - notch * 2.6, bh * 0.68);
}

const BALLOONS = [
  { p: [-52, 26, -24], a: 0xff3b6b, b: 0xffd23f, band: '#e0115f' },
  { p: [-36, 32, -48], a: 0x2ec4ff, b: 0xffffff, band: '#1565e8' },
  { p: [-14, 30, -40], a: 0xffc400, b: 0x9b2cff, band: '#ff7a00' },
  { p: [12, 33, -60], a: 0xff5ec4, b: 0x35e0b0, band: '#d1149a' },
  { p: [32, 28, -42], a: 0x7c4dff, b: 0xff8a3d, band: '#6a2cff' },
  { p: [52, 24, -22], a: 0x22e06b, b: 0x1b6cff, band: '#0fa84f' },
];
const BOB = /* glsl */ `
vec3 bob(float id, float t){ return vec3(sin(t*0.13+id*1.7)*1.8, sin(t*0.42+id*2.3)*0.9, cos(t*0.11+id*1.3)*1.4); }`;

const BAL_VERT = /* glsl */ `
uniform float uTime;
attribute vec2 aInfo; // id, kind (0 vỏ, 1 giỏ/dây, 2 miệng lửa)
attribute vec3 aColA; attribute vec3 aColB;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vKind; varying float vId; varying vec3 vN; varying vec3 vV;
${BOB}
void main(){
  vUv = uv; vA = aColA; vB = aColB; vKind = aInfo.y; vId = aInfo.x; vN = normal;
  vec3 p = position + bob(aInfo.x, uTime);
  vV = cameraPosition - p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const BAL_FRAG = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vKind; varying float vId; varying vec3 vN; varying vec3 vV;
void main(){
  if (vKind > 1.5) { float f = 0.8 + 0.2 * sin(uTime * 17.0 + vId * 5.0); gl_FragColor = vec4(vec3(1.0, 0.65, 0.25) * f * (1.0 + uPulse * 0.5), 1.0); return; }
  if (vKind > 0.5) { gl_FragColor = vec4(0.10, 0.07, 0.05, 1.0); return; }
  float g = fract(vUv.x * 10.0);
  vec3 c = mix(vA, vB, step(0.5, g));
  float seam = smoothstep(0.0, 0.04, g) * smoothstep(1.0, 0.96, g) * smoothstep(0.0, 0.04, abs(g - 0.5));
  float v = vUv.y;
  float inner = 0.35 + 0.75 * exp(-pow((v - 0.25) * 2.4, 2.0));
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float flick = 0.92 + 0.08 * sin(uTime * 11.0 + vId * 3.0);
  float lit = (0.22 + inner * (0.5 + 0.4 * uPulse) * (0.75 + 0.45 * uHype) * flick) * (0.55 + 0.6 * ndv);
  lit *= 0.75 + 0.25 * seam;
  gl_FragColor = vec4(c * lit, 1.0);
}`;

const BAN_VERT = /* glsl */ `
uniform float uTime;
attribute float aId;
varying vec2 vUv;
${BOB}
void main(){
  vUv = uv;
  float lv = 1.0 - (uv.y * NROWS - (NROWS - 1.0 - aId)); // 0 mép trên → 1 mép dưới
  vec3 p = position;
  float sw = sin(uTime * 0.9 + aId * 1.9) * 0.10 * lv; // đung đưa quanh thanh treo
  p += normal * (sw * 6.0 + sin(uv.x * 9.0 - uTime * 2.3 + aId) * 0.22 * (0.3 + lv));
  p.y += abs(sw) * 0.6;
  p += bob(aId, uTime);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const BAN_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uPulse; uniform float uHype;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec4 c = texture2D(uMap, uv);
  if (c.a < 0.45) discard;
  gl_FragColor = vec4(c.rgb * (0.9 + 0.2 * uPulse * uHype), 1.0);
}`;

export function createBalloons(scene: THREE.Scene, uniforms: Uniforms) {
  const disposables: { dispose(): void }[] = [];
  // Atlas băng rôn cổ vũ
  const RW = 1024, RH = 256, n = BALLOONS.length;
  const canvas = document.createElement('canvas');
  canvas.width = RW; canvas.height = RH * n;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const draw = () => {
    const texts = getCheerTexts();
    BALLOONS.forEach((b, i) => drawCheerBanner(ctx, 0, i * RH, RW, RH, texts[i], b.band));
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  disposables.push(tex, { dispose: off });

  const lathePts = [
    [0.9, -5.6], [1.4, -4.9], [2.5, -3.6], [3.8, -1.9], [4.8, 0], [5.15, 1.6], [4.95, 3.0], [4.25, 4.3], [3.05, 5.2], [1.6, 5.75], [0.01, 5.95],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const balParts: THREE.BufferGeometry[] = [];
  const banParts: THREE.BufferGeometry[] = [];
  const ca = new THREE.Color(), cb = new THREE.Color();
  const tag = (g: THREE.BufferGeometry, id: number, kind: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    const k = ng.attributes.position.count;
    const info = new Float32Array(k * 2), A = new Float32Array(k * 3), B = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) { info[i * 2] = id; info[i * 2 + 1] = kind; A.set([ca.r, ca.g, ca.b], i * 3); B.set([cb.r, cb.g, cb.b], i * 3); }
    ng.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
    ng.setAttribute('aColA', new THREE.BufferAttribute(A, 3));
    ng.setAttribute('aColB', new THREE.BufferAttribute(B, 3));
    balParts.push(ng);
  };
  const beam = (a: THREE.Vector3, b: THREE.Vector3, th: number, id: number) => {
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(th, len, th);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    tag(g, id, 1);
  };
  BALLOONS.forEach((B, id) => {
    const [x, y, z] = B.p;
    ca.set(B.a); cb.set(B.b);
    const env = new THREE.LatheGeometry(lathePts, 30);
    env.translate(x, y, z);
    tag(env, id, 0);
    const fire = new THREE.CircleGeometry(0.85, 12); fire.rotateX(Math.PI / 2); fire.translate(x, y - 5.55, z); tag(fire, id, 2);
    const basket = new THREE.BoxGeometry(1.7, 1.2, 1.7); basket.translate(x, y - 7.6, z); tag(basket, id, 1);
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) {
      beam(new THREE.Vector3(x + dx * 1.1, y - 5.5, z + dz * 1.1), new THREE.Vector3(x + dx, y - 7.0, z + dz), 0.08, id);
    }
    // băng rôn quay mặt về sân khấu, treo dưới giỏ bằng thanh ngang + 2 dây
    const ry = Math.atan2(-x, -z);
    const W = 12, H = W * RH / RW;
    const right = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const topY = y - 9.6;
    const L = new THREE.Vector3(x, topY, z).addScaledVector(right, -W / 2);
    const R = new THREE.Vector3(x, topY, z).addScaledVector(right, W / 2);
    beam(new THREE.Vector3(x, y - 8.2, z), L, 0.07, id);
    beam(new THREE.Vector3(x, y - 8.2, z), R, 0.07, id);
    beam(L.clone().addScaledVector(right, -0.2), R.clone().addScaledVector(right, 0.2), 0.16, id);
    const ban = new THREE.PlaneGeometry(W, H, 20, 3);
    const uv = ban.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (n - 1 - id + uv.getY(i)) / n);
    ban.rotateY(ry);
    ban.translate(x, topY - H / 2 - 0.1, z);
    const ids = new Float32Array(ban.attributes.position.count).fill(id);
    ban.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    banParts.push(ban);
  });
  const balGeo = mergeGeometries(balParts)!;
  const banGeo = mergeGeometries(banParts)!;
  balParts.forEach((g) => g.dispose()); banParts.forEach((g) => g.dispose());
  const balMat = new THREE.ShaderMaterial({ uniforms, vertexShader: BAL_VERT, fragmentShader: BAL_FRAG, fog: false, side: THREE.DoubleSide });
  const banMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: tex } }, vertexShader: BAN_VERT.replace(/NROWS/g, n.toFixed(1)), fragmentShader: BAN_FRAG, fog: false, side: THREE.DoubleSide,
  });
  const bal = new THREE.Mesh(balGeo, balMat); bal.frustumCulled = false;
  const ban = new THREE.Mesh(banGeo, banMat); ban.frustumCulled = false;
  scene.add(bal, ban);
  disposables.push(balGeo, banGeo, balMat, banMat);
  return { dispose() { disposables.forEach((d) => d.dispose()); } };
}
