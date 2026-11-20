// KHU 3 — sổ đăng ký builder theo phong cách (docs/THEMES.md mục "Khe builder").
// Mỗi KHE là một nhóm vật thể thay được, trả về ĐÚNG handle hiện có (main.ts và index.ts không cần biết phong cách).
// Builder riêng của phong cách nằm ở ./themes/<id>/<module>.ts và đăng ký trong ./themes/<id>/index.ts.
import type { FrameState, Updatable } from '../../core/types';
import { getActiveThemeId, type ThemeId } from '../../world/style';
import type { ZoneContext } from '../../world/zone';
import { createBand, type Band } from './band';
import { createCameraCrew, type CameraCrew } from './cameraCrew';
import { createConfetti, type Confetti } from './confetti';
import type { CrowdOptions } from '../../core/types';
import { createCrowd, type Crowd } from './crowd';
import { createEmotes, type Emotes } from './emotes';
import { createEntrance, DEFAULT_ENTRANCE_KIT, type Entrance, type EntranceKit } from './entrance';
import { createLedScreens, type LedScreens } from './ledScreens';
import { createLedWall } from './ledWall';
import { createLights } from './lights';
import { createSinger, type SingerAvatar } from './singer';
import { createStageBase } from './stageBase';
import { createStageDeco } from './stageDeco';
import { createStageFx, type StageFx } from './stageFx';
import { createRunway } from './stageRunway';
import { THEME_BUILDERS } from './themes';

export type { Band, CameraCrew, Confetti, Crowd, CrowdOptions, Emotes, Entrance, EntranceKit, LedScreens, SingerAvatar, StageFx };

/** Vật tĩnh (sàn diễn…). */
export interface StaticHandle { dispose(): void }
/** Vật có hoạt hoạ theo đồng hồ world (runway, tường LED, mái giàn + trang trí). */
export interface AnimatedHandle { update(f: FrameState, t: number): void; dispose(): void }

export interface ArenaBuildContext extends ZoneContext {
  /** Tham số khán giả sân (số người, số hàng, góc cung). */
  readonly crowd: CrowdOptions;
}

export interface ArenaBuilders {
  /** Sàn diễn, mép, loa monitor, sàn dốc khu khán giả. Kích thước lấy ở world/layout.ts (không đổi vùng đi lại). */
  stageBase(ctx: ArenaBuildContext): StaticHandle;
  /** Hình các đường đi + bục + sân khấu phụ (vùng đi lại vẫn theo walkLayout.ts). */
  runway(ctx: ArenaBuildContext): AnimatedHandle;
  /** Tường LED sau lưng ca sĩ + cánh gà. */
  ledWall(ctx: ArenaBuildContext): AnimatedHandle;
  /** Mái giàn, tháp, loa, nhạc cụ, hàng rào, cổng đèn. */
  stageDeco(ctx: ArenaBuildContext): AnimatedHandle;
  band(ctx: ArenaBuildContext): Band;
  /** Khán giả sân (instancing). Biến thể shader: tự tạo ShaderMaterial riêng, giữ handle Crowd (setFlash, getQuality…). */
  crowd(ctx: ArenaBuildContext): Crowd;
  lights(ctx: ArenaBuildContext): Updatable;
  /** Hai màn hình LED lớn cuối sân. */
  ledScreens(ctx: ArenaBuildContext): LedScreens;
  confetti(ctx: ArenaBuildContext): Confetti;
  emotes(ctx: ArenaBuildContext): Emotes;
  /** Laser, pháo hoa, đèn chớp, khói. */
  stageFx(ctx: ArenaBuildContext): StageFx;
  singer(ctx: ArenaBuildContext): SingerAvatar;
  /** Đội quay phim + cần cẩu + flycam (cũng cung cấp pose các góc máy ngoài). */
  cameraCrew(ctx: ArenaBuildContext): CameraCrew;
  /** Đạo cụ ba màn chào sân; trả về từng phần muốn thay (phần thiếu dùng mặc định). */
  entranceProps(ctx: ArenaBuildContext): Partial<EntranceKit>;
  /** Toàn bộ màn chào sân (kịch bản + camera); mặc định dùng `kit` từ khe entranceProps. */
  entrance(ctx: ArenaBuildContext, kit: EntranceKit): Entrance;
}
export type ArenaSlot = keyof ArenaBuilders;

export const DEFAULT_BUILDERS: ArenaBuilders = {
  stageBase: (c) => createStageBase(c.scene),
  runway: (c) => createRunway(c.scene),
  ledWall: (c) => createLedWall(c.scene, c.uniforms),
  stageDeco: (c) => createStageDeco(c.scene),
  band: (c) => createBand(c.scene),
  crowd: (c) => createCrowd(c.scene, c.crowd),
  lights: (c) => createLights(c.scene),
  ledScreens: (c) => createLedScreens(c.scene),
  confetti: (c) => createConfetti(c.scene),
  emotes: (c) => createEmotes(c.scene),
  stageFx: (c) => createStageFx(c.scene),
  singer: (c) => createSinger(c.scene),
  cameraCrew: (c) => createCameraCrew(c.scene),
  entranceProps: () => DEFAULT_ENTRANCE_KIT,
  entrance: (c, kit) => createEntrance(c.scene, kit),
};

/** Như outside/builders.ts: 'default' → builder mặc định; khác → builder của phong cách nếu có, không thì mặc định. */
export function pickBuilder<K extends ArenaSlot>(slot: K, variant = 'themed', themeId: ThemeId = getActiveThemeId()): ArenaBuilders[K] {
  if (variant === 'default') return DEFAULT_BUILDERS[slot];
  return (THEME_BUILDERS[themeId]?.[slot] as ArenaBuilders[K] | undefined) ?? DEFAULT_BUILDERS[slot];
}
