// Hợp đồng chung của ba khu (zones/outside, zones/stands, zones/arena).
import type * as THREE from 'three';
import type { FrameState } from '../core/types';
import type { GlowBuf, Uniforms } from './shared/glowPoints';

/** Thứ world.ts đưa cho mỗi khu khi tạo. Khu không tự tạo scene/camera/renderer. */
export interface ZoneContext {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Uniform dùng chung (uTime, uHype, uPulse, uLevel, uPhase…), world.ts cập nhật mỗi frame. */
  readonly uniforms: Uniforms;
  /** Bộ đệm điểm sáng dùng chung; khu thêm điểm lúc tạo, world.ts dựng thành 1 draw call. */
  readonly glow: GlowBuf;
}

export interface Zone {
  /** f: trạng thái frame; t: đồng hồ hoạt họa của world (giây, đứng yên khi dt = 0). */
  update(f: FrameState, t: number): void;
  dispose(): void;
}
