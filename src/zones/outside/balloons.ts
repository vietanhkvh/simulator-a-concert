// Khinh khí cầu mang băng rôn cổ vũ (khẩu hiệu fan), đặt SAU KHÁN ĐÀI XA NHẤT (vòng cung r ≈ 138–158 m quanh tâm
// sân, ±44° quanh hướng nhìn của ca sĩ), đủ cao để cả vỏ lẫn băng rôn ló trên mép khán đài (≈ 36 m) từ mắt ca sĩ.
// Phong cách "Kẹo đêm · chibi": vỏ mập 8 múi sọc 2 token + motif, viền INK_SKY (inverted hull gộp chung mesh),
// tô 2 bậc + highlight, lửa ấm đập theo phách, giỏ tròn có 2 hành khách chibi (vẫy tay khi Hype cao).
// 2 draw call: thân (vỏ+giỏ+người+dây+viền) và băng rôn (CanvasTexture atlas). Bập bềnh + đung đưa trong shader.
// setCheerBanners() đổi khẩu hiệu lúc chạy; triggerFlyby() yêu cầu màn bay chào mừng (flyby.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Uniforms } from '../../world/shared/glowPoints';
import { BALLOON_Y, EYE_HEIGHT, STADIUM_CENTRE, STANDS_R_OUTER, STANDS_TOP_Y } from '../../world/layout';
import { MOTIF, PAL } from '../../world/style';
import {
  BALLOON_FRAG, BANNER_FRAG, BAL_DIM, balloonVert, bannerVert, buildBalloon, buildHangers, drawRibbonBanner, pushBanner,
  type BalloonStyle,
} from './balloonKit';
export { CHEER_FONT, drawCheerText } from './balloonKit';

export const DEFAULT_CHEERS = ['MÃI YÊU ♥', 'HÁT NỮA ĐI!', 'ENCORE!', 'CHÁY HẾT MÌNH', 'WE LOVE YOU', 'NGÔI SAO ĐÊM NAY'];
let cheerTexts: string[] = DEFAULT_CHEERS.slice();
const cheerListeners = new Set<() => void>();
let flybyRequested = false;

/** Khẩu hiệu hiện tại (luôn đủ 6). */
export function getCheerTexts(): string[] { return cheerTexts.slice(); }
/** Đăng ký vẽ lại khi khẩu hiệu đổi; trả về hàm huỷ đăng ký. */
export function onCheerChange(cb: () => void): () => void { cheerListeners.add(cb); return () => { cheerListeners.delete(cb); }; }

/** Thay khẩu hiệu trên 6 khinh khí cầu (tối đa 6 chuỗi, mỗi chuỗi ≤ 24 ký tự; thiếu → mặc định). Gọi được trước/sau khi tạo backdrop. */
export function setCheerBanners(texts: string[]): void {
  const src = Array.isArray(texts) ? texts : [];
  cheerTexts = DEFAULT_CHEERS.map((d, i) => {
    const s = typeof src[i] === 'string' ? src[i].trim().slice(0, 24).trim() : '';
    return s || d;
  });
  cheerListeners.forEach((cb) => cb());
}

/** Kích hoạt màn bay chào mừng (máy bay kéo băng rôn + khinh khí cầu) ngay lập tức. Gọi lúc nào cũng được. */
export function triggerFlyby(): void { flybyRequested = true; }
/** (nội bộ) flyby.ts đọc + xoá yêu cầu. */
export function consumeFlybyRequest(): boolean { const r = flybyRequested; flybyRequested = false; return r; }

if (typeof window !== 'undefined' && (import.meta.env.DEV || location.search.includes('debugSky'))) {
  (window as unknown as { __debugSky: unknown }).__debugSky = { setCheerBanners, triggerFlyby, getCheerTexts };
}

/** Phóng to so với kích thước gốc (để băng rôn đọc được từ xa ~150 m). */
export const BALLOON_SCALE = 2.0;
/** Băng rôn (m) và ô atlas tương ứng (px), tỉ lệ 16:9. */
export const BANNER_W = 36, BANNER_H = 20.25, BANNER_PX_W = 1024, BANNER_PX_H = 576;
/** Mép trên băng rôn so với tâm vỏ (m, đã scale): ngay dưới đáy giỏ. */
export const BANNER_TOP = BAL_DIM.basketBottom * BALLOON_SCALE - 0.9;
/** Phần dải chữ kết thúc ở tỉ lệ này của chiều cao băng rôn (phía dưới là nền trong suốt). */
const BAND_BOTTOM_FRAC = 536 / 576;

export const BALLOON_STYLES: BalloonStyle[] = [
  { a: 'berry', b: 'cream', motif: 0, motifCol: MOTIF.star, band: PAL.berry[700], bow: PAL.soda[500] },
  { a: 'soda', b: 'cream', motif: 1, motifCol: MOTIF.star, band: PAL.soda[700], bow: PAL.berry[500] },
  { a: 'grape', b: 'honey', motif: 0, motifCol: MOTIF.heart, band: PAL.grape[700], bow: PAL.honey[500] },
  { a: 'mint', b: 'cream', motif: 2, motifCol: MOTIF.heart, band: PAL.mint[700], bow: PAL.berry[500] },
  { a: 'peach', b: 'cream', motif: 1, motifCol: PAL.grape[500], band: PAL.peach[700], bow: PAL.soda[500] },
  { a: 'berry', b: 'grape', motif: 2, motifCol: MOTIF.bow, band: PAL.grape[700], bow: PAL.honey[500] },
];

/** Góc (độ, 0 = phía xa đối diện sân khấu, + = bên phải ca sĩ) và bán kính quanh STADIUM_CENTRE. */
const ARC = [
  { deg: -44, r: 146 }, { deg: -26, r: 156 }, { deg: -9, r: 140 }, { deg: 9, r: 152 }, { deg: 26, r: 140 }, { deg: 44, r: 154 },
];

/**
 * Vị trí tâm vỏ của khinh khí cầu i: đủ cao để mép dưới dải chữ băng rôn nằm trên đường ngắm
 * từ mắt ca sĩ qua mép trên khán đài (+1 m), kẹp trong BALLOON_Y.
 */
export function balloonPosition(deg: number, r: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(deg);
  const x = STADIUM_CENTRE.x + Math.sin(a) * r, z = STADIUM_CENTRE.z - Math.cos(a) * r;
  const d = Math.hypot(x, z);
  const slope = (STANDS_TOP_Y - EYE_HEIGHT) / (STANDS_R_OUTER - STADIUM_CENTRE.z);
  const bandBottom = -BANNER_TOP + BANNER_H * BAND_BOTTOM_FRAC;
  const y = THREE.MathUtils.clamp(EYE_HEIGHT + d * slope + bandBottom + 1, BALLOON_Y.min, BALLOON_Y.max);
  return out.set(x, y, z);
}

export function createBalloons(scene: THREE.Scene, uniforms: Uniforms) {
  const disposables: { dispose(): void }[] = [];
  const n = BALLOON_STYLES.length, COLS = 2, ROWS = Math.ceil(n / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = BANNER_PX_W * COLS; canvas.height = BANNER_PX_H * ROWS;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  const cell = (i: number) => ({ x: (i % COLS) * BANNER_PX_W, y: Math.floor(i / COLS) * BANNER_PX_H });
  const draw = () => {
    const texts = getCheerTexts();
    BALLOON_STYLES.forEach((s, i) => {
      const c = cell(i);
      drawRibbonBanner(ctx, c.x, c.y, BANNER_PX_W, BANNER_PX_H, texts[i], s.band, s.bow);
    });
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  // vẽ lại khi font web (Baloo 2) tải xong
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(() => { if (!disposed) draw(); }).catch(() => {});
  let disposed = false;
  disposables.push(tex, { dispose: off });

  const balParts: THREE.BufferGeometry[] = [];
  const banParts: THREE.BufferGeometry[] = [];
  const S = BALLOON_SCALE;
  const p = new THREE.Vector3();
  BALLOON_STYLES.forEach((st, id) => {
    balloonPosition(ARC[id].deg, ARC[id].r, p);
    const ry = Math.atan2(-p.x, -p.z); // mặt trước (+Z cục bộ) hướng về ca sĩ
    const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(S, S, S));
    buildBalloon(balParts, m, id, st, 0.22);
    buildHangers(balParts, m, id, (BANNER_TOP - BANNER_H * (92 / 576)) / S, BANNER_W * 0.42 / S);
    const c = cell(id);
    const mb = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    pushBanner(banParts, mb, id, BANNER_W, BANNER_H, BANNER_TOP, {
      u0: c.x / canvas.width, u1: (c.x + BANNER_PX_W) / canvas.width,
      v0: 1 - (c.y + BANNER_PX_H) / canvas.height, v1: 1 - c.y / canvas.height,
    });
  });
  const balGeo = mergeGeometries(balParts)!;
  const banGeo = mergeGeometries(banParts)!;
  balParts.forEach((g) => g.dispose()); banParts.forEach((g) => g.dispose());
  const balMat = new THREE.ShaderMaterial({ uniforms, vertexShader: balloonVert(false), fragmentShader: BALLOON_FRAG, fog: false });
  const banMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: tex } }, vertexShader: bannerVert(false), fragmentShader: BANNER_FRAG, fog: false, side: THREE.DoubleSide,
  });
  const bal = new THREE.Mesh(balGeo, balMat); bal.frustumCulled = false;
  const ban = new THREE.Mesh(banGeo, banMat); ban.frustumCulled = false;
  scene.add(bal, ban);
  disposables.push(balGeo, banGeo, balMat, banMat);
  return {
    dispose() {
      disposed = true;
      scene.remove(bal, ban);
      disposables.forEach((d) => d.dispose());
    },
  };
}
