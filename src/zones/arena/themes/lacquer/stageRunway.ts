// "Mực & Sơn mài" — khe `runway`: lối đi sơn then chỉ vàng, rèm son rủ hai bên + tua vàng, lan can son thấp mũ vàng,
// mặt bục = mặt trống đồng (B-stage: trống lớn 14 tia + vành chim Lạc), cổng chào tre mái ngói nhỏ + đèn lồng + cờ ngũ sắc
// thay cổng kẹo (cao 4,3 m, đi dưới được). Hình đi lại theo walkLayout.ts. 4 draw call + đèn lồng instanced.
import * as THREE from 'three';
import type { FrameState } from '../../../../core/types';
import { FIELD_Y, STAGE_Y } from '../../../../world/layout';
import { hypeColors, toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { WALK_SHAPES, edgeRuns, shapeSignedDist, type WalkShape } from '../../walkLayout';
import { addGlow } from './stageBase';
import { DRUM_GLSL, Kit, R, V, createLanterns, hipRoof, kitMaterial } from './stageKit';

const RAIL_Y = 0.55;

const DISC_FRAG = /* glsl */ `
uniform float uBeat; uniform float uHype; uniform float uRot;
uniform vec3 uBase; uniform vec3 uGold; uniform vec3 uGoldHi; uniform vec3 uA;
varying vec2 vUv;
${DRUM_GLSL}
void main(){
  vec2 q = (vUv - 0.5) * 2.0;
  vec2 d = drumFace(q, 0.0, uRot);
  vec3 gold = mix(uGold, uA, 0.2 + 0.15 * uHype);
  vec3 col = mix(uBase, gold * 0.9, d.x);
  col = mix(col, mix(uGoldHi, uA, 0.3) * (0.9 + 0.4 * uBeat * uHype), d.y);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Cờ ngũ sắc: 5 hình vuông lồng nhau (chàm · vỏ trứng · ngọc · vàng · son) + diềm răng cưa; mặt phẳng XY, cán ở x = 0. */
export function fiveColourFlag(k: Kit, x: number, y: number, z: number, w: number, ry: number) {
  const P = R();
  const cols = [P.indigo[500], P.silk[500], P.jade[500], P.gold[500], P.son[500]];
  const m = k.xf(x, y, z, 0, ry);
  const sq = (s: number, hex: number, dz: number) => {
    const g = new THREE.PlaneGeometry(w * s, w * s * 0.9);
    g.translate(w / 2, -w * 0.45, dz);
    k.add(g, hex, m, true);
  };
  cols.forEach((c, i) => sq(1 - i * 0.18, c, -0.004 * i));
  // diềm răng cưa son dưới mép
  for (let i = 0; i < 6; i++) {
    const g = new THREE.BufferGeometry();
    const x0 = (i / 6) * w, x1 = ((i + 1) / 6) * w, yb = -w * 0.9;
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0, yb, 0, x1, yb, 0, (x0 + x1) / 2, yb - w * 0.16, 0], 3));
    k.add(g, i % 2 ? P.son[500] : P.gold[500], m, true);
  }
}

export function createLacquerRunway(ctx: ArenaBuildContext) {
  const { scene, glow } = ctx;
  const P = R();
  const FLOOR = FIELD_Y - 0.2;
  const H = STAGE_Y - FLOOR, MID = (STAGE_Y + FLOOR) / 2;
  const deck = new Kit();
  const edge = new Kit();
  const discs: THREE.BufferGeometry[] = [];

  const outward = (s: WalkShape, x: number, z: number, tx: number, tz: number): [number, number] => {
    let nx = -tz, nz = tx;
    if (shapeSignedDist(s, x + nx * 0.25, z + nz * 0.25) < shapeSignedDist(s, x - nx * 0.25, z - nz * 0.25)) { nx = -nx; nz = -nz; }
    return [nx, nz];
  };

  for (const s of WALK_SHAPES) {
    if (!s.mesh) continue;
    if (s.kind === 'disc') {
      deck.add(new THREE.CylinderGeometry(s.r, s.r, H, 48), P.lac[700], deck.xf(s.x, MID - 0.01, s.z));
      const g = new THREE.CircleGeometry(s.r - 0.12, 72).rotateX(-Math.PI / 2);
      g.translate(s.x, STAGE_Y + 0.008, s.z);
      discs.push(g);
      edge.add(new THREE.TorusGeometry(s.r - 0.06, 0.04, 4, 72).rotateX(Math.PI / 2), P.gold[500], edge.xf(s.x, 0.012, s.z), true);
    } else {
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
      deck.add(new THREE.BoxGeometry(s.hw * 2, H, L), P.lac[700], deck.xf((s.ax + s.bx) / 2, MID, (s.az + s.bz) / 2, 0, Math.atan2(s.bx - s.ax, s.bz - s.az)));
      // mặt sàn sơn then sáng hơn một bậc
      const top = new THREE.PlaneGeometry(s.hw * 2 - 0.02, L).rotateX(-Math.PI / 2);
      deck.add(top, P.lac[500], deck.xf((s.ax + s.bx) / 2, STAGE_Y + 0.004, (s.az + s.bz) / 2, 0, Math.atan2(s.bx - s.ax, s.bz - s.az)), true);
      // khảm ngang hồi văn mỗi 3 m
      const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
      for (let a = 3; a < L - 1; a += 3) {
        const cx = s.ax + ux * a, cz = s.az + uz * a;
        const px = -uz * (s.hw - 0.25), pz = ux * (s.hw - 0.25);
        if (WALK_SHAPES.some((o) => o !== s && (shapeSignedDist(o, cx - px, cz - pz) < 0.1 || shapeSignedDist(o, cx + px, cz + pz) < 0.1))) continue;
        edge.rod(V(cx - px, 0.012, cz - pz), V(cx + px, 0.012, cz + pz), 0.025, P.gold[700], 4, true);
        edge.add(new THREE.TorusGeometry(0.22, 0.025, 4, 16).rotateX(Math.PI / 2), P.gold[500], edge.xf(cx, 0.014, cz), true);
      }
    }
    // rèm son rủ hai bên + tua vàng
    const step = s.kind === 'disc' ? 0.3 : 0.1;
    for (const run of edgeRuns(s, step, 0.01)) {
      let acc = 0, fold = 0;
      const n = run.pts.length;
      let prev = run.pts[0]!;
      for (let i = 1; i < n; i++) {
        const p = run.pts[i]!;
        acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        if (acc < 0.55 && i < n - 1) continue;
        const [tx, tz] = [p[0] - prev[0], p[1] - prev[1]];
        const tl = Math.hypot(tx, tz) || 1;
        const [nx, nz] = outward(s, (p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, tx / tl, tz / tl);
        const o = 0.04;
        const a = V(prev[0] + nx * o, STAGE_Y - 0.08, prev[1] + nz * o), b = V(p[0] + nx * o, STAGE_Y - 0.08, p[1] + nz * o);
        const sag = 0.9 + 0.15 * (fold & 1);
        deck.quad(a, b, V(b.x, STAGE_Y - sag, b.z), V(a.x, STAGE_Y - sag, a.z), fold & 1 ? P.son[700] : P.son[500], true);
        edge.rod(a.clone().add(V(nx * 0.01, 0, nz * 0.01)), b.clone().add(V(nx * 0.01, 0, nz * 0.01)), 0.035, P.gold[500], 4, true);
        if (fold % 3 === 0) edge.add(new THREE.ConeGeometry(0.06, 0.32, 5).rotateX(Math.PI), P.gold[500], edge.xf(b.x + nx * 0.02, STAGE_Y - sag - 0.1, b.z + nz * 0.02), true);
        fold++; acc = 0; prev = p;
      }
    }
    // lan can son thấp: con tiện mỗi ~1,2 m, mũ vàng, tay vịn son
    for (const run of edgeRuns(s, 0.1, -0.08)) {
      let acc = 0;
      const pts = run.pts;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i]!;
        if (i > 0) acc += Math.hypot(x - pts[i - 1]![0], z - pts[i - 1]![1]);
        if (i === 0 || acc >= 1.2 || (!run.closed && i === pts.length - 1)) {
          acc = 0;
          deck.cyl(0.045, 0.06, RAIL_Y, x, STAGE_Y + RAIL_Y / 2, z, P.son[500], 6);
          edge.sphere(0.07, x, STAGE_Y + RAIL_Y + 0.04, z, P.gold[500], 1, 1, 1, true);
        }
      }
      const path = run.closed ? [...pts, pts[0]!] : s.kind === 'seg' ? [pts[0]!, pts[pts.length - 1]!] : pts;
      for (let i = 0; i + 1 < path.length; i++) {
        const [ax, az] = path[i]!, [bx, bz] = path[i + 1]!;
        deck.beam(V(ax, STAGE_Y + RAIL_Y, az), V(bx, STAGE_Y + RAIL_Y, bz), 0.07, 0.06, P.son[700]);
        edge.rod(V(ax, 0.02, az), V(bx, 0.02, bz), 0.03, P.gold[500], 4, true);
      }
    }
  }

  // ── cổng chào: hai cột tre sơn son, xà, biển son, mái ngói nhỏ đầu đao, 2 đèn lồng, cờ ngũ sắc ──
  const gateZ = [-9, -15, -21];
  const lp: { x: number; y: number; z: number; s: number }[] = [];
  const PX = 1.95, TOP = 4.3;
  for (const z of gateZ) {
    for (const sx of [-1, 1]) {
      deck.cyl(0.085, 0.1, TOP - FIELD_Y + 0.6, sx * PX, (TOP + FIELD_Y + 0.6) / 2, z, P.son[500], 8);
      for (let y = FIELD_Y + 1; y < TOP; y += 1.1) edge.cyl(0.1, 0.1, 0.06, sx * PX, y, z, P.gold[500], 8, true); // đốt tre
      deck.rod(V(sx * PX, TOP + 0.6, z), V(sx * PX, TOP + 1.9, z), 0.03, P.lac[300], 5);
      fiveColourFlag(deck, sx * PX, TOP + 1.85, z, 0.6, sx > 0 ? 0 : Math.PI);
      lp.push({ x: sx * 1.35, y: TOP + 0.05, z: z - 0.05, s: 0.6 });
    }
    deck.beam(V(-PX - 0.35, TOP - 0.1, z), V(PX + 0.35, TOP - 0.1, z), 0.16, 0.2, P.lac[500]);
    deck.box(1.7, 0.42, 0.06, 0, TOP - 0.45, z, P.son[500]);
    edge.box(1.78, 0.05, 0.08, 0, TOP - 0.22, z, P.gold[500], 0, true);
    edge.box(1.78, 0.05, 0.08, 0, TOP - 0.68, z, P.gold[500], 0, true);
    edge.box(1.0, 0.07, 0.08, 0, TOP - 0.45, z - 0.01, P.gold[300], 0, true);
    const es = hipRoof(deck, { cx: 0, cz: z, ox: 2.55, oz: 0.5, ix: 1.75, iz: 0.04, yEave: TOP + 0.15, yTop: TOP + 0.7, curl: 0.35, tile: P.lac[500], tile2: P.lac[300], nu: 12 });
    for (const e of es) edge.poly(e.map((p) => p.clone().add(V(0, 0.05, 0))), 0.035, P.gold[500], true);
    edge.sphere(0.12, 0, TOP + 0.85, z, P.gold[300], 1, 1, 1, true);
  }

  const deckGeo = deck.build();
  const deckMat = kitMaterial();
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  const edgeGeo = edge.build();
  const edgeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);

  // mặt trống đồng trên các bục (1 draw call)
  const discGeo = mergeUv(discs);
  const du = {
    uBeat: { value: 0 }, uHype: { value: 0 }, uRot: { value: 0 },
    uBase: { value: toColor(P.lac[500]).convertLinearToSRGB() }, uGold: { value: toColor(P.gold[500]).convertLinearToSRGB() },
    uGoldHi: { value: toColor(P.gold[300]).convertLinearToSRGB() }, uA: { value: new THREE.Color() },
  };
  const discMat = new THREE.ShaderMaterial({
    uniforms: du,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: DISC_FRAG, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  scene.add(deckMesh, edgeMesh, discMesh);

  const lan = createLanterns(scene, lp, P.son[300], P.gold[500]);
  const lc = toColor(P.amber[300]);
  for (const l of lp) addGlow(glow, l.x, l.y - 0.35, l.z, lc, 0.6, 1.6);

  let rot = 0;
  return {
    update(f: FrameState, t: number) {
      const hc = hypeColors(f.hype);
      du.uA.value.setRGB(hc.primary[0], hc.primary[1], hc.primary[2]);
      du.uBeat.value = f.beatPulse; du.uHype.value = f.hype;
      rot += Math.min(0.1, f.dt) * 0.04;
      du.uRot.value = rot;
      // chỉ vàng ấm lên theo phách (chậm, không chớp)
      edgeMat.color.setScalar(0.94 + 0.12 * f.beatPulse * f.hype);
      lan.update(t, 1 + 0.1 * f.beatPulse * f.hype);
    },
    dispose() {
      scene.remove(deckMesh, edgeMesh, discMesh);
      deckGeo.dispose(); deckMat.dispose(); edgeGeo.dispose(); edgeMat.dispose(); discGeo.dispose(); discMat.dispose(); lan.dispose();
    },
  };
}

function mergeUv(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
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

export const builders: Partial<ArenaBuilders> = { runway: createLacquerRunway };
