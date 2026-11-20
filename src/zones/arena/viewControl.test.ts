import { describe, expect, it } from 'vitest';
import { groundYAtZ, ROOF } from '../../world/layout';
import {
  aerialOrbitRadius, aerialPosition, AERIAL_ROOF_CLEAR, AERIAL_H_MAX, AERIAL_H_MIN, clampFreeFly, clampHeightOffset, clampZoom, composeFov,
  composeLook, FREEFLY_BOUNDS, freeFlyStep, insideRoof, lookAngles, rigHeightRange, roofRayInterval, solidFloorAt,
  VIEW_CONTROL_HINTS, VIEW_PITCH_LIMIT,
} from './viewControl';

const DEG = Math.PI / 180;

describe('composeLook / lookAngles', () => {
  it('zero offset keeps the automatic direction', () => {
    const [y, p] = lookAngles(0, 10, -20, 0, 0, 0);
    expect(Math.abs(y)).toBeCloseTo(Math.PI, 6); // looking +Z
    expect(p).toBeCloseTo(-Math.atan2(10, 20), 6);
    expect(composeLook(y, p, 0, 0)).toEqual({ yaw: y, pitch: p });
  });
  it('adds yaw freely (360°) and clamps pitch to ±85°', () => {
    const l = composeLook(0.3, 0.2, 2 * Math.PI + 1, 3);
    expect(l.yaw).toBeCloseTo(0.3 + 2 * Math.PI + 1, 9);
    expect(l.pitch).toBeCloseTo(VIEW_PITCH_LIMIT, 9);
    expect(composeLook(0, -1.2, 0, -1).pitch).toBeCloseTo(-85 * DEG, 9);
  });
});

describe('zoom', () => {
  it('zoom 1 leaves the automatic FOV untouched, even outside 20–85', () => {
    expect(composeFov(14, 1)).toBe(14);
    expect(composeFov(50, 1)).toBe(50);
  });
  it('clamps zoomed FOV into 20–85°', () => {
    expect(composeFov(50, 0.1)).toBe(20);
    expect(composeFov(50, 3)).toBe(85);
    expect(composeFov(50, 0.8)).toBeCloseTo(40, 9);
  });
  it('clampZoom keeps the target factor inside the FOV range', () => {
    expect(clampZoom(0.1, 50)).toBeCloseTo(0.4, 9);
    expect(clampZoom(5, 50)).toBeCloseTo(1.7, 9);
    expect(clampZoom(0.5, 14)).toBe(1); // auto already below 20° → no further zoom-in
  });
});

describe('rig height ranges', () => {
  it('per-rig ranges', () => {
    expect(rigHeightRange('aerial')).toEqual([AERIAL_H_MIN, AERIAL_H_MAX]);
    expect(rigHeightRange('pit')).toEqual([0.4, 2.5]);
    const w = rigHeightRange('wide')!;
    expect(w[1] - w[0]).toBeCloseTo(9, 9);
    expect(w[0]).toBeCloseTo(groundYAtZ(-40) + 3, 9);
    expect(rigHeightRange('flycam')).toBeNull();
  });
  it('clampHeightOffset keeps auto + offset in range', () => {
    expect(clampHeightOffset(5, 1, 0.4, 2.5)).toBeCloseTo(1.5, 9);
    expect(clampHeightOffset(-5, 1, 0.4, 2.5)).toBeCloseTo(-0.6, 9);
    expect(clampHeightOffset(0, 30, 0.4, 2.5)).toBe(0); // auto outside range is not pulled
  });
});

describe('aerial orbit around the roof', () => {
  it('ray interval through the roof footprint from the stage centre', () => {
    const iv = roofRayInterval(0, -3.5, Math.PI / 2)!; // toward +X
    expect(iv[0]).toBe(0);
    expect(iv[1]).toBeCloseTo(ROOF.halfW + 1.5, 9);
    expect(roofRayInterval(0, -40, Math.PI)).toBeNull(); // pointing -Z from far audience: never crosses
  });
  it('pushes the radius out past the roof when low, not when high', () => {
    expect(aerialOrbitRadius(0, -3.5, Math.PI / 2, 16, 8)).toBeCloseTo(ROOF.halfW + AERIAL_ROOF_CLEAR + 0.5, 9);
    expect(aerialOrbitRadius(0, -3.5, Math.PI / 2, 16, 40)).toBe(16);
    expect(aerialOrbitRadius(0, -3.5, Math.PI, 16, 8)).toBe(16); // in front of the roof already
  });
  it('full low orbit never enters the roof volume', () => {
    for (let h = AERIAL_H_MIN; h <= 24; h += 2) {
      for (let a = 0; a < 360; a += 5) {
        const p = aerialPosition({ x: 0, y: 30, z: -19.5 }, { x: 0, z: -3.5 }, a * DEG, h - 30);
        expect(insideRoof(p.x, p.y, p.z, 0)).toBe(false);
      }
    }
  });
  it('zero offsets return the automatic pose; height clamps 6–70', () => {
    expect(aerialPosition({ x: 1, y: 30, z: -19 }, { x: 0, z: -3 }, 0, 0)).toEqual({ x: 1, y: 30, z: -19 });
    expect(aerialPosition({ x: 0, y: 30, z: -19 }, { x: 0, z: -3 }, 0, 100).y).toBe(70);
    expect(aerialPosition({ x: 0, y: 30, z: -19 }, { x: 0, z: -3 }, 0, -100).y).toBe(6);
    const back = aerialPosition({ x: 0, y: 30, z: -19.5 }, { x: 0, z: -3.5 }, Math.PI, 0);
    expect(back.x).toBeCloseTo(0, 6);
    expect(back.z).toBeCloseTo(12.5, 6); // 180° orbit: behind the stage
    expect(aerialPosition({ x: 0, y: 30, z: -19.5 }, { x: 0, z: -3.5 }, Math.PI, -24).y).toBeCloseTo(ROOF.yMax + 3, 6); // lifted over the LED wall
  });
});

describe('free-fly bounds', () => {
  it('clamps into the box', () => {
    const p = clampFreeFly({ x: 999, y: 999, z: -999 });
    expect(p).toEqual({ x: FREEFLY_BOUNDS.xAbs, y: FREEFLY_BOUNDS.yMax, z: FREEFLY_BOUNDS.zMin });
    expect(clampFreeFly({ x: 0, y: 5, z: 999 }).z).toBe(FREEFLY_BOUNDS.zMax);
  });
  it('stays 1 m above stage / field / stands', () => {
    expect(clampFreeFly({ x: 0, y: -10, z: 0 }).y).toBeCloseTo(1, 9); // stage
    expect(clampFreeFly({ x: 40, y: -10, z: -30 }).y).toBeCloseTo(groundYAtZ(-30) + 1, 9);
    expect(solidFloorAt(0, -10 - 100)).toBeGreaterThan(10); // second tier of the stands straight ahead
  });
  it('pushes out of the roof volume', () => {
    const p = clampFreeFly({ x: 0, y: 10, z: -5.5 });
    expect(insideRoof(p.x, p.y, p.z, 0.7)).toBe(false);
    expect(p.z).toBeLessThan(ROOF.zFront);
  });
  it('W moves along the camera heading, R up', () => {
    const p = freeFlyStep({ x: 0, y: 20, z: -30 }, 0, 1, 0, 0, 10, 1);
    expect(p.z).toBeCloseTo(-40, 9);
    const q = freeFlyStep({ x: 0, y: 20, z: -30 }, Math.PI / 2, 1, 0, 1, 10, 1); // yaw 90° = facing -X
    expect(q.x).toBeCloseTo(-10, 9);
    expect(q.y).toBeCloseTo(30, 9);
  });
});

it('hint table lists the five Vietnamese controls', () => {
  expect(VIEW_CONTROL_HINTS.map((h) => h.keys.join('/'))).toEqual(['Kéo chuột', 'Lăn chuột', 'R/F', 'G', '0']);
});
