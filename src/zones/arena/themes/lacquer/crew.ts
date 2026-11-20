// "Mực & Sơn mài" — đội quay phim (khe `cameraCrew`). Giữ nguyên rig/pose/góc nhìn của cameraCrew.ts mặc định, chỉ thay
// ngoại hình (CrewAppearance): người quay phim trên rig 7,5 đầu (áo the sơn then, tai nghe, không mắt chibi), máy quay hộp
// sơn then viền vàng + tally son nhỏ, dolly + tháp FOH gỗ sẫm đầu cột vàng (chòi canh gỗ), cần cẩu tre sẫm đốt vàng + đối
// trọng vàng, drone = chuồn chuồn sơn then cánh xà cừ + đèn lồng nhỏ. Draw call: 5 instanced + 1 Points + 1 rig = 7.
import * as THREE from 'three';
import { PAL, SKIN } from '../../../../world/style';
import type { ArenaBuilders } from '../../builders';
import { createCameraCrew, type CrewAppearance, type CrewKit } from '../../cameraCrew';
import { B, RigBatch, aimArm, ell, legs, tube, type RigChar } from './rig';

const V3 = THREE.Vector3;

function lacquerCrewAppearance(): CrewAppearance {
  const LAC = PAL.night[300]; // sơn then
  const LAC2 = PAL.night[500];
  const WOOD = PAL.night[100]; // gỗ sẫm
  const GOLD = PAL.honey[500];
  const GOLD2 = PAL.honey[300];
  const SON = PAL.berry[500];
  const batch = new RigBatch();
  const ops: { node: THREE.Object3D; c: RigChar; up: boolean }[] = [];
  let n = 0;
  const q = new THREE.Quaternion(), tgt = new V3(), pole = new V3();

  /** Viền vàng quanh mặt trước của hộp (w × h) ở z. */
  const goldFrame = ({ part }: CrewKit, p: THREE.Object3D, w: number, h: number, z: number, t: number) => {
    part(p, 0, GOLD, w + t, t, t, 0, h / 2, z); part(p, 0, GOLD, w + t, t, t, 0, -h / 2, z);
    part(p, 0, GOLD, t, h, t, w / 2, 0, z); part(p, 0, GOLD, t, h, t, -w / 2, 0, z);
  };

  return {
    geometries: () => [
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
      new THREE.SphereGeometry(0.5, 14, 10),
      new THREE.TorusGeometry(1, 0.3, 6, 18),
      new THREE.TorusGeometry(1, 0.08, 4, 24),
    ],
    operator(_k, node, up) {
      const i = n++;
      const c = batch.addChar({
        skin: SKIN[(i * 2 + 1) % SKIN.length]!, hair: PAL.night[700], hairStyle: i % 2 ? 'short' : 'bun', headWear: 'none', headCol: LAC,
        top: i % 3 === 2 ? PAL.grape[700] : LAC2, trim: GOLD, pants: PAL.night[700], shoe: PAL.night[700], hemY: 0.55,
      });
      // tai nghe: quai qua đỉnh đầu + 2 chụp + cần mic
      batch.add(c, new THREE.TorusGeometry(0.1, 0.008, 4, 18, Math.PI).translate(0, 1.6, 0), PAL.night[700], B.head);
      for (const s of [-1, 1]) batch.add(c, ell(new V3(s * 0.095, 1.595, 0), 0.022, 0.035, 0.035, 8), PAL.night[700], B.head);
      batch.add(c, tube(new V3(-0.1, 1.58, -0.01), new V3(-0.04, 1.535, -0.095), 0.004, 0.004, 4), GOLD, B.head, 1);
      ops.push({ node, c, up });
    },
    camera(k, p, s) {
      const { part, node, glow } = k;
      part(p, 0, LAC, 0.32 * s, 0.34 * s, 0.56 * s, 0, 0, 0); // thân hộp sơn then
      goldFrame(k, p, 0.32 * s, 0.34 * s, -0.28 * s, 0.025 * s);
      goldFrame(k, p, 0.32 * s, 0.34 * s, 0.28 * s, 0.025 * s);
      part(p, 0, LAC2, 0.16 * s, 0.12 * s, 0.22 * s, 0, 0.23 * s, 0.12 * s); // ống ngắm vuông
      part(p, 1, LAC2, 0.22 * s, 0.24 * s, 0.22 * s, 0, 0, -0.4 * s, Math.PI / 2, 0, 0); // ống kính
      part(p, 4, GOLD, 0.11 * s, 0.11 * s, 0.11 * s, 0, 0, -0.52 * s); // vành vàng
      part(p, 1, PAL.grape[700], 0.18 * s, 0.02 * s, 0.18 * s, 0, 0, -0.52 * s, Math.PI / 2, 0, 0); // mặt kính chàm
      glow(p, SON, 0.1 * s, 0.19 * s, -0.24 * s, 0.3); // tally son nhỏ
      return node(p, 0, 0, -0.72 * s);
    },
    dolly(k, root, headY, opY) {
      const { part } = k;
      part(root, 0, WOOD, 1.0, 0.16, 0.8, 0, 0.22, 0);
      part(root, 0, GOLD, 1.02, 0.03, 0.82, 0, 0.31, 0); // nẹp vàng
      for (const wx of [-0.42, 0.42]) for (const wz of [-0.32, 0.32]) {
        part(root, 3, LAC, 0.1, 0.1, 0.12, wx, 0.13, wz, 0, Math.PI / 2, 0); // bánh (vòng — mọi loại part phải có ≥ 1 instance)
        part(root, 1, GOLD, 0.08, 0.1, 0.08, wx, 0.13, wz, 0, 0, Math.PI / 2);
      }
      part(root, 0, WOOD, 0.14, headY - 0.3, 0.14, 0, (headY - 0.3) / 2 + 0.2, 0); // cột gỗ vuông
      part(root, 0, GOLD, 0.2, 0.05, 0.2, 0, headY - 0.12, 0); // đầu cột vàng
      part(root, 1, WOOD, 0.05, 0.7, 0.05, 0, opY + 0.7, 0.35, 0, 0, Math.PI / 2); // tay đẩy
      part(root, 0, WOOD, 0.66, opY, 0.56, 0, opY / 2, 0.85); // bục
      part(root, 0, GOLD, 0.68, 0.03, 0.58, 0, opY, 0.85);
    },
    tower(k, tw, TH) {
      const { part } = k;
      // chòi canh gỗ: 4 cột vuông đầu vàng, giằng chéo, sàn ván, lan can gỗ + trụ vàng, liễn son viền vàng phía trước
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        part(tw, 0, WOOD, 0.22, TH, 0.22, sx * 1.1, TH / 2, sz * 1.1);
        part(tw, 0, GOLD, 0.28, 0.06, 0.28, sx * 1.1, TH * 0.5, sz * 1.1);
        part(tw, 0, LAC, 0.3, 0.14, 0.3, sx * 1.1, 0.07, sz * 1.1); // chân tảng
      }
      for (const sz of [-1, 1]) part(tw, 0, WOOD, 0.08, 2.6, 0.08, 0, TH * 0.5, sz * 1.1, 0, 0, 0.9);
      for (const sx of [-1, 1]) part(tw, 0, WOOD, 0.08, 2.6, 0.08, sx * 1.1, TH * 0.5, 0, 0.9, 0, 0);
      part(tw, 0, WOOD, 2.6, 0.16, 2.6, 0, TH, 0);
      part(tw, 0, GOLD, 2.64, 0.03, 2.64, 0, TH + 0.08, 0);
      for (const sz of [-1, 1]) part(tw, 0, WOOD, 2.44, 0.08, 0.08, 0, TH + 1.0, sz * 1.22);
      for (const sx of [-1, 1]) part(tw, 0, WOOD, 0.08, 0.08, 2.44, sx * 1.22, TH + 1.0, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        part(tw, 0, WOOD, 0.1, 1.0, 0.1, sx * 1.22, TH + 0.5, sz * 1.22);
        part(tw, 0, GOLD, 0.14, 0.12, 0.14, sx * 1.22, TH + 1.06, sz * 1.22);
      }
      part(tw, 0, SON, 2.3, 0.5, 0.06, 0, TH - 0.32, -1.25); // liễn son
      part(tw, 0, GOLD, 2.36, 0.03, 0.07, 0, TH - 0.06, -1.25);
      part(tw, 0, GOLD, 2.36, 0.03, 0.07, 0, TH - 0.58, -1.25);
    },
    towerMount({ part }, ty) {
      for (const a of [0, 2.1, 4.2]) part(ty, 1, WOOD, 0.06, 1.45, 0.06, Math.sin(a) * 0.25, 0.7, Math.cos(a) * 0.25 + 0.1, Math.cos(a) * 0.17, 0, -Math.sin(a) * 0.17);
    },
    craneBase({ part }, cr, py) {
      for (const a of [0, 2.1, 4.2]) {
        part(cr, 0, WOOD, 0.14, 0.12, 1.6, Math.sin(a) * 0.55, 0.1, Math.cos(a) * 0.55, 0, a, 0);
        part(cr, 0, GOLD, 0.18, 0.16, 0.18, Math.sin(a) * 1.3, 0.09, Math.cos(a) * 1.3);
      }
      part(cr, 1, WOOD, 0.24, py - 0.1, 0.24, 0, (py - 0.1) / 2, 0);
      for (let k = 1; k <= 3; k++) part(cr, 4, GOLD, 0.13, 0.13, 0.13, 0, (py * k) / 4, 0, Math.PI / 2, 0, 0);
    },
    craneArm({ part }, cy, cp, arm) {
      part(cy, 0, LAC, 0.42, 0.34, 0.42, 0, 0, 0);
      part(cy, 0, GOLD, 0.46, 0.04, 0.46, 0, 0.17, 0);
      part(cp, 1, PAL.night[100], 0.18, arm + 2.2, 0.18, 0, 0, -(arm - 2.2) / 2, Math.PI / 2, 0, 0); // cần tre sẫm
      for (let k = 0; k < 7; k++) part(cp, 4, GOLD, 0.095, 0.095, 0.095, 0, 0, 1.6 - k * ((arm + 1.6) / 7)); // đốt tre vàng
      part(cp, 0, GOLD, 0.7, 0.7, 0.7, 0, -0.05, 2.25); // đối trọng vàng
      part(cp, 0, LAC, 0.74, 0.12, 0.74, 0, -0.05, 2.25);
      part(cp, 1, PAL.night[700], 0.03, arm, 0.03, 0, 0.45, -arm / 2 + 0.2, Math.PI / 2 + 0.06, 0, 0); // dây
    },
    craneHead({ part }, h) { part(h, 0, WOOD, 0.08, 0.4, 0.08, 0, 0.18, 0); },
    drone(k, body) {
      const { part, glow } = k;
      // chuồn chuồn sơn then: thân dài + đầu tròn + 4 cánh xà cừ viền vàng + đèn lồng son nhỏ treo dưới bụng
      part(body, 1, LAC, 0.1, 0.9, 0.1, 0, 0, 0.18, Math.PI / 2, 0, 0);
      for (let i = 0; i < 4; i++) part(body, 4, GOLD, 0.055, 0.055, 0.055, 0, 0, 0.1 + i * 0.16);
      part(body, 2, LAC2, 0.22, 0.18, 0.22, 0, 0.01, -0.3);
      for (const s of [-1, 1]) part(body, 2, GOLD, 0.07, 0.07, 0.07, s * 0.08, 0.04, -0.37);
      for (const [z, len, ang] of [[-0.12, 0.62, 0.12], [0.04, 0.56, -0.1]] as const) for (const s of [-1, 1]) {
        part(body, 2, PAL.soda[100], len, 0.012, 0.16, s * len * 0.5, 0.06, z, 0, s * ang, 0); // cánh xà cừ
        part(body, 2, GOLD, len * 1.02, 0.008, 0.02, s * len * 0.5, 0.062, z + 0.07, 0, s * ang, 0); // gân vàng
      }
      part(body, 1, PAL.night[700], 0.01, 0.12, 0.01, 0, -0.12, 0.05);
      part(body, 2, SON, 0.1, 0.13, 0.1, 0, -0.22, 0.05); // đèn lồng
      part(body, 0, GOLD, 0.06, 0.015, 0.06, 0, -0.15, 0.05);
      const lamp = glow(body, PAL.peach[300], 0, -0.22, 0.05, 0.7);
      const base = new THREE.Color(PAL.peach[300]);
      return (t) => { lamp.color.copy(base).multiplyScalar(0.75 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 3.1)); };
    },
    gimbal({ part }, g, aim) {
      part(g, 1, LAC, 0.05, 0.2, 0.05, 0, 0.1, 0);
      part(aim, 0, LAC, 0.2, 0.18, 0.2, 0, 0, 0);
      part(aim, 4, GOLD, 0.06, 0.06, 0.06, 0, 0, -0.1);
      part(aim, 1, PAL.grape[700], 0.1, 0.02, 0.1, 0, 0, -0.105, Math.PI / 2, 0, 0);
    },
    build(scene) {
      batch.build(scene, 'cameraCrew-lacquer');
    },
    update() {
      for (const o of ops) {
        const root = o.c.bones[B.root]!;
        o.node.getWorldPosition(root.position);
        o.node.getWorldQuaternion(q);
        root.quaternion.copy(q);
        legs(o.c, 0, 0);
        // hai tay tới máy (khung ngực): dolly/tháp ~0,5 m trước, cao ngang vai; vác máy = đỡ máy ngang hông phải
        for (const s of [-1, 1] as const) {
          if (o.up) tgt.set(s > 0 ? 0.36 : 0.2, s > 0 ? 0.02 : -0.02, s > 0 ? -0.12 : -0.3);
          else tgt.set(s * 0.12, 0.2, -0.46);
          pole.set(s, -1, 0.3);
          aimArm(o.c, s, tgt, pole, 0.2);
        }
      }
    },
    dispose() { batch.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { cameraCrew: (ctx) => createCameraCrew(ctx.scene, lacquerCrewAppearance) };
