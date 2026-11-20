// ★ Phi đội phản lực chibi (STYLE_GUIDE · SECRET OBJECT): 3 máy bay đồ chơi mập (dài ≤ 2,2 × đường kính thân,
// mũi tròn, cánh + 2 đuôi bo tròn, vòm kính thấy phi công chibi đội mũ, viền kem + phù hiệu sao, lửa đuôi tròn),
// màu berry / honey / soda. Bay đúng quỹ đạo cũ: 2 chiếc vẽ TRÁI TIM khổng lồ trên trời, chiếc soda bắn "mũi tên".
// Khói là dải mập mép gợn mây (berry-300 / cream / soda-300) + sao nhỏ rơi; tim hoàn thành thì đập nhẹ + tim mini bay lên.
// Bay đội hình nhún nhảy, chào cánh khi qua sân, lộn vòng đồng bộ trước khi tách đội. Viền ink (inverted hull) + tô 2 bậc.
// Draw call: máy bay (3 chiếc gộp) + viền + ribbon + 1 Points + vành secret = 5. Mỗi frame chỉ đổi uniform/transform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { INK, INK_SKY, OUTLINE, PAL, SKIN, hexToRgb, mixHex, popScale, shadowOf } from '../../world/style';
import { type SecretAct, disposeTree, pxScale, seededRnd } from './secretShared';
import { createSecretHalo } from './secretHalo';
import { DRAGON_PTS_FRAG } from './secretDragonShaders';
import { JET_GLSL } from './secretJetShaders';

const D = 24;
const TILT = (50 * Math.PI) / 180;
/** Tâm trái tim (điểm nhìn chính). */
export const JET_HEART_CENTER = new THREE.Vector3(0, 48, -34);
const K = 1.35; // tỉ lệ trái tim (đơn vị công thức → m)
const EX = new THREE.Vector3(1, 0, 0);
// mặt phẳng tim ngả về phía ca sĩ (pháp tuyến hướng xuống giữa ca sĩ và camera wide)
const EY = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
const T_IN = 0, T_HEART = 2.6, T_MEET = 8.6, T_OUT = 11.2;
const T_C0 = 3.4, T_C1 = 9.8; // mũi tên
const JET_COL = [PAL.berry[500], PAL.honey[500], PAL.soda[500]];
const SMOKE_COL = [PAL.berry[300], PAL.berry[300], PAL.soda[300]];
const SMOKE_EDGE = [PAL.berry[500], PAL.berry[500], PAL.soda[500]];
const SMOKE_LIFE = 15;
const JET_SCALE = 2.4;
const OBJ_H = 2.6 * JET_SCALE;

const heartPt = (tau: number, out: THREE.Vector3) => {
  const x = 16 * Math.sin(tau) ** 3;
  const y = 13 * Math.cos(tau) - 5 * Math.cos(2 * tau) - 2 * Math.cos(3 * tau) - Math.cos(4 * tau);
  return out.copy(JET_HEART_CENTER).addScaledVector(EX, x * K).addScaledVector(EY, y * K);
};
const TIP = heartPt(Math.PI, new THREE.Vector3());
const DIMPLE = heartPt(0, new THREE.Vector3());
const ease = (u: number) => u * u * (3 - 2 * u);
const sm = (a: number, b: number, x: number) => ease(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** Vị trí jet i tại thời điểm t (giải tích). */
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
      const u = ease((t - T_HEART) / (T_MEET - T_HEART));
      const tau = i === 0 ? Math.PI * (1 - u) : Math.PI * (1 + u);
      return heartPt(tau, out);
    }
    // thoát: vút lên cao và ra xa phía khán đài đối diện
    const u = Math.min(1, (t - T_MEET) / (T_OUT - T_MEET));
    return out.set(DIMPLE.x + s * 45 * u * u, DIMPLE.y + 55 * u, DIMPLE.z - 90 * u);
  }
  // mũi tên: thẳng từ trái (-X) sang phải (+X), xuyên tâm tim, lệch chút về phía ca sĩ
  const u = (t - T_C0) / (T_C1 - T_C0);
  return out.set(-150 + 300 * u, JET_HEART_CENTER.y - 30 + 60 * u, JET_HEART_CENTER.z + 3 - 6 * u);
}
const EMIT: [number, number][] = [[1.2, T_MEET + 0.4], [1.2, T_MEET + 0.4], [5.0, 8.4]];

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

  // ── Ribbon khói tĩnh cho cả 3 jet
  const NSEG = 300;
  const pos: number[] = [], tan: number[] = [], colA: number[] = [], colE: number[] = [], info: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3(), tv = new THREE.Vector3();
  for (let j = 0; j < 3; j++) {
    const [t0, t1] = EMIT[j]!;
    const ca = hexToRgb(SMOKE_COL[j]!), ce = hexToRgb(SMOKE_EDGE[j]!);
    const base = pos.length / 3;
    let arc = 0;
    jetPos(j, t0, q);
    for (let k = 0; k <= NSEG; k++) {
      const te = t0 + ((t1 - t0) * k) / NSEG;
      jetPos(j, te, p);
      arc += p.distanceTo(q);
      jetPos(j, te + 0.02, q);
      tv.copy(q).sub(p).normalize();
      for (const side of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        tan.push(tv.x, tv.y, tv.z);
        colA.push(...ca);
        colE.push(...ce);
        info.push(te, side, j, arc);
      }
      q.copy(p);
      if (k < NSEG) {
        const a = base + k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tGeo.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 3));
  tGeo.setAttribute('aCol', new THREE.Float32BufferAttribute(colA, 3));
  tGeo.setAttribute('aEdge', new THREE.Float32BufferAttribute(colE, 3));
  tGeo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
  tGeo.setIndex(idx);
  const heartU = { uHeart: { value: JET_HEART_CENTER.clone() }, uBeat: { value: 0 }, uDone: { value: 0 } };
  const trailU = { uT: { value: 0 }, uLife: { value: SMOKE_LIFE }, ...heartU };
  const trail = new THREE.Mesh(tGeo, new THREE.ShaderMaterial({
    vertexShader: JET_GLSL.trailVert, fragmentShader: JET_GLSL.trailFrag, uniforms: trailU,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  trail.frustumCulled = false;
  trail.renderOrder = 5;
  root.add(trail);

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
    const [t0, t1] = EMIT[j]!;
    const te = t0 + rnd() * (t1 - t0);
    jetPos(j, te, p);
    pp.set([p.x, p.y, p.z], i * 3);
    sd4.set([te, 0, rnd(), rnd()], i * 4);
    pc.set(hexToRgb(rnd() < 0.6 ? PAL.honey[500] : PAL.cream[100]), i * 3);
  }
  for (let i = 0; i < NHEART; i++) {
    heartPt(rnd() * Math.PI * 2, p).lerp(JET_HEART_CENTER, 0.15 + rnd() * 0.5);
    const k = NSTAR + i;
    pp.set([p.x, p.y, p.z], k * 3);
    sd4.set([T_MEET + 0.2 + rnd() * 5, 1, rnd(), rnd()], k * 4);
    pc.set(hexToRgb(rnd() < 0.7 ? PAL.berry[500] : PAL.berry[300]), k * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(sd4, 4));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(pc, 3));
  const ptsU = { uT: { value: 0 }, uPx: { value: 720 }, ...heartU };
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
  const HEART_UP = EY.clone().cross(EX).negate();
  const visRange = (j: number, t: number) => (j < 2 ? t >= 0 && t <= T_OUT : t >= T_C0 && t <= T_C1);
  const visStart = [0, 0, T_C0];

  return {
    duration: D,
    start() { root.visible = true; },
    stop() { root.visible = false; },
    update(t: number, f: FrameState) {
      trailU.uT.value = ptsU.uT.value = jetU.uT.value = t;
      ptsU.uPx.value = jetU.uViewH.value = pxScale();
      heartU.uBeat.value = f.beatPulse;
      heartU.uDone.value = sm(T_MEET + 0.2, T_MEET + 1.2, t);
      for (let j = 0; j < 3; j++) {
        const vis = visRange(j, t);
        uVis[j] = vis ? 1 : 0;
        if (!vis) continue;
        jetPos(j, t, p);
        jetPos(j, t + 0.03, q);
        fwd.copy(q).sub(p).normalize();
        // cánh vuông góc mặt phẳng tim khi đang vẽ; bay ngang thì giữ cánh ngang
        h.copy(Math.abs(fwd.y) > 0.6 ? HEART_UP : UPV);
        r.crossVectors(h, fwd);
        if (r.lengthSq() < 1e-6) r.set(1, 0, 0);
        r.normalize();
        u.crossVectors(fwd, r);
        mtx.makeBasis(r, u, fwd);
        quat.setFromRotationMatrix(mtx);
        // roll: chào cánh khi qua sân · lộn vòng đồng bộ trước khi tách đội · mũi tên lộn khi ra
        let roll = 0;
        if (j < 2) {
          roll = Math.sin(t * 9) * 0.45 * sm(0.8, 1.2, t) * (1 - sm(1.9, 2.3, t));
          roll += Math.PI * 2 * sm(T_MEET + 0.1, T_MEET + 1.4, t) * (j === 0 ? 1 : -1);
        } else roll = Math.PI * 2 * sm(7.6, 8.8, t);
        quat.multiply(rq.setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
        // nhún nhảy đội hình
        const bob = Math.sin(t * 3.2 + j * 1.7) * 0.45;
        p.addScaledVector(u, bob);
        const pop = popScale(t - visStart[j]!);
        const stretch = t < T_HEART && j < 2 ? 1.06 : 1;
        sc.set(pop, pop, pop * stretch).multiplyScalar(JET_SCALE);
        uM[j]!.compose(p, quat, sc);
        if (j === 0) halo.group.position.copy(p);
      }
      const appear = sm(0.05, 0.5, t) * (1 - sm(T_OUT - 0.8, T_OUT, t));
      halo.update(t, 2.4 * JET_SCALE, appear);
    },
    focus(t: number, out: THREE.Vector3) {
      if (t < T_HEART - 0.3) jetPos(0, t, out).lerp(JET_HEART_CENTER, 0.5);
      else out.copy(JET_HEART_CENTER);
    },
    dispose() {
      halo.dispose();
      disposeTree(root);
    },
  };
}
