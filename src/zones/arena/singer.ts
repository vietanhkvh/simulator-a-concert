// Ca sĩ (avatar người chơi) cho các góc máy bên ngoài — chibi 2,3 đầu (STYLE_GUIDE "Ca sĩ").
// Dựng bằng chibiRig: 3 draw call (thân toy-shader, mặt atlas, viền ink) + 1 vòng follow-spot = 4.
// Tóc vàng + nơ soda, áo berry có sao honey + thắt lưng soda, micro honey mập ở miệng, tay kia giơ theo Hype.
// Ẩn thân người ở góc nhìn thứ nhất (visible=false) để không che tầm nhìn người chơi.
import * as THREE from 'three';
import { EYE_HEIGHT } from '../../world/layout';
import { HAIR, PAL, SKIN, SQUASH } from '../../world/style';
import type { FrameState } from '../../core/types';
import { ChibiBatch, RIG, aimArm, armDir, beatSquash, exprByHype, jumpCurve, lag, type Expr } from './chibiRig';

export interface SingerAvatar {
  /** pos = vị trí MẮT ca sĩ (y ≈ 1,65, như controls.getSingerPose()); yaw: 0 = nhìn -Z. */
  update(f: FrameState, pos: THREE.Vector3, yaw: number, visible: boolean): void;
  dispose(): void;
}

const EYE = EYE_HEIGHT;

/** Squash tiếp đất do màn chào sân (entrance.ts) đặt mỗi frame, 0..1: 1 = ngồi thụp (thấp 35%, bè 20%).
 * Kênh phụ cùng khu, giữ nguyên chữ ký update(); entrance.update chạy trước singer.update. */
export const singerSquash = { amount: 0 };
const SCALE = 1.04; // ≈ 1,67 m tính cả nơ

function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  const [r, gg, b] = [(PAL.cream[300] >> 16) & 255, (PAL.cream[300] >> 8) & 255, PAL.cream[300] & 255];
  grd.addColorStop(0, `rgba(${r},${gg},${b},0.8)`);
  grd.addColorStop(0.6, `rgba(${r},${gg},${b},0.42)`);
  grd.addColorStop(0.82, `rgba(${r},${gg},${b},0.12)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSinger(scene: THREE.Scene): SingerAvatar {
  const batch = new ChibiBatch({ maxChars: 1, name: 'singer' });
  const c = batch.addChar({
    skin: SKIN[0]!, hair: HAIR[4]!, hairStyle: 'bob',
    top: PAL.berry[500], bottom: PAL.night[100], shoe: PAL.cream[500], trim: PAL.soda[300],
    accessory: 'bow', accColor: PAL.soda[500], motif: 'star', motifColor: PAL.honey[500],
    heldL: 'mic',
  }, 0, 0, 0);
  batch.build(scene);
  c.root.scale.setScalar(SCALE);

  // Follow-spot: quầng kem trên sàn sân khấu (y = 0), mờ dần khi ca sĩ bay / hạ dưới sàn
  const poolTex = poolTexture();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 });
  const poolGeo = new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.renderOrder = 2;
  pool.name = 'singerPool';
  scene.add(pool);

  const lastPos = new THREE.Vector3(0, EYE, 0);
  const micTarget = new THREE.Vector3(), micDir = new THREE.Vector3(0.12, 0.9, -0.32).normalize();
  const jmp = { y: 0, sx: 1, sy: 1 };
  let walkPhase = 0, speedS = 0, t = 0, freeRaise = 0, headRoll = 0, headYaw = 0;

  return {
    update(f, pos, yaw, visible) {
      const dt = Math.max(0, Math.min(f.dt, 0.1));
      t += dt;
      const hype = THREE.MathUtils.clamp(f.hype, 0, 1);
      const floorY = pos.y - EYE;
      if (dt > 0) {
        const sp = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) / dt;
        speedS += (Math.min(sp, 5) - speedS) * (1 - Math.exp(-8 * dt));
        walkPhase += dt * (2 + speedS * 2.2);
      }
      lastPos.copy(pos);
      const walk = Math.min(1, speedS / 2.5);
      const b = Math.max(0, f.beat);

      // Nhảy (Hype > 0,6, đứng yên): mỗi 2 phách, Hype > 0,85 mỗi phách
      const jumpOn = hype > SQUASH.jumpHype && walk < 0.3 && Math.abs(floorY) < 0.3;
      let jy = 0, sx: number, sy: number;
      if (jumpOn) {
        const per = hype > 0.85 ? 1 : 2;
        const u = (b % per) / 1; // cú nhảy chiếm 1 phách đầu của chu kỳ
        if (u < 1) {
          jumpCurve(u, 0.16 + 0.14 * (hype - 0.6) / 0.4, jmp);
          jy = jmp.y; sx = jmp.sx; sy = jmp.sy;
        } else [sx, sy] = beatSquash(b, 0.6 + 0.4 * hype);
      } else [sx, sy] = beatSquash(b, (0.4 + 0.6 * hype) * (1 - walk * 0.5));

      // Quầng sáng: ẩn khi chân cách sàn sân khấu (y = 0) quá ~0,3 m
      const footY = floorY + jy;
      const ground = 1 - THREE.MathUtils.smoothstep(Math.abs(footY), 0.12, 0.3);
      pool.position.set(pos.x, 0.02, pos.z);
      poolMat.opacity = (0.45 + 0.25 * hype + 0.12 * f.beatPulse) * ground;
      pool.visible = ground > 0.01;
      pool.scale.setScalar(1 + 0.06 * f.beatPulse);

      batch.setVisible(visible);
      if (!visible) return;
      batch.setHype(hype, f.beatPulse);

      const groove = (0.35 + 0.65 * hype) * (1 - walk * 0.6);
      c.root.position.set(pos.x, floorY, pos.z);
      c.root.rotation.y = yaw;
      c.body.position.y = jy / SCALE;
      const sq = THREE.MathUtils.clamp(singerSquash.amount, 0, 1);
      c.body.scale.set(sx * (1 + 0.2 * sq), sy * (1 - 0.35 * sq), sx * (1 + 0.2 * sq));
      const sway = Math.sin(b * Math.PI) * 0.07 * groove;
      c.body.rotation.set(0, 0, sway);
      c.upper.rotation.set(-0.03 - f.beatPulse * 0.04 * hype + walk * 0.08, Math.sin(b * Math.PI * 0.5) * 0.2 * hype, sway * 0.4);
      // đầu: lắc trễ ~70 ms, ±8°
      headRoll = lag(headRoll, -sway * 1.6 + Math.sin(t * 1.3) * 0.04, dt);
      headYaw = lag(headYaw, Math.sin(t * 0.7) * 0.12, dt, 0.2);
      c.head.rotation.set(0.04 - f.beatPulse * 0.08 * (0.4 + hype), headYaw, THREE.MathUtils.clamp(headRoll, -0.14, 0.14));

      // chân: đi bộ, hoặc bước tại chỗ theo phách
      const stepW = Math.sin(walkPhase * Math.PI) * 0.7 * walk;
      const stepB = Math.sin(b * Math.PI) * (1 - walk);
      c.legL.rotation.set(stepW + Math.max(0, stepB) * 0.35 * groove, 0, -0.05);
      c.legR.rotation.set(-stepW + Math.max(0, -stepB) * 0.35 * groove, 0, 0.05);
      if (jy > 0.02) { c.legL.rotation.x = 0.35; c.legR.rotation.x = -0.15; }

      // tay trái: micro honey ở cạnh miệng (khung upper)
      micTarget.set(-0.11, RIG.headY - RIG.waistY - 0.16 + Math.sin(b * Math.PI) * 0.01, -0.44).addScaledVector(micDir, -0.2);
      aimArm(c, 0, micTarget, micDir);
      // tay phải: giơ dần theo Hype, bơm theo phách; đi bộ thì vung
      const target = THREE.MathUtils.clamp((hype - 0.25) / 0.55, 0, 1);
      freeRaise += (target - freeRaise) * (1 - Math.exp(-3 * dt));
      const pump = f.beatPulse * (0.15 + 0.35 * hype);
      if (walk > 0.3 && freeRaise < 0.5) armDir(c, 1, 0.25, -1, stepW * 1.2);
      else {
        const up = -1 + 2.6 * freeRaise + pump;
        armDir(c, 1, 0.45 + 0.35 * freeRaise, up, 0.25 + 0.2 * (1 - freeRaise));
      }

      // mặt: hát chữ "O" theo âm lượng, chớp mắt; Hype cao xen biểu cảm phấn khích
      const singing = f.level > 0.12;
      let ex: Expr = singing ? 'sing' : exprByHype(hype, b, 0);
      if (singing && hype > 0.8 && Math.floor(b) % 8 === 7) ex = 'excited';
      const open = THREE.MathUtils.clamp(f.level * 1.5, 0, 1) * (0.55 + 0.45 * Math.abs(Math.sin(t * 13)));
      batch.setFace(c, ex, dt, open);
    },
    dispose() {
      batch.dispose();
      scene.remove(pool);
      poolTex.dispose(); poolMat.dispose(); poolGeo.dispose();
    },
  };
}
