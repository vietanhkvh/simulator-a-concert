// Màn bay chào mừng khi Hype chạm đỉnh (≥ 0,95; tái kích hoạt khi < 0,8; hồi chiêu ≥ 25 s), ~18 s:
// máy bay hai tầng cánh mập (thân trứng kem, sọc berry + phù hiệu sao, cánh quạt quay, phi công chibi quàng khăn)
// LUÔN bay từ TRÁI sang PHẢI của ca sĩ (ca sĩ nhìn -Z → phải = +X) ở độ cao FLYBY.y, z = FLYBY.z, kéo băng rôn
// mép răng cưa tròn, hai đầu thắt nơ (gợn sóng trong vertex shader; mặt sau lật UV nên đọc xuôi cả hai mặt),
// dây kéo có 3 cờ đuôi nheo; phát window 'cs-secret' {kind:'plane', phase:'start'|'end'};
// 4 khinh khí cầu bay lên từ sau khán đài xa (r ≈ 160 m, hai cánh ngoài 6 quả cố định) rồi ở lại ngoài đó, bay cao và
// thu nhỏ khi hết màn; + bụi sao lấp lánh honey/cream.
// 4 draw call khi chạy (máy bay+băng rôn kéo, thân khinh khí cầu, băng rôn khinh khí cầu, bụi sao), visible=false khi rảnh;
// mỗi frame chỉ đổi uniform/transform.
import { EYE_HEIGHT, FLYBY, STADIUM_CENTRE, STANDS_R_OUTER, STANDS_TOP_Y } from '../../world/layout';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import type { Uniforms } from '../../world/shared/glowPoints';
import { HAIR, INK_SKY, PAL, SKIN, popScale } from '../../world/style';
import { emitSecret, secretFocusState } from './secretShared';
import {
  BANNER_H, BANNER_PX_H, BANNER_PX_W, BANNER_TOP, BANNER_W, BALLOON_SCALE, BALLOON_STYLES,
  consumeFlybyRequest, getCheerTexts, onCheerChange,
} from './balloons';
import {
  BALLOON_FRAG, BANNER_FRAG, TOON_GLSL, balloonVert, bannerVert, buildBalloon, buildHangers, drawRibbonBanner, drawTowBanner,
  pushBanner, rgb,
} from './balloonKit';
export { triggerFlyby, setCheerBanners } from './balloons';

const DUR = 18;
const COOLDOWN = 25;
const PLANE_Y = FLYBY.y, PLANE_Z = FLYBY.z, PLANE_X = 110, PLANE_SCALE = 1.3;
const AW = 2048, AH = 384 + BANNER_PX_H * 2;
const TOW = { x: 0, y: 0, w: 2048, h: 384 };
const BAL_SLOTS = [
  { x: 0, y: 384 }, { x: 1024, y: 384 }, { x: 0, y: 384 + BANNER_PX_H }, { x: 1024, y: 384 + BANNER_PX_H },
];
const BAL_TEXT_IDX = [1, 2, 4, 5];
const BAL_STYLE_IDX = [3, 0, 1, 2];
// sau khán đài xa, hai bên cánh của 6 quả cố định (không che băng rôn của chúng); (độ quanh STADIUM_CENTRE, bán kính)
const BAL_ARC = [{ deg: -62, r: 158 }, { deg: -50, r: 165 }, { deg: 50, r: 165 }, { deg: 62, r: 158 }];
const BAL_DY = [2, 5, 5, 2];

const PLANE_VERT = /* glsl */ `
uniform float uTime;
attribute float aKind;
varying vec2 vUv; varying float vKind; varying vec3 vCol; varying vec3 vN;
void main(){
  vUv = uv; vKind = aKind; vCol = color; vN = normalize(mat3(modelMatrix) * normal);
  vec3 p = position;
  if (aKind > 2.5 && aKind < 3.5) {
    float d = max(-p.x - 11.0, 0.0);
    p.z += sin(d * 0.32 - uTime * 7.0) * (0.12 + d * 0.045) + sin(d * 0.9 - uTime * 11.0) * 0.08 * (d / 32.0);
    p.y -= d * d * 0.0012;
  } else if (aKind > 4.5) {
    float d = max(-p.x - 0.2, 0.0);
    p.y += sin(d * 2.2 - uTime * 14.0) * 0.12 * d; p.z += sin(d * 1.7 - uTime * 11.0) * 0.1 * d;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const PLANE_FRAG = /* glsl */ `
uniform float uTime; uniform sampler2D uMap;
varying vec2 vUv; varying float vKind; varying vec3 vCol; varying vec3 vN;
${TOON_GLSL}
void main(){
  vec3 c = vCol; float k = vKind;
  if (k > 3.5 && k < 4.5) { c = vCol; }
  else if (k > 2.5 && k < 3.5) {
    vec2 uv = vUv;
    vec4 tx = texture2D(uMap, uv);
    if (tx.a < 0.5) discard;
    c = tx.rgb;
  } else if (k > 1.5 && k < 2.5) {
    vec2 q = vUv - 0.5;
    float a = atan(q.y, q.x);
    float bl = smoothstep(0.62, 0.7, fract(a / 3.14159 + uTime * 9.0));
    float r = length(q) * 2.0;
    if (bl < 0.5 && r > 0.2) discard;
    c = r < 0.2 ? vCol : mix(vCol, vec3(1.0), 0.25);
  } else if (k > 0.5 && k < 1.5) {
    c = toon(vCol, vN);
    vec2 q = vec2((vUv.x - 0.25) * 6.2832, (vUv.y - 0.5) * 3.1416);
    c = mix(c, vec3(1.0, 0.58, 0.77), smoothstep(0.15, 0.1, length(vec2(abs(q.x) - 0.5, q.y + 0.2))) * 0.45);
    vec2 e = vec2(abs(q.x) - 0.3, q.y - 0.02);
    float eye = smoothstep(0.13, 0.1, length(e * vec2(1.0, 0.8)));
    c = mix(c, vec3(0.169, 0.114, 0.361), eye);
    c = mix(c, vec3(1.0), smoothstep(0.05, 0.03, length(e - vec2(-0.035, 0.045))) * eye);
    float sm = abs(length(q - vec2(0.0, -0.05)) - 0.17);
    c = mix(c, vec3(0.72, 0.2, 0.43), smoothstep(0.045, 0.02, sm) * step(q.y, -0.17) * step(abs(q.x), 0.12));
  } else {
    c = toon(vCol, vN);
    float hi = smoothstep(0.93, 0.95, dot(normalize(vN), normalize(vec3(-0.55, 0.62, 0.56))));
    c = mix(c, vec3(1.0, 0.98, 0.95), hi * 0.8 * step(k, 0.5));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const SPARK_VERT = /* glsl */ `
uniform float uTime; uniform float uPx; uniform float uE;
attribute vec4 aSeed; // pha, tốc độ nháy, kích thước, thời điểm xuất hiện
varying vec3 vCol;
void main(){
  float age = uE - aSeed.w;
  float life = smoothstep(0.0, 0.6, age) * (1.0 - smoothstep(${(DUR - 4).toFixed(1)}, ${DUR.toFixed(1)}, uE));
  float tw = pow(0.5 + 0.5 * sin(uTime * aSeed.y + aSeed.x), 3.0);
  vCol = color * life * (0.3 + 1.2 * tw);
  vec3 p = position + vec3(0.0, -age * 0.6, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = life > 0.0 ? max(aSeed.z * uPx / -mv.z, 1.5) : 0.0;
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  float star = max(smoothstep(0.12, 0.0, abs(q.x)) , smoothstep(0.12, 0.0, abs(q.y))) * smoothstep(1.0, 0.2, d);
  float a = smoothstep(0.5, 0.0, d) + star * 0.7;
  if (a < 0.02) discard;
  gl_FragColor = vec4(vCol * a, 1.0);
}`;

function starShape(r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ShapeGeometry(s);
}

/** Vị trí cuối của khinh khí cầu flyby i (đứng ngoài sân, ló trên khán đài). */
function flybyBalloonPos(i: number, out: THREE.Vector3) {
  const a = THREE.MathUtils.degToRad(BAL_ARC[i].deg), r = BAL_ARC[i].r;
  const x = STADIUM_CENTRE.x + Math.sin(a) * r, z = STADIUM_CENTRE.z - Math.cos(a) * r;
  const slope = (STANDS_TOP_Y - EYE_HEIGHT) / (STANDS_R_OUTER - STADIUM_CENTRE.z);
  return out.set(x, EYE_HEIGHT + Math.hypot(x, z) * slope - BANNER_TOP + BANNER_H * 0.93 + 1 + BAL_DY[i], z);
}

export function createFlyby(scene: THREE.Scene, uniforms: Uniforms) {
  const disposables: { dispose(): void }[] = [];

  // Atlas: băng rôn kéo + 4 băng rôn khinh khí cầu
  const canvas = document.createElement('canvas');
  canvas.width = AW; canvas.height = AH;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    const texts = getCheerTexts();
    drawTowBanner(ctx, TOW.x, TOW.y, TOW.w, TOW.h, `HYPE MAX! 100% ♥ ${texts[0].replace(/♥/g, '').trim()}`);
    BAL_SLOTS.forEach((r, i) => {
      const st = BALLOON_STYLES[BAL_STYLE_IDX[i]];
      drawRibbonBanner(ctx, r.x, r.y, BANNER_PX_W, BANNER_PX_H, texts[BAL_TEXT_IDX[i]], st.band, st.bow);
    });
    tex.needsUpdate = true;
  };
  draw();
  const off = onCheerChange(draw);
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(draw).catch(() => {});
  disposables.push(tex, { dispose: off });

  // ── Máy bay hai tầng cánh + dây kéo + băng rôn (1 mesh, mũi +X cục bộ, mặt +Z hướng về ca sĩ)
  const pParts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  const addP = (g0: THREE.BufferGeometry, kind: number, hex: number, hull = 0) => {
    if (!g0.attributes.normal) g0.computeVertexNormals();
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (g !== g0) g0.dispose();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const [r, gg, b] = rgb(hex); col.setRGB(r, gg, b);
    const c = new Float32Array(n * 3), k = new Float32Array(n).fill(kind);
    for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(k, 1));
    pParts.push(g);
    if (hull > 0) {
      const h = g.clone();
      const p = h.attributes.position as THREE.BufferAttribute, nr = h.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nr.getX(i) * hull, p.getY(i) + nr.getY(i) * hull, p.getZ(i) + nr.getZ(i) * hull);
      for (const key of Object.keys(h.attributes)) {
        const at = h.attributes[key] as THREE.BufferAttribute, s = at.itemSize, arr = at.array as Float32Array;
        for (let t = 0; t < at.count; t += 3) for (let cc = 0; cc < s; cc++) {
          const i1 = (t + 1) * s + cc, i2 = (t + 2) * s + cc, tv = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tv;
        }
      }
      const ink = rgb(INK_SKY), hc = h.attributes.color as THREE.BufferAttribute, hk = h.attributes.aKind as THREE.BufferAttribute;
      for (let i = 0; i < hc.count; i++) { hc.setXYZ(i, ink[0], ink[1], ink[2]); hk.setX(i, 4); }
      pParts.push(h);
    }
  };
  const CREAM = PAL.cream[500], BERRY = PAL.berry[500], HONEY = PAL.honey[300], HW = 0.09;
  const fus = new THREE.SphereGeometry(1, 24, 16); fus.scale(3.0, 1.45, 1.45); addP(fus, 0, CREAM, HW);
  const stripe = new THREE.CylinderGeometry(1.47, 1.47, 0.7, 24, 1, true); stripe.rotateZ(Math.PI / 2); stripe.translate(-0.6, 0, 0); addP(stripe, 0, BERRY);
  for (const sz of [1, -1]) {
    const zr = Math.sqrt(1 - (1.7 / 3) ** 2) * 1.45 + 0.03;
    const disc = new THREE.CircleGeometry(0.62, 20); const st = starShape(0.48); st.translate(0, 0, 0.02);
    for (const [g, kk, hx] of [[disc, 0, BERRY], [st, 0, HONEY]] as const) {
      if (sz < 0) g.rotateY(Math.PI);
      g.rotateY(sz * -0.25); g.translate(-1.7, 0.05, sz * zr); addP(g, kk, hx);
    }
  }
  const nose = new THREE.SphereGeometry(0.55, 16, 10); nose.translate(2.95, 0, 0); addP(nose, 0, HONEY, HW);
  const wing = (y: number, x: number, hex: number) => {
    const w = new THREE.CapsuleGeometry(0.5, 11, 4, 14); w.rotateX(Math.PI / 2); w.scale(1.9, 0.34, 1); w.translate(x, y, 0); addP(w, 0, hex, HW);
  };
  wing(2.35, 0.9, BERRY); wing(-0.75, 0.6, BERRY);
  for (const sz of [-4.2, 4.2]) for (const sx of [0.2, 1.5]) {
    const s = new THREE.CylinderGeometry(0.09, 0.09, 3.1, 6); s.translate(sx, 0.8, sz); addP(s, 0, HONEY);
  }
  const fin = new THREE.CapsuleGeometry(0.5, 1.0, 4, 10); fin.scale(1.5, 1.2, 0.3); fin.translate(-2.75, 1.05, 0); addP(fin, 0, BERRY, HW);
  const stab = new THREE.CapsuleGeometry(0.4, 3.2, 4, 10); stab.rotateX(Math.PI / 2); stab.scale(1.4, 0.35, 1); stab.translate(-2.75, 0.2, 0); addP(stab, 0, BERRY, HW);
  const prop = new THREE.CircleGeometry(2.0, 28); prop.rotateY(Math.PI / 2); prop.translate(3.45, 0, 0); addP(prop, 2, HONEY);
  for (const sz of [-1, 1]) {
    const wh = new THREE.TorusGeometry(0.42, 0.2, 8, 14); wh.translate(1.0, -2.1, sz * 1.05); addP(wh, 0, INK_SKY);
    const leg = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6); leg.rotateX(sz * 0.4); leg.translate(1.0, -1.45, sz * 0.8); addP(leg, 0, HONEY);
  }
  // phi công chibi: đầu to nhìn về ca sĩ (+Z), tóc, khăn quàng bay
  const head = new THREE.SphereGeometry(0.72, 18, 14); head.translate(-0.5, 1.95, 0.05); addP(head, 1, SKIN[1], 0.05);
  const hair = new THREE.SphereGeometry(0.77, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42); hair.rotateX(-0.3); hair.translate(-0.5, 1.98, 0.02); addP(hair, 0, HAIR[1]);
  const scarf = new THREE.TorusGeometry(0.5, 0.17, 8, 16); scarf.rotateX(Math.PI / 2); scarf.translate(-0.5, 1.3, 0); addP(scarf, 0, PAL.soda[500]);
  const tail = new THREE.CapsuleGeometry(0.16, 2.0, 3, 8); tail.rotateZ(Math.PI / 2 + 0.25); tail.scale(1, 1, 1.8); tail.translate(-1.75, 1.55, 0.25); addP(tail, 5, PAL.soda[500]);
  // dây kéo + 3 cờ đuôi nheo + cột trước băng rôn
  const rope = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b), g = new THREE.BoxGeometry(0.08, len, 0.08);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    addP(g, 0, PAL.cream[700]);
  };
  const tA = new THREE.Vector3(-3.0, -0.2, 0);
  rope(tA, new THREE.Vector3(-11, -0.4, 0)); rope(tA, new THREE.Vector3(-11, -6.8, 0));
  [BERRY, HONEY, PAL.soda[500]].forEach((hx, i) => {
    const x = -4.8 - i * 2.0, y = -0.2 - (x + 3) * -0.025;
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x - 0.5, y, 0, x + 0.5, y, 0, x, y - 1.2, 0]), 3));
    f.computeVertexNormals(); addP(f, 0, hx);
    const fb = f.clone(); fb.setIndex([0, 2, 1]); addP(fb, 0, hx);
  });
  const post = new THREE.CylinderGeometry(0.14, 0.14, 6.6, 6); post.translate(-11, -3.6, 0); addP(post, 0, INK_SKY);
  const TW = 34, TH = TW * TOW.h / TOW.w;
  const towBan = new THREE.PlaneGeometry(TW, TH, 64, 2);
  const tuv = towBan.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < tuv.count; i++) tuv.setXY(i, (TOW.x + tuv.getX(i) * TOW.w) / AW, 1 - (TOW.y + (1 - tuv.getY(i)) * TOW.h) / AH);
  towBan.translate(-11 - TW / 2, -3.6, 0);
  // mặt sau: tam giác đảo chiều + UV lật ngang để đọc xuôi từ phía sau (mesh vẽ FrontSide vì viền hull)
  const towBack = towBan.clone();
  towBack.setIndex(Array.from(towBan.index!.array).map((_, i, a) => a[i - (i % 3) + [0, 2, 1][i % 3]]));
  const bu = towBack.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < bu.count; i++) bu.setX(i, TOW.w / AW - bu.getX(i));
  addP(towBan, 3, CREAM);
  addP(towBack, 3, CREAM);
  const planeGeo = mergeGeometries(pParts)!;
  pParts.forEach((g) => g.dispose());
  const pU = { uTime: uniforms.uTime, uMap: { value: tex } };
  const planeMat = new THREE.ShaderMaterial({
    uniforms: pU, vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, vertexColors: true, side: THREE.FrontSide, fog: false,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.frustumCulled = false;
  plane.visible = false;
  scene.add(plane);
  disposables.push(planeGeo, planeMat);

  // ── 4 khinh khí cầu (thân + băng rôn; vị trí/scale từng quả qua uniform uBal)
  const bParts: THREE.BufferGeometry[] = [], banParts: THREE.BufferGeometry[] = [];
  const fin0 = new THREE.Vector3();
  const finals = BAL_ARC.map((_, i) => flybyBalloonPos(i, new THREE.Vector3()));
  for (let id = 0; id < 4; id++) {
    fin0.copy(finals[id]);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-fin0.x, -fin0.z));
    const S = BALLOON_SCALE;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(), q, new THREE.Vector3(S, S, S));
    buildBalloon(bParts, m, id, BALLOON_STYLES[BAL_STYLE_IDX[id]], 0.22);
    buildHangers(bParts, m, id, (BANNER_TOP - BANNER_H * (92 / 576)) / S, BANNER_W * 0.42 / S);
    const r = BAL_SLOTS[id];
    pushBanner(banParts, new THREE.Matrix4().compose(new THREE.Vector3(), q, new THREE.Vector3(1, 1, 1)), id, BANNER_W, BANNER_H, BANNER_TOP, {
      u0: r.x / AW, u1: (r.x + BANNER_PX_W) / AW, v0: 1 - (r.y + BANNER_PX_H) / AH, v1: 1 - r.y / AH,
    });
  }
  const balGeo = mergeGeometries(bParts)!, banGeo = mergeGeometries(banParts)!;
  bParts.forEach((g) => g.dispose()); banParts.forEach((g) => g.dispose());
  const uBal = [0, 1, 2, 3].map(() => new THREE.Vector4(0, -500, 0, 0));
  const balMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uHype: uniforms.uHype, uPulse: uniforms.uPulse, uBal: { value: uBal } },
    vertexShader: balloonVert(true), fragmentShader: BALLOON_FRAG, fog: false,
  });
  const banMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uHype: uniforms.uHype, uPulse: uniforms.uPulse, uMap: { value: tex }, uBal: { value: uBal } },
    vertexShader: bannerVert(true), fragmentShader: BANNER_FRAG, fog: false, side: THREE.DoubleSide,
  });
  const bal = new THREE.Mesh(balGeo, balMat), ban = new THREE.Mesh(banGeo, banMat);
  bal.frustumCulled = ban.frustumCulled = false;
  bal.visible = ban.visible = false;
  scene.add(bal, ban);
  disposables.push(balGeo, banGeo, balMat, banMat);

  // ── Bụi sao lấp lánh honey/cream (Points tĩnh, hoạt ảnh bằng uniform)
  const NS = 320;
  const sp = new Float32Array(NS * 3), sc = new Float32Array(NS * 3), ss = new Float32Array(NS * 4);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sparkCols = [PAL.honey[500], PAL.cream[300], PAL.honey[300], PAL.cream[500]];
  for (let i = 0; i < NS; i++) {
    if (i % 3 === 0) sp.set([(rnd() * 2 - 1) * 100, PLANE_Y + 3 + rnd() * 14, PLANE_Z - 6 - rnd() * 14], i * 3);
    else sp.set([(rnd() * 2 - 1) * 120, 48 + rnd() * 50, -120 - rnd() * 50], i * 3);
    const [r, g, b] = rgb(sparkCols[i % 4]);
    sc.set([r, g, b], i * 3);
    ss.set([rnd() * 6.28, 3 + rnd() * 6, 0.8 + rnd() * 1.4, rnd() * 8], i * 4);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 4));
  const uE = { value: 0 };
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uPx: uniforms.uPx, uE }, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const spark = new THREE.Points(sparkGeo, sparkMat);
  spark.frustumCulled = false;
  spark.visible = false;
  spark.renderOrder = 3;
  scene.add(spark);
  disposables.push(sparkGeo, sparkMat);

  plane.scale.setScalar(PLANE_SCALE);
  // +1 = từ trái sang phải của ca sĩ (−X → +X). Cố định theo yêu cầu.
  const dir = 1;
  let armed = true, lastStart = -Infinity, start = -1;
  const setVis = (on: boolean) => { plane.visible = bal.visible = ban.visible = spark.visible = on; };
  const begin = (t: number) => {
    if (start >= 0) emitSecret('plane', 'end');
    emitSecret('plane', 'start');
    start = t; lastStart = t;
    setVis(true);
  };
  const sm = THREE.MathUtils.smoothstep;
  return {
    update(f: FrameState, t: number) {
      if (consumeFlybyRequest()) begin(t);
      if (f.hype < 0.8) armed = true;
      else if (armed && f.hype >= 0.95 && t - lastStart >= COOLDOWN) { armed = false; begin(t); }
      if (start < 0) return;
      const e = t - start;
      if (e > DUR || e < 0) {
        start = -1;
        setVis(false);
        emitSecret('plane', 'end');
        secretFocusState.active = false;
        return;
      }
      uE.value = e;
      // máy bay: băng ngang từ -dir*X → +dir*X trong DUR-1 s
      const u = Math.min(e / (DUR - 1), 1);
      plane.position.set(dir * THREE.MathUtils.lerp(-PLANE_X, PLANE_X, u), PLANE_Y + Math.sin(e * 0.6) * 0.8, PLANE_Z + Math.sin(e * 0.25) * 2);
      // nghiêng cánh chào: mặt trên (phi công) nghiêng về phía ca sĩ
      plane.rotation.set(0.42 + Math.sin(e * 0.9) * 0.08, dir > 0 ? 0 : Math.PI, Math.sin(e * 0.6) * 0.03);
      // điểm nhìn: giữa máy bay và băng rôn
      secretFocusState.v.set(plane.position.x - 20 * PLANE_SCALE, PLANE_Y - 3, PLANE_Z);
      secretFocusState.active = true;
      // khinh khí cầu: bay lên từ sau khán đài xa, đứng lại ngoài đó, cuối màn bay cao và thu nhỏ
      const leave = sm(e, DUR - 4, DUR);
      for (let i = 0; i < 4; i++) {
        const rise = sm(e, i * 0.4, 6 + i * 0.4);
        const fp = finals[i];
        uBal[i].set(
          fp.x + dir * Math.max(0, e - 6) * 0.5,
          fp.y - (1 - rise) * 55 + leave * 25,
          fp.z,
          popScale(e - 0.2 - i * 0.4) * (1 - leave),
        );
      }
    },
    dispose() {
      disposed = true;
      disposables.forEach((d) => d.dispose());
    },
  };
}
