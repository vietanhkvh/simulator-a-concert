// "Thép & Lửa" · khe secretRocket (S5, STYLE_C §5): "TÊN LỬA THÉP" + THÁC LỬA.
// Tên lửa thép đẽo mặt phẳng (dài ≈ 4 × đường kính, đai đinh tán, mũi + 3 vây đỏ, sao stencil trắng, 3 loa động cơ lộ)
// phóng từ NGOÀI SÂN (sau khán đài xa, z ≈ −150) như mặc định, lửa bậc thang khối + khói lục giác than chì, cong về
// điểm nổ trên mép xa sân cỏ (0, 40, −64) — như gói lacquer, KHÔNG dùng tâm mặc định (0, 50, −30): mái sân khấu che mọi
// thứ cao hơn ~41° từ mắt ca sĩ; điểm này ≈ 31° và cách máy toàn cảnh ~51 m. Nổ thành màn kết rock show: THÁC LỬA (màn
// tia lửa trắng nóng → cam rơi như thác pyro treo trên trời), sao 4 cánh trắng sắc, vòng xung kích đồng tâm (3 vòng /
// 1 s ⇒ ≤ 3 loé/giây) và ngôi sao stencil lớn. Mọi phần màn kết nằm trên bảng quay về camera (FIG_BASIS).
// Draw call khi chạy: tên lửa + Points (khói + tia lửa + sao) + quad (vòng + sao stencil) + vòng tia lửa chữ ký = 4.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../../../core/types';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { groundY, pxScale, seededRnd, smooth } from '../../secretShared';
import { FACET_GLSL, FIG_BASIS, createFireRing, gl3, pushPart, ramp, starShape } from './bannerKit';

const D = 22;
const T_IGN = 2.5, T_BURST = 9.5;
/** Điểm nổ (world). */
export const BURST = new THREE.Vector3(0, 40, -64);
const PAD_Z = -150;
const P0 = new THREE.Vector3(0, 0, PAD_Z), PC = new THREE.Vector3(0, 52, -122);
/** Thân: bán kính, chiều dài thân trụ, mũi. */
const R = 1.6, BODY = 9.6, NOSE = 3.2;

const sOf = (t: number) => { const u = Math.min(1, Math.max(0, (t - T_IGN) / (T_BURST - T_IGN))); return u * u * (1.6 - 0.6 * u); };
function bez(s: number, o: THREE.Vector3) {
  const m = 1 - s;
  return o.set(0, 0, 0).addScaledVector(P0, m * m).addScaledVector(PC, 2 * m * s).addScaledVector(BURST, s * s);
}
function bezT(s: number, o: THREE.Vector3) {
  return o.set(0, 0, 0).addScaledVector(PC.clone().sub(P0), 2 * (1 - s)).addScaledVector(BURST.clone().sub(PC), 2 * s).normalize();
}

function buildRocket(): THREE.BufferGeometry {
  const st = ramp('steel'), blood = ramp('blood'), paper = ramp('paper'), coal = ramp('coal'), fl = ramp('flame'), wh = ramp('whitehot');
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.CylinderGeometry(R, R, BODY, 8, 1, true); body.translate(0, BODY / 2, 0); pushPart(parts, body, null, st[300], 0);
  const nose = new THREE.ConeGeometry(R, NOSE, 8); nose.translate(0, BODY + NOSE / 2, 0); pushPart(parts, nose, null, blood[300], 3);
  for (const y of [0.35, 3.4, 6.6, BODY - 0.2]) {
    const band = new THREE.CylinderGeometry(R * 1.07, R * 1.07, 0.45, 8); band.translate(0, y, 0); pushPart(parts, band, null, st[700], 2);
  }
  const fin = new THREE.Shape([[R * 0.9, 0], [R * 0.9, 4.2], [R + 2.6, 0.2], [R + 2.6, -1.4]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (let k = 0; k < 3; k++) {
    const g = new THREE.ExtrudeGeometry(fin, { depth: 0.22, bevelEnabled: false }); g.translate(0, 0, -0.11); g.rotateY((k * Math.PI * 2) / 3 + Math.PI / 6);
    pushPart(parts, g, null, blood[300], 3);
  }
  for (const s of [1, -1]) {
    const sg = new THREE.ShapeGeometry(starShape(1.05)); if (s < 0) sg.rotateY(Math.PI); sg.translate(0, 5.0, s * (R * 0.93 + 0.08)); pushPart(parts, sg, null, paper[300], 4);
    const stripe = new THREE.PlaneGeometry(0.5, 2.2); if (s < 0) stripe.rotateY(Math.PI); stripe.translate(0, 8.0, s * (R * 0.93 + 0.08)); pushPart(parts, stripe, null, paper[300], 4);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3, x = Math.cos(a) * 0.75, z = Math.sin(a) * 0.75;
    const bell = new THREE.CylinderGeometry(0.35, 0.7, 1.1, 6, 1, true); bell.translate(x, -0.55, z); pushPart(parts, bell, null, coal[300], 2);
  }
  // lửa bậc thang khối: 3 nón 6 cạnh lồng nhau (loại 1 = phát sáng, co giãn trong shader)
  const f1 = new THREE.ConeGeometry(1.5, 7, 6); f1.rotateX(Math.PI); f1.translate(0, -1.1 - 3.5, 0); pushPart(parts, f1, null, ramp('ember')[300], 1);
  const f2 = new THREE.ConeGeometry(1.05, 4.6, 6); f2.rotateX(Math.PI); f2.translate(0, -1.1 - 2.3, 0); pushPart(parts, f2, null, fl[500], 1);
  const f3 = new THREE.ConeGeometry(0.6, 2.4, 6); f3.rotateX(Math.PI); f3.translate(0, -1.1 - 1.2, 0); pushPart(parts, f3, null, wh[100], 1);
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  g.translate(0, -BODY / 2, 0);
  return g;
}
const ROCKET_VERT = /* glsl */ `
uniform float uT; uniform float uFire;
attribute vec3 aCol; attribute float aK;
varying vec3 vCol; varying float vK; varying vec3 vW;
void main(){
  vec3 p = position;
  if (aK > 0.5 && aK < 1.5) {
    float y0 = -${(BODY / 2 + 1.1).toFixed(2)};
    float k = uFire * (1.0 + 0.3 * sin(uT * 41.0) + 0.15 * sin(uT * 27.0 + p.x));
    p.y = y0 + (p.y - y0) * max(k, 0.001); p.xz *= max(uFire, 0.001);
  }
  vCol = aCol; vK = aK;
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const rocketFrag = () => /* glsl */ `
varying vec3 vCol; varying float vK; varying vec3 vW;
${FACET_GLSL()}
void main(){
  vec3 c;
  if (vK > 0.5 && vK < 1.5) c = vCol * 1.2;
  else if (vK > 3.5) c = mix(facet(vCol, vW), vCol, 0.5);
  else c = facet(vCol, vW);
  gl_FragColor = vec4(c, 1.0);
}`;

const NSMOKE = 220, NFALL = 2000, NBURST = 360, NSTAR = 26;
const PTS_VERT = /* glsl */ `
${FIG_BASIS}
uniform float uT; uniform float uPx;
uniform vec3 uP0; uniform vec3 uPC; uniform vec3 uP1;
attribute vec4 aS; // kind, tSinh, hạt giống, cỡ (m)
attribute vec3 aV;  // khói: lệch; tia lửa: vận tốc (u, v, w); thác: (u, tốc rơi, đời)
varying float vKind; varying float vAge; varying float vAl; varying float vK;
vec3 bez(float s){ float m = 1.0 - s; return m * m * uP0 + 2.0 * m * s * uPC + s * s * uP1; }
vec3 bezT(float s){ return normalize(2.0 * (1.0 - s) * (uPC - uP0) + 2.0 * s * (uP1 - uPC)); }
float sOf(float t){ float u = clamp((t - ${T_IGN.toFixed(2)}) / ${(T_BURST - T_IGN).toFixed(2)}, 0.0, 1.0); return u * u * (1.6 - 0.6 * u); }
void main(){
  float kind = aS.x, te = aS.y, age = uT - te;
  vKind = kind; vAge = age;
  vec3 wp; float size = aS.w; float al = 0.0; vK = 0.0;
  if (kind < 0.5) {
    float s = sOf(te);
    wp = bez(s) - bezT(s) * 7.0 + aV * (1.0 - exp(-max(age, 0.0) * 0.8)) * 5.0 + vec3(0.6, 1.2, 0.0) * max(age, 0.0);
    float life = 5.0;
    al = (age > 0.0 && age < life) ? (1.0 - age / life) * 0.9 : 0.0;
    size *= 1.0 + max(age, 0.0) * 0.6;
    vK = clamp(age, 0.0, 1.0);
  } else {
    vec3 p;
    if (kind < 1.5) {
      // thác lửa: rơi thẳng chậm, lắc nhẹ; trắng nóng → cam → than hồng
      float life = aV.z;
      p = vec3(aV.x + sin(age * 3.0 + aS.z * 20.0) * 0.25, 11.0 - aV.y * age - 0.7 * age * age, 0.0);
      al = (age > 0.0 && age < life) ? smoothstep(0.0, 0.15, age) * (1.0 - age / life) : 0.0;
      vK = age / life;
    } else if (kind < 2.5) {
      float life = 2.6 + aS.z;
      vec3 v = aV;
      float r = 1.0 - exp(-max(age, 0.0) * 2.2);
      p = v * r / 2.2 * 2.2 + vec3(0.0, -3.0, 0.0) * age * age * 0.5;
      al = (age > 0.0 && age < life) ? pow(1.0 - age / life, 0.8) : 0.0;
      vK = age / life;
    } else {
      // sao 4 cánh: nháy chậm (≤ 3 lần/giây)
      float life = 6.0;
      p = aV;
      float tw = 0.55 + 0.45 * sin(age * 6.0 + aS.z * 30.0);
      al = (age > 0.0 && age < life) ? smoothstep(0.0, 0.25, age) * (1.0 - smoothstep(life - 1.5, life, age)) * tw : 0.0;
    }
    wp = figWorld(p);
  }
  vAl = al;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = al < 0.003 ? 0.0 : size * uPx * projectionMatrix[1][1] * 0.5 / max(-mv.z, 1.0);
}`;
const ptsFrag = () => {
  const st = ramp('steel'), coal = ramp('coal'), em = ramp('ember'), wh = ramp('whitehot'), fl = ramp('flame'), paper = ramp('paper');
  return /* glsl */ `
varying float vKind; varying float vAge; varying float vAl; varying float vK;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y;
  if (vKind < 0.5) {
    vec2 a = abs(q);
    if (max(a.x * 0.866 + a.y * 0.5, a.y) > 0.92) discard;
    float ang = atan(q.y, q.x);
    float face = ang > 0.5236 && ang < 2.618 ? 1.0 : (q.x > 0.0 ? 0.7 : 0.55);
    vec3 c = mix(${gl3(st[500])}, ${gl3(coal[100])}, vK) * face;
    c = mix(c, ${gl3(em[300])}, (1.0 - vK) * 0.6 + step(q.y, -0.45) * 0.2);
    float al = vAl * 0.9;
    gl_FragColor = vec4(c * al, al);
  } else if (vKind < 2.5) {
    float r = vKind < 1.5 ? length(q * vec2(2.6, 0.75)) : length(q);
    float core = smoothstep(1.0, 0.0, r); core *= core;
    vec3 c = mix(${gl3(wh[100])}, ${gl3(fl[500])}, smoothstep(0.1, 0.55, vK));
    c = mix(c, ${gl3(em[500])}, smoothstep(0.55, 1.0, vK));
    gl_FragColor = vec4(c * core * vAl * (vKind < 1.5 ? 2.0 : 1.4), 0.0);
  } else {
    vec2 a = abs(q);
    float star = max(0.0, 1.0 - (a.x * a.y * 30.0 + max(a.x, a.y) * 0.9));
    star = smoothstep(0.0, 0.25, star) + smoothstep(0.35, 0.0, length(q)) * 0.6;
    gl_FragColor = vec4(mix(${gl3(paper[100])}, ${gl3(wh[300])}, 0.3) * star * vAl, 0.0);
  }
}`;
};

const QUAD_VERT = /* glsl */ `
${FIG_BASIS}
varying vec2 vP;
void main(){ vP = position.xy; gl_Position = projectionMatrix * viewMatrix * vec4(figWorld(vec3(position.xy, -0.5)), 1.0); }`;
const quadFrag = () => {
  const wh = ramp('whitehot'), fl = ramp('flame'), em = ramp('ember'), paper = ramp('paper');
  return /* glsl */ `
uniform float uE; // giây kể từ lúc nổ
varying vec2 vP;
float sdStar5(vec2 p, float r, float rf){
  const vec2 k1 = vec2(0.809016994375, -0.587785252292); const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x); p -= 2.0 * max(dot(k1, p), 0.0) * k1; p -= 2.0 * max(dot(k2, p), 0.0) * k2; p.x = abs(p.x);
  p.y -= r; vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1); float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
void main(){
  if (uE < 0.0) discard;
  float r = length(vP);
  vec3 col = vec3(0.0);
  // 3 vòng xung kích (0 · 0,33 · 0,67 s), nở nhanh rồi chậm
  for (int i = 0; i < 3; i++) {
    float e = uE - float(i) * 0.333;
    if (e < 0.0) continue;
    float R = 26.0 * (1.0 - exp(-e * 2.2)) + float(i) * 3.0;
    float w = 0.35 + e * 0.25;
    float a = exp(-pow((r - R) / w, 2.0)) * exp(-e * 1.1);
    col += mix(${gl3(wh[100])}, ${gl3(fl[500])}, clamp(e * 0.8, 0.0, 1.0)) * a * 1.2;
  }
  // loé lõi (một lần) + quầng
  col += ${gl3(wh[300])} * exp(-r * 0.25) * exp(-uE * 5.0) * 1.4;
  // ngôi sao stencil lớn: viền dày, khe cầu nối ở 5 cánh
  float d = sdStar5(vP * vec2(1.0, 1.0) - vec2(0.0, 1.0), 13.0, 0.45);
  float edge = 1.0 - smoothstep(0.7, 0.9, abs(d + 0.8));
  float ang = atan(vP.y - 1.0, vP.x);
  float gap = step(0.06, abs(fract((ang + 1.5708) / 1.2566 + 0.5) - 0.5));
  float sa = smoothstep(0.15, 0.6, uE) * (1.0 - smoothstep(5.0, 7.0, uE));
  vec3 sc = mix(${gl3(paper[300])}, ${gl3(fl[300])}, smoothstep(1.0, 5.0, uE));
  col += sc * edge * gap * sa * 1.1 + ${gl3(em[300])} * exp(-abs(d) * 0.6) * 0.12 * sa;
  if (dot(col, vec3(1.0)) < 0.003) discard;
  gl_FragColor = vec4(col, 1.0);
}`;
};

export function createSteelRocket(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  P0.y = groundY(PAD_Z) + BODY / 2 + 1.5;
  const uC = { value: BURST.clone() };

  const rGeo = buildRocket();
  const rU = { uT: { value: 0 }, uFire: { value: 0 } };
  const rocket = new THREE.Mesh(rGeo, new THREE.ShaderMaterial({ vertexShader: ROCKET_VERT, fragmentShader: rocketFrag(), uniforms: rU, fog: false, side: THREE.DoubleSide }));
  rocket.frustumCulled = false;
  root.add(rocket);

  // Points
  const rnd = seededRnd(808);
  const N = NSMOKE + NFALL + NBURST + NSTAR;
  const aS = new Float32Array(N * 4), aV = new Float32Array(N * 3);
  let k = 0;
  for (let i = 0; i < NSMOKE; i++, k++) {
    aS.set([0, T_IGN + (i / NSMOKE) * (T_BURST - T_IGN - 0.2), rnd(), 2.2 + rnd() * 1.8], k * 4);
    aV.set([(rnd() - 0.5) * 1.6, rnd() * 0.6, (rnd() - 0.5) * 1.6], k * 3);
  }
  const tb = T_BURST;
  for (let i = 0; i < NFALL; i++, k++) {
    const u = (rnd() * 2 - 1) * 30 * (0.75 + 0.25 * rnd());
    aS.set([1, tb + 0.4 + rnd() * 6.5 + Math.abs(u) * 0.012, rnd(), 1.0 + rnd() * 0.6], k * 4);
    aV.set([u, 2.2 + rnd() * 2.0, 3.0 + rnd() * 1.8], k * 3);
  }
  for (let i = 0; i < NBURST; i++, k++) {
    const a = rnd() * Math.PI * 2, sp = 18 + rnd() * 10;
    aS.set([2, tb + (i % 3) * 0.04, rnd(), 0.6 + rnd() * 0.5], k * 4);
    aV.set([Math.cos(a) * sp, Math.sin(a) * sp, (rnd() - 0.5) * 6], k * 3);
  }
  for (let i = 0; i < NSTAR; i++, k++) {
    const a = rnd() * Math.PI * 2, rr = 10 + rnd() * 24;
    aS.set([3, tb + 0.3 + rnd() * 2.5, rnd(), 2.6 + rnd() * 2.4], k * 4);
    aV.set([Math.cos(a) * rr, Math.sin(a) * rr * 0.75 + 2, 1], k * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  pGeo.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  pGeo.setAttribute('aV', new THREE.BufferAttribute(aV, 3));
  const pU = { uC, uT: { value: 0 }, uPx: { value: 720 }, uP0: { value: P0 }, uPC: { value: PC }, uP1: { value: BURST } };
  const pts = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    vertexShader: PTS_VERT, fragmentShader: ptsFrag(), uniforms: pU, transparent: true, premultipliedAlpha: true, depthWrite: false, fog: false,
  }));
  pts.frustumCulled = false; pts.renderOrder = 4;
  root.add(pts);

  const qU = { uC, uE: { value: -1 } };
  const qGeo = new THREE.PlaneGeometry(64, 64);
  const quad = new THREE.Mesh(qGeo, new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: quadFrag(), uniforms: qU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, fog: false,
  }));
  quad.frustumCulled = false; quad.renderOrder = 3;
  root.add(quad);

  const ring = createFireRing(null);
  root.add(ring.mesh);

  const p = new THREE.Vector3(), tg = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      void f;
      rU.uT.value = pU.uT.value = ring.u.uT.value = t;
      pU.uPx.value = pxScale();
      const s = sOf(t);
      bez(s, p); bezT(s, tg);
      // trước khi đánh lửa: dựng đứng trên bệ, trồi lên dần
      if (t < T_IGN) { p.copy(P0); p.y -= (1 - smooth(0, 1.5, t)) * 14; tg.copy(Y); }
      rocket.position.copy(p);
      rocket.quaternion.setFromUnitVectors(Y, tg);
      rocket.rotateY(t * 0.6);
      rocket.visible = t < T_BURST;
      rU.uFire.value = smooth(T_IGN - 0.4, T_IGN + 0.3, t) * (1 + 0.15 * smooth(T_IGN, T_IGN + 1, t));
      qU.uE.value = t >= T_BURST ? t - T_BURST : -1;
      ring.u.uAt.value.copy(p);
      ring.u.uR.value = 7;
      ring.u.uA.value = smooth(T_IGN, T_IGN + 0.8, t) * (1 - smooth(T_BURST - 0.6, T_BURST, t));
    },
    focus(t: number, out: THREE.Vector3) {
      if (t >= T_BURST - 0.5) { out.copy(BURST); return; }
      bez(sOf(t), out);
      out.lerp(BURST, 0.35);
    },
    dispose() {
      ring.dispose();
      root.removeFromParent();
      rGeo.dispose(); (rocket.material as THREE.Material).dispose();
      pGeo.dispose(); (pts.material as THREE.Material).dispose();
      qGeo.dispose(); (quad.material as THREE.Material).dispose();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { secretRocket: createSteelRocket };
