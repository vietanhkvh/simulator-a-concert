// "Thép & Lửa" — khe `runway`: catwalk lưới thép trên chân giàn (giằng chéo), mép sọc cảnh báo, lan can ống; mặt bục là tấm
// thép sao stencil lớn (B-stage: vòng cảnh báo + tia sét); cổng sáng → vòm giàn hộp thép mang moving-head (đi dưới được);
// tháp giàn bên ở bục trái/phải (giá đèn tháp của khe `lights`). Hình đi lại theo walkLayout.ts. 1 draw call.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FIELD_Y, STAGE_Y } from '../../../../world/layout';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { PLATFORMS, WALK_SHAPES, edgeRuns } from '../../walkLayout';
import { CELL, R, SKit, V, facetMaterial, resetJitter } from './stageKit';

export const GATE_Z = [-9, -15, -21];
export const GATE = { PX: 1.95, TOP: 4.6 };
const RAIL_Y = 0.95;

export function createSteelRunway(ctx: ArenaBuildContext) {
  const { scene } = ctx;
  const P = R();
  resetJitter(53);
  const k = new SKit();
  const FLOOR = FIELD_Y - 0.2;
  const st = P.steel[500], stD = P.steel[700], stL = P.steel[300];

  for (const s of WALK_SHAPES) {
    if (!s.mesh) continue;
    if (s.kind === 'disc') {
      // bục: trống thép 16 mặt + tấm mặt
      k.add(new THREE.CylinderGeometry(s.r, s.r, 0.4, 16, 1, true), P.coal[300], k.xf(s.x, STAGE_Y - 0.2, s.z));
      k.add(new THREE.CylinderGeometry(s.r * 0.86, s.r * 0.9, STAGE_Y - FLOOR - 0.4, 8, 1, true), P.coal[500], k.xf(s.x, (STAGE_Y - 0.4 + FLOOR) / 2, s.z));
      const top = new THREE.CircleGeometry(s.r, 16).rotateX(-Math.PI / 2);
      if (s.id === 'platB') {
        k.add(top, P.steel[300], k.xf(s.x, STAGE_Y + 0.006, s.z, 0, Math.PI), 2, CELL.hazRing, 0.02);
        k.bolt(s.r * 1.25, s.x, STAGE_Y + 0.02, s.z, P.white[500], 0, Math.PI, -Math.PI / 2);
      } else {
        k.add(top, P.steel[500], k.xf(s.x, STAGE_Y + 0.006, s.z, 0, Math.PI), 2, CELL.star, 0.02);
      }
      // chân giàn quanh bục
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, x = s.x + Math.cos(a) * s.r * 0.8, z = s.z + Math.sin(a) * s.r * 0.8;
        k.truss(V(x, FLOOR, z), V(x, STAGE_Y - 0.4, z), 0.4, st, stD, 0.9, 0.05, 0.025);
      }
    } else {
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
      const ry = Math.atan2(s.bx - s.ax, s.bz - s.az);
      const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
      // dầm sàn + mặt lưới thép (tấm 1 m)
      k.add(new THREE.BoxGeometry(s.hw * 2, 0.35, L), P.coal[300], k.xf((s.ax + s.bx) / 2, STAGE_Y - 0.18, (s.az + s.bz) / 2, 0, ry));
      const n = Math.max(1, Math.round(L));
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * L;
        k.floor(s.hw * 2 - 0.04, L / n - 0.02, s.ax + ux * a, STAGE_Y + 0.006, s.az + uz * a, P.steel[300], CELL.grating, ry);
      }
      // chân giàn (cặp) mỗi ~3 m + giằng chéo dọc hai bên
      const legs = Math.max(2, Math.round(L / 3));
      const px = -uz * (s.hw - 0.3), pz = ux * (s.hw - 0.3);
      for (let i = 0; i <= legs; i++) {
        const a = (i / legs) * L, x = s.ax + ux * a, z = s.az + uz * a;
        for (const sg of [-1, 1]) k.beam(V(x + px * sg, FLOOR, z + pz * sg), V(x + px * sg, STAGE_Y - 0.35, z + pz * sg), 0.16, 0.16, st);
        if (i < legs) {
          const a1 = ((i + 1) / legs) * L, x1 = s.ax + ux * a1, z1 = s.az + uz * a1;
          for (const sg of [-1, 1]) {
            k.beam(V(x + px * sg, FLOOR + 0.3, z + pz * sg), V(x1 + px * sg, STAGE_Y - 0.4, z1 + pz * sg), 0.06, 0.06, stD);
            k.beam(V(x + px * sg, STAGE_Y - 0.4, z + pz * sg), V(x1 + px * sg, FLOOR + 0.3, z1 + pz * sg), 0.06, 0.06, stD);
          }
        }
      }
    }
    // mép sọc cảnh báo (dải 0,22 m sát mép) + gờ thép mặt bên
    for (const run of edgeRuns(s, s.kind === 'disc' ? 0.5 : 1.0, -0.12)) {
      const pts = run.closed ? [...run.pts, run.pts[0]!] : run.pts;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
        const l = Math.hypot(bx - ax, bz - az);
        if (l < 0.05) continue;
        const nx = -(bz - az) / l * 0.11, nz = (bx - ax) / l * 0.11;
        k.quad(V(ax - nx, STAGE_Y + 0.012, az - nz), V(bx - nx, STAGE_Y + 0.012, bz - nz), V(bx + nx, STAGE_Y + 0.012, bz + nz), V(ax + nx, STAGE_Y + 0.012, az + nz), 0xffffff, 2, CELL.hazard, [0, 0, Math.min(1, l), 0.22]);
      }
    }
    // lan can ống: trụ mỗi ~1,5 m, tay vịn trên + giữa
    for (const run of edgeRuns(s, 0.1, -0.06)) {
      const pts = run.pts;
      let acc = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i]!;
        if (i > 0) acc += Math.hypot(x - pts[i - 1]![0], z - pts[i - 1]![1]);
        if (i === 0 || acc >= 1.5 || (!run.closed && i === pts.length - 1)) { acc = 0; k.pipe(V(x, STAGE_Y, z), V(x, STAGE_Y + RAIL_Y, z), 0.03, stL, 5); }
      }
      const path = run.closed ? [...pts, pts[0]!] : s.kind === 'seg' ? [pts[0]!, pts[pts.length - 1]!] : pts;
      const stepN = s.kind === 'disc' ? 3 : 1;
      for (let i = 0; i + stepN < path.length + stepN - 1; i += stepN) {
        const [ax, az] = path[i]!, [bx, bz] = path[Math.min(path.length - 1, i + stepN)]!;
        k.pipe(V(ax, STAGE_Y + RAIL_Y, az), V(bx, STAGE_Y + RAIL_Y, bz), 0.035, P.steel[100], 5);
        k.pipe(V(ax, STAGE_Y + RAIL_Y * 0.5, az), V(bx, STAGE_Y + RAIL_Y * 0.5, bz), 0.025, stL, 4);
      }
    }
  }
  // tấm chắn stencil nhỏ ở đầu runway giữa (sao)
  void PLATFORMS;

  // ── vòm giàn thép trên runway giữa: 2 cột giàn + giàn ngang + 3 moving-head treo ──
  const { PX, TOP } = GATE;
  for (const z of GATE_Z) {
    for (const sx of [-1, 1]) {
      k.truss(V(sx * PX, FIELD_Y, z), V(sx * PX, TOP + 0.3, z), 0.45, st, stD, 0.8, 0.05, 0.025);
      k.cbox(0.8, 0.2, 0.8, sx * PX, FIELD_Y + 0.1, z, P.coal[500]);
    }
    k.truss(V(-PX - 0.4, TOP + 0.3, z), V(PX + 0.4, TOP + 0.3, z), 0.45, stL, stD, 0.7, 0.05, 0.025);
    k.decal(1.2, 0.36, 0, TOP + 0.3, z - 0.24, 0xffffff, CELL.hazard);
    for (const x of [-1.1, 0, 1.1]) {
      k.box(0.06, 0.25, 0.4, x - 0.2, TOP - 0.1, z, P.coal[100]);
      k.box(0.06, 0.25, 0.4, x + 0.2, TOP - 0.1, z, P.coal[100]);
      k.cbox(0.32, 0.4, 0.36, x, TOP - 0.25, z, P.coal[300]);
      k.add(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 8), P.arc[300], k.xf(x, TOP - 0.46, z), 1);
    }
  }
  // ── tháp giàn ở bục trái/phải (mép ngoài) + tay vươn mang đèn tháp ──
  for (const sx of [-1, 1]) {
    const x = sx * (PLATFORMS.right.x + 3.6), z = PLATFORMS.right.z;
    k.truss(V(x, FIELD_Y, z), V(x, 11.8, z), 0.8, st, stD, 1.2, 0.07, 0.035);
    k.cbox(1.6, 0.3, 1.6, x, FIELD_Y + 0.15, z, P.coal[500]);
    k.truss(V(x, 11.4, z - 1.8), V(x, 11.4, z + 1.8), 0.45, stL, stD, 0.9, 0.05, 0.025);
    for (const dz of [-1.8, 0, 1.8]) {
      k.cbox(0.4, 0.5, 0.4, x - sx * 0.1, 10.9, z + dz, P.coal[300]);
      k.add(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 8), P.arc[300], k.xf(x - sx * 0.1, 10.64, z + dz), 1);
    }
    k.decal(0.7, 2.2, x - sx * 0.42, 6.0, z, P.steel[300], CELL.star, sx * Math.PI / 2 * -1);
  }

  const geo = k.build();
  const fm = facetMaterial(ctx.uniforms, { atlas: true });
  const mesh = new THREE.Mesh(geo, fm.mat);
  scene.add(mesh);
  return {
    update(f: FrameState, _t: number) { fm.mat.uniforms.uFire!.value = f.hype > 0.6 ? f.beatPulse * (f.hype - 0.6) * 2 : 0; },
    dispose() { scene.remove(mesh); geo.dispose(); fm.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { runway: createSteelRunway };
