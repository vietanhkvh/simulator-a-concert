// "Thép & Lửa" · khe skyFeature (S6): thay cực quang khi Hype > 40 % (bật > 40 %, tắt < 37 %; STYLE_C mục 3).
//  (a) TRẦN MÂY KHÓI THẤP có khối: 4 tấm mây xếp tầng (1 mesh, 1 draw call), tô bậc phẳng (đồng mức nhiễu lượng tử hoá), thân xám
//      thép, tầng trên bẩn hơn; chỉ BỤNG mây hắt ánh lửa từ sân lên (ấm dần theo Hype, đập theo phách ≥ 80 %).
//  (b) 8 ĐÈN RỌI từ nóc khán đài: chùm hẹp dài (1 draw call) chạm tầng mây thấp nhất, chỗ chạm có VẾT ELLIP sáng (vẽ trong
//      shader mây). Mẫu quét đổi mỗi 16 phách (quạt / chéo / xoay). Trắng lạnh → tungsten 40–80 % → trắng nung ≥ 80 %.
//  (c) TÀN LỬA bay từ sân khấu vào khói ≥ 60 % (1 Points). Tổng 3 draw call; chuyển động nằm trong shader, không ghi lại buffer.
import * as THREE from 'three';
import { STADIUM_CENTRE, STANDS_R_OUTER, STANDS_TOP_Y, STAGE_BACK_Z, STAGE_FRONT_Z } from '../../../../world/layout';
import { auroraAmount, hexToRgb, RAMPS, smoothstep } from '../../../../world/style';
import type { OutsideBuildContext, OutsideBuilders, SkyFeatureHandle } from '../../builders';

const BEAMS = 8;
const LAYERS_Y = [122, 104, 88, 74]; // từ cao xuống thấp; tầng cuối (thấp nhất) nhận vết chạm của đèn rọi
const HIT_Y = LAYERS_Y[LAYERS_Y.length - 1]!;
const CEIL_R = 215;
const EMBERS = 700;
const CX = STADIUM_CENTRE.x, CZ = STADIUM_CENTRE.z;
const f4 = (x: number) => x.toFixed(4);
const g = (hex: number) => `vec3(${hexToRgb(hex).map(f4).join(', ')})`;

const BEAM_VERT = /* glsl */ `
uniform vec3 uOrg[${BEAMS}]; uniform vec3 uDir[${BEAMS}]; uniform float uLen[${BEAMS}];
attribute float aBeam;
varying vec2 vUv;
void main() {
  int i = int(aBeam + 0.5);
  vec3 o = uOrg[i], d = uDir[i];
  float v = uv.y;
  vec3 c = o + d * (v * uLen[i]);
  vec3 side = normalize(cross(d, cameraPosition - c));
  float w = mix(1.6, 5.5, v);
  vec3 p = c + side * (uv.x - 0.5) * w;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform float uAmt; uniform vec3 uCol;
varying vec2 vUv;
void main() {
  float x = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float prof = x * x * x * (0.5 + 0.5 * x);
  float along = smoothstep(0.0, 0.05, vUv.y) * mix(1.0, 0.62, vUv.y);
  gl_FragColor = vec4(uCol * prof * along * uAmt * 0.75, 1.0);
}`;

const CLOUD_VERT = /* glsl */ `
attribute float aLayer;
varying vec3 vW; varying float vL;
void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; vL = aLayer; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`;
const cloudFrag = () => /* glsl */ `
uniform float uTime; uniform float uAmt; uniform float uHot; uniform float uWarm; uniform float uPulse;
uniform vec3 uLit; uniform vec3 uBeamCol; uniform vec4 uHit[${BEAMS}]; uniform float uHitE[${BEAMS}];
varying vec3 vW; varying float vL;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { return vn(p) * 0.55 + vn(p * 2.07 + 3.7) * 0.3 + vn(p * 4.1 - 1.9) * 0.15; }
// khối phồng (billow): đỉnh tròn, nếp gấp sắc giữa các búi → nhìn như khói dày, không như sương
float bil(vec2 p) {
  float a = 1.0 - abs(2.0 * vn(p) - 1.0), b = 1.0 - abs(2.0 * vn(p * 2.1 + 4.3) - 1.0);
  return a * 0.68 + b * 0.32;
}
void main() {
  float L = vL;                       // 0 = tầng cao nhất … 3 = thấp nhất
  float low = L / 3.0;
  float dir = mod(L, 2.0) < 0.5 ? 1.0 : -1.0;
  vec2 p = vW.xz * vec2(0.0095, 0.0125) + vec2(uTime * 0.0045 * dir * (0.6 + 0.4 * low), uTime * 0.002) + vec2(L * 7.3, L * 3.1);
  vec2 pw = p + 0.5 * vec2(vn(p * 1.3 + 9.0), vn(p * 1.3 + 2.0));
  float n = fbm(pw);
  float nb = bil(pw * 1.15);
  // hướng về lửa (sân khấu): búi quay về lửa sáng, búi quay đi tối → khối; lượng tử hoá 4 bậc = mặt phẳng
  vec2 toFire = normalize(vec2(${f4(CX)}, ${f4((STAGE_BACK_Z + STAGE_FRONT_Z) / 2)}) - vW.xz + 0.001);
  float nb2 = bil((pw + toFire * 0.07) * 1.15);
  float lobe = clamp((nb - nb2) * 10.0 + 0.45, 0.0, 1.0);
  float lobeQ = floor(lobe * 4.0 + 0.5) / 4.0;
  float thr = mix(0.46, 0.33, low);
  float aw = max(fwidth(n) * 1.2, 0.004);
  float dens = smoothstep(thr - aw, thr + aw, n) * 0.5 + smoothstep(thr + 0.05 - aw, thr + 0.05 + aw, n) * 0.28 + smoothstep(thr + 0.12 - aw, thr + 0.12 + aw, n) * 0.22;   // 3 bậc cứng: mép mỏng – thân – lõi
  float cell = h21(floor(vW.xz * 0.05 + L * 11.0));
  float dc = length(vW - cameraPosition);
  float edge = 1.0 - smoothstep(150.0, 212.0, dc);
  bool under = cameraPosition.y < vW.y;
  float rr = length(vW.xz - vec2(${f4(CX)}, ${f4(CZ)}));
  float fire = mix(0.3, 1.0, exp(-rr * rr / 9000.0));
  float pulseK = 1.0 + 0.3 * uPulse * uHot;
  // thân xám thép; búi dày (nb cao) tối hơn; tầng càng cao càng bẩn; mặt trên rất tối
  vec3 body = mix(${g(RAMPS.steel![700]!)} * 0.8, ${g(RAMPS.steel![500]!)} * 0.8, smoothstep(0.35, 0.9, nb)) * (0.65 + 0.5 * low) * (1.0 + (cell - 0.5) * 0.25);
  body = vec3(dot(body, vec3(0.3333))) * vec3(1.02, 1.0, 0.97);   // xám khói trung tính, không ngả tím
  vec3 col;
  if (under) {
    // chỉ BỤNG mây hắt lửa: búi quay về lửa + mép mỏng + tầng thấp + gần tâm sân
    float facing = max(lobeQ - 0.6, 0.0) * 2.5;
    float litAmt = facing * (0.45 + 0.55 * (1.0 - dens * 0.6)) * (0.3 + 0.7 * low) * fire * (0.1 + 0.9 * uWarm) * pulseK * smoothstep(0.45, 0.95, dens);
    litAmt *= 0.75 + 0.25 * lobe;
    col = mix(body * (0.5 + 0.5 * lobeQ), uLit * (0.55 + 0.45 * lobe), clamp(litAmt * 1.1, 0.0, 0.9));
  } else {
    col = body * 0.4;
  }
  float a = uAmt * edge * dens * (0.82 + 0.18 * low);
  // vết ellip của đèn rọi chạm tầng thấp nhất
  if (L > 2.5 && under) {
    float spot = 0.0;
    for (int i = 0; i < ${BEAMS}; i++) {
      vec4 h = uHit[i];
      vec2 d = vW.xz - h.xy;
      vec2 u = h.zw;
      float al = dot(d, u), pe = u.x * d.y - u.y * d.x;
      float aL = 6.5 * uHitE[i], aW = 6.5;     // kéo giãn theo góc nghiêng của chùm
      float e = (al * al) / (aL * aL) + (pe * pe) / (aW * aW);
      float core = floor(smoothstep(1.15, 0.15, e) * 3.0 + 0.5) / 3.0;   // 3 bậc phẳng: vành – giữa – lõi
      spot += core * (0.75 + 0.25 * smoothstep(0.3, 0.7, nb));
    }
    spot = min(spot, 1.0);
    col = mix(col, uBeamCol * 0.9, spot * 0.65);
    a = max(a, spot * uAmt * 0.92 * edge);
  }
  gl_FragColor = vec4(min(col, vec3(0.9)), clamp(a, 0.0, 0.95));
}`;

const E_VERT = /* glsl */ `
uniform float uTime; uniform float uPx; uniform float uDens; uniform float uAmt;
attribute vec4 aSeed;
varying float vA; varying float vH;
float hh(float x){ return fract(sin(x * 91.3) * 43758.5453); }
void main(){
  vec4 s = aSeed;
  float sp = 0.045 + 0.05 * hh(s.x * 7.7);               // vòng đời 10–20 s
  float k = fract(uTime * sp + s.z);
  float y = 3.0 + k * (${HIT_Y.toFixed(1)} - 3.0);
  float wob = sin(uTime * 0.7 + s.z * 40.0) * (1.0 + 7.0 * k) + sin(uTime * 0.23 + s.x * 17.0) * 5.0 * k;
  vec3 p = vec3((s.x - 0.5) * 60.0 + wob + k * 6.0, y, ${f4((STAGE_BACK_Z + STAGE_FRONT_Z) / 2)} + (s.y - 0.5) * 30.0 + wob * 0.6 - k * 24.0);
  float on = step(s.w, uDens);
  float flick = 0.7 + 0.3 * sin(uTime * (6.0 + 10.0 * s.x) + s.z * 90.0);
  vA = uAmt * on * flick * smoothstep(0.0, 0.04, k) * (1.0 - smoothstep(0.7, 1.0, k));
  vH = 1.0 - k;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = vA < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  gl_PointSize = clamp(uPx * (0.2 + 0.22 * hh(s.w * 17.0)) / max(-mv.z, 1.0), 1.5, 6.0);
}`;
const eFrag = () => /* glsl */ `
varying float vA; varying float vH;
void main(){
  vec2 q = abs(gl_PointCoord - 0.5) * 2.0;
  if (q.x + q.y > 1.0 || vA < 0.004) discard;
  vec3 c = mix(${g(RAMPS.ember![300]!)}, ${g(RAMPS.whitehot![300]!)}, vH * vH);
  gl_FragColor = vec4(c * vA * 1.1, 1.0);
}`;

export function createSkySearchlights(ctx: OutsideBuildContext): SkyFeatureHandle {
  const { scene, uniforms } = ctx;

  // ── chùm rọi: mỗi chùm 1 quad (uv.y dọc chùm); vị trí thật tính trong vertex shader ──
  const pos: number[] = [], uv: number[] = [], beam: number[] = [], idx: number[] = [];
  for (let b = 0; b < BEAMS; b++) {
    const k = b * 4;
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { pos.push(0, 0, 0); uv.push(u!, v!); beam.push(b); }
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  beamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  beamGeo.setAttribute('aBeam', new THREE.Float32BufferAttribute(beam, 1));
  beamGeo.setIndex(idx);
  const org = Array.from({ length: BEAMS }, (_, i) => {
    const a = ((i + 0.5) / BEAMS - 0.5) * 1.36 * Math.PI; // rải trên vành khán đài phía trước ca sĩ
    return new THREE.Vector3(CX + Math.sin(a) * (STANDS_R_OUTER - 6), STANDS_TOP_Y + 1, CZ - Math.cos(a) * (STANDS_R_OUTER - 6));
  });
  const dir = org.map(() => new THREE.Vector3(0, 1, 0));
  const hits = org.map(() => new THREE.Vector4());
  const elong = org.map(() => 1);
  const len = { value: org.map(() => 1) };
  const amt = { value: 0 };
  const beamCol = { value: new THREE.Color() };
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uOrg: { value: org }, uDir: { value: dir }, uLen: len, uAmt: amt, uCol: beamCol },
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const beams = new THREE.Mesh(beamGeo, beamMat);
  beams.frustumCulled = false;
  beams.renderOrder = -4;

  // ── trần mây: 4 đĩa xếp tầng trong 1 geometry (tầng cao vẽ trước) ──
  const cloudGeo = new THREE.BufferGeometry();
  {
    const P: number[] = [], Lr: number[] = [], I: number[] = [];
    const seg = 40, ring = 6;
    LAYERS_Y.forEach((y, li) => {
      const base = P.length / 3;
      P.push(CX, y, CZ); Lr.push(li);
      for (let r = 1; r <= ring; r++) for (let s = 0; s < seg; s++) {
        const a = (s / seg) * Math.PI * 2, rr = (r / ring) * CEIL_R;
        P.push(CX + Math.cos(a) * rr, y, CZ + Math.sin(a) * rr); Lr.push(li);
      }
      for (let s = 0; s < seg; s++) I.push(base, base + 1 + s, base + 1 + ((s + 1) % seg));
      for (let r = 1; r < ring; r++) for (let s = 0; s < seg; s++) {
        const a0 = base + 1 + (r - 1) * seg + s, a1 = base + 1 + (r - 1) * seg + ((s + 1) % seg);
        const b0 = a0 + seg, b1 = a1 + seg;
        I.push(a0, b0, a1, a1, b0, b1);
      }
    });
    cloudGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    cloudGeo.setAttribute('aLayer', new THREE.Float32BufferAttribute(Lr, 1));
    cloudGeo.setIndex(I);
  }
  const hot = { value: 0 }, warm = { value: 0 }, litCol = { value: new THREE.Color() };
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime!, uPulse: uniforms.uPulse!, uAmt: amt, uHot: hot, uWarm: warm, uLit: litCol, uBeamCol: beamCol, uHit: { value: hits }, uHitE: { value: elong } },
    vertexShader: CLOUD_VERT, fragmentShader: cloudFrag(),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  clouds.frustumCulled = false;
  clouds.renderOrder = -5;

  // ── tàn lửa từ sân khấu ──
  const seeds = new Float32Array(EMBERS * 4);
  let sd = 20262;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < EMBERS; i++) seeds.set([rnd(), rnd(), rnd(), (i + rnd()) / EMBERS], i * 4);
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3));
  eGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const eAmt = { value: 0 }, eDens = { value: 0 }, ePx = { value: 500 };
  const eMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime!, uPx: ePx, uDens: eDens, uAmt: eAmt },
    vertexShader: E_VERT, fragmentShader: eFrag(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const embers = new THREE.Points(eGeo, eMat);
  embers.frustumCulled = false;
  embers.renderOrder = -3;
  const v2 = new THREE.Vector2();
  embers.onBeforeRender = (renderer, _s, camera) => {
    renderer.getDrawingBufferSize(v2);
    ePx.value = v2.y * camera.projectionMatrix.elements[5]! * 0.5;
  };

  const group = new THREE.Group();
  group.add(clouds, beams, embers);
  group.visible = false;
  scene.add(group);

  const R = RAMPS;
  const cArc = new THREE.Color(R.arc![500]), cTung = new THREE.Color(R.tungsten![500]), cWhite = new THREE.Color(R.whitehot![300]);
  const lWarm = new THREE.Color(R.flame![500]).lerp(new THREE.Color(R.tungsten![500]), 0.15);
  const lHot = new THREE.Color(R.ember![300]).lerp(new THREE.Color(R.blood![100]), 0.4);
  const tgt = (i: number, pat: number, beat: number, pulse: number, out: THREE.Vector2) => {
    const o = org[i]!, s = i - (BEAMS - 1) / 2;
    const bt = beat * Math.PI;
    if (pat === 0) { // quạt: cả hàng quét ngang sân, lệch pha nhau
      out.set(CX + s * 11 + 26 * Math.sin(bt / 8 + i * 0.35), CZ - 14 + 34 * Math.sin(bt / 4 + i * 0.5));
    } else if (pat === 1) { // chéo: chùm bên trái vượt sang phải và ngược lại
      out.set(CX - o.x * 0.7 + 22 * Math.sin(bt / 8), CZ - 6 + 28 * Math.sin(bt / 2 + i * 0.9) - Math.abs(o.z - CZ) * 0.1);
    } else { // xoay quanh tâm
      const a = bt / 16 * (i % 2 ? -1 : 1) + i * Math.PI / 4, r = 32 + 22 * Math.sin(bt / 8 + i);
      out.set(CX + Math.cos(a) * r, CZ + Math.sin(a) * r);
    }
    const k = 1 + 0.07 * pulse;
    out.set(CX + (out.x - CX) * k, CZ + (out.y - CZ) * k);
  };
  const t0 = new THREE.Vector2(), t1 = new THREE.Vector2();
  let on = false, a = 0, lastT = -1;
  return {
    update(fs, t) {
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const h = fs.hype;
      if (!on && h > 0.4) on = true; else if (on && h < 0.37) on = false; // trễ: bật > 40 %, chỉ tắt < 37 %
      const target = on ? Math.max(auroraAmount(h), 0.1) : 0;
      a += Math.sign(target - a) * Math.min(Math.abs(target - a), dt / (target > a ? 1.4 : 2.4)); // "sập đèn → bật"
      amt.value = a;
      const w = smoothstep(0.4, 0.6, h);
      const hh = smoothstep(0.78, 0.92, h);
      warm.value = w; hot.value = hh;
      beamCol.value.copy(cArc).lerp(cTung, w).lerp(cWhite, hh * 0.85);
      litCol.value.copy(lWarm).lerp(lHot, hh);
      eAmt.value = a * smoothstep(0.55, 0.68, h);
      eDens.value = 0.25 + 0.75 * smoothstep(0.6, 0.95, h);
      group.visible = a > 0.003;
      if (!group.visible) return;
      const bar = fs.beat / 16;
      const pat = Math.floor(bar), blend = smoothstep(0.94, 1.0, bar - pat);
      for (let i = 0; i < BEAMS; i++) {
        tgt(i, ((pat % 3) + 3) % 3, fs.beat, fs.beatPulse, t0);
        tgt(i, (((pat + 1) % 3) + 3) % 3, fs.beat, fs.beatPulse, t1);
        t0.lerp(t1, blend);
        const o = org[i]!, d = dir[i]!;
        d.set(t0.x - o.x, HIT_Y - o.y, t0.y - o.z).normalize();
        const L = (HIT_Y - o.y) / d.y;
        len.value[i] = L;
        elong[i] = 1 / Math.max(d.y, 0.35);
        const hl = Math.hypot(d.x, d.z) || 1;
        hits[i]!.set(o.x + d.x * L, o.z + d.z * L, d.x / hl, d.z / hl);
      }
    },
    dispose() {
      scene.remove(group);
      beamGeo.dispose(); beamMat.dispose(); cloudGeo.dispose(); cloudMat.dispose(); eGeo.dispose(); eMat.dispose();
    },
  };
}

export const builders: Partial<OutsideBuilders> = { skyFeature: createSkySearchlights };
