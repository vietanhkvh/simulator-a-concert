// Đèn sân khấu giả (additive, không Light thật, không bóng). 5 draw call (3 + 2 đèn trang trí): chùm sáng, flare/chấm/sao gobo, vệt màu sàn.
// Màu: 3 trạng thái Hype dùng chung (stageDecoPal → src/world/style), mỗi nhóm một vai trò, chạy đuổi theo phách.
import * as THREE from 'three';
import { WALK_SHAPES, edgeRuns, shapeSignedDist, chaseDistance } from './walkLayout';
import type { FrameState, Updatable } from '../../core/types';
import { palColor, livePal, lightFraction } from './stageDecoPal';
import { GLARE_FRAG_PARS, GLARE_VERT_MAIN, GLARE_VERT_PARS } from './lightsGlare';
import { createDecoFixtures } from './stageDecoFixtures';
import { CROWD_BARRIER_Z, FIELD_Y, STAGE_Y, fieldY } from '../../world/layout';

const LEN = 60;

// ───────── shader ─────────
// Chùm "kẹo": mép mềm tròn, lõi hơi kem, đỉnh sáng thấp hơn trước; tắt dần gần camera và ở cửa sổ lời.
const beamVert = /* glsl */ `
attribute vec3 aColor;
attribute float aInt;
varying vec2 vUv;
varying float vFres;
varying vec3 vCol;
varying float vInt;
varying float vDepth;
${GLARE_VERT_PARS}
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal);
  vFres = abs(dot(n, normalize(-mv.xyz)));
  vCol = aColor; vInt = aInt; vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
}`;
const beamFrag = /* glsl */ `
varying vec2 vUv; varying float vFres; varying vec3 vCol; varying float vInt; varying float vDepth;
${GLARE_FRAG_PARS}
void main() {
  float along = pow(vUv.y, 1.5) * smoothstep(0.0, 0.25, vUv.y);
  // mép tròn mềm: hồ sơ gauss theo fresnel thay vì cạnh cứng
  float soft = exp(-pow(1.0 - vFres, 2.0) * 5.0);
  float near = smoothstep(1.5, 10.0, vDepth);
  float a = along * soft * vInt * near * lyricDim() * 0.82;
  vec3 c = toSrgb(vCol);
  c = mix(c, vec3(1.0, 0.98, 0.95), soft * soft * 0.18); // lõi kem
  gl_FragColor = vec4(c * a, a);
}`;
// flare: kind 0 = bóng đèn tròn bóng (lens), 1 = chấm runway, 2 = sao gobo ở đầu chùm
const flareVert = /* glsl */ `
attribute vec3 aColor;
attribute float aInt;
attribute float aKind;
varying vec2 vP; varying vec3 vCol; varying float vInt; varying float vKind;
${GLARE_VERT_PARS}
void main() {
  vP = position.xy * 2.0; vCol = aColor; vInt = aInt; vKind = aKind;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  c.xy += position.xy * s;
  gl_Position = projectionMatrix * c;
  ${GLARE_VERT_MAIN}
}`;
const flareFrag = /* glsl */ `
varying vec2 vP; varying vec3 vCol; varying float vInt; varying float vKind;
${GLARE_FRAG_PARS}
float star5(vec2 p, float r) {
  float a = atan(p.x, p.y);
  float k = 6.2831853 / 5.0;
  float m = abs(mod(a + k * 0.5, k) - k * 0.5);
  float rr = r * mix(0.5, 1.0, pow(cos(m * 2.5), 3.0)); // sao 5 cánh đầu tròn
  return smoothstep(rr + 0.06, rr - 0.04, length(p));
}
void main() {
  float r = length(vP);
  vec3 col = toSrgb(vCol);
  float a; vec3 c;
  if (vKind < 0.5) {
    // bóng đèn tròn bóng: thân đĩa màu, đốm highlight kem lệch trên-trái, quầng mềm
    float disc = smoothstep(0.42, 0.36, r);
    float hi = smoothstep(0.13, 0.03, length(vP - vec2(-0.13, 0.14)));
    float halo = pow(max(0.0, 1.0 - r), 3.0) * 0.45;
    a = (disc * (0.55 + 0.35 * smoothstep(0.4, 0.0, r)) + halo) * vInt;
    c = mix(col, vec3(1.0, 0.98, 0.95), max(hi * 0.85, disc * 0.18));
    a = max(a, hi * disc * 0.8 * min(1.0, vInt + 0.3));
  } else if (vKind < 1.5) {
    float core = smoothstep(0.32, 0.12, r);
    float halo = pow(max(0.0, 1.0 - r), 2.5) * 0.4;
    a = (core * 0.85 + halo) * vInt;
    c = mix(col, vec3(1.0, 0.98, 0.95), core * 0.25);
  } else {
    float st = star5(vP, 0.75);
    float halo = pow(max(0.0, 1.0 - r), 3.0) * 0.35;
    a = (st * 0.8 + halo) * vInt;
    c = mix(col, vec3(1.0, 0.96, 0.82), st * 0.45);
  }
  a *= lyricDim();
  gl_FragColor = vec4(c * a, a);
}`;
const washVert = /* glsl */ `
attribute vec3 aColor;
attribute float aInt;
varying vec2 vP; varying vec3 vCol; varying float vInt;
${GLARE_VERT_PARS}
void main() {
  vP = position.xy * 2.0; vCol = aColor; vInt = aInt;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  ${GLARE_VERT_MAIN}
}`;
const washFrag = /* glsl */ `
varying vec2 vP; varying vec3 vCol; varying float vInt;
${GLARE_FRAG_PARS}
void main() {
  float r = length(vP);
  float a = pow(max(0.0, 1.0 - r * r), 2.0) * vInt * lyricDim();
  gl_FragColor = vec4(toSrgb(vCol) * a, a);
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
  // flare: [0, NBT) bóng đèn, [NBT, NBT+ND) chấm runway, [NBT+ND, 2·NBT+ND) sao gobo ở đầu chùm (cùng draw call)
  const NF = NBT + ND + NBT;
  const flares = instanced(flareGeo, addMat(flareVert, flareFrag), NF, 6);
  {
    const kd = new THREE.InstancedBufferAttribute(new Float32Array(NF), 1);
    for (let i = 0; i < NF; i++) kd.array[i] = i < NBT ? 0 : i < NBT + ND ? 1 : 2;
    flareGeo.setAttribute('aKind', kd);
  }
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
        out.set((i - 3.5) * 4 * open, FIELD_Y + 1.5, -16 - 8 * Math.sin(p + i * 0.5));
        break;
      }
      case 1: { // cross: chéo qua runway
        const sd = i < 3 ? 1 : -1;
        out.set(sd * (3 - 9 * Math.sin(p * 0.5 + i)), FIELD_Y + 2, -20 + 16 * Math.sin(p * 0.5 + i * 1.3));
        break;
      }
      case 2: { // ballyhoo: loạn hướng về sân khấu, hơi ngẩng
        out.set(12 * Math.sin(p * 0.7 + i * 1.7), FIELD_Y + 2.5 + 5 * (0.5 + 0.5 * Math.sin(p * 1.3 + i * 2.1)), -8 + 14 * Math.sin(p * 0.5 + i));
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

      // màu: 3 trạng thái Hype dùng chung; số đèn bật theo guide (25 % / 60 % / 100 %)
      livePal.hype = hype; livePal.beat = beat;
      const frac = lightFraction(hype);
      const nLit = Math.max(4, Math.round(NBT * frac));
      const pulse = f.beatPulse;

      const colAttr = beams.col.array as Float32Array;
      const itAttr = beams.it.array as Float32Array;
      const fcAttr = flares.col.array as Float32Array;
      const fiAttr = flares.it.array as Float32Array;
      const dt = Math.min(0.1, Math.max(0, f.dt));

      // mỗi nhóm một vai trò (k lệch theo nhóm) → moving head / tháp / hậu / vòng sân khác màu nhau, chạy đuổi theo phách
      const fixColor = (fx: Fix, out: THREE.Color) => palColor(fx.group * 3 + (fx.group === 2 ? fx.idx : fx.idx >> 1), out);
      const starOn = sm(0.72, 0.9, hype);

      for (let i = 0; i < NBT; i++) {
        const fx = fixes[i]!;
        const on = rank[i]! < nLit ? 1 : 0;
        lit[i] = lit[i]! + (on - lit[i]!) * Math.min(1, dt * 3);
        const col = fixColor(fx, cA);
        const m = lit[i]!;
        const swing = 0.75 + 0.25 * Math.sin(p * 2 + i);
        const strobe = hype > 0.75 ? 0.75 + 0.5 * pulse : 0.85 + 0.25 * pulse;
        const intensity = (0.36 + 0.5 * hype) * m * swing * strobe * (fx.group === 4 ? 1.1 : fx.group === 2 ? 0.85 : 1);

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
        fiAttr[i] = 0.45 + 0.7 * m * (0.8 + 0.3 * pulse);

        // sao gobo lấp lánh ở đầu chùm (hype cao)
        const si = NBT + ND + i;
        if (fx.group === 4 || starOn <= 0) {
          fiAttr[si] = 0;
        } else {
          const tw = 0.5 + 0.5 * Math.sin(f.songTime * 7 + i * 2.3);
          tmpS.setScalar(1.1 + 0.5 * tw + 0.4 * pulse);
          tmpM.compose(tgt.y < 0.5 ? tgt.setY(fieldY(Math.hypot(tgt.x, tgt.z)) + 2.4) : tgt, tmpQ.identity(), tmpS);
          flares.mesh.setMatrixAt(si, tmpM);
          fcAttr[si * 3] = col.r; fcAttr[si * 3 + 1] = col.g; fcAttr[si * 3 + 2] = col.b;
          fiAttr[si] = starOn * m * (0.35 + 0.45 * tw);
        }
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
          col = palColor(row + 1, cA);
        } else {
          const kk = -1 - dotRow[k]!;
          b = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(p * 2 - kk * 0.63));
          col = palColor(kk, cA);
        }
        cB.copy(col);
        tmpM.compose(dotPos[k]!, tmpQ.identity(), tmpS.setScalar(0.9));
        flares.mesh.setMatrixAt(j, tmpM);
        fcAttr[j * 3] = cB.r; fcAttr[j * 3 + 1] = cB.g; fcAttr[j * 3 + 2] = cB.b;
        fiAttr[j] = b * (0.8 + 0.3 * pulse);
      }

      // vệt màu khán giả trôi chậm
      const wcol = washes.col.array as Float32Array;
      const wint = washes.it.array as Float32Array;
      for (let w = 0; w < NW; w++) {
        const b = washBase[w]!;
        const t = p * 0.15 + w * 1.7;
        tmpS.setScalar(15 + 3 * Math.sin(t * 1.3));
        const wx = b[0] + 3.5 * Math.sin(t), wz = b[1] + 4.5 * Math.cos(t * 0.8);
        // ngay trên đầu khán giả (sàn dốc fieldY + ~2,3 m); vệt sau rào (trên sân khấu) giữ sát mặt sàn diễn
        const wy = b[1] > CROWD_BARRIER_Z ? STAGE_Y + 0.6 : fieldY(Math.hypot(wx, wz)) + 2.3;
        tmpM.compose(tgt.set(wx, wy, wz), tmpQ.identity(), tmpS);
        washes.mesh.setMatrixAt(w, tmpM);
        // màu trôi chậm theo hue pha + palette
        palColor(w * 3 + 1, cA, beat * 0.5);
        wcol[w * 3] = cA.r; wcol[w * 3 + 1] = cA.g; wcol[w * 3 + 2] = cA.b;
        wint[w] = 0.2 + 0.3 * hype + 0.05 * pulse;
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
