// Tên lửa: phóng từ RẤT XA ngoài sân vận động (~290 m, sau sân khấu: chớp lửa + cột khói ở chân trời), bay vòng cung
// cao qua khán đài về tâm sân, nổ thành màn pháo hoa nhiều tầng phía trên giữa sân (~(0, 40–60, -44…-12)).
// giàn phóng (1 mesh) + tên lửa (1 mesh), khói (1 Points thường),
// lửa/vệt + pháo hoa nhiều tầng + kim tuyến (1 Points cộng sáng). = 4 draw call. Quỹ đạo Bézier tính cả ở CPU lẫn shader.
import { SKY_SHOW_CENTRE } from '../../world/layout';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { PALETTE, type SecretAct, disposeTree, makePoints, pxScale, seededRnd, smooth } from './secretShared';

const D = 22;
const T_IGN = 2.5, T_BURST = 10.0;
const PAD = new THREE.Vector3(-110, 0, 230);
const CTRL = new THREE.Vector3(-60, 135, 80);
/** Điểm nổ chính = tâm màn pháo hoa. */
export const ROCKET_BURST = new THREE.Vector3(SKY_SHOW_CENTRE.x, SKY_SHOW_CENTRE.y, SKY_SHOW_CENTRE.z);
const TOP = ROCKET_BURST;
const SHELLS: [number, number, number, number][] = [
  [TOP.x, TOP.y, TOP.z, T_BURST],
  [-26, 44, -18, T_BURST + 0.8],
  [24, 58, -40, T_BURST + 1.5],
  [-4, 40, -12, T_BURST + 2.2],
  [28, 42, -16, T_BURST + 2.9],
  [-20, 60, -44, T_BURST + 3.5],
];
const SHELL_COL = [0xffd93d, 0xff3d81, 0x35d0ff, 0x7cff6b, 0xb06bff, 0xff8a3d];

const BEZ = /* glsl */ `
uniform vec3 uP0; uniform vec3 uC; uniform vec3 uP1;
float sOf(float t) { float u = clamp((t - ${T_IGN.toFixed(2)}) / ${(T_BURST - T_IGN).toFixed(2)}, 0.0, 1.0); return u * u; }
vec3 bez(float s) { float m = 1.0 - s; return m * m * uP0 + 2.0 * m * s * uC + s * s * uP1; }
vec3 bezT(float s) { return normalize(2.0 * (1.0 - s) * (uC - uP0) + 2.0 * s * (uP1 - uC)); }
`;

const SMOKE_VERT = /* glsl */ `
uniform float uT; uniform float uPx;
${BEZ}
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
void main() {
  // aSeed.w < 0.2: hơi nước trước khi phóng; còn lại: khói theo đường bay
  float te = aSeed.w < 0.2 ? aSeed.x * ${T_IGN.toFixed(2)} : ${T_IGN.toFixed(2)} - 0.2 + aSeed.x * ${(T_BURST - T_IGN + 0.2).toFixed(2)};
  float age = uT - te;
  float life = aSeed.w < 0.2 ? 6.0 + aSeed.y * 4.0 : 7.0 + aSeed.y * 4.0;
  vec3 dir = normalize(vec3(cos(aSeed.y * 40.0), 0.35 + aSeed.z, sin(aSeed.y * 40.0)));
  vec3 base = bez(sOf(te));
  float spread = aSeed.w < 0.2 ? 6.0 : (te < ${(T_IGN + 0.8).toFixed(2)} ? 22.0 : 3.5);
  vec3 p = base + dir * spread * (1.0 - exp(-age * 1.2)) + vec3(0.6, aSeed.w < 0.2 ? 5.0 : 0.5, 0.0) * age;
  vAlpha = (age < 0.0 || age > life) ? 0.0 : smoothstep(0.0, 0.3, age) * (1.0 - smoothstep(life * 0.4, life, age)) * 0.55;
  float glow = exp(-age * 1.8) * step(0.2, aSeed.w);
  vColor = mix(vec3(0.32, 0.31, 0.36), vec3(1.0, 0.55, 0.2), glow);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * (3.0 + age * 1.6) / -mv.z, 2.0, 160.0);
}`;
const SMOKE_FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main() {
  if (vAlpha < 0.004) discard;
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.2, r);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

const SPARK_VERT = /* glsl */ `
uniform float uT; uniform float uPx;
uniform vec4 uShell[6];
${BEZ}
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
void main() {
  float cls = floor(aSeed.w);
  int si = int(fract(aSeed.w) * 10.0 + 0.5);
  vec3 p = vec3(0.0); float alpha = 0.0; float size = 0.6;
  vColor = aColor;
  float zr = aSeed.x * 2.0 - 1.0; float ph = aSeed.y * 6.2832;
  vec3 dir = vec3(sqrt(1.0 - zr * zr) * cos(ph), zr, sqrt(1.0 - zr * zr) * sin(ph));
  if (cls < 0.5) {
    // lửa + vệt sáng sau đuôi
    float te = ${T_IGN.toFixed(2)} + aSeed.z * ${(T_BURST - T_IGN).toFixed(2)};
    float age = uT - te;
    float life = 0.5 + aSeed.x * 0.9;
    float s = sOf(te);
    p = bez(s) - bezT(s) * (age * 14.0 + 3.0) + dir * age * 3.0;
    float k = age / life;
    vColor = mix(mix(vec3(1.0, 0.95, 0.75), vec3(1.0, 0.55, 0.12), smoothstep(0.0, 0.4, k)), vec3(0.7, 0.12, 0.05), smoothstep(0.4, 1.0, k));
    alpha = (age < 0.0 || k > 1.0) ? 0.0 : 1.0 - k * 0.8;
    size = mix(7.0, 2.0, k);
  } else if (cls < 1.5) {
    // chớp lửa khi đánh lửa
    float age = uT - ${T_IGN.toFixed(2)};
    p = uP0 + dir * vec3(26.0, 14.0, 26.0) * (1.0 - exp(-age * 3.0)) + vec3(0.0, 8.0 + age * 6.0, 0.0);
    alpha = age < 0.0 ? 0.0 : exp(-age * 1.2);
    size = 12.0 + aSeed.z * 14.0;
    vColor = vec3(1.0, 0.75, 0.4);
  } else {
    vec4 sh = uShell[si];
    float age = uT - sh.w;
    if (cls < 3.5) {
      // hoa cúc (cls 3 = bóng mờ trễ 0.12 s tạo vệt)
      float ag = cls > 2.5 ? age - 0.12 : age;
      float R = 19.0 + aSeed.z * 2.0;
      p = sh.xyz + dir * R * (1.0 - exp(-ag * 2.6));
      p.y -= 0.9 * ag * ag;
      alpha = ag < 0.0 ? 0.0 : (1.0 - smoothstep(1.6, 3.0, ag));
      alpha *= ag > 1.4 ? 0.55 + 0.45 * sin(ag * 38.0 + aSeed.z * 60.0) : 1.0;
      alpha *= cls > 2.5 ? 0.45 : 1.0;
      size = (cls > 2.5 ? 1.0 : 1.6) * (1.0 + 0.6 * exp(-ag * 5.0));
      vColor = mix(vec3(1.0), aColor, smoothstep(0.0, 0.35, ag));
    } else if (cls < 4.5) {
      // kim tuyến rơi lấp lánh
      p = sh.xyz + dir * 12.0 * (1.0 - exp(-age * 2.0));
      p.y -= 1.6 * max(age - 0.6, 0.0);
      p.x += sin(age * 2.0 + aSeed.z * 20.0) * 0.6;
      alpha = (age < 0.6 ? 0.0 : 1.0 - smoothstep(4.0, 6.0, age)) * step(0.45, fract(uT * 7.0 + aSeed.z * 13.0));
      size = 0.8;
      vColor = vec3(1.0, 0.85, 0.5);
    } else {
      // quầng sáng bầu trời
      p = sh.xyz;
      alpha = age < 0.0 ? 0.0 : 0.22 * exp(-age * 1.3);
      size = 50.0;
    }
  }
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * size / -mv.z, 1.5, 400.0);
}`;

function colored(parts: THREE.BufferGeometry[], g: THREE.BufferGeometry, hex: number) {
  const h = g.index ? g.toNonIndexed() : g;
  h.deleteAttribute('uv');
  const n = h.getAttribute('normal');
  const c = new THREE.Color(hex);
  const arr = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const s = 0.55 + 0.45 * Math.max(0, n.getX(i) * 0.5 + n.getY(i) * 0.6 + n.getZ(i) * 0.6);
    arr.set([c.r * s, c.g * s, c.b * s], i * 3);
  }
  h.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  parts.push(h);
}
const merge = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
};

function buildRocket(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const cyl = (rt: number, rb: number, h: number, y: number, col: number) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 20);
    g.translate(0, y + h / 2, 0);
    colored(p, g, col);
  };
  cyl(0.7, 0.95, 0.9, 0, 0x2a2a33); // vòi phun
  cyl(1.0, 1.0, 4.2, 0.9, 0xf2f2f5);
  cyl(1.01, 1.01, 0.6, 5.1, 0xe0203a);
  cyl(0.85, 1.0, 3.2, 5.7, 0xf2f2f5);
  cyl(0.86, 0.86, 0.35, 7.4, 0x2a6cff);
  cyl(0.02, 0.85, 3.0, 8.9, 0xe0203a); // mũi
  for (let i = 0; i < 4; i++) {
    const f = new THREE.BoxGeometry(0.12, 2.0, 1.4);
    f.translate(0, 1.6, 1.4);
    f.rotateY((i * Math.PI) / 2 + Math.PI / 4);
    colored(p, f, 0xe0203a);
  }
  // cửa sổ sáng
  const w = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12);
  w.rotateX(Math.PI / 2);
  w.translate(0, 6.6, 0.88);
  colored(p, w, 0x9ff6ff);
  return merge(p);
}

function buildGantry(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, col: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    colored(p, g, col);
  };
  box(9, 0.8, 9, 0, -0.4, 0, 0x3a3a48); // bệ
  const gx = -3.2;
  const H = 15;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.2, H, 0.2, gx + dx * 0.9, H / 2, dz * 0.9, 0xff8a1d);
  for (let y = 1; y < H; y += 1.5) {
    box(2, 0.12, 0.12, gx, y, 0.9, 0xff8a1d);
    box(2, 0.12, 0.12, gx, y, -0.9, 0xff8a1d);
    box(0.12, 0.12, 2, gx - 0.9, y, 0, 0xff8a1d);
  }
  box(2.4, 0.3, 0.6, gx + 1.7, 11, 0, 0xff8a1d); // tay đỡ
  box(2.4, 0.3, 0.6, gx + 1.7, 6, 0, 0xff8a1d);
  // đèn đỏ trên đỉnh + đèn vàng
  box(0.5, 0.5, 0.5, gx, H + 0.3, 0, 0xff2020);
  for (let y = 3; y < H; y += 4) box(0.3, 0.3, 0.3, gx + 1, y, 1, 0xffe080);
  // đèn bệ
  for (const [x, z] of [[-4, 4], [4, 4], [-4, -4], [4, -4]]) box(0.4, 0.4, 0.4, x, 0.2, z, 0x7cf0ff);
  return merge(p);
}

export function createRocket(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const basic = () => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const gantry = new THREE.Mesh(buildGantry(), basic());
  root.add(gantry);
  const rocket = new THREE.Mesh(buildRocket(), basic());
  root.add(rocket);
  gantry.scale.setScalar(2.4);
  rocket.scale.setScalar(3.6);

  const bez = { uP0: { value: PAD.clone() }, uC: { value: CTRL.clone() }, uP1: { value: TOP.clone() } };
  const smokeU = { uT: { value: 0 }, uPx: { value: 600 }, ...bez };
  const rnd = seededRnd(4242);
  const smoke = makePoints(700, SMOKE_VERT, smokeU, (i, s) => {
    s.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }, { additive: false, frag: SMOKE_FRAG });
  smoke.renderOrder = 6;
  root.add(smoke);

  const shellU = SHELLS.map(([x, y, z, t]) => new THREE.Vector4(x, y, z, t));
  const sparkU = { uT: { value: 0 }, uPx: { value: 600 }, uShell: { value: shellU }, ...bez };
  // phân bổ: lửa 900, chớp 40, hoa cúc 6×300, bóng 6×150, kim tuyến 6×90, quầng 6
  const plan: [number, number][] = [[0, 900], [1, 40]];
  for (let s = 0; s < 6; s++) plan.push([2 + s / 10, 300], [3 + s / 10, 150], [4 + s / 10, 90], [5 + s / 10, 1]);
  const total = plan.reduce((a, [, n]) => a + n, 0);
  const cls = new Float32Array(total);
  let k = 0;
  for (const [c, n] of plan) for (let j = 0; j < n; j++) cls[k++] = c;
  const tmp = new THREE.Color();
  const sparks = makePoints(total, SPARK_VERT, sparkU, (i, s, c) => {
    const w = cls[i]!;
    s.set([rnd(), rnd(), rnd(), w], i * 4);
    const si = Math.round((w % 1) * 10);
    tmp.setHex(SHELL_COL[si]!);
    if (rnd() < 0.25) tmp.copy(PALETTE[(si + 2) % PALETTE.length]!);
    c.set([tmp.r, tmp.g, tmp.b], i * 3);
  });
  sparks.renderOrder = 7;
  root.add(sparks);

  const q = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const bezAt = (s: number) => {
    const m = 1 - s;
    q.set(0, 0, 0).addScaledVector(PAD, m * m).addScaledVector(CTRL, 2 * m * s).addScaledVector(TOP, s * s);
    tan.copy(CTRL).sub(PAD).multiplyScalar(2 * m).addScaledVector(TOP.clone().sub(CTRL), 2 * s).normalize();
  };

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      smokeU.uT.value = sparkU.uT.value = t;
      smokeU.uPx.value = sparkU.uPx.value = pxScale();
      // giàn phóng nhô lên từ dưới đất lúc đầu, hạ xuống lúc cuối
      const rise = smooth(0, 1.6, t) * (1 - smooth(D - 2.5, D - 0.5, t));
      const sink = (1 - rise) * 18;
      gantry.position.set(PAD.x, PAD.y - sink, PAD.z);
      const u = Math.min(1, Math.max(0, (t - T_IGN) / (T_BURST - T_IGN)));
      bezAt(u * u);
      rocket.position.copy(q);
      if (t < T_IGN) rocket.position.y -= sink;
      rocket.quaternion.setFromUnitVectors(up, tan);
      // rung nhẹ trước khi rời bệ
      if (t > T_IGN - 0.6 && t < T_IGN + 1) rocket.position.x += Math.sin(t * 60) * 0.05;
      rocket.visible = t < T_BURST;
      void f;
    },
    focus(t: number, out: THREE.Vector3) {
      if (t >= T_BURST - 0.5) { out.copy(ROCKET_BURST); return; }
      const u = Math.min(1, Math.max(0, (t - T_IGN) / (T_BURST - T_IGN)));
      bezAt(u * u);
      out.copy(q).lerp(ROCKET_BURST, 0.35);
    },
    dispose() { disposeTree(root); },
  };
}
