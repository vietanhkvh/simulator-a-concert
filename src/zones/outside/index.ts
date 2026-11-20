// KHU 1 — NGOÀI SÂN VẬN ĐỘNG (xa nhất): bầu trời và mọi thứ bay trên trời.
// Điểm vào duy nhất của khu: mã ngoài khu chỉ import từ file này.
import { createDebugLayers } from '../../core/debugLayers';
import type { FrameState } from '../../core/types';
import type { Zone, ZoneContext } from '../../world/zone';
import { createSky, triggerMeteors } from './sky';
import { createBalloons, setCheerBanners, triggerFlyby } from './balloons';
import { createFlyby } from './flyby';
import {
  createSecretEvents, getSecretFocus, SECRET_CHANCES, setSecretChances, triggerSecret, type SecretKind,
} from './secretEvents';

export type { SecretKind };

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
  /** Debug (chế độ developer): ẩn/hiện cả khu hoặc từng lớp ('sky', 'balloons', 'flyby', 'secrets'). */
  setVisible?(on: boolean): void;
  debugLayers?(): string[];
  setLayerVisible?(name: string, on: boolean): boolean;
  isLayerVisible?(name: string): boolean;
}

export function createOutsideZone(ctx: ZoneContext): OutsideZone {
  const { scene, uniforms, glow } = ctx;
  const layers = createDebugLayers(scene); // chỉ dùng cho chế độ developer (ẩn/hiện từng lớp)
  const sky = layers.track('sky', () => createSky(scene, uniforms, glow)); // vòm trời, sao, sao băng, trăng, cực quang, máy bay chở khách
  const balloons = layers.track('balloons', () => createBalloons(scene, uniforms)); // khinh khí cầu + băng rôn cổ vũ
  const flyby = layers.track('flyby', () => createFlyby(scene, uniforms)); // máy bay kéo băng rôn khi Hype đạt đỉnh
  const secrets = layers.track('secrets', () => createSecretEvents(scene)); // UFO, tên lửa, rồng, máy bay phản lực
  return {
    update(f: FrameState, t: number) {
      sky.update(t);
      flyby.update(f, t);
      secrets.update(f);
    },
    dispose() {
      sky.dispose();
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
    triggerMeteors,
    setVisible: (on) => layers.setAll(on),
    debugLayers: () => layers.names(),
    setLayerVisible: (name, on) => layers.set(name, on),
    isLayerVisible: (name) => layers.get(name),
  };
}
