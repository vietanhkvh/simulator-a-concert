// Trăng chibi (STYLE_GUIDE khu 1): trăng khuyết mập, mặt ngủ, má hồng, viền INK_SKY.
// 1 CanvasTexture atlas 3 ô ngang: [ngủ | thức | chữ "z"]; vòm trời (sky.ts) lấy mẫu trong shader → +0 draw call.
import * as THREE from 'three';

import { hexStr, INK, INK_SKY, PAL, shade } from '../../world/style';

export const MOON_CELL = 256;
export const MOON_CELLS = 3;

const col = (hex: number) => hexStr(shade(hex, 'outside'));

/** Lớp trăng khuyết: đĩa lớn (cx, cy, r + grow) trừ đĩa lệch phải-trên (bán kính 0,86r − grow). */
function crescentLayer(fill: string, cx: number, cy: number, r: number, grow: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = MOON_CELL;
  const g = c.getContext('2d')!;
  g.fillStyle = fill;
  g.beginPath();
  g.arc(cx, cy, r + grow, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(cx + r * 0.62, cy - r * 0.3, r * 0.86 - grow, 0, Math.PI * 2);
  g.fill();
  return c;
}

function drawMoon(g: CanvasRenderingContext2D, x0: number, awake: boolean) {
  const S = MOON_CELL, cx = x0 + S * 0.5, cy = S * 0.5, r = S * 0.4;
  g.save();
  g.beginPath();
  g.rect(x0, 0, S, S);
  g.clip();
  // quầng mờ quanh hình khuyết
  g.save();
  g.filter = `blur(${S * 0.05}px)`;
  g.globalAlpha = 0.45;
  g.drawImage(crescentLayer(col(PAL.grape[300]), S * 0.5, cy, r, S * 0.03), x0, 0);
  g.restore();
  // viền INK_SKY (lớp to hơn phía sau) + thân kem
  g.drawImage(crescentLayer(hexStr(INK_SKY), S * 0.5, cy, r, S * 0.016), x0, 0);
  const body = crescentLayer(col(PAL.cream[500]), S * 0.5, cy, r, -S * 0.012);
  const bg = body.getContext('2d')!;
  bg.globalCompositeOperation = 'source-atop';
  // bậc bóng grape-300 ở mép trong
  const sh = bg.createRadialGradient(S * 0.5 + r * 0.62, cy - r * 0.3, r * 0.8, S * 0.5 + r * 0.62, cy - r * 0.3, r * 1.3);
  sh.addColorStop(0, col(PAL.grape[300]) + 'c0');
  sh.addColorStop(1, col(PAL.grape[300]) + '00');
  bg.fillStyle = sh;
  bg.fillRect(0, 0, S, S);
  // đốm highlight kem góc trên trái
  bg.fillStyle = hexStr(PAL.cream[100]) + 'dd';
  bg.beginPath();
  bg.ellipse(S * 0.5 - r * 0.6, cy - r * 0.42, r * 0.12, r * 0.065, -0.8, 0, Math.PI * 2);
  bg.fill();
  g.drawImage(body, x0, 0);
  // mặt
  const ex = cx - r * 0.5, ey = cy + r * 0.05;
  g.strokeStyle = hexStr(INK);
  g.fillStyle = hexStr(INK);
  g.lineCap = 'round';
  g.lineWidth = S * 0.026;
  if (!awake) {
    // mắt nhắm cong (vui, ngủ)
    g.beginPath();
    g.arc(ex, ey - r * 0.06, r * 0.13, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    // miệng nhỏ
    g.lineWidth = S * 0.02;
    g.beginPath();
    g.arc(ex + r * 0.08, ey + r * 0.3, r * 0.06, Math.PI * 0.1, Math.PI * 0.9);
    g.stroke();
  } else {
    // mắt mở to + đốm sáng
    g.beginPath();
    g.ellipse(ex, ey - r * 0.04, r * 0.085, r * 0.13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hexStr(PAL.cream[100]);
    g.beginPath();
    g.arc(ex - r * 0.03, ey - r * 0.1, r * 0.035, 0, Math.PI * 2);
    g.fill();
    // cười tươi
    g.fillStyle = col(PAL.berry[700]);
    g.beginPath();
    g.arc(ex + r * 0.1, ey + r * 0.24, r * 0.13, 0.05 * Math.PI, 0.95 * Math.PI);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // má hồng
  g.fillStyle = col(PAL.berry[300]) + 'd0';
  g.beginPath();
  g.ellipse(ex - r * 0.18, ey + r * 0.22, r * 0.11, r * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawZ(g: CanvasRenderingContext2D, x0: number) {
  const S = MOON_CELL;
  g.save();
  g.font = `900 ${S * 0.72}px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = S * 0.09;
  g.strokeStyle = hexStr(INK_SKY);
  g.strokeText('z', x0 + S / 2, S / 2);
  g.fillStyle = col(PAL.cream[300]);
  g.fillText('z', x0 + S / 2, S / 2);
  g.restore();
}

/** Atlas trăng: ô 0 ngủ, ô 1 thức, ô 2 chữ "z". Giá trị màu thô sRGB (shader không chuyển không gian màu). */
export function createMoonTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = MOON_CELL * MOON_CELLS;
  c.height = MOON_CELL;
  const g = c.getContext('2d')!;
  drawMoon(g, 0, false);
  drawMoon(g, MOON_CELL, true);
  drawZ(g, MOON_CELL * 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}
