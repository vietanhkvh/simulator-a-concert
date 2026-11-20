// Emotes: biểu tượng cảm xúc nổi lên từ khán giả. 1 THREE.Points, pool 250, atlas vẽ bằng canvas 2D,
// chuyển động trong vertex shader; chỉ ghi dải attribute nhỏ khi spawn (ring buffer).
import * as THREE from 'three';
import type { FrameState } from '../core/types';

export type EmoteKind = 'heart' | 'star' | 'note' | 'fire' | 'clap';
export interface Emotes {
  update(f: FrameState): void;
  burst(count?: number, kind?: EmoteKind): void;
  dispose(): void;
}

const KINDS: EmoteKind[] = ['heart', 'star', 'note', 'fire', 'clap'];
const COUNT = 250;
const LIFE = 2.6;
const TILE = 128;

function drawAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TILE * 5;
  c.height = TILE;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const outline = (fill: string) => {
    g.lineWidth = 9;
    g.strokeStyle = 'rgba(20,0,30,0.9)';
    g.stroke();
    g.fillStyle = fill;
    g.fill();
  };
  const tile = (i: number, fn: () => void) => {
    g.save();
    g.translate(i * TILE + TILE / 2, TILE / 2);
    fn();
    g.restore();
  };
  // heart
  tile(0, () => {
    g.beginPath();
    g.moveTo(0, 46);
    g.bezierCurveTo(-70, -2, -50, -52, -22, -42);
    g.bezierCurveTo(-8, -38, 0, -26, 0, -20);
    g.bezierCurveTo(0, -26, 8, -38, 22, -42);
    g.bezierCurveTo(50, -52, 70, -2, 0, 46);
    g.closePath();
    outline('#ff2f6d');
    g.beginPath();
    g.ellipse(-28, -22, 9, 6, -0.6, 0, 7);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fill();
  });
  // star
  tile(1, () => {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 24 : 56;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 4);
    }
    g.closePath();
    outline('#ffe03a');
  });
  // note
  tile(2, () => {
    g.beginPath();
    g.ellipse(-20, 34, 24, 18, -0.4, 0, 7);
    outline('#2fe6ff');
    g.beginPath();
    g.rect(2, -48, 13, 84);
    outline('#2fe6ff');
    g.beginPath();
    g.moveTo(2, -48);
    g.quadraticCurveTo(46, -34, 40, 2);
    g.lineTo(30, 0);
    g.quadraticCurveTo(32, -22, 2, -26);
    g.closePath();
    outline('#2fe6ff');
  });
  // flame
  tile(3, () => {
    g.beginPath();
    g.moveTo(0, -58);
    g.bezierCurveTo(10, -30, 44, -14, 40, 22);
    g.bezierCurveTo(38, 48, 18, 58, 0, 58);
    g.bezierCurveTo(-20, 58, -42, 46, -40, 20);
    g.bezierCurveTo(-39, 4, -26, -6, -22, -22);
    g.bezierCurveTo(-12, -10, -8, -4, -6, 4);
    g.bezierCurveTo(-4, -20, -6, -40, 0, -58);
    g.closePath();
    outline('#ff7a14');
    g.beginPath();
    g.moveTo(0, 8);
    g.bezierCurveTo(14, 22, 22, 34, 12, 46);
    g.quadraticCurveTo(0, 52, -12, 46);
    g.bezierCurveTo(-20, 32, -8, 22, 0, 8);
    g.fillStyle = '#ffe34d';
    g.fill();
  });
  // clap / raised hand: palm + 4 fingers + thumb
  tile(4, () => {
    g.beginPath();
    g.roundRect(-34, -6, 62, 58, 18);
    outline('#ffffff');
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.roundRect(-34 + k * 16, -56 + (k === 1 || k === 2 ? -6 : 4), 13, 56, 6);
      outline('#ffffff');
    }
    g.beginPath();
    g.ellipse(-38, 26, 11, 22, 0.9, 0, 7);
    outline('#ffffff');
    g.beginPath();
    g.roundRect(-34, -6, 62, 58, 18);
    g.fillStyle = '#ffffff';
    g.fill();
  });
  return c;
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
attribute vec4 aPos;   // xyz = vị trí spawn, w = thời điểm spawn
attribute vec2 aInfo;  // x = kind, y = seed
varying float vAlpha;
varying float vKind;
void main() {
  float age = uTime - aPos.w;
  float t = age / ${LIFE.toFixed(2)};
  float seed = aInfo.y;
  vKind = aInfo.x;
  vec3 p = aPos.xyz;
  if (t < 0.0 || t > 1.0) {
    vAlpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  float e = 1.0 - pow(1.0 - t, 1.6);
  p.y += e * (3.0 + seed * 2.0);
  p.x += sin(age * (2.0 + seed * 1.5) + seed * 40.0) * 0.35;
  float pop = t < 0.12 ? (t / 0.12) * 1.3 : (t < 0.22 ? 1.3 - (t - 0.12) / 0.1 * 0.3 : 1.0);
  vAlpha = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.7, 1.0, t));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = uPx * (0.75 + seed * 0.3) / max(-mv.z, 0.1);
  gl_PointSize = clamp(max(26.0, size), 0.0, 120.0) * pop;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
varying float vKind;
void main() {
  vec2 uv = vec2((gl_PointCoord.x + vKind) / 5.0, 1.0 - gl_PointCoord.y);
  vec4 c = texture2D(uMap, uv);
  float a = c.a * vAlpha;
  if (a < 0.02) discard;
  gl_FragColor = vec4(c.rgb * 1.1, a);
}`;

export function createEmotes(scene: THREE.Scene): Emotes {
  const posA = new Float32Array(COUNT * 4);
  const info = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) posA[i * 4 + 3] = -1000;
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(posA, 4);
  const aInfo = new THREE.BufferAttribute(info, 2);
  aPos.setUsage(THREE.DynamicDrawUsage);
  aInfo.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3)); // giả
  geo.setAttribute('aPos', aPos);
  geo.setAttribute('aInfo', aInfo);

  const tex = new THREE.CanvasTexture(drawAtlas());
  tex.colorSpace = THREE.SRGBColorSpace;
  const uniforms = { uTime: { value: 0 }, uPx: { value: 600 }, uMap: { value: tex } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);

  let time = 0;
  let head = 0;
  let acc = 0;
  let prevPulse = 0;
  let pendingFrom = -1;
  let pendingTo = -1;

  const spawnOne = (kind: EmoteKind) => {
    const i = head;
    head = (head + 1) % COUNT;
    const r = 8 + Math.pow(Math.random(), 0.8) * 24;
    const ang = (Math.random() - 0.5) * 1.9; // ~ ±54°
    const x = Math.sin(ang) * r;
    const z = -Math.cos(ang) * r;
    const floor = -1.5 + 0.05 * (r - 6.5);
    posA.set([x, floor + 2.0 + Math.random() * 0.6, z, time], i * 4);
    info[i * 2] = KINDS.indexOf(kind);
    info[i * 2 + 1] = Math.random();
    if (pendingFrom < 0) pendingFrom = i;
    pendingTo = i;
  };

  const pick = (hype: number): EmoteKind => {
    const r = Math.random();
    if (hype < 0.65) return r < 0.5 ? 'note' : r < 0.85 ? 'clap' : 'heart';
    if (hype < 0.85) return r < 0.25 ? 'note' : r < 0.4 ? 'clap' : r < 0.65 ? 'heart' : r < 0.85 ? 'star' : 'fire';
    return r < 0.1 ? 'note' : r < 0.15 ? 'clap' : r < 0.45 ? 'heart' : r < 0.75 ? 'star' : 'fire';
  };

  // Ghi dải attribute vừa spawn (tách làm 2 đoạn khi quay vòng ring buffer).
  const flush = () => {
    if (pendingFrom < 0) return;
    const ranges: [number, number][] =
      pendingTo >= pendingFrom ? [[pendingFrom, pendingTo]] : [[pendingFrom, COUNT - 1], [0, pendingTo]];
    // Nếu burst lớn hơn pool thì ghi toàn bộ — vẫn chỉ khi spawn, không phải mỗi khung.
    aPos.clearUpdateRanges();
    aInfo.clearUpdateRanges();
    for (const [a, b] of ranges) {
      aPos.addUpdateRange(a * 4, (b - a + 1) * 4);
      aInfo.addUpdateRange(a * 2, (b - a + 1) * 2);
    }
    aPos.needsUpdate = true;
    aInfo.needsUpdate = true;
    pendingFrom = pendingTo = -1;
  };

  return {
    update(f) {
      const dt = Math.min(f.dt, 0.1);
      time += dt;
      uniforms.uTime.value = time;
      uniforms.uPx.value = window.innerHeight * 1.1;
      const h = f.hype;
      if (h >= 0.35) {
        const rate = h < 0.5 ? ((h - 0.35) / 0.15) * 1.5 : h < 0.9 ? 1.5 + ((h - 0.5) / 0.4) * 23.5 : 25;
        acc += rate * dt;
        while (acc >= 1) {
          acc -= 1;
          spawnOne(pick(h));
        }
        if (f.beatPulse > 0.8 && prevPulse <= 0.8) {
          const n = h > 0.7 ? 3 : 1;
          for (let k = 0; k < n; k++) spawnOne(pick(h));
        }
      } else acc = 0;
      prevPulse = f.beatPulse;
      flush();
    },
    burst(count = 40, kind) {
      const n = Math.min(count, COUNT);
      for (let k = 0; k < n; k++) spawnOne(kind ?? pick(0.95));
      flush();
    },
    dispose() {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}
