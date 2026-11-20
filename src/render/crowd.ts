// P1 — Khán giả instanced + lightstick. Toàn bộ chuyển động trong vertex shader (crowd.vert.glsl),
// buffer instance tĩnh sau khi khởi tạo, 2 draw call (thân: alpha-test + depth write; lightstick: additive).
// LOD theo khoảng cách trong shader; tự giảm số người vẽ khi máy chậm (CROWD_QUALITY).
// Quy ước không gian: ca sĩ đứng tại gốc tọa độ nhìn về -Z; khán giả ở z < -6, sàn y = 0.
import * as THREE from 'three';
import type { CrowdOptions, FrameState, Updatable } from '../core/types';
import vert from './crowd.vert.glsl?raw';
import frag from './crowd.frag.glsl?raw';

/** Bán kính hàng đầu (m) tính từ ca sĩ. */
const R0 = 6.5;
/** Khoảng cách (m, theo trục -Z) từ ca sĩ tới hàng rào khán giả; mép sân khấu ở z = -5 → khe an ninh 2 m. */
const BARRIER_Z = 7;
/** Sân vận động ngoài trời: khán đài bắt đầu ~70 m → khán giả đứng tối đa tới FIELD.rMax. */
const FIELD = {
  rMax: 62,
  /** Bán kính tối thiểu của khu đứng (đám đông nhỏ thì thu gọn lại, không loãng ra). */
  rMin: R0 + 3,
  /** Khoảng cách người–người (m) ở hàng đầu; phía sau thưa dần tới spacing * (1 + backK). */
  spacing: 0.6,
  spacingMin: 0.36,
  backK: 0.4,
  /** Nửa góc quạt tối đa ở các hàng sau (độ): ôm quanh hai bên sân khấu / catwalk. */
  halfArcMaxDeg: 75,
  /** Bán kính (m) mà quạt mở rộng hết cỡ. */
  arcGrowR: 30,
};
/** Lối đi chia khu (m): 2 lối hướng tâm ở ±radialDeg (từ radialFromR trở ra) + 1 lối vòng ở ringR. */
const AISLES = { radialDeg: 36, radialFromR: 13, ringR: 30, width: 1.5 };
const JITTER = 0.28; // × spacing cục bộ
/** Sàn dốc lên phía sau (m cao / m xa). */
const SLOPE = 0.05;
/**
 * Cao độ sàn khán giả ở hàng đầu. Sân khấu (P6) có mặt sàn y = 0, camera mắt ca sĩ y = 1,65,
 * sân khấu cao 1,5 m so với khán giả (docs/discussion/02-gamedev.md §2) → sàn khán giả y = -1,5.
 */
export const CROWD_FLOOR_Y = -1.5;

/**
 * Tự giảm chất lượng (crowd.update): frame time làm mượt (EMA smoothTauSec) > slowMs liên tục
 * slowSec giây → quality -= step (≥ min); < fastMs liên tục fastSec giây → quality += step (≤ 1).
 * quality = tỉ lệ số người được vẽ (geo.instanceCount); thứ tự instance xen kẽ nên bỏ đuôi = thưa đều.
 * Lưu ý: màn 60 Hz có vsync cho dt ≈ 16,7 ms > fastMs → chỉ tăng lại khi màn > 70 Hz hoặc gọi setQuality.
 */
export const CROWD_QUALITY = {
  min: 0.35,
  step: 0.15,
  slowMs: 28,
  slowSec: 3,
  fastMs: 14,
  fastSec: 10,
  smoothTauSec: 0.5,
  /** Ngưỡng LOD (m): xa hơn → bóng người đơn giản (± 3 m ngẫu nhiên theo người để không lộ vòng). */
  lodDist: 35,
};
/** Mốc quality của các bậc tự động; instance được chia tầng theo mốc này, mỗi tầng xếp gần → xa (early-z). */
const QUALITY_TIERS = [0.35, 0.4, 0.55, 0.7, 0.85, 1];

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

/** Lối catwalk giữa khán giả (sàn y = 0): nửa rộng 1,6 m, z từ -5 tới -24, bục tròn R 3,5 m tại (0, -26). */
const RUNWAY = { halfWidth: 1.6, endZ: -24, platformZ: -26, platformR: 3.5 };
/** Khoảng trống quanh catwalk (m): không ai đứng trong |x| < CLEAR_X khi z > CLEAR_Z, hay trong CLEAR_R quanh bục. */
const CLEAR_X = 2.6;
const CLEAR_Z = -24.5;
const CLEAR_R = 4.6;

/**
 * Đẩy người khỏi lối catwalk & bục tròn sang chỗ trống gần nhất (giữ tổng số người).
 * Lặp vài lần vì đẩy khỏi lối có thể rơi vào vùng bục và ngược lại.
 */
function clearRunway(people: Person[], rand: () => number): void {
  for (const p of people) {
    for (let it = 0; it < 6; it++) {
      let moved = false;
      const dx = p.x;
      const dz = p.z - RUNWAY.platformZ;
      const r = Math.hypot(dx, dz);
      if (r < CLEAR_R) {
        // Đẩy theo hướng tâm bục; người đứng gần như đúng tâm → chọn hướng ngẫu nhiên phía sau.
        let ux = dx / Math.max(r, 1e-3);
        let uz = dz / Math.max(r, 1e-3);
        if (r < 1e-3) {
          const a = Math.PI * (0.25 + rand() * 0.5);
          ux = Math.cos(a);
          uz = -Math.sin(a);
        }
        const nr = CLEAR_R + 0.05 + rand() * 0.9;
        p.x = ux * nr;
        p.z = RUNWAY.platformZ + uz * nr;
        moved = true;
      }
      if (p.z > CLEAR_Z && Math.abs(p.x) < CLEAR_X) {
        const s = p.x === 0 ? (rand() < 0.5 ? -1 : 1) : Math.sign(p.x);
        // Dồn vào sát hàng rào hai bên lối (đám đông chen lên mép catwalk).
        p.x = s * (CLEAR_X + 0.05 + rand() * 1.1);
        moved = true;
      }
      if (!moved) break;
    }
    p.dist = Math.hypot(p.x, p.z);
  }
}

interface Person {
  x: number;
  y: number;
  z: number;
  dist: number;
  angleN: number;
  distN: number;
}

const DEG = Math.PI / 180;

/** Vị trí (x, z) có nằm trong khu đứng hợp lệ không (trước hàng rào, ngoài catwalk/bục, ngoài lối đi). */
function validSpot(x: number, z: number, r: number, rMax: number): boolean {
  if (z > -BARRIER_Z) return false;
  if (z > CLEAR_Z && Math.abs(x) < CLEAR_X) return false;
  if (Math.hypot(x, z - RUNWAY.platformZ) < CLEAR_R) return false;
  const hw = AISLES.width / 2;
  if (rMax > AISLES.ringR + 4 && Math.abs(r - AISLES.ringR) < hw) return false;
  const f = -z; // khoảng cách về phía trước (trục -Z)
  for (const sgn of [-1, 1]) {
    const a = sgn * AISLES.radialDeg * DEG;
    const along = x * Math.sin(a) + f * Math.cos(a);
    const perp = Math.abs(x * Math.cos(a) - f * Math.sin(a));
    if (along > AISLES.radialFromR && perp < hw) return false;
  }
  return true;
}

interface Spot {
  x: number;
  z: number;
  r: number;
  a: number;
  s: number;
}

/** Lưới cung đồng tâm: hàng cách nhau s(r), người trên hàng cách nhau s(r); chỉ giữ chỗ hợp lệ. */
function gridSpots(s0: number, rMax: number, halfArcFront: number, out: Spot[] | null): number {
  const halfMax = Math.max(halfArcFront, FIELD.halfArcMaxDeg * DEG);
  let n = 0;
  let row = 0;
  for (let r = R0; r <= rMax; row++) {
    const s = s0 * (1 + FIELD.backK * THREE.MathUtils.clamp((r - R0) / Math.max(1, rMax - R0), 0, 1));
    const half = THREE.MathUtils.lerp(halfArcFront, halfMax, THREE.MathUtils.smoothstep(r, R0, FIELD.arcGrowR));
    const m = Math.max(1, Math.floor((2 * half * r) / s));
    const off = (row % 2) * 0.5; // so le giữa các hàng
    for (let j = 0; j < m; j++) {
      const a = -half + ((j + 0.25 + off * 0.5) / m) * 2 * half;
      const x = Math.sin(a) * r;
      const z = -Math.cos(a) * r;
      if (!validSpot(x, z, r, rMax)) continue;
      n++;
      out?.push({ x, z, r, a, s });
    }
    r += s;
  }
  return n;
}

/** Nghịch đảo cơ số 2 (van der Corput) — thứ tự xen kẽ ổn định để cắt đuôi vẫn thưa đều. */
function radicalInverse(i: number): number {
  let v = 0;
  let f = 0.5;
  for (let k = i; k > 0; k >>>= 1, f *= 0.5) if (k & 1) v += f;
  return v;
}

function layout(opts: CrowdOptions, rand: () => number): Person[] {
  const count = Math.max(1, Math.floor(opts.count));
  const halfFront = (Math.max(10, Math.min(180, opts.arcDeg)) * DEG) / 2;
  // opts.rows giờ chỉ mang tính tham khảo: số hàng/khoảng cách tự suy ra từ count.
  // 1) Mật độ chuẩn: tìm bán kính nhỏ nhất chứa đủ count người.
  let s0 = FIELD.spacing;
  let rMax = FIELD.rMax;
  if (gridSpots(s0, FIELD.rMax, halfFront, null) >= count) {
    let lo = FIELD.rMin;
    let hi = FIELD.rMax;
    for (let it = 0; it < 30; it++) {
      const mid = (lo + hi) / 2;
      if (gridSpots(s0, mid, halfFront, null) >= count) hi = mid;
      else lo = mid;
    }
    rMax = hi;
  } else {
    // 2) Đầy sân: siết khoảng cách (tối thiểu spacingMin), nếu vẫn thiếu thì nới bán kính.
    let lo = FIELD.spacingMin;
    let hi = FIELD.spacing;
    for (let it = 0; it < 30; it++) {
      const mid = (lo + hi) / 2;
      if (gridSpots(mid, rMax, halfFront, null) >= count) lo = mid;
      else hi = mid;
    }
    s0 = lo;
    while (gridSpots(s0, rMax, halfFront, null) < count) rMax += 2;
  }
  const spots: Spot[] = [];
  gridSpots(s0, rMax, halfFront, spots);
  // Bỏ ngẫu nhiên phần dư (thường < 1%).
  while (spots.length > count) {
    const k = Math.floor(rand() * spots.length);
    spots[k] = spots[spots.length - 1];
    spots.pop();
  }
  spots.sort((p, q) => p.r - q.r || p.a - q.a);

  const people: Person[] = spots.map((sp) => {
    let x = sp.x;
    let z = sp.z;
    const jx = x + (rand() * 2 - 1) * JITTER * sp.s;
    const jz = z + (rand() * 2 - 1) * JITTER * sp.s;
    const jr = Math.hypot(jx, jz);
    if (validSpot(jx, jz, jr, rMax)) {
      x = jx;
      z = jz;
    }
    const r = Math.hypot(x, z);
    return {
      x,
      y: CROWD_FLOOR_Y + (r - R0) * SLOPE,
      z,
      dist: r,
      angleN: Math.atan2(x, -z) / (FIELD.halfArcMaxDeg * DEG),
      distN: THREE.MathUtils.clamp((r - R0) / Math.max(1e-3, rMax - R0), 0, 1),
    };
  });
  clearRunway(people, rand); // an toàn: lưới đã tránh catwalk nên thường không đẩy ai
  for (const p of people) p.y = CROWD_FLOOR_Y + (p.dist - R0) * SLOPE;

  // Thứ tự vẽ: thân dùng alpha-test + depth write (không cần sort theo khung hình). Chia tầng theo
  // QUALITY_TIERS bằng thứ tự xen kẽ van der Corput (trên thứ tự không gian) → cắt đuôi = thưa đều;
  // trong mỗi tầng xếp gần → xa để early-z loại bớt overdraw.
  const keyed = people.map((p, i) => {
    const rank = radicalInverse(i);
    let tier = 0;
    while (tier < QUALITY_TIERS.length - 1 && rank >= QUALITY_TIERS[tier]) tier++;
    return { p, tier };
  });
  keyed.sort((u, v) => u.tier - v.tier || u.p.dist - v.p.dist);
  return keyed.map((k) => k.p);
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
  /**
   * Tỉ lệ người được vẽ 0,3..1 (thưa đều, không bỏ hàng sau). Gọi là tắt chế độ tự động;
   * setQuality(q, true) đặt mức nhưng vẫn để tự động điều chỉnh tiếp.
   */
  setQuality?(q: number, keepAuto?: boolean): void;
  /** Mức quality hiện tại (0,3..1). */
  getQuality?(): number;
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
    uLodDist: { value: CROWD_QUALITY.lodDist },
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
      // Thân: alpha-test (discard) + depth write, không blend → không cần sort, early-z cắt overdraw.
      transparent: part === 'STICK',
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

  let quality = 1;
  let autoQuality = true;
  let ftSmooth = 16.7;
  let slowFor = 0;
  let fastFor = 0;
  const applyQuality = (q: number, why: string) => {
    const nq = THREE.MathUtils.clamp(Number.isFinite(q) ? q : 1, 0.3, 1);
    const changed = Math.abs(nq - quality) > 1e-3;
    quality = nq;
    geo.instanceCount = Math.max(1, Math.round(n * quality));
    if (changed) {
      console.info(
        `[crowd] quality ${quality.toFixed(2)} → ${geo.instanceCount}/${n} people (${why}, frame ~${ftSmooth.toFixed(1)} ms)`,
      );
    }
  };

  return {
    update(f: FrameState) {
      if (autoQuality && f.dt > 0) {
        // Bỏ qua khung giật bất thường (đổi tab, tải asset) khi làm mượt.
        const ms = Math.min(f.dt, 0.1) * 1000;
        ftSmooth += (ms - ftSmooth) * (1 - Math.exp(-f.dt / CROWD_QUALITY.smoothTauSec));
        slowFor = ftSmooth > CROWD_QUALITY.slowMs ? slowFor + f.dt : 0;
        fastFor = ftSmooth < CROWD_QUALITY.fastMs ? fastFor + f.dt : 0;
        if (slowFor >= CROWD_QUALITY.slowSec && quality > CROWD_QUALITY.min + 1e-3) {
          applyQuality(Math.max(CROWD_QUALITY.min, quality - CROWD_QUALITY.step), 'auto: slow');
          slowFor = 0;
        } else if (fastFor >= CROWD_QUALITY.fastSec && quality < 1 - 1e-3) {
          applyQuality(Math.min(1, quality + CROWD_QUALITY.step), 'auto: fast');
          fastFor = 0;
        }
      }
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
    setQuality(q: number, keepAuto = false) {
      autoQuality = keepAuto;
      slowFor = fastFor = 0;
      applyQuality(q, 'manual');
    },
    getQuality() {
      return quality;
    },
    dispose() {
      scene.remove(body, sticks);
      geo.dispose();
      bodyMat.dispose();
      stickMat.dispose();
    },
  };
}
