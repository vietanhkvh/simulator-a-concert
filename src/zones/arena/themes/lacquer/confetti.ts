// "Mực & Sơn mài · bản Việt" · khe confetti (L6): VÀNG LÁ + CÁNH HOA ĐÀO / SEN + DẢI GIẤY SON-VÀNG rơi chậm, chao lượn.
// Cùng hợp đồng với arena/confetti.ts (burst() + tự nổ khi Hype vượt 0,9, hồi chiêu 12 s): 1 THREE.Points ~600 mảnh,
// chuyển động trong vertex shader. Vàng lá = ô vuông xé mép (răng cưa ngẫu nhiên) loé sáng khi lật; cánh hoa = giọt
// bầu có khía; dải giấy = thanh mảnh son viền vàng. 1 draw call khi đang rơi, 0 khi rảnh.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FIELD_Y } from '../../../../world/layout';
import { viewHeightPx } from '../../../../world/shared/viewport';
import { mixHex, RAMPS } from '../../../../world/style';
import type { ArenaBuilders, Confetti } from '../../builders';

const COUNT = 600;
const LIFE = 11;
const COOLDOWN = 12;

const VERT = /* glsl */ `
uniform float uTime; uniform float uStart; uniform float uPx;
attribute vec4 aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vFlip; varying float vRot; varying float vGlint; varying float vSeed;
void main() {
  float age = uTime - uStart - aSeed.w * 1.5;
  float k = clamp(age, 0.0, 100.0);
  vec3 p = vec3((aSeed.x - 0.5) * 30.0, 10.0 + aSeed.y * 5.0, -5.0 - aSeed.z * 22.0);
  vShape = floor(fract(aSeed.z * 7.13 + aSeed.x * 3.7) * 3.0); // 0 vàng lá, 1 cánh hoa, 2 dải giấy
  float fall = vShape > 1.5 ? 1.4 + aSeed.y * 0.6 : 0.9 + aSeed.y * 0.8;
  p.y -= fall * k;
  // chao lượn kiểu lá rơi: lắc ngang biên độ lớn, chậm
  float sw = k * (0.9 + aSeed.z * 0.8) + aSeed.x * 40.0;
  p.x += sin(sw) * 1.4;
  p.z += cos(k * (0.7 + aSeed.x) + aSeed.y * 30.0) * 1.0;
  p.y += abs(cos(sw)) * 0.35;
  float flip = sin(k * (2.5 + aSeed.x * 3.0) + aSeed.z * 20.0);
  vFlip = 0.2 + 0.8 * abs(flip);
  vRot = sin(sw) * 0.9 + aSeed.x * 6.28 + (vShape > 1.5 ? k * (aSeed.y - 0.5) * 2.0 : 0.0);
  vGlint = smoothstep(0.85, 1.0, flip);
  vColor = aColor * (0.78 + 0.22 * flip);
  vSeed = aSeed.x * 13.7 + aSeed.y * 7.1;
  float fadeOut = 1.0 - smoothstep(${(LIFE - 3).toFixed(1)}, ${LIFE.toFixed(1)}, age + aSeed.w * 1.5);
  vAlpha = (age < 0.0 || p.y < ${(FIELD_Y + 0.3).toFixed(2)}) ? 0.0 : fadeOut;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(2.0, uPx * (0.22 + aSeed.y * 0.1) / -mv.z);
}`;

const frag = (glint: [number, number, number], edge: [number, number, number]) => /* glsl */ `
varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vFlip; varying float vRot; varying float vGlint; varying float vSeed;
float h(float x){ return fract(sin(x * 91.7 + vSeed * 13.1) * 43758.5); }
void main() {
  if (vAlpha < 0.01) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0; p.y = -p.y;
  float c = cos(vRot), s = sin(vRot);
  p = mat2(c, -s, s, c) * p;
  p.x /= vFlip;
  float m; vec3 col = vColor;
  if (vShape < 0.5) {
    // vàng lá: ô vuông mép xé (biên răng cưa theo góc)
    float a = atan(p.y, p.x);
    float tear = 0.06 * (h(floor(a * 3.0)) - 0.5) + 0.04 * sin(a * 11.0 + vSeed);
    vec2 q = abs(p);
    m = step(max(q.x, q.y), 0.5 + tear);
    col = mix(col, vec3(${glint.join(', ')}), vGlint * 0.8);
  } else if (vShape < 1.5) {
    // cánh hoa: giọt bầu, khía ở đầu
    vec2 q = vec2(p.x, p.y + 0.15);
    float w = 0.42 * (1.0 - 0.45 * smoothstep(-0.6, 0.7, -q.y));
    m = smoothstep(1.0, 0.85, length(vec2(q.x / w, q.y / 0.68)));
    m *= 1.0 - smoothstep(0.1, 0.0, length(vec2(q.x * 2.2, q.y - 0.66)) - 0.1);
    col = mix(col, col * 1.15, smoothstep(0.2, -0.5, q.y));
  } else {
    // dải giấy son, viền vàng
    vec2 q = vec2(p.x, p.y - 0.2 * sin(p.x * 2.5));
    m = step(abs(q.y), 0.12) * step(abs(q.x), 0.85);
    col = mix(vec3(${edge.join(', ')}), col, step(abs(q.y), 0.07));
  }
  if (m < 0.02) discard;
  gl_FragColor = vec4(col, vAlpha * m);
}`;

export function createLacquerConfetti(scene: THREE.Scene): Confetti {
  const gold = RAMPS.gold!, son = RAMPS.son!;
  const c3 = (hex: number) => new THREE.Color(hex).convertLinearToSRGB();
  const v3 = (hex: number) => { const c = c3(hex); return [c.r, c.g, c.b].map((x) => x.toFixed(4)) as unknown as [number, number, number]; };
  const goldCols = [gold[500], gold[300], mixHex(gold[500], gold[700], 0.4)].map(c3);
  const petalCols = [son[100], mixHex(son[300], son[100], 0.5), son[300]].map(c3);
  const stripCols = [son[500], son[700]].map(c3);
  const seed = new Float32Array(COUNT * 4), col = new Float32Array(COUNT * 3);
  let s = 4242;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < COUNT; i++) {
    const sd = [rnd(), rnd(), rnd(), rnd()];
    seed.set(sd, i * 4);
    const shape = Math.floor(((sd[2] * 7.13 + sd[0] * 3.7) % 1) * 3);
    const pal = shape === 0 ? goldCols : shape === 1 ? petalCols : stripCols;
    const c = pal[Math.floor(rnd() * pal.length)];
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const uniforms = { uTime: { value: 0 }, uStart: { value: -1000 }, uPx: { value: 600 } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag(v3(gold[100]), v3(gold[500])), uniforms, transparent: true, depthWrite: false, fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 5;
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
      if (points.visible && time - uniforms.uStart.value > LIFE + 1.5) points.visible = false;
    },
    burst,
    dispose() { scene.remove(points); geo.dispose(); mat.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { confetti: (c) => createLacquerConfetti(c.scene) };
