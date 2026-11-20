// STUB P0 — gói P6 thay: sân khấu, camera góc nhìn ca sĩ lắc theo chuột, fog, giới hạn DPR 1,5.
import * as THREE from 'three';
import type { Stage } from '../core/types';

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05050a);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 2.2, 0);
  camera.lookAt(0, 1.5, -20);
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  return {
    scene,
    camera,
    renderer,
    update() {},
    render: () => renderer.render(scene, camera),
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
