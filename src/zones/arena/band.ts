// Ban nhạc sống trên sân khấu chính: tay trống, guitar, bass, keyboard, 2 vocal phụ — chibi 2,3 đầu (chibiRig).
// Cả 6 nhạc công + nhạc cụ do module này vẽ (guitar, bass, dùi, ghế, bục) gộp vào MỘT ChibiBatch:
// 3 draw call (thân toy-shader, mặt atlas, viền ink) + 1 mesh vòng sáng cộng màu = 4. Đạo cụ cố định (bộ trống,
// keyboard, mic stand, amp) thuộc stageDeco; tay nhạc công với tới đúng vị trí các đạo cụ đó. Mọi người nhìn về -Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { HAIR, PAL, SKIN } from '../../world/style';
import {
  ChibiBatch, RIG, aimArm, aimArmWorld, armDir, beatSquash, capsule, exprByHype, heartGeo, jumpCurve, lag, lathe, sphere, starGeo, torus, xf,
  type ChibiChar, type ChibiLook,
} from './chibiRig';

export interface Band { update(f: FrameState): void; dispose(): void; }

const SCALE = 1.05; // ≈ 1,68 m
const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const fract = (x: number) => x - Math.floor(x);
const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

type Kind = 'drum' | 'guitar' | 'bass' | 'keys' | 'vocal';
interface Spec { kind: Kind; x: number; y: number; z: number; yaw: number; look: ChibiLook; poolR: number; poolCol: number; mirror?: number }

// Đạo cụ stageDeco (toạ độ thế giới)
const SNARE = new V3(-6.84, 1.08, 0.85);
const HIHAT = new V3(-6.0, 1.15, 0.85);
const KEYS = { x: 6.5, y: 1.27, z: 1.36 };
const MIC = (x: number) => new V3(x, 1.6, -1.42);
const STOOL_H = 0.34; // ghế trống (m, trên riser)
const STEP_H = 0.24; // bục kê chân keyboard
const POD_H = 0.55; // bục tròn vocal (miệng ngang mic stand)
const SEAT = 0.34; // đáy thân chibi (khung gốc) ngồi lên mặt ghế

const SPECS: Spec[] = [
  { kind: 'drum', x: -6.5, y: 0.45, z: 1.32, yaw: 0.05, poolR: 3.4, poolCol: PAL.honey[500],
    look: { skin: SKIN[2]!, hair: HAIR[0]!, hairStyle: 'spiky', top: PAL.grape[500], bottom: PAL.night[100], shoe: PAL.cream[500], trim: PAL.honey[300],
      accessory: 'headphones', accColor: PAL.berry[500], heldL: 'stick', heldR: 'stick', itemColor: PAL.honey[500] } },
  { kind: 'guitar', x: -9.9, y: 0, z: 1.15, yaw: -0.32, mirror: -1, poolR: 3.0, poolCol: PAL.peach[500],
    look: { skin: SKIN[1]!, hair: HAIR[2]!, hairStyle: 'short', top: PAL.honey[500], bottom: PAL.grape[700], shoe: PAL.cream[500], trim: PAL.soda[300],
      accessory: 'cap', accColor: PAL.soda[500], motif: 'star', motifColor: PAL.berry[500] } },
  { kind: 'bass', x: 9.9, y: 0, z: 1.15, yaw: 0.32, mirror: -1, poolR: 3.0, poolCol: PAL.mint[500],
    look: { skin: SKIN[3]!, hair: HAIR[7]!, hairStyle: 'pony', top: PAL.soda[700], bottom: PAL.night[100], shoe: PAL.cream[500], trim: PAL.mint[300] } },
  { kind: 'keys', x: 6.5, y: 0.3, z: 1.8, yaw: -0.08, poolR: 3.2, poolCol: PAL.grape[300],
    look: { skin: SKIN[0]!, hair: HAIR[1]!, hairStyle: 'buns', top: PAL.peach[500], bottom: PAL.grape[700], shoe: PAL.cream[500], trim: PAL.cream[300],
      accessory: 'glasses', motif: 'heart', motifColor: PAL.berry[500] } },
  { kind: 'vocal', x: -2.8, y: 0, z: -0.82, yaw: 0.1, mirror: 1, poolR: 2.4, poolCol: PAL.berry[300],
    look: { skin: SKIN[3]!, hair: HAIR[0]!, hairStyle: 'pony', top: PAL.berry[300], bottom: PAL.berry[300], shoe: PAL.cream[500], trim: PAL.cream[300],
      skirt: true, accessory: 'bow', accColor: PAL.soda[500], motif: 'heart', motifColor: PAL.berry[500] } },
  { kind: 'vocal', x: 2.8, y: 0, z: -0.82, yaw: -0.1, mirror: -1, poolR: 2.4, poolCol: PAL.soda[300],
    look: { skin: SKIN[0]!, hair: HAIR[3]!, hairStyle: 'bob', top: PAL.berry[300], bottom: PAL.berry[300], shoe: PAL.cream[500], trim: PAL.cream[300],
      skirt: true, accessory: 'bow', accColor: PAL.soda[500], motif: 'heart', motifColor: PAL.berry[500] } },
];

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.4)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0.1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Capsule nối 2 điểm (khung gốc nhân vật). */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8): THREE.BufferGeometry {
  const d = new V3().subVectors(b, a);
  const len = d.length();
  const g = capsule(r, Math.max(0.001, len - 2 * r), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

interface Gtr { G: THREE.Vector3; n: THREE.Vector3; L: number }
interface Mus { spec: Spec; c: ChibiChar; seed: number; gtr?: Gtr; lift: number; jumpY: number; roll: number }

export function createBand(scene: THREE.Scene): Band {
  const batch = new ChibiBatch({ maxChars: 6, name: 'band' });
  const mus: Mus[] = SPECS.map((spec, i) => {
    const c = batch.addChar(spec.look, spec.x, spec.y, spec.z);
    const m: Mus = { spec, c, seed: i * 1.7, lift: 0, jumpY: 0, roll: 0 };
    const P = (g: THREE.BufferGeometry, col: number, emit = 0) => batch.part(c, c.root, g, col, emit);
    const PU = (g: THREE.BufferGeometry, col: number, emit = 0) => batch.part(c, c.upper, g, col, emit);
    const sv = 1 / SCALE; // khối gắn root bị scale cùng nhân vật → chia lại để đúng kích thước đạo cụ thế giới
    if (spec.kind === 'drum') { // ghế tròn mập
      P(xf(lathe([[0, 0], [0.09, 0], [0.07, 0.04], [0.06, STOOL_H - 0.08], [0.2, STOOL_H - 0.05], [0.22, STOOL_H - 0.01], [0, STOOL_H + 0.02]], 16), 0, SEAT - STOOL_H * sv, 0.02, sv), PAL.night[300]);
      P(xf(torus(0.2, 0.025, TAU, 6, 20), 0, SEAT - 0.04 * sv, 0.02, sv, sv, sv, Math.PI / 2), PAL.honey[500], 1);
    }
    if (spec.kind === 'keys') { // bục kê chân
      P(xf(new THREE.CylinderGeometry(0.34, 0.36, STEP_H, 20), 0, -STEP_H / 2 * sv, 0, sv), PAL.peach[300]);
      P(xf(torus(0.35, 0.03, TAU, 6, 24), 0, -0.02 * sv, 0, sv, sv, sv, Math.PI / 2), PAL.cream[300], 1);
    }
    if (spec.kind === 'vocal') { // bục tròn kiểu bánh kem
      P(xf(new THREE.CylinderGeometry(0.46, 0.5, POD_H, 24), 0, -POD_H / 2 * sv, 0, sv), PAL.grape[300]);
      P(xf(torus(0.47, 0.04, TAU, 6, 28), 0, -0.03 * sv, 0, sv, sv, sv, Math.PI / 2), PAL.honey[500], 1);
    }
    if (spec.kind === 'guitar' || spec.kind === 'bass') {
      const bass = spec.kind === 'bass';
      const a = bass ? 0.32 : 0.45;
      const n = new V3(-Math.cos(a), Math.sin(a), 0);
      const G = new V3(0.06, 0.5, -0.3);
      const L = bass ? 0.6 : 0.46;
      const col = bass ? PAL.mint[500] : PAL.soda[500];
      PU(xf(sphere(1, 22, 14), G.x, G.y, G.z, 0.21, 0.18, 0.07, 0, 0, a * 0.5), col);
      PU(xf(sphere(1, 18, 12), G.x + n.x * 0.15, G.y + n.y * 0.15, G.z, 0.15, 0.13, 0.065, 0, 0, a * 0.5), col);
      const hole = new V3().copy(G).addScaledVector(n, 0.03);
      PU(xf(bass ? heartGeo(0.06, 0.02) : starGeo(0.065, 0.02), hole.x, hole.y - 0.01, G.z - 0.07, 1, 1, 1, 0, Math.PI, 0), bass ? PAL.berry[500] : PAL.honey[500], 0.6);
      const n0 = new V3().copy(G).addScaledVector(n, 0.2), n1 = new V3().copy(G).addScaledVector(n, 0.2 + L);
      PU(rod(n0.setZ(G.z - 0.03), n1.setZ(G.z - 0.03), 0.032), PAL.honey[700]);
      PU(xf(sphere(1, 12, 8), n1.x + n.x * 0.04, n1.y + n.y * 0.04, G.z - 0.03, 0.075, 0.055, 0.045, 0, 0, a), col);
      PU(rod(new V3(G.x + 0.12, G.y + 0.05, G.z + 0.02), new V3(RIG.shX - 0.05, RIG.shY + 0.03, -0.05), 0.022), PAL.night[300]); // dây đeo
      m.gtr = { G, n, L };
    }
    return m;
  });
  batch.build(scene);
  for (const m of mus) { m.c.root.scale.setScalar(SCALE); m.c.root.rotation.y = m.spec.yaw; }
  const dr = mus[0]!, gt = mus[1]!, bs = mus[2]!, kb = mus[3]!, v0 = mus[4]!, v1 = mus[5]!;

  // vòng sáng dưới chân
  const poolTex = radialTexture();
  const tc = new THREE.Color();
  const poolParts: THREE.BufferGeometry[] = [];
  for (const m of mus) {
    const s = m.spec;
    const g = new THREE.PlaneGeometry(s.poolR, s.poolR);
    g.rotateX(-Math.PI / 2);
    g.translate(s.x, s.y + 0.06, s.z + (s.kind === 'drum' ? -0.3 : 0));
    tc.setHex(s.poolCol);
    const arr = new Float32Array(4 * 3);
    for (let i = 0; i < 4; i++) { arr[i * 3] = tc.r; arr[i * 3 + 1] = tc.g; arr[i * 3 + 2] = tc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('normal');
    poolParts.push(g);
  }
  const poolGeo = mergeGeometries(poolParts, false)!;
  poolParts.forEach((g) => g.dispose());
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
  });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.renderOrder = 2;
  pool.frustumCulled = false;
  pool.name = 'bandPools';
  scene.add(pool);

  // ───────── hoạt ảnh ─────────
  const _a = new V3(), _b = new V3(), _dir = new V3();
  const jmp = { y: 0, sx: 1, sy: 1 };
  let dtLast = 1 / 60;

  const base = (m: Mus, b: number, amt: number, lift = 0, yawOff = 0) => {
    const [sx, sy] = beatSquash(b + m.seed * 0.05, amt);
    m.c.root.position.set(m.spec.x, m.spec.y + lift, m.spec.z);
    m.c.root.rotation.y = m.spec.yaw + yawOff;
    m.c.body.scale.set(sx, sy, sx);
  };
  const headBob = (m: Mus, b: number, hype: number, pulse: number, yaw: number) => {
    m.roll = lag(m.roll, -m.c.body.rotation.z * 1.5, dtLast);
    m.c.head.rotation.set(0.06 - pulse * 0.14 * (0.4 + hype), yaw, clamp(m.roll, -0.14, 0.14));
  };

  function animDrummer(b: number, hype: number, pulse: number) {
    const m = dr, c = m.c;
    base(m, b, 0.5 + 0.5 * hype, STOOL_H - SEAT * SCALE);
    c.body.position.y = -pulse * 0.015;
    c.legL.rotation.set(1.35, 0, -0.12);
    c.legR.rotation.set(1.35 - 0.18 * pulse, 0, 0.12); // đạp trống bass mỗi phách
    c.body.rotation.z = 0.04 * Math.sin(Math.PI * b);
    c.upper.rotation.set(0.08 + pulse * 0.05, 0.08 * Math.sin(Math.PI * b), 0);
    headBob(m, b, hype, pulse, Math.sin(b * 0.7) * 0.2);
    const lift8 = 0.5 - 0.5 * Math.cos(TAU * fract(b * 2)); // hi-hat mỗi móc đơn
    const u = (fract(b / 2) * 2 + 1) % 2;
    const liftS = 0.5 - 0.5 * Math.cos(Math.PI * u); // snare phách 2, 4
    const barPh = b % 4;
    const crash = smooth(0.6, 0.75, hype) * Math.max(clamp((barPh - 3.3) / 0.7, 0, 1), clamp(1 - barPh * 1.6, 0, 1));
    // đầu dùi chạm mặt trống; tay lùi lại theo hướng dùi
    const stick = (side: 0 | 1, tip: THREE.Vector3, lift: number, cr: number) => {
      _a.copy(tip);
      _a.y += 0.03 + lift * 0.3 + cr * 0.6;
      _a.x += side ? cr * 0.25 : 0;
      _dir.set(side ? 0.1 : -0.1, -0.35 - lift * 0.5 + cr * 0.6, -0.9).normalize(); // hướng dùi (thế giới)
      _b.copy(_a).addScaledVector(_dir, -0.34 * SCALE);
      aimArmWorld(c, side, _b, _dir);
    };
    stick(0, SNARE, Math.pow(liftS, 1.3), 0);
    stick(1, HIHAT, Math.pow(lift8, 1.3) * (1 - crash), crash);
    batch.setFace(c, hype > 0.55 ? (Math.floor(b / 4) % 4 === 3 ? 'wink' : 'excited') : 'smile', dtLast);
  }

  function animGuitar(m: Mus, b: number, hype: number, pulse: number, bass: boolean) {
    const c = m.c, g = m.gtr!;
    const groove = 0.4 + 0.6 * hype;
    const bar = Math.floor(b / 4), barPh = fract(b / 4);
    let lift = 0;
    if (hype > 0.8 && bar % 2 === (bass ? 1 : 0) && barPh > 0.75) { // nhảy cuối ô nhịp
      jumpCurve((barPh - 0.75) * 4, 0.22, jmp);
      lift = jmp.y;
      base(m, b, 0, lift, Math.sin(Math.PI * b * 0.25) * 0.12 * groove);
      c.body.scale.set(jmp.sx, jmp.sy, jmp.sx);
    } else base(m, b, groove, 0, Math.sin(Math.PI * b * 0.25) * 0.12 * groove);
    const lean = hype > 0.8 && bar % 2 === (bass ? 0 : 1) ? Math.sin(Math.PI * barPh) * 0.3 : 0;
    c.body.rotation.z = Math.sin(Math.PI * b) * 0.06 * groove;
    c.upper.rotation.set(lean * -0.6 + pulse * 0.04, Math.sin(Math.PI * b * 0.5) * 0.12 * hype, 0);
    headBob(m, b, hype, pulse, 0.15 + Math.sin(b * 0.5) * 0.12);
    const st = Math.sin(Math.PI * b) * 0.25 * groove * (lift > 0 ? 0 : 1);
    c.legL.rotation.set(Math.max(0, st), 0, -0.06);
    c.legR.rotation.set(Math.max(0, -st), 0, 0.06);
    if (lift > 0.02) { c.legL.rotation.x = 0.4; c.legR.rotation.x = -0.2; }
    // tay bấm phím trượt dọc cần đàn; tay gảy quét theo nhịp
    const t = 0.35 + 0.3 * Math.sin(b * Math.PI * 0.5 + (bass ? 1 : 0)) * (0.5 + 0.5 * hype);
    _a.copy(g.G).addScaledVector(g.n, 0.2 + t * g.L).add(_b.set(0, -0.02, -0.07));
    _a.y -= RIG.waistY;
    aimArm(c, 0, _a);
    const rate = bass ? (hype > 0.6 ? 2 : 1) : hype > 0.6 ? 4 : 2;
    _a.set(g.G.x + 0.06, g.G.y - RIG.waistY + 0.02 + (bass ? 0.04 : 0.08) * Math.sin(TAU * b * rate), g.G.z - 0.1);
    aimArm(c, 1, _a);
    batch.setFace(c, exprByHype(hype, b, m.seed), dtLast);
  }

  function animKeys(b: number, hype: number, pulse: number) {
    const m = kb, c = m.c;
    const rate = hype > 0.6 ? 4 : 2;
    const pl = 0.5 - 0.5 * Math.cos(TAU * b * rate);
    const pr = 0.5 - 0.5 * Math.cos(TAU * (b * rate + 0.5));
    const groove = 0.4 + 0.6 * hype;
    base(m, b, groove, STEP_H);
    c.body.rotation.z = Math.sin(Math.PI * b) * 0.05 * groove;
    c.upper.rotation.set(0.12 + pulse * 0.04, Math.sin(Math.PI * b * 0.5) * 0.1, 0);
    headBob(m, b, hype, pulse, Math.sin(b * 0.5) * 0.18);
    c.head.rotation.x += 0.15; // nhìn xuống phím
    c.legL.rotation.x = Math.max(0, Math.sin(Math.PI * b)) * 0.15;
    c.legR.rotation.x = Math.max(0, -Math.sin(Math.PI * b)) * 0.15;
    const sw = Math.sin(b * Math.PI * 0.5) * 0.25 * (0.4 + hype);
    aimArmWorld(c, 0, _a.set(KEYS.x - 0.28 + sw, KEYS.y + 0.04 + 0.07 * (1 - pl), KEYS.z));
    aimArmWorld(c, 1, _a.set(KEYS.x + 0.28 + sw, KEYS.y + 0.04 + 0.07 * (1 - pr), KEYS.z));
    batch.setFace(c, exprByHype(hype, b, m.seed), dtLast);
  }

  function animVocal(m: Mus, b: number, hype: number, pulse: number) {
    const c = m.c, mir = m.spec.mirror!;
    const amp = 0.25 + 0.75 * hype;
    const cs = Math.cos(Math.PI * b);
    base(m, b, amp, POD_H);
    c.root.position.x = m.spec.x + Math.sin(Math.PI * b) * 0.14 * amp * mir; // hai-bước đồng bộ, đối xứng
    c.body.position.y = Math.abs(Math.sin(Math.PI * b)) * 0.04 * amp;
    c.body.rotation.z = Math.sin(Math.PI * b) * 0.08 * amp;
    c.upper.rotation.set(0, Math.sin(Math.PI * b) * 0.15 * amp, 0);
    headBob(m, b, hype, pulse, -mir * 0.1);
    c.legL.rotation.set(0.15 * Math.max(0, cs) * amp, 0, -0.3 * Math.max(0, cs) * amp);
    c.legR.rotation.set(0.15 * Math.max(0, -cs) * amp, 0, 0.3 * Math.max(0, -cs) * amp);
    const bar = Math.floor(b / 4) % 2;
    const l0 = 0.5 - 0.5 * Math.cos(Math.PI * b);
    const hold = 1 - smooth(0.35, 0.6, hype);
    // tay trái: vẫy / bơm theo phách
    const lf = bar === 0 ? l0 : pulse;
    armDir(c, 0, 0.5 + 0.3 * amp * lf, -1 + 2.2 * amp * lf, 0.3);
    // tay phải: giữ mic stand khi Hype thấp, sau đó bơm đối xứng
    if (hold > 0.5) aimArmWorld(c, 1, _a.copy(MIC(m.spec.x)).add(_b.set(0, -0.08, 0.05)));
    else armDir(c, 1, 0.5 + 0.3 * amp * (bar === 0 ? 1 - l0 : pulse), -1 + 2.2 * amp * (bar === 0 ? 1 - l0 : pulse), 0.3);
    batch.setFace(c, hype > 0.3 && Math.floor(b) % 2 === 0 ? 'sing' : exprByHype(hype, b, m.seed), dtLast, 0.5 + 0.5 * pulse);
  }

  return {
    update(f) {
      dtLast = Math.max(0, Math.min(f.dt, 0.1));
      const hype = clamp(f.hype, 0, 1);
      const b = Math.max(0, f.beat);
      const pulse = f.beatPulse;
      batch.setHype(hype, pulse);
      animDrummer(b, hype, pulse);
      animGuitar(gt, b, hype, pulse, false);
      animGuitar(bs, b, hype, pulse, true);
      animKeys(b, hype, pulse);
      animVocal(v0, b, hype, pulse);
      animVocal(v1, b, hype, pulse);
      poolMat.opacity = 0.42 + 0.22 * hype + 0.18 * pulse;
    },
    dispose() {
      batch.dispose();
      scene.remove(pool);
      poolTex.dispose(); poolMat.dispose(); poolGeo.dispose();
    },
  };
}
