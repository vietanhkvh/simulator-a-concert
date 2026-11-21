// "Đêm Sao Điểm Ảnh" — khe `structure` của khán đài (gói P2). Dựng riêng (không bọc createStadium → không có quầng
// glow mềm): 3 tầng mặt phẳng tô phẳng bảng 31 màu, mỗi mặt "điểm hoạ" — chấm 1 px theo ô so le (Seurat) màu thứ hai,
// chấm mặt tường trước đổi màu theo Hype (lam Phổ → crôm → son). Lối thang tối bậc xám mây, cửa vom mực,
// biển khu A–H = nhãn bảo tàng khung mạ vàng chữ bitmap 5×7 (không lật gương), 4 cột đèn pha giàn mực + ô đèn crôm,
// và ở hai đầu khán đài: lan can cầu + hai bóng người đội mũ (trích "Tiếng thét", Munch 1893 — phạm vi công cộng).
// Không có dải trim sáng mảnh nào (bài học steel). Draw call: kết cấu 1 + biển 1.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FIELD_Y, STADIUM_CENTRE, STANDS_ARC, STANDS_TIERS } from '../../../../world/layout';
import type { StandsBuildContext, StandsBuilders, StructureHandle } from '../../builders';
import { P, pal31, palRgb } from './pal';

const CX = STADIUM_CENTRE.x, CZ = STADIUM_CENTRE.z;
const A0 = STANDS_ARC.from, A1 = STANDS_ARC.to;
const SECTIONS = 8;
const P3 = (r: number, a: number, y: number): number[] => [CX + Math.sin(a) * r, y, CZ - Math.cos(a) * r];

const VERT = /* glsl */ `
attribute vec3 color; attribute vec3 aDot; attribute float aKind;
varying vec3 vCol; varying vec3 vDot; varying float vKind;
void main(){ vCol = color; vDot = aDot; vKind = aKind; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
uniform vec3 uHypeDot;
varying vec3 vCol; varying vec3 vDot; varying float vKind;
void main(){
  vec2 p = floor(gl_FragCoord.xy);
  // ô so le: chấm 1 px mỗi 4 px ngang, cách hàng; hàng chấm lẻ dịch 2 px
  float row = mod(p.y, 2.0);
  float on = (1.0 - row) * step(mod(p.x + 2.0 * mod(floor(p.y * 0.5), 2.0), 4.0), 0.5);
  vec3 d = vKind > 0.5 ? uHypeDot : vDot;
  gl_FragColor = vec4(mix(vCol, d, on), 1.0);
}`;

const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
};

/** 8 nhãn bảo tàng 16×12 texel: viền crôm-700 + crôm-500, nền kem crôm-100, chữ mực. Hàng 0 = đáy (v = 0). */
function plaqueAtlas(pal: number[]): THREE.DataTexture {
  const CW = 16, CH = 12, W = CW * SECTIONS, H = CH;
  const data = new Uint8Array(W * H * 4);
  const put = (x: number, y: number, i: number) => {
    const h = pal[i]!, o = (y * W + x) * 4;
    data[o] = (h >> 16) & 255; data[o + 1] = (h >> 8) & 255; data[o + 2] = h & 255; data[o + 3] = 255;
  };
  for (let k = 0; k < SECTIONS; k++) {
    const ox = k * CW;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const edge = Math.min(x, y, CW - 1 - x, CH - 1 - y);
      put(ox + x, y, edge === 0 ? P.CROM7 : edge === 1 ? P.CROM5 : P.CROM1);
    }
    const g = FONT['ABCDEFGH'[k]!]!;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) if (g[i]![j] === '#') put(ox + 5 + j, CH - 3 - i, P.INK);
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  return tex;
}

export function createPixelStructure(ctx: StandsBuildContext): StructureHandle {
  const { scene } = ctx;
  const pal = pal31();
  const c = (i: number) => palRgb(pal, i);
  const pos: number[] = [], col: number[] = [], dot: number[] = [], kind: number[] = [];
  const quad = (a: number[], b: number[], cc: number[], d: number[], base: number, dt = base, k = 0) => {
    pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    const cb = c(base), cd = c(dt);
    for (let i = 0; i < 6; i++) { col.push(...cb); dot.push(...cd); kind.push(k); }
  };
  const N = 128;
  type Seg = [number, number, number, number, number, number, number?]; // r1,y1,r2,y2, nền, chấm, kind
  const sweep = (segs: Seg[]) => {
    for (const [r1, y1, r2, y2, base, d, k] of segs) for (let i = 0; i < N; i++) {
      const a = A0 + ((A1 - A0) * i) / N, b = A0 + ((A1 - A0) * (i + 1)) / N;
      quad(P3(r1, a, y1), P3(r1, b, y1), P3(r2, b, y2), P3(r2, a, y2), base, d, k ?? 0);
    }
  };
  const segs: Seg[] = [];
  STANDS_TIERS.forEach((T, ti) => {
    const y0 = T.y0;
    segs.push(
      [T.rf, T.yf0, T.rf, y0 - 0.6, P.PHO7, P.TIM5, 1],     // tường trước: chấm đổi màu theo Hype
      [T.rf, y0 - 0.6, T.rf, y0 + 0.15, P.TIM7, P.TIM5],    // lan can (tối, không viền sáng)
      [T.rf, y0 + 0.15, T.rf + 0.3, y0 + 0.15, P.TIM7, P.PHO5],
    );
    for (let s = 0; s < 4; s++) { // mặt ghế dốc: 2 tông tối xen kẽ (đốm khán giả phủ lên)
      const f0 = s / 4, f1 = (s + 1) / 4;
      segs.push([T.r0 + 0.3 + f0 * (T.r1 - T.r0 - 0.3), y0 + 0.15 + f0 * (T.y1 - y0 - 0.15), T.r0 + 0.3 + f1 * (T.r1 - T.r0 - 0.3), y0 + 0.15 + f1 * (T.y1 - y0 - 0.15), s % 2 ? P.TIM7 : P.PHO7, P.TIM5]);
    }
    const nx = STANDS_TIERS[ti + 1];
    if (nx) segs.push([T.r1, T.y1, nx.rf, nx.yf0, P.INK, P.TIM7]);
  });
  segs.push(
    [120, 30, 120, 34.2, P.TIM7, P.TIM5],
    [120, 34.2, 126.5, 34.9, P.INK, P.PHO7],
    [126.5, 34.9, 126.5, 35.8, P.PHO7, P.TIM5, 1],
    [126.5, 35.8, 120, 35.2, P.TIM5, P.TIM7],
  );
  sweep(segs);
  for (const a of [A0, A1]) {
    for (const T of STANDS_TIERS) quad(P3(T.rf, a, T.yf0), P3(T.r1 + 1, a, T.yf0), P3(T.r1 + 1, a, T.y1), P3(T.rf, a, T.y0), P.INK, P.TIM7);
    quad(P3(120, a, 30), P3(126.5, a, 30), P3(126.5, a, 35.8), P3(120, a, 35.8), P.INK, P.TIM7);
  }

  const tan = (a: number) => [Math.cos(a), 0, Math.sin(a)];
  const along = (b: number[], t: number[], x: number, y: number, dr = 0, a = 0) =>
    [b[0]! + t[0]! * x + Math.sin(a) * dr, y, b[2]! + t[2]! * x - Math.cos(a) * dr];
  const secA = (A1 - A0) / SECTIONS;
  for (let k = 1; k < SECTIONS; k++) {
    const a = A0 + secA * k, t = tan(a);
    STANDS_TIERS.forEach((T, ti) => {
      // cửa vom: chữ nhật mực trên tường trước
      const vb = P3(T.rf - 0.05, a, 0), vh = ti === 0 ? 3.6 : Math.max(1.6, T.y0 - 1.2 - T.yf0);
      quad(along(vb, t, -1.6, T.yf0), along(vb, t, 1.6, T.yf0), along(vb, t, 1.6, T.yf0 + vh), along(vb, t, -1.6, T.yf0 + vh), P.INK, P.INK);
      // lối thang: bậc mực / xám mây tối
      const steps = 12;
      for (let s = 0; s < steps; s++) {
        const f0 = s / steps, f1 = (s + 1) / steps;
        const r0 = T.r0 + 0.3 + f0 * (T.r1 - T.r0 - 0.3), r1 = T.r0 + 0.3 + f1 * (T.r1 - T.r0 - 0.3);
        const y0 = T.y0 + 0.2 + f0 * (T.y1 - T.y0 - 0.1), y1 = T.y0 + 0.2 + f1 * (T.y1 - T.y0 - 0.1);
        const da = 0.75 / r0;
        quad(P3(r0, a - da, y0), P3(r0, a + da, y0), P3(r1, a + da, y1), P3(r1, a - da, y1), s % 2 ? P.MAY7 : P.INK, P.INK);
      }
    });
  }

  // cột đèn pha: giàn 4 trụ mực/xám mây + bảng đèn mực với 6 × 4 ô đèn crôm (vuông, cạnh dày — không tia mảnh)
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, base: number) => {
    const X0 = x - w / 2, X1 = x + w / 2, Y0 = y - h / 2, Y1 = y + h / 2, Z0 = z - d / 2, Z1 = z + d / 2;
    quad([X0, Y0, Z0], [X1, Y0, Z0], [X1, Y1, Z0], [X0, Y1, Z0], base);
    quad([X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1], base);
    quad([X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0], base);
    quad([X1, Y0, Z0], [X1, Y0, Z1], [X1, Y1, Z1], [X1, Y1, Z0], base);
    quad([X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1], base);
  };
  for (const a of [-0.62 * Math.PI, -0.3 * Math.PI, 0.3 * Math.PI, 0.62 * Math.PI]) {
    const [x, , z] = P3(130, a, 0) as [number, number, number];
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(x + dx! * 1.0, (FIELD_Y + 47) / 2, z + dz! * 1.0, 0.45, 47 - FIELD_Y, 0.45, P.MAY7);
    for (let y = FIELD_Y + 3; y < 45; y += 3.4) { box(x, y, z - 1, 2.2, 0.35, 0.35, P.INK); box(x, y, z + 1, 2.2, 0.35, 0.35, P.INK); box(x - 1, y, z, 0.35, 0.35, 2.2, P.INK); box(x + 1, y, z, 0.35, 0.35, 2.2, P.INK); }
    const ry = -a, cs = Math.cos(ry), sn = Math.sin(ry);
    const pt = (lx: number, y: number, lz: number) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
    const W = 4, Y0 = 46.5, Y1 = 53;
    quad(pt(-W, Y0, 0.2), pt(W, Y0, 0.2), pt(W, Y1, 0.2), pt(-W, Y1, 0.2), P.INK, P.TIM7);
    quad(pt(-W, Y1, 0.2), pt(W, Y1, 0.2), pt(W, Y1, -0.6), pt(-W, Y1, -0.6), P.MAY7, P.MAY7);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const lx = (i - 2.5) * 1.25, ly = (Y0 + Y1) / 2 + (j - 1.5) * 1.45, s = 0.48;
      quad(pt(lx - s, ly - s, -0.05), pt(lx + s, ly - s, -0.05), pt(lx + s, ly + s, -0.05), pt(lx - s, ly + s, -0.05), (i + j) % 3 ? P.CROM3 : P.CROM1, P.CROM1);
    }
  }

  // hai đầu khán đài: lan can cầu chéo (đất) + hai bóng người đội mũ, mặt quay vào sân
  for (const [a, sgn] of [[A0 + 0.004, 1], [A1 - 0.004, -1]] as const) {
    STANDS_TIERS.forEach((T) => {
      const n = Math.ceil((T.r1 - T.r0) / 1.6);
      for (let i = 0; i <= n; i++) {
        const f = i / n, r = T.r0 + f * (T.r1 - T.r0), y = T.y0 + f * (T.y1 - T.y0);
        const b = P3(r, a, 0), t = tan(a);
        quad(along(b, t, -0.12, y), along(b, t, 0.12, y), along(b, t, 0.12, y + 1.3), along(b, t, -0.12, y + 1.3), P.DAT7, P.DAT7);
      }
      const ra = P3(T.r0, a, 0), rb = P3(T.r1, a, 0), t = tan(a);
      const top = (bb: number[], y: number, o: number) => along(bb, t, 0, y + o);
      quad(top(ra, T.y0, 1.05), top(rb, T.y1, 1.05), top(rb, T.y1, 1.45), top(ra, T.y0, 1.45), P.DAT5, P.DAT3);
    });
    const T = STANDS_TIERS[2];
    for (const [fr, hs] of [[0.35, 1.0], [0.62, 0.92]] as const) {
      const r = T.r0 + fr * (T.r1 - T.r0), y = T.y0 + fr * (T.y1 - T.y0) + 0.1;
      const aa = a + sgn * (1.6 / r);
      const b = P3(r, aa, 0);
      const rad = [Math.sin(aa), 0, -Math.cos(aa)]; // mặt phẳng hình chứa trục bán kính → nhìn ngang từ sân khấu
      const pp = (x: number, yy: number) => [b[0]! + rad[0]! * x, yy, b[2]! + rad[2]! * x];
      const H = 2.3 * hs;
      quad(pp(-0.45, y), pp(0.45, y), pp(0.35, y + H * 0.78), pp(-0.35, y + H * 0.78), P.TIM7, P.INK);       // áo khoác dài
      quad(pp(-0.2, y + H * 0.78), pp(0.2, y + H * 0.78), pp(0.2, y + H * 0.92), pp(-0.2, y + H * 0.92), P.DAT5, P.DAT5); // mặt
      quad(pp(-0.4, y + H * 0.92), pp(0.4, y + H * 0.92), pp(0.4, y + H * 0.96), pp(-0.4, y + H * 0.96), P.INK, P.INK);   // vành mũ
      quad(pp(-0.22, y + H * 0.96), pp(0.22, y + H * 0.96), pp(0.22, y + H * 1.08), pp(-0.22, y + H * 1.08), P.INK, P.INK); // chóp mũ
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aDot', new THREE.Float32BufferAttribute(dot, 3));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  const hypeDot = new THREE.Vector3(...c(P.PHO3));
  const mat = new THREE.ShaderMaterial({ uniforms: { uHypeDot: { value: hypeDot } }, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, fog: false });
  const struct = new THREE.Mesh(geo, mat);
  struct.renderOrder = -8;
  struct.name = 'stands-pixel-structure';

  // biển khu: nhãn bảo tàng trên tường trước; u tăng theo hướng PHẢI của người nhìn từ trong sân (tiếp tuyến +t)
  const tex = plaqueAtlas(pal);
  const sp: number[] = [], su: number[] = [];
  STANDS_TIERS.forEach((T, ti) => {
    const w = ti === 0 ? 4.4 : 3.4, h = w * 0.75, yc = ti === 0 ? 2.4 : T.yf0 + (T.y0 - 0.6 - T.yf0) / 2;
    for (let k = 0; k < SECTIONS; k++) {
      const a = A0 + secA * (k + 0.5), t = tan(a), b = P3(T.rf - 0.1, a, 0);
      const pt = (x: number, y: number) => [b[0]! + t[0]! * x, y, b[2]! + t[2]! * x];
      const u0 = k / SECTIONS, u1 = (k + 1) / SECTIONS;
      const L0 = pt(-w / 2, yc - h / 2), R0 = pt(w / 2, yc - h / 2), R1 = pt(w / 2, yc + h / 2), L1 = pt(-w / 2, yc + h / 2);
      sp.push(...L0, ...R0, ...R1, ...L0, ...R1, ...L1);
      su.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    }
  });
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sGeo.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
  const sMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const signs = new THREE.Mesh(sGeo, sMat);
  signs.renderOrder = -7;
  signs.name = 'stands-pixel-plaques';

  scene.add(struct, signs);
  let band = -1;
  return {
    update(f: FrameState) {
      const b = f.hype >= 0.8 ? 2 : f.hype >= 0.4 ? 1 : 0;
      if (b !== band) { band = b; hypeDot.set(...c([P.PHO3, P.CROM5, P.SON3][b]!)); }
    },
    dispose() {
      scene.remove(struct, signs);
      geo.dispose(); mat.dispose(); sGeo.dispose(); sMat.dispose(); tex.dispose();
    },
  };
}

export const builders: Partial<StandsBuilders> = { structure: createPixelStructure };
