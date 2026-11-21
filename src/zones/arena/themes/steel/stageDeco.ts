// "Thép & Lửa" — khe `stageDeco`: "nhà thờ" giàn hộp thép: 6 tháp vuông giằng chữ X, mái đầu hồi bằng giàn (kèo, xà nóc, xà gồ),
// giàn đầu trước mang hàng blinder, palăng xích + bó cáp, thanh đèn; line-array treo; HAI TƯỜNG LOA 2 × 9 tủ đen mặt nón loa
// cạnh sân khấu + sub dọc mép trước; chồng ampli + bộ trống đủ + đàn phím (giữ đúng vị trí neo nhạc cụ / mic của bản mặc định);
// thanh LED lửa dọc + băng rôn thép sao stencil thay màn LED tháp; cầu thang lưới thép + tay vịn ống; rào chắn thép hố.
// 1 draw call (kết cấu đẽo phẳng gộp, atlas). Mái là giàn hở → không cần gợi ý góc 'aerial' riêng.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { GROUND_Y0, PIT_FENCE_Z, STAGE_Y } from '../../../../world/layout';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { DECO } from '../../stageDecoLayout';
import { CELL, R, SKit, V, facetMaterial, resetJitter } from './stageKit';

/** Hình mái đầu hồi (mặt hồi quay về khán giả): mép x = ±TX ở EAVE, nóc x = 0 ở RIDGE. */
export const GABLE = { EAVE: 11.6, RIDGE: 15.0, HEADER_Y: 9.9, HEADER_Z: -4.6 };
export const gableY = (x: number) => GABLE.EAVE + (GABLE.RIDGE - GABLE.EAVE) * (1 - Math.abs(x) / DECO.TX);

export function createSteelStageDeco(ctx: ArenaBuildContext) {
  const { scene } = ctx;
  const P = R();
  resetJitter(23);
  const { TX, ZF, ZB } = DECO;
  const k = new SKit();
  const st = P.steel[500], stD = P.steel[700], stL = P.steel[300], coal = P.coal[300], coalD = P.coal[500];
  const PIT_DEPTH = STAGE_Y - GROUND_Y0;
  const { EAVE, RIDGE, HEADER_Y, HEADER_Z } = GABLE;

  // ── sàn cánh hai bên (tấm thép đen + mép lưới) ──
  for (const sx of [-1, 1]) {
    k.box(7.2, 0.3, 8, sx * 16.5, -0.15, -1, coal);
    k.floor(7.0, 0.5, sx * 16.5, 0.01, -4.8, 0xffffff, CELL.hazard);
  }

  // ── 6 tháp giàn hộp vuông (1,2 m) giằng chữ X, chân đế thép ──
  const ZM = (ZF + ZB) / 2;
  for (const sx of [-1, 1]) for (const z of [ZF, ZM, ZB]) {
    const x = sx * TX;
    k.truss(V(x, GROUND_Y0, z), V(x, EAVE + 0.6, z), 1.2, st, stD, 1.3, 0.09, 0.045);
    k.cbox(2.0, 0.3, 2.0, x, GROUND_Y0 + 0.15, z, coalD);
    k.box(1.5, 0.35, 1.5, x, EAVE + 0.75, z, stD); // đầu tháp (sleeve block)
  }
  // giàn ngang nối tháp ở đỉnh hai bên (dọc z)
  for (const sx of [-1, 1]) k.truss(V(sx * TX, EAVE + 0.3, ZF), V(sx * TX, EAVE + 0.3, ZB), 0.8, st, stD, 1.4, 0.07);

  // ── mái đầu hồi: kèo giàn ở z = ZF, ZM, ZB; xà nóc + xà gồ dọc z ──
  for (const z of [ZF, ZM, ZB]) {
    for (const sx of [-1, 1]) k.truss(V(sx * TX, EAVE + 0.4, z), V(0, RIDGE, z), 0.9, st, stD, 1.5, 0.08, 0.04);
    if (z === ZF) { // mặt hồi trước: thanh căng dưới + giằng thẳng đứng (đọc rõ hình tam giác)
      k.beam(V(-TX, EAVE + 0.4, z), V(TX, EAVE + 0.4, z), 0.12, 0.12, stD);
      for (const x of [-12.6, -6.3, 0, 6.3, 12.6]) k.beam(V(x, EAVE + 0.4, z), V(x, gableY(x), z), 0.08, 0.08, stD);
      for (const [a, b] of [[-12.6, -6.3], [-6.3, 0], [0, 6.3], [6.3, 12.6]] as const) {
        k.beam(V(a, EAVE + 0.4, z), V(b, gableY(b), z), 0.06, 0.06, stD);
      }
    }
  }
  k.truss(V(0, RIDGE, ZF), V(0, RIDGE, ZB), 0.8, stL, stD, 1.4, 0.08);
  for (const x of [-12.6, -6.3, 6.3, 12.6]) k.beam(V(x, gableY(x) + 0.2, ZF), V(x, gableY(x) + 0.2, ZB), 0.16, 0.24, st);
  // tấm thép hồi nhỏ trên đỉnh: sao đinh tán + tia sét
  k.cbox(2.2, 1.4, 0.12, 0, RIDGE - 1.2, ZF - 0.55, stD);
  k.star(0.55, 0, RIDGE - 1.2, ZF - 0.62, P.paper[500], 0);

  // ── giàn đầu trước (header) mang blinder + 3 thanh đèn ──
  k.truss(V(-TX + 0.6, HEADER_Y, HEADER_Z), V(TX - 0.6, HEADER_Y, HEADER_Z), 0.9, stL, stD, 1.2, 0.08, 0.04);
  for (const z of [-2.2, 0.4]) k.truss(V(-15.5, HEADER_Y, z), V(15.5, HEADER_Y, z), 0.5, st, stD, 1.6, 0.06, 0.03);
  // hộp blinder 2×2 bóng gắn dưới header (đèn sáng do khe `lights` vẽ)
  for (let i = 0; i < 12; i++) {
    const x = (i - 5.5) * 2.6;
    k.cbox(0.9, 0.6, 0.35, x, HEADER_Y - 0.75, HEADER_Z - 0.2, coalD);
    k.beam(V(x, HEADER_Y - 0.45, HEADER_Z - 0.2), V(x, HEADER_Y - 0.1, HEADER_Z), 0.05, 0.05, stD);
  }
  // palăng xích: hộp + xích từ kèo xuống header / thanh đèn
  for (const x of [-15, -9, -3, 3, 9, 15]) for (const z of [HEADER_Z, -2.2, 0.4]) {
    const top = gableY(x) - 0.3;
    k.cbox(0.3, 0.42, 0.26, x, top - 0.9, z, P.coal[100]);
    k.beam(V(x, top, z), V(x, top - 0.7, z), 0.03, 0.03, stL);
    k.beam(V(x, top - 1.1, z), V(x, HEADER_Y + 0.45, z), 0.03, 0.03, stL);
    k.beam(V(x + 0.1, top - 1.0, z), V(x + 0.18, top - 2.2, z), 0.05, 0.05, P.blood[700]); // đuôi xích đỏ
  }
  // bó cáp rủ dọc header
  for (let i = 0; i < 10; i++) {
    const x0 = -16 + i * 3.4, x1 = x0 + 3.4;
    const mid = V((x0 + x1) / 2, HEADER_Y - 0.55 - 0.1 * (i % 2), HEADER_Z + 0.3);
    k.pipe(V(x0, HEADER_Y - 0.35, HEADER_Z + 0.3), mid, 0.06, coalD, 5);
    k.pipe(mid, V(x1, HEADER_Y - 0.35, HEADER_Z + 0.3), 0.06, coalD, 5);
  }

  // ── line-array treo (8 hộp, cong dần) ──
  for (const sx of [-1, 1]) {
    const hx = sx * 12.4, hz = -4.3;
    k.beam(V(hx, gableY(hx) - 0.2, hz), V(hx, 11.15, hz), 0.05, 0.05, stL);
    k.cbox(1.8, 0.18, 1.1, hx, 11.05, hz, stD);
    for (let i = 0; i < 8; i++) {
      const y = 10.55 - i * 0.62, rx = -0.035 * i * i * 0.5;
      const m = new THREE.Matrix4().compose(V(hx, y, hz - 0.012 * i * i), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), V(1, 1, 1));
      k.add(trapezoid(1.6, 0.58, 0.95), coal, m);
      const fm = new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, -0.48));
      k.add(new THREE.PlaneGeometry(1.5, 0.5), 0xffffff, fm, 2, CELL.grille, 0.02);
    }
  }

  // ── TƯỜNG LOA 2 × 9 mỗi bên + thanh LED lửa + băng rôn sao ──
  const CW = 1.15, CH = 0.82, CD = 0.8;
  for (const sx of [-1, 1]) {
    const cx = sx * 15.25, z = -3.9;
    k.box(2 * CW + 0.2, 0.2, CD + 0.2, cx, 0.1, z, stD); // bệ
    for (let c = 0; c < 2; c++) for (let r = 0; r < 9; r++) {
      const x = cx + (c - 0.5) * CW, y = 0.2 + CH / 2 + r * CH;
      k.cbox(CW - 0.04, CH - 0.04, CD, x, y, z, r % 3 === 2 ? P.coal[100] : coal, 0, 0.03);
      k.decal(CW - 0.14, CH - 0.14, x, y, z - CD / 2 - 0.006, 0xffffff, CELL.cone);
    }
    for (const r of [3, 6, 9]) k.box(2 * CW + 0.08, 0.05, CD + 0.06, cx, 0.2 + r * CH, z, stL); // nẹp thép
    // thanh LED lửa dọc
    const lx = sx * 17.25;
    k.box(0.5, 7.6, 0.3, lx, 4.2, -4.2, coalD);
    for (let i = 0; i < 18; i++) k.decal(0.34, 0.34, lx, 0.65 + i * 0.42, -4.36, i % 3 === 0 ? P.white[300] : P.flame[500], -1, 0, 1);
    // băng rôn thép sao stencil trên tháp trước (mặt ngoài)
    k.decal(1.6, 2.6, sx * TX, 7.2, ZF - 0.62, P.steel[300], CELL.star);
    k.decal(1.6, 2.0, sx * TX, 4.6, ZF - 0.62, P.steel[300], CELL.bolt);
  }
  // sub stack dọc mép trước (giữ dải mặc định)
  for (const sx of [-1, 1]) for (let j = 0; j < 7; j++) {
    const x = sx * (3.2 + 1.25 * j);
    k.cbox(1.15, 0.45, 0.8, x, 0.225, -4.3, coal);
    k.decal(1.02, 0.36, x, 0.225, -4.705, 0xffffff, CELL.cone);
  }

  // ── bục trống (trái) + bộ trống đủ ──
  k.cbox(3.6, 0.45, 2.8, -6.5, 0.225, 1.5, coalD);
  k.decal(3.4, 0.36, -6.5, 0.225, 0.095, 0xffffff, CELL.hazard);
  const drum = (r: number, d: number, x: number, y: number, z: number, rx: number, shell: number) => {
    k.add(new THREE.CylinderGeometry(r, r, d, 10), shell, k.xf(x, y, z, rx));
    k.add(new THREE.CylinderGeometry(r * 0.96, r * 0.96, d + 0.02, 10), P.paper[700], k.xf(x, y, z, rx, 0, 0, 1, 1, 1), 0, -1, 0.02);
  };
  drum(0.42, 0.5, -6.5, 0.87, 0.3, Math.PI / 2, P.blood[500]); // trống bass
  k.star(0.2, -6.5, 0.87, 0.03, P.paper[500], 0);
  for (const dx of [-0.4, 0.4]) drum(0.22, 0.22, -6.5 + dx, 1.5, 0.35, 0.3, P.blood[500]);
  drum(0.26, 0.14, -6.84, 1.0, 0.85, 0, P.steel[300]); // snare
  drum(0.3, 0.4, -5.6, 0.7, 0.9, 0, P.blood[500]); // floor tom
  k.pipe(V(-6.84, 0.45, 0.85), V(-6.84, 0.93, 0.85), 0.03, stL, 6);
  k.add(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 8), P.white[700], k.xf(-6.0, 1.12, 0.85)); // hi-hat
  k.pipe(V(-6.0, 0.45, 0.85), V(-6.0, 1.1, 0.85), 0.025, stL, 6);
  for (const [x, y, z] of [[-7.8, 2.0, 0.5], [-5.3, 2.0, 0.55], [-5.7, 1.85, 1.0]] as [number, number, number][]) {
    k.add(new THREE.CylinderGeometry(0.38, 0.38, 0.025, 8), P.white[700], k.xf(x, y, z, 0.2));
    k.pipe(V(x, 0.45, z), V(x, y, z), 0.025, stL, 6);
  }
  k.cbox(0.5, 0.5, 0.5, -6.5, 0.7, 2.2, P.coal[100]); // ghế trống
  // ── bục phím (phải) ──
  k.cbox(3.2, 0.3, 2.2, 6.5, 0.15, 1.5, coalD);
  k.decal(3.0, 0.24, 6.5, 0.15, 0.395, 0xffffff, CELL.hazard);
  k.box(1.9, 0.1, 0.5, 6.5, 1.2, 1.2, coal);
  k.box(1.9, 0.04, 0.28, 6.5, 1.26, 1.31, P.paper[700]);
  k.box(1.6, 0.1, 0.5, 6.5, 1.5, 0.78, P.blood[500]);
  for (const dx of [-0.8, 0.8]) { k.beam(V(6.5 + dx, 0.3, 1.2), V(6.5 + dx, 1.2, 1.2), 0.06, 0.06, stL); k.beam(V(6.5 + dx, 0.3, 0.78), V(6.5 + dx, 1.5, 0.78), 0.06, 0.06, stL); }
  // ── chồng ampli (2 tủ + đầu ampli) ──
  for (const x of [-10.8, -9.3, 9.3, 10.8]) {
    for (const y of [0.475, 1.425]) {
      k.cbox(1.1, 0.95, 0.6, x, y, 2.3, coal, 0, 0.03);
      k.decal(0.96, 0.82, x, y, 1.995, 0xffffff, CELL.cone);
    }
    k.cbox(1.0, 0.3, 0.5, x, 2.05, 2.3, P.coal[100]);
    k.decal(0.9, 0.12, x, 2.05, 2.045, P.tung[700], -1, 0, 1);
  }
  // ── mic stand (đế tam giác, cần thép, đầu mic chrome) ──
  for (const [x, z] of [[-2.8, -1.8], [2.8, -1.8], [-6, -2.9], [6, -2.9]] as [number, number][]) {
    k.add(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 3), coalD, k.xf(x, 0.02, z));
    k.pipe(V(x, 0.02, z), V(x, 1.5, z), 0.02, stL, 5);
    k.pipe(V(x, 1.5, z), V(x, 1.6, z + 0.35), 0.018, stL, 5);
    k.add(new THREE.CylinderGeometry(0.045, 0.03, 0.16, 6), P.steel[100], k.xf(x, 1.6, z + 0.42, Math.PI / 2));
  }

  // ── cầu thang lưới thép + tay vịn ống ──
  {
    const N = Math.max(5, Math.round(PIT_DEPTH / 0.28) - 1);
    const rise = PIT_DEPTH / (N + 1), tread = 0.42, zBot = -5.4;
    const zTop = zBot + tread * (N - 1);
    for (const sx of [-1, 1]) {
      const x = sx * 13.65;
      for (let j = 0; j < N; j++) {
        const top = -rise * (j + 1), zz = zTop - tread * j;
        k.floor(1.3, tread, x, top + 0.005, zz, P.steel[300], CELL.grating);
        k.box(1.3, 0.05, 0.05, x, top - 0.02, zz - tread / 2, P.flame[500]); // mũi bậc cảnh báo
      }
      for (const ex of [-0.68, 0.68]) k.beam(V(x + ex, -rise, zTop + tread / 2), V(x + ex, -PIT_DEPTH, zBot - tread / 2 - 0.2), 0.08, 0.22, stD); // dầm cốn
      const xr = sx * 14.3;
      k.pipe(V(xr, 0.95, zTop + tread / 2), V(xr, -rise * N + 0.95, zBot - tread / 2), 0.035, P.steel[100], 6);
      for (let j = 0; j <= N; j += 3) {
        const zz = zTop + tread / 2 - tread * j, y = -rise * j;
        k.pipe(V(xr, y, zz), V(xr, y + 0.95, zz), 0.03, stL, 6);
      }
    }
  }
  // ── rào chắn hố: khung barricade thép (đế chân + thanh đứng) ──
  {
    const BZ = PIT_FENCE_Z, y0 = GROUND_Y0;
    for (const sx of [-1, 1]) {
      for (let x = 1.9; x + 1.15 <= 13.7; x += 1.2) {
        const a = sx * x, b = sx * (x + 1.15);
        k.beam(V(a, y0 + 1.1, BZ), V(b, y0 + 1.1, BZ), 0.06, 0.06, stL);
        k.beam(V(a, y0 + 0.12, BZ), V(b, y0 + 0.12, BZ), 0.05, 0.05, stL);
        k.beam(V(a, y0, BZ), V(a, y0 + 1.1, BZ), 0.06, 0.06, st);
        for (let i = 1; i < 8; i++) { const xx = a + ((b - a) * i) / 8; k.beam(V(xx, y0 + 0.12, BZ), V(xx, y0 + 1.1, BZ), 0.025, 0.025, st); }
        k.add(new THREE.BoxGeometry(1.15, 0.04, 0.9), stD, k.xf((a + b) / 2, y0 + 0.02, BZ - 0.4)); // tấm đế (phía khán giả)
        k.beam(V(a, y0 + 1.1, BZ), V(a, y0 + 0.02, BZ - 0.75), 0.04, 0.04, st);
      }
      k.decal(11.6, 0.18, sx * 7.75, y0 + 0.95, BZ - 0.035, 0xffffff, CELL.hazard);
    }
  }

  const geo = k.build();
  const fm = facetMaterial(ctx.uniforms, { atlas: true });
  const mesh = new THREE.Mesh(geo, fm.mat);
  scene.add(mesh);
  let fire = 0;
  return {
    update(f: FrameState, _t: number) {
      // rim lửa giật nhẹ theo phách mạnh khi Hype cao (khung thép "hắt lửa")
      const tgt = f.hype > 0.6 ? f.beatPulse * (f.hype - 0.6) * 2.5 : 0;
      fire += (tgt - fire) * Math.min(1, f.dt * 8);
      fm.mat.uniforms.uFire!.value = fire;
    },
    dispose() { scene.remove(mesh); geo.dispose(); fm.dispose(); },
  };
}

/** Hộp line-array hình thang (mặt trước rộng hơn sau). */
function trapezoid(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) p.setX(i, p.getX(i) * 0.72);
  return g;
}

export const builders: Partial<ArenaBuilders> = { stageDeco: createSteelStageDeco };
