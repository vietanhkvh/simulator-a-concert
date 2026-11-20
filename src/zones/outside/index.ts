// KHU 1 — NGOÀI SÂN VẬN ĐỘNG (xa nhất): bầu trời và mọi thứ bay trên trời.
// Điểm vào duy nhất của khu: mã ngoài khu chỉ import từ file này.
import { createDebugLayers } from '../../core/debugLayers';
import type { FrameState } from '../../core/types';
import { getTheme } from '../../world/style';
import type { Zone, ZoneContext } from '../../world/zone';
import { triggerMeteors } from './sky';
import { setCheerBanners, triggerFlyby } from './balloons';
import { pickBuilder, type OutsideBuildContext } from './builders';
import {
  createSecretEvents, getSecretFocus, SECRET_CHANCES, setSecretChances, triggerSecret, type SecretKind,
} from './secretEvents';

export type { SecretKind };
export type {
  BannerCarriersHandle, FlybyHandle, OutsideBuildContext, OutsideBuilders, OutsideSlot, SecretAct, SkyFeatureHandle, SkyHandle,
} from './builders';

export interface OutsideZone extends Zone {
  /** Đổi khẩu hiệu trên băng rôn khinh khí cầu / máy bay. */
  setCheerBanners(texts: string[]): void;
  /** Gọi màn máy bay kéo băng rôn + khinh khí cầu bay lên. */
  triggerFlyby(): void;
  /** Gọi một sự kiện bí mật (UFO / tên lửa / rồng / máy bay phản lực). */
  triggerSecret(kind?: SecretKind, force?: boolean): void;
  setSecretChances(c: Partial<Record<SecretKind, number>>): void;
  readonly secretChances: Record<SecretKind, number>;
  /** Tâm sự kiện bí mật đang diễn ra (để camera nhìn theo), null khi không có. */
  getSecretFocus: typeof getSecretFocus;
  triggerMeteors(count: number): void;
  /** Debug (chế độ developer): ẩn/hiện cả khu hoặc từng lớp ('sky', 'aurora', 'stars', 'meteors', 'balloons', 'flyby', 'secrets'). */
  setVisible?(on: boolean): void;
  debugLayers?(): string[];
  setLayerVisible?(name: string, on: boolean): boolean;
  isLayerVisible?(name: string): boolean;
}

export function createOutsideZone(ctx: ZoneContext): OutsideZone {
  const { scene } = ctx;
  const feat = getTheme().features;
  // Builder của từng khe theo phong cách đang bật; khe chưa có builder riêng → builder mặc định (builders.ts).
  const skyFeatureBuilder = feat.skyFeature === 'aurora' ? null : pickBuilder('skyFeature');
  const bctx: OutsideBuildContext = { ...ctx, aurora: !skyFeatureBuilder };
  const layers = createDebugLayers(scene); // chỉ dùng cho chế độ developer (ẩn/hiện từng lớp)
  const sky = layers.track('sky', () => pickBuilder('sky')(bctx)); // vòm trời, sao, sao băng, trăng, cực quang, máy bay chở khách
  // Khe "cực quang": đèn trời / đèn rọi + mây khói… (phong cách khác chibi); lớp debug vẫn tên 'aurora'.
  const skyFeature = skyFeatureBuilder ? layers.track('aurora', () => skyFeatureBuilder(bctx)) : null;
  const balloons = layers.track('balloons', () => pickBuilder('bannerCarriers', feat.bannerCarrier)(bctx)); // khinh khí cầu + băng rôn cổ vũ
  const flyby = layers.track('flyby', () => pickBuilder('flyby', feat.secretSet.plane)(bctx)); // máy bay kéo băng rôn khi Hype đạt đỉnh
  // UFO, tên lửa, rồng, máy bay phản lực (tạo lười khi cần)
  const secrets = layers.track('secrets', () => createSecretEvents(scene, {
    ufo: pickBuilder('secretUfo', feat.secretSet.ufo), rocket: pickBuilder('secretRocket', feat.secretSet.rocket),
    dragon: pickBuilder('secretDragon', feat.secretSet.dragon), jet: pickBuilder('secretJet', feat.secretSet.jet),
  }));
  // Chế độ developer: tách vài vật thể của sky ra lớp riêng, nhận theo renderOrder cố định trong sky.ts (không sửa module).
  layers.split('sky', 'aurora', (o) => o.renderOrder === -5);
  layers.split('sky', 'stars', (o) => o.renderOrder === -15);
  layers.split('sky', 'meteors', (o) => o.renderOrder === -14);
  return {
    update(f: FrameState, t: number) {
      sky.update(t);
      skyFeature?.update(f, t);
      balloons.update?.(f, t);
      flyby.update(f, t);
      layers.watch('secrets', () => secrets.update(f)); // sự kiện bí mật tạo vật thể lúc chạy → gán vào lớp 'secrets'
    },
    dispose() {
      sky.dispose();
      skyFeature?.dispose();
      balloons.dispose();
      flyby.dispose();
      secrets.dispose();
    },
    setCheerBanners,
    triggerFlyby,
    triggerSecret,
    setSecretChances,
    secretChances: SECRET_CHANCES,
    getSecretFocus,
    triggerMeteors: (n) => (sky.burstMeteors ?? triggerMeteors)(n),
    setVisible: (on) => layers.setAll(on),
    debugLayers: () => layers.names(),
    setLayerVisible: (name, on) => layers.set(name, on),
    isLayerVisible: (name) => layers.get(name),
  };
}
