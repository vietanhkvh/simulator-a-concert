// KHU 3 — SÂN TRUNG TÂM (gần nhất): sân khấu, runway, nơi người chơi và khán giả sân đứng.
// Điểm vào duy nhất của khu: mã ngoài khu chỉ import từ file này.
import type { FrameState, Song } from '../../core/types';
import { EYE_HEIGHT } from '../../world/layout';
import type { Zone, ZoneContext } from '../../world/zone';
import { createBand } from './band';
import { createCameraCrew, type CameraCrew } from './cameraCrew';
import { createConfetti, type Confetti } from './confetti';
import { createCrowd, type Crowd } from './crowd';
import { createEmotes, type Emotes } from './emotes';
import { createEntrance, ENTRANCE_SEC, type Entrance, type EntranceKind } from './entrance';
import { createLedScreens, type LedScreens } from './ledScreens';
import { createLedWall } from './ledWall';
import { createLights } from './lights';
import { createSinger } from './singer';
import { createStageBase } from './stageBase';
import { createControls, type StageControls, type ViewMode } from './stageControls';
import { createStageDeco } from './stageDeco';
import { createStageFx, type StageFx } from './stageFx';
import { createRunway } from './stageRunway';

export { ENTRANCE_SEC };
export type { EntranceKind, ViewMode, StageControls, Crowd, Emotes, Confetti, StageFx, LedScreens, Entrance, CameraCrew };

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
}

export function createArenaZone(ctx: ZoneContext, opts: ArenaOptions): ArenaZone {
  const { scene, camera, uniforms } = ctx;
  // Thứ tự tạo giữ nguyên như trước khi tách khu (ảnh hưởng thứ tự vẽ các vật trong suốt).
  const base = createStageBase(scene); // sàn diễn, mép, loa monitor, sàn dốc khu khán giả
  const runway = createRunway(scene); // các đường đi + bục
  const ledWall = createLedWall(scene, uniforms); // tường LED sau lưng ca sĩ + cánh gà
  const deco = createStageDeco(scene); // mái giàn, tháp, loa, nhạc cụ, cổng đèn
  const band = createBand(scene); // nhạc công
  const controls = createControls();
  const crowd = createCrowd(scene, { count: opts.crowdCount, rows: 40, arcDeg: 120 }); // khán giả sân
  const lights = createLights(scene); // đèn sân khấu
  const led = createLedScreens(scene);
  const confetti = createConfetti(scene);
  const emotes = createEmotes(scene); // biểu tượng cảm xúc
  const stageFx = createStageFx(scene); // laser, pháo hoa, đèn chớp, khói
  const singer = createSinger(scene); // hình ca sĩ (chỉ hiện ở góc máy ngoài)
  const crew = createCameraCrew(scene); // đội quay phim + flycam
  const entrance = createEntrance(scene); // màn chào sân

  let t = 0;
  let song: Song | null = null;

  return {
    controls, crowd, emotes, confetti, stageFx, led, crew, entrance,
    setSong(s) { song = s; },
    resetView: () => controls.reset(),
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
