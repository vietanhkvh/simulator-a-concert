// "Đêm Sao Điểm Ảnh" — khán giả sân (gói P2, khe `crowd`, biến thể shader). Giữ NGUYÊN máy JS của crowd.ts mặc định
// (bố cục + lối đi, 2 draw call, tự giảm chất lượng, flash, sóng biển) bằng cách bọc createCrowd rồi thay mã shader +
// thêm uniform atlas/bảng màu vào hai material (tìm theo tên mesh). Không ghi buffer mỗi frame.
// Sprite 4 tầng cầm sao có quầng; 1/12 "Người thét" (Munch 1893); khách mời ~1/45 (tranh phạm vi công cộng, E §5);
// Hype ≥ 80 %: cả sân ôm má (nới dần ≥ 1,2 s). 'cs-interact': cheer = cả sân giơ hai tay nhảy + Người thét thét;
// heart = sao đổi hồng sen; flash (setFlash) = sao giơ cao, quầng to; sóng = sóng biển Hokusai (áo đổi màu, ngọn nhấc 3 px).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { hexToRgb } from '../../../../world/style';
import { createCrowd } from '../../crowd';
import type { ArenaBuilders, Crowd } from '../../builders';
import { C, buildCrowdAtlas, pixelPalette, starCentres } from './crowdAtlas';
import vert from './crowd.vert.glsl?raw';
import frag from './crowd.frag.glsl?raw';

export function createPixelCrowd(scene: THREE.Scene, opts: Parameters<typeof createCrowd>[1]): Crowd {
  const crowd = createCrowd(scene, opts);
  const atlas = buildCrowdAtlas();
  const v2 = (a: number, b: number) => new THREE.Vector2(a, b);
  const extra = {
    uPxAtlas: { value: atlas },
    uPxPal: { value: pixelPalette().map((h) => new THREE.Vector3(...hexToRgb(h))) },
    uPxView: { value: new THREE.Vector2(427, 240) },
    uPxStar: { value: starCentres() },
    uPxCheer: { value: 0 },
    uPxScream: { value: 0 },
    uPxHeart: { value: 0 },
    // áo: lam Phổ, crôm, lục bách, ngọc, sen, tím chiều, đất — kèm bậc bóng (ramp dịch sắc về lam/tím)
    uPxCloth: { value: [
      v2(C.PHO3, C.PHO5), v2(C.PHO5, C.PHO7), v2(C.CROM5, C.CROM7), v2(C.BACH3, C.BACH5), v2(C.BACH1, C.BACH3),
      v2(C.NGOC, C.BACH5), v2(C.SEN, C.TIM5), v2(C.TIM3, C.TIM5), v2(C.TIM5, C.TIM7), v2(C.DAT3, C.DAT5),
    ] },
    uPxSkin: { value: [v2(C.DAT1, C.DAT3), v2(C.DAT3, C.DAT5), v2(C.DAT5, C.DAT7)] },
    uPxHair: { value: [C.INK, C.DAT7, C.DAT5, C.CROM7, C.CROM3, C.SEN, C.PHO1, C.TIM3] },
    uPxPants: { value: [C.PHO7, C.TIM7, C.DAT7, C.MAY7] },
  };
  let body: THREE.Mesh | undefined;
  for (const name of ['crowd-body', 'crowd-sticks']) {
    const m = scene.getObjectByName(name) as THREE.Mesh | undefined;
    const mat = m?.material as THREE.ShaderMaterial | undefined;
    if (!m || !mat || !mat.isShaderMaterial) { console.warn(`[pixel crowd] thiếu ${name}, giữ shader mặc định`); continue; }
    mat.vertexShader = vert;
    mat.fragmentShader = frag;
    Object.assign(mat.uniforms, extra);
    mat.needsUpdate = true;
    if (name === 'crowd-body') body = m;
  }
  // Cỡ đích vẽ hiện tại (đích thấp của hậu kỳ pixelate) — đọc ngay lúc vẽ nên luôn khớp gl_FragCoord.
  const vp = new THREE.Vector4();
  if (body) body.onBeforeRender = (renderer) => {
    renderer.getCurrentViewport(vp);
    if (vp.z > 0 && vp.w > 0) extra.uPxView.value.set(vp.z, vp.w);
  };

  let cheerAge = 99, heartAge = 99;
  const onInteract = (e: Event) => {
    const d = (e as CustomEvent).detail as { kind?: string } | undefined;
    if (d?.kind === 'cheer') cheerAge = 0;
    else if (d?.kind === 'heart') heartAge = 0;
  };
  window.addEventListener('cs-interact', onInteract);
  const env = (a: number, dur: number, fin: number, fout: number) => Math.max(0, Math.min(1, a / fin, (dur - a) / fout));

  return {
    ...crowd,
    update(f: FrameState) {
      crowd.update(f);
      const dt = Math.min(Math.max(f.dt, 0), 0.1);
      cheerAge += dt; heartAge += dt;
      extra.uPxCheer.value = env(cheerAge, 2.6, 0.1, 0.6);
      extra.uPxHeart.value = env(heartAge, 3.2, 0.1, 0.4);
      // ≥ 80 %: lần lượt từng người chuyển sang ôm má trong ~1,2 s (không đổi đồng loạt một khung)
      const target = f.hype >= 0.8 ? 1 : 0;
      const s = extra.uPxScream.value;
      extra.uPxScream.value = target > s ? Math.min(1, s + dt / 1.2) : Math.max(0, s - dt / 1.2);
    },
    dispose() {
      window.removeEventListener('cs-interact', onInteract);
      if (body) body.onBeforeRender = () => {};
      crowd.dispose();
      atlas.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { crowd: (ctx) => createPixelCrowd(ctx.scene, ctx.crowd) };
