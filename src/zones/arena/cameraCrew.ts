// Đội quay phim (trang trí) + các "rig" camera cho góc nhìn bên ngoài.
// 2 dolly dưới hố, 1 tháp FOH giữa khán giả, 1 người vác máy trên sân khấu, 1 cần cẩu jib, 1 drone.
// Toàn bộ vẽ bằng 3 InstancedMesh (hộp / trụ / cầu) + 1 Points phát sáng (đèn tally, LED) = 4 draw call.
import { EYE_HEIGHT, FIELD_Y, GROUND_RISE, GROUND_RUN, GROUND_Y0, GROUND_Z0 } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { walkable, type ViewMode, type ViewPose } from './stageControls';

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
/** Sàn khán giả: -1,6 tại z=-6, lên +4 tại z=-80. */
const audienceFloor = (z: number) => (z > GROUND_Z0 ? PIT_FLOOR : GROUND_Y0 + ((GROUND_Z0 - z) * GROUND_RISE) / GROUND_RUN);

type Kind = 0 | 1 | 2; // hộp, trụ, cầu
interface Part { obj: THREE.Object3D; kind: Kind; idx: number }

const BLACK = 0x26262e;
const DARK = 0x3a3a44;
const GREY = 0x6c6f7a;
const METAL = 0x9aa0ac;
const SKIN = 0xb98a6c;
const LENS = 0x101018;
const YELLOW = 0xe8b020;

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
  const counts = [0, 0, 0];
  const colors: number[][] = [[], [], []];
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
    part(parent, 2, color, 0.07, 0.07, 0.07, x, y, z);
    return g;
  };

  /** Người quay phim (gốc = chân, nhìn -Z). Tay vươn ra trước tới máy. */
  const operator = (parent: THREE.Object3D, armsUp = false) => {
    for (const sx of [-1, 1]) part(parent, 0, BLACK, 0.15, 0.85, 0.17, sx * 0.1, 0.43, 0);
    part(parent, 0, BLACK, 0.42, 0.6, 0.25, 0, 1.15, 0);
    part(parent, 2, SKIN, 0.22, 0.25, 0.23, 0, 1.6, 0);
    part(parent, 2, BLACK, 0.235, 0.14, 0.24, 0, 1.68, 0.02); // mũ lưỡi trai
    part(parent, 0, BLACK, 0.12, 0.02, 0.12, 0, 1.67, -0.14);
    // tai nghe
    part(parent, 0, DARK, 0.27, 0.035, 0.05, 0, 1.73, 0);
    for (const sx of [-1, 1]) part(parent, 2, DARK, 0.07, 0.1, 0.1, sx * 0.125, 1.6, 0);
    part(parent, 0, DARK, 0.02, 0.02, 0.14, -0.12, 1.55, -0.08, 0, -0.4, 0); // mic boom
    if (armsUp) {
      part(parent, 0, BLACK, 0.09, 0.09, 0.4, 0.2, 1.42, -0.12, 0.6, 0, 0);
      part(parent, 0, BLACK, 0.09, 0.09, 0.42, -0.2, 1.3, -0.2, 0.3, 0, 0);
    } else {
      for (const sx of [-1, 1]) part(parent, 0, BLACK, 0.09, 0.09, 0.45, sx * 0.22, 1.3, -0.2, -0.15, 0, 0);
    }
  };

  /** Thân máy quay broadcast (gốc = tâm thân máy, ống kính hướng -Z). Trả về node ở mặt ống kính. */
  const broadcastCam = (parent: THREE.Object3D, scale = 1) => {
    const s = scale;
    part(parent, 0, GREY, 0.28 * s, 0.32 * s, 0.6 * s, 0, 0, 0);
    part(parent, 0, DARK, 0.2 * s, 0.16 * s, 0.22 * s, 0, 0.22 * s, 0.12 * s); // viewfinder
    part(parent, 1, LENS, 0.2 * s, 0.4 * s, 0.2 * s, 0, 0, -0.48 * s, Math.PI / 2, 0, 0);
    part(parent, 1, DARK, 0.26 * s, 0.1 * s, 0.26 * s, 0, 0, -0.66 * s, Math.PI / 2, 0, 0); // loa che
    part(parent, 0, YELLOW, 0.29 * s, 0.03 * s, 0.4 * s, 0, -0.12 * s, 0); // sọc
    glow(parent, 0xff1a1a, 0, 0.22 * s, -0.16 * s, 0.45);
    return node(parent, 0, 0, -0.72 * s);
  };

  // ── 2 dolly dưới hố ──
  interface Dolly { root: THREE.Object3D; head: THREE.Object3D; lens: THREE.Object3D; x: number; side: number; aim: THREE.Vector3 }
  const dollies: Dolly[] = [];
  for (const side of [-1, 1]) {
    const root = node(world, side * 4, PIT_FLOOR, PIT_Z);
    part(root, 0, DARK, 1.0, 0.14, 0.8, 0, 0.18, 0);
    for (const wx of [-0.42, 0.42]) for (const wz of [-0.32, 0.32]) part(root, 1, BLACK, 0.18, 0.08, 0.18, wx, 0.09, wz, 0, 0, Math.PI / 2);
    part(root, 1, METAL, 0.14, 2.1, 0.14, 0, 1.25, 0);
    part(root, 0, GREY, 0.7, 0.03, 0.03, 0, 1.6, 0.35); // tay đẩy
    part(root, 0, DARK, 0.6, 0.5, 0.06, 0, 0.5, 0.75); // bậc đứng cho người quay
    const head = node(root, 0, 2.45, 0);
    const lens = broadcastCam(head);
    const op = node(root, 0, 0.75, 0.85);
    operator(op);
    dollies.push({ root, head, lens, x: side * 4, side, aim: new THREE.Vector3(0, 1.3, 0) });
  }

  // ── Tháp FOH giữa khán giả ──
  const towerZ = -40;
  const towerX = 7;
  const towerFloor = audienceFloor(towerZ);
  const tower = node(world, towerX, towerFloor, towerZ);
  const TH = 4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(tower, 0, DARK, 0.12, TH, 0.12, sx * 1.1, TH / 2, sz * 1.1);
  for (const sz of [-1, 1]) part(tower, 0, GREY, 2.2, 0.06, 0.06, 0, TH * 0.5, sz * 1.1, 0, 0, 0.9);
  for (const sx of [-1, 1]) part(tower, 0, GREY, 0.06, 0.06, 2.2, sx * 1.1, TH * 0.5, 0, 0.9, 0, 0);
  part(tower, 0, DARK, 2.5, 0.12, 2.5, 0, TH, 0);
  for (const sz of [-1, 1]) part(tower, 0, METAL, 2.5, 0.05, 0.05, 0, TH + 1.0, sz * 1.22);
  for (const sx of [-1, 1]) part(tower, 0, METAL, 0.05, 0.05, 2.5, sx * 1.22, TH + 1.0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(tower, 0, METAL, 0.05, 1.0, 0.05, sx * 1.22, TH + 0.5, sz * 1.22);
  part(tower, 0, 0x101014, 2.5, 0.5, 0.04, 0, TH - 0.3, -1.25); // băng rôn trước tháp
  const towerYaw = node(tower, 0, TH, 0);
  for (const a of [0, 2.1, 4.2]) part(towerYaw, 0, METAL, 0.04, 1.45, 0.04, Math.sin(a) * 0.25, 0.7, Math.cos(a) * 0.25 + 0.1, Math.cos(a) * 0.17, 0, -Math.sin(a) * 0.17);
  const towerHead = node(towerYaw, 0, 1.5, 0.1);
  const towerLens = broadcastCam(towerHead, 1.15);
  const towerOp = node(towerYaw, 0, 0, 0.85);
  operator(towerOp);
  const towerAim = new THREE.Vector3(0, 1.5, -2);

  // ── Người vác máy trên sân khấu ──
  const shoulder = node(world, -5, 0, -2.5);
  operator(shoulder, true);
  const shoulderCamNode = node(shoulder, 0.24, 1.66, -0.12);
  broadcastCam(shoulderCamNode, 0.7);
  const shoulderAim = new THREE.Vector3();

  // ── Cần cẩu jib ở cánh trái hố ──
  const craneBase = new THREE.Vector3(-9.6, PIT_FLOOR, -5.8);
  const crane = node(world, craneBase.x, craneBase.y, craneBase.z);
  for (const a of [0, 2.1, 4.2]) part(crane, 0, DARK, 0.1, 0.1, 1.6, Math.sin(a) * 0.55, 0.08, Math.cos(a) * 0.55, 0, a, 0);
  part(crane, 1, METAL, 0.2, 1.9, 0.2, 0, 1.0, 0);
  const CRANE_PIVOT_Y = 2.0;
  const craneYaw = node(crane, 0, CRANE_PIVOT_Y, 0);
  part(craneYaw, 0, DARK, 0.35, 0.25, 0.35, 0, 0, 0);
  const cranePitch = node(craneYaw, 0, 0, 0);
  const ARM = 7.5;
  part(cranePitch, 0, GREY, 0.14, 0.16, ARM + 2.2, 0, 0, -(ARM - 2.2) / 2);
  part(cranePitch, 0, YELLOW, 0.15, 0.02, ARM + 2.2, 0, 0.09, -(ARM - 2.2) / 2);
  part(cranePitch, 0, BLACK, 0.45, 0.45, 0.6, 0, -0.1, 2.0); // đối trọng
  part(cranePitch, 0, DARK, 0.03, 0.03, ARM, 0, 0.45, -ARM / 2 + 0.2, 0.06, 0, 0); // dây căng
  const craneHead = node(world, 0, 0, 0);
  part(craneHead, 0, DARK, 0.05, 0.4, 0.05, 0, 0.18, 0); // giá treo đầu máy
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
  part(droneBody, 0, 0xd8dce4, 0.32, 0.1, 0.42, 0, 0, 0);
  part(droneBody, 0, DARK, 0.2, 0.06, 0.26, 0, 0.07, 0);
  for (const a of [Math.PI / 4, -Math.PI / 4]) part(droneBody, 0, DARK, 0.05, 0.04, 0.95, 0, 0, 0, 0, a, 0);
  const rotorPos: [number, number][] = [[0.33, 0.33], [-0.33, 0.33], [0.33, -0.33], [-0.33, -0.33]];
  for (const [x, z] of rotorPos) {
    part(droneBody, 1, DARK, 0.05, 0.08, 0.05, x, 0.04, z);
    part(droneBody, 1, 0x9da3b0, 0.42, 0.012, 0.42, x, 0.085, z);
  }
  const ledR = glow(droneBody, 0xff2030, -0.33, -0.03, -0.33, 0.6);
  const ledG = glow(droneBody, 0x20ff60, 0.33, -0.03, -0.33, 0.6);
  const ledB1 = glow(droneBody, 0xff2030, -0.33, -0.03, 0.33, 0.45);
  const ledB2 = glow(droneBody, 0x20ff60, 0.33, -0.03, 0.33, 0.45);
  const gimbal = node(world);
  part(gimbal, 0, DARK, 0.04, 0.2, 0.04, 0, 0.1, 0);
  const gimbalAim = node(gimbal, 0, -0.02, 0);
  part(gimbalAim, 0, 0x202026, 0.16, 0.14, 0.18, 0, 0, 0);
  part(gimbalAim, 1, LENS, 0.09, 0.08, 0.09, 0, 0, -0.12, Math.PI / 2, 0, 0);
  const droneLens = node(gimbalAim, 0, 0, -0.18);
  const droneAim = new THREE.Vector3(0, 1.3, 0);
  let droneS = 0;
  const dronePrev = new THREE.Vector3(0, 10, -15);
  let droneHeading = 0;

  // ── Mesh instanced ──
  const disposables: { dispose(): void }[] = [];
  const geos = [new THREE.BoxGeometry(1, 1, 1), new THREE.CylinderGeometry(0.5, 0.5, 1, 12), new THREE.IcosahedronGeometry(0.5, 1)];
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
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
    flycam: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 },
    pit: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 },
    crane: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 35 },
    wide: { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 },
  };
  let pitIdx = 0;
  const chest = new THREE.Vector3();
  const lead = new THREE.Vector3();
  const prevSinger = new THREE.Vector3(0, EYE, 0);
  const vel = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  let t = 0;
  let first = true;

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
        drone.position.copy(tmp);
        droneBody.rotation.set(-0.12, droneHeading, Math.sin(t * 1.3) * 0.04, 'YXZ');
        gimbal.position.copy(tmp).y -= 0.22 * DS;
        damp(droneAim, lead, 3 * k, ddt);
        const [yy, pp] = aimAngles(gimbal.position, droneAim);
        gimbalAim.rotation.set(pp, yy, 0, 'YXZ');
        const blink = Math.floor(t * 2) % 2 === 0;
        const strobe = (t * 1.1) % 1 < 0.08;
        ledR.color.setHex(blink ? 0xff2030 : 0x300408);
        ledG.color.setHex(!blink ? 0x20ff60 : 0x04300c);
        ledB1.color.setHex(strobe ? 0xffffff : 0x300408);
        ledB2.color.setHex(strobe ? 0xffffff : 0x04300c);
      }

      // Ghi ma trận
      world.updateMatrixWorld(true);
      for (const p of parts) meshes[p.kind].setMatrixAt(p.idx, p.obj.matrixWorld);
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      const tally = 0.75 + 0.25 * Math.sin(t * 6);
      glows.forEach((g, i) => {
        g.obj.getWorldPosition(tmp);
        gPos[i * 3] = tmp.x; gPos[i * 3 + 1] = tmp.y; gPos[i * 3 + 2] = tmp.z;
        const s = g.color.r > 0.9 && g.color.g < 0.2 && g.size < 0.5 ? tally : 1;
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
