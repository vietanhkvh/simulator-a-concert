// ★ L2 · "Thăng Long · đôi rồng thời Lý chầu nguyệt" (STYLE_B2 §5) — khe `secretDragon` của phong cách lacquer.
// Hai rồng Lý: thân tròn trơn rất dài, thon đều về đuôi, uốn sin; không sừng, không vảy to (chỉ hàng răng lửa lưng + vạch bụng);
// đầu ngẩng, mào lửa son trên mũi, môi trên vươn cong lên, râu + bờm dài bay ngược, ngậm ngọc; 4 chân mảnh 3 móng + lửa khuỷu.
// Rồng A vàng quỳ, rồng B ngọc bích; mào/vây đỏ son, bụng bạc quỳ. Tô 2 bậc phẳng (bóng ấm = bậc 700), viền khảm vàng mảnh,
// thân như nét cọ: dày–mỏng, lộ ra theo sợi lông cọ, đuôi bút khô tách sợi, vệt mực loang đọng lại sau đuôi.
// Biên đạo (D = 24 s như bản mặc định, hai đường đối xứng gương qua x = 0):
//   0–3 s     trồi lên từ sau hai đầu mái sân khấu (x ≈ ±15), lao lên phía sân
//   3–8 s     một vòng xoắn ốc lên quanh trục (0, ·, −40), A xuôi / B ngược chiều, lệch cao ±5,5 m (không bao giờ chạm)
//   8–10,5 s  cuộn lên hai bên, đầu quay vào giữa → 10,5–14,5 s chầu nguyệt: giữ dáng, trăng–ngọc bừng sáng, vòng cọ ngọc
//             tự vẽ + triện son đóng, vảy vàng quỳ rơi
//   14,5–24 s quặt ra hai phía, bay vút lên xa, vệt mực loang tan dần; tan kiểu bút khô 22–24 s.
// Khung: up tính sẵn (buildDragonPath của bản mặc định: khung ngang + bank kẹp ±35°) ⇒ đầu không lộn ngược.
// Draw call khi chạy: thân+đầu (1, 2 instance) + viền khảm (1) + vệt mực (1) + trăng/chữ ký (1) + hạt (1) = 5; rảnh = 0.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { PAL, RAMPS, hexToRgb } from '../../../../world/style';
import type { OutsideBuilders } from '../../builders';
import { buildDragonPath } from '../../secretDragon';
import { type SecretAct, disposeTree, makePoints, pxScale, seededRnd } from '../../secretShared';
import { HEAD_PITCH, LB, PEARL_LOCAL, buildLyDragon } from './secretDragonGeo';
import { BODY_FRAG, BODY_VERT, MOON_FRAG, MOON_VERT, PTS_FRAG, PTS_VERT, TRAIL_FRAG, TRAIL_VERT } from './secretDragonShaders';

const D = 24;
const T_HOLD0 = 10.5, T_HOLD1 = 14.5;
const DY = 5.5;
/** Trăng–ngọc mà hai rồng chầu (mặc định của riêng gói này). */
export const MOON_POS = new THREE.Vector3(0, 35, -47);
const HOLD_HEAD = new THREE.Vector3(11.8, 34.8, -47);

const sm = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Đường gốc (rồng A, bên +x) + độ lệch cao mỗi điểm (A +, B −). */
function basePath(): { p: [number, number, number][]; dy: number[]; iHold: number } {
  const p: [number, number, number][] = [[15, -2, 11], [15, 8, 8], [14.6, 14, 2], [13.6, 14.5, -14], [12.4, 12.5, -32]];
  const dy: number[] = [0, 0.15, 0.4, 0.75, 0.95];
  const R = 12;
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const ph = 0.5 * Math.PI + (i / N) * 2 * Math.PI;
    p.push([R * Math.sin(ph), 12 + (i / N) * 7, -46 + R * Math.cos(ph)]);
    dy.push(1 - sm(2.1 * Math.PI, 2.6 * Math.PI, ph));
  }
  // vòng ra ngoài rồi vươn lên nghiêng vào trong, uốn sin (độ nghiêng > biên độ sin ⇒ khung không lật)
  p.push([17, 17.5, -54], [24, 15, -53.5], [28.5, 15.2, -48.5]);
  dy.push(0.4, 0.15, 0);
  const y0 = 15.2, y1 = 33.6;
  for (let k = 1; k <= 8; k++) {
    const u = k / 8, y = y0 + (y1 - y0) * u;
    p.push([28.5 - 14.5 * u + 1.0 * Math.sin(u * 2 * Math.PI * 1.9), y, -47 + 1.6 * Math.sin(u * 2 * Math.PI * 1.9 + 1.4)]);
    dy.push(0);
  }
  const iHold = p.length;
  p.push([HOLD_HEAD.x, HOLD_HEAD.y, HOLD_HEAD.z]);
  dy.push(0);
  p.push([9.4, 35, -44.8], [9.8, 35.6, -41.4], [13.2, 37, -40], [20, 40.5, -44], [34, 49, -52], [58, 62, -60], [90, 74, -68], [130, 88, -76], [170, 102, -86]);
  for (let i = 0; i < 9; i++) dy.push(0);
  return { p, dy, iHold };
}

type Path = ReturnType<typeof buildDragonPath>;
const NSn = (P: Path) => P.pos.length / 4;
function rowAt(A: Float32Array, n: number, len: number, d: number, out: THREE.Vector3) {
  const x = Math.min(1, Math.max(0, d / len)) * (n - 1);
  const a = Math.floor(x), b = Math.min(a + 1, n - 1), f = x - a;
  return out.set(A[a * 4]! + (A[b * 4]! - A[a * 4]!) * f, A[a * 4 + 1]! + (A[b * 4 + 1]! - A[a * 4 + 1]!) * f, A[a * 4 + 2]! + (A[b * 4 + 2]! - A[a * 4 + 2]!) * f);
}
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3();
function pathPos(P: Path, d: number, out: THREE.Vector3) {
  const n = NSn(P), ds = P.len / (n - 1);
  if (d < 0) { rowAt(P.pos, n, P.len, 0, _p0); rowAt(P.pos, n, P.len, ds, _p1); return out.copy(_p0).addScaledVector(_p0.sub(_p1), -d / ds); }
  if (d > P.len) { rowAt(P.pos, n, P.len, P.len, _p0); rowAt(P.pos, n, P.len, P.len - ds, _p1); return out.copy(_p0).addScaledVector(_p0.sub(_p1), (d - P.len) / ds); }
  return rowAt(P.pos, n, P.len, d, out);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(), _s = new THREE.Vector3();
const WK = (2 * Math.PI) / 9.5;
/** Khớp centerAt (GLSL). */
function centerAt(P: Path, id: number, dHead: number, s: number, t: number, out: THREE.Vector3) {
  const dd = dHead - s;
  pathPos(P, dd + 0.7, _a); pathPos(P, dd - 0.7, _b);
  _t.subVectors(_a, _b); _t.y += 1e-5; _t.normalize();
  rowAt(P.up, NSn(P), P.len, dd, _u).normalize();
  _s.crossVectors(_u, _t); _s.x += 1e-5; _s.normalize();
  _u.crossVectors(_t, _s);
  const env = 0.15 + 0.85 * sm(0, 7, s);
  const ph = s * WK - t * 2.0;
  pathPos(P, dd, out);
  return out.addScaledVector(_s, (id === 0 ? 1 : -1) * Math.sin(ph) * 1.25 * env).addScaledVector(_u, Math.cos(ph * 0.8 + 1) * 0.55 * env);
}
const _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
/** Khung đầu (s = 0): C, T, S, U. */
function headFrame(P: Path, id: number, dHead: number, t: number, C: THREE.Vector3, T: THREE.Vector3, S: THREE.Vector3, U: THREE.Vector3) {
  centerAt(P, id, dHead, 0, t, C);
  centerAt(P, id, dHead, -0.45, t, _c1); centerAt(P, id, dHead, 0.45, t, _c2);
  T.subVectors(_c1, _c2); T.y += 1e-5; T.normalize();
  rowAt(P.up, NSn(P), P.len, dHead, U).normalize();
  S.crossVectors(U, T); S.x += 1e-5; S.normalize();
  U.crossVectors(T, S);
}

/** Hai đường + mốc khoảng cách. Xuất cho test/harness. */
export function lyPaths() {
  const { p, dy, iHold } = basePath();
  const A0 = p.map(([x, y, z], i) => [x, y + DY * dy[i]!, z] as [number, number, number]);
  const B0 = p.map(([x, y, z], i) => [-x, y - DY * dy[i]!, z] as [number, number, number]);
  const paths = [buildDragonPath(A0, 11), buildDragonPath(B0, 11)];
  const hold = paths.map((P, id) => {
    const tgt = new THREE.Vector3(...(id === 0 ? A0 : B0)[iHold]!);
    const n = NSn(P), ds = P.len / (n - 1);
    let bi = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = _a.set(P.pos[i * 4]!, P.pos[i * 4 + 1]!, P.pos[i * 4 + 2]!).distanceTo(tgt);
      if (d < bd) { bd = d; bi = i; }
    }
    return bi * ds;
  });
  return { paths, hold };
}
/** Khoảng cách đầu theo thời gian: chậm dần vào thế chầu, đứng, rồi tăng tốc rời đi. */
export function headDist(t: number, dHold: number, len: number) {
  if (t <= T_HOLD0) {
    const x = Math.max(0, t) / T_HOLD0;
    return dHold * (x + x * x - x * x * x);
  }
  if (t <= T_HOLD1) return dHold + 0.35 * Math.sin(((t - T_HOLD0) / (T_HOLD1 - T_HOLD0)) * Math.PI); // nhích nhẹ
  const x = (t - T_HOLD1) / (D - T_HOLD1);
  return dHold + Math.min(len - dHold - 2, 112) * x * x;
}

const v3 = (hex: number, out = new THREE.Vector3()) => out.fromArray(hexToRgb(hex));

function createLyDragons(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const { paths, hold } = lyPaths();
  const [A, B] = paths as [Path, Path];
  const NS = NSn(A);
  const data = new Float32Array(NS * 4 * 4);
  data.set(A.pos, 0); data.set(A.up, NS * 4); data.set(B.pos, NS * 8); data.set(B.up, NS * 12);
  const tex = new THREE.DataTexture(data, NS, 4, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;

  const gold = RAMPS.gold ?? PAL.honey, jade = RAMPS.jade ?? PAL.mint, son = RAMPS.son ?? PAL.berry;
  const silk = RAMPS.silk ?? PAL.cream, lac = RAMPS.lacquer ?? PAL.night;

  const U = {
    uPath: { value: tex }, uLen: { value: new THREE.Vector2(A.len, B.len) }, uD: { value: new THREE.Vector2() }, uT: { value: 0 },
    uViewH: { value: 720 }, uFade: { value: new THREE.Vector2() }, uGlow: { value: 0 },
    uBody: { value: [v3(gold[500]), v3(jade[500])] }, uBodySh: { value: [v3(gold[700]), v3(jade[700])] }, uBodyHi: { value: [v3(gold[300]), v3(jade[300])] },
    uBelly: { value: v3(silk[300]) }, uBellySh: { value: v3(silk[700]) },
    uRed: { value: v3(son[500]) }, uRedSh: { value: v3(son[700]) }, uRedHi: { value: v3(son[300]) },
    uMane: { value: [v3(gold[100]), v3(jade[100])] }, uManeSh: { value: [v3(gold[500]), v3(jade[300])] },
    uMouth: { value: v3(son[700]) }, uPearlC: { value: v3(silk[100]) }, uEye: { value: v3(lac[700]) }, uClaw: { value: v3(silk[300]) },
    uEdge: { value: [v3(gold[100]), v3(gold[300])] },
  };
  const geo = buildLyDragon();
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = geo.index;
  for (const [k, a] of Object.entries(geo.attributes)) ig.setAttribute(k, a);
  ig.setAttribute('aId', new THREE.InstancedBufferAttribute(new Float32Array([0, 1]), 1));
  ig.instanceCount = 2;
  const defines = { LBF: LB.toFixed(3) };
  const bodyMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT(NS), fragmentShader: BODY_FRAG, uniforms: U, defines, fog: false });
  const hullMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT(NS), fragmentShader: BODY_FRAG, uniforms: U, defines: { ...defines, HULL: 1 }, side: THREE.BackSide, fog: false });
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, order = 0) => {
    const x = new THREE.Mesh(g, m);
    x.frustumCulled = false;
    x.renderOrder = order;
    root.add(x);
    return x;
  };
  mk(ig, bodyMat);
  mk(ig, hullMat); // dùng chung geometry (dispose hai lần vô hại)

  // ── vệt mực loang (2 ruy-băng, 1 draw)
  const TS = 96;
  const tp: number[] = [], tuv: number[] = [], tix: number[] = [];
  for (let i = 0; i <= TS; i++) for (const v of [-1, 1]) { tp.push(0, 0, 0); tuv.push(i / TS, v); }
  for (let i = 0; i < TS; i++) { const a = i * 2; tix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const tg0 = new THREE.BufferGeometry();
  tg0.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  tg0.setAttribute('aUV', new THREE.Float32BufferAttribute(tuv, 2));
  tg0.setIndex(tix);
  const tg = new THREE.InstancedBufferGeometry();
  tg.index = tg0.index;
  for (const [k, a] of Object.entries(tg0.attributes)) tg.setAttribute(k, a);
  tg.setAttribute('aId', new THREE.InstancedBufferAttribute(new Float32Array([0, 1]), 1));
  tg.instanceCount = 2;
  const TU = { uPath: U.uPath, uLen: U.uLen, uD: U.uD, uT: U.uT, uTL: { value: 46 }, uTrailA: { value: new THREE.Vector2() },
    uTrailC: { value: [v3(gold[300]), v3(jade[300])] } };
  mk(tg, new THREE.ShaderMaterial({ vertexShader: TRAIL_VERT(NS), fragmentShader: TRAIL_FRAG, uniforms: TU, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }), 5);

  // ── trăng–ngọc + chữ ký vòng cọ / triện son
  const MU = {
    uMoon: { value: MOON_POS.clone() }, uSize: { value: 15 }, uT: U.uT, uMoonA: { value: 0 }, uRing: { value: 0 }, uSeal: { value: 0 }, uFlare: { value: 0 },
    uRM: { value: 4.3 }, uRR: { value: 6.3 },
    uShell: { value: v3(silk[300]) }, uShellHi: { value: v3(silk[100]) }, uCrack: { value: v3(silk[700]) }, uGold: { value: v3(gold[500]) }, uGlowC: { value: v3(gold[100]) },
    uJade: { value: v3(jade[300]) }, uJadeSh: { value: v3(jade[500]) }, uSeal1: { value: v3(son[500]) }, uSeal2: { value: v3(son[100]) },
  };
  const moon = mk(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: MOON_VERT, fragmentShader: MOON_FRAG, uniforms: MU, transparent: true, depthWrite: false, fog: false }), 4);

  // ── hạt: 2 quầng ngọc + vảy vàng quỳ
  const pearlW = [new THREE.Vector3(), new THREE.Vector3()];
  const PU = { uT: U.uT, uPx: { value: 720 }, uPearl: { value: pearlW }, uPearlA: { value: 0 }, uMoon: MU.uMoon, uRain: { value: 0 } };
  const rnd = seededRnd(4417);
  const fl = [gold[100], gold[300], gold[300], gold[500], son[300]];
  const pts = makePoints(702, PTS_VERT, PU, (i, s, c) => {
    if (i < 2) { s.set([i, 0, 0, 0], i * 4); c.set(hexToRgb(silk[100]), i * 3); return; }
    s.set([rnd(), rnd(), rnd(), 1], i * 4);
    c.set(hexToRgb(fl[Math.floor(rnd() * fl.length)]!), i * 3);
  }, { frag: PTS_FRAG });
  pts.renderOrder = 7;
  root.add(pts);

  const hp = [new THREE.Vector3(), new THREE.Vector3()];
  const T = new THREE.Vector3(), S = new THREE.Vector3(), Uv = new THREE.Vector3();
  const foc = new THREE.Vector3(), focRaw = new THREE.Vector3();
  let lastT = -1;
  const pearlLocal = PEARL_LOCAL.clone();
  void HEAD_PITCH;

  return {
    duration: D,
    start() { root.visible = true; lastT = -1; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      U.uT.value = t;
      U.uViewH.value = PU.uPx.value = pxScale();
      const dA = headDist(t, hold[0]!, A.len), dB = headDist(t, hold[1]!, B.len);
      U.uD.value.set(dA, dB);
      const fade = sm(21.6, 23.8, t);
      U.uFade.value.set(fade, fade);
      const trailA = sm(1.5, 3.5, t) * (1 - sm(20.5, 23.5, t));
      TU.uTrailA.value.set(trailA, trailA);
      // trăng–ngọc: mờ hiện, bừng khi chầu, vòng cọ tự vẽ, triện đóng
      MU.uMoonA.value = sm(0.8, 4, t) * (1 - sm(20, 23.5, t));
      const flare = sm(T_HOLD0 + 0.6, T_HOLD0 + 1.8, t) * (1 - sm(T_HOLD1 - 0.5, T_HOLD1 + 1.8, t));
      MU.uFlare.value = Math.min(1, flare * (0.9 + 0.1 * f.beatPulse));
      MU.uRing.value = sm(T_HOLD0 - 0.4, T_HOLD0 + 1.6, t) * (1 - sm(20.5, 23, t));
      MU.uSeal.value = sm(T_HOLD0 + 1.5, T_HOLD0 + 1.9, t) * (1 - sm(20.5, 23, t));
      PU.uRain.value = 1 - sm(19, 21, t);
      U.uGlow.value = flare;
      PU.uPearlA.value = (0.45 + 0.55 * flare) * sm(0.5, 2, t) * (1 - fade);
      for (let id = 0; id < 2; id++) {
        const P = paths[id]!;
        headFrame(P, id, id === 0 ? dA : dB, t, hp[id]!, T, S, Uv);
        pearlW[id]!.copy(hp[id]!).addScaledVector(S, pearlLocal.x).addScaledVector(Uv, pearlLocal.y).addScaledVector(T, pearlLocal.z);
      }
      // điểm nhìn: giữa hai ngọc, kéo về trăng khi chầu
      focRaw.addVectors(pearlW[0]!, pearlW[1]!).multiplyScalar(0.5);
      focRaw.lerp(MOON_POS, sm(T_HOLD0 - 2, T_HOLD0, t) * (1 - sm(T_HOLD1 + 0.5, T_HOLD1 + 4, t)) * 0.8);
      const snap = lastT < 0 || t < lastT;
      foc.lerp(focRaw, snap ? 1 : 1 - Math.exp(-(t - lastT) * 2.2));
      lastT = t;
      void moon;
    },
    focus(_t: number, out: THREE.Vector3) { out.copy(foc); },
    dispose() {
      geo.dispose();
      tg0.dispose();
      tex.dispose();
      disposeTree(root);
    },
  };
}

export const builders: Partial<OutsideBuilders> = { secretDragon: createLyDragons };
