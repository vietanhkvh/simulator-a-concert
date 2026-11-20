// "Mực & Sơn mài" — khe `ledWall`: mặt trời trống đồng Đông Sơn (14 tia, vành chim Lạc / hươu / vòng tròn tiếp tuyến,
// vành quay chậm, tia nhịp theo phách, màu theo hypeColors) trước bình phong sơn mài 5 tấm vẽ vàng.
// 3 draw call: mặt trống (shader), tranh bình phong (canvas texture), khung (vertex colour).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { LED_WALL } from '../../../../world/layout';
import { hypeColors, toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { DRUM_GLSL, Kit, R, kitMaterial } from './stageKit';

const DRUM_FRAG = /* glsl */ `
uniform float uTime; uniform float uBeat; uniform float uHype; uniform float uRot;
uniform vec3 uBase; uniform vec3 uBase2; uniform vec3 uGold; uniform vec3 uGoldHi; uniform vec3 uA; uniform vec3 uC;
varying vec2 vUv;
${DRUM_GLSL}
void main(){
  vec2 q = (vUv - 0.5) * 2.0 * 1.22;
  float r = length(q);
  if (r > 1.22) discard;
  if (r > 1.0) { // quầng mềm quanh mặt trống
    float h = smoothstep(1.22, 1.0, r);
    gl_FragColor = vec4(mix(uGold, uA, 0.5) * (0.5 + 0.3 * uBeat * uHype), h * h * (0.35 + 0.35 * uHype));
    return;
  }
  vec2 d = drumFace(q, uTime, uRot);
  vec3 base = mix(uBase, uBase2, smoothstep(1.0, 0.1, r) * 0.6);
  vec3 gold = mix(uGold, uA, 0.28 + 0.2 * uHype);
  vec3 col = mix(base, gold, d.x);
  // tia: sáng theo phách, ngả sang accent ở Hype cao
  vec3 rayC = mix(uGoldHi, uA, 0.35) * (0.95 + 0.55 * uBeat * (0.4 + uHype));
  col = mix(col, mix(rayC, uC, 0.25 * uHype), d.y);
  col += uA * 0.12 * smoothstep(0.35, 0.0, r) * (0.4 + uBeat);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Tranh bình phong: núi, sen, hạc, mây cuộn bằng vàng quỳ trên sơn then (canvas, vẽ khi dựng). */
function screenTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const P = R();
  const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const W = 1600, H = 640;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, hx(P.lac[300])); grd.addColorStop(1, hx(P.lac[700]));
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = hx(P.gold[500]); g.fillStyle = hx(P.gold[700]);
  // núi xa (dải loang vàng sẫm)
  g.globalAlpha = 0.55;
  g.beginPath(); g.moveTo(0, H * 0.72);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, H * (0.6 + 0.12 * Math.sin(x * 0.011) + 0.06 * Math.sin(x * 0.037)));
  g.lineTo(W, H); g.lineTo(0, H); g.fill();
  g.globalAlpha = 1;
  // mây cuộn (nét cọ)
  g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = 90 + i * 180, y = 90 + (i % 3) * 40;
    g.beginPath(); g.arc(x, y, 22, Math.PI * 0.2, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.moveTo(x + 20, y + 8); g.quadraticCurveTo(x + 70, y + 20, x + 110, y - 4); g.stroke();
  }
  // hạc bay
  g.lineWidth = 4; g.strokeStyle = hx(P.silk[500]);
  for (let i = 0; i < 6; i++) {
    const x = 160 + i * 250, y = 200 + (i % 2) * 50;
    g.beginPath(); g.moveTo(x - 40, y - 18); g.quadraticCurveTo(x - 10, y + 6, x, y); g.quadraticCurveTo(x + 14, y + 4, x + 46, y - 22); g.stroke();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 34, y + 10); g.stroke();
  }
  // sen: lá tròn + bông
  for (let i = 0; i < 10; i++) {
    const x = 80 + i * 160 + (i % 2) * 30, y = H - 60 - (i % 3) * 26;
    g.fillStyle = hx(P.gold[700]); g.beginPath(); g.ellipse(x + 40, y + 20, 46, 14, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = hx(P.gold[500]); g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + 30); g.quadraticCurveTo(x - 6, y - 40, x, y - 80); g.stroke();
    g.fillStyle = hx(i % 3 === 0 ? P.son[500] : P.gold[300]);
    for (const [dx, rot] of [[-14, -0.5], [14, 0.5], [0, 0]] as const) {
      g.save(); g.translate(x + dx * 0.6, y - 94); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, 11, 26, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  // đường chia tấm + viền kép vàng
  g.strokeStyle = hx(P.gold[500]);
  for (let i = 0; i < 5; i++) {
    const x0 = (i * W) / 5;
    g.lineWidth = 6; g.strokeRect(x0 + 14, 14, W / 5 - 28, H - 28);
    g.lineWidth = 2; g.strokeRect(x0 + 26, 26, W / 5 - 52, H - 52);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createLacquerLedWall(ctx: ArenaBuildContext) {
  const { scene, uniforms } = ctx;
  const P = R();
  const disposables: { dispose(): void }[] = [];
  const objs: THREE.Object3D[] = [];

  // ── bình phong 5 tấm gấp khúc ──
  const PW = 5.5, PH = 10.6, Y0 = 0.05, ZS = LED_WALL.z + 0.35;
  const panels: { x: number; z: number; ry: number }[] = [];
  for (let i = 0; i < 5; i++) panels.push({ x: (i - 2) * PW * 0.985, z: ZS + (i % 2 ? 0.45 : 0), ry: (i % 2 ? 1 : -1) * 0.16 * (i === 2 ? 0 : 1) });
  const faces: THREE.BufferGeometry[] = [];
  const kit = new Kit();
  panels.forEach((p, i) => {
    const g = new THREE.PlaneGeometry(PW - 0.3, PH - 0.5);
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 5);
    g.rotateY(Math.PI);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(p.ry).setPosition(p.x, Y0 + PH / 2, p.z - 0.07));
    faces.push(g);
    const m = new THREE.Matrix4().makeRotationY(p.ry).setPosition(p.x, 0, p.z);
    // khung sơn then viền vàng + chân
    kit.add(new THREE.BoxGeometry(PW, PH, 0.12), P.lac[500], m.clone().multiply(new THREE.Matrix4().makeTranslation(0, Y0 + PH / 2, 0)));
    for (const sx of [-1, 1]) kit.add(new THREE.BoxGeometry(0.16, PH + 0.3, 0.2), P.gold[500], m.clone().multiply(new THREE.Matrix4().makeTranslation(sx * (PW / 2 - 0.08), Y0 + PH / 2 + 0.15, -0.04)), true);
    for (const y of [Y0 + 0.08, Y0 + PH - 0.08]) kit.add(new THREE.BoxGeometry(PW, 0.16, 0.2), P.gold[500], m.clone().multiply(new THREE.Matrix4().makeTranslation(0, y, -0.04)), true);
    kit.add(new THREE.SphereGeometry(0.2, 8, 6), P.gold[300], m.clone().multiply(new THREE.Matrix4().makeTranslation(-PW / 2 + 0.08, Y0 + PH + 0.42, -0.04)), true);
  });
  kit.add(new THREE.SphereGeometry(0.2, 8, 6), P.gold[300], new THREE.Matrix4().makeTranslation(panels[4]!.x + PW / 2 - 0.08, Y0 + PH + 0.42, panels[4]!.z - 0.04), true);
  // vành trống đồng (đúc nổi) quanh mặt trời
  const DR = 5.0, DY = 5.45, DZ = LED_WALL.z - 0.05;
  kit.add(new THREE.TorusGeometry(DR + 0.12, 0.2, 6, 64), P.gold[700], new THREE.Matrix4().makeTranslation(0, DY, DZ));
  kit.add(new THREE.TorusGeometry(DR + 0.4, 0.07, 4, 64), P.gold[500], new THREE.Matrix4().makeTranslation(0, DY, DZ + 0.05), true);
  const kitGeo = kit.build();
  const kitMat = kitMaterial();
  const frame = new THREE.Mesh(kitGeo, kitMat);
  objs.push(frame); disposables.push(kitGeo, kitMat);

  const faceGeo = mergeFaces(faces);
  const tex = screenTexture();
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : P.lac[300], side: THREE.DoubleSide });
  const face = new THREE.Mesh(faceGeo, faceMat);
  objs.push(face); disposables.push(faceGeo, faceMat);
  if (tex) disposables.push(tex);

  // ── mặt trống ──
  const own = {
    uRot: { value: 0 }, uBeat: { value: 0 },
    uBase: { value: new THREE.Color() }, uBase2: { value: new THREE.Color() }, uGold: { value: new THREE.Color() }, uGoldHi: { value: new THREE.Color() },
    uA: { value: new THREE.Color() }, uC: { value: new THREE.Color() },
  };
  const lin = (hex: number, c: THREE.Color) => toColor(hex, c).convertLinearToSRGB();
  lin(P.lac[500], own.uBase.value); lin(P.lac[300], own.uBase2.value); lin(P.gold[500], own.uGold.value); lin(P.gold[300], own.uGoldHi.value);
  const drumGeo = new THREE.PlaneGeometry(DR * 2 * 1.22, DR * 2 * 1.22);
  const drumMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime ?? { value: 0 }, uHype: uniforms.uHype ?? { value: 0 }, ...own },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: DRUM_FRAG, transparent: true, fog: false,
  });
  const drum = new THREE.Mesh(drumGeo, drumMat);
  drum.position.set(0, DY, DZ - 0.02);
  drum.rotation.y = Math.PI;
  objs.push(drum); disposables.push(drumGeo, drumMat);

  scene.add(...objs);
  let rot = 0;
  return {
    update(f: FrameState, _t: number) {
      const hc = hypeColors(f.hype);
      own.uA.value.setRGB(hc.primary[0], hc.primary[1], hc.primary[2]);
      own.uC.value.setRGB(hc.accent[0], hc.accent[1], hc.accent[2]);
      own.uBeat.value = f.beatPulse;
      rot += Math.min(0.1, f.dt) * (0.03 + 0.05 * f.hype); // vành quay chậm
      own.uRot.value = rot;
    },
    dispose() { scene.remove(...objs); disposables.forEach((d) => d.dispose()); },
  };
}

function mergeFaces(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (const g of gs) {
    const n = g.index ? g.toNonIndexed() : g;
    pos.push(...(n.getAttribute('position').array as Float32Array));
    uv.push(...(n.getAttribute('uv').array as Float32Array));
    if (n !== g) n.dispose();
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

export const builders: Partial<ArenaBuilders> = { ledWall: createLacquerLedWall };
