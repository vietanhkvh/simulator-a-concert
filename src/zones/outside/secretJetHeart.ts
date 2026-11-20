// Hình học "trái tim khói" + "mũi tên" của phi đội phản lực (secretJet.ts), trong hệ toạ độ PHẲNG của trái tim:
// world = JET_HEART_CENTER + EX·u + EY·v (m). Cả viền + khói + màng tô được vẽ trên 1 quad bằng trường khoảng cách
// (SDF) nướng sẵn vào 1 DataTexture half-float: R = khoảng cách CÓ DẤU tới đường tim (âm = bên trong),
// G = thời điểm phát khói của điểm gần nhất trên tim, B = khoảng cách tới nét mũi tên, A = thời điểm phát của nét đó.
// Nhờ SDF: nét đều, đầu nét tròn, chỗ nối (mũi tim, khe trên) mượt, khử răng cưa bằng fwidth.
import * as THREE from 'three';

/** Tỉ lệ công thức tim → m. */
export const HEART_K = 1.35;
/** Mốc thời gian (s) của màn: vào sân · bắt đầu vẽ tim · gặp nhau ở khe trên · mũi tên. */
export const T_HEART = 2.6, T_MEET = 8.6, T_C0 = 3.4;
/** Đường mũi tên trong mặt phẳng tim: v = ARROW_V0 + ARROW_SLOPE·u; thân vẽ từ u = ARROW_U0 tới ARROW_U1 (đầu). */
export const ARROW_V0 = -3, ARROW_SLOPE = 0.32, ARROW_U0 = -44, ARROW_U1 = 41;
/** Jet mũi tên ở u = -150 lúc T_C0, bay đều tốc độ ARROW_SPD (m/s) theo hướng ARROW_DIR (trong mặt phẳng). */
export const ARROW_SPD = 46;
const AL = Math.hypot(1, ARROW_SLOPE);
export const ARROW_DIR = { u: 1 / AL, v: ARROW_SLOPE / AL } as const;
export const arrowTimeAtU = (u: number) => T_C0 + ((u + 150) * AL) / ARROW_SPD;

// ───────── Nửa phải trái tim (x ≥ 0) theo độ dài cung, từ mũi dưới (τ = π) lên khe trên (τ = 0) ─────────
const M = 1600;
const HU = new Float32Array(M + 1), HV = new Float32Array(M + 1), HA = new Float32Array(M + 1);
{
  for (let k = 0; k <= M; k++) {
    const tau = Math.PI * (1 - k / M);
    HU[k] = 16 * Math.sin(tau) ** 3 * HEART_K;
    HV[k] = (13 * Math.cos(tau) - 5 * Math.cos(2 * tau) - 2 * Math.cos(3 * tau) - Math.cos(4 * tau)) * HEART_K;
    HA[k] = k ? HA[k - 1]! + Math.hypot(HU[k]! - HU[k - 1]!, HV[k]! - HV[k - 1]!) : 0;
  }
}
/** Độ dài nửa trái tim (m). */
export const HEART_HALF_LEN = HA[M]!;
/** Tốc độ vẽ tim (m/s), đều. */
export const HEART_SPD = HEART_HALF_LEN / (T_MEET - T_HEART);

/** Điểm trên nửa tim ở độ dài cung a (m) tính từ mũi dưới; side = +1 (phải) / -1 (trái). Trả (u, v). */
export function heartAt(a: number, side: number, out: { u: number; v: number }) {
  const x = Math.min(Math.max(a, 0), HEART_HALF_LEN);
  let lo = 0, hi = M;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (HA[mid]! <= x) lo = mid; else hi = mid; }
  const f = (x - HA[lo]!) / Math.max(HA[hi]! - HA[lo]!, 1e-6);
  out.u = side * (HU[lo]! + (HU[hi]! - HU[lo]!) * f);
  out.v = HV[lo]! + (HV[hi]! - HV[lo]!) * f;
  return out;
}

/** Vùng phủ của quad SDF trong mặt phẳng (m). */
export const SDF_BOX = { u0: -50, u1: 50, v0: -28, v1: 22 } as const;
const TW = 640, TH = 320, RMAX = 5;

interface Seg { ax: number; ay: number; bx: number; by: number; ta: number; tb: number }

function heartSegs(): Seg[] {
  const segs: Seg[] = [];
  const N = 200, p = { u: 0, v: 0 }, q = { u: 0, v: 0 };
  for (const side of [1, -1]) {
    for (let i = 0; i < N; i++) {
      const a0 = (HEART_HALF_LEN * i) / N, a1 = (HEART_HALF_LEN * (i + 1)) / N;
      heartAt(a0, side, p); heartAt(a1, side, q);
      segs.push({ ax: p.u, ay: p.v, bx: q.u, by: q.v, ta: T_HEART + a0 / HEART_SPD, tb: T_HEART + a1 / HEART_SPD });
    }
  }
  return segs;
}

function arrowSegs(): Seg[] {
  const segs: Seg[] = [];
  const at = (u: number) => ({ x: u, y: ARROW_V0 + ARROW_SLOPE * u });
  const a = at(ARROW_U0), b = at(ARROW_U1);
  segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, ta: arrowTimeAtU(ARROW_U0), tb: arrowTimeAtU(ARROW_U1) });
  const dx = ARROW_DIR.u, dy = ARROW_DIR.v;
  const stroke = (o: { x: number; y: number }, ang: number, len: number, t0: number) => {
    // nét toả ra sau, lệch góc ang so với hướng ngược mũi tên
    const c = Math.cos(ang), s = Math.sin(ang);
    const ex = -dx * c + dy * s, ey = -dy * c - dx * s;
    segs.push({ ax: o.x, ay: o.y, bx: o.x + ex * len, by: o.y + ey * len, ta: t0, tb: t0 + len / ARROW_SPD });
  };
  // đầu mũi tên: 2 nét chữ V
  const tTip = arrowTimeAtU(ARROW_U1);
  for (const s of [1, -1]) stroke(b, s * 0.62, 7.2, tTip);
  // đuôi: 3 cặp lông vũ
  for (let k = 0; k < 3; k++) {
    const u = ARROW_U0 + 1.2 + k * 3.6, o = at(u);
    for (const s of [1, -1]) stroke(o, s * 0.75, 4.2, arrowTimeAtU(u));
  }
  return segs;
}

/** Nướng trường khoảng cách (CPU, lưới không gian để chỉ xét đoạn gần). */
function bake(segs: Seg[], dist: Float32Array, te: Float32Array) {
  const du = (SDF_BOX.u1 - SDF_BOX.u0) / TW, dv = (SDF_BOX.v1 - SDF_BOX.v0) / TH;
  const CELL = 2.5, GW = Math.ceil((SDF_BOX.u1 - SDF_BOX.u0) / CELL), GH = Math.ceil((SDF_BOX.v1 - SDF_BOX.v0) / CELL);
  const grid: number[][] = Array.from({ length: GW * GH }, () => []);
  segs.forEach((s, i) => {
    const x0 = Math.floor((Math.min(s.ax, s.bx) - RMAX - SDF_BOX.u0) / CELL), x1 = Math.floor((Math.max(s.ax, s.bx) + RMAX - SDF_BOX.u0) / CELL);
    const y0 = Math.floor((Math.min(s.ay, s.by) - RMAX - SDF_BOX.v0) / CELL), y1 = Math.floor((Math.max(s.ay, s.by) + RMAX - SDF_BOX.v0) / CELL);
    for (let y = Math.max(0, y0); y <= Math.min(GH - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(GW - 1, x1); x++) grid[y * GW + x]!.push(i);
  });
  for (let j = 0; j < TH; j++) {
    const py = SDF_BOX.v0 + (j + 0.5) * dv, gy = Math.min(GH - 1, Math.floor((py - SDF_BOX.v0) / CELL));
    for (let i = 0; i < TW; i++) {
      const px = SDF_BOX.u0 + (i + 0.5) * du, gx = Math.min(GW - 1, Math.floor((px - SDF_BOX.u0) / CELL));
      let best = RMAX * RMAX, bt = 99;
      for (const si of grid[gy * GW + gx]!) {
        const s = segs[si]!;
        const ex = s.bx - s.ax, ey = s.by - s.ay;
        const h = Math.min(1, Math.max(0, ((px - s.ax) * ex + (py - s.ay) * ey) / (ex * ex + ey * ey)));
        const qx = px - s.ax - ex * h, qy = py - s.ay - ey * h;
        const d2 = qx * qx + qy * qy;
        if (d2 < best) { best = d2; bt = s.ta + (s.tb - s.ta) * h; }
      }
      dist[j * TW + i] = Math.sqrt(best);
      te[j * TW + i] = bt;
    }
  }
}

/** Texture SDF (tạo 1 lần khi màn jet được dùng lần đầu, ~vài chục ms). */
export function buildHeartSdf(): THREE.DataTexture {
  const n = TW * TH;
  const hd = new Float32Array(n), ht = new Float32Array(n), ad = new Float32Array(n), at = new Float32Array(n);
  const hs = heartSegs();
  bake(hs, hd, ht);
  bake(arrowSegs(), ad, at);
  // dấu trong/ngoài: quét từng hàng, giao với đa giác kín
  const dv = (SDF_BOX.v1 - SDF_BOX.v0) / TH, du = (SDF_BOX.u1 - SDF_BOX.u0) / TW;
  const xs: number[] = [];
  for (let j = 0; j < TH; j++) {
    const py = SDF_BOX.v0 + (j + 0.5) * dv;
    xs.length = 0;
    for (const s of hs) {
      if ((s.ay <= py) !== (s.by <= py)) xs.push(s.ax + ((py - s.ay) / (s.by - s.ay)) * (s.bx - s.ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k]! - SDF_BOX.u0) / du - 0.5)), i1 = Math.min(TW - 1, Math.floor((xs[k + 1]! - SDF_BOX.u0) / du - 0.5));
      for (let i = i0; i <= i1; i++) hd[j * TW + i] = -hd[j * TW + i]!;
    }
  }
  const data = new Uint16Array(n * 4);
  const h = THREE.DataUtils.toHalfFloat;
  for (let k = 0; k < n; k++) {
    data[k * 4] = h(hd[k]!); data[k * 4 + 1] = h(ht[k]!); data[k * 4 + 2] = h(ad[k]!); data[k * 4 + 3] = h(at[k]!);
  }
  const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
