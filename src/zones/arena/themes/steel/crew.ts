// "Thép & Lửa" — đội quay phim (khe `cameraCrew`). Giữ nguyên rig/pose/góc nhìn của cameraCrew.ts mặc định, chỉ thay
// ngoại hình (CrewAppearance): người quay = roadie đen đẽo mặt phẳng (mũ lưỡi trai, thẻ laminate), máy vác vai = hộp thép
// khối + tally đỏ, dolly = xe thép, tháp FOH = giàn giáo truss, cần cẩu = jib truss thép, drone = quadcopter đen góc cạnh.
// Phần instanced dùng hình low-poly + Lambert flatShading (mặt phẳng rõ). Draw call: 5 instanced + 1 Points + 1 rig = 7.
import * as THREE from 'three';
import { RAMPS, SKIN } from '../../../../world/style';
import type { ArenaBuilders } from '../../builders';
import { createCameraCrew, type CrewAppearance, type CrewKit } from '../../cameraCrew';
import { B, RigBatch, aimArm, hand, legs, type RigChar } from './rig';

const V3 = THREE.Vector3;

function steelCrewAppearance(): CrewAppearance {
  const CO = RAMPS.coal!, S = RAMPS.steel!, BL = RAMPS.blood!, WH = RAMPS.whitehot!;
  const BLACK = CO[300], DARK = CO[500], STEEL = S[500], STEEL2 = S[300], HI = S[100];
  const batch = new RigBatch();
  const ops: { node: THREE.Object3D; c: RigChar; up: boolean }[] = [];
  let n = 0;
  const q = new THREE.Quaternion(), tgt = new V3(), pole = new V3();

  /** Giàn truss hộp: 4 thanh dọc + giằng chéo zig-zag dọc trục Y (cao h, cạnh w). */
  const truss = ({ part }: CrewKit, p: THREE.Object3D, w: number, h: number, x: number, y0: number, z: number, col = STEEL2) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(p, 1, col, 0.05, h, 0.05, x + sx * w / 2, y0 + h / 2, z + sz * w / 2);
    const nSeg = Math.max(2, Math.round(h / w));
    const seg = h / nSeg, len = Math.hypot(seg, w), ang = Math.atan2(w, seg);
    for (let i = 0; i < nSeg; i++) {
      const yc = y0 + seg * (i + 0.5), s = i % 2 ? 1 : -1;
      part(p, 1, col, 0.03, len, 0.03, x, yc, z - w / 2, 0, 0, s * ang);
      part(p, 1, col, 0.03, len, 0.03, x, yc, z + w / 2, 0, 0, -s * ang);
      part(p, 1, col, 0.03, len, 0.03, x - w / 2, yc, z, -s * ang, 0, 0);
      part(p, 1, col, 0.03, len, 0.03, x + w / 2, yc, z, s * ang, 0, 0);
    }
  };

  return {
    geometries: () => [
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
      new THREE.SphereGeometry(0.5, 6, 4),
      new THREE.TorusGeometry(1, 0.3, 4, 8),
      new THREE.TorusGeometry(1, 0.08, 3, 10),
    ],
    material: () => new THREE.MeshLambertMaterial({ flatShading: true, emissive: new THREE.Color(RAMPS.steel![700]).multiplyScalar(0.25) }),
    operator(_k, node, up) {
      const i = n++;
      const c = batch.addChar({
        skin: SKIN[(i * 2 + 1) % SKIN.length]!, hair: i % 2 ? CO[500] : 0x4a3122, hairStyle: 'cap', headCol: i % 3 === 2 ? BL[500] : CO[300],
        top: 'tee', topCol: BLACK, shirtCol: BLACK, decal: i % 2 ? 'none' : 'bolt', decalCol: S[500],
        pants: CO[300], boots: CO[700], laminate: true, belt: false,
      });
      ops.push({ node, c, up });
    },
    camera(k, p, s) {
      const { part, node, glow } = k;
      part(p, 0, STEEL, 0.3 * s, 0.34 * s, 0.56 * s, 0, 0, 0); // hộp thép
      part(p, 0, DARK, 0.32 * s, 0.06 * s, 0.5 * s, 0, 0.2 * s, 0); // tay xách đen
      part(p, 0, HI, 0.31 * s, 0.02 * s, 0.57 * s, 0, -0.08 * s, 0); // đường nối tấm
      part(p, 0, DARK, 0.14 * s, 0.12 * s, 0.2 * s, -0.2 * s, 0.1 * s, -0.1 * s); // màn ngắm
      part(p, 1, DARK, 0.22 * s, 0.26 * s, 0.22 * s, 0, 0, -0.4 * s, Math.PI / 2, 0, 0); // ống kính
      part(p, 4, HI, 0.11 * s, 0.11 * s, 0.11 * s, 0, 0, -0.53 * s);
      part(p, 1, S[700], 0.17 * s, 0.02 * s, 0.17 * s, 0, 0, -0.535 * s, Math.PI / 2, 0, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(p, 2, HI, 0.04 * s, 0.04 * s, 0.04 * s, sx * 0.15 * s, 0.17 * s, sz * 0.26 * s); // đinh tán
      glow(p, BL[100], 0.1 * s, 0.19 * s, -0.24 * s, 0.35); // tally đỏ
      return node(p, 0, 0, -0.72 * s);
    },
    dolly(k, root, headY, opY) {
      const { part } = k;
      part(root, 0, STEEL, 1.0, 0.12, 0.8, 0, 0.22, 0);
      part(root, 0, WH[500], 1.02, 0.03, 0.04, 0, 0.26, -0.41); // nẹp cảnh báo
      for (const wx of [-0.42, 0.42]) for (const wz of [-0.32, 0.32]) {
        part(root, 3, DARK, 0.1, 0.1, 0.12, wx, 0.13, wz, 0, Math.PI / 2, 0);
        part(root, 1, HI, 0.06, 0.1, 0.06, wx, 0.13, wz, 0, 0, Math.PI / 2);
      }
      truss(k, root, 0.16, headY - 0.3, 0, 0.28, 0);
      part(root, 0, DARK, 0.22, 0.06, 0.22, 0, headY - 0.12, 0);
      part(root, 1, HI, 0.04, 0.7, 0.04, 0, opY + 0.7, 0.35, 0, 0, Math.PI / 2);
      part(root, 0, S[700], 0.66, opY, 0.56, 0, opY / 2, 0.85); // bục tấm chống trượt
      part(root, 0, STEEL2, 0.68, 0.025, 0.58, 0, opY, 0.85);
    },
    tower(k, tw, TH) {
      const { part } = k;
      // giàn giáo truss: 4 cột truss + sàn tấm thép + lan can ống + băng rôn cảnh báo
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        truss(k, tw, 0.3, TH, sx * 1.05, 0, sz * 1.05);
        part(tw, 0, DARK, 0.42, 0.06, 0.42, sx * 1.05, 0.03, sz * 1.05);
      }
      part(tw, 0, S[700], 2.6, 0.12, 2.6, 0, TH, 0);
      part(tw, 0, STEEL2, 2.62, 0.03, 2.62, 0, TH + 0.07, 0);
      for (const sz of [-1, 1]) part(tw, 1, HI, 0.05, 2.44, 0.05, 0, TH + 1.0, sz * 1.22, 0, 0, Math.PI / 2);
      for (const sx of [-1, 1]) part(tw, 1, HI, 0.05, 2.44, 0.05, sx * 1.22, TH + 1.0, 0, Math.PI / 2, 0, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(tw, 1, HI, 0.05, 1.0, 0.05, sx * 1.22, TH + 0.5, sz * 1.22);
      part(tw, 0, CO[700], 2.3, 0.45, 0.04, 0, TH - 0.3, -1.25);
      part(tw, 0, WH[500], 2.3, 0.05, 0.05, 0, TH - 0.06, -1.25);
      part(tw, 0, BL[300], 2.3, 0.05, 0.05, 0, TH - 0.54, -1.25);
    },
    towerMount({ part }, ty) {
      for (const a of [0, 2.1, 4.2]) part(ty, 1, STEEL2, 0.05, 1.45, 0.05, Math.sin(a) * 0.25, 0.7, Math.cos(a) * 0.25 + 0.1, Math.cos(a) * 0.17, 0, -Math.sin(a) * 0.17);
    },
    craneBase(k, cr, py) {
      const { part } = k;
      for (const a of [0, 2.1, 4.2]) {
        part(cr, 0, STEEL, 0.14, 0.1, 1.6, Math.sin(a) * 0.55, 0.08, Math.cos(a) * 0.55, 0, a, 0);
        part(cr, 0, DARK, 0.2, 0.14, 0.2, Math.sin(a) * 1.3, 0.07, Math.cos(a) * 1.3);
      }
      truss(k, cr, 0.26, py - 0.1, 0, 0, 0);
    },
    craneArm({ part }, cy, cp, arm) {
      part(cy, 0, DARK, 0.42, 0.34, 0.42, 0, 0, 0);
      part(cy, 0, HI, 0.46, 0.03, 0.46, 0, 0.17, 0);
      // jib truss tam giác: 3 thanh dọc + giằng zig-zag
      const L = arm + 2.2, zc = -(arm - 2.2) / 2;
      for (const [x, y] of [[-0.12, -0.08], [0.12, -0.08], [0, 0.14]] as const) part(cp, 1, STEEL2, 0.045, L, 0.045, x, y, zc, Math.PI / 2, 0, 0);
      const nSeg = Math.round(L / 0.35);
      for (let i = 0; i < nSeg; i++) {
        const z = 2.2 - (i + 0.5) * (L / nSeg), s = i % 2 ? 1 : -1;
        for (const x of [-0.06, 0.06]) part(cp, 1, STEEL2, 0.025, 0.4, 0.025, x * 1.0 + (x < 0 ? -0.0 : 0), 0.03, z, s * 0.9, 0, x < 0 ? 0.5 : -0.5);
        part(cp, 1, STEEL2, 0.025, 0.26, 0.025, 0, -0.08, z, s * 1.0, 0, Math.PI / 2);
      }
      part(cp, 0, DARK, 0.6, 0.6, 0.6, 0, -0.05, 2.25); // đối trọng
      part(cp, 0, WH[500], 0.62, 0.06, 0.62, 0, 0.2, 2.25);
      part(cp, 1, CO[700], 0.02, arm, 0.02, 0, 0.45, -arm / 2 + 0.2, Math.PI / 2 + 0.06, 0, 0); // cáp
    },
    craneHead({ part }, h) { part(h, 0, DARK, 0.1, 0.4, 0.1, 0, 0.18, 0); },
    drone(k, body) {
      const { part, glow } = k;
      // quadcopter đen góc cạnh: thân bát diện dẹt, 4 tay xiên, vòng bảo vệ 6 cạnh, đèn đỏ / trắng
      part(body, 2, CO[300], 0.42, 0.14, 0.52, 0, 0, 0);
      part(body, 0, STEEL, 0.2, 0.05, 0.3, 0, 0.08, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const ang = Math.atan2(sx, sz);
        part(body, 0, DARK, 0.06, 0.04, 0.5, sx * 0.2, 0, sz * 0.2, 0, ang, 0);
        part(body, 4, STEEL2, 0.16, 0.16, 0.16, sx * 0.35, 0.03, sz * 0.35, Math.PI / 2, 0, 0);
        part(body, 0, CO[700], 0.26, 0.008, 0.03, sx * 0.35, 0.05, sz * 0.35, 0, ang + 0.6, 0);
      }
      const red = glow(body, BL[100], -0.35, -0.03, -0.35, 0.6);
      glow(body, RAMPS.arc![500], 0.35, -0.03, -0.35, 0.5);
      const base = new THREE.Color(BL[100]);
      return (t) => { red.color.copy(base).multiplyScalar(0.3 + 0.7 * (Math.sin(t * 6) > 0.6 ? 1 : 0)); };
    },
    gimbal({ part }, g, aim) {
      part(g, 1, DARK, 0.05, 0.2, 0.05, 0, 0.1, 0);
      part(aim, 0, STEEL, 0.2, 0.18, 0.2, 0, 0, 0);
      part(aim, 4, HI, 0.06, 0.06, 0.06, 0, 0, -0.1);
      part(aim, 1, S[700], 0.1, 0.02, 0.1, 0, 0, -0.105, Math.PI / 2, 0, 0);
    },
    build(scene) {
      batch.build(scene, 'cameraCrew-steel');
    },
    update() {
      for (const o of ops) {
        const root = o.c.bones[B.root]!;
        o.node.getWorldPosition(root.position);
        o.node.getWorldQuaternion(q);
        root.quaternion.copy(q);
        legs(o.c, 0, 0, 0.12, 0.08);
        for (const s of [-1, 1] as const) {
          if (o.up) tgt.set(s > 0 ? 0.36 : 0.2, s > 0 ? 0.04 : -0.02, s > 0 ? -0.12 : -0.3);
          else tgt.set(s * 0.12, 0.2, -0.46);
          pole.set(s, -1, 0.3);
          aimArm(o.c, s, tgt, pole, 0.2);
          hand(o.c, s, 'grip');
        }
      }
    },
    dispose() { batch.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { cameraCrew: (ctx) => createCameraCrew(ctx.scene, steelCrewAppearance) };
