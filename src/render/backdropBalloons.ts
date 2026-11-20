// Khinh khí cầu mang băng rôn khu vực (ZONE A/B/C/D, VIP, FANZONE) lơ lửng trên khán giả.
// Toàn bộ khinh khí cầu + giỏ + dây = 1 mesh; băng rôn = 1 mesh (CanvasTexture atlas). Bập bềnh trong shader.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Uniforms } from './backdropSky';

const BALLOONS = [
  { name: 'ZONE A', p: [-52, 26, -24], a: 0xff3b6b, b: 0xffd23f, band: '#d81b60' },
  { name: 'ZONE B', p: [-36, 32, -48], a: 0x2ec4ff, b: 0xffffff, band: '#1e66d0' },
  { name: 'VIP', p: [-14, 30, -40], a: 0xffc400, b: 0x9b2cff, band: '#b8860b' },
  { name: 'FANZONE', p: [12, 33, -60], a: 0xff5ec4, b: 0x35e0b0, band: '#c2187a' },
  { name: 'ZONE C', p: [32, 28, -42], a: 0x7c4dff, b: 0xff8a3d, band: '#5e35b1' },
  { name: 'ZONE D', p: [52, 24, -22], a: 0x22e06b, b: 0x1b6cff, band: '#1b8a4a' },
];

const BOB = /* glsl */ `
vec3 bob(float id, float t){ return vec3(sin(t*0.13+id*1.7)*1.8, sin(t*0.42+id*2.3)*0.9, cos(t*0.11+id*1.3)*1.4); }`;

const BAL_VERT = /* glsl */ `
uniform float uTime;
attribute vec2 aInfo; // id, kind (0 vỏ, 1 giỏ/dây, 2 miệng lửa)
attribute vec3 aColA; attribute vec3 aColB;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vKind; varying float vId; varying vec3 vN; varying vec3 vV;
${BOB}
void main(){
  vUv = uv; vA = aColA; vB = aColB; vKind = aInfo.y; vId = aInfo.x; vN = normal;
  vec3 p = position + bob(aInfo.x, uTime);
  vV = cameraPosition - p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const BAL_FRAG = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vKind; varying float vId; varying vec3 vN; varying vec3 vV;
void main(){
  if (vKind > 1.5) { float f = 0.8 + 0.2 * sin(uTime * 17.0 + vId * 5.0); gl_FragColor = vec4(vec3(1.0, 0.65, 0.25) * f * (1.0 + uPulse * 0.5), 1.0); return; }
  if (vKind > 0.5) { gl_FragColor = vec4(0.10, 0.07, 0.05, 1.0); return; }
  float g = fract(vUv.x * 10.0);
  vec3 c = mix(vA, vB, step(0.5, g));
  float seam = smoothstep(0.0, 0.04, g) * smoothstep(1.0, 0.96, g) * smoothstep(0.0, 0.04, abs(g - 0.5));
  float v = vUv.y;
  float inner = 0.35 + 0.75 * exp(-pow((v - 0.25) * 2.4, 2.0));
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float flick = 0.92 + 0.08 * sin(uTime * 11.0 + vId * 3.0);
  float lit = (0.22 + inner * (0.5 + 0.4 * uPulse) * (0.75 + 0.45 * uHype) * flick) * (0.55 + 0.6 * ndv);
  lit *= 0.75 + 0.25 * seam;
  gl_FragColor = vec4(c * lit, 1.0);
}`;

const BAN_VERT = /* glsl */ `
uniform float uTime;
attribute float aId;
varying vec2 vUv;
${BOB}
void main(){
  vUv = uv;
  vec3 p = position + bob(aId, uTime);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const BAN_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uPulse; uniform float uHype;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec3 c = texture2D(uMap, uv).rgb;
  gl_FragColor = vec4(c * (0.85 + 0.15 * uPulse * uHype), 1.0);
}`;

export function createBalloons(scene: THREE.Scene, uniforms: Uniforms) {
  const disposables: { dispose(): void }[] = [];
  // Atlas băng rôn
  const RW = 1024, RH = 224, n = BALLOONS.length;
  const canvas = document.createElement('canvas');
  canvas.width = RW; canvas.height = RH * n;
  const ctx = canvas.getContext('2d')!;
  BALLOONS.forEach((b, i) => {
    const y0 = i * RH;
    ctx.fillStyle = b.band; ctx.fillRect(0, y0, RW, RH);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12; ctx.strokeRect(14, y0 + 14, RW - 28, RH - 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 150px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeText(b.name, RW / 2, y0 + RH / 2 + 6);
    ctx.fillText(b.name, RW / 2, y0 + RH / 2 + 6);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  disposables.push(tex);

  const lathePts = [
    [0.9, -5.6], [1.4, -4.9], [2.5, -3.6], [3.8, -1.9], [4.8, 0], [5.15, 1.6], [4.95, 3.0], [4.25, 4.3], [3.05, 5.2], [1.6, 5.75], [0.01, 5.95],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const balParts: THREE.BufferGeometry[] = [];
  const banParts: THREE.BufferGeometry[] = [];
  const ca = new THREE.Color(), cb = new THREE.Color();
  const tag = (g: THREE.BufferGeometry, id: number, kind: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    const k = ng.attributes.position.count;
    const info = new Float32Array(k * 2), A = new Float32Array(k * 3), B = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) { info[i * 2] = id; info[i * 2 + 1] = kind; A.set([ca.r, ca.g, ca.b], i * 3); B.set([cb.r, cb.g, cb.b], i * 3); }
    ng.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
    ng.setAttribute('aColA', new THREE.BufferAttribute(A, 3));
    ng.setAttribute('aColB', new THREE.BufferAttribute(B, 3));
    balParts.push(ng);
  };
  const beam = (a: THREE.Vector3, b: THREE.Vector3, th: number, id: number) => {
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(th, len, th);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    tag(g, id, 1);
  };
  BALLOONS.forEach((B, id) => {
    const [x, y, z] = B.p;
    ca.set(B.a); cb.set(B.b);
    const env = new THREE.LatheGeometry(lathePts, 30);
    env.translate(x, y, z);
    tag(env, id, 0);
    const fire = new THREE.CircleGeometry(0.85, 12); fire.rotateX(Math.PI / 2); fire.translate(x, y - 5.55, z); tag(fire, id, 2);
    const basket = new THREE.BoxGeometry(1.7, 1.2, 1.7); basket.translate(x, y - 7.6, z); tag(basket, id, 1);
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) {
      beam(new THREE.Vector3(x + dx * 1.1, y - 5.5, z + dz * 1.1), new THREE.Vector3(x + dx, y - 7.0, z + dz), 0.08, id);
    }
    // băng rôn quay mặt về sân khấu, treo dưới giỏ bằng thanh ngang + 2 dây
    const ry = Math.atan2(-x, -z);
    const W = 11, H = W * RH / RW;
    const right = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const topY = y - 9.6;
    const L = new THREE.Vector3(x, topY, z).addScaledVector(right, -W / 2);
    const R = new THREE.Vector3(x, topY, z).addScaledVector(right, W / 2);
    beam(new THREE.Vector3(x, y - 8.2, z), L, 0.07, id);
    beam(new THREE.Vector3(x, y - 8.2, z), R, 0.07, id);
    beam(L.clone().addScaledVector(right, -0.2), R.clone().addScaledVector(right, 0.2), 0.16, id);
    const ban = new THREE.PlaneGeometry(W, H);
    const uv = ban.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (n - 1 - id + uv.getY(i)) / n);
    ban.rotateY(ry);
    ban.translate(x, topY - H / 2 - 0.1, z);
    const ids = new Float32Array(ban.attributes.position.count).fill(id);
    ban.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    ban.deleteAttribute('normal');
    banParts.push(ban);
  });
  const balGeo = mergeGeometries(balParts)!;
  const banGeo = mergeGeometries(banParts)!;
  balParts.forEach((g) => g.dispose()); banParts.forEach((g) => g.dispose());
  const balMat = new THREE.ShaderMaterial({ uniforms, vertexShader: BAL_VERT, fragmentShader: BAL_FRAG, fog: false, side: THREE.DoubleSide });
  const banMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: tex } }, vertexShader: BAN_VERT, fragmentShader: BAN_FRAG, fog: false, side: THREE.DoubleSide,
  });
  const bal = new THREE.Mesh(balGeo, balMat); bal.frustumCulled = false;
  const ban = new THREE.Mesh(banGeo, banMat); ban.frustumCulled = false;
  scene.add(bal, ban);
  disposables.push(balGeo, banGeo, balMat, banMat);
  return { dispose() { disposables.forEach((d) => d.dispose()); } };
}
