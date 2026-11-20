// P6: 8 chùm sáng additive giả (không Light thật, không bóng), quét theo beat, sáng theo hype.
import * as THREE from 'three';
import type { FrameState, Updatable } from '../core/types';

const N = 8;
const LEN = 60;

const vert = /* glsl */ `
varying vec2 vUv;
varying float vFres;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFres = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
varying float vFres;
void main() {
  // vUv.y: 1 ở đỉnh nón (nguồn), 0 ở đáy
  float along = pow(vUv.y, 1.3);
  float soft = pow(vFres, 1.5);
  float a = along * soft * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
}`;

export function createLights(scene: THREE.Scene): Updatable {
  const group = new THREE.Group();
  // Mở nón, đỉnh ở gốc, hướng -Y
  const geo = new THREE.CylinderGeometry(0.15, 3.4, LEN, 20, 1, true);
  geo.translate(0, -LEN / 2, 0);
  const beams: { pivot: THREE.Group; mat: THREE.ShaderMaterial; phase: number; base: THREE.Vector2 }[] = [];
  for (let i = 0; i < N; i++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    const pivot = new THREE.Group();
    const side = (i / (N - 1)) * 2 - 1; // -1..1
    pivot.position.set(side * 13, 9, -12 - (i % 2) * 6);
    pivot.add(mesh);
    group.add(pivot);
    beams.push({ pivot, mat, phase: i * 0.8, base: new THREE.Vector2(-side * 0.35, 0) });
  }
  scene.add(group);

  const colA = new THREE.Color();
  const colB = new THREE.Color();
  const cool = [new THREE.Color(0x3a7bff), new THREE.Color(0x9a4dff), new THREE.Color(0x2fd0ff)];
  const warm = [new THREE.Color(0xff3d9a), new THREE.Color(0xff9a3d), new THREE.Color(0xffd04d)];

  return {
    update(f: FrameState) {
      const phase = f.beat * Math.PI * 0.5; // một chu kỳ quét mỗi 4 phách
      const step = Math.floor(Math.max(0, f.beat) / 4);
      for (let i = 0; i < N; i++) {
        const b = beams[i]!;
        const s = Math.sin(phase + b.phase);
        const c = Math.cos(phase * 0.5 + b.phase);
        // Hướng về khán giả (-Z): xoay quanh X từ thẳng xuống tới ~ -Z
        b.pivot.rotation.x = 0.85 + 0.25 * s + f.beatPulse * 0.05;
        b.pivot.rotation.z = b.base.x + 0.55 * c;
        colA.copy(cool[(i + step) % 3]!);
        colB.copy(warm[(i + step) % 3]!);
        b.mat.uniforms.uColor!.value.copy(colA).lerp(colB, Math.min(1, f.hype * 1.2));
        const base = 0.3 + 0.35 * f.hype;
        b.mat.uniforms.uIntensity!.value = base * (0.8 + 0.5 * f.beatPulse) * (0.7 + 0.3 * (s * 0.5 + 0.5));
      }
    },
    dispose() {
      scene.remove(group);
      geo.dispose();
      for (const b of beams) b.mat.dispose();
    },
  };
}
