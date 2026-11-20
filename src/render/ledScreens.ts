// Hai màn LED lớn phía sau khán giả. Một CanvasTexture dùng chung (≤15 fps) hoặc VideoTexture.
import * as THREE from 'three';
import type { FrameState, Song } from '../core/types';

export interface LedScreens {
  update(f: FrameState, song: Song | null): void;
  setVideo(video: HTMLVideoElement | null): void;
  dispose(): void;
}

const W = 1024;
const H = 576;
const SCREEN_W = 24;
const SCREEN_H = (SCREEN_W * 9) / 16;
const POS_X = 30;
const POS_Y = 15;
const POS_Z = -75;
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
  const mats: THREE.Material[] = [];
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x0a0a12, fog: false });
  const backMat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const screenMat = new THREE.MeshBasicMaterial({ map: canvasTex, fog: false, toneMapped: false });
  mats.push(frameMat, backMat, screenMat);
  const planeGeo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H);
  const frameGeo = new THREE.BoxGeometry(SCREEN_W + 1, SCREEN_H + 1, 0.4);
  const legGeo = new THREE.BoxGeometry(0.5, POS_Y + 2, 0.5);
  geos.push(planeGeo, frameGeo, legGeo);

  const displays: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * POS_X, POS_Y, POS_Z);
    // Xoay mặt về phía ca sĩ (gốc tọa độ)
    g.lookAt(0, POS_Y, 0);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.25;
    const back = new THREE.Mesh(planeGeo, backMat);
    back.position.z = -0.02;
    const disp = new THREE.Mesh(planeGeo, screenMat);
    displays.push(disp);
    const leg = new THREE.Mesh(legGeo, frameMat);
    leg.position.set(0, -(POS_Y + 2) / 2 - SCREEN_H / 2 + 0.5 + (POS_Y + 2) / 2 - 0, -0.5);
    leg.position.y = -SCREEN_H / 2 - (POS_Y + 2) / 2 + 1;
    g.add(frame, back, disp, leg);
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
    const g = ctx.createLinearGradient(0, 0, W, H);
    const hue = (t * 12 + h * 120) % 360;
    g.addColorStop(0, `hsl(${hue}, 80%, ${12 + 18 * h + 8 * bp}%)`);
    g.addColorStop(1, `hsl(${(hue + 70) % 360}, 85%, ${10 + 16 * h}%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // rings
    ctx.lineWidth = 6;
    for (let i = 0; i < 3; i++) {
      const r = 80 + i * 90 + bp * 40 + f.level * 60;
      ctx.strokeStyle = `hsla(${(hue + 40 * i) % 360}, 90%, 65%, ${0.35 - i * 0.08})`;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // bars
    const n = 32;
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = (0.25 + 0.75 * Math.abs(Math.sin(t * 3 + i * 0.7) * Math.cos(t * 1.7 + i * 0.31))) * (0.2 + f.level * 0.9 + bp * 0.2);
      const bh = Math.min(1, v) * H * 0.45;
      ctx.fillStyle = `hsla(${(hue + i * 6) % 360}, 90%, 62%, 0.75)`;
      ctx.fillRect(i * bw + 3, H - bh, bw - 6, bh);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (song) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 30px system-ui, sans-serif';
      ctx.fillText(`${song.title} - ${song.artist}`, W / 2, 40, W - 60);
      const text = currentLine(song, f.songTime);
      if (text) {
        let size = 84;
        let lines: string[] = [];
        for (; size >= 40; size -= 6) {
          ctx.font = `800 ${size}px system-ui, sans-serif`;
          lines = wrap(ctx, text, W - 100);
          if (lines.length <= 3) break;
        }
        ctx.lineJoin = 'round';
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.fillStyle = '#fff';
        const lh = size * 1.15;
        const y0 = H / 2 - ((lines.length - 1) * lh) / 2;
        lines.forEach((l, i) => {
          ctx.strokeText(l, W / 2, y0 + i * lh);
          ctx.fillText(l, W / 2, y0 + i * lh);
        });
      }
    }
    if (h > 0.8) {
      const s = 1 + 0.12 * bp;
      ctx.save();
      ctx.translate(W / 2, H - 70);
      ctx.scale(s, s);
      ctx.font = '900 56px system-ui, sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.fillStyle = bp > 0.3 ? '#ffe14a' : '#ff5a3c';
      ctx.strokeText('HYPE MAX', 0, 0);
      ctx.fillText('HYPE MAX', 0, 0);
      ctx.restore();
    }
    canvasTex.needsUpdate = true;
  }

  return {
    update(f, song) {
      clock += Math.min(f.dt, 0.1);
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
