// Bầu trời đêm sân vận động: vòm trời gradient + trăng, cực quang (aurora), trường sao + sao băng, điểm sáng (đèn nhà hát,
// cụm đèn pha, đèn hàng không), máy bay + vệt khói. 6 draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Uniforms = { [k: string]: THREE.IUniform };

const MW_N = new THREE.Vector3(0.75, 0.5, 0.45).normalize();
const SKY_FRAG = /* glsl */ `
const vec3 MW_N = vec3(${MW_N.x.toFixed(5)}, ${MW_N.y.toFixed(5)}, ${MW_N.z.toFixed(5)});
uniform float uTime; uniform float uHype; uniform float uPulse;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float el = d.y;
  float h = max(el, 0.0);
  float az = atan(d.x, -d.z);
  vec3 zen = vec3(0.004, 0.006, 0.022);
  vec3 mid = vec3(0.022, 0.035, 0.115);
  vec3 hor = vec3(0.07, 0.065, 0.16);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
  col = mix(col, zen, smoothstep(0.18, 0.95, h));
  // ánh đèn thành phố ấm ở chân trời
  float glow = exp(-h * 13.0) * (0.7 + 0.3 * sin(az * 3.0 + 1.0));
  col += vec3(0.32, 0.14, 0.07) * glow * 0.85;
  // ánh xanh cực quang hắt lên nền trời
  col += vec3(0.0, 0.05, 0.045) * (0.35 + 0.65 * uHype) * smoothstep(0.05, 0.5, h) * (0.6 + 0.4 * sin(az * 2.0 + uTime * 0.05));
  col += vec3(0.04, 0.0, 0.05) * uHype * smoothstep(0.3, 0.9, h);
  col = mix(col, vec3(0.03, 0.025, 0.06), smoothstep(0.0, -0.08, el));
  // trăng lưỡi liềm
  vec3 md = normalize(vec3(-0.62, 0.40, -0.68));
  float mdot = dot(d, md);
  float disc = smoothstep(0.99978, 0.99984, mdot);
  float cut = smoothstep(0.99978, 0.99984, dot(d, normalize(md + vec3(0.009, 0.004, 0.0))));
  col += vec3(1.0, 0.95, 0.82) * disc * (1.0 - cut * 0.93) * 1.2;
  col += vec3(0.20, 0.22, 0.34) * pow(max(mdot, 0.0), 900.0) * 0.5;
  // dải Ngân Hà mờ (cùng mặt phẳng với MW_N phía TS)
  float mw = dot(d, MW_N);
  float band = exp(-mw * mw / 0.018);
  float nz = 0.5 + 0.5 * sin(d.x * 9.0 + sin(d.z * 7.0) * 1.7) * sin(d.y * 11.0 + d.z * 5.0 + 1.3);
  float core = exp(-mw * mw / 0.004);
  col += (vec3(0.10, 0.115, 0.18) * (0.35 + 0.8 * nz) * band + vec3(0.05, 0.045, 0.06) * core * nz) * smoothstep(0.02, 0.25, el) * (1.0 + 0.3 * uHype);
  gl_FragColor = vec4(col, 1.0);
}`;

const AURORA_VERT = /* glsl */ `
uniform float uTime; uniform float uHype;
attribute vec3 aCurt; // s (m dọc dải), u (0..1), id
varying vec2 vUv; varying float vS; varying float vId;
void main(){
  vUv = vec2(aCurt.y, uv.y); vS = aCurt.x; vId = aCurt.z;
  vec3 p = position;
  float t = uTime * (0.5 + 0.8 * uHype);
  vec2 radial = normalize(p.xz + vec2(0.0001));
  float fold = sin(vS * 0.03 + t * 0.10 + vId * 2.0) * 9.0 + sin(vS * 0.083 - t * 0.07 + vId) * 4.0;
  p.xz += radial * fold;
  p.y += sin(vS * 0.045 + t * 0.15 + vId * 3.0) * 4.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const AURORA_FRAG = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse;
varying vec2 vUv; varying float vS; varying float vId;
float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
void main(){
  float t = uTime * (0.45 + 1.3 * uHype);
  float s = vS;
  float x = s * 0.09 + t * 0.30 + vId * 13.0;
  float rays = n1(x * 3.0) * 0.5 + n1(x * 7.3 - t * 0.8) * 0.3 + n1(x * 17.0 + t * 1.7) * 0.2;
  rays = pow(rays, 2.0) * 2.0;
  float big = smoothstep(0.2, 0.7, n1(s * 0.013 - t * 0.05 + vId * 5.0)) * 0.85 + 0.15;
  float y = vUv.y;
  float bottom = smoothstep(0.0, 0.06, y);
  float fade = exp(-y * mix(3.4, 1.3, clamp(rays, 0.0, 1.0)));
  float top = smoothstep(1.0, 0.7, y);
  float I = bottom * top * (fade * (0.25 + rays) + exp(-y * 22.0) * 0.5) * big;
  vec3 green = vec3(0.15, 1.0, 0.45), teal = vec3(0.1, 0.85, 0.95), violet = vec3(0.55, 0.3, 1.0), pink = vec3(1.0, 0.3, 0.75);
  float k = y * 1.05 + n1(s * 0.02 + t * 0.05) * 0.25 + uHype * 0.22;
  vec3 c = k < 0.33 ? mix(green, teal, k / 0.33) : (k < 0.66 ? mix(teal, violet, (k - 0.33) / 0.33) : mix(violet, pink, clamp((k - 0.66) / 0.34, 0.0, 1.0)));
  float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  float amp = (0.65 + 0.85 * uHype) * (1.0 + 0.35 * uPulse * (0.3 + uHype));
  gl_FragColor = vec4(c * I * edge * amp, 1.0);
}`;

// kind: 0 sao, 1 đèn nhà hát, 2 đèn pha, 3/4 đèn máy bay 0/1, 5 drone
const GLOW_VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uPx;
uniform vec4 uPlane[2]; uniform vec2 uPlaneVis;
attribute vec3 color; attribute float aSize; attribute vec4 aInfo;
varying vec3 vCol;
void main(){
  float kind = aInfo.x;
  vec3 p = position;
  float g = 1.0;
  if (kind > 2.5 && kind < 4.5) {
    vec4 pl = kind < 3.5 ? uPlane[0] : uPlane[1];
    float c = cos(pl.w), s = sin(pl.w);
    p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z) + pl.xyz;
    g = kind < 3.5 ? uPlaneVis.x : uPlaneVis.y;
  } else if (kind > 4.5) {
    float a = uTime * 0.045;
    p += vec3(sin(a) * 55.0, 46.0 + sin(uTime * 0.3) * 2.0, -45.0 + cos(a) * 35.0);
  }
  float tw;
  if (aInfo.w < 0.5) tw = 0.6 + 0.4 * sin(uTime * aInfo.y + aInfo.z);
  else if (aInfo.w < 1.5) tw = step(0.9, fract(uTime * aInfo.y + aInfo.z));
  else tw = 1.0;
  if (kind > 0.5 && kind < 1.5) g *= 0.6 + 0.3 * uHype + 0.3 * uPulse;
  if (kind > 1.5 && kind < 2.5) g *= 1.0 + 0.12 * uPulse;
  vCol = color * tw * g;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(aSize * uPx / -mv.z, 1.6);
  gl_Position = projectionMatrix * mv;
}`;

const GLOW_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(1.0, 0.0, d);
  float a = core * core * 0.6 + smoothstep(0.45, 0.15, d) * 0.6;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol * a, 1.0);
}`;

const PLANE_VERT = /* glsl */ `
uniform vec4 uPlane[2]; uniform vec2 uPlaneVis;
attribute vec2 aInfo; // id máy bay, 1 = vệt khói
varying float vA; varying float vTrail; varying float vU;
void main(){
  vec4 pl = aInfo.x < 0.5 ? uPlane[0] : uPlane[1];
  float c = cos(pl.w), s = sin(pl.w);
  vec3 p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z) + pl.xyz;
  vA = aInfo.x < 0.5 ? uPlaneVis.x : uPlaneVis.y;
  vTrail = aInfo.y; vU = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const PLANE_FRAG = /* glsl */ `
varying float vA; varying float vTrail; varying float vU;
void main(){
  if (vTrail > 0.5) {
    float a = 0.28 * pow(1.0 - vU, 1.6) * smoothstep(0.0, 0.04, vU) * vA;
    gl_FragColor = vec4(vec3(0.72, 0.76, 0.9), a);
  } else {
    gl_FragColor = vec4(vec3(0.02, 0.02, 0.04), vA);
  }
}`;


const STAR_R = 185;
const STAR_VERT = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uRes;
attribute vec3 color; attribute float aSize; attribute vec3 aTw; // tốc độ, pha, hero
varying vec3 vCol; varying float vHero;
void main(){
  vec3 wp = position * ${STAR_R}.0 + cameraPosition;
  float sp = aTw.x * (1.0 + 0.9 * uHype);
  float tw = 0.72 + 0.28 * sin(uTime * sp + aTw.y) + (0.18 + 0.3 * uHype) * sin(uTime * sp * 2.7 + aTw.y * 3.1);
  tw = max(tw, 0.15);
  float hz = smoothstep(0.0, 0.1, position.y);
  vCol = color * tw * hz * (1.0 + 0.45 * uHype + 0.1 * uPulse * uHype);
  vHero = aTw.z;
  gl_PointSize = aSize * uRes * (1.0 + 0.12 * uHype);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vCol; varying float vHero;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  float a;
  if (vHero > 0.5) {
    float cr = exp(-abs(p.x) * 26.0 - abs(p.y) * 3.2) + exp(-abs(p.y) * 26.0 - abs(p.x) * 3.2);
    a = exp(-d2 * 40.0) * 1.6 + exp(-d2 * 9.0) * 0.35 + cr * 0.9;
    a *= smoothstep(1.0, 0.8, max(abs(p.x), abs(p.y)));
  } else {
    a = exp(-d2 * 3.2) * 1.1;
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol * a, 1.0);
}`;

const MET_VERT = /* glsl */ `
uniform float uTime;
attribute vec3 aP0; attribute vec3 aT; attribute vec4 aLife; // bắt đầu, thời lượng, độ dài cung, độ dài đuôi
attribute vec2 aLook; // nửa rộng, độ sáng
varying vec2 vQ; varying float vA; varying float vFlare; varying float vBr;
void main(){
  float u = (uTime - aLife.x) / aLife.y;
  if (u < 0.0 || u > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(0.0); vA = 0.0; vFlare = 0.0; vBr = 0.0; return; }
  float e = u * (2.0 - u) * 0.35 + u * 0.65; // hơi giảm tốc
  float head = aLife.z * e;
  float tail = min(head, aLife.w * (1.0 - 0.5 * smoothstep(0.6, 1.0, u)));
  float a = head - position.x * tail;
  vec3 dir = aP0 * cos(a) + aT * sin(a);
  vec3 side = cross(aP0, aT);
  vFlare = smoothstep(0.68, 0.9, u) * (1.0 - smoothstep(0.9, 1.0, u));
  float w = aLook.x * (1.0 + 2.2 * vFlare * (1.0 - position.x)) * mix(1.0, 0.12, position.x);
  vec3 wp = (dir + side * position.y * w) * ${STAR_R - 5}.0 + cameraPosition;
  vQ = position.xy;
  vA = smoothstep(0.0, 0.07, u) * (1.0 - smoothstep(0.93, 1.0, u));
  vBr = aLook.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const MET_FRAG = /* glsl */ `
varying vec2 vQ; varying float vA; varying float vFlare; varying float vBr;
void main(){
  float x = vQ.x;
  float across = exp(-vQ.y * vQ.y * 3.5);
  float tl = pow(1.0 - x, 2.2);
  float head = exp(-x * x * 90.0);
  float i = (tl * 1.0 + head * 2.2 + vFlare * head * 2.5 + vFlare * 0.6 * exp(-x * 8.0)) * across * vA * vBr;
  vec3 c = mix(vec3(0.55, 0.75, 1.0), vec3(1.0, 0.96, 0.85), clamp(head + tl * 0.3, 0.0, 1.0));
  gl_FragColor = vec4(c * i, 1.0);
}`;

/** Thêm một nhóm điểm sáng vào bộ đệm chung (sao/đèn/...). */
export interface GlowBuf { pos: number[]; col: number[]; size: number[]; info: number[] }
export function addGlow(b: GlowBuf, x: number, y: number, z: number, c: THREE.Color, k: number, size: number, info: [number, number, number, number]) {
  b.pos.push(x, y, z);
  b.col.push(c.r * k, c.g * k, c.b * k);
  b.size.push(size);
  b.info.push(...info);
}

// Đường bay (từ → tới), độ cao lớn, trong tầm far=220 của camera.
const PATHS: [THREE.Vector3, THREE.Vector3][] = [
  [new THREE.Vector3(-125, 112, -85), new THREE.Vector3(125, 112, -25)],
  [new THREE.Vector3(95, 125, 55), new THREE.Vector3(-70, 125, -120)],
  [new THREE.Vector3(120, 105, -100), new THREE.Vector3(-120, 118, -40)],
  [new THREE.Vector3(-90, 130, 60), new THREE.Vector3(60, 120, -130)],
];

let activeBurst: ((n: number) => void) | null = null;
/** Bắn n sao băng (cho kiểm thử). */
export function triggerMeteors(count: number): void { activeBurst?.(count); }

export function createSky(scene: THREE.Scene, uniforms: Uniforms, glow: GlowBuf) {
  const disposables: { dispose(): void }[] = [];
  uniforms.uPx = { value: 500 };
  uniforms.uRes = { value: 1 };
  uniforms.uPlane = { value: [new THREE.Vector4(0, -500, 0, 0), new THREE.Vector4(0, -500, 0, 0)] };
  uniforms.uPlaneVis = { value: new THREE.Vector2(0, 0) };

  // 1) Vòm trời (bám theo camera, bán kính < far)
  const skyGeo = new THREE.SphereGeometry(190, 48, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  const v2 = new THREE.Vector2();
  sky.onBeforeRender = (renderer, _s, camera) => {
    renderer.getDrawingBufferSize(v2);
    uniforms.uPx.value = v2.y * camera.projectionMatrix.elements[5] * 0.5;
    uniforms.uRes.value = Math.max(0.6, v2.y / 720);
  };
  scene.add(sky);
  disposables.push(skyGeo, skyMat);

  // 2) Cực quang: vài dải rèm cong lớn (1 mesh)
  const curt: { cx: number; cz: number; r: number; a0: number; a1: number; yb: number; h: number }[] = [
    { cx: 0, cz: -10, r: 160, a0: -1.9, a1: 1.9, yb: 30, h: 85 },
    { cx: 10, cz: -30, r: 105, a0: -1.0, a1: 1.3, yb: 72, h: 60 },
    { cx: 0, cz: 0, r: 150, a0: 1.7, a1: 3.6, yb: 48, h: 75 },
    { cx: -20, cz: -40, r: 125, a0: -3.0, a1: -1.2, yb: 60, h: 70 },
  ];
  const ap: number[] = [], auv: number[] = [], ac: number[] = [], ai: number[] = [];
  curt.forEach((c, id) => {
    const N = 160;
    const len = (c.a1 - c.a0) * c.r;
    const base = ap.length / 3;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = c.a0 + (c.a1 - c.a0) * u;
      const x = c.cx + Math.sin(a) * c.r, z = c.cz - Math.cos(a) * c.r;
      for (let j = 0; j < 2; j++) {
        ap.push(x, c.yb + j * c.h, z);
        auv.push(u, j);
        ac.push(u * len, u, id);
      }
    }
    for (let i = 0; i < N; i++) {
      const k = base + i * 2;
      ai.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  });
  const aurGeo = new THREE.BufferGeometry();
  aurGeo.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
  aurGeo.setAttribute('uv', new THREE.Float32BufferAttribute(auv, 2));
  aurGeo.setAttribute('aCurt', new THREE.Float32BufferAttribute(ac, 3));
  aurGeo.setIndex(ai);
  const aurMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG,
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const aurora = new THREE.Mesh(aurGeo, aurMat);
  aurora.frustumCulled = false;
  aurora.renderOrder = -5;
  scene.add(aurora);
  disposables.push(aurGeo, aurMat);

  // 3) Trường sao + sao băng (mỗi thứ 1 draw call)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sp: number[] = [], sc: number[] = [], ss: number[] = [], st: number[] = [];
  const col = new THREE.Color();
  const addStar = (x: number, y: number, z: number, size: number, bright: number, hero: number) => {
    const l = Math.hypot(x, y, z);
    sp.push(x / l, y / l, z / l);
    const tt = rnd();
    if (tt < 0.28) col.setRGB(0.62, 0.76, 1.0); else if (tt < 0.7) col.setRGB(1.0, 0.98, 0.95); else if (tt < 0.88) col.setRGB(1.0, 0.88, 0.7); else col.setRGB(1.0, 0.72, 0.52);
    sc.push(col.r * bright, col.g * bright, col.b * bright);
    ss.push(size);
    st.push(0.6 + rnd() * 2.6, rnd() * 6.28, hero);
  };
  const NS = 3400;
  for (let i = 0; i < NS; i++) {
    let x: number, y: number, z: number;
    if (i < 2500) { // đều trên bầu trời
      y = 0.03 + Math.pow(rnd(), 0.85) * 0.97;
      const th = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
      x = Math.cos(th) * rr; z = Math.sin(th) * rr;
    } else { // dải Ngân Hà: quanh đại vòng vuông góc MW_N
      const g = (rnd() + rnd() + rnd() - 1.5) * 0.3;
      const th = rnd() * Math.PI * 2;
      const u = new THREE.Vector3(1, 0, 0).cross(MW_N).normalize(), v = new THREE.Vector3().crossVectors(MW_N, u);
      const q = u.multiplyScalar(Math.cos(th)).add(v.multiplyScalar(Math.sin(th))).add(MW_N.clone().multiplyScalar(g)).normalize();
      x = q.x; y = q.y; z = q.z;
      if (y < 0.04) { i--; continue; }
    }
    const m = rnd();
    const mw = i >= 2500;
    addStar(x, y, z, 1.5 + Math.pow(m, 4) * 2.6, (mw ? 0.35 : 0.45) + Math.pow(m, 2.5) * 0.9, 0);
  }
  for (let i = 0; i < 16; i++) { // sao "hero" có tia chữ thập
    const y = 0.15 + rnd() * 0.8, th = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
    addStar(Math.cos(th) * rr, y, Math.sin(th) * rr, 22 + rnd() * 14, 0.7 + rnd() * 0.5, 1);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  starGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(ss, 1));
  starGeo.setAttribute('aTw', new THREE.Float32BufferAttribute(st, 3));
  const starMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -15;
  scene.add(stars);
  disposables.push(starGeo, starMat);

  // Sao băng: pool 24 quad instanced, chỉ ghi buffer khi sinh sao
  const POOL = 24;
  const mGeo = new THREE.InstancedBufferGeometry();
  mGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3));
  mGeo.setIndex([0, 1, 2, 1, 3, 2]);
  const mkAttr = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(POOL * n), n);
  const aP0 = mkAttr(3), aT = mkAttr(3), aLife = mkAttr(4), aLook = mkAttr(2);
  for (let i = 0; i < POOL; i++) aLife.setXYZW(i, -1000, 1, 0, 0);
  mGeo.setAttribute('aP0', aP0); mGeo.setAttribute('aT', aT); mGeo.setAttribute('aLife', aLife); mGeo.setAttribute('aLook', aLook);
  mGeo.instanceCount = POOL;
  const mMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: MET_VERT, fragmentShader: MET_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const meteors = new THREE.Mesh(mGeo, mMat);
  meteors.frustumCulled = false;
  meteors.renderOrder = -14;
  scene.add(meteors);
  disposables.push(mGeo, mMat);

  const P0 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), nV = new THREE.Vector3(), eV = new THREE.Vector3(), TV = new THREE.Vector3();
  let slot = 0;
  const spawn = (now: number) => {
    const az = (rnd() < 0.62 ? 0 : Math.PI) + (rnd() - 0.5) * 1.9;
    const el = THREE.MathUtils.degToRad(26 + rnd() * 36);
    P0.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    nV.copy(UP).addScaledVector(P0, -P0.y).normalize();
    eV.crossVectors(nV, P0).normalize().multiplyScalar(rnd() < 0.5 ? 1 : -1);
    const down = rnd() < 0.88;
    const phi = THREE.MathUtils.degToRad(down ? 14 + rnd() * 52 : 5 + rnd() * 12);
    TV.copy(eV).multiplyScalar(Math.cos(phi)).addScaledVector(nV, (down ? -1 : 1) * Math.sin(phi)).normalize();
    const i = slot; slot = (slot + 1) % POOL;
    aP0.setXYZ(i, P0.x, P0.y, P0.z); aT.setXYZ(i, TV.x, TV.y, TV.z);
    aLife.setXYZW(i, now, 0.6 + rnd() * 0.8, 0.4 + rnd() * 0.45, 0.14 + rnd() * 0.14);
    aLook.setXY(i, 0.0042 + rnd() * 0.0022, 0.9 + rnd() * 0.7);
    aP0.needsUpdate = aT.needsUpdate = aLife.needsUpdate = aLook.needsUpdate = true;
  };
  const queue: number[] = []; // thời điểm sao băng sắp sinh
  let now = 0, lastT = -1, prevHype = -1;
  const armed = [true, true, true, true];
  const TH = [0.2, 0.4, 0.6, 0.8], BURST = [1, 2, 4, 7];
  const burst = (n: number) => { for (let k = 0; k < n; k++) queue.push(now + (n > 1 ? (k / (n - 1)) * 1.5 : 0) + rnd() * 0.12); };
  activeBurst = burst;
  (window as unknown as { __csSky?: unknown }).__csSky = { triggerMeteors };

  // Đèn hàng không: máy bay (cục bộ: mũi +X, cánh ±Z)
  const red = new THREE.Color(1, 0.12, 0.1), green = new THREE.Color(0.15, 1, 0.3), white = new THREE.Color(1, 1, 1);
  for (const k of [3, 4]) {
    const ph = k * 0.37;
    addGlow(glow, 0, 0, -4.8, red, 1.2, 2.2, [k, 0, 0, 2]);
    addGlow(glow, 0, 0, 4.8, green, 1.2, 2.2, [k, 0, 0, 2]);
    addGlow(glow, -4.2, 0.3, 0, white, 1.4, 2.6, [k, 1.1, ph, 1]);
    addGlow(glow, -0.5, -0.6, 0, red, 1.5, 3.0, [k, 0.8, ph + 0.4, 1]);
    addGlow(glow, 1.2, -0.5, 0, white, 1.4, 2.6, [k, 1.1, ph + 0.5, 1]);
  }
  // drone/trực thăng đèn nháy chậm
  addGlow(glow, 0, 0, 0, red, 1.3, 1.6, [5, 0.6, 0, 1]);
  addGlow(glow, 0, 0.5, 0, white, 0.7, 1.0, [5, 0, 0, 2]);

  // 4) Máy bay + vệt khói (1 mesh)
  const parts: THREE.BufferGeometry[] = [];
  const addPart = (g: THREE.BufferGeometry, id: number, trail: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    const n = ng.attributes.position.count;
    const info = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { info[i * 2] = id; info[i * 2 + 1] = trail; }
    ng.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
    ng.deleteAttribute('normal');
    parts.push(ng);
  };
  for (const id of [0, 1]) {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); addPart(g, id, 0);
    };
    box(8, 0.8, 0.8, 0, 0, 0); // thân
    box(1.6, 0.12, 9.5, 0, 0, 0); // cánh
    box(0.9, 0.1, 3.4, -3.7, 0.2, 0); // đuôi ngang
    box(0.9, 1.4, 0.1, -3.7, 0.8, 0); // đuôi đứng
    for (const zz of [-2.2, 2.2]) {
      const g = new THREE.PlaneGeometry(90, 1.3);
      g.rotateX(-Math.PI / 2);
      // uv.x: 0 tại máy bay → 1 cuối vệt
      const uvA = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uvA.count; i++) uvA.setX(i, 1 - uvA.getX(i));
      g.translate(-4 - 45, 0, zz);
      addPart(g, id, 1);
    }
  }
  const planeGeo = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  const planeMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const planes = new THREE.Mesh(planeGeo, planeMat);
  planes.frustumCulled = false;
  scene.add(planes);
  disposables.push(planeGeo, planeMat);

  const CYCLE = [31, 39];
  const OFFS = [26, 25];
  const tmp = new THREE.Vector3();
  return {
    /** Tạo Points điểm sáng chung sau khi mọi module đã thêm vào bộ đệm. */
    finishGlow() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(glow.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(glow.col, 3));
      g.setAttribute('aSize', new THREE.Float32BufferAttribute(glow.size, 1));
      g.setAttribute('aInfo', new THREE.Float32BufferAttribute(glow.info, 4));
      const m = new THREE.ShaderMaterial({
        uniforms, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false;
      p.renderOrder = 2;
      scene.add(p);
      disposables.push(g, m);
    },
    update(t: number) {
      now = t;
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const h = (uniforms.uHype?.value as number) ?? 0;
      if (prevHype < 0) prevHype = h;
      for (let i = 0; i < 4; i++) {
        if (h < TH[i] - 0.05) armed[i] = true;
        if (armed[i] && prevHype < TH[i] && h >= TH[i]) { armed[i] = false; burst(BURST[i]); }
      }
      prevHype = h;
      const rate = h < 0.2 ? 0 : h < 0.4 ? 1 / 12 : h < 0.6 ? 1 / 6 : h < 0.8 ? 1 / 3 : 3.5 + (h - 0.8) * 20;
      if (dt > 0 && rnd() < rate * dt) queue.push(t);
      for (let k = queue.length - 1; k >= 0; k--) if (queue[k] <= t) { spawn(t); queue.splice(k, 1); }
      for (let i = 0; i < 2; i++) {
        const local = (t + OFFS[i]) / CYCLE[i];
        const idx = Math.floor(local);
        const f = (local - idx) / 0.85;
        const [A, B] = PATHS[(idx * 2 + i * 3) % PATHS.length];
        const vis = f >= 1 ? 0 : THREE.MathUtils.smoothstep(f, 0, 0.06) * (1 - THREE.MathUtils.smoothstep(f, 0.94, 1));
        tmp.lerpVectors(A, B, Math.min(f, 1));
        const pl = uniforms.uPlane.value[i] as THREE.Vector4;
        pl.set(tmp.x, vis > 0 ? tmp.y : -500, tmp.z, Math.atan2(B.z - A.z, B.x - A.x));
        (uniforms.uPlaneVis.value as THREE.Vector2).setComponent(i, vis);
      }
    },
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}
