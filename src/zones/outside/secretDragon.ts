// Rồng phương Đông: thân 56 đốt (InstancedBufferGeometry) + đầu (1 mesh) bám theo đường cong (DataTexture,
// tham số hoá theo độ dài), sóng lượn truyền dọc thân — toàn bộ trong vertex shader, CPU chỉ đặt uniform.
// Hạt: vệt tia lửa sau thân + hơi thở "lửa" lấp lánh (1 Points). = 3 draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { type SecretAct, disposeTree, makePoints, pxScale, seededRnd } from './secretShared';

const D = 24;
const NSEG = 56;
const S = 0.95; // khoảng cách đốt (m)
const NS = 512; // số mẫu đường bay
const BREATH_DUR = 2.0;

const PATH_PTS: [number, number, number][] = [
  [80, 22, -46], [55, 19, -46], [36, 15, -38], [8, 14, -32], [-20, 15, -36], [-40, 20, -52],
  [-32, 22, -76], [-10, 20, -70],
  // vòng quanh B-stage
  [8, 19, -62], [15, 18, -48], [9, 17, -37], [-3, 17, -34], [-13, 18, -42], [-14, 19, -54], [-4, 20, -62], [10, 21, -64],
  // xoắn lên và bay mất
  [20, 25, -76], [6, 31, -92], [-16, 37, -88], [-22, 45, -72], [-8, 58, -64], [8, 78, -70], [4, 115, -80],
];
const BREATH_AT = new THREE.Vector3(-4, 20, -62);

const COMMON = /* glsl */ `
uniform sampler2D uPath;
uniform float uLen;
uniform float uSpeed;
uniform float uT;
vec3 pathAt(float d) {
  float x = clamp(d / uLen, 0.0, 1.0) * ${(NS - 1).toFixed(1)};
  int a = int(floor(x));
  int b = min(a + 1, ${NS - 1});
  return mix(texelFetch(uPath, ivec2(a, 0), 0).xyz, texelFetch(uPath, ivec2(b, 0), 0).xyz, fract(x));
}
vec3 bodyPos(float i, float t) {
  float d = uSpeed * t - i * ${S.toFixed(3)};
  vec3 p = pathAt(d);
  vec3 T = normalize(pathAt(d + 1.0) - pathAt(d - 1.0) + vec3(1e-4, 0.0, 0.0));
  vec3 sd = normalize(cross(vec3(0.0, 1.0, 0.0), T) + vec3(0.0, 0.0, 1e-4));
  vec3 up = cross(T, sd);
  float env = 0.2 + 0.8 * smoothstep(0.0, 12.0, i);
  float ph = i * 0.36 - t * 4.2;
  return p + sd * sin(ph) * 1.8 * env + up * cos(ph * 0.7 + 1.0) * 1.0 * env;
}
void frameAt(float i, float t, out vec3 P, out vec3 T, out vec3 sd, out vec3 up) {
  P = bodyPos(i, t);
  T = normalize(bodyPos(i - 0.5, t) - bodyPos(i + 0.5, t) + vec3(1e-4, 0.0, 0.0));
  sd = normalize(cross(vec3(0.0, 1.0, 0.0), T) + vec3(0.0, 0.0, 1e-4));
  up = cross(T, sd);
}
`;

const BODY_VERT = /* glsl */ `
${COMMON}
attribute float aPart;
#ifdef BODY
attribute float aI;
#endif
varying vec3 vN;
varying vec3 vW;
varying vec3 vLoc;
varying float vPart;
varying float vI;
void main() {
  vec3 l = position;
  vec3 n = normal;
#ifdef BODY
  float i = aI + 1.25;
  float r = 1.45 * mix(0.95, 1.25, smoothstep(1.6, 7.0, i)) * (1.0 - 0.82 * smoothstep(10.0, ${(NSEG + 1.6).toFixed(1)}, i));
  bool leg = abs(aI - 6.0) < 0.5 || abs(aI - 27.0) < 0.5;
  if ((aPart > 2.5 && aPart < 3.5) || aPart > 6.5) { if (!leg) l *= 0.0; }
  float fin = aPart > 3.5 && aPart < 4.5 ? (aI > ${NSEG - 7}.0 ? 2.4 : 1.0) : 1.0;
  l.xy *= r * fin;
  if (fin > 1.5) l.z *= 2.0;
  vI = aI;
#else
  float i = 0.0;
  if (aPart > 4.5 && aPart < 5.5) l.y += sin(uT * 5.0 + l.z * 1.3) * 0.22 * clamp(3.0 - l.z, 0.0, 4.0);
  if (aPart > 3.5 && aPart < 4.5) l.x += sin(uT * 6.0 + l.z * 2.0) * 0.12 * max(-l.z, 0.0);
  vI = -1.0;
#endif
  vec3 P, T, sd, up;
  frameAt(i, uT, P, T, sd, up);
  vec3 w = P + sd * l.x + up * l.y + T * l.z;
  vN = normalize(sd * n.x + up * n.y + T * n.z);
  vW = w;
  vLoc = l;
  vPart = aPart;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const BODY_FRAG = /* glsl */ `
uniform float uT;
uniform float uPal;
uniform float uPulse;
uniform float uBreath;
varying vec3 vN;
varying vec3 vW;
varying vec3 vLoc;
varying float vPart;
varying float vI;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float diff = max(dot(n, normalize(vec3(0.3, 0.85, 0.4))), 0.0);
  float rim = pow(1.0 - abs(dot(n, v)), 2.0);
  vec3 base = mix(vec3(0.82, 0.08, 0.05), vec3(0.03, 0.55, 0.45), uPal);
  vec3 edge = mix(vec3(1.0, 0.78, 0.22), vec3(0.55, 1.0, 0.9), uPal);
  vec3 belly = mix(vec3(1.0, 0.86, 0.48), vec3(0.85, 1.0, 0.82), uPal);
  vec3 flame = mix(vec3(1.0, 0.55, 0.1), vec3(0.4, 0.95, 1.0), uPal);
  vec3 c;
  float p = vPart;
  if (p < 0.5 || (p > 6.5)) {
    // vảy: ô bán nguyệt so le theo chiều dài + chu vi
    float ang = atan(vLoc.y, vLoc.x) / 3.1416 * 4.0;
    vec2 g = vec2(ang, (vI + vLoc.z / ${S.toFixed(3)}) * 1.6);
    g.y += 0.5 * mod(floor(g.x), 2.0);
    vec2 f = fract(g) - vec2(0.5, 0.0);
    float sc = smoothstep(0.42, 0.62, length(f * vec2(1.0, 1.2)));
    float isBelly = smoothstep(-0.2, -0.6, n.y * 0.5 + normalize(vLoc + 1e-4).y * 0.5);
    c = mix(base, edge, sc * 0.6) * (0.5 + 0.6 * diff);
    c = mix(c, belly * (0.7 + 0.3 * diff), isBelly * step(vI, 1e3) * step(-0.5, vI));
    float wave = 0.5 + 0.5 * sin(vI * 0.5 - uT * 7.0);
    c += edge * sc * (0.08 + 0.35 * wave * (0.6 + 0.6 * uPulse));
  } else if (p < 1.5) {
    c = belly * (0.6 + 0.5 * diff);
  } else if (p < 2.5) {
    c = mix(vec3(1.0, 0.95, 0.4), vec3(1.0, 0.25, 0.2), uPal) * 1.6; // mắt
  } else if (p < 3.5) {
    c = vec3(0.95, 0.9, 0.78) * (0.6 + 0.5 * diff); // sừng / móng
  } else if (p < 4.5) {
    c = flame * (0.8 + 0.4 * sin(uT * 8.0 + vLoc.z * 3.0 + vI * 0.4)); // bờm / vây
  } else if (p < 5.5) {
    c = edge * 1.1; // râu
  } else {
    c = mix(vec3(0.4, 0.05, 0.05), flame * 1.5, uBreath); // miệng
  }
  c += mix(edge, flame, 0.5) * rim * 0.55;
  gl_FragColor = vec4(c, 1.0);
}`;

const PTS_VERT = /* glsl */ `
${COMMON}
uniform float uPx;
uniform float uBreathT;
uniform float uPal;
attribute vec4 aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p; float alpha; float size;
  vec3 rd = normalize(aSeed.xyz - 0.5 + 1e-4);
  if (aSeed.w < 0.62) {
    // tia lửa rơi từ thân
    float te = aSeed.w / 0.62 * ${D.toFixed(1)};
    float age = uT - te;
    float life = 1.0 + aSeed.x * 1.4;
    p = bodyPos(aSeed.y * ${NSEG}.0 + 1.6, te) + rd * (0.9 + age * 1.2) - vec3(0.0, 0.9 * age * age, 0.0);
    alpha = (age < 0.0 || age > life) ? 0.0 : 1.0 - age / life;
    alpha *= 0.6 + 0.4 * step(0.5, fract(uT * 6.0 + aSeed.z * 9.0));
    size = 0.5 + 0.3 * aSeed.z;
    vColor = mix(mix(vec3(1.0, 0.8, 0.3), vec3(0.5, 1.0, 0.9), uPal), aColor, 0.25);
  } else {
    // hơi thở lửa lấp lánh (bắn tới trước + chếch lên, không nhắm vào khán giả)
    float te = uBreathT + (aSeed.w - 0.62) / 0.38 * ${BREATH_DUR.toFixed(1)};
    float age = uT - te;
    vec3 P, T, sd, up;
    frameAt(0.0, te, P, T, sd, up);
    vec3 mouth = P + T * 5.6 - up * 0.4;
    vec3 dir = normalize(T + vec3(0.0, 0.5, 0.0) + rd * 0.45);
    float sp = 18.0 + aSeed.z * 10.0;
    p = mouth + dir * sp * (1.0 - exp(-age * 1.4)) / 1.4 - vec3(0.0, 0.35 * age * age, 0.0);
    p += vec3(sin(age * 3.0 + aSeed.x * 20.0), 0.0, cos(age * 2.5 + aSeed.y * 20.0)) * 0.5 * age;
    float life = 2.2 + aSeed.x * 1.2;
    alpha = (age < 0.0 || age > life) ? 0.0 : (1.0 - smoothstep(life * 0.5, life, age));
    alpha *= 0.55 + 0.45 * sin(age * 25.0 + aSeed.y * 40.0);
    size = mix(1.3, 0.55, clamp(age, 0.0, 1.0));
    vColor = mix(vec3(1.0, 0.9, 0.6), aColor, smoothstep(0.0, 0.5, age));
  }
  vAlpha = alpha;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * size / -mv.z, 1.5, 80.0);
}`;

function tagged(parts: THREE.BufferGeometry[], g: THREE.BufferGeometry, part: number) {
  const h = g.index ? g.toNonIndexed() : g;
  h.deleteAttribute('uv');
  h.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(h.getAttribute('position').count).fill(part), 1));
  parts.push(h);
}
/** Nón hướng ra sau (-z), nghiêng lên một góc `lift`, xoay quanh trục z một góc `roll`, gốc ở `at`. */
function spike(r: number, len: number, lift: number, roll: number, at: [number, number, number], seg = 6) {
  const g = new THREE.ConeGeometry(r, len, seg);
  g.translate(0, len / 2, 0);
  g.rotateX(-(Math.PI / 2 - lift));
  g.rotateZ(roll);
  g.translate(...at);
  return g;
}
const mergeAll = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
};

function buildSegment(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(1, 16, 10);
  body.scale(1, 0.92, 0.8);
  tagged(p, body, 0);
  tagged(p, spike(0.28, 1.1, 0.75, 0, [0, 0.85, 0.1], 4), 4); // vây lưng
  for (const sx of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.16, 0.24, 1.5, 6);
    leg.translate(0, -0.75, 0);
    leg.rotateZ(sx * 0.7);
    leg.translate(sx * 0.6, -0.3, 0);
    tagged(p, leg, 7);
    for (let c = -1; c <= 1; c++) {
      const claw = new THREE.ConeGeometry(0.07, 0.45, 4);
      claw.rotateX(Math.PI / 2 + 0.6);
      claw.translate(sx * 1.6 + c * 0.12 * sx, -1.45, 0.15 + c * 0.05);
      tagged(p, claw, 3);
    }
  }
  return mergeAll(p);
}

function buildHead(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const skull = new THREE.SphereGeometry(1, 16, 12);
  skull.scale(1.05, 0.85, 1.35);
  skull.translate(0, 0.15, 0.3);
  tagged(p, skull, 0);
  const snout = new THREE.BoxGeometry(1.25, 0.6, 2.0, 2, 1, 2);
  snout.translate(0, 0.0, 2.0);
  tagged(p, snout, 0);
  const nose = new THREE.SphereGeometry(0.5, 10, 8);
  nose.scale(1.35, 0.7, 0.8);
  nose.translate(0, 0.15, 3.0);
  tagged(p, nose, 1);
  const mouth = new THREE.BoxGeometry(1.05, 0.25, 1.6);
  mouth.translate(0, -0.38, 2.0);
  tagged(p, mouth, 6);
  const jaw = new THREE.BoxGeometry(1.05, 0.25, 2.0);
  jaw.translate(0, 0, 1.0);
  jaw.rotateX(0.35);
  jaw.translate(0, -0.55, 1.0);
  tagged(p, jaw, 1);
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.24, 10, 8);
    eye.translate(sx * 0.62, 0.48, 1.05);
    tagged(p, eye, 2);
    const brow = spike(0.18, 0.9, 0.9, sx * 0.4, [sx * 0.55, 0.7, 1.3], 4);
    tagged(p, brow, 4);
    // sừng hươu: nhánh chính + nhánh phụ
    tagged(p, spike(0.16, 2.4, 0.65, sx * 0.4, [sx * 0.45, 0.7, 0.2]), 3);
    tagged(p, spike(0.09, 1.0, 1.2, sx * 0.7, [sx * 0.75, 1.35, -0.5]), 3);
    // râu dài
    const wh = new THREE.CylinderGeometry(0.03, 0.08, 4.0, 5);
    wh.translate(0, 2.0, 0);
    wh.rotateX(-(Math.PI / 2 - 0.05));
    wh.rotateY(sx * 0.45);
    wh.translate(sx * 0.6, -0.15, 2.8);
    tagged(p, wh, 5);
  }
  // bờm quanh gáy
  for (let k = 0; k < 11; k++) {
    const a = -2.3 + (k / 10) * 4.6;
    tagged(p, spike(0.25, 2.2 + (k % 2) * 0.6, 0.35, a, [Math.sin(a) * 0.7, Math.cos(a) * 0.65 + 0.1, -0.5]), 4);
  }
  const g = mergeAll(p);
  g.scale(1.75, 1.75, 1.75);
  return g;
}

export function createDragon(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const curve = new THREE.CatmullRomCurve3(PATH_PTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const samples = curve.getSpacedPoints(NS - 1);
  const data = new Float32Array(NS * 4);
  let bi = 0, bd = Infinity;
  samples.forEach((v, i) => {
    data.set([v.x, v.y, v.z, 1], i * 4);
    const d = v.distanceTo(BREATH_AT);
    if (d < bd) { bd = d; bi = i; }
  });
  const tex = new THREE.DataTexture(data, NS, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  const len = curve.getLength();
  const speed = len / (D - 0.5);
  const tBreath = ((bi / (NS - 1)) * len) / speed - 0.6;

  const U = {
    uPath: { value: tex }, uLen: { value: len }, uSpeed: { value: speed }, uT: { value: 0 },
    uPal: { value: 0 }, uPulse: { value: 0 }, uBreath: { value: 0 },
  };

  const segBase = buildSegment();
  const segGeo = new THREE.InstancedBufferGeometry();
  segGeo.index = segBase.index;
  for (const [k, a] of Object.entries(segBase.attributes)) segGeo.setAttribute(k, a);
  segGeo.setAttribute('aI', new THREE.InstancedBufferAttribute(new Float32Array(NSEG).map((_, i) => i), 1));
  segGeo.instanceCount = NSEG;
  const bodyMat = new THREE.ShaderMaterial({
    vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, uniforms: U, fog: false, defines: { BODY: 1 },
  });
  const body = new THREE.Mesh(segGeo, bodyMat);
  body.frustumCulled = false;
  root.add(body);

  const head = new THREE.Mesh(buildHead(), new THREE.ShaderMaterial({
    vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, uniforms: U, fog: false,
  }));
  head.frustumCulled = false;
  root.add(head);

  const ptsU = { ...U, uPx: { value: 600 }, uBreathT: { value: tBreath } };
  const rnd = seededRnd(9001);
  const fire = [0xff3d81, 0xffd93d, 0xff8a3d, 0xffffff, 0x35d0ff, 0xb06bff].map((c) => new THREE.Color(c));
  const pts = makePoints(3600, PTS_VERT, ptsU, (i, s, c) => {
    s.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    const col = fire[Math.floor(rnd() * fire.length)]!;
    c.set([col.r, col.g, col.b], i * 3);
  });
  pts.renderOrder = 7;
  root.add(pts);

  return {
    duration: D,
    start() {
      root.visible = true;
      U.uPal.value = Math.random() < 0.5 ? 0 : 1;
    },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      U.uT.value = t;
      U.uPulse.value = f.beatPulse;
      const b = t - tBreath;
      U.uBreath.value = b > 0 && b < BREATH_DUR + 0.5 ? 1 : 0;
      ptsU.uPx.value = pxScale();
    },
    dispose() {
      segBase.dispose();
      tex.dispose();
      disposeTree(root);
    },
  };
}
