// "Đêm Sao Điểm Ảnh" — khe `ledScreens`: hai màn LED lớn cuối sân thành HAI TOAN CĂNG KHUNG VÀNG trên giá vẽ (khung hạt
// vàng + hoa thị 4 góc, mép vải bố, chân giá gỗ xuống đất, nhãn bảo tàng dưới khung). Nội dung canvas 384 × 216 phóng
// nearest (điểm ảnh to, đúng bảng màu): trời lam Phổ bậc dither + sao chữ thập, cột visualiser khối vuông theo bộ màu Hype,
// tên bài may-300, LỜI HÁT kem crôm bóng cứng mực lệch 2 px, Hype ≥ 80 % thêm nhãn "TIẾNG THÉT". Chế độ video giữ nguyên.
// 3 draw call (khung + viền mực dùng chung, màn hình) — hai màn chung geometry/material.
import * as THREE from 'three';
import type { FrameState, Song } from '../../../../core/types';
import { LED_SCREENS } from '../../../../world/layout';
import type { ArenaBuildContext, ArenaBuilders, LedScreens } from '../../builders';
import { CELL, PKit, R, V, inkOutline, makeAtlas, pixelMaterial } from './stageKit';

const W = 384, H = 216, FPS = 12;
const SW = LED_SCREENS.width, SH = (SW * 9) / 16;
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace';

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
    if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = w; } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}
const hx = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function createPixelLedScreens(ctx: ArenaBuildContext): LedScreens {
  const { scene } = ctx;
  const P = R();
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const c2 = canvas.getContext('2d')!;
  c2.imageSmoothingEnabled = false;
  const canvasTex = new THREE.CanvasTexture(canvas);
  canvasTex.colorSpace = THREE.SRGBColorSpace;
  canvasTex.magFilter = THREE.NearestFilter;
  canvasTex.minFilter = THREE.NearestFilter;
  canvasTex.generateMipmaps = false;
  let videoTex: THREE.VideoTexture | null = null;

  // ── khung tranh (dựng hướng -Z rồi xoay π: nhóm lookAt đặt +Z về phía ca sĩ) ──
  const k = new PKit();
  k.box(SW + 0.4, SH + 0.4, 0.5, 0, 0, 0.3, P.crom[100]); // toan + khung căng
  k.frame(SW, SH, 1.1, 0.6, 0, 0, -0.06, P, { seg: 1.2 });
  // nhãn bảo tàng dưới khung
  k.box(4.2, 1.2, 0.2, 0, -SH / 2 - 2.0, 0.0, P.crom[700]);
  k.decal(4.0, 1.0, 0, -SH / 2 - 2.0, -0.11, CELL.plaque, 0, 3);
  // giá vẽ: 2 chân trước nghiêng + chân sau + thanh đỡ
  const legBot = -SH / 2 - LED_SCREENS.y - 2, yT = SH / 2 + 1.4;
  for (const sx of [-1, 1]) k.beam(V(sx * SW * 0.36, legBot, 1.0), V(sx * SW * 0.12, yT, 1.0), 0.9, 0.7, P.dat[500]);
  k.beam(V(0, yT - 0.6, 1.4), V(0, legBot, 7.5), 0.8, 0.7, P.dat[700]);
  k.box(SW + 2.6, 0.7, 1.4, 0, -SH / 2 - 0.95, -0.2, P.dat[300]);
  k.box(3.0, 1.0, 1.2, 0, SH / 2 + 1.0, 0.5, P.dat[300]); // kẹp trên
  const furnGeo = k.build().rotateY(Math.PI);
  const atlas = makeAtlas();
  const pm = pixelMaterial({ atlas });
  const ink = inkOutline(furnGeo);
  const screenMat = new THREE.MeshBasicMaterial({ map: canvasTex, fog: false, toneMapped: false });
  const planeGeo = new THREE.PlaneGeometry(SW, SH);

  const group = new THREE.Group();
  group.name = 'ledScreens-pixel';
  scene.add(group);
  const displays: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * LED_SCREENS.x, LED_SCREENS.y, LED_SCREENS.z);
    g.lookAt(0, LED_SCREENS.y, 0);
    const disp = new THREE.Mesh(planeGeo, screenMat);
    disp.position.z = 0.02;
    displays.push(disp);
    const ol = new THREE.Mesh(furnGeo, ink.mesh.material);
    ol.onBeforeRender = ink.mesh.onBeforeRender;
    g.add(new THREE.Mesh(furnGeo, pm.mat), ol, disp);
    group.add(g);
  }
  const fitDisplays = (aspect: number) => {
    const target = 16 / 9;
    const sx = aspect > target ? 1 : aspect / target, sy = aspect > target ? target / aspect : 1;
    for (const d of displays) d.scale.set(sx, sy, 1);
  };

  let videoMode = false, last = -1, clock = 0;
  const px = (x: number, y: number, col: number, w = 1, h = 1) => { c2.fillStyle = hx(col); c2.fillRect(x, y, w, h); };
  const stars: [number, number][] = [];
  for (let i = 0; i < 11; i++) stars.push([Math.floor(((i * 97) % 360) + 12), Math.floor(((i * 53) % 90) + 10)]);

  const bgCache: (HTMLCanvasElement | null)[] = [null, null];
  function background(vivid: boolean): HTMLCanvasElement {
    const i = vivid ? 1 : 0;
    if (bgCache[i]) return bgCache[i]!;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d')!;
    const bands = vivid ? [P.son[700], P.son[500], P.pho[700], P.pho[500]] : [P.pho[700], P.pho[500], P.pho[700], P.tim[700]];
    const bh = H / 4;
    for (let b = 0; b < 4; b++) { g.fillStyle = hx(bands[b]!); g.fillRect(0, Math.floor(b * bh), W, Math.ceil(bh)); }
    for (let b = 1; b < 4; b++) {
      const y0 = Math.floor(b * bh) - 4;
      g.fillStyle = hx(bands[b - 1]!);
      for (let y = 0; y < 8; y++) for (let x = 0; x < W; x++) if (BAYER[((y + y0) & 3) * 4 + (x & 3)]! / 16 >= (y + 0.5) / 8) g.fillRect(x, y0 + y, 1, 1);
    }
    bgCache[i] = cv;
    return cv;
  }

  function draw(f: FrameState, song: Song | null) {
    const h = Math.min(1, Math.max(0, f.hype)), bp = f.beatPulse, t = clock;
    const set = h >= 0.8 ? [P.son[500], P.son[300], P.son[100], P.crom[500]] : h >= 0.4 ? [P.pho[300], P.crom[500], P.bach[100], P.crom[300]] : [P.pho[500], P.pho[300], P.crom[300], P.pho[100]];
    // nền: 4 dải ngang lam Phổ (son khi thét), mép dải dither Bayer 4×4 — vẽ sẵn một lần mỗi trạng thái
    c2.drawImage(background(h >= 0.8), 0, 0);
    // sao chữ thập thở theo phách (≤ 1 điểm)
    for (const [sx, sy] of stars) {
      const r = bp > 0.5 ? 2 : 1;
      px(sx - r, sy, P.crom[300], 2 * r + 1, 1); px(sx, sy - r, P.crom[300], 1, 2 * r + 1); px(sx, sy, P.crom[100]);
    }
    // visualiser: cột khối 8 px, mỗi khối cách 1 px
    const n = 24, bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = (0.25 + 0.75 * Math.abs(Math.sin(t * 3 + i * 0.7) * Math.cos(t * 1.7 + i * 0.31))) * (0.2 + f.level * 0.9 + bp * 0.2);
      const blocks = Math.max(1, Math.round(Math.min(1, v) * 9));
      for (let j = 0; j < blocks; j++) px(Math.floor(i * bw) + 2, H - 10 - j * 6, set[Math.min(3, j >> 1)]!, Math.floor(bw) - 3, 5);
    }
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    if (song) {
      c2.font = `700 11px ${MONO}`;
      const title = `${song.title} · ${song.artist}`;
      c2.fillStyle = hx(P.ink); c2.fillText(title, W / 2 + 1, 15, W - 40);
      c2.fillStyle = hx(P.may[300]); c2.fillText(title, W / 2, 14, W - 40);
      const text = currentLine(song, f.songTime);
      if (text) {
        let size = 30;
        let lines: string[] = [];
        for (; size >= 14; size -= 2) {
          c2.font = `800 ${size}px ${MONO}`;
          lines = wrap(c2, text, W - 40);
          if (lines.length <= 3) break;
        }
        const lh = Math.round(size * 1.2), y0 = Math.round(H / 2 - 12 - ((lines.length - 1) * lh) / 2);
        lines.forEach((l, i) => {
          c2.fillStyle = hx(P.ink); c2.fillText(l, W / 2 + 2, y0 + i * lh + 2);
          c2.fillStyle = hx(P.crom[100]); c2.fillText(l, W / 2, y0 + i * lh);
        });
      }
    }
    if (h >= 0.8) {
      // nhãn bảo tàng "TIẾNG THÉT": khung vuông, bóng cứng lệch 3 px
      const x = W - 132, y = 22;
      px(x + 3, y + 3, P.ink, 116, 26); px(x, y, P.crom[700], 116, 26); px(x + 2, y + 2, P.crom[500], 112, 22);
      c2.font = `800 14px ${MONO}`;
      c2.fillStyle = hx(P.ink); c2.fillText('★ TIẾNG THÉT', x + 58, y + 14);
    }
    canvasTex.needsUpdate = true;
  }

  return {
    update(f, song) {
      clock += Math.min(f.dt, 0.1);
      if (videoMode || clock - last < 1 / FPS) return;
      last = clock;
      draw(f, song);
    },
    setVideo(video) {
      videoTex?.dispose();
      videoTex = null;
      if (!video) {
        videoMode = false;
        screenMat.map = canvasTex; screenMat.needsUpdate = true;
        fitDisplays(16 / 9); last = -1;
        return;
      }
      videoMode = true;
      videoTex = new THREE.VideoTexture(video);
      videoTex.colorSpace = THREE.SRGBColorSpace;
      screenMat.map = videoTex; screenMat.needsUpdate = true;
      const apply = () => fitDisplays(video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9);
      apply();
      video.addEventListener('loadedmetadata', apply, { once: true });
    },
    dispose() {
      scene.remove(group);
      videoTex?.dispose(); canvasTex.dispose();
      furnGeo.dispose(); planeGeo.dispose(); pm.dispose(); ink.dispose(); atlas?.dispose(); screenMat.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { ledScreens: createPixelLedScreens };
