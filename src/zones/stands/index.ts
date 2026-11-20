// KHU 2 — KHÁN ĐÀI SÂN VẬN ĐỘNG (ở giữa): các tầng khán đài, khán giả chấm sáng, đèn nhà, cột đèn pha.
// Điểm vào duy nhất của khu: mã ngoài khu chỉ import từ file này.
import { createDebugLayers } from '../../core/debugLayers';
import type { FrameState } from '../../core/types';
import { getTheme } from '../../world/style';
import type { Zone, ZoneContext } from '../../world/zone';
import { pickBuilder, type StandsBuildContext } from './builders';

export type { StandCrowdHandle, StandsBuildContext, StandsBuilders, StandsSlot, StructureHandle } from './builders';

export interface StandsZone extends Zone {
  /** Debug (chế độ developer): ẩn/hiện cả khu hoặc lớp 'stadium' / 'crowdDots'. */
  setVisible?(on: boolean): void;
  debugLayers?(): string[];
  setLayerVisible?(name: string, on: boolean): boolean;
  isLayerVisible?(name: string): boolean;
}

export function createStandsZone(ctx: ZoneContext): StandsZone {
  // Khán đài tự nghe sự kiện 'cs-interact' (hò reo, sóng, tim, flash, pháo hoa) và f.waveMode.
  const feat = getTheme().features;
  const crowdBuilder = pickBuilder('standCrowd', feat.standCrowdVariant); // null = khán giả nằm trong builder kết cấu
  const bctx: StandsBuildContext = { ...ctx, crowd: !crowdBuilder };
  const layers = createDebugLayers(ctx.scene); // chỉ dùng cho chế độ developer
  const stadium = layers.track('stadium', () => pickBuilder('structure', feat.stageVariant)(bctx));
  const standCrowd = crowdBuilder ? layers.track('crowdDots', () => crowdBuilder(bctx)) : null;
  // Khán giả chấm sáng (Points, renderOrder 1 trong stadium.ts) tách thành lớp riêng.
  layers.split('stadium', 'crowdDots', (o) => o.renderOrder === 1 && (o as { isPoints?: boolean }).isPoints === true);
  return {
    update(f: FrameState, t: number) { stadium.update?.(f, t); standCrowd?.update?.(f, t); },
    dispose() { stadium.dispose(); standCrowd?.dispose(); },
    setVisible: (on) => layers.setAll(on),
    debugLayers: () => layers.names(),
    setLayerVisible: (name, on) => layers.set(name, on),
    isLayerVisible: (name) => layers.get(name),
  };
}
