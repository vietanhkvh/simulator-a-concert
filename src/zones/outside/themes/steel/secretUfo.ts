// ★ S4 · "Cầu gương 12 m" (STYLE_C §5) — khe `secretUfo` của phong cách steel.
// Cần cẩu tháp (cột giàn thép chữ X dựng ở khán đài trái, tay cần giàn tam giác, xe con, xích, móc) vung một QUẢ CẦU GƯƠNG
// đường kính 12 m (lưới ô vuông phẳng, mỗi ô một sắc thép, ô ngẫu nhiên loé trắng nung khi quay, nửa dưới hắt lửa) ra giữa sân,
// hạ xuống ~24 m, quay nhanh dần; 64 tia sáng hẹp quét sân vận động (hồ quang → tungsten → cam/đỏ "Lửa lớn"), mỗi tia chiếu
// một đốm tròn trôi trên khán giả / khán đài (48 đốm); đập theo phách, cú quay bứt tốc, rồi kéo lên, cần quay ra ngoài và
// cột thu xuống (RA KHỎI khung hình, không đứng rồi biến). Chữ ký: vòng tia lửa + 6 tàn lửa quay quanh cầu khi tới nơi.
// Biên đạo (D = 20 s như bản mặc định):
//   0–2,2 s cột trồi lên · 2,2–6,2 s tay cần quay vào (cầu đung đưa) · 6,2–8 s hạ xích · 8–16 s quay + tia (8 arc, 10,5
//   tungsten, 13 lửa; bứt tốc 14,3–16) · 16–17,5 s kéo lên · 17–19,3 s quay ra · 18,8–20 s cột thu xuống.
// Draw call khi chạy: cần cẩu (1 InstancedMesh gộp) + cầu (1) + tia (1) + đốm (1) + tia lửa (1) = 5; rảnh 0.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { disposeTree, makePoints, pxScale, seededRnd } from '../../secretShared';
import { M, Parts, SPARK_SQ_FRAG, gl3, makePartsMesh, makeSteelMaterial, sramp, v3 } from './secretDragonKit';

const D = 20;
const MAST = new THREE.Vector3(-92, -3.5, -40);
const MAST_H = 62, JIB = 92, R = 6, NR = 64, NSPOT = 48;
const FIELD_Y = -3.5;

const sm = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

function buildCrane(): THREE.BufferGeometry {
  const p = new Parts();
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // 0 cột giàn: 4 thanh góc + giằng chữ X mỗi 4 m
  p.curPart = 0;
  const w = 1.4;
  const cs = [[-w, -w], [w, -w], [w, w], [-w, w]] as const;
  for (const [x, z] of cs) p.beam(V(x, 0, z), V(x, MAST_H, z), 0.32, 0.32, M.plate, V(0, 0, 1));
  for (let y = 0; y < MAST_H - 1; y += 4) {
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = cs[i]!, [x1, z1] = cs[(i + 1) % 4]!;
      p.beam(V(x0, y, z0), V(x1, y + 4, z1), 0.14, 0.14, M.dark, V(0, 1, 0));
      p.beam(V(x1, y, z1), V(x0, y + 4, z0), 0.14, 0.14, M.dark, V(0, 1, 0));
    }
  }
  // 1 tay cần (gốc = đỉnh cột, dọc +x), đối trọng phía −x, cabin, chóp
  p.curPart = 1;
  const h = 2.2;
  const tri = [V(0, 0, -1.1), V(0, 0, 1.1), V(0, h, 0)];
  for (const q of tri) p.beam(q.clone().setX(-22), q.clone().setX(JIB), 0.3, 0.3, M.plate, V(0, 1, 0));
  for (let x = -22; x < JIB; x += 3) {
    p.beam(V(x, 0, -1.1), V(x + 3, h, 0), 0.12, 0.12, M.dark, V(0, 0, 1));
    p.beam(V(x, 0, 1.1), V(x + 3, h, 0), 0.12, 0.12, M.dark, V(0, 0, 1));
    p.beam(V(x, 0, -1.1), V(x + 3, 0, 1.1), 0.1, 0.1, M.dark);
  }
  for (let x = 4; x < JIB; x += 12) p.beam(V(x, h + 0.02, 0), V(x + 6, h + 0.02, 0), 0.5, 0.06, M.hazard); // sọc cảnh báo
  p.loft([[V(-21, -2.5, -1.6), V(-21, -2.5, 1.6), V(-21, 0, 1.6), V(-21, 0, -1.6)], [V(-15, -2.5, -1.6), V(-15, -2.5, 1.6), V(-15, 0, 1.6), V(-15, 0, -1.6)]], M.dark);
  p.loft([[V(-1.5, -3, -1.5), V(-1.5, -3, 1.5), V(-1.5, 0, 1.5), V(-1.5, 0, -1.5)], [V(1.5, -3, -1.5), V(1.5, -3, 1.5), V(1.5, 0, 1.5), V(1.5, 0, -1.5)]], [M.plate, M.plate, M.eye, M.plate]);
  p.spike(V(0, h, 0), V(0, 9, 0), 1.0, M.plate, 4, Math.PI / 4);
  p.beam(V(0, 9, 0), V(JIB * 0.6, h, 0), 0.1, 0.1, M.chrome);
  p.beam(V(0, 9, 0), V(-21, 0, 0), 0.1, 0.1, M.chrome);
  // xe con
  p.beam(V(JIB - 2, -0.2, 0), V(JIB + 0.5, -0.2, 0), 1.6, 0.8, M.hazard);
  // 2 xích: mắt xích hộp xoay xen kẽ, chiều dài 1 (scale y)
  p.curPart = 2;
  for (let k = 0; k < 10; k++) {
    const y0 = -k * 0.1, y1 = y0 - 0.1;
    p.beam(V(0, y0, 0), V(0, y1, 0), k % 2 ? 0.25 : 0.08, k % 2 ? 0.08 : 0.25, M.chrome, V(0, 0, 1));
  }
  // 3 móc: khối ròng rọc + móc chữ J
  p.curPart = 3;
  p.loft([[V(-0.8, -1.4, -0.5), V(0.8, -1.4, -0.5), V(0.8, -1.4, 0.5), V(-0.8, -1.4, 0.5)], [V(-0.6, 0, -0.4), V(0.6, 0, -0.4), V(0.6, 0, 0.4), V(-0.6, 0, 0.4)]], [M.hazard, M.dark, M.hazard, M.dark]);
  p.beam(V(0, -1.4, 0), V(0, -2.2, 0), 0.3, 0.3, M.chrome, V(0, 0, 1));
  p.beam(V(0, -2.2, 0), V(0.7, -2.6, 0), 0.3, 0.3, M.chrome, V(0, 0, 1));
  p.beam(V(0.7, -2.6, 0), V(0.5, -2.0, 0), 0.25, 0.25, M.chrome, V(0, 0, 1));
  return p.geometry();
}

/** Cầu ô vuông: 16 vĩ × 32 kinh, mỗi ô 2 tam giác riêng; aF = id ngẫu nhiên, aUV = toạ độ trong ô (ron). */
function buildBall(): THREE.BufferGeometry {
  const LAT = 16, LON = 32;
  const pos: number[] = [], f: number[] = [], uv: number[] = [];
  const rnd = seededRnd(311);
  const pt = (i: number, j: number) => {
    const th = -Math.PI / 2 + (i / LAT) * Math.PI, ph = (j / LON) * Math.PI * 2;
    return [R * Math.cos(th) * Math.cos(ph), R * Math.sin(th), R * Math.cos(th) * Math.sin(ph)];
  };
  for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
    const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j);
    const id = rnd();
    const q = [[a, 0, 0], [c, 1, 1], [b, 1, 0], [a, 0, 0], [d, 0, 1], [c, 1, 1]] as const;
    for (const [P, u, v] of q) { pos.push(...P); f.push(id); uv.push(u, v); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aF', new THREE.Float32BufferAttribute(f, 1));
  g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const BALL_VERT = /* glsl */ `
attribute float aF; attribute vec2 aUV;
varying vec3 vW; varying float vF; varying vec2 vUV; varying float vNy;
void main(){ vF = aF; vUV = aUV; vNy = normalize(position).y; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const ballFrag = () => {
  const steel = sramp('steel'), coal = sramp('coal'), arc = sramp('arc'), ember = sramp('ember'), flame = sramp('flame'), wh = sramp('whitehot');
  return /* glsl */ `
uniform float uT; uniform float uFlash; uniform float uFire; uniform float uPulse; uniform vec3 uRayCol;
varying vec3 vW; varying float vF; varying vec2 vUV; varying float vNy;
void main(){
  vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  vec3 Rf = reflect(-V, N);
  float tone = fract(vF * 13.7);
  vec3 c = mix(${gl3(coal[100])}, ${gl3(steel[100])}, 0.15 + 0.6 * tone);
  c *= 0.55 + 0.45 * max(dot(N, normalize(vec3(-0.35, 1.0, 0.25))), 0.0);
  c += ${gl3(arc[500])} * pow(max(Rf.y, 0.0), 4.0) * 0.35;
  c += uRayCol * pow(max(dot(Rf, normalize(vec3(0.3, 0.2, 1.0))), 0.0), 6.0) * 0.5;
  // nửa dưới hắt lửa
  float low = smoothstep(0.15, -0.75, vNy);
  c = mix(c, mix(${gl3(ember[500])}, ${gl3(flame[500])}, tone) * (0.7 + 0.5 * tone), low * (0.35 + 0.55 * uFire));
  // ô loé trắng nung khi quay
  float k = fract(sin(vF * 91.3 + floor(uT * 4.0 + vF * 9.0) * 17.1) * 4375.5);
  float fl = step(1.0 - 0.04 - 0.12 * uFlash, k);
  c = mix(c, ${gl3(wh[100])}, fl * (0.55 + 0.45 * uPulse));
  float e = min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y));
  c *= e < 0.06 ? 0.3 : 1.0;
  gl_FragColor = vec4(c, 1.0);
}`;
};

/** Điểm chạm của tia (sân phẳng y = −3,5 trong r < 84, ngoài đó khán đài dốc lên). */
const HIT_GLSL = /* glsl */ `
float hitT(vec3 o, vec3 d){
  if (d.y > -0.03) return 120.0;
  float t = (${FIELD_Y.toFixed(1)} - o.y) / d.y;
  for (int i = 0; i < 3; i++) {
    vec3 h = o + d * t;
    float r = length(h.xz - vec2(0.0, -10.0));
    float gy = ${FIELD_Y.toFixed(1)} + max(r - 84.0, 0.0) * 0.6;
    t = (gy - o.y) / d.y;
  }
  return min(t, 140.0);
}`;

const RAY_VERT = /* glsl */ `
uniform mat3 uRot; uniform vec3 uO;
attribute vec3 aDir; attribute vec3 aE; // (đầu 0/1, cạnh −1/1, id)
varying float vA; varying float vS; varying float vK;
${HIT_GLSL}
void main(){
  vec3 d = normalize(uRot * aDir);
  float L = hitT(uO, d);
  vec3 p = uO + d * (${(R * 0.95).toFixed(2)} + aE.x * (L - ${(R * 0.95).toFixed(2)}));
  vec3 side = normalize(cross(d, normalize(cameraPosition - p)));
  p += side * aE.y * (0.08 + aE.x * 0.55);
  vA = 1.0 - aE.x * 0.75; vS = aE.y; vK = aE.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAY_FRAG = /* glsl */ `
uniform float uA; uniform vec3 uRayCol; uniform vec3 uRayCol2; uniform float uPulse;
varying float vA; varying float vS; varying float vK;
void main(){
  vec3 c = mod(vK, 2.0) < 0.5 ? uRayCol : uRayCol2;
  float edge = 1.0 - abs(vS);
  gl_FragColor = vec4(c * vA * edge * uA * (0.55 + 0.3 * uPulse), 1.0);
}`;
const SPOT_VERT = /* glsl */ `
uniform mat3 uRot; uniform vec3 uO;
attribute vec3 aDir; attribute vec3 aC; // (góc x, góc y, id)
varying vec2 vC; varying float vK;
${HIT_GLSL}
void main(){
  vec3 d = normalize(uRot * aDir);
  float L = hitT(uO, d);
  vec3 h = o_dummy(uO) + d * L;
  vec2 rv = h.xz - vec2(0.0, -10.0);
  float r = length(rv);
  vec3 n = normalize(vec3(0.0, 1.0, 0.0) + (r > 84.0 ? vec3(-rv.x / r, 0.0, -rv.y / r) * 0.6 : vec3(0.0)));
  vec3 t1 = normalize(cross(n, vec3(0.0, 0.0, 1.0)));
  vec3 t2 = cross(n, t1);
  float s = 1.0 + L * 0.03;
  vec3 p = h + n * 0.3 + (t1 * aC.x + t2 * aC.y) * s;
  vC = aC.xy; vK = aC.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`.replace('o_dummy(uO)', 'uO');
const SPOT_FRAG = /* glsl */ `
uniform float uA; uniform vec3 uRayCol; uniform vec3 uRayCol2; uniform float uPulse;
varying vec2 vC; varying float vK;
void main(){
  float r = length(vC);
  if (r > 1.0) discard;
  vec3 c = mod(vK, 2.0) < 0.5 ? uRayCol : uRayCol2;
  float a = r > 0.8 ? 1.0 : 0.55;
  gl_FragColor = vec4(c * a * uA * (0.6 + 0.4 * uPulse), 1.0);
}`;

const SPARK_VERT = /* glsl */ `
uniform float uT; uniform float uPx; uniform vec3 uO; uniform float uRing; uniform float uFall;
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
void main(){
  float r1 = aSeed.z, r2 = aSeed.w;
  vec3 p; float a; float sz;
  if (aSeed.x < 0.5) { // vòng tia lửa chữ ký + 6 tàn lửa quay
    bool big = r2 < 0.04;
    float ang = r1 * 6.2831853 + (big ? -1.8 : 0.9) * uT;
    float rad = big ? 11.0 : 8.5 + 0.4 * sin(r2 * 40.0 + uT * 7.0);
    p = uO + vec3(cos(ang) * rad, (big ? 1.5 : 0.0) + 0.3 * sin(r2 * 70.0 + uT * 5.0), sin(ang) * rad);
    a = uRing * (0.6 + 0.4 * step(0.5, fract(r2 * 9.0 + uT * 2.5)));
    sz = big ? 1.4 : 0.6;
  } else { // tia lửa rơi từ nửa dưới cầu ("Lửa lớn")
    float s = fract(uT * (0.35 + 0.3 * r2) + r1);
    float an = r1 * 6.2831853 * 7.0;
    vec3 o = vec3(cos(an), -0.4 - 0.5 * r2, sin(an)) * ${R.toFixed(1)};
    p = uO + o + vec3(cos(an), 0.0, sin(an)) * s * 6.0 + vec3(0.0, -22.0 * s * s, 0.0);
    a = uFall * (1.0 - s);
    sz = 0.45;
  }
  vColor = aColor; vAlpha = clamp(a, 0.0, 1.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAlpha < 0.004 ? 0.0 : clamp(uPx * sz / -mv.z, 1.5, 40.0);
}`;

function createMirrorBall(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const arc = sramp('arc'), tung = sramp('tungsten'), flame = sramp('flame'), blood = sramp('blood'), wh = sramp('whitehot'), ember = sramp('ember');

  // ── cần cẩu
  const cgeo = buildCrane();
  const { mat: cmat, uniforms: CU } = makeSteelMaterial();
  CU.uBase.value[0]!.copy(v3(sramp('steel')[500]));
  CU.uRimK.value = 0.35;
  const crane = makePartsMesh(cgeo, cmat, [[0, 0], [1, 0], [2, 0], [3, 0]]);
  root.add(crane);

  // ── cầu gương
  const bgeo = buildBall();
  const BU = { uT: { value: 0 }, uFlash: { value: 0 }, uFire: { value: 0 }, uPulse: { value: 0 }, uRayCol: { value: v3(arc[500]) } };
  const ball = new THREE.Mesh(bgeo, new THREE.ShaderMaterial({ vertexShader: BALL_VERT, fragmentShader: ballFrag(), uniforms: BU, fog: false }));
  ball.frustumCulled = false;
  root.add(ball);

  // ── 64 tia + 48 đốm
  const rnd = seededRnd(6427);
  const dirs: THREE.Vector3[] = [];
  for (let i = 0; i < NR; i++) {
    const y = i < NSPOT ? -0.18 - 0.62 * Math.sqrt(rnd()) : -0.15 + 0.6 * rnd();
    const az = rnd() * Math.PI * 2, c = Math.sqrt(1 - y * y);
    dirs.push(new THREE.Vector3(Math.cos(az) * c, y, Math.sin(az) * c));
  }
  const rp: number[] = [], rd: number[] = [], re: number[] = [], ri: number[] = [];
  dirs.forEach((d, i) => {
    const b = i * 4;
    for (const [e, s] of [[0, -1], [0, 1], [1, -1], [1, 1]] as const) { rp.push(0, 0, 0); rd.push(d.x, d.y, d.z); re.push(e, s, i); }
    ri.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  });
  const rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  rgeo.setAttribute('aDir', new THREE.Float32BufferAttribute(rd, 3));
  rgeo.setAttribute('aE', new THREE.Float32BufferAttribute(re, 3));
  rgeo.setIndex(ri);
  const RU = { uRot: { value: new THREE.Matrix3() }, uO: { value: new THREE.Vector3() }, uA: { value: 0 }, uRayCol: BU.uRayCol, uRayCol2: { value: v3(arc[300]) }, uPulse: BU.uPulse };
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false } as const;
  const rays = new THREE.Mesh(rgeo, new THREE.ShaderMaterial({ vertexShader: RAY_VERT, fragmentShader: RAY_FRAG, uniforms: RU, ...add }));
  rays.frustumCulled = false;
  rays.renderOrder = 6;
  root.add(rays);
  const sp: number[] = [], sd: number[] = [], sc: number[] = [], si: number[] = [];
  for (let i = 0; i < NSPOT; i++) {
    const d = dirs[i]!, b = i * 4;
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) { sp.push(0, 0, 0); sd.push(d.x, d.y, d.z); sc.push(x, y, i); }
    si.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sgeo.setAttribute('aDir', new THREE.Float32BufferAttribute(sd, 3));
  sgeo.setAttribute('aC', new THREE.Float32BufferAttribute(sc, 3));
  sgeo.setIndex(si);
  const spots = new THREE.Mesh(sgeo, new THREE.ShaderMaterial({ vertexShader: SPOT_VERT, fragmentShader: SPOT_FRAG, uniforms: RU, ...add }));
  spots.frustumCulled = false;
  spots.renderOrder = 5;
  root.add(spots);

  // ── tia lửa
  const PU = { uT: { value: 0 }, uPx: { value: 720 }, uO: RU.uO, uRing: { value: 0 }, uFall: { value: 0 } };
  const cols = [wh[100], wh[300], flame[300], flame[500], ember[300]];
  const sparks = makePoints(420, SPARK_VERT, PU, (i, s, c) => {
    s.set([i < 180 ? 0 : 1, 0, rnd(), rnd()], i * 4);
    c.set(v3(cols[Math.floor(rnd() * cols.length)]!).toArray(), i * 3);
  }, { frag: SPARK_SQ_FRAG });
  sparks.renderOrder = 7;
  root.add(sparks);

  const m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const tip = new THREE.Vector3(), bc = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const foc = new THREE.Vector3(), focRaw = new THREE.Vector3(), MID = new THREE.Vector3(-34, 34, -40);
  const cA = v3(arc[500]), cA2 = v3(arc[300]), cT = v3(tung[500]), cT2 = v3(tung[300]), cF = v3(flame[500]), cF2 = v3(blood[100]);
  let lastT = -1, spin = 0;

  return {
    duration: D,
    start() { root.visible = true; lastT = -1; spin = 0; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      const dt = lastT < 0 || t < lastT ? 0 : t - lastT;
      if (dt === 0 && (lastT < 0 || t < lastT)) spin = 0;
      const rise = -66 * (1 - sm(0, 2.2, t)) - 66 * sm(18.8, 20, t);
      const th = Math.PI + Math.PI * sm(2.2, 6.2, t) - Math.PI * sm(17, 19.3, t);
      const swing = (t > 2.2 ? 0.16 * Math.sin(2.3 * (t - 2.2)) * Math.exp(-0.45 * Math.max(0, t - 5.2)) : 0)
        + (t > 17 ? -0.12 * Math.sin(2.3 * (t - 17)) * Math.exp(-0.5 * Math.max(0, t - 18.5)) : 0);
      const L = 6 + 20 * sm(6.2, 8, t) - 20 * sm(16, 17.5, t);
      // cột
      m4.makeTranslation(MAST.x, MAST.y + rise, MAST.z);
      crane.setMatrixAt(0, m4);
      // tay cần (quay quanh trục đứng: +x cục bộ → (cos th, 0, sin th))
      const top = MAST.y + rise + MAST_H;
      m4.makeRotationY(-th).setPosition(MAST.x, top, MAST.z);
      crane.setMatrixAt(1, m4);
      tip.set(MAST.x + Math.cos(th) * JIB, top - 0.6, MAST.z + Math.sin(th) * JIB);
      // xích + móc (đu đưa quanh trục tay cần)
      e.set(swing, -th, 0, 'YXZ');
      q.setFromEuler(e);
      m5.compose(tip, q, one.set(1, L, 1));
      crane.setMatrixAt(2, m5);
      bc.set(0, -L, 0).applyQuaternion(q).add(tip);
      m5.compose(bc, q, one.set(1.4, 1.4, 1.4));
      crane.setMatrixAt(3, m5);
      crane.instanceMatrix.needsUpdate = true;
      bc.set(0, -L - 3.1 - R, 0).applyQuaternion(q).add(tip);
      // quay: chậm → nhanh dần → bứt tốc → chậm
      const w = 0.25 + 0.55 * sm(7, 9, t) + 2.4 * sm(14.3, 14.8, t) * (1 - sm(15.8, 16.4, t)) - 0.5 * sm(16, 17.5, t);
      spin += w * dt;
      ball.position.copy(bc);
      ball.quaternion.copy(q);
      ball.rotateY(spin);
      // tia: màu theo pha
      const env = sm(7.8, 8.8, t) * (1 - sm(15.8, 16.6, t));
      const k1 = sm(10.3, 10.9, t), k2 = sm(12.8, 13.4, t);
      BU.uRayCol.value.copy(cA).lerp(cT, k1).lerp(cF, k2);
      RU.uRayCol2.value.copy(cA2).lerp(cT2, k1).lerp(cF2, k2);
      RU.uA.value = env;
      rays.visible = spots.visible = env > 0.002;
      RU.uRot.value.setFromMatrix4(ball.matrix.compose(ball.position, ball.quaternion, one.set(1, 1, 1)));
      RU.uO.value.copy(bc);
      BU.uPulse.value = f.beatPulse;
      BU.uT.value = PU.uT.value = t;
      BU.uFlash.value = Math.min(1, w / 1.2);
      BU.uFire.value = k2 * (1 - sm(16, 18, t));
      PU.uPx.value = pxScale();
      PU.uRing.value = sm(7.4, 8.2, t) * (1 - sm(10.5, 11.5, t));
      PU.uFall.value = k2 * (1 - sm(15.8, 16.5, t));
      // điểm nhìn: theo cầu khi vào sân, nghiêng xuống đám đông khi có tia
      focRaw.copy(MID).lerp(bc, sm(3.5, 6.5, t) * (1 - sm(17.5, 19.5, t)));
      focRaw.y -= 4 * env;
      const snap = lastT < 0 || t < lastT;
      foc.lerp(focRaw, snap ? 1 : 1 - Math.exp(-dt * 2.5));
      lastT = t;
    },
    focus(_t: number, out: THREE.Vector3) { out.copy(foc); },
    dispose() {
      cgeo.dispose();
      disposeTree(root);
    },
  };
}

export const builders: Partial<OutsideBuilders> = { secretUfo: createMirrorBall };
