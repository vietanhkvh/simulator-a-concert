// "Thép & Lửa" — ban nhạc rock (gói S2, khe `band`): 6 nhạc công rig 7,5 đầu đẽo mặt phẳng ở đúng vị trí ban nhạc mặc
// định. Nhạc cụ tự vẽ: bộ trống đủ (trống bass logo tia sét, snare, 2 tom, tom sàn, hi-hat, 3 chũm chọe) trên bục; guitar
// chữ V đỏ (head-bang, ngả người solo ở Hype > 0,8, quạt cối xay gió); bass đeo thấp; synth 2 tầng; 2 bè phụ ở chân mic
// (nắm đấm / tay sừng). Ampli do gói sân khấu vẽ — không lặp. Toàn bộ = 1 SkinnedMesh → 1 draw call.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { RAMPS, SKIN } from '../../../../world/style';
import type { ArenaBuilders, Band } from '../../builders';
import {
  B, K, REST_ABS, RigBatch, aimArm, box, boltShape, clamp, gem, hand, heavy, legs, lerpExp, prism, shapeGeo, starShape, stud,
  syncChest, updateHair, worldToChest, type RigChar, type RigLook,
} from './rig';

const V3 = THREE.Vector3;
type Kind = 'drum' | 'lead' | 'bass' | 'keys' | 'vox';
interface Spec { kind: Kind; x: number; y: number; z: number; yaw: number; look: RigLook; side?: -1 | 1 }

const CH = REST_ABS[B.chest]!;
const toChest = (p: THREE.Vector3) => p.clone().sub(CH);

function specs(): Spec[] {
  const CO = RAMPS.coal!, S = RAMPS.steel!, BL = RAMPS.blood!, F = RAMPS.flame!;
  const denim = 0x3b4a66;
  return [
    { kind: 'drum', x: -6.5, y: 0.45, z: 1.32, yaw: 0.05, look: { skin: SKIN[2]!, hair: CO[500], hairStyle: 'bandana', headCol: BL[300], top: 'tank', topCol: CO[300], shirtCol: CO[300], decal: 'star', decalCol: S[100], pants: CO[300], boots: CO[700], wristbands: true, beard: true } },
    { kind: 'lead', x: -9.9, y: 0, z: 1.15, yaw: -0.32, look: { skin: SKIN[1]!, hair: BL[300], hairStyle: 'long', top: 'vest', topCol: CO[300], shirtCol: CO[500], decal: 'star', decalCol: S[300], pants: CO[300], ripped: true, boots: CO[700], belt: true, wristbands: true } },
    { kind: 'bass', x: 9.9, y: 0, z: 1.15, yaw: 0.32, look: { skin: SKIN[3]!, hair: CO[500], hairStyle: 'mohawk', top: 'tee', topCol: CO[300], shirtCol: CO[300], decal: 'flame', decalCol: F[500], pants: denim, ripped: true, boots: CO[700], belt: true, shades: true } },
    { kind: 'keys', x: 6.5, y: 0.3, z: 1.74, yaw: -0.08, look: { skin: SKIN[0]!, hair: 0x4a3122, hairStyle: 'pony', top: 'jacket', topCol: S[700], shirtCol: BL[500], decal: 'none', pants: CO[300], boots: CO[700], belt: true, shades: true } },
    { kind: 'vox', x: -2.8, y: 0, z: -0.82, yaw: 0.1, side: -1, look: { skin: SKIN[2]!, hair: 0x2a1c14, hairStyle: 'short', top: 'tee', topCol: CO[300], shirtCol: BL[500], decal: 'bolt', decalCol: RAMPS.paper![500], pants: S[500], boots: CO[700], belt: true, wristbands: true, beard: true } },
    { kind: 'vox', x: 2.8, y: 0, z: -0.82, yaw: -0.1, side: 1, look: { skin: SKIN[4]!, hair: CO[500], hairStyle: 'long', top: 'tee', topCol: CO[300], shirtCol: CO[300], decal: 'flame', decalCol: F[500], pants: CO[300], ripped: true, boots: CO[700], belt: true } },
  ];
}

interface Mus { s: Spec; c: RigChar; seed: number; inst: Record<string, THREE.Vector3>; bangT: number; lastBi: number }

/** Guitar chữ V / bass trên xương ngực: trả điểm cần (tay trái) + điểm gảy (tay phải) trong khung ngực. */
function guitar(batch: RigBatch, c: RigChar, v: boolean, inst: Record<string, THREE.Vector3>) {
  const CO = RAMPS.coal!, S = RAMPS.steel!, BL = RAMPS.blood!;
  const add = (g: THREE.BufferGeometry, col: number, kind = 0) => batch.add(c, g, col, B.chest, kind);
  const zf = -0.16;
  const bridge = v ? new V3(0.06, 0.98, zf) : new V3(0.08, 0.86, zf);
  const dirN = new V3(-0.8, v ? 0.58 : 0.5, 0).normalize();
  const neckLen = v ? 0.62 : 0.8;
  const j = bridge.clone().addScaledVector(dirN, 0.12);
  const body = v ? BL[300] : CO[300];
  if (v) {
    // chữ V dài +30 %: 2 cánh xoè ra sau cầu đàn, tấm chắn đen, mép thép
    for (const s of [-1, 1]) {
      const d = dirN.clone().negate().applyAxisAngle(new V3(0, 0, 1), s * 0.36);
      const tip = j.clone().addScaledVector(d, 0.6);
      add(prism(j, tip, 0.07, 0.035, 4, 0.35, Math.PI / 4), s < 0 ? body : BL[100]);
      add(prism(j.clone().addScaledVector(d, 0.05).add(new V3(0, 0, -0.016)), j.clone().addScaledVector(d, 0.3).add(new V3(0, 0, -0.016)), 0.028, 0.02, 4, 0.2, Math.PI / 4), CO[700]);
    }
  } else {
    // bass: thân 2 sừng lệch
    add(gem(bridge.clone().add(new V3(0.02, 0.02, 0)), 0.2, 0.16, 0.035, 6, 2), body, K.leather);
    add(prism(bridge.clone().add(new V3(-0.06, 0.08, 0)), bridge.clone().add(new V3(-0.18, 0.26, 0)), 0.06, 0.03, 4, 0.5), body, K.leather);
    add(shapeGeo(starShape(), bridge.clone().add(new V3(0.07, -0.02, -0.04)), 0.05), S[100], K.chrome);
  }
  // cần + đầu đàn + dây đeo
  const nut = j.clone().addScaledVector(dirN, neckLen);
  add(prism(j, nut, 0.024, 0.02, 4, 0.6, Math.PI / 4), CO[500]);
  add(prism(nut, nut.clone().addScaledVector(dirN, 0.16).add(new V3(0, v ? 0.04 : 0, 0)), 0.035, 0.02, 3, 0.4), v ? body : CO[500]);
  for (let i = 0; i < 2; i++) add(box(bridge.clone().addScaledVector(dirN, 0.04 + i * 0.09).add(new V3(0, 0, -0.03)), 0.07, 0.025, 0.01).rotateZ(0), S[100], K.chrome);
  add(prism(nut, bridge.clone().add(new V3(0, 0, -0.03)), 0.003, 0.003, 3), S[100], K.chrome);
  add(prism(new V3(0.17, 1.42, 0.0), bridge.clone().add(new V3(0.12, -0.06, 0.03)), 0.012, 0.012, 3, 2.5), CO[700]);
  add(prism(new V3(0.17, 1.42, 0.02), new V3(-0.12, 1.15, 0.1), 0.012, 0.012, 3, 2.5), CO[700]);
  inst.neck = toChest(j.clone().addScaledVector(dirN, neckLen * 0.62).add(new V3(0, -0.03, -0.03)));
  inst.strum = toChest(bridge.clone().addScaledVector(dirN, 0.12).add(new V3(0.0, 0.03, -0.06)));
}

export function createSteelBand(scene: THREE.Scene): Band {
  const batch = new RigBatch();
  const mus: Mus[] = [];
  const CO = RAMPS.coal!, S = RAMPS.steel!, BL = RAMPS.blood!, WH = RAMPS.whitehot!, P = RAMPS.paper!;

  specs().forEach((s, i) => {
    const c = batch.addChar(s.look);
    const inst: Record<string, THREE.Vector3> = {};
    const add = (g: THREE.BufferGeometry, col: number, bone: number, kind = 0) => batch.add(c, g, col, bone, kind);
    // bục thép (sàn tấm chống trượt + nẹp cảnh báo) dưới chân nhạc công đứng cao
    if (s.y > 0.01) {
      const w = s.kind === 'drum' ? 2.2 : 1.6, d = s.kind === 'drum' ? 2.0 : 1.4, zc = s.kind === 'drum' ? -0.35 : -0.15;
      add(box(new V3(0, -s.y / 2, zc), w, s.y, d), CO[300], B.root);
      add(box(new V3(0, -0.01, zc - d / 2), w + 0.02, 0.025, 0.03), WH[500], B.root);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(stud(new V3(sx * (w / 2 - 0.06), -0.06, zc + sz * (d / 2 - 0.06) - (sz < 0 ? 0.01 : 0)), 0.02), S[100], B.root, K.chrome);
    }
    if (s.kind === 'drum') {
      // ghế + bộ trống đủ (khung nhân vật, nhìn -Z)
      add(prism(new V3(0, 0, 0.05), new V3(0, 0.46, 0.05), 0.03, 0.03, 5), S[300], B.root, K.chrome);
      add(prism(new V3(0, 0.46, 0.05), new V3(0, 0.52, 0.05), 0.17, 0.17, 7), CO[500], B.root, K.leather);
      const shell = BL[300], head = P[700], hw = S[100];
      // trống bass: nằm ngang, mặt trước có tia sét
      const kick = new V3(0, 0.3, -0.72);
      add(new THREE.CylinderGeometry(0.29, 0.29, 0.42, 10).rotateX(Math.PI / 2).translate(kick.x, kick.y, kick.z), shell, B.root, K.leather);
      for (const dz of [-0.215, 0.215]) add(new THREE.TorusGeometry(0.29, 0.016, 3, 10).translate(kick.x, kick.y, kick.z + dz), hw, B.root, K.chrome);
      add(new THREE.CircleGeometry(0.27, 10).rotateY(Math.PI).translate(kick.x, kick.y, kick.z - 0.222), CO[500], B.root);
      add(shapeGeo(boltShape(), new V3(kick.x, kick.y, kick.z - 0.226), 0.2), WH[500], B.root, K.glow);
      const drum = (c0: THREE.Vector3, r: number, h: number, tilt: number, col = shell) => {
        const q = new THREE.Euler(-tilt, 0, 0);
        add(new THREE.CylinderGeometry(r, r, h, 9).rotateX(q.x).translate(c0.x, c0.y, c0.z), col, B.root, K.leather);
        const top = new V3(0, h / 2 + 0.002, 0).applyEuler(q).add(c0);
        add(new THREE.CircleGeometry(r * 0.96, 9).rotateX(-Math.PI / 2).rotateX(q.x).translate(top.x, top.y, top.z), head, B.root);
        add(new THREE.TorusGeometry(r, 0.01, 3, 9).rotateX(Math.PI / 2).rotateX(q.x).translate(top.x, top.y, top.z), hw, B.root, K.chrome);
        add(prism(new V3(c0.x, 0, c0.z), new V3(c0.x, c0.y - h / 2, c0.z), 0.012, 0.012, 4), hw, B.root, K.chrome);
        return top;
      };
      inst.snare = toChest(drum(new V3(-0.16, 0.62, -0.42), 0.17, 0.14, 0.12, S[300]).add(new V3(0, 0.02, 0)));
      inst.tom1 = toChest(drum(new V3(-0.15, 0.78, -0.66), 0.13, 0.17, 0.45).add(new V3(0, 0.02, 0)));
      inst.tom2 = toChest(drum(new V3(0.15, 0.78, -0.66), 0.14, 0.18, 0.45).add(new V3(0, 0.02, 0)));
      inst.floor = toChest(drum(new V3(0.42, 0.45, -0.3), 0.2, 0.36, 0.05).add(new V3(0, 0.02, 0)));
      // hi-hat + 3 chũm chọe (crash trái, crash phải, ride)
      const cym = (c0: THREE.Vector3, r: number, tilt: number, rz = 0) => {
        add(new THREE.ConeGeometry(r, r * 0.12, 9, 1, true).rotateX(tilt).rotateZ(rz).translate(c0.x, c0.y, c0.z), WH[700], B.root, K.chrome);
        add(prism(new V3(c0.x, 0, c0.z + 0.05), c0, 0.01, 0.01, 4), hw, B.root, K.chrome);
        return toChest(c0.clone().add(new V3(0, 0.03, 0.08)));
      };
      inst.hat = cym(new V3(-0.44, 0.84, -0.4), 0.17, -0.05);
      add(new THREE.ConeGeometry(0.17, 0.02, 9, 1, true).rotateX(Math.PI).translate(-0.44, 0.81, -0.4), WH[700], B.root, K.chrome);
      inst.crashL = cym(new V3(-0.55, 1.28, -0.62), 0.22, -0.35, 0.2);
      inst.crashR = cym(new V3(0.5, 1.34, -0.66), 0.24, -0.35, -0.2);
      inst.ride = cym(new V3(0.66, 1.06, -0.3), 0.26, -0.2, -0.25);
      // dùi
      for (const sd of [-1, 1] as const) {
        const W = REST_ABS[sd < 0 ? B.hdL : B.hdR]!;
        add(prism(new V3(W.x, W.y - 0.04, W.z + 0.08), new V3(W.x, W.y - 0.08, W.z - 0.34), 0.008, 0.006, 4), WH[300], sd < 0 ? B.hdL : B.hdR);
      }
    } else if (s.kind === 'lead' || s.kind === 'bass') {
      guitar(batch, c, s.kind === 'lead', inst);
    } else if (s.kind === 'keys') {
      // synth 2 tầng trên chân chữ X
      const z = -0.42;
      for (const [y, tz, wdt] of [[0.92, 0, 1.0], [1.08, 0.16, 0.9]] as const) {
        add(box(new V3(0, y, z + tz), wdt, 0.07, 0.3), CO[300], B.root, K.leather);
        add(box(new V3(0, y + 0.037, z + tz - 0.06), wdt - 0.08, 0.008, 0.14), P[500], B.root);
        for (let k = 0; k < 14; k++) add(box(new V3(-wdt / 2 + 0.07 + k * (wdt - 0.14) / 13, y + 0.044, z + tz - 0.08), 0.02, 0.01, 0.08), CO[700], B.root);
        add(box(new V3(0, y + 0.037, z + tz + 0.09), wdt - 0.1, 0.006, 0.05), CO[500], B.root);
        for (let k = 0; k < 6; k++) add(stud(new V3(-0.3 + k * 0.12, y + 0.045, z + tz + 0.09), 0.012), k === 2 ? BL[100] : S[100], B.root, k === 2 ? K.glow : K.chrome);
      }
      for (const s2 of [-1, 1]) add(prism(new V3(s2 * 0.35, 0, z - 0.1), new V3(-s2 * 0.35, 0.9, z + 0.1), 0.02, 0.02, 4), S[300], B.root, K.chrome);
      add(shapeGeo(boltShape(), new V3(0.3, 0.92, z - 0.152), 0.03), WH[500], B.root, K.glow);
      inst.left = toChest(new V3(-0.2, 0.99, z - 0.06));
      inst.right = toChest(new V3(0.18, 0.99, z - 0.06));
    } else {
      // chân mic thẳng (đế chân chữ T) trước mặt
      const z = -0.38;
      add(prism(new V3(0, 0, z), new V3(0, 0.03, z), 0.16, 0.14, 6), CO[500], B.root, K.chrome);
      add(prism(new V3(0, 0.03, z), new V3(0, 1.44, z), 0.012, 0.012, 5), S[300], B.root, K.chrome);
      add(prism(new V3(0, 1.44, z), new V3(0, 1.53, z + 0.17), 0.016, 0.02, 6), CO[700], B.root, K.leather);
      add(gem(new V3(0, 1.545, z + 0.2), 0.028, 0.03, 0.03, 6, 4), S[300], B.root, K.chrome);
      inst.mic = toChest(new V3(0, 1.43, z - 0.02));
    }
    mus.push({ s, c, seed: i * 1.37, inst, bangT: 9, lastBi: -1 });
  });
  batch.build(scene, 'band-steel');
  for (const m of mus) {
    const r = m.c.bones[B.root]!;
    r.position.set(m.s.x, m.s.y, m.s.z);
    r.rotation.y = m.s.yaw;
  }

  const tgt = new V3(), pole = new V3(), hdir = new V3(), wp = new V3();
  let t = 0, beatRate = 2, lastBeat = 0;
  return {
    update(f: FrameState) {
      const dt = Math.max(0, Math.min(f.dt, 0.1));
      t += dt;
      const hype = clamp(f.hype, 0, 1);
      const b = Math.max(0, f.beat);
      if (dt > 0) { const br = (f.beat - lastBeat) / dt; if (br > 0.5 && br < 6) beatRate = lerpExp(beatRate, br, dt, 0.5); }
      lastBeat = f.beat;
      const spb = 1 / Math.max(0.5, beatRate);
      const ph = b % 1;
      const hit = heavy(ph * spb);
      const bi = Math.floor(b);
      batch.setHype(hype, f.beatPulse);
      for (const m of mus) {
        const { c, s, inst, seed } = m;
        const bn = c.bones;
        const groove = 0.4 + 0.6 * hype;
        if (bi !== m.lastBi) {
          m.lastBi = bi;
          const strong = s.kind === 'lead' ? hype >= 0.45 && (hype > 0.75 || bi % 2 === 0) : s.kind === 'bass' || s.kind === 'vox' ? hype > 0.6 && bi % 2 === 1 : s.kind === 'drum' ? hype > 0.5 : hype > 0.85 && bi % 4 === 0;
          if (strong) m.bangT = 0;
        }
        m.bangT += dt;
        const bang = heavy(m.bangT) * clamp((hype - 0.3) / 0.4, 0, 1);
        const nod = s.kind === 'bass' ? 0.6 : s.kind === 'lead' ? 1 : s.kind === 'drum' ? 0.5 : 0.7;
        const sw = Math.sin((b + seed * 0.3) * Math.PI * 0.5);
        bn[B.hips]!.rotation.set(0, sw * 0.05 * groove, sw * 0.03 * groove);
        bn[B.chest]!.rotation.set(-0.04 * hit * groove - 0.25 * bang * nod, -sw * 0.05, -sw * 0.03 * groove);
        bn[B.neck]!.rotation.set(-0.2 * bang * nod, 0, 0);
        bn[B.head]!.rotation.set(-0.4 * bang * nod - 0.05 * hit * groove, Math.sin(t * 0.4 + seed) * 0.12 * (1 - bang), Math.sin(t * 0.5 + seed) * 0.05);
        if (s.kind === 'drum') {
          // ngồi: đùi ngang, cẳng chân xuống bàn đạp; đá kép nhanh ở Hype cao
          bn[B.hips]!.position.y = 0.55;
          const dk = hype > 0.55 ? Math.max(0, Math.sin(b * Math.PI * 4)) : Math.max(0, Math.sin(b * Math.PI * 2)) * 0.6;
          const dk2 = hype > 0.55 ? Math.max(0, -Math.sin(b * Math.PI * 4)) : 0;
          bn[B.thL]!.rotation.set(1.45 + 0.08 * dk2, 0, -0.2); bn[B.shL]!.rotation.set(-1.35 - 0.1 * dk2, 0, 0.12);
          bn[B.thR]!.rotation.set(1.45 + 0.08 * dk, 0, 0.2); bn[B.shR]!.rotation.set(-1.35 - 0.1 * dk, 0, -0.12);
          bn[B.chest]!.rotation.x += 0.12;
          const crash = hype > 0.45 && bi % 4 === 0 && ph < 0.6;
          for (const sd of [-1, 1] as const) {
            const mine = (bi % 2 === 0) === (sd < 0);
            let base: THREE.Vector3;
            if (crash) base = sd < 0 ? inst.crashL! : inst.crashR!;
            else if (sd < 0) base = Math.floor(b * 2) % 4 === 3 ? inst.tom1! : inst.hat!;
            else base = hype > 0.7 && bi % 8 >= 6 ? (bi % 2 ? inst.floor! : inst.tom2!) : inst.snare!;
            const sub = (b * 2) % 1; // 8 nốt móc
            const up = (crash ? (1 - hit) * 0.25 : (mine ? 0.1 + 0.12 * hype : 0.06) * (1 - heavy(sub * spb * 0.5))) ;
            tgt.copy(base).add(new V3(-sd * 0.02, 0.1 + up, 0.28));
            aimArm(c, sd, tgt, pole.set(sd, -0.4, 0.5), 0);
            const twirl = sd > 0 && hype > 0.6 && bi % 16 === 15 ? ph * Math.PI * 2 : 0;
            bn[sd < 0 ? B.hdL : B.hdR]!.rotation.set(-1.0 + up * 2 - twirl, 0, 0);
            hand(c, sd, 'grip');
          }
          bn[B.jaw]!.rotation.x = -0.1 * hit * hype;
        } else if (s.kind === 'lead' || s.kind === 'bass') {
          const lead = s.kind === 'lead';
          const solo = lead && hype > 0.8 && (bi % 16) >= 8 ? 1 : 0;
          legs(c, 0, 0, lead ? 0.16 : 0.22, (lead ? 0.12 : 0.2) + 0.08 * hit * groove);
          if (solo) { bn[B.chest]!.rotation.x += 0.35; bn[B.neck]!.rotation.x += 0.25; bn[B.head]!.rotation.x += 0.2; bn[B.hips]!.position.y -= 0.05; bn[B.thL]!.rotation.x += 0.3; bn[B.shL]!.rotation.x -= 0.6; }
          tgt.copy(inst.neck!).add(new V3(Math.sin(b * Math.PI * 0.5) * 0.05, 0, 0));
          aimArm(c, -1, tgt, pole.set(-0.6, -1, 0.2), 0, hdir.set(0.3, -0.3, -1));
          hand(c, -1, 'grip');
          const windmill = lead && hype > 0.6 && bi % 16 >= 12 && !solo;
          if (windmill) {
            const a = (b % 1) * Math.PI * 2;
            tgt.copy(inst.strum!).add(new V3(0.15 + Math.sin(a) * 0.12, 0.28 + Math.cos(a) * 0.42, -0.08));
            aimArm(c, 1, tgt, pole.set(1, 0, 0.6), 0);
            hand(c, 1, 'grip');
          } else {
            const strum = (lead ? Math.sin(b * Math.PI * 4) : Math.sin(b * Math.PI * 2)) * 0.05 * groove;
            tgt.copy(inst.strum!).add(new V3(0.02, strum + 0.02, 0));
            aimArm(c, 1, tgt, pole.set(1, -0.6, 0.6), 0.4);
            hand(c, 1, 'grip');
          }
          bn[B.jaw]!.rotation.x = -0.25 * bang;
        } else if (s.kind === 'keys') {
          legs(c, b * Math.PI, 0.05 * groove, 0.1, 0.05);
          bn[B.chest]!.rotation.x -= 0.12;
          for (const sd of [-1, 1] as const) {
            const off = ((b + (sd > 0 ? 0.5 : 0)) % 1);
            const raise = sd > 0 && hype > 0.75 && bi % 8 === 7 ? 1 : 0;
            tgt.copy(sd < 0 ? inst.left! : inst.right!).add(new V3(Math.sin(t * 1.3 + sd) * 0.08, 0.04 + Math.max(0, 0.04 - off * 0.08) + raise * 0.7, raise * 0.1));
            aimArm(c, sd, tgt, pole.set(sd, -0.5, 0.5), 0, raise ? hdir.set(0, 1, 0) : hdir.set(0, -0.6, -1));
            hand(c, sd, raise ? 'horns' : 'open', 0.6 + raise * 0.4);
          }
        } else {
          // bè phụ: tay trong (về phía ca sĩ) cầm mic trên chân, tay ngoài nắm đấm / tay sừng bơm theo phách
          legs(c, 0, 0, 0.15, 0.1 + 0.1 * hit * groove);
          const sd = (s.side ?? 1) as -1 | 1;
          const inner = (-sd) as -1 | 1;
          tgt.copy(inst.mic!).add(new V3(-inner * 0.02, 0, 0));
          aimArm(c, inner, tgt, pole.set(inner, -0.8, 0.2), 0, hdir.set(0, -0.2, -1));
          hand(c, inner, 'grip');
          const up = clamp((hype - 0.25) / 0.4, 0, 1);
          const pump = hit * 0.12 * up;
          tgt.set(sd * (0.25 + 0.05 * up), THREE.MathUtils.lerp(-0.45, 0.62, up) + pump, -0.15 - 0.1 * up);
          aimArm(c, sd, tgt, pole.set(sd, THREE.MathUtils.lerp(-1, 0.4, up), 0.3), 0, up > 0.5 ? hdir.set(0, 1, -0.2) : undefined);
          hand(c, sd, up < 0.3 ? 'open' : (bi + (sd > 0 ? 2 : 0)) % 8 < 4 ? 'horns' : 'fist', up < 0.3 ? 0.4 : 1);
          bn[B.jaw]!.rotation.x = -0.35 * clamp(f.level, 0, 1) * (0.5 + 0.5 * Math.sin(t * 7 + seed));
        }
        updateHair(c, dt);
      }
      void syncChest; void worldToChest; void wp;
    },
    dispose() { batch.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { band: (ctx) => createSteelBand(ctx.scene) };
