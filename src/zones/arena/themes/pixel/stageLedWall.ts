// "Đêm Sao Điểm Ảnh" — khe `ledWall`: tường LED 26 × 10 m là TOAN CĂNG TRÊN GIÁ VẼ khổng lồ (mép toan vải bố, chân giá gỗ
// nghiêng sau toan, thanh đỡ dưới, kẹp + cột giá ló trên đỉnh). Mặt toan là tranh pixel 104 × 40 điểm (0,25 m / điểm),
// tô bằng bảng 31 màu + Bayer 4×4, không gradient mượt; đổi theo 3 trạng thái Hype bằng hoà tan dither:
// Đêm đầy sao = trời xoáy lam Phổ, sao quầng thở ±1 điểm theo phách, trăng khuyết cam, cây bách, làng ·
// Hướng dương = cánh đồng hướng dương dưới trời lam xoáy, mặt trời quầng · Tiếng thét = trời gợn son–cam, vịnh lam–lục,
// cầu chéo, nhân vật thét ôm má. Không chớp toàn mặt (chỉ sao/hoa nhích 1 điểm). 3 draw call (mặt toan + giá + viền mực).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { LED_WALL } from '../../../../world/layout';
import { toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { CELL, GLSL_BAYER, PKit, R, V, inkOutline, makeAtlas, pixelMaterial } from './stageKit';

const PAL_KEYS = [
  'pho7', 'pho5', 'pho3', 'pho1', 'crom7', 'crom5', 'crom3', 'crom1', 'bach7', 'bach5', 'bach3', 'bach1',
  'son7', 'son5', 'son3', 'son1', 'dat7', 'dat5', 'dat3', 'dat1', 'tim7', 'tim5', 'may5', 'ink',
] as const;

const LED_FRAG = () => /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uLevel; uniform float uBeat;
${PAL_KEYS.map((k) => `uniform vec3 ${k};`).join(' ')}
varying vec2 vUv;
${GLSL_BAYER}
float h11(float n){ return fract(sin(n * 91.345) * 43758.545); }
// ── 1. Đêm đầy sao ──
vec3 starry(vec2 q, float th){
  float t = uTime;
  float psi = q.y * 0.32 + 2.6 * sin(q.x * 0.075 + t * 0.25);
  vec2 d1 = q - vec2(-6.0, 6.0); float r1 = length(d1);
  psi += 5.5 * exp(-r1 * r1 / 110.0) * sin(atan(d1.y, d1.x) + r1 * 0.42 - t * 1.25);
  vec2 d2 = q - vec2(18.0, 3.0); float r2 = length(d2);
  psi += 3.5 * exp(-r2 * r2 / 60.0) * sin(atan(d2.y, d2.x) - r2 * 0.5 + t * 1.0);
  float b = fract(psi * 0.22);
  float lv = floor(b * 4.0 + th * 0.9);
  vec3 c = lv < 1.0 ? pho7 : lv < 2.0 ? pho5 : lv < 3.0 ? pho3 : lv < 4.0 ? pho5 : pho1;
  // vệt cọ sáng ngắn dọc dòng chảy
  if (fract(psi * 1.1 + h11(floor(q.x / 5.0)) ) < 0.08 && q.y > -10.0) c = pho1;
  // sao quầng (thở ±1 điểm theo phách)
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 sc = vec2(-44.0 + fi * 13.5 + 4.0 * h11(fi + 2.0), 4.0 + 12.0 * h11(fi + 9.0));
    float d = length(q - sc);
    float rh = 3.2 + 1.3 * h11(fi) + floor(uPulse * 1.6 + 0.3);
    if (d < rh + 0.7 && d > rh - 0.6 && th < 0.55) c = crom3;
    else if (d < rh - 0.6) c = th < 0.5 ? pho1 : crom3;
    if (d < 1.6) c = crom3;
    if (d < 0.9) c = crom1;
  }
  // trăng khuyết cam trong quầng vàng (phải trên)
  vec2 m = q - vec2(42.0, 12.0);
  float dm = length(m);
  if (dm < 7.6 && dm > 6.6) c = crom5;
  else if (dm < 6.6 && dm > 5.0 && th < 0.5) c = crom3;
  if (dm < 4.6 && length(m - vec2(-1.9, 1.3)) > 3.8) c = son1;
  // cây bách (trái) dạng ngọn lửa
  float cy = q.y + 20.0;
  float hwid = (6.0 - cy * 0.19) * (1.0 + 0.18 * sin(q.y * 0.9 + t * 1.2));
  if (abs(q.x + 40.0 + 0.6 * sin(cy * 0.35)) < hwid && cy < 33.0) c = (fract(cy * 0.35 + q.x * 0.2) < 0.25) ? bach5 : bach7;
  // đồi + làng (dưới)
  float hill = -14.0 + 2.2 * sin(q.x * 0.11) + 1.2 * sin(q.x * 0.31);
  if (q.y < hill) {
    c = q.y < hill - 2.0 ? tim7 : tim5;
    vec2 cell = floor(vec2(q.x / 4.0, (q.y + 20.0) / 2.0));
    if (q.y < hill - 1.0 && h11(cell.x * 7.0 + cell.y) > 0.55 && mod(q.x, 4.0) < 1.0 && mod(q.y, 2.0) < 1.0) c = crom5;
  }
  // tháp chuông
  if (abs(q.x - 6.0) < 1.0 && q.y < hill + 6.0 && q.y > hill - 1.0) c = tim7;
  return c;
}
// ── 2. Hướng dương ──
vec3 sunflowers(vec2 q, float th){
  float t = uTime;
  float psi = q.y * 0.3 + 2.0 * sin(q.x * 0.09 - t * 0.3);
  float b = fract(psi * 0.25);
  vec3 c = b + th * 0.2 < 0.45 ? pho3 : b < 0.8 ? pho1 : crom3;
  // mặt trời quầng
  float ds = length(q - vec2(30.0, 12.0));
  if (ds < 9.5 && ds > 8.5) c = crom5;
  if (ds < 6.5) c = ds < 4.5 ? crom1 : crom3;
  // đồng hướng dương: 2 hàng bông, thân + lá
  float ground = -6.0 + 1.5 * sin(q.x * 0.2);
  if (q.y < ground) c = (fract((q.x + q.y * 0.7) * 0.18) < 0.5 + 0.2 * (th - 0.5)) ? bach5 : bach3;
  for (int row = 0; row < 2; row++) {
    float fr = float(row);
    float sp = fr < 0.5 ? 14.0 : 11.0;
    float x0 = fr < 0.5 ? -46.0 : -50.0 + 5.5;
    float idx = floor((q.x - x0) / sp + 0.5);
    float sway = floor(sin(t * 1.6 + idx * 1.3) * 1.2 + uPulse * 0.8);
    vec2 hc = vec2(x0 + idx * sp + sway, (fr < 0.5 ? -1.0 : -11.0) + 2.0 * h11(idx + fr * 13.0));
    float sz = fr < 0.5 ? 1.0 : 1.35;
    vec2 d = (q - hc) / sz;
    float r = length(d), a = atan(d.y, d.x);
    if (abs(q.x - hc.x) < 0.6 && q.y < hc.y - 2.0 * sz) c = bach7; // thân
    if (abs(q.y - (hc.y - 7.0 * sz) - 0.5 * (q.x - hc.x)) < 0.8 && abs(q.x - hc.x - 1.8) < 2.0) c = bach3; // lá
    float pet = 4.2 + 1.2 * abs(cos(a * 6.0 + idx));
    if (r < pet) c = r < pet - 1.0 ? crom5 : crom7;
    if (r < 2.4) c = th < 0.5 && r > 1.0 ? dat7 : dat5;
  }
  return c;
}
// ── 3. Tiếng thét ──
vec3 scream(vec2 q, float th){
  float t = uTime;
  vec3 c;
  float w = q.y + 3.0 * sin(q.x * 0.09 + t * 0.6) + 1.5 * sin(q.x * 0.21 - t * 0.9);
  float b = fract(w * 0.12);
  if (q.y > -2.0 + 3.0 * sin(q.x * 0.05)) {
    float lv = floor(b * 4.0 + th * 0.8);
    c = lv < 1.0 ? son5 : lv < 2.0 ? son3 : lv < 3.0 ? son1 : lv < 4.0 ? crom5 : son7;
  } else {
    float v = fract((q.y * 0.4 + 2.5 * sin(q.x * 0.12 + q.y * 0.2 + t * 0.4)) * 0.3);
    c = v + th * 0.15 < 0.5 ? pho5 : v < 0.8 ? bach5 : pho7;
  }
  // cầu chéo (trái dưới → phải)
  float by = -20.0 + (q.x + 52.0) * 0.32;
  if (q.x < 10.0 && abs(q.y - by) < 1.2) c = dat5;
  if (q.x < 10.0 && abs(q.y - by - 2.4) < 0.5) c = dat7;
  if (q.x < 10.0 && q.y > by + 1.2 && q.y < by + 2.0 && mod(q.x, 3.0) < 0.8) c = dat7;
  // hai bóng người trên cầu
  for (int i = 0; i < 2; i++) {
    float px = -40.0 + float(i) * 4.0;
    float py = -20.0 + (px + 52.0) * 0.32;
    if (abs(q.x - px) < 0.9 && q.y > py + 1.0 && q.y < py + 6.0) c = ink;
    if (length(q - vec2(px, py + 6.6)) < 1.1) c = ink;
  }
  // nhân vật thét (giữa-phải, ôm má, miệng O), thân gợn lam sẫm
  vec2 hc = vec2(20.0 + floor(sin(t * 2.0) * 0.8), -2.0);
  float sway = 1.2 * sin((q.y + 20.0) * 0.25 + t * 1.4);
  if (q.y < hc.y - 4.0 && abs(q.x - hc.x - sway) < 3.5 + (hc.y - 4.0 - q.y) * 0.12) c = pho7;
  vec2 e = (q - hc) / vec2(3.0, 4.2);
  if (length(e) < 1.0) c = length(e) < 0.8 ? dat1 : dat3;
  if (length(q - hc - vec2(-1.1, 1.0)) < 0.75 || length(q - hc - vec2(1.1, 1.0)) < 0.75) c = ink;
  vec2 mo = (q - hc - vec2(0.0, -1.8)) / vec2(0.8, 1.3);
  if (length(mo) < 1.0) c = ink;
  for (int s = 0; s < 2; s++) { // hai tay ôm má
    float sx = s == 0 ? -1.0 : 1.0;
    vec2 hp = hc + vec2(sx * 3.2, -0.8);
    if (length((q - hp) / vec2(1.0, 1.8)) < 1.0) c = dat3;
    if (abs(q.x - hp.x - sx * 0.4) < 0.9 && q.y < hp.y - 1.0 && q.y > hc.y - 8.0) c = pho7;
  }
  return c;
}
void main(){
  vec2 grid = vec2(104.0, 40.0);
  vec2 p = floor(vUv * grid);
  vec2 q = p - grid * 0.5 + 0.5;
  float th = bayer4(p);
  float w1 = smoothstep(0.32, 0.5, uHype), w2 = smoothstep(0.76, 0.9, uHype);
  vec3 col = th < w2 ? scream(q, th) : th < w1 ? sunflowers(q, th) : starry(q, th);
  // mép toan: 1 điểm vải bố sáng (sơn chưa phủ tới mép)
  if (p.x < 1.0 || p.x > grid.x - 2.0 || p.y < 1.0 || p.y > grid.y - 2.0) col = mod(p.x + p.y, 2.0) < 1.0 ? crom1 : may5;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createPixelLedWall(ctx: ArenaBuildContext) {
  const { scene, uniforms } = ctx;
  const P = R();
  const { z: WZ, width: W, height: H, centreY: CY } = LED_WALL;

  const pal: Record<string, number> = {
    pho7: P.pho[700], pho5: P.pho[500], pho3: P.pho[300], pho1: P.pho[100], crom7: P.crom[700], crom5: P.crom[500], crom3: P.crom[300], crom1: P.crom[100],
    bach7: P.bach[700], bach5: P.bach[500], bach3: P.bach[300], bach1: P.bach[100], son7: P.son[700], son5: P.son[500], son3: P.son[300], son1: P.son[100],
    dat7: P.dat[700], dat5: P.dat[500], dat3: P.dat[300], dat1: P.dat[100], tim7: P.tim[700], tim5: P.tim[500], may5: P.may[500], ink: P.ink,
  };
  const u: Record<string, { value: unknown }> = {
    uTime: uniforms.uTime ?? { value: 0 }, uHype: { value: 0 }, uPulse: { value: 0 }, uLevel: { value: 0 }, uBeat: { value: 0 },
  };
  for (const key of PAL_KEYS) u[key] = { value: toColor(pal[key]!) };
  const g = new THREE.PlaneGeometry(W, H).rotateY(Math.PI);
  g.translate(0, CY, WZ - 0.05);
  const mat = new THREE.ShaderMaterial({
    uniforms: u, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: LED_FRAG(),
  });
  const face = new THREE.Mesh(g, mat);

  // ── giá vẽ khổng lồ: toan dày (khung căng), 2 chân trước nghiêng ra sau toan, chân sau, thanh đỡ dưới, kẹp + cột trên ──
  const k = new PKit();
  const wood = P.dat[500], woodD = P.dat[700], woodL = P.dat[300];
  const yB = CY - H / 2, yT = CY + H / 2;
  // khung căng (mép toan vải bố dày 0,3 m)
  k.box(W + 0.3, H + 0.3, 0.3, 0, CY, WZ + 0.12, P.crom[100]);
  for (let i = 0; i < 26; i++) {
    k.decal(1.0, 0.3, -W / 2 + 0.5 + i, yT + 0.15, WZ - 0.04, CELL.weave);
    k.decal(1.0, 0.3, -W / 2 + 0.5 + i, yB - 0.15, WZ - 0.04, CELL.weave);
  }
  // chân trước (sau toan, ló ra trên đỉnh) + cột giữa
  for (const sx of [-1, 1]) {
    k.beam(V(sx * 11.5, -0.1, WZ + 0.35), V(sx * 4.5, yT + 2.3, WZ + 0.55), 0.45, 0.32, wood);
    k.beam(V(sx * 11.5, -0.1, WZ + 0.35), V(sx * 12.6, -0.1, WZ - 0.25), 0.36, 0.2, woodD); // bàn chân
  }
  k.beam(V(0, -0.1, WZ + 0.4), V(0, yT + 3.2, WZ + 0.55), 0.5, 0.36, woodL);
  k.beam(V(0, yT + 2.2, WZ + 0.8), V(0, -0.1, WZ + 5.5), 0.36, 0.3, woodD); // chân sau
  // kẹp trên + thanh ngang
  k.box(3.4, 0.55, 0.7, 0, yT + 0.35, WZ + 0.15, woodL);
  k.box(3.0, 0.12, 0.05, 0, yT + 0.35, WZ - 0.22, woodD);
  k.beam(V(-6.5, yT + 1.6, WZ + 0.5), V(6.5, yT + 1.6, WZ + 0.5), 0.3, 0.3, woodD);
  // thanh đỡ dưới (gờ gỗ trước toan, mang vài tuýp sơn + cọ)
  k.box(W + 1.2, 0.3, 0.7, 0, yB - 0.12, WZ - 0.12, wood);
  k.box(W + 1.2, 0.1, 0.12, 0, yB + 0.06, WZ - 0.43, woodL);
  const tubes = [P.tim[300], P.crom[500], P.ngoc, P.pho[300], P.bach[300], P.sen];
  tubes.forEach((c, i) => {
    const x = -11 + i * 4.3;
    k.box(0.5, 0.16, 0.18, x, yB + 0.08, WZ - 0.3, P.may[300]);
    k.box(0.14, 0.12, 0.14, x + 0.3, yB + 0.08, WZ - 0.3, c, 0, 1);
  });
  const kg = k.build();
  const atlas = makeAtlas();
  const pm = pixelMaterial({ atlas });
  const frame = new THREE.Mesh(kg, pm.mat);
  const ink = inkOutline(kg);
  scene.add(face, frame, ink.mesh);

  return {
    update(f: FrameState, _t: number) {
      u.uHype!.value = Math.min(1, Math.max(0, f.hype));
      u.uPulse!.value = f.beatPulse;
      u.uLevel!.value = f.level;
      u.uBeat!.value = f.beat;
    },
    dispose() { scene.remove(face, frame, ink.mesh); g.dispose(); mat.dispose(); kg.dispose(); pm.dispose(); ink.dispose(); atlas?.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { ledWall: createPixelLedWall };
