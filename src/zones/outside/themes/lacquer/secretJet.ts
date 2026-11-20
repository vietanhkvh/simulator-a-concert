// "Mực & Sơn mài · bản Việt" · khe secretJet (gói L3, STYLE_B2 §6 + §9): "Đàn hạc và sông đèn trời vẽ dải đất hình chữ S"
// thay tim khói. Ba nhịp ≈ 11 s rồi giữ ~6 s, tan lên trời, tổng 24 s (= màn mặc định, 'cs-secret' start/end như cũ):
//   (1) 0–3,4 s  chín hạc bay vào đội hình chữ V từ phía tây tới mũi bắc
//   (2) 3,4–8,4 s hai hạc đầu đàn vạch nét cọ từ Bắc vào Nam (bờ đông + bờ tây), mực sáng loang dần theo đường bay,
//       các con sau thả đèn dọc đường bay; ấn ký (vòng cọ ngọc hở 40° + triện son) theo hạc đầu đàn
//   (3) 8,4–11 s chữ S rực lên: lòng sáng mờ, sao vàng nền son ở Thủ đô, sông đèn trời chảy qua lòng chữ S,
//       Hoàng Sa (5 đốm) + Trường Sa (7 đốm) sáng sau cùng; hạc lượn một vòng quanh hình rồi lướt đi
//   giữ tới 17 s, 17–22,5 s tan từ dưới lên, đèn bay lên trời.
// Hình nằm trên trục dài sân (x = 0), trên mép xa sân cỏ: từ mắt ca sĩ ≈ 22–40° (dưới mép mái), từ máy toàn cảnh
// (0, 66, −108) nằm trọn khung. Mặt phẳng hình quay về camera quanh trục X (FIG_BASIS) ⇒ cả hai phía thấy bắc trên, đông phải.
// Draw call khi chạy: quad SDF + hạc (instanced) + 1 Points + ấn ký = 4; rảnh = 0 (root ẩn); dựng lười, dispose hết.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { hexToRgb, RAMPS } from '../../../../world/style';
import type { OutsideBuilders } from '../../builders';
import { type SecretAct, disposeTree, pxScale, seededRnd } from '../../secretShared';
import { BOX, CAPITAL, HOANG_SA, SPINE, SPINE_N, TRUONG_SA, buildFigureSdf, sideAt } from './secretJetShape';
import { CRANE_FRAG, CRANE_VERT, QUAD_VERT, SIGIL_VERT, ptsFrag, ptsVert, quadFrag, sigilFrag } from './secretJetShaders';

const D = 24;
/** Tâm hình (world). */
export const S_CENTER = new THREE.Vector3(0, 45, -74);
const T_D0 = 3.4, T_D1 = 8.4, T_LIT = T_D1;
const T_ORB1 = 15.2, T_HOLD1 = 17, T_DISS1 = 22.5;
const NCRANE = 9;
const CRANE_SCALE = 1.25;
/** Camera dùng để tính focus() (máy toàn cảnh của sự kiện bí mật, main.ts). */
const FOCUS_CAM = new THREE.Vector3(0, 66, -108);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sm = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ───────────── Hình hạc phẳng (mũi +x, m) ─────────────
type Pt = [number, number];
function buildCraneGeo(): THREE.BufferGeometry {
  const R = RAMPS;
  const pos: number[] = [], col: number[] = [], wa: number[] = [];
  const C = {
    white: R.silk![100]!, shade: R.pearl![300]!, black: R.lacquer![700]!, red: R.son![500]!, gold: R.gold![500]!, beak: R.gold![300]!,
  };
  const SH: Pt = [0.05, 0.14];
  const poly = (pts: Pt[], hex: number, kind = 0, edge = 0) => {
    // đa giác lồi (CCW); edge > 0: bản viền vàng nới ra theo pháp tuyến góc
    let P = pts;
    if (edge > 0) {
      P = pts.map((p, i) => {
        const a = pts[(i + pts.length - 1) % pts.length]!, b = pts[(i + 1) % pts.length]!;
        const n1 = [p[1] - a[1], -(p[0] - a[0])], n2 = [b[1] - p[1], -(b[0] - p[0])];
        const l1 = Math.hypot(n1[0]!, n1[1]!) || 1, l2 = Math.hypot(n2[0]!, n2[1]!) || 1;
        let nx = n1[0]! / l1 + n2[0]! / l2, ny = n1[1]! / l1 + n2[1]! / l2;
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        return [p[0] + nx * edge, p[1] + ny * edge] as Pt;
      });
    }
    const c = hexToRgb(hex);
    for (let i = 1; i < P.length - 1; i++) {
      for (const q of [P[0]!, P[i]!, P[i + 1]!]) { pos.push(q[0], q[1], 0); col.push(...c); wa.push(kind, SH[0], SH[1]); }
    }
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 16, a0 = 0, a1 = Math.PI * 2): Pt[] => {
    const o: Pt[] = [];
    for (let i = 0; i < n; i++) { const a = a0 + ((a1 - a0) * i) / (a1 - a0 >= Math.PI * 2 - 1e-6 ? n : n - 1); o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return o;
  };
  const strip = (a: Pt, b: Pt, wa0: number, wb: number): Pt[] => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    return [[a[0] - nx * wa0, a[1] - ny * wa0], [b[0] - nx * wb, b[1] - ny * wb], [b[0] + nx * wb, b[1] + ny * wb], [a[0] + nx * wa0, a[1] + ny * wa0]];
  };
  // cánh (CCW): phần trong trắng thon dần + 4 lông cánh sơ cấp đen xoè ở đầu (mỗi lông 1 đa giác lồi)
  const wing = (dx: number, k: number, hexIn: number, kind: number) => {
    const T = (p: Pt): Pt => [p[0] * k + dx, (p[1] - SH[1]) * k + SH[1]];
    const inner: Pt[] = ([[0.45, 0.16], [-0.4, 0.12], [-0.66, 0.62], [-0.6, 1.0], [-0.1, 1.08], [0.22, 0.7]] as Pt[]).map(T);
    const fe: Pt[][] = ([
      [[-0.1, 1.0], [-0.6, 0.95], [-0.62, 1.62], [-0.42, 1.78]],
      [[0.0, 0.98], [-0.35, 1.0], [-0.2, 1.72], [-0.06, 1.74]],
      [[0.12, 0.9], [-0.1, 0.98], [0.06, 1.6], [0.18, 1.58]],
      [[0.22, 0.72], [0.02, 0.86], [0.3, 1.36], [0.38, 1.3]],
    ] as Pt[][]).map((f) => f.map(T));
    poly(inner, C.gold, kind, E); for (const f of fe) poly(f, C.gold, kind, E * 0.7);
    for (const f of fe) poly(f, C.black, kind);
    poly(inner, hexIn, kind);
  };
  const E = 0.05;
  wing(0.18, 0.86, C.shade, 1); // cánh xa: bậc bóng, lệch trước, nhỏ hơn
  // chân thả sau, đuôi
  poly(strip([-0.5, -0.06], [-1.75, -0.16], 0.035, 0.025), C.black);
  poly(strip([-0.46, -0.1], [-1.68, -0.24], 0.035, 0.025), C.black);
  const tail: Pt[] = [[-0.6, 0.08], [-1.02, -0.02], [-0.98, 0.14]];
  poly(tail, C.black);
  // thân + cổ + đầu, viền vàng mảnh
  const body = ellipse(0, 0, 0.78, 0.3, 20);
  const neck = strip([0.55, 0.06], [1.62, 0.24], 0.13, 0.065);
  const head = ellipse(1.72, 0.25, 0.14, 0.12, 12);
  poly(body, C.gold, 0, E); poly(neck, C.gold, 0, E * 0.8); poly(head, C.gold, 0, E * 0.8);
  poly(body, C.white);
  poly(ellipse(0, -0.02, 0.74, 0.25, 14, Math.PI * 1.05, Math.PI * 1.95), C.shade); // bụng: bậc bóng thứ 2
  poly(neck, C.white); poly(head, C.white);
  poly(ellipse(1.74, 0.33, 0.07, 0.05, 10), C.red); // mào đỏ
  poly([[1.84, 0.29], [1.84, 0.2], [2.22, 0.23]], C.beak);
  // cánh gần (sáng)
  wing(0, 1, C.white, 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aW', new THREE.Float32BufferAttribute(wa, 3));
  g.instanceCount = NCRANE;
  return g;
}

// ───────────── Đường bay (toạ độ phẳng) ─────────────
const tmp = { u: 0, v: 0 };
const NORTH = sideAt(0, 0, { u: 0, v: 0 });
const ORB = { cu: -1.5, cv: 0, a: 15.5, b: 16.5 };
const ORB_A0 = -1.95; // góc bắt đầu (gần mũi Cà Mau)

/** Vị trí đội hình V lúc t (beat 1): hạc đầu ở đỉnh, đi theo Bézier từ tây tới mũi bắc. */
function vLead(t: number, out: { u: number; v: number }) {
  const x = clamp01(t / T_D0), e = 1 - (1 - x) * (1 - x) * 0.6 - 0.4 * (1 - x);
  const p0 = [-34, 6], c = [-20, 18], p1 = [NORTH.u, NORTH.v + 1.2];
  const m = 1 - e;
  out.u = m * m * p0[0]! + 2 * m * e * c[0]! + e * e * p1[0]!;
  out.v = m * m * p0[1]! + 2 * m * e * c[1]! + e * e * p1[1]!;
  return out;
}
function vSlot(i: number, t: number, out: { u: number; v: number }) {
  vLead(t, out);
  if (i === 0) return out;
  const q = { u: 0, v: 0 };
  vLead(t - 0.15, q);
  let dx = out.u - q.u, dy = out.v - q.v; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const rank = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
  out.u += -dx * rank * 3.4 - dy * side * rank * 3.0;
  out.v += -dy * rank * 3.4 + dx * side * rank * 3.0;
  return out;
}
/** Tiến độ nét (0..1) lúc t. */
const headAt = (t: number) => clamp01((t - T_D0) / (T_D1 - T_D0));

function cranePos(i: number, t: number, out: { u: number; v: number }) {
  // nhịp 1
  vSlot(i, Math.min(t, T_D0), out);
  if (t <= T_D0) return out;
  // nhịp 2: hạc 0 vạch bờ đông, hạc 1 bờ tây; con chẵn theo bờ đông, con lẻ theo bờ tây, trễ dần
  const side = (i % 2 === 0 ? 0 : 1) as 0 | 1;
  const rank = i < 2 ? 0 : Math.ceil((i - 1) / 2);
  const lag = rank * 0.07;
  const s = headAt(t) - lag;
  sideAt(side, Math.max(s, 0), tmp);
  const off = rank * 0.9 * (side === 0 ? 1 : -1);
  const pu = tmp.u + off, pv = tmp.v + rank * 0.5 + (i < 2 ? 0.25 : 0.9);
  const w2 = sm(T_D0, T_D0 + 0.5 + lag * 12, t);
  let u = out.u + (pu - out.u) * w2, v = out.v + (pv - out.v) * w2;
  // nhịp 3: lượn một vòng quanh hình rồi lướt đi
  if (t > T_D1 - 0.2) {
    const w3 = sm(T_D1 - 0.2, T_D1 + 1.4, t);
    const ang = ORB_A0 + 2 * Math.PI * sm(T_D1, T_ORB1 + 0.6, t) * 1.02 - i * 0.24;
    let ou = ORB.cu + Math.cos(ang) * ORB.a, ov = ORB.cv + Math.sin(ang) * ORB.b;
    if (t > T_ORB1) {
      const e = t - T_ORB1;
      ou += e * e * 2.2 + e * 4 + i * e * 0.5; ov += e * e * 1.3 + e * 2.5;
    }
    u += (ou - u) * w3; v += (ov - v) * w3;
  }
  out.u = u; out.v = v;
  return out;
}

export function createLacquerJet(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const uC = { value: S_CENTER.clone() };

  // ── quad chữ S
  const sdf = buildFigureSdf();
  const qGeo = new THREE.PlaneGeometry(BOX.u1 - BOX.u0, BOX.v1 - BOX.v0, 1, 1);
  qGeo.translate((BOX.u0 + BOX.u1) / 2, (BOX.v0 + BOX.v1) / 2, 0);
  const qU = {
    uC, uSdf: { value: sdf }, uBox: { value: new THREE.Vector4(BOX.u0, BOX.v0, BOX.u1 - BOX.u0, BOX.v1 - BOX.v0) },
    uHead: { value: 0 }, uFill: { value: 0 }, uGlow: { value: 0 }, uDiss: { value: 0 }, uT: { value: 0 }, uLift: { value: 0 },
  };
  const quad = new THREE.Mesh(qGeo, new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: quadFrag(), uniforms: qU, transparent: true, premultipliedAlpha: true,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  quad.frustumCulled = false;
  quad.renderOrder = 5;
  root.add(quad);

  // ── Points: sông đèn + đèn thả + đảo + sao
  const rnd = seededRnd(1975);
  const NRIVER = 320, NDROP = 60;
  const N = NRIVER + NDROP + HOANG_SA.length + TRUONG_SA.length + 1;
  const pp = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  let k = 0;
  for (let i = 0; i < NRIVER; i++, k++) seed.set([0, rnd(), rnd(), rnd()], k * 4);
  for (let i = 0; i < NDROP; i++, k++) {
    const s = rnd(), side = (i % 2) as 0 | 1;
    sideAt(side, s, tmp);
    pp.set([tmp.u + (rnd() - 0.5) * 1.5, tmp.v + 0.6 + rnd() * 1.2, 0.8], k * 3);
    seed.set([1, rnd(), rnd(), s], k * 4);
  }
  const isles = [...HOANG_SA.map((p, i) => [p, i / 5 * 0.4] as const), ...TRUONG_SA.map((p, i) => [p, 0.35 + (i / 7) * 0.45] as const)];
  for (const [p, d] of isles) { pp.set([p[0], p[1], 0.3], k * 3); seed.set([2, d, rnd(), rnd()], k * 4); k++; }
  pp.set([CAPITAL[0], CAPITAL[1], 0.5], k * 3); seed.set([3, 0, rnd(), rnd()], k * 4);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const spine = Array.from({ length: SPINE_N }, (_, i) => new THREE.Vector3(SPINE[i * 3]!, SPINE[i * 3 + 1]!, SPINE[i * 3 + 2]!));
  const pU = {
    uC, uT: { value: 0 }, uPx: { value: 720 }, uRiver: { value: 0 }, uIsle: { value: 0 }, uStar: { value: 0 }, uHead: { value: 0 },
    uDiss: { value: 0 }, uDrawT: { value: T_D1 - T_D0 }, uSpine: { value: spine },
  };
  const pts = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    vertexShader: ptsVert(SPINE_N), fragmentShader: ptsFrag(), uniforms: pU, transparent: true, premultipliedAlpha: true,
    depthWrite: false, fog: false,
  }));
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  root.add(pts);

  // ── hạc (instanced)
  const cGeo = buildCraneGeo();
  const aI0 = new THREE.InstancedBufferAttribute(new Float32Array(NCRANE * 4), 4);
  const aI1 = new THREE.InstancedBufferAttribute(new Float32Array(NCRANE * 4), 4);
  aI0.setUsage(THREE.DynamicDrawUsage); aI1.setUsage(THREE.DynamicDrawUsage);
  cGeo.setAttribute('aI0', aI0); cGeo.setAttribute('aI1', aI1);
  const cranes = new THREE.Mesh(cGeo, new THREE.ShaderMaterial({
    vertexShader: CRANE_VERT, fragmentShader: CRANE_FRAG, uniforms: { uC }, transparent: true, premultipliedAlpha: true,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  cranes.frustumCulled = false;
  cranes.renderOrder = 7;
  root.add(cranes);

  // ── ấn ký
  const sgU = { uC, uAt: { value: new THREE.Vector2() }, uR: { value: 2.2 }, uA: { value: 0 }, uT: { value: 0 } };
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: SIGIL_VERT, fragmentShader: sigilFrag(), uniforms: sgU, transparent: true, premultipliedAlpha: true,
    depthWrite: false, fog: false,
  }));
  sigil.frustumCulled = false;
  sigil.renderOrder = 8;
  root.add(sigil);

  const a = { u: 0, v: 0 }, b = { u: 0, v: 0 }, sx = new Float32Array(NCRANE).fill(1);
  const basis = (cam: THREE.Vector3) => {
    const f = new THREE.Vector3(0, cam.y - S_CENTER.y, cam.z - S_CENTER.z).normalize();
    const ey = new THREE.Vector3(0, 1, 0).addScaledVector(f, -f.y).normalize();
    return { ex: new THREE.Vector3().crossVectors(ey, f), ey };
  };
  const FB = basis(FOCUS_CAM);

  return {
    duration: D,
    start() { root.visible = true; sx.fill(1); },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      void f;
      const head = headAt(t);
      const diss = sm(T_HOLD1, T_DISS1, t);
      qU.uT.value = pU.uT.value = sgU.uT.value = t;
      qU.uHead.value = pU.uHead.value = t >= T_D1 ? 1.01 : head;
      qU.uFill.value = sm(T_LIT, T_LIT + 1.3, t);
      qU.uGlow.value = sm(T_LIT - 0.3, T_LIT + 0.8, t) * (1 + 0.15 * Math.sin(t * 2.2));
      qU.uDiss.value = pU.uDiss.value = diss;
      qU.uLift.value = diss * diss * 4;
      pU.uPx.value = pxScale();
      pU.uRiver.value = sm(T_LIT + 0.4, T_LIT + 2.6, t);
      pU.uStar.value = sm(T_LIT + 0.5, T_LIT + 1.2, t) * (1 + 0.5 * Math.exp(-Math.max(0, t - T_LIT - 1.2) * 3));
      pU.uIsle.value = clamp01((t - (T_LIT + 1.4)) / 1.6);
      const A0 = aI0.array as Float32Array, A1 = aI1.array as Float32Array;
      const fade = 1 - sm(T_ORB1 + 2.6, T_ORB1 + 4.2, t);
      for (let i = 0; i < NCRANE; i++) {
        cranePos(i, t, a);
        cranePos(i, t + 0.1, b);
        let dx = b.u - a.u, dy = b.v - a.v; const l = Math.hypot(dx, dy);
        if (l > 1e-4) { dx /= l; dy /= l; } else { dx = 1; dy = 0; }
        // lật ngang có trễ để hạc luôn thẳng lưng, không đổi chiều giật khi bay thẳng đứng
        if (dx > 0.25) sx[i] = 1; else if (dx < -0.25) sx[i] = -1;
        const s = sx[i]!;
        const cu = dx * s, cv = dy; // hướng sau khi lật: luôn nhìn về +x của hình hạc
        const ang = Math.atan2(cv, cu) * s;
        // nhịp cánh 1,2 s; xen pha lượn (cánh giữ ngang)
        const glide = sm(0.35, 0.75, Math.sin(t * 0.8 + i * 1.3)) * (t > T_D0 - 0.5 && t < T_D1 && i < 2 ? 0.2 : 1);
        const flapPh = (t / 1.2) * Math.PI * 2 + i * 0.9;
        const pop = sm(i * 0.08, i * 0.08 + 0.5, t);
        A0.set([a.u, a.v, Math.cos(ang), Math.sin(ang)], i * 4);
        A1.set([flapPh, 1 - glide * 0.85, CRANE_SCALE * s * (i < 2 ? 1.12 : 1) * pop, pop * fade], i * 4);
        if (i === 0) {
          // ấn ký theo hạc đầu đàn ở nhịp 1–2
          sgU.uAt.value.set(a.u + 2.8, a.v + 2.4);
          sgU.uA.value = sm(0.2, 0.9, t) * (1 - sm(T_D1 - 0.4, T_D1 + 0.6, t));
        }
      }
      aI0.needsUpdate = aI1.needsUpdate = true;
    },
    focus(t: number, out: THREE.Vector3) {
      out.copy(S_CENTER);
      if (t < T_D1 + 1.5) {
        cranePos(0, t, a);
        const w = (t < T_D0 ? 0.6 : 0.4) * (1 - sm(T_D1 - 0.5, T_D1 + 1.5, t));
        out.addScaledVector(FB.ex, a.u * w).addScaledVector(FB.ey, a.v * w);
      }
    },
    dispose() {
      sdf.dispose();
      disposeTree(root);
    },
  };
}

export const builders: Partial<OutsideBuilders> = { secretJet: createLacquerJet };
