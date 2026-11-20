// Phi đội phản lực vẽ khói: 2 chiếc (đỏ / hồng) lao vào từ sau sân khấu, sượt qua mái, rồi vẽ một TRÁI TIM
// khổng lồ trên bầu trời phía trên giữa sân (mặt phẳng ngửa xuống ~50° về phía ca sĩ / camera wide), chiếc thứ 3 (cyan) bắn "mũi tên"
// xuyên tim từ trái sang phải (theo góc nhìn ca sĩ). Khói là dải ribbon tĩnh (tính sẵn theo quỹ đạo giải tích),
// shader làm nó hiện dần theo thời gian phát, nở rộng + trôi + mờ dần ~15 s. Afterburner + chớp "whoosh" bằng Points.
// Draw call: 1 ribbon + 3 máy bay + 1 Points = 5. Mỗi frame chỉ đổi uniform/transform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../core/types';
import { type SecretAct, disposeTree, makePoints, pxScale } from './secretShared';

const D = 24;
const TILT = (50 * Math.PI) / 180;
/** Tâm trái tim (điểm nhìn chính). */
export const JET_HEART_CENTER = new THREE.Vector3(0, 48, -34);
const K = 1.35; // tỉ lệ trái tim (đơn vị công thức → m)
const EX = new THREE.Vector3(1, 0, 0);
// mặt phẳng tim ngả về phía ca sĩ (pháp tuyến hướng xuống giữa ca sĩ và camera wide)
const EY = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
const T_IN = 0, T_HEART = 2.6, T_MEET = 8.6, T_OUT = 11.2;
const T_C0 = 3.4, T_C1 = 9.8; // mũi tên cyan
const JET_COL = [0xff2a48, 0xff6fb4, 0x3ae8ff];
const SMOKE_LIFE = 15;

const heartPt = (tau: number, out: THREE.Vector3) => {
  const x = 16 * Math.sin(tau) ** 3;
  const y = 13 * Math.cos(tau) - 5 * Math.cos(2 * tau) - 2 * Math.cos(3 * tau) - Math.cos(4 * tau);
  return out.copy(JET_HEART_CENTER).addScaledVector(EX, x * K).addScaledVector(EY, y * K);
};
const TIP = heartPt(Math.PI, new THREE.Vector3());
const DIMPLE = heartPt(0, new THREE.Vector3());
const ease = (u: number) => u * u * (3 - 2 * u);

/** Vị trí jet i tại thời điểm t (giải tích). */
function jetPos(i: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  if (i < 2) {
    const s = i === 0 ? 1 : -1;
    if (t < T_HEART) {
      // lao vào từ sau sân khấu (+Z), bay thấp qua mái rồi kéo lên mũi tim — Bézier bậc 2
      const u = Math.max(0, (t - T_IN) / (T_HEART - T_IN));
      const p0x = s * 14, p0y = 30, p0z = 190;
      const cx = s * 3, cy = 14, cz = 20;
      const m = 1 - u;
      return out.set(
        m * m * p0x + 2 * m * u * cx + u * u * TIP.x,
        m * m * p0y + 2 * m * u * cy + u * u * TIP.y,
        m * m * p0z + 2 * m * u * cz + u * u * TIP.z,
      );
    }
    if (t < T_MEET) {
      const u = ease((t - T_HEART) / (T_MEET - T_HEART));
      const tau = i === 0 ? Math.PI * (1 - u) : Math.PI * (1 + u);
      return heartPt(tau, out);
    }
    // thoát: vút lên cao và ra xa phía khán đài đối diện
    const u = Math.min(1, (t - T_MEET) / (T_OUT - T_MEET));
    return out.set(DIMPLE.x + s * 45 * u * u, DIMPLE.y + 55 * u, DIMPLE.z - 90 * u);
  }
  // mũi tên: thẳng từ trái (-X) sang phải (+X), xuyên tâm tim, lệch chút về phía ca sĩ
  const u = (t - T_C0) / (T_C1 - T_C0);
  return out.set(-150 + 300 * u, JET_HEART_CENTER.y - 30 + 60 * u, JET_HEART_CENTER.z + 3 - 6 * u);
}
const EMIT: [number, number][] = [[1.2, T_MEET + 0.4], [1.2, T_MEET + 0.4], [5.0, 8.4]];

const TRAIL_VERT = /* glsl */ `
uniform float uT;
attribute vec3 aTan; attribute vec3 aCol; attribute vec3 aInfo; // emit, side, jet
varying vec3 vCol; varying float vAlpha; varying float vSide;
void main() {
  float age = uT - aInfo.x;
  vec3 c = position;
  float a = max(age, 0.0);
  // trôi theo gió + lan ra, chìm nhẹ
  c += vec3(0.35 + 0.25 * sin(aInfo.x * 3.1 + aInfo.z), -0.12 + 0.1 * cos(aInfo.x * 2.3), 0.2 * sin(aInfo.x * 1.7)) * a;
  float w = 0.9 + a * 0.42 + 0.25 * sin(aInfo.x * 9.0 + aInfo.z * 4.0) * min(a, 3.0) * 0.3;
  vec3 vd = normalize(cameraPosition - c);
  vec3 sd = cross(aTan, vd);
  float l = length(sd);
  sd = l > 1e-4 ? sd / l : vec3(0.0, 1.0, 0.0);
  c += sd * aInfo.y * w;
  vSide = aInfo.y;
  float fade = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(${(SMOKE_LIFE * 0.35).toFixed(1)}, ${SMOKE_LIFE.toFixed(1)}, age));
  vAlpha = age < 0.0 ? 0.0 : fade * 0.92;
  vCol = mix(vec3(1.0, 0.97, 0.9), aCol, smoothstep(0.0, 0.6, age)) * (1.0 - 0.25 * smoothstep(2.0, ${SMOKE_LIFE.toFixed(1)}, age));
  gl_Position = projectionMatrix * viewMatrix * vec4(c, 1.0);
}`;
const TRAIL_FRAG = /* glsl */ `
varying vec3 vCol; varying float vAlpha; varying float vSide;
void main() {
  float a = vAlpha * pow(max(1.0 - vSide * vSide, 0.0), 0.8);
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol, a);
}`;

const GLOW_VERT = /* glsl */ `
uniform float uPx; uniform vec4 uJet[3]; uniform vec3 uBack[3]; uniform float uFlash[3]; uniform float uT;
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
void main() {
  int i = int(aSeed.x + 0.5);
  vec4 j = uJet[0]; vec3 b = uBack[0]; float fl = uFlash[0];
  if (i == 1) { j = uJet[1]; b = uBack[1]; fl = uFlash[1]; } else if (i == 2) { j = uJet[2]; b = uBack[2]; fl = uFlash[2]; }
  vec3 p = j.xyz; float size; float al;
  if (aSeed.y < 0.5) { // afterburner
    p += b * 4.2; size = 3.2 + 0.6 * sin(uT * 47.0 + aSeed.x * 3.0); al = j.w; vColor = vec3(1.0, 0.62, 0.25);
  } else if (aSeed.y < 1.5) { // lõi trắng
    p += b * 3.6; size = 1.6; al = j.w; vColor = vec3(1.0, 0.95, 0.85);
  } else { // chớp whoosh
    size = 14.0 + 40.0 * (1.0 - fl); al = fl * j.w * 0.9; vColor = aColor;
  }
  vAlpha = al;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uPx * size / -mv.z, 2.0, 500.0);
}`;

function buildJet(hex: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, c: number) => {
    const h = g.index ? g.toNonIndexed() : g;
    if (h !== g) g.dispose();
    h.deleteAttribute('uv');
    const n = h.getAttribute('normal');
    const col = new THREE.Color(c);
    const arr = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) {
      const s = 0.6 + 0.4 * Math.max(0, n.getY(i) * 0.7 + n.getX(i) * 0.3 + 0.3);
      arr.set([col.r * s, col.g * s, col.b * s], i * 3);
    }
    h.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    h.deleteAttribute('normal');
    parts.push(h);
  };
  // mũi hướng +Z cục bộ
  const body = new THREE.CylinderGeometry(0.55, 0.7, 9, 12); body.rotateX(Math.PI / 2); add(body, 0xeef2f8);
  const nose = new THREE.ConeGeometry(0.55, 3, 12); nose.rotateX(Math.PI / 2); nose.translate(0, 0, 6); add(nose, hex);
  const canopy = new THREE.SphereGeometry(0.5, 10, 6); canopy.scale(1, 0.8, 2.4); canopy.translate(0, 0.55, 2.4); add(canopy, 0x1a2a55);
  const wing = new THREE.BufferGeometry();
  // cánh tam giác (delta), 2 mặt
  const wv = [0, 0, 2.5, -5.5, 0, -3.5, 5.5, 0, -3.5, 0, 0, 2.5, 5.5, 0, -3.5, -5.5, 0, -3.5];
  wing.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3));
  wing.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  wing.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
  add(wing, hex);
  const fin = new THREE.BoxGeometry(0.15, 2.4, 2.2); fin.translate(0, 1.4, -3.4); add(fin, hex);
  const tailW = new THREE.BoxGeometry(4.2, 0.12, 1.3); tailW.translate(0, 0.1, -4.0); add(tailW, 0xdde3ee);
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

export function createJet(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ── Ribbon khói tĩnh cho cả 3 jet
  const NSEG = 260;
  const pos: number[] = [], tan: number[] = [], colA: number[] = [], info: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3(), tv = new THREE.Vector3();
  const cc = new THREE.Color();
  for (let j = 0; j < 3; j++) {
    const [t0, t1] = EMIT[j]!;
    cc.setHex(JET_COL[j]!);
    const base = pos.length / 3;
    for (let k = 0; k <= NSEG; k++) {
      const te = t0 + ((t1 - t0) * k) / NSEG;
      jetPos(j, te, p);
      jetPos(j, te + 0.02, q);
      tv.copy(q).sub(p).normalize();
      for (const side of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        tan.push(tv.x, tv.y, tv.z);
        colA.push(cc.r, cc.g, cc.b);
        info.push(te, side, j);
      }
      if (k < NSEG) {
        const a = base + k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tGeo.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 3));
  tGeo.setAttribute('aCol', new THREE.Float32BufferAttribute(colA, 3));
  tGeo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3));
  tGeo.setIndex(idx);
  const trailU = { uT: { value: 0 } };
  const trail = new THREE.Mesh(tGeo, new THREE.ShaderMaterial({
    vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, uniforms: trailU,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  trail.frustumCulled = false;
  trail.renderOrder = 5;
  root.add(trail);

  // ── 3 máy bay
  const jets = JET_COL.map((c) => {
    const m = new THREE.Mesh(buildJet(c), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    m.scale.setScalar(1.5);
    m.frustumCulled = false;
    root.add(m);
    return m;
  });

  // ── Afterburner + chớp whoosh (1 Points)
  const uJet = [0, 1, 2].map(() => new THREE.Vector4());
  const uBack = [0, 1, 2].map(() => new THREE.Vector3());
  const uFlash = [0, 0, 0];
  const glowU = { uT: { value: 0 }, uPx: { value: 600 }, uJet: { value: uJet }, uBack: { value: uBack }, uFlash: { value: uFlash } };
  const glow = makePoints(9, GLOW_VERT, glowU, (i, s, c) => {
    s.set([Math.floor(i / 3), i % 3, 0, 0], i * 4);
    cc.setHex(JET_COL[Math.floor(i / 3)]!).lerp(new THREE.Color(1, 1, 1), 0.5);
    c.set([cc.r, cc.g, cc.b], i * 3);
  });
  glow.renderOrder = 7;
  root.add(glow);

  const FLASH_AT = [T_HEART - 0.9, T_HEART - 0.9, 6.6];
  const fwd = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3(), h = new THREE.Vector3();
  const mtx = new THREE.Matrix4();
  const visRange = (j: number, t: number) => (j < 2 ? t >= 0 && t <= T_OUT : t >= T_C0 && t <= T_C1);

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      void f;
      trailU.uT.value = glowU.uT.value = t;
      glowU.uPx.value = pxScale();
      for (let j = 0; j < 3; j++) {
        const m = jets[j]!;
        const vis = visRange(j, t);
        m.visible = vis;
        uJet[j]!.w = vis ? 1 : 0;
        uFlash[j] = t > FLASH_AT[j]! ? Math.exp(-(t - FLASH_AT[j]!) * 2.5) : 0;
        if (!vis) continue;
        jetPos(j, t, p);
        jetPos(j, t + 0.03, q);
        fwd.copy(q).sub(p).normalize();
        // cánh nằm vuông góc với mặt phẳng tim khi đang vẽ; lúc bay ngang thì giữ cánh ngang
        h.copy(Math.abs(fwd.y) > 0.6 ? EY.clone().cross(EX).negate() : new THREE.Vector3(0, 1, 0));
        r.crossVectors(h, fwd);
        if (r.lengthSq() < 1e-6) r.set(1, 0, 0);
        r.normalize();
        u.crossVectors(fwd, r);
        mtx.makeBasis(r, u, fwd);
        m.quaternion.setFromRotationMatrix(mtx);
        m.position.copy(p);
        uJet[j]!.set(p.x, p.y, p.z, 1);
        uBack[j]!.copy(fwd).multiplyScalar(-1.5);
      }
    },
    focus(t: number, out: THREE.Vector3) {
      if (t < T_HEART - 0.3) jetPos(0, t, out).lerp(JET_HEART_CENTER, 0.5);
      else out.copy(JET_HEART_CENTER);
    },
    dispose() { disposeTree(root); },
  };
}
