// "Thép & Lửa" — khe `stageBase`: sàn đen lì, tấm thép xước ở mép + sọc cảnh báo ở môi sân khấu, dải lưới thép giữa,
// mặt tiền 3,5 m là tấm thép đinh tán + máng cáp, 8 ống phun lửa (ống thép + vòi) gắn dọc mép trước (khe stageFx bắn lửa),
// monitor nêm thép, sàn dốc khu khán giả than. 2 draw call (kết cấu đẽo phẳng + sàn dốc).
import * as THREE from 'three';
import { GROUND_RISE, GROUND_RUN, GROUND_Y0, STAGE_FRONT_Z, STAGE_HALF_W, STAGE_HEIGHT, STAGE_Y } from '../../../../world/layout';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { CELL, R, SKit, V, facetMaterial, resetJitter } from './stageKit';

/** x của 8 ống lửa (tránh runway giữa |x| ≤ 1,6 và runway chéo rời mép ở x ≈ ±11,5). */
export const CANNON_X = [-9.8, -7.4, -5.0, -2.6, 2.6, 5.0, 7.4, 9.8];
export const CANNON_Z = STAGE_FRONT_Z - 0.32;
export const CANNON_TOP = STAGE_Y + 0.42;

export function createSteelStageBase(ctx: ArenaBuildContext) {
  const { scene } = ctx;
  const P = R();
  resetJitter(11);
  const k = new SKit();
  const W = STAGE_HALF_W * 2, FZ = STAGE_FRONT_Z;

  // khối sàn (xuống tới đất nền như mặc định)
  const deckH = STAGE_Y - (GROUND_Y0 - 0.2);
  k.box(W, deckH, 8, 0, STAGE_Y - deckH / 2 - 0.06, -1, P.coal[300]);
  // mặt sàn: ô sàn đen lì xen sắc (mỗi tấm 2×2 m một sắc độ)
  for (let x = -12; x <= 12; x += 2) for (let z = -4; z <= 2; z += 2) {
    const t = ((x * 7 + z * 13) & 3) === 0 ? P.coal[100] : P.coal[300];
    k.floor(1.96, 1.96, x, STAGE_Y + 0.004, z, t, -1, 0, 0);
  }
  // lưới thép giữa (nối runway)
  for (let z = -4.5; z <= 2.6; z += 1.0) k.floor(3.2, 1.0, 0, STAGE_Y + 0.008, z, P.steel[300], CELL.grating);
  // tấm thép xước mép trước/sau + sọc cảnh báo ở môi
  k.box(W + 0.2, 0.08, 0.5, 0, STAGE_Y - 0.02, FZ + 0.2, P.steel[500]);
  k.box(W + 0.2, 0.08, 0.4, 0, STAGE_Y - 0.02, 2.85, P.steel[700]);
  for (let x = -12.5; x < 12.6; x += 1.0) {
    if (Math.abs(x) < 1.7) continue;
    k.floor(1.0, 0.32, x, STAGE_Y + 0.03, FZ + 0.62, 0xffffff, CELL.hazard);
  }
  k.rivets(V(-12.9, STAGE_Y + 0.03, FZ + 0.08), V(12.9, STAGE_Y + 0.03, FZ + 0.08), 0.5, P.steel[100], 0.03);

  // mặt tiền 3,5 m: tấm thép đinh tán (hàng 2 tầng) + nẹp + máng cáp
  const fz = FZ - 0.02;
  k.box(W, STAGE_HEIGHT, 0.1, 0, STAGE_Y - STAGE_HEIGHT / 2, FZ + 0.05, P.coal[300]);
  for (let x = -12.35; x < 12.5; x += 1.3) {
    if (Math.abs(x) < 1.6) continue;
    for (const [y, h] of [[-0.95, 1.6], [-2.6, 1.6]] as const) k.decal(1.24, h, x + 0.65, STAGE_Y + y, fz - 0.02, P.steel[500], CELL.plate);
    k.box(0.08, STAGE_HEIGHT, 0.08, x, STAGE_Y - STAGE_HEIGHT / 2, fz - 0.05, P.steel[700]);
  }
  for (const y of [-0.2, -1.78, -3.4]) k.box(W, 0.12, 0.1, 0, STAGE_Y + y, fz - 0.06, P.steel[300]);
  // máng cáp đen chạy ngang + bó cáp rủ
  for (const sx of [-1, 1]) {
    k.box(10.6, 0.22, 0.22, sx * 7.3, STAGE_Y - 1.55, fz - 0.2, P.coal[500]);
    for (let i = 0; i < 6; i++) k.pipe(V(sx * (2.4 + i * 1.9), STAGE_Y - 1.55, fz - 0.2), V(sx * (2.6 + i * 1.9), STAGE_Y - 3.45, fz - 0.28), 0.05, P.coal[100], 5);
  }

  // 8 ống lửa: bệ hộp + ống thép đứng + vòi phun + kẹp + sọc cảnh báo
  for (const x of CANNON_X) {
    const z = CANNON_Z;
    k.cbox(0.62, 0.5, 0.62, x, STAGE_Y - 0.9, z, P.steel[700]);
    k.box(0.7, 0.06, 0.7, x, STAGE_Y - 0.64, z, P.steel[300]);
    k.pipe(V(x, STAGE_Y - 0.64, z), V(x, CANNON_TOP - 0.12, z), 0.13, P.steel[500], 8);
    k.add(new THREE.CylinderGeometry(0.1, 0.17, 0.14, 8), P.steel[100], k.xf(x, CANNON_TOP - 0.06, z));
    k.add(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8), P.ember[700], k.xf(x, CANNON_TOP + 0.005, z), 1);
    for (const y of [STAGE_Y - 0.4, STAGE_Y - 0.05]) k.add(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8), P.coal[100], k.xf(x, y, z));
    k.pipe(V(x, STAGE_Y - 0.2, z), V(x, STAGE_Y - 0.2, FZ + 0.0), 0.04, P.steel[300], 4); // giá đỡ vào mặt tiền
    k.decal(0.6, 0.2, x, STAGE_Y - 1.05, z - 0.32, 0xffffff, CELL.hazard);
    k.pipe(V(x + 0.2, STAGE_Y - 1.15, z), V(x + 0.2, STAGE_Y - 3.45, z + 0.2), 0.04, P.blood[500], 5); // ống nhiên liệu
  }
  // monitor nêm thép (vị trí như mặc định)
  for (const x of [-1.6, 0, 2.1]) {
    const g = new THREE.BufferGeometry();
    const w = 0.5, d = 0.36, h = 0.34;
    const p = [[-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d], [-w, h, d], [w, h, d]];
    const tri = [[0, 1, 5], [0, 5, 4], [3, 4, 5], [3, 5, 2], [0, 4, 3], [1, 2, 5], [0, 3, 2], [0, 2, 1]];
    const arr: number[] = [];
    for (const t of tri) for (const i of t) arr.push(...p[i]!);
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    k.add(g, P.coal[300], k.xf(x + 0.05, 0, -3.55));
    k.decal(0.8, 0.32, x + 0.05, 0.17, -3.55 - 0.26, 0xffffff, CELL.grille, 0, 2);
  }
  const geo = k.build();
  const fm = facetMaterial(ctx.uniforms, { atlas: true });
  const mesh = new THREE.Mesh(geo, fm.mat);

  // sàn dốc khu khán giả (như mặc định)
  const slope = new THREE.PlaneGeometry(200, 90, 1, 1).rotateX(-Math.PI / 2);
  const slopeMat = new THREE.MeshBasicMaterial({ color: P.coal[300], depthWrite: false });
  const slopeMesh = new THREE.Mesh(slope, slopeMat);
  slopeMesh.renderOrder = -10;
  slopeMesh.position.set(0, GROUND_Y0, -50);
  slopeMesh.rotation.x = Math.atan2(GROUND_RISE, GROUND_RUN);

  scene.add(mesh, slopeMesh);
  return {
    dispose() { scene.remove(mesh, slopeMesh); geo.dispose(); fm.dispose(); slope.dispose(); slopeMat.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { stageBase: createSteelStageBase };
