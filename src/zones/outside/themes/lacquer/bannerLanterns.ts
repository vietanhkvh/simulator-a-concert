// "Mực & Sơn mài · bản Việt" · khe bannerCarriers (L6): SÁU ĐÈN LỒNG HỘI AN mang LIỄN DỌC thay khinh khí cầu.
// Cùng vòng cung với khinh khí cầu (r 140–172 m sau khán đài xa, ±40° quanh hướng nhìn ca sĩ); độ cao tính sao cho
// mép dưới liễn nằm trên đường ngắm mắt ca sĩ → mép trên khán đài (+3 m) và đèn vẫn trong khung FOV 70.
// Đèn: lathe 12 múi phồng (nan tre = vạch trong shader), lụa son / ngọc / chàm / vàng / hồng sen / cam, sen vàng hai mặt,
// chóp + đế vàng, thanh treo vàng + hai tua son; ánh sáng ấm bên trong đập nhẹ theo phách. Liễn: lụa son viền vàng kép,
// khẩu hiệu viết từ trên xuống (mỗi từ một dòng, 1–2 cột), đọc xuôi cả hai mặt. setCheerBanners() → vẽ lại atlas.
// 2 draw call: thân đèn (gộp) + liễn (CanvasTexture atlas). Bập bềnh chung `bob()` của balloonKit (đèn + liễn đi cùng).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EYE_HEIGHT, STADIUM_CENTRE, STANDS_R_OUTER, STANDS_TOP_Y } from '../../../../world/layout';
import { mixHex } from '../../../../world/style';
import { getCheerTexts, onCheerChange } from '../../balloons';
import { BANNER_FRAG, BOB_GLSL, bannerVert, pushBanner } from '../../balloonKit';
import type { BannerCarriersHandle, OutsideBuildContext, OutsideBuilders } from '../../builders';
import { drawLien, gl3, ramp, rgb3 } from './bannerKit';

/** Kích thước liễn (m) và ô atlas (px). */
export const LIEN_W = 27, LIEN_H = 29;
const CELL_W = 512, CELL_H = Math.round(CELL_W * LIEN_H / LIEN_W);
/** Thân đèn (m): bán kính lớn nhất, nửa chiều cao thân, cao chóp/đế. */
const R = 6, HH = 4.8, CAP = 1.3;
const ARC = [
  { deg: -40, r: 172 }, { deg: -24.5, r: 150 }, { deg: -8.6, r: 140 }, { deg: 8.6, r: 140 }, { deg: 24.5, r: 150 }, { deg: 40, r: 172 },
];

/** Vị trí tâm thân đèn i + độ cao mép trên liễn (thế giới). */
export function lanternPlacement(deg: number, r: number) {
  const a = THREE.MathUtils.degToRad(deg);
  const x = STADIUM_CENTRE.x + Math.sin(a) * r, z = STADIUM_CENTRE.z - Math.cos(a) * r;
  const d = Math.hypot(x, z);
  const slope = (STANDS_TOP_Y - EYE_HEIGHT) / (STANDS_R_OUTER - STADIUM_CENTRE.z);
  const bottom = EYE_HEIGHT + d * slope + 1.5;
  const top = bottom + LIEN_H;
  const centreY = top + 1.2 + CAP + HH;
  return { pos: new THREE.Vector3(x, centreY, z), lienTop: top - centreY };
}

/** Màu lụa 6 đèn (đọc ramp lúc gọi). */
const SILK = (): number[] => {
  const son = ramp('son'), jade = ramp('jade'), ind = ramp('indigo'), gold = ramp('gold'), amb = ramp('amber');
  return [son[500], jade[500], ind[500], gold[500], mixHex(son[300], son[100], 0.45), amb[500]];
};

type Part = THREE.BufferGeometry;
function push(out: Part[], g: THREE.BufferGeometry, m: THREE.Matrix4, id: number, kind: number, col: number) {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
  if (!ng.attributes.normal) ng.computeVertexNormals();
  ng.applyMatrix4(m);
  const n = ng.attributes.position.count;
  const c = rgb3(col), info = new Float32Array(n * 2), cc = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { info[i * 2] = id; info[i * 2 + 1] = kind; cc.set(c, i * 3); }
  ng.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
  ng.setAttribute('aCol', new THREE.BufferAttribute(cc, 3));
  for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv', 'aInfo', 'aCol'].includes(k)) ng.deleteAttribute(k);
  out.push(ng);
}

/** Trụ mảnh nối a → b. */
export function seg(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

function bodyProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const r0 = 2.0;
  for (let i = 0; i <= 24; i++) {
    const y = -HH + (2 * HH * i) / 24;
    const k = Math.sqrt(Math.max(0, 1 - (y / HH) ** 2));
    pts.push(new THREE.Vector2(r0 + (R - r0) * Math.pow(k, 0.75), y));
  }
  return pts;
}

const VERT = /* glsl */ `
uniform float uTime;
attribute vec2 aInfo; attribute vec3 aCol;
varying vec2 vUv; varying vec3 vCol; varying float vKind; varying vec3 vN; varying vec3 vV;
${BOB_GLSL}
void main(){
  vUv = uv; vCol = aCol; vKind = aInfo.y;
  vec3 p = position + bob(aInfo.x, uTime);
  vN = normalize(normal);
  vV = normalize(cameraPosition - p);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const frag = () => {
  const gold = ramp('gold'), lac = ramp('lacquer'), amb = ramp('amber'), son = ramp('son');
  return /* glsl */ `
uniform float uTime; uniform float uPulse; uniform float uHype;
varying vec2 vUv; varying vec3 vCol; varying float vKind; varying vec3 vN; varying vec3 vV;
vec3 flat2(vec3 c, vec3 n){
  float d = dot(normalize(n), normalize(vec3(-0.4, 0.75, 0.55)));
  vec3 sh = mix(c * 0.62, ${gl3(lac[500])}, 0.18);
  return mix(sh, c, smoothstep(-0.1, 0.0, d));
}
float petal(vec2 p, vec2 base, float ang, float len, float wid){
  float c = cos(ang), s = sin(ang);
  vec2 q = p - base; q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  q.y -= len * 0.5;
  // lá nhọn: elip thu hẹp về đỉnh
  float w = wid * (1.0 - 0.75 * smoothstep(-len * 0.1, len * 0.5, q.y));
  return length(vec2(q.x / max(w, 0.05), q.y / (len * 0.5))) - 1.0;
}
float lotus(vec2 p){
  vec2 b = vec2(0.0, -1.6);
  float d = petal(p, b, 0.0, 3.4, 0.95);
  d = min(d, petal(p, b, 0.55, 3.0, 0.8));
  d = min(d, petal(p, b, -0.55, 3.0, 0.8));
  d = min(d, petal(p, b, 1.15, 2.4, 0.65));
  d = min(d, petal(p, b, -1.15, 2.4, 0.65));
  return d;
}
void main(){
  vec3 c;
  if (vKind < 0.5) {
    float u = vUv.x, v = vUv.y;
    vec3 base = vCol;
    // múi lụa: tối nhẹ ở hai mép múi
    float g = fract(u * 12.0);
    base *= 0.9 + 0.1 * smoothstep(0.0, 0.3, min(g, 1.0 - g));
    c = flat2(base, vN);
    // ánh sáng ấm bên trong (lụa xuyên sáng), đập nhẹ theo phách
    float ndv = abs(dot(normalize(vN), vV));
    float glow = pow(ndv, 1.6) * (0.55 + 0.25 * uPulse + 0.15 * uHype) * (1.0 - pow(abs(v - 0.5) * 2.0, 3.0));
    c = mix(c, c * 1.35 + ${gl3(amb[300])} * 0.35, glow);
    // nan tre: vạch mảnh ở đường nối múi
    float rib = smoothstep(0.035, 0.012, min(g, 1.0 - g));
    c = mix(c, ${gl3(mixHex(gold[700], lac[300], 0.4))}, rib * 0.85);
    // dải vàng gần chóp và đế
    float band = smoothstep(0.012, 0.0, abs(v - 0.13) - 0.012) + smoothstep(0.012, 0.0, abs(v - 0.87) - 0.012);
    c = mix(c, ${gl3(gold[500])}, clamp(band, 0.0, 1.0));
    // sen vàng hai mặt (u≈0 trước, u≈0.5 sau)
    float du0 = fract(u + 0.5) - 0.5, du1 = fract(u) - 0.5;
    float du = abs(du0) < abs(du1) ? du0 : du1;
    vec2 q = vec2(du * 6.2832 * ${R.toFixed(1)}, (v - 0.5) * ${(2 * HH).toFixed(1)}) * 0.95;
    float dl = lotus(q);
    float bowl = abs(length(q - vec2(0.0, 2.2)) - 4.0) - 0.22;
    bowl = max(bowl, q.y + 1.3); bowl = max(bowl, abs(q.x) - 2.4);
    float d = min(dl, bowl * 1.6);
    c = mix(c, ${gl3(gold[700])}, smoothstep(0.16, 0.06, d));
    c = mix(c, mix(${gl3(gold[300])}, ${gl3(gold[100])}, smoothstep(0.0, 3.0, q.y + 1.6)), smoothstep(0.02, -0.06, d));
  } else if (vKind < 1.5) {
    c = flat2(vCol, vN);
    float hi = smoothstep(0.9, 0.95, dot(normalize(vN), normalize(vec3(-0.4, 0.7, 0.6))));
    c = mix(c, ${gl3(gold[100])}, hi * 0.6);
  } else if (vKind < 2.5) {
    // tua: sợi dọc
    c = flat2(vCol, vN) * (0.85 + 0.15 * sin(vUv.x * 80.0));
  } else {
    c = vCol;
  }
  gl_FragColor = vec4(c, 1.0);
}`;
};

export function createLanternCarriers(ctx: OutsideBuildContext): BannerCarriersHandle {
  const { scene, uniforms } = ctx;
  const n = ARC.length, COLS = 3, ROWS = 2;
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * COLS; canvas.height = CELL_H * ROWS;
  const g2 = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  const cell = (i: number) => ({ x: (i % COLS) * CELL_W, y: Math.floor(i / COLS) * CELL_H });
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    const texts = getCheerTexts();
    for (let i = 0; i < n; i++) { const c = cell(i); drawLien(g2, c.x, c.y, CELL_W, CELL_H, texts[i] ?? ''); }
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(draw).catch(() => {});

  const gold = ramp('gold'), son = ramp('son');
  const silk = SILK();
  const parts: Part[] = [], banParts: Part[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  ARC.forEach((a, id) => {
    const { pos, lienTop } = lanternPlacement(a.deg, a.r);
    const ry = Math.atan2(-pos.x, -pos.z);
    const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(up, ry), new THREE.Vector3(1, 1, 1));
    // thân 12 múi phồng
    const body = new THREE.LatheGeometry(bodyProfile(), 72);
    const p = body.attributes.position as THREE.BufferAttribute, uv = body.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const g = (uv.getX(i) * 12) % 1;
      const f = 0.94 + 0.06 * Math.sin(Math.PI * g);
      p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
    }
    body.computeVertexNormals();
    push(parts, body, m, id, 0, silk[id]);
    // chóp + đế vàng, núm, móc
    const capT = new THREE.CylinderGeometry(1.7, 2.3, CAP, 20); capT.translate(0, HH + CAP / 2 - 0.1, 0);
    push(parts, capT, m, id, 1, gold[500]);
    const knob = new THREE.SphereGeometry(0.75, 12, 8); knob.translate(0, HH + CAP + 0.4, 0);
    push(parts, knob, m, id, 1, gold[300]);
    const capB = new THREE.CylinderGeometry(2.3, 1.7, CAP, 20); capB.translate(0, -HH - CAP / 2 + 0.1, 0);
    push(parts, capB, m, id, 1, gold[500]);
    // dây treo phía trên (mảnh, vàng tối) — lên tới ngoài khung để không "lơ lửng"
    const hook = new THREE.TorusGeometry(0.55, 0.14, 6, 14); hook.translate(0, HH + CAP + 1.55, 0);
    push(parts, hook, m, id, 1, gold[700]);
    // thanh treo liễn + hai tua son
    const rodY = lienTop + 0.45;
    const rod = new THREE.CylinderGeometry(0.32, 0.32, LIEN_W + 2.2, 8); rod.rotateZ(Math.PI / 2); rod.translate(0, rodY, 0);
    push(parts, rod, m, id, 1, gold[500]);
    for (const sx of [-1, 1]) {
      push(parts, seg(new THREE.Vector3(0, -HH - CAP, 0), new THREE.Vector3(sx * LIEN_W * 0.42, rodY, 0), 0.1), m, id, 3, gold[700]);
      const end = new THREE.SphereGeometry(0.55, 10, 8); end.translate(sx * (LIEN_W / 2 + 1.1), rodY, 0);
      push(parts, end, m, id, 1, gold[300]);
      const tas = new THREE.ConeGeometry(0.9, 9, 10, 1, true); tas.translate(sx * (LIEN_W / 2 + 1.1), rodY - 5.2, 0);
      push(parts, tas, m, id, 2, son[500]);
      const knot = new THREE.SphereGeometry(0.45, 8, 6); knot.translate(sx * (LIEN_W / 2 + 1.1), rodY - 0.9, 0);
      push(parts, knot, m, id, 1, gold[500]);
    }
    const c = cell(id);
    const mb = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(up, ry), new THREE.Vector3(1, 1, 1));
    pushBanner(banParts, mb, id, LIEN_W, LIEN_H, lienTop, {
      u0: c.x / canvas.width, u1: (c.x + CELL_W) / canvas.width,
      v0: 1 - (c.y + CELL_H) / canvas.height, v1: 1 - c.y / canvas.height,
    });
  });
  const geo = mergeGeometries(parts)!;
  const banGeo = mergeGeometries(banParts)!;
  parts.forEach((g) => g.dispose()); banParts.forEach((g) => g.dispose());
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uPulse: uniforms.uPulse, uHype: uniforms.uHype },
    vertexShader: VERT, fragmentShader: frag(), fog: false,
  });
  const banMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uPulse: uniforms.uPulse, uHype: uniforms.uHype, uMap: { value: tex } },
    vertexShader: bannerVert(false), fragmentShader: BANNER_FRAG, fog: false, side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(geo, mat), ban = new THREE.Mesh(banGeo, banMat);
  body.frustumCulled = ban.frustumCulled = false;
  scene.add(body, ban);
  return {
    dispose() {
      disposed = true;
      off();
      scene.remove(body, ban);
      geo.dispose(); banGeo.dispose(); mat.dispose(); banMat.dispose(); tex.dispose();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { bannerCarriers: createLanternCarriers };
