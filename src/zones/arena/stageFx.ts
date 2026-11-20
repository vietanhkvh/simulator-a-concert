// Hiệu ứng sân khấu giả (additive, không Light thật, không bóng): laser quạt, đài phun sao/tim, blinder bóng kem, khói thấp.
// 4 draw call; mỗi frame chỉ đổi uniform. Màu theo "Kẹo đêm": laser mint/soda/berry, pháo honey/cream/berry,
// khói nhuộm theo 3 trạng thái Hype, chớp pháo màu kem (không bao giờ trắng xoá, ≤ 3 lần chớp/giây).
import { viewHeightPx } from '../../world/shared/viewport';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { FIELD_Y } from '../../world/layout';
import { PAL, toColor } from '../../world/style';
import { hypeTriad } from './stageDecoPal';
import { GLARE_FRAG_PARS, GLARE_VERT_MAIN, GLARE_VERT_PARS } from './lightsGlare';

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
${GLARE_VERT_PARS}
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
  p += side * aL.w * (0.03 + dist * 0.0042); // dải rộng hơn → quầng mềm
  vAlong = aL.z;
  vSide = aL.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  ${GLARE_VERT_MAIN}
}`;
const LASER_FRAG = () => /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vAlong;
varying float vSide;
${GLARE_FRAG_PARS()}
void main() {
  float x = abs(vSide);
  float core = exp(-x * x * 18.0);        // lõi mảnh tròn
  float glow = exp(-x * x * 3.5) * 0.35;  // quầng kẹo mềm
  float a = (core * 0.75 + glow) * uIntensity * (1.0 - smoothstep(0.35, 1.0, vAlong)) * smoothstep(0.0, 0.02, vAlong);
  a *= lyricDim();
  vec3 c = mix(uColor, vec3(1.0, 0.98, 0.95), core * 0.25);
  gl_FragColor = vec4(c * a, a);
}`;

// ───────────── Hình kẹo dùng chung (sao 5 cánh đầu tròn, tim mập) ─────────────
export const SHAPES_GLSL = /* glsl */ `
float sdStar(vec2 p, float r) {
  float a = atan(p.x, p.y);
  float k = 6.2831853 / 5.0;
  float m = abs(mod(a + k * 0.5, k) - k * 0.5);
  float rr = r * mix(0.48, 1.0, pow(max(cos(m * 2.5), 0.0), 3.0));
  return smoothstep(rr + 0.08, rr - 0.04, length(p));
}
float dot2h(vec2 v) { return dot(v, v); }
// tim mập (SDF của Inigo Quilez), p trong [-1, 1], mũi tim ở dưới
float sdHeart(vec2 p) {
  vec2 q = p * 0.7 + vec2(0.0, 0.45);
  q.x = abs(q.x);
  float d = (q.y + q.x > 1.0)
    ? sqrt(dot2h(q - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0
    : sqrt(min(dot2h(q - vec2(0.0, 1.0)), dot2h(q - 0.5 * max(q.x + q.y, 0.0)))) * sign(q.x - q.y);
  return smoothstep(0.04, -0.03, d);
}
`;

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
varying float vSeed;
varying float vSpin;
void main() {
  float birth = aSeed.w * ${(PYRO_DUR - 0.7).toFixed(2)};
  float life = 0.75 + aSeed.y * 0.5;
  float age = uTime - uStart - birth;
  float k = age / life;
  vec3 v = vec3((aSeed.x - 0.5) * 1.6, 8.6 + aSeed.y * 1.6, (aSeed.z - 0.5) * 1.6);
  vec3 p = vec3(aJet, 0.05, -5.0) + v * age + vec3(0.0, -4.9 * age * age, 0.0);
  vLife = (age < 0.0 || k > 1.0) ? -1.0 : k;
  vSeed = aSeed.z;
  vSpin = (aSeed.x - 0.5) * 6.0 * age;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // "pop": 0 → 1,15 → 1 trong 0,25 s đầu, rồi co dần
  float pop = age < 0.15 ? 1.15 * (1.0 - pow(1.0 - age / 0.15, 3.0)) : mix(1.15, 1.0, smoothstep(0.15, 0.25, age));
  gl_PointSize = vLife < 0.0 ? 0.0 : max(2.0, uPx * (0.22 * pop * (1.0 - 0.45 * k)) / -mv.z);
}`;
const SPARK_FRAG = /* glsl */ `
uniform vec3 uHoney; uniform vec3 uCream; uniform vec3 uBerry;
varying float vLife;
varying float vSeed;
varying float vSpin;
${SHAPES_GLSL}
void main() {
  if (vLife < 0.0) discard;
  vec2 c = (gl_PointCoord - 0.5) * 2.0;
  c.y = -c.y;
  float cs = cos(vSpin), sn = sin(vSpin);
  c = mat2(cs, -sn, sn, cs) * c;
  // ~45 % sao (honey), ~25 % tim (berry), còn lại tia lửa tròn (cream)
  float m; vec3 col;
  if (vSeed < 0.45) { m = sdStar(c, 0.85); col = uHoney; }
  else if (vSeed < 0.7) { m = sdHeart(c * 1.1); col = uBerry; }
  else { m = smoothstep(0.42, 0.3, length(c)); col = uCream; }
  col = mix(col, uCream, (1.0 - vLife) * 0.35);
  float a = m * (1.0 - smoothstep(0.6, 1.0, vLife)) * 0.9;
  gl_FragColor = vec4(col * a, a);
}`;

// ───────────── Blinder ─────────────
const BLINDERS = 8;
const BLIND_VERT = /* glsl */ `
uniform float uPx;
uniform float uIntensity;
varying float vI;
${GLARE_VERT_PARS}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
  vI = uIntensity;
  gl_PointSize = uPx * (1.1 + 0.6 * uIntensity) / -mv.z;
}`;
const BLIND_FRAG = () => /* glsl */ `
uniform vec3 uCream;
uniform vec3 uHoney;
varying float vI;
${GLARE_FRAG_PARS()}
void main() {
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  float d = length(q);
  // bóng đèn tròn kem: thân đĩa, đốm highlight trên-trái, quầng mềm
  float disc = 1.0 - smoothstep(0.24, 0.3, d);
  float hi = 1.0 - smoothstep(0.03, 0.09, length(q - vec2(-0.08, -0.09)));
  float halo = pow(max(0.0, 1.0 - d), 3.0);
  vec3 c = mix(uHoney, uCream, 0.55 + 0.45 * vI);
  float a = disc * (0.2 + 0.6 * vI) + halo * 0.4 * vI;
  c = mix(c, vec3(1.0), hi * disc * 0.6);
  a = max(a, hi * disc * 0.5);
  a *= lyricDim();
  gl_FragColor = vec4(c * a, a);
}`;

// ───────────── Khói thấp ─────────────
const HAZE_VERT = /* glsl */ `
attribute float aLayer;
varying vec2 vUv;
varying float vLayer;
${GLARE_VERT_PARS}
void main() {
  vUv = uv;
  vLayer = aLayer;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${GLARE_VERT_MAIN}
}`;
const HAZE_FRAG = () => /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
uniform vec3 uColor2;
varying vec2 vUv;
varying float vLayer;
${GLARE_FRAG_PARS()}
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
  // bông mềm: ngưỡng hoá nhẹ để khói thành cụm tròn
  v = smoothstep(0.25, 0.85, v);
  float a = v * edge * vert * uIntensity * lyricDim();
  vec3 c = mix(uColor, uColor2, n(p * 0.7 + 3.1));
  gl_FragColor = vec4(c * a, a);
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
    vertexShader: LASER_VERT, fragmentShader: LASER_FRAG(), uniforms: laserU,
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
  const sparkU = {
    uTime: { value: 0 }, uStart: { value: -1000 }, uPx: { value: 600 },
    uHoney: { value: new THREE.Color(PAL.honey[500]).convertLinearToSRGB() },
    uCream: { value: new THREE.Color(PAL.cream[500]).convertLinearToSRGB() },
    uBerry: { value: new THREE.Color(PAL.berry[300]).convertLinearToSRGB() },
  };
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
  const blindU = {
    uPx: { value: 600 }, uIntensity: { value: 0 },
    uCream: { value: new THREE.Color(PAL.cream[300]).convertLinearToSRGB() },
    uHoney: { value: new THREE.Color(PAL.honey[300]).convertLinearToSRGB() },
  };
  const blindMat = new THREE.ShaderMaterial({
    vertexShader: BLIND_VERT, fragmentShader: BLIND_FRAG(), uniforms: blindU,
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
  const hazeU = { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uColor2: { value: new THREE.Color() }, uIntensity: { value: 0.1 } };
  const hazeMat = new THREE.ShaderMaterial({
    vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG(), uniforms: hazeU,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const haze = new THREE.Mesh(hazeGeo, hazeMat);
  haze.frustumCulled = false;
  haze.renderOrder = 4;
  group.add(haze);
  disposables.push(hazeGeo, hazeMat);

  scene.add(group);

  // shader thô (không colorspace_fragment) → giữ giá trị sRGB để ra đúng hex của bảng
  const srgb = (hex: number) => new THREE.Color(hex).convertLinearToSRGB();
  const laserCols = [srgb(PAL.mint[500]), srgb(PAL.soda[500]), srgb(PAL.berry[500])];
  const laserTmp = new THREE.Color();
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
      const px = viewHeightPx() * 1.2;
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
      {
        // mint → soda → berry, trộn mượt trong phách đầu mỗi đoạn 8 phách
        const seg = Math.floor(beat / 8), u = Math.min(1, (beat - seg * 8));
        laserTmp.copy(laserCols[(seg + 2) % 3]!).lerp(laserCols[seg % 3]!, u * u * (3 - 2 * u));
        laserU.uColor.value.copy(laserTmp);
      }
      laserU.uIntensity.value = laserFade * (0.6 + 0.25 * f.beatPulse);

      // Blinder / strobe
      let bi = 0.06;
      if (f.hype > 0.7) bi += 0.35 * Math.min(1, (f.hype - 0.7) / 0.15) * f.beatPulse;
      // chớp pháo: một nhịp "pop" kem duy nhất, tắt mềm (không nhấp nháy 24 Hz, không trắng xoá)
      const sa = time - lastPyro;
      if (sa >= 0 && sa < 0.9) bi = Math.max(bi, 0.85 * (sa < 0.08 ? sa / 0.08 : Math.exp(-(sa - 0.08) * 4)));
      blindU.uIntensity.value = bi;

      // Khói
      const tri = hypeTriad(f.hype);
      hazeU.uColor.value.copy(tri[0]!).convertLinearToSRGB();
      hazeU.uColor2.value.copy(tri[1]!).convertLinearToSRGB();
      hazeU.uIntensity.value = 0.1 + 0.06 * f.hype;
    },
    pyro,
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose();
    },
  };
}
