// "Mực & Sơn mài" — khe `stageDeco`: đình hai tầng mái đầu đao (sơn then, chỉ vàng quỳ), cột đỏ son trên chân tảng đá ở vị trí
// tháp mặc định, xà + đấu củng, cửa võng chạm vàng, bờ nóc "lưỡng long chầu nhật", đèn lồng Hội An treo mép mái (lắc chậm),
// câu đối son, cầu thang + lan can gỗ, giá cồng / trống cái thay ampli. 2 draw call (kết cấu gộp + đèn lồng instanced).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { GROUND_Y0, PIT_FENCE_Z, STAGE_Y } from '../../../../world/layout';
import { toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { DECO } from '../../stageDecoLayout';
import { setAerialHint } from '../../viewControl';
import { addGlow } from './stageBase';
import { Kit, R, V, createLanterns, hipRoof, kitMaterial } from './stageKit';

/** Kích thước mái (trong vùng ROOF của layout: |x| ≤ 20, z ∈ [-6, 4]; đỉnh ≈ như vòm mặc định). */
export const DINH = {
  cz: -1.0,
  low: { ox: 19.3, oz: 4.7, ix: 15.6, iz: 2.6, yEave: 10.4, yTop: 12.1, curl: 1.7 },
  up: { ox: 16.4, oz: 3.3, ix: 11.8, iz: 0.3, yEave: 12.7, yTop: 14.2, curl: 1.4 },
  beamY: 9.9,
};

export function createLacquerStageDeco(ctx: ArenaBuildContext) {
  const { scene, glow } = ctx;
  const P = R();
  const { TX, ZF, ZB } = DECO;
  const k = new Kit();
  const PIT_DEPTH = STAGE_Y - GROUND_Y0;
  const gold = P.gold[500], goldD = P.gold[700], son = P.son[500], sonD = P.son[700], lac = P.lac[500], lac3 = P.lac[300];

  // ── sàn cánh hai bên ──
  for (const sx of [-1, 1]) {
    k.box(7.2, 0.3, 8, sx * 16.5, -0.15, -1, P.lac[700]);
    for (const dz of [-4.95, 2.95]) k.box(7.2, 0.04, 0.1, sx * 16.5, 0.01, dz, goldD, 0, true);
    k.box(0.1, 0.04, 8, sx * 19.95, 0.01, -1, goldD, 0, true);
  }

  // ── cột son trên chân tảng ──
  const cols: [number, number][] = [];
  for (const sx of [-1, 1]) for (const z of [ZF, ZB]) cols.push([sx * TX, z]);
  for (const sx of [-1, 1]) cols.push([sx * 13.95, ZB + 0.35]);
  const BY = DINH.beamY;
  for (const [x, z] of cols) {
    const onWing = Math.abs(x) > 13.5;
    const y0 = onWing ? 0 : 0;
    k.cyl(0.62, 0.72, 0.5, x, y0 + 0.25, z, P.silk[700], 10); // chân tảng đá
    k.cyl(0.5, 0.62, 0.18, x, y0 + 0.58, z, P.silk[500], 10);
    k.cyl(0.4, 0.44, BY - y0, x, y0 + (BY - y0) / 2, z, son, 14);
    for (const y of [y0 + 0.9, BY - 0.6]) k.cyl(0.46, 0.46, 0.12, x, y, z, gold, 14, true);
    // đấu củng: 3 lớp hộp xoè ra
    for (let j = 0; j < 3; j++) k.box(0.9 + j * 0.45, 0.22, 0.9 + j * 0.45, x, BY + 0.11 + j * 0.24, z, j === 1 ? sonD : lac);
    k.box(1.85, 0.05, 1.85, x, BY + 0.72, z, gold, 0, true);
  }
  // gầm sân khấu: chân cột chìm xuống đất (cột tháp trước có hố phía dưới cánh)
  for (const sx of [-1, 1]) for (const z of [ZF, ZB]) k.cyl(0.42, 0.42, PIT_DEPTH, sx * TX, -PIT_DEPTH / 2, z, P.lac[700], 10);

  // ── xà: trước, sau, hai bên + xà ngang trong ──
  const xa = (a: THREE.Vector3, b: THREE.Vector3) => {
    k.beam(a, b, 0.45, 0.7, lac);
    k.beam(a.clone().add(V(0, -0.33, 0)), b.clone().add(V(0, -0.33, 0)), 0.5, 0.06, gold, true);
    k.beam(a.clone().add(V(0, 0.33, 0)), b.clone().add(V(0, 0.33, 0)), 0.5, 0.05, gold, true);
  };
  xa(V(-TX, BY + 0.35, ZF), V(TX, BY + 0.35, ZF));
  xa(V(-TX, BY + 0.35, ZB), V(TX, BY + 0.35, ZB));
  for (const sx of [-1, 1]) xa(V(sx * TX, BY + 0.35, ZF), V(sx * TX, BY + 0.35, ZB));
  for (const x of [-13.95, -7, 0, 7, 13.95]) k.beam(V(x, BY + 0.9, ZF), V(x, BY + 0.9, ZB), 0.35, 0.5, lac3);
  // kẻ (tay đỡ cong) từ đầu cột ra mép mái
  for (const [x, z] of cols.slice(0, 4)) {
    const ox = Math.sign(x) * (DINH.low.ox + 0.3), oz = DINH.cz + Math.sign(z - DINH.cz) * (DINH.low.oz + 0.3);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push(V(x + (ox - x) * t, BY + 0.6 + Math.sin(t * Math.PI * 0.5) * 0.9 + t * t * 0.4, z + (oz - z) * t));
    }
    k.poly(pts, 0.13, sonD, false, 6);
  }

  // ── cửa võng chạm vàng dưới xà trước (để trống giữa cho góc 'aerial') ──
  for (const sx of [-1, 1]) {
    const x0 = sx * 3.2, x1 = sx * (TX - 0.5);
    k.box(Math.abs(x1 - x0), 0.5, 0.08, (x0 + x1) / 2, BY - 0.3, ZF - 0.02, sonD);
    const n = 22;
    for (let i = 0; i < n; i++) {
      const xa0 = x0 + ((x1 - x0) * i) / n, xa1 = x0 + ((x1 - x0) * (i + 1)) / n;
      const ya = i % 2 ? BY - 0.52 : BY - 0.08, yb = i % 2 ? BY - 0.08 : BY - 0.52;
      k.rod(V(xa0, ya, ZF - 0.08), V(xa1, yb, ZF - 0.08), 0.03, gold, 4, true);
    }
    // vòm võng: tua cung đỡ hai bên khoảng giữa
    const arc: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; arc.push(V(sx * (3.2 - 1.6 * t), BY - 0.55 + 0.45 * Math.sin(t * Math.PI * 0.5), ZF - 0.06)); }
    k.poly(arc, 0.05, gold, true);
  }

  // ── mái hai tầng ──
  const lowEdges = hipRoof(k, { cx: 0, cz: DINH.cz, ...DINH.low, tile: lac, tile2: lac3 });
  const upEdges = hipRoof(k, { cx: 0, cz: DINH.cz, ...DINH.up, tile: lac, tile2: lac3, nu: 24 });
  for (const e of [...lowEdges, ...upEdges]) {
    k.poly(e.map((p) => p.clone().add(V(0, 0.04, 0))), 0.16, sonD, false); // diềm mái son
    k.poly(e.map((p) => p.clone().add(V(0, 0.2, 0))), 0.06, gold, true); // chỉ khảm vàng
  }
  // đầu đao: móc cuộn vàng ở 8 góc
  for (const [o, y] of [[DINH.low, DINH.low.yEave + DINH.low.curl + 0.25], [DINH.up, DINH.up.yEave + DINH.up.curl + 0.25]] as const) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (o.ox + 0.63), z = DINH.cz + sz * (o.oz + 0.63);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 1.3; pts.push(V(x + sx * Math.sin(a) * 0.35, y + 0.1 + (1 - Math.cos(a)) * 0.45, z + sz * Math.sin(a) * 0.25)); }
      k.poly(pts, 0.09, gold, true);
    }
  }
  // cổ diêm giữa hai tầng: dải son + ô vàng
  {
    const { ix, iz, yTop } = DINH.low, y0 = yTop - 0.05, y1 = DINH.up.yEave + 0.15, cz = DINH.cz;
    const c = [V(-ix, 0, cz - iz), V(ix, 0, cz - iz), V(ix, 0, cz + iz), V(-ix, 0, cz + iz)];
    for (let i = 0; i < 4; i++) {
      const a = c[i]!, b = c[(i + 1) % 4]!;
      k.quad(V(a.x, y0, a.z), V(b.x, y0, b.z), V(b.x, y1, b.z), V(a.x, y1, a.z), sonD);
      k.rod(V(a.x, y0 + 0.08, a.z), V(b.x, y0 + 0.08, b.z), 0.05, gold, 4, true);
      const L = a.distanceTo(b), n = Math.floor(L / 1.3);
      for (let j = 1; j < n; j++) { const p = a.clone().lerp(b, j / n); k.rod(V(p.x, y0 + 0.1, p.z), V(p.x, y1 - 0.05, p.z), 0.04, goldD, 4, true); }
    }
  }
  // bờ nóc + kìm cuộn hai đầu
  const RY = DINH.up.yTop + 0.25, RZ = DINH.cz;
  k.box(DINH.up.ix * 2 + 0.6, 0.5, 0.55, 0, RY, RZ, lac);
  k.box(DINH.up.ix * 2 + 0.6, 0.06, 0.6, 0, RY - 0.2, RZ, gold, 0, true);
  k.box(DINH.up.ix * 2 + 0.6, 0.06, 0.6, 0, RY + 0.22, RZ, gold, 0, true);
  for (const sx of [-1, 1]) {
    const x0 = sx * (DINH.up.ix + 0.3);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 1.6; pts.push(V(x0 + sx * (0.2 + Math.sin(a) * 0.45), RY + 0.2 + (1 - Math.cos(a)) * 0.5, RZ)); }
    k.poly(pts, 0.14, gold, true);
  }
  // lưỡng long chầu nhật: mặt trời / ngọc giữa + hai rồng uốn sin (nét vàng), mào son
  {
    const SY = RY + 1.15;
    k.add(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20).rotateX(Math.PI / 2), gold, k.xf(0, SY, RZ), true);
    k.sphere(0.32, 0, SY, RZ - 0.08, son, 1, 1, 0.6, true);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.add(new THREE.ConeGeometry(0.1, 0.42, 4), gold, k.xf(Math.cos(a) * 0.72, SY + Math.sin(a) * 0.72, RZ, 0, 0, a - Math.PI / 2), true);
    }
    k.rod(V(0, RY + 0.25, RZ), V(0, SY - 0.55, RZ), 0.08, gold, 6, true);
    for (const sx of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 22; i++) {
        const t = i / 22; // 0 = đầu (gần ngọc), 1 = đuôi
        pts.push(V(sx * (1.05 + t * 6.2), RY + 0.45 + 0.42 * Math.sin(t * Math.PI * 3.2) * (1 - t * 0.5) + (1 - t) * 0.5, RZ));
      }
      for (let i = 0; i + 1 < pts.length; i++) k.rod(pts[i]!, pts[i + 1]!, 0.17 * (1 - (i / pts.length) * 0.7), gold, 6, true);
      const h = pts[0]!;
      k.sphere(0.24, h.x, h.y + 0.05, RZ, gold, 1.3, 0.9, 0.9, true);
      k.add(new THREE.ConeGeometry(0.12, 0.45, 5), son, k.xf(h.x + sx * 0.1, h.y + 0.38, RZ, 0, 0, sx * 0.4), true); // mào lửa
      k.rod(V(h.x, h.y + 0.05, RZ), V(h.x - sx * 0.5, h.y + 0.25, RZ), 0.05, gold, 4, true); // môi trên vươn dài
      for (let j = 1; j < 4; j++) { const p = pts[j * 4]!; k.rod(p, p.clone().add(V(sx * 0.15, 0.45, 0)), 0.04, son, 4, true); } // vây lửa
    }
  }

  // ── câu đối son treo hai bên (thay màn LED tháp) ──
  for (const sx of [-1, 1]) {
    const x = sx * 15.6, z = ZF - 0.1, y0 = 2.4, y1 = BY - 0.2;
    k.box(1.7, y1 - y0, 0.08, x, (y0 + y1) / 2, z, son);
    k.box(1.85, 0.12, 0.12, x, y1, z - 0.02, gold, 0, true);
    k.box(1.85, 0.12, 0.12, x, y0, z - 0.02, gold, 0, true);
    for (const ex of [-0.8, 0.8]) k.box(0.05, y1 - y0, 0.1, x + ex, (y0 + y1) / 2, z - 0.03, gold, 0, true);
    for (let j = 0; j < 6; j++) { // "chữ" nét cọ vàng
      const y = y1 - 0.8 - j * 1.05;
      k.box(0.55, 0.08, 0.04, x, y, z - 0.06, gold, 0, true);
      k.box(0.08, 0.5, 0.04, x + 0.05, y - 0.15, z - 0.06, gold, 0, true);
      k.box(0.35, 0.07, 0.04, x - 0.05, y - 0.38, z - 0.06, P.gold[300], 0.3, true);
    }
    k.rod(V(x - 0.6, y1, z), V(x - 0.4, BY, z), 0.02, goldD, 4, true);
    k.rod(V(x + 0.6, y1, z), V(x + 0.4, BY, z), 0.02, goldD, 4, true);
  }

  // ── cầu thang gỗ xuống hố + tay vịn son ──
  {
    const N = Math.max(5, Math.round(PIT_DEPTH / 0.28) - 1);
    const rise = PIT_DEPTH / (N + 1), tread = 0.42, zBot = -5.4;
    const zTop = zBot + tread * (N - 1);
    for (const sx of [-1, 1]) {
      const x = sx * 13.65;
      for (let j = 0; j < N; j++) {
        const top = -rise * (j + 1);
        k.box(1.3, top + PIT_DEPTH, tread + 0.02, x, (top - PIT_DEPTH) / 2, zTop - tread * j, j & 1 ? lac3 : lac);
        k.box(1.3, 0.03, 0.05, x, top + 0.005, zTop - tread * j - tread / 2 + 0.03, goldD, 0, true);
      }
      const xr = sx * 14.3;
      k.rod(V(xr, 0.95, zTop + tread / 2), V(xr, -rise * N + 0.95, zBot - tread / 2), 0.06, son, 6);
      for (const [y, z] of [[0, zTop + tread / 2], [-rise * N, zBot - tread / 2]] as const) {
        k.rod(V(xr, y, z), V(xr, y + 0.95, z), 0.06, son, 6);
        k.sphere(0.1, xr, y + 1.0, z, gold, 1, 1, 1, true);
      }
    }
  }
  // ── lan can hố: con tiện son, tay vịn son, mũ vàng ──
  {
    const BZ = PIT_FENCE_Z, y0 = GROUND_Y0;
    for (const sx of [-1, 1]) {
      for (let x = 1.9; x <= 13.65; x += 0.9) {
        k.cyl(0.06, 0.08, 1.0, sx * x, y0 + 0.5, BZ, son, 8);
        k.sphere(0.09, sx * x, y0 + 1.08, BZ, gold, 1, 1, 1, true);
      }
      k.beam(V(sx * 1.85, y0 + 1.0, BZ), V(sx * 13.7, y0 + 1.0, BZ), 0.12, 0.1, sonD);
      k.beam(V(sx * 1.85, y0 + 1.07, BZ), V(sx * 13.7, y0 + 1.07, BZ), 0.13, 0.03, gold, true);
      k.beam(V(sx * 1.85, y0 + 0.3, BZ), V(sx * 13.7, y0 + 0.3, BZ), 0.08, 0.08, sonD);
      k.beam(V(sx * 13.6, y0 + 1.0, BZ), V(sx * 13.6, y0 + 1.0, BZ + 1.2), 0.12, 0.1, sonD);
    }
  }

  // ── đạo cụ ở vị trí cũ ──
  // bục trống (trái) + trống cái sơn son trên giá
  k.box(3.6, 0.45, 2.8, -6.5, 0.225, 1.5, lac);
  k.box(3.64, 0.05, 2.84, -6.5, 0.45, 1.5, gold, 0, true);
  k.add(new THREE.CylinderGeometry(0.6, 0.6, 0.75, 18).rotateZ(Math.PI / 2), son, k.xf(-7.6, 1.45, 2.3));
  k.add(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 18).rotateZ(Math.PI / 2), gold, k.xf(-7.6 + 0.38, 1.45, 2.3), true);
  k.add(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 18).rotateZ(Math.PI / 2), gold, k.xf(-7.6 - 0.38, 1.45, 2.3), true);
  for (const dz of [-0.5, 0.5]) { k.rod(V(-7.6, 0.45, 2.3 + dz), V(-7.6, 0.95, 2.3 + dz * 0.4), 0.05, lac3, 5); }
  // bục đàn (phải) + bàn đàn tranh sơn then
  k.box(3.2, 0.3, 2.2, 6.5, 0.15, 1.5, lac);
  k.box(3.24, 0.05, 2.24, 6.5, 0.3, 1.5, gold, 0, true);
  // giá cồng chiêng thay dàn ampli
  for (const sx of [-1, 1]) {
    const cx = sx * 10.05, z = 2.3;
    for (const dx of [-0.9, 0.9]) { k.rod(V(cx + dx, 0, z), V(cx + dx, 2.5, z), 0.07, son, 6); k.sphere(0.1, cx + dx, 2.55, z, gold, 1, 1, 1, true); }
    k.beam(V(cx - 1.05, 2.35, z), V(cx + 1.05, 2.35, z), 0.12, 0.14, lac);
    k.add(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 20).rotateX(Math.PI / 2), goldD, k.xf(cx, 1.45, z));
    k.add(new THREE.SphereGeometry(0.16, 10, 6), P.gold[300], k.xf(cx, 1.45, z - 0.05, 0, 0, 0, 1, 1, 0.6), true);
    k.rod(V(cx - 0.3, 2.3, z), V(cx - 0.2, 2.06, z), 0.015, gold, 3, true);
    k.rod(V(cx + 0.3, 2.3, z), V(cx + 0.2, 2.06, z), 0.015, gold, 3, true);
  }
  // mic: thanh vàng mảnh, đầu son
  for (const [x, z] of [[-2.8, -1.8], [2.8, -1.8], [-6, -2.9], [6, -2.9]] as [number, number][]) {
    k.cyl(0.18, 0.2, 0.04, x, 0.02, z, lac3, 10);
    k.rod(V(x, 0.02, z), V(x, 1.5, z), 0.018, gold, 5, true);
    k.rod(V(x, 1.5, z), V(x, 1.58, z + 0.4), 0.016, gold, 4, true);
    k.rod(V(x, 1.58, z + 0.36), V(x, 1.6, z + 0.5), 0.045, son, 6);
  }
  // hộp gỗ thấp ở dải loa sub (giữ vùng), mặt có vòng sen vàng
  for (const sx of [-1, 1]) for (let j = 0; j < 7; j++) {
    const x = sx * (3.2 + 1.25 * j);
    k.box(1.15, 0.4, 0.8, x, 0.2, -4.3, lac3);
    k.add(new THREE.TorusGeometry(0.13, 0.025, 4, 14), gold, k.xf(x, 0.2, -4.71), true);
  }

  const geo = k.build();
  const mat = kitMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // ── đèn lồng treo mép mái ──
  const lp: { x: number; y: number; z: number; s: number }[] = [];
  const lo = DINH.low;
  const eaveY = (u: number) => lo.yEave + lo.curl * Math.pow(Math.abs(u), 5) + 0.25 * u * u;
  for (let x = -17; x <= 17.01; x += 3.4) {
    if (Math.abs(x) < 3) continue; // giữ trống giữa cho góc 'aerial'
    const u = x / lo.ox;
    lp.push({ x, y: eaveY(u) - 0.25, z: DINH.cz - lo.oz + 0.15, s: 1.15 });
    lp.push({ x, y: eaveY(u) - 0.25, z: DINH.cz + lo.oz - 0.15, s: 0.9 });
  }
  for (const sx of [-1, 1]) for (const z of [-3.2, 1.2]) lp.push({ x: sx * (lo.ox - 0.15), y: eaveY(z / lo.oz) - 0.3, z, s: 1.0 });
  // đèn treo dưới xà trong (thấp, ấm)
  for (const x of [-7, 7]) for (const z of [-3.5, 0.8]) lp.push({ x, y: BY + 0.6, z, s: 0.75 });
  const lan = createLanterns(scene, lp, P.son[300], P.gold[500]);
  const lc = toColor(P.amber[300]);
  for (const l of lp) addGlow(glow, l.x, l.y - 0.45 * l.s, l.z, lc, 0.7, 2.6 * l.s);

  // Mái đình đặc (ngói) che nửa trên góc 'aerial' mặc định → lùi xa + hạ thấp, nhìn z ≈ -8: mái chỉ còn là khung trên.
  setAerialHint({ targetZ: -8, height: 17, back: 30 });

  return {
    update(f: FrameState, t: number) {
      lan.update(t, 1.0 + 0.12 * f.beatPulse * f.hype);
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose(); mat.dispose(); lan.dispose();
      setAerialHint(null);
    },
  };
}

export const builders: Partial<ArenaBuilders> = { stageDeco: createLacquerStageDeco };
