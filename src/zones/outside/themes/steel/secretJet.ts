// "Thép & Lửa" · khe secretJet (S5, STYLE_C §5): "PHẢN LỰC VẼ TIA SÉT" thay tim khói.
// Ba tiêm kích đẽo mặt phẳng (cánh tam giác, đuôi kép, lửa đốt sau bậc thang, sơn thép / đen / đỏ, sao stencil) lao vào
// đội hình 0–5 s, tách đội; chiếc dẫn đầu bổ nhào DỌC tia sét 5–8 s, tia sét lộ dần từ đỉnh tới mũi nhọn; 8 s tia sét
// CHỚP 3 lần (≤ 3 lần/giây) rồi rực đều, nhánh điện lách tách toả ra ~3 s + mưa tia lửa; khói = cụm lục giác
// xám/than hồng. Máy bay bay RA KHỎI sân (> 360 m) rồi mới ẩn; tia sét giữ tới 19 s rồi tắt dần; tổng 24 s.
// Hình tia sét: đa giác zig-zag nướng 1 lần trên CPU thành texture khoảng cách có dấu (R) + khoảng cách tới nhánh điện
// (G, B = số nhánh, A = vị trí dọc nhánh) → mép nét sắc khử răng cưa, nét đều. Bảng hình quay về camera QUANH TRỤC X
// (FIG_BASIS) → từ mắt ca sĩ lẫn máy toàn cảnh đều thấy tia sét đứng, không lật gương; máy bay + khói dùng cùng hệ toạ độ.
// Draw call khi chạy: quad tia sét + máy bay (instanced) + Points (khói + tia lửa) + vòng tia lửa chữ ký = 4; rảnh 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../../../core/types';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { disposeTree, pxScale, seededRnd } from '../../secretShared';
import { FACET_GLSL, FIG_BASIS, FOCUS_CAM, createFireRing, figBasis, gl3, pushPart, ramp, starShape } from './bannerKit';

const D = 24;
/** Tâm hình (world): trên mép xa sân cỏ, từ mắt ca sĩ ≈ 16–38° (dưới mép mái), trọn khung máy toàn cảnh. */
export const BOLT_CENTER = new THREE.Vector3(0, 42, -76);
const T_BREAK = 5, T_TIP = 8, T_FLASH_END = 9, T_CRACKLE_END = 11.2, T_HOLD = 18.5, T_FADE = 21.5;
const EXIT_R = 470; // toạ độ bảng: > 360 m tính từ gốc sân khấu

/** Đa giác tia sét (m, toạ độ bảng: u phải, v lên), đỉnh rộng → mũi nhọn dưới trái. */
const BOLT: [number, number][] = ([[-1, 18], [7, 18], [2.5, 5], [7.5, 5], [-5, -19], [-0.5, -3], [-5.5, -3]] as [number, number][]).map(([u, v]) => [u - 1, v]);
/** Đường bổ nhào của chiếc dẫn đầu (giữa lòng tia sét). */
const DIVE: [number, number][] = [[2, 21], [2, 18], [-1.6, 5], [0.4, -3], [-6, -19]];
const BOX = { u0: -17, v0: -27, u1: 17, v1: 25 };
const TW = 272, TH = 416;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sm = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const ex = bx - ax, ey = by - ay;
  const h = clamp01(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey));
  return { d: Math.hypot(px - ax - ex * h, py - ay - ey * h), h };
}

/** Nhánh điện: các polyline gãy khúc mọc ra từ mép tia sét. */
function buildBranches() {
  const r = seededRnd(4242);
  const segs: { ax: number; ay: number; bx: number; by: number; id: number; s0: number; s1: number }[] = [];
  const roots = [[1, 0.35], [2, 0.6], [3, 0.5], [3, 0.85], [4, 0.3], [4, 0.75], [6, 0.4], [0, 0.6], [5, 0.5], [6, 0.85], [2, 0.2], [4, 0.55]];
  roots.forEach(([e, f], id) => {
    const a = BOLT[e]!, b = BOLT[(e + 1) % BOLT.length]!;
    let x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
    // pháp tuyến ra ngoài (đa giác CW → (dy, −dx))
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    let ang = Math.atan2(-dx / l, dy / l);
    const cross = BOLT.reduce((s, p, i) => { const q = BOLT[(i + 1) % BOLT.length]!; return s + (p[0] * q[1] - q[0] * p[1]); }, 0);
    if (cross < 0) ang += Math.PI;
    const n = 4 + Math.floor(r() * 3), len = 6 + r() * 6, step = len / n;
    let acc = 0;
    for (let k = 0; k < n; k++) {
      ang += (r() - 0.5) * 1.2;
      const nx = x + Math.cos(ang) * step, ny = y + Math.sin(ang) * step;
      segs.push({ ax: x, ay: y, bx: nx, by: ny, id, s0: acc / len, s1: (acc + step) / len });
      if (k === 1 && r() < 0.7) { // nhánh con
        const fa = ang + (r() < 0.5 ? 0.9 : -0.9);
        let fx = nx, fy = ny, fs = (acc + step) / len;
        for (let j = 0; j < 2; j++) {
          const gx = fx + Math.cos(fa + (r() - 0.5) * 0.8) * step * 0.7, gy = fy + Math.sin(fa + (r() - 0.5) * 0.8) * step * 0.7;
          segs.push({ ax: fx, ay: fy, bx: gx, by: gy, id, s0: fs, s1: fs + 0.15 });
          fx = gx; fy = gy; fs += 0.15;
        }
      }
      x = nx; y = ny; acc += step;
    }
  });
  return segs;
}

/** Nướng texture: R = khoảng cách có dấu tới tia sét (âm = trong), G = tới nhánh điện gần nhất, B = số nhánh/16, A = dọc nhánh. */
function buildBoltTex(): THREE.DataTexture {
  const br = buildBranches();
  const n = TW * TH, data = new Uint16Array(n * 4), h = THREE.DataUtils.toHalfFloat;
  const du = (BOX.u1 - BOX.u0) / TW, dv = (BOX.v1 - BOX.v0) / TH;
  for (let j = 0; j < TH; j++) {
    const py = BOX.v0 + (j + 0.5) * dv;
    for (let i = 0; i < TW; i++) {
      const px = BOX.u0 + (i + 0.5) * du;
      let d = 1e9, inside = false;
      for (let k = 0, m = BOLT.length - 1; k < BOLT.length; m = k++) {
        const a = BOLT[k]!, b = BOLT[m]!;
        d = Math.min(d, segDist(px, py, a[0], a[1], b[0], b[1]).d);
        if ((a[1] > py) !== (b[1] > py) && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      let bd = 6, bid = 0, bs = 1;
      for (const s of br) {
        if (Math.abs(px - s.ax) > 8 || Math.abs(py - s.ay) > 8) continue;
        const q = segDist(px, py, s.ax, s.ay, s.bx, s.by);
        if (q.d < bd) { bd = q.d; bid = s.id; bs = s.s0 + (s.s1 - s.s0) * q.h; }
      }
      const k = (j * TW + i) * 4;
      data[k] = h(Math.min(d, 12) * (inside ? -1 : 1)); data[k + 1] = h(bd); data[k + 2] = h(bid / 16); data[k + 3] = h(bs);
    }
  }
  const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const QUAD_VERT = /* glsl */ `
${FIG_BASIS}
varying vec2 vP;
void main(){ vP = position.xy; gl_Position = projectionMatrix * viewMatrix * vec4(figWorld(vec3(position.xy, 0.0)), 1.0); }`;
const quadFrag = () => {
  const wh = ramp('whitehot'), fl = ramp('flame'), em = ramp('ember'), arc = ramp('arc');
  return /* glsl */ `
precision highp float;
uniform sampler2D uTex; uniform vec4 uBox; uniform float uHead; uniform float uFlash; uniform float uGlow; uniform float uA; uniform float uT; uniform float uCrackle;
varying vec2 vP;
float h1(float n){ return fract(sin(n * 78.233) * 43758.5453); }
void main(){
  vec4 s = texture2D(uTex, (vP - uBox.xy) / uBox.zw);
  float d = s.r, aa = max(fwidth(d), 0.02);
  float shown = smoothstep(uHead - 0.4, uHead + 0.4, vP.y);
  float inside = (1.0 - smoothstep(-aa, aa, d)) * shown;
  // lõi trắng nóng → mép cam lửa (dải 1 m trong mép) → viền than hồng mảnh
  float e = smoothstep(-1.25, -0.25, d);
  vec3 core = mix(${gl3(wh[100])}, ${gl3(fl[500])}, e);
  core = mix(core, ${gl3(em[500])}, smoothstep(-0.35, 0.0, d) * 0.7);
  float head = exp(-abs(vP.y - uHead) * 0.7) * step(0.01, uHead + 30.0) * (1.0 - step(30.0, uHead));
  core += ${gl3(wh[300])} * head * 0.6;
  // quầng than hồng ngoài mép
  float od = max(d, 0.0);
  float glow = exp(-od * (0.55 - 0.25 * uFlash)) * (1.0 - inside) * shown * (0.35 * uGlow + 0.9 * uFlash);
  vec3 col = core * inside * (1.0 + 0.6 * uFlash) + mix(${gl3(em[300])}, ${gl3(fl[300])}, exp(-od)) * glow;
  float a = inside;
  // nhánh điện: mọc ra rồi lách tách (mỗi nhánh đổi trạng thái ≤ 3 lần/giây)
  float id = floor(s.b * 16.0 + 0.5);
  float grow = clamp((uT - id * 0.11) / 0.35, 0.0, 1.0);
  float on = step(0.3, h1(id * 7.1 + floor(uT * 3.0 + h1(id) * 3.0))) * uCrackle;
  float bw = 0.24 * (1.0 - 0.55 * s.a);
  float baa = max(fwidth(s.g), 0.02);
  float bl = (1.0 - smoothstep(bw - baa, bw + baa, s.g)) * step(s.a, grow) * on * step(0.0, d);
  float bg = exp(-s.g * 1.2) * 0.6 * step(s.a, grow) * on * step(0.0, d);
  col += mix(${gl3(arc[300])}, ${gl3(wh[100])}, 0.5) * bl + ${gl3(arc[500])} * bg * 0.5;
  a = max(a, bl);
  col *= uA; a *= uA;
  if (a < 0.002 && dot(col, vec3(1.0)) < 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;
};

// ───────── Máy bay (mũi +x, lưng +y, cánh ±z) ─────────
function buildJetGeo(): THREE.BufferGeometry {
  const st = ramp('steel'), coal = ramp('coal'), blood = ramp('blood'), paper = ramp('paper'), fl = ramp('flame'), wh = ramp('whitehot');
  const parts: THREE.BufferGeometry[] = [];
  const prof = [[0.01, 7.5], [0.55, 5], [0.95, 2], [1.0, -1], [0.95, -4.5], [0.8, -6.2], [0.01, -6.21]].map(([r, y]) => new THREE.Vector2(r, y));
  const fus = new THREE.LatheGeometry(prof, 6); fus.rotateZ(-Math.PI / 2);
  pushPart(parts, fus, null, st[300], 0);
  const nose = new THREE.ConeGeometry(0.56, 2.5, 6); nose.rotateZ(-Math.PI / 2); nose.translate(6.25, 0, 0);
  pushPart(parts, nose, null, blood[300], 3);
  const wing = new THREE.Shape([[3, 0], [-4.5, 6], [-5.9, 6], [-5.3, 0], [-5.9, -6], [-4.5, -6]].map(([x, y]) => new THREE.Vector2(x, y)));
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.18, bevelEnabled: false }); wg.rotateX(-Math.PI / 2); wg.translate(0, -0.2, 0);
  pushPart(parts, wg, null, st[500], 0);
  // đầu cánh đỏ
  const tip = new THREE.Shape([[-4.1, 5.0], [-4.5, 6], [-5.9, 6], [-5.7, 5.0]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const s of [1, -1]) {
    const tg = new THREE.ExtrudeGeometry(tip, { depth: 0.2, bevelEnabled: false }); tg.rotateX(-Math.PI / 2); tg.translate(0, -0.19, 0);
    if (s < 0) tg.scale(1, 1, -1);
    pushPart(parts, tg, null, blood[300], 3);
  }
  const fin = new THREE.Shape([[-2.6, 0], [-6.1, 0], [-6.7, 3.2], [-5.2, 3.2]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const s of [1, -1]) {
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false }); fg.translate(0, 0.4, -0.07); fg.rotateX(s * 0.32); fg.translate(0, 0, s * 0.9);
    pushPart(parts, fg, null, blood[300], 3);
  }
  const can = new THREE.OctahedronGeometry(1, 0); can.scale(1.9, 0.55, 0.5); can.translate(3.2, 0.75, 0);
  pushPart(parts, can, null, coal[500], 3);
  for (const s of [1, -1]) {
    const sg = new THREE.ShapeGeometry(starShape(1.1)); sg.rotateX(-Math.PI / 2); sg.translate(-2.6, 0.0, s * 3.2);
    pushPart(parts, sg, null, paper[300], 4);
  }
  // lửa đốt sau bậc thang: 2 nón lồng nhau (loại 1 = phát sáng, co giãn trong shader)
  const f1 = new THREE.ConeGeometry(0.75, 3.6, 6); f1.rotateZ(Math.PI / 2); f1.translate(-6.2 - 1.8, 0, 0); pushPart(parts, f1, null, fl[500], 1);
  const f2 = new THREE.ConeGeometry(0.45, 2.3, 6); f2.rotateZ(Math.PI / 2); f2.translate(-6.2 - 1.15, 0, 0); pushPart(parts, f2, null, wh[100], 1);
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  const ig = new THREE.InstancedBufferGeometry();
  for (const k of ['position', 'aCol', 'aK']) ig.setAttribute(k, g.getAttribute(k));
  ig.instanceCount = 3;
  g.dispose();
  return ig;
}
const JET_VERT = /* glsl */ `
${FIG_BASIS}
uniform float uT;
attribute vec3 aCol; attribute float aK;
attribute vec4 aI0; // u, v, w, scale
attribute vec4 aI1; // quaternion (trong hệ bảng)
attribute vec3 aTint;
varying vec3 vCol; varying float vK; varying vec3 vW;
vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main(){
  vec3 p = position;
  if (aK > 0.5 && aK < 1.5) { float x0 = -6.2; float k = 1.0 + 0.35 * sin(uT * 37.0 + aI0.x) + 0.2 * sin(uT * 23.0); p.x = x0 + (p.x - x0) * k; }
  vec3 fp = aI0.xyz + qrot(aI1, p * aI0.w);
  vec3 wp = figWorld(fp);
  float kd = 1.0 - smoothstep(150.0, 210.0, length(cameraPosition - figWorld(aI0.xyz)));
  wp = figWorld(aI0.xyz) + (wp - figWorld(aI0.xyz)) * kd;
  vCol = aK < 0.5 ? aCol * aTint : aCol; vK = aK; vW = wp;
  gl_Position = aI0.w * kd < 0.001 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const jetFrag = () => /* glsl */ `
varying vec3 vCol; varying float vK; varying vec3 vW;
${FACET_GLSL()}
void main(){
  vec3 c = vK > 0.5 && vK < 1.5 ? vCol * 1.15 : (vK > 3.5 ? mix(facet(vCol, vW), vCol, 0.5) : facet(vCol, vW));
  gl_FragColor = vec4(c, 1.0);
}`;

// ───────── Points: khói lục giác (ring buffer) + mưa tia lửa ─────────
const NPUFF = 240, NSPARK = 320;
const PTS_VERT = /* glsl */ `
${FIG_BASIS}
uniform float uT; uniform float uPx; uniform float uA;
attribute vec4 aS; // tSinh, loại (0 khói, 1 tia lửa), hạt giống, cỡ (m)
attribute vec3 aV;  // vận tốc (tia lửa)
varying float vKind; varying float vAge; varying float vAl; varying float vSeed;
void main(){
  float age = uT - aS.x;
  vKind = aS.y; vSeed = aS.z;
  vec3 p = position; float size = aS.w; float al = 0.0;
  if (aS.y < 0.5) {
    float life = 3.4;
    al = (age > 0.0 && age < life) ? (1.0 - age / life) : 0.0;
    size *= 1.0 + age * 0.9;
    p += vec3(0.0, 0.6, 0.0) * age;
  } else {
    float life = 1.8 + aS.z * 1.2;
    al = (age > 0.0 && age < life) ? pow(1.0 - age / life, 0.7) : 0.0;
    p += aV * age + vec3(0.0, -6.5, 0.0) * age * age * 0.5;
    size *= 1.0 - 0.5 * clamp(age / life, 0.0, 1.0);
  }
  vAge = age; vAl = al * uA;
  vec4 mv = viewMatrix * vec4(figWorld(p), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAl < 0.003 ? 0.0 : size * uPx * projectionMatrix[1][1] * 0.5 / max(-mv.z, 1.0);
}`;
const ptsFrag = () => {
  const st = ramp('steel'), em = ramp('ember'), wh = ramp('whitehot'), fl = ramp('flame');
  return /* glsl */ `
varying float vKind; varying float vAge; varying float vAl; varying float vSeed;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y;
  if (vKind < 0.5) {
    // lục giác phẳng 3 mặt: trên sáng (phím lạnh), hai mặt dưới tối, đáy ửng than hồng
    vec2 a = abs(q);
    float hex = max(a.x * 0.866 + a.y * 0.5, a.y);
    if (hex > 0.92) discard;
    float ang = atan(q.y, q.x);
    float face = ang > 0.5236 && ang < 2.618 ? 1.0 : (q.x > 0.0 ? 0.72 : 0.58);
    vec3 c = mix(${gl3(st[300])}, ${gl3(st[700])}, clamp(vAge / 3.0, 0.0, 1.0)) * face;
    c = mix(c, ${gl3(em[300])}, clamp(1.0 - vAge * 1.4, 0.0, 1.0) * 0.8 + step(q.y, -0.45) * 0.25);
    float al = vAl * 0.85;
    gl_FragColor = vec4(c * al, al);
  } else {
    float r = length(q);
    float star = max(1.0 - smoothstep(0.0, 0.18, min(abs(q.x), abs(q.y)) + r * 0.25), 0.0) * step(r, 1.0);
    float core = smoothstep(0.55, 0.0, r);
    vec3 c = mix(${gl3(fl[500])}, ${gl3(wh[100])}, clamp(1.0 - vAge * 0.7, 0.0, 1.0));
    gl_FragColor = vec4(c * (core + star) * vAl, 0.0);
  }
}`;
};

// ───────── Đường bay (toạ độ bảng) ─────────
type V3 = [number, number, number];
const bez = (a: V3, b: V3, c: V3, d: V3, t: number, o: THREE.Vector3) => {
  const m = 1 - t;
  return o.set(
    m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0],
    m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1],
    m * m * m * a[2] + 3 * m * m * t * b[2] + 3 * m * t * t * c[2] + t * t * t * d[2],
  );
};
const DIVE_LEN = DIVE.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - DIVE[i]![0], p[1] - DIVE[i]![1]), 0);
function diveAt(s: number, o: THREE.Vector3) {
  let x = clamp01(s) * DIVE_LEN;
  for (let i = 1; i < DIVE.length; i++) {
    const a = DIVE[i - 1]!, b = DIVE[i]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (x <= l || i === DIVE.length - 1) { const f = Math.min(1, x / l); return o.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 1.5); }
    x -= l;
  }
  return o;
}
const ENTRY: [V3, V3, V3, V3] = [[-170, 70, -140], [-100, 60, -60], [-25, 34, 0], [2, 21, 1.5]];
const TIP_OUT: [V3, V3, V3, V3] = [[-6, -19, 1.5], [-14, -34, 6], [-70, -20, -60], [-330, 120, -380]];
const WING_OFF: V3[] = [[0, 0, 0], [-9, 4.5, -5], [-9, -4.5, 5]];
const WING_OUT: [V3, V3, V3][] = [[[0, 0, 0], [0, 0, 0], [0, 0, 0]], [[0, 0, 0], [60, 90, -150], [330, 150, -380]], [[0, 0, 0], [120, 10, -80], [380, 90, -360]]];

/** Vị trí máy bay i lúc t (toạ độ bảng). */
function jetPos(i: number, t: number, o: THREE.Vector3): THREE.Vector3 {
  if (t <= T_BREAK) {
    bez(...ENTRY, clamp01(t / T_BREAK), o);
    const w = WING_OFF[i]!;
    return o.set(o.x + w[0], o.y + w[1], o.z + w[2]);
  }
  if (i === 0) {
    if (t <= T_TIP) return diveAt((t - T_BREAK) / (T_TIP - T_BREAK), o);
    const e = (t - T_TIP) / 7;
    return bez(...TIP_OUT, Math.pow(clamp01(e), 1.6), o);
  }
  const w = WING_OFF[i]!, P = ENTRY[3]!, c = WING_OUT[i]!;
  const e = clamp01((t - T_BREAK) / 8);
  return bez([P[0] + w[0], P[1] + w[1], P[2] + w[2]], [P[0] + w[0] + 25, P[1] + w[1] * 2 - 8, P[2] + w[2]], c[1], c[2], Math.pow(e, 1.4), o);
}

export function createSteelJet(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const uC = { value: BOLT_CENTER.clone() };

  // ── quad tia sét
  const tex = buildBoltTex();
  const qGeo = new THREE.PlaneGeometry(BOX.u1 - BOX.u0, BOX.v1 - BOX.v0);
  qGeo.translate((BOX.u0 + BOX.u1) / 2, (BOX.v0 + BOX.v1) / 2, 0);
  const qU = {
    uC, uTex: { value: tex }, uBox: { value: new THREE.Vector4(BOX.u0, BOX.v0, BOX.u1 - BOX.u0, BOX.v1 - BOX.v0) },
    uHead: { value: 40 }, uFlash: { value: 0 }, uGlow: { value: 0 }, uA: { value: 1 }, uT: { value: 0 }, uCrackle: { value: 0 },
  };
  const quad = new THREE.Mesh(qGeo, new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: quadFrag(), uniforms: qU, transparent: true, premultipliedAlpha: true,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  quad.frustumCulled = false; quad.renderOrder = 5;
  root.add(quad);

  // ── máy bay
  const jGeo = buildJetGeo();
  const aI0 = new THREE.InstancedBufferAttribute(new Float32Array(12), 4), aI1 = new THREE.InstancedBufferAttribute(new Float32Array(12), 4);
  aI0.setUsage(THREE.DynamicDrawUsage); aI1.setUsage(THREE.DynamicDrawUsage);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1, 0.38, 0.38, 0.4, 0.75, 0.78, 0.84]), 3);
  jGeo.setAttribute('aI0', aI0); jGeo.setAttribute('aI1', aI1); jGeo.setAttribute('aTint', tint);
  const jU = { uC, uT: { value: 0 } };
  const jets = new THREE.Mesh(jGeo, new THREE.ShaderMaterial({ vertexShader: JET_VERT, fragmentShader: jetFrag(), uniforms: jU, fog: false, side: THREE.DoubleSide }));
  jets.frustumCulled = false; jets.renderOrder = 7;
  root.add(jets);

  // ── khói + tia lửa
  const N = NPUFF + NSPARK, rnd = seededRnd(77);
  const pos = new Float32Array(N * 3), aS = new Float32Array(N * 4), aV = new Float32Array(N * 3);
  for (let i = 0; i < NPUFF; i++) aS.set([-99, 0, rnd(), 2.2], i * 4);
  for (let k = 0; k < NSPARK; k++) {
    const i = NPUFF + k, e = Math.floor(rnd() * BOLT.length), a = BOLT[e]!, b = BOLT[(e + 1) % BOLT.length]!, f = rnd();
    pos.set([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.5], i * 3);
    const ang = rnd() * Math.PI * 2, sp = 3 + rnd() * 9;
    aV.set([Math.cos(ang) * sp, Math.sin(ang) * sp * 0.7 + 2, (rnd() - 0.5) * 4], i * 3);
    aS.set([T_TIP + rnd() * 1.6, 1, rnd(), 0.5 + rnd() * 0.5], i * 4);
  }
  const pGeo = new THREE.BufferGeometry();
  const pPos = new THREE.BufferAttribute(pos, 3), pS = new THREE.BufferAttribute(aS, 4);
  pPos.setUsage(THREE.DynamicDrawUsage); pS.setUsage(THREE.DynamicDrawUsage);
  pGeo.setAttribute('position', pPos); pGeo.setAttribute('aS', pS); pGeo.setAttribute('aV', new THREE.BufferAttribute(aV, 3));
  const pU = { uC, uT: { value: 0 }, uPx: { value: 720 }, uA: { value: 1 } };
  const pts = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    vertexShader: PTS_VERT, fragmentShader: ptsFrag(), uniforms: pU, transparent: true, premultipliedAlpha: true, depthWrite: false, fog: false,
  }));
  pts.frustumCulled = false; pts.renderOrder = 6;
  root.add(pts);

  // ── chữ ký: vòng tia lửa quanh chiếc dẫn đầu
  const ring = createFireRing({ uC });
  root.add(ring.mesh);

  const a = new THREE.Vector3(), b = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const up = new THREE.Vector3(), side = new THREE.Vector3(), roll = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
  const FB = figBasis(BOLT_CENTER, FOCUS_CAM);
  let puffHead = 0, lastPuff = 0;
  const hidden = [false, false, false];

  return {
    duration: D,
    start() { root.visible = true; puffHead = 0; lastPuff = 0; hidden.fill(false); for (let i = 0; i < NPUFF; i++) aS[i * 4] = -99; pS.needsUpdate = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      void f;
      qU.uT.value = Math.max(0, t - T_TIP);
      jU.uT.value = pU.uT.value = ring.u.uT.value = t;
      pU.uPx.value = pxScale();
      // tia sét lộ dần theo chiếc dẫn đầu
      if (t < T_BREAK) qU.uHead.value = 40;
      else if (t < T_TIP) { diveAt((t - T_BREAK) / (T_TIP - T_BREAK), a); qU.uHead.value = a.y - 0.5; }
      else qU.uHead.value = -40;
      // 3 chớp trong 1 s (≤ 3 lần/giây) rồi rực đều
      let fl = 0;
      for (let k = 0; k < 3; k++) { const dt = t - (T_TIP + k / 3); if (dt >= 0) fl = Math.max(fl, Math.exp(-dt * 9) * (1 - k * 0.2)); }
      qU.uFlash.value = t < T_FLASH_END + 0.3 ? fl : 0;
      qU.uGlow.value = sm(T_BREAK, T_TIP, t) * (1 + 0.12 * Math.sin(t * 2.4));
      qU.uCrackle.value = sm(T_TIP, T_TIP + 0.2, t) * (1 - sm(T_CRACKLE_END - 0.6, T_CRACKLE_END, t));
      qU.uA.value = 1 - sm(T_HOLD, T_FADE, t);
      pU.uA.value = 1 - sm(T_FADE - 1, T_FADE + 1, t);
      // máy bay
      const A0 = aI0.array as Float32Array, A1 = aI1.array as Float32Array;
      const emit = t - lastPuff > 0.07;
      for (let i = 0; i < 3; i++) {
        jetPos(i, t, a); jetPos(i, t + 0.05, b);
        const dir = b.sub(a);
        if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
        dir.normalize();
        if (!hidden[i] && a.length() > EXIT_R) hidden[i] = true;
        side.crossVectors(dir, new THREE.Vector3(0, 1, 0));
        if (side.lengthSq() < 1e-4) side.set(0, 0, 1);
        side.normalize();
        up.crossVectors(side, dir).normalize();
        m4.makeBasis(dir, up, side);
        q.setFromRotationMatrix(m4);
        const bank = i === 0 ? (t > T_BREAK && t < T_TIP ? Math.sin(t * 2.0) * 0.3 : -0.25) : (t > T_BREAK ? (i === 1 ? -0.9 : 0.9) * sm(T_BREAK, T_BREAK + 1, t) : 0.15 * (i === 1 ? -1 : 1));
        roll.setFromAxisAngle(X, bank); q.multiply(roll);
        A0.set([a.x, a.y, a.z, hidden[i] ? 0 : 1], i * 4);
        A1.set([q.x, q.y, q.z, q.w], i * 4);
        // khói: lục giác sau đuôi (không thả khi chiếc dẫn đầu đang vẽ tia sét)
        if (emit && !hidden[i] && t < 14 && !(i === 0 && t > T_BREAK && t < T_TIP + 0.3)) {
          const k = puffHead++ % NPUFF;
          pos.set([a.x - dir.x * 7, a.y - dir.y * 7, a.z - dir.z * 7], k * 3);
          aS.set([t, 0, Math.random(), 1.6 + Math.random() * 1.2], k * 4);
          pPos.addUpdateRange(k * 3, 3); pS.addUpdateRange(k * 4, 4);
          pPos.needsUpdate = pS.needsUpdate = true;
        }
      }
      if (emit) lastPuff = t;
      aI0.needsUpdate = aI1.needsUpdate = true;
      jetPos(0, t, a);
      ring.u.uAt.value.copy(a);
      ring.u.uR.value = 7.5;
      ring.u.uA.value = sm(0.3, 1.2, t) * (1 - sm(T_TIP + 1.5, T_TIP + 3, t));
    },
    focus(t: number, out: THREE.Vector3) {
      out.copy(BOLT_CENTER);
      if (t < T_TIP + 1.5) {
        jetPos(0, t, a);
        const w = (t < T_BREAK ? 0.45 : 0.3) * (1 - sm(T_TIP - 0.5, T_TIP + 1.5, t));
        out.addScaledVector(FB.ex, a.x * w).addScaledVector(FB.ey, a.y * w).addScaledVector(FB.f, a.z * w);
      }
    },
    dispose() {
      tex.dispose();
      ring.dispose();
      disposeTree(root);
    },
  };
}

export const builders: Partial<OutsideBuilders> = { secretJet: createSteelJet };
