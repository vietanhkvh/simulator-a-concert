// Đạo cụ cho cảnh mở màn (entrance.ts): trực thăng + dù, sao chổi + hiệu ứng chạm đất.
// Toàn bộ là mesh gộp, vật liệu không cần đèn, fog:false; hoạt ảnh bằng uniform/shader.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const LDIR = new THREE.Vector3(0.35, 0.8, -0.5).normalize();

/** Tô màu theo đỉnh (có "đèn" giả từ pháp tuyến), bỏ uv/normal để gộp được. */
function painted(g: THREE.BufferGeometry, color: number, shade = true): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  ng.computeVertexNormals();
  const n = ng.getAttribute('normal');
  const c = new THREE.Color(color);
  const col = new Float32Array(n.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    const k = shade ? 0.45 + 0.55 * Math.max(0, v.dot(LDIR)) : 1;
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ng.deleteAttribute('normal');
  ng.deleteAttribute('uv');
  return ng;
}

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  g.applyMatrix4(m);
  return g;
}

export function radialTex(stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- Trực thăng (4 draw call)
const ROTOR_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ROTOR_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x) - uTime * 31.0;
  // 4 cánh nhoè chuyển động: vệt sáng sau mỗi cánh
  float s = fract(a * 4.0 / 6.2831853);
  float blade = pow(1.0 - s, 6.0);
  float alpha = 0.10 + 0.45 * blade;
  alpha *= smoothstep(1.0, 0.9, r) * smoothstep(0.05, 0.16, r);
  alpha += smoothstep(0.98, 0.93, r) * smoothstep(0.88, 0.93, r) * 0.25; // vành đầu cánh
  alpha += smoothstep(0.12, 0.0, r) * 0.9; // trục
  gl_FragColor = vec4(vec3(0.78, 0.82, 0.9), alpha);
}`;

const LIGHT_VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
attribute vec3 aColor;
attribute vec3 aBlink; // x = tần số (0 = sáng liên tục), y = pha, z = kích thước (m)
varying vec3 vColor;
varying float vA;
void main() {
  float on = aBlink.x > 0.0 ? step(fract(uTime * aBlink.x + aBlink.y), 0.18) : 1.0;
  vA = on;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = on > 0.5 ? max(3.0, uPx * aBlink.z / -mv.z) : 0.0;
}`;
const LIGHT_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  if (vA < 0.5) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 5.0) + 0.6 * smoothstep(0.25, 0.0, d);
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

const CONE_VERT = /* glsl */ `
varying float vV;
void main() { vV = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CONE_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vV;
void main() {
  float a = pow(vV, 1.6) * uOpacity;
  gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * a, 1.0);
}`;

export interface Heli {
  group: THREE.Group;
  /** Chỗ đứng trên càng (cục bộ, ở mức sàn chân). */
  door: THREE.Vector3;
  update(time: number): void;
  dispose(): void;
}

export function createHeli(): Heli {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: number, shade = true) => parts.push(painted(g, color, shade));
  const BODY = 0x26324a;
  add(place(new THREE.SphereGeometry(1, 18, 12), 0, 0, 0, 3.0, 1.35, 1.25), BODY);
  add(place(new THREE.SphereGeometry(1, 14, 10), 1.85, 0.2, 0, 1.35, 0.95, 1.08), 0x7fd8ff, false); // kính buồng lái sáng
  add(place(new THREE.BoxGeometry(5.6, 0.18, 2.56), 0, -0.25, 0), 0xd0207a); // sọc sơn
  add(place(new THREE.BoxGeometry(1.4, 1.25, 0.06), 0.15, -0.1, -1.24), 0xffc46b, false); // cửa mở, trong sáng ấm
  add(place(new THREE.CylinderGeometry(0.38, 0.16, 6, 10), -5.2, 0.35, 0, 1, 1, 1, 0, 0, Math.PI / 2), BODY);
  add(place(new THREE.BoxGeometry(1.0, 1.7, 0.12), -8.0, 1.0, 0, 1, 1, 1, 0, 0, -0.35), 0xd0207a);
  add(place(new THREE.BoxGeometry(0.7, 0.08, 2.2), -7.4, 0.4, 0), BODY);
  add(place(new THREE.BoxGeometry(2.2, 0.65, 1.2), -0.5, 1.25, 0), 0x323e58);
  add(place(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8), 0, 1.7, 0), 0x55607a);
  for (const sz of [-1, 1]) {
    add(place(new THREE.BoxGeometry(4.4, 0.12, 0.12), 0.2, -1.95, sz * 1.05), 0x9aa3b5);
    for (const sx of [-1, 1]) add(place(new THREE.BoxGeometry(0.1, 0.65, 0.1), sx * 1.1 + 0.2, -1.62, sz * 0.98, 1, 1, 1, sz * 0.25, 0, 0), 0x9aa3b5);
  }
  const bodyGeo = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  // Rotor chính + rotor đuôi: 1 mesh, shader nhoè chuyển động
  const main = new THREE.CircleGeometry(6.0, 48).rotateX(-Math.PI / 2).translate(0, 2.0, 0);
  const tail = new THREE.CircleGeometry(1.15, 24).translate(-8.15, 1.15, 0.2);
  const rotorGeo = mergeGeometries([main.toNonIndexed(), tail.toNonIndexed()])!;
  main.dispose(); tail.dispose();
  const rotorMat = new THREE.ShaderMaterial({
    vertexShader: ROTOR_VERT, fragmentShader: ROTOR_FRAG, uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const rotor = new THREE.Mesh(rotorGeo, rotorMat);
  rotor.renderOrder = 6;

  // Đèn hàng hải: đỏ (trái), xanh (phải), chớp trắng đuôi, đèn hiệu đỏ trên nóc, chớp bụng
  const L: [number, number, number, number, number, number, number][] = [
    // x, y, z, màu, tần số, pha, cỡ
    [0.6, -0.25, -1.35, 0xff2030, 0, 0, 0.9],
    [0.6, -0.25, 1.35, 0x20ff60, 0, 0, 0.9],
    [-8.3, 1.9, 0, 0xffffff, 1.1, 0, 1.6],
    [-0.4, 1.6, 0, 0xff3030, 0.9, 0.5, 1.3],
    [0.5, -1.4, 0, 0xffffff, 1.1, 0.35, 1.4],
    [3.1, -0.3, 0, 0xfff2c0, 0, 0, 1.0],
  ];
  const lp = new Float32Array(L.length * 3), lc = new Float32Array(L.length * 3), lb = new Float32Array(L.length * 3);
  L.forEach(([x, y, z, c, f, ph, s], i) => {
    lp.set([x, y, z], i * 3);
    const col = new THREE.Color(c);
    lc.set([col.r, col.g, col.b], i * 3);
    lb.set([f, ph, s], i * 3);
  });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));
  lg.setAttribute('aBlink', new THREE.BufferAttribute(lb, 3));
  const lightMat = new THREE.ShaderMaterial({
    vertexShader: LIGHT_VERT, fragmentShader: LIGHT_FRAG,
    uniforms: { uTime: { value: 0 }, uPx: { value: 600 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const lights = new THREE.Points(lg, lightMat);
  lights.frustumCulled = false;
  lights.renderOrder = 7;

  // Đèn pha rọi xuống: nón mở, đỉnh ở bụng trực thăng
  const coneGeo = new THREE.ConeGeometry(7, 40, 28, 1, true).translate(0, -20, 0);
  const coneMat = new THREE.ShaderMaterial({
    vertexShader: CONE_VERT, fragmentShader: CONE_FRAG, uniforms: { uOpacity: { value: 0.16 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(2.4, -1.2, 0);
  cone.renderOrder = 4;

  const group = new THREE.Group();
  group.add(body, rotor, lights, cone);
  group.visible = false;

  return {
    group,
    door: new THREE.Vector3(0.3, -1.95, -1.15),
    update(time) {
      rotorMat.uniforms.uTime.value = time;
      lightMat.uniforms.uTime.value = time;
      lightMat.uniforms.uPx.value = window.innerHeight * 1.2;
      cone.rotation.set(0.25 + Math.sin(time * 0.6) * 0.18, 0, 0.35 + Math.sin(time * 0.43) * 0.2);
    },
    dispose() {
      bodyGeo.dispose(); bodyMat.dispose(); rotorGeo.dispose(); rotorMat.dispose();
      lg.dispose(); lightMat.dispose(); coneGeo.dispose(); coneMat.dispose();
    },
  };
}

// ---------------------------------------------------------------- Dù tròn sọc (2 draw call)
export interface Canopy {
  /** Gốc = điểm treo ở vai ca sĩ; mái dù phía trên +Y. */
  group: THREE.Group;
  /** Nhóm con để co giãn khi bung/xẹp (tâm co giãn = điểm treo). */
  inflate: THREE.Group;
  setOpacity(a: number): void;
  dispose(): void;
}

export function createCanopy(): Canopy {
  const R = 3.3, PHI = 1.1, SQ = 0.62, CY = 3.4;
  const dome = new THREE.SphereGeometry(R, 24, 8, 0, Math.PI * 2, 0, PHI).toNonIndexed();
  dome.scale(1, SQ, 1);
  dome.translate(0, CY, 0);
  const pos = dome.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const pal = [0xff2d6f, 0xffffff, 0xffc21a, 0x24c8ff, 0xffffff, 0x8b4bff].map((c) => new THREE.Color(c));
  for (let f = 0; f < pos.count; f += 3) {
    let cx = 0, cz = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cx += pos.getX(f + k); cy += pos.getY(f + k); cz += pos.getZ(f + k); }
    const a = (Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2);
    const c = pal[Math.floor(a * 12) % pal.length];
    const shade = 0.7 + 0.3 * ((cy / 3 - CY) / (R * SQ)); // đỉnh sáng hơn
    for (let k = 0; k < 3; k++) col.set([c.r * shade, c.g * shade, c.b * shade], (f + k) * 3);
  }
  dome.setAttribute('color', new THREE.BufferAttribute(col, 3));
  dome.deleteAttribute('normal');
  dome.deleteAttribute('uv');
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, transparent: true });
  const domeMesh = new THREE.Mesh(dome, domeMat);

  // Dây dù: 12 dây từ mép mái về 2 điểm treo trên vai
  const rimY = CY + R * Math.cos(PHI) * SQ, rimR = R * Math.sin(PHI);
  const lv: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * rimR, z = Math.sin(a) * rimR;
    lv.push(x, rimY, z, x > 0 ? 0.2 : -0.2, 0, 0);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe8e8f0, transparent: true, opacity: 0.75, fog: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);

  const inflate = new THREE.Group();
  inflate.add(domeMesh, lines);
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  group.add(inflate);
  group.visible = false;
  return {
    group, inflate,
    setOpacity(a) { domeMat.opacity = a; lineMat.opacity = 0.75 * a; },
    dispose() { dome.dispose(); domeMat.dispose(); lineGeo.dispose(); lineMat.dispose(); },
  };
}

// ---------------------------------------------------------------- Siêu anh hùng (5 draw call)
const STREAK_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float v = vUv.y; // 0 = đầu (ca sĩ), 1 = đuôi
  float a = pow(1.0 - v, 1.4) * uOpacity;
  a *= 0.8 + 0.2 * sin(vUv.x * 40.0 + uTime * 30.0 + v * 20.0);
  vec3 c = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.45, 0.15), smoothstep(0.0, 0.35, v));
  c = mix(c, vec3(0.75, 0.2, 1.0), smoothstep(0.35, 0.9, v));
  gl_FragColor = vec4(c * a, 1.0);
}`;

const FLOOR_VERT = /* glsl */ `
varying vec2 vP;
varying vec3 vW;
void main() {
  vP = (uv - 0.5) * 16.0;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FLOOR_FRAG = /* glsl */ `
uniform float uAge;
varying vec2 vP;
varying vec3 vW;
void main() {
  if (uAge < 0.0) discard;
  float r = length(vP);
  float ang = atan(vP.y, vP.x);
  // sóng xung kích
  float R = uAge * 15.0;
  float ring = exp(-pow((r - R) / 0.35, 2.0)) * (1.0 - smoothstep(0.0, 0.55, uAge));
  // vết nứt toả tia (chỉ trên mặt sàn: runway |x|<1,5 hoặc sân khấu z>-5)
  float n = 11.0;
  float seg = floor(ang * n / 6.2831853);
  float k = ang * n / 6.2831853 + 0.18 * sin(r * 2.7 + seg * 1.9);
  float d = abs(fract(k) - 0.5) * 6.2831853 / n * r;
  float len = 2.2 + 1.6 * fract(sin(seg * 12.9898) * 43758.5453);
  float crack = smoothstep(0.07, 0.0, d) * smoothstep(len, len * 0.6, r) * step(0.35, r);
  float onDeck = max(step(abs(vW.x), 1.5), step(-4.9, vW.z) * step(abs(vW.x), 12.8));
  float heat = exp(-uAge * 0.9) * 0.85 + 0.15;
  float scorch = exp(-r * r * 0.9) * (exp(-uAge * 1.5) * 1.2 + 0.25);
  vec3 col = vec3(0.6, 0.95, 1.0) * ring * 1.6
           + vec3(1.0, 0.55, 0.15) * crack * heat * onDeck * 1.4
           + vec3(1.0, 0.75, 0.4) * scorch * onDeck;
  gl_FragColor = vec4(col, 1.0);
}`;

const WAVE_FRAG = /* glsl */ `
uniform float uAge;
varying vec2 vP;
varying vec3 vW;
void main() {
  if (uAge < 0.0 || uAge > 2.6) discard;
  float r = length(vP) * (130.0 / 16.0);
  float R = 6.0 + 58.0 * (1.0 - pow(1.0 - min(uAge / 2.4, 1.0), 2.2));
  float w = 1.2 + R * 0.04;
  float ring = exp(-pow((r - R) / w, 2.0)) + 0.35 * exp(-pow((r - R + w * 2.5) / (w * 2.0), 2.0));
  float fade = 1.0 - smoothstep(1.4, 2.6, uAge);
  float front = smoothstep(-5.0, -6.5, vW.z); // chỉ quét qua khán giả, không quét sân khấu
  vec3 c = mix(vec3(0.3, 0.9, 1.0), vec3(1.0, 0.3, 0.85), 0.5 + 0.5 * sin(atan(vP.y, vP.x) * 3.0));
  gl_FragColor = vec4(c * ring * fade * front * 0.9, 1.0);
}`;

const SPARK_VERT = /* glsl */ `
uniform float uAge;
uniform float uPx;
attribute vec4 aSeed;
varying vec3 vColor;
varying float vA;
void main() {
  float dust = step(0.72, aSeed.w);
  float a = aSeed.x * 6.2831853;
  float sp = mix(5.0 + aSeed.y * 9.0, 1.5 + aSeed.y * 3.0, dust);
  float up = mix(2.0 + aSeed.z * 8.0, 0.6 + aSeed.z * 1.6, dust);
  float t = max(uAge, 0.0);
  float drag = mix(1.0, 0.35, dust);
  float tt = (1.0 - exp(-t * 2.2 / drag)) / (2.2 / drag);
  vec3 p = position + vec3(cos(a) * sp * tt, up * tt - 4.9 * t * t * (1.0 - dust * 0.9), sin(a) * sp * tt);
  p.y = max(p.y, position.y + 0.02);
  float life = mix(1.0 + aSeed.z * 0.6, 2.4, dust);
  vA = (uAge < 0.0) ? 0.0 : 1.0 - smoothstep(life * 0.5, life, t);
  vColor = mix(mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 1.0, 0.95), aSeed.y), vec3(0.55, 0.5, 0.6), dust);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vA > 0.0 ? max(1.5, uPx * mix(0.07, 0.5 + t * 0.4, dust) / -mv.z) : 0.0;
}`;
const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  if (vA <= 0.0) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.2, d) * vA;
  gl_FragColor = vec4(vColor, a * 0.85);
}`;

export interface HeroFx {
  group: THREE.Group;
  /** Đặt vệt sao chổi: đầu tại head, kéo dài về hướng dir (đơn vị) dài len. */
  setComet(head: THREE.Vector3, dir: THREE.Vector3, len: number, glow: number, time: number): void;
  /** Tuổi (giây) kể từ lúc chạm đất; < 0 = chưa. */
  setImpact(age: number): void;
  dispose(): void;
}

export function createHeroFx(land: THREE.Vector3): HeroFx {
  const group = new THREE.Group();
  group.visible = false;
  const disposables: { dispose(): void }[] = [];

  const streakGeo = new THREE.CylinderGeometry(0, 0.75, 1, 14, 1, true).translate(0, 0.5, 0);
  // uv.y của CylinderGeometry: 1 ở đỉnh → đổi sang 0 ở đáy(đầu)...: đáy (y=0) có uv.y=0 → đúng quy ước
  const streakMat = new THREE.ShaderMaterial({
    vertexShader: ROTOR_VERT, fragmentShader: STREAK_FRAG,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const streak = new THREE.Mesh(streakGeo, streakMat);
  streak.frustumCulled = false;
  disposables.push(streakGeo, streakMat);

  const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,240,200,0.9)'], [0.5, 'rgba(255,140,60,0.35)'], [1, 'rgba(160,60,255,0)']]);
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true });
  const glow = new THREE.Sprite(glowMat);
  glow.renderOrder = 8;
  disposables.push(glowTex, glowMat);

  const floorGeo = new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2);
  const floorMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, uniforms: { uAge: { value: -1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(land.x, 0.03, land.z);
  floor.renderOrder = 3;
  disposables.push(floorGeo, floorMat);

  const waveGeo = new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2);
  const waveMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT, fragmentShader: WAVE_FRAG, uniforms: { uAge: { value: -1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const wave = new THREE.Mesh(waveGeo, waveMat);
  wave.position.set(land.x, 0.35, land.z);
  wave.renderOrder = 3;
  disposables.push(waveGeo, waveMat);

  const N = 320;
  const sp = new Float32Array(N * 3), ss = new Float32Array(N * 4);
  let s = 777;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) {
    sp.set([land.x + (rnd() - 0.5) * 0.6, 0.1, land.z + (rnd() - 0.5) * 0.6], i * 3);
    ss.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 4));
  const sparkMat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
    uniforms: { uAge: { value: -1 }, uPx: { value: 600 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  sparks.renderOrder = 7;
  disposables.push(sparkGeo, sparkMat);

  group.add(streak, glow, floor, wave, sparks);
  const UP = new THREE.Vector3(0, 1, 0);

  return {
    group,
    setComet(head, dir, len, g, time) {
      streak.visible = len > 0.05;
      streak.position.copy(head);
      streak.quaternion.setFromUnitVectors(UP, dir);
      streak.scale.set(Math.max(0.2, g), len, Math.max(0.2, g));
      streakMat.uniforms.uTime.value = time;
      glow.visible = g > 0.01;
      glow.position.copy(head);
      glow.scale.setScalar(1.5 + 5 * g);
      glowMat.opacity = Math.min(1, g);
    },
    setImpact(age) {
      floorMat.uniforms.uAge.value = age;
      waveMat.uniforms.uAge.value = age;
      sparkMat.uniforms.uAge.value = age;
      sparkMat.uniforms.uPx.value = window.innerHeight * 1.2;
      floor.visible = wave.visible = sparks.visible = age >= 0;
    },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}
