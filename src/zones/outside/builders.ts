// KHU 1 — sổ đăng ký builder theo phong cách (docs/THEMES.md mục "Khe builder").
// Mỗi KHE (slot) là một nhóm vật thể thay được; builder mặc định là bản chibi hiện có (đọc token của phong cách đang bật).
// Builder riêng của phong cách nằm ở ./themes/<id>/<module>.ts và đăng ký trong ./themes/<id>/index.ts.
import type * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { getActiveThemeId, type ThemeId } from '../../world/style';
import type { ZoneContext } from '../../world/zone';
import { createBalloons } from './balloons';
import { createFlyby } from './flyby';
import { DEFAULT_SECRET_FACTORIES } from './secretEvents';
import type { SecretAct } from './secretShared';
import { createSky } from './sky';
import { THEME_BUILDERS } from './themes';

export type { SecretAct };

/** Vòm trời + sao + sao băng + trăng + máy bay chở khách. `burstMeteors` tuỳ chọn (không có → bỏ qua). */
export interface SkyHandle { update(t: number): void; dispose(): void; burstMeteors?(count: number): void }
/** Thứ xuất hiện trên trời khi Hype > 40 % (cực quang / đèn trời / đèn rọi + mây khói / gió nét cọ). */
export interface SkyFeatureHandle { update(f: FrameState, t: number): void; dispose(): void }
/** Vật mang băng rôn cổ vũ đứng yên sau khán đài (khinh khí cầu / đèn lồng / blimp / toan căng khung). */
export interface BannerCarriersHandle { update?(f: FrameState, t: number): void; dispose(): void }
/** Màn bay ngang kéo băng rôn khi Hype đạt đỉnh hoặc khi balloons.consumeFlybyRequest() trả true. */
export interface FlybyHandle { update(f: FrameState, t: number): void; dispose(): void }

export interface OutsideBuildContext extends ZoneContext {
  /** false khi phong cách thay cực quang (khe skyFeature có builder): builder `sky` không được vẽ cực quang. */
  readonly aurora: boolean;
}

export interface OutsideBuilders {
  sky(ctx: OutsideBuildContext): SkyHandle;
  /** null ở mặc định: cực quang nằm sẵn trong builder `sky`. */
  skyFeature: ((ctx: OutsideBuildContext) => SkyFeatureHandle) | null;
  bannerCarriers(ctx: OutsideBuildContext): BannerCarriersHandle;
  flyby(ctx: OutsideBuildContext): FlybyHandle;
  /** Sự kiện bí mật: tạo LƯỜI ở lần đầu diễn; hợp đồng SecretAct (secretShared.ts). */
  secretUfo(scene: THREE.Scene): SecretAct;
  secretRocket(scene: THREE.Scene): SecretAct;
  secretDragon(scene: THREE.Scene): SecretAct;
  /** Phi đội vẽ hình trên trời (tim khói / chữ S / tia sét / tim nét cọ — theme.features.heartFigure). */
  secretJet(scene: THREE.Scene): SecretAct;
}
export type OutsideSlot = keyof OutsideBuilders;

export const DEFAULT_BUILDERS: OutsideBuilders = {
  sky: (c) => createSky(c.scene, c.uniforms, c.glow, { aurora: c.aurora }),
  skyFeature: null,
  bannerCarriers: (c) => createBalloons(c.scene, c.uniforms),
  flyby: (c) => createFlyby(c.scene, c.uniforms),
  secretUfo: DEFAULT_SECRET_FACTORIES.ufo,
  secretRocket: DEFAULT_SECRET_FACTORIES.rocket,
  secretDragon: DEFAULT_SECRET_FACTORIES.dragon,
  secretJet: DEFAULT_SECRET_FACTORIES.jet,
};

/**
 * Chọn builder cho một khe. `variant` lấy từ theme.features (vd. theme.features.secretSet.dragon):
 * 'default' → luôn dùng builder mặc định; giá trị khác → builder của phong cách nếu đã đăng ký, chưa có thì mặc định.
 */
export function pickBuilder<K extends OutsideSlot>(slot: K, variant = 'themed', themeId: ThemeId = getActiveThemeId()): OutsideBuilders[K] {
  if (variant === 'default') return DEFAULT_BUILDERS[slot];
  return (THEME_BUILDERS[themeId]?.[slot] as OutsideBuilders[K] | undefined) ?? DEFAULT_BUILDERS[slot];
}
