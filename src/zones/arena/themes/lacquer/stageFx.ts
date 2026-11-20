// "Mực & Sơn mài" — khe `stageFx`: bọc hiệu ứng mặc định. Tắt laser (đêm hội, không phải rave); blinder dịu còn một nửa
// (vẫn ≤ 1 chớp mỗi phách, < 3 lần/s); khói thấp thành sương trầm hương ấm (vỏ trứng ↔ cam đèn lồng) thay CO2 theo màu Hype;
// pháo giữ nguyên (tia lửa vàng quỳ / vỏ trứng / son lấy từ token của phong cách).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { hypeColors, toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders, StageFx } from '../../builders';
import { createStageFx } from '../../stageFx';
import { R } from './stageKit';

export function createLacquerStageFx(ctx: ArenaBuildContext): StageFx {
  const { scene } = ctx;
  const before = new Set(scene.children);
  const inner = createStageFx(scene);
  const group = scene.children.find((o) => !before.has(o));
  const kids = group?.children ?? [];
  const uOf = (o: THREE.Object3D | undefined) => ((o as THREE.Mesh | undefined)?.material as THREE.ShaderMaterial | undefined)?.uniforms;
  const lasers = kids[0], blind = uOf(kids[2]), haze = uOf(kids[3]);
  const P = R();
  const silk = toColor(P.silk[700]).convertLinearToSRGB(), amber = toColor(P.amber[700]).convertLinearToSRGB();
  const tmp = new THREE.Color();
  return {
    update(f: FrameState) {
      inner.update(f);
      if (lasers) lasers.visible = false;
      if (blind) blind.uIntensity!.value *= 0.5;
      if (haze) {
        const hc = hypeColors(f.hype);
        tmp.setRGB(hc.primary[0], hc.primary[1], hc.primary[2]);
        (haze.uColor!.value as THREE.Color).copy(silk).lerp(tmp, 0.25);
        (haze.uColor2!.value as THREE.Color).copy(amber);
        haze.uIntensity!.value = 0.08 + 0.05 * f.hype;
      }
    },
    pyro: () => inner.pyro(),
    dispose() { inner.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { stageFx: createLacquerStageFx };
