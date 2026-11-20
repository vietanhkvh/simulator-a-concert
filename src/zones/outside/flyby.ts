// Màn bay chào mừng khi Hype chạm đỉnh (≥ 0,95; tái kích hoạt khi < 0,8; hồi chiêu ≥ 25 s), ~18 s:
// máy bay cánh quạt LUÔN bay từ TRÁI sang PHẢI của ca sĩ (ca sĩ nhìn -Z → phải = +X) ở độ cao ~36 m, z = -30
// (giữa sân, cả camera ca sĩ lẫn camera wide đều thấy), kéo băng rôn dài (gợn sóng trong vertex shader;
// mặt +Z hướng về ca sĩ đọc xuôi, mặt sau lật UV nên cũng không bị ngược),
// phát window 'cs-secret' {kind:'plane', phase:'start'|'end'},
// 4 khinh khí cầu bay lên từ sau khán đài mang băng rôn cổ vũ rồi trôi đi/mờ dần, + bụi sao lấp lánh.
// 3 draw call, visible=false khi rảnh; mỗi frame chỉ đổi uniform/transform.
import { FLYBY } from '../../world/layout';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import type { Uniforms } from '../../world/shared/glowPoints';
import { emitSecret, secretFocusState } from './secretShared';
import { consumeFlybyRequest, drawCheerBanner, getCheerTexts, onCheerChange } from './balloons';
export { triggerFlyby, setCheerBanners } from './balloons';

const DUR = 18;
const COOLDOWN = 25;
const PLANE_Y = FLYBY.y, PLANE_Z = FLYBY.z, PLANE_X = 110, PLANE_SCALE = 1.3;
const AW = 2048, AH = 1024;
const TOW = { x: 0, y: 0, w: 2048, h: 352 };
const BAL_SLOTS = [
  { x: 0, y: 384, w: 1024, h: 256 }, { x: 1024, y: 384, w: 1024, h: 256 },
  { x: 0, y: 640, w: 1024, h: 256 }, { x: 1024, y: 640, w: 1024, h: 256 },
];
const BAL_TEXT_IDX = [1, 2, 4, 5];
const BAL_BANDS = ['#ff1f7a', '#ff8a00', '#0f9dff', '#8a2cff'];
const BAL_COLS: [number, number][] = [[0xff2d8a, 0xfff35a], [0x2ef0ff, 0xff3bd0], [0xffa31a, 0x8a2cff], [0x5cff7a, 0xff3b6b]];
// sau khán đài, né góc nhìn hai màn LED (±30, 15, -75)
const BAL_X = [-80, -14, 10, 78];
const BAL_DY = [0, 3, 1, 4];

const PLANE_VERT = /* glsl */ `
uniform float uTime; uniform float uDir;
attribute float aKind;
varying vec2 vUv; varying float vKind; varying vec3 vCol;
void main(){
  vUv = uv; vKind = aKind; vCol = color;
  vec3 p = position;
  if (aKind > 4.5) {
    float d = max(-p.x - 13.0, 0.0);
    p.z += sin(d * 0.32 - uTime * 7.0) * (0.12 + d * 0.045) + sin(d * 0.9 - uTime * 11.0) * 0.08 * (d / 32.0);
    p.y -= d * d * 0.0012;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const PLANE_FRAG = /* glsl */ `
uniform float uTime; uniform sampler2D uMap; uniform float uFade;
varying vec2 vUv; varying float vKind; varying vec3 vCol;
void main(){
  vec3 c = vCol;
  if (vKind > 4.5) {
    vec2 uv = vUv;
    if (!gl_FrontFacing) uv.x = ${(TOW.w / AW).toFixed(4)} - uv.x;
    vec4 tx = texture2D(uMap, uv);
    if (tx.a < 0.45) discard;
    c = tx.rgb * 1.05;
  } else if (vKind > 3.5) {
    float a = atan(vUv.y - 0.5, vUv.x - 0.5);
    float bl = step(0.55, fract(a / 3.14159 + uTime * 9.0));
    if (bl < 0.5) discard;
    c = vec3(0.35);
  } else if (vKind > 0.5) {
    float rate = vKind < 2.5 ? 1.2 : 1.7;
    float on = vKind < 2.5 ? 0.55 + 0.45 * step(0.35, fract(uTime * rate)) : step(0.85, fract(uTime * rate + 0.3));
    c = vCol * (0.25 + 2.2 * on);
  }
  gl_FragColor = vec4(c * uFade, 1.0);
}`;

const BAL_VERT = /* glsl */ `
uniform float uTime; uniform vec4 uBal[4];
attribute vec2 aInfo; // id, kind (0 vỏ, 1 giỏ/dây, 2 lửa, 3 băng rôn)
attribute vec3 aColA; attribute vec3 aColB;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vKind; varying float vId; varying float vAlpha; varying float vLv;
void main(){
  int i = int(aInfo.x + 0.5);
  vec4 b = uBal[0];
  if (i == 1) b = uBal[1]; else if (i == 2) b = uBal[2]; else if (i == 3) b = uBal[3];
  vUv = uv; vA = aColA; vB = aColB; vKind = aInfo.y; vId = aInfo.x; vAlpha = b.w; vLv = position.y;
  vec3 p = position;
  if (aInfo.y > 2.5) p.z += sin(p.x * 0.6 - uTime * 2.6 + aInfo.x) * 0.3;
  p += b.xyz + vec3(sin(uTime * 0.5 + aInfo.x * 2.0) * 0.8, sin(uTime * 0.7 + aInfo.x * 1.3) * 0.6, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const BAL_FRAG = /* glsl */ `
uniform float uTime; uniform float uPulse; uniform sampler2D uMap;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vKind; varying float vId; varying float vAlpha; varying float vLv;
void main(){
  vec3 c;
  if (vKind > 2.5) {
    vec2 uv = vUv;
    if (!gl_FrontFacing) uv.x = (vId < 0.5 || (vId > 1.5 && vId < 2.5)) ? ${(1024 / AW).toFixed(4)} - uv.x : 1.5 - uv.x;
    vec4 tx = texture2D(uMap, uv);
    if (tx.a < 0.45) discard;
    c = tx.rgb;
  } else if (vKind > 1.5) {
    c = vec3(1.0, 0.7, 0.3) * (1.1 + 0.3 * sin(uTime * 17.0 + vId * 5.0));
  } else if (vKind > 0.5) {
    c = vec3(0.12, 0.08, 0.05);
  } else {
    float g = fract(vUv.x * 12.0);
    c = mix(vA, vB, step(0.5, g));
    float inner = 0.55 + 0.75 * exp(-pow((vUv.y - 0.25) * 2.2, 2.0));
    c *= inner * (0.95 + 0.25 * uPulse) * (0.92 + 0.08 * sin(uTime * 9.0 + vId * 3.0));
  }
  gl_FragColor = vec4(c, vAlpha);
}`;

const SPARK_VERT = /* glsl */ `
uniform float uTime; uniform float uPx; uniform float uE;
attribute vec4 aSeed; // pha, tốc độ nháy, kích thước, thời điểm xuất hiện
varying vec3 vCol;
void main(){
  float age = uE - aSeed.w;
  float life = smoothstep(0.0, 0.6, age) * (1.0 - smoothstep(${(DUR - 4).toFixed(1)}, ${DUR.toFixed(1)}, uE));
  float tw = pow(0.5 + 0.5 * sin(uTime * aSeed.y + aSeed.x), 3.0);
  vCol = color * life * (0.3 + 1.2 * tw);
  vec3 p = position + vec3(0.0, -age * 0.6, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = life > 0.0 ? max(aSeed.z * uPx / -mv.z, 1.5) : 0.0;
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  float star = max(smoothstep(0.12, 0.0, abs(q.x)) , smoothstep(0.12, 0.0, abs(q.y))) * smoothstep(1.0, 0.2, d);
  float a = smoothstep(0.5, 0.0, d) + star * 0.7;
  if (a < 0.02) discard;
  gl_FragColor = vec4(vCol * a, 1.0);
}`;

const LATHE = [
  [0.9, -5.6], [1.4, -4.9], [2.5, -3.6], [3.8, -1.9], [4.8, 0], [5.15, 1.6], [4.95, 3.0], [4.25, 4.3], [3.05, 5.2], [1.6, 5.75], [0.01, 5.95],
];

function remapUv(g: THREE.BufferGeometry, r: { x: number; y: number; w: number; h: number }) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (r.x + uv.getX(i) * r.w) / AW, 1 - (r.y + (1 - uv.getY(i)) * r.h) / AH);
  }
}

function beamGeo(a: THREE.Vector3, b: THREE.Vector3, th: number) {
  const g = new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

export function createFlyby(scene: THREE.Scene, uniforms: Uniforms) {
  const disposables: { dispose(): void }[] = [];

  // Atlas: băng rôn kéo + 4 băng rôn khinh khí cầu
  const canvas = document.createElement('canvas');
  canvas.width = AW; canvas.height = AH;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const draw = () => {
    const texts = getCheerTexts();
    ctx.clearRect(0, 0, AW, AH);
    drawCheerBanner(ctx, TOW.x, TOW.y, TOW.w, TOW.h, `HYPE MAX! 100% ♥ ${texts[0].replace(/♥/g, '').trim()}`, '#ff1f6e');
    BAL_SLOTS.forEach((r, i) => drawCheerBanner(ctx, r.x, r.y, r.w, r.h, texts[BAL_TEXT_IDX[i]], BAL_BANDS[i]));
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  disposables.push(tex, { dispose: off });

  // ── Máy bay cánh quạt + dây kéo + băng rôn (1 mesh, mũi +X cục bộ)
  const pParts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  const addP = (g: THREE.BufferGeometry, kind: number, hex: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    ng.deleteAttribute('normal');
    const n = ng.attributes.position.count;
    col.set(hex);
    const c = new Float32Array(n * 3), k = new Float32Array(n).fill(kind);
    for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3);
    ng.setAttribute('color', new THREE.BufferAttribute(c, 3));
    ng.setAttribute('aKind', new THREE.BufferAttribute(k, 1));
    pParts.push(ng);
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, kind: number, hex: number) => {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); addP(g, kind, hex);
  };
  const fus = new THREE.CylinderGeometry(0.75, 0.45, 9, 12); fus.rotateZ(Math.PI / 2); addP(fus, 0, 0xfff6d8);
  const nose = new THREE.CylinderGeometry(0.35, 0.75, 1.2, 12); nose.rotateZ(-Math.PI / 2); nose.translate(5.1, 0, 0); addP(nose, 0, 0xff2d8a);
  box(3.0, 0.25, 0.9, 0.2, -0.05, 0, 0, 0xff2d8a); // sọc thân
  box(2.2, 0.3, 14, 0.8, 0.85, 0, 0, 0xffd23f); // cánh trên
  box(1.4, 0.18, 5, -4.2, 0.2, 0, 0, 0xff2d8a); // đuôi ngang
  box(1.5, 2.2, 0.18, -4.3, 1.3, 0, 0, 0xffd23f); // đuôi đứng
  box(1.6, 0.6, 0.5, 1.6, 0.45, 0, 0, 0x2a3b66); // kính buồng lái
  box(0.6, 0.45, 0.45, 0.9, 0.85, -7.1, 1, 0xff2020); // đèn trái đỏ
  box(0.6, 0.45, 0.45, 0.9, 0.85, 7.1, 2, 0x20ff50); // đèn phải xanh
  box(0.45, 0.45, 0.45, -4.6, 2.5, 0, 3, 0xffffff); // chớp đuôi
  box(0.45, 0.35, 0.45, 0, -0.85, 0, 3, 0xff3030); // đèn bụng
  const prop = new THREE.CircleGeometry(1.7, 20); prop.rotateY(Math.PI / 2); prop.translate(5.75, 0, 0); addP(prop, 4, 0x555555);
  // dây kéo (2 sợi hội tụ) + cột trước băng rôn
  const tail = new THREE.Vector3(-4.8, -0.3, 0);
  addP(beamGeo(tail, new THREE.Vector3(-13, -0.6, 0), 0.08), 0, 0xdddddd);
  addP(beamGeo(tail, new THREE.Vector3(-13, -6.0, 0), 0.08), 0, 0xdddddd);
  box(0.25, 5.8, 0.25, -13, -3.3, 0, 0, 0x333333);
  const towBan = new THREE.PlaneGeometry(32, 32 * TOW.h / TOW.w, 64, 2);
  remapUv(towBan, TOW);
  towBan.translate(-13 - 16, -3.3, 0);
  addP(towBan, 5, 0xffffff);
  const planeGeo = mergeGeometries(pParts)!;
  pParts.forEach((g) => g.dispose());
  const pU = { uTime: uniforms.uTime, uMap: { value: tex }, uFade: { value: 1 }, uDir: { value: 1 } };
  const planeMat = new THREE.ShaderMaterial({
    uniforms: pU, vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, vertexColors: true, side: THREE.DoubleSide, fog: false,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.frustumCulled = false;
  plane.visible = false;
  scene.add(plane);
  disposables.push(planeGeo, planeMat);

  // ── 4 khinh khí cầu (1 mesh, vị trí từng quả qua uniform uBal)
  const bParts: THREE.BufferGeometry[] = [];
  const ca = new THREE.Color(), cb = new THREE.Color();
  const tag = (g: THREE.BufferGeometry, id: number, kind: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    ng.deleteAttribute('normal');
    const k = ng.attributes.position.count;
    const info = new Float32Array(k * 2), A = new Float32Array(k * 3), B = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) { info[i * 2] = id; info[i * 2 + 1] = kind; A.set([ca.r, ca.g, ca.b], i * 3); B.set([cb.r, cb.g, cb.b], i * 3); }
    ng.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
    ng.setAttribute('aColA', new THREE.BufferAttribute(A, 3));
    ng.setAttribute('aColB', new THREE.BufferAttribute(B, 3));
    bParts.push(ng);
  };
  const S = 1.3;
  const lathe = LATHE.map(([r, y]) => new THREE.Vector2(r * S, y * S));
  for (let id = 0; id < 4; id++) {
    ca.set(BAL_COLS[id][0]); cb.set(BAL_COLS[id][1]);
    tag(new THREE.LatheGeometry(lathe, 28), id, 0);
    const fire = new THREE.CircleGeometry(0.85 * S, 12); fire.rotateX(Math.PI / 2); fire.translate(0, -5.55 * S, 0); tag(fire, id, 2);
    const basket = new THREE.BoxGeometry(1.7 * S, 1.2 * S, 1.7 * S); basket.translate(0, -7.6 * S, 0); tag(basket, id, 1);
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) {
      tag(beamGeo(new THREE.Vector3(dx * 1.1 * S, -5.5 * S, dz * 1.1 * S), new THREE.Vector3(dx * S, -7.0 * S, dz * S), 0.1), id, 1);
    }
    const W = 18, H = W * 256 / 1024, top = -8.2 * S - 1.6;
    tag(beamGeo(new THREE.Vector3(0, -8.2 * S, 0), new THREE.Vector3(-W / 2, top, 0), 0.08), id, 1);
    tag(beamGeo(new THREE.Vector3(0, -8.2 * S, 0), new THREE.Vector3(W / 2, top, 0), 0.08), id, 1);
    tag(beamGeo(new THREE.Vector3(-W / 2 - 0.2, top, 0), new THREE.Vector3(W / 2 + 0.2, top, 0), 0.18), id, 1);
    const ban = new THREE.PlaneGeometry(W, H, 24, 2);
    remapUv(ban, BAL_SLOTS[id]);
    ban.translate(0, top - H / 2 - 0.1, 0);
    tag(ban, id, 3);
  }
  const balGeo = mergeGeometries(bParts)!;
  bParts.forEach((g) => g.dispose());
  const uBal = [0, 1, 2, 3].map(() => new THREE.Vector4(0, -500, 0, 0));
  const balMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uPulse: uniforms.uPulse, uMap: { value: tex }, uBal: { value: uBal } },
    vertexShader: BAL_VERT, fragmentShader: BAL_FRAG, side: THREE.DoubleSide, transparent: true, fog: false,
  });
  const bal = new THREE.Mesh(balGeo, balMat);
  bal.frustumCulled = false;
  bal.visible = false;
  scene.add(bal);
  disposables.push(balGeo, balMat);

  // ── Bụi sao lấp lánh trên trời (Points tĩnh, hoạt ảnh bằng uniform)
  const NS = 320;
  const sp = new Float32Array(NS * 3), sc = new Float32Array(NS * 3), ss = new Float32Array(NS * 4);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < NS; i++) {
    sp.set([(rnd() * 2 - 1) * 110, 42 + rnd() * 45, -60 - rnd() * 80], i * 3);
    col.setHSL([0.92, 0.13, 0.52, 0.8][i % 4] + rnd() * 0.05, 0.9, 0.65);
    sc.set([col.r, col.g, col.b], i * 3);
    ss.set([rnd() * 6.28, 3 + rnd() * 6, 0.8 + rnd() * 1.4, rnd() * 8], i * 4);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 4));
  const uE = { value: 0 };
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uPx: uniforms.uPx, uE }, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const spark = new THREE.Points(sparkGeo, sparkMat);
  spark.frustumCulled = false;
  spark.visible = false;
  spark.renderOrder = 3;
  scene.add(spark);
  disposables.push(sparkGeo, sparkMat);

  plane.scale.setScalar(PLANE_SCALE);
  // +1 = từ trái sang phải của ca sĩ (−X → +X). Cố định theo yêu cầu.
  const dir = 1;
  let armed = true, lastStart = -Infinity, start = -1;
  const begin = (t: number) => {
    if (start >= 0) emitSecret('plane', 'end');
    emitSecret('plane', 'start');
    start = t; lastStart = t;
    plane.visible = bal.visible = spark.visible = true;
  };
  const sm = THREE.MathUtils.smoothstep;
  return {
    update(f: FrameState, t: number) {
      if (consumeFlybyRequest()) begin(t);
      if (f.hype < 0.8) armed = true;
      else if (armed && f.hype >= 0.95 && t - lastStart >= COOLDOWN) { armed = false; begin(t); }
      if (start < 0) return;
      const e = t - start;
      if (e > DUR || e < 0) {
        start = -1;
        plane.visible = bal.visible = spark.visible = false;
        emitSecret('plane', 'end');
        secretFocusState.active = false;
        return;
      }
      uE.value = e;
      // máy bay: băng ngang từ -dir*X → +dir*X trong DUR-1 s
      const u = Math.min(e / (DUR - 1), 1);
      plane.position.set(dir * THREE.MathUtils.lerp(-PLANE_X, PLANE_X, u), PLANE_Y + Math.sin(e * 0.6) * 0.8, PLANE_Z + Math.sin(e * 0.25) * 2);
      plane.rotation.set(Math.sin(e * 0.9) * 0.06, dir > 0 ? 0 : Math.PI, Math.sin(e * 0.6) * 0.03);
      // điểm nhìn: giữa máy bay và băng rôn
      secretFocusState.v.set(plane.position.x - 20 * PLANE_SCALE, PLANE_Y - 3, PLANE_Z);
      secretFocusState.active = true;
      pU.uFade.value = sm(e, 0, 0.6) * (1 - sm(e, DUR - 0.6, DUR));
      // khinh khí cầu: bay lên từ sau khán đài, trôi ngang, rồi bay cao và mờ đi
      const rise = sm(e, 0, 5.5);
      const leave = sm(e, DUR - 4.5, DUR);
      for (let i = 0; i < 4; i++) {
        const v = uBal[i];
        const drift = dir * Math.max(0, e - 3 - i * 0.3) * 2.4;
        v.set(
          BAL_X[i] + drift,
          THREE.MathUtils.lerp(4, 53 + BAL_DY[i], rise) + leave * 28,
          THREE.MathUtils.lerp(-128, -94, rise) - leave * 30,
          sm(e, 0.2, 1.5) * (1 - leave),
        );
      }
    },
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}
