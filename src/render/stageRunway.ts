// Runway/catwalk + bục tròn từ walkLayout (runway giữa, 2 runway chéo, lối ngang, B-stage). 2 draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../core/types';
import { WALK_SHAPES, edgeRuns, shapeSignedDist } from './walkLayout';

/** Hộp nối 2 điểm (x, z) ở cao độ y; tiết diện w × h. */
function bar(ax: number, az: number, bx: number, bz: number, y: number, w: number, h: number, extend = 0): THREE.BufferGeometry {
  const L = Math.hypot(bx - ax, bz - az);
  const g = new THREE.BoxGeometry(w, h, L + extend);
  g.rotateY(Math.atan2(bx - ax, bz - az));
  g.translate((ax + bx) / 2, y, (az + bz) / 2);
  return g.toNonIndexed();
}

export function createRunway(scene: THREE.Scene) {
  const FLOOR = -1.7;
  const H = -FLOOR;
  const deckParts: THREE.BufferGeometry[] = [];
  const strips: THREE.BufferGeometry[] = [];
  for (const s of WALK_SHAPES) {
    if (!s.mesh) continue;
    if (s.kind === 'disc') {
      const g = new THREE.CylinderGeometry(s.r, s.r, H, Math.max(32, Math.round(s.r * 14))).toNonIndexed();
      g.translate(s.x, FLOOR / 2, s.z);
      deckParts.push(g);
      // vòng trong trang trí
      const inner = new THREE.TorusGeometry(s.r * 0.63, 0.03, 4, 64);
      inner.rotateX(Math.PI / 2);
      inner.translate(s.x, 0.005, s.z);
      strips.push(inner.toNonIndexed());
      inner.dispose();
    } else {
      deckParts.push(bar(s.ax, s.az, s.bx, s.bz, FLOOR / 2, s.hw * 2, H));
      // vạch ngang mỗi 2 m (bỏ phần nằm trong sân khấu/bục)
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
      const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
      for (let a = 2; a < L - 1; a += 2) {
        const cx = s.ax + ux * a, cz = s.az + uz * a;
        const px = -uz * (s.hw - 0.15), pz = ux * (s.hw - 0.15);
        const covered = WALK_SHAPES.some((o) => o !== s && (shapeSignedDist(o, cx - px, cz - pz) < 0.1 || shapeSignedDist(o, cx + px, cz + pz) < 0.1));
        if (covered) continue;
        strips.push(bar(cx - px, cz - pz, cx + px, cz + pz, 0.005, 0.05, 0.02));
      }
    }
    // mép phát sáng trên mặt + dải chân váy; bỏ phần nằm trong hình khác (chỗ nối gọn)
    const step = s.kind === 'disc' ? 0.35 : 0.1;
    for (const [off, y, w, h] of [[-0.02, 0.02, 0.08, 0.05], [0.015, -0.6, 0.03, 0.04]] as const) {
      for (const run of edgeRuns(s, step, off)) {
        // mép đoạn thẳng: cả run thẳng hàng → 1 hộp từ đầu tới cuối
        const pts = run.closed ? [...run.pts, run.pts[0]!] : s.kind === 'seg' ? [run.pts[0]!, run.pts[run.pts.length - 1]!] : run.pts;
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
          strips.push(bar(ax, az, bx, bz, y, w, h, s.kind === 'disc' ? 0.02 : 0));
        }
      }
    }
  }
  const deckGeo = mergeGeometries(deckParts);
  const deckMat = new THREE.MeshBasicMaterial({ color: 0x100e1e });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  scene.add(deck);

  const stripGeo = mergeGeometries(strips);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x6a4cff, fog: false });
  const stripMesh = new THREE.Mesh(stripGeo, stripMat);
  scene.add(stripMesh);
  for (const g of [...strips, ...deckParts]) g.dispose();

  const col = new THREE.Color();
  return {
    update(f: FrameState, t: number) {
      const hue = (0.72 - f.hype * 0.55 + Math.sin(t * 0.2) * 0.05 + 1) % 1;
      const light = 0.42 + f.beatPulse * 0.25 * (0.4 + f.hype);
      stripMat.color.copy(col.setHSL(hue, 0.9, light));
    },
    dispose() {
      scene.remove(deck, stripMesh);
      deckGeo.dispose(); deckMat.dispose(); stripGeo.dispose(); stripMat.dispose();
    },
  };
}
