// "Thép & Lửa" — khe `lights`: bọc dàn đèn mặc định (chùm moving-head, chấm runway, vệt màu khán giả — màu theo hypeColors
// của phong cách) nhưng chùm hẹp lại ×0,45 và ngả trắng hồ quang khi Hype thấp (ít màu, tương phản cao); ẩn đèn trang trí
// giàn ống kẹo. Thêm: hàng blinder tungsten 12 × 4 bóng dưới giàn đầu (chớp theo phách từ 40 %, ≤ 3 lần/s), 15 chùm
// searchlight hồ quang hẹp từ vòm giàn runway + tháp bên + giàn đầu (quét chậm, khói nặng). Mọi lớp cộng dồn nén ở cửa sổ lời.
import * as THREE from 'three';
import type { FrameState, Updatable } from '../../../../core/types';
import { FIELD_Y } from '../../../../world/layout';
import { toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { createLights } from '../../lights';
import { GLARE_FRAG_PARS, GLARE_VERT_MAIN, GLARE_VERT_PARS } from '../../lightsGlare';
import { GABLE } from './stageDeco';
import { GATE, GATE_Z } from './stageRunway';
import { R } from './stageKit';

const BEAM_VERT = /* glsl */ `
attribute float aInt; varying float vInt; varying vec2 vUv; varying float vFres; varying float vDepth;
${GLARE_VERT_PARS}
void main(){
  vUv = uv; vInt = aInt;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  vec3 n = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal);
  vFres = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
}`;
const BEAM_FRAG = () => /* glsl */ `
uniform vec3 uCol; varying float vInt; varying vec2 vUv; varying float vFres; varying float vDepth;
${GLARE_FRAG_PARS()}
void main(){
  // hẹp, trong; tắt dần sát camera (mọi góc máy) → không chùm nào phủ kín màn hình
  float a = vInt * pow(vFres, 3.0) * pow(vUv.y, 1.6) * 0.3 * smoothstep(3.0, 14.0, vDepth);
  gl_FragColor = vec4(toSrgb(uCol * a * lyricDim()), 1.0);
}`;
const LAMP_FRAG = () => /* glsl */ `
uniform vec3 uCol; uniform vec3 uHot; varying float vInt; varying vec2 vUv; varying float vFres; varying float vDepth;
${GLARE_FRAG_PARS()}
void main(){
  vec2 q = abs(vUv - 0.5);
  float sq = step(max(q.x, q.y), 0.42);
  float core = step(max(q.x, q.y), 0.2);
  vec3 c = mix(uCol * 0.12, mix(uCol, uHot, core) * (0.25 + 1.2 * vInt), sq);
  gl_FragColor = vec4(toSrgb(c * lyricDim()), 1.0);
}`;

export function createSteelLights(ctx: ArenaBuildContext): Updatable {
  const { scene } = ctx;
  const P = R();
  const before = new Set(scene.children);
  const inner = createLights(scene);
  const added = scene.children.filter((o) => !before.has(o));
  let beamMesh: THREE.InstancedMesh | null = null, beamCol: THREE.BufferAttribute | null = null, beamInt: THREE.BufferAttribute | null = null;
  const dimInt: THREE.BufferAttribute[] = [], dimK: number[] = []; // flare + vệt màu khán giả: hạ cường độ
  for (const o of added) {
    if (!(o instanceof THREE.Group)) { o.visible = false; continue; } // đèn trang trí giàn ống kẹo
    for (const c of o.children) {
      const m = c as THREE.InstancedMesh;
      if (m.isInstancedMesh && m.geometry instanceof THREE.CylinderGeometry) { beamMesh = m; beamCol = m.geometry.getAttribute('aColor') as THREE.BufferAttribute; beamInt = m.geometry.getAttribute('aInt') as THREE.BufferAttribute; }
      else if (m.isInstancedMesh && m.geometry.getAttribute('aInt')) { dimInt.push(m.geometry.getAttribute('aInt') as THREE.BufferAttribute); dimK.push(m.renderOrder === 3 ? 0.3 : 0.6); }
    }
  }

  // ── searchlight hồ quang hẹp ──
  type Src = { p: THREE.Vector3; ph: number; kind: number };
  const srcs: Src[] = [];
  for (const z of GATE_Z) for (const x of [-1.1, 0, 1.1]) srcs.push({ p: new THREE.Vector3(x, GATE.TOP - 0.45, z), ph: z * 0.7 + x, kind: 0 });
  for (const sx of [-1, 1]) for (const dz of [-1.8, 1.8]) srcs.push({ p: new THREE.Vector3(sx * 25.5, 10.6, -20 + dz), ph: sx * 2 + dz, kind: 1 });
  for (const x of [-11, 11]) srcs.push({ p: new THREE.Vector3(x, GABLE.HEADER_Y - 0.6, GABLE.HEADER_Z), ph: x, kind: 2 });
  const NS = srcs.length;
  const LEN = 46;
  const bGeo = new THREE.CylinderGeometry(0.04, 0.45, LEN, 10, 1, true);
  bGeo.translate(0, -LEN / 2, 0);
  const bInt = new THREE.InstancedBufferAttribute(new Float32Array(NS), 1);
  bGeo.setAttribute('aInt', bInt);
  const bU = { uCol: { value: new THREE.Color() } };
  const bMat = new THREE.ShaderMaterial({ uniforms: bU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const search = new THREE.InstancedMesh(bGeo, bMat, NS);
  search.frustumCulled = false;
  search.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // ── blinder 12 × 4 bóng (quad vuông) dưới giàn đầu ──
  const NL = 48;
  const lGeo = new THREE.PlaneGeometry(0.34, 0.24).rotateY(Math.PI);
  const lInt = new THREE.InstancedBufferAttribute(new Float32Array(NL), 1);
  lGeo.setAttribute('aInt', lInt);
  const lU = { uCol: { value: toColor(P.tung[500]) }, uHot: { value: toColor(P.tung[100]) } };
  const lMat = new THREE.ShaderMaterial({ uniforms: lU, vertexShader: BEAM_VERT, fragmentShader: LAMP_FRAG(), fog: false });
  const lamps = new THREE.InstancedMesh(lGeo, lMat, NL);
  {
    const m = new THREE.Matrix4();
    for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) {
      const x = (i - 5.5) * 2.6 + (j % 2 ? 0.2 : -0.2), y = GABLE.HEADER_Y - 0.75 + (j < 2 ? 0.13 : -0.13);
      lamps.setMatrixAt(i * 4 + j, m.makeTranslation(x, y, GABLE.HEADER_Z - 0.38));
    }
  }
  lamps.frustumCulled = false;
  scene.add(search, lamps);

  const arc = toColor(P.arc[300]), tung = toColor(P.tung[500]), white = new THREE.Color(1, 1, 1);
  const DOWN = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3(), tgt = new THREE.Vector3();
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), m = new THREE.Matrix4();
  const pos = new THREE.Vector3(), sc = new THREE.Vector3();
  let time = 0, lastBeat = -1, lastFlash = -10, blind = 0, ph = 0, prevB = NaN;
  return {
    update(f: FrameState) {
      inner.update(f);
      const h = Math.min(1, Math.max(0, f.hype));
      time += f.dt;
      // chùm mặc định: hẹp hơn + ngả trắng hồ quang (ít màu hơn bản kẹo); màu lửa giữ lại khi Hype lên
      if (beamMesh && beamCol && beamInt) {
        // Thép nguội: ~18 % đèn bật, Lửa lớn: ~70 %; chùm hẹp ×0,3, trong (cường độ ×0,3–0,55), ngả trắng hồ quang khi lạnh
        const a = beamCol.array as Float32Array, it = beamInt.array as Float32Array, w = 0.6 * (1 - h);
        const n = beamMesh.count, nOn = Math.max(3, Math.round(n * (0.18 + 0.52 * THREE.MathUtils.smoothstep(h, 0.3, 0.95))));
        const kI = 0.3 + 0.25 * h;
        for (let i = 0; i < n; i++) {
          const r = (i * 7) % n; // thứ tự bật xen kẽ nhóm
          if (r >= nOn) it[i] = 0; else it[i] = Math.min(0.6, it[i]! * kI);
          beamMesh.getMatrixAt(i, m);
          m.decompose(pos, q, sc);
          sc.x *= 0.3; sc.z *= 0.3;
          beamMesh.setMatrixAt(i, m.compose(pos, q, sc));
          for (let c = 0; c < 3; c++) a[i * 3 + c] = a[i * 3 + c]! * (1 - w) + (c === 2 ? 0.95 : 0.85) * w;
        }
      }
      for (let d = 0; d < dimInt.length; d++) {
        const arr = dimInt[d]!.array as Float32Array, k = dimK[d]!;
        for (let i = 0; i < arr.length; i++) arr[i] = arr[i]! * k;
      }
      // searchlight: quét chậm theo phách, mạnh dần theo Hype
      const db = Number.isFinite(prevB) ? f.beat - prevB : 0;
      prevB = f.beat;
      if (db > 0 && db < 2) ph += db * (0.2 + 0.5 * h);
      const ia = bInt.array as Float32Array;
      for (let i = 0; i < NS; i++) {
        const sr = srcs[i]!;
        if (sr.kind === 0) tgt.set(sr.p.x * 4 + 9 * Math.sin(ph + sr.ph), FIELD_Y + 1.5, sr.p.z - 6 + 10 * Math.sin(ph * 0.7 + sr.ph * 1.3));
        else if (sr.kind === 1) tgt.set(Math.sign(sr.p.x) * (6 + 6 * Math.sin(ph * 0.6 + sr.ph)), FIELD_Y + 1, -14 + 12 * Math.sin(ph * 0.5 + sr.ph));
        else tgt.set(sr.p.x * 0.6 + 4 * Math.sin(ph + sr.ph), FIELD_Y + 1, -22 + 8 * Math.sin(ph * 0.8 + sr.ph));
        dir.copy(tgt).sub(sr.p).normalize();
        q.setFromUnitVectors(DOWN, dir);
        search.setMatrixAt(i, m.compose(sr.p, q, s.setScalar(1)));
        ia[i] = (i % 5 === 0 || h >= 0.4) ? (0.15 + 0.3 * h) * (sr.kind === 0 ? 1 : 0.8) : 0;
      }
      bU.uCol.value.copy(arc).lerp(white, 0.3);
      search.instanceMatrix.needsUpdate = true; bInt.needsUpdate = true;
      // blinder: chớp ấm mỗi phách từ 40 %, cách nhau ≥ 0,34 s (≤ 3 lần/s); dưới 40 % chỉ âm ỉ
      const bi = Math.floor(f.beat);
      if (bi !== lastBeat) {
        lastBeat = bi;
        if (h >= 0.4 && time - lastFlash >= 0.34 && (h >= 0.8 || bi % 2 === 0)) { blind = 1; lastFlash = time; }
      }
      blind = Math.max(0, blind - f.dt / 0.3);
      const li = lInt.array as Float32Array;
      for (let i = 0; i < NL; i++) li[i] = 0.1 + 0.15 * h + blind * (0.3 + 0.3 * h) * (((i >> 2) + lastBeat) % 2 ? 1 : 0.6);
      lInt.needsUpdate = true;
      lU.uCol.value.copy(tung);
    },
    dispose() {
      inner.dispose();
      scene.remove(search, lamps);
      bGeo.dispose(); bMat.dispose(); search.dispose(); lGeo.dispose(); lMat.dispose(); lamps.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { lights: createSteelLights };
