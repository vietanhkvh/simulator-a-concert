// "Thép & Lửa" — khe `stageFx`: thay hẳn bản kẹo (không laser màu, không tim/sao bắn). 8 ống lửa ở mép trước bắn cột lửa
// đẽo phẳng 5 lớp (trắng nung → vàng → cam → than hồng → khói), mỗi lớp một sắc phẳng + bậc tối ở ngọn, cao 4–7 m theo
// phách mạnh khi Hype ≥ 60 % (≤ 3 lần/s), cả 8 cùng bắn ở pyro(); thác pyro tia lửa tam giác rơi từ giàn đầu; CO2 cụm khối
// xám đẽo mặt; khói thấp hắt lửa từ dưới. 4 draw call; mỗi frame chỉ đổi uniform (+ mảng 8 độ cao).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FIELD_Y } from '../../../../world/layout';
import { toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders, StageFx } from '../../builders';
import { GLARE_FRAG_PARS, GLARE_VERT_MAIN, GLARE_VERT_PARS } from '../../lightsGlare';
import { CANNON_TOP, CANNON_X, CANNON_Z } from './stageBase';
import { GABLE } from './stageDeco';
import { R } from './stageKit';

const FLAME_VERT = /* glsl */ `
uniform float uH[8]; uniform float uTime;
attribute float aCannon; attribute float aLayer;
varying float vLayer; varying float vY; varying float vDepth;
${GLARE_VERT_PARS}
void main(){
  int ci = int(aCannon + 0.5);
  float H = 0.0;
  for (int i = 0; i < 8; i++) if (i == ci) H = uH[i];
  float L = aLayer; // 0 khói … 4 lõi
  float w = mix(0.4, 0.1, L / 4.0);
  float hh = mix(1.12, 0.5, L / 4.0);
  vec3 p = position;
  float y = p.y; // 0..1
  float flick = sin(uTime * 17.0 + aCannon * 2.3 + y * 6.0) * 0.12 + sin(uTime * 29.0 + L) * 0.05;
  p.x = p.x * w * (1.0 - 0.55 * y) + flick * y * 0.8;
  p.z = p.z * w * (1.0 - 0.55 * y) + cos(uTime * 13.0 + aCannon) * 0.08 * y;
  p.y = y * hh * H + (L < 0.5 ? 0.25 * H * y : 0.0);
  vLayer = L; vY = y;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = H < 0.05 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
}`;
const FLAME_FRAG = () => /* glsl */ `
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
varying float vLayer; varying float vY; varying float vDepth;
${GLARE_FRAG_PARS()}
void main(){
  int L = int(vLayer + 0.5);
  vec3 c = L == 0 ? uC0 : L == 1 ? uC1 : L == 2 ? uC2 : L == 3 ? uC3 : uC4;
  c *= vY > 0.72 ? 0.78 : 1.0; // bậc tối ở ngọn (không gradient mượt)
  // tắt dần sát camera (góc pit / cần cẩu): lửa không bao giờ phủ kín màn hình
  float a = (L == 0 ? 0.55 : 0.95) * smoothstep(2.0, 6.0, vDepth);
  c *= mix(0.55, 1.0, smoothstep(4.0, 10.0, vDepth));
  gl_FragColor = vec4(toSrgb(c * mix(1.0, lyricDim(), 0.7)), a);
}`;

const SPARK_VERT = /* glsl */ `
uniform float uT; uniform float uTop; uniform float uTime;
attribute vec3 aSeed; varying float vA;
${GLARE_VERT_PARS}
void main(){
  float on = step(0.0, uT) * (1.0 - smoothstep(5.0, 6.5, uT));
  float sp = 0.55 + 0.6 * aSeed.y;
  float t = fract(uT * sp * 0.5 + aSeed.z);
  float y = uTop - t * (uTop + 0.1);
  float x = aSeed.x + sin(uTime * 3.0 + aSeed.z * 30.0) * 0.05;
  float s = 0.24 * (1.0 - 0.4 * t);
  vec3 p = vec3(x, y, 0.0) + vec3(position.x * s, position.y * s * 2.2, 0.0);
  vA = on * (1.0 - 0.6 * t) * step(0.0, uT - aSeed.z * 0.6);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
}`;
const SPARK_FRAG = () => /* glsl */ `
uniform vec3 uCol; varying float vA;
${GLARE_FRAG_PARS()}
void main(){ gl_FragColor = vec4(toSrgb(uCol * vA * lyricDim()), 1.0); }`;

const CO2_VERT = /* glsl */ `
uniform float uT; attribute vec2 aPuff; varying vec3 vN; varying float vA;
${GLARE_VERT_PARS}
void main(){
  float on = step(0.0, uT) * (1.0 - smoothstep(1.2, 2.2, uT));
  float k = aPuff.x; // 0..4 dọc cột
  float rise = min(uT, 1.0) * (1.6 + k * 1.3);
  float sc = (0.35 + 0.25 * k) * (0.6 + 0.8 * min(uT * 2.0, 1.0));
  vec3 p = position * sc + vec3(sin(aPuff.y * 7.0 + k) * 0.25 * k, rise, 0.0);
  vN = normalize(mat3(instanceMatrix) * normal);
  vA = on * (1.0 - k * 0.12);
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
}`;
const CO2_FRAG = () => /* glsl */ `
uniform vec3 uGrey; uniform vec3 uWarm; varying vec3 vN; varying float vA;
${GLARE_FRAG_PARS()}
void main(){
  float k = max(dot(normalize(vN), normalize(vec3(-0.45, 0.8, -0.4))), 0.0);
  float r = max(dot(normalize(vN), normalize(vec3(0.3, -0.6, -0.7))), 0.0);
  vec3 c = uGrey * (0.45 + 0.6 * floor(k * 3.0 + 0.5) / 3.0) + uWarm * r * 0.5;
  gl_FragColor = vec4(toSrgb(c), 0.7 * vA);
}`;

const HAZE_VERT = /* glsl */ `varying vec2 vUv; varying vec3 vW; varying float vGraze;
${GLARE_VERT_PARS}
void main(){ vUv = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; vGraze = abs(normalize(cameraPosition - vW).y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); ${GLARE_VERT_MAIN} }`;
const HAZE_FRAG = () => /* glsl */ `
uniform float uTime; uniform float uInt; uniform float uFire; uniform vec3 uCol; uniform vec3 uCol2;
varying vec2 vUv; varying vec3 vW; varying float vGraze;
${GLARE_FRAG_PARS()}
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 p = vW.xz * 0.12 + vec2(uTime * 0.05, uTime * 0.03);
  float n = vn(p) * 0.6 + vn(p * 2.3 - uTime * 0.04) * 0.4;
  n = floor(n * 4.0) / 4.0; // bậc
  float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  float near = exp(-max(0.0, -5.0 - vW.z) * 0.06); // ấm hơn gần mép sân khấu (lửa hắt)
  vec3 c = mix(uCol, uCol2, near * (0.4 + 0.6 * uFire));
  gl_FragColor = vec4(toSrgb(c * n * edge * uInt * lyricDim() * smoothstep(0.08, 0.4, vGraze)), 1.0);
}`;

export function createSteelStageFx(ctx: ArenaBuildContext): StageFx {
  const { scene, uniforms } = ctx;
  const P = R();
  const group = new THREE.Group();
  const uTime = uniforms.uTime ?? { value: 0 };

  // ── cột lửa: 8 ống × 5 lớp, 1 InstancedMesh ──
  const fGeo = new THREE.CylinderGeometry(0.62, 1, 1, 5, 4, true);
  fGeo.translate(0, 0.5, 0);
  { // đẽo răng cưa: lệch đỉnh theo hàng
    const p = fGeo.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const j = Math.sin(i * 12.9898) * 0.18 * y; p.setX(i, p.getX(i) * (1 + j)); p.setZ(i, p.getZ(i) * (1 - j)); }
    p.setY(0, p.getY(0));
  }
  const NI = 40;
  const aC = new THREE.InstancedBufferAttribute(new Float32Array(NI), 1), aL = new THREE.InstancedBufferAttribute(new Float32Array(NI), 1);
  const fU = {
    uH: { value: new Array(8).fill(0) as number[] }, uTime,
    uC0: { value: toColor(P.coal[100]).lerp(toColor(P.ember[700]), 0.5) }, uC1: { value: toColor(P.ember[500]) }, uC2: { value: toColor(P.flame[500]) },
    uC3: { value: toColor(P.white[500]) }, uC4: { value: toColor(P.white[100]) },
  };
  const fMat = new THREE.ShaderMaterial({ uniforms: fU, vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  fGeo.setAttribute('aCannon', aC); fGeo.setAttribute('aLayer', aL);
  const flames = new THREE.InstancedMesh(fGeo, fMat, NI);
  {
    const m = new THREE.Matrix4();
    let n = 0;
    CANNON_X.forEach((x, ci) => {
      for (let L = 0; L < 5; L++, n++) {
        m.makeRotationY(ci * 0.7 + L * 0.4).setPosition(x, CANNON_TOP, CANNON_Z);
        flames.setMatrixAt(n, m); aC.array[n] = ci; aL.array[n] = L;
      }
    });
  }
  flames.frustumCulled = false;
  flames.renderOrder = 5;

  // ── thác pyro: tia lửa tam giác rơi từ giàn đầu ──
  const NSP = 360;
  const sGeo = new THREE.InstancedBufferGeometry();
  sGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.5, 0, -0.35, -0.5, 0, 0.35, -0.5, 0], 3));
  const seed = new Float32Array(NSP * 3);
  let sd = 7;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < NSP; i++) { seed[i * 3] = -12.5 + 25 * ((i + rnd()) / NSP); seed[i * 3 + 1] = rnd(); seed[i * 3 + 2] = rnd(); }
  sGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 3));
  sGeo.instanceCount = NSP;
  const spU = { uT: { value: -1 }, uTop: { value: GABLE.HEADER_Y - 1.1 }, uTime, uCol: { value: toColor(P.white[300]).multiplyScalar(1.3) } };
  const spMat = new THREE.ShaderMaterial({ uniforms: spU, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const sparks = new THREE.Mesh(sGeo, spMat);
  sparks.position.z = GABLE.HEADER_Z - 0.45;
  sparks.frustumCulled = false;

  // ── CO2: 4 cột × 5 cụm khối đẽo mặt ──
  const cGeo = new THREE.IcosahedronGeometry(1, 0);
  cGeo.computeVertexNormals();
  const NC = 20;
  const puff = new THREE.InstancedBufferAttribute(new Float32Array(NC * 2), 2);
  cGeo.setAttribute('aPuff', puff);
  const cU = { uT: { value: -1 }, uGrey: { value: toColor(P.steel[300]) }, uWarm: { value: toColor(P.flame[500]) } };
  const cMat = new THREE.ShaderMaterial({ uniforms: cU, vertexShader: CO2_VERT, fragmentShader: CO2_FRAG(), transparent: true, depthWrite: false, fog: false });
  const co2 = new THREE.InstancedMesh(cGeo, cMat, NC);
  {
    const m = new THREE.Matrix4();
    let n = 0;
    for (const x of [-12.2, -6.2, 6.2, 12.2]) for (let k = 0; k < 5; k++, n++) {
      m.makeRotationFromEuler(new THREE.Euler(k * 0.7, k * 1.3, x)).setPosition(x, 0.3, -4.55);
      co2.setMatrixAt(n, m); puff.array[n * 2] = k; puff.array[n * 2 + 1] = x;
    }
  }
  co2.frustumCulled = false;

  // ── khói thấp hắt lửa ──
  const hGeo = new THREE.PlaneGeometry(64, 40).rotateX(-Math.PI / 2);
  const hU = { uTime, uInt: { value: 0.1 }, uFire: { value: 0 }, uCol: { value: toColor(P.tung[700]) }, uCol2: { value: toColor(P.ember[500]) } };
  const hMat = new THREE.ShaderMaterial({ uniforms: hU, vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const haze = new THREE.Mesh(hGeo, hMat);
  haze.position.set(0, FIELD_Y + 2.6, -24);
  haze.renderOrder = 4;

  group.add(haze, flames, co2, sparks);
  scene.add(group);

  const fired = new Array(8).fill(-10) as number[], hold = new Array(8).fill(0.35) as number[], peak = new Array(8).fill(5) as number[];
  let time = 0, lastBeat = -1, lastShot = -10, pyroAt = -100, co2At = -100, prevHype = 0, lastPyro = -100, pat = 0;
  const env = (dt: number, hd: number) => dt < 0 ? 0 : dt < 0.08 ? dt / 0.08 : dt < hd ? 1 : Math.max(0, 1 - (dt - hd) / 0.45);
  const pyro = () => {
    pyroAt = time; co2At = time; lastPyro = time;
    for (let i = 0; i < 8; i++) { fired[i] = time + i * 0.04; hold[i] = 1.3; peak[i] = 7; }
  };
  return {
    update(f: FrameState) {
      time += f.dt;
      const h = Math.min(1, Math.max(0, f.hype));
      if (h > 0.85 && prevHype <= 0.85 && time - lastPyro >= 15) pyro();
      prevHype = h;
      const bi = Math.floor(f.beat);
      if (bi !== lastBeat) {
        lastBeat = bi;
        // phách mạnh: phách chẵn (60–85 %), mọi phách (≥ 85 %); cách nhau ≥ 0,34 s → ≤ 3 lần/s
        if (h >= 0.6 && time - lastShot >= 0.34 && (h >= 0.85 || bi % 2 === 0) && time - pyroAt > 1.8) {
          lastShot = time;
          pat = (pat + 1) % 4;
          const sets = [[0, 7], [1, 6], [2, 5], [3, 4]];
          const pick = h >= 0.85 && bi % 8 === 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : h >= 0.85 ? [...sets[pat]!, ...sets[(pat + 2) % 4]!] : sets[pat]!;
          for (const i of pick) { fired[i] = time; hold[i] = 0.3; peak[i] = 4 + 3 * Math.min(1, (h - 0.6) / 0.35); }
        }
        if (h >= 0.85 && bi % 16 === 8 && time - co2At > 6) co2At = time;
      }
      const H = fU.uH.value;
      let fireSum = 0;
      for (let i = 0; i < 8; i++) { const e = env(time - fired[i]!, hold[i]!); H[i] = e * peak[i]!; fireSum += e; }
      spU.uT.value = time - pyroAt < 7 ? time - pyroAt : -1;
      cU.uT.value = time - co2At < 2.5 ? time - co2At : -1;
      hU.uInt.value = 0.05 + 0.1 * h + 0.05 * fireSum / 8;
      hU.uFire.value = Math.min(1, fireSum / 3 + 0.3 * h);
    },
    pyro,
    dispose() {
      scene.remove(group);
      fGeo.dispose(); fMat.dispose(); flames.dispose();
      sGeo.dispose(); spMat.dispose();
      cGeo.dispose(); cMat.dispose(); co2.dispose();
      hGeo.dispose(); hMat.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { stageFx: createSteelStageFx };
