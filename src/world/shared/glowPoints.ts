// Điểm sáng dùng chung giữa các khu (đèn hàng không của máy bay ở khu "ngoài sân", đèn nhà + đèn pha
// ở khu "khán đài"): mọi khu thêm điểm vào MỘT bộ đệm, world.ts gọi buildGlowPoints() một lần → 1 draw call.
// aInfo = [kind, tốc độ nháy, pha, kiểu]; kind 3/4 bám theo hai máy bay chở khách (uniform uPlane/uPlaneVis).
import * as THREE from 'three';

export type Uniforms = { [k: string]: THREE.IUniform };

const GLOW_VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uPx;
uniform vec4 uPlane[2]; uniform vec2 uPlaneVis;
attribute vec3 color; attribute float aSize; attribute vec4 aInfo;
varying vec3 vCol;
void main(){
  float kind = aInfo.x;
  vec3 p = position;
  float g = 1.0;
  if (kind > 2.5 && kind < 4.5) {
    vec4 pl = kind < 3.5 ? uPlane[0] : uPlane[1];
    float c = cos(pl.w), s = sin(pl.w);
    p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z) + pl.xyz;
    g = kind < 3.5 ? uPlaneVis.x : uPlaneVis.y;
  } else if (kind > 4.5) {
    float a = uTime * 0.045;
    p += vec3(sin(a) * 55.0, 46.0 + sin(uTime * 0.3) * 2.0, -45.0 + cos(a) * 35.0);
  }
  float tw;
  if (aInfo.w < 0.5) tw = 0.6 + 0.4 * sin(uTime * aInfo.y + aInfo.z);
  else if (aInfo.w < 1.5) tw = step(0.9, fract(uTime * aInfo.y + aInfo.z));
  else tw = 1.0;
  if (kind > 0.5 && kind < 1.5) g *= 0.6 + 0.3 * uHype + 0.3 * uPulse;
  if (kind > 1.5 && kind < 2.5) g *= 1.0 + 0.12 * uPulse;
  vCol = color * tw * g;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(aSize * uPx / -mv.z, 1.6);
  gl_Position = projectionMatrix * mv;
}`;

const GLOW_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(1.0, 0.0, d);
  float a = core * core * 0.6 + smoothstep(0.45, 0.15, d) * 0.6;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol * a, 1.0);
}`;

/** Thêm một nhóm điểm sáng vào bộ đệm chung (sao/đèn/...). */
export interface GlowBuf { pos: number[]; col: number[]; size: number[]; info: number[] }
export function addGlow(b: GlowBuf, x: number, y: number, z: number, c: THREE.Color, k: number, size: number, info: [number, number, number, number]) {
  b.pos.push(x, y, z);
  b.col.push(c.r * k, c.g * k, c.b * k);
  b.size.push(size);
  b.info.push(...info);
}

export function createGlowBuf(): GlowBuf { return { pos: [], col: [], size: [], info: [] }; }

/** Tạo Points điểm sáng chung sau khi mọi khu đã thêm vào bộ đệm. */
export function buildGlowPoints(scene: THREE.Scene, uniforms: Uniforms, glow: GlowBuf): { dispose(): void } {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(glow.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(glow.col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(glow.size, 1));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(glow.info, 4));
  const m = new THREE.ShaderMaterial({
    uniforms, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 2;
  scene.add(p);
  return { dispose() { scene.remove(p); g.dispose(); m.dispose(); } };
}
