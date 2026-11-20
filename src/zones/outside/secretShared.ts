// Tiện ích chung cho các sự kiện bí mật (UFO / tên lửa / rồng).
import { groundYAtZ } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';

export interface SecretAct {
  readonly duration: number;
  start(): void;
  /** t = giây kể từ khi bắt đầu. */
  update(t: number, f: FrameState): void;
  stop(): void;
  dispose(): void;
  /** Điểm cần nhìn hiện tại (cho camera wide nhìn theo), ghi vào `out`. */
  focus?(t: number, out: THREE.Vector3): void;
}

/** Điểm nhìn chung của sự kiện đang chạy (secret hoặc máy bay kéo băng rôn); null khi rảnh. */
export const secretFocusState: { v: THREE.Vector3; active: boolean } = { v: new THREE.Vector3(), active: false };

/** Phát window CustomEvent 'cs-secret' { kind, phase }. */
export function emitSecret(kind: string, phase: 'start' | 'end'): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cs-secret', { detail: { kind, phase } }));
}

/** Mặt đất nền: y tại z (định nghĩa ở world/layout.ts). */
export const groundY = groundYAtZ;

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function seededRnd(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** Fragment shader điểm sáng tròn mềm (dùng với AdditiveBlending). */
export const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.004) discard;
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.0, r);
  a = a * a + 0.6 * smoothstep(0.35, 0.0, r);
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}`;

/** Points có buffer seed (vec4) + màu (vec3); chuyển động hoàn toàn trong vertex shader. */
export function makePoints(
  count: number,
  vert: string,
  uniforms: Record<string, THREE.IUniform>,
  fill: (i: number, seed: Float32Array, col: Float32Array) => void,
  opts: { additive?: boolean; frag?: string } = {},
) {
  const seed = new Float32Array(count * 4);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) fill(i, seed, col);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: opts.frag ?? SPARK_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

export const PALETTE = [0xff3d81, 0x35d0ff, 0xffd93d, 0x7cff6b, 0xb06bff, 0xff8a3d, 0xffffff].map((c) => new THREE.Color(c));

/** Kích thước điểm ~ chiều cao viewport (giống confetti.ts). */
export const pxScale = () => (typeof window !== 'undefined' ? window.innerHeight : 720);

export function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
  o.removeFromParent();
}
