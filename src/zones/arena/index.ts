// KHU 3 — SÂN TRUNG TÂM (gần nhất): sân khấu, runway, nơi người chơi và khán giả sân đứng.
// Điểm vào duy nhất của khu: mã ngoài khu chỉ import từ file này.
import { createDebugLayers } from '../../core/debugLayers';
import type { FrameState, Song } from '../../core/types';
import { EYE_HEIGHT } from '../../world/layout';
import type { Zone, ZoneContext } from '../../world/zone';
import { getTheme } from '../../world/style';
import { pickBuilder, type ArenaBuildContext, type CameraCrew, type Confetti, type Crowd, type Emotes, type Entrance, type LedScreens, type StageFx } from './builders';
import { DEFAULT_ENTRANCE_KIT, ENTRANCE_SEC, type EntranceKind } from './entrance';
import { createControls, VIEW_CONTROL_HINTS, VIEW_MODES, VIEW_ORDER, type StageControls, type ViewControlState, type ViewMode } from './stageControls';
import { PLATFORMS } from './walkLayout';

export { ENTRANCE_SEC };
/** Debug/chế độ developer: thứ tự góc máy (phím V) và tâm các bục (để dịch chuyển nhanh). */
export { VIEW_ORDER, VIEW_MODES, PLATFORMS };
/** Hướng dẫn điều khiển góc máy ngoài (xoay, zoom, nâng/hạ, flycam bay tự do, đặt lại) cho bảng phím tắt. */
export { VIEW_CONTROL_HINTS };
export type { ViewControlState };
export type { EntranceKind, ViewMode, StageControls, Crowd, Emotes, Confetti, StageFx, LedScreens, Entrance, CameraCrew };
export type {
  AnimatedHandle, ArenaBuildContext, ArenaBuilders, ArenaSlot, Band, CrowdOptions, EntranceKit, SingerAvatar, StaticHandle,
} from './builders';

export interface ArenaOptions {
  /** Số khán giả đứng dưới sân. */
  crowdCount: number;
}

export interface ArenaZone extends Zone {
  /** Điều khiển người chơi: đi lại, xoay, đổi góc máy. */
  readonly controls: StageControls;
  readonly crowd: Crowd;
  readonly emotes: Emotes;
  readonly confetti: Confetti;
  readonly stageFx: StageFx;
  /** Hai màn hình LED lớn cuối sân. */
  readonly led: LedScreens;
  readonly crew: CameraCrew;
  readonly entrance: Entrance;
  /** Bài đang diễn (để màn hình LED hiện lời); null = chỉ hiện hình sóng. */
  setSong(song: Song | null): void;
  resetView(): void;
  /** Debug (chế độ developer): ẩn/hiện cả khu hoặc từng lớp (crowd, lights, stageFx, emotes…). */
  setVisible?(on: boolean): void;
  debugLayers?(): string[];
  setLayerVisible?(name: string, on: boolean): boolean;
  isLayerVisible?(name: string): boolean;
}

export function createArenaZone(ctx: ZoneContext, opts: ArenaOptions): ArenaZone {
  const { scene, camera, uniforms } = ctx;
  // Thứ tự tạo giữ nguyên như trước khi tách khu (ảnh hưởng thứ tự vẽ các vật trong suốt).
  const layers = createDebugLayers(scene); // chỉ dùng cho chế độ developer (ẩn/hiện từng lớp)
  // Builder của từng khe theo phong cách đang bật; khe chưa có builder riêng → builder mặc định (builders.ts).
  const feat = getTheme().features;
  const bctx: ArenaBuildContext = { ...ctx, crowd: { count: opts.crowdCount, rows: 40, arcDeg: 120 } };
  const stage = feat.stageVariant, rig = feat.rigVariant;
  const base = layers.track('base', () => pickBuilder('stageBase', stage)(bctx)); // sàn diễn, mép, loa monitor, sàn dốc khu khán giả
  const runway = layers.track('runway', () => pickBuilder('runway', stage)(bctx)); // các đường đi + bục
  const ledWall = layers.track('ledWall', () => pickBuilder('ledWall', stage)(bctx)); // tường LED sau lưng ca sĩ + cánh gà
  const deco = layers.track('deco', () => pickBuilder('stageDeco', stage)(bctx)); // mái giàn, tháp, loa, nhạc cụ, cổng đèn
  const band = layers.track('band', () => pickBuilder('band', rig)(bctx)); // nhạc công
  const controls = createControls();
  const crowd = layers.track('crowd', () => pickBuilder('crowd', feat.crowdVariant)(bctx)); // khán giả sân
  const lights = layers.track('lights', () => pickBuilder('lights', stage)(bctx)); // đèn sân khấu
  const led = layers.track('led', () => pickBuilder('ledScreens', stage)(bctx));
  const confetti = layers.track('confetti', () => pickBuilder('confetti')(bctx));
  const emotes = layers.track('emotes', () => pickBuilder('emotes')(bctx)); // biểu tượng cảm xúc
  const stageFx = layers.track('stageFx', () => pickBuilder('stageFx', stage)(bctx)); // laser, pháo hoa, đèn chớp, khói
  // Laser nằm trong nhóm stageFx: nhận theo uniform uSpread của vật liệu (không sửa module).
  layers.split('stageFx', 'lasers', (o) => !!((o as unknown as { material?: { uniforms?: Record<string, unknown> } }).material?.uniforms?.uSpread));
  const singer = layers.track('singer', () => pickBuilder('singer', rig)(bctx)); // hình ca sĩ (chỉ hiện ở góc máy ngoài)
  const crew = layers.track('crew', () => pickBuilder('cameraCrew', rig)(bctx)); // đội quay phim + flycam
  const kit = { ...DEFAULT_ENTRANCE_KIT, ...pickBuilder('entranceProps')(bctx) };
  const entrance = layers.track('entrance', () => pickBuilder('entrance')(bctx, kit)); // màn chào sân

  let t = 0;
  let song: Song | null = null;

  return {
    controls, crowd, emotes, confetti, stageFx, led, crew, entrance,
    setSong(s) { song = s; },
    resetView: () => controls.reset(),
    setVisible: (on) => layers.setAll(on),
    debugLayers: () => layers.names(),
    setLayerVisible: (name, on) => layers.set(name, on),
    isLayerVisible: (name) => layers.get(name),
    update(f: FrameState, animT: number) {
      crowd.update(f);
      lights.update(f);
      emotes.update(f);
      stageFx.update(f);
      led.update(f, song);
      confetti.update(f);

      // Người chơi + camera góc ca sĩ (idle: thở + nhún nhẹ theo beat)
      const dt = Math.min(f.dt, 0.1);
      t += dt;
      controls.update(dt);
      const idleYaw = Math.sin(t * 0.37) * 0.008;
      const idlePitch = Math.sin(t * 0.53) * 0.006 - f.beatPulse * 0.004 * f.hype;
      camera.rotation.y = controls.yaw + idleYaw;
      camera.rotation.x = controls.pitch + idlePitch;
      camera.position.set(controls.pos.x, EYE_HEIGHT + Math.sin(t * 0.8) * 0.012, controls.pos.z);

      runway.update(f, animT);
      ledWall.update(f, animT);
      deco.update(f, animT);
      band.update(f);

      // Đội quay phim, màn chào sân, hình ca sĩ
      const sp = controls.getSingerPose();
      crew.update(f, sp.position, sp.yaw);
      entrance.update(f);
      const ep = entrance.getSingerPose();
      singer.update(f, ep ? ep.position : sp.position, ep ? ep.yaw : sp.yaw, ep ? true : controls.getViewMode() !== 'singer');
    },
    dispose() {
      controls.dispose();
      for (const d of [base, runway, ledWall, deco, band, crowd, lights, led, confetti, emotes, stageFx, singer, crew, entrance]) d.dispose();
    },
  };
}
