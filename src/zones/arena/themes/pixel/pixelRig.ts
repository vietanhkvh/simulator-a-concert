// "Đêm Sao Điểm Ảnh" — rig sprite-3D dùng chung cho ca sĩ / ban nhạc / quay phim (gói P4).
// Nhân vật chibi 3,2 đầu dựng bằng KHỐI HỘP phẳng (không bo, không gradient): mỗi mặt một bước sáng tô sẵn vào màu đỉnh
// (đỉnh sáng · trước · trái · phải/sau tối — ramp dịch sắc: sáng về kem vàng, tối về tím chiều), vật liệu Basic không đèn.
// Viền mực: một lớp "vỏ ngược" skinned, đẩy mỗi đỉnh theo hướng góc hộp ra đúng 1 texel của đích 427×240 (tính theo độ sâu),
// nên viền luôn 1 px ở mọi cự ly. Mỗi PixelBatch = 2 draw call (thân + viền) cho mọi nhân vật + đạo cụ gắn xương.
// Hoạt hoạ do module gọi bước 12 fps (xem `tick12`). Giải IK 2 xương cho tay; chân dùng góc.
import * as THREE from 'three';
import { pixel } from '../../../../world/style/themes/pixel';

const V3 = THREE.Vector3;
type V3 = THREE.Vector3;
export const clamp = THREE.MathUtils.clamp;
export const INK = pixel.ink;
/** Ramp màu của phong cách (đọc thẳng từ theme để không phụ thuộc theme đang bật). */
export const R = pixel.ramps!;
export const SKIN_TONES = [R.dat!['100'], R.dat!['300'], R.dat!['500']];

/** Texel của đích thấp theo mét trên đơn vị độ sâu: 2·tan(fov/2) / 240 (fov 70°). */
const TEXEL_PER_DEPTH = (2 * Math.tan((70 * Math.PI) / 360)) / 240;

// ───────── màu từng mặt (bước cứng) ─────────
const CREAM = new THREE.Color(R.crom!['100']), DUSK = new THREE.Color(R.tim!['700']);
const LIGHT = new V3(-0.5, 0.8, -0.6).normalize();
const _c = new THREE.Color();
/** Màu mặt theo pháp tuyến: 4 bước (sáng / gốc / tối vừa / tối). */
export function faceColor(hex: number, n: THREE.Vector3, out: THREE.Color = _c): THREE.Color {
  const lum = n.dot(LIGHT);
  out.setHex(hex);
  if (lum > 0.65) out.lerp(CREAM, 0.22);
  else if (lum > 0.3) { /* gốc */ } else if (lum > -0.2) out.lerp(DUSK, 0.2);
  else out.lerp(DUSK, 0.38);
  return out;
}

/** Hệ số nhân màu theo pháp tuyến cho phần instanced (cameraCrew nhân với instanceColor). */
export function bakeFlat(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.computeVertexNormals(); // không chia sẻ đỉnh → pháp tuyến phẳng
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  const n = new V3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nor, i);
    const lum = n.dot(LIGHT);
    const f = lum > 0.65 ? [1, 1, 1] : lum > 0.3 ? [0.88, 0.86, 0.94] : lum > -0.2 ? [0.74, 0.72, 0.9] : [0.58, 0.55, 0.82];
    col[i * 3] = f[0]!; col[i * 3 + 1] = f[1]!; col[i * 3 + 2] = f[2]!;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

// ───────── bộ dựng xương + hộp ─────────
export interface BoneDef { n: string; p: string | null; x: number; y: number; z: number }
export interface PixChar {
  b: Record<string, THREE.Bone>;
  abs: Record<string, THREE.Vector3>;
  idx: Record<string, number>;
}
export interface PartOpts { rot?: [number, number, number]; hull?: boolean }

export class PixelBatch {
  private bones: THREE.Bone[] = [];
  private roots: THREE.Bone[] = [];
  private pos: number[] = []; private col: number[] = []; private skin: number[] = [];
  private hpos: number[] = []; private hdir: number[] = []; private hskin: number[] = [];
  mesh: THREE.SkinnedMesh | null = null;
  hull: THREE.SkinnedMesh | null = null;
  private skeleton: THREE.Skeleton | null = null;
  private mats: THREE.Material[] = [];
  private _e = new THREE.Euler(); private _q = new THREE.Quaternion(); private _m = new THREE.Matrix4();

  addSkeleton(defs: BoneDef[]): PixChar {
    const ch: PixChar = { b: {}, abs: {}, idx: {} };
    for (const d of defs) {
      const bone = new THREE.Bone();
      bone.name = d.n;
      bone.position.set(d.x, d.y, d.z);
      ch.b[d.n] = bone;
      ch.idx[d.n] = this.bones.length;
      ch.abs[d.n] = new V3(d.x, d.y, d.z).add(d.p ? ch.abs[d.p]! : new V3());
      if (d.p) ch.b[d.p]!.add(bone); else this.roots.push(bone);
      this.bones.push(bone);
    }
    return ch;
  }

  /** Hộp tâm `c` (khung xương), kích thước `s`. */
  box(ch: PixChar, bone: string, c: [number, number, number], s: [number, number, number], col: number, o: PartOpts = {}) {
    const bi = ch.idx[bone]!;
    const base = ch.abs[bone]!;
    this._e.set(...(o.rot ?? [0, 0, 0]), 'YXZ');
    this._q.setFromEuler(this._e);
    this._m.compose(new V3(base.x + c[0], base.y + c[1], base.z + c[2]), this._q, new V3(s[0], s[1], s[2]));
    const hull = o.hull !== false;
    const n = new V3(), p = new V3(), d = new V3();
    for (const [axis, sgn] of FACES) {
      n.set(0, 0, 0).setComponent(axis, sgn);
      const nn = n.clone().transformDirection(this._m);
      const fc = faceColor(col, nn);
      const u = (axis + 1) % 3, v = (axis + 2) % 3;
      const quad: V3[] = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const q = new V3(); q.setComponent(axis, sgn * 0.5); q.setComponent(u, a * 0.5); q.setComponent(v, b * 0.5);
        quad.push(q);
      }
      // đảo thứ tự nếu cần để mặt quay ra ngoài (kiểm bằng tích có hướng)
      const e1 = quad[1]!.clone().sub(quad[0]!), e2 = quad[2]!.clone().sub(quad[1]!);
      const flip = e1.cross(e2).dot(n) < 0;
      const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const k of order) {
        const lp = quad[k]!;
        p.copy(lp).applyMatrix4(this._m);
        this.pos.push(p.x, p.y, p.z); this.col.push(fc.r, fc.g, fc.b); this.skin.push(bi);
        if (hull) {
          // hướng góc trong không gian mô hình: quay (không scale) của hộp
          d.set(Math.sign(lp.x) || 1, Math.sign(lp.y) || 1, Math.sign(lp.z) || 1).applyQuaternion(this._q);
          this.hpos.push(p.x, p.y, p.z); this.hdir.push(d.x, d.y, d.z); this.hskin.push(bi);
        }
      }
    }
  }

  /** Lăng trụ đều `seg` cạnh (trục Y), bán kính r, cao h. */
  cyl(ch: PixChar, bone: string, c: [number, number, number], r: number, h: number, col: number, seg = 8, o: PartOpts = {}) {
    const bi = ch.idx[bone]!;
    const base = ch.abs[bone]!;
    this._e.set(...(o.rot ?? [0, 0, 0]), 'YXZ');
    this._q.setFromEuler(this._e);
    const hull = o.hull !== false;
    const ctr = new V3(base.x + c[0], base.y + c[1], base.z + c[2]);
    const P = (x: number, y: number, z: number) => new V3(x, y, z).applyQuaternion(this._q).add(ctr);
    const N = (x: number, y: number, z: number) => new V3(x, y, z).applyQuaternion(this._q);
    const tri = (a: V3, b: V3, cc: V3, da: V3, db: V3, dc: V3, nrm: V3) => {
      const fc = faceColor(col, nrm.normalize());
      for (const [pp, dd] of [[a, da], [b, db], [cc, dc]] as const) {
        this.pos.push(pp.x, pp.y, pp.z); this.col.push(fc.r, fc.g, fc.b); this.skin.push(bi);
        if (hull) { this.hpos.push(pp.x, pp.y, pp.z); this.hdir.push(dd.x, dd.y, dd.z); this.hskin.push(bi); }
      }
    };
    const hy = h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      // thành bên (2 tam giác)
      const nrm = N(Math.cos(am), 0, Math.sin(am));
      const p00 = P(c0 * r, -hy, s0 * r), p10 = P(c1 * r, -hy, s1 * r), p11 = P(c1 * r, hy, s1 * r), p01 = P(c0 * r, hy, s0 * r);
      const d00 = N(c0, -1, s0), d10 = N(c1, -1, s1), d11 = N(c1, 1, s1), d01 = N(c0, 1, s0);
      tri(p00, p11, p10, d00, d11, d10, nrm.clone()); tri(p00, p01, p11, d00, d01, d11, nrm.clone());
      // nắp trên + đáy
      tri(P(0, hy, 0), p11, p01, N(0, 1, 0), d11, d01, N(0, 1, 0));
      tri(P(0, -hy, 0), p00, p10, N(0, -1, 0), d00, d10, N(0, -1, 0));
    }
  }

  build(scene: THREE.Scene, name: string, hullMat?: THREE.Material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skin.flatMap((s) => [s, 0, 0, 0]), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skin.flatMap(() => [1, 0, 0, 0]), 4));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.name = name; mesh.frustumCulled = false;
    for (const r of this.roots) mesh.add(r);
    mesh.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.bones);
    mesh.bind(this.skeleton);

    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(this.hpos, 3));
    hg.setAttribute('normal', new THREE.Float32BufferAttribute(this.hdir, 3));
    hg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.hskin.flatMap((s) => [s, 0, 0, 0]), 4));
    hg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.hskin.flatMap(() => [1, 0, 0, 0]), 4));
    const hm = hullMat ?? inkHullMaterial();
    const hull = new THREE.SkinnedMesh(hg, hm);
    hull.name = name + '-ink'; hull.frustumCulled = false;
    hull.bind(this.skeleton, mesh.bindMatrix);
    hull.renderOrder = -1;
    scene.add(mesh); scene.add(hull);
    this.mesh = mesh; this.hull = hull; this.mats = [mat, hm];
    this.pos = this.col = this.skin = this.hpos = this.hdir = this.hskin = [];
  }

  setVisible(v: boolean) { if (this.mesh) this.mesh.visible = v; if (this.hull) this.hull.visible = v; }

  dispose() {
    for (const m of [this.mesh, this.hull]) if (m) { m.removeFromParent(); m.geometry.dispose(); }
    for (const m of this.mats) m.dispose();
    this.skeleton?.dispose();
    this.mesh = this.hull = null; this.skeleton = null;
  }
}
const FACES: [number, number][] = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];

/** Vật liệu viền: mực, mặt sau, đẩy ra đúng 1 texel (tỉ lệ độ sâu). */
export function inkHullMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: false, toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTexel = { value: TEXEL_PER_DEPTH };
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uTexel;\nvoid main() {')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
      { vec4 mvp0 = modelViewMatrix * vec4(transformed, 1.0);
        transformed += objectNormal * (max(-mvp0.z, 0.5) * uTexel); }`);
  };
  m.customProgramCacheKey = () => 'pixelInkHull';
  return m;
}

// ───────── nhân vật hoạ sĩ chibi ─────────
export const PAINTER_BONES: BoneDef[] = [
  { n: 'root', p: null, x: 0, y: 0, z: 0 },
  { n: 'hips', p: 'root', x: 0, y: 0.46, z: 0 },
  { n: 'chest', p: 'hips', x: 0, y: 0.06, z: 0 },
  { n: 'head', p: 'chest', x: 0, y: 0.42, z: 0 },
  { n: 'mouth', p: 'head', x: 0, y: 0.1, z: -0.2 },
  { n: 'uaL', p: 'chest', x: -0.24, y: 0.34, z: 0 }, { n: 'faL', p: 'uaL', x: 0, y: -0.2, z: 0 }, { n: 'hdL', p: 'faL', x: 0, y: -0.2, z: 0 },
  { n: 'uaR', p: 'chest', x: 0.24, y: 0.34, z: 0 }, { n: 'faR', p: 'uaR', x: 0, y: -0.2, z: 0 }, { n: 'hdR', p: 'faR', x: 0, y: -0.2, z: 0 },
  { n: 'thL', p: 'hips', x: -0.09, y: -0.02, z: 0 }, { n: 'shL', p: 'thL', x: 0, y: -0.22, z: 0 },
  { n: 'thR', p: 'hips', x: 0.09, y: -0.02, z: 0 }, { n: 'shR', p: 'thR', x: 0, y: -0.22, z: 0 },
];
export const L_UA = 0.2, L_FA = 0.2;
/** Vai trái / phải trong khung ngực. */
export const SHOULDER = [new V3(-0.24, 0.34, 0), new V3(0.24, 0.34, 0)] as const;
/** Miệng trong khung ngực (đầu không xoay). */
export const MOUTH_CHEST = new V3(0, 0.52, -0.2);

export interface PainterLook {
  skin: number; hair: number; hairStyle: 'long' | 'short' | 'bun' | 'bald' | 'pony' | 'afro';
  hat?: { kind: 'beret' | 'cap' | 'bandana'; col: number; col2?: number };
  smock: number; sleeve?: number; pants: number; boots: number; scarf?: number; belt?: number;
  glasses?: 'round' | 'shades'; splat?: number[]; headphones?: boolean; beard?: boolean; skirt?: boolean;
}

/** Dựng thân + đầu + chân tay. Đạo cụ gắn vào xương hdL/hdR/chest bởi nơi gọi. */
export function buildPainter(batch: PixelBatch, look: PainterLook): PixChar {
  const ch = batch.addSkeleton(PAINTER_BONES);
  const bx = (bone: string, c: [number, number, number], s: [number, number, number], col: number, o?: PartOpts) => batch.box(ch, bone, c, s, col, o);
  const sleeve = look.sleeve ?? look.smock;
  // chân
  for (const [sd, th, sh] of [[-1, 'thL', 'shL'], [1, 'thR', 'shR']] as const) {
    void sd;
    bx(th, [0, -0.1, 0], [0.12, 0.24, 0.12], look.pants);
    bx(sh, [0, -0.09, 0], [0.11, 0.2, 0.11], look.pants);
    bx(sh, [0, -0.19, -0.025], [0.13, 0.09, 0.18], look.boots);
  }
  // hông + thân (áo choàng dài quá hông)
  bx('hips', [0, 0.02, 0], [0.32, 0.12, 0.22], look.pants);
  bx('chest', [0, 0.16, 0], [0.34, 0.5, 0.24], look.smock);
  bx('hips', [0, -0.02, 0], [look.skirt ? 0.4 : 0.37, 0.12, 0.27], look.smock);
  if (look.belt !== undefined) bx('chest', [0, -0.04, 0], [0.35, 0.04, 0.25], look.belt, { hull: false });
  if (look.scarf !== undefined) bx('chest', [0, 0.42, 0], [0.26, 0.06, 0.22], look.scarf);
  // sơn dính áo (không viền để khỏi thành chấm mực)
  const sp = look.splat ?? [];
  const spots: [number, number, number][] = [[-0.09, 0.28, 0.06], [0.07, 0.15, 0.05], [-0.04, 0.02, 0.06], [0.1, 0.34, 0.05], [-0.11, 0.12, 0.05]];
  sp.forEach((c, i) => { const s = spots[i % spots.length]!; bx('chest', [s[0], s[1], -0.121], [s[2] + 0.02, s[2], 0.02], c, { hull: false }); });
  // tay (tay áo + bàn tay da)
  for (const [ua, fa, hd] of [['uaL', 'faL', 'hdL'], ['uaR', 'faR', 'hdR']] as const) {
    bx(ua, [0, -0.09, 0], [0.11, 0.24, 0.11], sleeve);
    bx(fa, [0, -0.08, 0], [0.1, 0.21, 0.1], sleeve);
    bx(hd, [0, -0.01, 0], [0.09, 0.09, 0.09], look.skin);
  }
  // đầu: hộp da, tóc, mắt, miệng
  bx('head', [0, 0.24, 0], [0.44, 0.44, 0.4], look.skin);
  const H = look.hair;
  switch (look.hairStyle) {
    case 'long':
      bx('head', [0, 0.27, 0.15], [0.5, 0.52, 0.14], H);
      bx('head', [-0.235, 0.12, 0.02], [0.08, 0.34, 0.3], H); bx('head', [0.235, 0.12, 0.02], [0.08, 0.34, 0.3], H);
      bx('head', [0, 0.45, -0.02], [0.46, 0.08, 0.4], H);
      break;
    case 'short': bx('head', [0, 0.45, 0.0], [0.46, 0.1, 0.42], H); bx('head', [0, 0.3, 0.17], [0.46, 0.3, 0.08], H); break;
    case 'pony': bx('head', [0, 0.45, 0.0], [0.46, 0.1, 0.42], H); bx('head', [0, 0.3, 0.17], [0.46, 0.3, 0.08], H); bx('head', [0, 0.2, 0.27], [0.1, 0.3, 0.1], H); break;
    case 'bun': bx('head', [0, 0.45, 0.0], [0.46, 0.1, 0.42], H); bx('head', [0, 0.3, 0.17], [0.46, 0.3, 0.08], H); bx('head', [0, 0.58, 0.1], [0.16, 0.14, 0.16], H); break;
    case 'afro': bx('head', [0, 0.38, 0.06], [0.6, 0.56, 0.5], H); break;
    default: break;
  }
  const FZ = -0.201;
  bx('head', [-0.1, 0.28, FZ], [0.06, 0.07, 0.02], INK, { hull: false });
  bx('head', [0.1, 0.28, FZ], [0.06, 0.07, 0.02], INK, { hull: false });
  bx('head', [0, 0.2, -0.215], [0.05, 0.05, 0.04], faceColor(look.skin, new V3(0, -0.4, -1)).getHex(), { hull: false });
  bx('mouth', [0, 0, -0.005], [0.12, 0.03, 0.02], INK, { hull: false });
  if (look.glasses === 'round') for (const s of [-1, 1]) bx('head', [s * 0.1, 0.28, -0.208], [0.12, 0.12, 0.012], R.may!['300'], { hull: false });
  if (look.glasses === 'shades') bx('head', [0, 0.28, -0.208], [0.34, 0.09, 0.015], INK, { hull: false });
  if (look.beard) { bx('head', [0, 0.1, -0.19], [0.3, 0.1, 0.04], look.hair); }
  if (look.headphones) {
    for (const s of [-1, 1]) bx('head', [s * 0.24, 0.26, 0], [0.07, 0.16, 0.16], R.may!['500']);
    bx('head', [0, 0.49, 0], [0.5, 0.04, 0.1], R.may!['500']);
  }
  const hat = look.hat;
  if (hat?.kind === 'beret') {
    // mũ nồi: đĩa dẹt lệch về một bên + cuống
    bx('head', [0.04, 0.5, -0.01], [0.52, 0.09, 0.46], hat.col, { rot: [0, 0, -0.14] });
    bx('head', [-0.14, 0.52, -0.02], [0.18, 0.05, 0.38], hat.col, { rot: [0, 0, -0.14] });
    bx('head', [0.15, 0.58, -0.01], [0.05, 0.05, 0.05], hat.col2 ?? hat.col);
  } else if (hat?.kind === 'cap') {
    bx('head', [0, 0.5, 0], [0.46, 0.1, 0.42], hat.col);
    bx('head', [0, 0.46, -0.26], [0.36, 0.04, 0.16], hat.col2 ?? hat.col);
  } else if (hat?.kind === 'bandana') {
    bx('head', [0, 0.46, 0], [0.46, 0.09, 0.42], hat.col);
    bx('head', [0.1, 0.4, 0.22], [0.1, 0.12, 0.06], hat.col, { rot: [0, 0, 0.5] });
  }
  return ch;
}

// ───────── tư thế ─────────
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const DOWN = new V3(0, -1, 0), UP = new V3(0, 1, 0);
const _d = new V3(), _dn = new V3(), _pp = new V3(), _e = new V3(), _u = new V3(), _v = new V3(), _t = new V3();

/** IK 2 xương: tay `side` (-1 trái, +1 phải) với tới `target` (khung ngực); `pole` = hướng gợi ý khuỷu (khung ngực). */
export function reach(ch: PixChar, side: -1 | 1, target: THREE.Vector3, pole: THREE.Vector3) {
  const S = SHOULDER[side > 0 ? 1 : 0];
  _d.subVectors(target, S);
  const full = L_UA + L_FA - 0.004;
  const dist = clamp(_d.length(), 0.06, full);
  _dn.copy(_d).normalize();
  _t.copy(S).addScaledVector(_dn, dist); // đích đã kẹp
  const cosA = clamp((L_UA * L_UA + dist * dist - L_FA * L_FA) / (2 * L_UA * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _pp.copy(pole).addScaledVector(_dn, -pole.dot(_dn));
  if (_pp.lengthSq() < 1e-6) _pp.set(0, -1, 0).addScaledVector(_dn, _dn.y);
  _pp.normalize();
  _e.copy(S).addScaledVector(_dn, L_UA * cosA).addScaledVector(_pp, L_UA * sinA);
  _u.subVectors(_e, S).normalize();
  _v.subVectors(_t, _e).normalize();
  const ua = ch.b[side > 0 ? 'uaR' : 'uaL']!, fa = ch.b[side > 0 ? 'faR' : 'faL']!;
  ua.quaternion.setFromUnitVectors(DOWN, _u);
  _v.applyQuaternion(_q1.copy(ua.quaternion).invert());
  fa.quaternion.setFromUnitVectors(DOWN, _v);
}

/** Xoay xương cầm (hdL/hdR) để trục +Y chỉ theo `dir` (khung ngực), sau khi đã `reach`. */
export function aimHold(ch: PixChar, side: -1 | 1, dir: THREE.Vector3) {
  const ua = ch.b[side > 0 ? 'uaR' : 'uaL']!, fa = ch.b[side > 0 ? 'faR' : 'faL']!, hd = ch.b[side > 0 ? 'hdR' : 'hdL']!;
  _q2.copy(ua.quaternion).multiply(fa.quaternion).invert();
  _q3.setFromUnitVectors(UP, _t.copy(dir).normalize());
  hd.quaternion.copy(_q2).multiply(_q3);
}

/** Tay thả theo hướng (khung ngực), duỗi hết cỡ. */
export function armDir(ch: PixChar, side: -1 | 1, dir: THREE.Vector3, pole: THREE.Vector3, len = 0.4) {
  const S = SHOULDER[side > 0 ? 1 : 0];
  _tgt.copy(S).addScaledVector(_dn.copy(dir).normalize(), len);
  reach(ch, side, _tgt, pole);
}
const _tgt = new V3();

/** Điểm thế giới → khung ngực (cần root.updateMatrixWorld(true) trước đó). */
export function worldToChest(ch: PixChar, p: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  return ch.b.chest!.worldToLocal(out.copy(p));
}
/** Hướng thế giới → khung ngực. */
export function dirToChest(ch: PixChar, d: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  ch.b.chest!.getWorldQuaternion(_q1).invert();
  return out.copy(d).applyQuaternion(_q1);
}

/** Chân bằng góc: đùi quay x = a (dương = đưa chân ra trước), cẳng chân x = b. */
export function leg(ch: PixChar, side: -1 | 1, a: number, b: number, spread = 0) {
  ch.b[side > 0 ? 'thR' : 'thL']!.rotation.set(a, 0, side * spread);
  ch.b[side > 0 ? 'shR' : 'shL']!.rotation.set(b, 0, 0);
}
/** Về tư thế nghỉ. */
export function resetPose(ch: PixChar) {
  for (const k of Object.keys(ch.b)) if (k !== 'root') { const b = ch.b[k]!; b.quaternion.identity(); }
  ch.b.hips!.position.y = 0.46;
  ch.b.mouth!.scale.set(1, 1, 1);
}
/** Độ cao hông để bàn chân chạm sàn khi đùi nghiêng a, cẳng b (cùng cho hai chân). */
export function hipHeight(a: number, b: number) { return 0.02 + 0.22 * (Math.cos(a) + Math.cos(a + b)); }

/** Bộ đếm bước 12 fps: trả true mỗi khi tới khung mới (luôn true ở lần đầu). */
export class Tick12 {
  private acc = 1;
  step(dt: number): boolean {
    this.acc += dt;
    if (this.acc < 1 / 12) return false;
    this.acc = Math.min(this.acc - 1 / 12, 1 / 12);
    return true;
  }
}

/** Đĩa bóng đổ phẳng dưới chân (trong suốt, không viền, không additive). */
export function shadowDisc(radius = 0.34): { mesh: THREE.Mesh; dispose(): void } {
  const geo = new THREE.CircleGeometry(radius, 10).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.4, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1; mesh.scale.set(1, 1, 0.8);
  return { mesh, dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); } };
}
