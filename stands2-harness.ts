import * as THREE from 'three';
import { createWorldUniforms } from './src/world/shared/worldUniforms';
import { createGlowBuf, buildGlowPoints } from './src/world/shared/glowPoints';
import { createStandsZone } from './src/zones/stands';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1); renderer.setSize(1280, 720, false);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0a1c);
const camera = new THREE.PerspectiveCamera(70, 1280 / 720, 0.1, 400);
camera.position.set(0, 1.65, 0); camera.rotation.order = 'YXZ';
const uniforms = createWorldUniforms(); uniforms.uRes = { value: 1 }; uniforms.uPx = { value: 514 };
const glow = createGlowBuf();
const stands = createStandsZone({ scene, camera, uniforms, glow });
buildGlowPoints(scene, uniforms, glow);
let t = 0;
const w = window as any;
w.frame = (hype: number, secs = 0, yawDeg = 0, pitchDeg = 0, fov = 70) => {
  camera.rotation.y = THREE.MathUtils.degToRad(yawDeg); camera.rotation.x = THREE.MathUtils.degToRad(pitchDeg);
  camera.fov = fov; camera.updateProjectionMatrix();
  const n = Math.max(1, Math.round(secs * 30));
  for (let i = 0; i < n; i++) {
    t += 1 / 30;
    uniforms.uTime.value = t; uniforms.uHype.value = hype; uniforms.uPhase.value = t * 2;
    uniforms.uPulse.value = Math.max(0, 1 - ((t * 2) % 1) * 3);
    stands.update({ hype, waveMode: 0 } as any, t);
    renderer.render(scene, camera);
  }
  return renderer.info.render.calls;
};
w.fire = (kind: string, on?: boolean) => window.dispatchEvent(new CustomEvent('cs-interact', { detail: { kind, on } }));
w.ready = true;
