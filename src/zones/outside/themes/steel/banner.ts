// "Thép & Lửa" · khe bannerCarriers (S5, STYLE_C §5): HAI BLIMP TẤM GHÉP + BỐN CỜ TOUR thay sáu khinh khí cầu.
// Blimp: vỏ thép xám đẽo mặt phẳng (lathe 10 cạnh, tô pháp tuyến phẳng), đường ghép tấm + đinh tán lộ, 4 vây đỏ,
// biểu tượng sao trắng + tia sét đỏ trên đĩa đỏ, cabin có cửa sổ sáng, 2 cánh quạt quay chậm, đèn rọi dưới bụng quét
// chậm; mỗi chiếc treo một băng rôn vải đen dải đỏ mép rách, chữ stencil trắng (khẩu hiệu 2 và 5).
// Cờ tour (khẩu hiệu 1, 3, 4, 6): căng giữa hai tháp đèn thép trên mép khán đài xa, gợn sóng nhẹ.
// Bố trí theo góc nhìn ca sĩ (trái → phải): cờ −46° · blimp −26° · cờ −8° · cờ 8° · blimp 26° · cờ 46° (quanh tâm sân);
// không vật nào che hai màn LED (±30, 15, −75): mép dưới băng rôn/cờ cao hơn đường ngắm qua mép khán đài.
// 3 draw call: thân (blimp + tháp, gộp) · vải (atlas CanvasTexture) · quầng (chùm đèn rọi, cộng màu).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EYE_HEIGHT, STADIUM_CENTRE, STANDS_R_OUTER, STANDS_TOP_Y } from '../../../../world/layout';
import { getCheerTexts, onCheerChange } from '../../balloons';
import type { BannerCarriersHandle, OutsideBuildContext, OutsideBuilders } from '../../builders';
import { FACET_GLSL, boltShape, drawClothBanner, drawTourFlag, gl3, pushPart, ramp, starShape } from './bannerKit';

/** Băng rôn blimp (m) và cờ tour (m). */
export const BLIMP_BAN = { w: 46, h: 26 };
export const FLAG = { w: 30, h: 20 };
const AW = 2048;
const BPX = { w: 1024, h: Math.round((1024 * BLIMP_BAN.h) / BLIMP_BAN.w) };
const FPX = { w: 1024, h: Math.round((1024 * FLAG.h) / FLAG.w) };
const AH = BPX.h + FPX.h * 2;
/** Thân blimp: dài, bán kính lớn nhất. */
const HULL_L = 52, HULL_R = 8;
const GONDOLA_Y = -HULL_R - 0.6;
const BAN_TOP = -HULL_R - 5.2;

type Slot = { kind: 'blimp' | 'flag'; deg: number; r: number; text: number; cell: { x: number; y: number; w: number; h: number } };
const SLOTS: Slot[] = [
  { kind: 'flag', deg: -46, r: 118, text: 0, cell: { x: 0, y: BPX.h, ...FPX } },
  { kind: 'blimp', deg: -26, r: 140, text: 1, cell: { x: 0, y: 0, ...BPX } },
  { kind: 'flag', deg: -8, r: 118, text: 2, cell: { x: 1024, y: BPX.h, ...FPX } },
  { kind: 'flag', deg: 8, r: 118, text: 3, cell: { x: 0, y: BPX.h + FPX.h, ...FPX } },
  { kind: 'blimp', deg: 26, r: 140, text: 4, cell: { x: 1024, y: 0, ...BPX } },
  { kind: 'flag', deg: 46, r: 118, text: 5, cell: { x: 1024, y: BPX.h + FPX.h, ...FPX } },
];

const slope = () => (STANDS_TOP_Y - EYE_HEIGHT) / (STANDS_R_OUTER - STADIUM_CENTRE.z);
function arcXZ(deg: number, r: number) {
  const a = THREE.MathUtils.degToRad(deg);
  return { x: STADIUM_CENTRE.x + Math.sin(a) * r, z: STADIUM_CENTRE.z - Math.cos(a) * r };
}
/** Tâm vỏ blimp: mép dưới băng rôn cao hơn đường ngắm mắt ca sĩ → mép khán đài 2 m. */
export function blimpPos(deg: number, r: number) {
  const { x, z } = arcXZ(deg, r);
  const bottom = EYE_HEIGHT + Math.hypot(x, z) * slope() + 2;
  return new THREE.Vector3(x, bottom + BLIMP_BAN.h - BAN_TOP, z);
}
/** Mép dưới cờ tour (trên mép khán đài). */
const FLAG_BOTTOM = STANDS_TOP_Y + 2.5;

const BOB = /* glsl */ `
vec3 bob(float id, float t){ return vec3(sin(t*0.13+id*1.7)*1.6, sin(t*0.42+id*2.3)*1.0, cos(t*0.11+id*1.3)*1.2); }
vec3 rotAx(vec3 v, vec3 k, float a){ float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }`;

const BODY_VERT = /* glsl */ `
uniform float uTime;
attribute vec3 aCol; attribute float aK; attribute vec4 aPiv; attribute vec3 aAx;
varying vec3 vCol; varying float vK; varying vec2 vUv; varying vec3 vW;
${BOB}
void main(){
  vCol = aCol; vK = aK; vUv = uv;
  vec3 p = position;
  if (aK > 1.5 && aK < 2.5) p = aPiv.xyz + rotAx(p - aPiv.xyz, aAx, uTime * 2.6 + aPiv.w);
  if (aPiv.w > -0.5) p += bob(aPiv.w, uTime);
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const bodyFrag = () => {
  const st = ramp('steel'), coal = ramp('coal'), tu = ramp('tungsten'), arc = ramp('arc');
  return /* glsl */ `
uniform float uTime; uniform float uPulse; uniform float uHype;
varying vec3 vCol; varying float vK; varying vec2 vUv; varying vec3 vW;
${FACET_GLSL()}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 c;
  if (vK < 0.5) {
    // vỏ tấm ghép: 10 dải quanh × 9 đoạn dọc, mỗi tấm lệch sắc, đường ghép tối + hàng đinh tán
    vec2 g = vec2(vUv.x * 10.0, vUv.y * 9.0 + step(0.5, fract(vUv.x * 5.0)) * 0.5);
    vec2 cell = floor(g), f = fract(g);
    vec3 base = mix(${gl3(st[300])}, ${gl3(st[500])}, hash(cell) * 0.55);
    float seam = 1.0 - smoothstep(0.0, 0.035, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) );
    base = mix(base, ${gl3(st[700])}, seam * 0.85);
    vec2 rv = vec2(fract(g.x * 6.0) - 0.5, (f.y - 0.07) * 6.0);
    float riv = step(length(rv), 0.22) * step(f.y, 0.14);
    base = mix(base, ${gl3(st[100])}, riv * 0.6);
    c = facet(base, vW);
  } else if (vK < 1.5) {
    c = ${gl3(tu[500])} * (1.05 + 0.25 * uPulse);
  } else if (vK < 2.5) {
    c = facet(${gl3(coal[300])}, vW);
  } else if (vK < 3.5) {
    c = facet(vCol, vW);
  } else if (vK < 4.5) {
    c = mix(facet(vCol, vW), vCol, 0.55);
  } else {
    c = ${gl3(arc[300])} * (1.1 + 0.3 * uHype);
  }
  gl_FragColor = vec4(c, 1.0);
}`;
};

const CLOTH_VERT = /* glsl */ `
uniform float uTime;
attribute vec2 aBan; attribute vec4 aFlip;
varying vec2 vUv; varying vec2 vFlip; varying float vShade;
${BOB}
void main(){
  vUv = uv; vFlip = aFlip.xy;
  float id = aBan.x, lv = aBan.y, lu = aFlip.z;
  vec3 p = position;
  float w;
  if (id < 9.5) {
    // treo dưới blimp: đung đưa theo mép dưới + gợn chạy ngang
    w = sin(uTime * 0.9 + id * 1.9) * 0.6 * lv + sin(lu * 14.0 - uTime * 2.1 + id) * 0.35 * (0.3 + lv);
    p += normal * w + bob(id, uTime);
  } else {
    // căng giữa hai tháp: hai mép đứng giữ cố định, giữa bụng gợn theo gió
    float env = sin(3.14159 * lu) * (0.35 + 0.65 * lv);
    w = (sin(lu * 9.0 - uTime * 2.4 + id) * 0.55 + sin(lu * 17.0 + lv * 5.0 - uTime * 3.3) * 0.2) * env;
    p += normal * w;
  }
  vShade = 0.86 + 0.14 * clamp(w * 1.4 + 0.5, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const CLOTH_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uPulse; uniform float uHype;
varying vec2 vUv; varying vec2 vFlip; varying float vShade;
void main(){
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = vFlip.x + vFlip.y - uv.x;
  vec4 c = texture2D(uMap, uv);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb * vShade * (0.95 + 0.1 * uPulse * uHype), 1.0);
}`;

const GLOW_VERT = /* glsl */ `
uniform float uTime;
attribute vec4 aPiv;
varying float vD; varying vec3 vW; varying vec3 vN;
${BOB}
void main(){
  vec3 p = aPiv.xyz + rotAx(position - aPiv.xyz, vec3(0.0, 1.0, 0.0), 0.45 * sin(uTime * 0.23 + aPiv.w * 2.1));
  vec3 n = rotAx(normal, vec3(0.0, 1.0, 0.0), 0.45 * sin(uTime * 0.23 + aPiv.w * 2.1));
  vD = length(position - aPiv.xyz);
  p += bob(aPiv.w, uTime);
  vW = p; vN = n;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const glowFrag = () => /* glsl */ `
uniform float uHype;
varying float vD; varying vec3 vW; varying vec3 vN;
void main(){
  float k = clamp(vD / 70.0, 0.0, 1.0);
  float edge = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float a = pow(1.0 - k, 1.6) * (0.05 + 0.12 * edge) * (0.8 + 0.4 * uHype);
  gl_FragColor = vec4(${gl3(ramp('arc')[300])} * a, 1.0);
}`;

/** Profil vỏ (r, y): đuôi thuôn dài, mũi tròn tù. */
function hullProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const N = 13;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = i === 0 || i === N ? 0.01 : HULL_R * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.62);
    pts.push(new THREE.Vector2(r, (t - 0.5) * HULL_L));
  }
  return pts;
}

function buildBlimp(out: THREE.BufferGeometry[], glow: THREE.BufferGeometry[], m: THREE.Matrix4, id: number) {
  const blood = ramp('blood'), paper = ramp('paper'), coal = ramp('coal'), st = ramp('steel');
  const piv = (v: THREE.Vector3) => { const w = v.clone().applyMatrix4(m); return [w.x, w.y, w.z, id]; };
  const ax = new THREE.Vector3(1, 0, 0).transformDirection(m);
  const ex = (pv: THREE.Vector3) => ({ aPiv: piv(pv), aAx: [ax.x, ax.y, ax.z] });
  const still = ex(new THREE.Vector3());
  // vỏ: lathe 10 cạnh quanh Y → trục dọc X (mũi +X)
  const hull = new THREE.LatheGeometry(hullProfile(), 10);
  hull.rotateZ(-Math.PI / 2);
  pushPart(out, hull, m, st[300], 0, still);
  // 4 vây đỏ ở đuôi
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(-9, 0); fin.lineTo(-11.5, 8.5); fin.lineTo(-6.5, 8.5); fin.closePath();
  for (let k = 0; k < 4; k++) {
    const g = new THREE.ExtrudeGeometry(fin, { depth: 0.6, bevelEnabled: false });
    g.translate(-HULL_L / 2 + 13.5, HULL_R * 0.32, -0.3);
    g.rotateX((k * Math.PI) / 2);
    pushPart(out, g, m, blood[300], 3, still);
  }
  // biểu tượng: đĩa đỏ + sao trắng + tia sét đỏ, phía trước (+Z, về sân khấu)
  const ez = HULL_R + 0.25, ecx = 6;
  const disc = new THREE.CircleGeometry(5.2, 10); disc.translate(ecx, 0.4, ez); pushPart(out, disc, m, blood[300], 4, still);
  const ring = new THREE.RingGeometry(4.3, 4.7, 10); ring.translate(ecx, 0.4, ez + 0.05); pushPart(out, ring, m, paper[500], 4, still);
  const star = new THREE.ShapeGeometry(starShape(3.9)); star.translate(ecx, 0.4, ez + 0.1); pushPart(out, star, m, paper[300], 4, still);
  const bolt = new THREE.ShapeGeometry(boltShape(2.6)); bolt.translate(ecx + 0.1, 0.3, ez + 0.18); pushPart(out, bolt, m, blood[500], 4, still);
  // sọc đỏ dọc thân
  const stripe = new THREE.PlaneGeometry(22, 0.9); stripe.translate(-10, -1.5, HULL_R * 0.97 + 0.2); pushPart(out, stripe, m, blood[300], 4, still);
  // cabin (gondola) + cửa sổ sáng + giá treo băng rôn
  const gon = new THREE.CylinderGeometry(1.8, 2.2, 12, 6); gon.rotateZ(Math.PI / 2); gon.translate(1, GONDOLA_Y, 0);
  pushPart(out, gon, m, st[500], 3, still);
  for (let i = 0; i < 6; i++) {
    const w = new THREE.PlaneGeometry(1.1, 0.9); w.translate(-3.5 + i * 1.6, GONDOLA_Y + 0.3, 2.12); pushPart(out, w, m, 0xffffff, 1, still);
  }
  const bar = new THREE.BoxGeometry(BLIMP_BAN.w + 1.5, 0.5, 0.5); bar.translate(0, BAN_TOP + 0.3, 0); pushPart(out, bar, m, coal[300], 3, still);
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(sx * 4, -HULL_R * 0.85, 0), b = new THREE.Vector3(sx * (BLIMP_BAN.w / 2), BAN_TOP + 0.3, 0);
    const c = new THREE.CylinderGeometry(0.09, 0.09, a.distanceTo(b), 4);
    c.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1)));
    pushPart(out, c, m, coal[100], 3, still);
  }
  // 2 cánh quạt 3 lá (quay quanh trục dọc) hai bên đuôi cabin
  for (const sz of [-1, 1]) {
    const pv = new THREE.Vector3(-6.5, GONDOLA_Y + 0.2, sz * 3.4);
    const arm = new THREE.BoxGeometry(0.4, 0.4, 3.2); arm.translate(-5.6, GONDOLA_Y + 0.2, sz * 1.8); pushPart(out, arm, m, st[500], 3, still);
    const hub = new THREE.ConeGeometry(0.5, 1.4, 5); hub.rotateZ(Math.PI / 2); hub.translate(pv.x - 0.2, pv.y, pv.z); pushPart(out, hub, m, coal[300], 3, still);
    for (let b = 0; b < 3; b++) {
      const bl = new THREE.BoxGeometry(0.15, 3.2, 0.55); bl.translate(0, 1.7, 0); bl.rotateX((b * Math.PI * 2) / 3); bl.translate(pv.x - 0.6, pv.y, pv.z);
      pushPart(out, bl, m, coal[300], 2, ex(pv));
    }
  }
  // đèn rọi dưới bụng (chóa + chùm)
  const lamp = new THREE.CylinderGeometry(0.7, 0.5, 0.8, 6); lamp.translate(4.5, GONDOLA_Y - 2.1, 0); pushPart(out, lamp, m, 0xffffff, 5, still);
  const cone = new THREE.ConeGeometry(7, 70, 12, 1, true);
  cone.translate(0, -35, 0); cone.rotateX(-0.65); cone.translate(4.5, GONDOLA_Y - 2.3, 0);
  cone.applyMatrix4(m);
  const n = cone.attributes.position.count, pp = piv(new THREE.Vector3(4.5, GONDOLA_Y - 2.3, 0));
  const pa = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) pa.set(pp, i * 4);
  cone.setAttribute('aPiv', new THREE.BufferAttribute(pa, 4));
  cone.deleteAttribute('uv');
  glow.push(cone.index ? cone.toNonIndexed() : cone);
}

function buildTowers(out: THREE.BufferGeometry[], m: THREE.Matrix4) {
  const st = ramp('steel'), coal = ramp('coal'), blood = ramp('blood');
  const none = { aPiv: [0, 0, 0, -1], aAx: [1, 0, 0] };
  const base = STANDS_TOP_Y - 6, top = FLAG_BOTTOM + FLAG.h + 3.2;
  for (const sx of [-1, 1]) {
    const x = sx * (FLAG.w / 2 + 1.1);
    // tháp lưới: 2 cột + giằng chéo
    for (const dz of [-0.9, 0.9]) {
      const col = new THREE.BoxGeometry(0.45, top - base, 0.45); col.translate(x, (top + base) / 2, dz); pushPart(out, col, m, st[500], 3, none);
    }
    for (let y = base + 1; y < top - 2; y += 3.2) {
      const br = new THREE.BoxGeometry(0.22, 4.2, 0.22); br.rotateX(0.75); br.translate(x, y + 1.6, 0); pushPart(out, br, m, st[700], 3, none);
    }
    // đầu đèn: hộp than + mặt kính sáng
    const head = new THREE.BoxGeometry(2.6, 1.8, 1.6); head.translate(x, top + 0.9, 0); pushPart(out, head, m, coal[300], 3, none);
    const lens = new THREE.PlaneGeometry(2.1, 1.3); lens.translate(x, top + 0.9, 0.82); pushPart(out, lens, m, 0xffffff, 5, none);
    const cap = new THREE.BoxGeometry(2.9, 0.3, 1.9); cap.translate(x, top + 1.95, 0); pushPart(out, cap, m, blood[300], 3, none);
  }
  // dây cáp + thanh treo cờ
  const rod = new THREE.BoxGeometry(FLAG.w + 2.2, 0.4, 0.4); rod.translate(0, FLAG_BOTTOM + FLAG.h + 0.2, 0); pushPart(out, rod, m, coal[100], 3, none);
}

export function createSteelCarriers(ctx: OutsideBuildContext): BannerCarriersHandle {
  const { scene, uniforms } = ctx;
  const canvas = document.createElement('canvas');
  canvas.width = AW; canvas.height = AH;
  const g2 = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    const texts = getCheerTexts();
    for (const s of SLOTS) {
      const c = s.cell;
      if (s.kind === 'blimp') drawClothBanner(g2, c.x, c.y, c.w, c.h, texts[s.text] ?? '', 17 + s.text * 31);
      else drawTourFlag(g2, c.x, c.y, c.w, c.h, texts[s.text] ?? '', 5 + s.text * 13);
    }
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(draw).catch(() => {});

  const parts: THREE.BufferGeometry[] = [], cloth: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  SLOTS.forEach((s, idx) => {
    let pos: THREE.Vector3;
    if (s.kind === 'blimp') pos = blimpPos(s.deg, s.r);
    else { const { x, z } = arcXZ(s.deg, s.r); pos = new THREE.Vector3(x, 0, z); }
    const ry = Math.atan2(-pos.x, -pos.z);
    const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(up, ry), new THREE.Vector3(1, 1, 1));
    const W = s.kind === 'blimp' ? BLIMP_BAN.w : FLAG.w, H = s.kind === 'blimp' ? BLIMP_BAN.h : FLAG.h;
    const top = s.kind === 'blimp' ? BAN_TOP : FLAG_BOTTOM + FLAG.h;
    const id = s.kind === 'blimp' ? idx : 10 + idx;
    if (s.kind === 'blimp') buildBlimp(parts, glow, m, idx); else buildTowers(parts, m);
    // vải: lưới 32×8, UV ô atlas, aBan (id, lv), aFlip (u0, u1, lu)
    const pg = new THREE.PlaneGeometry(W, H, 32, 8);
    pg.translate(0, top - H / 2, 0);
    const uv = pg.attributes.uv as THREE.BufferAttribute, n = uv.count;
    const ban = new Float32Array(n * 2), fl = new Float32Array(n * 4);
    const u0 = s.cell.x / AW, u1 = (s.cell.x + s.cell.w) / AW, v0 = 1 - (s.cell.y + s.cell.h) / AH, v1 = 1 - s.cell.y / AH;
    for (let i = 0; i < n; i++) {
      const x = uv.getX(i), y = uv.getY(i);
      ban[i * 2] = id; ban[i * 2 + 1] = 1 - y;
      fl.set([u0, u1, x, 0], i * 4);
      uv.setXY(i, u0 + x * (u1 - u0), v0 + y * (v1 - v0));
    }
    pg.applyMatrix4(m);
    pg.setAttribute('aBan', new THREE.BufferAttribute(ban, 2));
    pg.setAttribute('aFlip', new THREE.BufferAttribute(fl, 4));
    cloth.push(pg);
  });
  const geo = mergeGeometries(parts)!, clothGeo = mergeGeometries(cloth)!, glowGeo = mergeGeometries(glow)!;
  [...parts, ...cloth, ...glow].forEach((g) => g.dispose());
  const U = { uTime: uniforms.uTime, uPulse: uniforms.uPulse, uHype: uniforms.uHype };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: BODY_VERT, fragmentShader: bodyFrag(), fog: false, side: THREE.DoubleSide });
  const clothMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uMap: { value: tex } }, vertexShader: CLOTH_VERT, fragmentShader: CLOTH_FRAG, fog: false, side: THREE.DoubleSide,
  });
  const glowMat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: GLOW_VERT, fragmentShader: glowFrag(), fog: false, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(geo, mat), clothM = new THREE.Mesh(clothGeo, clothMat), glowM = new THREE.Mesh(glowGeo, glowMat);
  body.frustumCulled = clothM.frustumCulled = glowM.frustumCulled = false;
  glowM.renderOrder = 2;
  scene.add(body, clothM, glowM);
  return {
    dispose() {
      disposed = true;
      off();
      scene.remove(body, clothM, glowM);
      geo.dispose(); clothGeo.dispose(); glowGeo.dispose(); mat.dispose(); clothMat.dispose(); glowMat.dispose(); tex.dispose();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { bannerCarriers: createSteelCarriers };
