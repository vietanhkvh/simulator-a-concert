// Hiệu ứng sân khấu giả (additive, không Light thật, không bóng): laser quạt, pháo sáng, blinder/strobe, khói thấp.
// 4 draw call; mỗi frame chỉ đổi uniform.
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { FIELD_Y } from '../../world/layout';

export interface StageFx {
  update(f: FrameState): void;
  pyro(): void;
  dispose(): void;
}

// ───────────── Laser ─────────────
const LASER_PER = 8;
const LASER_LEN = 70;
const LASER_VERT = /* glsl */ `
uniform float uSpread;
uniform float uTilt;
uniform float uPitch;
attribute vec4 aL; // x: emitter (-1/1), y: line index 0..1, z: along 0..1, w: side -1/1
varying float vAlong;
varying float vSide;
void main() {
  float sx = aL.x;
  vec3 origin = vec3(sx * 10.0, 7.6, -6.0);
  float yaw = -sx * 0.32 + sx * uTilt + uSpread * (aL.y - 0.5);
  float pitch = uPitch + 0.05 * abs(aL.y - 0.5);
  vec3 d = normalize(vec3(sin(yaw) * cos(pitch), -sin(pitch), -cos(yaw) * cos(pitch)));
  vec3 p = origin + d * aL.z * ${LASER_LEN.toFixed(1)};
  vec3 toCam = cameraPosition - p;
  float dist = length(toCam);
  vec3 side = normalize(cross(d, toCam));
  p += side * aL.w * (0.015 + dist * 0.0022);
  vAlong = aL.z;
  vSide = aL.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const LASER_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vAlong;
varying float vSide;
void main() {
  float core = 1.0 - abs(vSide);
  core = core * core;
  float a = core * uIntensity * (1.0 - smoothstep(0.35, 1.0, vAlong)) * smoothstep(0.0, 0.02, vAlong);
  gl_FragColor = vec4(uColor * a + vec3(a * a * 0.25), a);
}`;

// ───────────── Pháo sáng ─────────────
const SPARK_PER = 260;
const JETS = [-5.2, -2.6, 2.6, 5.2];
const PYRO_DUR = 2.5;
const SPARK_VERT = /* glsl */ `
uniform float uTime;
uniform float uStart;
uniform float uPx;
attribute vec4 aSeed;
attribute float aJet;
varying float vLife;
void main() {
  float birth = aSeed.w * ${(PYRO_DUR - 0.7).toFixed(2)};
  float life = 0.75 + aSeed.y * 0.5;
  float age = uTime - uStart - birth;
  float k = age / life;
  vec3 v = vec3((aSeed.x - 0.5) * 1.6, 8.6 + aSeed.y * 1.6, (aSeed.z - 0.5) * 1.6);
  vec3 p = vec3(aJet, 0.05, -5.0) + v * age + vec3(0.0, -4.9 * age * age, 0.0);
  vLife = (age < 0.0 || k > 1.0) ? -1.0 : k;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vLife < 0.0 ? 0.0 : max(1.5, uPx * (0.1 * (1.0 - 0.5 * k)) / -mv.z);
}`;
const SPARK_FRAG = /* glsl */ `
varying float vLife;
void main() {
  if (vLife < 0.0) discard;
  vec2 c = gl_PointCoord - 0.5;
  float r = 1.0 - smoothstep(0.1, 0.5, length(c));
  vec3 col = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.45, 0.08), smoothstep(0.1, 0.7, vLife));
  float a = r * (1.0 - smoothstep(0.6, 1.0, vLife));
  gl_FragColor = vec4(col * a, a);
}`;

// ───────────── Blinder ─────────────
const BLINDERS = 8;
const BLIND_VERT = /* glsl */ `
uniform float uPx;
uniform float uIntensity;
varying float vI;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vI = uIntensity;
  gl_PointSize = uPx * (1.1 + 0.6 * uIntensity) / -mv.z;
}`;
const BLIND_FRAG = /* glsl */ `
varying float vI;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float disc = 1.0 - smoothstep(0.22, 0.28, d);
  float halo = pow(max(0.0, 1.0 - d), 2.5);
  vec3 warm = vec3(1.0, 0.82, 0.55);
  float a = disc * (0.18 + 0.82 * vI) + halo * 0.55 * vI;
  gl_FragColor = vec4(warm * a, a);
}`;

// ───────────── Khói thấp ─────────────
const HAZE_VERT = /* glsl */ `
attribute float aLayer;
varying vec2 vUv;
varying float vLayer;
void main() {
  vUv = uv;
  vLayer = aLayer;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const HAZE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
varying float vLayer;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vUv * vec2(6.0, 1.5) + vec2(uTime * (0.05 + vLayer * 0.03), vLayer * 7.3);
  float v = n(p) * 0.6 + n(p * 2.1 + vec2(-uTime * 0.07, 0.0)) * 0.4;
  float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  float vert = smoothstep(0.0, 0.3, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
  float a = v * edge * vert * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
}`;

export function createStageFx(scene: THREE.Scene): StageFx {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  let s = 98765;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

  // Laser: 2×8 dải quad mảnh, hướng tính trong vertex shader.
  const laserAttr: number[] = [];
  const laserIdx: number[] = [];
  let vi = 0;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < LASER_PER; i++) {
      const li = i / (LASER_PER - 1);
      for (const along of [0, 1]) for (const side of [-1, 1]) laserAttr.push(sx, li, along, side);
      laserIdx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
      vi += 4;
    }
  }
  const laserGeo = new THREE.BufferGeometry();
  laserGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vi * 3), 3));
  laserGeo.setAttribute('aL', new THREE.BufferAttribute(new Float32Array(laserAttr), 4));
  laserGeo.setIndex(laserIdx);
  const laserU = {
    uSpread: { value: 0.6 },
    uTilt: { value: 0 },
    uPitch: { value: 0.06 },
    uColor: { value: new THREE.Color(0x30ff60) },
    uIntensity: { value: 0 },
  };
  const laserMat = new THREE.ShaderMaterial({
    vertexShader: LASER_VERT, fragmentShader: LASER_FRAG, uniforms: laserU,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const lasers = new THREE.Mesh(laserGeo, laserMat);
  lasers.frustumCulled = false;
  lasers.renderOrder = 6;
  lasers.visible = false;
  group.add(lasers);
  disposables.push(laserGeo, laserMat);

  // Pháo sáng: 4 cột tia lửa, 1 Points.
  const nSpark = SPARK_PER * JETS.length;
  const sSeed = new Float32Array(nSpark * 4);
  const sJet = new Float32Array(nSpark);
  for (let i = 0; i < nSpark; i++) {
    sSeed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    sJet[i] = JETS[i % JETS.length]!;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSpark * 3), 3));
  sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 4));
  sparkGeo.setAttribute('aJet', new THREE.BufferAttribute(sJet, 1));
  const sparkU = { uTime: { value: 0 }, uStart: { value: -1000 }, uPx: { value: 600 } };
  const sparkMat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, uniforms: sparkU,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  sparks.renderOrder = 6;
  sparks.visible = false;
  group.add(sparks);
  disposables.push(sparkGeo, sparkMat);

  // Blinder: hàng 8 đĩa trên giàn treo phía trước sân khấu (trong khung nhìn của ca sĩ).
  const bPos = new Float32Array(BLINDERS * 3);
  for (let i = 0; i < BLINDERS; i++) {
    const x = ((i / (BLINDERS - 1)) * 2 - 1) * 9;
    bPos.set([x, 6.4, -10], i * 3);
  }
  const blindGeo = new THREE.BufferGeometry();
  blindGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const blindU = { uPx: { value: 600 }, uIntensity: { value: 0 } };
  const blindMat = new THREE.ShaderMaterial({
    vertexShader: BLIND_VERT, fragmentShader: BLIND_FRAG, uniforms: blindU,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const blinders = new THREE.Points(blindGeo, blindMat);
  blinders.frustumCulled = false;
  blinders.renderOrder = 6;
  group.add(blinders);
  disposables.push(blindGeo, blindMat);

  // Khói: 3 mặt phẳng gộp thành 1 mesh, thấp hơn tầm mắt, trước mép sân khấu.
  const hazeParts: THREE.BufferGeometry[] = [];
  const layers = [
    { z: -5.6, y: FIELD_Y + 2.3, w: 26, h: 3.6 },
    { z: -7.5, y: FIELD_Y + 1.2, w: 34, h: 2.6 },
    { z: -10, y: FIELD_Y + 0.9, w: 44, h: 3.0 },
  ];
  layers.forEach((l, i) => {
    const g = new THREE.PlaneGeometry(l.w, l.h);
    g.translate(0, l.y, l.z);
    g.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(4).fill(i), 1));
    hazeParts.push(g);
  });
  // Gộp thủ công (tránh phụ thuộc examples/).
  const hazeGeo = new THREE.BufferGeometry();
  {
    const pos: number[] = [], uv: number[] = [], lay: number[] = [], idx: number[] = [];
    let off = 0;
    for (const g of hazeParts) {
      pos.push(...(g.getAttribute('position').array as Float32Array));
      uv.push(...(g.getAttribute('uv').array as Float32Array));
      lay.push(...(g.getAttribute('aLayer').array as Float32Array));
      for (const k of g.getIndex()!.array as ArrayLike<number> as number[]) idx.push(k + off);
      off += g.getAttribute('position').count;
      g.dispose();
    }
    hazeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hazeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hazeGeo.setAttribute('aLayer', new THREE.Float32BufferAttribute(lay, 1));
    hazeGeo.setIndex(idx);
  }
  const hazeU = { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uIntensity: { value: 0.1 } };
  const hazeMat = new THREE.ShaderMaterial({
    vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG, uniforms: hazeU,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const haze = new THREE.Mesh(hazeGeo, hazeMat);
  haze.frustumCulled = false;
  haze.renderOrder = 4;
  group.add(haze);
  disposables.push(hazeGeo, hazeMat);

  scene.add(group);

  const laserCols = [new THREE.Color(0x30ff60), new THREE.Color(0x20e8ff), new THREE.Color(0xff30e0)];
  const hazeCool = new THREE.Color(0x3a5cff);
  const hazeWarm = new THREE.Color(0xff6a3a);
  let time = 0;
  let laserFade = 0;
  let prevHype = 0;
  let lastPyro = -1000;

  const pyro = () => {
    sparkU.uStart.value = time;
    lastPyro = time;
    sparks.visible = true;
  };

  return {
    update(f) {
      const dt = Math.min(f.dt, 0.1);
      time += dt;
      const px = window.innerHeight * 1.2;
      sparkU.uTime.value = time;
      sparkU.uPx.value = px;
      blindU.uPx.value = px;
      hazeU.uTime.value = time;

      if (f.hype > 0.85 && prevHype <= 0.85 && time - lastPyro >= 15) pyro();
      prevHype = f.hype;
      if (sparks.visible && time - sparkU.uStart.value > PYRO_DUR + 0.5) sparks.visible = false;

      // Laser
      const target = f.hype > 0.55 ? 1 : 0;
      laserFade += (target - laserFade) * Math.min(1, dt * 2.5);
      lasers.visible = laserFade > 0.01;
      const beat = Math.max(0, f.beat);
      laserU.uSpread.value = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(beat * Math.PI * 0.25));
      laserU.uTilt.value = 0.18 * Math.sin(beat * Math.PI * 0.125);
      laserU.uPitch.value = 0.045 + 0.03 * Math.sin(beat * Math.PI * 0.5) + 0.01 * f.beatPulse;
      laserU.uColor.value.copy(laserCols[Math.floor(beat / 8) % 3]!);
      laserU.uIntensity.value = laserFade * (0.75 + 0.35 * f.beatPulse);

      // Blinder / strobe
      let bi = 0.05;
      if (f.hype > 0.7) bi += 0.45 * Math.min(1, (f.hype - 0.7) / 0.15) * f.beatPulse;
      const sa = time - lastPyro;
      if (sa >= 0 && sa < 0.5) bi = Math.floor(sa * 24) % 2 === 0 ? 1 : 0.05;
      blindU.uIntensity.value = bi;

      // Khói
      hazeU.uColor.value.copy(hazeCool).lerp(hazeWarm, Math.min(1, Math.max(0, f.hype)));
      hazeU.uIntensity.value = 0.12 + 0.07 * f.hype;
    },
    pyro,
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose();
    },
  };
}
