// Đội quay phim (trang trí) + các "rig" camera cho góc nhìn bên ngoài.
// 2 dolly dưới hố, 1 tháp FOH giữa khán giả, 1 người vác máy trên sân khấu, 1 cần cẩu jib, 1 drone.
// Phong cách "Kẹo đêm": người quay phim chibi 2,3 đầu (mũ, tai nghe, mắt chấm, áo night-300 + điểm soda/berry),
// máy quay đồ chơi bo tròn ống kính to + bóng tally, dolly bánh mập, tháp FOH ống tròn sọc grape, cần cẩu ống tròn +
// đối trọng cầu, drone quadcopter mập (thân tròn, 4 rotor vòng, LED kẹo, mắt gimbal; phương tiện nên không có mặt).
// Vẽ bằng 5 InstancedMesh (hộp bo / trụ bo / cầu / vòng xuyến mập / vòng mảnh, vật liệu toon + viền fresnel) + 1 Points phát sáng
// = 6 draw call. Flycam bay tự do (phím G, stageControls): drone đi theo camera của người chơi.
import { EYE_HEIGHT, FIELD_Y, GROUND_RISE, GROUND_RUN, GROUND_Y0, GROUND_Z0, STAGE_HEIGHT } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { getControls, walkable, type ViewMode, type ViewPose } from './stageControls';
import { FOH_TOWER } from './viewControl';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PAL, INK, SKIN as SKIN_TONES, HAIR, CHAR_H } from '../../world/style';
import { createToonMaterial, roundedCylinder } from './cameraCrewToon';

export type { ViewMode, ViewPose };

export interface CameraCrew {
  /** singerPos = vị trí mắt ca sĩ (y ≈ 1,65). */
  update(f: FrameState, singerPos: THREE.Vector3, singerYaw: number): void;
  /** Camera pose for an external view, or null for 'singer'. */
  getView(mode: ViewMode): ViewPose | null;
  dispose(): void;
}

const EYE = EYE_HEIGHT;
const PIT_Z = -6.0;
const PIT_FLOOR = FIELD_Y;
/** Mặt đất nền dưới khán giả (GROUND_Y0 tại z=-6, dốc lên phía sau). */
const audienceFloor = (z: number) => (z > GROUND_Z0 ? PIT_FLOOR : GROUND_Y0 + ((GROUND_Z0 - z) * GROUND_RISE) / GROUND_RUN);

type Kind = 0 | 1 | 2 | 3 | 4; // hộp bo, trụ bo, cầu, vòng xuyến mập, vòng mảnh
interface Part { obj: THREE.Object3D; kind: Kind; idx: number }

// Token "Kẹo đêm" (guide mục 6, khu 3: quay phim / drone / cần cẩu → night-100, grape-300, tally peach-500)
const BLACK = PAL.night[300]; // áo, quần
const DARK = PAL.night[100]; // thân máy, khung
const GREY = PAL.grape[300]; // điểm sáng thân máy
const METAL = PAL.night[100];
const STRIPE = PAL.grape[500];
const LENS = INK;
const YELLOW = PAL.honey[500];
const TALLY = PAL.peach[500];
const EYE_C = INK;
const CHEEK = PAL.berry[300];
const ACCENTS = [PAL.soda[500], PAL.berry[500]];

/** fov dọc (độ) để khung hình cao H mét ở khoảng cách d. */
const fovFor = (d: number, h: number, lo = 14, hi = 70) =>
  THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(h / 2 / Math.max(0.5, d))), lo, hi);

/** Xoay object (mặt trước = -Z) nhìn về điểm đích: trả về [yaw, pitch]. */
function aimAngles(from: THREE.Vector3, to: THREE.Vector3): [number, number] {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))];
}

export function createCameraCrew(scene: THREE.Scene): CameraCrew {
  const parts: Part[] = [];
  const counts = [0, 0, 0, 0, 0];
  const colors: number[][] = [[], [], [], [], []];
  const world = new THREE.Object3D(); // cây tạm, không gắn vào scene

  const part = (parent: THREE.Object3D, kind: Kind, color: number,
    sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    o.scale.set(sx, sy, sz);
    parent.add(o);
    const idx = counts[kind]++;
    colors[kind].push(color);
    parts.push({ obj: o, kind, idx });
    return idx;
  };
  const node = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // Đèn phát sáng (tally đỏ, LED drone): Points cộng màu
  interface Glow { obj: THREE.Object3D; color: THREE.Color; size: number }
  const glows: Glow[] = [];
  const glow = (parent: THREE.Object3D, color: number, x: number, y: number, z: number, size = 0.5) => {
    const o = node(parent, x, y, z);
    const g = { obj: o, color: new THREE.Color(color), size };
    glows.push(g);
    part(parent, 2, color, 0.1, 0.1, 0.1, x, y, z); // bóng đèn tròn
    return g;
  };

  /** Người quay phim chibi 2,3 đầu (gốc = chân, nhìn -Z; H = 1,5 m). Tay vươn ra trước tới máy. */
  let opN = 0;
  const operator = (parent: THREE.Object3D, armsUp = false) => {
    const H = CHAR_H;
    const n = opN++;
    const acc = ACCENTS[n % 2]!;
    const skin = SKIN_TONES[(n * 2 + 1) % SKIN_TONES.length]!;
    const hair = HAIR[n % 5]!;
    const headY = H * 0.75, headW = 0.46 * H, headH = 0.42 * H;
    // chân + bàn chân nửa cầu
    for (const sx of [-1, 1]) {
      part(parent, 2, BLACK, 0.15, 0.36, 0.15, sx * 0.1, 0.2, 0);
      part(parent, 2, DARK, 0.17, 0.11, 0.23, sx * 0.1, 0.04, -0.03);
    }
    // thân hình hạt đậu + đai màu nhấn
    part(parent, 2, BLACK, 0.46, 0.5, 0.38, 0, 0.55, 0);
    part(parent, 3, acc, 0.21, 0.21, 0.3, 0, 0.5, 0, Math.PI / 2, 0, 0);
    // đầu to, tóc, mắt chấm, má hồng
    part(parent, 2, skin, headW, headH, headW * 0.92, 0, headY, 0);
    part(parent, 2, hair, headW * 1.02, headH * 0.7, headW * 0.95, 0, headY + 0.08, 0.04);
    for (const sx of [-1, 1]) {
      part(parent, 2, EYE_C, 0.075, 0.1, 0.05, sx * 0.13, headY - 0.02, -headW * 0.43);
      part(parent, 2, CHEEK, 0.09, 0.05, 0.03, sx * 0.22, headY - 0.1, -headW * 0.39);
    }
    // mũ lưỡi trai màu nhấn
    part(parent, 2, acc, headW * 0.98, headH * 0.5, headW * 0.92, 0, headY + 0.16, 0.01);
    part(parent, 0, acc, 0.34, 0.05, 0.24, 0, headY + 0.12, -headW * 0.5);
    // tai nghe: 2 chụp cầu + vòng qua đỉnh + mic
    for (const sx of [-1, 1]) part(parent, 2, GREY, 0.11, 0.15, 0.15, sx * headW * 0.5, headY, 0);
    part(parent, 3, GREY, headW * 0.5, headW * 0.5, 0.25, 0, headY, 0, 0, Math.PI / 2, 0);
    part(parent, 2, GREY, 0.035, 0.035, 0.2, -headW * 0.48, headY - 0.1, -0.12, 0, -0.5, 0);
    part(parent, 2, DARK, 0.06, 0.06, 0.06, -0.2, headY - 0.13, -0.23);
    // tay 1 đoạn capsule + bàn tay cầu
    const arm = (sx: number, y: number, z: number, rx: number) => {
      part(parent, 2, BLACK, 0.12, 0.12, 0.4, sx * 0.24, y, z, rx, 0, 0);
      part(parent, 2, skin, 0.15, 0.15, 0.15, sx * 0.25, y + Math.sin(rx) * 0.2, z - 0.2);
    };
    if (armsUp) { arm(1, 0.82, -0.1, 0.7); arm(-1, 0.7, -0.15, 0.3); } else for (const sx of [-1, 1]) arm(sx, 0.66, -0.16, 0.2);
  };

  /** Thân máy quay broadcast (gốc = tâm thân máy, ống kính hướng -Z). Trả về node ở mặt ống kính. */
  const broadcastCam = (parent: THREE.Object3D, scale = 1) => {
    const s = scale;
    part(parent, 0, DARK, 0.34 * s, 0.36 * s, 0.58 * s, 0, 0, 0); // thân hộp bo mập
    part(parent, 0, GREY, 0.36 * s, 0.08 * s, 0.42 * s, 0, 0.13 * s, 0.02 * s); // sọc nắp grape
    part(parent, 2, DARK, 0.22 * s, 0.18 * s, 0.22 * s, 0, 0.24 * s, 0.14 * s); // ống ngắm tròn
    part(parent, 1, DARK, 0.3 * s, 0.22 * s, 0.3 * s, 0, 0, -0.36 * s, Math.PI / 2, 0, 0); // ống kính mập
    part(parent, 3, GREY, 0.19 * s, 0.19 * s, 0.32 * s, 0, 0, -0.48 * s); // vành ống kính
    part(parent, 2, LENS, 0.3 * s, 0.3 * s, 0.14 * s, 0, 0, -0.5 * s); // mắt kính tròn to
    part(parent, 2, PAL.soda[300], 0.07 * s, 0.07 * s, 0.03 * s, -0.06 * s, 0.06 * s, -0.565 * s); // ánh kính
    part(parent, 2, YELLOW, 0.06 * s, 0.06 * s, 0.06 * s, 0.17 * s, -0.05 * s, 0.2 * s); // nút sao
    glow(parent, TALLY, 0, 0.29 * s, -0.12 * s, 0.45);
    return node(parent, 0, 0, -0.72 * s);
  };

  // ── 2 dolly dưới hố ──
  interface Dolly { root: THREE.Object3D; head: THREE.Object3D; lens: THREE.Object3D; x: number; side: number; aim: THREE.Vector3 }
  const dollies: Dolly[] = [];
  for (const side of [-1, 1]) {
    const root = node(world, side * 4, PIT_FLOOR, PIT_Z);
    part(root, 0, DARK, 1.0, 0.18, 0.8, 0, 0.22, 0);
    part(root, 0, STRIPE, 1.02, 0.05, 0.82, 0, 0.26, 0);
    for (const wx of [-0.42, 0.42]) for (const wz of [-0.32, 0.32]) {
      part(root, 3, BLACK, 0.12, 0.12, 0.2, wx, 0.13, wz, 0, Math.PI / 2, 0); // bánh mập
      part(root, 2, GREY, 0.08, 0.08, 0.1, wx, 0.13, wz); // moay-ơ
    }
    // Cột nâng: ống kính cao hơn mặt sân khấu ~0,95 m để nhìn qua mép sàn diễn.
    const HEAD_Y = STAGE_HEIGHT + 0.95;
    const OP_Y = HEAD_Y - 1.2; // người chibi thấp hơn → bục cao hơn để tay chạm máy
    part(root, 1, METAL, 0.18, HEAD_Y - 0.3, 0.18, 0, (HEAD_Y - 0.3) / 2 + 0.2, 0);
    part(root, 1, GREY, 0.07, 0.7, 0.07, 0, OP_Y + 0.7, 0.35, 0, 0, Math.PI / 2); // tay đẩy
    part(root, 0, DARK, 0.66, OP_Y, 0.56, 0, OP_Y / 2, 0.85); // bục đứng cho người quay
    part(root, 3, STRIPE, 0.3, 0.3, 0.3, 0, OP_Y * 0.55, 0.85, Math.PI / 2, 0, 0);
    const head = node(root, 0, HEAD_Y, 0);
    const lens = broadcastCam(head);
    const op = node(root, 0, OP_Y, 0.85);
    operator(op);
    dollies.push({ root, head, lens, x: side * 4, side, aim: new THREE.Vector3(0, 1.3, 0) });
  }

  // ── Tháp FOH giữa khán giả ──
  const towerZ = FOH_TOWER.z;
  const towerX = FOH_TOWER.x;
  const towerFloor = audienceFloor(towerZ);
  const tower = node(world, towerX, towerFloor, towerZ);
  const TH = Math.max(4, 5 - towerFloor); // sàn tháp ở y ≈ 5 để góc 'wide' nhìn qua đầu khán giả
  // ống tròn + khớp cầu + sọc quấn grape
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    part(tower, 1, DARK, 0.22, TH, 0.22, sx * 1.1, TH / 2, sz * 1.1);
    for (let k = 1; k <= 3; k++) part(tower, 3, STRIPE, 0.13, 0.13, 0.4, sx * 1.1, (TH * k) / 4, sz * 1.1, Math.PI / 2, 0, 0);
    part(tower, 2, METAL, 0.34, 0.34, 0.34, sx * 1.1, TH, sz * 1.1);
  }
  for (const sz of [-1, 1]) part(tower, 1, METAL, 0.1, 2.3, 0.1, 0, TH * 0.5, sz * 1.1, 0, 0, 0.9);
  for (const sx of [-1, 1]) part(tower, 1, METAL, 0.1, 2.3, 0.1, sx * 1.1, TH * 0.5, 0, 0.9, 0, 0);
  part(tower, 0, DARK, 2.6, 0.18, 2.6, 0, TH, 0);
  for (const sz of [-1, 1]) part(tower, 1, STRIPE, 0.1, 2.44, 0.1, 0, TH + 1.0, sz * 1.22, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) part(tower, 1, STRIPE, 0.1, 2.44, 0.1, sx * 1.22, TH + 1.0, 0, Math.PI / 2, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    part(tower, 1, METAL, 0.09, 1.0, 0.09, sx * 1.22, TH + 0.5, sz * 1.22);
    part(tower, 2, YELLOW, 0.16, 0.16, 0.16, sx * 1.22, TH + 1.02, sz * 1.22);
  }
  part(tower, 0, PAL.night[500], 2.5, 0.55, 0.08, 0, TH - 0.3, -1.25); // băng rôn trước tháp
  part(tower, 2, YELLOW, 0.32, 0.32, 0.06, 0, TH - 0.3, -1.3); // sao (motif) trên băng rôn
  const towerYaw = node(tower, 0, TH, 0);
  for (const a of [0, 2.1, 4.2]) part(towerYaw, 1, METAL, 0.07, 1.45, 0.07, Math.sin(a) * 0.25, 0.7, Math.cos(a) * 0.25 + 0.1, Math.cos(a) * 0.17, 0, -Math.sin(a) * 0.17);
  const towerHead = node(towerYaw, 0, 1.5, 0.1);
  const towerLens = broadcastCam(towerHead, 1.15);
  const towerOp = node(towerYaw, 0, 0, 0.85);
  operator(towerOp);
  const towerAim = new THREE.Vector3(0, 1.5, -2);

  // ── Người vác máy trên sân khấu ──
  const shoulder = node(world, -5, 0, -2.5);
  operator(shoulder, true);
  const shoulderCamNode = node(shoulder, 0.45, 1.0, -0.15); // trên vai người chibi
  broadcastCam(shoulderCamNode, 0.7);
  const shoulderAim = new THREE.Vector3();

  // ── Cần cẩu jib ở cánh trái hố ──
  const craneBase = new THREE.Vector3(-9.6, PIT_FLOOR, -5.8);
  const crane = node(world, craneBase.x, craneBase.y, craneBase.z);
  for (const a of [0, 2.1, 4.2]) {
    part(crane, 1, DARK, 0.16, 1.6, 0.16, Math.sin(a) * 0.55, 0.1, Math.cos(a) * 0.55, Math.PI / 2, a, 0, );
    part(crane, 3, BLACK, 0.09, 0.09, 0.14, Math.sin(a) * 1.3, 0.09, Math.cos(a) * 1.3, 0, a + Math.PI / 2, 0); // bánh xe tròn
  }
  const CRANE_PIVOT_Y = STAGE_HEIGHT + 2.0;
  part(crane, 1, METAL, 0.28, CRANE_PIVOT_Y - 0.1, 0.28, 0, (CRANE_PIVOT_Y - 0.1) / 2, 0);
  for (let k = 1; k <= 3; k++) part(crane, 3, STRIPE, 0.16, 0.16, 0.4, 0, (CRANE_PIVOT_Y * k) / 4, 0, Math.PI / 2, 0, 0);
  const craneYaw = node(crane, 0, CRANE_PIVOT_Y, 0);
  part(craneYaw, 2, GREY, 0.5, 0.42, 0.5, 0, 0, 0);
  const cranePitch = node(craneYaw, 0, 0, 0);
  const ARM = 7.5;
  part(cranePitch, 1, DARK, 0.24, ARM + 2.2, 0.24, 0, 0, -(ARM - 2.2) / 2, Math.PI / 2, 0, 0); // tay cần ống tròn
  for (let k = 0; k < 6; k++) part(cranePitch, 3, STRIPE, 0.14, 0.14, 0.4, 0, 0, 1.6 - k * ((ARM + 1.6) / 6)); // sọc quấn
  part(cranePitch, 2, BLACK, 0.85, 0.85, 0.85, 0, -0.05, 2.25); // đối trọng cầu
  part(cranePitch, 2, YELLOW, 0.26, 0.26, 0.1, 0, -0.05, 2.68); // sao trên đối trọng
  part(cranePitch, 1, GREY, 0.05, ARM, 0.05, 0, 0.45, -ARM / 2 + 0.2, Math.PI / 2 + 0.06, 0, 0); // dây căng
  const craneHead = node(world, 0, 0, 0);
  part(craneHead, 1, DARK, 0.1, 0.4, 0.1, 0, 0.18, 0); // giá treo đầu máy
  const craneHeadAim = node(craneHead, 0, 0, 0);
  const craneLens = broadcastCam(craneHeadAim, 0.75);
  let craneYawSm = 0.3;
  let cranePitchSm = 0.3;
  const craneAim = new THREE.Vector3(0, 1.3, 0);
  const craneOp = node(world, craneBase.x - 0.6, PIT_FLOOR, craneBase.z - 0.3);
  operator(craneOp);

  // ── Drone (fly cam) ──
  const DS = 1.7; // phóng to cho dễ thấy
  const drone = node(world, 0, 10, -15);
  const droneBody = node(drone);
  droneBody.scale.setScalar(DS);
  // thân tròn mập + nắp grape + 4 tay ống + 4 rotor vòng + đĩa nhoè; LED kẹo ở chân tay
  part(droneBody, 2, PAL.cream[500], 0.5, 0.26, 0.5, 0, 0, 0);
  part(droneBody, 2, GREY, 0.36, 0.16, 0.36, 0, 0.09, 0);
  part(droneBody, 3, PAL.berry[500], 0.255, 0.255, 0.3, 0, 0, 0, Math.PI / 2, 0, 0);
  for (const a of [Math.PI / 4, -Math.PI / 4]) part(droneBody, 1, PAL.cream[700], 0.08, 0.95, 0.08, 0, 0.02, 0, Math.PI / 2, a, 0);
  const rotorPos: [number, number][] = [[0.33, 0.33], [-0.33, 0.33], [0.33, -0.33], [-0.33, -0.33]];
  for (const [x, z] of rotorPos) {
    part(droneBody, 2, PAL.cream[700], 0.1, 0.1, 0.1, x, 0.05, z);
    // vòng bảo vệ rotor: vòng mảnh riêng (kind 4) ôm sát mép đĩa cánh quạt nhoè — vòng mập dùng chung (ống 0,42) bị "béo"
    part(droneBody, 4, PAL.soda[500], 0.19, 0.19, 0.19, x, 0.09, z, Math.PI / 2, 0, 0);
    part(droneBody, 1, PAL.soda[100], 0.34, 0.008, 0.34, x, 0.09, z); // cánh quạt nhoè
  }
  const ledR = glow(droneBody, PAL.berry[500], -0.33, -0.03, -0.33, 0.6);
  const ledG = glow(droneBody, PAL.mint[500], 0.33, -0.03, -0.33, 0.6);
  const ledB1 = glow(droneBody, PAL.honey[500], -0.33, -0.03, 0.33, 0.45);
  const ledB2 = glow(droneBody, PAL.soda[500], 0.33, -0.03, 0.33, 0.45);
  const gimbal = node(world);
  part(gimbal, 1, DARK, 0.07, 0.2, 0.07, 0, 0.1, 0);
  const gimbalAim = node(gimbal, 0, -0.02, 0);
  part(gimbalAim, 2, DARK, 0.26, 0.24, 0.26, 0, 0, 0); // bi gimbal tròn
  part(gimbalAim, 3, GREY, 0.08, 0.08, 0.1, 0, 0, -0.11); // vành mắt
  part(gimbalAim, 2, LENS, 0.13, 0.13, 0.06, 0, 0, -0.12); // mắt kính
  part(gimbalAim, 2, PAL.soda[300], 0.035, 0.035, 0.02, -0.025, 0.025, -0.15); // ánh kính
  const droneLens = node(gimbalAim, 0, 0, -0.18);
  const droneAim = new THREE.Vector3(0, 1.3, 0);
  let droneS = 0;
  const dronePrev = new THREE.Vector3(0, 10, -15);
  let droneHeading = 0;

  // ── Mesh instanced ──
  const disposables: { dispose(): void }[] = [];
  const geos = [
    new RoundedBoxGeometry(1, 1, 1, 2, 0.2),
    roundedCylinder(14),
    new THREE.SphereGeometry(0.5, 16, 12),
    new THREE.TorusGeometry(1, 0.42, 8, 18), // vòng mập (bánh xe, sọc quấn)
    new THREE.TorusGeometry(1, 0.1, 6, 28), // vòng mảnh (vòng bảo vệ rotor drone)
  ];
  const mat = createToonMaterial();
  disposables.push(mat, ...geos);
  const meshes = geos.map((g, k) => {
    const m = new THREE.InstancedMesh(g, mat, Math.max(1, counts[k]));
    m.count = counts[k];
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    for (let i = 0; i < counts[k]; i++) m.setColorAt(i, c.setHex(colors[k][i]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.name = 'cameraCrew';
    scene.add(m);
    return m;
  });

  // Points phát sáng
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const gPos = new Float32Array(glows.length * 3);
  const gCol = new Float32Array(glows.length * 3);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3).setUsage(THREE.DynamicDrawUsage));
  glowGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3).setUsage(THREE.DynamicDrawUsage));
  const glowMat = new THREE.PointsMaterial({
    size: 0.5, map: glowTex, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const glowPts = new THREE.Points(glowGeo, glowMat);
  glowPts.frustumCulled = false;
  scene.add(glowPts);
  disposables.push(glowTex, glowGeo, glowMat);

  // ── Trạng thái góc nhìn ──
  const views: Record<Exclude<ViewMode, 'singer'>, ViewPose> = {
    flycam: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45, rig: true },
    pit: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30, rig: true },
    crane: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 35, rig: true },
    wide: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30, rig: true },
    aerial: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50, rig: true },
  };
  // Góc 'aerial': trên không trước vòm mái, chúc xuống tâm sân khấu/ca sĩ (bám lỏng), lắc ±10°.
  const aerialTgt = new THREE.Vector3(0, 1, -3.5);
  const aerialPos = new THREE.Vector3(0, 30, -19.5);
  let pitIdx = 0;
  const chest = new THREE.Vector3();
  const lead = new THREE.Vector3();
  const prevSinger = new THREE.Vector3(0, EYE, 0);
  const vel = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  let t = 0;
  let first = true;
  let prevSongTime = 0;
  // Drone theo lệnh người chơi (flycam bay tự do) rồi trượt mượt về đường bay tự động
  let droneRet = 1;
  const droneFrom = new THREE.Vector3();
  let droneFromHeading = 0;
  let wasFree = false;

  const damp = (v: THREE.Vector3, to: THREE.Vector3, rate: number, dt: number) => v.lerp(to, 1 - Math.exp(-rate * dt));
  const aimNode = (n: THREE.Object3D, yawNode: THREE.Object3D | null, target: THREE.Vector3) => {
    world.updateMatrixWorld(true);
    n.getWorldPosition(tmp);
    const [y, p] = aimAngles(tmp, target);
    if (yawNode) {
      const parentYaw = new THREE.Euler().setFromQuaternion(yawNode.parent!.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
      yawNode.rotation.y = y - parentYaw;
      n.rotation.set(p, 0, 0);
    } else n.rotation.set(p, y, 0, 'YXZ');
  };

  return {
    update(f, singerPos, singerYaw) {
      const dt = Math.max(0, Math.min(f.dt, 0.1));
      t += dt;
      const hype = THREE.MathUtils.clamp(f.hype, 0, 1);
      const floorY = singerPos.y - EYE;
      chest.set(singerPos.x, floorY + 1.3, singerPos.z);
      if (dt > 0) vel.subVectors(singerPos, prevSinger).divideScalar(dt).setY(0).clampLength(0, 5);
      prevSinger.copy(singerPos);
      lead.copy(chest).addScaledVector(vel, 0.25);
      // Bài mới bắt đầu (songTime nhảy về âm: đếm ngược) → đặt lại góc máy người chơi đã chỉnh
      if (f.songTime < 0 && prevSongTime >= 0) getControls()?.resetViewOffsets();
      prevSongTime = f.songTime;
      const k = first ? 1e6 : 1;
      const ddt = first ? 1 : dt;
      first = false;

      // Dolly: chạy dọc hố theo ca sĩ, tránh lối runway
      for (const d of dollies) {
        const want = d.side < 0 ? THREE.MathUtils.clamp(singerPos.x - 2.8, -10.8, -2.6) : THREE.MathUtils.clamp(singerPos.x + 2.8, 2.6, 10.8);
        const step = THREE.MathUtils.clamp((want - d.x) * (1 - Math.exp(-1.5 * ddt * k)), -2.5 * ddt * k, 2.5 * ddt * k);
        d.x += step;
        d.root.position.x = d.x;
        damp(d.aim, lead, 4 * k, ddt);
        const [y] = aimAngles(d.root.position, d.aim);
        d.root.rotation.y = y;
        aimNode(d.head, null, d.aim);
        d.head.rotation.y = 0; // gốc dolly đã xoay theo yaw
      }
      // Tháp FOH
      tmp2.set(0, 1.6, -3).lerp(lead, 0.35);
      damp(towerAim, tmp2, 2 * k, ddt);
      aimNode(towerHead, towerYaw, towerAim);

      // Người vác máy: đứng chéo trước-trái ca sĩ ~3,6 m, đi chậm theo
      {
        const ang = singerYaw + 1.0 + Math.sin(t * 0.13) * 0.5;
        const fx = singerPos.x - Math.sin(ang) * 3.6;
        const fz = singerPos.z - Math.cos(ang) * 3.6;
        let gx = fx, gz = fz;
        for (let i = 0; i < 8 && !walkable(gx, gz); i++) { gx += (singerPos.x - gx) * 0.25; gz += (singerPos.z - gz) * 0.25; }
        if (walkable(gx, gz)) {
          const kk = 1 - Math.exp(-0.9 * ddt * k);
          const nx = shoulder.position.x + (gx - shoulder.position.x) * kk;
          const nz = shoulder.position.z + (gz - shoulder.position.z) * kk;
          if (walkable(nx, nz) || first) { shoulder.position.x = nx; shoulder.position.z = nz; }
        }
        // giữ khoảng cách tối thiểu
        tmp.set(shoulder.position.x - singerPos.x, 0, shoulder.position.z - singerPos.z);
        if (tmp.length() < 1.6) {
          tmp.setLength(1.6);
          const px = singerPos.x + tmp.x, pz = singerPos.z + tmp.z;
          if (walkable(px, pz)) shoulder.position.set(px, 0, pz);
        }
        shoulder.position.y = floorY;
        damp(shoulderAim, lead, 3 * k, ddt);
        shoulder.rotation.y = aimAngles(shoulder.position, shoulderAim)[0];
        shoulder.position.y = floorY + Math.abs(Math.sin(t * 3.1)) * 0.01;
        world.updateMatrixWorld(true);
        shoulderCamNode.getWorldPosition(tmp);
        shoulderCamNode.rotation.set(aimAngles(tmp, shoulderAim)[1], 0, 0);
      }

      // Cần cẩu: tay cần quay về phía ca sĩ ± đung đưa, nâng hạ chậm
      {
        damp(craneAim, lead, 2.5 * k, ddt);
        const dx = craneAim.x - craneBase.x, dz = craneAim.z - craneBase.z;
        const toSinger = Math.atan2(-dx, -dz);
        const wantYaw = toSinger + Math.sin(t * 0.21) * 0.35 + 0.15;
        craneYawSm += (wantYaw - craneYawSm) * (1 - Math.exp(-0.8 * ddt * k));
        const wantPitch = 0.28 + 0.2 * Math.sin(t * 0.17) + 0.12 * hype;
        cranePitchSm += (wantPitch - cranePitchSm) * (1 - Math.exp(-0.8 * ddt * k));
        // giữ đầu máy cách ca sĩ ≥ 3 m
        const dist = Math.hypot(dx, dz);
        const reach = Math.min(ARM, Math.max(2, dist - 3.2));
        const armPitch = cranePitchSm + Math.max(0, Math.acos(Math.min(1, reach / ARM)));
        craneYaw.rotation.y = craneYawSm;
        cranePitch.rotation.x = armPitch;
        const hr = Math.cos(armPitch) * ARM;
        craneHead.position.set(
          craneBase.x - Math.sin(craneYawSm) * hr,
          craneBase.y + CRANE_PIVOT_Y + Math.sin(armPitch) * ARM - 0.38,
          craneBase.z - Math.cos(craneYawSm) * hr,
        );
        craneHead.position.y += 0;
        tmp.copy(craneHead.position);
        const [yy, pp] = aimAngles(tmp, craneAim);
        craneHeadAim.rotation.set(pp, yy, 0, 'YXZ');
        craneOp.rotation.y = aimAngles(craneOp.position, craneAim)[0];
      }

      // Drone: hình số 8 trên khán giả + quanh sân khấu, sà xuống khi hype cao
      {
        droneS += dt * (0.13 + 0.06 * hype);
        const s = droneS;
        const swoop = hype > 0.6 ? ((hype - 0.6) / 0.4) * Math.max(0, Math.sin(s * 3)) : 0;
        // Cung phía trước sân khấu (luôn z ≤ -9, ngoài khối mái), quét trái↔phải, sà vào runway
        const sx = 13 * Math.sin(s) + singerPos.x * 0.3;
        const baseZ = Math.min(-11, singerPos.z - 11);
        const sz = Math.min(-9, baseZ - 2.5 + 2.5 * Math.cos(2 * s) + swoop * 1.5);
        let sy = 8 + 2 * Math.sin(s * 0.7 + 1) - swoop * 2.5;
        if (Math.abs(sx) < 4) sy = Math.max(sy, 6); // trên các cổng đèn runway (cao 5 m)
        tmp.set(sx, Math.max(4, Math.min(11, sy)), sz);
        if (dt > 0) {
          tmp2.subVectors(tmp, dronePrev);
          if (tmp2.lengthSq() > 1e-6) {
            const hd = Math.atan2(-tmp2.x, -tmp2.z);
            let dh = hd - droneHeading;
            dh = Math.atan2(Math.sin(dh), Math.cos(dh));
            droneHeading += dh * (1 - Math.exp(-2 * dt));
          }
        }
        dronePrev.copy(tmp);
        damp(droneAim, lead, 3 * k, ddt);
        const free = getControls()?.getFreeFlyCam() ?? null;
        if (free) {
          // ống kính gimbal trùng vị trí camera: thân drone ở trên + lùi sau ống kính
          const fx = -Math.sin(free.yaw), fz = -Math.cos(free.yaw);
          drone.position.set(free.pos.x - fx * 0.18, free.pos.y + 0.22 * DS + 0.02, free.pos.z - fz * 0.18);
          droneFrom.copy(drone.position);
          droneFromHeading = free.yaw;
          droneRet = 0;
          wasFree = true;
          droneBody.rotation.set(-0.12, free.yaw, Math.sin(t * 1.3) * 0.04, 'YXZ');
          gimbal.position.copy(drone.position).y -= 0.22 * DS;
          gimbalAim.rotation.set(free.pitch, free.yaw, 0, 'YXZ');
        } else {
          if (wasFree) { wasFree = false; droneRet = 0; }
          droneRet = Math.min(1, droneRet + dt / 0.6);
          const e = droneRet * droneRet * (3 - 2 * droneRet);
          drone.position.lerpVectors(droneFrom, tmp, droneRet < 1 ? e : 1);
          let dh = droneHeading - droneFromHeading;
          dh = Math.atan2(Math.sin(dh), Math.cos(dh));
          droneBody.rotation.set(-0.12, droneRet < 1 ? droneFromHeading + dh * e : droneHeading, Math.sin(t * 1.3) * 0.04, 'YXZ');
          gimbal.position.copy(drone.position).y -= 0.22 * DS;
          const [yy, pp] = aimAngles(gimbal.position, droneAim);
          gimbalAim.rotation.set(pp, yy, 0, 'YXZ');
        }
        const blink = Math.floor(t * 2) % 2 === 0;
        const strobe = (t * 1.1) % 1 < 0.08;
        // LED kẹo nhấp nháy mềm (không trắng): berry/mint xen kẽ, honey/soda chớp
        ledR.color.setHex(PAL.berry[500]).multiplyScalar(blink ? 1 : 0.15);
        ledG.color.setHex(PAL.mint[500]).multiplyScalar(!blink ? 1 : 0.15);
        ledB1.color.setHex(PAL.honey[300]).multiplyScalar(strobe ? 1 : 0.15);
        ledB2.color.setHex(PAL.soda[300]).multiplyScalar(strobe ? 1 : 0.15);
      }

      // Ghi ma trận
      world.updateMatrixWorld(true);
      for (const p of parts) meshes[p.kind].setMatrixAt(p.idx, p.obj.matrixWorld);
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      const tally = 0.75 + 0.25 * Math.sin(t * 6);
      glows.forEach((g, i) => {
        g.obj.getWorldPosition(tmp);
        gPos[i * 3] = tmp.x; gPos[i * 3 + 1] = tmp.y; gPos[i * 3 + 2] = tmp.z;
        const s = g.size < 0.5 ? tally : 1; // tally (0,45) thở nhẹ
        gCol[i * 3] = g.color.r * s; gCol[i * 3 + 1] = g.color.g * s; gCol[i * 3 + 2] = g.color.b * s;
      });
      glowGeo.attributes.position.needsUpdate = true;
      glowGeo.attributes.color.needsUpdate = true;

      // ── Góc nhìn ──
      // pit: dolly gần nhất (có trễ chuyển)
      const dA = dollies[pitIdx].root.position.distanceTo(chest);
      const dB = dollies[1 - pitIdx].root.position.distanceTo(chest);
      if (dB < dA - 1.5) pitIdx = 1 - pitIdx;
      const pd = dollies[pitIdx];
      pd.lens.getWorldPosition(views.pit.position);
      views.pit.target.copy(pd.aim);
      views.pit.fov = fovFor(views.pit.position.distanceTo(pd.aim), 3.0, 18, 60);

      craneLens.getWorldPosition(views.crane.position);
      views.crane.target.copy(craneAim);
      views.crane.fov = fovFor(views.crane.position.distanceTo(craneAim), 4.2, 20, 65);

      droneLens.getWorldPosition(views.flycam.position);
      views.flycam.target.copy(droneAim);
      views.flycam.fov = fovFor(views.flycam.position.distanceTo(droneAim), 5.2 - 1.2 * hype, 10, 50);

      {
        tmp.set(singerPos.x * 0.6, floorY + 1.0, THREE.MathUtils.clamp(singerPos.z * 0.7 - 3.5, -32, -2));
        damp(aerialTgt, tmp, 0.8 * k, ddt);
        const sway = THREE.MathUtils.degToRad(10) * Math.sin(t * 0.09);
        const R = 16; // camera trước vòm mái (z ≤ -18) → giàn mái không che tâm sân khấu
        tmp.set(aerialTgt.x + Math.sin(sway) * R, aerialTgt.y + 29 + Math.sin(t * 0.13) * 0.8, Math.min(-18, aerialTgt.z - Math.cos(sway) * R));
        damp(aerialPos, tmp, 1.2 * k, ddt);
        views.aerial.position.copy(aerialPos);
        views.aerial.target.copy(aerialTgt);
        views.aerial.fov = 55 - 5 * hype - 1.5 * f.beatPulse * hype;
      }
      towerLens.getWorldPosition(views.wide.position);
      views.wide.target.copy(towerAim);
      views.wide.fov = fovFor(views.wide.position.distanceTo(towerAim), 13, 12, 50);
    },
    getView(mode) {
      return mode === 'singer' ? null : views[mode];
    },
    dispose() {
      for (const m of meshes) scene.remove(m);
      scene.remove(glowPts);
      for (const d of disposables) d.dispose();
    },
  };
}
