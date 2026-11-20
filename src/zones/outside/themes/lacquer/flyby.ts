// "Mực & Sơn mài · bản Việt" · khe flyby (L6): DIỀU SÁO KÉO LIỄN thay hai máy bay kéo băng rôn.
// Hai diều sáo (cánh lưỡi liềm giấy dó vẽ sen — son/vàng và ngọc/vàng — sống tre, bộ sáo trúc 2 tầng trên đầu, hai dải
// đuôi dài) bay TRÁI → PHẢI của ca sĩ theo hành lang FLYBY của máy bay mặc định (bập bềnh nhẹ, leo khi qua khán đài),
// mỗi chiếc kéo một băng rôn lụa son viền vàng gợn sóng (chữ đọc xuôi cả hai mặt): khẩu hiệu 1 và khẩu hiệu 4.
// Hợp đồng như flyby.ts: Hype ≥ 0,95 (tái kích hoạt khi < 0,8, hồi chiêu 25 s) hoặc consumeFlybyRequest(); 'cs-secret'
// kind 'plane' start/end; điểm nhìn secretFocusState; diều bay tiếp ra ngoài sân, chỉ ẩn khi xa hơn FLYBY.exitR (thu nhỏ
// theo khoảng cách camera trước đó). 2 draw call khi chạy (mỗi diều + đuôi + dây + băng rôn một mesh), 0 khi rảnh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../../../core/types';
import { FLYBY, STADIUM_CENTRE, STANDS_R_INNER, STANDS_R_OUTER } from '../../../../world/layout';
import { consumeFlybyRequest, getCheerTexts, onCheerChange } from '../../balloons';
import type { FlybyHandle, OutsideBuildContext, OutsideBuilders } from '../../builders';
import { emitSecret, secretFocusState } from '../../secretShared';
import { css, drawSilkBanner, gl3, ramp, rgb3 } from './bannerKit';

const DUR = 18;
const COOLDOWN = 25;
const KITE_S = 1.5;
/** Băng rôn kéo (m, cục bộ chưa scale) và vị trí mép phải (gần diều). */
const BAN_W = 26, BAN_H = 4.4, BAN_X0 = -9;
const AW = 2048, AH = 1024;
const KITES = [
  { x0: -230, y: FLYBY.y + 4, z: FLYBY.z, text: 0, face: 0 },
  { x0: -230 - FLYBY.gap, y: FLYBY.y2 + 4, z: FLYBY.z2, text: 3, face: 1 },
].map((k) => {
  const dz = k.z - STADIUM_CENTRE.z;
  const xIn = Math.sqrt(Math.max(STANDS_R_INNER ** 2 - dz * dz, 0)), xOut = Math.sqrt(STANDS_R_OUTER ** 2 - dz * dz);
  return { ...k, c0: xIn - 20, c1: xOut };
});

/** Viền cánh diều (m, cục bộ): lưỡi liềm (vòm cung, hai mũi cụp như cánh chim). */
function wingPath(p: { moveTo(x: number, y: number): void; quadraticCurveTo(a: number, b: number, c: number, d: number): void }) {
  p.moveTo(-7, -2.0);
  p.quadraticCurveTo(0, 6.0, 7, -2.0);
  p.quadraticCurveTo(0, 1.0, -7, -2.0);
}
const toCanvas = (x: number, y: number, cx: number, cy: number) => [cx + (x + 7.5) * (1024 / 15), cy + (3.5 - y) * (512 / 7.5)] as const;

function drawKiteFace(g: CanvasRenderingContext2D, cx: number, cy: number, variant: number) {
  const son = ramp('son'), gold = ramp('gold'), jade = ramp('jade'), silk = ramp('silk');
  const base = variant === 0 ? son[500] : jade[500];
  g.save();
  g.fillStyle = css(base); g.fillRect(cx, cy, 1024, 512);
  // loang 2 bậc
  g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(cx, cy + 300, 1024, 212);
  const P = { moveTo: (x: number, y: number) => g.moveTo(...toCanvas(x, y, cx, cy)), quadraticCurveTo: (a: number, b: number, c: number, d: number) => g.quadraticCurveTo(...toCanvas(a, b, cx, cy), ...toCanvas(c, d, cx, cy)) };
  // viền vàng khảm
  g.beginPath(); wingPath(P); g.closePath();
  g.lineWidth = 22; g.strokeStyle = css(gold[500]); g.stroke();
  g.lineWidth = 6; g.strokeStyle = css(gold[300]); g.stroke();
  // mây cuộn ở hai cánh
  g.strokeStyle = css(variant === 0 ? gold[300] : silk[100]); g.lineWidth = 9; g.lineCap = 'round';
  for (const sx of [-1, 1]) {
    const [x, y] = toCanvas(sx * 4.3, -0.1, cx, cy);
    g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 1.6); g.stroke();
    g.beginPath(); g.arc(x + sx * 58, y + 10, 22, Math.PI, Math.PI * 2.5); g.stroke();
  }
  // sen vàng giữa
  const [lx, ly] = toCanvas(0, 0.8, cx, cy);
  g.translate(lx, ly + 50);
  const petal = (ang: number, len: number, wid: number, col: number) => {
    g.save(); g.rotate(ang); g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(wid, -len * 0.5, 0, -len); g.quadraticCurveTo(-wid, -len * 0.5, 0, 0);
    g.fillStyle = css(col); g.fill(); g.lineWidth = 4; g.strokeStyle = css(gold[700]); g.stroke(); g.restore();
  };
  for (const a of [-1.1, 1.1]) petal(a, 70, 26, gold[500]);
  for (const a of [-0.55, 0.55]) petal(a, 92, 30, gold[300]);
  petal(0, 110, 34, gold[100]);
  g.fillStyle = css(gold[500]); g.beginPath(); g.ellipse(0, 0, 60, 14, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

const VERT = /* glsl */ `
uniform float uTime;
attribute float aKind; attribute vec3 aCol;
varying vec2 vUv; varying float vKind; varying vec3 vCol; varying vec3 vN;
void main(){
  vUv = uv; vKind = aKind; vCol = aCol; vN = normalize(mat3(modelMatrix) * normal);
  vec3 p = position;
  float kd = 1.0 - smoothstep(150.0, 205.0, length(cameraPosition - modelMatrix[3].xyz));
  if (aKind > 2.5 && aKind < 3.5) {
    // băng rôn: gợn sóng tăng dần về đuôi (−x)
    float d = max(-p.x - ${(-BAN_X0 * KITE_S).toFixed(1)}, 0.0);
    p.z += sin(d * 0.3 - uTime * 4.0) * (0.15 + d * 0.04) + sin(d * 0.8 - uTime * 7.0) * 0.1;
    p.y -= d * d * 0.0009;
  } else if (aKind > 4.5) {
    // đuôi ruy băng: sóng mềm
    float d = max(-p.x, 0.0);
    p.y += sin(d * 0.45 - uTime * 5.0) * 0.08 * d; p.z += sin(d * 0.35 - uTime * 4.0) * 0.06 * d;
  }
  gl_Position = kd < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * modelViewMatrix * vec4(p * kd, 1.0);
}`;
const frag = () => /* glsl */ `
uniform sampler2D uMap; uniform float uPulse;
varying vec2 vUv; varying float vKind; varying vec3 vCol; varying vec3 vN;
void main(){
  vec3 c;
  if (vKind < 0.5 || (vKind > 2.5 && vKind < 3.5)) {
    vec2 uv = vUv;
    if (!gl_FrontFacing) uv.x = vCol.x + vCol.y - uv.x;
    vec4 t = texture2D(uMap, uv);
    if (t.a < 0.5) discard;
    c = t.rgb;
  } else c = vCol;
  float d = dot(normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), normalize(vec3(-0.4, 0.75, 0.55)));
  vec3 sh = mix(c * 0.66, ${gl3(ramp('lacquer')[500])}, 0.15);
  c = mix(sh, c, smoothstep(-0.25, -0.1, d));
  gl_FragColor = vec4(c * (0.95 + 0.08 * uPulse), 1.0);
}`;

type G = THREE.BufferGeometry;
function tag(g: G, kind: number, col: [number, number, number], out: G[]) {
  const ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose();
  if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
  if (!ng.attributes.normal) ng.computeVertexNormals();
  for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ng.deleteAttribute(k);
  const n = ng.attributes.position.count, kk = new Float32Array(n), cc = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { kk[i] = kind; cc.set(col, i * 3); }
  ng.setAttribute('aKind', new THREE.BufferAttribute(kk, 1)); ng.setAttribute('aCol', new THREE.BufferAttribute(cc, 3));
  out.push(ng);
}
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}

function buildKite(face: number, banRow: number): G {
  const gold = ramp('gold'), son = ramp('son'), jade = ramp('jade'), lac = ramp('lacquer');
  const out: G[] = [];
  const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
  // cánh: ShapeGeometry hai mặt (DoubleSide), uv → ô atlas
  const sh = new THREE.Shape(); wingPath(sh);
  const wing = new THREE.ShapeGeometry(sh, 24);
  const uv = wing.attributes.uv as THREE.BufferAttribute, pos = wing.attributes.position as THREE.BufferAttribute;
  const u0 = face * 1024;
  for (let i = 0; i < uv.count; i++) {
    const [px, py] = toCanvas(pos.getX(i), pos.getY(i), u0, 0);
    uv.setXY(i, px / AW, 1 - py / AH);
  }
  tag(wing, 0, [u0 / AW, (u0 + 1024) / AW, 0], out);
  // sống tre + nan ngang (sau cánh một chút)
  const bam = rgb3(gold[700]);
  tag(rod(V(0, -1.6, -0.15), V(0, 3.4, -0.15), 0.14), 1, bam, out);
  tag(rod(V(-6.5, -1.6, -0.15), V(6.5, -1.6, -0.15), 0.1), 1, bam, out);
  // bộ sáo 2 tầng: ống trúc ngang + bầu sáo
  const flute = rgb3(face === 0 ? jade[300] : gold[300]);
  tag(rod(V(-2.4, 3.0, 0), V(2.4, 3.0, 0), 0.32), 1, flute, out);
  tag(rod(V(-1.6, 3.95, 0), V(1.6, 3.95, 0), 0.26), 1, flute, out);
  for (const [x, y] of [[-2.4, 3.0], [2.4, 3.0], [-1.6, 3.95], [1.6, 3.95]]) {
    const cap = new THREE.SphereGeometry(0.4, 8, 6); cap.translate(x, y, 0); tag(cap, 1, rgb3(gold[500]), out);
  }
  tag(rod(V(0, 1.8, 0), V(0, 4.3, 0), 0.1), 1, bam, out);
  // hai dải đuôi từ hai mũi cánh, kéo về −x
  for (const [sx, col] of [[-7, son[500]], [7, gold[500]]] as const) {
    const t = new THREE.PlaneGeometry(22, 0.7, 22, 1);
    t.translate(-11, 0, 0); t.rotateZ(0.08); t.translate(sx, -2.0, -0.05);
    tag(t, 5, rgb3(col), out);
  }
  // dây kéo băng rôn
  const rope = rgb3(lac[300]);
  tag(rod(V(-1.5, 0.5, 0), V(BAN_X0, -3.2, 0), 0.06), 1, rope, out);
  tag(rod(V(-1.5, 0.5, 0), V(BAN_X0, -3.2 - BAN_H, 0), 0.06), 1, rope, out);
  // băng rôn (gợn trong shader); uv → hàng atlas
  const ban = new THREE.PlaneGeometry(BAN_W, BAN_H, 40, 2);
  ban.translate(BAN_X0 - BAN_W / 2, -3.2 - BAN_H / 2, 0);
  const bu = ban.attributes.uv as THREE.BufferAttribute;
  const v0 = 1 - (512 + (banRow + 1) * 256) / AH, v1 = 1 - (512 + banRow * 256) / AH;
  for (let i = 0; i < bu.count; i++) bu.setXY(i, bu.getX(i), v0 + bu.getY(i) * (v1 - v0));
  tag(ban, 3, [0, 1, 0], out);
  const g = mergeGeometries(out)!;
  out.forEach((x) => x.dispose());
  g.scale(KITE_S, KITE_S, KITE_S);
  return g;
}

export function createKiteFlyby(ctx: OutsideBuildContext): FlybyHandle {
  const { scene, uniforms } = ctx;
  const canvas = document.createElement('canvas');
  canvas.width = AW; canvas.height = AH;
  const g2 = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    g2.clearRect(0, 0, AW, AH);
    drawKiteFace(g2, 0, 0, 0); drawKiteFace(g2, 1024, 0, 1);
    const texts = getCheerTexts();
    KITES.forEach((k, i) => drawSilkBanner(g2, 0, 512 + i * 256, AW, 256, texts[k.text] ?? ''));
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(draw).catch(() => {});
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uPulse: uniforms.uPulse, uMap: { value: tex } },
    vertexShader: VERT, fragmentShader: frag(), side: THREE.DoubleSide, fog: false,
  });
  const geos = KITES.map((k, i) => buildKite(k.face, i));
  const kites = geos.map((g) => { const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.visible = false; scene.add(m); return m; });

  let armed = true, lastStart = -Infinity, start = -1, pStart = -1;
  const sm = THREE.MathUtils.smoothstep;
  const kiteY = (i: number, x: number) => { const k = KITES[i]!; return k.y + (FLYBY.climbY - k.y) * sm(Math.abs(x), k.c0, k.c1); };
  const begin = (t: number) => {
    if (start >= 0) emitSecret('plane', 'end');
    emitSecret('plane', 'start');
    start = t; lastStart = t; pStart = t;
    kites.forEach((m) => { m.visible = true; });
  };
  const updateKites = (ep: number) => {
    let any = false;
    for (let i = 0; i < kites.length; i++) {
      const k = KITES[i]!, m = kites[i]!;
      if (!m.visible) continue;
      const x = k.x0 + FLYBY.speed * ep;
      const y = kiteY(i, x) + Math.sin(ep * 0.7 + i * 2) * 1.2;
      const z = k.z + Math.sin(ep * 0.25 + i) * 1.5;
      if (Math.hypot(x, y, z) > FLYBY.exitR) { m.visible = false; continue; }
      any = true;
      m.position.set(x, y, z);
      const slope = kiteY(i, x + 0.5) - kiteY(i, x - 0.5);
      m.rotation.set(0.24 + Math.sin(ep * 0.9 + i) * 0.05, Math.sin(ep * 0.5 + i) * 0.08, Math.atan(slope) * 0.6 + Math.sin(ep * 1.1 + i) * 0.06);
    }
    if (!any) pStart = -1;
  };
  return {
    update(f: FrameState, t: number) {
      if (consumeFlybyRequest()) begin(t);
      if (f.hype < 0.8) armed = true;
      else if (armed && f.hype >= 0.95 && t - lastStart >= COOLDOWN) { armed = false; begin(t); }
      if (pStart >= 0) updateKites(t - pStart);
      if (start < 0) return;
      const e = t - start;
      if (e > DUR || e < 0) {
        start = -1;
        emitSecret('plane', 'end');
        secretFocusState.active = false;
        return;
      }
      const a = kites[0]!.position, b = kites[1]!.position;
      secretFocusState.v.set(THREE.MathUtils.clamp((a.x + b.x) / 2 - 10, -45, 45), (a.y + b.y) / 2 - 4, (a.z + b.z) / 2);
      secretFocusState.active = true;
    },
    dispose() {
      disposed = true;
      off();
      kites.forEach((m) => scene.remove(m));
      geos.forEach((g) => g.dispose());
      mat.dispose(); tex.dispose();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { flyby: createKiteFlyby };
