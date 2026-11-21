// "Thép & Lửa" · khe confetti (gói S3): TÀN LỬA thay pháo giấy. Mảnh tàn hồng + tia lửa BAY LÊN, trôi ngang theo gió nóng,
// nguội dần theo bậc màu (trắng nung → cam → đỏ than → tối), kèm ít vảy TRO xám rơi xuống. Hình: tam giác / tứ giác cạnh
// thẳng (không tròn). Cùng hợp đồng với arena/confetti.ts (burst() + tự nổ khi Hype vượt 0,9, hồi chiêu 12 s):
// 1 THREE.Points ~700 hạt, chuyển động trong vertex shader, additive cho tàn lửa. 1 draw call khi đang bay, 0 khi rảnh.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FIELD_Y } from '../../../../world/layout';
import { viewHeightPx } from '../../../../world/shared/viewport';
import { PAL, RAMPS } from '../../../../world/style';
import type { ArenaBuilders, Confetti } from '../../builders';

const COUNT = 700;
const LIFE = 9;
const COOLDOWN = 12;

const glsl3 = (hex: number) => {
  const c = new THREE.Color(hex).convertLinearToSRGB();
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

function shaders() {
  const r = (n: string, k: 100 | 300 | 500 | 700, fb: number) => RAMPS[n]?.[k] ?? fb;
  const hot = glsl3(r('flame', 300, PAL.honey[300]));
  const yel = glsl3(r('flame', 500, PAL.berry[500]));
  const spk = glsl3(r('whitehot', 500, PAL.honey[500]));
  const org = glsl3(r('ember', 300, PAL.berry[500]));
  const red = glsl3(r('blood', 300, PAL.peach[700]));
  const dark = glsl3(r('ember', 700, PAL.night[300]));
  const ash = glsl3(r('steel', 300, PAL.grape[300]));
  const vert = /* glsl */ `
uniform float uTime; uniform float uStart; uniform float uPx;
attribute vec4 aSeed;
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot; varying float vAsh; varying float vBig;
void main() {
  float age = uTime - uStart - aSeed.w * 2.0;
  float k = clamp(age, 0.0, 100.0);
  float isAsh = step(0.86, fract(aSeed.z * 7.13 + aSeed.x * 3.7));
  float spark = step(0.6, fract(aSeed.y * 5.31 + aSeed.w * 2.1)) * (1.0 - isAsh);
  vShape = floor(fract(aSeed.x * 11.7 + aSeed.y * 2.3) * 2.0) + 2.0 * spark; // 0 tam giác, 1 tứ giác, 2-3 tia
  vec3 p;
  if (isAsh > 0.5) {
    // tro: từ trên cao rơi chậm, lắc
    p = vec3((aSeed.x - 0.5) * 34.0, 12.0 + aSeed.y * 6.0, -6.0 - aSeed.z * 26.0);
    p.y -= (0.5 + aSeed.y * 0.4) * k;
    p.x += sin(k * (0.8 + aSeed.z) + aSeed.x * 30.0) * 0.9;
    p.z += cos(k * 0.6 + aSeed.y * 20.0) * 0.6;
  } else {
    // tàn lửa: bốc lên từ phía sân khấu / trước đám đông, nhanh lúc đầu, chậm dần; gió nóng đẩy ngang, xoáy nhẹ
    p = vec3((aSeed.x - 0.5) * 26.0, ${(FIELD_Y + 1.0).toFixed(2)} + aSeed.y * 3.0, -5.0 - aSeed.z * 20.0);
    float up = (spark > 0.5 ? 4.5 : 2.2) + aSeed.y * 1.8;
    p.y += up * (1.0 - exp(-k * 0.55)) / 0.55;
    p.x += k * (aSeed.w - 0.4) * 1.4 + sin(k * (1.7 + aSeed.z * 2.0) + aSeed.x * 40.0) * 0.6;
    p.z += cos(k * (1.3 + aSeed.x) + aSeed.y * 30.0) * 0.5;
  }
  vRot = aSeed.x * 6.28 + k * (aSeed.z - 0.5) * 6.0;
  // bậc màu theo tuổi: trắng nung → vàng → cam → đỏ than → tối (bậc rời, không chuyển mượt)
  float life = k / ${LIFE.toFixed(1)} * (0.7 + 0.6 * aSeed.y);
  float stp = floor(life * 6.0) - 1.0 + step(0.5, spark) * 0.0;
  float big = step(0.9, fract(aSeed.w * 17.3 + aSeed.z * 3.1)) * (1.0 - isAsh) * (1.0 - spark);
  vBig = big;
  vec3 c = spark > 0.5 && stp < 1.5 ? ${spk} : stp < 0.5 ? ${hot} : (stp < 1.5 ? ${yel} : (stp < 2.5 ? ${org} : (stp < 3.5 ? ${red} : ${dark})));
  float flick = 0.7 + 0.3 * step(0.5, fract(sin(floor(uTime * 12.0) + aSeed.x * 91.0) * 437.5));
  vColor = isAsh > 0.5 ? ${ash} * 0.35 : c * flick * (stp < 4.0 ? 1.0 : 0.4);
  vAsh = isAsh;
  float fadeOut = 1.0 - smoothstep(${(LIFE - 2.5).toFixed(1)}, ${LIFE.toFixed(1)}, age + aSeed.w * 2.0);
  vAlpha = (age < 0.0 || p.y < ${(FIELD_Y + 0.2).toFixed(2)}) ? 0.0 : fadeOut;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = isAsh > 0.5 ? 0.14 : (spark > 0.5 ? 0.22 : 0.2 + aSeed.y * 0.12);
  sz *= 1.0 + 2.2 * big;
  gl_PointSize = max(2.0, uPx * sz / -mv.z);
}`;
  const frag = /* glsl */ `
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot; varying float vAsh; varying float vBig;
void main() {
  if (vAlpha < 0.01) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0; p.y = -p.y;
  if (vBig > 0.5) {
    // mảnh tàn lớn: tứ giác lõi sáng + quầng ấm
    vec2 q = p * 2.4;
    float cs = cos(vRot), sn = sin(vRot);
    q = mat2(cs, -sn, sn, cs) * q;
    float core = step(max(abs(q.x + q.y * 0.3) - 0.45, abs(q.y) - 0.32), 0.0);
    float glow = exp(-dot(p, p) * 5.0) * 0.55;
    if (core + glow < 0.02) discard;
    gl_FragColor = vec4(vColor * vAlpha * (core * 1.2 + glow), 0.0);
    return;
  }
  float c = cos(vRot), s = sin(vRot);
  p = mat2(c, -s, s, c) * p;
  float m;
  if (vShape < 0.5) {            // tam giác
    m = step(max(-p.y - 0.45, max(dot(p, vec2(0.866, 0.5)), dot(p, vec2(-0.866, 0.5))) - 0.45), 0.0);
  } else if (vShape < 1.5) {     // tứ giác lệch
    m = step(max(abs(p.x + p.y * 0.3) - 0.42, abs(p.y) - 0.3), 0.0);
  } else {                       // tia lửa: vệt mảnh dài
    m = step(max(abs(p.x) - 0.09, abs(p.y) - 0.85), 0.0);
  }
  if (m < 0.5) discard;
  float a = vAlpha * (vAsh > 0.5 ? 0.8 : 1.0);
  gl_FragColor = vec4(vColor * a, vAsh > 0.5 ? a : 0.0);
}`;
  return { vert, frag };
}

export function createSteelConfetti(scene: THREE.Scene): Confetti {
  const seed = new Float32Array(COUNT * 4);
  let s = 9173;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < COUNT * 4; i++) seed[i] = rnd();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const uniforms = { uTime: { value: 0 }, uStart: { value: -1000 }, uPx: { value: 600 } };
  const { vert, frag } = shaders();
  // Premultiplied: tàn lửa cộng sáng (alpha 0), tro che (alpha > 0) — một material, một draw call.
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 5;
  points.name = 'confetti-embers';
  scene.add(points);
  let time = 0, lastBurst = -1000, prevHype = 0;
  const burst = () => { uniforms.uStart.value = time; lastBurst = time; points.visible = true; };
  return {
    update(f: FrameState) {
      time += Math.min(f.dt, 0.1);
      uniforms.uTime.value = time;
      uniforms.uPx.value = viewHeightPx() * 1.2;
      if (f.hype > 0.9 && prevHype <= 0.9 && time - lastBurst >= COOLDOWN) burst();
      prevHype = f.hype;
      if (points.visible && time - uniforms.uStart.value > LIFE + 2.5) points.visible = false;
    },
    burst,
    dispose() { scene.remove(points); geo.dispose(); mat.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { confetti: (c) => createSteelConfetti(c.scene) };
