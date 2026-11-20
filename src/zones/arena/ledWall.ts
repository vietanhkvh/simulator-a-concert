// Khu SÂN TRUNG TÂM — phần sau lưng ca sĩ (Kẹo đêm): tường LED (shader palette: gradient kẹo, bokeh, tim/sao bay, cột equaliser bo tròn),
// khung vành bo + cột ống + cánh gà bo tròn, dải sáng theo Hype. 3 draw call.
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import type { Uniforms } from '../../world/shared/glowPoints';
import { PAL, glHex, hypeColors } from '../../world/style';
import { GLSL_SHAPES, Toy, bakeToonShade, createToyMaterial, ringGeo, slabGeo, updateToyHype } from './stageStyle';

const LED_FRAG = () => /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uLevel; uniform float uPhase;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
varying vec2 vUv;
${GLSL_SHAPES}
const vec3 N5 = ${glHex(PAL.night[500])};
const vec3 N3 = ${glHex(PAL.night[300])};
const vec3 CREAM = ${glHex(PAL.cream[500])};
void main(){
  vec2 q = (vUv - 0.5) * vec2(26.0, 10.0);
  float sd = sdRoundRect(q, vec2(12.9, 4.9), 1.0);
  if (sd > 0.0) discard;
  float t = uTime;
  // nền kẹo: gradient mềm trôi
  float fl = 0.5 + 0.5 * sin(q.x * 0.22 + t * 0.35) * sin(q.y * 0.4 - t * 0.27 + q.x * 0.1);
  vec3 col = mix(N5, N3, 0.35 + 0.4 * vUv.y);
  col = mix(col, uA * 0.8, ss(0.15, 1.0, fl) * (0.5 + 0.4 * uHype));
  col = mix(col, uB * 0.7, ss(0.1, 1.0, 1.0 - fl) * (0.3 + 0.5 * vUv.y) * (0.4 + 0.4 * uHype));
  // vòng xung mềm theo beat
  float r = length(q * vec2(0.8, 1.2));
  float ring = ss(0.7, 0.0, abs(r - fract(uPhase * 0.25) * 16.0));
  col += mix(uB, uC, 0.5) * ring * (0.1 + 0.25 * uPulse) * (0.4 + uHype);
  // bokeh
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float yy = fract(hash11(fi + 3.0) + t * (0.02 + 0.03 * hash11(fi)) * (0.5 + uHype));
    vec2 c = vec2((hash11(fi + 9.0) - 0.5) * 25.0, (yy - 0.5) * 11.0);
    float rr = 0.4 + 0.8 * hash11(fi + 5.0);
    float m = ss(rr, rr * 0.25, length(q - c));
    col = mix(col, mix(uB, uC, hash11(fi + 1.0)) , m * 0.22);
  }
  // tim và sao lơ lửng
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float yy = fract(hash11(fi + 21.0) + t * (0.035 + 0.02 * hash11(fi + 2.0)) * (0.5 + uHype));
    vec2 c = vec2((hash11(fi + 31.0) - 0.5) * 24.0 + sin(t * 0.7 + fi) * 0.5, (yy - 0.5) * 11.0);
    float sz = 0.8 + 0.6 * hash11(fi + 7.0) + 0.15 * uPulse;
    vec2 hc = (q - c) / sz;
    float sdm = (mod(fi, 2.0) < 1.0) ? sdHeart(hc) * sz : (sdStar5(hc, 1.0, 0.5) - 0.14) * sz;
    vec3 mc = (mod(fi, 2.0) < 1.0) ? mix(uA, CREAM, 0.15) : mix(uC, CREAM, 0.2);
    col = mix(col, mc * (0.75 + 0.3 * uPulse), ss(0.03, -0.03, sdm) * 0.8);
    col = mix(col, CREAM, ss(0.03, -0.03, abs(sdm + 0.03) - 0.03) * 0.5);
  }
  // cột equaliser bo tròn dọc mép dưới
  for (int c = 0; c < 26; c++) {
    float fc = float(c);
    float cx = (fc - 12.5) * 0.98;
    float rnd = hash11(fc * 1.7 + floor(t * (2.0 + 4.0 * uHype)) * 0.37);
    float h = clamp(0.5 + 3.0 * uLevel * (0.25 + rnd) + 1.6 * uPulse * rnd * (0.3 + uHype), 0.4, 4.2);
    vec2 pa = vec2(cx, -4.1), pb = vec2(cx, -4.1 + h);
    vec2 pp = q - pa, ba = pb - pa;
    float tt = clamp(dot(pp, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pp - ba * tt) - 0.3;
    vec3 bc = mix(uA, uB, fc / 25.0);
    bc = mix(bc, uC, ss(0.6, 1.0, (q.y + 4.1) / max(h, 0.1)) * 0.7);
    float inside = ss(0.02, -0.02, d);
    col = mix(col, bc * (0.7 + 0.3 * uPulse), inside * 0.9);
    col = mix(col, CREAM, ss(0.02, -0.02, length(q - vec2(cx - 0.1, -4.1 + h - 0.18)) - 0.07) * inside * 0.8);
  }
  // lưới điểm LED rất nhẹ + viền tối mép bo
  vec2 g = fract(vUv * vec2(260.0, 100.0));
  col *= 0.9 + 0.1 * ss(0.0, 0.2, g.x) * ss(0.0, 0.2, g.y);
  col *= 0.85 + 0.2 * uPulse * uHype;
  col = mix(col, uA * 0.9 + 0.12, ss(-0.18, -0.05, sd) * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

/** uniforms: bộ uniform dùng chung của world (uTime, uHype, uPulse, uLevel, uPhase) — world.ts cập nhật mỗi frame. */
export function createLedWall(scene: THREE.Scene, uniforms: Uniforms) {
  const disposables: { dispose(): void }[] = [];

  // Tường LED (góc bo tròn bằng discard)
  const ledGeo = new THREE.PlaneGeometry(26, 10);
  const own = { uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() } };
  const ledMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...own },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: LED_FRAG(),
    fog: false,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 5.2, 3.5);
  led.rotation.y = Math.PI;
  scene.add(led);
  disposables.push(ledGeo, ledMat);

  // Nền sau tường + cột ống + cánh gà bo tròn (1 mesh toy)
  const toy = new Toy();
  toy.add(slabGeo(27.4, 11.2, 0.5, 1.7, 0.12), PAL.night[300], false, new THREE.Matrix4().makeTranslation(0, 5.2, 3.82));
  for (const sx of [-1, 1]) {
    toy.tubeBands(new THREE.Vector3(sx * 13.9, -0.1, 3.4), new THREE.Vector3(sx * 13.9, 12.8, 3.4), 0.5, PAL.night[300], PAL.grape[500], 0.26, 1.4);
    toy.sphere(0.36, sx * 13.9, 12.85, 3.4, PAL.cream[500]);
    toy.star(0.7, 0.28, sx * 13.9, 13.9, 3.4, PAL.honey[500], { ry: Math.PI, trim: true });
    toy.box(6, 12, 0.3, sx * 16.2, 6, 3.2, PAL.night[300], { ry: -sx * 0.5, r: 0.14 }); // cánh gà xiên
    toy.box(0.3, 12, 9, sx * 13.9, 6, -1, PAL.night[300], { r: 0.14 }); // tường cánh hai bên sân khấu
    toy.tube(new THREE.Vector3(sx * 13.55, 12.3, -5.4), new THREE.Vector3(sx * 13.55, 12.3, 3.3), 0.36, PAL.grape[500]); // xà dọc
    // váy xếp cung dọc tường cánh (mặt trong)
    for (let k = 0; k < 9; k++) toy.sphere(1, sx * 13.7, 11.5, -5.0 + k * 1.0, k & 1 ? PAL.grape[700] : PAL.night[500], {}, 0.2, 0.55, 0.5);
  }
  const darkGeo = toy.build();
  const toyM = createToyMaterial();
  scene.add(new THREE.Mesh(darkGeo, toyM.mat));
  disposables.push(darkGeo, toyM);

  // Dải đèn: khung vành bo quanh tường + ống sáng trên tường bên (1 mesh, màu chạy theo hype)
  const acc = new Toy();
  acc.add(ringGeo(26.8, 10.8, 0.5, 1.5, 0.28), 0xffffff, false, new THREE.Matrix4().makeTranslation(0, 5.2, 3.4));
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) acc.tube(new THREE.Vector3(sx * 13.62, 1.2 + i * 1.9, -4.9), new THREE.Vector3(sx * 13.62, 1.2 + i * 1.9, 3.2), 0.1, 0xffffff);
  }
  const accGeo = bakeToonShade(acc.build());
  const accMat = new THREE.MeshBasicMaterial({ color: PAL.berry[500], vertexColors: true, fog: false });
  scene.add(new THREE.Mesh(accGeo, accMat));
  disposables.push(accGeo, accMat);

  const c = new THREE.Color();
  return {
    update(f: FrameState, t: number) {
      updateToyHype(f.hype);
      const hc = hypeColors(f.hype);
      own.uA.value.set(hc.primary[0], hc.primary[1], hc.primary[2]);
      own.uB.value.set(hc.secondary[0], hc.secondary[1], hc.secondary[2]);
      own.uC.value.set(hc.accent[0], hc.accent[1], hc.accent[2]);
      c.setRGB(hc.primary[0], hc.primary[1], hc.primary[2], THREE.SRGBColorSpace);
      accMat.color.copy(c).multiplyScalar(0.85 + 0.35 * f.beatPulse);
      void t;
    },
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}
