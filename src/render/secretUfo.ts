// UFO: đĩa bay kim loại + vòm phát sáng + vòng đèn chạy (1 mesh), tia hút hình nón (1), vũng sáng trên khán giả (1),
// hạt "lightstick" bay lên theo tia + vệt/flash khi phóng đi (1 Points). = 4 draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../core/types';
import { PALETTE, type SecretAct, disposeTree, groundY, makePoints, pxScale, seededRnd, smooth } from './secretShared';

const D = 20;
const T_HOVER = 4.5, T_BEAM_ON = 5.2, T_BEAM_OFF = 15.4, T_TILT = 16, T_ZIP = 17, ZIP_DUR = 1.1;
const START = new THREE.Vector3(34, 62, -100);
const HOVER = new THREE.Vector3(0, 18, -40);
const AWAY = new THREE.Vector3(-150, 70, -170);
const LIGHTS = 18;

const BODY_VERT = /* glsl */ `
attribute vec2 aPart;
varying vec3 vN;
varying vec3 vL;
varying vec2 vPart;
void main() {
  vN = normalize(normalMatrix * normal);
  vL = position;
  vPart = aPart;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BODY_FRAG = /* glsl */ `
uniform float uTime;
uniform float uPulse;
varying vec3 vN;
varying vec3 vL;
varying vec2 vPart;
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  vec3 n = normalize(vN);
  float fres = pow(1.0 - abs(n.z), 2.0);
  vec3 c;
  if (vPart.x < 0.5) {
    // thân kim loại: phản chiếu giả (trời đêm tím trên, ánh đèn sân khấu dưới), vạch panel
    float up = n.y;
    vec3 sky = mix(vec3(0.18, 0.2, 0.3), vec3(0.85, 0.88, 1.0), smoothstep(0.0, 0.9, up));
    vec3 low = mix(vec3(0.5, 0.15, 0.45), vec3(0.06, 0.07, 0.1), smoothstep(-0.9, 0.0, up));
    c = up > 0.0 ? sky : low;
    float band = smoothstep(0.12, 0.0, abs(up - 0.25)) * 0.6;
    c += vec3(band);
    float ang = atan(vL.z, vL.x);
    float panel = smoothstep(0.03, 0.0, abs(fract(ang * 24.0 / 6.2832) - 0.5) - 0.47);
    c *= 1.0 - 0.35 * panel;
    float ring = smoothstep(0.08, 0.0, abs(length(vL.xz) - 3.4)) * step(vL.y, 0.0);
    c += vec3(0.2, 0.9, 1.0) * ring * (0.6 + 0.8 * uPulse);
    c += vec3(0.4, 0.8, 1.0) * fres * 0.35;
  } else if (vPart.x < 1.5) {
    // vòm kính phát sáng
    c = mix(vec3(0.2, 1.0, 0.75), vec3(0.85, 1.0, 1.0), fres) * (0.75 + 0.35 * uPulse + 0.1 * sin(uTime * 7.0));
  } else {
    // vòng đèn chạy màu
    float id = vPart.y;
    float on = smoothstep(0.55, 0.45, fract(id * 3.0 - uTime * 2.2));
    c = hue(id + uTime * 0.25) * (0.35 + 1.3 * on) * (0.8 + 0.6 * uPulse) + vec3(0.25) * on;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying float vEdge;
void main() {
  vUv = uv;
  vec3 n = normalize(normalMatrix * normal);
  vEdge = 1.0 - abs(n.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uI;
uniform float uPulse;
varying vec2 vUv;
varying float vEdge;
void main() {
  float y = vUv.y; // 1 = đỉnh (UFO), 0 = đáy
  float bands = 0.65 + 0.35 * sin(y * 40.0 + uTime * 9.0);
  float a = (0.08 + 0.32 * pow(vEdge, 3.0)) * bands * (0.45 + 0.55 * y) * smoothstep(0.0, 0.08, y);
  vec3 col = mix(vec3(0.25, 1.0, 0.6), vec3(0.6, 1.0, 1.0), y) * (0.8 + 0.4 * uPulse);
  gl_FragColor = vec4(col * a * uI, 1.0);
}`;
const POOL_FRAG = /* glsl */ `
uniform float uTime;
uniform float uI;
uniform float uPulse;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float core = smoothstep(1.0, 0.0, r);
  float rings = 0.5 + 0.5 * sin(r * 22.0 - uTime * 6.0);
  float a = core * (0.35 + 0.25 * rings) + smoothstep(0.08, 0.0, abs(r - 0.92)) * 0.6;
  vec3 col = mix(vec3(0.2, 1.0, 0.55), vec3(0.85, 1.0, 0.95), core * core);
  gl_FragColor = vec4(col * a * uI * (0.75 + 0.4 * uPulse), 1.0);
}`;
const POOL_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const PTS_VERT = /* glsl */ `
uniform float uT;
uniform float uPx;
uniform float uBeam;
uniform vec3 uUfo;
uniform vec3 uPool;
uniform vec3 uZipA;
uniform vec3 uZipB;
attribute vec4 aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p; float size; float alpha = 0.0;
  vColor = aColor;
  if (aSeed.w < 0.6) {
    // lightstick bay lên theo tia hút (xoắn ốc)
    float k = fract(uT / 3.2 + aSeed.x);
    float ang = aSeed.y * 6.2832 + k * 9.0;
    float rad = (1.0 - k) * (2.0 + aSeed.z * 8.0) + 0.8;
    vec3 a = uPool + vec3(cos(ang) * rad, 0.0, sin(ang) * rad);
    p = mix(a, uUfo - vec3(0.0, 1.6, 0.0), pow(k, 1.4));
    p.x += cos(ang) * rad * 0.3 * k; p.z += sin(ang) * rad * 0.3 * k;
    alpha = uBeam * smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(0.85, 1.0, k));
    size = 0.35 + aSeed.z * 0.25;
  } else {
    // vệt + flash khi phóng đi
    float f = aSeed.x;
    float tPass = ${T_ZIP.toFixed(2)} + f * ${ZIP_DUR.toFixed(2)};
    float age = uT - tPass;
    vec3 jit = (aSeed.yzw - 0.5) * 2.0;
    p = mix(uZipA, uZipB, f * f) + jit * age * 2.5;
    alpha = age < 0.0 ? 0.0 : exp(-age * 2.2);
    size = 0.5 + (f < 0.04 ? 3.0 * exp(-age * 3.0) : 0.0);
    vColor = mix(vec3(0.6, 1.0, 1.0), aColor, 0.3);
  }
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * size / -mv.z, 1.5, 90.0);
}`;

function buildBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tag = (g: THREE.BufferGeometry, part: number, id = 0) => {
    const h = g.index ? g.toNonIndexed() : g;
    h.deleteAttribute('uv');
    const n = h.getAttribute('position').count;
    const a = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { a[i * 2] = part; a[i * 2 + 1] = id; }
    h.setAttribute('aPart', new THREE.BufferAttribute(a, 2));
    parts.push(h);
  };
  const prof = [
    [0.01, -1.0], [1.8, -0.95], [3.4, -0.62], [5.3, -0.12], [6.0, 0.0], [5.4, 0.18], [3.8, 0.55], [2.4, 0.8], [0.01, 0.86],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  tag(new THREE.LatheGeometry(prof, 48), 0);
  const dome = new THREE.SphereGeometry(2.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.85, 1);
  dome.translate(0, 0.7, 0);
  tag(dome, 1);
  for (let i = 0; i < LIGHTS; i++) {
    const a = (i / LIGHTS) * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.42, 10, 6);
    s.translate(Math.cos(a) * 4.5, -0.42, Math.sin(a) * 4.5);
    tag(s, 2, i / LIGHTS);
  }
  // đèn viền ngoài
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.22, 8, 5);
    s.translate(Math.cos(a) * 6.0, 0, Math.sin(a) * 6.0);
    tag(s, 2, ((i * 3) % 32) / 32);
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

export function createUfo(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const bodyU = { uTime: { value: 0 }, uPulse: { value: 0 } };
  const body = new THREE.Mesh(
    buildBody(),
    new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, uniforms: bodyU, fog: false }),
  );
  body.frustumCulled = false;
  root.add(body);

  const beamU = { uTime: { value: 0 }, uI: { value: 0 }, uPulse: { value: 0 } };
  const beamGeo = new THREE.CylinderGeometry(2.8, 11, 1, 40, 1, true);
  beamGeo.translate(0, -0.5, 0);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: beamU, fog: false,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }),
  );
  beam.frustumCulled = false;
  beam.renderOrder = 6;
  root.add(beam);

  const poolGeo = new THREE.PlaneGeometry(27, 27);
  poolGeo.rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(
    poolGeo,
    new THREE.ShaderMaterial({
      vertexShader: POOL_VERT, fragmentShader: POOL_FRAG, uniforms: beamU, fog: false,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  pool.rotation.x = Math.atan2(5.6, 74);
  pool.frustumCulled = false;
  pool.renderOrder = 6;
  root.add(pool);

  const ptsU = {
    uT: { value: 0 }, uPx: { value: 600 }, uBeam: { value: 0 },
    uUfo: { value: new THREE.Vector3() }, uPool: { value: new THREE.Vector3() },
    uZipA: { value: new THREE.Vector3() }, uZipB: { value: AWAY.clone() },
  };
  const rnd = seededRnd(777);
  const pts = makePoints(900, PTS_VERT, ptsU, (i, s, c) => {
    const streak = i >= 500;
    s.set([rnd(), rnd(), rnd(), streak ? 0.6 + rnd() * 0.4 : rnd() * 0.59], i * 4);
    const col = PALETTE[Math.floor(rnd() * PALETTE.length)]!;
    c.set([col.r, col.g, col.b], i * 3);
  });
  pts.renderOrder = 7;
  root.add(pts);

  const pos = new THREE.Vector3();
  const zipA = new THREE.Vector3();

  const ufoPos = (t: number, out: THREE.Vector3) => {
    if (t < T_HOVER) {
      const s = 1 - Math.pow(1 - t / T_HOVER, 3);
      out.lerpVectors(START, HOVER, s);
      out.x += Math.sin(t * 2.1) * 3 * (1 - s);
    } else {
      out.copy(HOVER);
    }
    out.y += Math.sin(t * 1.4) * 0.6;
    out.x += Math.sin(t * 0.45) * 2.5 * smooth(T_HOVER - 1, T_HOVER + 2, t);
    if (t > T_TILT) out.y += (t - T_TILT) * 1.2;
    return out;
  };

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      const pulse = f.beatPulse;
      bodyU.uTime.value = t; bodyU.uPulse.value = pulse;
      beamU.uTime.value = t; beamU.uPulse.value = pulse;
      ptsU.uT.value = t; ptsU.uPx.value = pxScale();

      if (t < T_ZIP) ufoPos(t, pos);
      else {
        ufoPos(T_ZIP, zipA);
        const k = Math.min(1, (t - T_ZIP) / ZIP_DUR);
        pos.lerpVectors(zipA, AWAY, k * k);
      }
      body.position.copy(pos);
      body.visible = t < T_ZIP + ZIP_DUR;
      body.rotation.order = 'ZXY';
      body.rotation.y = t * (t < T_ZIP ? 1.2 : 4);
      const wob = t < T_HOVER + 1 ? (1 - t / (T_HOVER + 1)) * 0.35 : 0.06;
      body.rotation.x = Math.sin(t * 3.1) * wob;
      // nghiêng theo tia + nghiêng mạnh trước khi phóng
      const sweep = Math.sin((f.beat * Math.PI) / 4) * 0.55;
      const beamI = smooth(T_BEAM_ON, T_BEAM_ON + 0.7, t) * (1 - smooth(T_BEAM_OFF, T_BEAM_OFF + 0.6, t));
      body.rotation.z = Math.sin(t * 2.3) * wob + sweep * 0.25 * beamI + smooth(T_TILT, T_ZIP, t) * 0.55;
      const sc = 1.5 + 0.04 * pulse;
      body.scale.setScalar(sc);

      beamU.uI.value = beamI;
      beam.visible = pool.visible = beamI > 0.001;
      beam.position.copy(pos).y -= 1.2;
      beam.rotation.z = sweep;
      const gy = groundY(pos.z) + 1.4;
      const h = (beam.position.y - gy) / Math.cos(sweep);
      beam.scale.set(1, h, 1);
      // tia quay quanh trục z: đáy nằm ở x = top.x + sin(sweep)*h
      pool.position.set(beam.position.x + Math.sin(sweep) * h, gy + 0.05, pos.z);
      ptsU.uBeam.value = beamI;
      ptsU.uUfo.value.copy(pos);
      ptsU.uPool.value.copy(pool.position);
      ptsU.uZipA.value.copy(t < T_ZIP ? ufoPos(T_ZIP, zipA) : zipA);
    },
    dispose() { disposeTree(root); },
  };
}
