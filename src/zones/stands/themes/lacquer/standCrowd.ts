// "Mực & Sơn mài" — khán giả khán đài (gói L4, khe stands `standCrowd`): đốm đèn lồng ấm (đỏ / cam / sen hồng),
// cùng bố cục chấm như stadium.ts mặc định (1 THREE.Points, hoạt ảnh trong shader), màu Hype của phong cách.
// 'cs-interact': cheer = ánh vàng chạy vòng · wave = dải đèn giơ cao · heart = 3 hoa SEN ghép bằng đốm ·
// flash = đốm nến trắng · pyro = mưa vàng lá lấp lánh.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { STADIUM_CENTRE, STANDS_ARC, STANDS_TIERS } from '../../../../world/layout';
import { PAL, hexToRgb, hypeColors } from '../../../../world/style';
import type { StandsBuilders, StandCrowdHandle } from '../../builders';

const VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uPhase; uniform float uRes;
uniform vec3 uHA; uniform vec3 uHB; uniform vec3 uHC;
uniform vec3 uRed; uniform vec3 uAmber; uniform vec3 uLotus; uniform vec3 uGold; uniform vec3 uGoldHi; uniform vec3 uJade;
uniform vec3 uCandle; uniform vec3 uDim;
uniform float uCheer; uniform float uCheerAge; uniform float uWave; uniform float uWavePos;
uniform float uHeart; uniform float uHeartAge; uniform float uFlash; uniform float uPyro; uniform float uPyroAge;
attribute vec2 aSeed;
varying vec3 vCol; varying float vShape;
float h11(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float lotusIn(vec2 q){
  vec2 c = q - vec2(0.0, -0.55);
  float a = atan(c.x, c.y);
  float r = 1.35 * (0.5 + 0.5 * pow(abs(cos(a * 2.5)), 0.8));
  float petals = step(length(c), r) * step(abs(a), 1.75) * step(0.18, abs(cos(a * 2.5)) + step(length(c), 0.45));
  float bowl = step(length((q - vec2(0.0, -0.62)) * vec2(0.8, 2.6)), 1.0);
  return max(petals, bowl);
}
void main(){
  float sd = aSeed.x, ang = aSeed.y;
  vec3 p = position;
  float sway = sin(uPhase * 3.14159 * 0.5 + sd * 1.2 + ang * 6.0) * (0.12 + 0.3 * uHype);
  p.x += sway * cos(ang * 4.5);
  p.z += sway * sin(ang * 4.5) * 0.5;
  p.y += 0.25 * uHype * smoothstep(0.6, 1.0, uHype) * step(0.4, sd);
  float pick = fract(sd * 7.13);
  vec3 own = pick < 0.55 ? uRed : (pick < 0.82 ? uAmber : uLotus);
  float w = 0.5 + 0.5 * sin(ang * 26.0 - uTime * 1.1 + uPhase * 0.25);
  vec3 group = mix(uHA, uHB, w);
  float u = smoothstep(0.4, 0.9, uHype);
  vec3 c = mix(own, group, u * 0.8);
  c = mix(c, uHC, step(0.92, fract(sd * 23.1)) * smoothstep(0.8, 1.0, uHype) * 0.6);
  float fly = 0.55 + 0.45 * sin(uTime * (0.8 + sd * 1.6) + sd * 40.0); // đom đóm chậm
  float b = mix(fly, 0.85 + 0.15 * w, u * 0.8) * (0.6 + 0.4 * uHype + 0.15 * uPulse);
  float lit = step(mix(0.75, 0.1, smoothstep(0.0, 0.55, uHype)), fract(sd * 13.7));
  vec3 col = mix(uDim * 0.5, c * b, lit);
  col *= step(0.06, fract(sd * 13.7));
  float sz = mix(1.6, 3.0, lit) + 0.8 * fract(sd * 91.7);
  float y = position.y;
  float da = abs(ang - 0.5) * 2.0;
  vShape = lit;
  if (uFlash > 0.001) {
    float ph = step(0.45, fract(sd * 31.7));
    float tk = 0.75 + 0.25 * sin(uTime * (1.5 + sd * 2.0) + sd * 91.0);
    col = mix(col, mix(col * 0.25, uCandle * tk, ph), uFlash);
    sz = mix(sz, mix(sz, 2.2, ph), uFlash);
  }
  if (uWave > 0.001) {
    float dd = ang - uWavePos;
    float sf = dd > 0.0 ? 0.022 : 0.04;
    float crest = exp(-dd * dd / (sf * sf));
    vec3 wc = mix(uJade * 0.35, mix(uGold, uGoldHi, crest), smoothstep(0.05, 0.6, crest));
    col = mix(col, wc * step(0.05, fract(sd * 13.7)), uWave);
    p.y += uWave * crest * 3.5;
    sz += uWave * crest * 2.2;
  }
  if (uHeart > 0.001) {
    float th = 0.5 + 0.5 * sin(uHeartAge * 3.0);
    float a = (ang - 0.5) * 2.0 * 2.2619;
    float hx = min(min(abs(a), abs(a - 1.15)), abs(a + 1.15)) * 100.0;
    float s = 0.92 + 0.08 * th;
    float inL = lotusIn(vec2(hx / (28.0 * s), (y - 19.5) / (12.0 * s)));
    vec3 lc = mix(uLotus * (0.08 + 0.06 * th), mix(uLotus, uGold, 0.2 * th) * 0.75, inL);
    col = mix(col, lc, uHeart);
    sz += uHeart * inL * 0.6;
  }
  if (uPyro > 0.001) {
    float fall = fract(y * 0.045 + uPyroAge * 0.55 + h11(floor(ang * 60.0)) * 0.3);
    float leaf = exp(-fall * 9.0) * step(0.45, fract(sd * 17.3));
    float sh = 0.6 + 0.4 * sin(uTime * 17.0 + sd * 70.0);
    col = mix(col, uGold * (0.35 + 0.2 * sh), uPyro * 0.5) + uGoldHi * leaf * sh * 0.7 * uPyro;
    sz += uPyro * leaf * 1.2;
  }
  if (uCheer > 0.001) {
    float r = fract(uCheerAge * 0.7);
    float race = exp(-pow((da - r) * 6.0, 2.0));
    float fk = step(0.5, h11(floor(uTime * 10.0) + sd * 311.0));
    col = mix(col, uGold * (0.4 + 0.25 * fk), uCheer * 0.6) + uGoldHi * race * 0.5 * uCheer;
    p.y += uCheer * race * 1.2;
    sz += uCheer * (0.3 * fk + 1.2 * race);
  }
  vCol = col;
  gl_PointSize = sz * uRes;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = /* glsl */ `
varying vec3 vCol; varying float vShape;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = length(q);
  if (d > 1.0) discard;
  float core = smoothstep(0.62, 0.35, length(q * vec2(1.0, 0.85)));
  float halo = pow(1.0 - d, 2.0) * 0.55;
  vec3 c = vCol * (core + halo) + vec3(1.0, 0.92, 0.75) * smoothstep(0.25, 0.0, d) * 0.25 * vShape * dot(vCol, vec3(0.33));
  gl_FragColor = vec4(c, 1.0);
}`;

export function createLacquerStandCrowd(ctx: Parameters<NonNullable<StandsBuilders['standCrowd']>>[0]): StandCrowdHandle {
  const { scene } = ctx;
  const uniforms = ctx.uniforms as Record<string, { value: unknown }>;
  const CX = STADIUM_CENTRE.x, CZ = STADIUM_CENTRE.z, A0 = STANDS_ARC.from, A1 = STANDS_ARC.to, TIERS = STANDS_TIERS, SECTIONS = 8;
  const P = (r: number, a: number, y: number) => [CX + Math.sin(a) * r, y, CZ - Math.cos(a) * r];
  const COUNT = 26000;
  const cp = new Float32Array(COUNT * 3), cs = new Float32Array(COUNT * 2);
  const areas = TIERS.map((T) => (T.r1 - T.r0) * (T.r0 + T.r1) / 2);
  const tot = areas.reduce((s, v) => s + v, 0);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < COUNT; i++) {
    let pick = rnd() * tot, ti = 0;
    while (ti < TIERS.length - 1 && pick > areas[ti]!) { pick -= areas[ti]!; ti++; }
    const T = TIERS[ti]!;
    const rows = Math.round((T.r1 - T.r0) / 0.9);
    const row = Math.floor(rnd() * rows);
    const f = (row + 0.5) / rows;
    const r = T.r0 + 0.5 + f * (T.r1 - T.r0 - 1);
    const y = T.y0 + 0.14 + f * (T.y1 - T.y0) + 1.0 + rnd() * 0.3;
    let u = 0.01 + rnd() * 0.98;
    for (let k = 1; k < SECTIONS; k++) {
      const du = u - k / SECTIONS, lim = 1.2 / (r * (A1 - A0));
      if (Math.abs(du) < lim) u = k / SECTIONS + Math.sign(du || 1) * lim * (1 + rnd());
    }
    cp.set(P(r, A0 + (A1 - A0) * u, y), i * 3);
    cs[i * 2] = rnd(); cs[i * 2 + 1] = u;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(cs, 2));
  const v3 = (hex: number) => new THREE.Vector3(...hexToRgb(hex));
  const lotus = v3(PAL.berry[300]).lerp(v3(PAL.berry[100]), 0.45);
  const fxU = {
    uCheer: { value: 0 }, uCheerAge: { value: 99 }, uWave: { value: 0 }, uWavePos: { value: -1 },
    uHeart: { value: 0 }, uHeartAge: { value: 99 }, uFlash: { value: 0 }, uPyro: { value: 0 }, uPyroAge: { value: 99 },
    uHA: { value: new THREE.Vector3() }, uHB: { value: new THREE.Vector3() }, uHC: { value: new THREE.Vector3() },
    uRed: { value: v3(PAL.berry[500]) }, uAmber: { value: v3(PAL.peach[500]) }, uLotus: { value: lotus },
    uGold: { value: v3(PAL.honey[500]) }, uGoldHi: { value: v3(PAL.honey[100]) }, uJade: { value: v3(PAL.mint[500]) },
    uCandle: { value: v3(PAL.cream[100]) }, uDim: { value: v3(PAL.night[100]) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRes: { value: 1 }, uPhase: { value: 0 }, uPulse: { value: 0 }, uTime: { value: 0 }, uHype: { value: 0 }, ...uniforms, ...fxU },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 1;
  pts.name = 'standCrowd-lacquer';
  scene.add(pts);

  const age = { cheer: 99, wave: 99, heart: 99, pyro: 99 };
  let flashOn = false, waveModeOn = false, lastT = -1, lastReal = performance.now(), waveLap = 0;
  const onInteract = (e: Event) => {
    const d = (e as CustomEvent).detail as { kind?: string; on?: boolean } | undefined;
    if (!d) return;
    if (d.kind === 'cheer') age.cheer = 0;
    else if (d.kind === 'heart') age.heart = 0;
    else if (d.kind === 'pyro') age.pyro = 0;
    else if (d.kind === 'flash') flashOn = d.on ?? !flashOn;
    else if (d.kind === 'wave') { if (fxU.uWave.value < 0.05) waveLap = 0; age.wave = 0; }
  };
  window.addEventListener('cs-interact', onInteract);
  const env = (a: number, dur: number, fin: number, fout: number) => Math.max(0, Math.min(1, a / fin, (dur - a) / fout));
  const ease = (v: number, target: number, rate: number) => v + Math.max(-rate, Math.min(rate, target - v));
  pts.onBeforeRender = () => {
    const now = performance.now();
    const t = (mat.uniforms.uTime!.value as number) ?? now / 1000;
    const hype = (mat.uniforms.uHype!.value as number) ?? 0;
    let dt = t - lastT;
    if (lastT < 0 || dt <= 0 || dt > 0.5) dt = Math.min(0.1, (now - lastReal) / 1000);
    lastT = t; lastReal = now;
    const hc = hypeColors(hype);
    fxU.uHA.value.set(...hc.primary); fxU.uHB.value.set(...hc.secondary); fxU.uHC.value.set(...hc.accent);
    age.cheer += dt; age.wave += dt; age.heart += dt; age.pyro += dt;
    fxU.uCheer.value = env(age.cheer, 2.8, 0.15, 1.0); fxU.uCheerAge.value = age.cheer;
    fxU.uHeart.value = env(age.heart, 4.4, 0.4, 1.1); fxU.uHeartAge.value = age.heart;
    fxU.uPyro.value = env(age.pyro, 3.6, 0.15, 1.1); fxU.uPyroAge.value = age.pyro;
    fxU.uFlash.value = ease(fxU.uFlash.value, flashOn ? 1 : 0, dt / 0.9);
    const waveOn = waveModeOn || age.wave < 6;
    fxU.uWave.value = ease(fxU.uWave.value, waveOn ? 1 : 0, dt / 0.9);
    if (fxU.uWave.value > 0) waveLap += dt / 3.6; else waveLap = 0;
    fxU.uWavePos.value = (waveLap % 1) * 1.3 - 0.15;
  };
  return {
    update(f: FrameState) { waveModeOn = f.waveMode === 1; },
    dispose() {
      window.removeEventListener('cs-interact', onInteract);
      scene.remove(pts);
      geo.dispose(); mat.dispose();
    },
  };
}

export const builders: Partial<StandsBuilders> = { standCrowd: createLacquerStandCrowd };
