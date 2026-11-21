// "Đêm Sao Điểm Ảnh" · khe flyby (P5, STYLE_E §6, secretSet.plane 'paperPlane'): MÁY BAY GIẤY KÝ HOẠ KÉO TOAN.
// Hai máy bay giấy gấp (cánh may-100, sống gấp may-300, nét ký hoạ mực trên cánh) mỗi chiếc kéo một TOAN căng khung gỗ bằng
// hai dây: toan 1 = khẩu hiệu 1, toan 2 (theo sau, gần hơn) = khẩu hiệu 4, nền vệt cọ pixel + chữ kem crôm viền mực;
// toan có mặt tranh cả hai phía (đọc xuôi từ mắt ca sĩ lẫn máy toàn cảnh). Bay TRÁI → PHẢI theo hành lang FLYBY của mặc
// định, leo lên khi qua khán đài, KHÔNG dừng: bay tiếp tới khi cách gốc > FLYBY.exitR mới ẩn.
// Hợp đồng như flyby.ts: Hype ≥ 0,95 (tái kích hoạt khi < 0,8, hồi chiêu 25 s) hoặc consumeFlybyRequest(); 'cs-secret'
// kind 'plane' start/end; điểm nhìn secretFocusState. 2 draw call khi chạy (tô + viền, một hình học gộp), 0 khi rảnh.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FLYBY, STADIUM_CENTRE, STANDS_R_INNER, STANDS_R_OUTER } from '../../../../world/layout';
import { consumeFlybyRequest, getCheerTexts, onCheerChange } from '../../balloons';
import type { FlybyHandle, OutsideBuildContext, OutsideBuilders } from '../../builders';
import { emitSecret, secretFocusState } from '../../secretShared';
import { drawCanvasPainting } from './bannerKit';
import { MODE, Parts, V2, V3, makePixelMesh, pr, slab, sm } from './secretKit';

const DUR = 18;
const COOLDOWN = 25;
/** Toan kéo (m), dây dài, tỉ lệ máy bay. */
const BW = 30, BH = 11, ROPE = 9, PS = 2.2;
const AW = 1024, CH = Math.round((AW * BH) / BW);
const PAIRS = [
  { x0: -240, y: FLYBY.y + 4, z: FLYBY.z, text: 0, style: 0 },
  { x0: -240 - BW - FLYBY.gap, y: FLYBY.y2 + 4, z: FLYBY.z2, text: 3, style: 1 },
].map((p) => {
  const dz = p.z - STADIUM_CENTRE.z;
  const xIn = Math.sqrt(Math.max(STANDS_R_INNER ** 2 - dz * dz, 0)), xOut = Math.sqrt(STANDS_R_OUTER ** 2 - dz * dz);
  return { ...p, c0: xIn - 20, c1: xOut };
});

/** Một cặp (máy bay + dây + toan) trong toạ độ cục bộ: mũi máy bay +X tại gốc, toan treo phía −X. */
function buildPair(p: Parts, g: number, cell: [number, number, number, number]) {
  const may = pr('may'), dat = pr('dat');
  const ink = 0x0b0a1a;
  // máy bay giấy: 2 cánh (tam giác, nhị diện nhẹ) + sống gấp (tam giác đứng)
  for (const sz of [-1, 1]) {
    const w = slab([V2(6, 0), V2(-5, 0), V2(-5.6, 5.2)], 0.12);
    w.rotateX(sz * (Math.PI / 2 - 0.18)); // nằm ngang, vểnh lên
    w.scale(PS, PS, PS);
    p.add(w, may[100], null, { g, out: V3(0, 0, 0) });
    // nét ký hoạ trên cánh
    const ln = new THREE.BoxGeometry(6.5, 0.08, 0.16); ln.translate(-1.5, 0.36, sz * 1.6); ln.rotateY(sz * 0.18); ln.scale(PS, PS, PS);
    p.add(ln, ink, null, { g, mode: MODE.flat, out: 'none' });
  }
  const keel = slab([V2(6, 0), V2(-5, 0), V2(-4.6, -2.0)], 0.2);
  keel.scale(PS, PS, PS);
  p.add(keel, may[300], null, { g, out: V3(0, -0.5, 0) });
  // dây kéo: từ đuôi máy bay tới hai góc trên toan
  const tail = V3(-5 * PS, -0.6, 0);
  const right = -5 * PS - ROPE;
  for (const cy of [BH / 2 - 0.3, -BH / 2 + 0.3]) {
    const a = tail, b = V3(right, -1.5 + cy, 0);
    const r = new THREE.BoxGeometry(0.16, a.distanceTo(b), 0.16);
    r.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()), V3(1, 1, 1)));
    p.add(r, may[500], null, { g, out: 'none' });
  }
  // toan: khung gỗ + mặt tranh hai phía
  const cx = right - BW / 2, cy = -1.5;
  const box = new THREE.BoxGeometry(BW, BH, 0.6); box.translate(cx, cy, 0);
  p.add(box, dat[300], null, { g });
  const front = new THREE.PlaneGeometry(BW, BH); front.translate(cx, cy, 0.32);
  p.add(front, 0xffffff, null, { g, mode: MODE.tex, out: 'none', uv: cell });
  const back = new THREE.PlaneGeometry(BW, BH); back.rotateY(Math.PI); back.translate(cx, cy, -0.32);
  p.add(back, 0xffffff, null, { g, mode: MODE.tex, out: 'none', uv: cell });
}

export function createPaperFlyby(ctx: OutsideBuildContext): FlybyHandle {
  const { scene } = ctx;
  const canvas = document.createElement('canvas');
  canvas.width = AW; canvas.height = CH * 2;
  const g2 = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    const texts = getCheerTexts();
    PAIRS.forEach((p, i) => drawCanvasPainting(g2, 0, i * CH, AW, CH, texts[p.text] ?? '', p.style, 91 + i * 7));
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(draw).catch(() => {});

  const parts = new Parts();
  PAIRS.forEach((_, i) => buildPair(parts, i, [0, 1, 1 - ((i + 1) * CH) / (CH * 2), 1 - (i * CH) / (CH * 2)]));
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const pm = makePixelMesh(parts.build(), 2, root, { map: tex, inkBack: 0.4 });
  pm.hide(0); pm.hide(1);

  let armed = true, lastStart = -Infinity, start = -1, pStart = -1;
  const live = [false, false];
  const mid = [V3(0, 0, 0), V3(0, 0, 0)];
  const begin = (t: number) => {
    if (start >= 0) emitSecret('plane', 'end');
    emitSecret('plane', 'start');
    start = t; lastStart = t; pStart = t;
    live[0] = live[1] = true;
    root.visible = true;
  };
  const pairY = (i: number, x: number) => { const p = PAIRS[i]!; return p.y + (FLYBY.climbY - p.y) * sm(p.c0, p.c1, Math.abs(x)); };
  const e = new THREE.Euler(), q = new THREE.Quaternion(), v = V3(0, 0, 0), one = V3(1, 1, 1);
  const updatePairs = (ep: number) => {
    for (let i = 0; i < 2; i++) {
      const p = PAIRS[i]!;
      if (!live[i]) { pm.hide(i); continue; }
      const x = p.x0 + FLYBY.speed * ep;
      const y = pairY(i, x) + Math.sin(ep * 0.9 + i * 2) * 0.6;
      const z = p.z + Math.sin(ep * 0.3 + i) * 1.2;
      if (Math.hypot(x - BW, y, z) > FLYBY.exitR) { live[i] = false; pm.hide(i); continue; }
      mid[i]!.set(x - 5 * PS - ROPE - BW / 2, y - 1.5, z);
      const slope = pairY(i, x + 0.5) - pairY(i, x - 0.5);
      // giấy chao lượn theo bậc nhẹ: lắc cánh + ngóc mũi khi leo
      e.set(0.12 * Math.sin(ep * 1.6 + i), 0, Math.atan(slope) * 0.7 + 0.04 * Math.sin(ep * 2.3));
      q.setFromEuler(e);
      pm.m(i).compose(v.set(x, y, z), q, one);
    }
    if (!live[0] && !live[1]) { pStart = -1; root.visible = false; }
  };

  return {
    update(f: FrameState, t: number) {
      pm.tick();
      if (consumeFlybyRequest()) begin(t);
      if (f.hype < 0.8) armed = true;
      else if (armed && f.hype >= 0.95 && t - lastStart >= COOLDOWN) { armed = false; begin(t); }
      if (pStart >= 0) updatePairs(t - pStart);
      if (start < 0) return;
      const el = t - start;
      if (el > DUR || el < 0) {
        start = -1;
        emitSecret('plane', 'end');
        secretFocusState.active = false;
        return;
      }
      const a = live[0] ? mid[0]! : mid[1]!, b = live[1] ? mid[1]! : mid[0]!;
      secretFocusState.v.set(THREE.MathUtils.clamp((a.x + b.x) / 2, -45, 45), (a.y + b.y) / 2, (a.z + b.z) / 2);
      secretFocusState.active = true;
    },
    dispose() {
      disposed = true;
      off();
      if (start >= 0) { emitSecret('plane', 'end'); secretFocusState.active = false; }
      pm.dispose(); tex.dispose();
      root.removeFromParent();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { flyby: createPaperFlyby };
