// "Mực & Sơn mài" — khán giả sân (gói L4, khe `crowd`, biến thể shader). Giữ NGUYÊN máy JS của crowd.ts mặc định
// (bố cục + lối đi, 2 draw call, LOD, tự giảm chất lượng, flash, sóng biển, hành vi) bằng cách bọc createCrowd rồi
// thay mã shader + thêm uniform bảng màu sơn mài vào hai material của nó. Không ghi buffer mỗi frame.
import * as THREE from 'three';
import { PAL, SKIN, hexToRgb } from '../../../../world/style';
import { createCrowd } from '../../crowd';
import type { ArenaBuilders, Crowd } from '../../builders';
import vert from './crowd.vert.glsl?raw';
import frag from './crowd.frag.glsl?raw';

const v3 = (hex: number) => new THREE.Vector3(...hexToRgb(hex));

function lacquerUniforms() {
  const lotus = v3(PAL.berry[300]).lerp(v3(PAL.berry[100]), 0.45);
  return {
    uLqCloth: { value: [PAL.grape[500], PAL.grape[700], PAL.mint[500], PAL.mint[700], PAL.night[100], PAL.berry[700], PAL.peach[700], PAL.cream[700]].map(v3) },
    uLqSkin: { value: SKIN.slice(0, 5).map(v3) },
    uLqScarf: { value: [PAL.berry[500], PAL.honey[500], PAL.grape[500], PAL.mint[500]].map(v3) },
    uLqLant: { value: [v3(PAL.berry[500]), v3(PAL.peach[500]), lotus, v3(PAL.honey[300])] },
    uLqWave: { value: [PAL.mint[700], PAL.mint[500], PAL.honey[500], PAL.honey[100]].map(v3) },
    uLqPhone: { value: [PAL.cream[100], PAL.peach[100]].map(v3) },
    uLqInk: { value: v3(PAL.night[700]) },
    uLqSilk: { value: v3(PAL.cream[500]) },
    uLqGold: { value: v3(PAL.honey[500]) },
    uLqWash: { value: v3(PAL.night[300]) },
    uLqStick: { value: v3(PAL.peach[700]) },
  };
}

export function createLacquerCrowd(scene: THREE.Scene, opts: Parameters<typeof createCrowd>[1]): Crowd {
  const crowd = createCrowd(scene, opts);
  const extra = lacquerUniforms();
  for (const name of ['crowd-body', 'crowd-sticks']) {
    const m = scene.getObjectByName(name) as THREE.Mesh | undefined;
    const mat = m?.material as THREE.ShaderMaterial | undefined;
    if (!mat || !mat.isShaderMaterial) { console.warn(`[lacquer crowd] thiếu ${name}, giữ shader mặc định`); continue; }
    mat.vertexShader = vert;
    mat.fragmentShader = frag;
    Object.assign(mat.uniforms, extra);
    mat.needsUpdate = true;
  }
  return crowd;
}

export const builders: Partial<ArenaBuilders> = { crowd: (ctx) => createLacquerCrowd(ctx.scene, ctx.crowd) };
