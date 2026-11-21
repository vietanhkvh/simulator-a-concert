// "Đêm Sao Điểm Ảnh" — đội quay phim (gói P4, khe `cameraCrew`). Giữ nguyên rig / pose / góc nhìn của cameraCrew.ts mặc định,
// chỉ thay ngoại hình qua CrewAppearance: người quay = hoạ sĩ sprite (mũ lưỡi trai, tai nghe, áo sơn) cùng rig ca sĩ, máy quay =
// hộp mực có dải kem + ống kính lăng trụ, dolly = thùng gỗ trên bánh, tháp FOH = giàn gỗ + toan căng khung, cần cẩu = cán cọ dài
// với đối trọng là thùng sơn, drone = bảng pha màu có 4 nắp thùng làm cánh quạt.
// Phần instanced: 5 hình lăng trụ phẳng, màu mặt tô sẵn, vật liệu Basic không đèn. Draw call: 5 instanced + 1 Points + 2 rig = 8.
import * as THREE from 'three';
import type { ArenaBuilders } from '../../builders';
import { createCameraCrew, type CrewAppearance, type CrewKit } from '../../cameraCrew';
import { INK, PixelBatch, R, SKIN_TONES, bakeFlat, buildPainter, leg, reach, resetPose, worldToChest, type PixChar } from './pixelRig';

const V3 = THREE.Vector3;

function pixelCrewAppearance(): CrewAppearance {
  const r = R;
  const WOOD = r.dat!['500'], WOOD2 = r.dat!['300'], INKC = INK, CREAM = r.crom!['100'], GOLD = r.crom!['500'];
  const GREY = r.may!['500'], GREY2 = r.may!['300'];
  const batch = new PixelBatch();
  const ops: { node: THREE.Object3D; c: PixChar; up: boolean }[] = [];
  let n = 0;
  const tgt = new V3(), pole = new V3(), w = new V3(), qy = new THREE.Quaternion();

  return {
    geometries: () => [
      bakeFlat(new THREE.BoxGeometry(1, 1, 1)),
      bakeFlat(new THREE.CylinderGeometry(0.5, 0.5, 1, 6)),
      bakeFlat(new THREE.BoxGeometry(1, 1, 1)),
      bakeFlat(new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2)),
      bakeFlat(new THREE.TorusGeometry(1, 0.1, 3, 8)),
    ],
    material: () => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }),
    operator(_k, node, up) {
      const i = n++;
      const c = buildPainter(batch, {
        skin: SKIN_TONES[(i * 2 + 1) % SKIN_TONES.length]!, hair: i % 2 ? r.dat!['700'] : r.dat!['500'], hairStyle: i % 2 ? 'short' : 'pony',
        hat: { kind: 'cap', col: i % 2 ? r.pho!['300'] : r.bach!['300'], col2: r.crom!['300'] },
        smock: i % 2 ? r.tim!['500'] : r.pho!['500'], pants: r.pho!['700'], boots: INKC, headphones: true,
        splat: [r.crom!['500'], r.son!['500'], r.may!['100']],
      });
      ops.push({ node, c, up });
    },
    camera(k, p, s) {
      const { part, node, glow } = k;
      part(p, 0, INKC, 0.3 * s, 0.34 * s, 0.56 * s, 0, 0, 0); // thân hộp mực
      part(p, 0, CREAM, 0.31 * s, 0.05 * s, 0.4 * s, 0, 0.19 * s, 0.02 * s); // dải kem trên nắp
      part(p, 0, GREY, 0.14 * s, 0.12 * s, 0.2 * s, -0.2 * s, 0.1 * s, -0.1 * s); // màn ngắm
      part(p, 1, GREY, 0.24 * s, 0.26 * s, 0.24 * s, 0, 0, -0.4 * s, Math.PI / 2, 0, 0); // ống kính
      part(p, 3, GOLD, 0.15 * s, 0.15 * s, 0.05 * s, 0, 0, -0.53 * s); // vành vàng
      part(p, 2, r.pho!['100'], 0.12 * s, 0.12 * s, 0.03 * s, 0, 0, -0.56 * s); // mắt kính
      glow(p, r.son!['300'], 0.1 * s, 0.22 * s, -0.24 * s, 0.35); // tally son
      return node(p, 0, 0, -0.72 * s);
    },
    dolly(k, root, headY, opY) {
      const { part } = k;
      part(root, 0, WOOD, 1.0, 0.16, 0.8, 0, 0.22, 0); // sàn thùng gỗ
      part(root, 0, GOLD, 1.02, 0.03, 0.04, 0, 0.3, -0.41); // nẹp vàng
      for (const wx of [-0.42, 0.42]) for (const wz of [-0.32, 0.32]) part(root, 3, INKC, 0.11, 0.11, 0.12, wx, 0.13, wz, 0, Math.PI / 2, 0); // bánh
      part(root, 0, WOOD2, 0.14, headY - 0.3, 0.14, 0, 0.28 + (headY - 0.3) / 2, 0); // cột nâng
      part(root, 0, INKC, 0.22, 0.06, 0.22, 0, headY - 0.12, 0);
      part(root, 1, GREY, 0.04, 0.7, 0.04, 0, opY + 0.7, 0.35, 0, 0, Math.PI / 2); // tay đẩy
      part(root, 0, WOOD, 0.66, opY, 0.56, 0, opY / 2, 0.85); // bục người quay
      part(root, 0, WOOD2, 0.68, 0.03, 0.58, 0, opY, 0.85);
    },
    tower(k, tw, TH) {
      const { part } = k;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        part(tw, 0, WOOD, 0.16, TH, 0.16, sx * 1.05, TH / 2, sz * 1.05);
        part(tw, 0, WOOD2, 0.2, 0.08, 0.2, sx * 1.05, TH * 0.5, sz * 1.05);
      }
      for (const sz of [-1, 1]) part(tw, 1, WOOD2, 0.07, 2.4, 0.07, 0, TH * 0.5, sz * 1.05, 0, 0, 0.9);
      for (const sx of [-1, 1]) part(tw, 1, WOOD2, 0.07, 2.4, 0.07, sx * 1.05, TH * 0.5, 0, 0.9, 0, 0);
      part(tw, 0, WOOD, 2.6, 0.14, 2.6, 0, TH, 0);
      part(tw, 0, WOOD2, 2.62, 0.03, 2.62, 0, TH + 0.08, 0);
      for (const sz of [-1, 1]) part(tw, 0, WOOD2, 2.44, 0.07, 0.07, 0, TH + 1.0, sz * 1.22);
      for (const sx of [-1, 1]) part(tw, 0, WOOD2, 0.07, 0.07, 2.44, sx * 1.22, TH + 1.0, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(tw, 0, WOOD2, 0.07, 1.0, 0.07, sx * 1.22, TH + 0.5, sz * 1.22);
      part(tw, 0, r.dat!['700'], 2.5, 0.6, 0.06, 0, TH - 0.34, -1.25); // khung toan
      part(tw, 0, r.pho!['500'], 2.3, 0.44, 0.04, 0, TH - 0.34, -1.29);
      part(tw, 2, r.crom!['500'], 0.28, 0.28, 0.03, -0.5, TH - 0.28, -1.32); // sao quầng
      part(tw, 0, r.pho!['100'], 0.8, 0.07, 0.03, 0.5, TH - 0.4, -1.32);
    },
    towerMount({ part }, ty) {
      for (const a of [0, 2.1, 4.2]) part(ty, 1, WOOD2, 0.07, 1.45, 0.07, Math.sin(a) * 0.25, 0.7, Math.cos(a) * 0.25 + 0.1, Math.cos(a) * 0.17, 0, -Math.sin(a) * 0.17);
    },
    craneBase({ part }, cr, py) {
      for (const a of [0, 2.1, 4.2]) {
        part(cr, 0, WOOD, 0.14, 0.1, 1.6, Math.sin(a) * 0.55, 0.08, Math.cos(a) * 0.55, 0, a, 0);
        part(cr, 3, INKC, 0.1, 0.1, 0.14, Math.sin(a) * 1.3, 0.09, Math.cos(a) * 1.3, 0, a + Math.PI / 2, 0);
      }
      part(cr, 0, WOOD2, 0.26, py - 0.1, 0.26, 0, (py - 0.1) / 2, 0);
      for (let k = 1; k <= 3; k++) part(cr, 0, GOLD, 0.3, 0.07, 0.3, 0, (py * k) / 4, 0);
    },
    craneArm({ part }, cy, cp, arm) {
      part(cy, 0, GREY, 0.46, 0.38, 0.46, 0, 0, 0);
      part(cy, 0, GOLD, 0.5, 0.05, 0.5, 0, 0.2, 0);
      // tay cần = CÁN CỌ dài: cán gỗ, đai kim loại ở đầu đối trọng, lông vàng chrome phía camera
      part(cp, 0, WOOD2, 0.16, 0.16, arm + 1.8, 0, 0, -(arm - 1.8) / 2);
      part(cp, 0, GREY, 0.2, 0.2, 0.3, 0, 0, 1.5);
      part(cp, 0, GOLD, 0.24, 0.24, 0.5, 0, 0, -arm + 0.05);
      // đối trọng = thùng sơn son
      part(cp, 1, GREY, 0.9, 0.7, 0.9, 0, -0.05, 2.2);
      part(cp, 1, r.son!['500'], 0.82, 0.05, 0.82, 0, 0.32, 2.2);
      part(cp, 1, INKC, 0.02, arm, 0.02, 0, 0.45, -arm / 2 + 0.2, Math.PI / 2 + 0.06, 0, 0);
    },
    craneHead({ part }, h) { part(h, 0, INKC, 0.1, 0.4, 0.1, 0, 0.18, 0); },
    drone(k, body) {
      const { part, glow } = k;
      // bảng pha màu bay: thân dẹt gỗ sáng + chấm sơn, 4 tay + 4 nắp thùng làm cánh quạt
      part(body, 0, WOOD2, 0.52, 0.1, 0.46, 0, 0, 0);
      part(body, 0, INKC, 0.1, 0.12, 0.1, 0.12, 0.01, 0.06);
      part(body, 2, r.son!['500'], 0.09, 0.05, 0.09, -0.15, 0.07, 0.0);
      part(body, 2, r.pho!['300'], 0.09, 0.05, 0.09, -0.05, 0.07, 0.1);
      part(body, 2, r.bach!['300'], 0.09, 0.05, 0.09, 0.0, 0.07, -0.12);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const ang = Math.atan2(sx, sz);
        part(body, 0, WOOD, 0.06, 0.04, 0.5, sx * 0.2, 0, sz * 0.2, 0, ang, 0);
        part(body, 4, GREY2, 0.17, 0.17, 0.17, sx * 0.35, 0.05, sz * 0.35, Math.PI / 2, 0, 0);
        part(body, 1, GOLD, 0.3, 0.012, 0.3, sx * 0.35, 0.08, sz * 0.35); // nắp thùng quay
      }
      const red = glow(body, r.son!['300'], -0.35, -0.03, -0.35, 0.6);
      glow(body, r.crom!['300'], 0.35, -0.03, -0.35, 0.5);
      const base = new THREE.Color(r.son!['300']);
      return (t) => { red.color.copy(base).multiplyScalar(0.3 + 0.7 * (Math.sin(t * 6) > 0.6 ? 1 : 0)); };
    },
    gimbal({ part }, g, aim) {
      part(g, 0, INKC, 0.05, 0.2, 0.05, 0, 0.1, 0);
      part(aim, 0, INKC, 0.2, 0.18, 0.2, 0, 0, 0);
      part(aim, 0, GOLD, 0.08, 0.08, 0.06, 0, 0, -0.1);
      part(aim, 2, r.pho!['100'], 0.06, 0.06, 0.02, 0, 0, -0.14);
    },
    build(scene) { batch.build(scene, 'cameraCrew-pixel'); for (const o of ops) o.c.b.root!.scale.setScalar(0.95); },
    update() {
      for (const o of ops) {
        const root = o.c.b.root!;
        o.node.getWorldPosition(root.position);
        o.node.getWorldQuaternion(qy);
        root.quaternion.copy(qy);
        resetPose(o.c);
        leg(o.c, -1, 0, 0, 0.08); leg(o.c, 1, 0, 0, 0.08);
        root.updateMatrixWorld(true);
        for (const s of [-1, 1] as const) {
          // đích tay trong khung node người quay (gốc = chân, nhìn -Z)
          if (o.up) tgt.set(s > 0 ? 0.3 : -0.2, s > 0 ? 1.05 : 0.88, s > 0 ? -0.12 : -0.42);
          else tgt.set(s * 0.2, 0.78, -0.4);
          w.copy(tgt); o.node.localToWorld(w);
          worldToChest(o.c, w, tgt);
          reach(o.c, s, tgt, pole.set(s, -1, 0.3));
        }
      }
    },
    dispose() { batch.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { cameraCrew: (ctx) => createCameraCrew(ctx.scene, pixelCrewAppearance) };
