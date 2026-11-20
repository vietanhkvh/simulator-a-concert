// Bộ dựng dùng chung cho khinh khí cầu cổ vũ (balloons.ts) và khinh khí cầu của màn bay chào mừng (flyby.ts):
// hình học (vỏ lathe mập 8 múi, giỏ tròn, 2 hành khách chibi, dây, viền ink dạng inverted hull gộp chung mesh),
// shader tô đồ chơi 2 bậc + đốm highlight + motif tim/sao/nơ + lửa ấm đập theo phách, và vẽ băng rôn
// dải ruy băng đuôi én + nơ + cờ đuôi nheo + khẩu hiệu kem viền ink (tim vẽ bằng path).
import * as THREE from 'three';
import {
  HAIR, INK_HEX, INK_SKY, MOTIF, PAL, PAL_HEX, SKIN, hexToRgb, hexStr, shade, shadowOf, type ColorName,
} from '../../world/style';

/** Font tròn đậm (Baloo 2 nếu có), fallback hệ thống có dấu tiếng Việt. */
export const CHEER_FONT = '"Baloo 2", "Nunito", "Segoe UI", Roboto, "Noto Sans", "DejaVu Sans", Arial, sans-serif';

/** Màu (0..1, giá trị sRGB thô — shader xuất thẳng, khớp canvas). */
export const rgb = (hex: number): [number, number, number] => hexToRgb(hex);

// ───────────── Băng rôn (canvas) ─────────────
export function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.42);
  ctx.bezierCurveTo(cx - s * 0.62, cy - s * 0.02, cx - s * 0.48, cy - s * 0.58, cx, cy - s * 0.26);
  ctx.bezierCurveTo(cx + s * 0.48, cy - s * 0.58, cx + s * 0.62, cy - s * 0.02, cx, cy + s * 0.42);
  ctx.closePath();
}

function lineWidthAt(ctx: CanvasRenderingContext2D, s: string, fs: number) {
  ctx.font = `800 ${fs}px ${CHEER_FONT}`;
  const segs = s.split('♥');
  let w = 0;
  segs.forEach((sg, i) => { w += ctx.measureText(sg).width; if (i < segs.length - 1) w += fs * 0.95; });
  return w;
}

/** Chọn bố cục 1 hoặc 2 dòng cho chữ to nhất vừa hộp maxW × maxH. */
export function layoutCheer(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number): { lines: string[]; fs: number } {
  const REF = 100, LH = 1.06;
  const one = Math.min(maxH * 0.62, REF * maxW / Math.max(1, lineWidthAt(ctx, text, REF)));
  let best = { lines: [text], fs: one };
  const words = text.split(' ');
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    if (a.replace(/[\s♥!?.]/g, '').length < 2 || b.replace(/[\s♥!?.]/g, '').length < 2) continue;
    const w = Math.max(lineWidthAt(ctx, a, REF), lineWidthAt(ctx, b, REF));
    const fs = Math.min(maxH / (2 * LH), REF * maxW / w);
    if (fs > best.fs * 1.08) best = { lines: [a, b], fs };
  }
  best.fs = Math.floor(best.fs);
  return best;
}

/** Vẽ một dòng chữ kem viền ink ở giữa (cx, cy); '♥' vẽ bằng path. */
export function drawCheerLine(ctx: CanvasRenderingContext2D, s: string, cx: number, cy: number, fs: number, heartHex: string) {
  const segs = s.split('♥');
  const w = lineWidthAt(ctx, s, fs);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  let x = cx - w / 2;
  const ty = cy + fs * 0.08;
  segs.forEach((sg, i) => {
    if (sg) {
      ctx.lineWidth = fs * 0.2; ctx.strokeStyle = INK_HEX; ctx.strokeText(sg, x, ty);
      ctx.fillStyle = PAL_HEX.cream[500]; ctx.fillText(sg, x, ty);
      x += ctx.measureText(sg).width;
    }
    if (i < segs.length - 1) {
      heartPath(ctx, x + fs * 0.475, cy, fs * 0.86);
      ctx.lineWidth = fs * 0.14; ctx.strokeStyle = INK_HEX; ctx.stroke();
      ctx.fillStyle = heartHex; ctx.fill();
      x += fs * 0.95;
    }
  });
}

/** Tương thích cũ: 1 dòng tự thu nhỏ cho vừa maxW. */
export function drawCheerText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, size: number) {
  const w = lineWidthAt(ctx, text, size);
  drawCheerLine(ctx, text, cx, cy, w > maxW ? Math.floor(size * maxW / w) : size, PAL_HEX.berry[500]);
}

const FLAG_COLS = [PAL_HEX.berry[500], PAL_HEX.honey[500], PAL_HEX.soda[500], PAL_HEX.mint[500], PAL_HEX.grape[300], PAL_HEX.cream[500]];

function drawBow(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, fill: string) {
  ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.12; ctx.strokeStyle = INK_HEX; ctx.fillStyle = fill;
  // đuôi nơ
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(cx + sx * s * 0.55, cy + s * 1.05); ctx.lineTo(cx + sx * s * 0.3, cy + s * 0.92); ctx.lineTo(cx + sx * s * 0.12, cy + s * 1.08);
    ctx.closePath(); ctx.stroke(); ctx.fill();
  }
  // hai thuỳ nơ
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx + sx * s * 0.5, cy - s * 0.85, cx + sx * s * 1.25, cy - s * 0.55, cx + sx * s * 1.05, cy);
    ctx.bezierCurveTo(cx + sx * s * 1.25, cy + s * 0.55, cx + sx * s * 0.5, cy + s * 0.75, cx, cy);
    ctx.closePath(); ctx.stroke(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
  ctx.fillStyle = PAL_HEX.cream[300];
  ctx.beginPath(); ctx.ellipse(cx - s * 0.62, cy - s * 0.22, s * 0.16, s * 0.09, -0.5, 0, Math.PI * 2); ctx.fill();
}

/**
 * Băng rôn khinh khí cầu: dây cờ đuôi nheo + nơ ở điểm treo (trên giữa) + dải ruy băng đuôi én màu `band`.
 * Ô (x0, y0, w, h), tỉ lệ khuyên dùng 16:9. Nền trong suốt (shader bỏ alpha thấp).
 */
export function drawRibbonBanner(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, text: string, band: number, bow: number) {
  ctx.clearRect(x0, y0, w, h);
  const u = h / 576;
  const bt = y0 + 128 * u, bb = y0 + h - 40 * u, bl = x0 + 70 * u, br = x0 + w - 70 * u, sag = 14 * u;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // dây cờ đuôi nheo (võng xuống giữa)
  const gy = (x: number) => y0 + 40 * u + Math.sin(Math.PI * (x - x0) / w) * 58 * u;
  ctx.lineWidth = 7 * u; ctx.strokeStyle = INK_HEX;
  ctx.beginPath(); for (let x = x0 + 24 * u; x <= x0 + w - 24 * u; x += 8) ctx.lineTo(x, gy(x)); ctx.stroke();
  const NF = 12;
  for (let i = 0; i < NF; i++) {
    const fx = x0 + w * (0.07 + 0.86 * (i + 0.5) / NF);
    if (Math.abs(fx - (x0 + w / 2)) < 64 * u) continue;
    const a = fx - 26 * u, b = fx + 26 * u;
    ctx.beginPath(); ctx.moveTo(a, gy(a)); ctx.lineTo(b, gy(b)); ctx.lineTo(fx, gy(fx) + 62 * u); ctx.closePath();
    ctx.lineWidth = 6 * u; ctx.strokeStyle = INK_HEX; ctx.stroke();
    ctx.fillStyle = FLAG_COLS[i % FLAG_COLS.length]; ctx.fill();
  }
  // đuôi ruy băng gấp phía sau (bóng tối hơn) với đuôi én
  const back = hexStr(shadowOf(band)), front = hexStr(band);
  const my = (bt + bb) / 2 + 22 * u, th = (bb - bt) * 0.62;
  for (const sx of [-1, 1]) {
    const inner = sx < 0 ? bl + 40 * u : br - 40 * u, outer = sx < 0 ? x0 + 6 * u : x0 + w - 6 * u, notch = sx < 0 ? x0 + 62 * u : x0 + w - 62 * u;
    ctx.beginPath();
    ctx.moveTo(inner, my - th / 2); ctx.lineTo(outer, my - th / 2); ctx.lineTo(notch, my); ctx.lineTo(outer, my + th / 2); ctx.lineTo(inner, my + th / 2);
    ctx.closePath(); ctx.fillStyle = back; ctx.fill(); ctx.lineWidth = 9 * u; ctx.strokeStyle = INK_HEX; ctx.stroke(); ctx.fill();
  }
  // dải chính hơi cong
  ctx.beginPath();
  ctx.moveTo(bl, bt); ctx.quadraticCurveTo((bl + br) / 2, bt + sag * 2, br, bt);
  ctx.lineTo(br, bb); ctx.quadraticCurveTo((bl + br) / 2, bb + sag * 2, bl, bb); ctx.closePath();
  ctx.fillStyle = front; ctx.fill(); ctx.lineWidth = 10 * u; ctx.strokeStyle = INK_HEX; ctx.stroke();
  // viền chỉ kem bên trong
  ctx.setLineDash([22 * u, 16 * u]); ctx.lineWidth = 5 * u; ctx.strokeStyle = PAL_HEX.cream[300];
  ctx.beginPath(); ctx.moveTo(bl + 18 * u, bt + 20 * u); ctx.quadraticCurveTo((bl + br) / 2, bt + 20 * u + sag * 2, br - 18 * u, bt + 20 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bl + 18 * u, bb - 20 * u); ctx.quadraticCurveTo((bl + br) / 2, bb - 20 * u + sag * 2, br - 18 * u, bb - 20 * u); ctx.stroke();
  ctx.setLineDash([]);
  // khẩu hiệu
  const innerW = br - bl - 50 * u, innerH = bb - bt - 22 * u;
  const { lines, fs } = layoutCheer(ctx, text, innerW, innerH);
  const cy = (bt + bb) / 2 + sag;
  const lh = fs * 1.06;
  const heart = band === PAL.berry[700] ? PAL_HEX.honey[500] : PAL_HEX.berry[500];
  lines.forEach((ln, i) => drawCheerLine(ctx, ln, (bl + br) / 2, cy + (i - (lines.length - 1) / 2) * lh, fs, heart));
  // nơ ở điểm treo
  drawBow(ctx, x0 + w / 2, y0 + 92 * u, 46 * u, hexStr(bow));
}

/** Băng rôn kéo sau máy bay: mép răng cưa tròn, hai đầu thắt nơ. Ô rộng (khuyên dùng ~5,3:1). */
export function drawTowBanner(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, text: string) {
  ctx.clearRect(x0, y0, w, h);
  const u = h / 384;
  const bl = x0 + 120 * u, br = x0 + w - 120 * u, bt = y0 + 70 * u, bb = y0 + h - 70 * u, r = 20 * u;
  const band = PAL_HEX.berry[500];
  ctx.lineJoin = 'round';
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(bl, bt);
    for (let x = bl; x < br - 1; x += r * 2) ctx.arc(x + r, bt, r, Math.PI, 0, false);
    ctx.lineTo(br, bb);
    for (let x = br; x > bl + 1; x -= r * 2) ctx.arc(x - r, bb, r, 0, Math.PI, false);
    ctx.closePath();
  };
  shape(); ctx.lineWidth = 12 * u; ctx.strokeStyle = INK_HEX; ctx.stroke();
  ctx.fillStyle = band; ctx.fill();
  ctx.fillStyle = PAL_HEX.berry[300]; ctx.fillRect(bl + 6 * u, bt + 8 * u, br - bl - 12 * u, 16 * u);
  const { lines, fs } = layoutCheer(ctx, text, br - bl - 80 * u, bb - bt - 30 * u);
  lines.forEach((ln, i) => drawCheerLine(ctx, ln, (bl + br) / 2, (bt + bb) / 2 + (i - (lines.length - 1) / 2) * fs * 1.12, fs, PAL_HEX.honey[500]));
  drawBow(ctx, bl, (bt + bb) / 2, 58 * u, PAL_HEX.honey[500]);
  drawBow(ctx, br, (bt + bb) / 2, 58 * u, PAL_HEX.honey[500]);
}

// ───────────── Hình học ─────────────
/** Kiểu motif trên vỏ: 0 tim, 1 sao, 2 nơ. */
export type MotifKind = 0 | 1 | 2;
export interface BalloonStyle { a: ColorName; b: ColorName; motif: MotifKind; motifCol: number; band: number; bow: number }

/** Profile vỏ mập (đơn vị gốc; nhân scale). Mặt bên rộng nhất r = 5,75 ở y ≈ 1,6. */
const PROFILE_CTRL = [
  [0.85, -5.2], [1.35, -4.6], [2.7, -3.3], [4.3, -1.7], [5.4, 0.1], [5.78, 1.7], [5.6, 3.3], [4.9, 4.75], [3.6, 5.85], [1.9, 6.5], [0.0, 6.7],
].map(([r, y]) => new THREE.Vector2(r, y));
const PROFILE = new THREE.SplineCurve(PROFILE_CTRL).getSpacedPoints(30);
PROFILE[PROFILE.length - 1].x = 0.001;
/** Chiều dài cung profile (đơn vị gốc) — shader dùng để đặt motif. */
export const PROFILE_LEN = new THREE.SplineCurve(PROFILE_CTRL).getLength();
/** Toạ độ y (đơn vị gốc) của các mốc. */
export const BAL_DIM = { mouthY: -5.2, basketY: -6.9, basketBottom: -7.65, top: 6.7, radius: 5.78 } as const;

export interface PartBuffers { parts: THREE.BufferGeometry[] }

const tmpC = new THREE.Vector3();
/** Gắn thuộc tính chung (aInfo id/kind, aColA, aColB, aMot, aPiv) và đẩy vào danh sách. */
function pushPart(out: THREE.BufferGeometry[], g0: THREE.BufferGeometry, m: THREE.Matrix4, id: number, kind: number,
  A: number[] | [number, number, number], B: number[] = [0, 0, 0], mot: number[] = [0, 0, 0, -1], piv: number[] = [0, 0, 0, 0]) {
  if (!g0.attributes.normal) g0.computeVertexNormals();
  const g = g0.index ? g0.toNonIndexed() : g0;
  if (g !== g0) g0.dispose();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const info = new Float32Array(n * 2), ca = new Float32Array(n * 3), cb = new Float32Array(n * 3), mo = new Float32Array(n * 4), pv = new Float32Array(n * 4);
  tmpC.set(piv[0], piv[1], piv[2]).applyMatrix4(m);
  const ax = kind === 4 ? new THREE.Vector3(B[0], B[1], B[2]).transformDirection(m) : null;
  for (let i = 0; i < n; i++) {
    info[i * 2] = id; info[i * 2 + 1] = kind;
    ca.set(A, i * 3); cb.set(ax ? [ax.x, ax.y, ax.z] : B, i * 3); mo.set(mot, i * 4); pv.set([tmpC.x, tmpC.y, tmpC.z, piv[3]], i * 4);
  }
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
  g.setAttribute('aColA', new THREE.BufferAttribute(ca, 3));
  g.setAttribute('aColB', new THREE.BufferAttribute(cb, 3));
  g.setAttribute('aMot', new THREE.BufferAttribute(mo, 4));
  g.setAttribute('aPiv', new THREE.BufferAttribute(pv, 4));
  out.push(g);
  return g;
}

/** Inverted hull: bản sao đẩy theo pháp tuyến, đảo chiều tam giác, kind 5 (màu INK_SKY). */
function pushHull(out: THREE.BufferGeometry[], src: THREE.BufferGeometry, w: number) {
  const g = src.clone();
  const p = g.attributes.position as THREE.BufferAttribute, nr = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nr.getX(i) * w, p.getY(i) + nr.getY(i) * w, p.getZ(i) + nr.getZ(i) * w);
  for (const key of Object.keys(g.attributes)) {
    const at = g.attributes[key] as THREE.BufferAttribute, s = at.itemSize, arr = at.array as Float32Array;
    for (let t = 0; t < at.count; t += 3) for (let c = 0; c < s; c++) {
      const i1 = (t + 1) * s + c, i2 = (t + 2) * s + c, tv = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tv;
    }
  }
  const info = g.attributes.aInfo as THREE.BufferAttribute, ca = g.attributes.aColA as THREE.BufferAttribute;
  const ink = rgb(INK_SKY);
  for (let i = 0; i < info.count; i++) { info.setY(i, 5); ca.setXYZ(i, ink[0], ink[1], ink[2]); }
  out.push(g);
}

let seedState = 7;
const rnd = () => ((seedState = (seedState * 16807) % 2147483647) / 2147483647);

/**
 * Dựng 1 khinh khí cầu ở hệ toạ độ cục bộ (mặt trước +Z) rồi áp `m` (vị trí/hướng/scale).
 * Trả về điểm treo băng rôn (đơn vị gốc, cục bộ) để nơi gọi đặt băng rôn.
 */
export function buildBalloon(out: THREE.BufferGeometry[], m: THREE.Matrix4, id: number, st: BalloonStyle, outlineW: number) {
  const A = rgb(shade(PAL[st.a][500], 'balloon')), B = rgb(shade(PAL[st.b][st.b === 'cream' ? 500 : 300], 'balloon'));
  const mot = [...rgb(st.motifCol), st.motif];
  // vỏ: lathe 8 múi phồng
  const env = new THREE.LatheGeometry(PROFILE, 64);
  const pos = env.attributes.position as THREE.BufferAttribute, uv = env.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const g = (u * 8 + 0.5) % 1;
    const f = 0.95 + 0.05 * Math.sin(Math.PI * g);
    pos.setX(i, pos.getX(i) * f); pos.setZ(i, pos.getZ(i) * f);
  }
  env.computeVertexNormals();
  const envG = pushPart(out, env, m, id, 0, A, B, mot);
  pushHull(out, envG, outlineW);
  // miệng lửa (che lỗ đáy)
  const mouth = new THREE.CircleGeometry(0.9, 16); mouth.rotateX(Math.PI / 2); mouth.translate(0, BAL_DIM.mouthY + 0.05, 0);
  pushPart(out, mouth, m, id, 2, rgb(PAL.honey[500]));
  // giỏ tròn + vành
  const basketCol = rgb(PAL.peach[700]);
  const basket = new THREE.CylinderGeometry(1.35, 1.1, 1.3, 18); basket.translate(0, BAL_DIM.basketY - 0.1, 0);
  const bG = pushPart(out, basket, m, id, 1, basketCol);
  pushHull(out, bG, outlineW * 0.35);
  const rim = new THREE.TorusGeometry(1.38, 0.16, 6, 18); rim.rotateX(Math.PI / 2); rim.translate(0, BAL_DIM.basketY + 0.55, 0);
  pushPart(out, rim, m, id, 1, rgb(PAL.honey[700]));
  // 4 dây
  for (const a of [0.25, 0.75, 1.25, 1.75]) {
    const ang = a * Math.PI;
    const top = new THREE.Vector3(Math.sin(ang) * 1.05, BAL_DIM.mouthY + 0.1, Math.cos(ang) * 1.05);
    const bot = new THREE.Vector3(Math.sin(ang) * 1.3, BAL_DIM.basketY + 0.6, Math.cos(ang) * 1.3);
    pushPart(out, beam(top, bot, 0.07), m, id, 1, rgb(PAL.night[100]));
  }
  // 2 hành khách chibi (đầu to, mắt chấm), nhìn ra phía trước (+Z)
  for (const sx of [-1, 1]) {
    const skin = rgb(SKIN[Math.floor(rnd() * 3)]), hair = rgb(HAIR[Math.floor(rnd() * HAIR.length)]);
    const cloth = rgb(PAL[(['berry', 'soda', 'mint', 'grape', 'honey'] as const)[Math.floor(rnd() * 5)]][500]);
    const hx = sx * 0.6, hy = BAL_DIM.basketY + 1.45, hz = 0.5;
    const body = new THREE.CapsuleGeometry(0.36, 0.5, 3, 8); body.translate(hx, BAL_DIM.basketY + 0.6, hz);
    pushPart(out, body, m, id, 1, cloth);
    const head = new THREE.SphereGeometry(0.6, 16, 12); head.translate(hx, hy, hz);
    pushPart(out, head, m, id, 3, skin);
    const hairG = new THREE.SphereGeometry(0.645, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
    hairG.rotateX(-0.35); hairG.translate(hx, hy + 0.02, hz - 0.03);
    pushPart(out, hairG, m, id, 1, hair);
    // tay vẫy: dựng giơ lên-ra ngoài, shader hạ xuống khi Hype thấp
    const sh = new THREE.Vector3(hx + sx * 0.34, BAL_DIM.basketY + 0.85, hz + 0.05);
    const arm = new THREE.CapsuleGeometry(0.12, 0.62, 3, 6);
    arm.translate(0, 0.43, 0); arm.rotateZ(-sx * 0.55); arm.translate(sh.x, sh.y, sh.z);
    pushPart(out, arm, m, id, 4, skin, [0, 0, 1], [0, 0, 0, -1], [sh.x, sh.y, sh.z, sx]);
  }
}

export function beam(a: THREE.Vector3, b: THREE.Vector3, th: number) {
  const g = new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Dây treo băng rôn: từ đáy giỏ tới nơ (giữa mép trên băng rôn) và hai góc trên. Đơn vị gốc cục bộ. */
export function buildHangers(out: THREE.BufferGeometry[], m: THREE.Matrix4, id: number, topY: number, halfW: number) {
  const from = new THREE.Vector3(0, BAL_DIM.basketBottom, 0.2);
  const ink = rgb(PAL.night[100]);
  pushPart(out, beam(from, new THREE.Vector3(0, topY, 0), 0.06), m, id, 1, ink);
  pushPart(out, beam(from, new THREE.Vector3(-halfW, topY - 0.3, 0), 0.05), m, id, 1, ink);
  pushPart(out, beam(from, new THREE.Vector3(halfW, topY - 0.3, 0), 0.05), m, id, 1, ink);
}

// ───────────── Shader khinh khí cầu ─────────────
/** DYN: vị trí/scale từng quả lấy từ uniform uBal[4] (xyz, scale) — dùng cho flyby. */
export function balloonVert(dyn: boolean) {
  return /* glsl */ `
uniform float uTime; uniform float uHype;
${dyn ? 'uniform vec4 uBal[4];' : ''}
attribute vec2 aInfo; attribute vec3 aColA; attribute vec3 aColB; attribute vec4 aMot; attribute vec4 aPiv;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying vec4 vMot; varying float vKind; varying float vId; varying vec3 vN;
${BOB_GLSL}
vec3 rotAx(vec3 v, vec3 k, float a){ float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
void main(){
  vUv = uv; vA = aColA; vB = aColB; vMot = aMot; vKind = aInfo.y; vId = aInfo.x;
  vec3 p = position; vec3 n = normal;
  if (aInfo.y > 3.5 && aInfo.y < 4.5) {
    float w = smoothstep(0.72, 0.9, uHype);
    float ang = aPiv.w * ((1.0 - w) * 2.5 - w * 0.45 * sin(uTime * 8.0 + aInfo.x * 1.7 + aPiv.w));
    vec3 k = normalize(aColB);
    p = aPiv.xyz + rotAx(p - aPiv.xyz, k, ang); n = rotAx(n, k, ang);
  }
${dyn ? `  int i = int(aInfo.x + 0.5);
  vec4 b = uBal[0];
  if (i == 1) b = uBal[1]; else if (i == 2) b = uBal[2]; else if (i == 3) b = uBal[3];
  p = p * b.w + b.xyz + bob(aInfo.x, uTime) * 0.5;` : '  p += bob(aInfo.x, uTime);'}
  vN = normalize(n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
}

export const BOB_GLSL = /* glsl */ `
vec3 bob(float id, float t){ return vec3(sin(t*0.13+id*1.7)*2.4, sin(t*0.42+id*2.3)*1.3, cos(t*0.11+id*1.3)*1.8); }`;

/** Tô đồ chơi 2 bậc: bóng tối hơn, dịch về tím, không về đen. */
export const TOON_GLSL = /* glsl */ `
vec3 toon(vec3 c, vec3 n){
  float d = dot(normalize(n), normalize(vec3(-0.45, 0.8, 0.55)));
  float k = smoothstep(-0.12, -0.02, d);
  vec3 sh = c * 0.7; sh = mix(sh, vec3(dot(sh, vec3(0.33))) * vec3(0.8, 0.62, 1.3), 0.35);
  sh = max(sh, vec3(0.1, 0.08, 0.2));
  return mix(sh, c, k);
}`;

export const BALLOON_FRAG = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying vec4 vMot; varying float vKind; varying float vId; varying vec3 vN;
${TOON_GLSL}
float dot2(vec2 v){ return dot(v, v); }
float sdHeart(vec2 p){
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
float sdStar5(vec2 p, float r, float rf){
  const vec2 k1 = vec2(0.809016994375, -0.587785252292); const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x); p -= 2.0 * max(dot(k1, p), 0.0) * k1; p -= 2.0 * max(dot(k2, p), 0.0) * k2; p.x = abs(p.x);
  p.y -= r; vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1); float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float sdBow(vec2 p){
  float knot = length(p) - 0.22;
  vec2 q = vec2(abs(p.x), p.y);
  float wing = max(abs(q.y) - (0.12 + 0.55 * q.x), q.x - 0.95) - 0.06;
  return min(knot, wing);
}
void main(){
  vec3 c; float k = vKind;
  if (k > 4.5) { c = vA; }
  else if (k > 3.5 || (k > 0.5 && k < 1.5)) { c = toon(vA, vN); }
  else if (k > 1.5 && k < 2.5) { c = vA * (1.1 + 0.25 * sin(uTime * 17.0 + vId * 5.0)) * (1.0 + 0.5 * uPulse); }
  else if (k > 2.5) {
    c = toon(vA, vN);
    vec2 q = vec2((vUv.x - 0.25) * 6.2832, (vUv.y - 0.5) * 3.1416);
    float cheek = smoothstep(0.15, 0.1, length(vec2(abs(q.x) - 0.5, q.y + 0.2)));
    c = mix(c, vec3(1.0, 0.58, 0.77), cheek * 0.45);
    vec2 e = vec2(abs(q.x) - 0.3, q.y - 0.02);
    float eye = smoothstep(0.13, 0.1, length(e * vec2(1.0, 0.8)));
    c = mix(c, vec3(0.169, 0.114, 0.361), eye);
    c = mix(c, vec3(1.0), smoothstep(0.05, 0.03, length(e - vec2(-0.035, 0.045))) * eye);
    float sm = abs(length(q - vec2(0.0, -0.05)) - 0.17);
    c = mix(c, vec3(0.72, 0.2, 0.43), smoothstep(0.045, 0.02, sm) * step(q.y, -0.17) * step(abs(q.x), 0.12));
  } else {
    // vỏ: sọc 8 múi, motif phía trước (+Z) và phía sau, highlight kem, lửa ấm trong theo phách
    float u = vUv.x, v = vUv.y;
    float s = step(0.5, fract(u * 4.0 + 0.25));
    vec3 base = mix(vB, vA, s);
    float g = fract(u * 8.0 + 0.5);
    base *= 0.9 + 0.1 * smoothstep(0.0, 0.25, min(g, 1.0 - g));
    c = toon(base, vN);
    float du0 = fract(u + 0.5) - 0.5, du1 = fract(u) - 0.5;
    float du = abs(du0) < abs(du1) ? du0 : du1;
    vec2 q = vec2(du * 6.2832 * 5.6, (v - 0.47) * ${PROFILE_LEN.toFixed(2)}) / 2.2;
    float d = 1e3;
    if (vMot.w < 0.5) d = sdHeart(q + vec2(0.0, 0.5)) * 1.0;
    else if (vMot.w < 1.5) d = sdStar5(q, 0.85, 0.48) - 0.08;
    else d = sdBow(q * 1.05);
    c = mix(c, vec3(0.29, 0.247, 0.51), smoothstep(0.1, 0.07, d));
    c = mix(c, toon(vMot.rgb, vN), smoothstep(0.02, -0.01, d));
    float hi = smoothstep(0.955, 0.965, dot(normalize(vN), normalize(vec3(-0.55, 0.62, 0.56))));
    c = mix(c, vec3(1.0, 0.98, 0.95), hi * 0.9);
    float glow = exp(-pow(v * 4.5, 2.0)) * (0.3 + 0.7 * uPulse) * (0.7 + 0.4 * uHype);
    c = mix(c, c * vec3(1.25, 1.0, 0.7) + vec3(0.25, 0.12, 0.0), glow * 0.8);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

/** Băng rôn: sway + gợn trong vertex shader; mặt sau lật UV (đọc xuôi cả hai mặt). */
export function bannerVert(dyn: boolean) {
  return /* glsl */ `
uniform float uTime;
${dyn ? 'uniform vec4 uBal[4];' : ''}
attribute vec2 aBan; // id, lv (0 mép trên → 1 mép dưới)
attribute vec4 aFlip; // uv-x min, max của ô trong atlas, piv.xz (gốc treo, chỉ khi DYN)
varying vec2 vUv; varying vec2 vFlip;
${BOB_GLSL}
void main(){
  vUv = uv; vFlip = aFlip.xy;
  float id = aBan.x, lv = aBan.y;
  vec3 p = position;
  float sw = sin(uTime * 0.9 + id * 1.9) * 0.08 * lv;
  p += normal * (sw * 8.0 + sin(uv.x * 40.0 - uTime * 2.3 + id) * 0.3 * (0.3 + lv));
  p.y += abs(sw) * 0.8;
${dyn ? `  int i = int(id + 0.5);
  vec4 b = uBal[0];
  if (i == 1) b = uBal[1]; else if (i == 2) b = uBal[2]; else if (i == 3) b = uBal[3];
  p = p * b.w + b.xyz + bob(id, uTime) * 0.5;` : '  p += bob(id, uTime);'}
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
}
export const BANNER_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uPulse; uniform float uHype;
varying vec2 vUv; varying vec2 vFlip;
void main(){
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = vFlip.x + vFlip.y - uv.x;
  vec4 c = texture2D(uMap, uv);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb * (0.94 + 0.12 * uPulse * uHype), 1.0);
}`;

/** Thêm 1 băng rôn W×H (m, đã scale) treo tại `top` (cục bộ, đã scale) với ô atlas rect (uv 0..1). */
export function pushBanner(out: THREE.BufferGeometry[], m: THREE.Matrix4, id: number, W: number, H: number, topY: number,
  r: { u0: number; v0: number; u1: number; v1: number }) {
  const g = new THREE.PlaneGeometry(W, H, 28, 6);
  g.translate(0, topY - H / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute, n = uv.count;
  const ban = new Float32Array(n * 2), fl = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const y = uv.getY(i);
    ban[i * 2] = id; ban[i * 2 + 1] = 1 - y;
    uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + y * (r.v1 - r.v0));
    fl.set([r.u0, r.u1, 0, 0], i * 4);
  }
  g.applyMatrix4(m);
  g.setAttribute('aBan', new THREE.BufferAttribute(ban, 2));
  g.setAttribute('aFlip', new THREE.BufferAttribute(fl, 4));
  out.push(g);
}

export { MOTIF };
