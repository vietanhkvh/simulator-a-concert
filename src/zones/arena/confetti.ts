// Confetti: 1 THREE.Points, ~600 mảnh, chuyển động hoàn toàn trong vertex shader (uTime - uStart).
// Mảnh kẹo bo tròn: đĩa, tim, sao, ruy băng (SDF trong fragment), màu berry/soda/honey/mint/cream; lật = co một trục.
import { viewHeightPx } from '../../world/shared/viewport';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { FIELD_Y } from '../../world/layout';
import { PAL } from '../../world/style';
import { SHAPES_GLSL } from './stageFx';

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
varying float vShape;
varying float vFlip;
varying float vRot;
void main() {
  float age = uTime - uStart - aSeed.w * 1.2;
  float k = clamp(age, 0.0, 100.0);
  // vị trí khởi đầu: dải rộng trước khán giả / mép sân khấu, trên cao
  vec3 p = vec3((aSeed.x - 0.5) * 30.0, 9.0 + aSeed.y * 5.0, -5.0 - aSeed.z * 22.0);
  float fall = 1.6 + aSeed.y * 1.6;
  p.y -= fall * k;
  p.x += sin(k * (1.5 + aSeed.z * 2.0) + aSeed.x * 40.0) * 0.8;
  p.z += cos(k * (1.2 + aSeed.x * 2.0) + aSeed.y * 30.0) * 0.8;
  float flip = sin(k * (5.0 + aSeed.x * 6.0) + aSeed.z * 20.0);
  vFlip = 0.25 + 0.75 * abs(flip);            // lật: co một trục
  vRot = k * (aSeed.y - 0.5) * 3.0 + aSeed.x * 6.28;
  vShape = floor(fract(aSeed.z * 7.13 + aSeed.x * 3.7) * 4.0); // 0 đĩa, 1 tim, 2 sao, 3 ruy băng
  vColor = aColor * (0.8 + 0.2 * flip);         // mặt sau tối hơn một chút
  float fadeOut = 1.0 - smoothstep(${(LIFE - 3).toFixed(1)}, ${LIFE.toFixed(1)}, age + aSeed.w * 1.2);
  vAlpha = (age < 0.0 || p.y < ${(FIELD_Y + 0.3).toFixed(2)}) ? 0.0 : fadeOut;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(2.0, uPx * (0.2 + aSeed.y * 0.1) / -mv.z);
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying float vFlip;
varying float vRot;
${SHAPES_GLSL}
void main() {
  if (vAlpha < 0.01) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  p.y = -p.y;
  float c = cos(vRot), s = sin(vRot);
  p = mat2(c, -s, s, c) * p;
  p.x /= vFlip;
  float m;
  if (vShape < 0.5) m = smoothstep(0.52, 0.44, length(p));
  else if (vShape < 1.5) m = sdHeart(p * 1.15);
  else if (vShape < 2.5) m = sdStar(p, 0.8);
  else { // ruy băng: dải cong bo tròn hai đầu
    vec2 q = vec2(p.x, p.y - 0.25 * sin(p.x * 3.0));
    q.x = max(abs(q.x) - 0.55, 0.0);
    m = smoothstep(0.2, 0.13, length(q));
  }
  if (m < 0.02) discard;
  // đốm highlight kem nhỏ
  float hi = smoothstep(0.16, 0.05, length(p - vec2(-0.18, 0.2)));
  vec3 col = mix(vColor, vec3(1.0, 0.98, 0.95), hi * 0.35 * step(vShape, 2.5));
  gl_FragColor = vec4(col, vAlpha * m);
}`;

export function createConfetti(scene: THREE.Scene): Confetti {
  const seed = new Float32Array(COUNT * 4);
  const col = new Float32Array(COUNT * 3);
  const pos = new Float32Array(COUNT * 3); // giả, chỉ để có số đỉnh
  // shader thô → giá trị sRGB để đúng hex bảng màu
  const palette = [PAL.berry[500], PAL.soda[500], PAL.honey[500], PAL.mint[500], PAL.cream[500], PAL.berry[300]].map((c) => new THREE.Color(c).convertLinearToSRGB());
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
      uniforms.uPx.value = viewHeightPx() * 1.2; // gl_PointSize ~ tỉ lệ chiều cao viewport
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
