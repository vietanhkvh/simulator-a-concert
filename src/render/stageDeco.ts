// Trang trí sân khấu ngoài trời: khung mái/tháp truss, loa, màn LED bên, props, cầu thang, rào; sàn LED, cổng sáng, logo.
// 3 draw call: cấu trúc tĩnh (vertex color), 2 màn LED tháp (shader), ~230 phần tử phát sáng (InstancedMesh).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../core/types';
import { liveColor } from './stageDecoPal';
import { DECO } from './stageDecoLayout';

const { TX, ZF, ZB, TH, ay } = DECO;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ───────── cấu trúc tĩnh ─────────
function buildStatic(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const L = new THREE.Vector3(0.35, 0.85, 0.4).normalize();
  const tc = new THREE.Color();
  const o = new THREE.Object3D();

  function push(g: THREE.BufferGeometry, color: number, m?: THREE.Matrix4) {
    const h = g.index ? g.toNonIndexed() : g;
    if (m) h.applyMatrix4(m);
    const n = h.getAttribute('normal');
    const arr = new Float32Array(n.count * 3);
    tc.setHex(color);
    for (let i = 0; i < n.count; i++) {
      const d = n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z;
      const s = 0.55 + 0.5 * Math.max(0, d);
      arr[i * 3] = tc.r * s; arr[i * 3 + 1] = tc.g * s; arr[i * 3 + 2] = tc.b * s;
    }
    h.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    h.deleteAttribute('uv');
    parts.push(h);
    if (h !== g) g.dispose();
  }
  const bx = (w: number, h: number, d: number, x: number, y: number, z: number, color: number, m?: THREE.Matrix4) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    push(g, color, m);
  };
  const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, color: number, rx = 0, rz = 0, seg = 10) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.updateMatrix();
    push(g, color, o.matrix.clone());
  };
  const rod = (a: THREE.Vector3, b: THREE.Vector3, t: number, color: number) => {
    const len = a.distanceTo(b);
    if (len < 1e-4) return;
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.up.set(0, 1, 0);
    o.lookAt(b);
    o.updateMatrix();
    push(new THREE.BoxGeometry(t, t, len), color, o.matrix.clone());
  };
  const TRUSS = 0x56528a;
  function trussBar(a: THREE.Vector3, b: THREE.Vector3, s: number, color = TRUSS, chordT = 0.08, diagT = 0.045) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.divideScalar(len);
    const up = Math.abs(dir.y) > 0.95 ? V(1, 0, 0) : V(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u).normalize();
    const h = s / 2;
    const off = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([cu, cv]) => u.clone().multiplyScalar(cu! * h).addScaledVector(v, cv! * h));
    for (const f of off) rod(a.clone().add(f), b.clone().add(f), chordT, color);
    const n = Math.max(1, Math.round(len / (s * 1.1)));
    for (let k = 0; k < n; k++) {
      const t0 = a.clone().addScaledVector(dir, (len * k) / n);
      const t1 = a.clone().addScaledVector(dir, (len * (k + 1)) / n);
      for (let f = 0; f < 4; f++) {
        const o1 = off[f]!, o2 = off[(f + 1) % 4]!;
        if (k % 2 === 0) rod(t0.clone().add(o1), t1.clone().add(o2), diagT, color);
        else rod(t0.clone().add(o2), t1.clone().add(o1), diagT, color);
      }
    }
  }

  // sàn cánh hai bên mở rộng sân khấu
  for (const sx of [-1, 1]) bx(7.2, 0.3, 8, sx * 16.5, -0.15, -1, 0x14122a);
  // tháp truss 4 góc + vòm trước/sau + xà dọc
  for (const sx of [-1, 1]) for (const z of [ZF, ZB]) {
    trussBar(V(sx * TX, 0, z), V(sx * TX, TH, z), 1.1);
    bx(1.8, 0.2, 1.8, sx * TX, 0.1, z, 0x1c1a38);
    bx(1.4, 0.25, 1.4, sx * TX, TH + 0.12, z, 0x1c1a38);
  }
  const N = 26;
  for (const z of [ZF, ZB]) {
    for (let i = 0; i < N; i++) {
      const x0 = -TX + (2 * TX * i) / N, x1 = -TX + (2 * TX * (i + 1)) / N;
      trussBar(V(x0, ay(x0), z), V(x1, ay(x1), z), 0.9);
    }
  }
  for (const x of [-16, -8, 0, 8, 16]) trussBar(V(x, ay(x), ZF), V(x, ay(x), ZB), 0.7);
  // thanh đèn treo + cáp
  const BAR_Z = [-3.6, -1.1, 1.4];
  for (const z of BAR_Z) {
    trussBar(V(-16, 9.5, z), V(16, 9.5, z), 0.6);
    for (const x of [-14, -7, 0, 7, 14]) rod(V(x, 9.8, z), V(x, ay(x) - 0.1, z < -2 ? -4.0 : z), 0.05, 0x8886b8);
  }
  trussBar(V(-14, 6.5, ZB - 0.4), V(14, 6.5, ZB - 0.4), 0.5);
  for (const x of [-14, 14]) rod(V(x, 6.7, ZB - 0.4), V(x, 12.0, ZB - 0.4), 0.05, 0x8886b8);

  // line-array loa treo trái/phải
  for (const sx of [-1, 1]) {
    const hx = sx * 12.4, hz = -4.3;
    rod(V(hx, 11.0, hz), V(hx, ay(hx) - 0.2, hz), 0.07, 0x8886b8);
    for (let i = 0; i < 8; i++) {
      const y = 10.8 - i * 0.8;
      o.position.set(hx, y, hz); o.rotation.set(-0.02 * i, 0, 0); o.updateMatrix();
      const M = o.matrix.clone();
      bx(1.5, 0.76, 0.95, 0, 0, 0, 0x34325e, M);
      bx(1.32, 0.6, 0.04, 0, 0, -0.49, 0x0b0a16, M);
      bx(1.5, 0.05, 0.9, 0, 0.4, 0, 0x6a68a0, M);
    }
  }
  // cột màn LED bên: khung + chân
  for (const sx of [-1, 1]) {
    bx(3.5, 9.5, 0.3, sx * 15.5, 6.0, -5.05, 0x24223e);
    bx(0.4, 1.6, 0.6, sx * 15.5, 0.8, -4.9, 0x24223e);
  }
  // subwoofer dọc mép sân khấu (thấp, chừa lối đi giữa)
  for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) {
    const x = sx * (3.2 + 1.25 * k);
    bx(1.15, 0.45, 0.8, x, 0.225, -4.3, 0x24223e);
    bx(1.0, 0.3, 0.03, x, 0.225, -4.71, 0x0b0a16);
    bx(1.15, 0.03, 0.8, x, 0.46, -4.3, 0x5a5890);
  }
  // cầu thang xuống hố khán giả + tay vịn
  for (const sx of [-1, 1]) {
    const x = sx * 12.2;
    for (let k = 0; k < 5; k++) {
      const top = -0.32 * (k + 1);
      bx(1.3, top + 1.6, 0.5, x, (top - 1.6) / 2, -5.4 - 0.5 * k, 0x3a3866);
    }
    for (const dx of [-0.68, 0.68]) {
      rod(V(x + dx, 0.95, -5.15), V(x + dx, -0.65, -7.9), 0.06, 0x9a98c8);
      rod(V(x + dx, 0, -5.15), V(x + dx, 0.95, -5.15), 0.06, 0x9a98c8);
    }
  }
  // rào chắn hố khán giả
  const BZ = -6.3;
  for (const sx of [-1, 1]) {
    for (let x = 1.9; x <= 13.6; x += 1.2) bx(0.07, 1.15, 0.07, sx * x, -1.0, BZ, 0x8a88b8);
    bx(11.8, 0.07, 0.07, sx * 7.75, -0.45, BZ, 0x9a98c8);
    bx(11.8, 0.05, 0.05, sx * 7.75, -0.95, BZ, 0x6a68a0);
    bx(0.07, 0.07, 1.2, sx * 13.6, -0.45, BZ + 0.6, 0x9a98c8);
  }
  // trống (riser bên trái, upstage): tay trống ngồi ở z=1,5 (hậu), bộ trống nằm giữa tay trống và khán giả (-Z)
  bx(3.6, 0.45, 2.8, -6.5, 0.225, 1.5, 0x2c2a52);
  cyl(0.42, 0.42, 0.5, -6.5, 0.87, 0.3, 0x3c3a78, Math.PI / 2, 0, 16); // trống bass
  cyl(0.43, 0.43, 0.04, -6.5, 0.87, 0.03, 0xc8c8e8, Math.PI / 2, 0, 16); // mặt trống hướng khán giả
  for (const dx of [-0.4, 0.4]) cyl(0.22, 0.22, 0.22, -6.5 + dx, 1.5, 0.35, 0x3c3a78, 0.3, 0, 12); // tom
  cyl(0.26, 0.26, 0.14, -6.84, 1.0, 0.85, 0xc8c8e8, 0, 0, 14); // snare (tay trái)
  rod(V(-6.84, 0.45, 0.85), V(-6.84, 0.93, 0.85), 0.03, 0x8886b8);
  cyl(0.24, 0.24, 0.04, -6.0, 1.12, 0.85, 0xc9a23a, 0, 0, 14); // hi-hat (tay phải)
  rod(V(-6.0, 0.45, 0.85), V(-6.0, 1.1, 0.85), 0.03, 0x8886b8);
  for (const [x, y, z] of [[-7.8, 2.0, 0.5], [-5.3, 2.0, 0.55], [-5.7, 1.85, 1.0]] as [number, number, number][]) {
    cyl(0.38, 0.38, 0.015, x, y, z, 0xc9a23a, 0.2, 0, 16);
    rod(V(x, 0.45, z), V(x, y, z), 0.025, 0x8886b8);
  }
  // keyboard riser bên phải: phím (dải sáng) quay về phía nghệ sĩ (+Z), đàn thứ hai phía khán giả
  bx(3.2, 0.3, 2.2, 6.5, 0.15, 1.5, 0x2c2a52);
  bx(1.9, 0.08, 0.5, 6.5, 1.2, 1.2, 0x15141f);
  bx(1.9, 0.02, 0.28, 6.5, 1.25, 1.31, 0xd8d8ee);
  bx(1.6, 0.08, 0.5, 6.5, 1.5, 0.78, 0x15141f);
  for (const dx of [-0.8, 0.8]) { rod(V(6.5 + dx, 0.3, 1.2), V(6.5 + dx, 1.2, 1.2), 0.05, 0x8886b8); rod(V(6.5 + dx, 0.3, 0.78), V(6.5 + dx, 1.5, 0.78), 0.05, 0x8886b8); }
  // amp stack
  for (const x of [-10.8, -9.3, 9.3, 10.8]) {
    bx(1.1, 0.95, 0.6, x, 0.475, 2.3, 0x34325e);
    bx(1.1, 0.95, 0.6, x, 1.425, 2.3, 0x34325e);
    bx(0.95, 0.8, 0.03, x, 0.475, 1.99, 0x0b0a16);
    bx(0.95, 0.8, 0.03, x, 1.425, 1.99, 0x0b0a16);
    bx(1.0, 0.3, 0.5, x, 2.05, 2.3, 0x4a4880);
  }
  // mic stand
  for (const [x, z] of [[-2.8, -1.8], [2.8, -1.8], [-6, -2.9], [6, -2.9]] as [number, number][]) {
    cyl(0.2, 0.2, 0.03, x, 0.02, z, 0x9a98c8, 0, 0, 14);
    rod(V(x, 0.02, z), V(x, 1.5, z), 0.04, 0x9a98c8);
    rod(V(x, 1.5, z), V(x, 1.6, z + 0.35), 0.03, 0x9a98c8); // cần mic cong về phía người hát (+Z)
    bx(0.07, 0.07, 0.16, x, 1.6, z + 0.4, 0x1a1a28);
  }

  const merged = mergeGeometries(parts, false)!;
  for (const g of parts) g.dispose();
  return merged;
}

// ───────── màn LED tháp ─────────
const ledVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const ledFrag = /* glsl */ `
uniform float uTime; uniform float uBeat; uniform float uLevel; uniform float uHype; uniform vec3 uA; uniform vec3 uB;
varying vec2 vUv;
float hh(float n){ return fract(sin(n*91.3)*437.58); }
void main(){
  float cols = 8.0, rows = 40.0;
  float c = floor(vUv.x*cols);
  float cx = fract(vUv.x*cols);
  float rnd = hh(c + floor(uTime*(2.0+5.0*uHype)) * 0.37);
  float height = clamp(0.1 + 0.6*uLevel*(0.35+rnd) + 0.45*uBeat*rnd*(0.3+uHype), 0.0, 0.97);
  float ry = fract(vUv.y*rows);
  float pix = smoothstep(0.0,0.15,ry)*smoothstep(1.0,0.85,ry)*smoothstep(0.0,0.12,cx)*smoothstep(1.0,0.88,cx);
  vec3 grad = mix(uA, uB, vUv.y);
  float bar = step(vUv.y, height);
  float cap = step(abs(vUv.y-height-0.03), 0.012);
  vec3 o = grad*0.07 + grad*bar*pix*(0.5+0.4*uBeat) + vec3(1.0)*cap*pix*0.25;
  o *= smoothstep(0.0,0.02,vUv.y)*smoothstep(1.0,0.98,vUv.y)*smoothstep(0.0,0.02,vUv.x)*smoothstep(1.0,0.98,vUv.x);
  gl_FragColor = vec4(o, 1.0);
}`;

// ───────── phần tử phát sáng (instanced) ─────────
interface Item { g: number; a: number; b: number; x: number; z: number }

export function createStageDeco(scene: THREE.Scene) {
  const staticGeo = buildStatic();
  const staticMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const staticMesh = new THREE.Mesh(staticGeo, staticMat);
  scene.add(staticMesh);

  const planes = [-1, 1].map((sx) => {
    const g = new THREE.PlaneGeometry(3.0, 8.6);
    g.rotateY(Math.PI); // mặt hướng khán giả (-Z)
    g.translate(sx * 15.5, 6.0, -5.25);
    return g;
  });
  const ledGeo = mergeGeometries(planes)!;
  planes.forEach((g) => g.dispose());
  const ledU = { uTime: { value: 0 }, uBeat: { value: 0 }, uLevel: { value: 0 }, uHype: { value: 0 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() } };
  const ledMat = new THREE.ShaderMaterial({ uniforms: ledU, vertexShader: ledVert, fragmentShader: ledFrag, side: THREE.DoubleSide, fog: false });
  const ledMesh = new THREE.Mesh(ledGeo, ledMat);
  scene.add(ledMesh);

  const items: Item[] = [];
  const mats: THREE.Matrix4[] = [];
  const o = new THREE.Object3D();
  const add = (g: number, a: number, b: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) => {
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
    mats.push(o.matrix.clone());
    items.push({ g, a, b, x, z });
  };
  // segment nằm ngang trên mặt phẳng XZ theo hướng (dx,dz)
  const flat = (g: number, a: number, b: number, x: number, y: number, z: number, dx: number, dz: number, len: number, t: number) =>
    add(g, a, b, x, y, z, len, 0.03, t, 0, Math.atan2(-dz, dx), 0);
  // 0: gạch sàn LED
  for (let i = 0; i < 12; i++) for (let j = 0; j < 5; j++) {
    const x = -11 + 2 * i, z = 1.9 - 1.5 * j;
    add(0, i + j, (i + j) & 1, x, 0.02, z, 1.8, 0.02, 1.3);
  }
  // 1: footlight mép sân khấu
  for (let i = 0; i < 43; i++) add(1, i, 0, -12.6 + 0.6 * i, 0.03, -4.7, 0.3, 0.06, 0.15);
  // 2: panel LED riser mặt trước sân khấu
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(2, i, 0, sx * (2.9 + 2 * i), -0.75, -5.17, 1.8, 1.2, 0.03);
  // 3: chevron chỉ hướng runway
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) add(3, k, 0, s * 0.45, 0.03, -6.0 - 0.7 * k, 1.0, 0.03, 0.12, 0, s * 0.7, 0);
  // 4: cổng sáng trên runway
  const R = 1.85, CY = 3.3;
  [-9, -15, -21].forEach((z, gi) => {
    const segs: [number, number, number, number, number][] = []; // x,y,len,angle,t
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) segs.push([sx * R, 0.55 + k * 1.1, 1.1, Math.PI / 2, sx > 0 ? k / 40 : 1 - k / 40]);
    const NS = 14;
    for (let k = 0; k < NS; k++) {
      const a0 = (k / NS) * Math.PI, a1 = ((k + 1) / NS) * Math.PI, am = (a0 + a1) / 2;
      segs.push([Math.cos(am) * R, CY + Math.sin(am) * R, 2 * R * Math.sin(Math.PI / NS / 2) * 1.05, am + Math.PI / 2, 0.05 + 0.9 * (1 - am / Math.PI)]);
    }
    for (const [x, y, len, ang, t] of segs) add(4, gi, t, x, y, z, len, 0.06, 0.06, 0, 0, ang);
  });
  // 5: vòng logo + 6: ngôi sao trên bục cuối
  const PZ = -26;
  for (const [r, n, grp] of [[2.85, 36, 5], [1.0, 14, 5]] as [number, number, number][]) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      flat(grp, k, k / n, Math.cos(a) * r, 0.03, PZ + Math.sin(a) * r, -Math.sin(a), Math.cos(a), ((2 * Math.PI * r) / n) * 1.04, r > 2 ? 0.1 : 0.07);
    }
  }
  for (let k = 0; k < 5; k++) {
    const a0 = (k * 2 * Math.PI * 2) / 5 - Math.PI / 2, a1 = ((k * 2 + 2) * Math.PI * 2) / 5 - Math.PI / 2;
    const x0 = Math.cos(a0) * 1.9, z0 = Math.sin(a0) * 1.9, x1 = Math.cos(a1) * 1.9, z1 = Math.sin(a1) * 1.9;
    flat(6, k, 0, (x0 + x1) / 2, 0.035, PZ + (z0 + z1) / 2, x1 - x0, z1 - z0, Math.hypot(x1 - x0, z1 - z0), 0.08);
  }
  // 7: tay vịn rào
  for (const sx of [-1, 1]) add(7, 0, 0, sx * 7.75, -0.45, -6.3, 11.8, 0.05, 0.05);
  const NI = items.length;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const emMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const em = new THREE.InstancedMesh(boxGeo, emMat, NI);
  const col = new THREE.Color();
  for (let i = 0; i < NI; i++) { em.setMatrixAt(i, mats[i]!); em.setColorAt(i, col.setRGB(0.1, 0.1, 0.2)); }
  em.instanceMatrix.needsUpdate = true;
  scene.add(em);

  const ring = (a: number, b: number) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
  const cA = new THREE.Color();
  const cB = new THREE.Color();

  return {
    update(f: FrameState, t: number) {
      const hype = Math.min(1, Math.max(0, f.hype));
      const beat = Math.max(0, f.beat);
      const pulse = f.beatPulse;
      const sp = 0.5 + 1.5 * hype;
      for (let i = 0; i < NI; i++) {
        const it = items[i]!;
        let b = 0.2, k = 0;
        switch (it.g) {
          case 0: { // gạch sàn: sóng đồng tâm chạy theo beat
            const dist = Math.hypot(it.x, (it.z + 1) * 1.6);
            const w = ((beat * 0.25 * sp - dist * 0.09) % 1 + 1) % 1;
            const r = Math.pow(Math.max(0, 1 - w * 2.6), 2);
            b = 0.03 + 0.3 * r * (0.5 + hype) + 0.03 * pulse + (it.b ? 0.04 * pulse * hype : 0);
            k = Math.floor(dist * 0.4);
            break;
          }
          case 1:
            b = 0.2 + 0.55 * Math.max(0, Math.sin(beat * Math.PI * 0.5 * sp * 2 - it.a * 0.5)) + 0.1 * pulse;
            k = it.a >> 2;
            break;
          case 2:
            b = 0.12 + 0.45 * (0.5 + 0.5 * Math.sin(beat * Math.PI * 0.5 * sp - it.a * 0.9)) + 0.18 * pulse;
            k = it.a;
            break;
          case 3: {
            const head = (beat * sp) % 4;
            const d = (head - it.a + 4) % 4;
            b = 0.12 + 0.75 * Math.max(0, 1 - d / 1.5);
            k = 1;
            break;
          }
          case 4: {
            const head = (beat * 0.25 * sp + it.a * 0.33) % 1;
            b = 0.15 + 0.5 * Math.max(0, 1 - ring(it.b, head) * 5) + 0.05 * pulse;
            k = it.a * 2 + Math.floor(beat / 4);
            break;
          }
          case 5: {
            const head = (beat * 0.125 * sp) % 1;
            b = 0.25 + 0.7 * Math.max(0, 1 - ring(it.b, head) * 4) + 0.08 * pulse;
            k = Math.floor(it.b * 4);
            break;
          }
          case 6:
            b = 0.3 + 0.45 * pulse + 0.2 * Math.sin(t * 2 + it.a);
            k = it.a;
            break;
          default:
            b = 0.12 + 0.1 * pulse;
            k = 2;
        }
        liveColor(k, col, it.g === 7 ? 0.5 : 0.35).multiplyScalar(Math.min(0.95, b));
        em.setColorAt(i, col);
      }
      em.instanceColor!.needsUpdate = true;

      ledU.uTime.value = t;
      ledU.uBeat.value = pulse;
      ledU.uLevel.value = f.level;
      ledU.uHype.value = hype;
      liveColor(0, cA, 0.4);
      liveColor(2, cB, 0.4);
      ledU.uA.value.copy(cA);
      ledU.uB.value.copy(cB);
    },
    dispose() {
      scene.remove(staticMesh, ledMesh, em);
      staticGeo.dispose(); staticMat.dispose();
      ledGeo.dispose(); ledMat.dispose();
      boxGeo.dispose(); emMat.dispose(); em.dispose();
    },
  };
}
