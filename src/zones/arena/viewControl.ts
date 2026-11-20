// Điều khiển góc máy ngoài (xoay 360°, phóng to, nâng/hạ, flycam bay tự do): phần toán thuần, không đụng DOM/three.
// stageControls.ts dùng để ghép offset của người chơi lên pose tự động của cameraCrew; test ở viewControl.test.ts.
import { FIELD_Y, groundYAtZ, ROOF, STAGE_Y, STADIUM_CENTRE, STANDS_ARC, STANDS_TIERS } from '../../world/layout';
import { isWalkable } from './walkLayout';

const DEG = Math.PI / 180;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Giới hạn ngẩng/cúi của góc máy ngoài (rad). */
export const VIEW_PITCH_LIMIT = 85 * DEG;
/** FOV (độ) khi người chơi phóng to/thu nhỏ ở góc máy ngoài. */
export const VIEW_FOV_MIN = 20;
export const VIEW_FOV_MAX = 85;
/** FOV (độ) phóng to/thu nhỏ ở góc ca sĩ. */
export const SINGER_FOV_MIN = 40;
export const SINGER_FOV_MAX = 85;
/** Độ cao camera 'aerial' (m so với mặt sân khấu). */
export const AERIAL_H_MIN = 6;
export const AERIAL_H_MAX = 70;
/** Tháp FOH (cameraCrew đặt ở đây). */
export const FOH_TOWER = { x: 7, z: -40 } as const;
/** Lề an toàn quanh khối mái giàn (m). */
export const ROOF_MARGIN = 1.5;
/** Lề quỹ đạo 'aerial' khi thấp: tháp mái (x ±19, cao 12,5 m) che tâm sân nếu camera bám sát mép mái. */
export const AERIAL_ROOF_CLEAR = 5;

/** Khoảng độ cao tuyệt đối (y thế giới) mà R/F được phép đưa ống kính tới, theo từng rig. */
export function rigHeightRange(mode: string): [number, number] | null {
  switch (mode) {
    case 'aerial': return [STAGE_Y + AERIAL_H_MIN, STAGE_Y + AERIAL_H_MAX];
    case 'pit': return [STAGE_Y + 0.4, STAGE_Y + 2.5]; // ống kính dolly so với mặt sân khấu
    case 'crane': return [FIELD_Y + 2, FIELD_Y + 14]; // đầu cần cẩu so với sàn hố
    case 'wide': { const g = groundYAtZ(FOH_TOWER.z); return [g + 3, g + 12]; } // máy trên tháp FOH so với nền
    default: return null;
  }
}

/** Kẹp offset độ cao sao cho autoY + off nằm trong [lo, hi] (không kéo pose tự động nếu nó đã ở ngoài khoảng). */
export function clampHeightOffset(off: number, autoY: number, lo: number, hi: number): number {
  return clamp(off, Math.min(0, lo - autoY), Math.max(0, hi - autoY));
}

/** Hướng nhìn [yaw, pitch] từ `from` tới `to` (yaw 0 = nhìn -Z, như camera three.js). */
export function lookAngles(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number): [number, number] {
  const dx = tx - fx, dy = ty - fy, dz = tz - fz;
  return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))];
}

/** Ghép offset xoay của người chơi lên hướng tự động: yaw tự do 360°, pitch kẹp ±85°. */
export function composeLook(autoYaw: number, autoPitch: number, uYaw: number, uPitch: number): { yaw: number; pitch: number } {
  return { yaw: autoYaw + uYaw, pitch: clamp(autoPitch + uPitch, -VIEW_PITCH_LIMIT, VIEW_PITCH_LIMIT) };
}

/** FOV sau khi phóng to (zoom = hệ số nhân FOV; 1 = tự động). Kẹp 20–85°, không kéo FOV tự động nếu nó đã ở ngoài. */
export function composeFov(autoFov: number, zoom: number): number {
  if (zoom === 1) return autoFov;
  return clamp(autoFov * zoom, Math.min(VIEW_FOV_MIN, autoFov), Math.max(VIEW_FOV_MAX, autoFov));
}

/** Kẹp hệ số zoom (đích) để FOV kết quả nằm trong 20–85° ở FOV tự động hiện tại. */
export function clampZoom(zoom: number, autoFov: number): number {
  const lo = Math.min(1, VIEW_FOV_MIN / autoFov), hi = Math.max(1, VIEW_FOV_MAX / autoFov);
  return clamp(zoom, lo, hi);
}

/**
 * Tia từ (tx,tz) theo hướng (sin az, cos az): khoảng [tIn, tOut] nằm trong hình chữ nhật mái (nới thêm margin),
 * hoặc null nếu không cắt.
 */
export function roofRayInterval(tx: number, tz: number, az: number, margin = ROOF_MARGIN): [number, number] | null {
  const dx = Math.sin(az), dz = Math.cos(az);
  let t0 = 0, t1 = Infinity;
  const slab = (o: number, d: number, lo: number, hi: number): boolean => {
    if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!slab(tx, dx, -ROOF.halfW - margin, ROOF.halfW + margin)) return null;
  if (!slab(tz, dz, ROOF.zFront - margin, ROOF.zBack + margin)) return null;
  return [t0, t1];
}

/**
 * Bán kính quỹ đạo 'aerial' đã đẩy ra ngoài mái giàn: khi camera thấp (gần/dưới đỉnh mái) mà điểm trên quỹ đạo rơi vào
 * hình chiếu của mái (nới AERIAL_ROOF_CLEAR) thì đẩy ra ngoài (+0,5 m). Chuyển mượt trong 4 m phía trên đỉnh mái.
 */
export function aerialOrbitRadius(tx: number, tz: number, az: number, r0: number, h: number): number {
  const top = ROOF.yMax + ROOF_MARGIN;
  const w = h <= top ? 1 : h >= top + 4 ? 0 : 1 - (h - top) / 4;
  if (w <= 0) return r0;
  const iv = roofRayInterval(tx, tz, az, AERIAL_ROOF_CLEAR);
  if (!iv || r0 < iv[0] || r0 > iv[1]) return r0;
  const need = iv[1] + 0.5;
  return r0 + w * (need - r0);
}

/** Có nằm trong khối mái giàn (nới margin) không. */
export function insideRoof(x: number, y: number, z: number, margin = ROOF_MARGIN): boolean {
  return Math.abs(x) <= ROOF.halfW + margin && z >= ROOF.zFront - margin && z <= ROOF.zBack + margin
    && y >= ROOF.yMin - margin && y <= ROOF.yMax + margin;
}

/** Vị trí camera 'aerial' từ pose tự động + offset người chơi (quỹ đạo quanh trục đứng qua target). */
export function aerialPosition(
  autoPos: { x: number; y: number; z: number }, target: { x: number; z: number }, orbitYaw: number, heightOff: number,
): { x: number; y: number; z: number } {
  const dx = autoPos.x - target.x, dz = autoPos.z - target.z;
  const r0 = Math.hypot(dx, dz);
  const az = Math.atan2(dx, dz) + orbitYaw;
  const y = heightOff === 0 ? autoPos.y : clamp(autoPos.y + heightOff, STAGE_Y + AERIAL_H_MIN, STAGE_Y + AERIAL_H_MAX);
  if (orbitYaw === 0 && heightOff === 0) return { x: autoPos.x, y, z: autoPos.z };
  const r = aerialOrbitRadius(target.x, target.z, az, r0, y);
  const z = target.z + Math.cos(az) * r;
  // Thấp mà vòng sang hai bên / ra sau sân khấu thì tháp mái + tường LED (cao 10 m, z LED_WALL.z) che hết tâm sân:
  // chỉ cho bay thấp phía trước mép mái, càng vòng ra cạnh/sau thì nâng dần lên trên đỉnh mái.
  const behind = clamp((z - (ROOF.zFront - AERIAL_ROOF_CLEAR - 3)) / 6, 0, 1);
  const minY = ROOF.yMax + 3;
  return { x: target.x + Math.sin(az) * r, y: y < minY ? y + (minY - y) * behind * behind * (3 - 2 * behind) : y, z };
}

// ───────────── Flycam bay tự do ─────────────
export const FREEFLY_BOUNDS = { xAbs: 150, yMax: 120, zMin: -190, zMax: 40, clearance: 1 } as const;

/** Mặt rắn thấp nhất dưới (x,z): sân khấu/runway (y 0), nền khán giả, mặt dốc khán đài. */
export function solidFloorAt(x: number, z: number): number {
  let y = isWalkable(x, z, 0) ? STAGE_Y : groundYAtZ(z);
  const r = Math.hypot(x - STADIUM_CENTRE.x, z - STADIUM_CENTRE.z);
  const a = Math.atan2(x - STADIUM_CENTRE.x, -(z - STADIUM_CENTRE.z));
  if (a >= STANDS_ARC.from && a <= STANDS_ARC.to) {
    for (const t of STANDS_TIERS) {
      if (r >= t.rf && r <= t.r1) y = Math.max(y, t.y0 + ((t.y1 - t.y0) * clamp(r - t.r0, 0, t.r1 - t.r0)) / (t.r1 - t.r0));
    }
  }
  return y;
}

/** Kẹp vị trí flycam tự do vào hộp lớn, cao hơn mặt rắn ≥ 1 m, đẩy ra khỏi khối mái (theo trục gần nhất). */
export function clampFreeFly(p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const B = FREEFLY_BOUNDS;
  let x = clamp(p.x, -B.xAbs, B.xAbs);
  let z = clamp(p.z, B.zMin, B.zMax);
  let y = Math.min(B.yMax, Math.max(p.y, solidFloorAt(x, z) + B.clearance));
  const m = ROOF_MARGIN * 0.5;
  if (insideRoof(x, y, z, m)) {
    const opts: [number, () => void][] = [
      [ROOF.halfW + m - x, () => { x = ROOF.halfW + m; }],
      [x + ROOF.halfW + m, () => { x = -ROOF.halfW - m; }],
      [ROOF.zBack + m - z, () => { z = ROOF.zBack + m; }],
      [z - (ROOF.zFront - m), () => { z = ROOF.zFront - m; }],
      [ROOF.yMax + m - y, () => { y = ROOF.yMax + m; }],
      [y - (ROOF.yMin - m), () => { y = ROOF.yMin - m; }],
    ];
    opts.sort((a, b) => a[0] - b[0]);
    opts[0][1]();
    y = Math.min(B.yMax, Math.max(y, solidFloorAt(x, z) + B.clearance));
  }
  return { x, y, z };
}

/** Bước di chuyển flycam (W/S tiến/lùi theo hướng camera trên mặt phẳng, A/D ngang, R/F lên/xuống). */
export function freeFlyStep(
  p: { x: number; y: number; z: number }, yaw: number, fwd: number, right: number, up: number, speed: number, dt: number,
): { x: number; y: number; z: number } {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return clampFreeFly({
    x: p.x + (fx * fwd + rx * right) * speed * dt,
    y: p.y + up * speed * dt,
    z: p.z + (fz * fwd + rz * right) * speed * dt,
  });
}

/** Hướng dẫn điều khiển góc máy (tiếng Việt) cho bảng phím tắt. */
export const VIEW_CONTROL_HINTS: readonly { label: string; keys: string[] }[] = [
  { label: 'Xoay góc máy', keys: ['Kéo chuột'] },
  { label: 'Phóng to / thu nhỏ', keys: ['Lăn chuột'] },
  { label: 'Nâng / hạ máy quay', keys: ['R', 'F'] },
  { label: 'Flycam bay tự do', keys: ['G'] },
  { label: 'Đặt lại góc máy', keys: ['0'] },
];
