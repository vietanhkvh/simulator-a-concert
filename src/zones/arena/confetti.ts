// Confetti: 1 THREE.Points, ~600 mảnh, chuyển động hoàn toàn trong vertex shader (uTime - uStart).
import * as THREE from 'three';
import type { FrameState } from '../../core/types';

export interface Confetti {
  update(f: FrameState): void;
  burst(): void;
  dispose(): void;
}

const COUNT = 600;
const LIFE = 9; // giây, gồm cả trễ rơi
const COOLDOWN = 12;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uStart;
uniform float uPx;
attribute vec4 aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float age = uTime - uStart - aSeed.w * 1.2;
  float k = clamp(age, 0.0, 100.0);
  // vị trí khởi đầu: dải rộng trước khán giả / mép sân khấu, trên cao
  vec3 p = vec3((aSeed.x - 0.5) * 30.0, 9.0 + aSeed.y * 5.0, -5.0 - aSeed.z * 22.0);
  float fall = 1.6 + aSeed.y * 1.6;
  p.y -= fall * k;
  p.x += sin(k * (1.5 + aSeed.z * 2.0) + aSeed.x * 40.0) * 0.8;
  p.z += cos(k * (1.2 + aSeed.x * 2.0) + aSeed.y * 30.0) * 0.8;
  vColor = aColor * (0.75 + 0.25 * sin(k * 9.0 + aSeed.z * 20.0)); // lấp lánh khi lật
  float fadeOut = 1.0 - smoothstep(${(LIFE - 3).toFixed(1)}, ${LIFE.toFixed(1)}, age + aSeed.w * 1.2);
  vAlpha = (age < 0.0 || p.y < -1.2) ? 0.0 : fadeOut;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(2.0, uPx * (0.13 + aSeed.y * 0.08) / -mv.z);
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}`;

export function createConfetti(scene: THREE.Scene): Confetti {
  const seed = new Float32Array(COUNT * 4);
  const col = new Float32Array(COUNT * 3);
  const pos = new Float32Array(COUNT * 3); // giả, chỉ để có số đỉnh
  const palette = [0xff3d81, 0x35d0ff, 0xffd93d, 0x7cff6b, 0xb06bff, 0xffffff].map((c) => new THREE.Color(c));
  let s = 12345;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < COUNT; i++) {
    seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    const c = palette[Math.floor(rnd() * palette.length)];
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const uniforms = { uTime: { value: 0 }, uStart: { value: -1000 }, uPx: { value: 600 } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 5;
  scene.add(points);

  let time = 0;
  let lastBurst = -1000;
  let prevHype = 0;

  const burst = () => {
    uniforms.uStart.value = time;
    lastBurst = time;
    points.visible = true;
  };

  return {
    update(f) {
      time += Math.min(f.dt, 0.1);
      uniforms.uTime.value = time;
      uniforms.uPx.value = window.innerHeight * 1.2; // gl_PointSize ~ tỉ lệ chiều cao viewport
      if (f.hype > 0.9 && prevHype <= 0.9 && time - lastBurst >= COOLDOWN) burst();
      prevHype = f.hype;
      if (points.visible && time - uniforms.uStart.value > LIFE + 1.5) points.visible = false;
    },
    burst,
    dispose() {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
    },
  };
}
