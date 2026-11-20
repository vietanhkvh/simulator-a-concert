// Khán đài sân vận động "Kẹo đêm · chibi": 3 tầng bo tròn quanh khán giả, bảng khu A–H, bóng đèn dây, cờ,
// tháp đèn pha "cây nấm" 4 góc, "biển" lightstick khán đài xa (1 THREE.Points, hoạt ảnh trong shader).
// Draw call: kết cấu 1 + trang trí 1 + khán giả 1 (+ đèn pha/beacon nằm trong Points điểm sáng chung, world/shared/glowPoints.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../../core/types';
import { FIELD_Y, STADIUM_CENTRE, STANDS_ARC, STANDS_TIERS } from '../../world/layout';
import { addGlow, type GlowBuf, type Uniforms } from '../../world/shared/glowPoints';
import { PAL, ZONE_SAT, hexToRgb, hslToRgb, hypeColors, rgbToHsl, shade, shadowOf, type Rgb } from '../../world/style';
import { CROWD_FRAG, CROWD_VERT, DECOR_FRAG, STRUCT_FRAG, STRUCT_VERT, decorVert } from './stadiumShaders';
import { buildDecor, makeSignAtlas } from './stadiumDecor';

const CX = STADIUM_CENTRE.x, CZ = STADIUM_CENTRE.z;
const A0 = STANDS_ARC.from, A1 = STANDS_ARC.to;
// tầng: mặt trước (r, y đáy → y đỉnh), khán đài dốc (r0→r1, y0→y1)
const TIERS = STANDS_TIERS;
const SECTIONS = 8; // khu A–H
const ROOF_LIP_R = 126.9;

/** Màu token của khu khán đài (độ bão hoà 0.75) → [r,g,b] 0..1. */
const S = (hex: number): number[] => hexToRgb(shade(hex, 'stands'));
const satRgb = (c: Rgb): Rgb => { const [h, s, l] = rgbToHsl(c); return hslToRgb([h, s * ZONE_SAT.stands, l]); };

export function createStadium(scene: THREE.Scene, uniforms: Uniforms, glow: GlowBuf) {
  const disposables: { dispose(): void }[] = [];
  const pos: number[] = [], col: number[] = [], kind: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], ca: number[], cb: number[] = ca, k = 0) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    col.push(...ca, ...ca, ...cb, ...ca, ...cb, ...cb);
    for (let i = 0; i < 6; i++) kind.push(k);
  };
  const P = (r: number, a: number, y: number) => [CX + Math.sin(a) * r, y, CZ - Math.cos(a) * r];
  const N = 192;
  // đèn "mặt trời" giả: từ trên, hơi từ phía khán giả → bậc sáng / bậc bóng
  const LR = -0.47, LY = 0.88;
  type Seg = [number, number, number, number, number, number?]; // r1,y1,r2,y2,hex,(1=trim, 2=bóng ngược)
  const sweep = (segs: Seg[]) => {
    for (const [r1, y1, r2, y2, hex, f] of segs) {
      let nr = -(y2 - y1), ny = r2 - r1;
      const len = Math.hypot(nr, ny) || 1; nr /= len; ny /= len;
      if (f === 2) { nr = -nr; ny = -ny; }
      const lit = nr * LR + ny * LY > 0.28;
      const cc = f === 1 ? [1, 1, 1] : lit ? S(hex) : hexToRgb(shadowOf(shade(hex, 'stands')));
      for (let i = 0; i < N; i++) {
        const a = A0 + ((A1 - A0) * i) / N, b = A0 + ((A1 - A0) * (i + 1)) / N;
        quad(P(r1, a, y1), P(r1, b, y1), P(r2, b, y2), P(r2, a, y2), cc, cc, f === 1 ? 1 : 0);
      }
    }
  };
  const nightAt = (k: 700 | 500 | 300 | 100) => PAL.night[k];
  const segs: Seg[] = [];
  TIERS.forEach((T, ti) => {
    const rf = T.rf, y0 = T.y0;
    segs.push(
      [rf, T.yf0, rf, y0 - 0.95, nightAt(500)],            // thân tầng
      [rf, y0 - 0.95, rf - 0.1, y0 - 0.9, nightAt(300)],
      [rf - 0.1, y0 - 0.9, rf - 0.12, y0 - 0.7, nightAt(300), 1], // dải trim phát sáng màu Hype
      [rf - 0.12, y0 - 0.7, rf, y0 - 0.64, nightAt(300)],
      [rf, y0 - 0.64, rf - 0.3, y0 - 0.5, PAL.grape[700]],  // gờ bo tròn (mép trước tầng)
      [rf - 0.3, y0 - 0.5, rf - 0.5, y0 - 0.25, PAL.grape[500]],
      [rf - 0.5, y0 - 0.25, rf - 0.38, y0 + 0.02, PAL.grape[500]],
      [rf - 0.38, y0 + 0.02, rf - 0.1, y0 + 0.14, PAL.night[100]],
      [rf - 0.1, y0 + 0.14, rf + 0.3, y0 + 0.14, PAL.night[100]],
    );
    // ghế dốc: 4 dải hàng xen kẽ 2 tông (2 bậc)
    for (let s = 0; s < 4; s++) {
      const f0 = s / 4, f1 = (s + 1) / 4;
      segs.push([T.r0 + 0.3 + f0 * (T.r1 - T.r0 - 0.3), y0 + 0.14 + f0 * (T.y1 - y0 - 0.14), T.r0 + 0.3 + f1 * (T.r1 - T.r0 - 0.3), y0 + 0.14 + f1 * (T.y1 - y0 - 0.14), s % 2 ? PAL.night[700] : PAL.night[500]]);
    }
    const nx = TIERS[ti + 1];
    if (nx) segs.push([T.r1, T.y1, nx.rf - 0.5, nx.yf0, PAL.night[700]]); // trần bậc nối tầng
  });
  // tường sau + mái hiên bo tròn
  segs.push(
    [120, 30, 120, 33.4, PAL.night[300]],
    [120, 33.4, 126.0, 34.1, PAL.night[500], 2],           // mặt dưới mái
    [126.0, 34.1, 126.6, 34.35, PAL.grape[700]],
    [126.6, 34.35, ROOF_LIP_R, 34.9, PAL.grape[500]],
    [ROOF_LIP_R, 34.9, 126.6, 35.5, PAL.grape[500]],
    [126.6, 35.5, 126.0, 35.75, PAL.night[100]],
    [126.0, 35.75, 120, 34.3, PAL.night[300], 2],
  );
  sweep(segs);

  // hai đầu khán đài (bịt mặt cắt)
  const dark = S(PAL.night[700]);
  for (const a of [A0, A1]) {
    for (const T of TIERS) quad(P(T.rf, a, T.yf0), P(T.r1 + 1, a, T.yf0), P(T.r1 + 1, a, T.y1), P(T.rf, a, T.y0), dark);
    quad(P(120, a, 30), P(126, a, 30), P(126, a, 36), P(120, a, 36), dark);
  }

  // lối vào (vomitory) hình vòm tối + lối đi dọc ghế, tại ranh giới giữa các khu
  const secA = (A1 - A0) / SECTIONS;
  const tangent = (a: number) => [Math.cos(a), 0, Math.sin(a)];
  const archFan = (r: number, a: number, yb: number, h: number, w: number, c: number[]) => {
    const t = tangent(a), base = P(r, a, 0);
    const pt = (x: number, y: number) => [base[0] + t[0] * x, y, base[2] + t[2] * x];
    const outline: number[][] = [pt(-w, yb), pt(w, yb)];
    const yc = yb + h - w;
    for (let k = 0; k <= 10; k++) { const th = (k / 10) * Math.PI; outline.push(pt(w * Math.cos(th), yc + w * Math.sin(th))); }
    const cen = pt(0, yb + h / 2);
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i], q = outline[(i + 1) % outline.length];
      pos.push(...cen, ...p, ...q); col.push(...c, ...c, ...c); kind.push(0, 0, 0);
    }
  };
  for (let k = 1; k < SECTIONS; k++) {
    const a = A0 + secA * k;
    TIERS.forEach((T, ti) => {
      const h = ti === 0 ? 3.6 : T.y0 - 1.15 - T.yf0;
      archFan(T.rf - 0.05, a, T.yf0, h, 1.9, S(PAL.night[300]));
      archFan(T.rf - 0.07, a, T.yf0, h - 0.25, 1.55, S(PAL.night[700]));
      // lối đi trên ghế
      const t = tangent(a), w = 0.7, c = S(PAL.night[700]);
      const A = P(T.r0 + 0.3, a, T.y0 + 0.24), B = P(T.r1, a, T.y1 + 0.1);
      const off = (p: number[], s: number) => [p[0] + t[0] * w * s, p[1], p[2] + t[2] * w * s];
      quad(off(A, -1), off(A, 1), off(B, 1), off(B, -1), c);
    });
  }

  const structGeo = new THREE.BufferGeometry();
  structGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  structGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  structGeo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));

  // Tháp đèn pha 4 góc: cột bo + vành grape + đầu "nấm" + 6 bóng kem tròn + beacon nhấp nháy
  const parts: THREE.BufferGeometry[] = [structGeo];
  const towerA = [-0.62 * Math.PI, -0.3 * Math.PI, 0.3 * Math.PI, 0.62 * Math.PI];
  const lampHex = PAL.peach[100];
  const part = (g: THREE.BufferGeometry, m: THREE.Matrix4, hex: number, L: THREE.Vector3, flat = false) => {
    g.applyMatrix4(m);
    const ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose();
    const nrm = ng.attributes.normal, n = ng.attributes.position.count;
    const lit = S(hex), shd = hexToRgb(shadowOf(shade(hex, 'stands')));
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = flat ? 1 : nrm.getX(i) * L.x + nrm.getY(i) * L.y + nrm.getZ(i) * L.z;
      arr.set(d > 0.15 ? lit : shd, i * 3);
    }
    ng.deleteAttribute('normal'); ng.deleteAttribute('uv');
    ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    ng.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n), 1));
    parts.push(ng);
  };
  const cream = S(PAL.peach[300]), halo = S(PAL.peach[500]), grape = S(PAL.grape[300]);
  for (const a of towerA) {
    const R = 130, H = 52, HY = H + 3;
    const [x, , z] = P(R, a, 0);
    const ry = Math.atan2(-(x - CX), -(z - CZ)); // mặt đầu đèn hướng vào sân
    const fx = Math.cos(ry), fz = -Math.sin(ry); // trục ngang của đầu đèn
    const nx = Math.sin(ry), nz = Math.cos(ry); // pháp tuyến hướng vào sân
    const L = new THREE.Vector3(nx * 0.45, 0.88, nz * 0.45).normalize();
    const T4 = (px: number, py: number, pz: number, sx = 1, sy = 1, sz = 1) =>
      new THREE.Matrix4().makeTranslation(px, py, pz).multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
    const GY = FIELD_Y; // chân cột đứng trên mặt đất ở cao độ sân (FIELD_Y), không lơ lửng / không chìm
    const HB = H - GY; // cao từ chân tới đỉnh cột
    part(new THREE.CylinderGeometry(0.9, 1.5, HB, 16), T4(x, GY + HB / 2, z), PAL.night[300], L);
    part(new THREE.CylinderGeometry(3.4, 3.8, 0.7, 24), T4(x, GY + 0.35, z), PAL.night[100], L); // bệ tròn
    for (const yy of [9, 21, 33]) { const rr = 1.5 - 0.6 * ((yy - GY) / HB) + 0.08; part(new THREE.CylinderGeometry(rr, rr + 0.04, 1.4, 16), T4(x, yy, z), PAL.grape[500], L); }
    part(new THREE.SphereGeometry(2.3, 16, 10), T4(x, GY + 1.2, z, 1, 0.8, 1), PAL.night[300], L);
    part(new THREE.SphereGeometry(5.5, 24, 14), T4(x, HY, z, 1, 0.75, 1), PAL.night[100], L); // đầu nấm
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const ox = (i - 1) * 3.3, oy = (j - 0.5) * 3.2;
      const dep = 5.5 * Math.sqrt(Math.max(0.1, 1 - (ox * ox) / 30.25 - (oy * oy) / 17)) + 0.35;
      const lx = x + nx * dep + fx * ox, ly = HY + oy, lz = z + nz * dep + fz * ox;
      const lamp = new THREE.SphereGeometry(1.4, 14, 10);
      part(lamp, T4(lx, ly, lz), lampHex, L, true);
      addGlow(glow, lx + nx * 0.5, ly, lz + nz * 0.5, new THREE.Color(...cream), 0.3, 5.2, [2, 0, 0, 2]); // quầng mềm quanh bóng
    }
    addGlow(glow, x + nx * 2.5, HY, z + nz * 2.5, new THREE.Color(...halo), 0.2, 50, [2, 0, 0, 2]);
    addGlow(glow, x + nx * 2.5, HY, z + nz * 2.5, new THREE.Color(...grape), 0.1, 90, [2, 0, 0, 2]);
    // beacon nhỏ nhấp nháy trên đỉnh
    part(new THREE.SphereGeometry(0.7, 10, 8), T4(x, HY + 5.2, z), PAL.berry[500], L, true);
    addGlow(glow, x, HY + 5.2, z, new THREE.Color(...S(PAL.berry[500])), 1.5, 3.0, [2, 0.7 + 0.05 * a, a * 3, 1]);
  }
  const allGeo = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());

  // màu Hype dùng chung (stands: độ bão hoà 0.75) — mọi vật liệu của khu này cùng đọc
  const hypeU = { uHA: { value: new THREE.Vector3() }, uHB: { value: new THREE.Vector3() }, uHC: { value: new THREE.Vector3() } };
  const structMat = new THREE.ShaderMaterial({
    uniforms: { uTrim: hypeU.uHA, uTint: { value: new THREE.Vector3(1, 1, 1) }, uPulse: uniforms.uPulse ?? { value: 0 } },
    vertexShader: STRUCT_VERT, fragmentShader: STRUCT_FRAG, side: THREE.DoubleSide, fog: false,
  });
  const struct = new THREE.Mesh(allGeo, structMat);
  struct.renderOrder = -8;
  scene.add(struct);
  disposables.push(allGeo, structMat);

  // Trang trí (1 mesh): bóng đèn dây, bảng khu A–H, cờ
  const decorGeo = buildDecor({
    P, A0, A1, tiers: TIERS, signSections: SECTIONS, signR: (T) => T.rf - 0.06,
    roofBulb: { r: ROOF_LIP_R - 0.14, y: 34.9 },
  });
  const atlas = makeSignAtlas();
  const decorU = { uChase: { value: 0 }, uCheerFx: { value: 0 }, uTex: { value: atlas } };
  const decorMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...decorU }, vertexShader: decorVert(CX, CZ), fragmentShader: DECOR_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  const decor = new THREE.Mesh(decorGeo, decorMat);
  decor.frustumCulled = false;
  decor.renderOrder = -4;
  scene.add(decor);
  disposables.push(decorGeo, decorMat);
  if (atlas) disposables.push(atlas);

  // Đèn nhà/đèn pha trong Points điểm sáng chung (beacon, quầng); bóng đèn dây nằm trong mesh trang trí ở trên.

  // Khán giả khán đài xa: ~26k chấm kẹo, tầng dưới có lightstick sao/tim
  const COUNT = 26000;
  const cp = new Float32Array(COUNT * 3), cs = new Float32Array(COUNT * 2);
  const areas = TIERS.map((T) => (T.r1 - T.r0) * (T.r0 + T.r1) / 2);
  const tot = areas.reduce((s, v) => s + v, 0);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < COUNT; i++) {
    let pick = rnd() * tot, ti = 0;
    while (ti < 2 && pick > areas[ti]) { pick -= areas[ti]; ti++; }
    const T = TIERS[ti];
    const rows = Math.round((T.r1 - T.r0) / 0.9);
    const row = Math.floor(rnd() * rows);
    const f = (row + 0.5) / rows;
    const r = T.r0 + 0.5 + f * (T.r1 - T.r0 - 1);
    const y = T.y0 + 0.14 + f * (T.y1 - T.y0) + 1.0 + rnd() * 0.3;
    let u = 0.01 + rnd() * 0.98;
    for (let k = 1; k < SECTIONS; k++) { // tránh lối đi
      const du = u - k / SECTIONS, lim = 1.2 / (r * (A1 - A0));
      if (Math.abs(du) < lim) u = k / SECTIONS + Math.sign(du || 1) * lim * (1 + rnd());
    }
    const a = A0 + (A1 - A0) * u;
    cp.set(P(r, a, y), i * 3);
    cs[i * 2] = rnd(); cs[i * 2 + 1] = u;
  }
  const crowdGeo = new THREE.BufferGeometry();
  crowdGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  crowdGeo.setAttribute('aSeed', new THREE.BufferAttribute(cs, 2));
  const fxU = {
    uCheer: { value: 0 }, uCheerAge: { value: 99 }, uWave: { value: 0 }, uWavePos: { value: -1 },
    uHeart: { value: 0 }, uHeartAge: { value: 99 }, uFlash: { value: 0 }, uPyro: { value: 0 }, uPyroAge: { value: 99 },
  };
  const crowdMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...fxU, ...hypeU }, vertexShader: CROWD_VERT, fragmentShader: CROWD_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const crowd = new THREE.Points(crowdGeo, crowdMat);
  crowd.frustumCulled = false;
  crowd.renderOrder = 1;
  scene.add(crowd);
  disposables.push(crowdGeo, crowdMat);

  // Tương tác khán giả (sự kiện 'cs-interact' từ main.ts) → bao hiệu ứng nới mềm trong JS
  const age = { cheer: 99, wave: 99, heart: 99, pyro: 99 };
  let flashOn = false, waveModeOn = false, lastT = -1, lastReal = performance.now(), waveLap = 0, chase = 0;
  const onInteract = (e: Event) => {
    const d = (e as CustomEvent).detail as { kind?: string; on?: boolean } | undefined;
    if (!d) return;
    if (d.kind === 'cheer') age.cheer = 0;
    else if (d.kind === 'heart') age.heart = 0;
    else if (d.kind === 'pyro') age.pyro = 0;
    else if (d.kind === 'flash') flashOn = d.on ?? !flashOn;
    else if (d.kind === 'wave') { if (fxU.uWave.value < 0.05) waveLap = 0; age.wave = 0; }
  };
  window.addEventListener('cs-interact', onInteract);
  const env = (a: number, dur: number, fin: number, fout: number) => Math.max(0, Math.min(1, a / fin, (dur - a) / fout));
  const ease = (v: number, target: number, rate: number) => v + Math.max(-rate, Math.min(rate, target - v));
  const tint = structMat.uniforms.uTint.value as THREE.Vector3;
  crowd.onBeforeRender = () => {
    const now = performance.now();
    const t = uniforms.uTime?.value as number ?? now / 1000;
    const hype = (uniforms.uHype?.value as number) ?? 0;
    let dt = t - lastT;
    if (lastT < 0 || dt <= 0 || dt > 0.5) dt = Math.min(0.1, (now - lastReal) / 1000); // tạm dừng: dùng đồng hồ thực
    lastT = t; lastReal = now;
    const hc = hypeColors(hype);
    hypeU.uHA.value.set(...satRgb(hc.primary));
    hypeU.uHB.value.set(...satRgb(hc.secondary));
    hypeU.uHC.value.set(...satRgb(hc.accent));
    age.cheer += dt; age.wave += dt; age.heart += dt; age.pyro += dt;
    const cheer = env(age.cheer, 2.6, 0.12, 0.9), heart = env(age.heart, 4.2, 0.3, 1.0), pyro = env(age.pyro, 3.4, 0.1, 1.0);
    fxU.uCheer.value = cheer; fxU.uCheerAge.value = age.cheer;
    fxU.uHeart.value = heart; fxU.uHeartAge.value = age.heart;
    fxU.uPyro.value = pyro; fxU.uPyroAge.value = age.pyro;
    fxU.uFlash.value = ease(fxU.uFlash.value, flashOn ? 1 : 0, dt / 0.7);
    const waveOn = waveModeOn || age.wave < 6;
    fxU.uWave.value = ease(fxU.uWave.value, waveOn ? 1 : 0, dt / 0.7);
    if (fxU.uWave.value > 0) waveLap += dt / 3; else waveLap = 0; // 1 vòng / 3 s
    fxU.uWavePos.value = (waveLap % 1) * 1.3 - 0.15;
    // đèn dây chạy chậm, nhanh hơn khi Hype cao; loé theo hò reo; kết cấu ấm lên khi pháo hoa
    chase += dt * (0.9 + 3.6 * hype);
    decorU.uChase.value = chase;
    decorU.uCheerFx.value = cheer * (0.5 + 0.5 * Math.sin(t * 30)) * 0.8 + pyro * 0.3;
    const fl = cheer * (0.5 + 0.5 * Math.sin(t * 30)) * 0.4 + pyro * 0.2;
    tint.set(1 + fl, 1 + fl * (1 - 0.25 * pyro), 1 + fl * (1 - 0.6 * pyro));
  };

  return {
    /** Tuỳ chọn: gọi mỗi khung để đồng bộ waveMode (1 = sóng) với khán đài xa. */
    update(f: FrameState, _t?: number) { waveModeOn = f.waveMode === 1; },
    dispose() {
      window.removeEventListener('cs-interact', onInteract);
      scene.remove(struct, decor, crowd);
      disposables.forEach((d) => d.dispose());
    },
  };
}
