// "Đêm Sao Điểm Ảnh" — ban nhạc hoạ sĩ (gói P4, khe `band`): 6 nhạc công sprite-3D cùng rig với ca sĩ, đúng vị trí ban nhạc
// mặc định. Đạo cụ tự vẽ bằng khối phẳng: trống = thùng sơn (bass = thùng lớn, snare / tom = thùng nhỏ nắp sơn màu, chũm chọe
// = nắp thùng vàng chrome, ghế = thùng úp), guitar / bass = BẢNG PHA MÀU có cần (chấm sơn + lỗ ngón cái), keyboard đặt trên
// GIÁ VẼ (toan căng khung phía sau), 2 bè phụ hát vào cọ cắm trên chân mic, đứng trên bục thùng sơn.
// Hoạt hoạ bước 12 fps. Draw call: thân + viền 2, bóng đổ 1 = 3.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import type { ArenaBuilders, Band } from '../../builders';
import {
  INK, PixelBatch, R, SKIN_TONES, Tick12, aimHold, buildPainter, clamp, dirToChest, hipHeight, leg, reach, resetPose, worldToChest,
  type PainterLook, type PixChar,
} from './pixelRig';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
type Kind = 'drum' | 'guitar' | 'bass' | 'keys' | 'vocal';
interface Spec { kind: Kind; x: number; y: number; z: number; yaw: number; look: PainterLook }

const RISER = 0.45; // sàn bục trống
const KEYS_RISER = 0.3;
const POD = 0.3; // bục thùng của bè phụ
const KEYS = { x: 6.5, z: 1.36, top: KEYS_RISER + 0.72 };
const SNARE = new V3(-6.84, RISER + 0.52, 0.85);
const HIHAT = new V3(-6.0, RISER + 0.82, 0.85);

function specs(): Spec[] {
  const r = R;
  return [
    { kind: 'drum', x: -6.5, y: RISER, z: 1.32, yaw: 0.05, look: { skin: SKIN_TONES[1]!, hair: r.dat!['500'], hairStyle: 'short', hat: { kind: 'bandana', col: r.son!['500'] }, smock: r.crom!['300'], pants: r.pho!['700'], boots: r.dat!['700'], splat: [r.son!['500'], r.pho!['300'], r.bach!['300']], headphones: false } },
    { kind: 'guitar', x: -9.9, y: 0, z: 1.15, yaw: -0.32, look: { skin: SKIN_TONES[2]!, hair: r.dat!['700'], hairStyle: 'afro', smock: r.may!['100'], pants: r.dat!['500'], boots: r.dat!['700'], scarf: r.bach!['300'], splat: [r.crom!['500'], r.son!['300'], r.pho!['300'], r.tim!['300']] } },
    { kind: 'bass', x: 9.9, y: 0, z: 1.15, yaw: 0.32, look: { skin: SKIN_TONES[2]!, hair: r.pho!['700'], hairStyle: 'pony', smock: r.bach!['500'], pants: r.pho!['700'], boots: r.pho!['700'], glasses: 'shades', splat: [r.crom!['300'], r.may!['100'], r.son!['300']] } },
    { kind: 'keys', x: 6.5, y: KEYS_RISER, z: 1.74, yaw: -0.08, look: { skin: SKIN_TONES[0]!, hair: r.crom!['700'], hairStyle: 'bun', smock: r.tim!['300'], pants: r.tim!['700'], boots: r.dat!['700'], glasses: 'round', splat: [r.crom!['300'], r.may!['100']] } },
    { kind: 'vocal', x: -2.8, y: POD, z: -0.82, yaw: 0.1, look: { skin: SKIN_TONES[2]!, hair: r.dat!['700'], hairStyle: 'pony', hat: { kind: 'beret', col: r.pho!['300'] }, smock: r.son!['300'], pants: r.dat!['700'], boots: r.dat!['700'], skirt: true, splat: [r.crom!['300'], r.may!['100']] } },
    { kind: 'vocal', x: 2.8, y: POD, z: -0.82, yaw: -0.1, look: { skin: SKIN_TONES[0]!, hair: r.dat!['500'], hairStyle: 'short', hat: { kind: 'beret', col: r.bach!['300'] }, smock: r.pho!['300'], pants: r.dat!['700'], boots: r.dat!['700'], skirt: true, splat: [r.crom!['300'], r.son!['300']] } },
  ];
}

interface Mus { s: Spec; c: PixChar; seed: number }

/** Bảng pha màu làm đàn: thân gắn xương ngực (khung ngực), cần chếch lên về bên trái. Trả [tâm thân, hướng cần]. */
function palette(batch: PixelBatch, c: PixChar, bass: boolean) {
  const r = R;
  const G = new V3(0.02, -0.02, -0.17);
  const a = bass ? 0.4 : 0.6;
  const n = new V3(-Math.cos(a), Math.sin(a), 0);
  const L = bass ? 0.62 : 0.46;
  const wood = bass ? r.dat!['300'] : r.dat!['100'];
  batch.box(c, 'chest', [G.x, G.y, G.z], [0.36, 0.3, 0.05], wood, { rot: [0, 0, 0.2] });
  batch.box(c, 'chest', [G.x - 0.15, G.y - 0.1, G.z], [0.12, 0.12, 0.05], wood, { rot: [0, 0, 0.5] });
  // chấm sơn (không viền) + lỗ ngón cái
  const dots = [r.son!['500'], r.crom!['500'], r.pho!['300'], r.bach!['300'], r.tim!['300']];
  dots.forEach((d, i) => batch.box(c, 'chest', [G.x + 0.05 + (i % 3) * 0.055 - 0.07, G.y + 0.08 - Math.floor(i / 3) * 0.07 - (i % 2) * 0.02, G.z - 0.028], [0.05, 0.05, 0.012], d, { hull: false }));
  batch.box(c, 'chest', [G.x - 0.1, G.y - 0.03, G.z - 0.028], [0.05, 0.05, 0.012], INK, { hull: false });
  const mid = G.clone().addScaledVector(n, 0.2 + L / 2).setZ(G.z - 0.02);
  batch.box(c, 'chest', [mid.x, mid.y, mid.z], [L + 0.1, 0.055, 0.04], r.dat!['500'], { rot: [0, 0, Math.PI - a] });
  const end = G.clone().addScaledVector(n, 0.2 + L + 0.08).setZ(G.z - 0.02);
  batch.box(c, 'chest', [end.x, end.y, end.z], [0.12, 0.07, 0.06], bass ? r.bach!['300'] : r.son!['500'], { rot: [0, 0, Math.PI - a] });
  return { G, n, L };
}

/** Cọ gắn lên bàn tay (trục +Y): cán 0,3, lông ở đầu trên. */
function brushOn(batch: PixelBatch, c: PixChar, hd: string, col: number, tip: number) {
  batch.box(c, hd, [0, 0, 0], [0.045, 0.24, 0.045], R.dat!['300']);
  batch.box(c, hd, [0, 0.145, 0], [0.058, 0.05, 0.058], R.may!['500']);
  batch.box(c, hd, [0, 0.205, 0], [0.085, 0.09, 0.085], col);
  batch.box(c, hd, [0, 0.262, 0], [0.07, 0.04, 0.07], tip);
}

function stickOn(batch: PixelBatch, c: PixChar, hd: string) {
  batch.box(c, hd, [0, 0.07, 0], [0.04, 0.36, 0.04], R.dat!['300']);
  batch.box(c, hd, [0, 0.26, 0], [0.055, 0.06, 0.055], R.crom!['500']);
}

export function createPixelBand(scene: THREE.Scene): Band {
  const batch = new PixelBatch();
  const r = R;
  const mus: Mus[] = specs().map((s, i) => ({ s, c: buildPainter(batch, s.look), seed: i * 1.7 }));
  const [dr, gt, bs, kb, v0, v1] = mus as [Mus, Mus, Mus, Mus, Mus, Mus];
  const gtr = palette(batch, gt.c, false), bsr = palette(batch, bs.c, true);
  stickOn(batch, dr.c, 'hdL'); stickOn(batch, dr.c, 'hdR');
  const mic = [v0, v1].map((m) => { brushOn(batch, m.c, 'hdL', r.crom!['500'], r.son!['500']); return m; });
  void mic;

  // ── đạo cụ tĩnh (một xương gốc, toạ độ thế giới) ──
  const st = batch.addSkeleton([{ n: 'root', p: null, x: 0, y: 0, z: 0 }]);
  const S = (c: [number, number, number], s: [number, number, number], col: number, o?: { rot?: [number, number, number]; hull?: boolean }) => batch.box(st, 'root', c, s, col, o);
  const C = (c: [number, number, number], rad: number, h: number, col: number, seg = 8, o?: { rot?: [number, number, number]; hull?: boolean }) => batch.cyl(st, 'root', c, rad, h, col, seg, o);
  /** Thùng sơn: thân thép + vành + nắp sơn màu + vệt chảy. */
  const bucket = (x: number, y: number, z: number, rad: number, h: number, paint: number, drips = true) => {
    C([x, y + h / 2, z], rad, h, r.may!['500']);
    C([x, y + h, z], rad * 1.04, 0.025, r.may!['300'], 8, { hull: false });
    C([x, y + h + 0.012, z], rad * 0.88, 0.016, paint, 8, { hull: false });
    if (drips) S([x - rad * 0.55, y + h - 0.07, z - rad * 0.86], [0.03, 0.14, 0.015], paint, { hull: false });
  };
  // bục trống + bộ trống thùng sơn
  S([-6.5, RISER / 2, 1.5], [3.4, RISER, 2.7], r.dat!['500']);
  S([-6.5, RISER + 0.005, 1.5], [3.3, 0.02, 2.6], r.dat!['300'], { hull: false });
  bucket(-6.5, RISER, 0.78, 0.27, 0.4, r.son!['500']); // bass: thùng lớn
  bucket(-6.84, RISER, 0.85, 0.19, 0.52 - 0.0, r.pho!['300'], false); // snare (đứng trên thùng cao)
  for (const dx of [-0.3, 0.3]) bucket(-6.5 + dx, RISER + 0.5, 0.55, 0.14, 0.14, dx < 0 ? r.bach!['300'] : r.crom!['500'], false);
  bucket(-5.6, RISER, 0.9, 0.2, 0.42, r.tim!['300']); // floor tom
  C([-6.0, RISER + 0.4, 0.85], 0.02, 0.8, r.may!['300'], 6);
  C([HIHAT.x, HIHAT.y + 0.04, HIHAT.z], 0.17, 0.025, r.crom!['500'], 8);
  for (const [x, y, z] of [[-7.7, 1.55, 0.5], [-5.3, 1.45, 0.55]] as [number, number, number][]) {
    C([x, RISER + (y - RISER) / 2, z], 0.02, y - RISER, r.may!['300'], 6);
    C([x, y, z], 0.3, 0.025, r.crom!['500'], 8, { rot: [0.15, 0, 0.1] });
  }
  C([-6.5, RISER + 0.1, 1.5 - 0.02], 0.2, 0.2, r.son!['700'], 8); // ghế = thùng úp (vành lên trên)
  C([-6.5, RISER + 0.205, 1.5 - 0.02], 0.2, 0.016, r.may!['300'], 8, { hull: false });
  // bục + giá vẽ của keyboard
  C([KEYS.x, KEYS_RISER / 2, 1.74], 0.55, KEYS_RISER, r.dat!['500'], 12);
  C([KEYS.x, KEYS_RISER + 0.004, 1.74], 0.5, 0.012, r.dat!['300'], 12, { hull: false });
  const kz = KEYS.z;
  for (const sx of [-1, 1]) {
    S([KEYS.x + sx * 0.44, KEYS_RISER + 0.38, kz + 0.04], [0.045, 0.78, 0.045], r.dat!['500'], { rot: [-0.08, 0, 0] });
    S([KEYS.x + sx * 0.5, KEYS_RISER + 0.36, kz + 0.28], [0.045, 0.74, 0.045], r.dat!['500'], { rot: [0.22, 0, sx * 0.1] });
  }
  S([KEYS.x, KEYS.top - 0.045, kz], [1.0, 0.05, 0.34], r.dat!['300']); // mặt giá
  S([KEYS.x, KEYS.top - 0.005, kz], [0.96, 0.05, 0.3], INK); // thân đàn
  S([KEYS.x, KEYS.top + 0.025, kz - 0.03], [0.9, 0.012, 0.2], r.crom!['100'], { hull: false });
  for (let k = 0; k < 8; k++) S([KEYS.x - 0.36 + k * 0.1, KEYS.top + 0.034, kz - 0.06], [0.04, 0.012, 0.11], INK, { hull: false });
  // toan căng khung trên giá (phía sau đàn): bầu trời xoáy mini
  S([KEYS.x, KEYS.top + 0.62, kz + 0.2], [0.8, 0.62, 0.04], r.dat!['300'], { rot: [-0.12, 0, 0] });
  S([KEYS.x, KEYS.top + 0.62, kz + 0.17], [0.7, 0.52, 0.02], r.pho!['500'], { rot: [-0.12, 0, 0], hull: false });
  S([KEYS.x - 0.12, KEYS.top + 0.7, kz + 0.155], [0.22, 0.05, 0.015], r.pho!['100'], { rot: [-0.12, 0, 0.2], hull: false });
  S([KEYS.x + 0.1, KEYS.top + 0.56, kz + 0.155], [0.26, 0.05, 0.015], r.pho!['300'], { rot: [-0.12, 0, -0.2], hull: false });
  C([KEYS.x + 0.2, KEYS.top + 0.72, kz + 0.15], 0.07, 0.012, r.crom!['500'], 8, { rot: [Math.PI / 2 - 0.12, 0, 0], hull: false });
  // bục thùng + chân mic-cọ của hai bè phụ
  for (const m of [v0, v1]) {
    const x = m.s.x, z = m.s.z;
    C([x, POD / 2, z], 0.46, POD, r.may!['500'], 12);
    C([x, POD + 0.008, z], 0.42, 0.016, m === v0 ? r.son!['500'] : r.crom!['500'], 12, { hull: false });
    C([x, POD + 0.5, z - 0.4], 0.016, 1.0, r.may!['300'], 6);
    C([x, POD + 0.012, z - 0.4], 0.1, 0.02, r.may!['500'], 6);
    S([x, POD + 1.0, z - 0.4], [0.07, 0.05, 0.07], INK); // kẹp cọ trống (cọ đang ở tay)
  }
  batch.build(scene, 'band-pixel');

  for (const m of mus) { m.c.b.root!.position.set(m.s.x, m.s.y, m.s.z); m.c.b.root!.rotation.y = m.s.yaw; }
  const tick = new Tick12();
  const pole = new V3(), tgt = new V3(), a = new V3(), d = new V3(), d2 = new V3();
  const world = new V3();
  /** Đưa tay `side` tới điểm thế giới. */
  const hand = (m: Mus, side: -1 | 1, w: THREE.Vector3, polev: THREE.Vector3) => { worldToChest(m.c, world.copy(w), tgt); reach(m.c, side, tgt, polev); };

  const common = (m: Mus, b: number, hype: number, pulse: number, yawOff = 0) => {
    const c = m.c;
    resetPose(c);
    c.b.root!.position.set(m.s.x, m.s.y, m.s.z);
    c.b.root!.rotation.y = m.s.yaw + yawOff;
    const groove = 0.4 + 0.6 * hype;
    c.b.chest!.rotation.set(pulse > 0.55 ? -0.04 * groove : 0, 0, -Math.round(Math.sin(Math.PI * (b + m.seed)) * 3) / 3 * 0.06 * groove);
    c.b.head!.rotation.set(pulse > 0.55 ? 0.1 : 0, Math.round(Math.sin((b + m.seed) * 0.5) * 2) / 2 * 0.2, 0);
    const mouthOpen = hype > 0.5 && Math.floor(b + m.seed) % 2 === 0 ? 2.2 : 1;
    c.b.mouth!.scale.set(1, mouthOpen, 1);
    return groove;
  };

  function animDrummer(b: number, hype: number, pulse: number) {
    const m = dr, c = m.c;
    common(m, b, hype, pulse);
    leg(c, -1, 1.4, -1.4, 0.1); leg(c, 1, 1.4 - (pulse > 0.55 ? 0.18 : 0), -1.4, 0.1);
    c.b.hips!.position.y = hipHeight(1.4, -1.4) + (pulse > 0.55 ? -0.02 : 0);
    c.b.chest!.rotation.x = 0.1;
    c.b.root!.updateMatrixWorld(true);
    const lift8 = 0.5 - 0.5 * Math.cos(TAU * fract(b * 2));
    const u = (fract(b / 2) * 2 + 1) % 2;
    const liftS = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const barPh = b % 4;
    const crash = smooth(0.6, 0.75, hype) * Math.max(clamp((barPh - 3.3) / 0.7, 0, 1), clamp(1 - barPh * 1.6, 0, 1));
    const stick = (side: -1 | 1, tip: THREE.Vector3, lift: number, cr: number) => {
      a.copy(tip); a.y += 0.02 + Math.round(lift * 3) / 3 * 0.26 + cr * 0.5; a.x += side > 0 ? cr * 0.2 : 0;
      d.set(side > 0 ? 0.1 : -0.1, -0.35 - lift * 0.5 + cr * 0.6, -0.9).normalize(); // hướng tay → chóp dùi
      d2.copy(a).addScaledVector(d, -0.25); // tay lùi theo dùi
      hand(m, side, d2, pole.set(side, -0.8, 0.4));
      aimHold(c, side, dirToChest(c, d, tgt));
    };
    stick(-1, SNARE, Math.pow(liftS, 1.3), 0);
    stick(1, HIHAT, Math.pow(lift8, 1.3) * (1 - crash), crash);
  }

  function animGuitar(m: Mus, b: number, hype: number, pulse: number, bass: boolean) {
    const c = m.c, g = bass ? bsr : gtr;
    const groove = common(m, b, hype, pulse, Math.round(Math.sin(Math.PI * b * 0.25) * 2) / 2 * 0.12 * (0.4 + 0.6 * hype));
    const bar = Math.floor(b / 4), barPh = fract(b / 4);
    let lift = 0;
    if (hype > 0.8 && bar % 2 === (bass ? 1 : 0) && barPh > 0.75) lift = Math.round(Math.sin((barPh - 0.75) * 4 * Math.PI) * 0.2 / 0.05) * 0.05;
    c.b.root!.position.y = m.s.y + lift;
    const stp = Math.sin(Math.PI * b) * 0.3 * groove;
    leg(c, -1, Math.max(0, stp), -Math.max(0, stp) * 0.6, 0.08); leg(c, 1, Math.max(0, -stp), -Math.max(0, -stp) * 0.6, 0.08);
    if (lift > 0.02) { leg(c, -1, 0.4, -0.8); leg(c, 1, -0.15, -0.3); }
    const lean = hype > 0.8 && bar % 2 === (bass ? 0 : 1) ? Math.sin(Math.PI * barPh) * 0.3 : 0;
    c.b.chest!.rotation.x -= lean * 0.6;
    const t = 0.35 + 0.3 * Math.sin(b * Math.PI * 0.5 + (bass ? 1 : 0)) * (0.5 + 0.5 * hype);
    a.copy(g.G).addScaledVector(g.n, 0.22 + 0.22 * t * (g.L / 0.46)).setZ(g.G.z - 0.06);
    reach(c, -1, a, pole.set(-1, -0.8, 0.2));
    const rate = bass ? (hype > 0.6 ? 2 : 1) : hype > 0.6 ? 4 : 2;
    a.set(g.G.x + 0.06, g.G.y + 0.02 + (bass ? 0.04 : 0.08) * Math.round(Math.sin(TAU * b * rate) * 2) / 2, g.G.z - 0.1);
    reach(c, 1, a, pole.set(1, -0.7, 0.3));
  }

  function animKeys(b: number, hype: number, pulse: number) {
    const m = kb, c = m.c;
    common(m, b, hype, pulse);
    c.b.head!.rotation.x += 0.15;
    const rate = hype > 0.6 ? 4 : 2;
    const pl = 0.5 - 0.5 * Math.cos(TAU * b * rate), pr = 0.5 - 0.5 * Math.cos(TAU * (b * rate + 0.5));
    const sw = Math.round(Math.sin(b * Math.PI * 0.5) * 2) / 2 * 0.2 * (0.4 + hype);
    leg(c, -1, Math.max(0, Math.sin(Math.PI * b)) * 0.15, 0, 0.05); leg(c, 1, Math.max(0, -Math.sin(Math.PI * b)) * 0.15, 0, 0.05);
    c.b.root!.updateMatrixWorld(true);
    hand(m, -1, a.set(KEYS.x - 0.26 + sw, KEYS.top + 0.06 + 0.07 * (1 - Math.round(pl)), KEYS.z), pole.set(-1, -0.8, 0.3));
    const bar = b % 4, fl = hype > 0.35 ? Math.sin(Math.PI * clamp((bar - 3) / 1, 0, 1)) : 0;
    if (fl > 0.02) { tgt.set(0.3, 0.34 + 0.4 * fl, -0.1); reach(c, 1, tgt, pole.set(1, -0.3, 0.2)); }
    else hand(m, 1, a.set(KEYS.x + 0.26 + sw, KEYS.top + 0.06 + 0.07 * (1 - Math.round(pr)), KEYS.z), pole.set(1, -0.8, 0.3));
  }

  function animVocal(m: Mus, b: number, hype: number, pulse: number) {
    const c = m.c, mir = m.s.x < 0 ? 1 : -1;
    const amp = 0.25 + 0.75 * hype;
    const cs = Math.cos(Math.PI * b);
    common(m, b, hype, pulse);
    c.b.root!.position.x = m.s.x + Math.round(Math.sin(Math.PI * b) * 3) / 3 * 0.12 * amp * mir;
    c.b.chest!.rotation.z = -Math.round(Math.sin(Math.PI * b) * 2) / 2 * 0.08 * amp;
    leg(c, -1, 0.1 * Math.max(0, cs) * amp, 0, 0.3 * Math.max(0, cs) * amp); leg(c, 1, 0.1 * Math.max(0, -cs) * amp, 0, 0.3 * Math.max(0, -cs) * amp);
    c.b.root!.updateMatrixWorld(true);
    const bar = Math.floor(b / 4) % 2;
    const l0 = Math.round((0.5 - 0.5 * Math.cos(Math.PI * b)) * 2) / 2;
    const hold = 1 - smooth(0.35, 0.6, hype);
    // tay trái: cọ-micro luôn tới miệng khi Hype thấp; sau đó bơm đối xứng
    const pump = bar === 0 ? l0 : pulse > 0.55 ? 1 : 0;
    if (hold > 0.5) {
      d.set(0.22, 0.8, -0.52).normalize();
      a.set(0, 0.47, -0.28).addScaledVector(d, -0.28);
      reach(c, -1, a, pole.set(-1, -0.7, 0.2));
      aimHold(c, -1, d);
    } else {
      tgt.set(-0.3 - 0.1 * pump, 0.3 + 0.55 * pump, -0.1);
      reach(c, -1, tgt, pole.set(-1, -0.3, 0.2));
    }
    // tay phải: nắm chân mic khi Hype thấp, sau đó giơ
    if (hold > 0.5) hand(m, 1, a.set(m.s.x + 0.04, POD + 0.92, m.s.z - 0.38), pole.set(1, -0.7, 0.3));
    else { tgt.set(0.3 + 0.1 * (1 - pump), 0.3 + 0.55 * (bar === 0 ? 1 - l0 : pulse > 0.55 ? 1 : 0), -0.1); reach(c, 1, tgt, pole.set(1, -0.3, 0.2)); }
    void hype;
  }

  return {
    update(f: FrameState) {
      if (!tick.step(Math.max(0, Math.min(f.dt, 0.1)))) return;
      const hype = clamp(f.hype, 0, 1);
      const b = Math.max(0, f.beat);
      const pulse = f.beatPulse;
      animDrummer(b, hype, pulse);
      animGuitar(gt, b, hype, pulse, false);
      animGuitar(bs, b, hype, pulse, true);
      animKeys(b, hype, pulse);
      animVocal(v0, b, hype, pulse);
      animVocal(v1, b, hype, pulse);
    },
    dispose() { batch.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { band: (ctx) => createPixelBand(ctx.scene) };
