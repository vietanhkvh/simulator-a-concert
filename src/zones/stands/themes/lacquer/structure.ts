// "Mực & Sơn mài" — khe `structure` của khán đài: bọc createStadium (giữ khán giả chấm sáng + tương tác + quầng đèn pha trong
// Points chung) nhưng ẩn kết cấu / trang trí kẹo, thay bằng: tầng gỗ sơn then chỉ vàng, mái ngói cong vểnh trên đỉnh, cờ ngũ sắc
// trên cột (vẫy chậm, instanced), biển khu sơn son chữ vàng, dây đèn lồng thay bóng đèn dây, tháp đèn pha thành tháp đèn lồng gỗ.
// Draw call: kết cấu 1 + cờ 1 + biển 1 + đèn lồng 1 (+ khán giả của bản mặc định nếu khe standCrowd trống).
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

/** Atlas 4×2: biển sơn son, viền kép vàng, chữ khu vàng quỳ kiểu serif. */
function signAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const son = RAMPS.son!, gold = RAMPS.gold!;
  const CW = 400, CH = 180;
  const cv = document.createElement('canvas'); cv.width = CW * 4; cv.height = CH * 2;
  const g = cv.getContext('2d')!;
  for (let k = 0; k < 8; k++) {
    // Biển quay mặt vào sân nên UV bị lật ngang: vẽ từng ô lật gương để chữ đọc xuôi từ trong sân.
    const cx0 = (k % 4) * CW, oy = Math.floor(k / 4) * CH;
    g.save(); g.translate(cx0 + CW, 0); g.scale(-1, 1);
    const ox = 0;
    g.fillStyle = hx(son[700]); g.fillRect(ox, oy, CW, CH);
    g.fillStyle = hx(son[500]); g.fillRect(ox + 16, oy + 16, CW - 32, CH - 32);
    g.strokeStyle = hx(gold[500]); g.lineWidth = 8; g.strokeRect(ox + 10, oy + 10, CW - 20, CH - 20);
    g.lineWidth = 3; g.strokeRect(ox + 26, oy + 26, CW - 52, CH - 52);
    g.fillStyle = hx(gold[300]);
    g.font = '700 110px "Noto Serif", Georgia, "Times New Roman", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('KHU ' + 'ABCDEFGH'[k], ox + CW / 2, oy + CH / 2 + 6);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

const FLAG_VERT = /* glsl */ `
uniform float uTime; attribute vec3 color; varying vec3 vCol;
void main(){
  vec3 p = position;
  float ph = instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05;
  float k = clamp(p.x / 2.4, 0.0, 1.0);
  p.z += sin(uTime * 1.6 - p.x * 1.6 + ph) * 0.35 * k;
  p.y += sin(uTime * 1.1 + p.x + ph) * 0.08 * k;
  vCol = color;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}`;
const FLAG_FRAG = /* glsl */ `varying vec3 vCol;
void main(){ gl_FragColor = vec4(vCol, 1.0);
#include <colorspace_fragment>
}`;

/** Cờ ngũ sắc 2,4 × 2,1 m: lưới 10×10 ô, vòng ô đồng tâm 5 màu + diềm răng cưa; cán ở x = 0, mép trên y = 0. */
function flagGeo(): THREE.BufferGeometry {
  const R = RAMPS;
  const cols = [R.son![500], R.gold![500], R.jade![500], R.silk![500], R.indigo![500]].map((h) => new THREE.Color(h));
  const pos: number[] = [], col: number[] = [];
  const W = 2.4, H = 2.1, N = 10;
  const tri = (a: number[], b: number[], c: number[], cc: THREE.Color) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(cc.r, cc.g, cc.b); };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const ring = Math.min(4, Math.floor(Math.max(Math.abs(i - 4.5), Math.abs(j - 4.5))));
    const cc = cols[4 - ring]!;
    const x0 = (i / N) * W, x1 = ((i + 1) / N) * W, y0 = -(j / N) * H, y1 = -((j + 1) / N) * H;
    tri([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], cc); tri([x0, y0, 0], [x1, y1, 0], [x0, y1, 0], cc);
  }
  for (let i = 0; i < 8; i++) { // răng cưa dưới + ngoài
    const x0 = (i / 8) * W, x1 = ((i + 1) / 8) * W;
    tri([x0, -H, 0], [x1, -H, 0], [(x0 + x1) / 2, -H - 0.3, 0], cols[i % 2 ? 0 : 1]!);
    const y0 = -(i / 8) * H, y1 = -((i + 1) / 8) * H;
    tri([W, y0, 0], [W, y1, 0], [W + 0.3, (y0 + y1) / 2, 0], cols[i % 2 ? 0 : 1]!);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Đèn lồng nhỏ (gốc ở móc, treo xuống). */
function lanternGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI; pts.push(new THREE.Vector2(0.03 + Math.sin(a) * 0.4, -0.1 - (1 - Math.cos(a)) * 0.32)); }
  const g = new THREE.LatheGeometry(pts, 8);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  return g;
}

export function createLacquerStructure(ctx: StandsBuildContext): StructureHandle {
  const { scene, uniforms, glow } = ctx;
  const before = new Set(scene.children);
  const inner = createStadium(scene, uniforms, glow, { crowd: ctx.crowd });
  for (const o of scene.children) if (!before.has(o) && (o as THREE.Mesh).isMesh) o.visible = false; // kết cấu + trang trí kẹo

  const L = RAMPS.lacquer!, SON = RAMPS.son!, GOLD = RAMPS.gold!, AMB = RAMPS.amber!;
  const pos: number[] = [], col: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], ca: number[], cb: number[] = ca) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    col.push(...ca, ...ca, ...cb, ...ca, ...cb, ...cb);
  };
  const N = 192;
  const LR = -0.47, LY = 0.88;
  type Seg = [number, number, number, number, number, number?]; // r1,y1,r2,y2,hex,(1 = phẳng/khảm, 2 = mái: sọc ngói)
  const sweep = (segs: Seg[]) => {
    for (const [r1, y1, r2, y2, hex, f] of segs) {
      const nr = -(y2 - y1), ny = r2 - r1, len = Math.hypot(nr, ny) || 1;
      const lit = (nr / len) * LR + (ny / len) * LY > 0.28 || f === 1;
      const c1 = lit ? S(hex) : D(hex);
      const c2 = f === 2 ? D(hex) : c1;
      for (let i = 0; i < N * (f === 2 ? 2 : 1); i++) {
        const n = N * (f === 2 ? 2 : 1);
        const a = A0 + ((A1 - A0) * i) / n, b = A0 + ((A1 - A0) * (i + 1)) / n;
        const cc = f === 2 && i & 1 ? c2 : c1;
        quad(P3(r1, a, y1), P3(r1, b, y1), P3(r2, b, y2), P3(r2, a, y2), cc, cc);
      }
    }
  };
  const segs: Seg[] = [];
  STANDS_TIERS.forEach((T, ti) => {
    const rf = T.rf, y0 = T.y0;
    segs.push(
      [rf, T.yf0, rf, y0 - 0.95, L[500]], // mặt tầng gỗ sơn then
      [rf - 0.02, y0 - 0.95, rf - 0.02, y0 - 0.82, GOLD[500], 1], // chỉ vàng mảnh
      [rf, y0 - 0.82, rf, y0 - 0.5, L[300]],
      [rf, y0 - 0.5, rf - 0.4, y0 - 0.2, SON[700]], // gờ son
      [rf - 0.4, y0 - 0.2, rf - 0.3, y0 + 0.14, SON[700]],
      [rf - 0.3, y0 + 0.14, rf + 0.3, y0 + 0.14, GOLD[700], 1],
    );
    for (let s = 0; s < 4; s++) {
      const f0 = s / 4, f1 = (s + 1) / 4;
      segs.push([T.r0 + 0.3 + f0 * (T.r1 - T.r0 - 0.3), y0 + 0.14 + f0 * (T.y1 - y0 - 0.14), T.r0 + 0.3 + f1 * (T.r1 - T.r0 - 0.3), y0 + 0.14 + f1 * (T.y1 - y0 - 0.14), s % 2 ? L[700] : L[500]]);
    }
    const nx = STANDS_TIERS[ti + 1];
    if (nx) segs.push([T.r1, T.y1, nx.rf - 0.5, nx.yf0, L[700]]);
  });
  // tường sau + mái ngói cong (võng, mép vểnh) + diềm son + chỉ vàng + bờ nóc
  segs.push(
    [120, 30, 120, 33.6, L[300]],
    [126.6, 36.4, 124.2, 37.4, L[500], 2],
    [124.2, 37.4, 121.6, 36.1, L[500], 2],
    [121.6, 36.1, 119.2, 35.2, L[500], 2],
    [119.2, 35.2, 117.8, 35.3, L[300], 2],
    [117.8, 35.3, 117.3, 35.75, L[300]], // mép vểnh
    [117.3, 35.75, 117.3, 35.2, SON[700]], // diềm son
    [117.25, 35.75, 117.25, 35.62, GOLD[500], 1], // chỉ khảm vàng
    [117.5, 35.2, 120, 33.6, L[700]], // mặt dưới mái
    [124.2, 37.4, 124.2, 37.9, L[700]], // bờ nóc
    [124.15, 37.9, 124.15, 37.75, GOLD[500], 1],
    [126.6, 36.4, 126.6, 30, L[700]],
  );
  sweep(segs);
  // bịt hai đầu
  const dark = S(L[700]);
  for (const a of [A0, A1]) {
    for (const T of STANDS_TIERS) quad(P3(T.rf, a, T.yf0), P3(T.r1 + 1, a, T.yf0), P3(T.r1 + 1, a, T.y1), P3(T.rf, a, T.y0), dark);
    quad(P3(117.3, a, 30), P3(126.6, a, 30), P3(126.6, a, 37.4), P3(117.3, a, 35.7), dark);
  }
  // lối vào khu: ô tối có viền son
  const SECTIONS = 8, secA = (A1 - A0) / SECTIONS;
  const tan = (a: number) => [Math.cos(a), 0, Math.sin(a)];
  for (let k = 1; k < SECTIONS; k++) {
    const a = A0 + secA * k, t = tan(a);
    STANDS_TIERS.forEach((T, ti) => {
      const h = ti === 0 ? 3.6 : T.y0 - 1.15 - T.yf0, base = P3(T.rf - 0.07, a, 0);
      const pt = (x: number, y: number) => [base[0] + t[0] * x, y, base[2] + t[2] * x];
      quad(pt(-1.9, T.yf0), pt(1.9, T.yf0), pt(1.9, T.yf0 + h), pt(-1.9, T.yf0 + h), S(SON[700]));
      const b2 = P3(T.rf - 0.09, a, 0), p2 = (x: number, y: number) => [b2[0] + t[0] * x, y, b2[2] + t[2] * x];
      quad(p2(-1.55, T.yf0), p2(1.55, T.yf0), p2(1.55, T.yf0 + h - 0.3), p2(-1.55, T.yf0 + h - 0.3), S(L[700]));
    });
  }
  // cán cờ: bờ nóc + mép tầng 1
  const flagSpots: { x: number; y: number; z: number; ry: number }[] = [];
  const pole = (r: number, a: number, yb: number, yt: number) => {
    const t = tan(a), w = 0.09;
    const b = P3(r, a, 0);
    quad([b[0] - t[0] * w, yb, b[2] - t[2] * w], [b[0] + t[0] * w, yb, b[2] + t[2] * w], [b[0] + t[0] * w, yt, b[2] + t[2] * w], [b[0] - t[0] * w, yt, b[2] - t[2] * w], S(SON[500]));
    flagSpots.push({ x: b[0], y: yt - 0.1, z: b[2], ry: -a + Math.PI / 2 });
  };
  for (let i = 0; i <= 24; i++) pole(124.2, A0 + ((A1 - A0) * i) / 24, 37.6, 43);
  for (let i = 0; i < 16; i++) pole(STANDS_TIERS[0].rf - 0.6, A0 + ((A1 - A0) * (i + 0.5)) / 16, STANDS_TIERS[0].y0, STANDS_TIERS[0].y0 + 4.2);

  // tháp đèn lồng gỗ (ở vị trí tháp đèn pha cũ; quầng sáng của bản mặc định nằm đúng đầu tháp)
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, hex: number) => {
    const c = S(hex), cd = D(hex);
    const X0 = x - w / 2, X1 = x + w / 2, Y0 = y - h / 2, Y1 = y + h / 2, Z0 = z - d / 2, Z1 = z + d / 2;
    quad([X0, Y0, Z0], [X1, Y0, Z0], [X1, Y1, Z0], [X0, Y1, Z0], c);
    quad([X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1], cd);
    quad([X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0], cd);
    quad([X1, Y0, Z0], [X1, Y0, Z1], [X1, Y1, Z1], [X1, Y1, Z0], c);
    quad([X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1], c);
  };
  const tierRoof = (x: number, y: number, z: number, w: number) => { // mái vuông nhỏ, góc vểnh
    const h = w * 0.35, cTop = S(L[500]), cSide = D(L[500]);
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = c[i]!, [bx, bz] = c[(i + 1) % 4]!;
      pos.push(x + ax * w, y + 0.6, z + az * w, x + bx * w, y + 0.6, z + bz * w, x, y + h, z);
      for (let j = 0; j < 3; j++) col.push(...(i % 2 ? cTop : cSide));
    }
    box(x, y + 0.45, z, w * 2.02, 0.12, w * 2.02, GOLD[500]);
  };
  const lanternTops: [number, number, number][] = [];
  for (const a of [-0.62 * Math.PI, -0.3 * Math.PI, 0.3 * Math.PI, 0.62 * Math.PI]) {
    const [x, , z] = P3(130, a, 0);
    box(x, (FIELD_Y + 49) / 2, z, 1.4, 49 - FIELD_Y, 1.4, SON[700]);
    box(x, FIELD_Y + 0.6, z, 4, 1.2, 4, L[300]);
    for (const y of [16, 30, 44]) { box(x, y, z, 2.6, 1.2, 2.6, L[500]); tierRoof(x, y + 0.6, z, 3.4 - y * 0.02); }
    box(x, 49.5, z, 3.2, 1, 3.2, GOLD[700]);
    lanternTops.push([x, 55, z]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // màu đã ở không gian sRGB (hexToRgb) → chuyển tuyến tính cho MeshBasicMaterial
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col.map((v) => Math.pow(v, 2.2)), 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const struct = new THREE.Mesh(geo, mat);
  struct.renderOrder = -8;

  // cờ (instanced, vẫy trong shader)
  const fGeo = flagGeo();
  const fU = { uTime: uniforms.uTime ?? { value: 0 } };
  const fMat = new THREE.ShaderMaterial({ uniforms: fU, vertexShader: FLAG_VERT, fragmentShader: FLAG_FRAG, side: THREE.DoubleSide, fog: false });
  const flags = new THREE.InstancedMesh(fGeo, fMat, flagSpots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  flagSpots.forEach((f, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.ry); const s = f.y > 30 ? 1.3 : 0.75; flags.setMatrixAt(i, m.compose(p.set(f.x, f.y, f.z), q, sc.setScalar(s))); });
  flags.frustumCulled = false;

  // biển khu
  const tex = signAtlas();
  const sp: number[] = [], su: number[] = [];
  STANDS_TIERS.forEach((T, ti) => {
    const w = ti === 0 ? 4.4 : 3.4, h = w * 0.45, yc = ti === 0 ? 2.6 : T.yf0 + (T.y0 - 0.95 - T.yf0) / 2;
    for (let k = 0; k < SECTIONS; k++) {
      const a = A0 + secA * (k + 0.5), t = tan(a), b = P3(T.rf - 0.12, a, 0);
      const pt = (x: number, y: number) => [b[0] + t[0] * x, y, b[2] + t[2] * x];
      const u0 = (k % 4) / 4, u1 = u0 + 0.25, v1 = 1 - Math.floor(k / 4) / 2, v0 = v1 - 0.5;
      // nhìn từ trong sân (−tâm) → chữ không ngược: x âm ở trái người xem
      const A = pt(w / 2, yc - h / 2), B = pt(-w / 2, yc - h / 2), C = pt(-w / 2, yc + h / 2), Dd = pt(w / 2, yc + h / 2);
      sp.push(...A, ...B, ...C, ...A, ...C, ...Dd);
      su.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
  });
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sGeo.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
  const sMat = new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : SON[500], side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const signs = new THREE.Mesh(sGeo, sMat);

  // dây đèn lồng dọc mép các tầng (võng giữa hai cột) + 4 đèn lồng khổng lồ đầu tháp
  const lp: { x: number; y: number; z: number; s: number; c: number }[] = [];
  STANDS_TIERS.forEach((T) => {
    const r = T.rf - 0.5, n = Math.round((r * (A1 - A0)) / 2.2);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, a = A0 + (A1 - A0) * u;
      const seg = (u * 24) % 1, sag = 4 * seg * (1 - seg) * 0.9;
      const [x, , z] = P3(r, a, 0);
      lp.push({ x, y: T.y0 + 1.6 - sag, z, s: 0.75, c: i % 3 });
    }
  });
  for (const [x, y, z] of lanternTops) lp.push({ x, y: y + 4, z, s: 9, c: 0 });
  const lGeo = lanternGeo();
  const lMat = new THREE.MeshBasicMaterial({ fog: false, side: THREE.DoubleSide });
  const lan = new THREE.InstancedMesh(lGeo, lMat, lp.length);
  const lcs = [new THREE.Color(SON[300]), new THREE.Color(AMB[300]), new THREE.Color(GOLD[300])];
  lp.forEach((l, i) => { lan.setMatrixAt(i, m.compose(p.set(l.x, l.y, l.z), q.identity(), sc.setScalar(l.s))); lan.setColorAt(i, lcs[l.c]!); });
  lan.frustumCulled = false;

  const objs = [struct, flags, signs, lan];
  scene.add(...objs);
  return {
    update(f: FrameState, t: number) {
      inner.update?.(f, t);
      lMat.color.setScalar(0.9 + 0.1 * Math.sin(t * 1.3) + 0.12 * f.beatPulse * f.hype);
    },
    dispose() {
      inner.dispose();
      scene.remove(...objs);
      geo.dispose(); mat.dispose(); fGeo.dispose(); fMat.dispose(); flags.dispose();
      sGeo.dispose(); sMat.dispose(); tex?.dispose(); lGeo.dispose(); lMat.dispose(); lan.dispose();
    },
  };
}

export const builders: Partial<StandsBuilders> = { structure: createLacquerStructure };
