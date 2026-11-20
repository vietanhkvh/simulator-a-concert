import { STAGE_BACK_Z, STAGE_FRONT_Z, STAGE_HALF_W } from '../../world/layout';
// Nguồn duy nhất cho mọi lối đi trên cao (y = 0): sân khấu chính, runway giữa, 2 runway chéo,
// lối ngang (cross-walk) nối 3 bục, runway ra B-stage. Dùng cho: mesh (stageRunway), di chuyển
// (stageControls), vùng cấm đứng của khán giả (crowd), chấm đèn (lights). Thuần toán học, không three.js.

export interface WalkSeg {
  kind: 'seg';
  id: string;
  ax: number; az: number;
  bx: number; bz: number;
  hw: number;
  /** true = đầu/cuối là mép thật (sân khấu); false = đầu mở, luôn chồng vào hình khác (nối). */
  capped: boolean;
  /** Thu thêm (m) ở hai đầu có nắp khi đi bộ (ngoài margin chung) — sân khấu tránh truss/cầu thang. */
  inset?: number;
  /** Thu thêm (m) ở hai mép dọc khi đi bộ. */
  sideInset?: number;
  /** Có vẽ mesh/đèn chấm không (sân khấu chính đã có mesh riêng trong stage.ts). */
  mesh: boolean;
}
export interface WalkDisc {
  kind: 'disc';
  id: string;
  x: number; z: number;
  r: number;
  mesh: boolean;
}
export type WalkShape = WalkSeg | WalkDisc;

const seg = (id: string, ax: number, az: number, bx: number, bz: number, hw: number, mesh = true, capped = false, inset = 0, sideInset = 0): WalkSeg =>
  ({ kind: 'seg', id, ax, az, bx, bz, hw, capped, inset, sideInset, mesh });
const disc = (id: string, x: number, z: number, r: number): WalkDisc => ({ kind: 'disc', id, x, z, r, mesh: true });

/** Tâm các bục. */
export const PLATFORMS = {
  centre: { x: 0, z: -26, r: 3.5 },
  left: { x: -22, z: -20, r: 3 },
  right: { x: 22, z: -20, r: 3 },
  bstage: { x: 0, z: -46, r: 4.5 },
};

/** Runway chéo: rời mép sân khấu ở x = ±11,5 (z = -5). Điểm đầu lùi vào trong sân khấu để góc chéo không hở. */
function sideRunway(sx: number): WalkSeg {
  const ex = sx * 11.5, ez = STAGE_FRONT_Z;
  const tx = PLATFORMS.right.x * sx, tz = PLATFORMS.right.z;
  const L = Math.hypot(tx - ex, tz - ez);
  const dx = (tx - ex) / L, dz = (tz - ez) / L;
  const back = 1.0; // lùi 1 m vào sân khấu (|dx|·hw ≤ 1 → không còn khe tam giác ở mép)
  return seg(sx < 0 ? 'sideL' : 'sideR', ex - dx * back, ez - dz * back, tx, tz, 1.3);
}

export const WALK_SHAPES: readonly WalkShape[] = [
  // Sân khấu chính |x| ≤ 13, z ∈ [-5, 3]; khi đi (margin 0,3): |x| ≤ 12,3, z ∈ [-4,5; 2,5] (như cũ ±0,2).
  seg('stage', -STAGE_HALF_W, (STAGE_FRONT_Z + STAGE_BACK_Z) / 2, STAGE_HALF_W, (STAGE_FRONT_Z + STAGE_BACK_Z) / 2, (STAGE_BACK_Z - STAGE_FRONT_Z) / 2, false, true, 0.4, 0.2),
  // đầu runway lùi 1 m vào sân khấu để vùng đi được liền mạch (sân khấu thu 0,5 m ở mép trước)
  seg('centre', 0, -4, 0, PLATFORMS.centre.z, 1.6),
  disc('platC', PLATFORMS.centre.x, PLATFORMS.centre.z, PLATFORMS.centre.r),
  sideRunway(-1),
  sideRunway(1),
  disc('platL', PLATFORMS.left.x, PLATFORMS.left.z, PLATFORMS.left.r),
  disc('platR', PLATFORMS.right.x, PLATFORMS.right.z, PLATFORMS.right.r),
  seg('crossL', PLATFORMS.left.x, PLATFORMS.left.z, PLATFORMS.centre.x, PLATFORMS.centre.z, 1.2),
  seg('crossR', PLATFORMS.centre.x, PLATFORMS.centre.z, PLATFORMS.right.x, PLATFORMS.right.z, 1.2),
  seg('bRunway', 0, PLATFORMS.centre.z, 0, PLATFORMS.bstage.z, 1.3),
  disc('platB', PLATFORMS.bstage.x, PLATFORMS.bstage.z, PLATFORMS.bstage.r),
];

/** Lề mặc định khi đi bộ (m) — như trước: runway 1,6 → đi được |x| ≤ 1,3. */
export const WALK_MARGIN = 0.3;

/** Toạ độ cục bộ của điểm với đoạn: along ∈ [0, L], perp có dấu. */
function local(s: WalkSeg, x: number, z: number) {
  const vx = s.bx - s.ax, vz = s.bz - s.az;
  const L = Math.hypot(vx, vz);
  const ux = vx / L, uz = vz / L;
  const px = x - s.ax, pz = z - s.az;
  return { along: px * ux + pz * uz, perp: px * -uz + pz * ux, L, ux, uz };
}

/** Khoảng cách có dấu tới biên hình (âm = bên trong). Đầu mở của đoạn coi như dài vô hạn trong phạm vi [0, L]. */
export function shapeSignedDist(s: WalkShape, x: number, z: number): number {
  if (s.kind === 'disc') return Math.hypot(x - s.x, z - s.z) - s.r;
  const { along, perp, L } = local(s, x, z);
  const dp = Math.abs(perp) - s.hw;
  const da = Math.max(-along, along - L);
  // hộp chữ nhật (SDF chuẩn)
  const ox = Math.max(dp, 0), oz = Math.max(da, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(dp, da), 0);
}

function insideShape(s: WalkShape, x: number, z: number, margin: number): boolean {
  if (s.kind === 'disc') {
    const r = s.r - margin;
    const dx = x - s.x, dz = z - s.z;
    return dx * dx + dz * dz <= r * r;
  }
  const m = margin + (s.inset ?? 0);
  const { along, perp, L } = local(s, x, z);
  if (Math.abs(perp) > s.hw - margin - (s.sideInset ?? 0)) return false;
  return s.capped ? along >= m && along <= L - m : along >= 0 && along <= L;
}

/** Điểm (x, z) có đứng được không (cách mép ≥ margin; đầu mở của runway nối liền hình kế bên). */
export function isWalkable(x: number, z: number, margin = WALK_MARGIN, shapes: readonly WalkShape[] = WALK_SHAPES): boolean {
  for (const s of shapes) if (insideShape(s, x, z, margin)) return true;
  return false;
}

/** Khoảng cách (m) tới lối đi gần nhất; 0 nếu đứng trên lối. Dùng cho vùng cấm của khán giả. */
export function distanceToWalkway(x: number, z: number, shapes: readonly WalkShape[] = WALK_SHAPES): number {
  let d = Infinity;
  for (const s of shapes) d = Math.min(d, shapeSignedDist(s, x, z));
  return Math.max(0, d);
}

/** Chiếu điểm vào trong 1 hình (cách mép margin). */
function projectInto(s: WalkShape, x: number, z: number, margin: number): [number, number] {
  if (s.kind === 'disc') {
    const r = Math.max(0, s.r - margin - 1e-4);
    const dx = x - s.x, dz = z - s.z;
    const d = Math.hypot(dx, dz);
    if (d <= r) return [x, z];
    return [s.x + (dx / d) * r, s.z + (dz / d) * r];
  }
  const m = margin + (s.inset ?? 0);
  const { along, perp, L, ux, uz } = local(s, x, z);
  const lo = s.capped ? m : 0, hi = s.capped ? L - m : L;
  const h = Math.max(0, s.hw - margin - (s.sideInset ?? 0) - 1e-4);
  const a = Math.min(Math.max(along, lo + 1e-4), hi - 1e-4);
  const p = Math.min(Math.max(perp, -h), h);
  return [s.ax + ux * a - uz * p, s.az + uz * a + ux * p];
}

/**
 * Di chuyển prev → next mà không rời hợp các lối đi. Nếu next không đứng được: chiếu next vào từng
 * hình, chọn điểm hợp lệ gần next nhất mà vẫn nối thẳng được từ prev (trượt dọc mép, qua chỗ nối).
 * prev phải đứng được; nếu không, trả về điểm hợp lệ gần nhất.
 */
export function clampToWalkable(
  prev: { x: number; z: number },
  next: { x: number; z: number },
  margin = WALK_MARGIN,
  shapes: readonly WalkShape[] = WALK_SHAPES,
): { x: number; z: number } {
  if (isWalkable(next.x, next.z, margin, shapes)) {
    // bước nhỏ (≤ ~0,5 m/khung) → kiểm tra trung điểm là đủ chống "nhảy" qua góc lõm
    const mx = (prev.x + next.x) / 2, mz = (prev.z + next.z) / 2;
    if (isWalkable(mx, mz, margin, shapes)) return { x: next.x, z: next.z };
  }
  const prevOk = isWalkable(prev.x, prev.z, margin, shapes);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const s of shapes) {
    const [px, pz] = projectInto(s, next.x, next.z, margin);
    if (!isWalkable(px, pz, margin, shapes)) continue;
    if (prevOk) {
      // đoạn prev → p phải nằm trong hợp (lấy mẫu 4 điểm)
      let ok = true;
      for (let k = 1; k < 4 && ok; k++) {
        const t = k / 4;
        ok = isWalkable(prev.x + (px - prev.x) * t, prev.z + (pz - prev.z) * t, margin, shapes);
      }
      if (!ok) continue;
    }
    const d = Math.hypot(px - next.x, pz - next.z);
    if (d < bestD) { bestD = d; best = [px, pz]; }
  }
  if (best) return { x: best[0], z: best[1] };
  return prevOk ? { x: prev.x, z: prev.z } : nearestWalkable(prev.x, prev.z, margin, shapes);
}

/** Điểm đứng được gần nhất. */
export function nearestWalkable(x: number, z: number, margin = WALK_MARGIN, shapes: readonly WalkShape[] = WALK_SHAPES): { x: number; z: number } {
  if (isWalkable(x, z, margin, shapes)) return { x, z };
  let best = { x: 0, z: 0 };
  let bestD = Infinity;
  for (const s of shapes) {
    const [px, pz] = projectInto(s, x, z, margin);
    const d = Math.hypot(px - x, pz - z);
    if (d < bestD && isWalkable(px, pz, margin, shapes)) { bestD = d; best = { x: px, z: pz }; }
  }
  return best;
}

/**
 * Đẩy điểm ra ngoài mọi lối đi tới khoảng cách ≥ clear (theo hướng ra khỏi hình gần nhất).
 * `extra` = khoảng thêm ngẫu nhiên đã chọn bởi người gọi. Lặp vì có thể rơi vào hình khác.
 */
export function pushOutOfWalkways(x: number, z: number, clear: number, extra = 0, shapes: readonly WalkShape[] = WALK_SHAPES): { x: number; z: number } {
  for (let it = 0; it < 10; it++) {
    let worst: WalkShape | null = null;
    let wd = Infinity;
    for (const s of shapes) {
      const d = shapeSignedDist(s, x, z);
      if (d < clear && d < wd) { wd = d; worst = s; }
    }
    if (!worst) break;
    const target = clear + 0.02 + extra;
    if (worst.kind === 'disc') {
      let dx = x - worst.x, dz = z - worst.z;
      let d = Math.hypot(dx, dz);
      if (d < 1e-3) { dx = 0; dz = -1; d = 1; }
      x = worst.x + (dx / d) * (worst.r + target);
      z = worst.z + (dz / d) * (worst.r + target);
    } else {
      const { along, perp, L, ux, uz } = local(worst, x, z);
      const sp = perp === 0 ? 1 : Math.sign(perp);
      const nPerp = sp * (worst.hw + target);
      // đẩy theo pháp tuyến (đầu mở luôn nối vào hình khác nên không đẩy dọc trục)
      const a = Math.min(Math.max(along, 0), L);
      x = worst.ax + ux * a - uz * nPerp;
      z = worst.az + uz * a + ux * nPerp;
    }
  }
  return { x, z };
}

/** Lấy mẫu biên của hình (mép trái/phải của đoạn, hoặc vòng tròn), bỏ phần nằm trong hình khác. */
export interface EdgeRun { pts: [number, number][]; closed: boolean }
export function edgeRuns(s: WalkShape, step: number, offset = 0, shapes: readonly WalkShape[] = WALK_SHAPES, eps = 0.05): EdgeRun[] {
  const others = shapes.filter((o) => o !== s);
  const covered = (x: number, z: number) => others.some((o) => shapeSignedDist(o, x, z) < -eps);
  const runs: EdgeRun[] = [];
  const emit = (pts: [number, number][], closed: boolean) => {
    // tách thành các đoạn liên tục không bị che
    let cur: [number, number][] = [];
    const flags = pts.map(([x, z]) => covered(x, z));
    const allFree = flags.every((f) => !f);
    if (closed && allFree) { runs.push({ pts, closed: true }); return; }
    // vòng kín: bắt đầu từ điểm bị che để không cắt đôi đoạn
    const start = closed ? Math.max(0, flags.indexOf(true)) : 0;
    const n = pts.length;
    const total = closed ? n + 1 : n;
    for (let k = 0; k < total; k++) {
      const i = (start + k) % n;
      if (flags[i]) { if (cur.length > 1) runs.push({ pts: cur, closed: false }); cur = []; }
      else cur.push(pts[i]!);
    }
    if (cur.length > 1) runs.push({ pts: cur, closed: false });
  };
  if (s.kind === 'disc') {
    const r = s.r + offset;
    const n = Math.max(12, Math.ceil((2 * Math.PI * r) / step));
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([s.x + Math.cos(a) * r, s.z + Math.sin(a) * r]); }
    emit(pts, true);
  } else {
    const { L, ux, uz } = local(s, s.bx, s.bz);
    const n = Math.max(2, Math.ceil(L / step));
    for (const side of [-1, 1]) {
      const p = side * (s.hw + offset);
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const a = (i / n) * L; pts.push([s.ax + ux * a - uz * p, s.az + uz * a + ux * p]); }
      emit(pts, false);
    }
  }
  return runs;
}

/** Khoảng cách "đi bộ" gần đúng từ mép sân khấu (dùng cho chase đèn chấm: tăng dần ra xa sân khấu). */
export function chaseDistance(x: number, z: number): number {
  return Math.hypot(x, z + 5);
}
