// "Mực & Sơn mài" · khe skyFeature (L5): ĐÈN TRỜI (đèn lồng giấy instanced, hướng về camera) thả từ 40 % Hype, thay cực quang;
// ≥ 80 % thêm mưa vàng quỳ (Points). Tổng 2 draw call, mọi chuyển động trong vertex shader (không ghi lại buffer mỗi frame).
// Có trễ: bật > 40 %, chỉ tắt < 37 %; mật độ + độ cao tăng theo Hype; độ sáng bị chặn để vùng lời hát vẫn đọc được.
import * as THREE from 'three';
import { STADIUM_CENTRE } from '../../../../world/layout';
import { auroraAmount, hexToRgb, RAMPS, smoothstep } from '../../../../world/style';
import type { OutsideBuildContext, OutsideBuilders, SkyFeatureHandle } from '../../builders';

const COUNT = 520, FLAKES = 650, RISE = 170;
const f = (x: number) => x.toFixed(4);
const rgb = (hex: number) => `vec3(${hexToRgb(hex).map(f).join(', ')})`;
const CX = f(STADIUM_CENTRE.x), CZ = f(STADIUM_CENTRE.z);

const L_VERT = /* glsl */ `
uniform float uTime; uniform float uAmt; uniform float uDense; uniform float uRise; uniform float uT0;
attribute vec4 aSeed;
varying vec2 vUv; varying float vA; varying float vWarm; varying float vPh;
float hh(float x){ return fract(sin(x * 91.3) * 43758.5453); }
void main(){
  vec4 s = aSeed;
  float inner = step(hh(s.x * 3.1), 0.3);
  float r = mix(95.0 + 90.0 * s.y, 32.0 + 45.0 * s.y, inner);
  float ang = (hh(s.z * 5.7) - 0.5) * mix(5.0, 6.2831, step(0.85, hh(s.y * 9.1)));
  float sp = 2.4 + 2.4 * hh(s.x * 7.7);
  float cyc = uTime * sp / ${f(RISE)} + s.z;
  float k = fract(cyc);
  float born = uTime - k * ${f(RISE)} / sp;
  float y0 = mix(8.0, -2.0, inner);
  float y = y0 + k * uRise * (0.7 + 0.5 * s.y);
  float sway = sin(uTime * 0.35 + s.z * 40.0) * 2.0 + sin(uTime * 0.13 + s.x * 17.0) * 3.5;
  vec3 p = vec3(${CX} + sin(ang) * r, y, ${CZ} - cos(ang) * r);
  p.xz += vec2(0.9, 0.35) * k * 40.0 + vec2(sway, sway * 0.6);
  float on = step(s.w, uDense) * step(uT0, born);
  vA = uAmt * on * smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.78, 1.0, k)) * (0.55 + 0.45 * hh(s.x * 13.0)) * 0.9;
  vWarm = hh(s.y * 21.0); vPh = s.z * 60.0; vUv = position.xy + 0.5;
  float size = (2.0 + 2.2 * hh(s.w * 17.0)) * mix(1.0, 0.55, inner);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * vec2(size * 0.8, size * 1.3);
  gl_Position = vA < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
}`;

const L_FRAG = () => {
  const A = RAMPS.amber!, G = RAMPS.gold!;
  return /* glsl */ `
uniform float uTime;
varying vec2 vUv; varying float vA; varying float vWarm; varying float vPh;
void main(){
  float x = (vUv.x - 0.5) * 2.0, y = vUv.y;
  float hw = (0.3 + 0.3 * smoothstep(0.14, 0.78, y)) * (1.0 - 0.85 * pow(smoothstep(0.8, 0.98, y), 2.0));
  float body = smoothstep(hw, hw - 0.1, abs(x)) * smoothstep(0.1, 0.2, y) * smoothstep(1.0, 0.92, y);
  float fl = 0.88 + 0.12 * sin(uTime * 7.0 + vPh);
  float flame = smoothstep(0.32, 0.0, length(vec2(x * 1.3, y - 0.17))) * fl;
  float halo = smoothstep(0.95, 0.0, length(vec2(x * 0.95, (y - 0.3) * 1.3))) * 0.22 * smoothstep(1.0, 0.8, abs(x)) * smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.85, y);
  float rib = 0.9 + 0.1 * sin(x * 22.0);
  vec3 shell = mix(${rgb(A[300])}, ${rgb(A[500])}, vWarm * 0.7);
  vec3 c = mix(${rgb(G[100])}, shell, smoothstep(0.15, 0.7, y)) * rib;
  vec3 rgbv = c * body * 1.15 + ${rgb(G[100])} * flame * 1.1 + ${rgb(A[500])} * halo;
  float a = clamp(body * 0.82 + flame * 0.9 + halo, 0.0, 1.0) * vA;
  gl_FragColor = vec4(rgbv * vA, a);
}`;
};

const F_VERT = /* glsl */ `
uniform float uTime; uniform float uPx; uniform float uGold;
attribute vec4 aSeed;
varying float vA; varying float vRot; varying float vTw;
float hh(float x){ return fract(sin(x * 91.3) * 43758.5453); }
void main(){
  vec4 s = aSeed;
  float r = 22.0 + 150.0 * sqrt(s.y);
  float ang = (hh(s.z * 5.7) - 0.5) * 5.6;
  float k = fract(s.z + uTime * (0.012 + 0.012 * hh(s.x * 3.3)));
  float y = 100.0 - k * 98.0;
  vec3 p = vec3(${CX} + sin(ang) * r + sin(uTime * 0.4 + s.x * 30.0) * 3.0, y, ${CZ} - cos(ang) * r + cos(uTime * 0.3 + s.w * 30.0) * 3.0);
  vA = uGold * smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.9, 1.0, k));
  vRot = s.x * 6.28; vTw = pow(0.5 + 0.5 * sin(uTime * (2.0 + 4.0 * s.w) + s.z * 90.0), 3.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = vA < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  gl_PointSize = clamp(uPx * (0.6 + 0.9 * s.w) / -mv.z, 2.0, 12.0);
}`;
const F_FRAG = () => /* glsl */ `
varying float vA; varying float vRot; varying float vTw;
void main(){
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  q = vec2(cos(vRot) * q.x - sin(vRot) * q.y, sin(vRot) * q.x + cos(vRot) * q.y);
  float sh = smoothstep(0.95, 0.6, abs(q.x) + abs(q.y) * 0.7 + 0.25 * q.x * q.y);
  if (sh < 0.02 || vA < 0.004) discard;
  vec3 c = mix(${rgb(RAMPS.gold![500]!)}, ${rgb(RAMPS.gold![100]!)}, vTw);
  gl_FragColor = vec4(c * sh * vA * (0.7 + 0.5 * vTw), sh * vA * 0.8);
}`;

export function createSkyLanterns(ctx: OutsideBuildContext): SkyFeatureHandle {
  const { scene, uniforms } = ctx;
  const rndSeed = (n: number, seed0: number) => {
    let s = seed0;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) a.set([rnd(), rnd(), rnd(), (i + rnd()) / n], i * 4);
    return a;
  };
  const q = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = q.index; geo.setAttribute('position', q.getAttribute('position'));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(rndSeed(COUNT, 20261), 4));
  geo.instanceCount = COUNT;
  const loc = { uAmt: { value: 0 }, uDense: { value: 0.2 }, uRise: { value: 60 }, uT0: { value: 1e9 }, uGold: { value: 0 } };
  const lMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime!, ...loc }, vertexShader: L_VERT, fragmentShader: L_FRAG(),
    transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const lanterns = new THREE.Mesh(geo, lMat);
  lanterns.frustumCulled = false; lanterns.renderOrder = -5; lanterns.visible = false;
  scene.add(lanterns);

  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLAKES * 3), 3));
  fGeo.setAttribute('aSeed', new THREE.BufferAttribute(rndSeed(FLAKES, 9137), 4));
  const fMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime!, uPx: uniforms.uPx!, uGold: loc.uGold }, vertexShader: F_VERT, fragmentShader: F_FRAG(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const flakes = new THREE.Points(fGeo, fMat);
  flakes.frustumCulled = false; flakes.renderOrder = -5; flakes.visible = false;
  scene.add(flakes);

  let on = false, goldOn = false, amt = 0, gold = 0, lastT = -1, dense = 0.2, rise = 60;
  return {
    update(fs, t) {
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const h = fs.hype;
      if (!on && h > 0.4) { on = true; if (amt < 0.01) loc.uT0.value = t - 16; } // thả đèn mới: đèn sinh ra sau mốc này
      else if (on && h < 0.37) on = false;
      const target = on ? Math.max(auroraAmount(h), 0.12) : 0;
      amt += Math.sign(target - amt) * Math.min(Math.abs(target - amt), dt / (target > amt ? 1.2 : 2.5));
      dense += (0.2 + 0.8 * smoothstep(0.45, 0.95, h) - dense) * Math.min(1, dt * 0.8);
      rise += (60 + 105 * smoothstep(0.4, 0.95, h) - rise) * Math.min(1, dt * 0.5);
      if (!goldOn && h > 0.8) goldOn = true; else if (goldOn && h < 0.76) goldOn = false;
      gold += ((goldOn ? 1 : 0) - gold) * Math.min(1, dt / 2);
      loc.uAmt.value = amt; loc.uDense.value = dense; loc.uRise.value = rise; loc.uGold.value = gold;
      lanterns.visible = amt > 0.003;
      flakes.visible = gold > 0.003;
    },
    dispose() {
      scene.remove(lanterns); scene.remove(flakes);
      geo.dispose(); q.dispose(); lMat.dispose(); fGeo.dispose(); fMat.dispose();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { skyFeature: createSkyLanterns };
