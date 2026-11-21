// "Đêm Sao Điểm Ảnh" · khe secretJet (P5, STYLE_E §6, heartFigure 'brushHeart'): HAI CÂY CỌ BAY VẼ TRÁI TIM NÉT CỌ SON
// (thay phi đội phản lực + tim khói).
// Hai cây cọ (cán gỗ dat, đai kim loại may, chùm lông son) bay vào từ hai phía ngoài sân, gặp nhau ở mũi tim, rồi mỗi cây
// vẽ một nửa tim từ mũi dưới lên khe trên (tốc độ đều): nét cọ là dải băng rộng 2,4–3,2 m, sợi lông = dải dọc ba bậc son,
// viền mực 1 texel hai mép, vệt sơn bắn lấm tấm hiện theo nét. Vẽ xong: lòng tim tô caro 50 % son-300 (dither), cọ vẩy một
// vòng rồi bay RA khỏi sân (> 400 m) và ẩn; tim đập nhẹ theo phách rồi tan bằng dither Bayer.
// Hình nằm trên "bảng" quay về camera quanh trục X tại (0, 44, −44) (đọc xuôi từ mắt ca sĩ lẫn máy toàn cảnh, không lật gương).
// Draw call khi chạy: tô + viền = 2 (một hình học gộp: tim, lòng tim, vệt sơn, hai cây cọ); rảnh 0.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { MODE, Parts, V2, V3, makePixelMesh, pr, ribbon, sm } from './secretKit';

const D = 24;
export const HEART_CENTER = V3(0, 44, -44);
const K = 1.15; // tim ≈ 37 × 25 m
const T_MEET = 3, T_DONE = 10.5, T_FLOURISH = 12, T_EXIT = 16.5, T_FILL = 10.8, T_FADE0 = 19.5, T_FADE1 = 22.5;
const EXIT_X = 420;

/** Điểm tim (toạ độ bảng) tại θ: θ = π mũi dưới, θ = 0 / 2π khe trên. */
function heart(th: number, out: THREE.Vector2) {
  const s = Math.sin(th);
  return out.set(16 * s * s * s * K, (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) * K + 4);
}
/** Nửa tim của cọ b (0 trái, 1 phải) tại tiến độ u ∈ [0, 1]. */
const halfAt = (b: number, u: number, out: THREE.Vector2) => heart(Math.PI + (b === 0 ? 1 : -1) * u * Math.PI, out);

function buildAll(): THREE.BufferGeometry {
  const son = pr('son'), dat = pr('dat'), may = pr('may');
  const p = new Parts();
  // hai nửa nét cọ (nhóm 0), aRev = tiến độ
  for (let b = 0; b < 2; b++) {
    const pts = Array.from({ length: 49 }, (_, i) => halfAt(b, i / 48, V2(0, 0)));
    const w = (u: number) => 2.4 + 0.8 * Math.sin(Math.PI * u) + 0.3 * Math.sin(u * 23 + b);
    p.add(ribbon(pts, w), son[500], null, { g: 0, mode: MODE.brush });
  }
  // lòng tim (nhóm 0, mode fade2) lùi sau nét
  const outline = Array.from({ length: 64 }, (_, i) => heart((i / 64) * Math.PI * 2, V2(0, 0)).multiplyScalar(0.94));
  const fill = new THREE.ShapeGeometry(new THREE.Shape(outline));
  fill.translate(0, 0.12, -1.2);
  p.add(fill, son[300], null, { g: 0, mode: MODE.fade2, out: 'none' });
  // vệt sơn bắn lấm tấm quanh nét (hiện theo nét)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const q = V2(0, 0), q2 = V2(0, 0);
  for (let k = 0; k < 46; k++) {
    const b = k % 2, u = rnd();
    halfAt(b, u, q); halfAt(b, Math.min(1, u + 0.01), q2);
    const nx = -(q2.y - q.y), ny = q2.x - q.x, L = Math.hypot(nx, ny) || 1;
    const off = (rnd() < 0.5 ? -1 : 1) * (2.2 + rnd() * 2.4);
    const r = 0.3 + rnd() * 0.45;
    const dot = new THREE.CircleGeometry(r, 4);
    dot.translate(q.x + (nx / L) * off, q.y + (ny / L) * off, 0.1);
    const rev = new Float32Array(dot.attributes.position.count).fill(u + 0.02);
    dot.setAttribute('aRev', new THREE.BufferAttribute(rev, 1));
    p.add(dot, k % 3 ? son[500] : son[300], null, { g: 0, mode: MODE.flat });
  }
  // hai cây cọ (nhóm 1, 2): đầu lông ở gốc, cán dọc +Y
  for (let b = 0; b < 2; b++) {
    const g = 1 + b;
    const tip = new THREE.ConeGeometry(1.0, 2.8, 6); tip.rotateX(Math.PI); tip.translate(0, 1.4, 0);
    p.add(tip, son[500], null, { g, out: V3(0, 2, 0) });
    const tuft = new THREE.CylinderGeometry(1.05, 1.0, 1.0, 6); tuft.translate(0, 3.2, 0);
    p.add(tuft, dat[700], null, { g });
    const fer = new THREE.CylinderGeometry(0.85, 1.05, 2.2, 6); fer.translate(0, 4.8, 0);
    p.add(fer, may[100], null, { g });
    const crimp = new THREE.CylinderGeometry(0.9, 0.9, 0.35, 6); crimp.translate(0, 5.6, 0);
    p.add(crimp, may[500], null, { g, out: 'none' });
    const handle = new THREE.CylinderGeometry(0.5, 0.75, 9.5, 6); handle.translate(0, 10.6, 0);
    p.add(handle, b ? dat[300] : dat[500], null, { g, out: V3(0, 10, 0) });
    const end = new THREE.SphereGeometry(0.62, 6, 3); end.translate(0, 15.4, 0);
    p.add(end, son[700], null, { g });
  }
  return p.build();
}

export function createBrushHeart(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const pm = makePixelMesh(buildAll(), 3, root, { board: true });
  pm.u.uC.value.copy(HEART_CENTER);

  const tip = V2(0, 0), tip2 = V2(0, 0), pos = V3(0, 0, 0), from = V3(0, 0, 0), handle = V3(0, 0, 0);
  const Y = V3(0, 1, 0), q = new THREE.Quaternion(), sc = V3(1, 1, 1);
  const bottom = halfAt(0, 0, V2(0, 0));

  /** Đặt cọ b: mũi lông tại `pos` (toạ độ bảng), cán hướng `handle`. */
  const setBrush = (b: number, show: boolean) => {
    if (!show) { pm.hide(1 + b); return; }
    q.setFromUnitVectors(Y, handle.normalize());
    pm.m(1 + b).compose(pos, q, sc);
  };

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      pm.tick();
      // tiến độ vẽ (đều)
      const u = Math.min(1, Math.max(0, (t - T_MEET) / (T_DONE - T_MEET)));
      pm.u.uRev.value = t < T_MEET ? -0.01 : u + 0.002;
      // tim: đập theo phách sau khi xong, tan dần cuối màn
      const beat = t > T_DONE ? 1 + 0.035 * f.beatPulse : 1;
      pm.m(0).makeScale(beat, beat, 1);
      pm.u.uFade2.value = 0.5 * sm(T_FILL, T_FILL + 1.4, t);
      pm.u.uFade.value = 1 - sm(T_FADE0, T_FADE1, t);
      for (let b = 0; b < 2; b++) {
        const side = b === 0 ? -1 : 1;
        if (t < T_MEET) {
          // bay vào từ ngoài sân theo cung tới mũi tim
          const k = sm(0, T_MEET, t);
          from.set(side * 260, 30, 6);
          pos.set(bottom.x, bottom.y, 1.2).lerp(from, 1 - k);
          pos.y += Math.sin(k * Math.PI) * 14;
          handle.set(side * 0.9 * (1 - k) + side * 0.35, 1, 0.5);
        } else if (t < T_DONE) {
          halfAt(b, u, tip); halfAt(b, Math.min(1, u + 0.02), tip2);
          pos.set(tip.x, tip.y, 1.2);
          // cán nghiêng ra ngoài hướng chuyển động + về phía camera, lắc theo nét cọ
          handle.set(-(tip2.x - tip.x) * 0.6 + side * 0.4, 1, 0.55 + 0.15 * Math.sin(t * 9 + b));
        } else if (t < T_FLOURISH) {
          // vẩy một vòng nhỏ ở khe trên
          const k = (t - T_DONE) / (T_FLOURISH - T_DONE);
          halfAt(b, 1, tip);
          pos.set(tip.x + side * Math.sin(k * Math.PI * 2) * 3, tip.y + (1 - Math.cos(k * Math.PI * 2)) * 2.5 + k * 3, 1.2 + k * 2);
          handle.set(side * (0.4 + k), 1, 0.6);
        } else {
          // bay ra ngoài sân, tăng tốc
          const k = (t - T_FLOURISH) / (T_EXIT - T_FLOURISH);
          halfAt(b, 1, tip);
          pos.set(tip.x + side * EXIT_X * k * k, tip.y + 3 + 26 * k, 3.2 + 10 * k);
          handle.set(side * 1.4, 1, 0.4);
        }
        const pop = Math.min(1, t / 0.4);
        sc.set(pop, pop, pop);
        setBrush(b, t < T_EXIT);
      }
    },
    focus(_t: number, out: THREE.Vector3) { out.copy(HEART_CENTER); },
    dispose() { pm.dispose(); root.removeFromParent(); },
  };
}

export const builders: Partial<OutsideBuilders> = { secretJet: createBrushHeart };
