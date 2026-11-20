// ★ Rồng chibi (STYLE_GUIDE · SECRET OBJECT): đầu tròn to (≈1,6 × đường kính thân), mắt long lanh chớp + nhìn về
// sân khấu, má hồng, mõm nhỏ có lỗ mũi, miệng cười (há ra khi "thở"), sừng tròn màu đào, tai cụp + râu lượn,
// chỏm bờm kem; thân 34 đốt cầu chồng nhau (tham số hoá theo độ dài, đốt dày hơn ở giữa), bụng kem có vạch,
// đốm + vảy bán nguyệt trong shader, vây lưng tròn, 4 chân ngắn khua, chùm lông đuôi; ngậm/đẩy viên NGỌC
// phát sáng (SECRET_CORE + vành SECRET_RIM, sao nhỏ quay quanh). Bay lượn sóng như cũ + co giãn khi rẽ +
// một vòng lộn vui; hơi thở là tim / sao / lấp lánh (không nhắm khán giả). Viền ink (inverted hull) + tô 2 bậc.
// Draw call: thân + viền thân + đầu + viền đầu + 1 Points + vành secret = 6. Mỗi frame chỉ đổi uniform/transform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { INK_SKY, OUTLINE, PAL, SECRET_CORE, SECRET_RIM, hexToRgb, popScale, shadowOf } from '../../world/style';
import { type SecretAct, disposeTree, makePoints, pxScale, seededRnd } from './secretShared';
import { createSecretHalo } from './secretHalo';
import { DRAGON_GLSL, DRAGON_PTS_FRAG } from './secretDragonShaders';

const D = 24;
const NSEG = 34;
const R_BODY = 1.3; // bán kính thân lớn nhất (m)
const R_HEAD = 2.1; // ≈ 1,6 × đường kính thân
const S_HEAD = -0.6; // vị trí đầu trên trục thân
const NS = 512;
const BREATH_DUR = 2.0;
const OBJ_H = 4.6; // chiều cao vật thể cho độ dày viền (3,5%)
const LOOP_R = 5.5, LOOP_LEN = 18;

const PATH_PTS: [number, number, number][] = [
  [80, 22, -46], [55, 19, -46], [36, 15, -38], [8, 14, -32], [-20, 15, -36], [-40, 20, -52],
  [-32, 22, -76], [-10, 20, -70],
  // vòng quanh B-stage
  [8, 19, -62], [15, 18, -48], [9, 17, -37], [-3, 17, -34], [-13, 18, -42], [-14, 19, -54], [-4, 20, -62], [10, 21, -64],
  // xoắn lên và bay mất
  [20, 25, -76], [6, 31, -92], [-16, 37, -88], [-22, 45, -72], [-8, 58, -64], [8, 78, -70], [4, 115, -80],
];
const BREATH_AT = new THREE.Vector3(-4, 20, -62);
const LOOP_AT = new THREE.Vector3(26, 14.5, -35);
const LOOK_AT = new THREE.Vector3(0, 2, 0); // sân khấu / ca sĩ

const sm = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
/** Bán kính thân theo khoảng cách s sau đầu (giống GLSL radAt). */
const radAt = (s: number, lb: number) => R_BODY * (0.8 + 0.2 * sm(0, 3, s)) * (1 - 0.66 * sm(lb * 0.3, lb, s));

// ── 3 bộ màu: [thân, bụng, đốm, vây, sừng, má, bờm, nét tối, miệng, (ngọc), lòng trắng mắt]
type Way = [number, number, number, number, number, number, number];
const WAYS: Way[] = [
  [PAL.honey[500], PAL.cream[500], PAL.berry[500], PAL.mint[500], PAL.peach[500], PAL.berry[300], PAL.cream[300]],
  [PAL.mint[500], PAL.cream[500], PAL.soda[700], PAL.berry[500], PAL.peach[300], PAL.berry[300], PAL.cream[300]],
  [PAL.berry[300], PAL.cream[500], PAL.grape[500], PAL.soda[500], PAL.honey[500], PAL.berry[500], PAL.cream[300]],
];
const NSLOT = 11;
const v3 = (hex: number, out = new THREE.Vector3()) => out.fromArray(hexToRgb(hex));

// ───────────── Hình khối ─────────────
interface PartOpts { slot: number; part?: number; kind?: number; c?: THREE.Vector3; uv?: boolean }
function tag(parts: THREE.BufferGeometry[], g: THREE.BufferGeometry, o: PartOpts, uvFrom?: THREE.Matrix4) {
  const h = g.index ? g.toNonIndexed() : g;
  if (h !== g) g.dispose();
  const n = h.getAttribute('position').count;
  h.deleteAttribute('uv');
  const a = new Float32Array(n * 4);
  const c = o.c ?? new THREE.Vector3();
  for (let i = 0; i < n; i++) a.set([c.x, c.y, c.z, o.kind ?? 0], i * 4);
  h.setAttribute('aC', new THREE.BufferAttribute(a, 4));
  const b = new Float32Array(n * 4);
  const p = h.getAttribute('position');
  const inv = uvFrom ? uvFrom.clone().invert() : null;
  const q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    let ux = 0, uy = 0;
    if (inv) { q.fromBufferAttribute(p, i).applyMatrix4(inv); ux = q.x; uy = q.y; }
    b.set([o.slot, o.part ?? 0, ux, uy], i * 4);
  }
  h.setAttribute('aS', new THREE.BufferAttribute(b, 4));
  parts.push(h);
}
const merge = (p: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(p)!;
  p.forEach((x) => x.dispose());
  return g;
};
const sphere = (r: number, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 12);

/** Một đốt thân (đơn vị bán kính = 1, +z hướng về đầu). part: 0 thân · 1 vây · 2 chân · 3 ngón · 4 chùm đuôi. */
function buildSegment(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const body = sphere(1, 22, 16);
  body.scale(1, 0.96, 1.08);
  tag(p, body, { slot: 0, part: 0 });
  const fin = sphere(1, 12, 10);
  fin.scale(0.2, 0.5, 0.48);
  fin.rotateX(-0.35);
  fin.translate(0, 1.0, -0.12);
  tag(p, fin, { slot: 3, part: 1 });
  for (const sx of [-1, 1]) {
    const m = new THREE.Matrix4().makeTranslation(sx * 0.55, -0.5, 0.15)
      .multiply(new THREE.Matrix4().makeRotationZ(sx * 0.55))
      .multiply(new THREE.Matrix4().makeTranslation(0, -0.5, 0));
    const leg = capsule(0.3, 0.5);
    leg.applyMatrix4(m);
    tag(p, leg, { slot: 0, part: 2, c: new THREE.Vector3(sx * 0.55, -0.5, 0.15) });
    for (let k = -1; k <= 1; k++) {
      const toe = sphere(0.13, 8, 6);
      toe.translate(k * 0.17, -0.48, 0.2 - Math.abs(k) * 0.05);
      toe.applyMatrix4(m);
      tag(p, toe, { slot: 6, part: 3, c: new THREE.Vector3(sx * 0.55, -0.5, 0.15) });
    }
  }
  // chùm lông đuôi (chỉ đốt cuối, kích thước tuyệt đối)
  const tuft: [number, number, number, number, number][] = [
    [0, 0.1, -0.6, 0.55, 6], [0.35, 0.35, -1.2, 0.5, 6], [-0.35, 0.3, -1.25, 0.5, 6], [0, 0.65, -1.15, 0.45, 3],
    [0, -0.2, -1.4, 0.42, 3], [0.25, 0.1, -1.75, 0.38, 6], [-0.25, 0.15, -1.8, 0.36, 3], [0, 0.45, -1.75, 0.34, 6],
  ];
  for (const [x, y, z, r, slot] of tuft) {
    const g = sphere(r, 12, 9);
    g.translate(x, y, z);
    tag(p, g, { slot, part: 4 });
  }
  return merge(p);
}

/** Đầu (+z = phía trước, +y = lên). kind: 1 mắt · 2 miệng há · 3 tai · 4 râu · 5 ngọc. */
function buildHead(): { geo: THREE.BufferGeometry; pearl: THREE.Vector3 } {
  const p: THREE.BufferGeometry[] = [];
  const skull = sphere(R_HEAD, 28, 20);
  skull.scale(1.04, 0.94, 0.96);
  skull.translate(0, 0.15, 0);
  tag(p, skull, { slot: 0 });
  // mõm nhỏ màu kem
  const muz = sphere(1.08, 22, 14);
  muz.scale(1.2, 0.72, 0.8);
  muz.translate(0, -0.72, 1.55);
  tag(p, muz, { slot: 1 });
  for (const sx of [-1, 1]) {
    // lỗ mũi
    const ns = sphere(0.11, 8, 6);
    ns.scale(1.2, 0.8, 0.6);
    ns.translate(sx * 0.32, -0.42, 2.35);
    tag(p, ns, { slot: 7 });
    // mắt to: elip dẹt áp lên mặt, xoay nhẹ ra ngoài
    const em = new THREE.Matrix4().makeTranslation(sx * 0.8, 0.42, 1.62)
      .multiply(new THREE.Matrix4().makeRotationY(sx * 0.42))
      .multiply(new THREE.Matrix4().makeRotationX(-0.12));
    const eye = sphere(1, 22, 16);
    eye.scale(0.56, 0.68, 0.3);
    eye.applyMatrix4(em);
    const eu = em.clone().multiply(new THREE.Matrix4().makeScale(0.56, 0.68, 0.3));
    tag(p, eye, { slot: 10, kind: 1, c: new THREE.Vector3(sx * 0.8, 0.42, 1.62), uv: true }, eu);
    // lông mày ngắn
    const br = capsule(0.07, 0.34);
    br.rotateZ(Math.PI / 2 + sx * 0.25);
    br.rotateY(sx * 0.42);
    br.translate(sx * 0.86, 1.28, 1.6);
    tag(p, br, { slot: 7 });
    // má hồng
    const ck = sphere(0.36, 14, 10);
    ck.scale(1.15, 0.62, 0.3);
    ck.rotateY(sx * 0.95);
    ck.translate(sx * 1.38, -0.3, 1.32);
    tag(p, ck, { slot: 5 });
    // sừng tròn: nhánh chính + nhánh phụ
    const hm = new THREE.Matrix4().makeTranslation(sx * 0.82, 1.62, -0.25)
      .multiply(new THREE.Matrix4().makeRotationZ(-sx * 0.42))
      .multiply(new THREE.Matrix4().makeRotationX(-0.4));
    const h1 = capsule(0.24, 0.62); h1.translate(0, 0.45, 0); h1.applyMatrix4(hm);
    tag(p, h1, { slot: 4 });
    const h2 = capsule(0.16, 0.28); h2.translate(0, 0.2, 0); h2.rotateZ(sx * 0.95); h2.translate(0, 0.5, 0); h2.applyMatrix4(hm);
    tag(p, h2, { slot: 4 });
    // tai cụp (vẫy)
    const ec = new THREE.Vector3(sx * 1.6, 0.85, -0.55);
    const ear = sphere(1, 14, 10);
    ear.scale(0.32, 0.18, 0.6);
    ear.translate(0, 0, -0.35);
    ear.rotateZ(-sx * 0.5);
    ear.rotateY(sx * 0.5);
    ear.translate(ec.x + sx * 0.25, ec.y - 0.1, ec.z);
    tag(p, ear, { slot: 3, kind: 3, c: ec });
    // râu capsule lượn (từ mép mõm ra sau)
    const root = new THREE.Vector3(sx * 1.05, -0.7, 1.9);
    const wc = new THREE.CatmullRomCurve3([
      root, new THREE.Vector3(sx * 1.8, -0.75, 1.65), new THREE.Vector3(sx * 2.5, -0.5, 1.0), new THREE.Vector3(sx * 3.05, -0.85, 0.25),
    ]);
    const wh = new THREE.TubeGeometry(wc, 18, 0.085, 6, false);
    tag(p, wh, { slot: 3, kind: 4, c: root });
    const wt = sphere(0.13, 8, 6); wt.translate(sx * 3.05, -0.85, 0.25);
    tag(p, wt, { slot: 3, kind: 4, c: root });
  }
  // miệng cười (cung) + miệng há (dẹt, phóng to khi thở)
  const smile = new THREE.TorusGeometry(0.3, 0.065, 6, 18, Math.PI);
  smile.rotateZ(Math.PI);
  smile.rotateX(-0.25);
  smile.translate(0, -0.72, 2.42);
  tag(p, smile, { slot: 7 });
  const mo = sphere(0.5, 16, 12);
  mo.scale(1, 0.85, 0.42);
  mo.rotateX(-0.25);
  mo.translate(0, -0.95, 2.3);
  tag(p, mo, { slot: 8, kind: 2, c: new THREE.Vector3(0, -0.95, 2.3) }, new THREE.Matrix4().makeTranslation(0, -0.95, 2.3).multiply(new THREE.Matrix4().makeScale(0.5, 0.42, 0.21)));
  // chỏm bờm kem
  const mane: [number, number, number, number][] = [
    [0, 2.05, -0.35, 0.55], [0.42, 1.95, -0.75, 0.48], [-0.42, 1.95, -0.75, 0.48], [0, 1.85, -1.1, 0.5],
    [0.3, 2.3, -0.05, 0.36], [-0.3, 2.28, -0.08, 0.34], [0, 1.45, -1.55, 0.5], [0.55, 1.4, -1.35, 0.4], [-0.55, 1.4, -1.35, 0.4],
  ];
  for (const [x, y, z, r] of mane) {
    const g = sphere(r, 12, 9);
    g.translate(x, y, z);
    tag(p, g, { slot: 6 });
  }
  // ngọc: trước miệng
  const pearl = new THREE.Vector3(0, -1.5, 3.35);
  const pg = sphere(0.62, 22, 16);
  pg.translate(pearl.x, pearl.y, pearl.z);
  tag(p, pg, { slot: 9, kind: 5, c: pearl });
  return { geo: merge(p), pearl };
}

// ───────────── CPU: đường bay (khớp GLSL) ─────────────
interface PathCPU { data: Float32Array; len: number; speed: number; loopD: number }
function pathAt(P: PathCPU, d: number, out: THREE.Vector3) {
  const x = Math.min(1, Math.max(0, d / P.len)) * (NS - 1);
  const a = Math.floor(x), b = Math.min(a + 1, NS - 1), f = x - a;
  const A = P.data, ia = a * 4, ib = b * 4;
  return out.set(A[ia]! + (A[ib]! - A[ia]!) * f, A[ia + 1]! + (A[ib + 1]! - A[ia + 1]!) * f, A[ia + 2]! + (A[ib + 2]! - A[ia + 2]!) * f);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _T = new THREE.Vector3(), _sd = new THREE.Vector3(), _up = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
function pathFrame(P: PathCPU, d: number) {
  pathAt(P, d + 1, _a); pathAt(P, d - 1, _b);
  _T.subVectors(_a, _b); _T.x += 1e-4; _T.normalize();
  _sd.crossVectors(Y, _T); _sd.z += 1e-4; _sd.normalize();
  _up.crossVectors(_T, _sd);
}
function bodyPos(P: PathCPU, s: number, t: number, out: THREE.Vector3) {
  const d = P.speed * t - s;
  pathAt(P, d, out);
  pathFrame(P, d);
  const env = 0.25 + 0.75 * sm(0, 6, s);
  const ph = s * 0.42 - t * 4.2;
  out.addScaledVector(_sd, Math.sin(ph) * 1.6 * env).addScaledVector(_up, Math.cos(ph * 0.7 + 1) * 0.9 * env);
  // vòng lộn: lệch theo d trong mặt phẳng (T, up) của đường
  const u = Math.min(1, Math.max(0, (d - P.loopD) / LOOP_LEN));
  const th = 6.2831853 * u * u * (3 - 2 * u);
  out.addScaledVector(_T, -LOOP_R * Math.sin(th)).addScaledVector(_up, LOOP_R * (1 - Math.cos(th)));
  return out;
}

export function createDragon(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const curve = new THREE.CatmullRomCurve3(PATH_PTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const samples = curve.getSpacedPoints(NS - 1);
  const data = new Float32Array(NS * 4);
  let bi = 0, bd = Infinity, li = 0, ld = Infinity;
  samples.forEach((v, i) => {
    data.set([v.x, v.y, v.z, 1], i * 4);
    const d = v.distanceTo(BREATH_AT);
    if (d < bd) { bd = d; bi = i; }
    const e = v.distanceTo(LOOP_AT);
    if (e < ld) { ld = e; li = i; }
  });
  const tex = new THREE.DataTexture(data, NS, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  const len = curve.getLength();
  const speed = len / (D - 0.5);
  const loopD = (li / (NS - 1)) * len - LOOP_LEN / 2;
  const P: PathCPU = { data, len, speed, loopD };
  const tBreath = ((bi / (NS - 1)) * len) / speed - 0.6;

  // ── vị trí các đốt: khoảng cách ∝ bán kính để luôn chồng khít
  let lb = 26;
  const sArr = new Float32Array(NSEG);
  for (let it = 0; it < 6; it++) {
    let s = 0.9;
    for (let k = 0; k < NSEG; k++) { sArr[k] = s; s += 0.5 * radAt(s, lb); }
    lb = sArr[NSEG - 1]!;
  }
  const nearest = (s: number) => sArr.reduce((bk, v, k) => (Math.abs(v - s) < Math.abs(sArr[bk]! - s) ? k : bk), 0);
  const LEG1 = nearest(2.6), LEG2 = nearest(lb * 0.42);

  const uCol = Array.from({ length: NSLOT }, () => new THREE.Vector3());
  const uSh = Array.from({ length: NSLOT }, () => new THREE.Vector3());
  const U = {
    uPath: { value: tex }, uLen: { value: len }, uSpeed: { value: speed }, uLoopD: { value: loopD }, uLb: { value: lb },
    uT: { value: 0 }, uPop: { value: 1 }, uPulse: { value: 0 }, uViewH: { value: 720 },
    uCol: { value: uCol }, uSh: { value: uSh },
    uRimC: { value: v3(PAL.cream[300]).lerp(v3(SECRET_RIM), 0.6) },
    uInk: { value: v3(INK_SKY) },
    uCore: { value: v3(SECRET_CORE) }, uRimS: { value: v3(SECRET_RIM) },
    uBlink: { value: 0 }, uMouth: { value: 0 }, uLook: { value: new THREE.Vector2() },
    uOutW: { value: OUTLINE.secret * OBJ_H }, uObjH: { value: OBJ_H },
  };
  const defs = (o: Record<string, number>) => ({ NSEG, LEG1, LEG2, ...o });

  const segBase = buildSegment();
  const segGeo = new THREE.InstancedBufferGeometry();
  for (const [k, a] of Object.entries(segBase.attributes)) segGeo.setAttribute(k, a);
  const inst = new Float32Array(NSEG * 2);
  for (let k = 0; k < NSEG; k++) inst.set([sArr[k]!, k], k * 2);
  segGeo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 2));
  segGeo.instanceCount = NSEG;

  const mk = (o: Record<string, number>, hull: boolean) => new THREE.ShaderMaterial({
    vertexShader: DRAGON_GLSL.vert, fragmentShader: DRAGON_GLSL.frag, uniforms: U, fog: false,
    defines: defs(hull ? { ...o, HULL: 1 } : o), side: hull ? THREE.BackSide : THREE.FrontSide,
  });
  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => {
    const x = new THREE.Mesh(g, m);
    x.frustumCulled = false;
    parent.add(x);
    return x;
  };
  addMesh(segGeo, mk({ BODY: 1 }, false), root);
  addMesh(segGeo, mk({ BODY: 1 }, true), root);

  const head = new THREE.Group();
  root.add(head);
  const { geo: headGeo, pearl } = buildHead();
  addMesh(headGeo, mk({ HEAD: 1 }, false), head);
  addMesh(headGeo, mk({ HEAD: 1 }, true), head);

  // ── hạt: lấp lánh sau thân · hơi thở tim/sao · sao quanh ngọc (1 Points)
  const ptsU = { ...U, uPx: { value: 720 }, uBreathT: { value: tBreath }, uPearl: { value: new THREE.Vector3() } };
  const rnd = seededRnd(9001);
  const cols = [PAL.berry[500], PAL.berry[300], PAL.honey[500], PAL.honey[300], PAL.mint[500], PAL.soda[300], PAL.cream[100], PAL.peach[300]];
  const pts = makePoints(2600, DRAGON_GLSL.pts, ptsU, (i, s, c) => {
    s.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    c.set(hexToRgb(cols[Math.floor(rnd() * cols.length)]!), i * 3);
  }, { additive: false, frag: DRAGON_PTS_FRAG });
  pts.renderOrder = 7;
  root.add(pts);

  const halo = createSecretHalo();
  root.add(halo.group);

  // ── trạng thái mỗi lần chạy
  let blinks: number[] = [];
  const hp = new THREE.Vector3(), hq = new THREE.Vector3(), fw = new THREE.Vector3(), sd = new THREE.Vector3(), up = new THREE.Vector3();
  const mtx = new THREE.Matrix4(), look = new THREE.Vector3(), pw = new THREE.Vector3();
  const tA = new THREE.Vector3(), tB = new THREE.Vector3();

  return {
    duration: D,
    start() {
      root.visible = true;
      const way = WAYS[Math.floor(Math.random() * WAYS.length)]!;
      const slots = [...way, INK_SKY === PAL.night[100] ? 0x2b1d5c : INK_SKY, PAL.berry[700], SECRET_CORE, PAL.cream[100]];
      slots.forEach((hex, k) => { v3(hex, uCol[k]); v3(shadowOf(hex), uSh[k]); });
      blinks = [];
      for (let t = 1 + Math.random() * 2; t < D; t += 3 + Math.random() * 2) blinks.push(t);
    },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      U.uT.value = t;
      U.uPulse.value = f.beatPulse;
      U.uPop.value = popScale(t);
      U.uViewH.value = ptsU.uPx.value = pxScale();
      const b = t - tBreath;
      U.uMouth.value = sm(-0.25, 0.15, b) * (1 - sm(BREATH_DUR, BREATH_DUR + 0.4, b));
      let bl = 0;
      for (const x of blinks) bl = Math.max(bl, 1 - Math.abs(t - x) / 0.09);
      U.uBlink.value = Math.max(0, bl);

      // khung đầu (khớp shader thân)
      bodyPos(P, S_HEAD, t, hp);
      bodyPos(P, S_HEAD - 0.5, t, tA); bodyPos(P, S_HEAD + 0.5, t, tB);
      fw.subVectors(tA, tB).normalize();
      pathFrame(P, speed * t - S_HEAD);
      sd.crossVectors(Y, _T).normalize();
      up.crossVectors(fw, sd).normalize();
      sd.crossVectors(up, fw).normalize();
      mtx.makeBasis(sd, up, fw);
      head.position.copy(hp);
      head.quaternion.setFromRotationMatrix(mtx);
      // co giãn: rẽ gắt → dẹt dọc trục bay; thở → vươn lên
      pathAt(P, speed * t + 4, tA); pathAt(P, speed * t - 4, tB); pathAt(P, speed * t, hq);
      const turn = tA.sub(hq).normalize().distanceTo(hq.sub(tB).normalize());
      const sq = Math.min(0.2, turn * 0.3);
      const br = U.uMouth.value * 0.08;
      const pop = U.uPop.value;
      head.scale.set(pop * (1 + sq * 0.5), pop * (1 + sq * 0.4 + br), pop * (1 - sq - br * 0.5));
      // mắt nhìn về sân khấu
      look.subVectors(LOOK_AT, hp).normalize();
      U.uLook.value.set(Math.max(-0.28, Math.min(0.28, look.dot(sd) * 0.4)), Math.max(-0.22, Math.min(0.22, look.dot(up) * 0.4)));
      // ngọc (khớp kind 5 trong shader)
      pw.copy(pearl);
      pw.y += Math.sin(t * 3) * 0.12;
      ptsU.uPearl.value.copy(head.localToWorld(pw));
      const appear = sm(0.1, 0.8, t) * (1 - sm(D - 2.2, D - 0.6, t));
      halo.group.position.copy(hp);
      halo.update(t, R_HEAD * 1.35, appear);
    },
    dispose() {
      segBase.dispose();
      tex.dispose();
      halo.dispose();
      disposeTree(root);
    },
  };
}
