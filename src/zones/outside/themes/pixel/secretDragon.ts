// "Đêm Sao Điểm Ảnh" · khe secretDragon (P5, STYLE_E §6): ĐÔI RỒNG NÉT CỌ (vàng crôm + ngọc).
// Mỗi rồng = đầu khối (mõm, hàm, 2 sừng, mắt kem đồng tử mực, bờm 3 vệt cọ, râu) + 12 "vệt cọ" thân (lăng trụ 5 cạnh thuôn,
// xen kẽ hai bậc màu, vây lưng tam giác bậc sáng) + đuôi quạt 3 vệt. Thân bám theo một đường cong tính sẵn theo ĐỘ DÀI CUNG
// (khoảng cách đều giữa các vệt kể cả khi lao nhanh), cộng sóng sin chạy dọc thân → "chuỗi vệt cọ uốn hình sin".
// Biên đạo (D = 24 s như mặc định): hai rồng xoắn ốc vào từ ngoài sân (r ≈ 210 m) 0–6,5 s, đuổi nhau quanh viên ngọc
// sao (0, 34, −42) bán kính 20 m, rồi xoắn ra xa > 230 m từ 17,5 s và ẩn. Đuôi rắc giọt sơn vuông.
// Viền mực 1 texel; tô 2 bậc cứng. Draw call khi chạy: tô + viền + hạt = 3; rảnh 0.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { Parts, TRS, V2, V3, makePixelMesh, makeSparks, pr, single, slab, sm } from './secretKit';

const D = 24;
export const DRAGON_PEARL = V3(0, 34, -42);
const NSEG = 12, GPD = 16; // nhóm mỗi rồng: 0 đầu, 1..12 thân, 13 đuôi
const G_PEARL = 2 * GPD;
const SEG_GAP = 3.0;
const OMEGA = 0.55;
const U0 = -12, U1 = D + 1, DU = 0.02;

/** Một vệt cọ thân: lăng trụ 5 cạnh dọc +X, đầu to đuôi nhỏ, + vây lưng. */
function pushStroke(p: Parts, g: number, body: number, fin: number, s: number) {
  const c = new THREE.CylinderGeometry(1.05 * s, 1.4 * s, 4.6, 5);
  c.rotateZ(-Math.PI / 2); // trục +X (đỉnh trên = +X)
  p.add(c, body, null, { g, out: V3(0, 0, 0) });
  const f = slab([V2(-1.6, 0), V2(1.0, 0), V2(-1.1, 1.5 * s + 0.6)], 0.35);
  f.translate(0, 1.0 * s, 0);
  p.add(f, fin, null, { g });
}

function buildDragon(p: Parts, d: number) {
  const crom = pr('crom'), bach = pr('bach'), may = pr('may'), son = pr('son');
  const ngoc = single('ngoc'), ink = single('ink');
  const A = d === 0 ? crom[500] : ngoc;
  const B = d === 0 ? crom[300] : bach[300];
  const L = d === 0 ? crom[100] : may[100];
  const Dk = d === 0 ? crom[700] : bach[500];
  const o = d * GPD;
  // đầu (dọc +X): sọ, mõm, hàm, sừng, mắt, bờm, râu
  const skull = new THREE.BoxGeometry(3.2, 2.4, 2.6);
  p.add(skull, A, null, { g: o });
  const snout = new THREE.CylinderGeometry(0.95, 1.3, 3.2, 4); snout.rotateZ(-Math.PI / 2); snout.rotateX(Math.PI / 4); snout.translate(2.9, -0.15, 0);
  p.add(snout, A, null, { g: o, out: V3(1.5, 0, 0) });
  const jaw = new THREE.BoxGeometry(3.0, 0.6, 1.8); jaw.translate(2.4, -1.35, 0); jaw.rotateZ(-0.12);
  p.add(jaw, son[500], null, { g: o });
  const nose = new THREE.BoxGeometry(0.6, 0.6, 1.2); nose.translate(4.6, 0.35, 0);
  p.add(nose, Dk, null, { g: o });
  for (const sz of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.42, 3.2, 4); horn.translate(0, 1.6, 0); horn.rotateZ(0.95); horn.translate(-0.6, 1.0, sz * 0.8);
    p.add(horn, L, null, { g: o });
    const eye = new THREE.BoxGeometry(0.9, 0.7, 0.3); eye.translate(0.9, 0.55, sz * 1.32);
    p.add(eye, crom[100], null, { g: o, mode: 1, out: 'none' });
    const pupil = new THREE.BoxGeometry(0.4, 0.5, 0.32); pupil.translate(1.15, 0.5, sz * 1.36);
    p.add(pupil, ink, null, { g: o, mode: 1, out: 'none' });
    // râu: vệt mảnh vắt ra sau
    const wh = new THREE.BoxGeometry(5.0, 0.22, 0.22); wh.translate(-2.2, 0, 0); wh.rotateY(sz * 0.5); wh.rotateZ(-0.25); wh.translate(4.2, -0.2, sz * 0.7);
    p.add(wh, L, null, { g: o });
  }
  // bờm: 3 vệt cọ tam giác hướng ra sau
  [[0.6, 0.3], [-0.3, 0.0], [-0.1, -0.5]].forEach(([y, rz], k) => {
    const m = slab([V2(0, -0.6), V2(0, 0.6), V2(-4.2 + k * 0.6, 0)], 0.5);
    m.rotateZ(rz!); m.translate(-1.4, y! + 0.6, 0);
    p.add(m, k === 1 ? B : Dk, null, { g: o });
  });
  // thân
  for (let i = 1; i <= NSEG; i++) {
    const s = 1 - (i / NSEG) * 0.55;
    pushStroke(p, o + i, i % 2 ? A : B, i % 2 ? L : Dk, s);
  }
  // đuôi: quạt 3 vệt
  for (const [rz, c] of [[0.5, B], [0, L], [-0.5, A]] as [number, number][]) {
    const t = slab([V2(0, -0.35), V2(0, 0.35), V2(-4.6, 0)], 0.4);
    t.rotateZ(rz); t.rotateX(Math.PI / 2 * (rz === 0 ? 1 : 0));
    p.add(t, c, null, { g: o + NSEG + 1 });
  }
}

function buildAll(): THREE.BufferGeometry {
  const p = new Parts();
  buildDragon(p, 0);
  buildDragon(p, 1);
  // viên ngọc sao: bát diện kem + vành crôm + 4 tia
  const crom = pr('crom');
  const gem = new THREE.OctahedronGeometry(2.4, 0);
  p.add(gem, crom[100], null, { g: G_PEARL, mode: 1, out: V3(0, 0, 0) });
  const ring = new THREE.TorusGeometry(3.8, 0.45, 3, 12);
  p.add(ring, crom[300], null, { g: G_PEARL, mode: 1, out: 'none' });
  for (let k = 0; k < 4; k++) {
    const ray = slab([V2(4.4, -0.5), V2(4.4, 0.5), V2(7.2, 0)], 0.3);
    ray.rotateZ((k * Math.PI) / 2 + Math.PI / 4);
    p.add(ray, crom[500], null, { g: G_PEARL, mode: 1 });
  }
  return p.build();
}

/** Đường bay của rồng d tại thời điểm giả u: xoắn ốc vào → vòng quanh ngọc → xoắn ra. */
function curve(d: number, u: number, out: THREE.Vector3) {
  const R = 20 + 190 * (1 - sm(-2, 6.5, u)) + 210 * sm(17.5, 24.5, u);
  const th = OMEGA * u + d * Math.PI + 0.6;
  return out.set(
    DRAGON_PEARL.x + Math.cos(th) * R,
    DRAGON_PEARL.y + 6 * Math.sin(2 * th + d * 1.3) + (d ? -3 : 3) + 0.05 * (R - 20),
    DRAGON_PEARL.z + Math.sin(th) * R * 0.72,
  );
}

export function createBrushDragons(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const pm = makePixelMesh(buildAll(), G_PEARL + 1, root);
  const NPT = 260;
  const sp = makeSparks(NPT, root);

  // bảng đường cong theo độ dài cung
  const NS = Math.ceil((U1 - U0) / DU) + 1;
  const tab = [new Float32Array(NS * 3), new Float32Array(NS * 3)];
  const len = [new Float32Array(NS), new Float32Array(NS)];
  const v = V3(0, 0, 0), pv = V3(0, 0, 0);
  for (let d = 0; d < 2; d++) {
    let acc = 0;
    for (let i = 0; i < NS; i++) {
      curve(d, U0 + i * DU, v);
      if (i) acc += v.distanceTo(pv);
      tab[d]!.set([v.x, v.y, v.z], i * 3); len[d]![i] = acc; pv.copy(v);
    }
  }
  /** Điểm trên đường của rồng d tại độ dài cung s. */
  const atLen = (d: number, s: number, out: THREE.Vector3) => {
    const L = len[d]!, T = tab[d]!;
    let lo = 0, hi = NS - 1;
    if (s <= 0) return out.set(T[0]!, T[1]!, T[2]!);
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m]! < s) lo = m; else hi = m; }
    const k = (s - L[lo]!) / Math.max(1e-6, L[hi]! - L[lo]!);
    return out.set(T[lo * 3]! + (T[hi * 3]! - T[lo * 3]!) * k, T[lo * 3 + 1]! + (T[hi * 3 + 1]! - T[lo * 3 + 1]!) * k, T[lo * 3 + 2]! + (T[hi * 3 + 2]! - T[lo * 3 + 2]!) * k);
  };
  const lenAtU = (d: number, u: number) => {
    const x = (u - U0) / DU, i = Math.max(0, Math.min(NS - 2, Math.floor(x))), k = Math.min(1, Math.max(0, x - i));
    return len[d]![i]! + (len[d]![i + 1]! - len[d]![i]!) * k;
  };

  const P = Array.from({ length: NSEG + 2 }, () => V3(0, 0, 0));
  const ax = V3(0, 0, 0), ay = V3(0, 0, 0), az = V3(0, 0, 0), up = V3(0, 1, 0), foc = V3(0, 0, 0), tmp = V3(0, 0, 0), vel = V3(0, 0, 0);
  const scl = V3(1, 1, 1);
  const tails = [V3(0, 0, 0), V3(0, 0, 0)];
  const crom = pr('crom'), may = pr('may');
  let emitAcc = 0, head = 0, lastT = 0;
  const place = (g: number, pos: THREE.Vector3, dir: THREE.Vector3, s: number, roll: number) => {
    ax.copy(dir).normalize();
    ay.copy(up).addScaledVector(ax, -ax.y);
    if (ay.lengthSq() < 1e-6) ay.set(1, 0, 0);
    ay.normalize();
    az.crossVectors(ax, ay);
    if (roll) { tmp.copy(ay).multiplyScalar(Math.cos(roll)).addScaledVector(az, Math.sin(roll)); az.crossVectors(ax, tmp); ay.copy(tmp); }
    const m = pm.m(g);
    m.makeBasis(ax, ay, az);
    m.scale(scl.set(s, s, s));
    m.setPosition(pos);
  };

  return {
    duration: D,
    start() { root.visible = true; emitAcc = 0; head = 0; lastT = 0; for (let i = 0; i < NPT; i++) sp.set(i, foc, 1e9, foc, 1, 0, 0, 0, 0, 0); sp.commit(); },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      pm.tick();
      sp.u.uT.value = t; sp.u.uPxScale.value = Math.max(1, Math.round(pm.u.uPxH.value / 240));
      const S = 1.5 * Math.min(1, 0.4 + t / 1.5);
      for (let d = 0; d < 2; d++) {
        const o = d * GPD;
        const sh = lenAtU(d, t);
        for (let i = 0; i <= NSEG + 1; i++) {
          const s = sh - i * SEG_GAP * 1.5 - (i ? 1.2 : 0);
          atLen(d, s, P[i]!);
          // sóng sin chạy dọc thân (dọc + ngang nhẹ)
          P[i]!.y += 1.8 * Math.sin(s * 0.32 - t * 4.2);
          P[i]!.x += 0.8 * Math.sin(s * 0.21 - t * 3.1 + d);
        }
        for (let i = 0; i <= NSEG + 1; i++) {
          if (i === 0) tmp.subVectors(P[0]!, P[1]!); else tmp.subVectors(P[i - 1]!, P[i]!);
          const roll = 0.25 * Math.sin(t * 1.7 + i * 0.4 + d);
          place(o + i, P[i]!, tmp, S, roll);
        }
        tails[d]!.copy(P[NSEG + 1]!);
      }
      if (t > lastT) {
        emitAcc = Math.min(emitAcc + t - lastT, 0.5);
        while (emitAcc > 0.05) {
          emitAcc -= 0.05;
          for (let d = 0; d < 2; d++) {
            const k = head++ % NPT;
            vel.set(Math.sin(head * 1.7) * 2.5, -1.5 + Math.cos(head * 2.3) * 1.5, Math.cos(head * 1.1) * 2.5);
            sp.set(k, tails[d]!, t, vel, 1.6, d === 0 ? crom[300] : single('ngoc'), d === 0 ? crom[100] : may[100], 2, 0.6, 3, (head % 5) / 5);
          }
        }
      }
      sp.commit();
      lastT = t;
      // viên ngọc: hiện 4–19 s, xoay, nhún theo phách
      const pe = sm(3.5, 4.5, t) * (1 - sm(18.5, 19.5, t));
      if (pe < 0.01) pm.hide(G_PEARL);
      else {
        const m = pm.m(G_PEARL);
        const s = pe * (1 + 0.12 * f.beatPulse);
        m.makeRotationY(t * 1.2);
        m.scale(scl.set(s, s, s));
        m.setPosition(DRAGON_PEARL);
      }
      // điểm nhìn: giữa hai đầu, kéo về ngọc
      foc.copy(P[0]!);
      atLen(0, lenAtU(0, t), tmp);
      foc.add(tmp).multiplyScalar(0.5).lerp(DRAGON_PEARL, 0.6);
    },
    focus(_t: number, out: THREE.Vector3) { out.copy(foc); },
    dispose() { pm.dispose(); sp.dispose(); root.removeFromParent(); },
  };
}

export const builders: Partial<OutsideBuilders> = { secretDragon: createBrushDragons };
void TRS;
