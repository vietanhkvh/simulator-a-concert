// "Mực & Sơn mài · bản Việt" · khe secretRocket (L6): PHÁO BÔNG TRÚC 5 ỐNG.
// Giá 5 ống tre sơn ngọc (đốt tre viền vàng) trên bệ sơn son, trồi lên ở cuối sân (z ≈ −82, ngoài vùng khán giả, giữa
// hai màn LED) rồi bắn lần lượt các quả pháo vệt vàng lên trên khán đài xa (SHOW) nổ thành: hoa cúc (cánh mảnh
// cong), hoa sen (cánh nhọn nhiều lớp nở dần, quay mặt về camera), liễu rủ (dải vàng rơi), và màn kết: mặt trời trống
// đồng (vòng đồng tâm + 14 tia, quay mặt về camera) + bốn hoa cúc nhỏ. Hạt là nét chấm cọ / cánh hoa hướng theo chiều
// bay trên màn hình, lưu lại rồi rơi như vàng lá. Không chớp trắng; ≤ 3 lần loé/giây.
// 3 draw call khi chạy (giá + hạt + vòng cọ chữ ký), 0 khi rảnh; mọi chuyển động trong shader, CPU chỉ đổi uniform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../../../core/types';
import { mixHex, popScale } from '../../../../world/style';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { groundY, pxScale, seededRnd, smooth } from '../../secretShared';
import { createSealRing, gl3, ramp, rgb3 } from './bannerKit';

const D = 22;
/** Tâm màn pháo: trên nửa xa của sân, trước ca sĩ (≈ 28° trên đường chân trời; cách máy secret (0, 66, −108) ~58 m) — đọc được cả từ mắt ca sĩ (mái sân
 * khấu che mọi thứ cao hơn ~41°, nên tâm mặc định ROCKET_BURST (0, 50, −30) ở 58° không thấy từ sân khấu) lẫn camera cao. */
const SHOW = new THREE.Vector3(0, 34, -60);
const FLIGHT = 1.5;
const RACK_Z = -82;
const BASE_H = 5;
const TUBE_H = 8;
const KIND = { TRAIL: 0, CHRYS: 1, WILLOW: 2, LOTUS: 3, SUN: 4, FLASH: 5 } as const;
type Kind = (typeof KIND)[keyof typeof KIND];

/** Kịch bản: ống bắn, thời điểm NỔ, kiểu, màu (0 vàng, 1 son, 2 ngọc, 3 xà cừ), lệch tâm nổ (m). */
const SHELLS: { tube: number; tb: number; kind: Kind; col: number; off: [number, number, number]; size: number }[] = [
  { tube: 2, tb: 3.6, kind: KIND.CHRYS, col: 0, off: [0, 4, 0], size: 22 },
  { tube: 0, tb: 5.2, kind: KIND.LOTUS, col: 1, off: [-22, -2, 4], size: 16 },
  { tube: 4, tb: 6.8, kind: KIND.WILLOW, col: 0, off: [20, 6, -4], size: 20 },
  { tube: 1, tb: 8.3, kind: KIND.CHRYS, col: 2, off: [-16, 4, -6], size: 22 },
  { tube: 3, tb: 9.8, kind: KIND.LOTUS, col: 3, off: [14, 0, 2], size: 16 },
  // màn kết: 5 ống cùng bắn
  { tube: 2, tb: 13.0, kind: KIND.SUN, col: 0, off: [0, 3, 0], size: 21 },
  { tube: 0, tb: 13.35, kind: KIND.CHRYS, col: 1, off: [-34, -4, 0], size: 14 },
  { tube: 4, tb: 13.35, kind: KIND.CHRYS, col: 2, off: [34, -4, 0], size: 14 },
  { tube: 1, tb: 13.7, kind: KIND.WILLOW, col: 0, off: [-20, 10, -4], size: 14 },
  { tube: 3, tb: 13.7, kind: KIND.WILLOW, col: 0, off: [20, 10, -4], size: 14 },
];

const tubeMouth = (i: number, out = new THREE.Vector3()) => {
  const a = (i - 2) * 0.16, tilt = 0.22;
  const base = new THREE.Vector3((i - 2) * 1.8, groundY(RACK_Z) + BASE_H, RACK_Z);
  return out.set(Math.sin(a) * TUBE_H, Math.cos(a) * Math.cos(tilt) * TUBE_H, Math.sin(tilt) * TUBE_H).add(base);
};

const VERT = /* glsl */ `
uniform float uT; uniform float uPx;
attribute vec4 aA; // tBurst, kind, lag (s), life
attribute vec4 aB; // dir.xyz / start.xyz / 2D pt, speed
attribute vec4 aC; // centre.xyz, size
attribute vec3 aColor;
varying vec3 vCol; varying float vAl; varying float vAng; varying float vKind; varying float vStretch;
const float FL = ${FLIGHT.toFixed(2)};
void main(){
  float tb = aA.x, kind = aA.y, lag = aA.z, life = aA.w;
  vec3 c = aC.xyz;
  vec3 p = c; vec3 dirW = vec3(0.0, 1.0, 0.0);
  vec2 off2 = vec2(0.0); bool cam = false;
  float al = 0.0; float size = aC.w; vStretch = 1.0;
  float age = uT - tb - lag;
  if (kind < 0.5) {
    float s = (uT - lag - (tb - FL)) / FL;
    vec3 a = aB.xyz; vec3 m = vec3(mix(a.x, c.x, 0.3), c.y + 6.0, mix(a.z, c.z, 0.2));
    float e = 1.0 - (1.0 - s) * (1.0 - s);
    vec3 q0 = mix(a, m, e), q1 = mix(m, c, e);
    p = mix(q0, q1, e) + vec3(sin(s * 18.0 + tb) * 0.35, 0.0, 0.0);
    dirW = normalize(q1 - q0 + 1e-4);
    al = (s > 0.0 && s < 1.0) ? (1.0 - lag * 3.5) : 0.0;
    vStretch = 1.6;
  } else if (kind < 1.5 || (kind > 1.5 && kind < 2.5)) {
    bool wil = kind > 1.5;
    float k = wil ? 2.6 : 2.2;
    float r = aB.w * (1.0 - exp(-k * max(age, 0.0)));
    p = c + aB.xyz * r;
    float g = wil ? 2.6 : 1.1;
    p.y -= g * age * age * 0.5;
    float late = smoothstep(life * 0.55, life, age);
    p.x += sin(age * 3.0 + aB.x * 20.0) * late * 1.2;
    dirW = normalize(aB.xyz * exp(-k * age) * aB.w * k + vec3(0.0, -g * age, 0.0) + 1e-4);
    al = (age > 0.0 ? 1.0 : 0.0) * (1.0 - smoothstep(life * 0.7, life, age)) * (1.0 - lag * 2.2);
    vStretch = wil ? 2.6 : 2.0;
    size *= (1.0 - 0.5 * late);
  } else if (kind < 3.5 || kind < 4.5) {
    cam = true;
    float open = smoothstep(0.0, kind < 3.5 ? 1.1 : 0.8, max(age, 0.0));
    float rot = (kind < 3.5 ? 0.15 : 0.08) * age;
    vec2 q = aB.xy * (0.25 + 0.75 * open) * aB.w;
        float cs = cos(rot), sn = sin(rot);
    off2 = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
    p = c; p.y -= 0.7 * age * age * 0.5;
    float late = smoothstep(life * 0.5, life, age);
    p.y -= late * 6.0; off2.x += sin(age * 2.5 + aB.x * 9.0) * late * 1.5;
    al = (age > 0.0 ? 1.0 : 0.0) * (1.0 - smoothstep(life * 0.72, life, age)) * (1.0 - lag * 2.0);
    vAng = atan(off2.y, off2.x);
    vStretch = 1.8;
  } else {
    p = c;
    al = age > 0.0 ? (1.0 - smoothstep(0.0, 0.35, age)) * 0.55 : 0.0;
    vStretch = 1.0;
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  if (cam) mv.xy += off2;
  else {
    vec4 mv2 = viewMatrix * vec4(p + dirW, 1.0);
    vec2 sd = mv2.xy / -mv2.z - mv.xy / -mv.z;
    vAng = atan(sd.y, sd.x);
  }
  gl_Position = projectionMatrix * mv;
  vAl = al; vKind = kind; vCol = aColor;
  gl_PointSize = al < 0.004 ? 0.0 : clamp(uPx * size / -mv.z, 1.5, 90.0);
}`;

const FRAG = /* glsl */ `
varying vec3 vCol; varying float vAl; varying float vAng; varying float vKind; varying float vStretch;
void main(){
  if (vAl < 0.004) discard;
  vec2 q = (gl_PointCoord - 0.5) * 2.0; q.y = -q.y;
  float c = cos(vAng), s = sin(vAng);
  q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  float m;
  if (vKind > 4.5) { m = smoothstep(1.0, 0.0, length(q)); m *= m; }
  else {
    // cánh hoa / chấm cọ: thon nhọn hai đầu, đầu trước tròn hơn
    float x = q.x, y = q.y * vStretch;
    float w = 1.0 - 0.55 * smoothstep(-0.2, 1.0, -x);
    m = smoothstep(1.0, 0.75, length(vec2(x, y / max(w, 0.2))));
  }
  if (m < 0.02) discard;
  gl_FragColor = vec4(vCol * m * vAl * 0.9, 1.0);
}`;

function buildParticles() {
  const gold = ramp('gold'), son = ramp('son'), jade = ramp('jade'), pearl = ramp('pearl');
  const cols = [[gold[500], gold[300], son[300]], [son[300], son[500], gold[300]], [jade[300], jade[100], gold[300]], [pearl[100], pearl[300], gold[100]]];
  const A: number[] = [], B: number[] = [], C: number[] = [], K: number[] = [];
  const rnd = seededRnd(2026);
  const add = (a: number[], b: number[], c: number[], col: number) => { A.push(...a); B.push(...b); C.push(...c); K.push(...rgb3(col)); };
  const mouth = new THREE.Vector3();
  for (const sh of SHELLS) {
    const cx = SHOW.x + sh.off[0], cy = SHOW.y + sh.off[1], cz = SHOW.z + sh.off[2];
    const pal = cols[sh.col];
    tubeMouth(sh.tube, mouth);
    // vệt pháo vàng (đầu + 18 bóng)
    for (let g = 0; g < 19; g++) add([sh.tb, KIND.TRAIL, g * 0.028, 0], [mouth.x, mouth.y, mouth.z, 0], [cx, cy, cz, g === 0 ? 1.4 : 0.9], g < 3 ? gold[100] : gold[300]);
    if (sh.tb < 12 || sh.kind === KIND.SUN) add([sh.tb, KIND.FLASH, 0, 0], [0, 0, 0, 0], [cx, cy, cz, sh.size * 0.9], gold[300]);
    if (sh.kind === KIND.CHRYS || sh.kind === KIND.WILLOW) {
      const wil = sh.kind === KIND.WILLOW;
      const n = wil ? 150 : 170, ghosts = wil ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        const d = [r * Math.cos(ph), u, r * Math.sin(ph)];
        const sp = sh.size * (0.88 + 0.12 * rnd());
        const life = wil ? 5.5 + rnd() * 1.5 : 3.6 + rnd() * 1.2;
        const col = pal[i % 3 === 0 ? 1 : 0];
        for (let g = 0; g < ghosts; g++) add([sh.tb, sh.kind, g * (wil ? 0.09 : 0.05), life], [d[0], d[1], d[2], sp], [cx, cy, cz, (wil ? 1.1 : 1.3) * (1 - g * 0.12)], col);
      }
    } else if (sh.kind === KIND.LOTUS) {
      // hoa sen nhìn chính diện: 3 lớp cánh nhọn xòe lên (ngoài 7, giữa 5, trong 3) từ gốc chung + đài sen
      const layers = [{ n: 7, from: 0.2, to: Math.PI - 0.2, L: 1.0, w: 0.2, c: pal[0] }, { n: 5, from: 0.55, to: Math.PI - 0.55, L: 0.8, w: 0.17, c: pal[2] }, { n: 3, from: 1.05, to: Math.PI - 1.05, L: 0.6, w: 0.14, c: pal[1] }];
      layers.forEach((ly, li) => {
        for (let pI = 0; pI < ly.n; pI++) {
          const ang = ly.from + (ly.to - ly.from) * (pI / (ly.n - 1));
          const L = ly.L * (0.75 + 0.25 * Math.sin(ang));
          for (let k = 0; k < 20; k++) {
            const s = k / 19, side = s < 0.5 ? -1 : 1, t = s < 0.5 ? s * 2 : (1 - s) * 2;
            const along = t * L, wid = Math.sin(Math.PI * Math.pow(t, 0.75)) * ly.w * L;
            const x = Math.cos(ang) * along - Math.sin(ang) * wid * side, y = Math.sin(ang) * along + Math.cos(ang) * wid * side - 0.35;
            add([sh.tb, KIND.LOTUS, li * 0.12, 4.6], [x, y, 0, sh.size], [cx, cy, cz, 1.0], ly.c);
          }
        }
      });
      for (let i = 0; i < 16; i++) { const a = Math.PI * (1 + i / 15); add([sh.tb, KIND.LOTUS, 0, 4.6], [Math.cos(a) * 0.32, Math.sin(a) * 0.12 - 0.35, 0, sh.size], [cx, cy, cz, 1.0], pal[2]); }
    } else {
      // mặt trời trống đồng: ngôi sao 14 tia + 3 vòng đồng tâm (chấm) + vòng chim chấm ngoài
      for (let ray = 0; ray < 14; ray++) {
        const a = ray / 14 * Math.PI * 2;
        for (let k = 0; k < 14; k++) {
          const t = 0.08 + 0.34 * k / 13, w = (1 - k / 13) * 0.05;
          for (const sd of [-1, 1]) add([sh.tb, KIND.SUN, 0, 6], [Math.cos(a) * t - Math.sin(a) * w * sd, Math.sin(a) * t + Math.cos(a) * w * sd, 0, sh.size], [cx, cy, cz, 1.2], gold[300]);
        }
      }
      const rings = [[0.5, 70, gold[100]], [0.72, 96, son[300]], [0.95, 120, gold[300]]] as const;
      for (const [r, n, col] of rings) for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        for (let g = 0; g < 2; g++) add([sh.tb, KIND.SUN, g * 0.05, 6], [Math.cos(a) * r, Math.sin(a) * r, 0, sh.size], [cx, cy, cz, 1.25], col);
      }
      for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; add([sh.tb, KIND.SUN, 0, 6], [Math.cos(a) * 0.84, Math.sin(a) * 0.84, 0, sh.size], [cx, cy, cz, 2.0], jade[300]); }
    }
  }
  const n = A.length / 4;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aA', new THREE.Float32BufferAttribute(A, 4));
  geo.setAttribute('aB', new THREE.Float32BufferAttribute(B, 4));
  geo.setAttribute('aC', new THREE.Float32BufferAttribute(C, 4));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(K, 3));
  return geo;
}

function buildRack(): THREE.BufferGeometry {
  const son = ramp('son'), gold = ramp('gold'), jade = ramp('jade');
  const parts: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, col: number) => {
    const ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose();
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal'].includes(k)) ng.deleteAttribute(k);
    const n = ng.attributes.position.count, c = rgb3(col), cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cc.set(c, i * 3);
    ng.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    parts.push(ng);
  };
  // bệ sơn son (cục bộ: gốc = tâm đáy bệ), viền vàng
  const base = new THREE.BoxGeometry(11, BASE_H, 4.4); base.translate(0, BASE_H / 2, 0); put(base, son[500]);
  const trim = new THREE.BoxGeometry(11.6, 0.5, 5.0); trim.translate(0, BASE_H - 0.25, 0); put(trim, gold[500]);
  const trim2 = new THREE.BoxGeometry(11.6, 0.4, 5.0); trim2.translate(0, 0.6, 0); put(trim2, gold[700]);
  const plaque = new THREE.CircleGeometry(1.3, 24); plaque.translate(0, BASE_H / 2, 2.21); put(plaque, gold[300]);
  const plaqueB = new THREE.CircleGeometry(1.3, 24); plaqueB.rotateY(Math.PI); plaqueB.translate(0, BASE_H / 2, -2.21); put(plaqueB, gold[300]);
  const bamboo = mixHex(jade[500], gold[500], 0.25);
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.16, tilt = 0.22;
    const m = new THREE.Matrix4().makeRotationX(tilt).premultiply(new THREE.Matrix4().makeRotationZ(-a));
    m.setPosition((i - 2) * 1.8, BASE_H, 0);
    const tube = new THREE.CylinderGeometry(0.72, 0.78, TUBE_H, 14, 1, true); tube.translate(0, TUBE_H / 2, 0); tube.applyMatrix4(m); put(tube, bamboo);
    const inner = new THREE.CircleGeometry(0.7, 14); inner.rotateX(-Math.PI / 2); inner.translate(0, TUBE_H - 0.15, 0); inner.applyMatrix4(m); put(inner, son[700]);
    for (const y of [1.6, 3.8, 6.0, TUBE_H - 0.1]) {
      const node = new THREE.TorusGeometry(0.78, 0.13, 6, 16); node.rotateX(Math.PI / 2); node.translate(0, y, 0); node.applyMatrix4(m); put(node, gold[500]);
    }
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

const RACK_VERT = /* glsl */ `
varying vec3 vC; varying vec3 vN;
void main(){ vC = color; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const rackFrag = () => /* glsl */ `
uniform float uGlow;
varying vec3 vC; varying vec3 vN;
void main(){
  float d = dot(normalize(vN), normalize(vec3(-0.4, 0.75, 0.55)));
  vec3 sh = mix(vC * 0.62, ${gl3(ramp('lacquer')[500])}, 0.18);
  vec3 c = mix(sh, vC, smoothstep(-0.1, 0.0, d));
  c += ${gl3(ramp('amber')[300])} * uGlow * 0.25;
  gl_FragColor = vec4(c, 1.0);
}`;

export function createBambooFireworks(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const rackGeo = buildRack();
  const rackMat = new THREE.ShaderMaterial({ uniforms: { uGlow: { value: 0 } }, vertexShader: RACK_VERT, fragmentShader: rackFrag(), vertexColors: true, fog: false });
  const rack = new THREE.Mesh(rackGeo, rackMat);
  const rackY = groundY(RACK_Z);
  rack.position.set(0, rackY, RACK_Z);
  root.add(rack);
  const pGeo = buildParticles();
  const pU = { uT: { value: 0 }, uPx: { value: 720 } };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pU, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const pts = new THREE.Points(pGeo, pMat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  root.add(pts);
  const seal = createSealRing();
  root.add(seal.mesh);
  const rackCentre = new THREE.Vector3(0, rackY + BASE_H + 3, RACK_Z);

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      pU.uT.value = t; pU.uPx.value = pxScale();
      const rise = smooth(0, 1.6, t) * (1 - smooth(D - 2.5, D - 0.5, t));
      const pop = popScale(t);
      rack.position.y = rackY - (1 - rise) * (BASE_H + TUBE_H + 2);
      rack.scale.setScalar(Math.max(0.01, 0.4 + 0.6 * pop));
      // ống loé ấm theo phách + lúc bắn
      let fire = 0;
      for (const s of SHELLS) { const dt = t - (s.tb - FLIGHT); if (dt > 0 && dt < 0.4) fire = Math.max(fire, 1 - dt / 0.4); }
      rackMat.uniforms.uGlow.value = Math.max(fire, f.beatPulse * 0.4);
      // chữ ký: quanh giá lúc đầu, quanh mặt trời trống đồng ở màn kết
      seal.mesh.position.copy(rackCentre);
      seal.update(t, 9, smooth(0.6, 1.4, t) * (1 - smooth(D - 3, D - 1.5, t)));
    },
    focus(t: number, out: THREE.Vector3) {
      if (t < 2.2) out.copy(rackCentre).lerp(SHOW, smooth(1.0, 2.2, t) * 0.5);
      else out.copy(SHOW);
    },
    dispose() {
      seal.dispose();
      root.removeFromParent();
      rackGeo.dispose(); rackMat.dispose(); pGeo.dispose(); pMat.dispose();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { secretRocket: createBambooFireworks };
