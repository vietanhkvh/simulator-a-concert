// "Đêm Sao Điểm Ảnh" — khe `lights`: thay hẳn dàn đèn kẹo. 20 đèn quét: 8 trên thanh treo dưới xà khung tranh lớn, 6 dưới
// 3 khung tranh rỗng trên runway, 2 × 3 trên hai cột gỗ cạnh bục trái/phải. Chùm là NÓN DITHER: không cộng màu, không mép
// mềm — mỗi điểm ảnh đích (≈ 427 × 240) hoặc tô một màu bảng hoặc bỏ, theo ngưỡng Bayer 4×4 cố định trên màn hình;
// độ phủ lượng tử 4 bậc, tối đa 50 % (caro) → không bao giờ trắng xoá; tắt dần trong 4–16 m sát camera ở MỌI góc máy và nén ở
// cửa sổ lời. Hype 0,3: ~20 % đèn bật, chùm hẹp, phủ ≤ 25 %; ≥ 80 %: ~80 % đèn, đổi bộ màu son. Đầu đèn + chấm runway chạy
// đuổi là ô vuông phẳng (không quầng). Bộ màu: Đêm đầy sao (crôm-300 / lam / mây) · Hướng dương (crôm / lục / ngọc) ·
// Tiếng thét (son / cam / sen). 3 draw call (chùm + ô vuông + cột gỗ).
import * as THREE from 'three';
import type { FrameState, Updatable } from '../../../../core/types';
import { FIELD_Y, STAGE_Y } from '../../../../world/layout';
import { toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { GLARE_FRAG_PARS, GLARE_VERT_MAIN, GLARE_VERT_PARS } from '../../lightsGlare';
import { WALK_SHAPES, chaseDistance, edgeRuns, shapeSignedDist } from '../../walkLayout';
import { BIG_FRAME } from './stageDeco';
import { GATE, GATE_Z } from './stageRunway';
import { GLSL_BAYER, PKit, R, V, pixelMaterial } from './stageKit';

const BEAM_VERT = /* glsl */ `
attribute vec3 aColor; attribute float aInt;
varying vec2 vUv; varying float vFres; varying vec3 vCol; varying float vInt; varying float vDepth;
${GLARE_VERT_PARS}
void main(){
  vUv = uv; vCol = aColor; vInt = aInt;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal);
  vFres = abs(dot(n, normalize(-mv.xyz)));
  vDepth = -mv.z;
  gl_Position = aInt < 0.005 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
}`;
const BEAM_FRAG = () => /* glsl */ `
uniform float uMax;
varying vec2 vUv; varying float vFres; varying vec3 vCol; varying float vInt; varying float vDepth;
${GLARE_FRAG_PARS()}
${GLSL_BAYER}
void main(){
  float along = smoothstep(0.0, 0.2, vUv.y) * (0.4 + 0.6 * vUv.y);
  float body = smoothstep(0.25, 0.75, vFres);
  float near = smoothstep(4.0, 16.0, vDepth);
  float a = vInt * along * body * near * lyricDim();
  float cov = floor(min(a, uMax) * 8.0 + 0.5) / 8.0; // bậc 12,5 %: 0 · 12,5 · 25 · 37,5 · 50 %
  if (cov <= 0.0 || bayer4(gl_FragCoord.xy) >= cov) discard;
  vec3 c = vCol;
  if (vFres > 0.92 && vUv.y > 0.55) c = mix(c, vec3(1.0, 0.96, 0.8), 0.25); // lõi sáng gần đầu đèn
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
// ô vuông: kind 0 = đầu đèn (billboard), 1 = chấm runway (nằm trên mặt sàn)
const SQ_VERT = /* glsl */ `
attribute vec3 aColor; attribute float aInt; attribute float aKind;
varying vec3 vCol; varying float vInt;
void main(){
  vCol = aColor; vInt = aInt;
  vec4 c;
  float s = length(instanceMatrix[0].xyz);
  if (aKind < 0.5) {
    c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    c.xy += position.xy * s;
  } else {
    c = modelViewMatrix * instanceMatrix * vec4(position.x, 0.0, position.y, 1.0);
  }
  gl_Position = projectionMatrix * c;
}`;
const SQ_FRAG = /* glsl */ `
uniform vec3 uOff;
varying vec3 vCol; varying float vInt;
void main(){
  vec3 c = vInt > 0.66 ? vCol : vInt > 0.33 ? mix(uOff, vCol, 0.5) : uOff;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

interface Fix { pos: THREE.Vector3; group: number; idx: number; len: number }

export function createPixelLights(ctx: ArenaBuildContext): Updatable {
  const { scene } = ctx;
  const P = R();
  const fixes: Fix[] = [];
  const { RAIL_Y, RAIL_Z } = BIG_FRAME;
  for (let i = 0; i < 8; i++) fixes.push({ pos: V((i - 3.5) * 3.9, RAIL_Y - 0.35, RAIL_Z), group: 0, idx: i, len: 30 });
  GATE_Z.forEach((z, gi) => { for (const sx of [-1, 1]) fixes.push({ pos: V(sx * 1.1, GATE.TOP - 0.3, z), group: 1, idx: gi * 2 + (sx > 0 ? 1 : 0), len: 16 }); });
  const POLE_X = 25.8, POLE_Z = -20;
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) fixes.push({ pos: V(sx * (POLE_X - 0.5), 10.2 - i * 1.2, POLE_Z + (i - 1) * 0.6), group: 2, idx: (sx > 0 ? 3 : 0) + i, len: 26 });
  const NB = fixes.length;
  // thứ tự bật: xen kẽ nhóm
  const order: number[] = [];
  {
    const byG: number[][] = [[], [], []];
    fixes.forEach((f, i) => byG[f.group]!.push(i));
    for (let r = 0, more = true; more; r++) { more = false; for (const g of byG) if (g[r] !== undefined) { order.push(g[r]!); more = true; } }
  }
  const rank = new Array<number>(NB);
  order.forEach((fi, r) => (rank[fi] = r));

  // chấm runway (như bản mặc định: hai mép mọi runway + vòng bục)
  const dotPos: THREE.Vector3[] = [], dotRow: number[] = [];
  const DOT_STEP = 1.35;
  for (const sh of WALK_SHAPES) {
    if (!sh.mesh) continue;
    if (sh.kind === 'disc') {
      const r = sh.r - 0.4, n = Math.max(8, Math.round((2 * Math.PI * r) / 2));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, x = sh.x + Math.cos(a) * r, z = sh.z + Math.sin(a) * r;
        if (WALK_SHAPES.some((o) => o !== sh && o.mesh && shapeSignedDist(o, x, z) < 0.25)) continue;
        dotPos.push(V(x, STAGE_Y + 0.02, z)); dotRow.push(-1 - k);
      }
    } else {
      for (const run of edgeRuns(sh, 0.1, -0.28)) {
        const [ax, az] = run.pts[0]!, [bx, bz] = run.pts[run.pts.length - 1]!;
        const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / DOT_STEP));
        for (let k = 0; k <= n; k++) {
          const t = n ? (k + 0.5) / (n + 1) : 0.5, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          dotPos.push(V(x, STAGE_Y + 0.02, z)); dotRow.push(Math.round(chaseDistance(x, z) / DOT_STEP));
        }
      }
    }
  }
  const ND = dotPos.length;

  // ── chùm nón dither ──
  const bGeo = new THREE.CylinderGeometry(0.05, 0.85, 1, 10, 1, true);
  bGeo.translate(0, -0.5, 0);
  const bCol = new THREE.InstancedBufferAttribute(new Float32Array(NB * 3), 3);
  const bInt = new THREE.InstancedBufferAttribute(new Float32Array(NB), 1);
  bGeo.setAttribute('aColor', bCol); bGeo.setAttribute('aInt', bInt);
  const bU = { uMax: { value: 0.25 } };
  const bMat = new THREE.ShaderMaterial({ uniforms: bU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beams = new THREE.InstancedMesh(bGeo, bMat, NB);
  beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beams.frustumCulled = false;
  beams.renderOrder = 5;

  // ── ô vuông: đầu đèn + chấm runway ──
  const NS = NB + ND;
  const sGeo = new THREE.PlaneGeometry(1, 1);
  const sCol = new THREE.InstancedBufferAttribute(new Float32Array(NS * 3), 3);
  const sInt = new THREE.InstancedBufferAttribute(new Float32Array(NS), 1);
  const sKind = new THREE.InstancedBufferAttribute(new Float32Array(NS), 1);
  sGeo.setAttribute('aColor', sCol); sGeo.setAttribute('aInt', sInt); sGeo.setAttribute('aKind', sKind);
  const sU = { uOff: { value: toColor(P.tim[700]) } };
  const sMat = new THREE.ShaderMaterial({ uniforms: sU, vertexShader: SQ_VERT, fragmentShader: SQ_FRAG, fog: false });
  const squares = new THREE.InstancedMesh(sGeo, sMat, NS);
  squares.frustumCulled = false;
  {
    const m = new THREE.Matrix4();
    for (let i = 0; i < NB; i++) { squares.setMatrixAt(i, m.compose(fixes[i]!.pos.clone().add(V(0, -0.22, 0)), new THREE.Quaternion(), V(0.42, 0.42, 0.42))); sKind.array[i] = 0; }
    for (let j = 0; j < ND; j++) { squares.setMatrixAt(NB + j, m.compose(dotPos[j]!, new THREE.Quaternion(), V(0.26, 0.26, 0.26))); sKind.array[NB + j] = 1; }
  }

  // ── thân đèn + 2 cột gỗ ──
  const k = new PKit();
  for (const f of fixes) {
    k.box(0.5, 0.36, 0.5, f.pos.x, f.pos.y, f.pos.z, P.tim[700]);
    k.box(0.12, 0.3, 0.12, f.pos.x, f.pos.y + 0.3, f.pos.z, P.may[500]);
  }
  for (const sx of [-1, 1]) {
    const x = sx * POLE_X;
    k.beam(V(x, FIELD_Y, POLE_Z), V(x, 10.9, POLE_Z), 0.5, 0.5, P.dat[700]);
    k.box(1.4, 0.3, 1.4, x, FIELD_Y + 0.15, POLE_Z, P.dat[500]);
    k.box(0.7, 0.4, 0.7, x, 11.05, POLE_Z, P.crom[500]);
    k.star(0.55, x, 11.85, POLE_Z, P.crom[300], 1, Math.PI / 2 * sx);
    for (let i = 0; i < 3; i++) k.beam(V(x, 10.5 - i * 1.2, POLE_Z + (i - 1) * 0.6), V(sx * (POLE_X - 0.5), 10.5 - i * 1.2, POLE_Z + (i - 1) * 0.6), 0.1, 0.1, P.may[500]);
  }
  const kg = k.build();
  const pm = pixelMaterial();
  const body = new THREE.Mesh(kg, pm.mat);

  scene.add(beams, squares, body);

  // bộ màu theo trạng thái Hype
  const sets = [
    [P.crom[300], P.pho[100], P.may[300], P.crom[100]].map((c) => toColor(c)),
    [P.crom[500], P.bach[100], P.ngoc, P.crom[300]].map((c) => toColor(c)),
    [P.son[300], P.son[100], P.sen, P.crom[500]].map((c) => toColor(c)),
  ];
  const lit = new Float32Array(NB);
  const DOWN = V(0, -1, 0), dir = new THREE.Vector3(), tgt = new THREE.Vector3();
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), m = new THREE.Matrix4();
  let ph = 0, prevB = NaN;
  const setOf = (h: number, i: number) => {
    const j = (i % 5) * 0.015;
    return h >= 0.8 + j ? sets[2]! : h >= 0.4 + j ? sets[1]! : sets[0]!;
  };

  return {
    update(f: FrameState) {
      const h = Math.min(1, Math.max(0, f.hype));
      const db = Number.isFinite(prevB) ? f.beat - prevB : 0;
      prevB = f.beat;
      if (db > 0 && db < 2) ph += db * (0.25 + 0.9 * h) * Math.PI * 0.5;
      const dt = Math.min(0.1, Math.max(0, f.dt));
      // Hype 0,3 → ~20 % đèn (4/20); 0,9 → ~80 %
      const nOn = Math.max(3, Math.round(NB * (0.2 + 0.6 * THREE.MathUtils.smoothstep(h, 0.3, 0.95))));
      bU.uMax.value = 0.25 + 0.25 * THREE.MathUtils.smoothstep(h, 0.45, 0.9);
      const wid = 0.6 + 0.4 * THREE.MathUtils.smoothstep(h, 0.3, 0.9);
      const ca = bCol.array as Float32Array, ia = bInt.array as Float32Array;
      const sca = sCol.array as Float32Array, sia = sInt.array as Float32Array;
      for (let i = 0; i < NB; i++) {
        const fx = fixes[i]!, n = fx.idx;
        const on = rank[i]! < nOn ? 1 : 0;
        lit[i] = lit[i]! + (on - lit[i]!) * Math.min(1, dt * 4);
        switch (fx.group) {
          case 0: tgt.set((n - 3.5) * 4.2 * (0.7 + 0.5 * Math.sin(ph * 0.5 + n * 0.3)), FIELD_Y + 1.5, -14 - 8 * Math.sin(ph + n * 0.6)); break;
          case 1: tgt.set(fx.pos.x * 3 + 5 * Math.sin(ph * 0.8 + n), FIELD_Y + 1.5, fx.pos.z - 4 + 6 * Math.sin(ph * 0.6 + n * 1.7)); break;
          default: tgt.set(Math.sign(fx.pos.x) * (8 + 7 * Math.sin(ph * 0.5 + n)), FIELD_Y + 1.2, -16 + 12 * Math.sin(ph * 0.4 + n * 1.3)); break;
        }
        dir.copy(tgt).sub(fx.pos).normalize();
        q.setFromUnitVectors(DOWN, dir);
        sc.set(wid, fx.len, wid);
        beams.setMatrixAt(i, m.compose(fx.pos, q, sc));
        const col = setOf(h, i)[(fx.group + n) % 4]!;
        ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b;
        ia[i] = lit[i]! * (0.35 + 0.45 * h) * (0.9 + 0.1 * f.beatPulse) * 1.6;
        sca[i * 3] = col.r; sca[i * 3 + 1] = col.g; sca[i * 3 + 2] = col.b;
        sia[i] = lit[i]! > 0.5 ? 1 : 0.1;
      }
      // chấm runway chạy đuổi về phía B-stage
      const beat = Math.max(0, f.beat);
      const CH = 14, head = (beat * (1 + h)) % CH;
      for (let j = 0; j < ND; j++) {
        const row = dotRow[j]!;
        let b: number, col: THREE.Color;
        const set = setOf(h, j);
        if (row >= 0) {
          let d = (head - row) % CH; if (d < 0) d += CH;
          b = d < 1.5 ? 1 : d < 3.5 ? 0.5 : 0.1;
          col = set[row % 4]!;
        } else {
          const kk = -1 - row;
          b = ((kk + Math.floor(beat)) % 3) === 0 ? 1 : 0.5;
          col = set[kk % 4]!;
        }
        const s = NB + j;
        sca[s * 3] = col.r; sca[s * 3 + 1] = col.g; sca[s * 3 + 2] = col.b;
        sia[s] = b;
      }
      beams.instanceMatrix.needsUpdate = true; bCol.needsUpdate = true; bInt.needsUpdate = true;
      sCol.needsUpdate = true; sInt.needsUpdate = true;
    },
    dispose() {
      scene.remove(beams, squares, body);
      bGeo.dispose(); bMat.dispose(); beams.dispose();
      sGeo.dispose(); sMat.dispose(); squares.dispose();
      kg.dispose(); pm.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { lights: createPixelLights };
