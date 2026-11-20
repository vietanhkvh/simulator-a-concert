// P1 — Khán giả instanced + lightstick. Toàn bộ chuyển động trong vertex shader (crowd.vert.glsl),
// buffer instance tĩnh sau khi khởi tạo, 2 draw call (thân: blend thường; lightstick: additive).
// Quy ước không gian: ca sĩ đứng tại gốc tọa độ nhìn về -Z; khán giả ở z < -6, sàn y = 0.
import * as THREE from 'three';
import type { CrowdOptions, FrameState, Updatable } from '../core/types';
import vert from './crowd.vert.glsl?raw';
import frag from './crowd.frag.glsl?raw';

/** Bán kính hàng đầu (m) và khoảng cách giữa các hàng / người. */
const R0 = 6.5;
const SPACING = 0.55;
const JITTER = 0.15;
/** Sàn dốc lên phía sau (m cao / m xa). */
const SLOPE = 0.05;
/**
 * Cao độ sàn khán giả ở hàng đầu. Sân khấu (P6) có mặt sàn y = 0, camera mắt ca sĩ y = 1,65,
 * sân khấu cao 1,5 m so với khán giả (docs/discussion/02-gamedev.md §2) → sàn khán giả y = -1,5.
 */
export const CROWD_FLOOR_Y = -1.5;

const COLOR_A = new THREE.Color(1.0, 0.18, 0.62); // hồng
const COLOR_B = new THREE.Color(0.2, 0.72, 1.0); // xanh cyan

/** PRNG có seed để bố trí giống nhau mỗi lần tải. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Person {
  x: number;
  y: number;
  z: number;
  dist: number;
  angleN: number;
  distN: number;
}

function layout(opts: CrowdOptions, rand: () => number): Person[] {
  const count = Math.max(1, Math.floor(opts.count));
  const arc = (Math.max(10, Math.min(180, opts.arcDeg)) * Math.PI) / 180;
  // Số hàng: theo opts.rows nhưng đủ để mật độ ~SPACING dọc cung.
  let rows = Math.max(1, Math.floor(opts.rows));
  const arcLenTotal = (r: number) => {
    let s = 0;
    for (let i = 0; i < r; i++) s += arc * (R0 + i * SPACING);
    return s;
  };
  while (rows > 4 && arcLenTotal(rows) / count > SPACING * 1.6) rows--;
  while (arcLenTotal(rows) / count < SPACING * 0.85) rows++;
  const total = arcLenTotal(rows);
  const rMax = R0 + (rows - 1) * SPACING;

  const people: Person[] = [];
  let placed = 0;
  for (let i = 0; i < rows; i++) {
    const r = R0 + i * SPACING;
    const n = i === rows - 1 ? count - placed : Math.round((count * arc * r) / total);
    for (let j = 0; j < n && placed < count; j++, placed++) {
      const t = (j + 0.5) / n;
      const a = (t - 0.5) * arc;
      const rr = r + (rand() * 2 - 1) * JITTER;
      const aa = a + ((rand() * 2 - 1) * JITTER) / r;
      const x = Math.sin(aa) * rr;
      const z = -Math.cos(aa) * rr;
      people.push({
        x,
        y: CROWD_FLOOR_Y + (rr - R0) * SLOPE,
        z,
        dist: rr,
        angleN: aa / (arc / 2),
        distN: (rr - R0) / Math.max(1e-3, rMax - R0),
      });
    }
  }
  // Xa trước gần sau: viền mềm của bóng blend đúng thứ tự.
  people.sort((p, q) => q.dist - p.dist);
  return people;
}

/**
 * "Biển đèn flash điện thoại" (đoạn nhạc lắng). Một phần khán giả (tối đa ~60%) giơ đèn flash
 * điện thoại trắng/trắng ấm thay cho lightstick; lightstick những người còn lại mờ đi.
 * Điều khiển: crowd.setFlash(0..1) (làm mượt ~1,5 s). Nếu chưa từng gọi setFlash, update(f) tự
 * suy ra: level làm mượt ~3 s < FLASH_AUTO.levelOn và hype < FLASH_AUTO.hypeMax → 1, ngược lại → 0
 * (tắt lại khi level > levelOff, có trễ để không chập chờn). Không thêm draw call, không cập nhật buffer.
 */
export const FLASH_AUTO = { levelOn: 0.35, levelOff: 0.42, hypeMax: 0.7, levelTauSec: 3, flashTauSec: 0.5 };

export interface Crowd extends Updatable {
  /** 0..1, làm mượt ~1,5 s. Gọi một lần là tắt chế độ tự động. */
  setFlash(amount: number): void;
}

export function createCrowd(scene: THREE.Scene, opts: CrowdOptions): Crowd {
  const rand = mulberry32(0xc0ffee);
  const people = layout(opts, rand);
  const n = people.length;

  const aPos = new Float32Array(n * 3);
  const aSeed = new Float32Array(n * 4);
  const aZone = new Float32Array(n * 2);
  const aTint = new Float32Array(n);
  people.forEach((p, i) => {
    aPos.set([p.x, p.y, p.z], i * 3);
    aSeed.set([rand(), 0.9 + rand() * 0.2, rand(), 0.5 + rand() * 0.5], i * 4);
    aZone.set([p.angleN, p.distN], i * 2);
    aTint[i] = 0.008 + rand() * 0.03;
  });

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 4));
  geo.setAttribute('aZone', new THREE.InstancedBufferAttribute(aZone, 2));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 1));
  geo.instanceCount = n;

  // Uniform chung cho cả 2 material (cùng object → cập nhật một lần).
  const shared = {
    uTime: { value: 0 },
    uBeat: { value: 0 },
    uBeatPulse: { value: 0 },
    uHype: { value: 0.3 },
    uWaveMode: { value: 0 },
    uWaveMix: { value: 0 },
    uColorA: { value: COLOR_A.clone() },
    uColorB: { value: COLOR_B.clone() },
    uFlash: { value: 0 },
  };
  let flashManual: number | null = null;
  let levelSmooth = 0.5;
  let autoOn = false;
  const makeMat = (part: 'BODY' | 'STICK') =>
    new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      defines: { [part]: '' },
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...shared },
      fog: true,
      transparent: true,
      depthTest: true,
      depthWrite: part === 'BODY',
      blending: part === 'BODY' ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  const bodyMat = makeMat('BODY');
  const stickMat = makeMat('STICK');

  const body = new THREE.Mesh(geo, bodyMat);
  const sticks = new THREE.Mesh(geo, stickMat);
  for (const m of [body, sticks]) {
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
  }
  body.name = 'crowd-body';
  sticks.name = 'crowd-sticks';
  body.renderOrder = 1;
  sticks.renderOrder = 2;
  scene.add(body, sticks);

  return {
    update(f: FrameState) {
      shared.uTime.value += f.dt;
      shared.uBeat.value = f.beat;
      shared.uBeatPulse.value = f.beatPulse;
      shared.uHype.value = THREE.MathUtils.clamp(f.hype, 0, 1);
      shared.uWaveMode.value = f.waveMode;
      const target = f.waveMode === 1 ? 1 : 0;
      const k = 1 - Math.exp(-f.dt * 2.5); // ~0,4 s chuyển mượt giữa đồng màu và sóng
      shared.uWaveMix.value += (target - shared.uWaveMix.value) * k;

      let flashTarget: number;
      if (flashManual !== null) {
        flashTarget = flashManual;
      } else {
        levelSmooth += (f.level - levelSmooth) * (1 - Math.exp(-f.dt / FLASH_AUTO.levelTauSec));
        if (autoOn) autoOn = levelSmooth < FLASH_AUTO.levelOff && f.hype < FLASH_AUTO.hypeMax + 0.05;
        else autoOn = levelSmooth < FLASH_AUTO.levelOn && f.hype < FLASH_AUTO.hypeMax;
        flashTarget = autoOn ? 1 : 0;
      }
      shared.uFlash.value += (flashTarget - shared.uFlash.value) * (1 - Math.exp(-f.dt / FLASH_AUTO.flashTauSec));
    },
    setFlash(amount: number) {
      flashManual = THREE.MathUtils.clamp(Number.isFinite(amount) ? amount : 0, 0, 1);
    },
    dispose() {
      scene.remove(body, sticks);
      geo.dispose();
      bodyMat.dispose();
      stickMat.dispose();
    },
  };
}
