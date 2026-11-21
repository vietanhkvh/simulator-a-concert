// "Thép & Lửa" — ca sĩ rock 7,5 đầu đẽo mặt phẳng (gói S2, khe `singer`). STYLE_C §4–5 + preview-C.
// Tóc bạc dài (7 khối, vung theo head-bang), áo khoác da đen + đinh tán vai, áo trong tia sét đỏ, thắt lưng đinh tán,
// quần xám, bốt. Chân mic NGHIÊNG cắm sàn, hai tay nắm chân mic — Hype lên thì một tay rời ra nắm đấm / tay sừng bơm theo
// phách; head-bang ở phách mạnh khi Hype ≥ 0,5 (đỉnh 60 ms, hồi 240 ms), giậm chân, thế đứng rộng; hàm mở theo âm
// lượng, gào ở Hype rất cao. Đi bộ / bay: xách chân mic theo. Tiếp đất (singerSquash): thế "siêu anh hùng" 3 điểm.
// Draw call: thân + chân mic 1 (SkinnedMesh) + quầng follow-spot 1 = 2. Hợp đồng như singer.ts mặc định.
import * as THREE from 'three';
import { EYE_HEIGHT } from '../../../../world/layout';
import { RAMPS, SKIN, hexToRgb } from '../../../../world/style';
import type { ArenaBuilders, SingerAvatar } from '../../builders';
import { singerSquash } from '../../singer';
import { B, K, REST_ABS, RigBatch, aimArm, clamp, hand, heavy, legs, lerpExp, prism, stud, syncChest, updateHair, worldToChest, gem } from './rig';

const V3 = THREE.Vector3;
/** Chân mic: đế ở gốc xương prop, cột theo +Y; micro nối dài cùng trục (tới đầu lưới ở POLE + MIC). */
const POLE = 1.44, MIC = 0.19;

function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  const [r, gg, b] = hexToRgb(RAMPS.tungsten![100]).map((v) => Math.round(v * 255));
  grd.addColorStop(0, `rgba(${r},${gg},${b},0.8)`);
  grd.addColorStop(0.55, `rgba(${r},${gg},${b},0.4)`);
  grd.addColorStop(0.85, `rgba(${r},${gg},${b},0.08)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSteelSinger(scene: THREE.Scene): SingerAvatar {
  const CO = RAMPS.coal!, S = RAMPS.steel!, BL = RAMPS.blood!;
  const batch = new RigBatch();
  const c = batch.addChar({
    skin: SKIN[0]!, hair: 0xd8d3c8, hairStyle: 'long',
    top: 'jacket', topCol: CO[300], shirtCol: CO[500], decal: 'bolt', decalCol: BL[100],
    pants: S[500], ripped: false, boots: CO[700], belt: true, wristbands: true,
  });
  // chân mic (xương prop): đế tròn 5 cạnh, cột thép, kẹp, micro đen đầu lưới thép
  const P = (y: number) => new V3(0, y, 0);
  batch.add(c, prism(P(0), P(0.025), 0.17, 0.15, 7), CO[500], B.prop, K.chrome);
  batch.add(c, prism(P(0.02), P(POLE * 0.55), 0.014, 0.014, 5), S[300], B.prop, K.chrome);
  batch.add(c, prism(P(POLE * 0.55 - 0.02), P(POLE), 0.01, 0.01, 5), S[100], B.prop, K.chrome);
  batch.add(c, prism(P(POLE * 0.55 - 0.03), P(POLE * 0.55 + 0.03), 0.02, 0.02, 6), CO[700], B.prop);
  batch.add(c, prism(P(POLE - 0.01), P(POLE + MIC - 0.05), 0.016, 0.022, 6), CO[700], B.prop, K.leather);
  batch.add(c, gem(P(POLE + MIC - 0.025), 0.03, 0.035, 0.03, 6, 4), S[300], B.prop, K.chrome);
  batch.add(c, stud(P(POLE + 0.05), 0.012), S[100], B.prop, K.chrome);
  batch.build(scene, 'singer-steel');

  const poolTex = poolTexture();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
  const poolGeo = new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.renderOrder = 2; pool.name = 'singerPool';
  scene.add(pool);

  const bn = c.bones;
  const lastPos = new V3(0, EYE_HEIGHT, 0);
  const tgt = new V3(), pole = new V3(), wp = new V3(), hdir = new V3();
  const prop = bn[B.prop]!;
  let t = 0, speedS = 0, walkPhase = 0, mouth = 0, carry = 0, free = 0, air = 0, beatRate = 2, lastBeat = 0, raise = 0;
  let bangT = 9, lastBang = -1, horns = 0;

  /** Điểm trên cột mic (tỉ lệ dọc cột) → khung ngực. */
  const onPole = (k: number, out: THREE.Vector3) => { wp.set(0, POLE * k, 0); prop.localToWorld(wp); return worldToChest(c, wp, out); };

  return {
    update(f, pos, yaw, visible) {
      const dt = Math.max(0, Math.min(f.dt, 0.1));
      t += dt;
      const hype = clamp(f.hype, 0, 1);
      const floorY = pos.y - EYE_HEIGHT;
      const sq = clamp(singerSquash.amount, 0, 1);
      if (dt > 0) {
        const sp = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) / dt;
        speedS = lerpExp(speedS, Math.min(sp, 6), dt, 0.15);
        walkPhase += dt * (1.6 + speedS * 2.2) * Math.PI;
        const br = (f.beat - lastBeat) / dt;
        if (br > 0.5 && br < 6) beatRate = lerpExp(beatRate, br, dt, 0.5);
      }
      lastBeat = f.beat;
      lastPos.copy(pos);
      const walk = clamp(speedS / 1.8, 0, 1);
      const b = Math.max(0, f.beat);
      const airborne = Math.abs(floorY) > 0.3 && sq < 0.05;

      const ground = 1 - THREE.MathUtils.smoothstep(Math.abs(floorY + 0.08 * sq), 0.12, 0.3);
      pool.position.set(pos.x, 0.02, pos.z);
      poolMat.opacity = (0.4 + 0.25 * hype + 0.1 * f.beatPulse) * ground;
      pool.visible = ground > 0.01;

      batch.setVisible(visible);
      if (!visible) return;
      batch.setHype(hype, f.beatPulse);

      const root = bn[B.root]!;
      root.position.set(pos.x, floorY + 0.08 * sq, pos.z);
      root.rotation.y = yaw;
      air = lerpExp(air, airborne ? 1 : 0, dt, 0.12);
      carry = lerpExp(carry, Math.max(walk > 0.25 ? 1 : 0, air > 0.3 ? 1 : 0, sq > 0.05 ? 1 : 0), dt, 0.12);

      // giây kể từ phách gần nhất → đường bao nặng (đỉnh 60 ms, hồi 240 ms)
      const u = (b % 1) / Math.max(0.5, beatRate);
      const hit = heavy(u);
      const groove = (0.4 + 0.6 * hype) * (1 - walk * 0.7) * (1 - air);
      // head-bang ở phách mạnh (Hype ≥ 0,5: mỗi 2 phách; ≥ 0,8: mỗi phách)
      const bi = Math.floor(b);
      if (bi !== lastBang) {
        lastBang = bi;
        if (hype >= 0.5 && walk < 0.4 && !airborne && sq < 0.05 && (hype >= 0.8 || bi % 2 === 0)) bangT = 0;
      }
      bangT += dt;
      const bang = heavy(bangT) * clamp((hype - 0.4) / 0.3, 0, 1);

      // ── thân ──
      const hips = bn[B.hips]!, chest = bn[B.chest]!, neck = bn[B.neck]!, head = bn[B.head]!;
      const sway = Math.sin(b * Math.PI) * 0.05 * groove;
      if (walk > 0.05 && air < 0.5) legs(c, walkPhase, 0.4 + 0.6 * walk, 0.05, 0.05);
      else {
        // thế đứng rộng (power stance) + giậm chân phải theo nhịp 2 phách
        const st = (b % 2);
        const lift = st > 1.55 ? (st - 1.55) / 0.45 : 0;
        legs(c, 0, 0, 0.16 + 0.04 * hype, 0.12 + 0.12 * hype + 0.1 * hit * groove);
        bn[B.thR]!.rotation.x += lift * 0.5 * groove;
        bn[B.shR]!.rotation.x -= lift * 0.6 * groove;
      }
      if (air > 0.01) {
        // bay: co gối, một chân trước một chân sau
        bn[B.thL]!.rotation.x += 0.9 * air; bn[B.shL]!.rotation.x -= 1.4 * air;
        bn[B.thR]!.rotation.x -= 0.2 * air; bn[B.shR]!.rotation.x -= 0.9 * air;
      }
      hips.rotation.set(0, Math.sin(b * Math.PI * 0.5) * 0.08 * groove, sway);
      chest.rotation.set(-0.06 * hit * groove - 0.28 * bang + walk * 0.06, -sway * 0.6, -sway * 0.8);
      neck.rotation.set(-0.25 * bang - 0.03 * hit * groove, 0, 0);
      head.rotation.set(-0.45 * bang - 0.06 * hit * groove + (hype > 0.85 ? 0.12 : 0), Math.sin(t * 0.5) * 0.08 * (1 - bang), Math.sin(t * 0.7) * 0.04);

      // ── tiếp đất 3 điểm: gối trái quỳ, chân phải chống trước, nắm đấm phải chạm sàn, đầu cúi ──
      if (sq > 0.01) {
        const k = sq;
        hips.position.y -= 0.55 * k;
        chest.rotation.x -= 0.85 * k;
        neck.rotation.x -= 0.2 * k; head.rotation.x -= 0.15 * k;
        bn[B.thR]!.rotation.x = THREE.MathUtils.lerp(bn[B.thR]!.rotation.x, 1.55, k);
        bn[B.shR]!.rotation.x = THREE.MathUtils.lerp(bn[B.shR]!.rotation.x, -1.6, k);
        bn[B.thL]!.rotation.x = THREE.MathUtils.lerp(bn[B.thL]!.rotation.x, 0.2, k);
        bn[B.shL]!.rotation.x = THREE.MathUtils.lerp(bn[B.shL]!.rotation.x, -1.75, k);
      }

      // ── chân mic (xương prop, khung nhân vật) ──
      // cắm sàn: đế 0,62 m trước mặt, nghiêng về miệng, rung theo phách khi tay giật
      const tilt = 0.29 + 0.05 * hit * groove * (1 - free * 0.5) - bang * 0.06;
      const standX = 0, standZ = -0.6 - 0.04 * hype;
      // xách: cột dựng chéo bên phải người, đế nhấc khỏi sàn (tiếp đất: tay trái chống chân mic ra ngang)
      const cs = sq > 0.05 ? -1 : 1;
      prop.position.set(
        THREE.MathUtils.lerp(standX, cs * 0.34, carry), THREE.MathUtils.lerp(0, sq > 0.05 ? 0.0 : 0.32, carry), THREE.MathUtils.lerp(standZ, -0.15, carry));
      prop.rotation.set(THREE.MathUtils.lerp(tilt, 0.25, carry), 0, THREE.MathUtils.lerp(0, cs * 0.12, carry));
      syncChest(c);

      // ── tay ──
      // tay rời chân mic theo Hype (nắm đấm / tay sừng bơm theo phách)
      const freeT = carry > 0.5 ? 0 : clamp((hype - 0.35) / 0.3, 0, 1) * (Math.floor(b / 8) % 3 === 2 && hype < 0.8 ? 0 : 1);
      free = lerpExp(free, freeT, dt, 0.18);
      if (Math.floor(b / 4) % 2 === 0 && hype > 0.7) horns = lerpExp(horns, 1, dt, 0.06); else horns = lerpExp(horns, 0, dt, 0.06);
      // tay trái: nắm cột ngay dưới micro (đang đứng) / tay phải cầm khi xách
      const holdL = carry < 0.5 || sq > 0.05;
      if (holdL) {
        onPole(carry > 0.5 ? 0.5 : 0.86, tgt);
        tgt.x -= 0.035;
        aimArm(c, -1, tgt, pole.set(-1, -0.6, 0.1), 0, hdir.set(0.25, -0.25, -1));
        hand(c, -1, 'grip');
      }
      // tay phải
      if (sq > 0.05) {
        // nắm đấm chạm sàn trước gối phải
        wp.set(0.2, 0.1, -0.5); bn[B.root]!.localToWorld(wp); worldToChest(c, wp, tgt);
        aimArm(c, 1, tgt, pole.set(1, 0.2, 0.6), 0, hdir.set(0, -1, 0));
        hand(c, 1, 'fist');
      } else if (carry > 0.5) {
        onPole(0.42, tgt); tgt.x += 0.035;
        aimArm(c, 1, tgt, pole.set(1, -0.6, 0.3), 0, hdir.set(-0.3, -0.2, -1));
        hand(c, 1, 'grip');
        // tay trái tự do: vung theo bước / giơ khi bay
        raise = lerpExp(raise, air, dt, 0.15);
        tgt.set(-0.3 - 0.1 * raise, -0.38 + 0.95 * raise, -0.05 - Math.sin(walkPhase) * 0.18 * (1 - raise));
        aimArm(c, -1, tgt, pole.set(-1, 0.2 * raise - 0.5, 0.2), 0);
        hand(c, -1, raise > 0.5 ? 'horns' : 'fist');
      } else {
        onPole(0.6, tgt); tgt.x += 0.03;
        const raised = new V3(0.24, 0.62 + 0.12 * hit, -0.12 - 0.05 * hit);
        tgt.lerp(raised, free);
        aimArm(c, 1, tgt, pole.set(1, THREE.MathUtils.lerp(-0.6, 0.3, free), 0.4), 0, free > 0.5 ? hdir.set(0.1, 1, -0.2) : hdir.set(-0.25, -0.2, -1));
        hand(c, 1, free < 0.4 ? 'grip' : horns > 0.5 ? 'horns' : 'fist');
      }
      if (sq > 0.05) {
        // tay trái chống chân mic chéo ra ngoài
        onPole(0.45, tgt);
        aimArm(c, -1, tgt, pole.set(-1, 0, 0.3), 0, hdir.set(0, -0.3, -1));
      }

      // hàm: mở theo âm lượng; gào khi Hype rất cao
      const scream = hype > 0.85 ? 0.35 + 0.25 * hit : 0;
      mouth = lerpExp(mouth, clamp(f.level * 1.3 + scream, 0, 1), dt, 0.05);
      bn[B.jaw]!.rotation.x = -0.42 * mouth;
      updateHair(c, dt);
      void REST_ABS;
    },
    dispose() {
      batch.dispose();
      scene.remove(pool);
      poolTex.dispose(); poolMat.dispose(); poolGeo.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { singer: (ctx) => createSteelSinger(ctx.scene) };
