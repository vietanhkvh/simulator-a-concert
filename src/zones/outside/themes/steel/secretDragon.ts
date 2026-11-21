// ★ S4 · "Rồng cơ khí" (STYLE_C §5) — khe `secretDragon` của phong cách steel.
// Hai rồng cơ khí đẽo thép phẳng mặt: đầu nêm góc cạnh, hàm dưới bản lề, hàng răng tam giác đỏ nung, tấm mắt trắng nung,
// sừng = ống xả vuốt ngược phun tia lửa, piston cổ; thân 30 đốt hình thang nối bản lề (bu-lông chrome), khe lò đỏ giữa
// các tấm đập theo phách, lưỡi lưng đỏ huyết, 4 chân thuỷ lực có vuốt, đuôi chuỳ gai. A = thép xước, B = đen lì khe than hồng.
// Biên đạo (D = 24 s như bản mặc định; hai đường đối xứng gương qua x = 0, lệch cao ±4,5 m ⇒ không bao giờ xuyên nhau):
//   0–4 s     lao vào từ hai bên (A từ +x, B từ −x), vòng tia lửa chữ ký quanh mỗi đầu; cắt chéo nhau trên sân
//   4–11 s    lượn ¾ vòng quanh B-stage (tâm (0,·,−44), R 18) NGƯỢC chiều nhau, đốt thân lắc khục khặc từng nhịp
//   11–13,5 s chúc xuống rồi CHỒM lên (thân treo chữ S dưới đầu) → 14–17,6 s PHUN LỬA chéo lên trên-vào trong: hai luồng
//             lửa khối 3 lớp (lõi trắng nung · lửa cam · vỏ than hồng, các bậc đẽo) bắt chéo thành chữ X trên sân, tia lửa + khói
//   18–24 s   vòng ra sau, bổ nhào ra hai phía, kéo vệt tia lửa.
// Draw call khi chạy: thân/đầu/hàm/chân/đuôi cả hai rồng (1 InstancedMesh) + lửa (1) + tia lửa (1) + khói (1) = 4; rảnh 0.
// Mỗi khung: chỉ ma trận instance + uniform.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import type { OutsideBuilders } from '../../builders';
import { buildDragonPath } from '../../secretDragon';
import { type SecretAct, disposeTree, makePoints, pxScale, seededRnd } from '../../secretShared';
import { History, SMOKE_FRAG, SPARK_SQ_FRAG, gl3, makePartsMesh, makeSteelMaterial, sramp, v3 } from './secretDragonKit';
import { HORN_TIP, JAW_HINGE, MOUTH, P_HEAD, P_JAW, P_LEG, P_SEG, P_TAIL, buildFlameJet, buildMechDragon } from './secretDragonGeo';

const D = 24;
const T_H0 = 13.6, T_H1 = 18;
const T_F0 = 14.0, T_F1 = 17.6;
const DY = 4.5;
const NJ = 30; // số đốt
const SP = 1.4; // khoảng khớp
const HS = 2.0; // tỉ lệ đầu
const LEG_SEG = [4, 15];
const JET_L = 24;
const HN = 24, HSTEP = 0.18; // lịch sử vị trí đầu (tia lửa vệt / khói)

const sm = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Đường gốc (rồng A, vào từ +x) + hệ số lệch cao (A +DY·dy, B −DY·dy). */
function basePath() {
  const p: [number, number, number][] = [[118, 47, -16], [86, 45, -20], [54, 43, -23], [24, 41, -27]];
  const dy: number[] = [1, 1, 1, 1];
  const R = 17, N = 14;
  for (let i = 1; i <= N; i++) {
    const ph = -(i / N) * 2.5 * Math.PI; // 1¼ vòng, kết thúc ở điểm tây, mũi hướng −z
    p.push([R * Math.sin(ph), 40 - (i / N) * 15, -44 + R * Math.cos(ph)]);
    dy.push(1);
  }
  // chúc xuống, rồi chồm lên chéo vào trong (mặt phẳng z ≈ −59, xa máy ca sĩ ⇒ nằm dưới mép mái)
  p.push([-16.5, 24.5, -52], [-13.8, 22, -56.2], [-11.6, 24.6, -58.4]);
  dy.push(0.85, 0.7, 0.55);
  const iHold = p.length;
  p.push([-9.8, 28.6, -59]);
  dy.push(0.45);
  p.push([-8.6, 32.4, -60.6], [-9.6, 35.5, -64.5], [-16, 37, -70.5], [-30, 34, -80], [-55, 30, -92], [-90, 27, -104], [-135, 24, -115], [-185, 22, -125]);
  for (let i = 0; i < 8; i++) dy.push(0.45 + 0.55 * Math.min(1, i / 3));
  return { p, dy, iHold };
}

type Path = ReturnType<typeof buildDragonPath>;
const nOf = (P: Path) => P.pos.length / 4;
function rowAt(A: Float32Array, n: number, len: number, d: number, out: THREE.Vector3) {
  const x = Math.min(1, Math.max(0, d / len)) * (n - 1);
  const a = Math.floor(x), b = Math.min(a + 1, n - 1), f = x - a;
  return out.set(A[a * 4]! + (A[b * 4]! - A[a * 4]!) * f, A[a * 4 + 1]! + (A[b * 4 + 1]! - A[a * 4 + 1]!) * f, A[a * 4 + 2]! + (A[b * 4 + 2]! - A[a * 4 + 2]!) * f);
}
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3();
function pathPos(P: Path, d: number, out: THREE.Vector3) {
  const n = nOf(P), ds = P.len / (n - 1);
  if (d < 0) { rowAt(P.pos, n, P.len, 0, _p0); rowAt(P.pos, n, P.len, ds, _p1); return out.copy(_p0).addScaledVector(_p0.sub(_p1), -d / ds); }
  if (d > P.len) { rowAt(P.pos, n, P.len, P.len, _p0); rowAt(P.pos, n, P.len, P.len - ds, _p1); return out.copy(_p0).addScaledVector(_p0.sub(_p1), (d - P.len) / ds); }
  return rowAt(P.pos, n, P.len, d, out);
}

/** Hai đường + khoảng cách tới điểm chồm. Xuất cho harness. */
export function mechPaths() {
  const { p, dy, iHold } = basePath();
  const A0 = p.map(([x, y, z], i) => [x, y + DY * dy[i]!, z] as [number, number, number]);
  const B0 = p.map(([x, y, z], i) => [-x, y - DY * dy[i]!, z] as [number, number, number]);
  const paths = [buildDragonPath(A0, 15), buildDragonPath(B0, 15)];
  const a = new THREE.Vector3();
  const hold = paths.map((P, id) => {
    const tgt = new THREE.Vector3(...(id === 0 ? A0 : B0)[iHold]!);
    const n = nOf(P), ds = P.len / (n - 1);
    let bi = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = a.set(P.pos[i * 4]!, P.pos[i * 4 + 1]!, P.pos[i * 4 + 2]!).distanceTo(tgt);
      if (d < bd) { bd = d; bi = i; }
    }
    return bi * ds;
  });
  return { paths, hold };
}
/** Khoảng cách đầu: chậm dần vào thế chồm, đứng (rung nhẹ), rồi tăng tốc bổ nhào. */
function headDist(t: number, dHold: number, len: number) {
  if (t <= T_H0) {
    const x = Math.max(0, t) / T_H0;
    return dHold * (x + x * x - x * x * x);
  }
  if (t <= T_H1) return dHold + 0.4 * Math.sin(((t - T_H0) / (T_H1 - T_H0)) * Math.PI);
  const x = (t - T_H1) / (D - T_H1);
  return dHold + Math.min(len - dHold - 2, 150) * x * x;
}

const PTS_VERT = (hn: number) => /* glsl */ `
uniform float uT; uniform float uPx; uniform vec3 uHead[2]; uniform vec3 uHS[2]; uniform vec3 uHU[2];
uniform vec3 uMouth[2]; uniform vec3 uDir[2]; uniform float uJet; uniform float uJetL; uniform float uRing;
uniform vec3 uHist[${hn * 2}]; uniform float uHFrac; uniform vec2 uTrail;
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
void main(){
  int g = int(aSeed.x + 0.5); int id = aSeed.y < 0.5 ? 0 : 1;
  float r1 = aSeed.z, r2 = aSeed.w;
  vec3 p = vec3(0.0); float a = 0.0; float sz = 0.5;
  if (g == 0) { // vòng tia lửa chữ ký quanh đầu + 6 tàn lửa quay
    bool big = r2 < 0.07;
    float ang = r1 * 6.2831853 + (big ? -2.4 : 1.3) * uT;
    float rad = (big ? 5.6 : 3.6 + 1.6 * uRing) + 0.25 * sin(r2 * 60.0 + uT * 9.0);
    p = uHead[id] + (uHS[id] * cos(ang) + uHU[id] * sin(ang)) * rad;
    a = uRing * (0.6 + 0.4 * step(0.5, fract(r2 * 7.0 + uT * 3.0)));
    sz = big ? 1.1 : 0.55;
  } else if (g == 1) { // tia lửa bắn theo luồng lửa
    vec3 d = uDir[id];
    vec3 p1 = normalize(cross(d, vec3(0.0, 0.0, 1.0)));
    vec3 p2 = cross(d, p1);
    float s = fract(uT * (0.55 + 0.5 * r2) + r1);
    float an = r1 * 57.0;
    p = uMouth[id] + d * s * uJetL * 1.2 + (p1 * cos(an) + p2 * sin(an)) * s * uJetL * (0.12 + 0.2 * r2) + vec3(0.0, -5.0 * s * s, 0.0);
    a = uJet * (1.0 - s) * 1.2;
    sz = 0.5;
  } else { // vệt tia lửa từ lịch sử vị trí đầu (ống xả / bổ nhào)
    float k = floor(r1 * ${hn.toFixed(1)});
    float age = (k + r2) * ${HSTEP.toFixed(3)} + uHFrac;
    vec3 base = uHist[id * ${hn} + int(k)];
    vec3 dr = vec3(fract(r1 * 91.3) - 0.5, fract(r2 * 53.1) - 0.3, fract(r1 * 17.7 + r2) - 0.5);
    p = base + dr * age * 5.0 + vec3(0.0, -2.2 * age * age, 0.0);
    a = (id == 0 ? uTrail.x : uTrail.y) * (1.0 - age / ${(hn * HSTEP).toFixed(2)});
    sz = 0.42;
  }
  vColor = aColor; vAlpha = clamp(a, 0.0, 1.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAlpha < 0.004 ? 0.0 : clamp(uPx * sz / -mv.z, 1.5, 40.0);
}`;

const SMOKE_VERT = (hn: number) => /* glsl */ `
uniform float uT; uniform float uPx; uniform vec3 uMouth[2]; uniform vec3 uDir[2]; uniform float uJet; uniform float uJetL;
uniform vec3 uHist[${hn * 2}]; uniform float uHFrac; uniform float uSmoke;
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
void main(){
  int g = int(aSeed.x + 0.5); int id = aSeed.y < 0.5 ? 0 : 1;
  float r1 = aSeed.z, r2 = aSeed.w;
  vec3 p; float a; float sz;
  if (g == 0) { // hơi/khói phụt từ khớp (đọng lại nơi thân đã đi qua)
    float k = floor(r1 * ${hn.toFixed(1)});
    float age = (k + r2) * ${HSTEP.toFixed(3)} + uHFrac;
    p = uHist[id * ${hn} + int(k)] + vec3(fract(r1 * 31.0) - 0.5, 0.6, fract(r2 * 13.0) - 0.5) * age * 2.2;
    float puff = step(0.55, fract(r1 * 7.3 + k * 0.37));
    a = uSmoke * puff * 0.55 * (1.0 - age / ${(hn * HSTEP).toFixed(2)});
    sz = 1.2 + age * 1.1;
  } else { // khói đen trên đầu luồng lửa
    float s = fract(uT * 0.3 + r1);
    vec3 d = uDir[id];
    p = uMouth[id] + d * uJetL * (0.55 + 0.55 * s) + vec3(r2 - 0.5, 0.0, fract(r1 * 9.1) - 0.5) * (2.0 + 6.0 * s) + vec3(0.0, s * 7.0, 0.0);
    a = uJet * 0.6 * sin(s * 3.1416);
    sz = 3.0 + 4.0 * s;
  }
  vColor = aColor; vAlpha = clamp(a, 0.0, 1.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAlpha < 0.004 ? 0.0 : clamp(uPx * sz / -mv.z, 1.5, 90.0);
}`;

const FLAME_VERT = /* glsl */ `
attribute vec3 aFl; uniform float uT; uniform float uGrow;
varying vec3 vW; varying vec3 vFl;
void main(){
  vFl = aFl;
  vec3 p = position;
  float tk = floor(uT * 11.0 + aFl.z * 3.0);
  float j = fract(sin(aFl.z * 91.7 + tk * 13.1 + aFl.x * 7.0) * 4375.5);
  p.xy *= 0.82 + 0.4 * j;
  p *= step(aFl.y, uGrow);
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const flameFrag = () => {
  const blood = sramp('blood'), ember = sramp('ember'), flame = sramp('flame'), wh = sramp('whitehot');
  return /* glsl */ `
uniform float uA;
varying vec3 vW; varying vec3 vFl;
void main(){
  vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
  float tone = 0.8 + 0.3 * fract(sin(dot(floor(N * 7.0 + 0.5), vec3(12.99, 78.23, 37.71))) * 43758.55);
  int L = int(vFl.x + 0.5);
  vec3 c = L == 0 ? mix(${gl3(blood[100])}, ${gl3(ember[500])}, 0.35) * 0.55 : (L == 1 ? ${gl3(flame[500])} * 0.6 : ${gl3(wh[100])} * 0.85);
  if (L == 1 && vFl.y > 0.55) c = ${gl3(flame[300])} * 0.55;
  if (L == 2 && vFl.y > 0.3) c = ${gl3(wh[500])} * 0.75;
  float band = mod(floor(vFl.y * 9.0 + 0.5), 2.0) < 0.5 ? 1.0 : 0.8;
  float fade = 1.0 - floor(vFl.y * 4.0) * 0.16;
  gl_FragColor = vec4(c * tone * band * fade * uA, 1.0);
}`;
};

function createMechDragons(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const { paths, hold } = mechPaths();

  // ── thân rắn: 1 InstancedMesh cho cả hai rồng
  const geo = buildMechDragon();
  const { mat, uniforms: SU } = makeSteelMaterial();
  const sel: [number, number][] = [];
  const idx = [0, 1].map((id) => {
    const seg = sel.length;
    for (let k = 0; k < NJ; k++) sel.push([P_SEG, id]);
    const head = sel.length; sel.push([P_HEAD, id]);
    const jaw = sel.length; sel.push([P_JAW, id]);
    const leg = sel.length; for (let k = 0; k < 4; k++) sel.push([P_LEG, id]);
    const tail = sel.length; sel.push([P_TAIL, id]);
    return { seg, head, jaw, leg, tail };
  });
  const body = makePartsMesh(geo, mat, sel);
  root.add(body);

  // ── lửa: 2 instance của luồng lửa khối
  const fgeo = buildFlameJet();
  const FU = { uT: { value: 0 }, uGrow: { value: 0 }, uA: { value: 1 } };
  const fmat = new THREE.ShaderMaterial({ vertexShader: FLAME_VERT, fragmentShader: flameFrag(), uniforms: FU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const flame = new THREE.InstancedMesh(fgeo, fmat, 2);
  flame.frustumCulled = false;
  flame.renderOrder = 6;
  root.add(flame);

  // ── tia lửa + khói (Points)
  const hist = new History(HN, HSTEP, 2);
  const heads = [new THREE.Vector3(), new THREE.Vector3()], hS = [new THREE.Vector3(), new THREE.Vector3()], hU = [new THREE.Vector3(), new THREE.Vector3()];
  const mouths = [new THREE.Vector3(), new THREE.Vector3()], dirs = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)];
  const horns = [new THREE.Vector3(), new THREE.Vector3()];
  const PU = {
    uT: { value: 0 }, uPx: { value: 720 }, uHead: { value: heads }, uHS: { value: hS }, uHU: { value: hU },
    uMouth: { value: mouths }, uDir: { value: dirs }, uJet: { value: 0 }, uJetL: { value: JET_L }, uRing: { value: 0 },
    uHist: { value: hist.v }, uHFrac: { value: 0 }, uTrail: { value: new THREE.Vector2() }, uSmoke: { value: 0 },
  };
  const flameR = sramp('flame'), wh = sramp('whitehot'), ember = sramp('ember'), coal = sramp('coal'), steel = sramp('steel');
  const rnd = seededRnd(9127);
  const sparkCols = [wh[100], wh[300], flameR[300], flameR[500], ember[300]];
  const groups = [180, 400, 420]; // vòng ký · lửa · vệt
  const nSp = groups[0]! + groups[1]! + groups[2]!;
  const sparks = makePoints(nSp, PTS_VERT(HN), PU, (i, s, c) => {
    const g = i < groups[0]! ? 0 : i < groups[0]! + groups[1]! ? 1 : 2;
    s.set([g, i % 2, rnd(), rnd()], i * 4);
    c.set(v3(sparkCols[Math.floor(rnd() * sparkCols.length)]!).toArray(), i * 3);
  }, { frag: SPARK_SQ_FRAG });
  sparks.renderOrder = 7;
  root.add(sparks);
  const smokeCols = [coal[100], steel[700], coal[300]].map((h) => v3(h).multiplyScalar(0.7).toArray());
  const smoke = makePoints(360, SMOKE_VERT(HN), PU, (i, s, c) => {
    s.set([i < 200 ? 0 : 1, i % 2, rnd(), rnd()], i * 4);
    c.set(smokeCols[i % 3]!, i * 3);
  }, { frag: SMOKE_FRAG, additive: false });
  smoke.renderOrder = 5;
  root.add(smoke);

  // ── scratch
  const J = Array.from({ length: NJ + 1 }, () => new THREE.Vector3());
  const T = new THREE.Vector3(), S = new THREE.Vector3(), U = new THREE.Vector3(), C = new THREE.Vector3(), F = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4(), mHead = new THREE.Matrix4(), mR = new THREE.Matrix4();
  const foc = new THREE.Vector3(), focRaw = new THREE.Vector3(), cross = new THREE.Vector3(0, 40, -59);
  let lastT = -1;

  /** Khung đường tại d: T tiếp tuyến, U lên. */
  function frameAt(P: Path, d: number) {
    pathPos(P, d + 0.8, a); pathPos(P, d - 0.8, b);
    T.subVectors(a, b); T.y += 1e-5; T.normalize();
    rowAt(P.up, nOf(P), P.len, d, U).normalize();
    S.crossVectors(U, T).normalize();
    U.crossVectors(T, S);
  }
  /** Ma trận có trục x = s·sx, y = u·sy, z = f·sz tại o. */
  function basis(out: THREE.Matrix4, s: THREE.Vector3, u: THREE.Vector3, f: THREE.Vector3, o: THREE.Vector3, sx: number, sy: number, sz: number) {
    return out.set(s.x * sx, u.x * sy, f.x * sz, o.x, s.y * sx, u.y * sy, f.y * sz, o.y, s.z * sx, u.z * sy, f.z * sz, o.z, 0, 0, 0, 1);
  }
  const wOf = (k: number) => 1.45 - 0.75 * Math.pow(k / (NJ - 1), 1.3);

  return {
    duration: D,
    start() { root.visible = true; lastT = -1; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      const beat = f.beatPulse;
      const fire = sm(T_F0 - 0.3, T_F0 + 0.5, t) * (1 - sm(T_F1 - 0.4, T_F1 + 0.3, t));
      SU.uHeat.value = 0.3 + 0.45 * beat * beat + 0.9 * fire;
      SU.uRimK.value = 0.6 + 0.8 * fire;
      for (let id = 0; id < 2; id++) {
        const P = paths[id]!, I = idx[id]!;
        const dH = headDist(t, hold[id]!, P.len);
        // khớp: theo đường + lắc ngang; mỗi đốt trễ pha (khục khặc theo bậc)
        for (let j = 0; j <= NJ; j++) {
          const d = dH - 0.2 - j * SP;
          frameAt(P, d);
          pathPos(P, d, J[j]!);
          const env = sm(0, 8, j);
          const ph = j * 0.42 - t * 2.4 + id * 1.7;
          const q = Math.round(Math.sin(ph) * 3) / 3; // nấc
          J[j]!.addScaledVector(S, (0.55 * Math.sin(ph) + 0.15 * q) * env).addScaledVector(U, 0.3 * Math.cos(ph * 0.7) * env);
        }
        // đốt
        for (let k = 0; k < NJ; k++) {
          C.addVectors(J[k]!, J[k + 1]!).multiplyScalar(0.5);
          F.subVectors(J[k]!, J[k + 1]!);
          const len = F.length();
          F.divideScalar(len || 1);
          frameAt(P, dH - 0.2 - (k + 0.5) * SP);
          S.crossVectors(U, F).normalize();
          U.crossVectors(F, S);
          const roll = 0.07 * Math.round(Math.sin(t * 4.2 - k * 0.7 + id) * 2) / 2;
          if (roll) { S.applyAxisAngle(F, roll); U.applyAxisAngle(F, roll); }
          const w = wOf(k);
          basis(m4, S, U, F, C, w, w, len / SP);
          body.setMatrixAt(I.seg + k, m4);
          // chân thuỷ lực
          const li = LEG_SEG.indexOf(k);
          if (li >= 0) {
            for (const side of [1, -1]) {
              const sw = 0.45 * Math.sin(t * 3.1 + k * 0.5 + (side > 0 ? 0 : Math.PI)) - 0.2 + 0.6 * sm(T_H1, T_H1 + 1.5, t);
              basis(m5, S, U, F, C, w, w, w);
              mR.makeRotationX(-sw);
              m5.multiply(m4.makeTranslation(0.92 * side, -0.4, 0)).multiply(mR).multiply(m4.makeScale(side * 1.1, 1.1, 1.1));
              body.setMatrixAt(I.leg + li * 2 + (side > 0 ? 0 : 1), m5);
            }
          }
        }
        // đuôi
        {
          F.subVectors(J[NJ - 1]!, J[NJ]!).normalize();
          frameAt(P, dH - 0.2 - NJ * SP);
          S.crossVectors(U, F).normalize(); U.crossVectors(F, S);
          const w = wOf(NJ - 1) * 1.5;
          basis(m4, S, U, F, J[NJ]!, w, w, w);
          body.setMatrixAt(I.tail, m4);
        }
        // đầu: hướng = cổ pha tiếp tuyến
        frameAt(P, dH);
        F.subVectors(J[0]!, J[1]!).normalize().add(T).normalize();
        S.crossVectors(U, F).normalize(); U.crossVectors(F, S);
        C.copy(J[0]!).addScaledVector(F, 0.35 * HS);
        basis(mHead, S, U, F, C, HS, HS, HS);
        body.setMatrixAt(I.head, mHead);
        heads[id]!.copy(C).addScaledVector(F, 2 * HS).addScaledVector(U, 0.4 * HS);
        hS[id]!.copy(S); hU[id]!.copy(U);
        // hàm: há theo phách, há rộng khi phun
        const open = 0.1 + 0.42 * beat * beat * (1 - fire) + 0.62 * fire;
        m5.copy(mHead).multiply(m4.makeTranslation(JAW_HINGE.x, JAW_HINGE.y, JAW_HINGE.z)).multiply(mR.makeRotationX(open));
        body.setMatrixAt(I.jaw, m5);
        // miệng + hướng lửa (ngẩng thêm một chút)
        mouths[id]!.copy(MOUTH).applyMatrix4(mHead);
        horns[id]!.copy(HORN_TIP).applyMatrix4(mHead);
        dirs[id]!.copy(F).addScaledVector(U, 0.12).normalize();
        dirs[id]!.x += (C.x > 0 ? -0.6 : 0.6) * fire; // bẻ luồng lửa chéo vào trong ⇒ chữ X
        dirs[id]!.normalize();
        const L = JET_L * Math.max(fire, 0.001);
        basis(m4, S.crossVectors(U, dirs[id]!).normalize(), U.crossVectors(dirs[id]!, S), dirs[id]!, mouths[id]!, L, L, L);
        flame.setMatrixAt(id, m4);
      }
      body.instanceMatrix.needsUpdate = true;
      flame.instanceMatrix.needsUpdate = true;
      flame.visible = fire > 0.002;
      FU.uT.value = PU.uT.value = t;
      FU.uGrow.value = Math.min(1, fire * 1.25);
      PU.uJet.value = fire;
      PU.uPx.value = pxScale();
      PU.uRing.value = sm(0.4, 1.4, t) * (1 - sm(3.6, 5, t));
      const trail = 0.3 + 0.7 * sm(T_H1, T_H1 + 0.8, t);
      PU.uTrail.value.set(trail, trail);
      PU.uSmoke.value = 0.8 + 0.2 * beat;
      PU.uHFrac.value = hist.push(t, horns);
      // chỗ hai luồng lửa bắt chéo (điểm gần nhất của hai tia)
      if (t > T_H0 - 1 && t < T_F1) {
        const d1 = dirs[0]!, d2 = dirs[1]!;
        a.subVectors(mouths[0]!, mouths[1]!);
        const bb = d1.dot(d2), dd = d1.dot(a), ee = d2.dot(a), den = 1 - bb * bb;
        if (den > 1e-3) {
          const s1 = Math.min(JET_L, Math.max(0, (bb * ee - dd) / den)), s2 = Math.min(JET_L, Math.max(0, (ee - bb * dd) / den));
          b.copy(mouths[0]!).addScaledVector(d1, s1).add(a.copy(mouths[1]!).addScaledVector(d2, s2)).multiplyScalar(0.5);
          cross.lerp(b, 0.25);
        }
      }
      // điểm nhìn: giữa hai đầu, kéo về chỗ hai luồng lửa bắt chéo khi phun
      focRaw.addVectors(heads[0]!, heads[1]!).multiplyScalar(0.5);
      focRaw.lerp(cross, sm(T_H0 - 1.5, T_F0 + 0.5, t) * (1 - sm(T_F1, T_F1 + 2.5, t)));
      if (t > T_H1 + 1) focRaw.lerp(cross, 0.5 - 0.5 * sm(T_H1 + 1, D, t));
      const snap = lastT < 0 || t < lastT;
      foc.lerp(focRaw, snap ? 1 : 1 - Math.exp(-(t - lastT) * 2.5));
      lastT = t;
    },
    focus(_t: number, out: THREE.Vector3) { out.copy(foc); },
    dispose() {
      geo.dispose();
      fgeo.dispose();
      disposeTree(root);
    },
  };
}

export const builders: Partial<OutsideBuilders> = { secretDragon: createMechDragons };
