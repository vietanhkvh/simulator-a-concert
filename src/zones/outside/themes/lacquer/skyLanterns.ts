// "Mực & Sơn mài" · khe skyFeature (v0): THẢ ĐÈN TRỜI thay cực quang khi Hype > 40 % (STYLE_B2 mục 3).
// Một Points duy nhất (1 draw call): 400 đèn trôi lên trong vertex shader; mật độ 150 → 400 theo auroraAmount(h).
import * as THREE from 'three';
import { STADIUM_CENTRE, STANDS_TOP_Y } from '../../../../world/layout';
import { auroraAmount, hexToRgb, RAMPS, smoothstep } from '../../../../world/style';
import type { OutsideBuildContext, OutsideBuilders, SkyFeatureHandle } from '../../builders';

const COUNT = 400;
/** Phần đèn luôn có khi vừa qua 40 % (150 / 400). */
const BASE_FRAC = 150 / COUNT;
const Y0 = STANDS_TOP_Y - 14, RISE = 150;

const VERT = /* glsl */ `
uniform float uTime; uniform float uPx; uniform float uAmt; uniform float uDense; uniform float uPulse;
attribute vec4 aSeed; // góc (0..1), bán kính (0..1), pha, thứ hạng (0..1)
varying float vA; varying float vFlick; varying float vWarm;
void main() {
  float ang = (aSeed.x - 0.5) * 6.2831853;
  float r = mix(58.0, 172.0, sqrt(aSeed.y));
  float sp = 2.2 + 2.6 * fract(aSeed.z * 7.31);
  float k = fract(aSeed.z + uTime * sp / ${RISE.toFixed(1)});
  float y = ${Y0.toFixed(1)} + k * ${RISE.toFixed(1)};
  float sway = sin(uTime * 0.35 + aSeed.z * 40.0) * 2.5 + sin(uTime * 0.13 + aSeed.x * 17.0) * 4.0;
  vec3 p = vec3(${STADIUM_CENTRE.x.toFixed(1)} + sin(ang) * r + sway, y, ${STADIUM_CENTRE.z.toFixed(1)} - cos(ang) * r + sway * 0.6);
  float on = step(aSeed.w, uDense);
  vA = uAmt * on * smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.8, 1.0, k));
  vFlick = 0.82 + 0.18 * sin(uTime * (5.0 + 4.0 * aSeed.x) + aSeed.z * 90.0) + 0.1 * uPulse;
  vWarm = fract(aSeed.w * 13.7);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = 5.0 + 3.0 * fract(aSeed.y * 5.3);
  gl_PointSize = vA < 0.004 ? 0.0 : clamp(uPx * size / -mv.z, 2.0, 96.0);
}`;

const frag = () => {
  const g = (hex: number) => `vec3(${hexToRgb(hex).map((x) => x.toFixed(4)).join(', ')})`;
  const amber = RAMPS.amber!, gold = RAMPS.gold!, son = RAMPS.son!;
  return /* glsl */ `
varying float vA; varying float vFlick; varying float vWarm;
void main() {
  if (vA < 0.004) discard;
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  // thân đèn: hình trụ bo (cao hơn rộng), miệng dưới sáng hơn; quầng cam mềm bao quanh
  float body = smoothstep(0.42, 0.3, length(vec2(q.x * 1.25, q.y * 0.95 + 0.05)));
  float mouth = smoothstep(0.3, 0.0, length(vec2(q.x * 1.6, q.y - 0.28)));
  float halo = smoothstep(1.0, 0.0, length(q));
  vec3 shell = mix(${g(amber[500])}, ${g(son[300])}, vWarm * 0.45);
  vec3 col = shell * body * (0.75 + 0.25 * (0.5 - q.y)) + ${g(gold[100])} * mouth * body * 0.9 + ${g(amber[700])} * halo * halo * 0.55;
  gl_FragColor = vec4(col * vA * vFlick, 1.0);
}`;
};

export function createSkyLanterns(ctx: OutsideBuildContext): SkyFeatureHandle {
  const { scene, uniforms } = ctx;
  const seed = new Float32Array(COUNT * 4);
  let s = 20261;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < COUNT; i++) seed.set([rnd(), rnd(), rnd(), i / COUNT], i * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const loc = { uAmt: { value: 0 }, uDense: { value: BASE_FRAC } };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime!, uPx: uniforms.uPx!, uPulse: uniforms.uPulse!, ...loc },
    vertexShader: VERT, fragmentShader: frag(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -5; // cùng chỗ với cực quang: sau sao, trước điểm sáng khán đài
  pts.visible = false;
  scene.add(pts);

  let amt = 0, lastT = -1;
  return {
    update(f, t) {
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const target = auroraAmount(f.hype);
      amt += Math.sign(target - amt) * Math.min(Math.abs(target - amt), dt / (target > amt ? 1.2 : 2.0));
      loc.uAmt.value = amt;
      loc.uDense.value = BASE_FRAC + (1 - BASE_FRAC) * smoothstep(0.55, 0.95, f.hype);
      pts.visible = amt > 0.003;
    },
    dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); },
  };
}

export const builders: Partial<OutsideBuilders> = { skyFeature: createSkyLanterns };
