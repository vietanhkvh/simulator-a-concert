// "Thép & Lửa" — khe `ledWall`: tường LED 26 × 10 m (lưới chấm LED + scanline) với TIA SÉT stencil lớn + sao đinh tán,
// màu theo 3 trạng thái Hype: Thép nguội = tia sét hồ quang lạnh trên nền than · Tungsten = tia sét tungsten, nền ấm tối ·
// Lửa lớn (≥ 80 %) = nền đỏ huyết, tia sét trắng nung. Tia sét chớp theo phách (≤ 3 lần/s). Khung giàn hộp thép + chân.
// 2 draw call (mặt LED shader + khung đẽo phẳng).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { LED_WALL } from '../../../../world/layout';
import { toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { BOLT_PTS, R, SKit, V, facetMaterial, resetJitter } from './stageKit';

const LED_FRAG = () => /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uFlash; uniform float uLevel; uniform float uPulse;
uniform vec3 uBg; uniform vec3 uBg2; uniform vec3 uBolt; uniform vec3 uStar; uniform vec3 uRim;
varying vec2 vUv;
float sdPoly(vec2 p){
  vec2 v[6];
  ${BOLT_PTS.slice(0, 6).map(([x, y], i) => `v[${i}] = vec2(${x.toFixed(3)}, ${y.toFixed(3)});`).join(' ')}
  float d = dot(p - v[0], p - v[0]); float s = 1.0;
  for (int i = 0; i < 6; i++) {
    int j = i == 0 ? 5 : i - 1;
    vec2 e = v[j] - v[i]; vec2 w = p - v[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s *= -1.0;
  }
  return s * sqrt(d);
}
float sdStar(vec2 p, float r){
  float a = atan(p.x, p.y); float n = 5.0;
  float m = mod(a + 3.14159 / n, 6.28318 / n) - 3.14159 / n;
  vec2 q = length(p) * vec2(cos(m), abs(sin(m)));
  vec2 A = vec2(r, 0.0), B = vec2(r * 0.42 * cos(3.14159 / n), r * 0.42 * sin(3.14159 / n));
  vec2 e = B - A, w = q - A;
  float h = clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
  float d = length(w - e * h);
  return (e.x * w.y - e.y * w.x) > 0.0 ? -d : d;
}
float h11(float n){ return fract(sin(n * 91.345) * 43758.545); }
void main(){
  vec2 q = (vUv - 0.5) * vec2(26.0, 10.0);
  float fire = smoothstep(0.75, 0.88, uHype);
  // nền: dải ngang thô (bậc) trôi chậm
  float band = floor((q.y + 5.0) * 1.2 + sin(q.x * 0.15 + uTime * 0.3) * 0.6) / 12.0;
  vec3 col = mix(uBg, uBg2, clamp(band, 0.0, 1.0));
  // vệt sét nhỏ ngang (scan) theo nhạc
  float scan = step(0.985, fract(q.y * 0.35 - uTime * (0.2 + 0.6 * uHype)));
  col += uRim * scan * (0.15 + 0.3 * uLevel);
  // sao đinh tán
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2(mix(-11.0, 11.0, h11(fi + 1.0)), mix(-3.6, 3.8, h11(fi + 7.0)));
    if (abs(c.x) < 4.5) c.x += sign(c.x + 0.01) * 4.5;
    float r = 0.7 + 0.5 * h11(fi + 3.0);
    float d = sdStar(q - c, r);
    col = mix(col, uStar, step(d, 0.0) * 0.9);
  }
  // tia sét lớn ở giữa (cao 9 m): viền tối + lõi
  vec2 bp = q / 9.0;
  float d = sdPoly(bp) * 9.0;
  col = mix(col, uBg * 0.3, step(d, 0.35) * 0.8);
  vec3 bolt = uBolt * (0.85 + 0.55 * uFlash);
  col = mix(col, bolt, step(d, 0.0));
  col = mix(col, mix(bolt, vec3(1.0), 0.5), step(d, -0.55) * step(-0.85, d) * 0.6 * uFlash); // gờ trong khi chớp
  // lưới chấm LED + scanline (mờ dần khi ở xa để khỏi nhiễu moiré)
  float pitch = 0.11;
  vec2 g = fract(q / pitch) - 0.5;
  float fw = clamp(fwidth(q.x) / pitch, 0.0, 1.0);
  float dotm = mix(smoothstep(0.5, 0.25, length(g)), 0.7, smoothstep(0.25, 0.7, fw));
  float sl = mix(0.82 + 0.18 * step(0.5, fract(q.y / (pitch * 2.0))), 1.0, smoothstep(0.2, 0.6, fw));
  col *= (0.35 + 0.75 * dotm) * sl;
  // viền khung tối
  float edge = step(12.85, abs(q.x)) + step(4.85, abs(q.y));
  col = mix(col, vec3(0.02), clamp(edge, 0.0, 1.0));
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(0.4545)), 1.0);
}`;

export function createSteelLedWall(ctx: ArenaBuildContext) {
  const { scene, uniforms } = ctx;
  const P = R();
  resetJitter(37);
  const { z: WZ, width: W, height: H, centreY: CY } = LED_WALL;

  const u = {
    uTime: uniforms.uTime ?? { value: 0 }, uHype: { value: 0 }, uFlash: { value: 0 }, uLevel: { value: 0 }, uPulse: { value: 0 },
    uBg: { value: new THREE.Color() }, uBg2: { value: new THREE.Color() }, uBolt: { value: new THREE.Color() },
    uStar: { value: new THREE.Color() }, uRim: { value: new THREE.Color() },
  };
  const g = new THREE.PlaneGeometry(W, H).rotateY(Math.PI);
  g.translate(0, CY, WZ - 0.05);
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: LED_FRAG(), fog: false });
  const face = new THREE.Mesh(g, mat);

  // khung giàn hộp thép: hai cột + giàn trên + giàn dưới + chân chéo
  const k = new SKit();
  const x0 = W / 2 + 0.5, yT = CY + H / 2 + 0.45, yB = CY - H / 2 - 0.3;
  for (const sx of [-1, 1]) {
    k.truss(V(sx * x0, -0.1, WZ + 0.2), V(sx * x0, yT + 0.4, WZ + 0.2), 0.8, P.steel[500], P.steel[700], 1.2, 0.08, 0.04);
    k.beam(V(sx * x0, yT, WZ + 0.2), V(sx * x0, 0, WZ + 3.0), 0.12, 0.12, P.steel[700]);
  }
  k.truss(V(-x0, yT, WZ + 0.2), V(x0, yT, WZ + 0.2), 0.8, P.steel[300], P.steel[700], 1.3, 0.08, 0.04);
  k.box(W + 0.4, 0.25, 0.3, 0, yB + 0.05, WZ + 0.05, P.coal[300]);
  k.box(W + 0.4, Math.max(0.1, yB), 0.3, 0, yB / 2, WZ + 0.05, P.coal[500]);
  k.box(W + 0.6, H + 0.8, 0.12, 0, CY, WZ + 0.12, P.coal[500]);
  // nẹp thép viền mặt LED
  for (const y of [CY - H / 2 - 0.08, CY + H / 2 + 0.08]) k.box(W + 0.3, 0.16, 0.16, 0, y, WZ - 0.1, P.steel[300]);
  for (const sx of [-1, 1]) k.box(0.16, H + 0.3, 0.16, sx * (W / 2 + 0.08), CY, WZ - 0.1, P.steel[300]);
  const kg = k.build();
  const fm = facetMaterial(uniforms);
  const frame = new THREE.Mesh(kg, fm.mat);
  scene.add(face, frame);

  const c = {
    coal: toColor(P.coal[500]), coal3: toColor(P.coal[300]), steel: toColor(P.steel[700]), arc: toColor(P.arc[500]), arc7: toColor(P.arc[700]),
    tung: toColor(P.tung[500]), tung7: toColor(P.tung[700]), ember: toColor(P.ember[700]), blood: toColor(P.blood[500]), blood3: toColor(P.blood[300]),
    white: toColor(P.white[300]), paper: toColor(P.paper[500]), flame: toColor(P.flame[500]),
  };
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const blend3 = (out: THREE.Color, a: THREE.Color, b: THREE.Color, cc: THREE.Color, h: number) => {
    const w1 = THREE.MathUtils.smoothstep(h, 0.32, 0.48), w2 = THREE.MathUtils.smoothstep(h, 0.75, 0.86);
    out.copy(a).lerp(b, w1).lerp(cc, w2);
    return out;
  };
  let lastBeat = -1, lastFlash = -10, flash = 0, time = 0;
  return {
    update(f: FrameState, _t: number) {
      const h = Math.min(1, Math.max(0, f.hype));
      time += f.dt;
      const bi = Math.floor(f.beat);
      // chớp tia sét: mỗi phách khi Hype ≥ 40 % (mỗi 2 phách khi thấp hơn), cách nhau ≥ 0,34 s (≤ 3 lần/s)
      if (bi !== lastBeat) {
        lastBeat = bi;
        if ((h >= 0.4 || bi % 2 === 0) && time - lastFlash >= 0.34) { flash = 1; lastFlash = time; }
      }
      flash = Math.max(0, flash - f.dt / 0.24);
      u.uFlash.value = flash * (0.4 + 0.6 * h);
      u.uHype.value = h; u.uLevel.value = f.level; u.uPulse.value = f.beatPulse;
      blend3(u.uBg.value, c.coal, tmp.copy(c.tung7).multiplyScalar(0.12), c.blood, h);
      blend3(u.uBg2.value, c.coal3, tmp2.copy(c.ember).multiplyScalar(0.3), c.blood3, h);
      blend3(u.uBolt.value, c.arc, c.tung, c.white, h);
      blend3(u.uStar.value, c.steel, c.tung7, c.paper, h);
      blend3(u.uRim.value, c.arc7, c.flame, c.white, h);
    },
    dispose() { scene.remove(face, frame); g.dispose(); mat.dispose(); kg.dispose(); fm.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { ledWall: createSteelLedWall };
