// "Đêm Sao Điểm Ảnh" — khe `runway`: mọi lối đi là MỘT VỆT CỌ VÀNG (mặt atlas lông cọ chạy dọc, mép tơi lông cọ đất),
// thân gỗ crôm-700/đất; bục giữa = hoa hướng dương, bục trái/phải = huy hiệu sao, B-stage = BẢNG PHA MÀU có lỗ ngón cái
// và 8 đốm sơn; lan can gỗ tay vịn vàng ở đúng vị trí lan can mặc định (walkLayout.edgeRuns, lùi 0,08 m, cao 0,55 m).
// Cổng sáng → 3 KHUNG TRANH RỖNG mạ vàng đứng ngang runway giữa (đi dưới được, đỉnh 4,6 m) mang đèn của khe `lights`.
// Hình đi lại theo walkLayout.ts (không đổi). 2 draw call (khối gộp + viền mực).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FIELD_Y, STAGE_Y } from '../../../../world/layout';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { WALK_SHAPES, edgeRuns } from '../../walkLayout';
import { CELL, PKit, R, V, inkOutline, makeAtlas, pixelMaterial } from './stageKit';

/** Khung tranh rỗng trên runway giữa: z, nửa bề rộng trong (cột ở ±PX), đỉnh ô (TOP). */
export const GATE_Z = [-9, -15, -21];
export const GATE = { PX: 2.05, TOP: 4.5, T: 0.32 };
const RAIL_Y = 0.55;
const RAIL_IN = -0.08;

export function createPixelRunway(ctx: ArenaBuildContext) {
  const { scene } = ctx;
  const P = R();
  const k = new PKit();
  const FLOOR = FIELD_Y - 0.2;
  const H = STAGE_Y - FLOOR, MID = (STAGE_Y + FLOOR) / 2;

  for (const s of WALK_SHAPES) {
    if (!s.mesh) continue;
    if (s.kind === 'disc') {
      // thân trụ 12 cạnh gỗ đất + nẹp vàng ở mép trên
      k.add(new THREE.CylinderGeometry(s.r, s.r * 0.94, H, 12, 1, true), P.dat[700], k.xf(s.x, MID, s.z));
      k.add(new THREE.CylinderGeometry(s.r + 0.03, s.r + 0.03, 0.22, 12, 1, true), P.crom[700], k.xf(s.x, STAGE_Y - 0.11, s.z));
      const top = new THREE.CircleGeometry(s.r, 24).rotateX(-Math.PI / 2);
      const cell = s.id === 'platB' ? CELL.palette : s.id === 'platC' ? CELL.sunflower : CELL.star;
      // bảng pha màu xoay cho lỗ ngón cái về phía sân khấu-phải; hướng dương/huy hiệu xoay về khán giả
      k.add(top, 0xffffff, k.xf(s.x, STAGE_Y + 0.006, s.z, 0, s.id === 'platB' ? 0.6 : Math.PI), 2, cell);
      if (s.id === 'platB') k.add(new THREE.CylinderGeometry(s.r * 0.98, s.r * 0.98, 0.1, 12, 1, true), P.dat[300], k.xf(s.x, STAGE_Y - 0.05, s.z));
    } else {
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
      const ry = Math.atan2(s.bx - s.ax, s.bz - s.az);
      const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
      // thân: hộp đất tối + gờ crôm dưới mặt
      k.add(new THREE.BoxGeometry(s.hw * 2, H, L), P.dat[700], k.xf((s.ax + s.bx) / 2, MID, (s.az + s.bz) / 2, 0, ry));
      k.add(new THREE.BoxGeometry(s.hw * 2 + 0.06, 0.22, L), P.crom[700], k.xf((s.ax + s.bx) / 2, STAGE_Y - 0.11, (s.az + s.bz) / 2, 0, ry));
      // mặt vệt cọ: ô 2 m dọc chiều dài (lông cọ chạy dọc), lật xen kẽ để không lặp; mép tơi hai bên
      const n = Math.max(1, Math.round(L / 2));
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * L, cx = s.ax + ux * a, cz = s.az + uz * a;
        k.floor(s.hw * 2 - 0.36, L / n, cx, STAGE_Y + 0.006, cz, CELL.stroke, ry + (i & 1 ? Math.PI : 0));
        for (const sg of [-1, 1]) {
          const px = -uz * (s.hw - 0.09) * sg, pz = ux * (s.hw - 0.09) * sg;
          // local +x của tấm = -perp → mép tơi (u = 1) ra ngoài: xoay π ở phía +perp
          k.floor(0.18, L / n, cx + px, STAGE_Y + 0.007, cz + pz, CELL.strokeEdge, ry + (sg > 0 ? Math.PI : 0));
        }
      }
    }
    // lan can gỗ: trụ mỗi ~2,4 m (đầu nụ vàng), tay vịn vàng ở RAIL_Y — đúng vị trí bản mặc định
    for (const run of edgeRuns(s, 0.1, RAIL_IN)) {
      const pts = run.pts;
      let acc = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i]!;
        if (i > 0) acc += Math.hypot(x - pts[i - 1]![0], z - pts[i - 1]![1]);
        if (i === 0 || acc >= 2.4 || (!run.closed && i === pts.length - 1)) {
          acc = 0;
          k.box(0.08, RAIL_Y, 0.08, x, STAGE_Y + RAIL_Y / 2, z, P.dat[500]);
          k.box(0.14, 0.12, 0.14, x, STAGE_Y + RAIL_Y + 0.04, z, P.crom[500]);
        }
      }
      const path = run.closed ? [...pts, pts[0]!] : s.kind === 'seg' ? [pts[0]!, pts[pts.length - 1]!] : pts;
      const stepN = s.kind === 'disc' ? 3 : 1;
      for (let i = 0; i < path.length - 1; i += stepN) {
        const [ax, az] = path[i]!, [bx, bz] = path[Math.min(path.length - 1, i + stepN)]!;
        k.beam(V(ax, STAGE_Y + RAIL_Y, az), V(bx, STAGE_Y + RAIL_Y, bz), 0.07, 0.07, P.crom[500]);
      }
    }
  }

  // ── 3 khung tranh rỗng trên runway giữa (cột đứng trên sàn khán giả ngoài mép runway) ──
  const { PX, TOP, T } = GATE;
  for (const z of GATE_Z) {
    const w = PX * 2 - T, h = TOP - FIELD_Y;
    k.frame(w, h, T, 0.22, 0, (TOP + FIELD_Y) / 2 - T / 2, z - 0.11, P, { seg: 0.5, skipBottom: true, back: true });
    for (const sx of [-1, 1]) k.box(0.7, 0.2, 0.7, sx * PX, FIELD_Y + 0.1, z, P.dat[700]);
    // huy hiệu sao nhỏ trên đỉnh
    k.box(0.9, 0.7, 0.16, 0, TOP + T + 0.3, z, P.crom[700]);
    k.decal(0.62, 0.5, 0, TOP + T + 0.3, z - 0.09, CELL.star);
    k.decal(0.62, 0.5, 0, TOP + T + 0.3, z + 0.09, CELL.star, Math.PI);
  }

  const atlas = makeAtlas();
  const geo = k.build();
  const pm = pixelMaterial({ atlas });
  const mesh = new THREE.Mesh(geo, pm.mat);
  const ink = inkOutline(geo);
  scene.add(mesh, ink.mesh);
  return {
    update(_f: FrameState, _t: number) { /* tĩnh: đèn chấm runway do khe `lights` vẽ */ },
    dispose() { scene.remove(mesh, ink.mesh); geo.dispose(); pm.dispose(); ink.dispose(); atlas?.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { runway: createPixelRunway };
