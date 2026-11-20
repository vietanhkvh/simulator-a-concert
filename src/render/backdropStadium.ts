// Khán đài sân vận động ngoài trời: 3 tầng cong quanh khán giả, tháp đèn pha 4 góc,
// "biển" lightstick khán đài xa (1 THREE.Points, hoạt ảnh hoàn toàn trong shader). 2 draw call
// (+ đèn nhà hát / cụm đèn pha nằm trong Points điểm sáng chung của backdropSky).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../core/types';
import { addGlow, type GlowBuf, type Uniforms } from './backdropSky';

const CX = 0, CZ = -10;
const A0 = -0.72 * Math.PI, A1 = 0.72 * Math.PI;
// tầng: mặt trước (r, y đáy → y đỉnh), khán đài dốc (r0→r1, y0→y1)
const TIERS = [
  { rf: 84, yf0: -1, r0: 84, r1: 96, y0: 6, y1: 12 },
  { rf: 97, yf0: 12, r0: 97, r1: 108, y0: 15, y1: 21 },
  { rf: 109, yf0: 21, r0: 109, r1: 120, y0: 24, y1: 30 },
];

const CROWD_VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uPhase; uniform float uRes;
// hiệu ứng tương tác (JS nới mềm): bao 0..1 + tuổi (s)
uniform float uCheer; uniform float uCheerAge; uniform float uWave; uniform float uWavePos;
uniform float uHeart; uniform float uHeartAge; uniform float uFlash; uniform float uPyro; uniform float uPyroAge;
attribute vec2 aSeed; // seed, góc chuẩn hoá 0..1
varying vec3 vCol;
vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.0)-3.0)-1.0,0.,1.); return v*mix(vec3(1.),k,s); }
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
  // màu: thấp hype = lẫn lộn, cao hype = sóng hồng/cyan đồng bộ
  vec3 mixed = hsv(fract(sd * 7.13), 0.75, 1.0);
  float w = 0.5 + 0.5 * sin(ang * 40.0 - uTime * 2.2 + uPhase * 0.5);
  vec3 wave = mix(vec3(1.0, 0.25, 0.7), vec3(0.2, 0.9, 1.0), w);
  float u = smoothstep(0.35, 0.85, uHype);
  vec3 c = mix(mixed, wave, u);
  float tw = 0.55 + 0.45 * sin(uTime * (2.0 + sd * 5.0) + sd * 40.0);
  float b = mix(tw, 0.8 + 0.2 * w, u * 0.7) * (0.45 + 0.35 * uHype + 0.3 * uPulse);
  float hold = step(0.08, fract(sd * 13.7)); // vài chỗ không giơ lightstick
  vec3 col = c * b * hold;
  float sz = 2.2;
  float y = position.y;
  float da = abs(ang - 0.5) * 2.0; // 0 giữa khán đài xa, 1 hai đầu (cạnh sân khấu)
  // 4: đèn flash điện thoại — bầu trời sao trắng, lightstick màu tối đi
  if (uFlash > 0.001) {
    float ph = step(0.42, fract(sd * 31.7));
    float tk = 0.5 + 0.5 * sin(uTime * (5.0 + sd * 9.0) + sd * 91.0);
    vec3 pc = vec3(1.0, 0.97, 0.92) * (0.7 + 1.3 * tk * tk);
    col = mix(col, mix(col * 0.22, pc, ph), uFlash);
    sz += uFlash * ph * (1.0 + 1.2 * tk);
  }
  // 2: sóng sân vận động — dải sáng cao chạy vòng quanh (bảng màu sóng biển)
  if (uWave > 0.001) {
    float dd = ang - uWavePos;
    float crest = exp(-dd * dd / 0.0012);
    float swell = exp(-dd * dd / 0.012);
    vec3 deep = vec3(0.06, 0.14, 0.85) * (0.35 + 0.15 * h11(sd * 9.0));
    vec3 wc = mix(deep, vec3(0.0, 0.45, 0.85) * 1.2, swell);
    wc = mix(wc, vec3(0.88, 1.0, 1.0) * 2.0, crest);
    col = mix(col, wc * hold, uWave);
    p.y += uWave * (crest * 3.5 + swell * 0.8);
    sz += uWave * (crest * 3.2 + swell * 0.8);
  }
  // 3: thả tim — hồng/đỏ, nhịp tim đập đôi + 3 trái tim khổng lồ ghép bằng chấm sáng
  if (uHeart > 0.001) {
    float th = thump(uHeartAge);
    float a = (ang - 0.5) * 2.0 * 2.2619; // rad
    float hx = min(min(abs(a), abs(a - 1.15)), abs(a + 1.15)) * 100.0;
    float hs = 0.85 + 0.15 * th;
    float inH = heartIn(vec2(hx / (21.0 * hs), (y - 17.5) / (11.0 * hs)));
    vec3 pink = mix(vec3(1.0, 0.08, 0.3), vec3(1.0, 0.35, 0.7), sd);
    vec3 hc = mix(pink * (0.3 + 0.45 * th), vec3(1.0, 0.1, 0.25) * (2.2 + 1.6 * th), inH);
    col = mix(col, hc, uHeart);
    sz += uHeart * (inH * (2.2 + 1.5 * th) + 0.6 * th);
    p.y += uHeart * th * 0.6;
  }
  // 5: pháo hoa — sóng cam/vàng lan từ phía sân khấu ra + chớp lấp lánh
  if (uPyro > 0.001) {
    float front = uPyroAge * 0.95;
    float wash = smoothstep(0.0, 0.25, front - (1.0 - da));
    float fl = 0.55 + 0.45 * sin(uTime * 23.0 + sd * 70.0);
    vec3 warm = mix(vec3(1.0, 0.38, 0.05), vec3(1.0, 0.7, 0.2), fl) * (0.9 + 0.5 * fl);
    float cell = floor(ang * 36.0) + floor(y / 8.0) * 50.0;
    float bt = fract(uTime * 0.9 + h11(cell));
    float burst = exp(-bt * 5.0) * step(0.55, h11(cell + 7.0)) * step(0.5, fract(sd * 17.3));
    float edge = exp(-pow((front - (1.0 - da)) * 6.0, 2.0));
    col = mix(col, warm, min(1.0, uPyro * wash * 1.5)) + vec3(1.0, 0.95, 0.75) * (burst * 3.5 * wash + edge * 1.2) * uPyro;
    sz += uPyro * (wash * 0.8 + burst * 3.0 * wash + edge * 1.5);
  }
  // 1: hò reo — xung sáng chạy quanh bowl + cả khán đài nhảy, nhấp nháy trắng-vàng
  if (uCheer > 0.001) {
    float r = fract(uCheerAge * 0.85);
    float race = exp(-pow((da - r) * 7.0, 2.0));
    float fk = step(0.5, h11(floor(uTime * 12.0) + sd * 311.0));
    vec3 gold = mix(vec3(1.0, 0.78, 0.35), vec3(1.0), fk);
    col = mix(col, gold * (0.8 + 0.8 * fk), uCheer * 0.85) + vec3(1.0, 0.95, 0.8) * race * 2.0 * uCheer;
    p.y += uCheer * (1.4 * abs(sin(uTime * 8.0 + sd * 20.0)) + race * 1.5);
    sz += uCheer * (1.2 + 0.8 * fk + 2.5 * race);
  }
  vCol = col;
  gl_PointSize = sz * uRes;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const CROWD_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vCol * (1.0 - d * 0.5), 1.0);
}`;

export function createStadium(scene: THREE.Scene, uniforms: Uniforms, glow: GlowBuf) {
  const disposables: { dispose(): void }[] = [];
  const pos: number[] = [], col: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], ca: number[], cb: number[]) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    col.push(...ca, ...ca, ...cb, ...ca, ...cb, ...cb);
  };
  const P = (r: number, a: number, y: number) => [CX + Math.sin(a) * r, y, CZ - Math.cos(a) * r];
  const N = 96;
  const seat = [0.006, 0.006, 0.016], seatTop = [0.01, 0.009, 0.026], fasc = [0.03, 0.022, 0.06], fascDark = [0.004, 0.003, 0.01];
  for (let i = 0; i < N; i++) {
    const a = A0 + ((A1 - A0) * i) / N, b = A0 + ((A1 - A0) * (i + 1)) / N;
    for (const T of TIERS) {
      quad(P(T.rf, a, T.yf0), P(T.rf, b, T.yf0), P(T.rf, b, T.y0), P(T.rf, a, T.y0), fascDark, fasc); // mặt trước
      quad(P(T.r0, a, T.y0), P(T.r0, b, T.y0), P(T.r1, b, T.y1), P(T.r1, a, T.y1), seat, seatTop); // ghế
    }
    quad(P(120, a, 30), P(120, b, 30), P(120, b, 34), P(120, a, 34), fascDark, fasc); // tường sau
    quad(P(120, a, 34), P(120, b, 34), P(126, b, 36), P(126, a, 36), fasc, fascDark); // mái hiên
  }
  // hai đầu khán đài (bịt mặt cắt)
  for (const a of [A0, A1]) {
    for (const T of TIERS) quad(P(T.rf, a, T.yf0), P(T.r1 + 1, a, T.yf0), P(T.r1 + 1, a, T.y1), P(T.rf, a, T.y0), fascDark, fascDark);
  }
  const structGeo = new THREE.BufferGeometry();
  structGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  structGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

  // Tháp đèn pha 4 góc: cột + khung đầu đèn (gộp vào cùng mesh)
  const parts: THREE.BufferGeometry[] = [structGeo];
  const towerA = [-0.62 * Math.PI, -0.3 * Math.PI, 0.3 * Math.PI, 0.62 * Math.PI];
  const lampCol = new THREE.Color(1, 0.95, 0.85), halo = new THREE.Color(0.9, 0.85, 1.0);
  const boxCol = (g: THREE.BufferGeometry, c: number[]) => {
    const ng = g.toNonIndexed(); g.dispose();
    ng.deleteAttribute('normal'); ng.deleteAttribute('uv');
    const n = ng.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set(c, i * 3);
    ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(ng);
  };
  for (const a of towerA) {
    const R = 130, H = 52;
    const [x, , z] = P(R, a, 0);
    const ry = Math.atan2(-(x - CX), -(z - CZ)); // mặt đầu đèn hướng vào sân
    const pole = new THREE.BoxGeometry(1.6, H, 1.6); pole.translate(x, H / 2, z); boxCol(pole, [0.008, 0.007, 0.016]);
    const head = new THREE.BoxGeometry(14, 8, 0.8); head.rotateX(0.3); head.rotateY(ry); head.translate(x, H + 3, z); boxCol(head, [0.012, 0.01, 0.022]);
    // cụm đèn 5×3 + quầng
    const fx = Math.cos(ry), fz = -Math.sin(ry); // trục ngang của đầu đèn
    const nx = Math.sin(ry), nz = Math.cos(ry); // pháp tuyến hướng vào sân
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const ox = (i - 2) * 2.6, oy = (j - 1) * 2.3;
      addGlow(glow, x + fx * ox + nx * 0.8, H + 3 + oy, z + fz * ox + nz * 0.8, lampCol, 1.3, 2.6, [2, 0, 0, 2]);
    }
    addGlow(glow, x + nx * 1.5, H + 3, z + nz * 1.5, halo, 0.5, 46, [2, 0, 0, 2]);
  }
  const allGeo = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  const structMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  const struct = new THREE.Mesh(allGeo, structMat);
  struct.renderOrder = -8;
  scene.add(struct);
  disposables.push(allGeo, structMat);

  // Đèn nhà hát: hàng chấm màu dọc mép trước mỗi tầng + mép mái
  const palette = [0xff4fa0, 0x4fd6ff, 0xffc24f, 0x9a6bff, 0x3dffb0].map((h) => new THREE.Color(h));
  const rows = [...TIERS.map((T) => ({ r: T.rf - 0.3, y: T.y0 - 0.4 })), { r: 125.5, y: 35.6 }];
  rows.forEach((row, ti) => {
    const n = Math.round(row.r * (A1 - A0) / 1.6);
    for (let i = 0; i < n; i++) {
      const a = A0 + ((A1 - A0) * i) / (n - 1);
      const [x, y, z] = P(row.r, a, row.y);
      const c = palette[(i + ti * 2) % palette.length];
      addGlow(glow, x, y, z, c, 0.55 + 0.45 * (((i * 7919) % 13) / 13), 0.9, [1, 0, 0, 2]);
    }
  });

  // Khán giả khán đài xa: ~26k lightstick
  const COUNT = 26000;
  const cp = new Float32Array(COUNT * 3), cs = new Float32Array(COUNT * 2);
  const areas = TIERS.map((T) => (T.r1 - T.r0) * (T.r0 + T.r1) / 2);
  const tot = areas.reduce((s, v) => s + v, 0);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < COUNT; i++) {
    let pick = rnd() * tot, ti = 0;
    while (ti < 2 && pick > areas[ti]) { pick -= areas[ti]; ti++; }
    const T = TIERS[ti];
    const rows = Math.round((T.r1 - T.r0) / 0.9);
    const row = Math.floor(rnd() * rows);
    const f = (row + 0.5) / rows;
    const r = T.r0 + 0.5 + f * (T.r1 - T.r0 - 1);
    const y = T.y0 + f * (T.y1 - T.y0) + 1.1 + rnd() * 0.3;
    const u = 0.01 + rnd() * 0.98;
    const a = A0 + (A1 - A0) * u;
    cp.set(P(r, a, y), i * 3);
    cs[i * 2] = rnd(); cs[i * 2 + 1] = u;
  }
  const crowdGeo = new THREE.BufferGeometry();
  crowdGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  crowdGeo.setAttribute('aSeed', new THREE.BufferAttribute(cs, 2));
  const fxU = {
    uCheer: { value: 0 }, uCheerAge: { value: 99 }, uWave: { value: 0 }, uWavePos: { value: -1 },
    uHeart: { value: 0 }, uHeartAge: { value: 99 }, uFlash: { value: 0 }, uPyro: { value: 0 }, uPyroAge: { value: 99 },
  };
  const crowdMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...fxU }, vertexShader: CROWD_VERT, fragmentShader: CROWD_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const crowd = new THREE.Points(crowdGeo, crowdMat);
  crowd.frustumCulled = false;
  crowd.renderOrder = 1;
  scene.add(crowd);
  disposables.push(crowdGeo, crowdMat);

  // Tương tác khán giả (sự kiện 'cs-interact' từ main.ts) → bao hiệu ứng nới mềm trong JS
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
  const baseStruct = new THREE.Color(1, 1, 1), tmpC = new THREE.Color();
  crowd.onBeforeRender = () => {
    const now = performance.now();
    const t = uniforms.uTime?.value as number ?? now / 1000;
    let dt = t - lastT;
    if (lastT < 0 || dt <= 0 || dt > 0.5) dt = Math.min(0.1, (now - lastReal) / 1000); // tạm dừng: dùng đồng hồ thực
    lastT = t; lastReal = now;
    age.cheer += dt; age.wave += dt; age.heart += dt; age.pyro += dt;
    const cheer = env(age.cheer, 2.6, 0.12, 0.9), heart = env(age.heart, 4.2, 0.3, 1.0), pyro = env(age.pyro, 3.4, 0.1, 1.0);
    fxU.uCheer.value = cheer; fxU.uCheerAge.value = age.cheer;
    fxU.uHeart.value = heart; fxU.uHeartAge.value = age.heart;
    fxU.uPyro.value = pyro; fxU.uPyroAge.value = age.pyro;
    fxU.uFlash.value = ease(fxU.uFlash.value, flashOn ? 1 : 0, dt / 0.7);
    const waveOn = waveModeOn || age.wave < 6;
    fxU.uWave.value = ease(fxU.uWave.value, waveOn ? 1 : 0, dt / 0.7);
    if (fxU.uWave.value > 0) waveLap += dt / 3; else waveLap = 0; // 1 vòng / 3 s
    fxU.uWavePos.value = (waveLap % 1) * 1.3 - 0.15;
    // đèn nhà hát / mép khán đài loé theo hò reo, ấm lên khi pháo hoa
    const fl = cheer * (0.5 + 0.5 * Math.sin(t * 30)) * 14 + pyro * 4;
    tmpC.copy(baseStruct).multiplyScalar(1 + fl);
    if (pyro > 0) tmpC.g *= 1 - 0.25 * pyro, tmpC.b *= 1 - 0.6 * pyro;
    structMat.color.copy(tmpC);
  };

  return {
    /** Tuỳ chọn: gọi mỗi khung để đồng bộ waveMode (1 = sóng) với khán đài xa. */
    update(f: FrameState, _t?: number) { waveModeOn = f.waveMode === 1; },
    dispose() { window.removeEventListener('cs-interact', onInteract); disposables.forEach((d) => d.dispose()); },
  };
}
