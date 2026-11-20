// KHU 2 — sổ đăng ký builder theo phong cách (docs/THEMES.md mục "Khe builder").
// Builder riêng của phong cách nằm ở ./themes/<id>/<module>.ts và đăng ký trong ./themes/<id>/index.ts.
import type { FrameState } from '../../core/types';
import { getActiveThemeId, type ThemeId } from '../../world/style';
import type { ZoneContext } from '../../world/zone';
import { createStadium } from './stadium';
import { THEME_BUILDERS } from './themes';

/** Kết cấu khán đài (tầng, mái, đèn dây, bảng khu, cờ, cột đèn pha). */
export interface StructureHandle { update?(f: FrameState, t: number): void; dispose(): void }
/** Khán giả khán đài xa (chấm sáng / đèn lồng / chấm điểm hoạ…): tự nghe 'cs-interact' và đọc f.waveMode. */
export interface StandCrowdHandle { update?(f: FrameState, t: number): void; dispose(): void }

export interface StandsBuildContext extends ZoneContext {
  /** false khi khe standCrowd có builder riêng: builder `structure` không được vẽ khán giả chấm sáng. */
  readonly crowd: boolean;
}

export interface StandsBuilders {
  structure(ctx: StandsBuildContext): StructureHandle;
  /** null ở mặc định: khán giả chấm sáng nằm sẵn trong builder `structure` (stadium.ts). */
  standCrowd: ((ctx: StandsBuildContext) => StandCrowdHandle) | null;
}
export type StandsSlot = keyof StandsBuilders;

export const DEFAULT_BUILDERS: StandsBuilders = {
  structure: (c) => createStadium(c.scene, c.uniforms, c.glow, { crowd: c.crowd }),
  standCrowd: null,
};

/** Như outside/builders.ts: 'default' → builder mặc định; khác → builder của phong cách nếu có, không thì mặc định. */
export function pickBuilder<K extends StandsSlot>(slot: K, variant = 'themed', themeId: ThemeId = getActiveThemeId()): StandsBuilders[K] {
  if (variant === 'default') return DEFAULT_BUILDERS[slot];
  return (THEME_BUILDERS[themeId]?.[slot] as StandsBuilders[K] | undefined) ?? DEFAULT_BUILDERS[slot];
}
