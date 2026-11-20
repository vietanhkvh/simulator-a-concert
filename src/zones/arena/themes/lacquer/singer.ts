// "Mực & Sơn mài" — ca sĩ áo dài son 7,5 đầu (gói L4, khe `singer`). B2 §4, §7; preview-B2.
// Áo dài son hai tà (tà trễ ~200 ms), gấu + cổ + cổ tay khảm vàng, sen vàng trên tà trước, khăn vấn vàng, tóc đen búi
// + đuôi dài, micro vàng ở miệng; tay kia mở dần theo Hype, lắc chậm 2 phách + bước nhỏ, cúi chào giữ ở Hype rất cao.
// Draw call: thân 1 (SkinnedMesh) + quầng đèn 1 = 2. Hợp đồng như singer.ts mặc định (pos = vị trí MẮT, singerSquash).
import * as THREE from 'three';
import { EYE_HEIGHT } from '../../../../world/layout';
import { PAL, SKIN, hexToRgb } from '../../../../world/style';
import type { ArenaBuilders, SingerAvatar } from '../../builders';
import { singerSquash } from '../../singer';
import { B, REST_ABS, RigBatch, aimArm, clamp, easeInOut, legs, lerpExp, tube, ell, updateCloth } from './rig';

const V3 = THREE.Vector3;

function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  const [r, gg, b] = hexToRgb(PAL.honey[100]).map((v) => Math.round(v * 255));
  grd.addColorStop(0, `rgba(${r},${gg},${b},0.75)`);
  grd.addColorStop(0.55, `rgba(${r},${gg},${b},0.36)`);
  grd.addColorStop(0.85, `rgba(${r},${gg},${b},0.08)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createLacquerSinger(scene: THREE.Scene): SingerAvatar {
  const batch = new RigBatch();
  const c = batch.addChar({
    skin: SKIN[1]!, hair: PAL.night[700], hairStyle: 'bunTail', headWear: 'khanVan', headCol: PAL.honey[500],
    top: PAL.berry[500], trim: PAL.honey[300], pants: PAL.cream[500], shoe: PAL.berry[700], hemY: 0.2, lotus: true,
  });
  // micro vàng (thân + đầu lưới tối) trên bàn tay trái, hướng theo cẳng tay
  const W = REST_ABS[B.hdL]!;
  batch.add(c, tube(new V3(W.x, W.y - 0.04, W.z), new V3(W.x, W.y - 0.2, W.z), 0.014, 0.019, 8), PAL.honey[300], B.hdL, 0);
  batch.add(c, ell(new V3(W.x, W.y - 0.225, W.z), 0.026, 0.03, 0.026, 10), PAL.night[300], B.hdL, 0);
  batch.add(c, new THREE.TorusGeometry(0.021, 0.004, 4, 12).rotateX(Math.PI / 2).translate(W.x, W.y - 0.2, W.z), PAL.honey[300], B.hdL, 1);
  batch.build(scene, 'singer-lacquer');

  const poolTex = poolTexture();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
  const poolGeo = new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.renderOrder = 2; pool.name = 'singerPool';
  scene.add(pool);

  const bn = c.bones;
  const lastPos = new V3(0, EYE_HEIGHT, 0);
  const tgt = new V3(), pole = new V3(), micHead = new V3();
  const micDir = new V3(0.16, 0.9, 0.36).normalize();
  let t = 0, speedS = 0, walkPhase = 0, open = 0, bow = 0, mouth = 0, tilt = 0, lift = 0, sway = 0;
  let first = true;

  return {
    update(f, pos, yaw, visible) {
      const dt = Math.max(0, Math.min(f.dt, 0.1));
      t += dt;
      const hype = clamp(f.hype, 0, 1);
      const floorY = pos.y - EYE_HEIGHT;
      if (dt > 0) {
        const sp = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) / dt;
        speedS = lerpExp(speedS, Math.min(sp, 5), dt, 0.15);
        walkPhase += dt * (1.4 + speedS * 2.4) * Math.PI;
      }
      lastPos.copy(pos);
      const walk = clamp(speedS / 2, 0, 1);
      const b = Math.max(0, f.beat);

      const ground = 1 - THREE.MathUtils.smoothstep(Math.abs(floorY), 0.12, 0.3);
      pool.position.set(pos.x, 0.02, pos.z);
      poolMat.opacity = (0.4 + 0.25 * hype + 0.08 * f.beatPulse) * ground;
      pool.visible = ground > 0.01;

      batch.setVisible(visible);
      if (!visible) return;

      const sq = clamp(singerSquash.amount, 0, 1);
      const root = bn[B.root]!;
      root.position.set(pos.x, floorY, pos.z);
      root.rotation.y = yaw;
      if (first) { c.lastRoot.copy(root.position); first = false; }
      // ngồi thụp khi tiếp đất (màn chào sân): gập gối, hạ hông
      const groove = (0.35 + 0.65 * hype) * (1 - walk * 0.7);
      // lắc 2 phách, chậm, mềm
      sway = lerpExp(sway, Math.sin(b * Math.PI * 0.5) * 0.06 * groove, dt, 0.25);
      const hips = bn[B.hips]!;
      hips.position.y = REST_ABS[B.hips]!.y - 0.33 * sq - 0.02 * walk * Math.abs(Math.sin(walkPhase));
      hips.rotation.set(0, Math.sin(b * Math.PI * 0.5) * 0.08 * groove, sway);
      // cúi chào ở Hype rất cao: mỗi 16 phách, giữ ~2 phách
      const bowOn = hype > 0.9 && walk < 0.2 && (b % 16) > 12.5 && (b % 16) < 15.2 ? 1 : 0;
      bow = lerpExp(bow, bowOn, dt, 0.35);
      const chest = bn[B.chest]!;
      chest.rotation.set(0.04 + walk * 0.05 + bow * 0.5 + sq * 0.25 - f.beatPulse * 0.015 * hype, -sway * 0.8, -sway * 1.3);
      // đầu nghiêng ±15° theo cảm xúc, ngẩng khi Hype cao
      tilt = lerpExp(tilt, Math.sin(t * 0.55) * 0.14 + Math.sin(b * Math.PI * 0.25) * 0.06, dt, 0.5);
      lift = lerpExp(lift, (hype - 0.5) * 0.18, dt, 0.8);
      bn[B.neck]!.rotation.set(-lift * 0.4 + bow * 0.2, 0, tilt * 0.4);
      bn[B.head]!.rotation.set(-lift * 0.6 + bow * 0.25, Math.sin(t * 0.37) * 0.12, clamp(tilt, -0.26, 0.26));
      // chân: đi bộ hoặc bước nhỏ theo phách; ngồi thụp gập gối
      if (walk > 0.05) legs(c, walkPhase, 0.5 + 0.6 * walk);
      else legs(c, b * Math.PI * 0.5, 0.18 * groove);
      if (sq > 0.01) {
        bn[B.thL]!.rotation.x += 1.0 * sq; bn[B.thR]!.rotation.x += 0.7 * sq;
        bn[B.shL]!.rotation.x -= 1.7 * sq; bn[B.shR]!.rotation.x -= 1.2 * sq;
      }
      // tay trái: đầu micro ~8 cm trước, ~2 cm dưới môi (khung ngực; miệng nghỉ ở (0; 0,485; -0,088)), thân micro
      // chếch lên–vào miệng, cẳng tay dựng gần thẳng, khuỷu buông xuống – ra ngoài. Đầu micro cách cổ tay 0,225 m.
      micHead.set(-0.005, 0.47 - 0.03 * lift + Math.sin(b * Math.PI) * 0.004 - bow * 0.03, -0.148 - bow * 0.05);
      tgt.copy(micHead).addScaledVector(micDir, -0.225);
      pole.set(-0.55, -1, 0.15);
      aimArm(c, -1, tgt, pole, 0, micDir);
      // tay phải: cử chỉ mở ra chậm, rộng dần theo Hype; đi bộ thì buông đung đưa
      const g = easeInOut(0.5 + 0.5 * Math.sin(b * Math.PI * 0.25 - 1));
      const openT = clamp((hype - 0.1) / 0.7, 0, 1) * (1 - walk) * (1 - bow);
      open = lerpExp(open, openT, dt, 0.6);
      const reach = 0.12 + 0.36 * open * (0.75 + 0.25 * g);
      tgt.set(0.17 + reach, 0.35 - 0.3 * (1 - open) + 0.1 * open + 0.1 * g * open, -0.1 - 0.16 * open - Math.sin(walkPhase) * 0.1 * walk);
      pole.set(1, -1, 0.4);
      aimArm(c, 1, tgt, pole, 0.25 - 0.45 * open);
      // miệng hé theo âm lượng
      mouth = lerpExp(mouth, clamp(f.level * 1.6, 0, 1), dt, 0.06);
      bn[B.mouth]!.scale.set(1 - 0.25 * mouth, 1 + 2.6 * mouth, 1);
      updateCloth(c, dt, t, yaw);
    },
    dispose() {
      batch.dispose();
      scene.remove(pool);
      poolTex.dispose(); poolMat.dispose(); poolGeo.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { singer: (ctx) => createLacquerSinger(ctx.scene) };
