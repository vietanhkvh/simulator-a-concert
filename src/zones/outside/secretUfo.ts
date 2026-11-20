// ★ UFO chibi (STYLE_GUIDE · SECRET OBJECT): đĩa tím nho mập (lathe, vành bo 2 tầng + đinh tán, đáy sẫm),
// vòm kính bạc hà bóng có vệt sáng, phi công chibi (đầu to, tai nghe, mắt chớp, vẫy tay), 12 đèn kẹo chạy đuổi
// màu Hype, 3 chân cầu, ăng-ten đầu sao xoay, ánh sáng dưới đáy. Tia hút 2 lớp + vũng sáng viền sò; tim / sao /
// lightstick xoắn ốc bay lên; rời đi: co giãn rồi vụt, để lại vòng sao lấp lánh. Chữ ký secret (halo).
// Draw call: thân + viền ink + vòm + tia + vũng + hạt + halo = 7.
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { PAL, SKIN, OUTLINE, popScale } from '../../world/style';
import { type SecretAct, disposeTree, groundY, makePoints, pxScale, seededRnd, smooth } from './secretShared';
import { PART, PartBuilder, SHAPE_FRAG, createSecretHalo, makeToon, raw, setChase, starGeo } from './secretHalo';

const D = 20;
const T_HOVER = 4.5, T_BEAM_ON = 5.2, T_BEAM_OFF = 15.4, T_TILT = 16, T_ZIP = 17, ZIP_DUR = 1.1;
const START = new THREE.Vector3(34, 62, -100);
const HOVER = new THREE.Vector3(0, 18, -40);
// điểm đến của cú vút: rất xa về bên trái, ngoài khung nhìn (> CAMERA_FAR và lệch > nửa FOV) để UFO bay RA khỏi cảnh rồi mới tắt
const AWAY = new THREE.Vector3(-320, 60, -110);
const LIGHTS = 12;
/** Tỉ lệ model (đơn vị local → m). Đĩa bán kính ~6,1 local ⇒ ~8,8 m. */
const S = 1.45;
const R_LOCAL = 6.1;
const H_LOCAL = 7.6;

function buildBody(): THREE.BufferGeometry {
  const b = new PartBuilder();
  const V = (x: number, y: number) => new THREE.Vector2(x, y);
  // nắp trên (lilac) – cong mập
  b.add(new THREE.LatheGeometry([V(5.2, 0.35), V(4.6, 0.8), V(3.6, 1.15), V(2.6, 1.32), V(0.01, 1.38)], 48), PAL.grape[300]);
  // vành 2 tầng: tầng trên mập sáng, tầng dưới thon sẫm
  const rim = new THREE.TorusGeometry(5.25, 0.72, 14, 64);
  rim.rotateX(Math.PI / 2);
  b.add(rim, PAL.grape[100]);
  const rim2 = new THREE.TorusGeometry(4.75, 0.5, 12, 56);
  rim2.rotateX(Math.PI / 2);
  rim2.translate(0, -0.62, 0);
  b.add(rim2, PAL.grape[500]);
  // đĩa đáy sẫm
  b.add(new THREE.LatheGeometry([V(0.01, -1.32), V(1.6, -1.28), V(3.0, -1.1), V(4.2, -0.82), V(4.9, -0.5)], 48), PAL.grape[700]);
  // vòng phát sáng dưới đáy (underglow)
  const ug = new THREE.TorusGeometry(1.7, 0.2, 8, 40);
  ug.rotateX(Math.PI / 2);
  ug.translate(0, -1.28, 0);
  b.add(ug, PAL.mint[300], PART.glow);
  const ugc = new THREE.CircleGeometry(1.55, 32);
  ugc.rotateX(Math.PI / 2);
  ugc.translate(0, -1.3, 0);
  b.add(ugc, PAL.mint[100], PART.glow, 1);
  // đinh tán tròn trên tầng trên
  for (let i = 0; i < 20; i++) {
    const a = ((i + 0.5) / 20) * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.15, 8, 6);
    s.translate(Math.cos(a) * 5.0, 0.62, Math.sin(a) * 5.0);
    b.add(s, PAL.cream[300]);
  }
  // 12 đèn kẹo trên mép ngoài
  for (let i = 0; i < LIGHTS; i++) {
    const a = (i / LIGHTS) * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.46, 14, 10);
    s.translate(Math.cos(a) * 5.92, 0.02, Math.sin(a) * 5.92);
    b.add(s, PAL.cream[500], PART.light, i / LIGHTS);
  }
  // 3 chân cầu
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const leg = new THREE.CylinderGeometry(0.22, 0.28, 0.7, 10);
    leg.translate(Math.cos(a) * 2.9, -1.35, Math.sin(a) * 2.9);
    b.add(leg, PAL.grape[500]);
    const s = new THREE.SphereGeometry(0.5, 14, 10);
    s.scale(1, 0.8, 1);
    s.translate(Math.cos(a) * 2.95, -1.85, Math.sin(a) * 2.95);
    b.add(s, PAL.honey[500]);
  }
  // cổ vòm (vòng mật ong)
  const col = new THREE.TorusGeometry(3.3, 0.26, 10, 48);
  col.rotateX(Math.PI / 2);
  col.translate(0, 1.32, 0);
  b.add(col, PAL.honey[500]);
  // ăng-ten trên đỉnh vòm + sao xoay
  const rod = new THREE.CylinderGeometry(0.09, 0.12, 1.2, 8);
  rod.translate(0, 4.75, 0);
  b.add(rod, PAL.cream[500]);
  const knob = new THREE.SphereGeometry(0.22, 10, 8);
  knob.translate(0, 4.2, 0);
  b.add(knob, PAL.cream[500]);
  const st = starGeo(0.62, 0.26);
  st.translate(0, 5.85, 0);
  b.add(st, PAL.honey[500], PART.spin, 0, new THREE.Vector3(0, 5.85, 0));

  // ── phi công chibi (nhìn về +z) ──
  const skin = SKIN[1]!;
  const body = new THREE.SphereGeometry(0.62, 18, 14);
  body.scale(1, 0.9, 0.9);
  body.translate(0, 1.85, 0);
  b.add(body, PAL.berry[500]);
  const star = starGeo(0.22, 0.08);
  star.translate(0, 1.9, 0.6);
  b.add(star, PAL.honey[500]);
  const head = new THREE.SphereGeometry(1.08, 28, 20);
  head.scale(1, 0.95, 0.95);
  head.translate(0, 3.0, 0);
  b.add(head, skin);
  // tóc mái
  const hair = new THREE.SphereGeometry(1.13, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42);
  hair.scale(1, 0.95, 0.95);
  hair.rotateX(-0.28);
  hair.translate(0, 3.05, -0.06);
  b.add(hair, 0x4a2f24);
  // tai nghe + mic + 2 ăng-ten nhỏ
  const band = new THREE.TorusGeometry(1.14, 0.09, 8, 32, Math.PI);
  band.translate(0, 3.05, 0);
  b.add(band, PAL.soda[500]);
  for (const sx of [-1, 1]) {
    const cup = new THREE.SphereGeometry(0.3, 12, 10);
    cup.scale(0.6, 1, 1);
    cup.translate(sx * 1.08, 3.0, 0);
    b.add(cup, PAL.soda[500]);
    const ant = new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6);
    ant.rotateZ(-sx * 0.35);
    ant.translate(sx * 0.48, 4.25, 0);
    b.add(ant, PAL.cream[500]);
    const bob = new THREE.SphereGeometry(0.15, 10, 8);
    bob.translate(sx * 0.6, 4.52, 0);
    b.add(bob, PAL.berry[500], PART.glow, 2);
  }
  const mic = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6);
  mic.rotateZ(Math.PI / 2 - 0.35);
  mic.rotateY(-0.9);
  mic.translate(0.86, 2.68, 0.45);
  b.add(mic, PAL.night[300]);
  // mắt chấm (chớp quanh tâm), má hồng
  for (const sx of [-1, 1]) {
    const e = new THREE.SphereGeometry(0.15, 12, 10);
    e.scale(0.8, 1.15, 0.45);
    const c = new THREE.Vector3(sx * 0.36, 2.98, 1.0);
    e.translate(c.x, c.y, c.z);
    b.add(e, PAL.night[700], PART.eye, 0, c);
    const gl = new THREE.SphereGeometry(0.05, 6, 6);
    gl.translate(sx * 0.36 - 0.04, 3.05, 1.06);
    b.add(gl, PAL.cream[100], PART.eye, 0, c);
    const ck = new THREE.CircleGeometry(0.16, 16);
    ck.scale(1.25, 0.8, 1);
    ck.rotateY(sx * 0.5);
    ck.translate(sx * 0.62, 2.72, 0.86);
    b.add(ck, PAL.berry[300], PART.flat);
  }
  const mouth = new THREE.TorusGeometry(0.11, 0.035, 6, 12, Math.PI);
  mouth.rotateZ(Math.PI);
  mouth.translate(0, 2.72, 1.02);
  b.add(mouth, PAL.night[700], PART.flat);
  // tay vẫy (phải) + tay trái
  const shoulder = new THREE.Vector3(0.5, 2.0, 0.2);
  const arm = new THREE.CapsuleGeometry(0.13, 0.45, 4, 8);
  arm.translate(0, 0.32, 0);
  arm.rotateZ(-0.35);
  arm.translate(shoulder.x, shoulder.y, shoulder.z);
  b.add(arm, PAL.berry[500], PART.wave, 0, shoulder);
  const hand = new THREE.SphereGeometry(0.2, 12, 10);
  hand.translate(shoulder.x + 0.25, shoulder.y + 0.72, shoulder.z);
  b.add(hand, skin, PART.wave, 0, shoulder);
  const larm = new THREE.SphereGeometry(0.2, 10, 8);
  larm.translate(-0.62, 1.7, 0.35);
  b.add(larm, skin);
  return b.build();
}

const DOME_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  vN = normalize(normalMatrix * normal); vL = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const DOME_FRAG = /* glsl */ `
uniform vec3 uGlass; uniform vec3 uGlassHi; uniform vec3 uInk; uniform vec3 uHi; uniform float uPulse;
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(-vV);
  float f = 1.0 - max(dot(n, v), 0.0);
  vec3 c = mix(uGlass, uGlassHi, smoothstep(0.2, 0.9, f));
  float a = mix(0.3, 0.72, smoothstep(0.3, 0.95, f));
  // vệt sáng cong (trên trái) + đốm nhỏ
  float streak = smoothstep(0.1, 0.0, abs(length(n.xy - vec2(0.35, -0.3)) - 0.92)) * step(n.x, -0.15) * step(0.05, n.y);
  float dotHi = 1.0 - smoothstep(0.08, 0.12, length(n.xy - vec2(-0.25, 0.62)));
  c = mix(c, uHi, max(streak * 0.9, dotHi));
  a = max(a, max(streak * 0.85, dotHi * 0.9));
  // viền ink ở mép silhouette (vòm không có hull)
  float edge = smoothstep(0.86, 0.92, f);
  c = mix(c, uInk, edge); a = max(a, edge);
  c *= 0.95 + 0.1 * uPulse;
  gl_FragColor = vec4(c * a, a);
}`;

const BEAM_VERT = /* glsl */ `
attribute float aLayer;
varying vec2 vUv; varying float vEdge; varying float vLayer;
void main() {
  vUv = uv; vLayer = aLayer;
  vec3 n = normalize(normalMatrix * normal);
  vEdge = 1.0 - abs(n.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform float uTime; uniform float uI; uniform float uPulse;
uniform vec3 uCore; uniform vec3 uHaze; uniform vec3 uRing;
varying vec2 vUv; varying float vEdge; varying float vLayer;
void main() {
  float y = vUv.y; // 1 = đỉnh (UFO), 0 = đáy
  float fadeEnds = smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.94, y);
  float rings = smoothstep(0.82, 1.0, 0.5 + 0.5 * sin(y * 26.0 + uTime * 5.0));
  vec3 col; float a;
  if (vLayer < 0.5) {
    // lõi sáng hẹp
    a = (0.12 + 0.16 * (1.0 - vEdge)) * (0.5 + 0.5 * y);
    col = uCore;
  } else {
    // quầng ngoài mềm + vòng chạy xuống
    a = (0.05 + 0.18 * pow(vEdge, 2.0)) * (0.55 + 0.45 * y) + rings * 0.22;
    col = mix(uHaze, uRing, rings);
  }
  a *= fadeEnds * uI * (0.85 + 0.25 * uPulse);
  gl_FragColor = vec4(col * a, 1.0);
}`;
const POOL_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const POOL_FRAG = /* glsl */ `
uniform float uTime; uniform float uI; uniform float uPulse;
uniform vec3 uCore; uniform vec3 uHaze; uniform vec3 uRing;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float edge = 0.86 + 0.05 * cos(ang * 10.0 + uTime * 0.8); // viền vỏ sò
  float fill = 1.0 - smoothstep(edge - 0.03, edge, r);
  float rimL = smoothstep(0.045, 0.0, abs(r - edge));
  float ripple = smoothstep(0.75, 1.0, 0.5 + 0.5 * sin(r * 18.0 - uTime * 5.0)) * fill;
  float core = 1.0 - smoothstep(0.0, 0.55, r);
  float a = fill * 0.22 + ripple * 0.18 + rimL * 0.75 + core * 0.25;
  vec3 col = mix(uHaze, uCore, core) + uRing * rimL * 0.5;
  gl_FragColor = vec4(col * a * uI * (0.8 + 0.3 * uPulse), 1.0);
}`;

const PTS_VERT = /* glsl */ `
uniform float uT; uniform float uPx; uniform float uBeam;
uniform vec3 uUfo; uniform vec3 uPool; uniform vec3 uZipA; uniform vec3 uZipB;
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot;
void main() {
  vec3 p; float size; float alpha = 0.0;
  vColor = aColor;
  vRot = 0.0;
  float cls = floor(aSeed.w);
  float r3 = fract(aSeed.w * 7.0);
  if (cls < 0.5) {
    // tim / sao / lightstick xoắn ốc theo tia hút
    float k = fract(uT / 3.6 + aSeed.x);
    float ang = aSeed.y * 6.2832 + k * 7.0;
    float rad = (1.0 - k) * (2.0 + aSeed.z * 7.0) + 0.6;
    vec3 a = uPool + vec3(cos(ang) * rad, 0.5, sin(ang) * rad);
    p = mix(a, uUfo - vec3(0.0, 2.0, 0.0), pow(k, 1.25));
    alpha = uBeam * smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.82, 0.97, k));
    vShape = r3 < 0.4 ? 2.0 : (r3 < 0.75 ? 1.0 : 3.0);
    size = vShape > 2.5 ? 0.9 : 1.25 + aSeed.z * 0.5;
    vRot = sin(uT * 2.0 + aSeed.y * 20.0) * 0.4;
    size *= 1.0 - 0.45 * k;
  } else if (cls < 1.5) {
    // vệt sao nhỏ khi vụt đi
    float f = aSeed.x;
    float tPass = ${T_ZIP.toFixed(2)} + f * ${ZIP_DUR.toFixed(2)};
    float age = uT - tPass;
    vec3 jit = (aSeed.yzw - vec3(0.5, 0.5, 1.5)) * 2.0;
    p = mix(uZipA, uZipB, f * f) + jit * age * 2.0;
    alpha = age < 0.0 ? 0.0 : exp(-age * 1.6);
    vShape = r3 < 0.5 ? 1.0 : 0.0;
    size = vShape > 0.5 ? 1.6 : 0.8;
    vRot = age * 3.0;
  } else {
    // vòng sao lấp lánh để lại tại điểm xuất phát
    float age = uT - ${(T_ZIP + 0.1).toFixed(2)};
    float i = aSeed.x;
    // đường viền ngôi sao 5 cánh (tham số theo chu vi)
    float seg = floor(i * 10.0); float u = fract(i * 10.0);
    float a0 = 1.5708 + seg * 0.6283; float a1 = a0 + 0.6283;
    float r0 = mod(seg, 2.0) < 0.5 ? 1.0 : 0.45; float r1 = mod(seg, 2.0) < 0.5 ? 0.45 : 1.0;
    vec2 q = mix(vec2(cos(a0), sin(a0)) * r0, vec2(cos(a1), sin(a1)) * r1, u);
    float R = 7.0 + 5.0 * (1.0 - exp(-max(age, 0.0) * 1.5));
    p = uZipA + vec3(q * R, 0.0);
    p.y -= 0.6 * max(age, 0.0);
    alpha = age < 0.0 ? 0.0 : (1.0 - smoothstep(1.4, 2.8, age)) * (0.55 + 0.45 * sin(uT * 18.0 + i * 40.0));
    vShape = cls > 2.5 ? 1.0 : 0.0;
    size = cls > 2.5 ? 6.0 * exp(-max(age, 0.0) * 1.2) : 1.0;
    vRot = cls > 2.5 ? age * 1.5 : 0.0;
    if (cls > 2.5) p = uZipA;
    if (cls > 2.5) alpha = age < 0.0 ? 0.0 : 1.0 - smoothstep(1.0, 2.6, age);
  }
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * size / -mv.z, 1.5, 160.0);
}`;

export function createUfo(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const ufo = new THREE.Group();
  root.add(ufo);
  const toon = makeToon(buildBody(), H_LOCAL * OUTLINE.secret);
  toon.uniforms.uLights.value = LIGHTS;
  ufo.add(toon.outline, toon.body);

  const domeGeo = new THREE.SphereGeometry(3.3, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeo.scale(1, 0.98, 1);
  domeGeo.translate(0, 1.3, 0);
  const domeU = {
    uGlass: { value: raw(PAL.mint[300]) }, uGlassHi: { value: raw(PAL.mint[100]) },
    uInk: { value: raw(PAL.night[100]) }, uHi: { value: raw(PAL.cream[100]) }, uPulse: { value: 0 },
  };
  const dome = new THREE.Mesh(domeGeo, new THREE.ShaderMaterial({
    vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, uniforms: domeU, fog: false,
    transparent: true, premultipliedAlpha: true, depthWrite: false,
  }));
  dome.frustumCulled = false;
  dome.renderOrder = 4;
  ufo.add(dome);

  const beamU = {
    uTime: { value: 0 }, uI: { value: 0 }, uPulse: { value: 0 },
    uCore: { value: raw(PAL.mint[100]) }, uHaze: { value: raw(PAL.mint[500]) }, uRing: { value: raw(PAL.honey[300]) },
  };
  const coneA = new THREE.CylinderGeometry(1.2, 4.2, 1, 32, 1, true);
  const coneB = new THREE.CylinderGeometry(2.6, 11.5, 1, 40, 1, true);
  const beamGeo = new THREE.BufferGeometry();
  {
    const merged = [coneA, coneB].map((g, li) => {
      const h = g.toNonIndexed();
      const n = h.getAttribute('position').count;
      h.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(n).fill(li), 1));
      return h;
    });
    const cat = (name: string, size: number) => {
      const arrs = merged.map((m) => m.getAttribute(name).array as Float32Array);
      const out = new Float32Array(arrs.reduce((a, x) => a + x.length, 0));
      let o = 0;
      for (const x of arrs) { out.set(x, o); o += x.length; }
      beamGeo.setAttribute(name, new THREE.BufferAttribute(out, size));
    };
    cat('position', 3); cat('normal', 3); cat('uv', 2); cat('aLayer', 1);
    beamGeo.translate(0, -0.5, 0);
    merged.forEach((m) => m.dispose());
    coneA.dispose(); coneB.dispose();
  }
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: beamU, fog: false,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  beam.frustumCulled = false;
  beam.renderOrder = 6;
  root.add(beam);

  const poolGeo = new THREE.PlaneGeometry(27, 27);
  poolGeo.rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(poolGeo, new THREE.ShaderMaterial({
    vertexShader: POOL_VERT, fragmentShader: POOL_FRAG, uniforms: beamU, fog: false,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
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
  const cols = [PAL.berry[500], PAL.honey[500], PAL.soda[500], PAL.mint[300], PAL.berry[300], PAL.grape[300]].map((h) => raw(h));
  const N_BEAM = 120, N_ZIP = 90, N_RING = 70;
  const pts = makePoints(N_BEAM + N_ZIP + N_RING + 1, PTS_VERT, ptsU, (i, s, c) => {
    const cls = i < N_BEAM ? 0 : i < N_BEAM + N_ZIP ? 1 : i < N_BEAM + N_ZIP + N_RING ? 2 : 3;
    s.set([cls === 2 ? (i - N_BEAM - N_ZIP) / N_RING : rnd(), rnd(), rnd(), cls + rnd() * 0.9], i * 4);
    let col = cols[Math.floor(rnd() * cols.length)]!;
    if (cls === 2 || cls === 3) col = raw(i % 3 ? PAL.honey[500] : PAL.mint[300]);
    if (cls === 3) col = raw(PAL.honey[300]);
    c.set([col.r, col.g, col.b], i * 3);
  }, { additive: false, frag: SHAPE_FRAG });
  (pts.material as THREE.ShaderMaterial).premultipliedAlpha = true;
  pts.renderOrder = 7;
  root.add(pts);

  const halo = createSecretHalo();
  halo.group.renderOrder = 8;
  root.add(halo.group);

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
    stop() { root.visible = false; halo.group.visible = false; },
    update(t: number, f: FrameState) {
      const pulse = f.beatPulse;
      const u = toon.uniforms;
      u.uTime.value = t; u.uPulse.value = pulse; u.uViewH.value = pxScale();
      setChase(u, Math.max(f.hype, 0.85));
      // chớp mắt mỗi ~3,5 s (0,14 s)
      const bl = (t + 0.7) % 3.4;
      u.uBlink.value = bl < 0.14 ? Math.abs(bl / 0.07 - 1) : 1;
      // vẫy tay "xin chào" khi tới + thỉnh thoảng trong lúc lơ lửng
      const waving = smooth(T_HOVER - 1.5, T_HOVER - 0.8, t) * (1 - smooth(T_BEAM_ON + 1.5, T_BEAM_ON + 2.2, t))
        + smooth(T_BEAM_OFF - 0.5, T_BEAM_OFF, t) * (1 - smooth(T_ZIP - 0.3, T_ZIP, t));
      u.uWave.value = -0.2 + waving * (0.5 + 0.5 * Math.sin(t * 11)) * 0.9 + (1 - waving) * 0.15 * Math.sin(t * 3);
      u.uSpin.value = t * 2.6;
      domeU.uPulse.value = pulse;
      beamU.uTime.value = t; beamU.uPulse.value = pulse;
      ptsU.uT.value = t; ptsU.uPx.value = pxScale();

      if (t < T_ZIP) ufoPos(t, pos);
      else {
        ufoPos(T_ZIP, zipA);
        const k = Math.min(1, (t - T_ZIP) / ZIP_DUR);
        pos.lerpVectors(zipA, AWAY, k * k);
      }
      ufo.position.copy(pos);
      ufo.visible = t < T_ZIP + ZIP_DUR; // tắt chỉ khi đã ra tới AWAY (ngoài khung nhìn)
      // quay mặt phi công về phía sân khấu (≈ +z), lắc nhẹ
      ufo.rotation.order = 'YXZ';
      ufo.rotation.y = Math.atan2(-pos.x, -pos.z) + Math.sin(t * 0.6) * 0.35;
      // nghiêng "xin chào" khi vừa tới: dao động tắt dần
      const hello = t > T_HOVER - 0.6 ? Math.exp(-(t - T_HOVER + 0.6) * 1.6) * Math.sin((t - T_HOVER + 0.6) * 7) * 0.32 : 0;
      const approach = (1 - smooth(0, T_HOVER, t)) * Math.sin(t * 2.1) * 0.18;
      const sweep = Math.sin((f.beat * Math.PI) / 4) * 0.55;
      const beamI = smooth(T_BEAM_ON, T_BEAM_ON + 0.7, t) * (1 - smooth(T_BEAM_OFF, T_BEAM_OFF + 0.6, t));
      ufo.rotation.z = hello + approach + Math.sin(t * 1.7) * 0.04 + sweep * 0.12 * beamI;
      ufo.rotation.x = Math.sin(t * 1.3) * 0.05 - smooth(T_TILT, T_ZIP, t) * 0.18;
      // pop khi xuất hiện + nhún theo phách; co trước khi vụt, kéo giãn khi vụt
      let sx = 1, sy = 1;
      const bob = 0.03 * pulse;
      sx += bob; sy -= bob * 0.6;
      const crouch = smooth(T_TILT + 0.2, T_ZIP, t) * (t < T_ZIP ? 1 : 0);
      sx *= 1 + 0.16 * crouch; sy *= 1 - 0.22 * crouch;
      if (t >= T_ZIP) { const k = smooth(T_ZIP, T_ZIP + 0.25, t); sx *= 1 - 0.3 * k; sy *= 1 + 0.12 * k; }
      const pop = popScale(t);
      ufo.scale.set(S * sx * pop * (t >= T_ZIP ? 1 + 0.6 * smooth(T_ZIP, T_ZIP + 0.3, t) : 1), S * sy * pop, S * sx * pop);

      beamU.uI.value = beamI;
      beam.visible = pool.visible = beamI > 0.001;
      beam.position.copy(pos).y -= 1.3 * S;
      beam.rotation.z = sweep;
      const gy = groundY(pos.z) + 1.4;
      const h = (beam.position.y - gy) / Math.cos(sweep);
      beam.scale.set(1, h, 1);
      pool.position.set(beam.position.x + Math.sin(sweep) * h, gy + 0.05, pos.z);
      ptsU.uBeam.value = beamI;
      ptsU.uUfo.value.copy(pos);
      ptsU.uPool.value.copy(pool.position);
      ptsU.uZipA.value.copy(t < T_ZIP ? ufoPos(T_ZIP, zipA) : zipA);

      halo.group.position.copy(pos).y += 1.0 * S;
      const appear = Math.min(1, t / 0.6) * (1 - smooth(T_ZIP - 0.2, T_ZIP + 0.3, t));
      halo.update(t, R_LOCAL * S * 1.02, appear);
    },
    dispose() { halo.dispose(); disposeTree(root); },
  };
}
