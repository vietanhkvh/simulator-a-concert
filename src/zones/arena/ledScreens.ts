// Hai màn LED lớn phía sau khán giả (Kẹo đêm). Một CanvasTexture dùng chung (≤15 fps) hoặc VideoTexture.
// Khung bo tròn viền nho, chân là cột kẹo sọc; nội dung canvas theo palette (gradient, tim/sao, cột bo tròn, chữ Baloo 2 có viền mực).
import { LED_SCREENS } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState, Song } from '../../core/types';
import { INK_HEX, PAL, PAL_HEX, hexStr, hypeColors, mixHex, rgbToHex } from '../../world/style';
import { Toy, createToyMaterial, ringGeo, slabGeo, updateToyHype } from './stageStyle';

export interface LedScreens {
  update(f: FrameState, song: Song | null): void;
  setVideo(video: HTMLVideoElement | null): void;
  dispose(): void;
}

const W = 1024;
const H = 576;
const SCREEN_W = LED_SCREENS.width;
const SCREEN_H = (SCREEN_W * 9) / 16;
const POS_X = LED_SCREENS.x;
const POS_Y = LED_SCREENS.y;
const POS_Z = LED_SCREENS.z;
const FPS = 15;

function currentLine(song: Song | null, t: number): string {
  if (!song) return '';
  let found = '';
  for (const line of song.lines) {
    if (line.notes.length === 0) continue;
    if (t >= line.startSec - 1.2) {
      found = line.notes.map((n) => n.text).join('').replace(/\s+/g, ' ').trim();
      if (t > line.endSec + 2.5) found = '';
    } else break;
  }
  return found;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const test = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(test).width > maxW) {
      out.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}

const FONT = "'Baloo 2', system-ui, sans-serif";
const R_PX = 43; // bán kính góc màn (≈ 1,0 m)

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function heartPath(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.3, y + s * 0.1, x - s * 0.8, y - s * 0.9, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.8, y - s * 0.9, x + s * 1.3, y + s * 0.1, x, y + s * 0.9);
  c.closePath();
}
function starPath(c: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + rot + (i * Math.PI) / 5, r = i & 1 ? s * 0.5 : s;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath();
  c.lineJoin = 'round';
}
const rgbHex = (rgb: readonly number[]) => hexStr(rgbToHex([rgb[0]!, rgb[1]!, rgb[2]!]));
const hash = (n: number) => { const v = Math.sin(n * 91.3) * 437.58; return v - Math.floor(v); };

export function createLedScreens(scene: THREE.Scene): LedScreens {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const canvasTex = new THREE.CanvasTexture(canvas);
  canvasTex.colorSpace = THREE.SRGBColorSpace;
  let videoTex: THREE.VideoTexture | null = null;

  const group = new THREE.Group();
  scene.add(group);
  const geos: THREE.BufferGeometry[] = [];
  const mats: { dispose(): void }[] = [];
  const toyM = createToyMaterial();
  // alphaTest: góc bo của màn canvas trong suốt → lộ thân khung phía sau
  // alphaMap bo góc (cùng bán kính R_PX với canvas) → cả chế độ VIDEO cũng có góc bo, không phụ thuộc alpha của map.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = W / 4; maskCanvas.height = H / 4;
  const mctx = maskCanvas.getContext('2d')!;
  mctx.fillStyle = '#000'; mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  mctx.fillStyle = '#fff'; rr(mctx, 0, 0, maskCanvas.width, maskCanvas.height, R_PX / 4); mctx.fill();
  const maskTex = new THREE.CanvasTexture(maskCanvas);
  const screenMat = new THREE.MeshBasicMaterial({ map: canvasTex, alphaMap: maskTex, fog: false, toneMapped: false, alphaTest: 0.5 });
  mats.push(toyM, screenMat, maskTex);
  const planeGeo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H);

  // Khung: thân night-300 bo + vành nho phát sáng quanh màn + 2 cột kẹo sọc berry/kem + sao trên đỉnh
  const toy = new Toy();
  toy.add(slabGeo(SCREEN_W + 1.4, SCREEN_H + 1.4, 0.4, 1.7, 0.1), PAL.night[300], false, new THREE.Matrix4().makeTranslation(0, 0, -0.27));
  toy.add(ringGeo(SCREEN_W + 0.5, SCREEN_H + 0.5, 0.25, 1.25, 0.3), PAL.grape[500], true, new THREE.Matrix4().makeTranslation(0, 0, -0.02));
  const legTop = -SCREEN_H / 2 + 1, legBot = legTop - (POS_Y + 2);
  for (const lx of [-SCREEN_W * 0.3, SCREEN_W * 0.3]) {
    toy.candyTube(new THREE.Vector3(lx, legBot, -0.5), new THREE.Vector3(lx, legTop, -0.5), 0.8, PAL.berry[500], PAL.cream[500], 1.3);
    toy.sphere(0.55, lx, legTop - 0.2, -0.5, PAL.cream[500]);
  }
  toy.star(1.2, 0.4, 0, SCREEN_H / 2 + 1.5, -0.2, PAL.honey[500], { trim: true });
  const furnGeo = toy.build();
  geos.push(planeGeo, furnGeo);

  const displays: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * POS_X, POS_Y, POS_Z);
    // Xoay mặt về phía ca sĩ (gốc tọa độ)
    g.lookAt(0, POS_Y, 0);
    const frame = new THREE.Mesh(furnGeo, toyM.mat);
    const disp = new THREE.Mesh(planeGeo, screenMat);
    displays.push(disp);
    g.add(frame, disp);
    group.add(g);
  }

  let videoMode = false;
  let last = -1;
  let clock = 0;

  const fitDisplays = (aspect: number) => {
    const target = 16 / 9;
    const sx = aspect > target ? 1 : aspect / target;
    const sy = aspect > target ? target / aspect : 1;
    for (const d of displays) d.scale.set(sx, sy, 1);
  };

  function draw(f: FrameState, song: Song | null) {
    const h = f.hype;
    const bp = f.beatPulse;
    const t = clock;
    const hc = hypeColors(h);
    const cA = rgbHex(hc.primary), cB = rgbHex(hc.secondary), cC = rgbHex(hc.accent);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    rr(ctx, 0, 0, W, H, R_PX);
    ctx.clip();
    // nền kẹo: night → primary/secondary theo Hype
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, hexStr(mixHex(PAL.night[500], rgbToHex([hc.primary[0]!, hc.primary[1]!, hc.primary[2]!]), 0.18 + 0.3 * h + 0.1 * bp)));
    g.addColorStop(1, hexStr(mixHex(PAL.night[300], rgbToHex([hc.secondary[0]!, hc.secondary[1]!, hc.secondary[2]!]), 0.15 + 0.3 * h)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // vòng xung mềm
    ctx.lineWidth = 14;
    for (let i = 0; i < 3; i++) {
      const r = 90 + i * 100 + bp * 30 + f.level * 50;
      ctx.globalAlpha = 0.22 - i * 0.05;
      ctx.strokeStyle = i & 1 ? cB : cA;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke();
    }
    // bokeh + tim/sao lơ lửng
    for (let i = 0; i < 14; i++) {
      const y = H + 40 - (((hash(i + 3) * 1000 + t * (14 + 22 * hash(i + 1)) * (0.5 + h))) % (H + 80));
      const x = hash(i + 9) * W + Math.sin(t * 0.8 + i) * 16;
      const s = 14 + hash(i + 5) * 22 + bp * 4;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = i % 3 === 0 ? cA : i % 3 === 1 ? cB : cC;
      if (i < 8) { if (i & 1) heartPath(ctx, x, y, s); else starPath(ctx, x, y, s, t * 0.4 + i); ctx.fill(); }
      else { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, s * 1.3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // cột equaliser bo tròn
    const n = 24;
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = (0.25 + 0.75 * Math.abs(Math.sin(t * 3 + i * 0.7) * Math.cos(t * 1.7 + i * 0.31))) * (0.2 + f.level * 0.9 + bp * 0.2);
      const bh = Math.max(bw * 0.7, Math.min(1, v) * H * 0.4);
      const gr = ctx.createLinearGradient(0, H - bh, 0, H);
      gr.addColorStop(0, i % 2 ? cC : cA);
      gr.addColorStop(1, cB);
      ctx.fillStyle = gr;
      ctx.globalAlpha = 0.85;
      rr(ctx, i * bw + 6, H - bh - 10, bw - 12, bh, (bw - 12) / 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = PAL_HEX.cream[100];
      ctx.beginPath(); ctx.arc(i * bw + bw * 0.38, H - bh + 4, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (song) {
      ctx.font = `700 32px ${FONT}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = INK_HEX;
      ctx.fillStyle = PAL_HEX.cream[500];
      const title = `${song.title} - ${song.artist}`;
      ctx.strokeText(title, W / 2, 46, W - 100);
      ctx.fillText(title, W / 2, 46, W - 100);
      const text = currentLine(song, f.songTime);
      if (text) {
        let size = 92;
        let lines: string[] = [];
        for (; size >= 42; size -= 6) {
          ctx.font = `800 ${size}px ${FONT}`;
          lines = wrap(ctx, text, W - 140);
          if (lines.length <= 3) break;
        }
        ctx.lineWidth = Math.max(10, size * 0.14);
        ctx.strokeStyle = INK_HEX;
        ctx.fillStyle = PAL_HEX.cream[500];
        const lh = size * 1.12;
        const y0 = H / 2 - ((lines.length - 1) * lh) / 2;
        lines.forEach((l, i) => {
          ctx.strokeText(l, W / 2, y0 + i * lh);
          ctx.fillText(l, W / 2, y0 + i * lh);
        });
      }
    }
    if (h > 0.8) {
      // băng rôn dạng sticker: viên thuốc kem + viền mực + sao
      const s = 1 + 0.1 * bp;
      ctx.save();
      ctx.translate(W / 2, H - 78);
      ctx.rotate(-0.05);
      ctx.scale(s, s);
      rr(ctx, -210, -42, 420, 84, 42);
      ctx.fillStyle = PAL_HEX.cream[500]; ctx.fill();
      ctx.lineWidth = 7; ctx.strokeStyle = INK_HEX; ctx.stroke();
      ctx.font = `800 54px ${FONT}`;
      ctx.lineWidth = 0;
      ctx.fillStyle = bp > 0.3 ? PAL_HEX.berry[500] : PAL_HEX.berry[700];
      ctx.fillText('HYPE MAX', 22, 4);
      starPath(ctx, -158, 0, 28, -0.2);
      ctx.fillStyle = PAL_HEX.honey[500]; ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = INK_HEX; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    canvasTex.needsUpdate = true;
  }

  return {
    update(f, song) {
      clock += Math.min(f.dt, 0.1);
      updateToyHype(f.hype);
      if (videoMode) return;
      if (clock - last < 1 / FPS) return;
      last = clock;
      draw(f, song);
    },
    setVideo(video) {
      if (videoTex) {
        videoTex.dispose();
        videoTex = null;
      }
      if (!video) {
        videoMode = false;
        screenMat.map = canvasTex;
        screenMat.needsUpdate = true;
        fitDisplays(16 / 9);
        last = -1;
        return;
      }
      videoMode = true;
      videoTex = new THREE.VideoTexture(video);
      videoTex.colorSpace = THREE.SRGBColorSpace;
      screenMat.map = videoTex;
      screenMat.needsUpdate = true;
      const apply = () => fitDisplays(video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9);
      apply();
      video.addEventListener('loadedmetadata', apply, { once: true });
    },
    dispose() {
      scene.remove(group);
      videoTex?.dispose();
      canvasTex.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
