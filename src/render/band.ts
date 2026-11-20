// Ban nhạc sống trên sân khấu chính: tay trống, guitar, bass, keyboard, 2 vocal phụ.
// Low-poly như singer.ts nhưng TOÀN BỘ 6 nhạc công gộp vào 1 SkinnedMesh (vertex color, MeshBasic) + 1 mesh vòng sáng cộng màu
// => 2 draw call. Tay chân dùng bone + IK 2 đoạn (không cấp phát mỗi frame). Chỉ phụ thuộc FrameState (beat/hype).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../core/types';

export interface Band { update(f: FrameState): void; dispose(): void; }

const SCALE = 0.93; // thân gốc theo singer (~1,9 m) -> ~1,75 m
const L1 = 0.3;
const L2 = 0.29;
const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const DOWN = new V3(0, -1, 0);
const LIGHT = new V3(0.35, 0.85, 0.4).normalize();
const fract = (x: number) => x - Math.floor(x);
const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

type Kind = 'drum' | 'guitar' | 'bass' | 'keys' | 'vocal';

interface Look {
  jacket: number; jacketDark: number; trim: number; pants: number; boots: number; skin: number; hair: number;
  hairStyle: 'spiky' | 'long' | 'mohawk' | 'pony' | 'slick' | 'bob';
  sleeve?: number; skirt?: number; glasses?: boolean; body2?: number; guitar?: number;
}
interface Spec {
  kind: Kind; x: number; y: number; z: number; yaw: number; look: Look; sit?: boolean; mirror?: number; poolR: number; poolCol: number;
}
interface Arm { sh: THREE.Bone; el: THREE.Bone; pole: THREE.Vector3 }
interface Mus {
  spec: Spec; root: THREE.Bone; upper: THREE.Bone; head: THREE.Bone; legs: THREE.Bone[]; arms: Arm[];
  upperY: number; seed: number;
}

const SPECS: Spec[] = [
  { // Tay trống ngồi sau bộ trống (riser x=-6,5 z=1,5, mặt riser y=0,45)
    kind: 'drum', x: -6.5, y: 0.45, z: 1.5, yaw: 0.05, sit: true, poolR: 3.4, poolCol: 0xffc060,
    look: { jacket: 0x1d5fd0, jacketDark: 0x123a86, trim: 0xffd34d, pants: 0x15131f, boots: 0xe8e8f0, skin: 0xd9a07c, hair: 0x1a1016, hairStyle: 'spiky', sleeve: 0x1d5fd0 },
  },
  { // Guitar chính, cạnh amp bên trái
    kind: 'guitar', x: -9.9, y: 0, z: 1.15, yaw: -0.32, mirror: -1, poolR: 3.0, poolCol: 0xff8a2a,
    look: { jacket: 0x24222e, jacketDark: 0x15141c, trim: 0xff8a2a, pants: 0x4a1f6e, boots: 0x0e0d14, skin: 0xe6b494, hair: 0xc9782e, hairStyle: 'long', guitar: 0xd23a2a },
  },
  { // Bass, cạnh amp bên phải
    kind: 'bass', x: 9.9, y: 0, z: 1.15, yaw: 0.32, mirror: -1, poolR: 3.0, poolCol: 0x6aff9a,
    look: { jacket: 0x14906a, jacketDark: 0x0b5a42, trim: 0xa8ff6a, pants: 0x15131f, boots: 0xf2f2f8, skin: 0xa8714e, hair: 0x7a3cff, hairStyle: 'mohawk', guitar: 0x1a1a22 },
  },
  { // Keyboard sau cây đàn (riser x=6,5 z=1,5 mặt y=0,3), hạ thấp một chút (gập gối) để với tới phím
    kind: 'keys', x: 6.5, y: 0.3, z: 1.62, yaw: -0.08, poolR: 3.2, poolCol: 0xb47bff,
    look: { jacket: 0xdfe4f4, jacketDark: 0x9aa0c0, trim: 0xb47bff, pants: 0x20203a, boots: 0xf2f2f8, skin: 0xe0a985, hair: 0x5a3a24, hairStyle: 'slick', glasses: true },
  },
  { // 2 vocal phụ sau mic stand (±2,8, -1,8)
    kind: 'vocal', x: -2.8, y: 0, z: -1.25, yaw: 0.1, mirror: 1, poolR: 2.4, poolCol: 0xff6a9a,
    look: { jacket: 0xff4f7a, jacketDark: 0xc22a5a, trim: 0xffffff, pants: 0x1b1630, boots: 0xffffff, skin: 0xe8b090, hair: 0x15101a, hairStyle: 'pony', sleeve: 0xe8b090, skirt: 0xff4f7a },
  },
  {
    kind: 'vocal', x: 2.8, y: 0, z: -1.25, yaw: -0.1, mirror: -1, poolR: 2.4, poolCol: 0x5ff8ff,
    look: { jacket: 0x2fb6d8, jacketDark: 0x1a7a98, trim: 0xffffff, pants: 0x1b1630, boots: 0xffffff, skin: 0xc58a68, hair: 0xf0d27a, hairStyle: 'bob', sleeve: 0xc58a68, skirt: 0x2fb6d8 },
  },
];

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.4)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0.1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// scratch (không cấp phát trong update)
const _d = new V3(), _p = new V3(), _u = new V3(), _e = new V3(), _f = new V3(), _t = new V3();
const _q = new THREE.Quaternion();

/** IK 2 đoạn trong không gian local của `upper`: đặt tay (hand) tại (tx,ty,tz). */
function solveArm(a: Arm, tx: number, ty: number, tz: number) {
  const s = a.sh.position;
  _d.set(tx - s.x, ty - s.y, tz - s.z);
  let c = _d.length();
  if (c < 1e-4) { _d.set(0, -1, 0); c = 0.3; } else _d.divideScalar(c);
  c = clamp(c, 0.14, (L1 + L2) * 0.995);
  const cosA = clamp((L1 * L1 + c * c - L2 * L2) / (2 * L1 * c), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _p.copy(a.pole).addScaledVector(_d, -a.pole.dot(_d));
  if (_p.lengthSq() < 1e-6) _p.set(0, -1, 0).addScaledVector(_d, _d.y);
  _p.normalize();
  _u.copy(_d).multiplyScalar(cosA).addScaledVector(_p, sinA);
  a.sh.quaternion.setFromUnitVectors(DOWN, _u);
  _e.copy(s).addScaledVector(_u, L1);
  _f.copy(s).addScaledVector(_d, c).sub(_e).normalize();
  _q.copy(a.sh.quaternion).invert();
  _f.applyQuaternion(_q);
  a.el.quaternion.setFromUnitVectors(DOWN, _f);
}

export function createBand(scene: THREE.Scene): Band {
  const disposables: { dispose(): void }[] = [];
  const bones: THREE.Bone[] = [];
  const rests: THREE.Vector3[] = [];
  const parts: THREE.BufferGeometry[] = [];

  const bases = [new THREE.BoxGeometry(1, 1, 1), new THREE.CylinderGeometry(0.5, 0.5, 1, 8), new THREE.IcosahedronGeometry(0.5, 1)];
  disposables.push(...bases);
  const tc = new THREE.Color();
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), pp = new V3(), ss = new V3();

  const newBone = (parent: THREE.Bone | null, x: number, y: number, z: number) => {
    const b = new THREE.Bone();
    const pr = parent ? rests[bones.indexOf(parent)]! : null;
    b.position.set(x - (pr ? pr.x : 0), y - (pr ? pr.y : 0), z - (pr ? pr.z : 0));
    if (parent) parent.add(b);
    b.userData.i = bones.length;
    bones.push(b);
    rests.push(new V3(x, y, z));
    return b;
  };

  const rootGroup = new THREE.Group();
  rootGroup.name = 'band';

  function build(spec: Spec, seed: number): Mus {
    const lk = spec.look;
    const sit = !!spec.sit;
    const hipY = sit ? 0.58 : 0.92;
    const UY = sit ? 0.6 : 0.95;
    const { x: ox, y: oy, z: oz } = spec;
    const root = newBone(null, ox, oy, oz);
    rootGroup.add(root);
    const legs: THREE.Bone[] = [];
    const upper = newBone(root, ox, oy + UY, oz);
    const head = newBone(upper, ox, oy + UY + 0.78, oz);
    // P: thêm khối. Toạ độ x,y,z theo khung gốc (chân = 0, nhìn -Z); mọi khối được bake theo thế bind.
    const P = (bone: THREE.Bone, kind: 0 | 1 | 2, color: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const g = bases[kind]!.clone();
      pp.set(ox + x, oy + y, oz + z);
      ee.set(rx, ry, rz);
      qq.setFromEuler(ee);
      ss.set(sx, sy, sz);
      mm.compose(pp, qq, ss);
      g.applyMatrix4(mm);
      const h = g.index ? g.toNonIndexed() : g;
      if (h !== g) g.dispose();
      const n = h.getAttribute('normal');
      const cnt = n.count;
      const col = new Float32Array(cnt * 3);
      const si = new Uint16Array(cnt * 4);
      const sw = new Float32Array(cnt * 4);
      tc.setHex(color);
      const bi = bone.userData.i as number;
      for (let i = 0; i < cnt; i++) {
        const d = n.getX(i) * LIGHT.x + n.getY(i) * LIGHT.y + n.getZ(i) * LIGHT.z;
        const sh = 0.6 + 0.5 * Math.max(0, d);
        col[i * 3] = tc.r * sh; col[i * 3 + 1] = tc.g * sh; col[i * 3 + 2] = tc.b * sh;
        si[i * 4] = bi; sw[i * 4] = 1;
      }
      h.deleteAttribute('uv');
      h.deleteAttribute('normal');
      h.setAttribute('color', new THREE.BufferAttribute(col, 3));
      h.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
      h.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      parts.push(h);
    };
    const B = 0, C = 1, S = 2;
    const sleeve = lk.sleeve ?? lk.jacket;

    // chân
    for (const sx of [-1, 1]) {
      const hip = newBone(root, ox + sx * 0.1, oy + hipY, oz);
      legs.push(hip);
      if (!sit) {
        P(hip, B, lk.pants, 0.15, 0.82, 0.17, sx * 0.1, hipY - 0.41, 0);
        P(hip, B, lk.trim, 0.03, 0.7, 0.18, sx * 0.175, hipY - 0.4, 0);
        P(hip, B, lk.boots, 0.17, 0.14, 0.28, sx * 0.1, hipY - 0.85, -0.04);
      } else {
        P(hip, B, lk.pants, 0.16, 0.16, 0.5, sx * 0.1, hipY, -0.25);
        P(hip, B, lk.pants, 0.14, 0.5, 0.15, sx * 0.1, hipY - 0.27, -0.5);
        P(hip, B, lk.trim, 0.03, 0.4, 0.16, sx * 0.19, hipY - 0.27, -0.5);
        P(hip, B, lk.boots, 0.17, 0.12, 0.28, sx * 0.1, hipY - 0.54, -0.56);
      }
    }
    if (lk.skirt) P(root, C, lk.skirt, 0.5, 0.34, 0.4, 0, hipY + 0.0, 0);
    // thân
    P(root, B, lk.pants, 0.34, 0.16, 0.21, 0, UY, 0);
    P(root, B, lk.trim, 0.36, 0.05, 0.23, 0, UY + 0.08, 0);
    P(upper, C, lk.jacket, 0.38, 0.52, 0.26, 0, UY + 0.36, 0);
    P(upper, B, lk.trim, 0.05, 0.48, 0.02, -0.07, UY + 0.36, -0.135);
    P(upper, B, lk.trim, 0.05, 0.48, 0.02, 0.07, UY + 0.36, -0.135);
    P(upper, B, lk.jacketDark, 0.5, 0.1, 0.27, 0, UY + 0.58, 0);
    P(upper, B, lk.trim, 0.52, 0.025, 0.28, 0, UY + 0.635, 0);
    P(upper, C, lk.skin, 0.09, 0.08, 0.09, 0, UY + 0.67, 0);
    // đầu
    const HY = UY + 0.78;
    P(head, S, lk.skin, 0.2, 0.24, 0.21, 0, HY, 0);
    P(head, B, 0x14121c, 0.03, 0.03, 0.02, -0.045, HY + 0.02, -0.105); // mắt
    P(head, B, 0x14121c, 0.03, 0.03, 0.02, 0.045, HY + 0.02, -0.105);
    P(head, B, 0xb5605a, 0.06, 0.016, 0.02, 0, HY - 0.06, -0.105); // miệng
    if (lk.glasses) P(head, B, lk.trim, 0.19, 0.04, 0.03, 0, HY + 0.02, -0.112);
    else P(head, B, lk.trim, 0.2, 0.02, 0.03, 0, HY + 0.105, -0.1); // băng đô phát sáng
    const hs = lk.hairStyle;
    P(head, S, lk.hair, 0.23, 0.2, 0.24, 0, HY + 0.06, 0.02);
    P(head, S, lk.hair, 0.18, 0.3, 0.12, 0, HY - 0.08, 0.1);
    if (hs === 'long') P(head, B, lk.hair, 0.24, 0.55, 0.1, 0, HY - 0.25, 0.13);
    if (hs === 'mohawk') P(head, B, lk.hair, 0.05, 0.2, 0.3, 0, HY + 0.2, 0.02);
    if (hs === 'pony') { P(head, S, lk.hair, 0.1, 0.1, 0.1, 0, HY + 0.0, 0.18); P(head, B, lk.hair, 0.06, 0.34, 0.06, 0, HY - 0.2, 0.22); }
    if (hs === 'bob') P(head, B, lk.hair, 0.27, 0.3, 0.2, 0, HY - 0.08, 0.1);
    if (hs === 'spiky') for (const [x, rz] of [[-0.08, 0.5], [0, 0], [0.08, -0.5]] as [number, number][]) P(head, C, lk.hair, 0.06, 0.16, 0.06, x, HY + 0.21, 0.0, 0, 0, rz);

    // tay
    const arms: Arm[] = [];
    for (const sx of [-1, 1]) {
      const sh = newBone(upper, ox + sx * 0.27, oy + UY + 0.56, oz);
      P(sh, B, sleeve, 0.1, 0.3, 0.1, sx * 0.27, UY + 0.41, 0);
      P(sh, B, lk.trim, 0.11, 0.04, 0.11, sx * 0.27, UY + 0.29, 0);
      const el = newBone(sh, ox + sx * 0.27, oy + UY + 0.26, oz);
      P(el, B, lk.skin, 0.075, 0.27, 0.075, sx * 0.27, UY + 0.125, 0);
      P(el, S, lk.skin, 0.09, 0.09, 0.09, sx * 0.27, UY - 0.03, 0);
      arms.push({ sh, el, pole: new V3(sx * 0.7, -0.8, 0.5) });
      if (spec.kind === 'drum') { // dùi trống dọc theo cẳng tay
        P(el, C, 0xe8d8b0, 0.022, 0.46, 0.022, sx * 0.27, UY - 0.07, 0);
        P(el, S, 0xe8d8b0, 0.035, 0.035, 0.035, sx * 0.27, UY - 0.3, 0);
      }
    }

    // ghế / nhạc cụ
    if (sit) {
      P(root, C, 0x222034, 0.42, 0.05, 0.42, 0, 0.5, 0);
      P(root, C, lk.trim, 0.43, 0.02, 0.43, 0, 0.48, 0);
      P(root, C, 0x555570, 0.06, 0.48, 0.06, 0, 0.24, 0);
    }
    if (spec.kind === 'guitar' || spec.kind === 'bass') {
      const bass = spec.kind === 'bass';
      const m = spec.mirror!;
      const y0 = bass ? -0.13 : -0.06;
      const bw = bass ? 0.42 : 0.38, bh = bass ? 0.36 : 0.32;
      const len = bass ? 0.98 : 0.8;
      const al = bass ? 0.3 : 0.42;
      const gc = lk.guitar!;
      const bx = -m * 0.07;
      P(upper, C, gc, bw, 0.07, bh, bx, UY + y0, -0.2, Math.PI / 2);
      P(upper, C, gc, bw * 0.7, 0.07, bh * 0.75, bx + m * 0.2, UY + y0 + 0.07, -0.2, Math.PI / 2);
      P(upper, B, lk.trim, 0.3, 0.05, 0.012, bx + m * 0.04, UY + y0 + 0.02, -0.241); // pickguard sáng
      P(upper, B, 0x14121c, 0.14, 0.025, 0.014, bx + m * 0.02, UY + y0 - 0.06, -0.243);
      const cx = m * 0.1, cy = y0 + 0.07;
      const ca = Math.cos(al), sa = Math.sin(al);
      const rz = Math.atan2(sa, m * ca);
      // cần đàn
      P(upper, B, 0x6a4326, len, 0.045, 0.04, cx + m * ca * (len / 2 + 0.04), UY + cy + sa * (len / 2 + 0.04), -0.215, 0, 0, rz);
      P(upper, B, lk.trim, 0.13, 0.07, 0.035, cx + m * ca * (len + 0.1), UY + cy + sa * (len + 0.1), -0.215, 0, 0, rz);
      // dây đeo
      P(upper, B, lk.trim, 0.04, 0.72, 0.016, -m * 0.085, UY + 0.255, -0.15, 0, 0, m * 0.55);
    }
    if (spec.kind === 'vocal') { // tay cầm micro-stand: không cần thêm khối
    }
    return { spec, root, upper, head, legs, arms, upperY: UY, seed };
  }

  const mus: Mus[] = SPECS.map((s, i) => build(s, i));
  const find = (k: Kind, n = 0) => mus.filter((m) => m.spec.kind === k)[n]!;

  // gộp vào 1 SkinnedMesh
  const geo = mergeGeometries(parts, false)!;
  for (const g of parts) g.dispose();
  disposables.push(geo);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(mat);
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'bandMesh';
  mesh.add(rootGroup);
  scene.add(mesh);
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton, new THREE.Matrix4());
  disposables.push(skeleton);
  for (const m of mus) m.root.scale.setScalar(SCALE);

  // vòng sáng dưới chân
  const poolTex = radialTexture();
  disposables.push(poolTex);
  const poolParts: THREE.BufferGeometry[] = [];
  for (const m of mus) {
    const s = m.spec;
    const g = new THREE.PlaneGeometry(s.poolR, s.poolR);
    g.rotateX(-Math.PI / 2);
    g.translate(s.x, s.y + 0.06, s.z + (s.kind === 'drum' ? -0.3 : 0));
    tc.setHex(s.poolCol);
    const arr = new Float32Array(4 * 3);
    for (let i = 0; i < 4; i++) { arr[i * 3] = tc.r; arr[i * 3 + 1] = tc.g; arr[i * 3 + 2] = tc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('normal');
    poolParts.push(g);
  }
  const poolGeo = mergeGeometries(poolParts, false)!;
  poolParts.forEach((g) => g.dispose());
  disposables.push(poolGeo);
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
  });
  disposables.push(poolMat);
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.renderOrder = 2;
  pool.frustumCulled = false;
  scene.add(pool);

  // ───────── hoạt ảnh ─────────
  const dr = find('drum'), gt = find('guitar'), bs = find('bass'), kb = find('keys'), v0 = find('vocal', 0), v1 = find('vocal', 1);

  // Điểm đặt tay (khung gốc nhạc công) -> khung local của `upper`.
  const reachRoot = (m: Mus, a: Arm, rx: number, ry: number, rz: number) => {
    _t.set(rx, ry - m.upperY, rz);
    _q.copy(m.upper.quaternion).invert();
    _t.applyQuaternion(_q);
    solveArm(a, _t.x, _t.y, _t.z);
  };
  const reachUp = (a: Arm, x: number, y: number, z: number) => solveArm(a, x, y, z);

  const poseBase = (m: Mus, yaw: number, bob: number, y0 = 0) => {
    m.root.rotation.y = m.spec.yaw + yaw;
    m.root.position.y = m.spec.y + y0 + bob;
  };

  function animDrummer(f: FrameState, b: number, hype: number, pulse: number) {
    const m = dr;
    const lift8 = 0.5 - 0.5 * Math.cos(TAU * fract(b * 2));
    const u = (fract(b / 2) * 2 + 1) % 2; // 0 tại phách 2 và 4 (snare)
    const liftS = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const barPh = b % 4;
    const crash = smooth(0.6, 0.75, hype) * Math.max(clamp((barPh - 3.3) / 0.7, 0, 1), clamp(1 - barPh * 1.6, 0, 1));
    poseBase(m, 0, -pulse * 0.02 * (0.5 + hype));
    m.upper.rotation.set(-0.12 - pulse * 0.04, 0.12 * (liftS - lift8), 0.04 * Math.sin(Math.PI * b));
    m.head.rotation.set(0.1 - pulse * 0.16 * (0.4 + hype), Math.sin(b * 0.7) * 0.2, 0);
    // tay phải: hi-hat mỗi 8; crash ở đầu ô nhịp khi hype cao
    const hy = 0.84 + 0.18 * Math.pow(lift8, 1.3) * (1 - crash);
    reachRoot(m, m.arms[1]!, 0.42 + 0.3 * crash, hy + 0.4 * crash, -0.5 + 0.15 * crash);
    // tay trái: snare ở phách 2 và 4
    reachRoot(m, m.arms[0]!, -0.34, 0.84 + 0.18 * Math.pow(liftS, 1.3), -0.5);
    // chân đạp trống bass mỗi phách
    m.legs[1]!.rotation.x = 0.03 + 0.18 * pulse;
    m.legs[0]!.rotation.x = 0.02 + 0.05 * Math.sin(Math.PI * b);
  }

  function animGuitar(m: Mus, b: number, hype: number, pulse: number, bass: boolean) {
    const mir = m.spec.mirror!;
    const rate = bass ? (hype > 0.6 ? 2 : 1) : hype > 0.6 ? 4 : 2;
    const sph = TAU * b * rate;
    const bar = Math.floor(b / 4);
    const barPh = fract(b / 4);
    const big = hype > 0.8;
    const jump = big && bar % 2 === 0 ? Math.max(0, Math.sin(Math.PI * clamp((barPh - 0.75) * 4, 0, 1))) * 0.22 : 0;
    const lean = big && bar % 2 === 1 ? Math.sin(Math.PI * barPh) * 0.45 : 0;
    const groove = 0.4 + 0.6 * hype;
    poseBase(m, Math.sin(Math.PI * b * 0.25) * 0.12 * groove, Math.abs(Math.sin(Math.PI * b)) * 0.035 * groove + jump);
    m.upper.rotation.set(-0.03 - lean + pulse * 0.04, Math.sin(Math.PI * b * 0.5) * 0.14 * hype * mir, Math.sin(Math.PI * b) * 0.06 * groove);
    m.head.rotation.set(0.05 - pulse * 0.16 * (0.4 + hype) + lean * 0.5, -mir * 0.15 + Math.sin(b * 0.5) * 0.12, 0);
    const st = Math.sin(Math.PI * b) * 0.22 * groove * (1 - jump * 3);
    m.legs[0]!.rotation.set(st, 0, 0);
    m.legs[1]!.rotation.set(-st, 0, 0);
    const y0 = bass ? -0.13 : -0.06;
    const len = bass ? 0.98 : 0.8;
    const al = bass ? 0.3 : 0.42;
    const t = 0.5 + 0.32 * Math.sin(b * Math.PI * 0.5 + (bass ? 1 : 0)) * (0.5 + 0.5 * hype);
    const d = 0.2 + t * (len - 0.3);
    const fx = mir * (0.1 + Math.cos(al) * d);
    const fy = y0 + 0.07 + Math.sin(al) * d - 0.02;
    const fret = mir > 0 ? m.arms[1]! : m.arms[0]!;
    const strum = mir > 0 ? m.arms[0]! : m.arms[1]!;
    reachUp(fret, fx, fy, -0.29);
    reachUp(strum, -mir * 0.08, y0 + (bass ? 0.0 : 0.02) + (bass ? 0.05 : 0.11) * Math.sin(sph), -0.29);
  }

  function animKeys(m: Mus, b: number, hype: number, pulse: number) {
    const rate = hype > 0.6 ? 4 : 2;
    const pl = 0.5 - 0.5 * Math.cos(TAU * b * rate);
    const pr = 0.5 - 0.5 * Math.cos(TAU * (b * rate + 0.5));
    const groove = 0.4 + 0.6 * hype;
    poseBase(m, 0, Math.abs(Math.sin(Math.PI * b)) * 0.02 * groove, -0.0);
    m.upper.rotation.set(-0.3 - pulse * 0.05, Math.sin(Math.PI * b * 0.5) * 0.1, Math.sin(Math.PI * b) * 0.07 * groove);
    m.head.rotation.set(0.2 - pulse * 0.12 * (0.4 + hype), Math.sin(b * 0.5) * 0.18, 0);
    m.legs[0]!.rotation.x = Math.sin(Math.PI * b) * 0.08;
    m.legs[1]!.rotation.x = -Math.sin(Math.PI * b) * 0.08;
    const sw = Math.sin(b * Math.PI * 0.5) * 0.3 * (0.4 + hype);
    reachRoot(m, m.arms[0]!, -0.3 + sw, 1.03 + 0.07 * (1 - pl), -0.4);
    reachRoot(m, m.arms[1]!, 0.3 + sw, 1.03 + 0.07 * (1 - pr), -0.4);
  }

  function animVocal(m: Mus, b: number, hype: number, pulse: number) {
    const mir = m.spec.mirror!;
    const amp = 0.25 + 0.75 * hype;
    const cs = Math.cos(Math.PI * b);
    poseBase(m, 0, Math.abs(Math.sin(Math.PI * b)) * 0.05 * amp);
    m.root.position.x = m.spec.x + Math.sin(Math.PI * b) * 0.2 * amp * mir; // hai-bước đồng bộ, đối xứng
    m.upper.rotation.set(-0.02, Math.sin(Math.PI * b) * 0.18 * amp, Math.sin(Math.PI * b) * 0.1 * amp);
    m.head.rotation.set(0.05 - pulse * 0.14 * (0.4 + hype), -mir * 0.12, Math.sin(Math.PI * b) * 0.1);
    m.legs[0]!.rotation.z = -0.28 * Math.max(0, cs) * amp;
    m.legs[1]!.rotation.z = 0.28 * Math.max(0, -cs) * amp;
    m.legs[0]!.rotation.x = 0.1 * Math.max(0, cs) * amp;
    m.legs[1]!.rotation.x = 0.1 * Math.max(0, -cs) * amp;
    const bar = Math.floor(b / 4) % 2;
    const l0 = 0.5 - 0.5 * Math.cos(Math.PI * b);
    const l1 = 1 - l0;
    // tay: bơm luân phiên; nhịp chẵn: giơ cao đối xứng
    const hold = 1 - smooth(0.15, 0.4, hype);
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -1 : 1;
      const lf = bar === 0 ? (i === 0 ? l0 : l1) : pulse;
      const hx = sx * (0.32 + 0.3 * amp * lf);
      const hy = 0.25 + 0.55 * amp * lf;
      const hz = -0.22 - 0.1 * amp * (1 - lf);
      if (i === 1) { // tay phải: giữ cần mic khi hype thấp
        const mx = (m.spec.x - m.root.position.x) / SCALE * 1;
        reachUp(m.arms[1]!, hx * (1 - hold) + hold * (mx * 0 + 0.1), hy * (1 - hold) + hold * 0.55, hz * (1 - hold) - hold * 0.34);
      } else reachUp(m.arms[0]!, hx, hy, hz);
    }
  }

  return {
    update(f) {
      const hype = clamp(f.hype, 0, 1);
      const b = Math.max(0, f.beat);
      const pulse = f.beatPulse;
      animDrummer(f, b, hype, pulse);
      animGuitar(gt, b, hype, pulse, false);
      animGuitar(bs, b, hype, pulse, true);
      animKeys(kb, b, hype, pulse);
      animVocal(v0, b, hype, pulse);
      animVocal(v1, b, hype, pulse);
      poolMat.opacity = 0.42 + 0.22 * hype + 0.18 * pulse;
    },
    dispose() {
      scene.remove(mesh);
      scene.remove(pool);
      for (const d of disposables) d.dispose();
    },
  };
}
