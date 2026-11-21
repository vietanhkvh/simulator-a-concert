// "Đêm Sao Điểm Ảnh" · khe bannerCarriers (P5, STYLE_E §6): SÁU TOAN CĂNG KHUNG TRÊN GIÁ VẼ KHỔNG LỒ + NHÃN BẢO TÀNG
// thay sáu khinh khí cầu. Đứng sau khán đài xa nhất như bản mặc định (vòng cung ±40° quanh STADIUM_CENTRE, r 138–165 m),
// chân giá chìm sau khán đài; mép dưới nhãn cao hơn đường ngắm mắt ca sĩ → mép trên khán đài 1 m nên cả tranh lẫn nhãn ló ra.
// Mỗi toan 34 × 20 m: nền vệt cọ pixel theo một tác phẩm công cộng (Đêm đầy sao, Hướng dương, Tiếng thét, Sóng lừng,
// Cây bách, Đêm tím) + LỜI CỔ VŨ chữ đậm kem crôm viền mực (to nhất có thể, 1–2 dòng); nhãn đồng vàng gắn giữa mép dưới khung ghi lại lời
// cổ vũ + số + tên tranh. Giá vẽ gỗ 3 chân + gờ đỡ + kẹp đầu; viền mực 1 texel quanh mọi khối.
// setCheerBanners() → vẽ lại atlas. 2 draw call (tô + viền, một hình học gộp, atlas CanvasTexture), tĩnh.
import * as THREE from 'three';
import { EYE_HEIGHT, STADIUM_CENTRE, STANDS_R_OUTER, STANDS_TOP_Y } from '../../../../world/layout';
import { getCheerTexts, onCheerChange } from '../../balloons';
import type { BannerCarriersHandle, OutsideBuildContext, OutsideBuilders } from '../../builders';
import { drawCanvasPainting, drawPlaque } from './bannerKit';
import { MODE, Parts, V3, makePixelMesh, pr } from './secretKit';

/** Toan (m) và nhãn (m). */
export const CANVAS_W = 34, CANVAS_H = 20;
const PW = 11, PH = 3.4;
const CB = PH - 1.6; // mép dưới toan (toạ độ cục bộ, gốc = mép dưới nhãn): nhãn gắn chồng lên mép dưới khung toan
const AW = 1024;
const CPX = { w: 512, h: Math.round((512 * CANVAS_H) / CANVAS_W) };
const PPX = { w: 170, h: Math.round((170 * PH) / PW) };
const AH = CPX.h * 3 + 4 + PPX.h;
/** Góc (độ, 0 = phía xa đối diện sân khấu) và bán kính quanh STADIUM_CENTRE — cùng vòng cung với khinh khí cầu mặc định. */
const ARC = [
  { deg: -40, r: 165 }, { deg: -24.5, r: 148 }, { deg: -8.6, r: 138 }, { deg: 8.6, r: 138 }, { deg: 24.5, r: 148 }, { deg: 40, r: 165 },
];
/** Kiểu nền tranh cho từng ô (trái → phải). */
const STYLE = [4, 0, 2, 1, 3, 5];

const slope = () => (STANDS_TOP_Y - EYE_HEIGHT) / (STANDS_R_OUTER - STADIUM_CENTRE.z);
/** Gốc giá vẽ (mép dưới nhãn) của ô i. */
export function easelBase(i: number, out = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(ARC[i]!.deg), r = ARC[i]!.r;
  const x = STADIUM_CENTRE.x + Math.sin(a) * r, z = STADIUM_CENTRE.z - Math.cos(a) * r;
  return out.set(x, EYE_HEIGHT + Math.hypot(x, z) * slope() + 1, z);
}

/** Hộp nối hai điểm (thanh gỗ). */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number) {
  const g = new THREE.BoxGeometry(w, a.distanceTo(b), d);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()), V3(1, 1, 1)));
  return g;
}

function cellUv(x: number, y: number, w: number, h: number): [number, number, number, number] {
  return [x / AW, (x + w) / AW, 1 - (y + h) / AH, 1 - y / AH];
}
const paintCell = (i: number) => ({ x: (i % 2) * CPX.w, y: Math.floor(i / 2) * CPX.h, ...CPX });
const plaqueCell = (i: number) => ({ x: i * PPX.w, y: CPX.h * 3 + 4, ...PPX });

export function createCanvasCarriers(ctx: OutsideBuildContext): BannerCarriersHandle {
  const { scene } = ctx;
  const canvas = document.createElement('canvas');
  canvas.width = AW; canvas.height = AH;
  const g2 = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    const texts = getCheerTexts();
    for (let i = 0; i < 6; i++) {
      const c = paintCell(i), p = plaqueCell(i), txt = texts[i] ?? '';
      drawCanvasPainting(g2, c.x, c.y, c.w, c.h, txt, STYLE[i]!, 11 + i * 37);
      drawPlaque(g2, p.x, p.y, p.w, p.h, i + 1, txt, STYLE[i]!);
    }
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(draw).catch(() => {});

  const dat = pr('dat'), crom = pr('crom');
  const parts = new Parts();
  const base = V3(0, 0, 0);
  for (let i = 0; i < 6; i++) {
    easelBase(i, base);
    const ry = Math.atan2(-base.x, -base.z); // mặt trước (+z cục bộ) hướng về ca sĩ
    const m = new THREE.Matrix4().compose(base, new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), ry), V3(1, 1, 1));
    const foot = -(base.y - 6); // chân giá chạm đất sau khán đài (y ≈ 6)
    const top = CB + CANVAS_H;
    // toan: khung căng (cạnh gỗ) + mặt tranh
    const box = new THREE.BoxGeometry(CANVAS_W, CANVAS_H, 1.0); box.translate(0, CB + CANVAS_H / 2, 0);
    parts.add(box, dat[300], m);
    const c = paintCell(i);
    const face = new THREE.PlaneGeometry(CANVAS_W, CANVAS_H); face.translate(0, CB + CANVAS_H / 2, 0.52);
    parts.add(face, 0xffffff, m, { mode: MODE.tex, out: 'none', uv: cellUv(c.x, c.y, c.w, c.h) });
    // giá vẽ: cột giữa sau toan, kẹp đầu, gờ đỡ, 3 chân
    parts.add(beam(V3(0, foot * 0.2, -1.0), V3(0, top + 5, -1.0), 1.6, 1.2), dat[500], m);
    const clamp = new THREE.BoxGeometry(4.2, 2.0, 2.2); clamp.translate(0, top + 0.6, 0.1);
    parts.add(clamp, dat[500], m);
    const ledge = new THREE.BoxGeometry(CANVAS_W + 3, 1.2, 1.6); ledge.translate(0, CB - 0.6, -0.1);
    parts.add(ledge, dat[500], m);
    for (const sx of [-1, 1]) parts.add(beam(V3(sx * CANVAS_W * 0.3, top - 1, -1.3), V3(sx * (CANVAS_W / 2 + 4), foot, -0.4), 1.3, 1.3), dat[500], m);
    parts.add(beam(V3(0, top + 2, -1.3), V3(0, foot, -18), 1.3, 1.3), dat[700], m);
    // nhãn đồng: tấm lót + mặt chữ, treo trước gờ
    const back = new THREE.BoxGeometry(PW + 0.6, PH + 0.6, 0.4); back.translate(0, PH / 2, 1.0);
    parts.add(back, crom[700], m);
    const p = plaqueCell(i);
    const pf = new THREE.PlaneGeometry(PW, PH); pf.translate(0, PH / 2, 1.22);
    parts.add(pf, 0xffffff, m, { mode: MODE.tex, out: 'none', uv: cellUv(p.x, p.y, p.w, p.h) });
  }
  const root = new THREE.Group();
  scene.add(root);
  const pm = makePixelMesh(parts.build(), 1, root, { map: tex, inkBack: 1.2 });
  return {
    update() { pm.tick(); },
    dispose() {
      disposed = true;
      off();
      pm.dispose(); tex.dispose();
      root.removeFromParent();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { bannerCarriers: createCanvasCarriers };
