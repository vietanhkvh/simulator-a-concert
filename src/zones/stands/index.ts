// KHU 2 — KHÁN ĐÀI SÂN VẬN ĐỘNG (ở giữa): các tầng khán đài, khán giả chấm sáng, đèn nhà, cột đèn pha.
// Điểm vào duy nhất của khu: mã ngoài khu chỉ import từ file này.
import type { FrameState } from '../../core/types';
import type { Zone, ZoneContext } from '../../world/zone';
import { createStadium } from './stadium';

export type StandsZone = Zone;

export function createStandsZone(ctx: ZoneContext): StandsZone {
  // Khán đài tự nghe sự kiện 'cs-interact' (hò reo, sóng, tim, flash, pháo hoa) và f.waveMode.
  const stadium = createStadium(ctx.scene, ctx.uniforms, ctx.glow);
  return {
    update(f: FrameState, t: number) { stadium.update?.(f, t); },
    dispose() { stadium.dispose(); },
  };
}
