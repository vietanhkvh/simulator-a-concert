// ★ Tên lửa chibi: phóng từ RẤT XA ngoài sân vận động (~290 m, sau sân khấu), bay vòng cung cao qua khán đài về tâm
// sân, xoay một vòng dễ thương rồi nổ thành pháo hoa chibi nhiều tầng (sao / tim / chấm tròn, chớp kem, kim tuyến).
// Thân kem mập 2,2 : 1, mũi + 3 vây mập hồng dâu, dải mật ong đinh tán sao, cửa sổ tròn có phi hành gia (chớp mắt,
// giơ ngón cái), lửa 3 lớp hình giọt viền sò, khói là cục bông tròn. Chữ ký secret (halo) khi bay.
// Draw call: giàn phóng + thân + viền ink + lửa + khói + pháo hoa/tia + halo = 7. Quỹ đạo Bézier tính cả ở CPU lẫn shader.
import { SKY_SHOW_CENTRE } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { PAL, SKIN, OUTLINE, popScale } from '../../world/style';
import { type SecretAct, disposeTree, makePoints, pxScale, seededRnd, smooth } from './secretShared';
import { PART, PartBuilder, SHAPE_FRAG, createSecretHalo, makeToon, raw, starGeo } from './secretHalo';

const D = 22;
const T_IGN = 2.5, T_BURST = 10.0, T_SPIN = 1.1;
const PAD = new THREE.Vector3(-110, 0, 230);
const CTRL = new THREE.Vector3(-60, 135, 80);
/** Điểm nổ chính = tâm màn pháo hoa. */
export const ROCKET_BURST = new THREE.Vector3(SKY_SHOW_CENTRE.x, SKY_SHOW_CENTRE.y, SKY_SHOW_CENTRE.z);
const TOP = ROCKET_BURST;
/** x, y, z, t nổ; kiểu: 0 cầu tròn, 1 trái tim. */
const SHELLS: [number, number, number, number, number][] = [
  [TOP.x, TOP.y, TOP.z, T_BURST, 0],
  [-26, 44, -18, T_BURST + 0.8, 1],
  [24, 58, -40, T_BURST + 1.5, 0],
  [-4, 40, -12, T_BURST + 2.2, 0],
  [28, 42, -16, T_BURST + 2.9, 1],
  [-20, 60, -44, T_BURST + 3.5, 0],
];
const SHELL_COL = [PAL.honey[500], PAL.berry[500], PAL.soda[500], PAL.mint[500], PAL.berry[300], PAL.honey[500]];
const SHELL_COL2 = [PAL.berry[300], PAL.honey[300], PAL.mint[300], PAL.honey[500], PAL.soda[300], PAL.soda[500]];
/** Tỉ lệ model: thân bán kính ~1,05 local ⇒ ~3,9 m; dài ~4,7 local ⇒ ~17 m. */
const S = 3.7;
const LEN_LOCAL = 4.7;

const BEZ = /* glsl */ `
uniform vec3 uP0; uniform vec3 uC; uniform vec3 uP1;
float sOf(float t) { float u = clamp((t - ${T_IGN.toFixed(2)}) / ${(T_BURST - T_IGN).toFixed(2)}, 0.0, 1.0); return u * u; }
vec3 bez(float s) { float m = 1.0 - s; return m * m * uP0 + 2.0 * m * s * uC + s * s * uP1; }
vec3 bezT(float s) { return normalize(2.0 * (1.0 - s) * (uC - uP0) + 2.0 * s * (uP1 - uC)); }
`;

// Khói: cục bông tròn billboard, pop to rồi teo dần (SHAPE_FRAG kiểu 4).
const SMOKE_VERT = /* glsl */ `
uniform float uT; uniform float uPx; uniform vec3 uWarm; uniform vec3 uCool;
${BEZ}
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot;
void main() {
  bool steam = aSeed.w < 0.2;
  float te = steam ? aSeed.x * ${T_IGN.toFixed(2)} : ${T_IGN.toFixed(2)} - 0.2 + aSeed.x * ${(T_BURST - T_IGN - 0.4).toFixed(2)};
  float age = uT - te;
  float life = steam ? 4.0 + aSeed.y * 3.0 : 3.5 + aSeed.y * 3.0;
  vec3 dir = normalize(vec3(cos(aSeed.y * 40.0), 0.3 + aSeed.z, sin(aSeed.y * 40.0)));
  float s = sOf(te);
  vec3 base = bez(s) - bezT(s) * 9.0;
  float spread = steam ? 9.0 : (te < ${(T_IGN + 0.8).toFixed(2)} ? 20.0 : 3.0);
  vec3 p = base + dir * spread * (1.0 - exp(-age * 1.4)) + vec3(0.5, steam ? 3.0 : 0.6, 0.0) * age;
  float k = age / life;
  // pop: 0 → 1,15 → 1 rồi teo
  float pop = age < 0.12 ? age / 0.12 * 1.15 : mix(1.15, 1.0, smoothstep(0.12, 0.3, age));
  float sz = (steam ? 7.0 : (te < ${(T_IGN + 0.8).toFixed(2)} ? 10.0 : 4.5)) * (0.7 + aSeed.z * 0.6) * pop * (1.0 - smoothstep(0.35, 1.0, k));
  vAlpha = (age < 0.0 || k > 1.0) ? 0.0 : 0.95;
  float warm = steam ? 0.0 : exp(-age * 2.2);
  vColor = mix(aColor, uWarm, warm);
  vShape = 4.0; vRot = 0.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * sz / -mv.z, 0.0, 220.0);
  if (gl_PointSize < 1.0) vAlpha = 0.0;
}`;

const SPARK_VERT = /* glsl */ `
uniform float uT; uniform float uPx;
uniform vec4 uShell[6];
uniform float uKind[6];
${BEZ}
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot;
void main() {
  float cls = floor(aSeed.w);
  int si = int(fract(aSeed.w) * 10.0 + 0.5);
  vec3 p = vec3(0.0); float alpha = 0.0; float size = 0.6;
  vColor = aColor; vShape = 0.0; vRot = 0.0;
  float zr = aSeed.x * 2.0 - 1.0; float ph = aSeed.y * 6.2832;
  vec3 dir = vec3(sqrt(1.0 - zr * zr) * cos(ph), zr, sqrt(1.0 - zr * zr) * sin(ph));
  if (cls < 0.5) {
    // tia sao nhỏ văng sau đuôi
    float te = ${T_IGN.toFixed(2)} + aSeed.z * ${(T_BURST - T_IGN).toFixed(2)};
    float age = uT - te;
    float life = 0.5 + aSeed.x * 0.6;
    float s = sOf(te);
    p = bez(s) - bezT(s) * (age * 10.0 + 12.0) + dir * age * 5.0;
    float k = age / life;
    alpha = (age < 0.0 || k > 1.0 || te > ${(T_BURST - 0.1).toFixed(2)}) ? 0.0 : 1.0 - k * 0.6;
    size = mix(2.2, 0.8, k);
    vShape = aSeed.z > 0.5 ? 1.0 : 3.0;
    vRot = age * 4.0;
  } else if (cls < 1.5) {
    // chớp lửa khi đánh lửa (ở bệ phóng rất xa)
    float age = uT - ${T_IGN.toFixed(2)};
    p = uP0 + dir * vec3(24.0, 12.0, 24.0) * (1.0 - exp(-age * 3.0)) + vec3(0.0, 8.0 + age * 5.0, 0.0);
    alpha = age < 0.0 ? 0.0 : exp(-age * 1.3);
    size = 10.0 + aSeed.z * 10.0;
  } else {
    vec4 sh = uShell[si];
    float kind = uKind[si];
    float age = uT - sh.w;
    if (kind > 0.5 && cls < 3.5) {
      // pháo hình trái tim: hướng theo đường cong tim trong mặt XY (nhìn được cả từ ca sĩ và từ camera toàn cảnh)
      float a = aSeed.y * 6.2832;
      vec2 h = vec2(16.0 * pow(sin(a), 3.0), 13.0 * cos(a) - 5.0 * cos(2.0 * a) - 2.0 * cos(3.0 * a) - cos(4.0 * a)) / 16.0;
      dir = vec3(h, (aSeed.x - 0.5) * 0.25);
    }
    if (cls < 3.5) {
      // vòng chính (cls 2) + vòng trong trễ 0,15 s (cls 3)
      bool inner = cls > 2.5;
      float ag = inner ? age - 0.15 : age;
      float R = (inner ? 9.0 : 17.0) + aSeed.z * 1.5;
      p = sh.xyz + dir * R * (1.0 - exp(-ag * 2.8));
      p.y -= 0.7 * ag * ag;
      alpha = ag < 0.0 ? 0.0 : (1.0 - smoothstep(1.8, 3.2, ag));
      alpha *= ag > 1.5 ? 0.6 + 0.4 * sin(ag * 30.0 + aSeed.z * 60.0) : 1.0;
      float r3 = fract(aSeed.z * 13.7);
      vShape = inner ? 0.0 : (r3 < 0.45 ? 1.0 : (r3 < 0.75 ? 2.0 : 0.0));
      size = (vShape > 0.5 ? 2.4 : 1.4) * (1.0 + 0.5 * exp(-ag * 5.0));
      if (inner) size = 1.3;
      vColor = mix(vec3(1.0, 0.98, 0.94), aColor, smoothstep(0.0, 0.3, ag));
      vRot = (aSeed.x - 0.5) * 1.2 + ag * (aSeed.y - 0.5) * 2.0;
    } else if (cls < 4.5) {
      // kim tuyến lấp lánh rơi chậm (crackle)
      p = sh.xyz + dir * 13.0 * (1.0 - exp(-age * 2.0));
      p.y -= 1.4 * max(age - 0.7, 0.0);
      p.x += sin(age * 2.0 + aSeed.z * 20.0) * 0.6;
      alpha = (age < 0.8 ? 0.0 : 1.0 - smoothstep(4.0, 6.5, age)) * step(0.4, fract(uT * 6.0 + aSeed.z * 13.0));
      size = 1.3;
      vShape = 3.0;
      vRot = 0.785 * step(0.5, aSeed.x);
    } else {
      // chớp kem lúc nổ
      p = sh.xyz;
      alpha = age < 0.0 ? 0.0 : exp(-age * 5.0);
      size = 22.0;
      vColor = vec3(1.0, 0.97, 0.9);
    }
  }
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * size / -mv.z, 1.5, 300.0);
}`;

// Lửa 3 lớp hình giọt mập, viền sò lay động (vẽ ngoài → trong trong cùng một draw call).
const FLAME_VERT = /* glsl */ `
attribute float aLayer;
uniform float uT; uniform float uI;
varying float vS; varying float vLayer;
void main() {
  vec3 p = position;
  float s = uv.y; // 0 = sát vòi, 1 = chóp
  float ang = atan(p.z, p.x);
  float fl = 1.0 + 0.16 * sin(ang * 7.0 + uT * 18.0 + aLayer * 2.0) * smoothstep(0.1, 0.6, s);
  p.xz *= fl * (0.9 + 0.1 * sin(uT * 37.0 + aLayer));
  float len = uI * (1.0 + 0.14 * sin(uT * 29.0 + aLayer * 1.7) + 0.08 * sin(uT * 47.0));
  p.y = -0.42 + (p.y + 0.42) * len;
  vS = s; vLayer = aLayer;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FLAME_FRAG = /* glsl */ `
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
varying float vS; varying float vLayer;
void main() {
  vec3 c = vLayer < 0.5 ? mix(uC2, uC3, smoothstep(0.3, 0.9, vS)) : (vLayer < 1.5 ? uC1 : uC0);
  gl_FragColor = vec4(c, 1.0);
}`;

function buildRocket(): THREE.BufferGeometry {
  const b = new PartBuilder();
  const V = (x: number, y: number) => new THREE.Vector2(x, y);
  // thân kem mập (lathe, đáy bo tròn)
  b.add(new THREE.LatheGeometry([V(0.5, -0.05), V(0.82, 0.08), V(0.98, 0.4), V(1.06, 1.0), V(1.07, 1.7), V(1.02, 2.4), V(0.93, 2.92)], 40), PAL.cream[500]);
  // mũi hồng dâu (gần bán cầu)
  b.add(new THREE.LatheGeometry([V(0.94, 2.9), V(0.88, 3.25), V(0.74, 3.6), V(0.52, 3.88), V(0.26, 4.04), V(0.01, 4.1)], 40), PAL.berry[500]);
  const tip = new THREE.SphereGeometry(0.13, 10, 8);
  tip.translate(0, 4.12, 0);
  b.add(tip, PAL.honey[500]);
  // 2 dải sơn: dải mật ong (đinh tán sao) + viền hồng ở cổ mũi
  const band = new THREE.TorusGeometry(1.06, 0.14, 10, 48);
  band.rotateX(Math.PI / 2);
  band.translate(0, 1.05, 0);
  b.add(band, PAL.honey[500]);
  const neck = new THREE.TorusGeometry(0.93, 0.08, 8, 40);
  neck.rotateX(Math.PI / 2);
  neck.translate(0, 2.92, 0);
  b.add(neck, PAL.berry[300]);
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const st = starGeo(0.11, 0.05);
    st.rotateY(Math.PI / 2 - a);
    st.translate(Math.cos(a) * 1.2, 1.05, Math.sin(a) * 1.2);
    b.add(st, PAL.cream[300]);
  }
  // 1 sao lớn bên hông (−x)
  const big = starGeo(0.34, 0.08);
  big.rotateY(-Math.PI / 2);
  big.translate(-1.06, 1.85, 0);
  b.add(big, PAL.honey[500]);
  // 3 vây mập bo tròn
  const fin = new THREE.Shape();
  fin.moveTo(0, 0.9);
  fin.quadraticCurveTo(0.35, 0.75, 0.62, 0.05);
  fin.quadraticCurveTo(0.8, -0.38, 0.5, -0.42);
  fin.quadraticCurveTo(0.2, -0.42, 0, -0.1);
  fin.lineTo(0, 0.9);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.ExtrudeGeometry(fin, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3, curveSegments: 8 });
    g.translate(0.82, 0.32, -0.08);
    g.rotateY((i / 3) * Math.PI * 2 + Math.PI / 2);
    b.add(g, PAL.berry[500]);
  }
  // vòi phun chuông
  b.add(new THREE.LatheGeometry([V(0.36, 0.0), V(0.4, -0.15), V(0.55, -0.38), V(0.6, -0.45), V(0.5, -0.45), V(0.3, -0.2)], 28), PAL.grape[300]);
  const glow = new THREE.CircleGeometry(0.46, 24);
  glow.rotateX(Math.PI / 2);
  glow.translate(0, -0.38, 0);
  b.add(glow, PAL.honey[300], PART.glow);
  // cửa sổ tròn (+z) + phi hành gia chibi
  const Y = 2.0;
  const frame = new THREE.TorusGeometry(0.44, 0.11, 10, 32);
  frame.translate(0, Y, 1.0);
  b.add(frame, PAL.grape[300]);
  const back = new THREE.CircleGeometry(0.42, 28);
  back.translate(0, Y, 0.99);
  b.add(back, PAL.night[300], PART.flat);
  const helmet = new THREE.SphereGeometry(0.33, 20, 14);
  helmet.scale(1, 1, 0.55);
  helmet.translate(0, Y - 0.04, 0.98);
  b.add(helmet, PAL.cream[300]);
  const face = new THREE.SphereGeometry(0.24, 20, 14);
  face.scale(1, 0.95, 0.5);
  face.translate(0, Y - 0.04, 1.08);
  b.add(face, SKIN[0]!);
  const fringe = new THREE.SphereGeometry(0.25, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.3);
  fringe.scale(1, 0.95, 0.5);
  fringe.rotateX(-0.25);
  fringe.translate(0, Y - 0.03, 1.07);
  b.add(fringe, 0x6b4226);
  for (const sx of [-1, 1]) {
    const c = new THREE.Vector3(sx * 0.085, Y - 0.04, 1.2);
    const e = new THREE.SphereGeometry(0.038, 8, 8);
    e.scale(0.8, 1.2, 0.5);
    e.translate(c.x, c.y, c.z);
    b.add(e, PAL.night[700], PART.eye, 0, c);
    const ck = new THREE.CircleGeometry(0.04, 12);
    ck.scale(1.3, 0.8, 1);
    ck.translate(sx * 0.15, Y - 0.12, 1.19);
    b.add(ck, PAL.berry[300], PART.flat);
  }
  const mouth = new THREE.TorusGeometry(0.03, 0.01, 4, 10, Math.PI);
  mouth.rotateZ(Math.PI);
  mouth.translate(0, Y - 0.12, 1.2);
  b.add(mouth, PAL.night[700], PART.flat);
  // vệt sáng trên kính mũ (glint)
  const gl = new THREE.CircleGeometry(0.07, 12);
  gl.scale(0.6, 1.3, 1);
  gl.rotateZ(0.6);
  gl.translate(-0.22, Y + 0.18, 1.12);
  b.add(gl, PAL.cream[100], PART.flat);
  // nắm tay giơ ngón cái (xoay quanh cổ tay)
  const wrist = new THREE.Vector3(0.36, Y - 0.32, 1.12);
  const fist = new THREE.SphereGeometry(0.09, 10, 8);
  fist.translate(wrist.x, wrist.y + 0.04, wrist.z);
  b.add(fist, PAL.cream[300], PART.wave, 0, wrist);
  const thumb = new THREE.CapsuleGeometry(0.035, 0.07, 3, 6);
  thumb.translate(wrist.x, wrist.y + 0.15, wrist.z);
  b.add(thumb, PAL.cream[300], PART.wave, 0, wrist);
  return b.build();
}

function buildGantry(): THREE.BufferGeometry {
  const b = new PartBuilder();
  const base = new THREE.CylinderGeometry(4.6, 5, 0.9, 32);
  base.translate(0, -0.45, 0);
  b.add(base, PAL.grape[500]);
  const ring = new THREE.TorusGeometry(4.75, 0.25, 8, 40);
  ring.rotateX(Math.PI / 2);
  b.add(ring, PAL.honey[500]);
  const gx = -3.4, H = 15;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = new THREE.CapsuleGeometry(0.22, H, 4, 8);
    leg.translate(gx + dx * 0.9, H / 2, dz * 0.9);
    b.add(leg, PAL.cream[500]);
  }
  for (let y = 1.5; y < H; y += 2.2) {
    const bar = new THREE.CapsuleGeometry(0.13, 1.8, 3, 6);
    bar.rotateZ(Math.PI / 2);
    bar.translate(gx, y, 0.9);
    b.add(bar, PAL.berry[300]);
    const bar2 = bar.clone();
    bar2.translate(0, 0, -1.8);
    b.add(bar2, PAL.berry[300]);
  }
  for (const y of [5.5, 11]) {
    const arm = new THREE.CapsuleGeometry(0.28, 1.6, 4, 8);
    arm.rotateZ(Math.PI / 2);
    arm.translate(gx + 1.8, y, 0);
    b.add(arm, PAL.honey[500]);
    const pad = new THREE.SphereGeometry(0.42, 10, 8);
    pad.translate(gx + 2.7, y, 0);
    b.add(pad, PAL.honey[500]);
  }
  const top = new THREE.SphereGeometry(0.5, 12, 10);
  top.translate(gx, H + 0.5, 0);
  b.add(top, PAL.berry[500], PART.glow);
  for (const [x, z] of [[-3.8, 3.8], [3.8, 3.8], [-3.8, -3.8], [3.8, -3.8]] as const) {
    const l = new THREE.SphereGeometry(0.4, 10, 8);
    l.translate(x, 0.3, z);
    b.add(l, PAL.mint[300], PART.glow);
  }
  return b.build();
}

export function createRocket(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const gantryToon = makeToon(buildGantry(), 0);
  const gantry = gantryToon.body;
  gantry.scale.setScalar(2.4);
  root.add(gantry);

  const rocket = new THREE.Group();
  root.add(rocket);
  const toon = makeToon(buildRocket(), LEN_LOCAL * OUTLINE.secret);
  toon.body.position.y = toon.outline.position.y = -2.0; // tâm quay ở giữa thân
  rocket.add(toon.outline, toon.body);

  // lửa 3 lớp
  const flameGeo = new THREE.BufferGeometry();
  {
    const layers = [[0.62, 2.6], [0.45, 1.85], [0.27, 1.1]].map(([r, len], li) => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) {
        const s = i / 12;
        const rr = r! * Math.pow(1 - s, 0.85) * (0.78 + 0.22 * Math.sin(Math.min(s / 0.22, 1) * Math.PI / 2));
        pts.push(new THREE.Vector2(Math.max(rr, 0.001), -0.42 - s * len!));
      }
      const g = new THREE.LatheGeometry(pts, 24).toNonIndexed();
      g.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(li), 1));
      return g;
    });
    for (const [name, size] of [['position', 3], ['uv', 2], ['aLayer', 1]] as const) {
      const arrs = layers.map((m) => m.getAttribute(name).array as Float32Array);
      const out = new Float32Array(arrs.reduce((a, x) => a + x.length, 0));
      let o = 0;
      for (const x of arrs) { out.set(x, o); o += x.length; }
      flameGeo.setAttribute(name, new THREE.BufferAttribute(out, size));
    }
    layers.forEach((l) => l.dispose());
  }
  const flameU = {
    uT: { value: 0 }, uI: { value: 0 },
    uC0: { value: raw(PAL.cream[300]) }, uC1: { value: raw(PAL.honey[500]) },
    uC2: { value: raw(PAL.peach[500]) }, uC3: { value: raw(PAL.berry[500]) },
  };
  const flame = new THREE.Mesh(flameGeo, new THREE.ShaderMaterial({
    vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, uniforms: flameU, fog: false,
    transparent: true, depthWrite: false,
  }));
  flame.frustumCulled = false;
  flame.renderOrder = 3;
  toon.body.add(flame);

  const bez = { uP0: { value: PAD.clone() }, uC: { value: CTRL.clone() }, uP1: { value: TOP.clone() } };
  const smokeU = { uT: { value: 0 }, uPx: { value: 600 }, uWarm: { value: raw(PAL.peach[300]) }, uCool: { value: raw(PAL.grape[100]) }, ...bez };
  const rnd = seededRnd(4242);
  const puffCols = [PAL.cream[300], PAL.cream[500], PAL.grape[100], PAL.berry[100]].map((h) => raw(h));
  const smoke = makePoints(520, SMOKE_VERT, smokeU, (i, s, c) => {
    s.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    const col = puffCols[Math.floor(rnd() * puffCols.length)]!;
    c.set([col.r, col.g, col.b], i * 3);
  }, { additive: false, frag: SHAPE_FRAG });
  (smoke.material as THREE.ShaderMaterial).premultipliedAlpha = true;
  smoke.renderOrder = 6;
  root.add(smoke);

  const shellU = SHELLS.map(([x, y, z, t]) => new THREE.Vector4(x, y, z, t));
  const sparkU = { uT: { value: 0 }, uPx: { value: 600 }, uShell: { value: shellU }, uKind: { value: SHELLS.map((s) => s[4]) }, ...bez };
  // tia sao 260, chớp đánh lửa 30; mỗi quả: vòng chính 220, vòng trong 110, kim tuyến 80, chớp 1
  const plan: [number, number][] = [[0, 260], [1, 30]];
  for (let s = 0; s < 6; s++) plan.push([2 + s / 10, 220], [3 + s / 10, 110], [4 + s / 10, 80], [5 + s / 10, 1]);
  const total = plan.reduce((a, [, n]) => a + n, 0);
  const cls = new Float32Array(total);
  let k = 0;
  for (const [c, n] of plan) for (let j = 0; j < n; j++) cls[k++] = c;
  const tmp = new THREE.Color();
  const trailCols = [PAL.honey[500], PAL.cream[300], PAL.peach[500], PAL.honey[300]];
  const sparks = makePoints(total, SPARK_VERT, sparkU, (i, s, c) => {
    const w = cls[i]!;
    s.set([rnd(), rnd(), rnd(), w], i * 4);
    const si = Math.round((w % 1) * 10);
    const cl = Math.floor(w);
    if (cl === 0) raw(trailCols[Math.floor(rnd() * trailCols.length)]!, tmp);
    else if (cl === 1) raw(PAL.honey[300], tmp);
    else if (cl === 3) raw(SHELL_COL2[si]!, tmp);
    else if (cl === 4) raw(rnd() < 0.5 ? PAL.honey[300] : PAL.cream[300], tmp);
    else raw(rnd() < 0.8 ? SHELL_COL[si]! : SHELL_COL2[si]!, tmp);
    c.set([tmp.r, tmp.g, tmp.b], i * 3);
  }, { additive: false, frag: SHAPE_FRAG });
  (sparks.material as THREE.ShaderMaterial).premultipliedAlpha = true;
  sparks.renderOrder = 7;
  root.add(sparks);

  const halo = createSecretHalo();
  root.add(halo.group);

  const q = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const zAx = new THREE.Vector3();
  const want = new THREE.Vector3();
  const q1 = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const bezAt = (s: number) => {
    const m = 1 - s;
    q.set(0, 0, 0).addScaledVector(PAD, m * m).addScaledVector(CTRL, 2 * m * s).addScaledVector(TOP, s * s);
    tan.copy(CTRL).sub(PAD).multiplyScalar(2 * m).addScaledVector(want.copy(TOP).sub(CTRL), 2 * s).normalize();
  };

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; halo.group.visible = false; },
    update(t: number, f: FrameState) {
      smokeU.uT.value = sparkU.uT.value = flameU.uT.value = t;
      smokeU.uPx.value = sparkU.uPx.value = pxScale();
      const tu = toon.uniforms;
      tu.uTime.value = gantryToon.uniforms.uTime.value = t;
      tu.uPulse.value = f.beatPulse;
      tu.uViewH.value = gantryToon.uniforms.uViewH.value = pxScale();
      const bl = (t + 0.4) % 3.1;
      tu.uBlink.value = bl < 0.14 ? Math.abs(bl / 0.07 - 1) : 1;
      // ngón cái: giơ lên khi bay, nhún theo phách
      tu.uWave.value = -0.6 + smooth(T_IGN + 1, T_IGN + 1.5, t) * (0.6 + 0.15 * Math.sin(t * 9));

      // giàn phóng nhô lên từ dưới đất lúc đầu, hạ xuống lúc cuối
      const rise = smooth(0, 1.6, t) * (1 - smooth(D - 2.5, D - 0.5, t));
      const sink = (1 - rise) * 18;
      gantry.position.set(PAD.x, PAD.y - sink, PAD.z);
      const u = Math.min(1, Math.max(0, (t - T_IGN) / (T_BURST - T_IGN)));
      bezAt(u * u);
      rocket.position.copy(q);
      if (t < T_IGN) rocket.position.y -= sink;
      // trục thân theo tiếp tuyến; xoay quanh trục để cửa sổ (+z) nhìn về sân khấu
      q1.setFromUnitVectors(up, tan);
      zAx.set(0, 0, 1).applyQuaternion(q1);
      want.set(0, 1.65, 0).sub(rocket.position);
      want.addScaledVector(tan, -want.dot(tan)).normalize();
      let roll = Math.atan2(zAx.clone().cross(want).dot(tan), zAx.dot(want));
      // vòng xoay dễ thương trước khi nổ
      const spin = smooth(T_BURST - T_SPIN, T_BURST - 0.1, t);
      roll += spin * Math.PI * 4;
      q2.setFromAxisAngle(tan, roll);
      rocket.quaternion.copy(q2).multiply(q1);
      // tâm thân dời lên nửa chiều dài để vòi ở đúng điểm quỹ đạo
      rocket.position.addScaledVector(tan, 2.0 * S);
      if (t > T_IGN - 0.6 && t < T_IGN + 1) rocket.position.x += Math.sin(t * 60) * 0.05;
      // pop + kéo dài khi tăng tốc + phình ra trước khi nổ
      const stretch = 1 + 0.1 * smooth(T_IGN, T_IGN + 0.8, t) * (1 - smooth(T_BURST - 2, T_BURST - 1, t));
      const puff = 1 + 0.18 * smooth(T_BURST - 0.35, T_BURST, t);
      const pop = popScale(t);
      rocket.scale.set(S * pop * puff / Math.sqrt(stretch), S * pop * stretch * (2 - puff), S * pop * puff / Math.sqrt(stretch));
      rocket.visible = t < T_BURST;
      flameU.uI.value = smooth(T_IGN - 0.3, T_IGN + 0.3, t) * (1 - 0.35 * spin) + 0.25 * smooth(T_IGN - 1.2, T_IGN - 0.3, t);
      flame.visible = flameU.uI.value > 0.01;

      halo.group.position.copy(rocket.position);
      const appear = smooth(T_IGN, T_IGN + 0.5, t) * (1 - smooth(T_BURST - 0.15, T_BURST, t));
      halo.update(t, (LEN_LOCAL / 2) * S, appear);
    },
    focus(t: number, out: THREE.Vector3) {
      if (t >= T_BURST - 0.5) { out.copy(ROCKET_BURST); return; }
      const u = Math.min(1, Math.max(0, (t - T_IGN) / (T_BURST - T_IGN)));
      bezAt(u * u);
      out.copy(q).lerp(ROCKET_BURST, 0.35);
    },
    dispose() { halo.dispose(); disposeTree(root); },
  };
}
