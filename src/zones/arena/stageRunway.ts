// Runway/catwalk + bục tròn (Kẹo đêm): thân night-500 mép bo, chân váy xếp cung (scallop) night-300/grape-700, lan can tròn mập + viền
// phát sáng theo Hype, hình khảm tim (bục bên) / sao lớn (B-stage). 2 draw call (toy gộp + dải sáng).
import { FIELD_Y, STAGE_Y } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { PAL, hypeColors, toColor } from '../../world/style';
import { WALK_SHAPES, edgeRuns, shapeSignedDist, type WalkShape } from './walkLayout';
import { Toy, bakeToonShade, createToyMaterial, updateToyHype } from './stageStyle';

/** Lan can mép runway/bục: cao RAIL_Y trên mặt sàn, lùi vào trong RAIL_IN (m). */
const RAIL_Y = 0.55;
const RAIL_IN = -0.08;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Thân bục tròn: trụ có mép trên bo tròn (lathe). */
function discBody(r: number, floor: number, x: number, z: number): THREE.BufferGeometry {
  const rr = 0.2, pts: THREE.Vector2[] = [new THREE.Vector2(0.001, floor), new THREE.Vector2(r, floor), new THREE.Vector2(r, STAGE_Y - rr)];
  for (let i = 1; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); pts.push(new THREE.Vector2(r - rr + Math.cos(a) * rr, STAGE_Y - rr + Math.sin(a) * rr)); }
  pts.push(new THREE.Vector2(0.001, STAGE_Y));
  const g = new THREE.LatheGeometry(pts, Math.max(32, Math.round(r * 14)));
  g.translate(x, 0, z);
  return g;
}

export function createRunway(scene: THREE.Scene) {
  // Thân runway rủ từ mặt sân khấu xuống dưới sàn khán giả 0,2 m.
  const FLOOR = FIELD_Y - 0.2;
  const H = STAGE_Y - FLOOR;
  const MID = (STAGE_Y + FLOOR) / 2;
  const deck = new Toy();
  const strip = new Toy();
  const W = 0xffffff;
  const scallopGeo = new THREE.SphereGeometry(1, 10, 6);
  let scallopI = 0;

  const outward = (s: WalkShape, x: number, z: number, tx: number, tz: number): [number, number] => {
    let nx = -tz, nz = tx;
    if (shapeSignedDist(s, x + nx * 0.25, z + nz * 0.25) < shapeSignedDist(s, x - nx * 0.25, z - nz * 0.25)) { nx = -nx; nz = -nz; }
    return [nx, nz];
  };

  for (const s of WALK_SHAPES) {
    if (!s.mesh) continue;
    if (s.kind === 'disc') {
      deck.add(discBody(s.r, FLOOR, s.x, s.z), PAL.night[500]);
      // vòng trong trang trí
      strip.add(new THREE.TorusGeometry(s.r * 0.63, 0.045, 5, 72).rotateX(Math.PI / 2).translate(s.x, 0.012, s.z), W);
      // hình khảm: tim ở bục bên, sao lớn ở B-stage
      if (s.id === 'platB') deck.star(s.r * 0.46, 0.05, s.x, 0.02, s.z, PAL.honey[500], { rx: -Math.PI / 2, trim: true });
      else if (s.id === 'platL' || s.id === 'platR') deck.heart(s.r * 1.25, 0.05, s.x, 0.02, s.z, PAL.berry[500], { rx: -Math.PI / 2, trim: true });
    } else {
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
      deck.box(s.hw * 2, H, L, (s.ax + s.bx) / 2, MID, (s.az + s.bz) / 2, PAL.night[500], { r: 0.2, ry: Math.atan2(s.bx - s.ax, s.bz - s.az) });
      // vạch ngang mỗi 2 m (bỏ phần nằm trong sân khấu/bục)
      const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
      for (let a = 2; a < L - 1; a += 2) {
        const cx = s.ax + ux * a, cz = s.az + uz * a;
        const px = -uz * (s.hw - 0.15), pz = ux * (s.hw - 0.15);
        const covered = WALK_SHAPES.some((o) => o !== s && (shapeSignedDist(o, cx - px, cz - pz) < 0.1 || shapeSignedDist(o, cx + px, cz + pz) < 0.1));
        if (covered) continue;
        strip.tube(V(cx - px, 0.012, cz - pz), V(cx + px, 0.012, cz + pz), 0.06, W);
      }
    }
    // chân váy xếp cung: bán nguyệt treo dưới mép, xen night-300 / grape-700; bỏ phần nằm trong hình khác
    const step = s.kind === 'disc' ? 0.35 : 0.1;
    for (const run of edgeRuns(s, step, 0.01)) {
      let acc = 0.6; // bắt đầu bằng cung ngay đầu run
      const n = run.pts.length;
      for (let i = 0; i < n; i++) {
        const [x, z] = run.pts[i]!;
        if (i > 0) acc += Math.hypot(x - run.pts[i - 1]![0], z - run.pts[i - 1]![1]);
        if (acc < 0.9) continue;
        acc = 0;
        const [px, pz] = run.pts[Math.max(0, i - 1)]!, [qx, qz] = run.pts[Math.min(n - 1, i + 1)]!;
        const tl = Math.hypot(qx - px, qz - pz) || 1;
        const [nx, nz] = outward(s, x, z, (qx - px) / tl, (qz - pz) / tl);
        const m = new THREE.Matrix4().compose(V(x + nx * 0.01, STAGE_Y - 0.5, z + nz * 0.01), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.atan2(nx, nz)), V(0.44, 0.44, 0.16));
        deck.add(scallopGeo.clone(), scallopI++ & 1 ? PAL.grape[700] : PAL.night[300], false, m);
      }
    }
    // mép phát sáng trên mặt (ống tròn) + lan can tròn mập: thanh trên y RAIL_Y, trụ mỗi ~2,4 m — cùng mesh dải sáng.
    for (const run of edgeRuns(s, 0.1, RAIL_IN)) {
      let acc = 0;
      for (let i = 0; i < run.pts.length; i++) {
        const [x, z] = run.pts[i]!;
        if (i > 0) acc += Math.hypot(x - run.pts[i - 1]![0], z - run.pts[i - 1]![1]);
        if (i === 0 || acc >= 2.4 || (!run.closed && i === run.pts.length - 1)) {
          acc = 0;
          strip.tube(V(x, STAGE_Y, z), V(x, STAGE_Y + RAIL_Y, z), 0.08, W);
          strip.sphere(0.075, x, STAGE_Y + RAIL_Y + 0.02, z, W);
        }
      }
    }
    for (const [off, y, dia] of [[-0.04, 0.05, 0.1], [RAIL_IN, STAGE_Y + RAIL_Y, 0.09]] as const) {
      for (const run of edgeRuns(s, step, off)) {
        const pts = run.closed ? [...run.pts, run.pts[0]!] : s.kind === 'seg' ? [run.pts[0]!, run.pts[run.pts.length - 1]!] : run.pts;
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
          strip.tube(V(ax, y, az), V(bx, y, bz), dia, W);
        }
      }
    }
  }
  const deckGeo = deck.build();
  const toyM = createToyMaterial();
  const deckMesh = new THREE.Mesh(deckGeo, toyM.mat);
  scene.add(deckMesh);

  const stripGeo = bakeToonShade(strip.build());
  const stripMat = new THREE.MeshBasicMaterial({ color: PAL.grape[500], vertexColors: true, fog: false });
  const stripMesh = new THREE.Mesh(stripGeo, stripMat);
  scene.add(stripMesh);
  scallopGeo.dispose();

  const col = new THREE.Color();
  return {
    update(f: FrameState, t: number) {
      updateToyHype(f.hype);
      const hc = hypeColors(f.hype);
      const k = 0.85 + 0.35 * f.beatPulse * (0.4 + f.hype);
      toColor(((hc.primary[0] * 255) << 16) | ((hc.primary[1] * 255) << 8) | (hc.primary[2] * 255), col);
      // nhịp nhẹ giữa primary và secondary theo thời gian
      const sec = hc.secondary;
      const mix = 0.5 + 0.5 * Math.sin(t * 0.8);
      const sc = new THREE.Color().setRGB(sec[0], sec[1], sec[2], THREE.SRGBColorSpace);
      stripMat.color.copy(col).lerp(sc, mix * 0.35).multiplyScalar(k);
    },
    dispose() {
      scene.remove(deckMesh, stripMesh);
      deckGeo.dispose(); toyM.dispose(); stripGeo.dispose(); stripMat.dispose();
    },
  };
}
