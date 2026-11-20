import { describe, expect, it } from 'vitest';
import {
  WALK_SHAPES, PLATFORMS, WALK_MARGIN, isWalkable, clampToWalkable, distanceToWalkway, pushOutOfWalkways, edgeRuns,
  type WalkSeg,
} from './walkLayout';

const segs = WALK_SHAPES.filter((s): s is WalkSeg => s.kind === 'seg');
const byId = (id: string) => WALK_SHAPES.find((s) => s.id === id)!;

/** Đi từ p về đích bằng các bước nhỏ qua clampToWalkable; kiểm tra mọi bước đều đứng được. */
function walk(from: { x: number; z: number }, to: { x: number; z: number }, step = 0.12, maxSteps = 4000) {
  let p = { ...from };
  for (let i = 0; i < maxSteps; i++) {
    const dx = to.x - p.x, dz = to.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    const s = Math.min(step, d);
    p = clampToWalkable(p, { x: p.x + (dx / d) * s, z: p.z + (dz / d) * s });
    expect(isWalkable(p.x, p.z, WALK_MARGIN - 1e-6)).toBe(true);
  }
  return p;
}

describe('walkLayout', () => {
  it('points on every shape are walkable', () => {
    for (const s of WALK_SHAPES) {
      if (s.kind === 'disc') {
        expect(isWalkable(s.x, s.z)).toBe(true);
        expect(isWalkable(s.x + s.r - 0.35, s.z)).toBe(true);
      } else {
        for (const t of [0.1, 0.5, 0.9]) {
          const x = s.ax + (s.bx - s.ax) * t, z = s.az + (s.bz - s.az) * t;
          expect(isWalkable(x, z), `${s.id} t=${t}`).toBe(true);
        }
      }
    }
    expect(isWalkable(12.2, 0)).toBe(true);
    expect(isWalkable(12.5, 0)).toBe(false);
  });

  it('crowd points are not walkable and are away from paths', () => {
    for (const [x, z] of [[6, -15], [-6, -15], [12, -30], [0, -60], [-14, -40], [7, -40], [30, -10]] as const) {
      expect(isWalkable(x, z, 0)).toBe(false);
      expect(distanceToWalkway(x, z)).toBeGreaterThan(1);
    }
    // FOH tower ≥ 3 m clear
    expect(distanceToWalkway(7, -40)).toBeGreaterThanOrEqual(3);
    // runway 1.6 hw → 2.6 m from centre line is exactly the clearance
    expect(distanceToWalkway(2.6, -15)).toBeCloseTo(1, 5);
  });

  it('pushOutOfWalkways clears 1 m', () => {
    for (let i = 0; i < 400; i++) {
      const x = -30 + (i % 20) * 3.1, z = -8 - Math.floor(i / 20) * 2.3;
      const p = pushOutOfWalkways(x, z, 1);
      expect(distanceToWalkway(p.x, p.z)).toBeGreaterThanOrEqual(0.999);
    }
  });

  it('clamp slides along an edge', () => {
    // centre runway: push diagonally into the left edge
    const p = clampToWalkable({ x: -1.2, z: -12 }, { x: -1.5, z: -12.3 });
    expect(p.x).toBeCloseTo(-1.3, 2);
    expect(p.z).toBeCloseTo(-12.3, 3);
    // B-stage disc rim: slides along the circle
    const q = clampToWalkable({ x: 0, z: -50.1 }, { x: 0.3, z: -50.4 });
    expect(Math.hypot(q.x, q.z + 46)).toBeLessThanOrEqual(4.2 + 1e-6);
    expect(q.x).toBeGreaterThan(0);
  });

  it('passes through every junction', () => {
    const C = PLATFORMS.centre, L = PLATFORMS.left, R = PLATFORMS.right, B = PLATFORMS.bstage;
    const s = byId('sideL') as WalkSeg;
    const r = byId('sideR') as WalkSeg;
    const pairs: [{ x: number; z: number }, { x: number; z: number }][] = [
      [{ x: 0, z: 0 }, { x: 0, z: -15 }], // stage → centre runway
      [{ x: 0, z: -15 }, C], // runway → platform
      [C, { x: (C.x + L.x) / 2, z: (C.z + L.z) / 2 }], // platform → cross-walk
      [{ x: (C.x + R.x) / 2, z: (C.z + R.z) / 2 }, R],
      [C, B],
      [{ x: -10, z: 0 }, { x: (s.ax + s.bx) / 2, z: (s.az + s.bz) / 2 }], // stage → side runway
      [{ x: (r.ax + r.bx) / 2, z: (r.az + r.bz) / 2 }, R],
    ];
    for (const [a, b] of pairs) {
      const end = walk(a, b);
      expect(Math.hypot(end.x - b.x, end.z - b.z)).toBeLessThan(0.1);
    }
  });

  it('scripted loop stage → centre → cross-walk → side platform → side runway → stage stays in the union', () => {
    const s = byId('sideL') as WalkSeg;
    const route = [
      { x: 0, z: 0 }, { x: 0, z: -26 }, { x: PLATFORMS.left.x, z: PLATFORMS.left.z },
      { x: (s.ax + s.bx) / 2, z: (s.az + s.bz) / 2 }, { x: -11.3, z: -4 }, { x: 0, z: 0 },
    ];
    let p = route[0]!;
    for (const wp of route.slice(1)) {
      p = walk(p, wp);
      expect(Math.hypot(p.x - wp.x, p.z - wp.z), `reach ${wp.x},${wp.z}`).toBeLessThan(0.1);
    }
  });

  it('cannot leave the union when pushing outward everywhere', () => {
    for (const sg of segs) {
      let p = { x: (sg.ax + sg.bx) / 2, z: (sg.az + sg.bz) / 2 };
      for (let i = 0; i < 300; i++) {
        p = clampToWalkable(p, { x: p.x + 0.2, z: p.z - 0.07 });
        expect(isWalkable(p.x, p.z, WALK_MARGIN - 1e-6)).toBe(true);
      }
    }
  });

  it('edge runs skip junction interiors', () => {
    for (const s of WALK_SHAPES) {
      if (!s.mesh) continue;
      for (const run of edgeRuns(s, 0.5)) for (const [x, z] of run.pts) {
        for (const o of WALK_SHAPES) if (o !== s) expect(isWalkable(x, z, 0.06, [o])).toBe(false);
      }
    }
  });
});
