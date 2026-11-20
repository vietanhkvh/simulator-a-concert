// "Mực & Sơn mài" — hai màn LED lớn sau khán giả (khe `ledScreens`). Khung sơn then viền kép vàng + sen vàng ở 4 góc,
// chân cột gỗ sẫm đầu vàng. Canvas: nền chàm → sơn then, vòng trống đồng vàng mờ, lời hát serif đậm vỏ trứng viền vàng
// mảnh, tên bài nhỏ vàng, cột mức = nét vàng mảnh; Hype cao: triện son "VÀNG SON". Chế độ video giữ nguyên (góc vuông).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState, Song } from '../../../../core/types';
import { LED_SCREENS } from '../../../../world/layout';
import { PAL, PAL_HEX } from '../../../../world/style';
import type { ArenaBuilders, LedScreens } from '../../builders';
import { lotusGeo } from './rig';

const W = 1024, H = 576, FPS = 15;
const SW = LED_SCREENS.width, SH = (SW * 9) / 16;
const SERIF = "'Noto Serif', 'Times New Roman', Georgia, serif";

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
const boxAt = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
/** Viền chữ nhật (w × h) dày t, sâu d ở z. */
const rect = (w: number, h: number, t: number, d: number, z: number) => [
  boxAt(w + t, t, d, 0, h / 2, z), boxAt(w + t, t, d, 0, -h / 2, z), boxAt(t, h, d, w / 2, 0, z), boxAt(t, h, d, -w / 2, 0, z),
];

export function createLacquerLedScreens(scene: THREE.Scene): LedScreens {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const canvasTex = new THREE.CanvasTexture(canvas);
  canvasTex.colorSpace = THREE.SRGBColorSpace;
  let videoTex: THREE.VideoTexture | null = null;

  // Khung: 3 vật liệu phẳng (sơn then / vàng / gỗ) — 3 draw call mỗi màn + màn hình
  const legTop = -SH / 2 + 0.6, legBot = -SH / 2 - LED_SCREENS.y - 2;
  const lacGeo = mergeGeometries([
    boxAt(SW + 2.2, SH + 2.2, 0.5, 0, 0, -0.3),
    boxAt(SW * 0.5, 0.9, 0.6, 0, SH / 2 + 1.4, -0.3), // mũ khung
  ])!;
  const goldParts: THREE.BufferGeometry[] = [...rect(SW + 0.35, SH + 0.35, 0.16, 0.12, 0.0), ...rect(SW + 1.5, SH + 1.5, 0.22, 0.12, 0.0),
    boxAt(SW * 0.5 + 0.3, 0.14, 0.7, 0, SH / 2 + 1.88, -0.3), boxAt(SW * 0.5 + 0.3, 0.1, 0.7, 0, SH / 2 + 0.92, -0.3)];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const l = lotusGeo(new THREE.Vector3(0, 0, 0), 0.55, -1);
    l.rotateZ(sy > 0 ? (sx > 0 ? -Math.PI / 4 : Math.PI / 4) : (sx > 0 ? -3 * Math.PI / 4 : 3 * Math.PI / 4));
    l.translate(sx * (SW / 2 + 0.75), sy * (SH / 2 + 0.75), 0.1);
    l.deleteAttribute('uv');
    goldParts.push(l);
  }
  const woodParts: THREE.BufferGeometry[] = [];
  for (const lx of [-SW * 0.3, SW * 0.3]) {
    woodParts.push(boxAt(0.9, legTop - legBot, 0.9, lx, (legTop + legBot) / 2, -0.7));
    goldParts.push(boxAt(1.15, 0.25, 1.15, lx, legTop - 0.5, -0.7), boxAt(1.3, 0.3, 1.3, lx, legBot + 0.15, -0.7));
  }
  for (const g of goldParts) { if (g.attributes.uv) g.deleteAttribute('uv'); }
  for (const g of [...woodParts]) g.deleteAttribute('uv');
  const goldGeo = mergeGeometries(goldParts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  const woodGeo = mergeGeometries(woodParts)!;
  for (const g of goldParts) g.dispose();
  for (const g of woodParts) g.dispose();
  const lacMat = new THREE.MeshBasicMaterial({ color: PAL.night[300] });
  const goldMat = new THREE.MeshBasicMaterial({ color: PAL.honey[500], side: THREE.DoubleSide });
  const woodMat = new THREE.MeshBasicMaterial({ color: PAL.night[100] });
  const screenMat = new THREE.MeshBasicMaterial({ map: canvasTex, fog: false, toneMapped: false });
  const planeGeo = new THREE.PlaneGeometry(SW, SH);

  const group = new THREE.Group();
  group.name = 'ledScreens-lacquer';
  scene.add(group);
  const displays: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * LED_SCREENS.x, LED_SCREENS.y, LED_SCREENS.z);
    g.lookAt(0, LED_SCREENS.y, 0);
    const disp = new THREE.Mesh(planeGeo, screenMat);
    displays.push(disp);
    g.add(new THREE.Mesh(lacGeo, lacMat), new THREE.Mesh(goldGeo, goldMat), new THREE.Mesh(woodGeo, woodMat), disp);
    group.add(g);
  }

  const fitDisplays = (aspect: number) => {
    const target = 16 / 9;
    const sx = aspect > target ? 1 : aspect / target, sy = aspect > target ? target / aspect : 1;
    for (const d of displays) d.scale.set(sx, sy, 1);
  };

  let videoMode = false, last = -1, clock = 0;
  const C = PAL_HEX;

  function draw(f: FrameState, song: Song | null) {
    const h = f.hype, bp = f.beatPulse, t = clock;
    // nền chàm → sơn then
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.grape[700]);
    g.addColorStop(1, C.night[500]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // vòng trống đồng vàng mờ + tia
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.strokeStyle = C.honey[500];
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = 0.09 + 0.05 * bp * (i === 0 ? 1 : 0);
      ctx.lineWidth = i % 2 ? 2 : 5;
      ctx.beginPath(); ctx.arc(0, 0, 60 + i * 62 + f.level * 12, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = C.honey[500];
    for (let i = 0; i < 14; i++) {
      ctx.save(); ctx.rotate(t * 0.05 + (i * Math.PI * 2) / 14);
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(0, -54); ctx.lineTo(7, 0); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // cột mức: nét vàng mảnh
    const n = 32, bw = W / n;
    ctx.strokeStyle = C.honey[300];
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < n; i++) {
      const v = (0.25 + 0.75 * Math.abs(Math.sin(t * 3 + i * 0.7) * Math.cos(t * 1.7 + i * 0.31))) * (0.2 + f.level * 0.9 + bp * 0.2);
      const bh = 8 + Math.min(1, v) * H * 0.22;
      const x = i * bw + bw / 2;
      ctx.beginPath(); ctx.moveTo(x, H - 26); ctx.lineTo(x, H - 26 - bh); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // viền kép vàng trong canvas (góc vuông)
    ctx.strokeStyle = C.honey[500];
    ctx.lineWidth = 4; ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.lineWidth = 1.5; ctx.strokeRect(26, 26, W - 52, H - 52);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (song) {
      ctx.font = `600 28px ${SERIF}`;
      ctx.fillStyle = C.honey[300];
      ctx.fillText(`${song.title} · ${song.artist}`, W / 2, 58, W - 140);
      const text = currentLine(song, f.songTime);
      if (text) {
        let size = 88;
        let lines: string[] = [];
        for (; size >= 40; size -= 6) {
          ctx.font = `700 ${size}px ${SERIF}`;
          lines = wrap(ctx, text, W - 160);
          if (lines.length <= 3) break;
        }
        const lh = size * 1.15;
        const y0 = H / 2 - ((lines.length - 1) * lh) / 2;
        ctx.lineWidth = Math.max(2, size * 0.04);
        ctx.strokeStyle = C.honey[500];
        ctx.fillStyle = C.cream[300];
        lines.forEach((l, i) => { ctx.fillText(l, W / 2, y0 + i * lh); ctx.strokeText(l, W / 2, y0 + i * lh); });
      }
    }
    if (h > 0.8) {
      // triện son vuông, chữ khắc vỏ trứng
      const s = 1 + 0.06 * bp;
      ctx.save();
      ctx.translate(W - 150, H - 140);
      ctx.rotate(-0.06);
      ctx.scale(s, s);
      ctx.fillStyle = C.berry[500];
      ctx.fillRect(-82, -82, 164, 164);
      ctx.strokeStyle = C.cream[300];
      ctx.lineWidth = 4; ctx.strokeRect(-70, -70, 140, 140);
      ctx.fillStyle = C.cream[300];
      ctx.font = `800 50px ${SERIF}`;
      ctx.fillText('VÀNG', 0, -24);
      ctx.fillText('SON', 0, 32);
      ctx.restore();
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
      for (const x of [lacGeo, goldGeo, woodGeo, planeGeo, lacMat, goldMat, woodMat, screenMat]) x.dispose();
    },
  };
}

export const builders: Partial<ArenaBuilders> = { ledScreens: (ctx) => createLacquerLedScreens(ctx.scene) };
