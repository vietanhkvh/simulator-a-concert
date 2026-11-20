// ★ ĐÔI rồng chibi (STYLE_GUIDE · SECRET OBJECT): mỗi con đầu tròn to (≈1,6 × đường kính thân), mắt long lanh
// chớp + nhìn về sân khấu (nhìn nhau khi lướt qua), má hồng, mõm nhỏ có lỗ mũi, miệng cười (há khi "thở"), sừng
// tròn, tai cụp + râu lượn, chỏm bờm kem; thân 34 đốt cầu chồng nhau, bụng kem có vạch, đốm + vảy trong shader,
// vây lưng tròn, 4 chân ngắn khua, chùm lông đuôi; mỗi con ngậm một viên NGỌC phát sáng + vành secret riêng.
// Hai bộ màu tương phản. Biên đạo (D = 24 s, hai đường bay đối xứng gương qua x = 0, lệch cao độ 10 m):
//   0–6,5 s  vào từ hai mép sân vận động, lượn sóng trên khán giả → giao nhau ở giữa (6,7 s, lắc chào + lấp lánh)
//   6,7–16 s vòng xoắn ốc nghiêng (corkscrew) quanh khu B-stage, ngược chiều nhau (A xuôi, B ngược kim đồng hồ),
//            giao nhau ở mỗi nửa vòng; ~14 s cả hai thở tim/sao lên trời, hai luồng chéo nhau thành trái tim lớn
//   16–24 s  xoắn rộng dần rồi bay vút đi về hai phía đối diện.
// Khung hướng: up được tính sẵn trên CPU (khung ngang + bank theo gia tốc ngang, kẹp ±35°, làm mượt) ⇒ đầu và thân
// không bao giờ lộn ngược / xoắn. Draw call: thân (2×34 instance) + viền thân + đầu (2 instance) + viền đầu
// + 1 Points + 2 vành secret = 7. Mỗi frame chỉ đổi uniform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { INK, INK_SKY, OUTLINE, PAL, SECRET_CORE, SECRET_RIM, hexToRgb, mixHex, popScale, shadowOf } from '../../world/style';
import { type SecretAct, disposeTree, makePoints, pxScale, seededRnd } from './secretShared';
import { createSecretHalo } from './secretHalo';
import { DRAGON_GLSL, DRAGON_PTS_FRAG } from './secretDragonShaders';

const D = 24;
const NSEG = 34;
const SC = 1.3; // tỉ lệ toàn con (to hơn để đọc được từ camera toàn cảnh)
const R_BODY = 1.3; // bán kính thân lớn nhất (đơn vị trước tỉ lệ)
const R_HEAD = 2.1; // ≈ 1,6 × đường kính thân
const S_HEAD = -0.6 * SC; // vị trí đầu trên trục thân
const NS = 1024;
const BREATH_DUR = 2.0;
const OBJ_H = 4.6 * SC; // chiều cao vật thể cho độ dày viền (3,5%)
const DY = 5; // lệch cao độ mỗi con so với đường gốc (tổng 10 m ⇒ không bao giờ chạm nhau)
const BANK_MAX = (35 * Math.PI) / 180;
const G = 9.8;

// ── Đường gốc (rồng A, vào từ +x); rồng B = gương x → −x. Vòng quanh B-stage: tâm (0, ·, −42), R = 16.
const RING_Z = -44, RING_R = 16;
function basePath(): [number, number, number][] {
  const p: [number, number, number][] = [[78, 38, -44], [60, 34, -30], [44, 31, -42], [28, 33, -30], [13, 33, -24]];
  const N = 21;
  for (let i = 0; i <= N; i++) {
    const ph = (i / N) * 3.5 * Math.PI;
    const e = Math.max(0, (ph - 3 * Math.PI) / (0.5 * Math.PI));
    const r = RING_R + e * 14;
    const y = ph <= 3 * Math.PI ? 33 + (10 * ph) / (3 * Math.PI) : 43 + e * 12;
    p.push([-r * Math.sin(ph), y, RING_Z + r * Math.cos(ph)]);
  }
  p.push([42, 62, -18], [62, 72, -28], [98, 90, -52]);
  return p;
}
const HEART_C = new THREE.Vector3(0, 57, RING_Z);
const BREATH_PT = new THREE.Vector3(-RING_R, 33 + (10 * 2.5) / 3 - DY, RING_Z); // A ở điểm tây, vòng thứ hai
const LOOK_AT = new THREE.Vector3(0, 2, 0); // sân khấu / ca sĩ

const sm = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
/** Bán kính thân theo khoảng cách s sau đầu (giống GLSL radAt). */
const radAt = (s: number, lb: number) => SC * R_BODY * (0.8 + 0.2 * sm(0, 3 * SC, s)) * (1 - 0.66 * sm(lb * 0.3, lb, s));

// ── bộ màu: [thân, bụng, đốm, vây, sừng, má, bờm] + [nét tối, miệng, ngọc, lòng trắng mắt]
type Way = [number, number, number, number, number, number, number];
const WAYS = (): Way[] => [
  [PAL.honey[500], PAL.cream[500], PAL.berry[500], PAL.mint[500], PAL.peach[500], PAL.berry[300], PAL.cream[300]],
  [PAL.mint[500], PAL.cream[500], PAL.soda[700], PAL.berry[500], PAL.peach[300], PAL.berry[300], PAL.cream[300]],
  [PAL.berry[300], PAL.cream[500], PAL.grape[500], PAL.soda[500], PAL.honey[500], PAL.berry[500], PAL.cream[300]],
];
/** Các cặp tương phản (mật ong/đào ↔ bạc hà/soda, bạc hà ↔ dâu/nho, mật ong ↔ dâu/nho). */
const PAIRS: [number, number][] = [[0, 1], [1, 2], [0, 2]];
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

// ───────────── CPU: đường bay + khung (khớp GLSL) ─────────────
export interface DragonPath { pos: Float32Array; up: Float32Array; len: number }
function rowAt(A: Float32Array, len: number, d: number, out: THREE.Vector3) {
  const x = Math.min(1, Math.max(0, d / len)) * (NS - 1);
  const a = Math.floor(x), b = Math.min(a + 1, NS - 1), f = x - a;
  const ia = a * 4, ib = b * 4;
  return out.set(A[ia]! + (A[ib]! - A[ia]!) * f, A[ia + 1]! + (A[ib + 1]! - A[ia + 1]!) * f, A[ia + 2]! + (A[ib + 2]! - A[ia + 2]!) * f);
}
const Y = new THREE.Vector3(0, 1, 0);

/** Lấy mẫu đường (cách đều theo độ dài) + up ổn định: khung ngang + bank theo gia tốc ngang (kẹp ±35°, làm mượt). */
export function buildDragonPath(pts: [number, number, number][], speedGuess: number, rollAt: number[] = [], rollSign = 1): DragonPath {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const sp = curve.getSpacedPoints(NS - 1);
  const len = curve.getLength();
  const ds = len / (NS - 1);
  const pos = new Float32Array(NS * 4), up = new Float32Array(NS * 4);
  const T = sp.map((_, i) => new THREE.Vector3().subVectors(sp[Math.min(NS - 1, i + 2)]!, sp[Math.max(0, i - 2)]!).normalize());
  const bank = new Float32Array(NS);
  const sd = new THREE.Vector3(), k = new THREE.Vector3();
  for (let i = 0; i < NS; i++) {
    const a = Math.min(NS - 1, i + 3), b = Math.max(0, i - 3);
    k.subVectors(T[a]!, T[b]!).divideScalar((a - b) * ds);
    sd.crossVectors(Y, T[i]!).normalize();
    let bk = Math.atan((speedGuess * speedGuess * k.dot(sd)) / G);
    // lắc chào nhẹ khi lướt qua nhau
    for (const ic of rollAt) {
      const u = ((i - ic) * ds) / 16;
      if (Math.abs(u) < 1) bk += rollSign * 0.5 * Math.sin(u * Math.PI * 2) * (0.5 + 0.5 * Math.cos(u * Math.PI));
    }
    bank[i] = Math.max(-BANK_MAX, Math.min(BANK_MAX, bk));
  }
  // làm mượt bank (2 lượt trung bình trượt ±12 mẫu), rồi kẹp lại
  for (let pass = 0; pass < 2; pass++) {
    const src = bank.slice();
    for (let i = 0; i < NS; i++) {
      let s = 0, n = 0;
      for (let j = Math.max(0, i - 12); j <= Math.min(NS - 1, i + 12); j++) { s += src[j]!; n++; }
      bank[i] = Math.max(-BANK_MAX, Math.min(BANK_MAX, s / n));
    }
  }
  const u0 = new THREE.Vector3();
  for (let i = 0; i < NS; i++) {
    const t = T[i]!;
    sd.crossVectors(Y, t).normalize();
    u0.crossVectors(t, sd);
    u0.multiplyScalar(Math.cos(bank[i]!)).addScaledVector(sd, Math.sin(bank[i]!)).normalize();
    pos.set([sp[i]!.x, sp[i]!.y, sp[i]!.z, 1], i * 4);
    up.set([u0.x, u0.y, u0.z, 0], i * 4);
  }
  return { pos, up, len };
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _T = new THREE.Vector3(), _sd = new THREE.Vector3(), _up = new THREE.Vector3();
function pathFrame(P: DragonPath, d: number) {
  rowAt(P.pos, P.len, d + 1, _a); rowAt(P.pos, P.len, d - 1, _b);
  _T.subVectors(_a, _b); _T.x += 1e-4; _T.normalize();
  rowAt(P.up, P.len, d, _up);
  _sd.crossVectors(_up, _T); _sd.z += 1e-5; _sd.normalize();
  _up.crossVectors(_T, _sd);
}
function bodyPos(P: DragonPath, id: number, speed: number, s: number, t: number, out: THREE.Vector3) {
  const d = speed * t - s;
  pathFrame(P, d);
  rowAt(P.pos, P.len, d, out);
  const env = 0.25 + 0.75 * sm(0, 6 * SC, s);
  const ph = (s * 0.42) / SC - t * 4.2 + id * 1.9;
  return out.addScaledVector(_sd, Math.sin(ph) * 1.6 * SC * env).addScaledVector(_up, Math.cos(ph * 0.7 + 1) * 0.9 * SC * env);
}
/** Khung đầu (khớp frameAt trong shader): ghi vào P, fw, sd, up. */
export function headFrame(P: DragonPath, id: number, speed: number, t: number, hp: THREE.Vector3, fw: THREE.Vector3, sd: THREE.Vector3, up: THREE.Vector3) {
  bodyPos(P, id, speed, S_HEAD - 0.5, t, fw);
  bodyPos(P, id, speed, S_HEAD + 0.5, t, sd);
  fw.sub(sd).normalize();
  bodyPos(P, id, speed, S_HEAD, t, hp);
  rowAt(P.up, P.len, speed * t - S_HEAD, up);
  sd.crossVectors(up, fw).normalize();
  up.crossVectors(fw, sd).normalize();
}

/** Hai đường bay đối xứng (A, B) + các mốc thời gian. Xuất cho test. */
export function dragonPaths() {
  const base = basePath();
  const A0 = base.map(([x, y, z]) => [x, y - DY, z] as [number, number, number]);
  const B0 = base.map(([x, y, z]) => [-x, y + DY, z] as [number, number, number]);
  const probe = buildDragonPath(A0, 15);
  const speed = probe.len / (D + 0.6); // đầu không bao giờ chạm cuối đường (khung không suy biến)
  // mốc giao nhau: x của A đổi dấu
  const cross: number[] = [];
  for (let i = 1; i < NS && cross.length < 4; i++) if (probe.pos[(i - 1) * 4]! > 0 !== probe.pos[i * 4]! > 0) cross.push(i);
  const A = buildDragonPath(A0, speed, cross, 1);
  const B = buildDragonPath(B0, speed, cross, -1);
  const ds = A.len / (NS - 1);
  const crossT = cross.map((i) => (i * ds + S_HEAD) / speed);
  let bi = 0, bd = Infinity;
  for (let i = 0; i < NS; i++) {
    const d = _a.set(A.pos[i * 4]!, A.pos[i * 4 + 1]!, A.pos[i * 4 + 2]!).distanceTo(BREATH_PT);
    if (d < bd) { bd = d; bi = i; }
  }
  const tBreath = (bi * ds + S_HEAD) / speed - 0.9;
  return { A, B, speed, crossT, tBreath };
}

export function createDragon(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const { A, B, speed, crossT, tBreath } = dragonPaths();
  const paths = [A, B];
  const len = A.len;
  const data = new Float32Array(NS * 4 * 4);
  data.set(A.pos, 0); data.set(A.up, NS * 4); data.set(B.pos, NS * 8); data.set(B.up, NS * 12);
  const tex = new THREE.DataTexture(data, NS, 4, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;

  // ── vị trí các đốt: khoảng cách ∝ bán kính để luôn chồng khít
  let lb = 26 * SC;
  const sArr = new Float32Array(NSEG);
  for (let it = 0; it < 6; it++) {
    let s = 0.9 * SC;
    for (let k = 0; k < NSEG; k++) { sArr[k] = s; s += 0.5 * radAt(s, lb); }
    lb = sArr[NSEG - 1]!;
  }
  const nearest = (s: number) => sArr.reduce((bk, v, k) => (Math.abs(v - s) < Math.abs(sArr[bk]! - s) ? k : bk), 0);
  const LEG1 = nearest(2.6 * SC), LEG2 = nearest(lb * 0.42);

  const uCol = Array.from({ length: NSLOT * 2 }, () => new THREE.Vector3());
  const uSh = Array.from({ length: NSLOT * 2 }, () => new THREE.Vector3());
  const headM = [new THREE.Matrix4(), new THREE.Matrix4()];
  const U = {
    uPath: { value: tex }, uLen: { value: len }, uSpeed: { value: speed }, uLb: { value: lb },
    uT: { value: 0 }, uPop: { value: 1 }, uPulse: { value: 0 }, uViewH: { value: 720 },
    uCol: { value: uCol }, uSh: { value: uSh }, uHeadM: { value: headM },
    uRimC: { value: v3(PAL.cream[300]).lerp(v3(SECRET_RIM), 0.6) },
    uInk: { value: v3(INK_SKY) },
    uCore: { value: v3(SECRET_CORE) }, uRimS: { value: v3(SECRET_RIM) },
    uBlink: { value: new THREE.Vector2() }, uMouth: { value: new THREE.Vector2() }, uLook: { value: new THREE.Vector4() },
    uOutW: { value: OUTLINE.secret * OBJ_H }, uObjH: { value: OBJ_H },
  };
  const defs = (o: Record<string, number | string>) => ({ NSEG, LEG1, LEG2, NSLOT, SC: SC.toFixed(3), NSF: `${NS - 1}.0`, ...o });

  // ── thân: một InstancedBufferGeometry cho cả đôi (instance = [s, k, id])
  const segBase = buildSegment();
  const segGeo = new THREE.InstancedBufferGeometry();
  for (const [k, a] of Object.entries(segBase.attributes)) segGeo.setAttribute(k, a);
  const inst = new Float32Array(NSEG * 2 * 3);
  for (let id = 0; id < 2; id++) for (let k = 0; k < NSEG; k++) inst.set([sArr[k]!, k, id], (id * NSEG + k) * 3);
  segGeo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 3));
  segGeo.instanceCount = NSEG * 2;

  const mk = (o: Record<string, number>, hull: boolean) => new THREE.ShaderMaterial({
    vertexShader: DRAGON_GLSL.vert, fragmentShader: DRAGON_GLSL.frag, uniforms: U, fog: false,
    defines: defs(hull ? { ...o, HULL: 1 } : o), side: hull ? THREE.BackSide : THREE.FrontSide,
  });
  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const x = new THREE.Mesh(g, m);
    x.frustumCulled = false;
    root.add(x);
    return x;
  };
  addMesh(segGeo, mk({ BODY: 1 }, false));
  addMesh(segGeo, mk({ BODY: 1 }, true));

  // ── đầu: 2 instance, ma trận qua uniform uHeadM[2]
  const { geo: headBase, pearl } = buildHead();
  const headGeo = new THREE.InstancedBufferGeometry();
  for (const [k, a] of Object.entries(headBase.attributes)) headGeo.setAttribute(k, a);
  headGeo.setAttribute('aId', new THREE.InstancedBufferAttribute(new Float32Array([0, 1]), 1));
  headGeo.instanceCount = 2;
  addMesh(headGeo, mk({ HEAD: 1 }, false));
  addMesh(headGeo, mk({ HEAD: 1 }, true));

  // ── hạt (1 Points cho cả đôi)
  const pearlW = [new THREE.Vector3(), new THREE.Vector3()];
  const cr = new THREE.Vector4(...[0, 1, 2, 3].map((i) => crossT[i] ?? -99) as [number, number, number, number]);
  const ptsU = { ...U, uPx: { value: 720 }, uBreathT: { value: tBreath }, uHeart: { value: HEART_C }, uCross: { value: cr }, uPearl: { value: pearlW } };
  const rnd = seededRnd(9001);
  const cols = [PAL.berry[500], PAL.berry[300], PAL.honey[500], PAL.honey[300], PAL.mint[500], PAL.soda[300], PAL.cream[100], PAL.peach[300]];
  const NP = 3600;
  const pts = makePoints(NP, DRAGON_GLSL.pts, ptsU, (i, s, c) => {
    const id = i % 2;
    const w = i < 16 ? 0.975 : i < 20 ? 0.995 : rnd() * 0.96;
    s.set([(id + rnd() * 0.999) * 0.5, rnd(), rnd(), w], i * 4);
    c.set(hexToRgb(cols[Math.floor(rnd() * cols.length)]!), i * 3);
  }, { additive: false, frag: DRAGON_PTS_FRAG });
  (pts.material as THREE.ShaderMaterial).defines = defs({});
  pts.renderOrder = 7;
  root.add(pts);

  const halos = [createSecretHalo(), createSecretHalo()];
  for (const h of halos) root.add(h.group);

  // ── trạng thái mỗi lần chạy
  let blinks: number[][] = [[], []];
  const hp = [new THREE.Vector3(), new THREE.Vector3()];
  const fw = new THREE.Vector3(), sd = new THREE.Vector3(), up = new THREE.Vector3();
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), scl = new THREE.Vector3();
  const look = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
  const foc = new THREE.Vector3(), focRaw = new THREE.Vector3();
  let lastT = -1;

  return {
    duration: D,
    start() {
      root.visible = true;
      const pr = PAIRS[Math.floor(Math.random() * PAIRS.length)]!;
      const flip = Math.random() < 0.5;
      for (let id = 0; id < 2; id++) {
        const way = WAYS()[pr[flip ? 1 - id : id]!]!;
        const slots = [...way, INK, PAL.berry[700], SECRET_CORE, PAL.cream[100]];
        slots.forEach((hex, k) => { v3(hex, uCol[k + id * NSLOT]); v3(mixHex(shadowOf(hex), hex, 0.3), uSh[k + id * NSLOT]); });
        blinks[id] = [];
        for (let t = 1 + Math.random() * 2; t < D; t += 3 + Math.random() * 2) blinks[id]!.push(t);
      }
      lastT = -1;
    },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      U.uT.value = t;
      U.uPulse.value = f.beatPulse;
      U.uPop.value = popScale(t);
      U.uViewH.value = ptsU.uPx.value = pxScale();
      const b = t - tBreath;
      const mouth = sm(-0.25, 0.15, b) * (1 - sm(BREATH_DUR, BREATH_DUR + 0.4, b));
      U.uMouth.value.set(mouth, mouth);
      const pop = U.uPop.value;
      const appear = sm(0.1, 0.8, t) * (1 - sm(D - 2.2, D - 0.6, t));
      let near = 0;
      for (const c of crossT) near = Math.max(near, 1 - sm(0.6, 1.4, Math.abs(t - c)));

      for (let id = 0; id < 2; id++) {
        const P = paths[id]!;
        let bl = 0;
        for (const x of blinks[id]!) bl = Math.max(bl, 1 - Math.abs(t - x) / 0.09);
        if (id === 0) U.uBlink.value.x = Math.max(0, bl); else U.uBlink.value.y = Math.max(0, bl);

        const h = hp[id]!;
        headFrame(P, id, speed, t, h, fw, sd, up);
        // co giãn: rẽ gắt → dẹt dọc trục bay; thở → vươn lên
        const d = speed * t;
        rowAt(P.pos, len, d + 4 * SC, tA); rowAt(P.pos, len, d - 4 * SC, tB); rowAt(P.pos, len, d, tC);
        const turn = tA.sub(tC).normalize().distanceTo(tC.sub(tB).normalize());
        const sq = Math.min(0.2, turn * 0.3);
        const br = mouth * 0.08;
        mtx.makeBasis(sd, up, fw);
        q.setFromRotationMatrix(mtx);
        scl.set(pop * (1 + sq * 0.5), pop * (1 + sq * 0.4 + br), pop * (1 - sq - br * 0.5)).multiplyScalar(SC);
        headM[id]!.compose(h, q, scl);
        // mắt: nhìn sân khấu, nhìn bạn khi lướt qua nhau
        const other = hp[1 - id]!;
        look.subVectors(LOOK_AT, h).normalize();
        // (rồng 0 dùng vị trí đầu rồng 1 của frame trước — sai lệch không đáng kể)
        tA.subVectors(other, h).normalize();
        look.lerp(tA, near).normalize();
        const lx = Math.max(-0.28, Math.min(0.28, look.dot(sd) * 0.4)), ly = Math.max(-0.22, Math.min(0.22, look.dot(up) * 0.4));
        if (id === 0) { U.uLook.value.x = lx; U.uLook.value.y = ly; } else { U.uLook.value.z = lx; U.uLook.value.w = ly; }
        // ngọc (khớp kind 5 trong shader)
        pearlW[id]!.set(pearl.x, pearl.y + Math.sin(t * 3 + id * 1.5) * 0.12, pearl.z).applyMatrix4(headM[id]!);
        halos[id]!.group.position.copy(h);
        halos[id]!.update(t, R_HEAD * SC * 1.35, appear);
      }
      // điểm nhìn: giữa hai đầu, kéo về trái tim lúc thở; làm mượt theo thời gian
      focRaw.addVectors(hp[0]!, hp[1]!).multiplyScalar(0.5);
      focRaw.lerp(HEART_C, 0.45 * sm(-0.2, 1.2, b) * (1 - sm(4.2, 5.5, b)));
      const snap = lastT < 0 || t < lastT;
      foc.lerp(focRaw, snap ? 1 : 1 - Math.exp(-(t - lastT) * 2.5));
      lastT = t;
    },
    focus(_t: number, out: THREE.Vector3) {
      out.copy(foc);
    },
    dispose() {
      segBase.dispose();
      headBase.dispose();
      tex.dispose();
      for (const h of halos) h.dispose();
      disposeTree(root);
    },
  };
}
