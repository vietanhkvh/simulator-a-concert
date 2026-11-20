// "Mực & Sơn mài · bản Việt" · khe secretUfo (L6): ĐÈN TRĂNG KHỔNG LỒ thả đèn trời.
// Quả cầu giấy dó có nan (vạch kinh tuyến), mây cuộn ngọc bích, khung vàng (xích đạo + hai vành cực), quầng xà cừ mềm,
// chữ ký vòng cọ ngọc + triện son. Hạ chậm xuống giữa sân (~20 m), lơ lửng, sáng theo phách; đáy mở (chóp vàng hạ xuống)
// và thả ~200 đèn trời: xoắn ốc rơi xuống một đoạn rồi bay lên, trôi đi. Cuối màn đèn trăng bay lên và trôi RA NGOÀI khung.
// 5 draw call khi chạy (cầu, chóp đáy, quầng, đèn trời, vòng chữ ký), 0 khi rảnh; mỗi khung chỉ đổi uniform/transform.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { popScale } from '../../../../world/style';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { pxScale, seededRnd, smooth } from '../../secretShared';
import { createSealRing, gl3, ramp } from './bannerKit';

const D = 20;
const T_HOVER = 5, T_OPEN = 7, T_REL0 = 7.6, T_REL1 = 12.5, T_CLOSE = 14.5, T_LEAVE = 15;
const START = new THREE.Vector3(30, 95, -110);
const HOVER = new THREE.Vector3(0, 16.5, -42);
const AWAY = new THREE.Vector3(-220, 250, -420);
const R = 9;
const N_LANTERN = 200;

const MOON_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying vec3 vV;
void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
const moonFrag = () => {
  const pearl = ramp('pearl'), silk = ramp('silk'), jade = ramp('jade'), gold = ramp('gold'), amb = ramp('amber');
  return /* glsl */ `
uniform float uPulse; uniform float uTime; uniform float uGlow;
varying vec3 vN; varying vec3 vP; varying vec3 vV;
void main(){
  vec3 p = normalize(vP);
  float lon = atan(p.x, p.z), lat = asin(clamp(p.y, -1.0, 1.0));
  float ndv = abs(dot(normalize(vN), vV));
  // giấy dó sáng từ trong: tâm ấm, rìa xà cừ
  vec3 c = mix(${gl3(pearl[500])}, mix(${gl3(silk[300])}, ${gl3(ramp('gold')[100])}, 0.5), smoothstep(0.05, 0.85, ndv));
  c = mix(c, c + ${gl3(amb[100])} * 0.25, pow(ndv, 2.0) * (0.5 + 0.5 * uPulse));
  // sợi giấy
  c *= 0.94 + 0.06 * fract(sin(dot(floor(vP.xy * 3.0 + vP.z), vec2(12.9898, 78.233))) * 43758.5);
  // nan: 16 kinh tuyến mảnh
  float g = fract(lon / 6.2831853 * 16.0);
  c = mix(c, ${gl3(gold[700])}, smoothstep(0.03, 0.01, min(g, 1.0 - g)) * 0.6);
  // mây cuộn ngọc bích (dải sóng xoắn quanh xích đạo-dưới)
  float band = lat + 0.25 + 0.12 * sin(lon * 3.0 + uTime * 0.2);
  float curl = sin(lon * 6.0 + sin(lat * 9.0) * 2.0);
  float cloud = smoothstep(0.16, 0.12, abs(band)) * smoothstep(-0.2, 0.4, curl);
  float cloudEdge = smoothstep(0.17, 0.155, abs(band)) - smoothstep(0.15, 0.135, abs(band));
  c = mix(c, ${gl3(jade[300])}, cloud * 0.85);
  c = mix(c, ${gl3(jade[500])}, clamp(cloudEdge, 0.0, 1.0) * smoothstep(-0.2, 0.4, curl));
  // khung vàng: xích đạo + vành gần cực
  float fr = smoothstep(0.04, 0.02, abs(lat - 0.38)) + smoothstep(0.035, 0.015, abs(lat - 1.25)) + smoothstep(0.035, 0.015, abs(lat + 1.25));
  c = mix(c, ${gl3(gold[500])}, clamp(fr, 0.0, 1.0));
  gl_FragColor = vec4(c * (0.86 + 0.1 * uPulse + 0.12 * uGlow), 1.0);
}`;
};

const GLOW_VERT = /* glsl */ `
uniform float uR; varying vec2 vP;
void main(){ vP = position.xy; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uR; mv.z += uR * 0.2; gl_Position = projectionMatrix * mv; }`;
const glowFrag = () => /* glsl */ `
uniform float uA; varying vec2 vP;
void main(){ float r = length(vP); float a = smoothstep(1.0, 0.5, r) * uA * 0.22; gl_FragColor = vec4(${gl3(ramp('pearl')[100])} * a + ${gl3(ramp('amber')[300])} * a * 0.25, 1.0); }`;

const LAN_VERT = /* glsl */ `
uniform float uT; uniform float uPx; uniform vec3 uO;
attribute vec4 aSeed; // thời điểm thả, góc, tốc độ, pha
varying float vA; varying float vF;
void main(){
  float age = uT - aSeed.x;
  float a0 = aSeed.y * 6.2831853;
  float k1 = clamp(age / 1.6, 0.0, 1.0);
  float r = 1.5 + 14.0 * k1 + max(age - 1.6, 0.0) * (1.6 + aSeed.z * 2.2);
  float ang = a0 + k1 * 2.6 + age * 0.25;
  float y = -6.0 * (1.0 - (1.0 - k1) * (1.0 - k1)) + max(age - 1.6, 0.0) * max(age - 1.6, 0.0) * 0.18 + max(age - 1.6, 0.0) * (1.2 + aSeed.z * 1.4);
  vec3 p = uO + vec3(cos(ang) * r, y - ${(R * 0.85).toFixed(2)}, sin(ang) * r * 0.8);
  p.x += sin(uT * 0.4 + aSeed.w * 30.0) * 1.2;
  vA = (age > 0.0 ? 1.0 : 0.0) * smoothstep(0.0, 0.3, age) * (1.0 - smoothstep(9.0, 11.0, age));
  vF = 0.85 + 0.15 * sin(uT * (5.0 + aSeed.z * 4.0) + aSeed.w * 50.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vA < 0.004 ? 0.0 : clamp(uPx * 2.4 / -mv.z, 2.0, 60.0);
}`;
const lanFrag = () => {
  const amb = ramp('amber'), gold = ramp('gold'), son = ramp('son');
  return /* glsl */ `
varying float vA; varying float vF;
void main(){
  if (vA < 0.004) discard;
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  float body = smoothstep(0.5, 0.38, length(vec2(q.x * 1.3, q.y * 0.95)));
  float mouth = smoothstep(0.3, 0.0, length(vec2(q.x * 1.6, q.y - 0.32)));
  float halo = smoothstep(1.0, 0.0, length(q));
  vec3 col = mix(${gl3(amb[500])}, ${gl3(son[300])}, 0.3) * body * (0.8 + 0.3 * (0.5 - q.y)) + ${gl3(gold[100])} * mouth * body * 0.8 + ${gl3(amb[700])} * halo * halo * 0.5;
  gl_FragColor = vec4(col * vA * vF, 1.0);
}`;
};

export function createMoonLantern(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const moon = new THREE.Group();
  root.add(moon);
  const sGeo = new THREE.SphereGeometry(R, 48, 32);
  const sU = { uPulse: { value: 0 }, uTime: { value: 0 }, uGlow: { value: 0 } };
  const sMat = new THREE.ShaderMaterial({ uniforms: sU, vertexShader: MOON_VERT, fragmentShader: moonFrag(), fog: false });
  const sphere = new THREE.Mesh(sGeo, sMat);
  moon.add(sphere);
  // chóp đáy vàng (mở = hạ xuống + xoay) + núm treo trên đỉnh: chung 1 mesh
  const gold = ramp('gold');
  const capGeo = new THREE.CylinderGeometry(R * 0.36, R * 0.14, 2.2, 20);
  const capMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHex(gold[500], THREE.LinearSRGBColorSpace), fog: false });
  const cap = new THREE.Mesh(capGeo, capMat);
  moon.add(cap);
  const gGeo = new THREE.PlaneGeometry(2, 2);
  const gU = { uR: { value: R * 1.9 }, uA: { value: 1 } };
  const gMat = new THREE.ShaderMaterial({ uniforms: gU, vertexShader: GLOW_VERT, fragmentShader: glowFrag(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const glow = new THREE.Mesh(gGeo, gMat);
  glow.renderOrder = 2;
  moon.add(glow);
  // đèn trời
  const rnd = seededRnd(808);
  const seed = new Float32Array(N_LANTERN * 4);
  for (let i = 0; i < N_LANTERN; i++) seed.set([T_REL0 + (T_REL1 - T_REL0) * (i / N_LANTERN) + rnd() * 0.1, rnd(), rnd(), rnd()], i * 4);
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_LANTERN * 3), 3));
  lGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const lU = { uT: { value: 0 }, uPx: { value: 720 }, uO: { value: HOVER.clone() } };
  const lMat = new THREE.ShaderMaterial({ uniforms: lU, vertexShader: LAN_VERT, fragmentShader: lanFrag(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const lan = new THREE.Points(lGeo, lMat);
  lan.frustumCulled = false;
  lan.renderOrder = 3;
  root.add(lan);
  const seal = createSealRing();
  root.add(seal.mesh);

  const pos = new THREE.Vector3(), a = new THREE.Vector3();
  const moonPos = (t: number, out: THREE.Vector3) => {
    if (t < T_HOVER) {
      const k = smooth(0, T_HOVER, t);
      out.lerpVectors(START, HOVER, k);
    } else if (t < T_LEAVE) {
      out.copy(HOVER);
    } else {
      const k = (t - T_LEAVE) / (D - T_LEAVE);
      out.lerpVectors(HOVER, AWAY, k * k * (1.4 - 0.4 * k));
    }
    out.y += Math.sin(t * 0.9) * 0.5;
    out.x += Math.sin(t * 0.35) * 1.2 * smooth(T_HOVER - 1, T_HOVER + 1, t);
    return out;
  };

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      sU.uPulse.value = f.beatPulse; sU.uTime.value = t;
      lU.uT.value = t; lU.uPx.value = pxScale();
      moonPos(t, pos);
      moon.position.copy(pos);
      moon.rotation.y = t * 0.12;
      moon.rotation.z = Math.sin(t * 0.7) * 0.04;
      const s = popScale(t) * (1 + 0.025 * f.beatPulse);
      moon.scale.setScalar(Math.max(0.01, s));
      const open = smooth(T_OPEN - 0.8, T_OPEN, t) * (1 - smooth(T_CLOSE - 0.8, T_CLOSE, t));
      sU.uGlow.value = open;
      cap.position.set(0, -R * 0.93 - open * 3.2, 0);
      cap.rotation.y = open * 2.0;
      gU.uA.value = (0.7 + 0.3 * f.beatPulse) * (0.8 + 0.4 * open);
      lU.uO.value.copy(HOVER);
      // ẩn hẳn khi đã trôi ra ngoài (AWAY xa > 300 m) — đèn trời vẫn bay tiếp tới hết màn
      moon.visible = t < D - 0.05;
      seal.mesh.position.copy(pos);
      seal.update(t, R * 1.25, smooth(0.5, 1.5, t) * (1 - smooth(T_LEAVE, T_LEAVE + 1.5, t)));
    },
    focus(t: number, out: THREE.Vector3) {
      moonPos(t, out);
      if (t > T_REL0 && t < T_LEAVE) out.y -= 6 * smooth(T_REL0, T_REL0 + 1, t);
      a.copy(out);
    },
    dispose() {
      seal.dispose();
      root.removeFromParent();
      sGeo.dispose(); sMat.dispose(); capGeo.dispose(); capMat.dispose(); gGeo.dispose(); gMat.dispose(); lGeo.dispose(); lMat.dispose();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { secretUfo: createMoonLantern };
