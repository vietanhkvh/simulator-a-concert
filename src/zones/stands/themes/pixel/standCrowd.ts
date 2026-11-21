// "Đêm Sao Điểm Ảnh" — khán giả khán đài (gói P2, khe stands `standCrowd`): ĐIỂM HOẠ kiểu Seurat. Mỗi ghế một chấm
// (lưới so le, KÍN mọi hàng ở mọi mức Hype), cỡ chấm = khoảng cách ghế chiếu lên đích thấp: xa = đúng 1 px, gần (camera
// trên khán đài) = khối vuông có "đầu" → khán đài luôn trông đầy người. Màu chấm: tông trung (tím chiều, lam Phổ, đất,
// sen, ngọc…) + "sao" crôm sáng 25 % → 60 % → 100 % theo Hype; ≥ 80 % cả khán đài ngả son–cam ("Tiếng thét").
// 'cs-interact': cheer = dải sao kem chạy vòng (chớp ≤ 3 lần/giây) · wave = sóng Hokusai lam + bọt trắng nhấc lên ·
// heart = trái tim hồng sen ghép bằng chấm · flash = biển sao kem · pyro = quầng son–cam tràn từ sân khấu ra.
// 1 THREE.Points, hoạt ảnh trong shader, màu là chỉ số bảng 31 màu.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { STADIUM_CENTRE, STANDS_ARC, STANDS_TIERS } from '../../../../world/layout';
import { viewHeightPx } from '../../../../world/shared/viewport';
import type { StandCrowdHandle, StandsBuilders } from '../../builders';
import { pal31, palRgb } from './pal';

const VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uRes;
uniform vec3 uPal[31];
uniform float uCheer; uniform float uCheerAge; uniform float uWave; uniform float uWavePos;
uniform float uHeart; uniform float uFlash; uniform float uPyro; uniform float uPyroAge;
attribute vec3 aSeed; // rand, góc chuẩn hoá 0..1, rand 2
varying vec3 vCol; varying vec3 vHead; varying float vSize;
float h11(float x){ return fract(sin(x * 127.1) * 43758.5453); }
void main(){
  float sd = aSeed.x, ang = aSeed.y, s2 = aSeed.z;
  vec3 p = position;
  float tq = floor(uTime * 12.0) / 12.0;
  // màu nền dân số (tông trung, đa sắc kiểu điểm hoạ) — luôn đủ người
  float pk = fract(sd * 7.13);
  int ci = pk < 0.2 ? 23 : (pk < 0.36 ? 3 : (pk < 0.5 ? 22 : (pk < 0.6 ? 19 : (pk < 0.7 ? 30 : (pk < 0.78 ? 29 : (pk < 0.86 ? 11 : (pk < 0.93 ? 2 : 18)))))));
  // "Tiếng thét": ngả son–cam
  float scr = smoothstep(0.78, 0.86, uHype);
  if (fract(sd * 3.7) < scr * 0.75) ci = fract(sd * 11.3) < 0.5 ? 14 : (fract(sd * 5.9) < 0.5 ? 15 : 6);
  // sao sáng theo Hype: 25 % → 60 % → 100 % (trong số chấm "đèn" 45 %)
  float frac = uHype < 0.4 ? mix(0.11, 0.2, uHype / 0.4) : (uHype < 0.8 ? mix(0.2, 0.32, (uHype - 0.4) / 0.4) : mix(0.32, 0.45, (uHype - 0.8) / 0.2));
  float lit = step(1.0 - frac, fract(sd * 13.7));
  float tw = step(0.5, h11(floor(tq * 1.5 + s2 * 7.0) + sd * 91.0)); // lấp lánh chậm (≤ 1,5 Hz)
  if (lit > 0.5) ci = scr > 0.5 ? (tw > 0.5 ? 16 : 6) : (tw > 0.5 ? 8 : 7);
  int hi = fract(s2 * 5.3) < 0.6 ? 19 : (fract(s2 * 9.1) < 0.5 ? 20 : 18); // da / tóc cho "đầu" khi chấm to
  if (uFlash > 0.001 && fract(sd * 31.7) < uFlash * 0.8) ci = fract(sd * 5.7) < 0.7 ? 8 : 28;
  if (uWave > 0.001) {
    float dd = ang - uWavePos;
    float crest = exp(-dd * dd / (dd > 0.0 ? 0.0004 : 0.0016));
    float face = exp(-dd * dd / 0.004);
    if (face * uWave > 0.35) ci = 3;
    if (crest * uWave > 0.5) ci = fract(sd * 2.3) < 0.6 ? 28 : 4;
    p.y += uWave * floor(crest * 3.0) * 0.9;
  }
  if (uHeart > 0.001) {
    float x = (ang - 0.5) * 7.0, y = (position.y - 17.0) / 9.0;
    float q = x * x + y * y - 1.0;
    float inH = step(q * q * q - x * x * y * y * y, 0.0);
    if (inH * uHeart > 0.5) ci = fract(sd * 4.1) < 0.7 ? 30 : 24;
  }
  if (uPyro > 0.001) {
    float r = length(position.xz);
    float front = 55.0 + uPyroAge * 80.0;
    float wash = step(r, front) * step(front - 40.0, r);
    if (wash * uPyro > 0.5 && fract(sd * 9.7) < 0.7) ci = fract(sd * 6.1) < 0.5 ? 15 : 16;
  }
  if (uCheer > 0.001) {
    float da = abs(ang - 0.5) * 2.0;
    float rr = fract(uCheerAge * 0.8);
    float race = step(abs(da - rr), 0.06);
    float strobe = step(0.62, fract(uTime * 2.8 + floor(ang * 12.0) * 0.13)); // ≤ 2,8 chớp/s
    if (race * uCheer > 0.5) { ci = strobe > 0.5 ? 8 : 7; p.y += 0.6; }
  }
  vCol = uPal[ci];
  vHead = uPal[hi];
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // cỡ chấm = khoảng cách ghế (~0,6 m) chiếu lên đích thấp, nguyên pixel
  float pxm = projectionMatrix[1][1] * uRes * 0.5 / max(1.0, -mv.z);
  float sz = clamp(floor(0.62 * pxm + 0.5), 1.0, 12.0);
  vSize = sz;
  gl_PointSize = sz;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec3 vCol; varying vec3 vHead; varying float vSize;
void main(){
  if (vSize >= 3.0) {
    // chấm to (camera gần): bóng người ngồi — đầu vuông giữa trên, vai dưới
    vec2 q = floor(gl_PointCoord * vSize);
    float hw = max(1.0, floor(vSize * 0.34));
    float headTop = floor(vSize * 0.42);
    bool head = q.y < headTop && abs(q.x + 0.5 - vSize * 0.5) <= hw * 0.5 + 0.01;
    bool body = q.y >= headTop && q.x >= floor(vSize * 0.12) && q.x < vSize - floor(vSize * 0.12);
    if (!head && !body) discard;
    gl_FragColor = vec4(head ? vHead : vCol, 1.0);
    return;
  }
  gl_FragColor = vec4(vCol, 1.0);
}`;

export function createPixelStandCrowd(ctx: Parameters<NonNullable<StandsBuilders['standCrowd']>>[0]): StandCrowdHandle {
  const { scene } = ctx;
  const uniforms = ctx.uniforms as Record<string, { value: unknown }>;
  const CX = STADIUM_CENTRE.x, CZ = STADIUM_CENTRE.z, A0 = STANDS_ARC.from, A1 = STANDS_ARC.to, SECTIONS = 8;
  // lưới ghế so le, đủ mọi hàng (không bốc ngẫu nhiên → không có mảng trống)
  const ps: number[] = [], ss: number[] = [];
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const T of STANDS_TIERS) {
    const rows = Math.round((T.r1 - T.r0 - 0.6) / 0.85);
    for (let row = 0; row < rows; row++) {
      const f = (row + 0.5) / rows;
      const r = T.r0 + 0.4 + f * (T.r1 - T.r0 - 0.8);
      const y = T.y0 + 0.15 + f * (T.y1 - T.y0) + 0.75;
      const len = r * (A1 - A0), n = Math.floor(len / 0.55);
      for (let j = 0; j < n; j++) {
        const u = (j + 0.5 + (row % 2) * 0.5) / n;
        let skip = false;
        for (let k = 1; k < SECTIONS; k++) if (Math.abs(u - k / SECTIONS) * len < 1.05) skip = true;
        if (skip || u > 0.998 || u < 0.002) continue;
        const a = A0 + (A1 - A0) * u;
        ps.push(CX + Math.sin(a) * r, y, CZ - Math.cos(a) * r);
        ss.push(rnd(), u, rnd());
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(ss, 3));
  const pal = pal31();
  const fxU = {
    uRes: { value: 240 }, uPal: { value: pal.map((_, i) => new THREE.Vector3(...palRgb(pal, i))) },
    uCheer: { value: 0 }, uCheerAge: { value: 99 }, uWave: { value: 0 }, uWavePos: { value: -1 },
    uHeart: { value: 0 }, uFlash: { value: 0 }, uPyro: { value: 0 }, uPyroAge: { value: 99 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHype: { value: 0 }, uPulse: { value: 0 }, ...uniforms, ...fxU },
    vertexShader: VERT, fragmentShader: FRAG, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 1;
  pts.name = 'standCrowd-pixel';
  scene.add(pts);

  const age = { cheer: 99, wave: 99, heart: 99, pyro: 99 };
  let flashOn = false, waveModeOn = false, lastT = -1, lastReal = performance.now(), waveLap = 0;
  const onInteract = (e: Event) => {
    const d = (e as CustomEvent).detail as { kind?: string; on?: boolean } | undefined;
    if (!d) return;
    if (d.kind === 'cheer') age.cheer = 0;
    else if (d.kind === 'heart') age.heart = 0;
    else if (d.kind === 'pyro') age.pyro = 0;
    else if (d.kind === 'flash') flashOn = d.on ?? !flashOn;
    else if (d.kind === 'wave') { if (fxU.uWave.value < 0.05) waveLap = 0; age.wave = 0; }
  };
  window.addEventListener('cs-interact', onInteract);
  const env = (a: number, dur: number, fin: number, fout: number) => Math.max(0, Math.min(1, a / fin, (dur - a) / fout));
  const ease = (v: number, target: number, rate: number) => v + Math.max(-rate, Math.min(rate, target - v));
  pts.onBeforeRender = () => {
    fxU.uRes.value = viewHeightPx();
    const now = performance.now();
    const t = (mat.uniforms.uTime!.value as number) ?? now / 1000;
    let dt = t - lastT;
    if (lastT < 0 || dt <= 0 || dt > 0.5) dt = Math.min(0.1, (now - lastReal) / 1000);
    lastT = t; lastReal = now;
    age.cheer += dt; age.wave += dt; age.heart += dt; age.pyro += dt;
    fxU.uCheer.value = env(age.cheer, 2.8, 0.15, 1.0); fxU.uCheerAge.value = age.cheer;
    fxU.uHeart.value = env(age.heart, 4.4, 0.4, 1.1);
    fxU.uPyro.value = env(age.pyro, 3.6, 0.15, 1.1); fxU.uPyroAge.value = age.pyro;
    fxU.uFlash.value = ease(fxU.uFlash.value, flashOn ? 1 : 0, dt / 0.9);
    const waveOn = waveModeOn || age.wave < 6;
    fxU.uWave.value = ease(fxU.uWave.value, waveOn ? 1 : 0, dt / 0.9);
    if (fxU.uWave.value > 0) waveLap += dt / 3.6; else waveLap = 0;
    fxU.uWavePos.value = (waveLap % 1) * 1.3 - 0.15;
  };
  return {
    update(f: FrameState) { waveModeOn = f.waveMode === 1; },
    dispose() {
      window.removeEventListener('cs-interact', onInteract);
      scene.remove(pts);
      geo.dispose(); mat.dispose();
    },
  };
}

export const builders: Partial<StandsBuilders> = { standCrowd: createPixelStandCrowd };
