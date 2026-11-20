// "Mực & Sơn mài · bản Việt" — tiện ích dùng chung của gói L6 (file phụ trợ, không đăng ký builder):
// vẽ liễn dọc / băng rôn ngang chữ Quốc ngữ (serif đậm hệ thống, vàng quỳ viền sơn then), màu thô cho shader,
// và chữ ký secret "vòng cọ hở 40° màu ngọc + triện son" (1 quad billboard, vẽ hết trong fragment shader).
import * as THREE from 'three';
import { hexStr, hexToRgb, RAMPS } from '../../../../world/style';

/** Serif đậm của hệ thống (có dấu tiếng Việt: Noto Serif / DejaVu Serif / Georgia / Times). */
export const SERIF = '"Noto Serif", "Noto Serif Display", "DejaVu Serif", Georgia, "Times New Roman", "Liberation Serif", serif';

/** Ramp của phong cách lacquer (đọc LÚC GỌI, không chép vào hằng cấp module). */
export const ramp = (name: string): Record<100 | 300 | 500 | 700, number> =>
  (RAMPS[name] ?? RAMPS.gold ?? { 100: 0xfbebc0, 300: 0xf0ce78, 500: 0xd9a93a, 700: 0x8f6a1a }) as Record<100 | 300 | 500 | 700, number>;
export const css = (hex: number) => hexStr(hex);
/** vec3 GLSL (sRGB thô, như các shader outside khác). */
export const gl3 = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;
export const rgb3 = (hex: number): [number, number, number] => hexToRgb(hex);

/** Tách khẩu hiệu thành các từ (bỏ trống). */
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/**
 * Liễn dọc: lụa đỏ son, viền vàng kép, khẩu hiệu viết TỪ TRÊN XUỐNG mỗi từ một dòng (đọc trái → phải nếu 2 cột).
 * Chọn 1 hoặc 2 cột (≤ 5 từ/cột) sao cho chữ to nhất. Vẽ trong ô (x0, y0, w, h) của canvas.
 */
export function drawLien(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, text: string): void {
  const son = ramp('son'), gold = ramp('gold'), lac = ramp('lacquer');
  ctx.save();
  ctx.clearRect(x0, y0, w, h);
  // nền lụa son + loang nhẹ 2 bậc
  ctx.fillStyle = css(son[500]);
  ctx.fillRect(x0, y0, w, h);
  const g = ctx.createLinearGradient(x0, y0, x0 + w, y0);
  g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  // viền vàng kép
  const b = Math.round(w * 0.028);
  ctx.strokeStyle = css(gold[500]); ctx.lineWidth = b;
  ctx.strokeRect(x0 + b * 0.9, y0 + b * 0.9, w - b * 1.8, h - b * 1.8);
  ctx.lineWidth = Math.max(2, b * 0.35);
  ctx.strokeStyle = css(gold[300]);
  ctx.strokeRect(x0 + b * 2.1, y0 + b * 2.1, w - b * 4.2, h - b * 4.2);
  // góc: chấm vàng
  ctx.fillStyle = css(gold[300]);
  for (const [cx, cy] of [[x0 + b * 2.1, y0 + b * 2.1], [x0 + w - b * 2.1, y0 + b * 2.1], [x0 + b * 2.1, y0 + h - b * 2.1], [x0 + w - b * 2.1, y0 + h - b * 2.1]]) {
    ctx.beginPath(); ctx.arc(cx, cy, b * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  // bố cục chữ
  const ws = words(text.toUpperCase());
  const innerW = w - b * 6, innerH = h - b * 6;
  const probe = 100;
  ctx.font = `900 ${probe}px ${SERIF}`;
  let best = { em: 0, cols: [[...ws]] as string[][] };
  for (let nc = 1; nc <= 2; nc++) {
    const per = Math.ceil(ws.length / nc);
    if (per > 5 || (nc === 2 && ws.length < 2)) continue;
    const cols: string[][] = [];
    for (let i = 0; i < nc; i++) cols.push(ws.slice(i * per, (i + 1) * per));
    const colW = cols.map((c) => Math.max(...c.map((s) => ctx.measureText(s).width / probe)));
    const gap = 0.3;
    const emW = innerW / (colW.reduce((a, c) => a + c, 0) + gap * (nc - 1));
    const emH = innerH / (per * 1.18);
    const em = Math.min(emW, emH);
    if (em > best.em) best = { em, cols };
  }
  const em = Math.floor(best.em);
  ctx.font = `900 ${em}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const colW = best.cols.map((c) => Math.max(...c.map((s) => ctx.measureText(s).width)));
  const gapPx = em * 0.3;
  const total = colW.reduce((a, c) => a + c, 0) + gapPx * (best.cols.length - 1);
  let cx = x0 + w / 2 - total / 2;
  best.cols.forEach((col, ci) => {
    const mid = cx + colW[ci] / 2;
    const lineH = em * 1.18;
    const top = y0 + h / 2 - (col.length * lineH) / 2;
    col.forEach((s, li) => {
      const by = top + lineH * (li + 0.5) + em * 0.37; // đường chân chữ: chừa chỗ dấu phía trên
      ctx.strokeStyle = css(lac[700]); ctx.lineWidth = Math.max(3, em * 0.13);
      ctx.strokeText(s, mid, by);
      ctx.fillStyle = css(gold[300]);
      ctx.fillText(s, mid, by);
    });
    cx += colW[ci] + gapPx;
  });
  ctx.restore();
}

/** Băng rôn ngang lụa đỏ son (diều kéo): viền vàng kép, chữ vàng một dòng, hai đầu đuôi nheo trong suốt. */
export function drawSilkBanner(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, text: string): void {
  const son = ramp('son'), gold = ramp('gold'), lac = ramp('lacquer');
  ctx.save();
  ctx.clearRect(x0, y0, w, h);
  const notch = h * 0.45;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w - notch, y0 + h / 2); ctx.lineTo(x0 + w, y0 + h);
  ctx.lineTo(x0, y0 + h); ctx.lineTo(x0 + notch, y0 + h / 2); ctx.closePath();
  ctx.fillStyle = css(son[500]); ctx.fill();
  const b = h * 0.07;
  ctx.strokeStyle = css(gold[500]); ctx.lineWidth = b; ctx.stroke();
  ctx.strokeStyle = css(gold[300]); ctx.lineWidth = b * 0.3;
  ctx.strokeRect(x0 + notch + b, y0 + b * 2, w - notch * 2 - b * 2, h - b * 4);
  const s = text.toUpperCase();
  let fs = h * 0.6;
  ctx.font = `900 ${fs}px ${SERIF}`;
  const maxW = w - notch * 2 - b * 6;
  const mw = ctx.measureText(s).width;
  if (mw > maxW) { fs *= maxW / mw; ctx.font = `900 ${fs}px ${SERIF}`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = css(lac[700]); ctx.lineWidth = Math.max(3, fs * 0.12);
  ctx.strokeText(s, x0 + w / 2, y0 + h * 0.55);
  ctx.fillStyle = css(gold[300]);
  ctx.fillText(s, x0 + w / 2, y0 + h * 0.55);
  ctx.restore();
}

/** Chữ ký secret: vòng cọ hở 40° màu ngọc + triện son (billboard, 1 draw call). */
export interface SealRing { mesh: THREE.Mesh; update(t: number, radius: number, appear: number): void; dispose(): void }
export function createSealRing(): SealRing {
  const jade = ramp('jade'), son = ramp('son'), gold = ramp('gold');
  const u = { uR: { value: 10 }, uA: { value: 0 }, uT: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
uniform float uR; varying vec2 vP;
void main(){ vP = position.xy * 1.35; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * 1.35 * uR; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
uniform float uA; uniform float uT; varying vec2 vP;
void main(){
  float r = length(vP);
  float a = atan(vP.y, vP.x) - uT * 0.25;
  float ang = mod(a, 6.2831853);
  // vòng cọ: dày-mỏng theo góc, hở 40° (0.698 rad), đầu nét khô
  float span = 6.2831853 - 0.698;
  float k = ang / span;
  float on = step(ang, span);
  float th = 0.035 + 0.05 * sin(k * 3.1416) * (0.8 + 0.2 * sin(ang * 23.0));
  float ring = on * smoothstep(th, th * 0.6, abs(r - 1.0 - 0.02 * sin(ang * 5.0)));
  ring *= 1.0 - 0.5 * step(0.92, k) * step(0.5, fract(r * 40.0 + ang * 9.0));
  // triện son vuông ở đầu nét
  float ea = uT * 0.25 + span + 0.12;
  vec2 c = vec2(cos(ea), sin(ea)) * 1.0;
  vec2 q = abs(vP - c);
  float seal = step(max(q.x, q.y), 0.09);
  float inner = step(max(q.x, q.y), 0.06) * step(0.02, min(abs(q.x - 0.03), abs(q.y - 0.03)));
  vec3 col = ${gl3(jade[300])} * ring;
  float al = ring;
  col = mix(col, ${gl3(son[500])}, seal); al = max(al, seal);
  col = mix(col, ${gl3(gold[100])}, seal * (1.0 - inner) * 0.0 + seal * inner * 0.0 + seal * step(max(q.x, q.y), 0.075) * (1.0 - step(max(q.x, q.y), 0.06)) * 0.9);
  float halo = smoothstep(0.25, 0.0, abs(r - 1.0)) * 0.12;
  gl_FragColor = vec4(col + ${gl3(jade[100])} * halo, (al + halo) * uA);
}`,
  });
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return {
    mesh,
    update(t, radius, appear) { u.uT.value = t; u.uR.value = radius; u.uA.value = appear; mesh.visible = appear > 0.003; },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}
