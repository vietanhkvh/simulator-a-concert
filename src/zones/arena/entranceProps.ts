// Đạo cụ cho cảnh mở màn (entrance.ts): trực thăng + dù, sao chổi + hiệu ứng chạm đất.
// Toàn bộ là mesh gộp, vật liệu không cần đèn, fog:false; hoạt ảnh bằng uniform/shader.
import { viewHeightPx } from '../../world/shared/viewport';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIELD_Y } from '../../world/layout';
import { INK, PAL, SKIN, HAIR, shadowOf } from '../../world/style';

/** Màu cho shader thô (không qua colorspace_fragment): giá trị sRGB của token. */
const glsl = (hex: number) => {
  const c = new THREE.Color(hex).convertLinearToSRGB();
  return `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`;
};

const LDIR = new THREE.Vector3(0.35, 0.8, -0.5).normalize();

/** Tô màu theo đỉnh (có "đèn" giả từ pháp tuyến), bỏ uv/normal để gộp được. */
function painted(g: THREE.BufferGeometry, color: number, shade = true): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  ng.computeVertexNormals();
  const n = ng.getAttribute('normal');
  // tô đồ chơi 2 bậc: thân (500) ↔ bóng dịch về tím (shadowOf), ngưỡng mềm; viền rim nhạt ở mặt trên
  const c = new THREE.Color(color);
  const cs = new THREE.Color(shadowOf(color));
  const col = new Float32Array(n.count * 3);
  const v = new THREE.Vector3();
  const tmpC = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    const d = v.dot(LDIR);
    const k = shade ? Math.min(1, Math.max(0, (d + 0.05) / 0.25)) : 1;
    tmpC.copy(cs).lerp(c, k);
    col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
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

/** Sao 5 cánh đầu tròn dạng tấm dày (mặt hướng +Z). */
function starGeo(r: number, depth: number): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.5;
    if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: r * 0.12, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
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
const ROTOR_FRAG = () => /* glsl */ `
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
  alpha *= 0.7; // đĩa nhoè mềm hơn
  alpha += smoothstep(0.12, 0.0, r) * 0.9; // trục
  gl_FragColor = vec4(mix(${glsl(PAL.cream[300])}, ${glsl(PAL.soda[300])}, smoothstep(0.85, 0.98, r)), alpha);
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
const CONE_FRAG = () => /* glsl */ `
uniform float uOpacity;
varying float vV;
void main() {
  float a = pow(vV, 2.2) * uOpacity * 0.8; // nón rọi mềm, kem
  gl_FragColor = vec4(${glsl(PAL.cream[300])} * a, 1.0);
}`;

export interface Heli {
  group: THREE.Group;
  /** Chỗ đứng trên càng (cục bộ, ở mức sàn chân). */
  door: THREE.Vector3;
  update(time: number): void;
  /** Rọi đèn pha vào điểm (thế giới); null = quét tự do. Gọi trước update(). */
  aim(target: THREE.Vector3 | null): void;
  dispose(): void;
}

export function createHeli(): Heli {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: number, shade = true) => parts.push(painted(g, color, shade));
  // Trực thăng đồ chơi mập: thân trứng (dài ≤ 2,2 × đường kính, tính cả đuôi ngắn), vòm kính bong bóng có phi công chibi,
  // đuôi ngắn cong, càng bo tròn; cream / berry / soda + huy hiệu sao. Phương tiện: không có mặt.
  const BODY = PAL.cream[500], TRIM = PAL.berry[500], ACC = PAL.soda[500];
  add(place(new THREE.SphereGeometry(1, 22, 16), -0.2, 0, 0, 2.15, 1.6, 1.4), BODY);            // thân trứng Ø≈2,8–3,2
  add(place(new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), -0.2, 0.05, 0, 2.18, 1.63, 1.43), TRIM); // bụng berry
  add(place(new THREE.TorusGeometry(1, 0.09, 8, 32), -0.2, -0.2, 0, 2.12, 1.38, 1.0, Math.PI / 2, 0, 0), ACC); // đai soda
  add(place(new THREE.SphereGeometry(1, 18, 14), 1.15, 0.35, 0, 1.05, 1.0, 1.05), PAL.soda[100], false); // vòm kính bong bóng
  add(place(new THREE.BoxGeometry(1.2, 1.15, 0.06), 0.0, -0.15, -1.36), PAL.honey[300], false); // cửa mở, trong sáng ấm
  // phi công chibi trong vòm (đầu to, mũ bảo hiểm berry, mắt chấm, má hồng)
  add(place(new THREE.SphereGeometry(0.36, 14, 10), 1.35, 0.42, 0, 1, 0.95, 1), SKIN[1]!);
  add(place(new THREE.SphereGeometry(0.39, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 1.33, 0.48, 0), TRIM);
  add(place(new THREE.SphereGeometry(0.39, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), 1.3, 0.48, 0, 1.02, 1.02, 1.02, 0, 0, -0.5), HAIR[4]!);
  for (const sz of [-1, 1]) {
    add(place(new THREE.SphereGeometry(0.05, 8, 6), 1.68, 0.44, sz * 0.12, 0.6, 1.3, 1), INK, false);
    add(place(new THREE.SphereGeometry(0.05, 8, 6), 1.66, 0.33, sz * 0.21, 0.4, 0.6, 1), PAL.berry[300], false);
  }
  add(place(new THREE.SphereGeometry(0.42, 12, 8), 1.2, -0.12, 0, 1, 0.7, 1.1), ACC); // thân phi công
  // huy hiệu sao hai bên
  for (const sz of [-1, 1]) {
    add(place(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 24), -0.9, 0.25, sz * 1.36, 1, 1, 1, Math.PI / 2, 0, 0), TRIM, false);
    add(place(starGeo(0.4, 0.07), -0.9, 0.25, sz * 1.4, 1, 1, 1, 0, sz > 0 ? 0 : Math.PI, 0), PAL.honey[500], false);
  }
  // đuôi ngắn mập cong lên + vây tròn + rotor đuôi
  add(place(new THREE.CapsuleGeometry(0.34, 1.6, 6, 12), -2.75, 0.5, 0, 1, 1, 1, 0, 0, Math.PI / 2 - 0.25), BODY);
  add(place(new THREE.SphereGeometry(0.62, 16, 12), -3.65, 0.95, 0, 0.9, 1.0, 0.28), TRIM);
  add(place(new THREE.CapsuleGeometry(0.16, 0.9, 4, 10), -3.45, 0.55, 0, 1, 1, 1, Math.PI / 2, 0, 0), TRIM);
  // trụ rotor + mũ cầu
  add(place(new THREE.CylinderGeometry(0.22, 0.3, 0.45, 14), -0.2, 1.65, 0), ACC);
  add(place(new THREE.SphereGeometry(0.3, 14, 10), -0.2, 1.92, 0, 1, 0.6, 1), TRIM);
  // càng bo tròn (ống capsule) + chân
  for (const sz of [-1, 1]) {
    add(place(new THREE.CapsuleGeometry(0.13, 3.6, 6, 10), 0.2, -1.95, sz * 1.05, 1, 1, 1, 0, 0, Math.PI / 2), PAL.grape[300]);
    for (const sx of [-1, 1]) add(place(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), sx * 0.9 + 0.2, -1.6, sz * 0.95, 1, 1, 1, sz * 0.25, 0, 0), PAL.grape[300]);
  }
  const bodyGeo = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  // Rotor chính + rotor đuôi: 1 mesh, shader nhoè chuyển động
  const main = new THREE.CircleGeometry(4.4, 48).rotateX(-Math.PI / 2).translate(-0.2, 2.05, 0);
  const tail = new THREE.CircleGeometry(0.8, 24).translate(-3.75, 0.95, 0.3);
  const rotorGeo = mergeGeometries([main.toNonIndexed(), tail.toNonIndexed()])!;
  main.dispose(); tail.dispose();
  const rotorMat = new THREE.ShaderMaterial({
    vertexShader: ROTOR_VERT, fragmentShader: ROTOR_FRAG(), uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const rotor = new THREE.Mesh(rotorGeo, rotorMat);
  rotor.renderOrder = 6;

  // Đèn hàng hải: đỏ (trái), xanh (phải), chớp trắng đuôi, đèn hiệu đỏ trên nóc, chớp bụng
  const L: [number, number, number, number, number, number, number][] = [
    // x, y, z, màu, tần số, pha, cỡ
    [0.6, -0.25, -1.45, PAL.berry[500], 0, 0, 0.9],
    [0.6, -0.25, 1.45, PAL.mint[500], 0, 0, 0.9],
    [-3.9, 1.5, 0, PAL.cream[300], 1.1, 0, 1.2],
    [-0.2, 2.2, 0, PAL.berry[300], 0.9, 0.5, 1.1],
    [0.3, -1.6, 0, PAL.honey[300], 1.1, 0.35, 1.1],
    [2.15, -0.1, 0, PAL.cream[300], 0, 0, 1.0],
  ];
  const lp = new Float32Array(L.length * 3), lc = new Float32Array(L.length * 3), lb = new Float32Array(L.length * 3);
  L.forEach(([x, y, z, c, f, ph, s], i) => {
    lp.set([x, y, z], i * 3);
    const col = new THREE.Color(c).convertLinearToSRGB();
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
  const coneGeo = new THREE.ConeGeometry(6, 40, 32, 1, true).translate(0, -20, 0);
  const coneMat = new THREE.ShaderMaterial({
    vertexShader: CONE_VERT, fragmentShader: CONE_FRAG(), uniforms: { uOpacity: { value: 0.16 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(1.6, -1.3, 0);
  cone.renderOrder = 4;

  const group = new THREE.Group();
  group.add(body, rotor, lights, cone);
  group.visible = false;

  let aimAt: THREE.Vector3 | null = null;
  const aimTmp = new THREE.Vector3();
  const DOWN = new THREE.Vector3(0, -1, 0);
  return {
    group,
    door: new THREE.Vector3(0.3, -1.95, -1.15),
    aim(target) { aimAt = target ? (aimAt ?? new THREE.Vector3()).copy(target) : null; },
    update(time) {
      rotorMat.uniforms.uTime.value = time;
      lightMat.uniforms.uTime.value = time;
      lightMat.uniforms.uPx.value = viewHeightPx() * 1.2;
      if (aimAt) {
        group.updateMatrixWorld(true);
        group.worldToLocal(aimTmp.copy(aimAt)).sub(cone.position).normalize();
        cone.quaternion.setFromUnitVectors(DOWN, aimTmp);
      } else cone.rotation.set(0.25 + Math.sin(time * 0.6) * 0.18, 0, 0.35 + Math.sin(time * 0.43) * 0.2);
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
const STREAK_FRAG = () => /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float v = vUv.y; // 0 = đầu (ca sĩ), 1 = đuôi
  float a = pow(1.0 - v, 1.4) * uOpacity;
  a *= 0.8 + 0.2 * sin(vUv.x * 40.0 + uTime * 30.0 + v * 20.0);
  vec3 c = mix(${glsl(PAL.cream[300])}, ${glsl(PAL.honey[500])}, smoothstep(0.0, 0.35, v));
  c = mix(c, ${glsl(PAL.berry[500])}, smoothstep(0.35, 0.9, v));
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
const FLOOR_FRAG = () => /* glsl */ `
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
  float crack = smoothstep(0.11, 0.02, d) * smoothstep(len, len * 0.6, r) * step(0.35, r);
  float onDeck = max(step(abs(vW.x), 1.5), step(-4.9, vW.z) * step(abs(vW.x), 12.8));
  float heat = exp(-uAge * 0.9) * 0.85 + 0.15;
  float scorch = exp(-r * r * 1.4) * (exp(-uAge * 3.0) * 0.6 + 0.12);
  // vòng xung kích soda, vết nứt honey → berry, quầng giữa kem/peach
  vec3 col = ${glsl(PAL.soda[300])} * ring * 1.3
           + mix(${glsl(PAL.berry[500])}, ${glsl(PAL.honey[500])}, heat) * crack * heat * onDeck * 1.2
           + ${glsl(PAL.peach[300])} * scorch * onDeck * 0.8;
  gl_FragColor = vec4(col, 1.0);
}`;

const WAVE_FRAG = () => /* glsl */ `
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
  vec3 c = mix(${glsl(PAL.soda[500])}, ${glsl(PAL.berry[500])}, 0.5 + 0.5 * sin(atan(vP.y, vP.x) * 3.0));
  gl_FragColor = vec4(c * ring * fade * front * 0.9, 1.0);
}`;

const SPARK_VERT = () => /* glsl */ `
uniform float uAge;
uniform float uPx;
attribute vec4 aSeed;
varying vec3 vColor;
varying float vA;
varying float vStar;
varying float vSpin;
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
  vColor = mix(mix(${glsl(PAL.honey[500])}, ${glsl(PAL.cream[300])}, aSeed.y * aSeed.y), ${glsl(PAL.grape[700])} * 0.45, dust);
  vStar = 1.0 - dust;
  vSpin = aSeed.z * 6.28 + t * (aSeed.x - 0.5) * 8.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vA > 0.0 ? max(1.5, uPx * mix(0.14, 0.3 + t * 0.25, dust) / -mv.z) : 0.0;
}`;
const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
varying float vStar;
varying float vSpin;
float star5(vec2 p, float r) {
  float a = atan(p.x, p.y);
  float k = 6.2831853 / 5.0;
  float m = abs(mod(a + k * 0.5, k) - k * 0.5);
  float rr = r * mix(0.48, 1.0, pow(max(cos(m * 2.5), 0.0), 3.0));
  return smoothstep(rr + 0.08, rr - 0.04, length(p));
}
void main() {
  if (vA <= 0.0) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float c = cos(vSpin), s = sin(vSpin);
  p = mat2(c, -s, s, c) * p;
  // tia lửa = sao nhỏ; bụi = cục bông tròn mềm
  float m = vStar > 0.5 ? star5(p, 0.9) : smoothstep(1.0, 0.35, length(p));
  gl_FragColor = vec4(vColor, m * vA * 0.9);
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
    vertexShader: ROTOR_VERT, fragmentShader: STREAK_FRAG(),
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
    vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG(), uniforms: { uAge: { value: -1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(land.x, 0.03, land.z);
  floor.renderOrder = 3;
  disposables.push(floorGeo, floorMat);

  const waveGeo = new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2);
  const waveMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT, fragmentShader: WAVE_FRAG(), uniforms: { uAge: { value: -1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const wave = new THREE.Mesh(waveGeo, waveMat);
  wave.position.set(land.x, FIELD_Y + 2.0, land.z); // vòng sáng quét ngang đầu khán giả
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
    vertexShader: SPARK_VERT(), fragmentShader: SPARK_FRAG,
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
      streak.scale.set(Math.max(0.3, g * 1.7), len, Math.max(0.3, g * 1.7));
      streakMat.uniforms.uTime.value = time;
      glow.visible = g > 0.01;
      glow.position.copy(head);
      glow.scale.setScalar(2 + 7 * g);
      glowMat.opacity = Math.min(1, g);
    },
    setImpact(age) {
      floorMat.uniforms.uAge.value = age;
      waveMat.uniforms.uAge.value = age;
      sparkMat.uniforms.uAge.value = age;
      sparkMat.uniforms.uPx.value = viewHeightPx() * 1.2;
      floor.visible = wave.visible = sparks.visible = age >= 0;
    },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}

// ---------------------------------------------------------------- Dây tời (1 draw call)
export interface Cable {
  group: THREE.Group;
  /** Kéo dây từ a (trên) tới b (dưới). */
  set(a: THREE.Vector3, b: THREE.Vector3): void;
  dispose(): void;
}

export function createCable(): Cable {
  // dây thừng kẹo: 2 sợi xoắn berry/cream (dải sọc theo chiều dài) — co giãn theo y nên sọc giãn theo; móc tròn ở đầu dưới
  const rope = new THREE.CylinderGeometry(0.06, 0.06, 1, 10, 24, true).translate(0, -0.5, 0).toNonIndexed();
  {
    const pos = rope.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color(PAL.berry[500]), b = new THREE.Color(PAL.cream[500]);
    const cc = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      let y = 0, ang = 0;
      for (let k = 0; k < 3; k++) { y += pos.getY(i + k) / 3; ang += Math.atan2(pos.getZ(i + k), pos.getX(i + k)) / 3; }
      const stripe = Math.sin(ang * 2 + y * 60) > 0;
      cc.copy(stripe ? a : b);
      for (let k = 0; k < 3; k++) col.set([cc.r, cc.g, cc.b], (i + k) * 3);
    }
    rope.setAttribute('color', new THREE.BufferAttribute(col, 3));
    rope.deleteAttribute('normal'); rope.deleteAttribute('uv');
  }
  const parts = [rope];
  const geo = mergeGeometries(parts)!;
  parts[0].dispose();
  // móc tròn (vòng xuyến honey + cầu nối), mesh riêng không co giãn → cùng vật liệu, +1 draw call
  const hookParts = [
    painted(new THREE.TorusGeometry(0.2, 0.07, 8, 20, Math.PI * 1.6).rotateZ(-Math.PI * 0.3).translate(0, -0.25, 0), PAL.honey[500]),
    painted(new THREE.SphereGeometry(0.12, 12, 8), PAL.berry[500]),
  ];
  const hookGeo = mergeGeometries(hookParts)!;
  for (const g of hookParts) g.dispose();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const line = new THREE.Mesh(geo, mat);
  line.frustumCulled = false;
  const hook = new THREE.Mesh(hookGeo, mat);
  hook.frustumCulled = false;
  const group = new THREE.Group();
  group.add(line, hook);
  group.visible = false;
  const DOWN = new THREE.Vector3(0, -1, 0), d = new THREE.Vector3();
  return {
    group,
    set(a, b) {
      d.subVectors(b, a);
      const len = d.length();
      line.visible = len > 0.05;
      line.position.copy(a);
      if (len > 1e-4) line.quaternion.setFromUnitVectors(DOWN, d.multiplyScalar(1 / len));
      line.scale.set(1, Math.max(len, 1e-3), 1);
      hook.visible = line.visible;
      hook.position.copy(b).addScaledVector(d, -0.15);
      hook.quaternion.copy(line.quaternion);
    },
    dispose() { geo.dispose(); hookGeo.dispose(); mat.dispose(); },
  };
}

// ---------------------------------------------------------------- Bục nâng sân khấu (4 draw call)
const SHAFT_VERT = /* glsl */ `
attribute float aK;
varying vec2 vUv;
varying float vK;
varying float vFace;
void main() {
  vUv = uv; vK = aK;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // mặt nhìn nghiêng (mép cột) mờ hơn → cột tròn mềm, không thành tấm sáng đặc khi nhiều lớp chồng
  vec3 n = normalize(normalMatrix * normal);
  vFace = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
// Cột sáng (aK = 0: kem → nho nhạt) + 6 tia (aK = 1 honey, 2 berry). Additive nên mỗi lớp chỉ ~0,1–0,25:
// chồng 3–4 lớp vẫn ra màu kẹo, không cháy trắng (lỗi cũ: kem + soda gần trắng, cắt về 0,05 thì mất hẳn).
const SHAFT_FRAG = () => /* glsl */ `
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
varying float vK;
varying float vFace;
void main() {
  float v = vUv.y; // 0 = chân, 1 = ngọn
  float flick = 0.85 + 0.15 * sin(vUv.x * 30.0 + uTime * 3.0);
  vec3 c;
  float a;
  if (vK < 0.5) {
    c = mix(${glsl(PAL.cream[300])}, ${glsl(PAL.grape[300])}, smoothstep(0.0, 0.7, v)) * 0.8;
    a = pow(1.0 - v, 1.6) * 0.16 * (0.35 + 0.65 * vFace);
  } else {
    c = vK < 1.5 ? ${glsl(PAL.honey[500])} : ${glsl(PAL.berry[500])};
    a = pow(1.0 - v, 1.3) * 0.3 * (0.4 + 0.6 * vFace);
  }
  gl_FragColor = vec4(c * a * uOpacity * flick, 1.0);
}`;

const LIFTP_VERT = () => /* glsl */ `
uniform float uT;
uniform float uLock;
uniform float uSmoke;
uniform float uPx;
attribute vec4 aSeed;
attribute float aType;
varying vec3 vColor;
varying float vA;
void main() {
  vec3 p = position;
  float size = 0.1;
  vA = 0.0;
  vColor = vec3(1.0);
  if (aType < 0.5) { // khói từ miệng hầm
    float L = 2.6;
    float ph = fract((uT + aSeed.x * L) / L);
    float ang = aSeed.y * 6.2831853;
    float rr = (0.3 + aSeed.z * 0.8) * (0.4 + ph);
    p += vec3(cos(ang) * rr, ph * (2.5 + aSeed.w * 2.0), sin(ang) * rr);
    size = 0.7 + ph * 2.2;
    // additive: ~10–20 cục chồng nhau ở tâm → mỗi cục chỉ ~0,05 và màu kẹo đậm, tránh cháy trắng
    vA = sin(ph * 3.14159) * 0.055 * uSmoke;
    vColor = mix(${glsl(PAL.grape[500])}, ${glsl(PAL.berry[300])}, aSeed.w);
  } else if (aType < 1.5) { // cột CO2 ở bốn góc
    float L = 0.7;
    float ph = fract((uLock + aSeed.x * L) / L);
    float on = step(0.0, uLock) * (1.0 - smoothstep(1.3, 1.9, uLock));
    float ang = aSeed.y * 6.2831853;
    p += vec3(cos(ang) * ph * 0.5, ph * (4.5 + aSeed.z * 2.0), sin(ang) * ph * 0.5);
    size = 0.3 + ph * 1.5;
    vA = (1.0 - ph) * 0.13 * on;
    vColor = mix(${glsl(PAL.soda[300])}, ${glsl(PAL.cream[300])}, aSeed.w * 0.5);
  } else { // tia lửa
    float t = uLock;
    float a = aSeed.x * 6.2831853;
    float sp = 0.8 + aSeed.y * 2.2;
    float up = 4.0 + aSeed.z * 5.0;
    p += vec3(cos(a) * sp * t, up * t - 4.9 * t * t, sin(a) * sp * t);
    p.y = max(p.y, 0.05);
    size = 0.12;
    vA = t < 0.0 ? 0.0 : 1.0 - smoothstep(0.6, 1.3 + aSeed.w * 0.4, t);
    vColor = mix(${glsl(PAL.honey[500])}, ${glsl(PAL.cream[300])}, aSeed.w);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vA > 0.0 ? max(1.5, uPx * size / -mv.z) : 0.0;
}`;
const LIFTP_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  if (vA <= 0.0) discard;
  // khói/CO2 = cục bông tròn có viền mềm rõ; tia lửa nhỏ cũng tròn
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (0.55 + 0.45 * smoothstep(1.0, 0.2, d)) * smoothstep(1.0, 0.82, d) * vA;
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

export interface LiftFx {
  group: THREE.Group;
  /** open: 0..1 độ mở nắp hầm; deckY: mặt bục (m); light: 0..1 cột sáng; lockAge: giây từ lúc khoá (<0 = chưa). */
  set(open: number, deckY: number, light: number, smoke: number, lockAge: number, time: number): void;
  dispose(): void;
}

export function createLiftFx(land: THREE.Vector3): LiftFx {
  const group = new THREE.Group();
  group.position.set(land.x, 0, land.z);
  group.visible = false;
  const disposables: { dispose(): void }[] = [];
  const R = 1.2;

  const hatchGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const hatchMat = new THREE.MeshBasicMaterial({ color: PAL.night[700], fog: false });
  const hatch = new THREE.Mesh(hatchGeo, hatchMat);
  hatch.position.y = 0.02;
  hatch.renderOrder = 2;
  disposables.push(hatchGeo, hatchMat);

  const pp: THREE.BufferGeometry[] = [];
  pp.push(painted(new THREE.CylinderGeometry(R, R, 0.4, 40).translate(0, -0.2 + 0.05, 0), PAL.night[300]));
  pp.push(painted(new THREE.TorusGeometry(R - 0.02, 0.1, 10, 48).rotateX(Math.PI / 2).translate(0, 0.04, 0), PAL.soda[300], false)); // vành sáng tròn mập
  pp.push(painted(new THREE.TorusGeometry(R * 0.62, 0.04, 6, 40).rotateX(Math.PI / 2).translate(0, 0.055, 0), PAL.berry[300], false));
  pp.push(painted(starGeo(R * 0.42, 0.03).rotateX(-Math.PI / 2).translate(0, 0.06, 0), PAL.honey[500], false)); // sao khảm giữa bục
  pp.push(painted(new THREE.TorusGeometry(R + 0.02, 0.07, 8, 48).rotateX(Math.PI / 2).translate(0, -0.3, 0), PAL.soda[500], false));
  for (let i = 0; i < 12; i++) { // bóng đèn tròn quanh mép
    const a = (i / 12) * Math.PI * 2;
    pp.push(painted(new THREE.SphereGeometry(0.075, 8, 6).translate(Math.cos(a) * (R + 0.05), -0.13, Math.sin(a) * (R + 0.05)), i % 2 ? PAL.honey[300] : PAL.berry[300], false));
  }
  const platGeo = mergeGeometries(pp)!;
  for (const g of pp) g.dispose();
  const platMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const plat = new THREE.Mesh(platGeo, platMat);
  disposables.push(platGeo, platMat);

  const tagK = (g: THREE.BufferGeometry, k: number) => {
    g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(k), 1));
    return g;
  };
  const sg: THREE.BufferGeometry[] = [tagK(new THREE.CylinderGeometry(1.7, R, 8, 32, 1, true).translate(0, 4, 0).toNonIndexed(), 0)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const g = new THREE.CylinderGeometry(0.4, 0.04, 10, 10, 1, true).translate(0, 5, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), 0.38));
    g.translate(Math.cos(a) * R, 0, Math.sin(a) * R);
    sg.push(tagK(g.toNonIndexed(), 1 + (i % 2)));
    g.dispose();
  }
  const shaftGeo = mergeGeometries(sg)!;
  for (const g of sg) g.dispose();
  const shaftMat = new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG(), uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.renderOrder = 5;
  disposables.push(shaftGeo, shaftMat);

  const NS = 40, NC = 4 * 24, NK = 4 * 40, N = NS + NC + NK;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4), type = new Float32Array(N);
  let s = 4242;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const C = [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]];
  for (let i = 0; i < N; i++) {
    let ty = 0, x = 0, z = 0;
    if (i >= NS && i < NS + NC) { ty = 1; [x, z] = C[(i - NS) % 4]; }
    else if (i >= NS + NC) { ty = 2; [x, z] = C[(i - NS - NC) % 4]; }
    pos.set([x, 0.05, z], i * 3);
    seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    type[i] = ty;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  pg.setAttribute('aType', new THREE.BufferAttribute(type, 1));
  const pMat = new THREE.ShaderMaterial({
    vertexShader: LIFTP_VERT(), fragmentShader: LIFTP_FRAG,
    uniforms: { uT: { value: 0 }, uLock: { value: -1 }, uSmoke: { value: 0 }, uPx: { value: 600 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const particles = new THREE.Points(pg, pMat);
  particles.frustumCulled = false;
  particles.renderOrder = 7;
  disposables.push(pg, pMat);

  group.add(hatch, plat, shaft, particles);
  return {
    group,
    set(open, deckY, light, smoke, lockAge, time) {
      hatch.visible = open > 0.01 && lockAge < 0;
      hatch.scale.setScalar(Math.max(0.001, open * 1.28));
      plat.position.y = deckY;
      shaftMat.uniforms.uOpacity.value = light; // cường độ từng lớp nằm trong SHAFT_FRAG (màu kẹo, không trắng xoá)
      shaftMat.uniforms.uTime.value = time;
      shaft.visible = light > 0.01;
      shaft.position.y = Math.min(0, deckY);
      pMat.uniforms.uT.value = time;
      pMat.uniforms.uLock.value = lockAge;
      pMat.uniforms.uSmoke.value = smoke;
      pMat.uniforms.uPx.value = viewHeightPx() * 1.2;
    },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}
