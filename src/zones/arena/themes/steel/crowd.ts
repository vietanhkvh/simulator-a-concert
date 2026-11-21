// "Thép & Lửa" — khán giả sân (gói S3, khe `crowd`, biến thể shader). Giữ NGUYÊN máy JS của crowd.ts mặc định
// (bố cục + lối đi, 2 draw call, LOD, tự giảm chất lượng, flash, sóng, hành vi) bằng cách bọc createCrowd rồi thay mã
// shader + thêm uniform bảng màu thép/lửa vào hai material (tìm theo tên mesh). Không ghi buffer mỗi frame.
// Người đa giác 6,5 đầu; nắm đấm / tay sừng / điện thoại / bật lửa; sóng = sóng mosh; flash = biển điện thoại + bật lửa.
import * as THREE from 'three';
import { HAIR, PAL, RAMPS, SKIN, hexToRgb } from '../../../../world/style';
import { createCrowd } from '../../crowd';
import type { ArenaBuilders, Crowd } from '../../builders';
import vert from './crowd.vert.glsl?raw';
import frag from './crowd.frag.glsl?raw';

const v3 = (hex: number) => new THREE.Vector3(...hexToRgb(hex));

function steelUniforms() {
  // RAMPS của style sheet "Thép & Lửa"; dự phòng về token 8 ô nếu thiếu (vd. dựng thử ở theme khác).
  const r = (name: string, k: 100 | 300 | 500 | 700, fb: number) => RAMPS[name]?.[k] ?? fb;
  const coal = (k: 100 | 300 | 500 | 700) => r('coal', k, PAL.night[k]);
  const denim = 0x3b4a66;
  const pick = <T,>(a: T[], n: number) => Array.from({ length: n }, (_, i) => a[i % a.length]!);
  return {
    uStSkin: { value: pick(SKIN, 5).map(v3) },
    uStHair: { value: pick(HAIR, 8).map(v3) },
    uStCloth: { value: [coal(500), coal(300), coal(100), denim, r('blood', 500, PAL.berry[700]), r('steel', 700, PAL.grape[700])].map(v3) },
    uStDenim: { value: v3(0x2e3a52) },
    uStArc: { value: v3(r('arc', 500, PAL.soda[300])) },
    uStTung: { value: v3(r('tungsten', 500, PAL.mint[500])) },
    uStFire: { value: v3(r('flame', 500, PAL.berry[500])) },
    uStBlood: { value: v3(r('blood', 100, PAL.berry[500])) },
    uStHot: { value: v3(r('whitehot', 100, PAL.honey[100])) },
    uStPhone: { value: v3(r('arc', 300, PAL.cream[100])) },
    uStCoal: { value: v3(coal(500)) },
  };
}

export function createSteelCrowd(scene: THREE.Scene, opts: Parameters<typeof createCrowd>[1]): Crowd {
  const crowd = createCrowd(scene, opts);
  const extra = steelUniforms();
  for (const name of ['crowd-body', 'crowd-sticks']) {
    const m = scene.getObjectByName(name) as THREE.Mesh | undefined;
    const mat = m?.material as THREE.ShaderMaterial | undefined;
    if (!mat || !mat.isShaderMaterial) { console.warn(`[steel crowd] thiếu ${name}, giữ shader mặc định`); continue; }
    mat.vertexShader = vert;
    mat.fragmentShader = frag;
    Object.assign(mat.uniforms, extra);
    mat.needsUpdate = true;
  }
  return crowd;
}

export const builders: Partial<ArenaBuilders> = { crowd: (ctx) => createSteelCrowd(ctx.scene, ctx.crowd) };
