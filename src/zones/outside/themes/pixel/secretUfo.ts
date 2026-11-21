// "Đêm Sao Điểm Ảnh" · khe secretUfo (P5, STYLE_E §6): BẢNG PHA MÀU BAY thay UFO.
// Bảng gỗ hình hạt đậu (dat-300, mặt dưới lùi một bậc), lỗ ngón cái có cây cọ cắm xiên (cán dat-500, đai may-100, đầu cọ
// son), 7 đốm sơn tròn dẹt = "đèn" (crôm, son, lam Phổ, lục bách, sen, ngọc, kem) nảy lên lần lượt như đèn chạy (4 bước/s).
// Chùm rọi dưới bụng = nón caro 50 % dither (crôm sáng ↔ trống), 3 bậc sáng theo độ cao; giọt sơn vuông bay ngược lên chùm.
// Biên đạo (D = 20 s như mặc định): 0–4,5 s bay vào từ ngoài sân (sau khán đài phải, xa > tầm nhìn) · lơ lửng tại
// (0, 22, −42), lắc + xoay chậm · 5,2–15,4 s chùm rọi · 16 s nghiêng · 17–18,2 s vút ra trái xa (> 330 m) rồi ẩn.
// Viền mực 1 texel quanh bảng, cọ và đốm sơn. Draw call khi chạy: tô + viền + chùm + hạt = 4; rảnh 0 (root ẩn).
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { groundY } from '../../secretShared';
import { BAYER_GLSL, Parts, TRS, V2, V3, gl3, makePixelMesh, makeSparks, pr, single, sm } from './secretKit';

const D = 20;
const T_HOVER = 4.5, T_BEAM_ON = 5.2, T_BEAM_OFF = 15.4, T_TILT = 16, T_ZIP = 17, ZIP_DUR = 1.2;
const START = V3(170, 85, -240);
export const PALETTE_HOVER = V3(0, 22, -42);
const AWAY = V3(-340, 72, -120);
const NBLOB = 7;
/** Tỉ lệ model: bảng 18 × 12,8 local ⇒ ~27 × 19 m. */
const S = 1.5;
/** Vị trí đốm sơn trên mặt bảng (x, z, bán kính). */
const BLOBS: [number, number, number][] = [
  [-5.6, 1.6, 1.35], [-3.2, 3.9, 1.25], [0, 4.4, 1.3], [3.3, 3.9, 1.2], [5.8, 1.4, 1.3], [5.1, -2.0, 1.15], [-5.4, -2.3, 1.2],
];

function paletteShape(): THREE.Shape {
  // hạt đậu: elip 9 × 6,4 có vết lõm ở cạnh trước (+y của hình 2D = −z sau khi nằm)
  const pts: THREE.Vector2[] = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let rx = 9, ry = 6.4;
    const notch = Math.exp(-(((a - Math.PI * 1.5) / 0.38) ** 2)); // lõm ở phía −y (cạnh gần cọ)
    rx *= 1 - 0.0 * notch; ry *= 1 - 0.42 * notch;
    pts.push(V2(Math.cos(a) * rx, Math.sin(a) * ry));
  }
  const s = new THREE.Shape(pts);
  const hole = new THREE.Path();
  const hc = V2(1.8, -2.6), hr = 1.1;
  for (let i = 0; i <= 10; i++) { const a = -(i / 10) * Math.PI * 2; (i ? hole.lineTo : hole.moveTo).call(hole, hc.x + Math.cos(a) * hr, hc.y + Math.sin(a) * hr); }
  s.holes.push(hole);
  return s;
}

function buildPalette(): THREE.BufferGeometry {
  const dat = pr('dat'), crom = pr('crom'), son = pr('son'), pho = pr('pho'), bach = pr('bach'), may = pr('may');
  const p = new Parts();
  // bảng: phiến dày 0,7 nằm trong mặt XZ (mặt trên +Y)
  const body = new THREE.ExtrudeGeometry(paletteShape(), { depth: 0.7, bevelEnabled: false, curveSegments: 4 });
  body.translate(0, 0, -0.35); body.rotateX(Math.PI / 2);
  p.add(body, dat[300], null, { g: 0, out: V3(0, 0, 0) });
  // mép gỗ sẫm (vành mỏng dưới bảng)
  const rim = new THREE.ExtrudeGeometry(paletteShape(), { depth: 0.25, bevelEnabled: false, curveSegments: 4 });
  rim.scale(0.96, 0.96, 1); rim.translate(0, 0, -0.25); rim.rotateX(Math.PI / 2); rim.translate(0, -0.35, 0);
  p.add(rim, dat[500], null, { g: 0, out: 'none' });
  // cây cọ cắm qua lỗ ngón cái (lỗ ở (1,8; −2,6) 2D → (1,8, *, 2,6) sau khi xoay), xiên ra sau
  const hx = 1.8, hz = -2.6;
  const tilt = TRS(hx, 0, hz, -0.9, 0, 0.35);
  const handle = new THREE.CylinderGeometry(0.32, 0.42, 11, 6); handle.translate(0, 2.6, 0);
  p.add(handle, dat[500], tilt, { g: 0 });
  const ferrule = new THREE.CylinderGeometry(0.46, 0.4, 1.6, 6); ferrule.translate(0, 8.9, 0);
  p.add(ferrule, may[100], tilt, { g: 0 });
  const tip = new THREE.ConeGeometry(0.55, 2.4, 6); tip.translate(0, 10.9, 0);
  p.add(tip, son[500], tilt, { g: 0 });
  // 7 đốm sơn (nhóm 1..7), dome thấp 6 cạnh
  const cols = [crom[500], son[500], pho[300], bach[300], single('sen'), single('ngoc'), crom[100]];
  BLOBS.forEach(([x, z, r], i) => {
    const dome = new THREE.SphereGeometry(r, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.55, 1);
    p.add(dome, cols[i]!, null, { g: 1 + i, mode: 1, out: V3(0, 0, 0) });
    void x; void z;
  });
  // đáy: 3 vết sơn nhỏ nhỏ giọt (nhóm 0) – đọc được từ mắt ca sĩ nhìn lên
  for (const [x, z, c] of [[-3, 1, son[300]], [2.5, -2, crom[300]], [4.5, 2.5, pho[100]]] as [number, number, number][]) {
    const d = new THREE.CircleGeometry(0.9, 6); d.rotateX(Math.PI / 2); d.translate(x, -0.62, z);
    p.add(d, c, null, { g: 0, mode: 1, out: 'none' });
  }
  return p.build();
}

const BEAM_VERT = /* glsl */ `
varying float vH; varying float vA;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vH = modelMatrix[3].y - w.y; vA = atan(position.z, position.x);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const beamFrag = () => /* glsl */ `
uniform float uI; uniform float uT;
varying float vH; varying float vA;
${BAYER_GLSL}
void main() {
  // caro 50 %: chỉ nửa số texel sáng; 3 bậc màu theo độ cao, cường độ bật/tắt bằng ngưỡng Bayer (không alpha)
  vec2 f = floor(gl_FragCoord.xy);
  if (mod(f.x + f.y, 2.0) < 0.5) discard;
  float band = floor(fract(vH * 0.12 - uT * 0.9) * 3.0);
  float lv = uI * (1.0 - 0.45 * clamp(vH / 26.0, 0.0, 1.0));
  if (lv <= bayer4(gl_FragCoord.xy * 0.5)) discard;
  vec3 c = band < 0.5 ? ${gl3(pr('crom')[100])} : band < 1.5 ? ${gl3(pr('crom')[300])} : ${gl3(pr('crom')[500])};
  gl_FragColor = vec4(c, 1.0);
}`;

export function createPaletteUfo(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const pm = makePixelMesh(buildPalette(), 1 + NBLOB, root);

  // chùm rọi: nón hở, đỉnh ở gốc, dài 1 (scale y = chiều cao)
  const beamGeo = new THREE.CylinderGeometry(2.6, 9, 1, 14, 1, true);
  beamGeo.translate(0, -0.5, 0);
  const beamU = { uI: { value: 0 }, uT: { value: 0 } };
  const beamMat = new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: BEAM_VERT, fragmentShader: beamFrag(), fog: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;
  root.add(beam);

  // giọt sơn bay lên trong chùm (sinh sẵn: thời điểm, góc, bán kính)
  const NP = 180;
  const sp = makeSparks(NP, root);
  const crom = pr('crom'), son = pr('son'), pho = pr('pho'), bach = pr('bach');
  const pcols = [crom[500], son[500], pho[100], bach[100], single('sen'), single('ngoc'), crom[100]];
  const gy = groundY(PALETTE_HOVER.z) + 0.6;
  const tmpP = V3(0, 0, 0), tmpV = V3(0, 0, 0);
  for (let i = 0; i < NP; i++) {
    const a = (i * 2.399) % (Math.PI * 2), r = 0.8 + ((i * 37) % 11) / 11 * 6;
    const t0 = T_BEAM_ON + 0.4 + (i / NP) * (T_BEAM_OFF - T_BEAM_ON - 1.6);
    const life = 3.2 + ((i * 13) % 7) * 0.12;
    tmpP.set(PALETTE_HOVER.x + Math.cos(a) * r, gy, PALETTE_HOVER.z + Math.sin(a) * r);
    tmpV.set(-Math.cos(a) * r * 0.18, (PALETTE_HOVER.y - 1.5 - gy) / life, -Math.sin(a) * r * 0.18);
    sp.set(i, tmpP, t0, tmpV, life, pcols[i % 7]!, crom[100], 2, 0, 0);
  }
  sp.commit();

  const pos = V3(0, 0, 0), zipA = V3(0, 0, 0), foc = V3(0, 0, 0);
  const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = V3(1, 1, 1);
  const bodyM = new THREE.Matrix4(), loc = new THREE.Matrix4(), lq = new THREE.Quaternion();
  const hoverPos = (t: number, out: THREE.Vector3) => {
    if (t < T_HOVER) {
      const k = sm(0, T_HOVER, t);
      out.lerpVectors(START, PALETTE_HOVER, k);
      out.y += Math.sin(k * Math.PI) * 10; // vòng cung
    } else out.copy(PALETTE_HOVER);
    out.y += Math.sin(t * 1.4) * 0.6;
    out.x += Math.sin(t * 0.45) * 3 * sm(T_HOVER - 1, T_HOVER + 2, t);
    if (t > T_TILT) out.y += (t - T_TILT) * 1.5;
    return out;
  };

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      pm.tick();
      sp.u.uT.value = t; sp.u.uPxScale.value = Math.max(1, Math.round(pm.u.uPxH.value / 240));
      beamU.uT.value = t;
      if (t < T_ZIP) hoverPos(t, pos);
      else {
        hoverPos(T_ZIP, zipA);
        const k = Math.min(1, (t - T_ZIP) / ZIP_DUR);
        pos.lerpVectors(zipA, AWAY, k * k);
      }
      const gone = t > T_ZIP + ZIP_DUR;
      // xoay chậm quanh pháp tuyến bảng, nghiêng mép trước xuống về phía ca sĩ (+z) để cả hai góc máy cùng thấy
      const tiltX = 0.3 + Math.sin(t * 1.3) * 0.06 - sm(T_TILT, T_ZIP, t) * 0.25;
      const roll = Math.sin(t * 1.7) * 0.05 + (1 - sm(0, T_HOVER, t)) * Math.sin(t * 2.1) * 0.2 + (t > T_ZIP ? 0.5 : 0);
      e.set(tiltX, Math.atan2(-pos.x, -pos.z) * 0.3 + t * 0.35, roll);
      q.setFromEuler(e);
      const pop = Math.min(1, t / 0.5) * S;
      const stretch = t >= T_ZIP ? 1 + 0.5 * sm(T_ZIP, T_ZIP + 0.3, t) : 1;
      sc.set(pop * stretch, pop, pop);
      bodyM.compose(pos, q, sc);
      if (gone) pm.hide(0); else pm.m(0).copy(bodyM);
      // đốm sơn: đèn chạy — mỗi bước 0,25 s một đốm nảy lên (≤ 4 bước/s, không chớp sáng)
      const step = Math.floor(t * 4) % NBLOB;
      for (let i = 0; i < NBLOB; i++) {
        if (gone) { pm.hide(1 + i); continue; }
        const [x, z] = BLOBS[i]!;
        const on = i === step ? 1 : 0;
        const beat = 0.12 * f.beatPulse;
        loc.compose(sc.set(x, 0.32 + on * 0.5, z), lq.identity(), V3ONE.set(1 + beat, 1 + on * 0.9 + beat, 1 + beat));
        pm.m(1 + i).multiplyMatrices(bodyM, loc);
      }
      // chùm
      const beamI = sm(T_BEAM_ON, T_BEAM_ON + 0.6, t) * (1 - sm(T_BEAM_OFF, T_BEAM_OFF + 0.6, t));
      beam.visible = beamI > 0.01 && !gone;
      beamU.uI.value = beamI;
      const ground = groundY(pos.z) + 0.3;
      beam.position.set(pos.x, pos.y - 0.9, pos.z);
      beam.scale.set(1, Math.max(1, pos.y - 0.9 - ground), 1);
      sp.pts.visible = t < T_BEAM_OFF + 4 && !gone;
      foc.copy(pos);
      if (t < T_HOVER) foc.lerpVectors(PALETTE_HOVER, pos, 1 - sm(0, T_HOVER, t) * 0.6);
      else if (t > T_ZIP) foc.copy(zipA);
    },
    focus(_t: number, out: THREE.Vector3) { out.copy(foc); },
    dispose() {
      pm.dispose(); sp.dispose();
      beamGeo.dispose(); beamMat.dispose();
      root.removeFromParent();
    },
  };
}
const V3ONE = V3(1, 1, 1);

export const builders: Partial<OutsideBuilders> = { secretUfo: createPaletteUfo };
