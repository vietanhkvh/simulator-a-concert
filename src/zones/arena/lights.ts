// Đèn sân khấu giả (additive, không Light thật, không bóng). 5 draw call (3 + 2 đèn trang trí): chùm sáng, flare/chấm, vệt màu sàn.
import * as THREE from 'three';
import { WALK_SHAPES, edgeRuns, shapeSignedDist, chaseDistance } from './walkLayout';
import type { FrameState, Updatable } from '../../core/types';
import { PALETTES, COOL, palColor, livePal } from './stageDecoPal';
import { createDecoFixtures } from './stageDecoFixtures';

const LEN = 60;

// ───────── shader ─────────
const beamVert = /* glsl */ `
attribute vec3 aColor;
attribute float aInt;
varying vec2 vUv;
varying float vFres;
varying vec3 vCol;
varying float vInt;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal);
  vFres = abs(dot(n, normalize(-mv.xyz)));
  vCol = aColor; vInt = aInt; vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const beamFrag = /* glsl */ `
varying vec2 vUv; varying float vFres; varying vec3 vCol; varying float vInt; varying float vDepth;
void main() {
  float along = pow(vUv.y, 1.3);
  float soft = pow(vFres, 1.5);
  // mờ dần gần camera: chùm không bao giờ thành flash toàn màn hình
  float near = smoothstep(1.5, 9.0, vDepth);
  float a = along * soft * vInt * near;
  gl_FragColor = vec4(vCol * a, a);
}`;
const flareVert = /* glsl */ `
attribute vec3 aColor;
attribute float aInt;
varying vec2 vP; varying vec3 vCol; varying float vInt;
void main() {
  vP = position.xy * 2.0; vCol = aColor; vInt = aInt;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  c.xy += position.xy * s;
  gl_Position = projectionMatrix * c;
}`;
const flareFrag = /* glsl */ `
varying vec2 vP; varying vec3 vCol; varying float vInt;
void main() {
  float r = length(vP);
  float core = smoothstep(0.35, 0.0, r);
  float halo = pow(max(0.0, 1.0 - r), 2.5);
  float a = (core * 0.9 + halo * 0.5) * vInt;
  vec3 c = mix(vCol, vec3(1.0), core * 0.6);
  gl_FragColor = vec4(c * a, a);
}`;
const washVert = /* glsl */ `
attribute vec3 aColor;
attribute float aInt;
varying vec2 vP; varying vec3 vCol; varying float vInt;
void main() {
  vP = position.xy * 2.0; vCol = aColor; vInt = aInt;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const washFrag = /* glsl */ `
varying vec2 vP; varying vec3 vCol; varying float vInt;
void main() {
  float r = length(vP);
  float a = pow(max(0.0, 1.0 - r), 2.0) * vInt;
  gl_FragColor = vec4(vCol * a, a);
}`;

function addMat(vs: string, fs: string, side: THREE.Side = THREE.FrontSide) {
  return new THREE.ShaderMaterial({
    vertexShader: vs,
    fragmentShader: fs,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side,
    fog: false,
  });
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, order: number) {
  const col = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const it = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  col.setUsage(THREE.DynamicDrawUsage);
  it.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aColor', col);
  geo.setAttribute('aInt', it);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return { mesh, col, it };
}

// ───────── đèn ─────────
interface Fix {
  pos: THREE.Vector3;
  group: number; // 0 truss, 1 tháp bên, 2 hậu, 3 vòng, 4 up-shaft
  idx: number;
  len: number; // hệ số tỉ lệ
}

export function createLights(scene: THREE.Scene): Updatable {
  const root = new THREE.Group();
  const fixes: Fix[] = [];
  const PLAT = new THREE.Vector3(0, 0, -26);
  // 0: truss trên sân khấu (8)
  for (let i = 0; i < 8; i++) fixes.push({ pos: new THREE.Vector3((i - 3.5) * 3.4, 9.5, -4), group: 0, idx: i, len: 0.8 });
  // 1: hai tháp bên (3 + 3)
  for (let s = 0; s < 2; s++)
    for (let i = 0; i < 3; i++) fixes.push({ pos: new THREE.Vector3((s ? 22 : -22) + (s ? 1 : -1) * 0.0, 8 + i * 1.6, -20 + (i - 1) * 1.8), group: 1, idx: s * 3 + i, len: 0.9 });
  // 2: nhóm hậu (6) nhìn về sân khấu
  for (let i = 0; i < 6; i++) fixes.push({ pos: new THREE.Vector3((i - 2.5) * 4.2, 11, -60), group: 2, idx: i, len: 1.25 });
  // 3: vòng trên sân cuối runway (4)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    fixes.push({ pos: new THREE.Vector3(PLAT.x + Math.cos(a) * 3.2, 9, PLAT.z + Math.sin(a) * 3.2), group: 3, idx: i, len: 0.7 });
  }
  const NB = fixes.length; // 24
  // 4: up-light quanh sân (4)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    fixes.push({ pos: new THREE.Vector3(PLAT.x + Math.cos(a) * 2.6, 0.05, PLAT.z + Math.sin(a) * 2.6), group: 4, idx: i, len: 0.32 });
  }
  const NBT = fixes.length; // 28

  // thứ tự bật đèn: xen kẽ nhóm để mức hype thấp vẫn rải đều
  const order: number[] = [];
  {
    const byG: number[][] = [[], [], [], [], []];
    fixes.forEach((f, i) => byG[f.group]!.push(i));
    let more = true;
    for (let r = 0; more; r++) {
      more = false;
      for (const g of byG) if (g[r] !== undefined) { order.push(g[r]!); more = true; }
    }
  }
  const rank = new Array<number>(NBT);
  order.forEach((fi, r) => (rank[fi] = r));

  // chấm runway + vòng sân
  // (theo walkLayout: mọi runway/lối ngang có chấm hai mép, mọi bục có vòng chấm)
  const dotPos: THREE.Vector3[] = [];
  /** ≥ 0: hàng chase (tăng dần ra xa sân khấu); < 0: chấm vòng bục (-1 - chỉ số trên vòng). */
  const dotRow: number[] = [];
  const DOT_STEP = 1.35;
  for (const sh of WALK_SHAPES) {
    if (!sh.mesh) continue;
    if (sh.kind === 'disc') {
      const r = sh.r - 0.4;
      const n = Math.max(8, Math.round((2 * Math.PI * r) / 2));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const x = sh.x + Math.cos(a) * r, z = sh.z + Math.sin(a) * r;
        if (WALK_SHAPES.some((o) => o !== sh && o.mesh && shapeSignedDist(o, x, z) < 0.25)) continue;
        dotPos.push(new THREE.Vector3(x, 0.12, z));
        dotRow.push(-1 - k);
      }
    } else {
      for (const run of edgeRuns(sh, 0.1, 0)) {
        const [ax, az] = run.pts[0]!, [bx, bz] = run.pts[run.pts.length - 1]!;
        const L = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.round(L / DOT_STEP));
        for (let k = 0; k <= n; k++) {
          const t = n ? (k + 0.5) / (n + 1) : 0.5;
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          dotPos.push(new THREE.Vector3(x, 0.12, z));
          dotRow.push(Math.round(chaseDistance(x, z) / DOT_STEP));
        }
      }
    }
  }
  const ND = dotPos.length;
  const RUN = dotRow.reduce((m, r) => Math.max(m, r), 0) + 1;

  // vệt màu khán giả
  const washBase: [number, number][] = [
    [-9, -8], [9, -8], [-8, -20], [8, -20], [-12, -34], [12, -34], [0, -14], [-7, -44], [7, -44], [0, 6],
  ];
  const NW = washBase.length;

  // ── mesh ──
  const beamGeo = new THREE.CylinderGeometry(0.12, 2.6, LEN, 18, 1, true);
  beamGeo.translate(0, -LEN / 2, 0);
  const beams = instanced(beamGeo, addMat(beamVert, beamFrag, THREE.DoubleSide), NBT, 5);
  const flareGeo = new THREE.PlaneGeometry(1, 1);
  const flares = instanced(flareGeo, addMat(flareVert, flareFrag), NBT + ND, 6);
  const washGeo = new THREE.PlaneGeometry(1, 1);
  washGeo.rotateX(-Math.PI / 2);
  const washes = instanced(washGeo, addMat(washVert, washFrag), NW, 3);
  root.add(washes.mesh, beams.mesh, flares.mesh);
  scene.add(root);
  const extra = createDecoFixtures(scene);

  // ── trạng thái ──
  const lit = new Float32Array(NBT);
  const ph = { v: 0 };
  let lastBeat = NaN;
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const DOWN = new THREE.Vector3(0, -1, 0);
  const sm = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function target(fx: Fix, p: number, hype: number, out: THREE.Vector3) {
    const i = fx.idx;
    switch (fx.group) {
      case 0: { // fan: nan quạt mở/khép
        const open = 0.5 + 0.5 * Math.sin(p * 0.5 + i * 0.15) + 0.3;
        out.set((i - 3.5) * 4 * open, 0, -16 - 8 * Math.sin(p + i * 0.5));
        break;
      }
      case 1: { // cross: chéo qua runway
        const sd = i < 3 ? 1 : -1;
        out.set(sd * (3 - 9 * Math.sin(p * 0.5 + i)), 0.5, -20 + 16 * Math.sin(p * 0.5 + i * 1.3));
        break;
      }
      case 2: { // ballyhoo: loạn hướng về sân khấu, hơi ngẩng
        out.set(12 * Math.sin(p * 0.7 + i * 1.7), 1 + 5 * (0.5 + 0.5 * Math.sin(p * 1.3 + i * 2.1)), -8 + 14 * Math.sin(p * 0.5 + i));
        break;
      }
      default: { // circle: xoay quanh sân
        const a = p * 0.5 + (i / 4) * Math.PI * 2;
        const r = 7 + 3 * Math.sin(p * 0.25);
        out.set(PLAT.x + Math.cos(a) * r, 0, PLAT.z + Math.sin(a) * r);
        break;
      }
    }
    void hype;
    return out;
  }

  return {
    update(f: FrameState) {
      const hype = Math.min(1, Math.max(0, f.hype));
      // pha quét tích lũy theo beat; tốc độ tăng theo hype
      const db = Number.isFinite(lastBeat) ? f.beat - lastBeat : 0;
      lastBeat = f.beat;
      if (db > 0 && db < 2) ph.v += db * (0.35 + 1.3 * hype) * Math.PI * 0.5;
      const p = ph.v;
      const beat = Math.max(0, f.beat);

      // palette đổi mỗi 8 phách, crossfade trong phách đầu
      const seg = Math.floor(beat / 8);
      const pCur = seg % PALETTES.length;
      const pPrev = (seg + PALETTES.length - 1) % PALETTES.length;
      const mix = sm(0, 1, (beat / 8 - seg) * 8);
      const vivid = sm(0.12, 0.65, hype);
      livePal.pCur = pCur; livePal.pPrev = pPrev; livePal.mix = mix; livePal.vivid = vivid; livePal.beat = beat;
      const nLit = Math.round(6 + (NBT - 6) * sm(0.05, 0.85, hype));
      const pulse = f.beatPulse;

      const colAttr = beams.col.array as Float32Array;
      const itAttr = beams.it.array as Float32Array;
      const fcAttr = flares.col.array as Float32Array;
      const fiAttr = flares.it.array as Float32Array;
      const dt = Math.min(0.1, Math.max(0, f.dt));

      const fixColor = (fx: Fix, out: THREE.Color) => {
        const k = fx.group * 2 + fx.idx + (pCur === 3 ? 0 : Math.floor(beat / 4 * (hype > 0.6 ? 1 : 0)));
        palColor(pPrev, fx.group * 2 + fx.idx, beat, cB);
        palColor(pCur, k, beat, cA);
        out.copy(cB).lerp(cA, mix);
        // hype thấp: lạnh, ít bão hòa; hype cao: đủ màu
        cB.copy(COOL[(fx.group + fx.idx) % COOL.length]!);
        out.lerpColors(cB, out, vivid);
        return out;
      };

      for (let i = 0; i < NBT; i++) {
        const fx = fixes[i]!;
        const on = rank[i]! < nLit ? 1 : 0;
        lit[i] = lit[i]! + (on - lit[i]!) * Math.min(1, dt * 3);
        const col = fixColor(fx, cA);
        const m = lit[i]!;
        const swing = 0.75 + 0.25 * Math.sin(p * 2 + i);
        const strobe = hype > 0.75 ? 0.75 + 0.5 * pulse : 0.85 + 0.25 * pulse;
        const intensity = (0.4 + 0.7 * hype) * m * swing * strobe * (fx.group === 4 ? 1.1 : fx.group === 2 ? 0.85 : 1);

        if (fx.group === 4) {
          const a = p * 0.4 + i;
          dir.set(Math.sin(a) * 0.12, 1, Math.cos(a) * 0.12).normalize();
          tmpQ.setFromUnitVectors(DOWN, dir);
        } else {
          target(fx, p, hype, tgt);
          dir.copy(tgt).sub(fx.pos).normalize();
          // chùm không được chĩa thẳng vào vị trí camera mặc định như flash: dir từ nguồn tới đích, đã mờ gần camera
          tmpQ.setFromUnitVectors(DOWN, dir);
        }
        tmpS.setScalar(fx.len);
        tmpM.compose(fx.pos, tmpQ, tmpS);
        beams.mesh.setMatrixAt(i, tmpM);
        colAttr[i * 3] = col.r; colAttr[i * 3 + 1] = col.g; colAttr[i * 3 + 2] = col.b;
        itAttr[i] = intensity;

        // flare đầu đèn: luôn thấy mờ, sáng hơn khi bật
        const fs = fx.group === 4 ? 0.7 : 2.2 + 0.8 * m;
        tmpM.compose(fx.pos, tmpQ.identity(), tmpS.setScalar(fs));
        flares.mesh.setMatrixAt(i, tmpM);
        fcAttr[i * 3] = col.r; fcAttr[i * 3 + 1] = col.g; fcAttr[i * 3 + 2] = col.b;
        fiAttr[i] = 0.5 + 0.9 * m * (0.8 + 0.4 * pulse);
      }

      // chấm runway chase về phía sân cuối (chỉ số tăng = xa dần)
      const CHASE = Math.min(RUN + 4, 18); // nhiều đợt chase cùng lúc trên lối dài
      const head = (beat * (1 + hype)) % CHASE;
      for (let k = 0; k < ND; k++) {
        const j = NBT + k;
        let b: number;
        let col: THREE.Color;
        if (dotRow[k]! >= 0) {
          const row = dotRow[k]!;
          let d = (head - row) % CHASE;
          if (d < 0) d += CHASE;
          b = 0.18 + 0.82 * Math.max(0, 1 - d / 4.5);
          col = palColor(pCur, row, beat, cA);
        } else {
          const kk = -1 - dotRow[k]!;
          b = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(p * 2 - kk * 0.63));
          col = palColor(pCur, kk, beat, cA);
        }
        cB.copy(COOL[0]!);
        cB.lerp(col, Math.max(0.35, vivid));
        tmpM.compose(dotPos[k]!, tmpQ.identity(), tmpS.setScalar(0.9));
        flares.mesh.setMatrixAt(j, tmpM);
        fcAttr[j * 3] = cB.r; fcAttr[j * 3 + 1] = cB.g; fcAttr[j * 3 + 2] = cB.b;
        fiAttr[j] = b * (0.9 + 0.4 * pulse);
      }

      // vệt màu khán giả trôi chậm
      const wcol = washes.col.array as Float32Array;
      const wint = washes.it.array as Float32Array;
      for (let w = 0; w < NW; w++) {
        const b = washBase[w]!;
        const t = p * 0.15 + w * 1.7;
        tmpS.setScalar(15 + 3 * Math.sin(t * 1.3));
        tmpM.compose(tgt.set(b[0] + 3.5 * Math.sin(t), 0.6, b[1] + 4.5 * Math.cos(t * 0.8)), tmpQ.identity(), tmpS);
        washes.mesh.setMatrixAt(w, tmpM);
        // màu trôi chậm theo hue pha + palette
        palColor(pCur, w, beat * 0.25, cA);
        palColor(pPrev, w, beat * 0.25, cB);
        cA.lerp(cB, 1 - mix);
        cB.copy(COOL[w % COOL.length]!);
        cA.lerpColors(cB, cA, vivid);
        wcol[w * 3] = cA.r; wcol[w * 3 + 1] = cA.g; wcol[w * 3 + 2] = cA.b;
        wint[w] = 0.22 + 0.36 * hype + 0.06 * pulse;
      }

      extra.update(f, p);

      for (const o of [beams, flares, washes]) {
        o.mesh.instanceMatrix.needsUpdate = true;
        o.col.needsUpdate = true;
        o.it.needsUpdate = true;
      }
    },
    dispose() {
      scene.remove(root);
      extra.dispose();
      for (const o of [beams, flares, washes]) {
        o.mesh.geometry.dispose();
        (o.mesh.material as THREE.Material).dispose();
        o.mesh.dispose();
      }
    },
  };
}
