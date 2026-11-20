// STUB P0 — gói P1 thay: khán giả instanced + lightstick (crowd.vert.glsl / crowd.frag.glsl, import ?raw).
// Quy ước không gian: ca sĩ đứng tại gốc tọa độ nhìn về -Z; khán giả ở z < -6, sàn y = 0.
import type * as THREE from 'three';
import type { CrowdOptions, Updatable } from '../core/types';

export function createCrowd(_scene: THREE.Scene, _opts: CrowdOptions): Updatable {
  return { update() {}, dispose() {} };
}
