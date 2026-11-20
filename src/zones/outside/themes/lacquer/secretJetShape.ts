// "Mực & Sơn mài" · secretJet — HÌNH HỌC "dải đất hình chữ S" (STYLE_B2 §6, §9).
// Toạ độ PHẲNG của hình (m): u = đông (+) / tây (−), v = bắc (+) / nam (−). Hình là "bảng" quay mặt về camera quanh trục X
// (secretJetShaders.ts · FIG_BASIS), nên từ phía nào nhìn cũng thấy bắc ở trên, đông ở bên phải như trên bản đồ.
// Đường viền đất liền: polyline kinh/vĩ độ cách điệu (tay soạn), Catmull-Rom + làm mượt nhẹ → nướng 1 lần trên CPU vào
// DataTexture half-float: R = khoảng cách CÓ DẤU tới đường viền (âm = trong), G = độ dài cung chuẩn hoá (0 = mũi bắc,
// 1 = mũi Cà Mau) của điểm gần nhất, B = hệ số dày/mỏng nét cọ tại đó, A = 0 (bờ đông) / 1 (bờ tây).
// Không có biên giới nước khác, không có chữ.
import * as THREE from 'three';

/** Kích thước hình: chiều cao đất liền (m) trên toàn dải vĩ độ. */
export const FIG_H = 30;
const LAT0 = 8.58, LAT1 = 23.39;
const K = FIG_H / (LAT1 - LAT0);
const COSL = Math.cos((16 * Math.PI) / 180);
/** Kinh độ ở tâm hình (tâm hộp bao gồm cả hai quần đảo) → hình nằm giữa x ≈ 0. */
const LON_C = 108.9;
const LAT_C = (LAT0 + LAT1) / 2;
export const lonLat = (lon: number, lat: number): [number, number] => [(lon - LON_C) * COSL * K, (lat - LAT_C) * K];

// Bờ ĐÔNG: mũi bắc (Lũng Cú) → đông bắc → Móng Cái → bờ biển (châu thổ sông Hồng phình ra, eo miền Trung cong ra
// biển, mũi Đại Lãnh) → Cà Mau.
const EAST: [number, number][] = [
  [105.32, 23.39], [105.9, 23.0], [106.55, 22.92], [106.75, 22.55], [106.68, 22.12], [107.1, 21.85], [107.55, 21.62],
  [107.98, 21.52], [107.6, 21.2], [107.15, 20.95], [106.85, 20.72], [106.72, 20.4], [106.55, 20.15], [106.25, 19.95],
  [105.95, 19.72], [105.82, 19.35], [105.76, 18.95], [105.88, 18.6], [106.15, 18.25], [106.45, 17.85], [106.68, 17.42],
  [107.0, 17.0], [107.45, 16.65], [107.95, 16.3], [108.28, 16.05], [108.58, 15.6], [108.85, 15.15], [109.0, 14.6],
  [109.15, 14.0], [109.25, 13.45], [109.42, 12.88], [109.22, 12.3], [109.2, 11.85], [109.0, 11.42], [108.7, 11.1],
  [108.3, 10.9], [107.8, 10.62], [107.25, 10.38], [106.85, 10.12], [106.62, 9.82], [106.32, 9.5], [105.95, 9.22],
  [105.55, 8.95], [105.15, 8.72], [104.8, 8.58],
];
// Bờ TÂY: mũi bắc → tây bắc (A Pa Chải) → Nghệ An → eo Quảng Bình → Tây Nguyên → Tây Ninh → Hà Tiên → bờ tây → Cà Mau.
const WEST: [number, number][] = [
  [105.32, 23.39], [104.85, 23.05], [104.4, 22.82], [103.95, 22.56], [103.5, 22.7], [102.95, 22.6], [102.5, 22.56],
  [102.15, 22.4], [102.45, 21.85], [102.85, 21.5], [102.98, 21.0], [103.4, 20.8], [104.1, 20.65], [104.6, 20.35],
  [104.35, 19.95], [103.95, 19.6], [103.9, 19.25], [104.45, 18.95], [104.95, 18.65], [105.4, 18.25], [105.72, 17.85],
  [106.2, 17.35], [106.5, 16.75], [107.1, 16.3], [107.3, 16.0], [107.45, 15.6], [107.5, 15.1], [107.55, 14.65],
  [107.42, 14.2], [107.55, 13.7], [107.6, 13.1], [107.5, 12.5], [107.15, 12.15], [106.6, 11.95], [106.15, 11.75],
  [105.95, 11.35], [105.85, 11.0], [105.45, 10.95], [105.05, 10.9], [104.75, 10.62], [104.48, 10.42], [104.75, 10.15],
  [105.05, 9.95], [104.95, 9.5], [104.86, 9.05], [104.8, 8.58],
];

/** Thủ đô (sao vàng nền son). */
export const CAPITAL = lonLat(105.85, 21.03);
/** Hoàng Sa — 5 đốm, phía đông bờ miền Trung (cách điệu, giãn ra cho đủ ≥ 3 px mỗi đốm). */
export const HOANG_SA: [number, number][] = ([[111.75, 16.95], [112.45, 16.75], [111.55, 16.3], [112.25, 16.15], [112.85, 16.45]] as [number, number][]).map(([a, b]) => lonLat(a, b));
/** Trường Sa — 7 đốm, xa hơn về phía đông nam. */
export const TRUONG_SA: [number, number][] = ([
  [113.0, 10.85], [113.9, 10.6], [114.7, 10.3], [113.4, 9.95], [114.3, 9.55], [115.1, 9.15], [113.85, 8.75],
] as [number, number][]).map(([a, b]) => lonLat(a, b));

/** Catmull-Rom (centripetal) qua các điểm, rồi lấy mẫu lại đều theo độ dài cung (n điểm). */
function smoothSide(pts: [number, number][], n: number): Float32Array {
  const P = pts.map(([a, b]) => lonLat(a, b));
  // làm mượt Laplace nhẹ (giữ hai đầu) → nét cọ thanh, không gãy khúc
  for (let it = 0; it < 2; it++) {
    const Q = P.map((p) => [p[0], p[1]] as [number, number]);
    for (let i = 1; i < P.length - 1; i++) {
      Q[i]![0] = P[i]![0] * 0.6 + (P[i - 1]![0] + P[i + 1]![0]) * 0.2;
      Q[i]![1] = P[i]![1] * 0.6 + (P[i - 1]![1] + P[i + 1]![1]) * 0.2;
    }
    P.splice(0, P.length, ...Q);
  }
  const dense: number[] = [];
  const SUB = 12;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[Math.min(P.length - 1, i + 2)]!;
    for (let s = 0; s < SUB; s++) {
      const t = s / SUB, t2 = t * t, t3 = t2 * t;
      for (let c = 0; c < 2; c++) {
        dense.push(0.5 * (2 * p1[c]! + (-p0[c]! + p2[c]!) * t + (2 * p0[c]! - 5 * p1[c]! + 4 * p2[c]! - p3[c]!) * t2 + (-p0[c]! + 3 * p1[c]! - 3 * p2[c]! + p3[c]!) * t3));
      }
    }
  }
  dense.push(P[P.length - 1]![0], P[P.length - 1]![1]);
  const m = dense.length / 2;
  const acc = new Float32Array(m);
  for (let i = 1; i < m; i++) acc[i] = acc[i - 1]! + Math.hypot(dense[i * 2]! - dense[i * 2 - 2]!, dense[i * 2 + 1]! - dense[i * 2 - 1]!);
  const L = acc[m - 1]!;
  const out = new Float32Array(n * 2);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const x = (L * k) / (n - 1);
    while (j < m - 2 && acc[j + 1]! < x) j++;
    const f = (x - acc[j]!) / Math.max(acc[j + 1]! - acc[j]!, 1e-6);
    out[k * 2] = dense[j * 2]! + (dense[j * 2 + 2]! - dense[j * 2]!) * f;
    out[k * 2 + 1] = dense[j * 2 + 1]! + (dense[j * 2 + 3]! - dense[j * 2 + 1]!) * f;
  }
  return out;
}

const NS = 420;
/** Hai bờ đã làm mượt, lấy mẫu đều (u,v xen kẽ), cùng bắt đầu ở mũi bắc, kết thúc ở mũi Cà Mau. */
export const SIDES = [smoothSide(EAST, NS), smoothSide(WEST, NS)] as const;
export const SIDE_N = NS;

/** Điểm trên bờ `side` ở tham số s ∈ [0,1] (0 = bắc). */
export function sideAt(side: 0 | 1, s: number, out: { u: number; v: number }) {
  const A = SIDES[side];
  const f = Math.min(Math.max(s, 0), 1) * (NS - 1), k = Math.min(NS - 2, Math.floor(f)), w = f - k;
  out.u = A[k * 2]! + (A[k * 2 + 2]! - A[k * 2]!) * w;
  out.v = A[k * 2 + 1]! + (A[k * 2 + 3]! - A[k * 2 + 1]!) * w;
  return out;
}

/** Hộp phủ của quad SDF (m, toạ độ phẳng), có lề cho quầng sáng. */
export const BOX = (() => {
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const A of SIDES) for (let i = 0; i < NS; i++) {
    u0 = Math.min(u0, A[i * 2]!); u1 = Math.max(u1, A[i * 2]!); v0 = Math.min(v0, A[i * 2 + 1]!); v1 = Math.max(v1, A[i * 2 + 1]!);
  }
  const m = 2.6;
  return { u0: u0 - m, u1: u1 + m, v0: v0 - m, v1: v1 + m };
})();

/** "Sống" chữ S (giữa hai bờ theo từng vĩ độ) — lòng sông đèn trời: SPINE_N điểm (u, v, nửa bề rộng). */
export const SPINE_N = 40;
export const SPINE = (() => {
  const out = new Float32Array(SPINE_N * 3);
  const vTop = BOX.v1 - 2.6 - 0.9, vBot = BOX.v0 + 2.6 + 0.5;
  const xs: number[] = [];
  for (let k = 0; k < SPINE_N; k++) {
    const v = vTop + ((vBot - vTop) * k) / (SPINE_N - 1);
    xs.length = 0;
    for (const A of SIDES) for (let i = 0; i < NS - 1; i++) {
      const ay = A[i * 2 + 1]!, by = A[i * 2 + 3]!;
      if ((ay <= v) !== (by <= v)) xs.push(A[i * 2]! + ((v - ay) / (by - ay)) * (A[i * 2 + 2]! - A[i * 2]!));
    }
    xs.sort((a, b) => a - b);
    let best = 0, cu = 0;
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1]! - xs[i]! > best) { best = xs[i + 1]! - xs[i]!; cu = (xs[i]! + xs[i + 1]!) / 2; }
    out.set([cu, v, Math.max(0.3, best / 2)], k * 3);
  }
  // làm mượt dọc sống
  for (let it = 0; it < 3; it++) for (let k = 1; k < SPINE_N - 1; k++) {
    out[k * 3] = out[k * 3]! * 0.5 + (out[k * 3 - 3]! + out[k * 3 + 3]!) * 0.25;
    out[k * 3 + 2] = out[k * 3 + 2]! * 0.5 + (out[k * 3 - 1]! + out[k * 3 + 5]!) * 0.25;
  }
  return out;
})();

const TW = 400, TH = 720, RMAX = 3.2;

/** Hệ số dày/mỏng của nét cọ theo hướng nét (bút lông nghiêng ~35°) + phình nhẹ dọc nét. */
const brushW = (dx: number, dy: number, s: number) => {
  const a = Math.atan2(dy, dx);
  return 0.5 + 0.5 * Math.abs(Math.sin(a - 0.6)) * (0.85 + 0.15 * Math.sin(s * 37.0));
};

/** Nướng texture SDF (1 lần, lúc dựng lười). */
export function buildFigureSdf(): THREE.DataTexture {
  interface Seg { ax: number; ay: number; bx: number; by: number; sa: number; sb: number; w: number; side: number }
  const segs: Seg[] = [];
  SIDES.forEach((A, side) => {
    for (let i = 0; i < NS - 1; i++) {
      const ax = A[i * 2]!, ay = A[i * 2 + 1]!, bx = A[i * 2 + 2]!, by = A[i * 2 + 3]!;
      segs.push({ ax, ay, bx, by, sa: i / (NS - 1), sb: (i + 1) / (NS - 1), w: brushW(bx - ax, by - ay, i / NS), side });
    }
  });
  // làm mượt hệ số dày giữa các đoạn kề nhau
  for (let it = 0; it < 6; it++) for (let i = 1; i < segs.length - 1; i++) {
    if (segs[i - 1]!.side === segs[i]!.side && segs[i + 1]!.side === segs[i]!.side) segs[i]!.w = segs[i]!.w * 0.5 + (segs[i - 1]!.w + segs[i + 1]!.w) * 0.25;
  }
  const n = TW * TH;
  const dist = new Float32Array(n), sArr = new Float32Array(n), wArr = new Float32Array(n), sdArr = new Float32Array(n);
  const du = (BOX.u1 - BOX.u0) / TW, dv = (BOX.v1 - BOX.v0) / TH;
  const CELL = 1.6, GW = Math.ceil((BOX.u1 - BOX.u0) / CELL), GH = Math.ceil((BOX.v1 - BOX.v0) / CELL);
  const grid: number[][] = Array.from({ length: GW * GH }, () => []);
  segs.forEach((s, i) => {
    const x0 = Math.floor((Math.min(s.ax, s.bx) - RMAX - BOX.u0) / CELL), x1 = Math.floor((Math.max(s.ax, s.bx) + RMAX - BOX.u0) / CELL);
    const y0 = Math.floor((Math.min(s.ay, s.by) - RMAX - BOX.v0) / CELL), y1 = Math.floor((Math.max(s.ay, s.by) + RMAX - BOX.v0) / CELL);
    for (let y = Math.max(0, y0); y <= Math.min(GH - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(GW - 1, x1); x++) grid[y * GW + x]!.push(i);
  });
  for (let j = 0; j < TH; j++) {
    const py = BOX.v0 + (j + 0.5) * dv, gy = Math.min(GH - 1, Math.floor((py - BOX.v0) / CELL));
    for (let i = 0; i < TW; i++) {
      const px = BOX.u0 + (i + 0.5) * du, gx = Math.min(GW - 1, Math.floor((px - BOX.u0) / CELL));
      let best = RMAX * RMAX, bs = 2, bw = 1, bside = 0;
      for (const si of grid[gy * GW + gx]!) {
        const s = segs[si]!;
        const ex = s.bx - s.ax, ey = s.by - s.ay;
        const h = Math.min(1, Math.max(0, ((px - s.ax) * ex + (py - s.ay) * ey) / (ex * ex + ey * ey)));
        const qx = px - s.ax - ex * h, qy = py - s.ay - ey * h;
        const d2 = qx * qx + qy * qy;
        if (d2 < best) { best = d2; bs = s.sa + (s.sb - s.sa) * h; bw = s.w; bside = s.side; }
      }
      const k = j * TW + i;
      dist[k] = Math.sqrt(best); sArr[k] = bs; wArr[k] = bw; sdArr[k] = bside;
    }
  }
  // dấu trong/ngoài: quét hàng, giao với đa giác kín (bờ đông + bờ tây đảo ngược)
  const xs: number[] = [];
  for (let j = 0; j < TH; j++) {
    const py = BOX.v0 + (j + 0.5) * dv;
    xs.length = 0;
    for (const s of segs) if ((s.ay <= py) !== (s.by <= py)) xs.push(s.ax + ((py - s.ay) / (s.by - s.ay)) * (s.bx - s.ax));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k]! - BOX.u0) / du - 0.5)), i1 = Math.min(TW - 1, Math.floor((xs[k + 1]! - BOX.u0) / du - 0.5));
      for (let i = i0; i <= i1; i++) dist[j * TW + i] = -dist[j * TW + i]!;
    }
  }
  const data = new Uint16Array(n * 4);
  const h = THREE.DataUtils.toHalfFloat;
  for (let k = 0; k < n; k++) {
    data[k * 4] = h(dist[k]!); data[k * 4 + 1] = h(sArr[k]!); data[k * 4 + 2] = h(wArr[k]!); data[k * 4 + 3] = h(sdArr[k]!);
  }
  const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
