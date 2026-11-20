// KHU 2 — KHÁN ĐÀI SÂN VẬN ĐỘNG (ở giữa): các tầng khán đài, khán giả chấm sáng, đèn nhà, cột đèn pha.
// Điểm vào duy nhất của khu: mã ngoài khu chỉ import từ file này.
import { createDebugLayers } from '../../core/debugLayers';
import type { FrameState } from '../../core/types';
import type { Zone, ZoneContext } from '../../world/zone';
import { createStadium } from './stadium';

export interface StandsZone extends Zone {
  /** Debug (chế độ developer): ẩn/hiện cả khu hoặc lớp 'stadium'. */
  setVisible?(on: boolean): void;
  debugLayers?(): string[];
  setLayerVisible?(name: string, on: boolean): boolean;
  isLayerVisible?(name: string): boolean;
}

export function createStandsZone(ctx: ZoneContext): StandsZone {
  // Khán đài tự nghe sự kiện 'cs-interact' (hò reo, sóng, tim, flash, pháo hoa) và f.waveMode.
  const layers = createDebugLayers(ctx.scene); // chỉ dùng cho chế độ developer
  const stadium = layers.track('stadium', () => createStadium(ctx.scene, ctx.uniforms, ctx.glow));
  return {
    update(f: FrameState, t: number) { stadium.update?.(f, t); },
    dispose() { stadium.dispose(); },
    setVisible: (on) => layers.setAll(on),
    debugLayers: () => layers.names(),
    setLayerVisible: (name, on) => layers.set(name, on),
    isLayerVisible: (name) => layers.get(name),
  };
}
