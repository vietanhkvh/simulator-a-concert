// "Thép & Lửa" — khe `structure` của khán đài: bọc createStadium (giữ khán giả chấm sáng + tương tác + quầng đèn pha) nhưng ẩn
// kết cấu / trang trí kẹo, thay bằng: tầng bê tông xám mặt phẳng, dầm thép lộ (cột + xà đỡ + giằng chéo mặt sau), lối cầu thang
// sọc cảnh báo, biển khu stencil "A"–"H" trên tấm thép, 4 cột đèn pha hộp với mảng bóng vuông hồ quang, băng rôn tour đỏ tia sét
// trắng nung rủ từ mép trên (thay cờ dây). Draw call: kết cấu 1 + biển 1 + bóng đèn pha 1 (+ khán giả mặc định nếu khe standCrowd trống).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FIELD_Y, STADIUM_CENTRE, STANDS_ARC, STANDS_TIERS } from '../../../../world/layout';
import { RAMPS, hexToRgb, shade, shadowOf } from '../../../../world/style';
import type { StandsBuildContext, StandsBuilders, StructureHandle } from '../../builders';
import { createStadium } from '../../stadium';

const CX = STADIUM_CENTRE.x, CZ = STADIUM_CENTRE.z;
const A0 = STANDS_ARC.from, A1 = STANDS_ARC.to;
const P3 = (r: number, a: number, y: number): [number, number, number] => [CX + Math.sin(a) * r, y, CZ - Math.cos(a) * r];
const S = (hex: number) => hexToRgb(shade(hex, 'stands'));
const D = (hex: number) => hexToRgb(shadowOf(shade(hex, 'stands')));
const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');
const BOLT: [number, number][] = [[0.12, 0.5], [-0.22, -0.02], [0.02, -0.02], [-0.14, -0.5], [0.24, 0.08], [0.0, 0.08]];

function signAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const st = RAMPS.steel!, paper = RAMPS.paper!, coal = RAMPS.coal!;
  const CW = 256, CH = 160;
  const cv = document.createElement('canvas'); cv.width = CW * 4; cv.height = CH * 2;
  const g = cv.getContext('2d')!;
  for (let k = 0; k < 8; k++) {
    const ox = (k % 4) * CW, oy = Math.floor(k / 4) * CH;
    g.save(); g.translate(ox + CW, oy); g.scale(-1, 1);
    g.fillStyle = hx(st[500]); g.fillRect(0, 0, CW, CH);
    g.fillStyle = hx(st[700]); for (let y = 0; y < CH; y += 4) g.fillRect(0, y, CW, 1);
    g.strokeStyle = hx(coal[300]); g.lineWidth = 6; g.strokeRect(5, 5, CW - 10, CH - 10);
    g.fillStyle = hx(st[100]); for (const [x, y] of [[16, 16], [CW - 16, 16], [16, CH - 16], [CW - 16, CH - 16]]) { g.beginPath(); g.arc(x!, y!, 6, 0, 7); g.fill(); }
    g.fillStyle = hx(paper[500]); g.font = '900 130px "Arial Narrow", "Roboto Condensed", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCDEFGH'[k]!, CW / 2, CH / 2 + 8);
    g.fillStyle = hx(st[500]); g.fillRect(CW / 2 - 3, 20, 6, CH - 40); // cầu stencil
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export function createSteelStructure(ctx: StandsBuildContext): StructureHandle {
  const { scene, uniforms, glow } = ctx;
  const before = new Set(scene.children);
  const inner = createStadium(scene, uniforms, glow, { crowd: ctx.crowd });
  for (const o of scene.children) if (!before.has(o) && (o as THREE.Mesh).isMesh) o.visible = false;

  const C = RAMPS.coal!, ST = RAMPS.steel!, FL = RAMPS.flame!, BL = RAMPS.blood!, WH = RAMPS.whitehot!;
  const CONC = 0x6b6e74, CONC2 = 0x55585e; // bê tông xám (derived từ steel-500 giảm bão hoà)
  const pos: number[] = [], col: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], ca: number[]) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) col.push(...ca); };
  const tri = (a: number[], b: number[], c: number[], ca: number[]) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(...ca); };
  const N = 96; // mặt phẳng rộng → đọc được từng tấm
  const LR = -0.47, LY = 0.88;
  type Seg = [number, number, number, number, number];
  const sweep = (segs: Seg[]) => {
    for (const [r1, y1, r2, y2, hex] of segs) {
      const nr = -(y2 - y1), ny = r2 - r1, len = Math.hypot(nr, ny) || 1;
      const lit = (nr / len) * LR + (ny / len) * LY > 0.28;
      for (let i = 0; i < N; i++) {
        const a = A0 + ((A1 - A0) * i) / N, b = A0 + ((A1 - A0) * (i + 1)) / N;
        const base = lit ? S(hex) : D(hex);
        const j = 1 + (((i * 37) % 7) - 3) * 0.015; // mỗi tấm một sắc
        quad(P3(r1, a, y1), P3(r1, b, y1), P3(r2, b, y2), P3(r2, a, y2), base.map((v) => v * j));
      }
    }
  };
  const segs: Seg[] = [];
  STANDS_TIERS.forEach((T, ti) => {
    const rf = T.rf, y0 = T.y0;
    segs.push([rf, T.yf0, rf, y0 - 0.9, CONC2], [rf, y0 - 0.9, rf - 0.35, y0 - 0.5, ST[700]], [rf - 0.35, y0 - 0.5, rf - 0.35, y0 + 0.1, ST[500]], [rf - 0.35, y0 + 0.1, rf + 0.3, y0 + 0.1, FL[700]]);
    for (let s = 0; s < 4; s++) {
      const f0 = s / 4, f1 = (s + 1) / 4;
      segs.push([T.r0 + 0.3 + f0 * (T.r1 - T.r0 - 0.3), y0 + 0.1 + f0 * (T.y1 - y0 - 0.1), T.r0 + 0.3 + f1 * (T.r1 - T.r0 - 0.3), y0 + 0.1 + f1 * (T.y1 - y0 - 0.1), s % 2 ? ST[700] : C[100]]); // bậc ngồi tối → đốm khán giả nổi
    }
    const nx = STANDS_TIERS[ti + 1];
    if (nx) segs.push([T.r1, T.y1, nx.rf - 0.5, nx.yf0, C[300]]);
  });
  segs.push([120, 30, 120, 33.4, ST[700]], [120, 33.4, 121.4, 33.4, ST[500]], [121.4, 33.4, 121.4, 30, C[300]]);
  sweep(segs);
  const dark = S(C[300]);
  for (const a of [A0, A1]) for (const T of STANDS_TIERS) quad(P3(T.rf, a, T.yf0), P3(T.r1 + 1, a, T.yf0), P3(T.r1 + 1, a, T.y1), P3(T.rf, a, T.y0), dark);

  const tan = (a: number) => [Math.cos(a), 0, Math.sin(a)];
  /** Dầm hộp đứng/xiên giữa hai điểm, tiết diện w theo phương tiếp tuyến tại góc a (2 mặt: trước + cạnh). */
  const girder = (p: number[], q: number[], a: number, w: number, hex: number) => {
    const t = tan(a), cs = S(hex), cd = D(hex);
    const o = (v: number[], s: number) => [v[0]! + t[0]! * w * s, v[1]!, v[2]! + t[2]! * w * s];
    quad(o(p, -1), o(p, 1), o(q, 1), o(q, -1), cs);
    const r = [Math.sin(a) * w, 0, -Math.cos(a) * w];
    quad(o(p, 1), [o(p, 1)[0]! + r[0]!, p[1]!, o(p, 1)[2]! + r[2]!], [o(q, 1)[0]! + r[0]!, q[1]!, o(q, 1)[2]! + r[2]!], o(q, 1), cd);
  };
  // dầm thép lộ: cột trước mỗi tầng + xà xiên dưới bậc + giằng chéo
  const NG = 32;
  for (let i = 0; i <= NG; i++) {
    const a = A0 + ((A1 - A0) * i) / NG;
    STANDS_TIERS.forEach((T) => {
      girder(P3(T.rf - 0.38, a, T.yf0), P3(T.rf - 0.38, a, T.y0 - 0.5), a, 0.22, ST[500]);
      girder(P3(T.r0 + 0.3, a, T.y0 + 0.2), P3(T.r1, a, T.y1 + 0.2), a, 0.16, ST[700]);
    });
    if (i < NG) {
      const b = A0 + ((A1 - A0) * (i + 1)) / NG, T = STANDS_TIERS[2];
      girder(P3(121.4, a, 30), P3(121.4, b, 33.4), a, 0.1, ST[500]);
      girder(P3(121.4, a, 33.4), P3(121.4, b, 30), a, 0.1, ST[500]);
      void T;
    }
  }
  // lối cầu thang: dải sọc cảnh báo (xen lửa / than) dọc 7 lối
  const SECTIONS = 8, secA = (A1 - A0) / SECTIONS;
  for (let k = 1; k < SECTIONS; k++) {
    const a = A0 + secA * k;
    STANDS_TIERS.forEach((T) => {
      const steps = 10;
      for (let s = 0; s < steps; s++) {
        const f0 = s / steps, f1 = (s + 1) / steps;
        const r0 = T.r0 + 0.3 + f0 * (T.r1 - T.r0 - 0.3), r1 = T.r0 + 0.3 + f1 * (T.r1 - T.r0 - 0.3);
        const y0 = T.y0 + 0.13 + f0 * (T.y1 - T.y0 - 0.1), y1 = T.y0 + 0.13 + f1 * (T.y1 - T.y0 - 0.1);
        const da = 0.7 / r0, c = s % 2 ? S(FL[500]) : S(C[500]);
        quad(P3(r0, a - da, y0), P3(r0, a + da, y0), P3(r1, a + da, y1), P3(r1, a - da, y1), c);
      }
    });
  }
  // băng rôn tour: đỏ huyết, mép rách răng cưa, tia sét trắng nung — rủ từ mép trên khán đài
  const NB = 14;
  for (let i = 0; i < NB; i++) {
    const a = A0 + ((A1 - A0) * (i + 0.5)) / NB, t = tan(a);
    const top = 33.2, h = 6.5, w = 2.4;
    const b = P3(119.8, a, 0);
    const pt = (x: number, y: number) => [b[0]! + t[0]! * x, y, b[2]! + t[2]! * x];
    quad(pt(-w / 2, top - h), pt(w / 2, top - h), pt(w / 2, top), pt(-w / 2, top), S(BL[500]));
    for (let j = 0; j < 6; j++) { const x0 = -w / 2 + (w * j) / 6, x1 = x0 + w / 6; tri(pt(x0, top - h), pt(x1, top - h), pt((x0 + x1) / 2, top - h - 0.45 - (j % 2) * 0.25), S(BL[500])); }
    const bp = BOLT.map(([x, y]) => pt(x * 4.6, top - h / 2 + y * 4.6).map((v, k) => (k === 1 ? v : v - (k === 0 ? Math.sin(a) : -Math.cos(a)) * 0.03)));
    const wc = S(WH[500]);
    for (const [p, q, r] of [[0, 1, 2], [0, 2, 5], [5, 2, 3], [5, 3, 4]] as const) tri(bp[p]!, bp[q]!, bp[r]!, wc);
  }
  // cột đèn pha hộp: thân giàn (4 mặt + giằng) + hộp đèn
  const lampPts: { x: number; y: number; z: number; ry: number }[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, hex: number) => {
    const c = S(hex), cd = D(hex);
    const X0 = x - w / 2, X1 = x + w / 2, Y0 = y - h / 2, Y1 = y + h / 2, Z0 = z - d / 2, Z1 = z + d / 2;
    quad([X0, Y0, Z0], [X1, Y0, Z0], [X1, Y1, Z0], [X0, Y1, Z0], c);
    quad([X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1], cd);
    quad([X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0], cd);
    quad([X1, Y0, Z0], [X1, Y0, Z1], [X1, Y1, Z1], [X1, Y1, Z0], c);
    quad([X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1], c);
  };
  for (const a of [-0.62 * Math.PI, -0.3 * Math.PI, 0.3 * Math.PI, 0.62 * Math.PI]) {
    const [x, , z] = P3(130, a, 0);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(x + dx! * 0.9, (FIELD_Y + 48) / 2, z + dz! * 0.9, 0.3, 48 - FIELD_Y, 0.3, ST[500]);
    for (let y = FIELD_Y + 3; y < 46; y += 3.2) { box(x, y, z - 0.9, 2.1, 0.15, 0.15, ST[700]); box(x, y, z + 0.9, 2.1, 0.15, 0.15, ST[700]); box(x - 0.9, y, z, 0.15, 0.15, 2.1, ST[700]); box(x + 0.9, y, z, 0.15, 0.15, 2.1, ST[700]); }
    box(x, FIELD_Y + 0.5, z, 3.4, 1.0, 3.4, C[300]);
    // hộp đèn 7 × 5 m, mặt quay vào sân
    const ry = -a;
    const c = Math.cos(ry), s = Math.sin(ry);
    const pt = (lx: number, y: number, lz: number) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
    const W = 3.6, Y0 = 47, Y1 = 52.5;
    quad(pt(-W, Y0, 0.3), pt(W, Y0, 0.3), pt(W, Y1, 0.3), pt(-W, Y1, 0.3), S(C[300]));
    quad(pt(-W, Y0, -0.4), pt(W, Y0, -0.4), pt(W, Y1, -0.4), pt(-W, Y1, -0.4), S(ST[700]));
    quad(pt(-W, Y1, -0.4), pt(W, Y1, -0.4), pt(W, Y1, 0.3), pt(-W, Y1, 0.3), S(ST[500]));
    lampPts.push({ x, y: (Y0 + Y1) / 2, z, ry });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col.map((v) => Math.pow(v, 2.2)), 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const struct = new THREE.Mesh(geo, mat);
  struct.renderOrder = -8;

  // mảng bóng đèn pha vuông (6 × 4 mỗi cột), hồ quang lạnh
  const lGeo = new THREE.PlaneGeometry(0.95, 0.95);
  const lMat = new THREE.MeshBasicMaterial({ color: RAMPS.arc![300], fog: false, side: THREE.DoubleSide });
  const lamps = new THREE.InstancedMesh(lGeo, lMat, lampPts.length * 24);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const L of lampPts) {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.ry);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
        const lx = (i - 2.5) * 1.15, ly = (j - 1.5) * 1.15;
        p.set(lx, ly, -0.45).applyQuaternion(q).add(new THREE.Vector3(L.x, L.y, L.z));
        lamps.setMatrixAt(n++, m.compose(p, q, sc));
      }
    }
  }
  lamps.frustumCulled = false;

  // biển khu stencil trên tấm thép
  const tex = signAtlas();
  const sp: number[] = [], su: number[] = [];
  STANDS_TIERS.forEach((T, ti) => {
    const w = ti === 0 ? 4.4 : 3.4, h = w * 0.62, yc = ti === 0 ? 2.6 : T.yf0 + (T.y0 - 0.9 - T.yf0) / 2;
    for (let k = 0; k < SECTIONS; k++) {
      const a = A0 + secA * (k + 0.5), t = tan(a), b = P3(T.rf - 0.12, a, 0);
      const pt = (x: number, y: number) => [b[0]! + t[0]! * x, y, b[2]! + t[2]! * x];
      const u0 = (k % 4) / 4, u1 = u0 + 0.25, v1 = 1 - Math.floor(k / 4) / 2, v0 = v1 - 0.5;
      const A = pt(w / 2, yc - h / 2), B = pt(-w / 2, yc - h / 2), Cc = pt(-w / 2, yc + h / 2), Dd = pt(w / 2, yc + h / 2);
      sp.push(...A, ...B, ...Cc, ...A, ...Cc, ...Dd);
      su.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
  });
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sGeo.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
  const sMat = new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : ST[500], side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const signs = new THREE.Mesh(sGeo, sMat);

  const objs = [struct, signs, lamps];
  scene.add(...objs);
  return {
    update(f: FrameState, t: number) {
      inner.update?.(f, t);
      lMat.color.setHex(RAMPS.arc![300]).multiplyScalar(0.85 + 0.15 * f.hype);
    },
    dispose() {
      inner.dispose();
      scene.remove(...objs);
      geo.dispose(); mat.dispose(); lGeo.dispose(); lMat.dispose(); lamps.dispose(); sGeo.dispose(); sMat.dispose(); tex?.dispose();
    },
  };
}

export const builders: Partial<StandsBuilders> = { structure: createSteelStructure };
