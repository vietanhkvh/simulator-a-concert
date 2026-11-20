// Vật liệu "đồ chơi" cho đội quay phim: InstancedMesh + instanceColor, tô 2 bậc (bóng dịch về tím),
// rim sáng, 1 đốm highlight kem, viền ink bằng fresnel (+0 draw call, đúng guide cho mesh instanced).
import * as THREE from 'three';
import { INK, PAL, TOY, toColor } from '../../world/style';

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vN;
varying vec3 vCol;
varying vec3 vWP;
void main() {
  mat4 im = instanceMatrix;
  vec3 sc = vec3(dot(im[0].xyz, im[0].xyz), dot(im[1].xyz, im[1].xyz), dot(im[2].xyz, im[2].xyz));
  vN = normalize(mat3(modelMatrix) * (mat3(im) * (normal / max(sc, vec3(1e-6)))));
  vCol = instanceColor;
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uRim;
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vCol;
varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWP);
  float ndv = dot(N, V);
  if (ndv < 0.0) N = -N;
  float l = dot(N, uLight);
  float t = smoothstep(-0.1, 0.06, l);                                // ngưỡng mềm 2 bậc
  vec3 sh = vCol * vec3(0.55, 0.5, 0.78) + vec3(0.004, 0.0, 0.012);  // bóng dịch về tím, không về đen
  vec3 c = mix(sh, vCol, t);
  float rim = pow(1.0 - abs(ndv), 3.0);
  c += uRim * rim * ${TOY.rim.toFixed(2)};
  float hi = smoothstep(0.955, 0.985, dot(reflect(-uLight, N), V));
  c = mix(c, vec3(1.0), hi * ${TOY.hi.toFixed(2)});
  float edge = smoothstep(0.8, 0.93, 1.0 - abs(ndv));
  c = mix(c, uInk, edge * 0.85);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function createToonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uInk: { value: toColor(INK) },
        uRim: { value: toColor(PAL.cream[300]).lerp(toColor(PAL.grape[300]), 0.5) },
        uLight: { value: new THREE.Vector3(-0.4, 0.85, -0.35).normalize() },
      },
    ]),
    fog: true,
  });
}

/** Trụ bo tròn (lathe), bán kính 0,5, cao 1, tâm ở gốc: thay cho trụ cạnh sắc. */
export function roundedCylinder(segments = 16, bevel = 0.14): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -0.5)];
  const N = 4;
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI / 2 + (i / N) * (Math.PI / 2);
    pts.push(new THREE.Vector2(0.5 - bevel + Math.cos(a) * bevel, -0.5 + bevel + Math.sin(a) * bevel));
  }
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * (Math.PI / 2);
    pts.push(new THREE.Vector2(0.5 - bevel + Math.cos(a) * bevel, 0.5 - bevel + Math.sin(a) * bevel));
  }
  pts.push(new THREE.Vector2(0, 0.5));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}
