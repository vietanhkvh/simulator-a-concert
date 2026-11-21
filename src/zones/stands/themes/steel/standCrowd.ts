// "Thép & Lửa" — khán giả khán đài (gói S3, khe stands `standCrowd`): đốm ĐIỆN THOẠI trắng lạnh + đốm BẬT LỬA ấm,
// cùng bố cục chấm như stadium.ts mặc định (1 THREE.Points, hoạt ảnh trong shader), màu tungsten / hồ quang theo Hype.
// 'cs-interact': cheer = gợn chớp trắng chạy vòng (≤ 3 chớp/s) · wave = dải nắm đấm/đèn giơ cao màu tungsten ·
// heart = TIA SÉT khổng lồ ghép bằng đốm · flash = biển đèn điện thoại · pyro = quầng lửa đỏ-cam tràn từ phía sân khấu.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { STADIUM_CENTRE, STANDS_ARC, STANDS_TIERS } from '../../../../world/layout';
import { PAL, RAMPS, hexToRgb, hypeColors } from '../../../../world/style';
import { viewHeightPx } from '../../../../world/shared/viewport';
import type { StandsBuilders, StandCrowdHandle } from '../../builders';

const VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uPhase; uniform float uRes;
uniform vec3 uHA; uniform vec3 uHB; uniform vec3 uHC;
uniform vec3 uPhone; uniform vec3 uLighter; uniform vec3 uTung; uniform vec3 uFire; uniform vec3 uBlood; uniform vec3 uHot; uniform vec3 uDim;
uniform float uCheer; uniform float uCheerAge; uniform float uWave; uniform float uWavePos;
uniform float uHeart; uniform float uHeartAge; uniform float uFlash; uniform float uPyro; uniform float uPyroAge;
attribute vec2 aSeed;
varying vec3 vCol; varying float vShape;
float h11(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float boltIn(vec2 q){
  float top = step(0.0, q.y) * step(q.y, 1.0) * step(abs(q.x - (0.1 + 0.35 * q.y)), 0.22);
  float bot = step(-1.0, q.y) * step(q.y, 0.1) * step(abs(q.x - (-0.1 + 0.35 * q.y)), 0.2 * (q.y + 1.0));
  float bar = step(abs(q.y - 0.05), 0.1) * step(-0.38, q.x) * step(q.x, 0.48);
  return max(max(top, bot), bar);
}
void main(){
  float sd = aSeed.x, ang = aSeed.y;
  vec3 p = position;
  float sway = sin(uPhase * 3.14159 * 0.5 + sd * 1.2 + ang * 6.0) * (0.08 + 0.25 * uHype);
  p.x += sway * cos(ang * 4.5);
  p.z += sway * sin(ang * 4.5) * 0.5;
  // nhịp nặng: giơ đèn lên theo phách khi Hype cao
  p.y += 0.3 * uPulse * smoothstep(0.6, 1.0, uHype) * step(0.4, sd);
  float pick = fract(sd * 7.13);
  float isPhone = step(pick, 0.62);
  vec3 own = isPhone > 0.5 ? uPhone : uLighter;
  float w = 0.5 + 0.5 * sin(ang * 26.0 - uTime * 1.1 + uPhase * 0.25);
  vec3 group = mix(uHA, uHB, w);
  float u = smoothstep(0.4, 0.9, uHype);
  vec3 c = mix(own, mix(own, group, 0.7), u * (1.0 - 0.6 * isPhone));
  c = mix(c, uHC, step(0.92, fract(sd * 23.1)) * smoothstep(0.8, 1.0, uHype) * 0.5);
  float tk = isPhone > 0.5 ? 0.85 + 0.15 * sin(uTime * (0.8 + sd) + sd * 40.0)
                           : 0.7 + 0.3 * step(0.5, h11(floor(uTime * 9.0) + sd * 91.0));
  float b = tk * (0.55 + 0.45 * uHype + 0.15 * uPulse);
  // tỉ lệ đốm sáng theo trạng thái Hype: 15 % → 55 % → 100 %
  float frac = uHype < 0.4 ? mix(0.27, 0.36, uHype / 0.4) : (uHype < 0.8 ? mix(0.36, 0.6, (uHype - 0.4) / 0.4) : mix(0.6, 0.85, (uHype - 0.8) / 0.2));
  float lit = step(1.0 - frac, fract(sd * 13.7));
  vec3 col = c * b * lit;
  col *= step(0.06, fract(sd * 13.7));
  float sz = (isPhone > 0.5 ? 2.8 : 2.4) + 0.7 * fract(sd * 91.7);
  float y = position.y;
  float da = abs(ang - 0.5) * 2.0;
  vShape = lit * (1.0 - isPhone) ;
  if (uFlash > 0.001) {
    float ph = step(0.25, fract(sd * 31.7));
    float pt = 0.8 + 0.2 * sin(uTime * (1.2 + sd * 2.0) + sd * 91.0);
    vec3 sea = mix(uLighter * pt, uPhone * pt * 1.1, step(0.2, fract(sd * 5.7)));
    col = mix(col, mix(col * 0.2, sea * 1.5, ph), uFlash);
    sz = mix(sz, mix(sz, 3.4, ph), uFlash);
  }
  if (uWave > 0.001) {
    float dd = ang - uWavePos;
    float sf = dd > 0.0 ? 0.02 : 0.035;
    float crest = exp(-dd * dd / (sf * sf));
    vec3 wc = mix(uTung, uHot, crest * crest * 0.25) * 1.1;
    col = mix(col, mix(col * 0.6, wc, smoothstep(0.05, 0.6, crest)), uWave);
    p.y += uWave * crest * 3.0;
    sz += uWave * crest * 2.0;
  }
  if (uHeart > 0.001) {
    float th = 0.5 + 0.5 * sin(uHeartAge * 6.0);
    float a = (ang - 0.5) * 2.0 * 2.2619 * 100.0;
    float s = 0.95 + 0.05 * th;
    float inB = boltIn(vec2(a / (75.0 * s), (y - 19.5) / (13.0 * s)));
    vec3 bc = mix(col * 0.2, mix(uHot, vec3(1.0), 0.3 * th) * 1.3, inB);
    col = mix(col, bc, uHeart);
    sz += uHeart * inB * 1.6;
  }
  if (uPyro > 0.001) {
    // quầng lửa tràn từ phía sân khấu (gốc tọa độ) ra ngoài; viền sóng sáng hơn
    float r = length(position.xz);
    float front = 55.0 + uPyroAge * 80.0;
    float wash = smoothstep(front, front - 30.0, r);
    float edge = exp(-pow((r - front + 6.0) / 8.0, 2.0));
    float fk = 0.75 + 0.25 * sin(uTime * 13.0 + sd * 60.0);
    vec3 fc = mix(uBlood, uFire, 0.5 + 0.5 * edge) * fk;
    col = mix(col, col * 0.3 + fc * (0.8 + 0.8 * edge), uPyro * wash);
    sz += uPyro * wash * (0.4 + 1.0 * edge);
  }
  if (uCheer > 0.001) {
    // gợn chớp trắng chạy vòng; chớp ≤ 3 lần/giây
    float r = fract(uCheerAge * 0.8);
    float race = exp(-pow((da - r) * 7.0, 2.0));
    float strobe = step(0.62, fract(uTime * 2.8 + floor(ang * 12.0) * 0.13));
    col = mix(col, uPhone * (0.35 + 0.65 * strobe), uCheer * race);
    p.y += uCheer * race * 0.8;
    sz += uCheer * race * (0.6 + 1.2 * strobe);
  }
  vCol = col;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // xa hơn → đốm to hơn chút để không biến mất
  gl_PointSize = sz * uRes * (1.0 + 0.7 * clamp((-mv.z - 40.0) / 100.0, 0.0, 1.0));
  gl_Position = projectionMatrix * mv;
}`;
const BODY_VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPhase; uniform float uPx; uniform float uRes;
uniform vec3 uBodyA; uniform vec3 uBodyB; uniform vec3 uFire; uniform vec3 uBlood;
uniform float uPyro; uniform float uPyroAge; uniform float uWave; uniform float uWavePos;
attribute vec2 aSeed;
varying vec3 vCol;
void main(){
  float sd = aSeed.x, ang = aSeed.y;
  vec3 p = position;
  p.y += sin(uPhase * 3.14159 * 0.5 + sd * 3.0 + ang * 9.0) * 0.08 * (0.3 + uHype);
  float k = fract(sd * 5.31);
  vec3 c = k < 0.45 ? uBodyA * 0.8 : (k < 0.75 ? uBodyB : uBodyA * 0.55);
  c *= 0.75 + 0.35 * fract(sd * 17.9);
  if (uWave > 0.001) { float dd = ang - uWavePos; p.y += uWave * exp(-dd * dd / 0.0009) * 2.0; }
  if (uPyro > 0.001) {
    float r = length(position.xz);
    float front = 55.0 + uPyroAge * 80.0;
    c = mix(c, c * 0.6 + mix(uBlood, uFire, 0.4) * 0.35, uPyro * smoothstep(front, front - 30.0, r));
  }
  vCol = c;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uPx * 0.62 / -mv.z, 1.5, 9.0);
  gl_Position = projectionMatrix * mv;
}`;
const BODY_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  // vai + đầu: khối vuông phía dưới, đầu nhỏ phía trên (cạnh thẳng)
  float body = step(abs(q.x), 0.75) * step(0.0, q.y);
  float head = step(abs(q.x), 0.32) * step(-0.75, q.y) * step(q.y, -0.05);
  if (body + head < 0.5) discard;
  gl_FragColor = vec4(vCol * (head > 0.5 ? 1.15 : 1.0), 1.0);
}`;
const FRAG = /* glsl */ `
varying vec3 vCol; varying float vShape;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  // đốm vuông cạnh thẳng (điện thoại) / hình thoi (ngọn lửa) — không tròn kẹo
  float dPh = max(abs(q.x) * 1.3, abs(q.y));
  float dFl = abs(q.x) * 1.6 + abs(q.y + 0.1) * 0.9;
  float d = mix(dPh, dFl, vShape);
  if (d > 1.0) discard;
  float core = step(d, 0.5);
  float halo = (1.0 - d) * 0.45;
  gl_FragColor = vec4(vCol * (core + halo), 1.0);
}`;

export function createSteelStandCrowd(ctx: Parameters<NonNullable<StandsBuilders['standCrowd']>>[0]): StandCrowdHandle {
  const { scene } = ctx;
  const uniforms = ctx.uniforms as Record<string, { value: unknown }>;
  const CX = STADIUM_CENTRE.x, CZ = STADIUM_CENTRE.z, A0 = STANDS_ARC.from, A1 = STANDS_ARC.to, TIERS = STANDS_TIERS, SECTIONS = 8;
  const P = (r: number, a: number, y: number) => [CX + Math.sin(a) * r, y, CZ - Math.cos(a) * r];
  const gen = (COUNT: number, seed0: number) => {
    const cp = new Float32Array(COUNT * 3), cs = new Float32Array(COUNT * 2);
    const areas = TIERS.map((T) => (T.r1 - T.r0) * (T.r0 + T.r1) / 2);
    const tot = areas.reduce((s, v) => s + v, 0);
    let seed = seed0;
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
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(cs, 2));
    return g;
  };
  const geo = gen(26000, 12345);
  // Lớp "người" tối (than / denim) phủ kín các bậc → khán đài luôn trông KÍN NGƯỜI, kể cả khi Hype thấp. 1 draw call.
  const bodyGeo = gen(48000, 777);
  const v3 = (hex: number) => new THREE.Vector3(...hexToRgb(hex));
  const r = (n: string, k: 100 | 300 | 500 | 700, fb: number) => RAMPS[n]?.[k] ?? fb;
  const fxU = {
    uCheer: { value: 0 }, uCheerAge: { value: 99 }, uWave: { value: 0 }, uWavePos: { value: -1 },
    uHeart: { value: 0 }, uHeartAge: { value: 99 }, uFlash: { value: 0 }, uPyro: { value: 0 }, uPyroAge: { value: 99 },
    uHA: { value: new THREE.Vector3() }, uHB: { value: new THREE.Vector3() }, uHC: { value: new THREE.Vector3() },
    uPhone: { value: v3(r('arc', 300, PAL.soda[300])) }, uLighter: { value: v3(r('flame', 300, PAL.berry[300])) },
    uTung: { value: v3(r('tungsten', 500, PAL.mint[500])) }, uFire: { value: v3(r('flame', 500, PAL.berry[500])) },
    uBlood: { value: v3(r('blood', 300, PAL.berry[700])) }, uHot: { value: v3(r('whitehot', 100, PAL.honey[100])) },
    uDim: { value: v3(r('coal', 100, PAL.night[100])) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRes: { value: 1 }, uPhase: { value: 0 }, uPulse: { value: 0 }, uTime: { value: 0 }, uHype: { value: 0 }, ...uniforms, ...fxU },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 1;
  pts.name = 'standCrowd-steel';
  scene.add(pts);
  const bodyU = { uPx: { value: 600 }, uBodyA: { value: v3(r('coal', 100, PAL.night[100])) }, uBodyB: { value: v3(0x2e3a52) } };
  const bodyMat = new THREE.ShaderMaterial({
    uniforms: { ...mat.uniforms, ...bodyU },
    vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, transparent: false, depthWrite: false, fog: false,
  });
  const bodies = new THREE.Points(bodyGeo, bodyMat);
  bodies.frustumCulled = false;
  bodies.renderOrder = 0;
  bodies.name = 'standCrowd-steel-bodies';
  scene.add(bodies);

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
    bodyU.uPx.value = viewHeightPx();
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
      scene.remove(pts, bodies);
      geo.dispose(); mat.dispose(); bodyGeo.dispose(); bodyMat.dispose();
    },
  };
}

export const builders: Partial<StandsBuilders> = { standCrowd: createSteelStandCrowd };
