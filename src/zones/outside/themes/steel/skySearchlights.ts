// "Thép & Lửa" · khe skyFeature (v0): 8 ĐÈN RỌI hồ quang quét chéo lên TRẦN MÂY KHÓI THẤP thay cực quang khi
// Hype > 40 % (STYLE_C mục 3). 2 draw call: chùm rọi (8 quad quay mặt về camera) + đĩa mây (noise trong fragment,
// bụng mây hắt ember theo nhịp, ≥ 80 % ửng blood). Cường độ = auroraAmount(h).
import * as THREE from 'three';
import { STADIUM_CENTRE, STANDS_R_OUTER, STANDS_TOP_Y } from '../../../../world/layout';
import { auroraAmount, hexToRgb, RAMPS, smoothstep } from '../../../../world/style';
import type { OutsideBuildContext, OutsideBuilders, SkyFeatureHandle } from '../../builders';

const BEAMS = 8;
const CEIL_Y = 96, CEIL_R = 178;
const g = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;

const BEAM_VERT = /* glsl */ `
uniform vec3 uOrg[${BEAMS}]; uniform vec3 uDir[${BEAMS}]; uniform float uLen[${BEAMS}];
attribute float aBeam;
varying vec2 vUv;
void main() {
  int i = int(aBeam + 0.5);
  vec3 o = uOrg[i], d = uDir[i];
  float v = uv.y;
  vec3 c = o + d * (v * uLen[i]);
  vec3 side = normalize(cross(d, cameraPosition - c));
  float w = mix(1.1, 9.0, v);
  vec3 p = c + side * (uv.x - 0.5) * w;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const beamFrag = () => /* glsl */ `
uniform float uAmt;
varying vec2 vUv;
void main() {
  float x = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float prof = x * x * (0.55 + 0.45 * x);
  float along = smoothstep(0.0, 0.04, vUv.y) * mix(1.0, 0.28, vUv.y);
  vec3 col = mix(${g(RAMPS.arc![500])}, ${g(RAMPS.arc![700])}, vUv.y * 0.7);
  gl_FragColor = vec4(col * prof * along * uAmt * 0.5, 1.0);
}`;

const CLOUD_VERT = /* glsl */ `
varying vec3 vW;
void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`;
const cloudFrag = () => /* glsl */ `
uniform float uTime; uniform float uAmt; uniform float uHot; uniform float uPulse; uniform vec3 uHit[${BEAMS}];
varying vec3 vW;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 p = vW.xz * 0.018 + vec2(uTime * 0.012, uTime * 0.007);
  float n = vn(p) * 0.55 + vn(p * 2.1 + 3.7) * 0.3 + vn(p * 4.3 - 1.9) * 0.15;
  float dens = smoothstep(0.38, 0.72, n);
  float r = length(vW.xz - vec2(${STADIUM_CENTRE.x.toFixed(1)}, ${STADIUM_CENTRE.z.toFixed(1)})) / ${CEIL_R.toFixed(1)};
  float edge = 1.0 - smoothstep(0.55, 1.0, r);
  // bụng mây: thép tối, hắt than hồng từ sân lên (mạnh ở giữa, đập theo phách); Hype ≥ 80 %: ửng huyết
  float under = (1.0 - smoothstep(0.0, 0.75, r)) * (0.55 + 0.45 * uPulse);
  vec3 col = mix(${g(RAMPS.coal![300])}, ${g(RAMPS.steel![700])}, n);
  col += mix(${g(RAMPS.ember![700])}, ${g(RAMPS.ember![500])}, uPulse * 0.6 + uHot * 0.4) * under * (0.55 + 0.9 * uHot);
  col = mix(col, ${g(RAMPS.blood![500])} * 1.25, uHot * 0.4 * dens);
  // vệt đèn rọi chạm trần mây
  float spot = 0.0;
  for (int i = 0; i < ${BEAMS}; i++) { vec2 d = vW.xz - uHit[i].xz; spot += exp(-dot(d, d) / 190.0); }
  col += ${g(RAMPS.arc![500])} * spot * (0.35 + 0.5 * dens);
  float a = uAmt * edge * (0.22 + 0.6 * dens + 0.35 * min(spot, 1.0));
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
}`;

export function createSkySearchlights(ctx: OutsideBuildContext): SkyFeatureHandle {
  const { scene, uniforms } = ctx;
  // chùm rọi: mỗi chùm 1 quad (uv.y dọc chùm); vị trí thật tính trong vertex shader
  const pos: number[] = [], uv: number[] = [], beam: number[] = [], idx: number[] = [];
  for (let b = 0; b < BEAMS; b++) {
    const k = b * 4;
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { pos.push(0, 0, 0); uv.push(u!, v!); beam.push(b); }
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  beamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  beamGeo.setAttribute('aBeam', new THREE.Float32BufferAttribute(beam, 1));
  beamGeo.setIndex(idx);
  const org = Array.from({ length: BEAMS }, (_, i) => {
    const a = ((i + 0.5) / BEAMS - 0.5) * 1.3 * Math.PI; // rải trên vành khán đài phía trước ca sĩ
    return new THREE.Vector3(STADIUM_CENTRE.x + Math.sin(a) * (STANDS_R_OUTER - 4), STANDS_TOP_Y + 1, STADIUM_CENTRE.z - Math.cos(a) * (STANDS_R_OUTER - 4));
  });
  const dir = org.map(() => new THREE.Vector3(0, 1, 0));
  const hit = org.map((o) => o.clone());
  const len = { value: org.map(() => 1) };
  const amt = { value: 0 };
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uOrg: { value: org }, uDir: { value: dir }, uLen: len, uAmt: amt },
    vertexShader: BEAM_VERT, fragmentShader: beamFrag(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const beams = new THREE.Mesh(beamGeo, beamMat);
  beams.frustumCulled = false;
  beams.renderOrder = -5;

  const cloudGeo = new THREE.CircleGeometry(CEIL_R, 48);
  cloudGeo.rotateX(Math.PI / 2); // mặt nhìn xuống
  cloudGeo.translate(STADIUM_CENTRE.x, CEIL_Y, STADIUM_CENTRE.z);
  const hot = { value: 0 };
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime!, uPulse: uniforms.uPulse!, uAmt: amt, uHot: hot, uHit: { value: hit } },
    vertexShader: CLOUD_VERT, fragmentShader: cloudFrag(),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  clouds.frustumCulled = false;
  clouds.renderOrder = -5;
  const group = new THREE.Group();
  group.add(clouds, beams);
  group.visible = false;
  scene.add(group);

  const centre = new THREE.Vector3(STADIUM_CENTRE.x, 0, STADIUM_CENTRE.z);
  let a = 0, lastT = -1;
  return {
    update(f, t) {
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const target = auroraAmount(f.hype);
      a += Math.sign(target - a) * Math.min(Math.abs(target - a), dt / (target > a ? 0.6 : 1.4)); // "sập đèn → bật"
      amt.value = a;
      hot.value = smoothstep(0.78, 0.95, f.hype);
      group.visible = a > 0.003;
      if (!group.visible) return;
      for (let i = 0; i < BEAMS; i++) {
        const o = org[i]!, d = dir[i]!;
        // quét chéo: nghiêng vào trong sân 18–46° so với phương đứng, lắc ngang ±0,7 rad
        const sw = Math.sin(t * (0.21 + 0.035 * i) + i * 1.7) * 0.7 + Math.sin(t * 0.09 + i) * 0.25;
        const tilt = 0.32 + 0.24 * (0.5 + 0.5 * Math.sin(t * (0.16 + 0.02 * i) + i * 2.3));
        const inX = centre.x - o.x, inZ = centre.z - o.z, il = Math.hypot(inX, inZ) || 1;
        const cs = Math.cos(sw), sn = Math.sin(sw);
        const hx = (inX * cs - inZ * sn) / il, hz = (inX * sn + inZ * cs) / il;
        d.set(hx * Math.sin(tilt), Math.cos(tilt), hz * Math.sin(tilt));
        const L = (CEIL_Y - o.y) / d.y;
        len.value[i] = L;
        hit[i]!.copy(o).addScaledVector(d, L);
      }
    },
    dispose() { scene.remove(group); beamGeo.dispose(); beamMat.dispose(); cloudGeo.dispose(); cloudMat.dispose(); },
  };
}

export const builders: Partial<OutsideBuilders> = { skyFeature: createSkySearchlights };
