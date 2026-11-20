// "Mực & Sơn mài" — khe `lights`: bọc dàn đèn mặc định (giữ chấm runway, vệt màu khán giả theo hypeColors "Trăng mờ / Hội đèn /
// Vàng son", flare đầu đèn) nhưng chùm moving-head dịu đi còn ~40 % (đêm hội, không phải rave) và ẩn đèn trang trí giàn
// (PAR bar / pixel vòm / searchlight) vốn bám giàn ống mặc định — đèn lồng của đình thay vai trò đó.
import * as THREE from 'three';
import type { FrameState, Updatable } from '../../../../core/types';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { createLights } from '../../lights';

export function createLacquerLights(ctx: ArenaBuildContext): Updatable {
  const { scene } = ctx;
  const before = new Set(scene.children);
  const inner = createLights(scene);
  const added = scene.children.filter((o) => !before.has(o));
  // nhóm gốc (Group) = chùm + flare + vệt màu; phần còn lại = đèn trang trí giàn → ẩn
  let beamInt: THREE.BufferAttribute | null = null;
  for (const o of added) {
    if (!(o instanceof THREE.Group)) { o.visible = false; continue; }
    for (const c of o.children) {
      const m = c as THREE.InstancedMesh;
      if (m.isInstancedMesh && m.geometry instanceof THREE.CylinderGeometry) beamInt = m.geometry.getAttribute('aInt') as THREE.BufferAttribute;
    }
  }
  return {
    update(f: FrameState) {
      inner.update(f);
      if (beamInt) { // chùm mềm hơn: hạ cường độ (mảng đã được ghi lại mỗi khung bởi bản mặc định)
        const a = beamInt.array as Float32Array;
        for (let i = 0; i < a.length; i++) a[i] = a[i]! * 0.4;
      }
    },
    dispose() { inner.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { lights: createLacquerLights };
