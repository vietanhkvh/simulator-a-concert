// "Mực & Sơn mài" — ban nhạc dân tộc (gói L4, khe `band`): 6 nhạc công rig 7,5 đầu ở đúng vị trí ban nhạc mặc định
// (stageDecoLayout / band.ts), nhạc cụ tự vẽ: trống son đinh vàng, đàn nguyệt, đàn bầu, đàn tranh, sáo trúc, sênh tiền.
// Áo the / áo dài chàm · ngọc · vàng, khăn đóng / khăn vấn. Toàn bộ = 1 SkinnedMesh → 1 draw call.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { PAL, SKIN } from '../../../../world/style';
import type { ArenaBuilders, Band } from '../../builders';
import { B, REST_ABS, RigBatch, aimArm, box, clamp, easeInOut, ell, legs, lerpExp, lotusGeo, tube, updateCloth, type RigChar, type RigLook } from './rig';

const V3 = THREE.Vector3;
type Kind = 'drum' | 'nguyet' | 'bau' | 'tranh' | 'sao' | 'senh';
interface Spec { kind: Kind; x: number; y: number; z: number; yaw: number; look: RigLook }

const CH = REST_ABS[B.chest]!; // ngực (khung nhân vật)
/** Đổi điểm khung nhân vật → khung ngực (lúc nghỉ). */
const toChest = (p: THREE.Vector3) => p.clone().sub(CH);

function specs(): Spec[] {
  const base = { skin: SKIN[1]!, hair: PAL.night[700], trim: PAL.honey[300], pants: PAL.cream[500], shoe: PAL.night[300] };
  return [
    { kind: 'drum', x: -6.5, y: 0.45, z: 1.32, yaw: 0.05, look: { ...base, skin: SKIN[2]!, hairStyle: 'short', headWear: 'khanDong', headCol: PAL.grape[700], top: PAL.grape[500], hemY: 0.55 } },
    { kind: 'nguyet', x: -9.9, y: 0, z: 1.15, yaw: -0.32, look: { ...base, hairStyle: 'short', headWear: 'khanDong', headCol: PAL.mint[700], top: PAL.mint[500], hemY: 0.5 } },
    { kind: 'bau', x: 9.9, y: 0, z: 1.15, yaw: 0.32, look: { ...base, skin: SKIN[3]!, hairStyle: 'short', headWear: 'khanDong', headCol: PAL.grape[700], top: PAL.honey[500], trim: PAL.berry[500], hemY: 0.5 } },
    { kind: 'tranh', x: 6.5, y: 0.3, z: 1.74, yaw: -0.08, look: { ...base, skin: SKIN[0]!, hairStyle: 'bunTail', headWear: 'khanVan', headCol: PAL.honey[500], top: PAL.mint[500], hemY: 0.25 } },
    { kind: 'sao', x: -2.8, y: 0, z: -0.82, yaw: 0.1, look: { ...base, hairStyle: 'short', headWear: 'khanDong', headCol: PAL.grape[700], top: PAL.grape[500], hemY: 0.5 } },
    { kind: 'senh', x: 2.8, y: 0, z: -0.82, yaw: -0.1, look: { ...base, skin: SKIN[0]!, hairStyle: 'bun', headWear: 'khanVan', headCol: PAL.berry[500], top: PAL.honey[500], trim: PAL.berry[500], hemY: 0.25 } },
  ];
}

interface Mus { s: Spec; c: RigChar; seed: number; inst: Record<string, THREE.Vector3> }

export function createLacquerBand(scene: THREE.Scene): Band {
  const batch = new RigBatch();
  const mus: Mus[] = [];
  const son = PAL.berry[500], gold = PAL.honey[500], goldHi = PAL.honey[300], wood = PAL.night[100], dark = PAL.night[300], silk = PAL.cream[500];

  specs().forEach((s, i) => {
    const c = batch.addChar(s.look);
    const inst: Record<string, THREE.Vector3> = {};
    const add = (g: THREE.BufferGeometry, col: number, bone: number, kind = 0) => batch.add(c, g, col, bone, kind);
    const hd = (side: -1 | 1) => REST_ABS[side < 0 ? B.hdL : B.hdR]!;
    // bục sơn then viền vàng dưới chân (thay riser mặc định nếu L1 bỏ đi)
    if (s.y > 0.01) {
      add(box(new V3(0, -s.y / 2, -0.15), 1.5, s.y, 1.3), PAL.night[500], B.root);
      add(box(new V3(0, -0.012, -0.8), 1.5, 0.024, 0.02), gold, B.root, 1);
    }
    if (s.kind === 'drum') {
      // trống son: thân tang trống phình, mặt da vỏ trứng, hai vòng đinh vàng, giá 3 chân
      const C = new V3(0, 0.82, -0.5), tilt = 0.5;
      const prof = [0, 0.3, 0.6, 0.9, 1].map((t) => new THREE.Vector2(0.3 + 0.05 * Math.sin(t * Math.PI), (t - 0.5) * 0.46));
      const body = new THREE.LatheGeometry(prof, 22).rotateX(-tilt).translate(C.x, C.y, C.z);
      add(body, son, B.root);
      for (const sy of [-1, 1]) {
        const ctr = new V3(0, sy * 0.23, 0).applyAxisAngle(new V3(1, 0, 0), -tilt).add(C);
        add(new THREE.CircleGeometry(0.295, 22).rotateX(sy > 0 ? -Math.PI / 2 : Math.PI / 2).rotateX(-tilt).translate(ctr.x, ctr.y, ctr.z), silk, B.root);
        add(new THREE.TorusGeometry(0.3, 0.012, 4, 26).rotateX(Math.PI / 2).rotateX(-tilt).translate(ctr.x, ctr.y, ctr.z), gold, B.root, 1);
        if (sy > 0) inst.head = ctr;
      }
      add(lotusGeo(new V3(0, C.y, C.z - 0.33), 0.07), gold, B.root, 1);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        add(tube(new V3(Math.sin(a) * 0.18, 0.62, C.z + Math.cos(a) * 0.12), new V3(Math.sin(a) * 0.36, 0.0, C.z + Math.cos(a) * 0.3), 0.02, 0.02, 6), wood, B.root);
      }
      for (const sd of [-1, 1] as const) {
        const W = hd(sd);
        add(tube(new V3(W.x, W.y - 0.06, W.z), new V3(W.x, W.y - 0.42, W.z), 0.011, 0.009, 6), goldHi, sd < 0 ? B.hdL : B.hdR);
      }
    } else if (s.kind === 'nguyet') {
      // đàn nguyệt: bầu tròn + cần dài gắn ngực
      const body = new V3(0.07, 1.02, -0.17), dir = new V3(-0.72, 0.62, -0.1).normalize();
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 22).rotateX(Math.PI / 2).translate(body.x, body.y, body.z), wood, B.chest);
      add(new THREE.CircleGeometry(0.15, 22).rotateY(Math.PI).translate(body.x, body.y, body.z - 0.027), PAL.honey[700], B.chest);
      add(new THREE.TorusGeometry(0.17, 0.008, 4, 24).translate(body.x, body.y, body.z - 0.026), gold, B.chest, 1);
      const tip = body.clone().addScaledVector(dir, 0.8);
      add(tube(body.clone().addScaledVector(dir, 0.15), tip, 0.022, 0.018, 6), wood, B.chest);
      add(ell(tip, 0.035, 0.05, 0.03, 8), son, B.chest);
      inst.neck = toChest(body.clone().addScaledVector(dir, 0.48));
      inst.strum = toChest(body.clone().add(new V3(0.04, -0.02, -0.08)));
    } else if (s.kind === 'bau') {
      // đàn bầu: hộp dài trên giá, cần (vòi) + bầu ở đầu trái
      const z = -0.36, y = 0.82;
      add(box(new V3(0.05, y, z), 1.0, 0.09, 0.13), wood, B.root);
      add(box(new V3(0.05, y + 0.047, z), 1.0, 0.006, 0.135), son, B.root);
      add(box(new V3(0.05, y + 0.052, z), 1.0, 0.004, 0.006), gold, B.root, 1);
      for (const sx of [-0.35, 0.45]) add(tube(new V3(sx, y - 0.05, z), new V3(sx, 0, z), 0.018, 0.022, 6), dark, B.root);
      add(tube(new V3(-0.38, y + 0.05, z), new V3(-0.4, y + 0.42, z - 0.04), 0.012, 0.008, 6), wood, B.root);
      add(ell(new V3(-0.38, y + 0.2, z), 0.06, 0.05, 0.06, 10), PAL.honey[700], B.root);
      add(tube(new V3(-0.4, y + 0.38, z - 0.04), new V3(0.52, y + 0.055, z), 0.002, 0.002, 3), PAL.honey[100], B.root, 1);
      inst.rod = toChest(new V3(-0.36, y + 0.34, z - 0.04));
      inst.pluck = toChest(new V3(0.32, y + 0.12, z - 0.02));
    } else if (s.kind === 'tranh') {
      // đàn tranh: thân dài cong trên giá thấp, dây vàng
      const z = -0.42, y = 0.66;
      const g = new THREE.CylinderGeometry(0.17, 0.17, 1.2, 14, 1, false, -0.6, 1.2).rotateZ(Math.PI / 2).scale(1, 0.35, 1).translate(0, y - 0.03, z);
      add(g, wood, B.root);
      add(box(new V3(0, y - 0.06, z), 1.2, 0.04, 0.3), son, B.root);
      for (let k = 0; k < 5; k++) add(box(new V3(0, y + 0.03, z - 0.1 + k * 0.05), 1.15, 0.003, 0.003), PAL.honey[100], B.root, 1);
      for (const sx of [-0.45, 0.45]) add(tube(new V3(sx, y - 0.08, z), new V3(sx, 0, z), 0.02, 0.025, 6), dark, B.root);
      inst.left = toChest(new V3(-0.15, y + 0.06, z + 0.02));
      inst.right = toChest(new V3(0.25, y + 0.06, z));
    } else if (s.kind === 'sao') {
      // sáo trúc ngang, từ miệng sang phải
      const a = new V3(-0.06, 1.535, -0.13), b = new V3(0.5, 1.47, -0.2);
      add(tube(a, b, 0.012, 0.011, 8), PAL.honey[700], B.chest);
      for (const t of [0.05, 0.97]) add(new THREE.TorusGeometry(0.0125, 0.003, 3, 10).rotateY(Math.PI / 2).rotateZ(-0.11).translate(...a.clone().lerp(b, t).toArray()), gold, B.chest, 1);
      inst.h1 = toChest(a.clone().lerp(b, 0.42).add(new V3(0, -0.04, 0.0)));
      inst.h2 = toChest(a.clone().lerp(b, 0.72).add(new V3(0, -0.04, 0.0)));
    } else {
      // sênh tiền: hai thanh gỗ có tiền đồng vàng, gõ trước ngực
      for (const sd of [-1, 1] as const) {
        const W = hd(sd);
        add(box(new V3(W.x, W.y - 0.2, W.z), 0.035, 0.3, 0.02), wood, sd < 0 ? B.hdL : B.hdR);
        add(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 10).rotateX(Math.PI / 2).translate(W.x, W.y - 0.28, W.z - 0.012), gold, sd < 0 ? B.hdL : B.hdR, 1);
      }
    }
    mus.push({ s, c, seed: i * 1.37, inst });
  });
  batch.build(scene, 'band-lacquer');
  for (const m of mus) {
    const r = m.c.bones[B.root]!;
    r.position.set(m.s.x, m.s.y, m.s.z);
    r.rotation.y = m.s.yaw;
    m.c.lastRoot.copy(r.position);
  }

  const tgt = new V3(), pole = new V3();
  let t = 0;
  return {
    update(f: FrameState) {
      const dt = Math.max(0, Math.min(f.dt, 0.1));
      t += dt;
      const hype = clamp(f.hype, 0, 1);
      const b = Math.max(0, f.beat);
      for (const m of mus) {
        const { c, s, inst, seed } = m;
        const bn = c.bones;
        const groove = 0.4 + 0.6 * hype;
        const sw = Math.sin((b + seed * 0.3) * Math.PI * 0.5);
        bn[B.hips]!.rotation.set(0, sw * 0.04 * groove, sw * 0.035 * groove);
        bn[B.chest]!.rotation.set(0.05 + f.beatPulse * 0.02 * groove, -sw * 0.04, -sw * 0.03 * groove);
        bn[B.head]!.rotation.set(0.06 + Math.sin(b * Math.PI) * 0.03 * groove, Math.sin(t * 0.4 + seed) * 0.1, Math.sin(t * 0.5 + seed) * 0.12);
        bn[B.mouth]!.scale.set(1, s.kind === 'senh' ? 1 + 2 * clamp(f.level, 0, 1) * (0.5 + 0.5 * Math.sin(t * 9)) : 1, 1);
        legs(c, b * Math.PI * 0.5, s.kind === 'drum' ? 0.05 : 0.1 * groove);
        const ph = b % 1;
        if (s.kind === 'drum') {
          // hai dùi luân phiên, chạm đúng phách
          const hT = inst.head!.clone().sub(CH);
          for (const sd of [-1, 1] as const) {
            const mine = (Math.floor(b) % 2 === 0) === (sd < 0);
            const up = mine ? easeInOut(Math.min(1, ph * 1.6)) * (0.12 + 0.12 * hype) : 0.05;
            tgt.set(sd * 0.21, hT.y + 0.16 + up, -0.3);
            pole.set(sd, 0.25, 0.3);
            aimArm(c, sd, tgt, pole, 0);
          }
        } else if (s.kind === 'nguyet') {
          tgt.copy(inst.neck!).add(new V3(0, 0.0, -0.03));
          aimArm(c, -1, tgt, pole.set(-0.5, -1, 0.3), 0.2);
          const strum = Math.sin(b * Math.PI * 2) * 0.03 * groove;
          tgt.copy(inst.strum!).add(new V3(0, strum, -0.02));
          aimArm(c, 1, tgt, pole.set(1, -0.6, 0.6), 0.5);
        } else if (s.kind === 'bau') {
          const bend = Math.sin(b * Math.PI * 0.5) * 0.04;
          tgt.copy(inst.rod!).add(new V3(bend, -0.12, 0.0));
          aimArm(c, -1, tgt, pole.set(-1, -0.5, 0.4), -0.3);
          tgt.copy(inst.pluck!).add(new V3(0, Math.max(0, 0.06 - ph * 0.12) * groove, 0));
          aimArm(c, 1, tgt, pole.set(1, -0.5, 0.5), 0.6);
        } else if (s.kind === 'tranh') {
          for (const sd of [-1, 1] as const) {
            const off = ((b + (sd > 0 ? 0.5 : 0)) % 1);
            tgt.copy(sd < 0 ? inst.left! : inst.right!).add(new V3(Math.sin(t * 0.7 + sd) * 0.04, 0.035 + Math.max(0, 0.05 - off * 0.1), 0));
            aimArm(c, sd, tgt, pole.set(sd, -0.5, 0.6), 0.7);
          }
          bn[B.chest]!.rotation.x += 0.12;
        } else if (s.kind === 'sao') {
          tgt.copy(inst.h1!); aimArm(c, -1, tgt, pole.set(-0.3, -1, 0.2), -1.2 + Math.sin(t * 7) * 0.08);
          tgt.copy(inst.h2!); aimArm(c, 1, tgt, pole.set(1, -0.8, 0.3), -1.3 + Math.sin(t * 9 + 1) * 0.08);
          bn[B.head]!.rotation.z = 0.15;
        } else {
          const hit = easeInOut(Math.min(1, Math.abs(ph - 0.5) * 2));
          for (const sd of [-1, 1] as const) {
            tgt.set(sd * (0.05 + 0.12 * (1 - hit)), 0.18 + 0.05 * hype, -0.26);
            aimArm(c, sd, tgt, pole.set(sd, -0.8, 0.4), -0.6);
          }
        }
        updateCloth(c, dt, t, s.yaw);
      }
    },
    dispose() { batch.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { band: (ctx) => createLacquerBand(ctx.scene) };
