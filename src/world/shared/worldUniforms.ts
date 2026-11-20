// Uniform dùng chung cho shader của cả ba khu: thời gian + trạng thái buổi diễn (Hype, nhịp, âm lượng).
// world.ts cập nhật MỘT lần mỗi frame; các khu chỉ đọc (và có thể gắn thêm uniform riêng vào cùng object).
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import type { Uniforms } from './glowPoints';

export function createWorldUniforms(): Uniforms {
  return {
    uTime: { value: 0 }, uHype: { value: 0 }, uPulse: { value: 0 }, uLevel: { value: 0 }, uPhase: { value: 0 },
    // Vị trí hai máy bay chở khách (khu ngoài sân ghi, shader điểm sáng dùng chung đọc).
    uPlane: { value: [new THREE.Vector4(0, -500, 0, 0), new THREE.Vector4(0, -500, 0, 0)] },
    uPlaneVis: { value: new THREE.Vector2(0, 0) },
  };
}

export function updateWorldUniforms(u: Uniforms, f: FrameState, t: number): void {
  u.uTime.value = t;
  u.uHype.value = f.hype;
  u.uPulse.value = f.beatPulse;
  u.uLevel.value = f.level;
  u.uPhase.value = f.beat;
}
