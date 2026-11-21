// "Đêm Sao Điểm Ảnh" — tiện ích vẽ của gói P5 cho băng rôn (file phụ trợ, KHÔNG đăng ký builder):
// "tranh trên toan" = nền vệt cọ chunky (vẽ trên lưới thô rồi phóng nearest → điểm ảnh thật, mỗi vệt một màu, không
// gradient) theo 6 tác phẩm công cộng (Đêm đầy sao · Hướng dương · Tiếng thét · Sóng lừng · Cây bách · Đêm tím) + lời cổ vũ
// chữ đậm hẹp kem crôm viền mực dày + bóng cứng; nhãn bảo tàng (plaque) đồng vàng viền bậc thang. Màu đọc LÚC GỌI.
import { hexStr } from '../../../../world/style';
import { pr, single } from './secretKit';

/** Sans đậm hẹp của hệ thống (đủ dấu tiếng Việt), dễ đọc ở 427×240. */
export const CHEER_FONT = '"DejaVu Sans Condensed", "Roboto Condensed", "Arial Narrow", "Liberation Sans Narrow", "Noto Sans", "DejaVu Sans", Arial, sans-serif';
const css = (h: number) => hexStr(h);

type Painting = { base: number; strokes: number[]; dots?: number[]; bands?: number[] };
const PAINTINGS = (): Painting[] => {
  const pho = pr('pho'), crom = pr('crom'), son = pr('son'), bach = pr('bach'), tim = pr('tim'), may = pr('may'), dat = pr('dat');
  return [
    { base: pho[500], strokes: [pho[300], pho[100], pho[700], pho[300]], dots: [crom[300], crom[100]] }, // Đêm đầy sao
    { base: crom[500], strokes: [crom[300], crom[700], dat[300], crom[100]] }, // Hướng dương
    { base: son[500], strokes: [son[300], son[100], son[700]], bands: [son[300], son[500], son[100], son[300], pho[500], pho[700]] }, // Tiếng thét
    { base: pho[300], strokes: [may[100], pho[500], pho[100], may[300]] }, // Sóng lừng
    { base: bach[500], strokes: [bach[300], bach[700], bach[100], pho[500]] }, // Cây bách
    { base: tim[500], strokes: [tim[300], tim[700], tim[100]], dots: [crom[300], single('sen')] }, // Đêm tím
  ];
};

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

let scratch: HTMLCanvasElement | null = null;
/** Nền tranh vệt cọ ở lưới thô gw × gh, phóng nearest vào ô (x, y, w, h). */
export function drawPaintingBg(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: number, seed: number, gw = 72) {
  const P = PAINTINGS()[style % 6]!;
  const gh = Math.max(8, Math.round((gw * h) / w));
  scratch ??= document.createElement('canvas');
  scratch.width = gw; scratch.height = gh;
  const s = scratch.getContext('2d')!;
  const rnd = seeded(seed);
  s.fillStyle = css(P.base); s.fillRect(0, 0, gw, gh);
  if (P.bands) {
    // dải gợn ngang (Tiếng thét): mỗi dải một màu, mép lượn theo bậc
    const n = P.bands.length;
    for (let k = 0; k < n; k++) {
      s.fillStyle = css(P.bands[k]!);
      for (let cx = 0; cx < gw; cx++) {
        const y0 = Math.round((k / n) * gh + Math.sin(cx * 0.22 + k * 1.3) * 1.6);
        s.fillRect(cx, y0, 1, Math.ceil(gh / n) + 2);
      }
    }
  }
  // vệt cọ 3–7 texel, một màu mỗi vệt, hướng theo trường dòng (xoáy nhẹ)
  const N = Math.round(gw * gh * 0.09);
  for (let i = 0; i < N; i++) {
    const cx = Math.floor(rnd() * gw), cy = Math.floor(rnd() * gh);
    const len = 3 + Math.floor(rnd() * 5);
    const ang = Math.sin(cx * 0.12 + style) * 0.5 + Math.cos(cy * 0.2 + style * 2) * 0.6;
    s.fillStyle = css(P.strokes[Math.floor(rnd() * P.strokes.length)]!);
    for (let k = 0; k < len; k++) s.fillRect(Math.round(cx + Math.cos(ang) * k), Math.round(cy + Math.sin(ang) * k), 1, 1);
  }
  if (P.dots) {
    for (let i = 0; i < 6; i++) {
      const cx = Math.floor(rnd() * gw), cy = Math.floor(rnd() * gh * 0.6);
      s.fillStyle = css(P.dots[0]!); s.fillRect(cx - 1, cy - 1, 3, 3);
      s.fillStyle = css(P.dots[1]!); s.fillRect(cx, cy, 1, 1);
    }
  }
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(scratch, 0, 0, gw, gh, x, y, w, h);
  g.restore();
}

const words = (t: string) => t.trim().toUpperCase().split(/\s+/).filter(Boolean);

/** Lời cổ vũ 1–2 dòng (chọn cách cho chữ to nhất) căn giữa ô, kem crôm viền mực dày + bóng cứng. Trả về cỡ chữ (px). */
export function drawCheer(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, maxH: number): number {
  const ws = words(text);
  if (!ws.length) return 0;
  const probe = 100;
  g.save();
  g.font = `800 ${probe}px ${CHEER_FONT}`;
  let best = { em: 0, lines: [ws.join(' ')] };
  for (let nl = 1; nl <= Math.min(2, ws.length); nl++) {
    let lines = [ws.join(' ')];
    if (nl === 2) {
      let bw = 1e9;
      for (let k = 1; k < ws.length; k++) {
        const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' ');
        const w = Math.max(g.measureText(a).width, g.measureText(b).width);
        if (w < bw) { bw = w; lines = [a, b]; }
      }
    }
    const w = Math.max(...lines.map((l) => g.measureText(l).width)) / probe;
    const em = Math.min(maxW / (w + 0.25), maxH / (nl * 1.18 + 0.2));
    if (em > best.em * 1.05) best = { em, lines };
  }
  const em = Math.floor(best.em);
  g.font = `800 ${em}px ${CHEER_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'miter'; g.miterLimit = 2;
  const ink = css(single('ink')), fill = css(pr('crom')[100]);
  const lh = em * 1.18, y0 = cy - ((best.lines.length - 1) * lh) / 2 + em * 0.08;
  const sh = Math.max(2, Math.round(em * 0.09));
  best.lines.forEach((l, i) => {
    const y = y0 + i * lh;
    g.lineWidth = Math.max(3, em * 0.2);
    g.strokeStyle = ink; g.fillStyle = ink;
    g.strokeText(l, cx + sh, y + sh); g.fillText(l, cx + sh, y + sh); // bóng cứng lệch
    g.strokeText(l, cx, y);
    g.fillStyle = fill; g.fillText(l, cx, y);
  });
  g.restore();
  return em;
}

/** Tranh căng toan: nền vệt cọ + mép toan sáng 1 bậc + lời cổ vũ. */
export function drawCanvasPainting(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, style: number, seed: number) {
  drawPaintingBg(g, x, y, w, h, style, seed);
  const ink = css(single('ink'));
  const b = Math.max(4, Math.round(w * 0.012));
  g.fillStyle = ink;
  g.fillRect(x, y, w, b); g.fillRect(x, y + h - b, w, b); g.fillRect(x, y, b, h); g.fillRect(x + w - b, y, b, h);
  drawCheer(g, text, x + w / 2, y + h * 0.45, w * 0.92, h * 0.78); // chừa mép dưới cho nhãn
}

/** Tên 6 tác phẩm (phạm vi công cộng) theo kiểu nền. */
export const PAINTING_TITLES = ['Đêm đầy sao', 'Hướng dương', 'Tiếng thét', 'Sóng lừng', 'Cây bách', 'Đêm tím'];

/** Nhãn bảo tàng: đồng vàng, viền bậc thang (sáng trên-trái, tối dưới-phải); dòng 1 = lời cổ vũ, dòng 2 = số + tên tranh. */
export function drawPlaque(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, cheer: string, style: number) {
  const crom = pr('crom');
  const ink = css(single('ink'));
  const b = Math.max(3, Math.round(h * 0.08));
  g.fillStyle = ink; g.fillRect(x, y, w, h);
  g.fillStyle = css(crom[700]); g.fillRect(x + b, y + b, w - 2 * b, h - 2 * b);
  g.fillStyle = css(crom[100]); g.fillRect(x + b, y + b, w - 3 * b, h - 3 * b);
  g.fillStyle = css(crom[500]); g.fillRect(x + 2 * b, y + 2 * b, w - 4 * b, h - 4 * b);
  g.save();
  g.fillStyle = ink;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${Math.round(h * 0.34)}px ${CHEER_FONT}`;
  g.fillText(cheer.toUpperCase(), x + w / 2, y + h * 0.4, w * 0.84);
  g.font = `600 ${Math.round(h * 0.2)}px ${CHEER_FONT}`;
  g.fillText(`Nº ${n} · ${PAINTING_TITLES[style % 6]} · sơn dầu trên toan`, x + w / 2, y + h * 0.72, w * 0.84);
  g.restore();
}
