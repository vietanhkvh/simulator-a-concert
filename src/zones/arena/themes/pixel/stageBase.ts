// "Đêm Sao Điểm Ảnh" — khe `stageBase`: sàn ván gỗ đất (ô 2 × 2 m, atlas 16 px), mép trước là băng hạt vàng (cạnh dưới của
// khung tranh lớn), mặt tiền 3,5 m ô tím chiều viền crôm, 8 thùng sơn mở nắp dọc mép trước (khe stageFx bắn sơn từ đây),
// monitor nêm gỗ, sàn dốc khu khán giả lam Phổ tối. 3 draw call (khối gộp + viền mực + sàn dốc).
import * as THREE from 'three';
import { GROUND_RISE, GROUND_RUN, GROUND_Y0, STAGE_FRONT_Z, STAGE_HALF_W, STAGE_HEIGHT, STAGE_Y } from '../../../../world/layout';
import { toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { CELL, PKit, R, V, inkOutline, makeAtlas, pixelMaterial } from './stageKit';

/** x của 8 thùng sơn (tránh runway giữa |x| ≤ 1,6 và runway chéo rời mép ở x ≈ ±11,5). */
export const POT_X = [-9.8, -7.4, -5.0, -2.6, 2.6, 5.0, 7.4, 9.8];
export const POT_Z = STAGE_FRONT_Z + 0.32;
export const POT_TOP = STAGE_Y + 0.36;
/** Màu sơn từng thùng (chỉ số vào bảng của khe stageFx). */
export const POT_PAINT = [0, 1, 2, 3, 3, 2, 1, 0];

export function createPixelStageBase(ctx: ArenaBuildContext) {
  const { scene } = ctx;
  const P = R();
  const k = new PKit();
  const W = STAGE_HALF_W * 2, FZ = STAGE_FRONT_Z;

  // khối sàn (xuống dưới đất nền như mặc định)
  const deckH = STAGE_Y - (GROUND_Y0 - 0.2);
  k.box(W, deckH, 8, 0, STAGE_Y - deckH / 2 - 0.02, -1, P.dat[700]);
  // mặt sàn: ván gỗ, mỗi ô 2 × 2 m (16 texel → 0,125 m / texel)
  for (let x = -12; x <= 12; x += 2) for (let z = -4; z <= 2; z += 2) k.floor(2, 2, x, STAGE_Y + 0.004, z, CELL.plank, ((x + z) & 2) ? 0 : Math.PI);
  // mép trước: băng hạt vàng nằm ngang + gờ crôm (cạnh dưới khung tranh lớn)
  k.box(W + 0.1, 0.16, 0.3, 0, STAGE_Y - 0.06, FZ + 0.1, P.crom[700]);
  for (let x = -12.5; x < 12.6; x += 1.0) k.floor(1.0, 0.24, x, STAGE_Y + 0.025, FZ + 0.12, CELL.bead);
  // mặt tiền 3,5 m: ô tím chiều (1 × 1 m), dải hạt vàng trên cùng
  const fz = FZ - 0.02;
  k.box(W, STAGE_HEIGHT, 0.1, 0, STAGE_Y - STAGE_HEIGHT / 2, FZ + 0.03, P.tim[700]);
  for (let x = -12.5; x < 12.6; x += 1.0) {
    k.decal(1.0, 0.5, x, STAGE_Y - 0.3, fz - 0.03, CELL.bead);
    for (let y = -1.05; y > -STAGE_HEIGHT; y -= 1.0) k.decal(1.0, 1.0, x, STAGE_Y + y, fz - 0.02, CELL.facade);
  }

  // 8 thùng sơn mở nắp (thiếc + băng nhãn atlas, mặt sơn phẳng màu theo POT_PAINT)
  const paint = [P.crom[500], P.sen, P.ngoc, P.pho[300]]; // son để dành cho Hype ≥ 80 %
  POT_X.forEach((x, i) => {
    const cyl = new THREE.CylinderGeometry(0.24, 0.21, 0.36, 8, 1, true);
    k.add(cyl, 0xffffff, k.xf(x, STAGE_Y + 0.18, POT_Z), 2, CELL.bucket);
    k.cyl(0.25, 0.25, 0.04, x, POT_TOP, POT_Z, P.may[500], 8);
    k.cyl(0.21, 0.21, 0.02, x, POT_TOP + 0.02, POT_Z, paint[POT_PAINT[i]!]!, 8, 0, 0, 1);
    // vệt sơn rỉ xuống mép
    k.box(0.06, 0.16, 0.02, x - 0.08, STAGE_Y + 0.26, POT_Z - 0.235, paint[POT_PAINT[i]!]!, 0, 1);
  });

  // monitor nêm gỗ (vị trí như mặc định) + mặt lưới crôm-700
  for (const x of [-1.6, 0, 2.1]) {
    const g = new THREE.BufferGeometry();
    const w = 0.5, d = 0.36, h = 0.34;
    const p = [[-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d], [-w, h, d], [w, h, d]];
    const tri = [[0, 1, 5], [0, 5, 4], [3, 4, 5], [3, 5, 2], [0, 4, 3], [1, 2, 5], [0, 3, 2], [0, 2, 1]];
    const arr: number[] = [];
    for (const t of tri) for (const i of t) arr.push(...p[i]!);
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    k.add(g, P.dat[700], k.xf(x + 0.05, 0, -3.55));
    const a = V(x + 0.05 - 0.42, 0.02, -3.55 - 0.33), b = V(x + 0.05 + 0.42, 0.02, -3.55 - 0.33);
    const c = V(x + 0.05 + 0.42, 0.3, -3.55 + 0.27), dd = V(x + 0.05 - 0.42, 0.3, -3.55 + 0.27);
    k.quad(a, b, c, dd, P.crom[700]);
  }

  const atlas = makeAtlas();
  const geo = k.build();
  const pm = pixelMaterial({ atlas });
  const mesh = new THREE.Mesh(geo, pm.mat);
  const ink = inkOutline(geo);

  // sàn dốc khu khán giả: lam Phổ tối phẳng
  const slope = new THREE.PlaneGeometry(200, 90, 1, 1).rotateX(-Math.PI / 2);
  const slopeMat = new THREE.MeshBasicMaterial({ color: toColor(P.pho[700]), depthWrite: false });
  const slopeMesh = new THREE.Mesh(slope, slopeMat);
  slopeMesh.renderOrder = -10;
  slopeMesh.position.set(0, GROUND_Y0, -50);
  slopeMesh.rotation.x = Math.atan2(GROUND_RISE, GROUND_RUN);

  scene.add(mesh, ink.mesh, slopeMesh);
  return {
    dispose() {
      scene.remove(mesh, ink.mesh, slopeMesh);
      geo.dispose(); pm.dispose(); ink.dispose(); atlas?.dispose(); slope.dispose(); slopeMat.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { stageBase: createPixelStageBase };
