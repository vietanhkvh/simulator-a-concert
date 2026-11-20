// Ca sĩ (avatar người chơi) để các góc máy bên ngoài nhìn thấy ai đang trên sân khấu.
// Low-poly, vật liệu không cần đèn (MeshBasic) + viền phát sáng; vòng follow-spot cộng màu dưới chân.
// Ẩn thân người ở góc nhìn thứ nhất (visible=false) để không che tầm nhìn người chơi.
import { EYE_HEIGHT } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';

export interface SingerAvatar {
  /** pos = vị trí MẮT ca sĩ (y ≈ 1,65, như controls.getSingerPose()); yaw: 0 = nhìn -Z. */
  update(f: FrameState, pos: THREE.Vector3, yaw: number, visible: boolean): void;
  dispose(): void;
}

const EYE = EYE_HEIGHT;

function radialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSinger(scene: THREE.Scene): SingerAvatar {
  const disposables: { dispose(): void }[] = [];
  const M = (color: number) => {
    const m = new THREE.MeshBasicMaterial({ color });
    disposables.push(m);
    return m;
  };
  const G = <T extends THREE.BufferGeometry>(g: T) => { disposables.push(g); return g; };

  const jacket = M(0xd0207a);
  const jacketDark = M(0x8a1050);
  const trim = M(0x5ff8ff);
  const gold = M(0xffd34d);
  const pants = M(0x15131f);
  const boots = M(0xf2f2f8);
  const skin = M(0xe0a985);
  const hair = M(0xf6e7b8);
  const micM = M(0x2a2a30);
  const micHead = M(0xb8bcc8);

  const box = G(new THREE.BoxGeometry(1, 1, 1));
  const cyl = G(new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
  const sph = G(new THREE.IcosahedronGeometry(0.5, 1));

  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D,
    sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const pivot = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  const root = new THREE.Group();
  root.name = 'singer';
  const body = pivot(root, 0, 0, 0); // nhún/nhảy
  // Chân
  const legs: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const hip = pivot(body, sx * 0.1, 0.92, 0);
    mk(box, pants, hip, 0.15, 0.82, 0.17, 0, -0.41, 0);
    mk(box, trim, hip, 0.03, 0.7, 0.18, sx * 0.075, -0.4, 0); // sọc phát sáng bên hông
    mk(box, boots, hip, 0.17, 0.14, 0.28, 0, -0.85, -0.04);
    legs.push(hip);
  }
  const upper = pivot(body, 0, 0.95, 0); // thân trên (xoay/lắc)
  mk(box, pants, upper, 0.34, 0.16, 0.21, 0, 0, 0);
  mk(box, gold, upper, 0.36, 0.05, 0.23, 0, 0.08, 0); // thắt lưng
  mk(cyl, jacket, upper, 0.36, 0.52, 0.27, 0, 0.36, 0).scale.set(0.38, 0.52, 0.26);
  mk(box, trim, upper, 0.05, 0.48, 0.02, -0.07, 0.36, -0.135); // sọc ngực
  mk(box, trim, upper, 0.05, 0.48, 0.02, 0.07, 0.36, -0.135);
  mk(box, jacketDark, upper, 0.5, 0.1, 0.27, 0, 0.58, 0); // vai
  mk(box, trim, upper, 0.52, 0.025, 0.28, 0, 0.635, 0);
  mk(cyl, skin, upper, 0.09, 0.08, 0.09, 0, 0.67, 0);
  const head = pivot(upper, 0, 0.78, 0);
  mk(sph, skin, head, 0.2, 0.24, 0.21, 0, 0, 0);
  mk(sph, hair, head, 0.23, 0.2, 0.24, 0, 0.06, 0.02);
  mk(sph, hair, head, 0.18, 0.3, 0.12, 0, -0.08, 0.1); // tóc sau gáy
  mk(box, trim, head, 0.17, 0.035, 0.03, 0, 0.02, -0.1); // kính/viền mắt phát sáng

  const arm = (side: number) => {
    const sh = pivot(upper, side * 0.27, 0.56, 0);
    mk(box, jacket, sh, 0.1, 0.3, 0.1, 0, -0.15, 0);
    mk(box, trim, sh, 0.11, 0.04, 0.11, 0, -0.27, 0);
    const el = pivot(sh, 0, -0.3, 0);
    mk(box, skin, el, 0.075, 0.27, 0.075, 0, -0.135, 0);
    const hand = pivot(el, 0, -0.29, 0);
    mk(sph, skin, hand, 0.09, 0.09, 0.09, 0, 0, 0);
    return { sh, el, hand };
  };
  const micArm = arm(1); // tay phải cầm micro
  const freeArm = arm(-1);
  // Micro: cán theo trục dọc cẳng tay, đầu micro hướng về miệng
  mk(cyl, micM, micArm.hand, 0.04, 0.17, 0.04, 0, -0.05, 0);
  mk(sph, micHead, micArm.hand, 0.065, 0.065, 0.065, 0, -0.15, 0);
  mk(cyl, gold, micArm.hand, 0.045, 0.02, 0.045, 0, -0.11, 0);

  scene.add(root);

  // Follow-spot: vòng sáng trên sàn + quầng mờ
  const poolTex = radialTexture([[0, 'rgba(255,245,225,0.85)'], [0.55, 'rgba(255,235,205,0.45)'], [0.8, 'rgba(255,225,190,0.12)'], [1, 'rgba(255,220,180,0)']]);
  disposables.push(poolTex);
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7,
  });
  disposables.push(poolMat);
  const poolGeo = G(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2));
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.renderOrder = 2;
  scene.add(pool);

  const lastPos = new THREE.Vector3(0, EYE, 0);
  let walkPhase = 0;
  let speedS = 0;
  let t = 0;
  let freeRaise = 0;

  return {
    update(f, pos, yaw, visible) {
      const dt = Math.max(0, Math.min(f.dt, 0.1));
      t += dt;
      const hype = THREE.MathUtils.clamp(f.hype, 0, 1);
      const floorY = pos.y - EYE;
      pool.position.set(pos.x, floorY + 0.02, pos.z);
      poolMat.opacity = 0.5 + 0.25 * hype + 0.15 * f.beatPulse;
      pool.scale.setScalar(1 + 0.06 * f.beatPulse);

      root.visible = visible;
      if (dt > 0) {
        const sp = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) / dt;
        speedS += (Math.min(sp, 5) - speedS) * (1 - Math.exp(-8 * dt));
        walkPhase += dt * (2 + speedS * 2.2);
      }
      lastPos.copy(pos);
      if (!visible) return;

      root.position.set(pos.x, floorY, pos.z);
      root.rotation.y = yaw;
      const b = f.beat * Math.PI;
      const walk = Math.min(1, speedS / 2.5);
      const groove = (0.35 + 0.65 * hype) * (1 - walk * 0.6);
      // Nhún theo phách, nhảy ở hype cao
      const jump = hype > 0.75 ? f.beatPulse * 0.14 * ((hype - 0.75) / 0.25) : 0;
      body.position.y = -Math.abs(Math.sin(b)) * 0.05 * groove + jump;
      body.rotation.z = Math.sin(b) * 0.05 * groove;
      upper.rotation.y = Math.sin(b * 0.5) * 0.22 * hype;
      upper.rotation.x = -0.04 - f.beatPulse * 0.04 * hype;
      // Bước chân: đi bộ hoặc bước tại chỗ theo phách
      const step = Math.sin(walkPhase * Math.PI) * 0.45 * walk + Math.sin(b) * 0.18 * groove * (1 - walk);
      legs[0].rotation.x = step;
      legs[1].rotation.x = -step;
      // Đầu gật theo phách
      head.rotation.x = -f.beatPulse * 0.18 * (0.4 + hype) + 0.05;
      head.rotation.y = Math.sin(t * 0.7) * 0.15;
      // Tay cầm micro đưa lên miệng
      micArm.sh.rotation.set(1.05 + Math.sin(b) * 0.04, -0.35, -0.3);
      micArm.el.rotation.set(1.95, 0, 0.25);
      micArm.hand.rotation.set(-0.2, 0, 0.5);
      // Tay tự do: giơ lên theo hype, vung theo phách
      const target = THREE.MathUtils.clamp((hype - 0.3) / 0.6, 0, 1);
      freeRaise += (target - freeRaise) * (1 - Math.exp(-3 * dt));
      const pump = f.beatPulse * (0.15 + 0.35 * hype);
      if (walk > 0.3 && freeRaise < 0.5) {
        freeArm.sh.rotation.set(-step * 0.8, 0, -0.12);
        freeArm.el.rotation.set(0.3, 0, 0);
      } else {
        freeArm.sh.rotation.set(0.3 + freeRaise * 2.4 + pump, 0, -0.25 - freeRaise * 0.35);
        freeArm.el.rotation.set(0.4 - freeRaise * 0.3 + pump * 0.5, 0, 0);
      }
    },
    dispose() {
      scene.remove(root);
      scene.remove(pool);
      for (const d of disposables) d.dispose();
    },
  };
}
