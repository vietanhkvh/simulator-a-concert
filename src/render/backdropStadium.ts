// Khán đài sân vận động ngoài trời: 3 tầng cong quanh khán giả, tháp đèn pha 4 góc,
// "biển" lightstick khán đài xa (1 THREE.Points, hoạt ảnh hoàn toàn trong shader). 2 draw call
// (+ đèn nhà hát / cụm đèn pha nằm trong Points điểm sáng chung của backdropSky).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
attribute vec2 aSeed; // seed, góc chuẩn hoá 0..1
varying vec3 vCol;
vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.0)-3.0)-1.0,0.,1.); return v*mix(vec3(1.),k,s); }
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
  b *= step(0.08, fract(sd * 13.7)); // vài chỗ không giơ lightstick
  vCol = c * b;
  gl_PointSize = 2.2 * uRes;
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
  const crowdMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: CROWD_VERT, fragmentShader: CROWD_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const crowd = new THREE.Points(crowdGeo, crowdMat);
  crowd.frustumCulled = false;
  crowd.renderOrder = 1;
  scene.add(crowd);
  disposables.push(crowdGeo, crowdMat);

  return { dispose() { disposables.forEach((d) => d.dispose()); } };
}
