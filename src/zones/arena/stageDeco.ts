// Trang trí sân khấu (Kẹo đêm): khung mái/tháp bằng ống tròn mập sọc nho, loa bo tròn, màn LED tháp, props, mặt tiền 3,5 m kẹo,
// cầu thang + rào bo tròn, cổng sọc kẹo; sàn gạch bóng, footlight, chevron, logo phát sáng theo `hypeColors`.
// 5 draw call: cấu trúc tĩnh (toy, vertex colour), 2 màn LED tháp (shader), panel riser mặt tiền (shader), gạch sàn + dải sáng (2 instanced).
import { GROUND_Y0, PIT_FENCE_Z, STAGE_HEIGHT, STAGE_Y } from '../../world/layout';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { PAL, glHex, hypeColors, themed, toColor } from '../../world/style';
import { DECO } from './stageDecoLayout';
import { GLSL_SHAPES, Toy, createToyMaterial, updateToyHype } from './stageStyle';

const { TX, ZF, ZB, TH, ay } = DECO;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
let NIGHT = 0, GRAPE = 0, CREAM = 0;
themed(() => { NIGHT = PAL.night[300]; GRAPE = PAL.grape[500]; CREAM = PAL.cream[500]; });

// ───────── cấu trúc tĩnh ─────────
function buildStatic(): THREE.BufferGeometry {
  const t = new Toy();
  const bands = (a: THREE.Vector3, b: THREE.Vector3, dia: number, gap = 0.9) => t.tubeBands(a, b, dia, NIGHT, GRAPE, 0.24, gap);

  /** Dầm ống: ống trên to (0.45) sọc nho + ống dưới + thanh chống zigzag; spread = khoảng cách dọc (m). */
  function trussTube(a: THREE.Vector3, b: THREE.Vector3, spread: number, top = 0.45, bot = 0.28, zig = true) {
    const up = V(0, spread / 2, 0);
    const a1 = a.clone().add(up), b1 = b.clone().add(up), a2 = a.clone().sub(up), b2 = b.clone().sub(up);
    bands(a1, b1, top);
    t.tube(a2, b2, bot, NIGHT);
    if (zig) {
      const n = Math.max(1, Math.round(a.distanceTo(b) / (spread * 1.2)));
      for (let k = 0; k < n; k++) {
        const p0 = a.clone().lerp(b, k / n), p1 = a.clone().lerp(b, (k + 1) / n);
        t.tube(k % 2 ? p0.clone().sub(up) : p0.clone().add(up), k % 2 ? p1.clone().add(up) : p1.clone().sub(up), 0.13, GRAPE);
      }
    }
  }

  // sàn cánh hai bên mở rộng sân khấu
  for (const sx of [-1, 1]) t.box(7.2, 0.3, 8, sx * 16.5, -0.15, -1, PAL.night[500], { r: 0.12 });

  // tháp 4 góc: 4 ống chủ + vòng ngang + chân đế + nắp kem + sao trên đỉnh
  for (const sx of [-1, 1]) for (const z of [ZF, ZB]) {
    const cx = sx * TX, off = 0.5;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      bands(V(cx + dx * off, GROUND_Y0 + 0.1, z + dz * off), V(cx + dx * off, TH, z + dz * off), 0.45, 1.3);
      t.sphere(0.3, cx + dx * off, TH + 0.05, z + dz * off, CREAM);
      t.sphere(0.28, cx + dx * off, GROUND_Y0 + 0.15, z + dz * off, CREAM);
    }
    for (let y = GROUND_Y0 + 2.0; y < TH - 0.5; y += 2.6) {
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
      for (let i = 0; i < 4; i++) {
        const [x0, z0] = c[i]!, [x1, z1] = c[(i + 1) % 4]!;
        t.tube(V(cx + x0 * off, y, z + z0 * off), V(cx + x1 * off, y, z + z1 * off), 0.16, GRAPE);
      }
      // thanh chéo mặt trước/sau
      t.tube(V(cx - off, y, z - off), V(cx + off, y + 2.6, z - off), 0.11, NIGHT);
      t.tube(V(cx + off, y, z + off), V(cx - off, y + 2.6, z + off), 0.11, NIGHT);
    }
    t.box(1.9, 0.25, 1.9, cx, GROUND_Y0 + 0.12, z, NIGHT, { r: 0.12 });
    t.box(1.5, 0.3, 1.5, cx, TH + 0.2, z, NIGHT, { r: 0.14 });
    t.star(0.9, 0.34, cx, TH + 1.15, z, PAL.honey[500], { ry: Math.PI, trim: true });
  }
  // vòm trước/sau: ống chủ theo đường vòng + ống dưới + chống; nắp kem ở khớp
  const N = 26;
  for (const z of [ZF, ZB]) {
    for (let i = 0; i < N; i++) {
      const x0 = -TX + (2 * TX * i) / N, x1 = -TX + (2 * TX * (i + 1)) / N;
      trussTube(V(x0, ay(x0), z), V(x1, ay(x1), z), 0.8, 0.45, 0.26, false);
      t.tube(V(x1, ay(x1) - 0.4, z), V(x1, ay(x1) + 0.4, z), 0.12, GRAPE);
      if (i % 2 === 1 && i < N - 1) t.sphere(0.27, x1, ay(x1) + 0.4, z, CREAM);
    }
  }
  for (const x of [-16, -8, 0, 8, 16]) {
    bands(V(x, ay(x) + 0.4, ZF), V(x, ay(x) + 0.4, ZB), 0.4, 1.1);
    t.tube(V(x, ay(x) - 0.4, ZF), V(x, ay(x) - 0.4, ZB), 0.24, NIGHT);
    t.sphere(0.3, x, ay(x) + 0.4, ZF, CREAM);
    t.sphere(0.3, x, ay(x) + 0.4, ZB, CREAM);
  }
  // thanh đèn treo (ống bo tròn đầu kem) + cáp
  const BAR_Z = [-3.6, -1.1, 1.4];
  for (const z of BAR_Z) {
    bands(V(-16, 9.5, z), V(16, 9.5, z), 0.42, 1.0);
    for (const sg of [-1, 1]) t.sphere(0.27, sg * 16.1, 9.5, z, CREAM);
    for (const x of [-14, -7, 0, 7, 14]) t.tube(V(x, 9.8, z), V(x, ay(x) - 0.1, z < -2 ? -4.0 : z), 0.08, CREAM);
  }
  bands(V(-14, 6.5, ZB - 0.4), V(14, 6.5, ZB - 0.4), 0.36, 1.0);
  for (const x of [-14, 14]) { t.tube(V(x, 6.7, ZB - 0.4), V(x, 12.0, ZB - 0.4), 0.08, CREAM); t.sphere(0.24, x, 6.5, ZB - 0.4, CREAM); }

  // line-array loa treo: thân night-300, lưới kem, viền nho
  for (const sx of [-1, 1]) {
    const hx = sx * 12.4, hz = -4.3;
    t.tube(V(hx, 11.0, hz), V(hx, ay(hx) - 0.2, hz), 0.12, CREAM);
    for (let i = 0; i < 8; i++) {
      const y = 10.8 - i * 0.8;
      const M = new THREE.Matrix4().compose(V(hx, y, hz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.02 * i, 0, 0)), V(1, 1, 1));
      t.box(1.5, 0.76, 0.95, 0, 0, 0, NIGHT, { m: M, r: 0.14 });
      t.box(1.3, 0.56, 0.06, 0, 0, -0.48, CREAM, { m: M, r: 0.08 });
      t.box(1.5, 0.07, 0.9, 0, 0.38, 0, GRAPE, { m: M, r: 0.03, trim: true });
    }
  }
  // cột màn LED bên: khung bo + viền nho + chân
  for (const sx of [-1, 1]) {
    t.add(new RoundedBoxGeometry(3.5, 9.5, 0.3, 2, 0.14), NIGHT, false, new THREE.Matrix4().makeTranslation(sx * 15.5, 6.0, -5.05));
    t.box(3.25, 9.0, 0.34, sx * 15.5, 6.0, -5.06, GRAPE, { r: 0.15, trim: true });
    t.box(0.7, 1.6, 0.7, sx * 15.5, 0.8, -4.9, NIGHT, { r: 0.2 });
    t.sphere(0.22, sx * 15.5, 1.7, -4.9, CREAM);
  }
  // subwoofer dọc mép sân khấu: thân bo tròn + lưới kem to bo + màng loa nho
  for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) {
    const x = sx * (3.2 + 1.25 * k);
    t.box(1.15, 0.45, 0.8, x, 0.225, -4.3, NIGHT, { r: 0.14 });
    t.box(0.95, 0.34, 0.06, x, 0.225, -4.72, CREAM, { r: 0.12 });
    t.cyl(0.13, 0.13, 0.05, x, 0.225, -4.75, GRAPE, { rx: Math.PI / 2, trim: true });
  }
  // cầu thang xuống hố khán giả: bậc bo tròn xen kẽ + tay vịn ống mập
  {
    const N = Math.max(5, Math.round(PIT_DEPTH / 0.28) - 1);
    const rise = PIT_DEPTH / (N + 1), tread = 0.42, zBot = -5.4;
    const zTop = zBot + tread * (N - 1);
    for (const sx of [-1, 1]) {
      const x = sx * 13.65;
      for (let k = 0; k < N; k++) {
        const top = -rise * (k + 1);
        t.box(1.3, top + PIT_DEPTH, tread + 0.02, x, (top - PIT_DEPTH) / 2, zTop - tread * k, k & 1 ? PAL.grape[700] : NIGHT, { r: Math.min(0.1, (tread + 0.02) * 0.4) });
      }
      const xr = sx * 14.3;
      t.tube(V(xr, 0.95, zTop + tread / 2), V(xr, -rise * N + 0.95, zBot - tread / 2), 0.13, GRAPE);
      t.tube(V(xr, 0, zTop + tread / 2), V(xr, 0.95, zTop + tread / 2), 0.13, GRAPE);
      t.tube(V(xr, -rise * N, zBot - tread / 2), V(xr, -rise * N + 0.95, zBot - tread / 2), 0.13, GRAPE);
      t.sphere(0.12, xr, 0.97, zTop + tread / 2, CREAM);
      t.sphere(0.12, xr, -rise * N + 0.97, zBot - tread / 2, CREAM);
    }
  }
  // rào chắn hố: ray tròn mập kem + trụ xen berry/grape đầu kem
  const BZ = PIT_FENCE_Z;
  for (const sx of [-1, 1]) {
    let i = 0;
    for (let x = 1.9; x <= 13.6; x += 1.2, i++) {
      t.cyl(0.065, 0.065, 1.15, sx * x, GROUND_Y0 + 0.6, BZ, i & 1 ? GRAPE : PAL.berry[500], {}, 10);
      t.sphere(0.1, sx * x, GROUND_Y0 + 1.2, BZ, CREAM);
    }
    t.tube(V(sx * 1.85, GROUND_Y0 + 1.15, BZ), V(sx * 13.65, GROUND_Y0 + 1.15, BZ), 0.11, CREAM);
    t.tube(V(sx * 1.85, GROUND_Y0 + 0.65, BZ), V(sx * 13.65, GROUND_Y0 + 0.65, BZ), 0.07, CREAM);
    t.tube(V(sx * 13.6, GROUND_Y0 + 1.15, BZ), V(sx * 13.6, GROUND_Y0 + 1.15, BZ + 1.2), 0.11, CREAM);
  }
  // trống (riser trái): trống bass/tom berry, mặt kem, chũm chọe mật; tim ở mặt riser
  t.box(3.6, 0.45, 2.8, -6.5, 0.225, 1.5, NIGHT, { r: 0.15 });
  t.heart(0.3, 0.05, -6.5, 0.23, 0.08, PAL.berry[500], { ry: Math.PI, trim: true });
  t.cyl(0.42, 0.42, 0.5, -6.5, 0.87, 0.3, PAL.berry[500], { rx: Math.PI / 2 }, 20);
  t.cyl(0.43, 0.43, 0.05, -6.5, 0.87, 0.03, CREAM, { rx: Math.PI / 2 }, 20);
  for (const dx of [-0.4, 0.4]) { t.cyl(0.22, 0.22, 0.22, -6.5 + dx, 1.5, 0.35, PAL.berry[500], { rx: 0.3 }, 14); t.cyl(0.215, 0.215, 0.04, -6.5 + dx, 1.5, 0.35, CREAM, { rx: 0.3 }, 14); }
  t.cyl(0.26, 0.26, 0.14, -6.84, 1.0, 0.85, CREAM, {}, 14);
  t.tube(V(-6.84, 0.45, 0.85), V(-6.84, 0.93, 0.85), 0.06, GRAPE);
  t.cyl(0.24, 0.24, 0.06, -6.0, 1.12, 0.85, PAL.honey[500], {}, 14);
  t.tube(V(-6.0, 0.45, 0.85), V(-6.0, 1.1, 0.85), 0.06, GRAPE);
  for (const [x, y, z] of [[-7.8, 2.0, 0.5], [-5.3, 2.0, 0.55], [-5.7, 1.85, 1.0]] as [number, number, number][]) {
    t.cyl(0.38, 0.38, 0.05, x, y, z, PAL.honey[500], { rx: 0.2 }, 16);
    t.sphere(0.06, x, y + 0.03, z, CREAM);
    t.tube(V(x, 0.45, z), V(x, y, z), 0.06, GRAPE);
  }
  // keyboard riser phải: phím kem hướng ca sĩ (+Z), đàn thứ hai phía khán giả; sao ở mặt riser
  t.box(3.2, 0.3, 2.2, 6.5, 0.15, 1.5, NIGHT, { r: 0.12 });
  t.star(0.22, 0.05, 6.5, 0.15, 0.38, PAL.honey[500], { ry: Math.PI, trim: true });
  t.box(1.9, 0.1, 0.5, 6.5, 1.2, 1.2, PAL.grape[700], { r: 0.04 });
  t.box(1.9, 0.04, 0.28, 6.5, 1.26, 1.31, CREAM, { r: 0.018 });
  t.box(1.6, 0.1, 0.5, 6.5, 1.5, 0.78, PAL.grape[700], { r: 0.04 });
  for (const dx of [-0.8, 0.8]) { t.tube(V(6.5 + dx, 0.3, 1.2), V(6.5 + dx, 1.2, 1.2), 0.1, GRAPE); t.tube(V(6.5 + dx, 0.3, 0.78), V(6.5 + dx, 1.5, 0.78), 0.1, GRAPE); }
  // amp stack: thân night-300, lưới kem + màng nho, đầu amp berry
  for (const x of [-10.8, -9.3, 9.3, 10.8]) {
    for (const y of [0.475, 1.425]) {
      t.box(1.1, 0.95, 0.6, x, y, 2.3, NIGHT, { r: 0.14 });
      t.box(0.9, 0.76, 0.06, x, y, 1.985, CREAM, { r: 0.1 });
      t.cyl(0.2, 0.2, 0.05, x, y, 1.955, GRAPE, { rx: Math.PI / 2, trim: true });
    }
    t.box(1.0, 0.3, 0.5, x, 2.05, 2.3, PAL.berry[500], { r: 0.1 });
  }
  t.star(0.2, 0.05, -10.05, 1.0, 1.95, PAL.honey[500], { ry: Math.PI, trim: true });
  t.star(0.2, 0.05, 10.05, 1.0, 1.95, PAL.honey[500], { ry: Math.PI, trim: true });
  // mic stand (cần mic cong về phía người hát +Z): đế night-300, cần kem, đầu mic berry
  for (const [x, z] of [[-2.8, -1.8], [2.8, -1.8], [-6, -2.9], [6, -2.9]] as [number, number][]) {
    t.cyl(0.2, 0.2, 0.04, x, 0.02, z, NIGHT, {}, 14);
    t.tube(V(x, 0.02, z), V(x, 1.5, z), 0.06, CREAM);
    t.tube(V(x, 1.5, z), V(x, 1.6, z + 0.35), 0.05, CREAM);
    t.tube(V(x, 1.6, z + 0.33), V(x, 1.6, z + 0.47), 0.11, PAL.berry[500]);
  }
  // cổng sáng trên runway: vòm sọc kẹo (berry/kem hoặc nho/kem) + nơ/sao ở đỉnh
  const R = 1.85, CY = 3.3;
  [-9, -15, -21].forEach((z, gi) => {
    const c1 = gi === 1 ? GRAPE : PAL.berry[500];
    for (const sx of [-1, 1]) t.candyTube(V(sx * R, 0.1, z), V(sx * R, CY, z), 0.3, c1, CREAM, 0.46);
    const NS = 16;
    for (let k = 0; k < NS; k++) {
      const a0 = (k / NS) * Math.PI, a1 = ((k + 1) / NS) * Math.PI;
      t.tube(V(Math.cos(a0) * R, CY + Math.sin(a0) * R, z), V(Math.cos(a1) * R, CY + Math.sin(a1) * R, z), 0.3, k & 1 ? CREAM : c1);
    }
    for (const sx of [-1, 1]) { t.sphere(0.24, sx * R, 0.14, z, CREAM); t.sphere(0.2, sx * R, CY, z, CREAM); }
    if (gi === 1) t.star(0.62, 0.22, 0, CY + R + 0.55, z, PAL.honey[500], { ry: Math.PI, trim: true });
    else t.bow(0.62, 0, CY + R + 0.42, z, PAL.soda[500], PAL.cream[500]);
  });

  // mặt tiền 3,5 m: valance xếp cung (grape/berry) dưới mép sàn
  for (let k = 0; k < 26; k++) {
    const x = -12.35 + k * 0.95;
    if (Math.abs(x) < 1.75) continue;
    t.sphere(1, x, STAGE_Y - 0.3, -5.23, k & 1 ? PAL.berry[500] : GRAPE, {}, 0.46, 0.34, 0.15);
  }
  return t.build();
}

// ───────── màn LED tháp (shader palette Kẹo đêm) ─────────
const ledVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const ledFrag = () => /* glsl */ `
uniform float uTime; uniform float uBeat; uniform float uLevel; uniform float uHype; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
varying vec2 vUv;
${GLSL_SHAPES}
const vec3 N5 = ${glHex(PAL.night[500])};
const vec3 N3 = ${glHex(PAL.night[300])};
const vec3 CREAM = ${glHex(PAL.cream[500])};
void main(){
  vec2 q = (vUv - 0.5) * vec2(3.0, 8.6);
  float sd = sdRoundRect(q, vec2(1.5, 4.3), 0.4);
  if (sd > 0.0) discard;
  vec3 col = mix(N5, mix(N3, uA * 0.55, 0.5), 0.25 + 0.75 * vUv.y);
  // bokeh trôi lên
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float sp = 0.15 + 0.1 * hash11(fi);
    float yy = fract(hash11(fi + 3.0) + uTime * sp * (0.4 + uHype)) ;
    vec2 c = vec2((hash11(fi + 9.0) - 0.5) * 2.4, (yy - 0.5) * 9.4);
    float rr = 0.18 + 0.2 * hash11(fi + 5.0);
    float m = ss(rr, rr * 0.2, length(q - c));
    col = mix(col, mix(uB, uC, hash11(fi)), m * 0.4);
    // tim / sao nhỏ
    if (i < 3) {
      vec2 hc = (q - c * vec2(0.8, 1.0)) / 0.38;
      float sdm = (mod(fi, 2.0) < 1.0) ? sdHeart(hc + vec2(0.0, 0.45)) * 0.38 : (sdStar5(hc, 1.0, 0.5) - 0.12) * 0.38;
      col = mix(col, CREAM, ss(0.02, -0.02, sdm) * (0.55 + 0.4 * uBeat));
    }
  }
  // cột equaliser bo tròn
  for (int c = 0; c < 5; c++) {
    float fc = float(c);
    float cx = (fc - 2.0) * 0.56;
    float rnd = hash11(fc + floor(uTime * (2.0 + 4.0 * uHype)) * 0.37);
    float h = clamp(0.8 + 5.0 * uLevel * (0.3 + rnd) + 2.4 * uBeat * rnd * (0.3 + uHype), 0.4, 7.6);
    float y0 = -3.9;
    vec2 pa = vec2(cx, y0), pb = vec2(cx, y0 + h);
    vec2 pp = q - pa, ba = pb - pa;
    float tt = clamp(dot(pp, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pp - ba * tt) - 0.2;
    vec3 bc = mix(uA, uB, fc / 4.0 + 0.2 * sin(uTime + fc));
    bc = mix(bc, uC, ss(0.7, 1.0, (q.y - y0) / max(h, 0.1)) * 0.6);
    float hl = ss(0.02, -0.02, length(q - vec2(cx - 0.07, y0 + h - 0.12)) - 0.045);
    col = mix(col, bc * (0.75 + 0.35 * uBeat), ss(0.015, -0.015, d));
    col = mix(col, CREAM, hl * 0.7 * ss(0.015, -0.015, d));
  }
  // viền bo
  col = mix(col, uA * 1.05 + 0.1, ss(-0.12, -0.04, sd) * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`;

// ───────── panel LED riser mặt tiền (kẹo sọc + tim/sao) ─────────
const riserFrag = () => /* glsl */ `
uniform float uTime; uniform float uBeat; uniform float uHype; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
varying vec2 vUv; varying float vId;
${GLSL_SHAPES}
const vec3 N5 = ${glHex(PAL.night[500])};
const vec3 N3 = ${glHex(PAL.night[300])};
const vec3 CREAM = ${glHex(PAL.cream[500])};
void main(){
  vec2 q = (vUv - 0.5) * vec2(1.8, 2.8);
  float sd = sdRoundRect(q, vec2(0.9, 1.4), 0.38);
  if (sd > 0.0) discard;
  float id = floor(vId + 0.5);
  float odd = mod(id, 2.0);
  vec3 bg = mix(N5, N3, vUv.y);
  float s = fract((q.x + q.y) * 0.85 - uTime * 0.22 * (0.4 + uHype) + id * 0.17);
  vec3 sc = mix(uA, uB, odd);
  vec3 cA = sc * (0.95 + 0.25 * uBeat);
  vec3 cB = mix(sc, CREAM, 0.55);
  vec3 col = mix(cB, cA, step(0.5, s)) * (0.5 + 0.5 * uHype);
  col = mix(bg, col, 0.9);
  float pul = 1.0 + 0.12 * uBeat;
  vec2 c = q - vec2(0.0, 0.05 * sin(uTime * 1.6 + id));
  float m = odd < 0.5 ? sdHeart(c / (0.62 * pul) + vec2(0.0, 0.45)) * 0.62 * pul : (sdStar5(c / (0.52 * pul), 1.0, 0.5) - 0.12) * 0.52 * pul;
  col = mix(col, N5, ss(0.1, 0.04, m) * 0.8);
  col = mix(col, odd < 0.5 ? uA * 1.1 + 0.05 : uC * 1.05 + 0.05, ss(0.012, -0.012, m));
  col = mix(col, CREAM, ss(0.012, -0.012, abs(m + 0.02) - 0.012) * 0.9);
  col = mix(col, CREAM, ss(-0.11, -0.05, sd) * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

// ───────── phần tử phát sáng (instanced) ─────────
interface Item { g: number; a: number; b: number; x: number; z: number }

/** Độ sâu hố sân khấu (mặt sân khấu → mặt đất nền). */
const PIT_DEPTH = STAGE_Y - GROUND_Y0;

/** Gạch bóng: hộp bo tròn đơn vị, vertex colour = highlight chéo + bậc tối ở cạnh. */
function tileGeo(): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(1, 1, 1, 4, 0.3);
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const top = n.getY(i) > 0.5;
    const k = top ? 0.78 + 0.45 * Math.min(1, Math.max(0, 0.5 - (p.getX(i) - p.getZ(i)) * 0.7)) : 0.5;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}
/** Dải sáng tròn dọc trục X (độ dài 1, đường kính 1). */
function beamGeo(): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(0.5, 0, 2, 8).rotateZ(Math.PI / 2);
  // capsule length 0 → đường kính 1 dọc X: sau scale (len,d,d) đầu hơi dẹt, ổn vì d nhỏ
  const n = g.getAttribute('normal');
  const c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const d = n.getX(i) * 0.35 + n.getY(i) * 0.8 + n.getZ(i) * 0.4;
    const k = d > 0.1 ? 1 : 0.7;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}

export function createStageDeco(scene: THREE.Scene) {
  const staticGeo = buildStatic();
  const toyM = createToyMaterial();
  const staticMesh = new THREE.Mesh(staticGeo, toyM.mat);
  scene.add(staticMesh);

  const planes = [-1, 1].map((sx) => {
    const g = new THREE.PlaneGeometry(3.0, 8.6);
    g.rotateY(Math.PI); // mặt hướng khán giả (-Z)
    g.translate(sx * 15.5, 6.0, -5.25);
    return g;
  });
  const ledGeo = mergeGeometries(planes)!;
  planes.forEach((g) => g.dispose());
  const ledU = {
    uTime: { value: 0 }, uBeat: { value: 0 }, uLevel: { value: 0 }, uHype: { value: 0 },
    uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() },
  };
  const ledMat = new THREE.ShaderMaterial({ uniforms: ledU, vertexShader: ledVert, fragmentShader: ledFrag(), side: THREE.DoubleSide, fog: false });
  const ledMesh = new THREE.Mesh(ledGeo, ledMat);
  scene.add(ledMesh);

  // panel riser mặt tiền (12 tấm bo tròn, 1 draw call)
  const rp: THREE.BufferGeometry[] = [];
  let pid = 0;
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) {
    const g = new THREE.PlaneGeometry(1.8, STAGE_HEIGHT * 0.8);
    g.rotateY(Math.PI);
    g.translate(sx * (2.9 + 2 * i), STAGE_Y - STAGE_HEIGHT / 2, -5.17);
    g.setAttribute('aId', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(pid++), 1));
    rp.push(g);
  }
  const riserGeo = mergeGeometries(rp)!;
  rp.forEach((g) => g.dispose());
  const riserU = {
    uTime: { value: 0 }, uBeat: { value: 0 }, uHype: { value: 0 },
    uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() },
  };
  const riserMat = new THREE.ShaderMaterial({
    uniforms: riserU,
    vertexShader: 'attribute float aId; varying vec2 vUv; varying float vId; void main(){ vUv = uv; vId = aId; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: riserFrag(), side: THREE.DoubleSide, fog: false,
  });
  const riserMesh = new THREE.Mesh(riserGeo, riserMat);
  scene.add(riserMesh);

  interface Inst { items: Item[]; mats: THREE.Matrix4[] }
  const tiles: Inst = { items: [], mats: [] };
  const beams: Inst = { items: [], mats: [] };
  const o = new THREE.Object3D();
  const add = (g: number, a: number, b: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) => {
    const tile = g <= 1;
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
    if (tile) o.scale.set(sx, sy, sz); else { const d = Math.max(0.06, sy, sz * 0.7); o.scale.set(sx, d, d); }
    o.updateMatrix();
    const dst = tile ? tiles : beams;
    dst.mats.push(o.matrix.clone());
    dst.items.push({ g, a, b, x, z });
  };
  // segment nằm ngang trên mặt phẳng XZ theo hướng (dx,dz)
  const flat = (g: number, a: number, b: number, x: number, y: number, z: number, dx: number, dz: number, len: number, t: number) =>
    add(g, a, b, x, y, z, len, 0.03, t, 0, Math.atan2(-dz, dx), 0);
  // 0: gạch sàn bóng
  for (let i = 0; i < 12; i++) for (let j = 0; j < 5; j++) {
    const x = -11 + 2 * i, z = 1.9 - 1.5 * j;
    add(0, i + j, (i + j) & 1, x, 0.02, z, 1.8, 0.03, 1.3);
  }
  // 1: footlight mép sân khấu
  for (let i = 0; i < 43; i++) add(1, i, 0, -12.6 + 0.6 * i, 0.04, -4.7, 0.3, 0.07, 0.15);
  // 3: chevron chỉ hướng runway
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) add(3, k, 0, s * 0.45, 0.04, -6.0 - 0.7 * k, 1.0, 0.03, 0.12, 0, s * 0.7, 0);
  // 4: hạt sáng bên trong cổng
  const R = 1.85, CY = 3.3, R2 = R - 0.2;
  [-9, -15, -21].forEach((z, gi) => {
    const segs: [number, number, number, number, number][] = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) segs.push([sx * R2, 0.55 + k * 1.1, 0.5, Math.PI / 2, sx > 0 ? k / 40 : 1 - k / 40]);
    const NS = 14;
    for (let k = 0; k < NS; k++) {
      const a0 = (k / NS) * Math.PI, a1 = ((k + 1) / NS) * Math.PI, am = (a0 + a1) / 2;
      segs.push([Math.cos(am) * R2, CY + Math.sin(am) * R2, 2 * R2 * Math.sin(Math.PI / NS / 2) * 0.6, am + Math.PI / 2, 0.05 + 0.9 * (1 - am / Math.PI)]);
    }
    for (const [x, y, len, ang, t] of segs) add(4, gi, t, x, y, z, len, 0.06, 0.06, 0, 0, ang);
  });
  // 5: vòng logo + 6: ngôi sao trên bục cuối
  const PZ = -26;
  for (const [r, n, grp] of [[2.85, 36, 5], [1.0, 14, 5]] as [number, number, number][]) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      flat(grp, k, k / n, Math.cos(a) * r, 0.04, PZ + Math.sin(a) * r, -Math.sin(a), Math.cos(a), ((2 * Math.PI * r) / n) * 1.04, r > 2 ? 0.1 : 0.07);
    }
  }
  for (let k = 0; k < 5; k++) {
    const a0 = (k * 2 * Math.PI * 2) / 5 - Math.PI / 2, a1 = ((k * 2 + 2) * Math.PI * 2) / 5 - Math.PI / 2;
    const x0 = Math.cos(a0) * 1.9, z0 = Math.sin(a0) * 1.9, x1 = Math.cos(a1) * 1.9, z1 = Math.sin(a1) * 1.9;
    flat(6, k, 0, (x0 + x1) / 2, 0.045, PZ + (z0 + z1) / 2, x1 - x0, z1 - z0, Math.hypot(x1 - x0, z1 - z0), 0.08);
  }
  // 7: dải sáng trên tay vịn rào
  for (const sx of [-1, 1]) add(7, 0, 0, sx * 7.75, GROUND_Y0 + 1.225, PIT_FENCE_Z, 11.8, 0.05, 0.05);

  const mkInst = (geo: THREE.BufferGeometry, inst: Inst) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false }), inst.items.length);
    const c = new THREE.Color();
    for (let i = 0; i < inst.items.length; i++) { m.setMatrixAt(i, inst.mats[i]!); m.setColorAt(i, c.setRGB(0.1, 0.1, 0.2)); }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const tGeo = tileGeo(), bGeo = beamGeo();
  const emT = mkInst(tGeo, tiles), emB = mkInst(bGeo, beams);

  const ring = (a: number, b: number) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
  const pal = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
  const col = new THREE.Color();
  const floorBase = toColor(PAL.night[300]);

  function shadeItem(it: Item, f: FrameState, t: number, hype: number, beat: number, pulse: number, sp: number): THREE.Color {
    let b = 0.2, k = 0;
    switch (it.g) {
      case 0: { // gạch sàn: sóng đồng tâm chạy theo beat
        const dist = Math.hypot(it.x, (it.z + 1) * 1.6);
        const w = ((beat * 0.25 * sp - dist * 0.09) % 1 + 1) % 1;
        const r = Math.pow(Math.max(0, 1 - w * 2.6), 2);
        b = 0.1 + 0.55 * r * (0.5 + hype) + 0.05 * pulse + (it.b ? 0.08 * pulse * hype : 0);
        k = Math.floor(dist * 0.4);
        break;
      }
      case 1:
        b = 0.3 + 0.55 * Math.max(0, Math.sin(beat * Math.PI * 0.5 * sp * 2 - it.a * 0.5)) + 0.1 * pulse;
        k = it.a >> 2;
        break;
      case 3: {
        const head = (beat * sp) % 4;
        const d = (head - it.a + 4) % 4;
        b = 0.25 + 0.75 * Math.max(0, 1 - d / 1.5);
        k = 1;
        break;
      }
      case 4: {
        const head = (beat * 0.25 * sp + it.a * 0.33) % 1;
        b = 0.3 + 0.6 * Math.max(0, 1 - ring(it.b, head) * 5) + 0.05 * pulse;
        k = it.a * 2 + Math.floor(beat / 4);
        break;
      }
      case 5: {
        const head = (beat * 0.125 * sp) % 1;
        b = 0.35 + 0.7 * Math.max(0, 1 - ring(it.b, head) * 4) + 0.08 * pulse;
        k = Math.floor(it.b * 4);
        break;
      }
      case 6:
        b = 0.5 + 0.45 * pulse + 0.2 * Math.sin(t * 2 + it.a);
        k = it.a;
        break;
      default:
        b = 0.45 + 0.2 * pulse;
        k = 2;
    }
    const base = pal[((k % 3) + 3) % 3]!;
    if (it.g === 0) return col.copy(floorBase).lerp(base, Math.min(0.95, b * 1.5));
    return col.copy(base).multiplyScalar(Math.min(1, b));
  }

  const setV = (v: THREE.Vector3, rgb: readonly number[]) => v.set(rgb[0]!, rgb[1]!, rgb[2]!);
  return {
    update(f: FrameState, t: number) {
      const hype = Math.min(1, Math.max(0, f.hype));
      const beat = Math.max(0, f.beat);
      const pulse = f.beatPulse;
      const sp = 0.5 + 1.5 * hype;
      updateToyHype(hype);
      const hc = hypeColors(hype);
      pal[0]!.setRGB(hc.primary[0], hc.primary[1], hc.primary[2], THREE.SRGBColorSpace);
      pal[1]!.setRGB(hc.secondary[0], hc.secondary[1], hc.secondary[2], THREE.SRGBColorSpace);
      pal[2]!.setRGB(hc.accent[0], hc.accent[1], hc.accent[2], THREE.SRGBColorSpace);
      for (const [inst, em] of [[tiles, emT], [beams, emB]] as const) {
        for (let i = 0; i < inst.items.length; i++) em.setColorAt(i, shadeItem(inst.items[i]!, f, t, hype, beat, pulse, sp));
        em.instanceColor!.needsUpdate = true;
      }
      for (const [u, extra] of [[ledU, true], [riserU, false]] as const) {
        u.uTime.value = t; u.uBeat.value = pulse; u.uHype.value = hype;
        if (extra) (u as typeof ledU).uLevel.value = f.level;
        setV(u.uA.value, hc.primary); setV(u.uB.value, hc.secondary); setV(u.uC.value, hc.accent);
      }
    },
    dispose() {
      scene.remove(staticMesh, ledMesh, riserMesh, emT, emB);
      staticGeo.dispose(); toyM.dispose();
      ledGeo.dispose(); ledMat.dispose();
      riserGeo.dispose(); riserMat.dispose();
      tGeo.dispose(); bGeo.dispose(); (emT.material as THREE.Material).dispose(); (emB.material as THREE.Material).dispose(); emT.dispose(); emB.dispose();
    },
  };
}
