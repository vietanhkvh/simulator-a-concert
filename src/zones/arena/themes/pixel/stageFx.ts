// "Đêm Sao Điểm Ảnh" — khe `stageFx`: thay laser/pháo/khói kẹo. (1) BẮN SƠN: 8 thùng sơn ở mép trước (khe stageBase) hắt
// cột đốm sơn vuông (đốm 4 × 4 texel bo góc, một màu bảng mỗi đốm) theo đường parabol, cao 3–6 m, theo phách mạnh khi
// Hype ≥ 60 % (≤ 3 lần/s); (2) PHÁO SAO VAN GOGH (thay pyro/CO2): 5 chùm sao nổ trên khung tranh — 3 vòng ô vuông
// kem/crôm/son nở ra rồi rơi, nhân 1 đốm sáng giữa; `pyro()` = cả 8 thùng + 5 chùm sao. Không chớp toàn màn, không cộng
// màu; mọi đốm hoà tan dither trong 2–6 m sát camera (mọi góc máy) và nén ở cửa sổ lời. 2 draw call, mỗi frame chỉ đổi uniform.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders, StageFx } from '../../builders';
import { GLARE_FRAG_PARS, GLARE_VERT_MAIN, GLARE_VERT_PARS } from '../../lightsGlare';
import { POT_PAINT, POT_TOP, POT_X, POT_Z } from './stageBase';
import { BIG_FRAME } from './stageDeco';
import { GLSL_BAYER, R } from './stageKit';

const SPLASH_PER = 18;
const SPLASH_VERT = /* glsl */ `
uniform float uT[8]; uniform float uPeak[8];
attribute vec4 aSeed; // x: thùng, y,z,w: ngẫu nhiên
attribute vec4 aOrigin; // xyz: miệng thùng, w: màu sơn của thùng
varying vec2 vQ; varying float vA; varying float vCi; varying float vDepth;
${GLARE_VERT_PARS}
void main(){
  int ci = int(aSeed.x + 0.5);
  float t = -1.0; float pk = 5.0;
  for (int i = 0; i < 8; i++) if (i == ci) { t = uT[i]; pk = uPeak[i]; }
  t -= aSeed.y * 0.18; // so le trong cụm
  float life = 1.25 + 0.4 * aSeed.z;
  float on = step(0.0, t) * step(t, life);
  float vy = sqrt(2.0 * 9.8 * pk) * (0.7 + 0.3 * aSeed.w);
  float ang = (aSeed.z - 0.5) * 1.3 + (aSeed.w - 0.5) * 0.4;
  vec3 p = vec3(sin(ang) * 1.6 * t, vy * t - 4.9 * t * t, (aSeed.w - 0.5) * -1.2 * t);
  vec4 mv = modelViewMatrix * vec4(p + aOrigin.xyz, 1.0);
  float s = 0.4 + 0.3 * aSeed.y;
  mv.xy += position.xy * s;
  vQ = position.xy + 0.5;
  vA = on * (1.0 - smoothstep(life - 0.35, life, t));
  vCi = aSeed.y < 0.6 ? aOrigin.w : mod(aOrigin.w + 1.0, 4.0); // màu thùng + xen màu kế bên
  vDepth = -mv.z;
  gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
}`;
const DOT_FRAG = () => /* glsl */ `
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uInk;
varying vec2 vQ; varying float vA; varying float vCi; varying float vDepth;
${GLARE_FRAG_PARS()}
${GLSL_BAYER}
void main(){
  // đốm 4 × 4 bo góc: bỏ 4 góc; viền dưới-phải tối một bậc
  vec2 g = floor(vQ * 4.0);
  if ((g.x < 0.5 || g.x > 2.5) && (g.y < 0.5 || g.y > 2.5)) discard;
  float a = vA * smoothstep(2.0, 6.0, vDepth) * mix(1.0, lyricDim(), 0.8);
  if (bayer4(gl_FragCoord.xy) >= a) discard;
  int i = int(vCi + 0.5);
  vec3 c = i == 0 ? uC0 : i == 1 ? uC1 : i == 2 ? uC2 : uC3;
  if (g.x > 2.5 || g.y < 0.5) c *= vec3(0.62, 0.66, 0.85);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const BURST_RINGS = 3, BURST_PER = 12, BURSTS = 5;
const BURST_VERT = /* glsl */ `
uniform float uT; uniform vec3 uCentres[5];
attribute vec4 aB; // x: chùm, y: vòng, z: chỉ số trên vòng (0..1), w: ngẫu nhiên
varying vec2 vQ; varying float vA; varying float vCi; varying float vDepth;
${GLARE_VERT_PARS}
void main(){
  int bi = int(aB.x + 0.5);
  vec3 cen = vec3(0.0);
  for (int i = 0; i < 5; i++) if (i == bi) cen = uCentres[i];
  float t = uT - aB.x * 0.22;
  float life = 2.1;
  float on = step(0.0, t) * step(t, life);
  float ring = aB.y;
  float r = (2.6 + ring * 2.2) * (1.0 - exp(-t * 3.2)) * (aB.z < 0.0 ? 0.0 : 1.0);
  float a = aB.z * 6.2831853 + ring * 0.35 + t * (0.6 - ring * 0.25); // xoáy nhẹ kiểu sao Van Gogh
  vec4 mv = modelViewMatrix * vec4(cen + vec3(0.0, -0.9 * t * t, 0.0), 1.0);
  mv.xy += vec2(cos(a), sin(a)) * r;
  float s = (aB.z < 0.0 ? 1.3 : 0.85 - ring * 0.15) * (1.0 - 0.3 * smoothstep(1.2, 2.1, t));
  mv.xy += position.xy * s;
  vQ = position.xy + 0.5;
  vA = on * (1.0 - smoothstep(1.4, life, t));
  vCi = aB.z < 0.0 ? 3.0 : ring;
  vDepth = -mv.z;
  gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  ${GLARE_VERT_MAIN}
}`;

export function createPixelStageFx(ctx: ArenaBuildContext): StageFx {
  const { scene } = ctx;
  const P = R();
  const group = new THREE.Group();

  // ── đốm sơn ──
  const NSP = 8 * SPLASH_PER;
  const quad = new THREE.PlaneGeometry(1, 1);
  const spGeo = new THREE.InstancedBufferGeometry();
  spGeo.index = quad.index!.clone();
  spGeo.setAttribute('position', quad.getAttribute('position').clone());
  const seed = new Float32Array(NSP * 4);
  let sd = 11;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < NSP; i++) { seed[i * 4] = Math.floor(i / SPLASH_PER); seed[i * 4 + 1] = rnd(); seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd(); }
  spGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  spGeo.instanceCount = NSP;
  const paint = [P.crom[500], P.sen, P.ngoc, P.pho[300]];
  const spU = {
    uT: { value: new Array(8).fill(-1) as number[] }, uPeak: { value: new Array(8).fill(4) as number[] },
    uC0: { value: toColor(paint[0]!) }, uC1: { value: toColor(paint[1]!) }, uC2: { value: toColor(paint[2]!) }, uC3: { value: toColor(paint[3]!) },
    uInk: { value: toColor(P.ink) },
  };
  const spMat = new THREE.ShaderMaterial({ uniforms: spU, vertexShader: SPLASH_VERT, fragmentShader: DOT_FRAG(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const splash = new THREE.Mesh(spGeo, spMat);
  splash.frustumCulled = false;
  splash.renderOrder = 6;
  // gốc mỗi đốm = miệng thùng của nó
  const origin = new Float32Array(NSP * 4);
  for (let i = 0; i < NSP; i++) { const c = Math.floor(i / SPLASH_PER); origin.set([POT_X[c]!, POT_TOP, POT_Z, POT_PAINT[c]!], i * 4); }
  spGeo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 4));

  // ── pháo sao Van Gogh ──
  const NBI = BURSTS * (BURST_RINGS * BURST_PER + 1);
  const bGeo = new THREE.InstancedBufferGeometry();
  bGeo.index = quad.index!.clone();
  bGeo.setAttribute('position', quad.getAttribute('position').clone());
  const bAttr = new Float32Array(NBI * 4);
  {
    let n = 0;
    for (let b = 0; b < BURSTS; b++) {
      for (let r = 0; r < BURST_RINGS; r++) for (let i = 0; i < BURST_PER; i++, n++) bAttr.set([b, r, i / BURST_PER, rnd()], n * 4);
      bAttr.set([b, 0, -1, 0], n * 4); n++;
    }
  }
  bGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(bAttr, 4));
  bGeo.instanceCount = NBI;
  const { FZ, TOP, PX } = BIG_FRAME;
  const centres = [V3(-PX * 0.75, TOP + 5.5, FZ - 1), V3(-PX * 0.35, TOP + 7.5, FZ - 2), V3(0, TOP + 4.6, FZ - 1.5), V3(PX * 0.35, TOP + 7.5, FZ - 2), V3(PX * 0.75, TOP + 5.5, FZ - 1)];
  const buU = {
    uT: { value: -10 }, uCentres: { value: centres },
    uC0: { value: toColor(P.crom[100]) }, uC1: { value: toColor(P.crom[300]) }, uC2: { value: toColor(P.crom[500]) }, uC3: { value: toColor(P.crom[100]) },
    uInk: { value: toColor(P.ink) },
  };
  const buMat = new THREE.ShaderMaterial({ uniforms: buU, vertexShader: BURST_VERT, fragmentShader: DOT_FRAG(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const bursts = new THREE.Mesh(bGeo, buMat);
  bursts.frustumCulled = false;
  bursts.renderOrder = 6;

  group.add(splash, bursts);
  scene.add(group);

  const fired = new Array(8).fill(-10) as number[];
  const cSet = {
    cool: [P.crom[300], P.crom[100], P.pho[100], P.crom[100]],
    warm: [P.crom[300], P.crom[500], P.bach[100], P.crom[100]],
    vivid: [P.son[100], P.son[300], P.son[500], P.crom[100]],
  };
  let time = 0, lastBeat = -1, lastShot = -10, pyroAt = -100, prevHype = 0, lastPyro = -100, pat = 0;
  const setBurstColours = (h: number) => {
    const s = h >= 0.8 ? cSet.vivid : h >= 0.4 ? cSet.warm : cSet.cool;
    buU.uC0.value.copy(toColor(s[0]!)); buU.uC1.value.copy(toColor(s[1]!)); buU.uC2.value.copy(toColor(s[2]!)); buU.uC3.value.copy(toColor(s[3]!));
  };
  const pyro = () => {
    pyroAt = time; lastPyro = time;
    for (let i = 0; i < 8; i++) { fired[i] = time + i * 0.05; spU.uPeak.value[i] = 6; }
  };
  return {
    update(f: FrameState) {
      time += f.dt;
      const h = Math.min(1, Math.max(0, f.hype));
      if (h > 0.85 && prevHype <= 0.85 && time - lastPyro >= 15) { setBurstColours(h); pyro(); }
      prevHype = h;
      const bi = Math.floor(f.beat);
      if (bi !== lastBeat) {
        lastBeat = bi;
        // phách chẵn (60–85 %), mọi phách (≥ 85 %); cách nhau ≥ 0,34 s → ≤ 3 lần/s
        if (h >= 0.6 && time - lastShot >= 0.34 && (h >= 0.85 || bi % 2 === 0) && time - pyroAt > 1.8) {
          lastShot = time;
          pat = (pat + 1) % 4;
          const pairs = [[0, 7], [1, 6], [2, 5], [3, 4]];
          const pick = h >= 0.85 ? [...pairs[pat]!, ...pairs[(pat + 2) % 4]!] : pairs[pat]!;
          for (const i of pick) { fired[i] = time; spU.uPeak.value[i] = 3 + 2.5 * Math.min(1, (h - 0.6) / 0.35); }
        }
      }
      for (let i = 0; i < 8; i++) spU.uT.value[i] = time - fired[i]! < 2 ? time - fired[i]! : -1;
      const bt = time - pyroAt;
      if (bt < 0.05) setBurstColours(h);
      buU.uT.value = bt < 3.2 ? bt : -10;
    },
    pyro: () => { pyro(); },
    dispose() {
      scene.remove(group);
      quad.dispose(); spGeo.dispose(); spMat.dispose(); bGeo.dispose(); buMat.dispose();
    },
  };
}
function V3(x: number, y: number, z: number) { return new THREE.Vector3(x, y, z); }

export const builders: Partial<ArenaBuilders> = { stageFx: createPixelStageFx };
