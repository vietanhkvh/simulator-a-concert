// WORLD — nơi DUY NHẤT ghép ba khu thành một cảnh: tạo renderer/scene/camera, uniform + điểm sáng dùng chung,
// rồi gọi lần lượt ba khu. main.ts chỉ làm việc với World và các handle của từng khu.
//
//   outside (ngoài sân, xa nhất)  →  stands (khán đài)  →  arena (sân trung tâm, gần nhất)
//
// Quy ước tọa độ (xem layout.ts): ca sĩ ở gốc, nhìn về -Z; khán giả ở phía -Z; +Y hướng lên.
import * as THREE from 'three';
import type { FrameState, Stage } from '../core/types';
import { createArenaZone, type ArenaOptions, type ArenaZone } from '../zones/arena';
import { createOutsideZone, type OutsideZone } from '../zones/outside';
import { createStandsZone, type StandsZone } from '../zones/stands';
import { CAMERA_FAR, CAMERA_FOV, EYE_HEIGHT, FOG_COLOR, FOG_DENSITY } from './layout';
import { buildGlowPoints, createGlowBuf } from './shared/glowPoints';
import { createWorldUniforms, updateWorldUniforms } from './shared/worldUniforms';
import type { ZoneContext } from './zone';

export interface World extends Stage {
  readonly outside: OutsideZone;
  readonly stands: StandsZone;
  readonly arena: ArenaZone;
  dispose(): void;
}

export function createWorld(canvas: HTMLCanvasElement, opts: ArenaOptions): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(FOG_COLOR);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, CAMERA_FAR);
  camera.position.set(0, EYE_HEIGHT, 0);
  camera.rotation.order = 'YXZ';

  const uniforms = createWorldUniforms();
  const glow = createGlowBuf();
  const ctx: ZoneContext = { scene, camera, uniforms, glow };

  // Từ xa tới gần. Điểm sáng dùng chung được dựng sau khi khu ngoài sân và khán đài đã thêm điểm.
  const outside = createOutsideZone(ctx);
  const stands = createStandsZone(ctx);
  const glowPoints = buildGlowPoints(scene, uniforms, glow);
  const arena = createArenaZone(ctx, opts);

  let animT = 0; // đồng hồ hoạt họa: đứng yên khi dt = 0 (tạm dừng)

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  return {
    scene, camera, renderer, outside, stands, arena,
    update(f: FrameState) {
      const dt = Math.min(f.dt, 0.1);
      animT += dt > 0 ? dt : 0;
      updateWorldUniforms(uniforms, f, animT);
      arena.update(f, animT);
      outside.update(f, animT);
      stands.update(f, animT);
    },
    render: () => renderer.render(scene, camera),
    dispose() {
      window.removeEventListener('resize', resize);
      arena.dispose();
      stands.dispose();
      outside.dispose();
      glowPoints.dispose();
      renderer.dispose();
    },
  };
}
