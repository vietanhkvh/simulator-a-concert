// "Đêm Sao Điểm Ảnh" · khe secretRocket (P5, STYLE_E §6): TUÝP SƠN thay tên lửa, pháo nổ thành SAO VAN GOGH nhiều
// vòng và HOA HƯỚNG DƯƠNG.
// Tuýp: thân kim loại may-100 (8 cạnh), nhãn son + sọc crôm, đầu kẹp dẹt có gân, vai côn + vòi; vòi chĩa xuống phun "lửa"
// = nón sơn 2 lớp (crôm ngoài, cam son trong, dài ngắn theo bậc) + giọt sơn vuông vàng → cam → son rơi lại phía sau.
// Bay theo Bézier từ ngoài sân (sau lưng khán đài trái, ~165 m từ tâm sân) lên tâm trời show (0, 50, −30), xoay quanh trục; tới nơi thì "bung"
// (ẩn) và 6 phát pháo nổ lần lượt (≤ 1,6 phát/s): sao Van Gogh = quầng tròn đồng tâm lượng tử (kem → crôm → vàng → lam
// nhạt, nở rồi tan bằng dither) + 3 vòng hạt đồng tâm trong mặt phẳng XY (đọc tròn từ cả mắt ca sĩ lẫn máy toàn cảnh);
// hướng dương = đĩa nâu hạt caro + 2 vòng cánh vàng viền mực 1 texel + vòng hạt cánh. Không chớp toàn màn.
// Draw call khi chạy: tuýp tô + viền + quầng (6 quad gộp) + hạt đuôi + hạt pháo = 5; rảnh 0.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { SKY_SHOW_CENTRE } from '../../../../world/layout';
import type { OutsideBuilders, SecretAct } from '../../builders';
import { BAYER_GLSL, Parts, V3, gl3, makePixelMesh, makeSparks, pr, single } from './secretKit';

const D = 22;
const T_IGN = 2.5, T_BURST = 10.0;
const PAD = V3(-150, -3, 60);
const CTRL = V3(-95, 125, 10);
export const TUBE_BURST = V3(SKY_SHOW_CENTRE.x, SKY_SHOW_CENTRE.y, SKY_SHOW_CENTRE.z);
/** x, y, z, t nổ, kiểu (0 sao Van Gogh, 1 hướng dương), cỡ quầng (m). */
const SHELLS: [number, number, number, number, number, number][] = [
  [TUBE_BURST.x, TUBE_BURST.y, TUBE_BURST.z, T_BURST, 0, 26],
  [-26, 44, -18, T_BURST + 0.8, 1, 17],
  [24, 58, -40, T_BURST + 1.5, 0, 17],
  [-4, 38, -12, T_BURST + 2.2, 1, 15],
  [28, 42, -16, T_BURST + 2.9, 0, 15],
  [-22, 60, -44, T_BURST + 3.5, 1, 18],
];
const HALO_LIFE = 4.2;
const S = 2.2; // tỉ lệ tuýp: dài ~12 local ⇒ ~26 m

function buildTube(): THREE.BufferGeometry {
  const may = pr('may'), son = pr('son'), crom = pr('crom');
  const p = new Parts();
  const C = V3(0, 0, 0);
  const body = new THREE.CylinderGeometry(1.6, 1.6, 7, 8); body.translate(0, 0.5, 0);
  p.add(body, may[100], null, { g: 0, out: C });
  const label = new THREE.CylinderGeometry(1.68, 1.68, 3.6, 8); label.translate(0, 0.4, 0);
  p.add(label, son[500], null, { g: 0, out: 'none' });
  for (const y of [-0.7, 1.5]) {
    const st = new THREE.CylinderGeometry(1.72, 1.72, 0.5, 8); st.translate(0, y, 0);
    p.add(st, crom[500], null, { g: 0, out: 'none' });
  }
  // ngôi sao nhỏ trên nhãn (2 mặt)
  for (const z of [1.72, -1.72]) {
    const star = new THREE.CircleGeometry(0.7, 5); star.translate(0, 0.4, z);
    p.add(star, crom[100], null, { g: 0, mode: 1, out: 'none' });
  }
  // đầu kẹp dẹt (trên) + gân
  const crimp = new THREE.CylinderGeometry(1.75, 1.6, 1.6, 8); crimp.scale(1, 1, 0.28); crimp.translate(0, 4.8, 0);
  p.add(crimp, may[300], null, { g: 0, out: C });
  for (let k = 0; k < 3; k++) {
    const r = new THREE.BoxGeometry(3.3, 0.14, 0.6); r.translate(0, 4.35 + k * 0.42, 0);
    p.add(r, may[500], null, { g: 0, out: 'none' });
  }
  // vai côn + vòi + ren
  const sh = new THREE.CylinderGeometry(1.6, 0.75, 1.3, 8); sh.translate(0, -3.65, 0);
  p.add(sh, may[100], null, { g: 0, out: C });
  const noz = new THREE.CylinderGeometry(0.62, 0.62, 1.2, 8); noz.translate(0, -4.85, 0);
  p.add(noz, may[300], null, { g: 0, out: C });
  // nón sơn phun (nhóm 1, dài 1 theo −y): ngoài crôm, trong cam son
  const f1 = new THREE.ConeGeometry(1.1, 1, 6); f1.rotateX(Math.PI); f1.translate(0, -0.5, 0);
  p.add(f1, crom[500], null, { g: 1, mode: 1, out: V3(0, -0.3, 0) });
  const f2 = new THREE.ConeGeometry(0.6, 0.7, 6); f2.rotateX(Math.PI); f2.translate(0, -0.33, 0);
  p.add(f2, son[300], null, { g: 1, mode: 1, out: 'none' });
  return p.build();
}

const HALO_VERT = /* glsl */ `
uniform float uT;
attribute vec4 aH; // t0, kiểu, cỡ, hạt giống
varying vec2 vQ; varying float vAge; varying float vKind; varying float vSeed;
void main() {
  vAge = uT - aH.x; vKind = aH.y; vSeed = aH.w; vQ = uv * 2.0 - 1.0;
  if (vAge < 0.0 || vAge > ${HALO_LIFE.toFixed(2)}) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float grow = clamp(vAge / 0.45, 0.0, 1.0);
  grow = 1.0 - (1.0 - grow) * (1.0 - grow);
  vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 u = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = position + (r * vQ.x + u * vQ.y) * aH.z * (0.35 + 0.65 * grow);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const haloFrag = () => {
  const crom = pr('crom'), pho = pr('pho'), dat = pr('dat');
  return /* glsl */ `
varying vec2 vQ; varying float vAge; varying float vKind; varying float vSeed;
${BAYER_GLSL}
void main() {
  float r = length(vQ);
  float fade = 1.0 - clamp((vAge - ${(HALO_LIFE - 1.4).toFixed(2)}) / 1.4, 0.0, 1.0);
  if (fade <= bayer4(gl_FragCoord.xy)) discard;
  float a = atan(vQ.y, vQ.x);
  vec3 c;
  if (vKind < 0.5) {
    // sao Van Gogh: lõi kem + vành crôm, rồi các vòng mảnh đồng tâm cách quãng (vàng nét đứt, lam nhạt caro) nở dần
    float rr = r + 0.03 * sin(a * 3.0 + vAge * 2.0 + vSeed);
    float px = fwidth(r) * 1.2;
    float ex = clamp(vAge / 1.2, 0.0, 1.0);
    vec2 f = floor(gl_FragCoord.xy);
    if (rr < 0.17) c = ${gl3(crom[100])};
    else if (rr < 0.29) c = mod(floor(a * 8.0 / 3.14159 + vAge * 3.0), 2.0) < 1.0 ? ${gl3(crom[300])} : ${gl3(crom[500])};
    else if (rr < 0.29 + px) c = ${gl3(crom[700])};
    else if (abs(rr - (0.42 + 0.14 * ex)) < max(px, 0.035) && mod(floor(a * 10.0 / 3.14159 - vAge * 2.0), 2.0) < 1.0) c = ${gl3(crom[500])};
    else if (abs(rr - (0.6 + 0.32 * ex)) < max(px, 0.03) && mod(f.x + f.y, 2.0) > 0.5) c = ${gl3(pho[100])};
    else discard;
  } else {
    // hướng dương: đĩa nâu hạt caro, 2 vòng cánh nhọn vàng, viền mực 1 texel
    float n = 13.0;
    float sa = a + vSeed + vAge * 0.15;
    float pet1 = 0.42 + 0.56 * pow(abs(cos(sa * n * 0.5)), 1.6);
    float pet2 = 0.42 + 0.44 * pow(abs(sin(sa * n * 0.5)), 1.6);
    float edge = max(pet1, pet2);
    float px = fwidth(r) * 1.2;
    if (r > edge + px) discard;
    if (r > edge) c = ${gl3(single('ink'))};
    else if (r < 0.34) {
      vec2 f = floor(gl_FragCoord.xy);
      c = mod(f.x + f.y, 2.0) < 0.5 ? ${gl3(dat[500])} : ${gl3(dat[700])};
      if (r > 0.34 - px) c = ${gl3(single('ink'))};
    }
    else if (r < 0.42) c = ${gl3(crom[700])};
    else c = r < pet1 ? ${gl3(crom[500])} : ${gl3(crom[300])};
  }
  gl_FragColor = vec4(c, 1.0);
}`;
};

export function createPaintTube(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const pm = makePixelMesh(buildTube(), 2, root);

  // quầng: 6 quad gộp
  const hp: number[] = [], hu: number[] = [], ha: number[] = [];
  SHELLS.forEach(([x, y, z, t0, k, sz], i) => {
    for (const [qx, qy] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { hp.push(x, y, z); hu.push(qx!, qy!); ha.push(t0, k, sz, i * 1.3); }
  });
  const hGeo = new THREE.BufferGeometry();
  hGeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  hGeo.setAttribute('uv', new THREE.Float32BufferAttribute(hu, 2));
  hGeo.setAttribute('aH', new THREE.Float32BufferAttribute(ha, 4));
  const hU = { uT: { value: 0 } };
  const hMat = new THREE.ShaderMaterial({ uniforms: hU, vertexShader: HALO_VERT, fragmentShader: haloFrag(), fog: false, side: THREE.DoubleSide, depthWrite: false, transparent: true });
  const halo = new THREE.Mesh(hGeo, hMat);
  halo.frustumCulled = false;
  halo.renderOrder = 4;
  root.add(halo);

  // hạt pháo (tĩnh, sinh sẵn)
  const crom = pr('crom'), son = pr('son'), pho = pr('pho'), dat = pr('dat');
  const ngoc = single('ngoc');
  const rings0: [number, number, number, number][] = [[16, 5.5, crom[100], crom[300]], [26, 10, crom[300], crom[500]], [36, 15, pho[100], ngoc]];
  const rings1: [number, number, number, number][] = [[26, 12, crom[500], son[300]], [26, 15.5, crom[300], son[100]], [18, 3.5, dat[300], dat[500]]];
  const NB = SHELLS.length * 26 * 3 + 40;
  const burst = makeSparks(NB, root);
  let bi = 0;
  const pv = V3(0, 0, 0), vv = V3(0, 0, 0);
  for (const [x, y, z, t0, kind] of SHELLS) {
    for (const [n, spd, c0, c1] of kind === 0 ? rings0 : rings1) {
      for (let j = 0; j < n && bi < NB; j++) {
        const a = (j / n) * Math.PI * 2 + (kind ? 0.12 : 0);
        pv.set(x, y, z);
        vv.set(Math.cos(a) * spd, Math.sin(a) * spd, Math.sin(j * 2.7) * spd * 0.12);
        burst.set(bi++, pv, t0 + 0.05, vv, 2.6 + (j % 3) * 0.25, c0, c1, spd > 12 ? 2 : 3, 1.4, 2.2, (j % 4) / 4);
      }
    }
  }
  burst.commit();

  // giọt sơn đuôi (vòng đệm)
  const NT = 240;
  const trail = makeSparks(NT, root);
  for (let i = 0; i < NT; i++) trail.set(i, pv, 1e9, vv, 1, 0, 0, 0, 0, 0);
  trail.commit();
  let head = 0, acc = 0, lastT = 0;

  const bez = (s: number, out: THREE.Vector3) => {
    const m = 1 - s;
    return out.set(0, 0, 0).addScaledVector(PAD, m * m).addScaledVector(CTRL, 2 * m * s).addScaledVector(TUBE_BURST, s * s);
  };
  const sOf = (t: number) => { const u = Math.min(1, Math.max(0, (t - T_IGN) / (T_BURST - T_IGN))); return u * u; };
  const pos = V3(0, 0, 0), ahead = V3(0, 0, 0), dir = V3(0, 0, 0), nozzle = V3(0, 0, 0), foc = V3(0, 0, 0);
  const q = new THREE.Quaternion(), qs = new THREE.Quaternion(), Y = V3(0, 1, 0), sc = V3(S, S, S);
  const flameM = new THREE.Matrix4(), tmpM = new THREE.Matrix4();

  return {
    duration: D,
    start() { root.visible = true; head = 0; acc = 0; lastT = 0; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      pm.tick();
      const pxs = Math.max(1, Math.round(pm.u.uPxH.value / 240));
      burst.u.uT.value = trail.u.uT.value = hU.uT.value = t;
      burst.u.uPxScale.value = trail.u.uPxScale.value = pxs;
      const flying = t < T_BURST;
      const s = sOf(t);
      bez(s, pos);
      bez(Math.min(1, s + 0.01), ahead);
      if (t < T_IGN) ahead.copy(pos).add(Y);
      dir.subVectors(ahead, pos).normalize();
      if (!flying) { pm.hide(0); pm.hide(1); }
      else {
        q.setFromUnitVectors(Y, dir);
        qs.setFromAxisAngle(Y, t * 2.2);
        q.multiply(qs);
        const shake = t < T_IGN ? Math.sin(t * 40) * 0.06 * (t / T_IGN) : 0;
        pos.x += shake;
        pm.m(0).compose(pos, q, sc);
        // nón sơn: bật ở đánh lửa, dài theo bậc (0,1 s mỗi bậc) + theo phách
        const ign = t > T_IGN - 0.6 ? 1 : 0;
        const len = ign * (5 + 2 * (Math.floor(t * 10) % 3) + 2 * f.beatPulse);
        nozzle.copy(dir).multiplyScalar(-5.4 * S).add(pos);
        if (len < 0.1) pm.hide(1);
        else {
          tmpM.makeScale(S, len, S);
          flameM.compose(nozzle, q, V3ONE);
          pm.m(1).multiplyMatrices(flameM, tmpM);
        }
        // giọt sơn rơi lại phía sau
        if (ign && t > lastT) {
          acc = Math.min(acc + t - lastT, 0.4);
          while (acc > 0.025) {
            acc -= 0.025;
            const k = head++ % NT;
            const j = head * 2.399;
            vv.copy(dir).multiplyScalar(-9).add(pv.set(Math.cos(j) * 2.5, Math.sin(j * 1.3) * 2.5, Math.sin(j) * 2.5));
            pv.copy(nozzle).addScaledVector(dir, -len * S * 0.6);
            const tone = head % 3;
            trail.set(k, pv, t, vv, 1.3, tone === 0 ? crom[500] : tone === 1 ? son[300] : crom[300], tone === 2 ? son[300] : son[500], tone === 1 ? 3 : 2, 1.2, 6);
          }
          trail.commit();
        }
      }
      lastT = t;
      if (flying) foc.copy(pos).lerp(TUBE_BURST, 0.35);
      else foc.copy(TUBE_BURST);
    },
    focus(_t: number, out: THREE.Vector3) { out.copy(foc); },
    dispose() {
      pm.dispose(); burst.dispose(); trail.dispose();
      hGeo.dispose(); hMat.dispose();
      root.removeFromParent();
    },
  };
}
const V3ONE = V3(1, 1, 1);

export const builders: Partial<OutsideBuilders> = { secretRocket: createPaintTube };
