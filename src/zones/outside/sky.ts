// Bầu trời đêm "Kẹo đêm" (STYLE_GUIDE khu 1): vòm trời gradient + trăng chibi ngủ (atlas trong shader vòm trời),
// cực quang (chỉ hiện khi Hype > 40%, bung rèm từ chân lên), trường sao + sao hero 5 cánh, sao băng đầu ngôi sao,
// máy bay chở khách mập + vệt khói chấm, điểm sáng (đèn hàng không, drone). 4–5 draw call (cực quang ẩn hẳn < 40%).
// Shader: skyShaders.ts · texture trăng: skyMoon.ts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { SKY_RADIUS } from '../../world/layout';
import { addGlow, type GlowBuf, type Uniforms } from '../../world/shared/glowPoints';
import { auroraAmount, hexToRgb, PAL, shade, VEHICLE_MAX_ASPECT } from '../../world/style';
import { createMoonTexture } from './skyMoon';
import {
  AURORA_FRAG, AURORA_VERT, MET_FRAG, MET_VERT, MW_N, PLANE_FRAG, PLANE_VERT, SKY_FRAG, SKY_VERT, STAR_FRAG, STAR_VERT,
} from './skyShaders';

const STAR_R = SKY_RADIUS;

/** Cực quang: bật khi Hype vượt 40%, tắt (mờ dần) khi xuống dưới 37%. */
const AUR_ON = 0.4, AUR_OFF = 0.37, AUR_UNFURL_SEC = 3, AUR_FADE_SEC = 1.6;
/** Trăng thức dậy khi Hype > 80% (ngủ lại dưới 76%). */
const WAKE_ON = 0.8, WAKE_OFF = 0.76;

// Đường bay (từ → tới), độ cao lớn, trong tầm far=220 của camera.
const PATHS: [THREE.Vector3, THREE.Vector3][] = [
  [new THREE.Vector3(-125, 112, -85), new THREE.Vector3(125, 112, -25)],
  [new THREE.Vector3(95, 125, 55), new THREE.Vector3(-70, 125, -120)],
  [new THREE.Vector3(120, 105, -100), new THREE.Vector3(-120, 118, -40)],
  [new THREE.Vector3(-90, 130, 60), new THREE.Vector3(60, 120, -130)],
];

/** Màu token → THREE.Color giữ nguyên số sRGB (shader dùng thẳng, không chuyển không gian màu). */
const rawColor = (hex: number, zoned = true) => {
  const [r, g, b] = hexToRgb(zoned ? shade(hex, 'outside') : hex);
  return new THREE.Color().setRGB(r, g, b);
};

let activeBurst: ((n: number) => void) | null = null;
/** Bắn n sao băng (cho kiểm thử). */
export function triggerMeteors(count: number): void { activeBurst?.(count); }

export function createSky(scene: THREE.Scene, uniforms: Uniforms, glow: GlowBuf) {
  const disposables: { dispose(): void }[] = [];
  uniforms.uPx = { value: 500 };
  uniforms.uRes = { value: 1 };
  uniforms.uPlane = { value: [new THREE.Vector4(0, -500, 0, 0), new THREE.Vector4(0, -500, 0, 0)] };
  uniforms.uPlaneVis = { value: new THREE.Vector2(0, 0) };
  const moonTex = createMoonTexture();
  disposables.push(moonTex);
  // uniform riêng của bầu trời (giữ tham chiếu tới uniform chung)
  const loc = { uAur: { value: 0 }, uGrow: { value: 0 }, uWake: { value: 0 }, uMoon: { value: moonTex } };
  const U = { ...uniforms, ...loc } as Uniforms;

  // 1) Vòm trời + trăng (bám theo camera, bán kính < far)
  const skyGeo = new THREE.SphereGeometry(190, 48, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  const v2 = new THREE.Vector2();
  sky.onBeforeRender = (renderer, _s, camera) => {
    renderer.getDrawingBufferSize(v2);
    uniforms.uPx.value = v2.y * camera.projectionMatrix.elements[5] * 0.5;
    uniforms.uRes.value = Math.max(0.6, v2.y / 720);
  };
  scene.add(sky);
  disposables.push(skyGeo, skyMat);

  // 2) Cực quang: vài dải rèm cong lớn (1 mesh), tránh hướng trăng (trên-trái phía trước)
  const curt: { cx: number; cz: number; r: number; a0: number; a1: number; yb: number; h: number }[] = [
    { cx: 0, cz: -10, r: 160, a0: -1.9, a1: 1.9, yb: 26, h: 78 },
    { cx: 10, cz: -30, r: 105, a0: -0.2, a1: 1.3, yb: 66, h: 55 },
    { cx: 0, cz: 0, r: 150, a0: 1.7, a1: 3.6, yb: 44, h: 72 },
    { cx: -20, cz: -40, r: 125, a0: -3.0, a1: -1.75, yb: 56, h: 66 },
  ];
  const ap: number[] = [], auv: number[] = [], ac: number[] = [], ai: number[] = [];
  curt.forEach((c, id) => {
    const N = 160;
    const len = (c.a1 - c.a0) * c.r;
    const base = ap.length / 3;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = c.a0 + (c.a1 - c.a0) * u;
      const x = c.cx + Math.sin(a) * c.r, z = c.cz - Math.cos(a) * c.r;
      for (let j = 0; j < 2; j++) {
        ap.push(x, c.yb + j * c.h, z);
        auv.push(u, j);
        ac.push(u * len, u, id);
      }
    }
    for (let i = 0; i < N; i++) {
      const k = base + i * 2;
      ai.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  });
  const aurGeo = new THREE.BufferGeometry();
  aurGeo.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
  aurGeo.setAttribute('uv', new THREE.Float32BufferAttribute(auv, 2));
  aurGeo.setAttribute('aCurt', new THREE.Float32BufferAttribute(ac, 3));
  aurGeo.setIndex(ai);
  const aurMat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG,
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const aurora = new THREE.Mesh(aurGeo, aurMat);
  aurora.frustumCulled = false;
  aurora.renderOrder = -5;
  aurora.visible = false; // không vẽ khi Hype ≤ 40%
  scene.add(aurora);
  disposables.push(aurGeo, aurMat);

  // 3) Trường sao + sao hero 5 cánh (1 draw call)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sp: number[] = [], sc: number[] = [], ss: number[] = [], st: number[] = [];
  const STAR_COLS = [rawColor(PAL.cream[300]), rawColor(PAL.soda[100]), rawColor(PAL.honey[100]), rawColor(PAL.grape[100])];
  const HERO_COLS = [rawColor(PAL.honey[500], false), rawColor(PAL.honey[300], false), rawColor(PAL.cream[300], false)];
  const addStar = (x: number, y: number, z: number, size: number, bright: number, hero: number) => {
    const l = Math.hypot(x, y, z);
    sp.push(x / l, y / l, z / l);
    const tt = rnd();
    const col = hero
      ? HERO_COLS[tt < 0.5 ? 0 : tt < 0.8 ? 1 : 2]!
      : STAR_COLS[tt < 0.5 ? 0 : tt < 0.75 ? 1 : tt < 0.92 ? 2 : 3]!;
    sc.push(col.r * bright, col.g * bright, col.b * bright);
    ss.push(size);
    st.push(0.6 + rnd() * 2.2, rnd() * 6.28, hero);
  };
  const N_UNI = 2200, NS = 2800;
  const mwU = new THREE.Vector3(1, 0, 0).cross(MW_N).normalize(), mwV = new THREE.Vector3().crossVectors(MW_N, mwU);
  const q = new THREE.Vector3();
  for (let i = 0; i < NS; i++) {
    let x: number, y: number, z: number;
    if (i < N_UNI) { // đều trên bầu trời
      y = 0.03 + Math.pow(rnd(), 0.85) * 0.97;
      const th = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
      x = Math.cos(th) * rr; z = Math.sin(th) * rr;
    } else { // dải Ngân Hà: quanh đại vòng vuông góc MW_N
      const g = (rnd() + rnd() + rnd() - 1.5) * 0.3;
      const th = rnd() * Math.PI * 2;
      q.copy(mwU).multiplyScalar(Math.cos(th)).addScaledVector(mwV, Math.sin(th)).addScaledVector(MW_N, g).normalize();
      x = q.x; y = q.y; z = q.z;
      if (y < 0.04) { i--; continue; }
    }
    const m = rnd();
    const mw = i >= N_UNI;
    addStar(x, y, z, 1.6 + Math.pow(m, 4) * 2.4, (mw ? 0.33 : 0.42) + Math.pow(m, 2.5) * 0.8, 0);
  }
  for (let i = 0; i < 12; i++) { // sao hero: ngôi sao 5 cánh tròn đầu
    const y = 0.2 + rnd() * 0.72, th = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
    addStar(Math.cos(th) * rr, y, Math.sin(th) * rr, 24 + rnd() * 12, 0.95 + rnd() * 0.15, 1);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  starGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(ss, 1));
  starGeo.setAttribute('aTw', new THREE.Float32BufferAttribute(st, 3));
  const starMat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: STAR_VERT(STAR_R), fragmentShader: STAR_FRAG,
    transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -15;
  scene.add(stars);
  disposables.push(starGeo, starMat);

  // Sao băng: pool 24 dải instanced, chỉ ghi buffer khi sinh sao
  const POOL = 24;
  const mGeo = new THREE.InstancedBufferGeometry();
  const XS = [-1, 0, 0.08, 0.2, 0.38, 0.6, 0.8, 1];
  const mPos: number[] = [], mIdx: number[] = [];
  XS.forEach((x, i) => {
    mPos.push(x, -1, 0, x, 1, 0);
    if (i > 0) { const k = (i - 1) * 2; mIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
  mGeo.setAttribute('position', new THREE.Float32BufferAttribute(mPos, 3));
  mGeo.setIndex(mIdx);
  const mkAttr = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(POOL * n), n);
  const aP0 = mkAttr(3), aT = mkAttr(3), aLife = mkAttr(4), aLook = mkAttr(2);
  for (let i = 0; i < POOL; i++) aLife.setXYZW(i, -1000, 1, 0, 0);
  mGeo.setAttribute('aP0', aP0); mGeo.setAttribute('aT', aT); mGeo.setAttribute('aLife', aLife); mGeo.setAttribute('aLook', aLook);
  mGeo.instanceCount = POOL;
  const mMat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: MET_VERT(STAR_R - 5), fragmentShader: MET_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const meteors = new THREE.Mesh(mGeo, mMat);
  meteors.frustumCulled = false;
  meteors.renderOrder = -14;
  scene.add(meteors);
  disposables.push(mGeo, mMat);

  const P0 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), nV = new THREE.Vector3(), eV = new THREE.Vector3(), TV = new THREE.Vector3();
  let slot = 0;
  const spawn = (now: number) => {
    const az = (rnd() < 0.62 ? 0 : Math.PI) + (rnd() - 0.5) * 1.9;
    const el = THREE.MathUtils.degToRad(26 + rnd() * 36);
    P0.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    nV.copy(UP).addScaledVector(P0, -P0.y).normalize();
    eV.crossVectors(nV, P0).normalize().multiplyScalar(rnd() < 0.5 ? 1 : -1);
    const down = rnd() < 0.88;
    const phi = THREE.MathUtils.degToRad(down ? 14 + rnd() * 52 : 5 + rnd() * 12);
    TV.copy(eV).multiplyScalar(Math.cos(phi)).addScaledVector(nV, (down ? -1 : 1) * Math.sin(phi)).normalize();
    const i = slot; slot = (slot + 1) % POOL;
    aP0.setXYZ(i, P0.x, P0.y, P0.z); aT.setXYZ(i, TV.x, TV.y, TV.z);
    aLife.setXYZW(i, now, 0.7 + rnd() * 0.8, 0.4 + rnd() * 0.45, 0.14 + rnd() * 0.12);
    aLook.setXY(i, 0.011 + rnd() * 0.005, 0.85 + rnd() * 0.3);
    aP0.needsUpdate = aT.needsUpdate = aLife.needsUpdate = aLook.needsUpdate = true;
  };
  const queue: number[] = []; // thời điểm sao băng sắp sinh
  let now = 0, lastT = -1, prevHype = -1;
  const armed = [true, true, true, true];
  const TH = [0.2, 0.4, 0.6, 0.8], BURST = [1, 2, 4, 7];
  const burst = (n: number) => { for (let k = 0; k < n; k++) queue.push(now + (n > 1 ? (k / (n - 1)) * 1.5 : 0) + rnd() * 0.12); };
  activeBurst = burst;
  (window as unknown as { __csSky?: unknown }).__csSky = { triggerMeteors };

  // 4) Máy bay chở khách mập (cục bộ: mũi +X, cánh ±Z) + vệt khói chấm (1 mesh)
  const S = 1.7; // tỉ lệ chung
  const BODY_R = 1.3, BODY_LEN = 2 * BODY_R * VEHICLE_MAX_ASPECT - 2 * BODY_R; // tổng dài = 2,2 × đường kính
  const parts: THREE.BufferGeometry[] = [];
  const addPart = (g: THREE.BufferGeometry, id: number, trail: number, body: number) => {
    g.scale(S, S, S);
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    const n = ng.attributes.position.count;
    const info = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { info[i * 3] = id; info[i * 3 + 1] = trail; info[i * 3 + 2] = body; }
    ng.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
    parts.push(ng);
  };
  for (const id of [0, 1]) {
    const body = new THREE.CapsuleGeometry(BODY_R, BODY_LEN, 6, 14);
    body.rotateZ(-Math.PI / 2);
    addPart(body, id, 0, 1);
    const wing = new THREE.CapsuleGeometry(0.5, 3.4, 4, 8); // cánh ngắn, dày
    wing.rotateX(Math.PI / 2); wing.scale(1.5, 0.6, 1); wing.translate(0.2, -0.45, 0);
    addPart(wing, id, 0, 0);
    const tail = new THREE.CapsuleGeometry(0.34, 1.5, 4, 8);
    tail.rotateX(Math.PI / 2); tail.scale(1.7, 0.6, 1); tail.translate(-2.1, 0.35, 0);
    addPart(tail, id, 0, 0);
    const fin = new THREE.CapsuleGeometry(0.32, 0.9, 4, 8);
    fin.scale(1.8, 1, 0.55); fin.rotateZ(0.45); fin.translate(-2.2, 1.45, 0);
    addPart(fin, id, 0, 0);
    for (const zz of [-1.5, 1.5]) {
      const g = new THREE.PlaneGeometry(70, 0.9);
      g.rotateX(-Math.PI / 2);
      // uv.x: 0 tại máy bay → 1 cuối vệt
      const uvA = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uvA.count; i++) uvA.setX(i, 1 - uvA.getX(i));
      g.translate(-3 - 35, -0.3, zz);
      addPart(g, id, 1, 0);
    }
  }
  const planeGeo = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  const planeMat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const planes = new THREE.Mesh(planeGeo, planeMat);
  planes.frustumCulled = false;
  scene.add(planes);
  disposables.push(planeGeo, planeMat);

  // Đèn hàng không (bộ đệm điểm sáng chung): 2 đèn to ở mút cánh peach / mint nháy mềm + đèn chớp kem ở đuôi
  const peach = rawColor(PAL.peach[500], false), mint = rawColor(PAL.mint[500], false), cream = rawColor(PAL.cream[300], false);
  for (const k of [3, 4]) {
    const ph = k * 0.37, tipZ = 2.6 * S;
    addGlow(glow, 0.2 * S, -0.45 * S, -tipZ, peach, 1.4, 3.2, [k, 2.2, ph, 0]);
    addGlow(glow, 0.2 * S, -0.45 * S, tipZ, mint, 1.4, 3.2, [k, 2.2, ph + 1.6, 0]);
    addGlow(glow, -2.6 * S, 2.1 * S, 0, cream, 1.3, 2.4, [k, 0.9, ph, 1]);
    addGlow(glow, 0.4 * S, -BODY_R * S, 0, peach, 1.2, 2.2, [k, 0.7, ph + 0.4, 1]);
  }
  // drone/trực thăng đèn nháy chậm
  addGlow(glow, 0, 0, 0, peach, 1.3, 1.6, [5, 0.6, 0, 1]);
  addGlow(glow, 0, 0.5, 0, cream, 0.7, 1.0, [5, 0, 0, 2]);

  const CYCLE = [31, 39];
  const OFFS = [26, 25];
  const tmp = new THREE.Vector3();
  let aurOn = false, aur = 0, grow = 0, awake = false, wake = 0;
  return {
    update(t: number) {
      now = t;
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const h = (uniforms.uHype?.value as number) ?? 0;
      if (prevHype < 0) prevHype = h;
      for (let i = 0; i < 4; i++) {
        if (h < TH[i] - 0.05) armed[i] = true;
        if (armed[i] && prevHype < TH[i] && h >= TH[i]) { armed[i] = false; burst(BURST[i]); }
      }
      prevHype = h;

      // Cực quang: ẩn hẳn khi Hype ≤ 40%; bung rèm ~3 s khi xuất hiện; mờ dần (trễ) khi xuống dưới 37%
      if (!aurOn && h > AUR_ON) { aurOn = true; if (aur < 0.01) grow = 0; }
      else if (aurOn && h < AUR_OFF) aurOn = false;
      const target = aurOn ? Math.max(auroraAmount(h), 0.08) : 0; // 0.08: giữ mờ trong vùng trễ 37–40%
      const rate = target > aur ? 1 / 0.8 : 1 / AUR_FADE_SEC;
      aur += Math.sign(target - aur) * Math.min(Math.abs(target - aur), rate * dt);
      if (aurOn) grow = Math.min(1, grow + dt / AUR_UNFURL_SEC);
      if (!aurOn && aur <= 0.001) { aur = 0; grow = 0; }
      loc.uAur.value = aur;
      loc.uGrow.value = grow;
      aurora.visible = aur > 0.001 && grow > 0;

      // Trăng thức khi Hype > 80%
      if (!awake && h > WAKE_ON) awake = true; else if (awake && h < WAKE_OFF) awake = false;
      wake += ((awake ? 1 : 0) - wake) * Math.min(1, dt * 4);
      loc.uWake.value = wake;

      const mr = h < 0.2 ? 0 : h < 0.4 ? 1 / 12 : h < 0.6 ? 1 / 6 : h < 0.8 ? 1 / 3 : 3.5 + (h - 0.8) * 20;
      if (dt > 0 && rnd() < mr * dt) queue.push(t);
      for (let k = queue.length - 1; k >= 0; k--) if (queue[k] <= t) { spawn(t); queue.splice(k, 1); }
      for (let i = 0; i < 2; i++) {
        const local = (t + OFFS[i]) / CYCLE[i];
        const idx = Math.floor(local);
        const f = (local - idx) / 0.85;
        const [A, B] = PATHS[(idx * 2 + i * 3) % PATHS.length];
        const vis = f >= 1 ? 0 : THREE.MathUtils.smoothstep(f, 0, 0.06) * (1 - THREE.MathUtils.smoothstep(f, 0.94, 1));
        tmp.lerpVectors(A, B, Math.min(f, 1));
        const pl = uniforms.uPlane.value[i] as THREE.Vector4;
        pl.set(tmp.x, vis > 0 ? tmp.y : -500, tmp.z, Math.atan2(B.z - A.z, B.x - A.x));
        (uniforms.uPlaneVis.value as THREE.Vector2).setComponent(i, vis);
      }
    },
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}
