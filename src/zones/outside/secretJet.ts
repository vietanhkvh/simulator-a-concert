// ★ Phi đội phản lực chibi (STYLE_GUIDE · SECRET OBJECT): 3 máy bay đồ chơi mập (dài ≤ 2,2 × đường kính thân,
// mũi tròn, cánh + 2 đuôi bo tròn, vòm kính thấy phi công chibi đội mũ, viền kem + phù hiệu sao, lửa đuôi tròn),
// màu berry / honey / soda. 2 chiếc vẽ TRÁI TIM khổng lồ (từ mũi dưới lên khe trên, tốc độ đều), chiếc soda bắn
// "mũi tên" có đầu chữ V + lông đuôi. Khói tim/mũi tên + màng tô bên trong = 1 quad trong mặt phẳng tim, vẽ bằng SDF
// (secretJetHeart.ts): nét đều, viền mực/berry khử răng cưa, đường sáng bên trong kiểu sticker, thân phồng mây mịn,
// tan từ mép vào trong ~15 s. Xong tim: đập nhẹ, màng tô hiện dần + tim mini bay lên. Hết màn, máy bay KHÔNG dừng:
// tách đội vút đi tăng tốc tới ≥ 350 m (thu nhỏ dần theo khoảng cách camera trước mặt cắt xa) rồi mới ẩn.
// Draw call: máy bay (3 chiếc gộp) + viền + quad tim + 1 Points + vành secret = 5. Mỗi frame chỉ đổi uniform/transform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { INK, INK_SKY, OUTLINE, PAL, SKIN, hexToRgb, mixHex, popScale, shadowOf } from '../../world/style';
import { type SecretAct, disposeTree, pxScale, seededRnd } from './secretShared';
import { createSecretHalo } from './secretHalo';
import { DRAGON_PTS_FRAG } from './secretDragonShaders';
import { JET_GLSL } from './secretJetShaders';
import {
  ARROW_DIR, ARROW_SLOPE, ARROW_SPD, ARROW_U0, ARROW_U1, ARROW_V0, HEART_HALF_LEN, HEART_SPD, SDF_BOX, T_C0, T_HEART, T_MEET,
  arrowTimeAtU, buildHeartSdf, heartAt,
} from './secretJetHeart';

const D = 24;
const TILT = (50 * Math.PI) / 180;
/** Tâm trái tim (điểm nhìn chính). */
export const JET_HEART_CENTER = new THREE.Vector3(0, 48, -34);
const EX = new THREE.Vector3(1, 0, 0);
// mặt phẳng tim ngả về phía ca sĩ (pháp tuyến hướng xuống giữa ca sĩ và camera wide)
const EY = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
/** Pháp tuyến mặt phẳng tim, hướng về phía ca sĩ. */
const EN = EX.clone().cross(EY);
const T_IN = 0;
const JET_COL = [PAL.berry[500], PAL.honey[500], PAL.soda[500]];
const SMOKE_LIFE = 15;
const JET_SCALE = 2.4;
const OBJ_H = 2.6 * JET_SCALE;
/** Máy bay ẩn khi đã cách gốc sân khấu quá mức này (m) — lúc đó đã ra khỏi khung nhìn / thu nhỏ hết. */
const EXIT_R = 360;

const plane = (u: number, v: number, out: THREE.Vector3) =>
  out.copy(JET_HEART_CENTER).addScaledVector(EX, u).addScaledVector(EY, v);
const hp = { u: 0, v: 0 };
const TIP = plane(0, heartAt(0, 1, hp).v, new THREE.Vector3());
const DIMPLE = plane(0, heartAt(HEART_HALF_LEN, 1, hp).v, new THREE.Vector3());
const ease = (u: number) => u * u * (3 - 2 * u);
const sm = (a: number, b: number, x: number) => ease(Math.min(1, Math.max(0, (x - a) / (b - a))));

// Đường thoát (tích phân sẵn): từ khe trên, đang lao xuống theo -EY, bẻ lái ra ngoài + lên cao + ra xa, tăng tốc.
const EXIT_DT = 1 / 60, EXIT_N = 60 * 12;
const EXIT_PATH = [0, 1].map((i) => {
  const s = i === 0 ? 1 : -1;
  const out = new Float32Array((EXIT_N + 1) * 3);
  const pos = DIMPLE.clone(), v = new THREE.Vector3();
  const d0 = EY.clone().negate();
  const d1 = new THREE.Vector3(s * 0.78, 0.42, -0.46).normalize();
  const dir = new THREE.Vector3();
  for (let k = 0; k <= EXIT_N; k++) {
    out.set([pos.x + EN.x * s * 0.6, pos.y + EN.y * s * 0.6, pos.z + EN.z * s * 0.6], k * 3);
    const e = k * EXIT_DT;
    dir.copy(d0).lerp(d1, sm(0, 1.3, e)).normalize();
    const spd = Math.min(HEART_SPD + 38 * e, 85);
    v.copy(dir).multiplyScalar(spd);
    pos.addScaledVector(v, EXIT_DT);
  }
  return out;
});

/** Vị trí jet i tại thời điểm t (giải tích + bảng đường thoát). */
function jetPos(i: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  if (i < 2) {
    const s = i === 0 ? 1 : -1;
    if (t < T_HEART) {
      // lao vào từ sau sân khấu (+Z), bay thấp qua mái rồi kéo lên mũi tim — Bézier bậc 2
      const u = Math.max(0, (t - T_IN) / (T_HEART - T_IN));
      const p0x = s * 14, p0y = 30, p0z = 190;
      const cx = s * 3, cy = 14, cz = 20;
      const m = 1 - u;
      return out.set(
        m * m * p0x + 2 * m * u * cx + u * u * TIP.x,
        m * m * p0y + 2 * m * u * cy + u * u * TIP.y,
        m * m * p0z + 2 * m * u * cz + u * u * TIP.z,
      );
    }
    if (t < T_MEET) {
      heartAt((t - T_HEART) * HEART_SPD, s, hp);
      return plane(hp.u, hp.v, out).addScaledVector(EN, s * 0.6 * sm(T_MEET - 1.5, T_MEET, t));
    }
    const f = Math.min((t - T_MEET) / EXIT_DT, EXIT_N - 1e-3), k = Math.floor(f), w = f - k;
    const P = EXIT_PATH[i]!;
    return out.set(
      P[k * 3]! + (P[k * 3 + 3]! - P[k * 3]!) * w,
      P[k * 3 + 1]! + (P[k * 3 + 4]! - P[k * 3 + 1]!) * w,
      P[k * 3 + 2]! + (P[k * 3 + 5]! - P[k * 3 + 2]!) * w,
    );
  }
  // mũi tên: thẳng trong mặt phẳng tim, trái → phải, lệch 2 m về phía ca sĩ; bay đều tới khi ra khỏi sân xa
  const a = (t - T_C0) * ARROW_SPD - 150 * Math.hypot(1, ARROW_SLOPE);
  const u = a * ARROW_DIR.u;
  return plane(u, ARROW_V0 + ARROW_SLOPE * u, out).addScaledVector(EN, 2);
}

// ───────────── Máy bay đồ chơi (mũi +Z, đơn vị: đường kính thân = 2) ─────────────
function buildJets(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const q = new THREE.Vector3();
  for (let j = 0; j < 3; j++) {
    const add = (g: THREE.BufferGeometry, hex: number | ((p: THREE.Vector3) => number), kind = 0, uv?: (p: THREE.Vector3) => [number, number]) => {
      const h = g.index ? g.toNonIndexed() : g;
      if (h !== g) g.dispose();
      h.deleteAttribute('uv');
      const pa = h.getAttribute('position');
      const n = pa.count;
      const col = new Float32Array(n * 3), shc = new Float32Array(n * 3), aj = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        q.fromBufferAttribute(pa, i);
        const c = typeof hex === 'number' ? hex : hex(q);
        col.set(hexToRgb(c), i * 3);
        shc.set(hexToRgb(mixHex(shadowOf(c), c, 0.3)), i * 3);
        const [u, v] = uv ? uv(q) : [0, 0];
        aj.set([j, kind, u, v], i * 4);
      }
      h.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
      h.setAttribute('aSh', new THREE.BufferAttribute(shc, 3));
      h.setAttribute('aJ', new THREE.BufferAttribute(aj, 4));
      parts.push(h);
    };
    const main = JET_COL[j]!;
    const trim = PAL.cream[500];
    // thân: lathe siêu-elip, mũi mập tròn, đuôi hơi bằng
    const prof: THREE.Vector2[] = [];
    const N = 36;
    for (let k = 0; k <= N; k++) {
      const u = -1 + (2 * k) / N;
      const e = u < 0 ? 3.2 : 2.3;
      const r = Math.pow(Math.max(0, 1 - Math.abs(u) ** e), 1 / e);
      prof.push(new THREE.Vector2(Math.max(r, k === 0 || k === N ? 0 : 0.02), u * 2.1 + 0.1));
    }
    const body = new THREE.LatheGeometry(prof, 28);
    body.rotateX(Math.PI / 2);
    add(body, (p) => (p.z > 1.75 ? trim : main));
    // vòng viền kem quanh thân
    const ring = new THREE.TorusGeometry(0.97, 0.11, 8, 28);
    ring.translate(0, 0, -0.75);
    add(ring, trim);
    // vòm kính phía sau phi công + khung kính trước
    const can = new THREE.SphereGeometry(0.62, 18, 12);
    can.scale(0.92, 0.78, 1.25);
    can.translate(0, 0.78, -0.25);
    add(can, PAL.soda[100], 4);
    const frame = new THREE.TorusGeometry(0.5, 0.07, 6, 18, Math.PI);
    frame.scale(1.1, 0.8, 1);
    frame.rotateX(-0.7);
    frame.translate(0, 0.62, 1.5);
    add(frame, trim);
    // phi công: đầu da + mũ bảo hiểm màu chủ đạo + kính mắt mật ong
    const hc = new THREE.Vector3(0, 1.12, 0.45);
    const head = new THREE.SphereGeometry(0.4, 18, 14);
    head.translate(hc.x, hc.y, hc.z);
    add(head, SKIN[0]!, 2, (p) => [(p.x - hc.x) / 0.4, (p.y - hc.y) / 0.4]);
    const helm = new THREE.SphereGeometry(0.47, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
    helm.rotateX(-0.55);
    helm.translate(hc.x, hc.y + 0.03, hc.z - 0.05);
    add(helm, j === 1 ? PAL.berry[300] : PAL.honey[300]);
    const vis = new THREE.TorusGeometry(0.43, 0.06, 6, 16, Math.PI * 0.9);
    vis.rotateZ(0.05 * Math.PI);
    vis.rotateX(-1.05);
    vis.translate(hc.x, hc.y + 0.18, hc.z + 0.08);
    add(vis, PAL.cream[300]);
    // cánh mập bo tròn + đầu cánh kem + phù hiệu sao
    for (const sx of [-1, 1]) {
      const w = new THREE.SphereGeometry(1, 20, 10);
      w.scale(1.2, 0.2, 0.62);
      w.rotateY(sx * 0.28);
      w.translate(sx * 1.25, -0.2, -0.15);
      const rc = new THREE.Vector3(sx * 1.45, 0, -0.2);
      add(w, main, 3, (p) => [(p.x - rc.x) / 0.42, (p.z - rc.z) / 0.42]);
      const tip = new THREE.SphereGeometry(0.26, 12, 8);
      tip.scale(1, 0.85, 1.3);
      tip.translate(sx * 2.38, -0.2, -0.5);
      add(tip, trim);
      // 2 đuôi đứng nghiêng ra ngoài
      const fin = new THREE.SphereGeometry(1, 14, 10);
      fin.scale(0.13, 0.58, 0.42);
      fin.translate(0, 0.45, 0);
      fin.rotateZ(-sx * 0.38);
      fin.translate(sx * 0.4, 0.4, -1.55);
      add(fin, main);
      const ft = new THREE.SphereGeometry(0.16, 10, 8);
      ft.translate(sx * 0.4 + sx * Math.sin(0.38) * 0.95, 0.4 + Math.cos(0.38) * 0.95, -1.55);
      add(ft, trim);
    }
    // vòi + lửa đuôi tròn
    const noz = new THREE.TorusGeometry(0.5, 0.13, 8, 20);
    noz.translate(0, 0, -1.98);
    add(noz, PAL.night[100]);
    const fl = new THREE.SphereGeometry(0.4, 16, 12);
    fl.scale(1, 1, 1.15);
    fl.translate(0, 0, -2.25);
    add(fl, PAL.honey[300], 1);
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

export function createJet(scene: THREE.Scene): SecretAct {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ── Quad trái tim + mũi tên + màng tô (SDF) trong mặt phẳng tim
  const sdf = buildHeartSdf();
  const qGeo = new THREE.PlaneGeometry(SDF_BOX.u1 - SDF_BOX.u0, SDF_BOX.v1 - SDF_BOX.v0, 1, 1);
  qGeo.translate((SDF_BOX.u0 + SDF_BOX.u1) / 2, (SDF_BOX.v0 + SDF_BOX.v1) / 2, 0);
  const tArrowDone = arrowTimeAtU(ARROW_U1) + 0.3;
  const heartU = {
    uSdf: { value: sdf },
    uBox: { value: new THREE.Vector4(SDF_BOX.u0, SDF_BOX.v0, SDF_BOX.u1 - SDF_BOX.u0, SDF_BOX.v1 - SDF_BOX.v0) },
    uC: { value: JET_HEART_CENTER.clone() }, uEX: { value: EX.clone() }, uEY: { value: EY.clone() },
    uScale: { value: 1 }, uDrift: { value: new THREE.Vector3() },
    uT: { value: 0 },
    uSpd: { value: new THREE.Vector4(HEART_SPD, ARROW_SPD, T_MEET, tArrowDone) },
    uDiss: { value: new THREE.Vector2() },
    uFill: { value: 0 }, uWob: { value: 0 },
  };
  const heartMat = new THREE.ShaderMaterial({
    vertexShader: JET_GLSL.heartVert, fragmentShader: JET_GLSL.heartFrag, uniforms: heartU,
    transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const heartQuad = new THREE.Mesh(qGeo, heartMat);
  heartQuad.frustumCulled = false;
  heartQuad.renderOrder = 5;
  root.add(heartQuad);
  const p = new THREE.Vector3(), q = new THREE.Vector3();

  // ── 3 máy bay gộp 1 geometry; ma trận từng chiếc qua uniform
  const uM = [0, 1, 2].map(() => new THREE.Matrix4());
  const uVis = [0, 0, 0];
  const jetU = {
    uM: { value: uM }, uVis: { value: uVis }, uT: { value: 0 }, uViewH: { value: 720 },
    uOutW: { value: OUTLINE.secret * OBJ_H }, uObjH: { value: OBJ_H },
    uInk: { value: new THREE.Vector3().fromArray(hexToRgb(INK_SKY)) },
    uRimC: { value: new THREE.Vector3().fromArray(hexToRgb(PAL.cream[300])) },
    uFace: { value: new THREE.Vector3().fromArray(hexToRgb(INK)) },
  };
  const jetGeo = buildJets();
  const mkJ = (hull: boolean) => {
    const m = new THREE.Mesh(jetGeo, new THREE.ShaderMaterial({
      vertexShader: JET_GLSL.vert, fragmentShader: JET_GLSL.frag, uniforms: jetU, fog: false,
      defines: hull ? { HULL: 1 } : {}, side: hull ? THREE.BackSide : THREE.FrontSide,
    }));
    m.frustumCulled = false;
    root.add(m);
    return m;
  };
  mkJ(false);
  mkJ(true);

  // ── Hạt: sao rơi dọc khói + tim mini bay lên khi tim hoàn thành (1 Points)
  const rnd = seededRnd(4242);
  const NSTAR = 420, NHEART = 18;
  const pp = new Float32Array((NSTAR + NHEART) * 3), sd4 = new Float32Array((NSTAR + NHEART) * 4), pc = new Float32Array((NSTAR + NHEART) * 3);
  for (let i = 0; i < NSTAR; i++) {
    const j = i % 3;
    let te: number;
    if (j < 2) {
      const a = rnd() * HEART_HALF_LEN;
      te = T_HEART + a / HEART_SPD;
      heartAt(a, j === 0 ? 1 : -1, hp);
    } else {
      const u = ARROW_U0 + rnd() * (ARROW_U1 - ARROW_U0);
      te = arrowTimeAtU(u);
      hp.u = u; hp.v = ARROW_V0 + ARROW_SLOPE * u;
    }
    plane(hp.u, hp.v, p);
    pp.set([p.x, p.y, p.z], i * 3);
    sd4.set([te, 0, rnd(), rnd()], i * 4);
    pc.set(hexToRgb(rnd() < 0.6 ? PAL.honey[500] : PAL.cream[100]), i * 3);
  }
  for (let i = 0; i < NHEART; i++) {
    heartAt(rnd() * HEART_HALF_LEN, rnd() < 0.5 ? 1 : -1, hp);
    plane(hp.u, hp.v, p).lerp(JET_HEART_CENTER, 0.15 + rnd() * 0.5);
    const k = NSTAR + i;
    pp.set([p.x, p.y, p.z], k * 3);
    sd4.set([T_MEET + 0.2 + rnd() * 5, 1, rnd(), rnd()], k * 4);
    pc.set(hexToRgb(rnd() < 0.7 ? PAL.berry[500] : PAL.berry[300]), k * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(sd4, 4));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(pc, 3));
  const ptsU = { uT: { value: 0 }, uPx: { value: 720 }, uHeart: { value: JET_HEART_CENTER.clone() }, uBeat: { value: 0 }, uDone: { value: 0 } };
  const pts = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    vertexShader: JET_GLSL.ptsVert, fragmentShader: DRAGON_PTS_FRAG, uniforms: ptsU,
    transparent: true, depthWrite: false, fog: false,
  }));
  pts.frustumCulled = false;
  pts.renderOrder = 7;
  root.add(pts);

  const halo = createSecretHalo();
  root.add(halo.group);

  const fwd = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3(), h = new THREE.Vector3();
  const mtx = new THREE.Matrix4(), rq = new THREE.Quaternion(), sc = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const UPV = new THREE.Vector3(0, 1, 0);
  const HEART_UP = EN.clone();
  const ZAX = new THREE.Vector3(0, 0, 1);
  const tArrowStart = T_C0 - 4; // xuất phát ngoài xa (thu nhỏ theo khoảng cách) rồi bay vào
  const visStart = [0, 0, tArrowStart];

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      heartU.uT.value = ptsU.uT.value = jetU.uT.value = t;
      ptsU.uPx.value = jetU.uViewH.value = pxScale();
      ptsU.uBeat.value = f.beatPulse;
      const done = sm(T_MEET + 0.2, T_MEET + 1.2, t);
      ptsU.uDone.value = done;
      // tim xong: đập nhẹ theo phách; trôi nhẹ theo gió; tan từ mép vào
      heartU.uScale.value = 1 + done * (0.018 * Math.sin(t * 6) + 0.015 * f.beatPulse);
      const drift = Math.max(0, t - T_HEART);
      heartU.uDrift.value.set(0.12 * drift, 0.05 * drift, 0);
      heartU.uWob.value = sm(T_MEET, T_MEET + 10, t);
      heartU.uDiss.value.set(sm(T_MEET + 7, T_MEET + SMOKE_LIFE - 0.8, t), sm(tArrowDone + 7.5, tArrowDone + 13.5, t));
      heartU.uFill.value = sm(T_MEET + 0.3, T_MEET + 2.2, t) * (1 - sm(T_MEET + 6, T_MEET + 11, t));
      for (let j = 0; j < 3; j++) {
        jetPos(j, t, p);
        const vis = t >= visStart[j]! && (j < 2 ? t < T_MEET + 1 || p.length() < EXIT_R : t < T_C0 || p.length() < EXIT_R);
        uVis[j] = vis ? 1 : 0;
        if (!vis) continue;
        // hướng mũi theo vận tốc trung bình ±0,12 s → bẻ lái mượt, không giật
        jetPos(j, t - 0.12, q);
        jetPos(j, t + 0.12, fwd);
        fwd.sub(q).normalize();
        // cánh vuông góc mặt phẳng tim khi đang vẽ; bay ngang thì giữ cánh ngang
        const inHeart = j < 2 && t > T_HEART - 0.3 && t < T_MEET + 0.6;
        h.copy(inHeart ? HEART_UP : UPV);
        r.crossVectors(h, fwd);
        if (r.lengthSq() < 1e-6) r.set(1, 0, 0);
        r.normalize();
        u.crossVectors(fwd, r);
        mtx.makeBasis(r, u, fwd);
        quat.setFromRotationMatrix(mtx);
        // roll: chào cánh khi qua sân · lộn vòng đồng bộ khi tách đội · mũi tên lộn khi ra
        let roll = 0;
        if (j < 2) {
          roll = Math.sin(t * 9) * 0.45 * sm(0.8, 1.2, t) * (1 - sm(1.9, 2.3, t));
          roll += Math.PI * 2 * sm(T_MEET + 0.3, T_MEET + 1.8, t) * (j === 0 ? 1 : -1);
        } else roll = Math.PI * 2 * sm(arrowTimeAtU(ARROW_U1) + 0.6, arrowTimeAtU(ARROW_U1) + 1.8, t);
        quat.multiply(rq.setFromAxisAngle(ZAX, roll));
        // nhún nhảy đội hình (tắt khi đang vẽ để nét khói khớp đường bay)
        const bob = Math.sin(t * 3.2 + j * 1.7) * 0.45 * (inHeart ? 0 : 1);
        p.addScaledVector(u, bob);
        const pop = j < 2 ? popScale(t - visStart[j]!) : 1;
        const stretch = (t < T_HEART && j < 2) || (j < 2 && t > T_MEET + 0.5) ? 1.08 : 1;
        sc.set(pop, pop, pop * stretch).multiplyScalar(JET_SCALE);
        uM[j]!.compose(p, quat, sc);
        if (j === 0) halo.group.position.copy(p);
      }
      const appear = sm(0.05, 0.5, t) * (1 - sm(T_MEET + 0.8, T_MEET + 2.2, t));
      halo.update(t, 2.4 * JET_SCALE, appear);
    },
    focus(t: number, out: THREE.Vector3) {
      if (t < T_HEART - 0.3) jetPos(0, t, out).lerp(JET_HEART_CENTER, 0.5);
      else out.copy(JET_HEART_CENTER);
    },
    dispose() {
      halo.dispose();
      sdf.dispose();
      disposeTree(root);
    },
  };
}
