// Emotes: biểu tượng cảm xúc nổi lên từ khán giả (8.000 người, sân tới ~62 m).
// 2 draw call: (1) THREE.Points icon (pool 600, atlas 34 icon vẽ canvas — emotesAtlas.ts),
// (2) THREE.Points vệt sáng/quầng (additive) cho icon đặc biệt. Mọi chuyển động trong vertex shader;
// CPU chỉ ghi attribute khi spawn (ring buffer). Hành vi: bay lắc, xoắn ốc, nảy, zig-zag, trôi xoay,
// nổ tỏa, đài phun, đội hình (trái tim). Mẫu đồng bộ: sóng theo phách, đội hình tim, đài phun khi hype vượt 0,8/0,95.
import { fieldY } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { ATLAS_COLS, ATLAS_ROWS, IC, ICON_TINT, drawEmoteAtlas } from './emotesAtlas';

export type EmoteKind = 'heart' | 'star' | 'note' | 'fire' | 'clap' | 'face' | 'hand' | 'text' | 'crown' | 'party';
export interface Emotes {
  update(f: FrameState): void;
  burst(count?: number, kind?: EmoteKind): void;
  /** Đội hình đồng bộ: 'heart' (mặc định) = đội hình trái tim; kind khác = đài phun icon chủ đề đó. */
  formation?(kind?: EmoteKind): void;
  dispose(): void;
}

const COUNT = 600;
const TRAIL_SLOTS = 150;
const GHOSTS = 6; // 0 = quầng, 1..5 = vệt lấp lánh
const B = { FLOAT: 0, SPIRAL: 1, BOUNCE: 2, ZIGZAG: 3, DRIFT: 4, SCATTER: 5, FOUNTAIN: 6, FORM: 7 } as const;

const THEMES: Record<EmoteKind, number[]> = {
  heart: [IC.HEART, IC.HEART, IC.HEART_PINK, IC.HEART_RAINBOW, IC.HEART_EYES, IC.HEARTS2, IC.FHEART, IC.T_YEU, IC.T_LOVE, IC.KISS],
  star: [IC.STAR, IC.STAR, IC.SPARKLE, IC.STARSTRUCK, IC.CROWN],
  note: [IC.NOTE, IC.NOTE, IC.NOTES2, IC.CLEF, IC.MIC],
  fire: [IC.FIRE, IC.FIRE, IC.BOLT, IC.HUNDRED, IC.T_DINH],
  clap: [IC.CLAP, IC.CLAP, IC.RAISE, IC.ROCK],
  face: [IC.SMILE, IC.LAUGH, IC.STARSTRUCK, IC.SCREAM, IC.HEART_EYES],
  hand: [IC.RAISE, IC.CLAP, IC.ROCK, IC.FHEART],
  text: [IC.T_ENCORE, IC.T_LOVE, IC.T_WOW, IC.T_DINH, IC.T_HAY, IC.T_YEU],
  crown: [IC.CROWN, IC.TROPHY, IC.HUNDRED, IC.STAR],
  party: [IC.POPPER, IC.SPARKLE, IC.ROSE, IC.STICK, IC.T_ENCORE],
};
const POOL_LOW = [IC.NOTE, IC.NOTE, IC.NOTES2, IC.SMILE, IC.SMILE, IC.CLAP, IC.CLAP, IC.CLEF, IC.STICK, IC.SPARKLE];
const POOL_MID = [
  ...POOL_LOW, IC.RAISE, IC.RAISE, IC.STAR, IC.STAR, IC.SPARKLE, IC.T_WOW, IC.T_HAY, IC.T_LOVE, IC.ROCK, IC.LAUGH,
  IC.FHEART, IC.MIC, IC.HEART, IC.HEART_PINK,
];
const POOL_HIGH = [
  IC.HEART, IC.HEART, IC.HEART, IC.HEART_PINK, IC.HEART_RAINBOW, IC.HEART_EYES, IC.HEARTS2, IC.FIRE, IC.FIRE, IC.CROWN,
  IC.HUNDRED, IC.T_ENCORE, IC.T_ENCORE, IC.T_DINH, IC.T_YEU, IC.STARSTRUCK, IC.SCREAM, IC.BOLT, IC.ROSE, IC.KISS,
  IC.TROPHY, IC.POPPER, IC.STAR, IC.RAISE, IC.ROCK, IC.FHEART, IC.T_HAY, IC.STICK,
];
const SPECIAL = new Set<number>([IC.CROWN, IC.HUNDRED, IC.TROPHY, IC.STAR, IC.HEART_RAINBOW, IC.T_ENCORE, IC.FIRE, IC.BOLT]);

const MOTION = /* glsl */ `
uniform float uTime;
uniform float uPx;
uniform float uPulse;
vec3 emoteMotion(vec3 p, float age, float t, float seed, float beh, vec3 v, out float rot) {
  float e = 1.0 - pow(1.0 - t, 1.6);
  rot = (seed - 0.5) * 0.5 + sin(age * (1.5 + seed) + seed * 30.0) * 0.16;
  int b = int(beh + 0.5);
  if (b == 0) {
    p.y += e * (2.6 + seed * 2.0);
    p.x += sin(age * (2.0 + seed * 1.5) + seed * 40.0) * 0.35;
  } else if (b == 1) {
    float a = age * (3.0 + seed * 2.0) + seed * 6.283;
    float r = 0.3 + t * 0.9;
    p.x += cos(a) * r; p.z += sin(a) * r;
    p.y += e * (3.0 + seed * 1.5);
    rot += sin(a) * 0.3;
  } else if (b == 2) {
    p.y += t * 2.0 + abs(sin(age * 5.5 + seed * 3.0)) * 0.8 * (1.0 - t);
  } else if (b == 3) {
    float z = abs(fract(age * 0.9 + seed) * 2.0 - 1.0) * 2.0 - 1.0;
    p.x += z * 0.6;
    p.y += e * (3.0 + seed);
    rot = z * 0.35;
  } else if (b == 4) {
    p.y += t * 1.7;
    p.x += (seed - 0.5) * 2.0 * t + sin(age * 1.2 + seed * 9.0) * 0.25;
    rot = (seed < 0.5 ? -1.0 : 1.0) * age * 1.1;
  } else if (b == 5) {
    float k = 1.0 - exp(-age * 3.5);
    p += v * k;
    p.y += age * 0.5;
    rot = v.x * 0.15 * k + sin(age * 3.0 + seed * 9.0) * 0.2;
  } else if (b == 6) {
    p += v * age;
    p.y -= 4.2 * age * age;
    rot = v.x * age * 0.7;
  } else {
    float k = 1.0 - exp(-age * 4.0);
    p += v * k;
    p.y += max(age - 0.7, 0.0) * 1.3 + sin(age * 2.2) * 0.08;
    rot = sin(age * 2.0 + v.x) * 0.08;
  }
  return p;
}
float emotePx(float sizeM, float dist) {
  return clamp(max(16.0, uPx * sizeM / max(dist, 0.1)), 0.0, 96.0);
}
`;

const VERT = /* glsl */ `
${MOTION}
attribute vec4 aPos;  // xyz spawn, w = thời điểm spawn
attribute vec4 aA;    // x icon, y seed, z hành vi, w kích thước (m)
attribute vec4 aB;    // xyz vận tốc/offset, w thời gian sống
varying float vAlpha;
varying float vIcon;
varying float vRot;
varying vec2 vSquash;
varying float vTw;
void main() {
  float age = uTime - aPos.w;
  float life = aB.w;
  float t = age / life;
  if (t < 0.0 || t > 1.0) {
    vAlpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  float seed = aA.y;
  vIcon = aA.x;
  float rot;
  vec3 p = emoteMotion(aPos.xyz, age, t, seed, aA.z, aB.xyz, rot);
  vRot = rot;
  // pop khi xuất hiện + squash & stretch tắt dần
  float grow = smoothstep(0.0, 0.14, age);
  float pop = grow * (1.0 + 0.35 * exp(-age * 6.0) * sin(age * 14.0)) * (1.0 + 0.07 * uPulse);
  float w = sin(age * 17.0) * exp(-age * 5.0);
  vSquash = vec2(1.0 + 0.3 * w, 1.0 - 0.3 * w);
  float ic = aA.x;
  float sparkly = (abs(ic - 9.0) < 0.5 || abs(ic - 10.0) < 0.5 || abs(ic - 7.0) < 0.5 || abs(ic - 2.0) < 0.5) ? 1.0 : 0.25;
  vTw = 1.0 + sparkly * (0.5 * pow(abs(sin(age * 7.0 + seed * 20.0)), 6.0) - 0.08);
  vAlpha = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.72, 1.0, t));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = emotePx(aA.w, -mv.z) * pop * 1.3;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
varying float vIcon;
varying float vRot;
varying vec2 vSquash;
varying float vTw;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  q = mat2(c, -s, s, c) * q;
  q = q * 1.3 / vSquash;
  vec2 uv = q + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  float col = mod(vIcon, ${ATLAS_COLS.toFixed(1)});
  float row = floor(vIcon / ${ATLAS_COLS.toFixed(1)} + 0.001);
  vec2 auv = vec2((col + uv.x) / ${ATLAS_COLS.toFixed(1)}, 1.0 - (row + uv.y) / ${ATLAS_ROWS.toFixed(1)});
  vec4 tc = texture2D(uMap, auv);
  float a = tc.a * vAlpha;
  if (a < 0.02) discard;
  gl_FragColor = vec4(tc.rgb * 1.08 * vTw, a);
}`;

const TRAIL_VERT = /* glsl */ `
${MOTION}
attribute vec4 aPos;
attribute vec4 aA;
attribute vec4 aB;
attribute vec3 aTint;
attribute float aGhost;
varying float vAlpha;
varying vec3 vTint;
varying float vGhost;
void main() {
  float lag = aGhost * 0.075;
  float age = uTime - aPos.w - lag;
  float life = aB.w;
  float t = age / life;
  if (t < 0.0 || t > 1.0 || aPos.w < -100.0) {
    vAlpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  float rot;
  vec3 p = emoteMotion(aPos.xyz, age, t, aA.y, aA.z, aB.xyz, rot);
  vTint = aTint;
  vGhost = aGhost;
  float fade = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.6, 1.0, t));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = emotePx(aA.w, -mv.z);
  if (aGhost < 0.5) {
    vAlpha = fade * (0.22 + 0.12 * uPulse);
    gl_PointSize = px * 1.6;
  } else {
    vAlpha = fade * (1.0 - aGhost / ${(GHOSTS + 0.5).toFixed(1)}) * (0.75 + 0.25 * sin(uTime * 20.0 + aGhost * 2.0 + aA.y * 30.0));
    gl_PointSize = max(8.0, px * (0.55 - aGhost * 0.07));
  }
}`;

const TRAIL_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vTint;
varying float vGhost;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  float a;
  vec3 col;
  if (vGhost < 0.5) {
    a = exp(-d * d * 3.5) * (1.0 - smoothstep(0.85, 1.0, d));
    col = vTint;
  } else {
    float core = exp(-d * d * 14.0);
    float rays = exp(-abs(q.x) * 40.0) * exp(-abs(q.y) * 5.0) + exp(-abs(q.y) * 40.0) * exp(-abs(q.x) * 5.0);
    a = clamp(core + rays * 0.8, 0.0, 1.0) * (1.0 - smoothstep(0.9, 1.0, d));
    col = mix(vTint, vec3(1.0), core);
  }
  a *= vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

interface Spawn {
  icon: number;
  x: number;
  y: number;
  z: number;
  delay?: number;
  beh: number;
  size: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  trail?: boolean;
}

const rnd = Math.random;
const pickOf = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];

/** Hành vi hợp với từng loại icon. */
function behFor(icon: number): number {
  const r = rnd();
  if (icon >= IC.T_ENCORE) return r < 0.6 ? B.BOUNCE : B.FLOAT;
  if (icon === IC.NOTE || icon === IC.NOTES2 || icon === IC.CLEF) return r < 0.55 ? B.ZIGZAG : B.FLOAT;
  if (icon === IC.STAR || icon === IC.SPARKLE) return r < 0.5 ? B.SPIRAL : B.DRIFT;
  if (icon === IC.ROSE || icon === IC.POPPER || icon === IC.STICK) return B.DRIFT;
  if (icon >= IC.SMILE && icon <= IC.SCREAM) return r < 0.5 ? B.BOUNCE : B.FLOAT;
  if (icon <= IC.HEARTS2) return r < 0.3 ? B.SPIRAL : r < 0.5 ? B.BOUNCE : B.FLOAT;
  return r < 0.2 ? B.SPIRAL : r < 0.4 ? B.BOUNCE : r < 0.55 ? B.ZIGZAG : r < 0.7 ? B.DRIFT : B.FLOAT;
}

/** Cao độ đầu khán giả tại bán kính r (sàn khán giả theo world/layout). */
const headY = (r: number) => fieldY(r) + 1.9;

/** Điểm ngẫu nhiên trên sân khán giả (tránh catwalk/bục tròn). bigOffCentre: tránh ±8° giữa tầm nhìn. */
function fieldSpot(rMin = 8, rMax = 62, bigOffCentre = false, maxDeg = 75): { x: number; y: number; z: number; r: number } {
  const r = rMin + (rMax - rMin) * Math.pow(rnd(), 1.4);
  const half = THREE.MathUtils.degToRad(Math.min(maxDeg, 50 + 25 * Math.min(1, (r - 8) / 22)));
  let ang = (rnd() * 2 - 1) * half;
  if (bigOffCentre && Math.abs(ang) < 0.15) ang = (ang < 0 ? -1 : 1) * (0.15 + rnd() * 0.35);
  let x = Math.sin(ang) * r;
  let z = -Math.cos(ang) * r;
  if (z > -27 && Math.abs(x) < 2.5) x = (x < 0 ? -1 : 1) * (2.5 + rnd() * 1.5);
  const dx = x;
  const dz = z + 26;
  const dp = Math.hypot(dx, dz);
  if (dp < 4.6) {
    const k = (4.6 + rnd()) / Math.max(dp, 0.01);
    x = dx * k;
    z = -26 + dz * k;
  }
  return { x, y: headY(r) + rnd() * 0.5, z, r };
}

export function createEmotes(scene: THREE.Scene): Emotes {
  // ── icon ──
  const posA = new Float32Array(COUNT * 4);
  const aAarr = new Float32Array(COUNT * 4);
  const aBarr = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    posA[i * 4 + 3] = -1000;
    aBarr[i * 4 + 3] = 1;
  }
  const geo = new THREE.BufferGeometry();
  const attrPos = new THREE.BufferAttribute(posA, 4).setUsage(THREE.DynamicDrawUsage);
  const attrA = new THREE.BufferAttribute(aAarr, 4).setUsage(THREE.DynamicDrawUsage);
  const attrB = new THREE.BufferAttribute(aBarr, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3)); // giả
  geo.setAttribute('aPos', attrPos);
  geo.setAttribute('aA', attrA);
  geo.setAttribute('aB', attrB);

  const atlas = drawEmoteAtlas();
  const tex = new THREE.CanvasTexture(atlas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const uniforms = {
    uTime: { value: 0 },
    uPx: { value: 600 },
    uPulse: { value: 0 },
    uMap: { value: tex },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);

  // ── vệt sáng / quầng (additive) ──
  const TN = TRAIL_SLOTS * GHOSTS;
  const tPos = new Float32Array(TN * 4);
  const tA = new Float32Array(TN * 4);
  const tB = new Float32Array(TN * 4);
  const tTint = new Float32Array(TN * 3);
  const tGhost = new Float32Array(TN);
  for (let i = 0; i < TN; i++) {
    tPos[i * 4 + 3] = -1000;
    tB[i * 4 + 3] = 1;
    tGhost[i] = i % GHOSTS;
  }
  const tgeo = new THREE.BufferGeometry();
  const tAttrPos = new THREE.BufferAttribute(tPos, 4).setUsage(THREE.DynamicDrawUsage);
  const tAttrA = new THREE.BufferAttribute(tA, 4).setUsage(THREE.DynamicDrawUsage);
  const tAttrB = new THREE.BufferAttribute(tB, 4).setUsage(THREE.DynamicDrawUsage);
  const tAttrTint = new THREE.BufferAttribute(tTint, 3).setUsage(THREE.DynamicDrawUsage);
  tgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 3), 3));
  tgeo.setAttribute('aPos', tAttrPos);
  tgeo.setAttribute('aA', tAttrA);
  tgeo.setAttribute('aB', tAttrB);
  tgeo.setAttribute('aTint', tAttrTint);
  tgeo.setAttribute('aGhost', new THREE.BufferAttribute(tGhost, 1));
  const tmat = new THREE.ShaderMaterial({
    vertexShader: TRAIL_VERT,
    fragmentShader: TRAIL_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const trails = new THREE.Points(tgeo, tmat);
  trails.frustumCulled = false;
  trails.renderOrder = 9;
  scene.add(trails);

  let time = 0;
  let head = 0;
  let thead = 0;
  let acc = 0;
  let prevPulse = 0;
  let prevBar = -1;
  let prevHype = 0;
  let armed80 = true;
  let armed95 = true;
  let formCool = 4;
  let dirty = false;
  let tdirty = false;

  const spawn = (s: Spawn) => {
    const i = head;
    head = (head + 1) % COUNT;
    const seed = rnd();
    const t0 = time + (s.delay ?? 0);
    posA.set([s.x, s.y, s.z, t0], i * 4);
    aAarr.set([s.icon, seed, s.beh, s.size], i * 4);
    aBarr.set([s.vx ?? 0, s.vy ?? 0, s.vz ?? 0, s.life], i * 4);
    dirty = true;
    if (s.trail) {
      const tint = ICON_TINT[s.icon] ?? [1, 1, 1];
      for (let k = 0; k < GHOSTS; k++) {
        const j = thead * GHOSTS + k;
        tPos.set([s.x, s.y, s.z, t0], j * 4);
        tA.set([s.icon, seed, s.beh, s.size], j * 4);
        tB.set([s.vx ?? 0, s.vy ?? 0, s.vz ?? 0, s.life], j * 4);
        tTint.set(tint, j * 3);
      }
      thead = (thead + 1) % TRAIL_SLOTS;
      tdirty = true;
    }
  };

  const sizeFor = (r: number) => (0.55 + rnd() * 0.35) * (1 + r / 45);

  /** Một emote thường trên sân; đôi khi là emote "hero" lớn gần sân khấu (có quầng + vệt). */
  const ambient = (icon: number, heroChance: number) => {
    const hero = rnd() < heroChance;
    const p = hero ? fieldSpot(8, 20, true) : fieldSpot();
    const beh = behFor(icon);
    spawn({
      icon,
      x: p.x,
      y: p.y,
      z: p.z,
      beh,
      size: hero ? 1.25 + rnd() * 0.55 : sizeFor(p.r),
      life: (beh === B.DRIFT ? 3.6 : 2.6) + rnd() * 1.0,
      trail: hero || (SPECIAL.has(icon) && rnd() < 0.35),
    });
  };

  const pickIcon = (h: number) => pickOf(h < 0.45 ? POOL_LOW : h < 0.78 ? POOL_MID : POOL_HIGH);

  /** Đội hình trái tim bằng các icon tim, mở ra từ một điểm rồi cùng bay lên. */
  const heartFormation = (centre?: { x: number; y: number; z: number; r: number }) => {
    const c = centre ?? fieldSpot(14, 30, true, 30);
    const len = Math.hypot(c.x, c.z);
    const rx = -c.z / len; // vector ngang vuông góc hướng nhìn
    const rz = c.x / len;
    const N = 28;
    const sc = 0.11 + c.r * 0.004;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(a), 3) * sc;
      const hy = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * sc;
      spawn({
        icon: pickOf(THEMES.heart.slice(0, 6)),
        x: c.x,
        y: c.y + 1.2,
        z: c.z,
        vx: rx * hx,
        vy: hy + 2.2,
        vz: rz * hx,
        beh: B.FORM,
        size: 0.6 + c.r * 0.012,
        life: 3.4,
        delay: k * 0.012,
        trail: k % 4 === 0,
      });
    }
    spawn({ icon: IC.HEART_EYES, x: c.x, y: c.y + 1.2, z: c.z, vy: 2.2, beh: B.FORM, size: 1.1 + c.r * 0.02, life: 3.4, delay: 0.2, trail: true });
  };

  /** Đài phun: cột icon bắn thẳng lên rồi rơi tỏa. */
  const fountain = (icons: readonly number[], n = 36) => {
    const c = fieldSpot(12, 28, true, 38);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const sp = 0.4 + rnd() * 1.1;
      spawn({
        icon: pickOf(icons),
        x: c.x,
        y: c.y,
        z: c.z,
        vx: Math.cos(a) * sp,
        vy: 6.5 + rnd() * 3,
        vz: Math.sin(a) * sp,
        beh: B.FOUNTAIN,
        size: 0.55 + c.r * 0.02,
        life: 2.3 + rnd() * 0.4,
        delay: k * 0.035,
        trail: k % 3 === 0,
      });
    }
  };

  /** Sóng: cùng một icon quét ngang đám đông (trái → phải) theo phách. */
  const wave = (icon: number) => {
    const r = 14 + rnd() * 22;
    const n = 30;
    const half = THREE.MathUtils.degToRad(62);
    const dir = rnd() < 0.5 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const ang = dir * (-half + (2 * half * k) / (n - 1));
      const x = Math.sin(ang) * r;
      const z = -Math.cos(ang) * r;
      if (z > -27 && Math.abs(x) < 2.5) continue;
      spawn({ icon, x, y: headY(r) + 0.2, z, beh: B.BOUNCE, size: 0.6 + r * 0.02, life: 1.9, delay: (k / n) * 0.9 });
    }
  };

  /** Nổ tỏa từ một điểm. */
  const scatter = (icons: readonly number[], n: number, near = false) => {
    const c = near ? fieldSpot(9, 22, true, 45) : fieldSpot(9, 45, false, 50);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const sp = 1.2 + rnd() * 2.2;
      spawn({
        icon: pickOf(icons),
        x: c.x,
        y: c.y + 0.5,
        z: c.z,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.8 + 1.2,
        vz: (rnd() - 0.5) * 1.5,
        beh: B.SCATTER,
        size: 0.6 + c.r * 0.018,
        life: 2.2 + rnd() * 0.6,
        trail: k < 3,
      });
    }
  };

  const flush = () => {
    if (dirty) {
      attrPos.needsUpdate = attrA.needsUpdate = attrB.needsUpdate = true;
      dirty = false;
    }
    if (tdirty) {
      tAttrPos.needsUpdate = tAttrA.needsUpdate = tAttrB.needsUpdate = tAttrTint.needsUpdate = true;
      tdirty = false;
    }
  };

  const formation = (kind: EmoteKind = 'heart') => {
    if (kind === 'heart') heartFormation();
    else fountain(THEMES[kind]);
    flush();
  };

  return {
    update(f) {
      const dt = Math.min(f.dt, 0.1);
      time += dt;
      uniforms.uTime.value = time;
      uniforms.uPx.value = window.innerHeight * 0.75;
      uniforms.uPulse.value = f.beatPulse;
      const h = f.hype;
      const rate = h < 0.15 ? 0.5 : 0.5 + 26 * Math.pow(h, 1.8);
      acc += rate * dt;
      const heroChance = h < 0.45 ? 0.03 : h < 0.78 ? 0.06 : 0.1;
      while (acc >= 1) {
        acc -= 1;
        ambient(pickIcon(h), heroChance);
      }
      if (f.beatPulse > 0.8 && prevPulse <= 0.8 && h > 0.3) {
        const n = h > 0.7 ? 3 : 1;
        for (let k = 0; k < n; k++) ambient(pickIcon(h), 0);
      }
      prevPulse = f.beatPulse;
      // sóng mỗi 8 phách
      const bar = Math.floor(f.beat / 8);
      if (bar !== prevBar) {
        if (prevBar >= 0 && h > 0.55 && rnd() < 0.7) wave(pickIcon(h));
        prevBar = bar;
      }
      // đài phun khi hype vượt 0,8 / 0,95
      if (armed80 && prevHype < 0.8 && h >= 0.8) {
        fountain(POOL_HIGH);
        armed80 = false;
      }
      if (armed95 && prevHype < 0.95 && h >= 0.95) {
        fountain([IC.CROWN, IC.HUNDRED, IC.T_ENCORE, IC.FIRE, IC.HEART_RAINBOW, IC.STAR], 48);
        armed95 = false;
      }
      if (h < 0.72) armed80 = true;
      if (h < 0.88) armed95 = true;
      prevHype = h;
      // đội hình tim định kỳ khi hype cao
      formCool -= dt;
      if (h > 0.85 && formCool <= 0) {
        heartFormation();
        formCool = 7 + rnd() * 4;
      }
      flush();
    },
    burst(count = 40, kind) {
      const n = Math.max(1, Math.min(count, COUNT - 60));
      if (kind) {
        const icons = THEMES[kind];
        if (kind === 'heart') heartFormation();
        const sc = Math.floor(n * 0.4);
        scatter(icons, Math.ceil(sc / 2), true);
        scatter(icons, Math.floor(sc / 2));
        for (let k = sc; k < n; k++) ambient(pickOf(icons), 0.08);
      } else {
        const all = [...POOL_HIGH, ...THEMES.text, ...THEMES.party];
        const sc = Math.floor(n * 0.45);
        scatter(all, Math.ceil(sc / 3), true);
        scatter(all, Math.ceil(sc / 3));
        scatter(all, Math.floor(sc / 3));
        for (let k = sc; k < n; k++) ambient(pickOf(all), 0.08);
        fountain(all, 24);
      }
      flush();
    },
    formation,
    dispose() {
      scene.remove(points, trails);
      geo.dispose();
      tgeo.dispose();
      mat.dispose();
      tmat.dispose();
      tex.dispose();
    },
  };
}
