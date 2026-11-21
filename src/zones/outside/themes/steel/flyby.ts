// "Thép & Lửa" · khe flyby (S5, STYLE_C §5): "TRỰC THĂNG ĐÔI CĂNG BANNER" thay máy bay kéo băng rôn.
// Hai CẶP trực thăng đẽo mặt phẳng (thân đen/thép, đuôi đỏ, rotor quay, đèn rọi mũi) bay TRÁI → PHẢI của ca sĩ theo
// hành lang FLYBY của mặc định, mỗi cặp bay nối đuôi và căng MỘT băng rôn dài giữa hai chiếc bằng 4 sợi cáp (vải đen
// dải đỏ, chữ stencil trắng, gợn sóng): cặp 1 = khẩu hiệu 1, cặp 2 (theo sau, gần hơn) = khẩu hiệu 4. Leo lên khi qua
// khán đài, KHÔNG dừng: bay tiếp tới khi cách gốc > FLYBY.exitR mới ẩn (thu nhỏ trước mặt cắt xa → không "pop").
// Hợp đồng như flyby.ts: Hype ≥ 0,95 (tái kích hoạt khi < 0,8, hồi chiêu 25 s) hoặc consumeFlybyRequest();
// 'cs-secret' kind 'plane' start/end; điểm nhìn secretFocusState. 2 draw call khi chạy (trực thăng instanced + băng rôn &
// cáp), 0 khi rảnh; mỗi frame chỉ đổi instance matrix + uniform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../../../core/types';
import { FLYBY, STADIUM_CENTRE, STANDS_R_INNER, STANDS_R_OUTER } from '../../../../world/layout';
import { consumeFlybyRequest, getCheerTexts, onCheerChange } from '../../balloons';
import type { FlybyHandle, OutsideBuildContext, OutsideBuilders } from '../../builders';
import { emitSecret, secretFocusState } from '../../secretShared';
import { FACET_GLSL, drawClothBanner, gl3, pushPart, ramp } from './bannerKit';

const DUR = 18;
const COOLDOWN = 25;
const HS = 1.35; // tỉ lệ trực thăng
/** Băng rôn (m) và khoảng cách hai trực thăng trong cặp. */
const BW = 40, BH = 8.5, SPAN = 50, DROP = 8;
const AW = 2048, CH = Math.round((AW * BH) / BW);
const PAIRS = [
  { x0: -230, y: FLYBY.y + 6, z: FLYBY.z, text: 0 },
  { x0: -230 - SPAN - FLYBY.gap, y: FLYBY.y2 + 6, z: FLYBY.z2, text: 3 },
].map((p) => {
  const dz = p.z - STADIUM_CENTRE.z;
  const xIn = Math.sqrt(Math.max(STANDS_R_INNER ** 2 - dz * dz, 0)), xOut = Math.sqrt(STANDS_R_OUTER ** 2 - dz * dz);
  return { ...p, c0: xIn - 20, c1: xOut };
});

function buildHeli(): THREE.BufferGeometry {
  const st = ramp('steel'), coal = ramp('coal'), blood = ramp('blood'), arc = ramp('arc');
  const parts: THREE.BufferGeometry[] = [];
  const none = { aPiv: [0, 0, 0, 0] };
  const prof = [[0.01, 3.6], [0.9, 2.8], [1.35, 1.2], [1.4, -0.6], [1.0, -2.0], [0.45, -2.8], [0.01, -2.81]].map(([r, y]) => new THREE.Vector2(r, y));
  const cab = new THREE.LatheGeometry(prof, 6); cab.rotateZ(-Math.PI / 2); cab.scale(1, 1.05, 0.85);
  pushPart(parts, cab, null, coal[300], 0, none);
  const glass = new THREE.OctahedronGeometry(1, 0); glass.scale(1.3, 0.75, 0.9); glass.translate(2.3, 0.45, 0); pushPart(parts, glass, null, st[700], 3, none);
  const boom = new THREE.CylinderGeometry(0.22, 0.45, 7.5, 5); boom.rotateZ(Math.PI / 2); boom.translate(-6.2, 0.35, 0); pushPart(parts, boom, null, blood[300], 3, none);
  const fin = new THREE.Shape([[0, 0], [-1.4, 0], [-2.0, 2.4], [-1.2, 2.4]].map(([x, y]) => new THREE.Vector2(x, y)));
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.16, bevelEnabled: false }); fg.translate(-8.6, 0.3, -0.08); pushPart(parts, fg, null, blood[300], 3, none);
  const stab = new THREE.BoxGeometry(1.1, 0.1, 2.6); stab.translate(-8.6, 0.4, 0); pushPart(parts, stab, null, coal[300], 3, none);
  const mast = new THREE.CylinderGeometry(0.25, 0.35, 0.8, 5); mast.translate(0, 1.6, 0); pushPart(parts, mast, null, st[500], 3, none);
  const eng = new THREE.BoxGeometry(2.4, 0.6, 1.2); eng.translate(-0.6, 1.25, 0); pushPart(parts, eng, null, st[500], 3, none);
  for (const s of [1, -1]) {
    const skid = new THREE.BoxGeometry(4.6, 0.18, 0.18); skid.translate(0.2, -1.75, s * 1.05); pushPart(parts, skid, null, st[300], 3, none);
    for (const x of [-1, 1.4]) { const leg = new THREE.BoxGeometry(0.14, 0.9, 0.14); leg.translate(x, -1.3, s * 0.95); pushPart(parts, leg, null, st[300], 3, none); }
  }
  // rotor chính 3 lá (loại 2: quay quanh Y tại trục) + đĩa mờ không cần
  for (let b = 0; b < 3; b++) {
    const bl = new THREE.BoxGeometry(5.8, 0.08, 0.45); bl.translate(2.9, 2.05, 0); bl.rotateY((b * Math.PI * 2) / 3);
    pushPart(parts, bl, null, coal[100], 2, { aPiv: [0, 2.05, 0, 0] });
  }
  // rotor đuôi (loại 5: quay quanh Z)
  for (let b = 0; b < 2; b++) {
    const bl = new THREE.BoxGeometry(0.16, 1.7, 0.05); bl.rotateZ((b * Math.PI) / 2); bl.translate(-9.1, 1.0, 0.25);
    pushPart(parts, bl, null, coal[100], 5, { aPiv: [-9.1, 1.0, 0.25, 0] });
  }
  // đèn rọi mũi (loại 1 phát sáng)
  const lamp = new THREE.CircleGeometry(0.32, 6); lamp.rotateY(Math.PI / 2); lamp.translate(3.35, -0.55, 0); pushPart(parts, lamp, null, arc[100], 1, none);
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  g.scale(HS, HS, HS);
  const pv = g.getAttribute('aPiv') as THREE.BufferAttribute;
  for (let i = 0; i < pv.count; i++) pv.setXYZ(i, pv.getX(i) * HS, pv.getY(i) * HS, pv.getZ(i) * HS);
  return g;
}

const HELI_VERT = /* glsl */ `
uniform float uTime;
attribute vec3 aCol; attribute float aK; attribute vec4 aPiv;
varying vec3 vCol; varying float vK; varying vec3 vW;
vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 rotZ(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
void main(){
  vec3 p = position;
  if (aK > 1.5 && aK < 2.5) p = aPiv.xyz + rotY(p - aPiv.xyz, uTime * 19.0);
  else if (aK > 4.5) p = aPiv.xyz + rotZ(p - aPiv.xyz, uTime * 31.0);
  vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float kd = 1.0 - smoothstep(150.0, 205.0, length(cameraPosition - c.xyz));
  vec4 w = modelMatrix * instanceMatrix * vec4(p * kd, 1.0);
  vCol = aCol; vK = aK; vW = w.xyz;
  gl_Position = kd < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * w;
}`;
const heliFrag = () => /* glsl */ `
varying vec3 vCol; varying float vK; varying vec3 vW;
${FACET_GLSL()}
void main(){ gl_FragColor = vec4(vK > 0.5 && vK < 1.5 ? vCol * 1.3 : facet(vCol, vW), 1.0); }`;

const BAN_VERT = /* glsl */ `
uniform float uTime; uniform vec4 uPos[2];
attribute vec4 aB; // cặp, lu, lv, loại (0 vải, 1 cáp)
varying vec2 vUv; varying float vK; varying float vSh;
void main(){
  vUv = uv; vK = aB.w;
  vec3 p = position;
  float w = 0.0;
  if (aB.w < 0.5) {
    float env = 0.35 + 0.65 * sin(3.14159 * aB.y);
    w = (sin(aB.y * 11.0 - uTime * 4.0 + aB.x * 2.0) * 0.55 + sin(aB.y * 23.0 - uTime * 6.5) * 0.18) * env * (0.5 + aB.z);
    p.z += w; p.y += sin(aB.y * 7.0 - uTime * 3.0) * 0.2 * aB.z;
  }
  vSh = 0.84 + 0.16 * clamp(w + 0.5, 0.0, 1.0);
  vec4 o = aB.x < 0.5 ? uPos[0] : uPos[1];
  vec3 wp = o.xyz + p * o.w;
  gl_Position = o.w < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const banFrag = () => /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv; varying float vK; varying float vSh;
void main(){
  if (vK > 0.5) { gl_FragColor = vec4(${gl3(ramp('steel')[300])} * 0.7, 1.0); return; }
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec4 c = texture2D(uMap, uv);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb * vSh, 1.0);
}`;

export function createSteelFlyby(ctx: OutsideBuildContext): FlybyHandle {
  const { scene, uniforms } = ctx;
  const disposables: { dispose(): void }[] = [];
  // atlas băng rôn: 2 ô dọc
  const canvas = document.createElement('canvas');
  canvas.width = AW; canvas.height = CH * 2;
  const g2 = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    const texts = getCheerTexts();
    PAIRS.forEach((p, i) => drawClothBanner(g2, 0, i * CH, AW, CH, texts[p.text] ?? '', 91 + i * 7, true));
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(draw).catch(() => {});
  disposables.push(tex, { dispose: off });

  // trực thăng (4 instance: cặp 0 = 0,1; cặp 1 = 2,3; chiếc chẵn bay trước)
  const hGeo = buildHeli();
  const hMat = new THREE.ShaderMaterial({ uniforms: { uTime: uniforms.uTime }, vertexShader: HELI_VERT, fragmentShader: heliFrag(), fog: false, side: THREE.DoubleSide });
  const helis = new THREE.InstancedMesh(hGeo, hMat, 4);
  helis.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  helis.frustumCulled = false;
  helis.visible = false;
  scene.add(helis);
  disposables.push(hGeo, hMat, { dispose: () => helis.dispose() });

  // băng rôn + cáp (toạ độ cục bộ của cặp: gốc = giữa hai trực thăng, y = 0 ngang thân)
  const parts: THREE.BufferGeometry[] = [];
  PAIRS.forEach((_, i) => {
    const pg = new THREE.PlaneGeometry(BW, BH, 40, 4);
    pg.translate(0, -DROP - BH / 2, 0);
    const uv = pg.attributes.uv as THREE.BufferAttribute, n = uv.count, ab = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      const x = uv.getX(k), y = uv.getY(k);
      ab.set([i, x, 1 - y, 0], k * 4);
      uv.setXY(k, x, (1 - i) * 0.5 + y * 0.5);
    }
    pg.setAttribute('aB', new THREE.BufferAttribute(ab, 4));
    pg.deleteAttribute('normal');
    parts.push(pg);
    for (const sx of [-1, 1]) for (const dx of [-1.6, 1.6]) {
      const a = new THREE.Vector3(sx * (SPAN / 2) + dx * 0.4, -1.8 * HS, 0), b = new THREE.Vector3(sx * (BW / 2) * (dx < 0 === sx < 0 ? 1 : 0.86), -DROP, 0);
      const c = new THREE.CylinderGeometry(0.08, 0.08, a.distanceTo(b), 3);
      c.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1)));
      const ng = c.toNonIndexed(); c.dispose();
      ng.deleteAttribute('normal');
      const cn = ng.attributes.position.count, cb = new Float32Array(cn * 4);
      for (let k = 0; k < cn; k++) cb.set([i, 0, 0, 1], k * 4);
      ng.setAttribute('aB', new THREE.BufferAttribute(cb, 4));
      parts.push(ng);
    }
  });
  const bGeo = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  parts.forEach((p) => p.dispose());
  const uPos = { value: [new THREE.Vector4(), new THREE.Vector4()] };
  const bMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uPos, uMap: { value: tex } }, vertexShader: BAN_VERT, fragmentShader: banFrag(), fog: false, side: THREE.DoubleSide,
  });
  const ban = new THREE.Mesh(bGeo, bMat);
  ban.frustumCulled = false;
  ban.visible = false;
  scene.add(ban);
  disposables.push(bGeo, bMat);

  let armed = true, lastStart = -Infinity, start = -1, pStart = -1;
  const live = [false, false];
  const begin = (t: number) => {
    if (start >= 0) emitSecret('plane', 'end');
    emitSecret('plane', 'start');
    start = t; lastStart = t; pStart = t;
    live[0] = live[1] = true;
    helis.visible = ban.visible = true;
  };
  const sm = THREE.MathUtils.smoothstep;
  const pairY = (i: number, x: number) => { const p = PAIRS[i]!; return p.y + (FLYBY.climbY - p.y) * sm(Math.abs(x), p.c0, p.c1); };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const mid = [new THREE.Vector3(), new THREE.Vector3()];
  const updatePairs = (ep: number) => {
    for (let i = 0; i < 2; i++) {
      const p = PAIRS[i]!;
      if (!live[i]) { helis.setMatrixAt(i * 2, zero); helis.setMatrixAt(i * 2 + 1, zero); uPos.value[i]!.w = 0; continue; }
      const x = p.x0 + FLYBY.speed * ep;
      const y = pairY(i, x) + Math.sin(ep * 0.7 + i * 2) * 0.5;
      const z = p.z + Math.sin(ep * 0.25 + i) * 1.2;
      if (Math.hypot(x, y, z) > FLYBY.exitR + SPAN / 2) { live[i] = false; continue; }
      mid[i]!.set(x, y, z);
      const slope = pairY(i, x + 0.5) - pairY(i, x - 0.5);
      e.set(0.05 * Math.sin(ep * 1.3 + i), 0, -0.2 + Math.atan(slope) * 0.8);
      q.setFromEuler(e);
      for (const s of [1, -1]) {
        v.set(x + (s * SPAN) / 2, y + Math.sin(ep * 1.7 + s + i) * 0.25, z);
        m4.compose(v, q, one);
        helis.setMatrixAt(i * 2 + (s > 0 ? 0 : 1), m4);
      }
      uPos.value[i]!.set(x, y, z, 1);
    }
    helis.instanceMatrix.needsUpdate = true;
    if (!live[0] && !live[1]) { pStart = -1; helis.visible = ban.visible = false; }
  };

  return {
    update(f: FrameState, t: number) {
      if (consumeFlybyRequest()) begin(t);
      if (f.hype < 0.8) armed = true;
      else if (armed && f.hype >= 0.95 && t - lastStart >= COOLDOWN) { armed = false; begin(t); }
      if (pStart >= 0) updatePairs(t - pStart);
      if (start < 0) return;
      const el = t - start;
      if (el > DUR || el < 0) {
        start = -1;
        emitSecret('plane', 'end');
        secretFocusState.active = false;
        return;
      }
      const a = live[0] ? mid[0]! : mid[1]!, b = live[1] ? mid[1]! : mid[0]!;
      secretFocusState.v.set(THREE.MathUtils.clamp((a.x + b.x) / 2 - 10, -45, 45), (a.y + b.y) / 2 - 6, (a.z + b.z) / 2);
      secretFocusState.active = true;
    },
    dispose() {
      disposed = true;
      scene.remove(helis, ban);
      disposables.forEach((d) => d.dispose());
    },
  };
}

export const builders: Partial<OutsideBuilders> = { flyby: createSteelFlyby };
