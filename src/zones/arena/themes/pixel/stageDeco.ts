// "Đêm Sao Điểm Ảnh" — khe `stageDeco`: sân khấu là MỘT KHUNG TRANH MẠ VÀNG khổng lồ (cột ±16,6 m, xà trên 11,8–13,1 m,
// cạnh dưới = mép sân khấu của khe stageBase): bản khung crôm-700, băng hạt vàng 4 px, gờ trong crôm-300, khối góc HOA THỊ,
// huy hiệu sao trên đỉnh; phông lam Phổ tối sau tường LED; thanh treo đèn dưới xà; hai GIÁ VẼ cạnh khung mang tranh nhỏ
// "Hướng dương" (trái) và "Sóng lừng" (phải) có nhãn bảo tàng. Bộ trống / keyboard / chân mic + bục của chúng do khe `band` (pixel/band.ts) vẽ;
// ở đây chỉ còn ampli = thùng gỗ. Cầu thang gỗ, rào hố = cột đồng
// + dây nhung tím kiểu phòng tranh. Xà trên + huy hiệu cắt ngang góc 'aerial' mặc định → setAerialHint hạ/lùi camera. 2 draw call (khối gộp + viền mực).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { GROUND_Y0, PIT_FENCE_Z, STAGE_Y } from '../../../../world/layout';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { setAerialHint } from '../../viewControl';
import { CELL, PKit, R, V, inkOutline, makeAtlas, pixelMaterial } from './stageKit';

/** Khung tranh lớn: tâm cột x = ±PX, bản T, mặt trước z = FZ, ô trong cao tới TOP, thanh treo đèn ở (RAIL_Y, RAIL_Z). */
export const BIG_FRAME = { PX: 16.6, T: 1.3, FZ: -5.5, D: 0.5, BOT: -0.6, TOP: 11.8, RAIL_Y: 10.9, RAIL_Z: -4.6 };

export function createPixelStageDeco(ctx: ArenaBuildContext) {
  const { scene } = ctx;
  const P = R();
  const k = new PKit();
  const PIT_DEPTH = STAGE_Y - GROUND_Y0;
  const wood = P.dat[500], woodD = P.dat[700], woodL = P.dat[300];

  // ── sàn cánh hai bên (ván) ──
  for (const sx of [-1, 1]) {
    k.box(7.2, 0.3, 8, sx * 16.5, -0.15, -1, woodD);
    for (let x = 13.9; x < 20.1; x += 2) for (let z = -4; z <= 2; z += 2) k.floor(2, 2, sx * (x + 0.1), 0.006, z, CELL.plank);
  }

  // ── khung tranh lớn ──
  const { PX, T, FZ, D, BOT, TOP } = BIG_FRAME;
  const w = PX * 2 - T, h = TOP - BOT;
  k.frame(w, h, T, D, 0, (TOP + BOT) / 2, FZ, P, { seg: 1.0, skipBottom: true, back: true });
  for (const sx of [-1, 1]) { // khối góc dưới (đứng trên sàn cánh)
    const cs = T * 1.25;
    k.box(cs, cs, D * 1.15, sx * PX, BOT + 0.05, FZ + D / 2 - D * 0.1, P.crom[700]);
    k.decal(cs * 0.92, cs * 0.92, sx * PX, BOT + 0.05, FZ - D * 0.15 - 0.02, CELL.rosette);
    k.box(T, 3.6, 2.2, sx * PX, -2.2, FZ + 1.2, woodD); // chân đỡ khung dưới sàn cánh
  }
  // huy hiệu (cartouche) trên đỉnh: khối vàng + sao + hai cuộn
  const yC = TOP + T + 0.55;
  k.box(3.4, 1.1, 0.42, 0, yC, FZ + 0.21, P.crom[700]);
  k.box(3.0, 0.8, 0.1, 0, yC, FZ - 0.02, P.crom[500]);
  k.decal(1.0, 0.8, 0, yC, FZ - 0.08, CELL.star);
  for (const sx of [-1, 1]) {
    k.cyl(0.32, 0.32, 0.42, sx * 1.9, yC - 0.2, FZ + 0.21, P.crom[500], 8, Math.PI / 2);
    k.decal(0.9, 0.5, sx * 1.05, yC, FZ - 0.08, CELL.bead);
  }
  // phông lam Phổ tối sau tường LED (lấp khoảng giữa toan và khung)
  k.box(PX * 2 + 1, TOP + 1.4, 0.12, 0, (TOP + 1.4) / 2 - 0.1, 5.2, P.pho[700]);
  for (const sx of [-1, 1]) k.box(0.12, TOP + 1.4, 10.6, sx * (PX + 0.4), (TOP + 1.4) / 2 - 0.1, 0.0, P.pho[700]);
  // thanh treo đèn dưới xà trên (đèn do khe `lights` vẽ) + thanh treo
  const { RAIL_Y, RAIL_Z } = BIG_FRAME;
  k.beam(V(-PX + 0.7, RAIL_Y, RAIL_Z), V(PX - 0.7, RAIL_Y, RAIL_Z), 0.22, 0.22, P.tim[700]);
  for (const x of [-12, -4, 4, 12]) k.beam(V(x, RAIL_Y, RAIL_Z), V(x, TOP + 0.1, RAIL_Z), 0.06, 0.06, P.may[500]);
  for (const z of [-1.8, 1.0]) {
    k.beam(V(-PX + 0.7, RAIL_Y + 0.3, z), V(PX - 0.7, RAIL_Y + 0.3, z), 0.18, 0.18, P.tim[700]);
    for (const sx of [-1, 1]) k.beam(V(sx * (PX - 0.7), RAIL_Y + 0.3, z), V(sx * (PX + 0.4), RAIL_Y + 0.3, z), 0.18, 0.18, P.tim[700]);
  }

  // ── hai giá vẽ cạnh khung + tranh nhỏ + nhãn bảo tàng ──
  for (const sx of [-1, 1]) {
    const x = sx * 19.0, z = -4.0, cw = 2.2, ch = 2.6, cy = 3.6;
    // chân giá: 2 chân trước nghiêng + chân sau + thanh đỡ tranh
    for (const dx of [-0.75, 0.75]) k.beam(V(x + dx * 1.2, 0, z - 0.3), V(x + dx * 0.25, cy + ch / 2 + 0.9, z + 0.25), 0.12, 0.12, wood);
    k.beam(V(x, cy + ch / 2 + 0.6, z + 0.3), V(x, 0, z + 1.6), 0.12, 0.12, woodD);
    k.box(cw + 0.6, 0.12, 0.4, x, cy - ch / 2 - 0.36, z - 0.05, woodL);
    k.box(0.5, 0.18, 0.2, x, cy + ch / 2 + 0.3, z + 0.12, woodL);
    // tranh: toan + khung vàng nhỏ
    k.decal(cw, ch, x, cy, z - 0.02, sx < 0 ? CELL.paintSun : CELL.paintWave, 0, 3);
    k.box(cw, ch, 0.06, x, cy, z + 0.02, P.crom[100]);
    k.frame(cw, ch, 0.24, 0.14, x, cy, z - 0.07, P, { seg: 0.3 });
    // nhãn bảo tàng trên thanh đỡ
    k.decal(0.9, 0.42, x, cy - ch / 2 - 0.62, z - 0.27, CELL.plaque, 0, 3);
  }

  // (bục trống + trống thùng sơn, bục + keyboard trên giá vẽ, bục + chân mic bè phụ: do khe `band` của pixel vẽ)
  // ── ampli = thùng gỗ (2 tầng) + nắp thiếc ──
  for (const x of [-10.8, -9.3, 9.3, 10.8]) {
    for (const y of [0.475, 1.425]) {
      k.box(1.1, 0.95, 0.6, x, y, 2.3, woodD);
      k.decal(1.0, 0.86, x, y, 1.995, CELL.crate);
    }
    k.box(1.0, 0.3, 0.5, x, 2.05, 2.3, P.may[500]);
    k.box(0.9, 0.08, 0.02, x, 2.05, 2.045, P.crom[300], 0, 1);
  }

  // ── cầu thang gỗ xuống hố (vị trí như mặc định) + tay vịn vàng ──
  {
    const N = Math.max(5, Math.round(PIT_DEPTH / 0.28) - 1);
    const rise = PIT_DEPTH / (N + 1), tread = 0.42, zBot = -5.4;
    const zTop = zBot + tread * (N - 1);
    for (const sx of [-1, 1]) {
      const x = sx * 13.65;
      for (let j = 0; j < N; j++) {
        const top = -rise * (j + 1);
        k.box(1.3, top + PIT_DEPTH, tread + 0.02, x, (top - PIT_DEPTH) / 2, zTop - tread * j, j & 1 ? woodD : wood);
        k.box(1.3, 0.04, 0.06, x, top + 0.01, zTop - tread * j - tread / 2, P.crom[700]);
      }
      const xr = sx * 14.3;
      k.beam(V(xr, 0.95, zTop + tread / 2), V(xr, -rise * N + 0.95, zBot - tread / 2), 0.08, 0.08, P.crom[500]);
      for (let j = 0; j <= N; j += 3) {
        const zz = zTop + tread / 2 - tread * j, y = -rise * j;
        k.box(0.08, 0.95, 0.08, xr, y + 0.475, zz, woodD);
      }
    }
  }
  // ── rào hố: cột đồng + dây nhung tím võng (kiểu phòng tranh) ──
  {
    const BZ = PIT_FENCE_Z, y0 = GROUND_Y0;
    for (const sx of [-1, 1]) {
      const xs: number[] = [];
      for (let x = 1.9; x <= 13.65; x += 1.2) xs.push(x);
      for (const x of xs) {
        k.cyl(0.22, 0.26, 0.08, sx * x, y0 + 0.04, BZ, P.crom[700], 8);
        k.cyl(0.05, 0.05, 1.05, sx * x, y0 + 0.6, BZ, P.crom[500], 6);
        k.cyl(0.1, 0.07, 0.14, sx * x, y0 + 1.16, BZ, P.crom[300], 6);
      }
      for (let i = 0; i + 1 < xs.length; i++) {
        const a = V(sx * xs[i]!, y0 + 1.02, BZ), b = V(sx * xs[i + 1]!, y0 + 1.02, BZ);
        const m = a.clone().lerp(b, 0.5); m.y -= 0.22;
        k.beam(a, m, 0.07, 0.07, P.tim[500]);
        k.beam(m, b, 0.07, 0.07, P.tim[500]);
      }
    }
  }

  const atlas = makeAtlas();
  const geo = k.build();
  const pm = pixelMaterial({ atlas });
  const mesh = new THREE.Mesh(geo, pm.mat);
  const ink = inkOutline(geo);
  scene.add(mesh, ink.mesh);
  // xà trên khung (y ≈ 12–14, z −5,5) cắt ngang sân khấu ở góc 'aerial' mặc định → hạ + lùi camera: xà chiếu ra sau toan LED
  setAerialHint({ targetZ: -3.5, height: 22, back: 26 });
  return {
    update(_f: FrameState, _t: number) { /* tĩnh */ },
    dispose() { scene.remove(mesh, ink.mesh); geo.dispose(); pm.dispose(); ink.dispose(); atlas?.dispose(); setAerialHint(null); },
  };
}

export const builders: Partial<ArenaBuilders> = { stageDeco: createPixelStageDeco };
