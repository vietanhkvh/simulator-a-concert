// "Đêm Sao Điểm Ảnh" — ca sĩ "hoạ sĩ rock" (gói P4, khe `singer`): sprite-3D chibi 3,2 đầu ≈ 20×32 px ở cự ly cần cẩu.
// Mũ nồi son, áo choàng trắng dính sơn, quần lam Phổ; micro = CỌ VẼ (đầu lông vàng chấm son) giữ trước miệng, tay kia giơ
// theo Hype. Viền mực 1 texel + màu phẳng 4 bước (pixelRig). Hoạt hoạ bước 12 fps. Giữ nguyên hợp đồng singer.ts mặc định:
// update(f, pos, yaw, visible), singerSquash (tiếp đất màn chào sân), bay/cáp (chân co, tay dang), đi bộ, nhảy theo Hype.
// Draw call: thân + viền 2, bóng đổ 1 = 3.
import * as THREE from 'three';
import { EYE_HEIGHT } from '../../../../world/layout';
import type { ArenaBuilders, SingerAvatar } from '../../builders';
import { singerSquash } from '../../singer';
import {
  MOUTH_CHEST, PixelBatch, R, Tick12, aimHold, buildPainter, clamp, hipHeight, leg, reach, resetPose, shadowDisc, worldToChest, SKIN_TONES,
} from './pixelRig';

const V3 = THREE.Vector3;
const BRUSH_LEN = 0.28; // từ tay tới chóp lông
/** Hướng cọ-micro (khung ngực): từ tay chếch lên-phải-ra trước, chóp dừng ngay trước môi. */
const MIC_DIR = new V3(0.22, 0.8, -0.52).normalize();
const MIC_TIP = new V3().copy(MOUTH_CHEST).add(new V3(0.0, -0.05, -0.08));

export function createPixelSinger(scene: THREE.Scene): SingerAvatar {
  const batch = new PixelBatch();
  const ch = buildPainter(batch, {
    skin: SKIN_TONES[0]!, hair: R.dat!['700'], hairStyle: 'long',
    hat: { kind: 'beret', col: R.son!['500'], col2: R.son!['300'] },
    smock: R.may!['100'], sleeve: R.may!['100'], pants: R.pho!['500'], boots: R.pho!['700'],
    scarf: R.crom!['500'], belt: R.dat!['500'],
    splat: [R.son!['500'], R.crom!['500'], R.pho!['300'], R.bach!['300'], R.tim!['300']],
  });
  // cọ-micro trên bàn tay trái (trục +Y): cán gỗ, đai kim loại, lông vàng chrome, chóp son
  const bx = (c: [number, number, number], s: [number, number, number], col: number) => batch.box(ch, 'hdL', c, s, col);
  bx([0, 0, 0], [0.045, 0.24, 0.045], R.dat!['300']);
  bx([0, 0.145, 0], [0.058, 0.05, 0.058], R.may!['500']);
  bx([0, 0.205, 0], [0.085, 0.09, 0.085], R.crom!['500']);
  bx([0, 0.262, 0], [0.07, 0.04, 0.07], R.son!['500']);
  // vệt sơn nhỏ trên bàn tay phải (cọ phụ để ra dáng hoạ sĩ không cầm gì: chỉ cái dải cổ tay)
  batch.box(ch, 'faR', [0, -0.15, 0], [0.105, 0.04, 0.105], R.son!['500'], { hull: false });
  batch.build(scene, 'singer-pixel');
  const sh = shadowDisc(0.36);
  sh.mesh.name = 'singerShadow';
  scene.add(sh.mesh);

  const b = ch.b;
  const tick = new Tick12();
  const lastPos = new V3(0, EYE_HEIGHT, 0);
  const tgt = new V3(), pole = new V3(), dir = new V3(), wp = new V3(), hand = new V3();
  const sNow = { pos: new V3(), yaw: 0, floorY: 0, sq: 0 };
  let t = 0, speedS = 0, walkPhase = 0, air = 0, raise = 0, jy = 0;
  let lastBeat = 0, mouth = 0;

  return {
    update(f, pos, yaw, visible) {
      const dt = Math.max(0, Math.min(f.dt, 0.1));
      t += dt;
      const hype = clamp(f.hype, 0, 1);
      const floorY = pos.y - EYE_HEIGHT;
      const sq = clamp(singerSquash.amount, 0, 1);
      if (dt > 0) {
        const sp = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) / dt;
        speedS += (Math.min(sp, 6) - speedS) * (1 - Math.exp(-8 * dt));
        walkPhase += dt * (1.8 + speedS * 2.2) * Math.PI;
      }
      lastPos.copy(pos);
      sNow.pos.copy(pos); sNow.yaw = yaw; sNow.floorY = floorY; sNow.sq = sq;

      // bóng đổ (luôn ở y = 0,02 của sân khấu): nhỏ dần và mờ khi bay / nhảy cao
      const above = floorY;
      sh.mesh.visible = visible && above > -0.3 && above < 5;
      sh.mesh.position.set(pos.x, 0.02, pos.z);
      sh.mesh.scale.set(1 / (1 + Math.max(0, above) * 0.35), 1, 0.8 / (1 + Math.max(0, above) * 0.35));

      batch.setVisible(visible);
      if (!visible) return;

      const root = b.root!;
      root.position.set(pos.x, floorY + 0.06 * sq + jy, pos.z);
      root.rotation.y = yaw;

      if (!tick.step(dt)) return;
      // ───── khung hình mới (12 fps) ─────
      const walk = clamp(speedS / 1.8, 0, 1);
      const bt = Math.max(0, f.beat);
      const pulse = f.beatPulse;
      const airborne = Math.abs(sNow.floorY) > 0.3 && sq < 0.05;
      air += ((airborne ? 1 : 0) - air) * 0.6;
      const groove = (0.4 + 0.6 * hype) * (1 - walk * 0.7) * (1 - air);
      resetPose(ch);

      // nhảy khi Hype > 0,6 đứng yên: mỗi 2 phách (mỗi phách khi > 0,85) — 4 khung/phách
      const grounded = Math.abs(sNow.floorY) < 0.3 && sq < 0.05;
      jy = 0;
      if (hype > 0.6 && walk < 0.3 && grounded) {
        const per = hype > 0.85 ? 1 : 2;
        const u = bt % per;
        if (u < 1) jy = Math.round(Math.sin(Math.PI * u) * (0.2 + 0.12 * (hype - 0.6) / 0.4) / 0.05) * 0.05;
      }
      root.position.y = sNow.floorY + 0.06 * sq + jy;

      // nhịp nảy 1 texel + nghiêng thân (bậc cứng)
      const bounce = pulse > 0.55 ? 0.05 * groove : 0;
      const sway = Math.round(Math.sin(bt * Math.PI) * 4) / 4 * 0.1 * groove;
      b.chest!.rotation.set(walk * 0.08 + (pulse > 0.55 ? -0.05 * groove : 0), Math.sin(bt * Math.PI * 0.5) > 0 ? 0.1 * hype : -0.1 * hype, -sway);
      b.head!.rotation.set((pulse > 0.55 ? 0.12 : 0) * (0.4 + hype) + (hype > 0.85 ? 0.1 : 0), 0, sway * 0.7);

      // chân: đi bộ / bước theo phách / co gối khi bay / ngồi thụp khi tiếp đất
      let hipsY = 0.46;
      if (sq > 0.01) {
        leg(ch, -1, 1.15 * sq, -1.9 * sq); leg(ch, 1, 1.5 * sq, -1.7 * sq);
        hipsY = hipHeight(1.15 * sq, -1.9 * sq) * sq + 0.46 * (1 - sq);
      } else if (air > 0.3) {
        leg(ch, -1, 0.5, -1.0); leg(ch, 1, -0.15, -0.5);
      } else if (jy > 0.04) {
        leg(ch, -1, 0.35, -0.7); leg(ch, 1, -0.1, -0.2);
      } else if (walk > 0.05) {
        const a = Math.sin(Math.round(walkPhase * 2) / 2) * 0.65 * walk;
        leg(ch, -1, a, Math.min(0, -a * 0.9)); leg(ch, 1, -a, Math.min(0, a * 0.9));
      } else {
        const st = Math.sin(bt * Math.PI) * groove;
        leg(ch, -1, Math.max(0, st) * 0.35, -Math.max(0, st) * 0.5, 0.06 + 0.04 * hype);
        leg(ch, 1, Math.max(0, -st) * 0.35, -Math.max(0, -st) * 0.5, 0.06 + 0.04 * hype);
      }
      b.hips!.position.y = hipsY - bounce;
      if (sq > 0.01) { b.chest!.rotation.x -= 0.5 * sq; b.head!.rotation.x -= 0.2 * sq; }
      root.updateMatrixWorld(true);

      // tay trái: cọ-micro luôn chĩa về miệng (nếu bay: dang tay; đi bộ: cọ hạ thấp một nấc)
      const wob = pulse > 0.55 ? 0.05 : 0;
      if (air > 0.3) {
        reach(ch, -1, tgt.set(-0.55, 0.7, -0.1), pole.set(-1, -0.3, 0.2));
        b.hdL!.quaternion.identity();
      } else {
        dir.copy(MIC_DIR);
        dir.x -= wob * 1.5; dir.y += wob;
        dir.normalize();
        hand.copy(MIC_TIP).addScaledVector(dir, -BRUSH_LEN);
        if (walk > 0.3) hand.y -= 0.06;
        reach(ch, -1, hand, pole.set(-1, -0.7, 0.2));
        aimHold(ch, -1, dir);
      }

      // tay phải: giơ dần theo Hype, bơm theo phách; vẫy khi đi / hype vừa; chạm sàn khi tiếp đất
      const rT = air > 0.3 ? 1 : clamp((hype - 0.25) / 0.5, 0, 1);
      raise += (rT - raise) * 0.45;
      if (sq > 0.05) {
        wp.set(0.22, 0.12, -0.45).applyMatrix4(root.matrixWorld);
        worldToChest(ch, wp, tgt);
        reach(ch, 1, tgt, pole.set(1, 0.1, 0.6));
      } else {
        const pump = pulse > 0.55 ? 0.1 : 0;
        const wave = hype > 0.45 && Math.floor(bt / 4) % 2 === 1 ? Math.round(Math.sin(bt * Math.PI * 2) * 2) / 2 * 0.1 : 0;
        const sw = walk > 0.3 && raise < 0.5 ? Math.round(Math.sin(walkPhase * 0.5 + Math.PI) * 2) / 2 * 0.2 : 0;
        tgt.set(0.2 + 0.1 * raise + wave, -0.2 + 0.95 * raise + pump * raise, -0.05 + sw);
        reach(ch, 1, tgt, pole.set(1, -0.4, 0.3));
      }

      // miệng: mở theo âm lượng (3 mức), hét khi Hype rất cao
      const open = clamp(f.level * 1.3 + (hype > 0.85 ? 0.35 + (pulse > 0.55 ? 0.25 : 0) : 0), 0, 1);
      mouth = Math.round(open * 2) / 2;
      b.mouth!.scale.set(1 + 0.3 * mouth, 1 + 3 * mouth, 1);
      lastBeat = bt; void lastBeat;
    },
    dispose() {
      batch.dispose();
      sh.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { singer: (ctx) => createPixelSinger(ctx.scene) };
