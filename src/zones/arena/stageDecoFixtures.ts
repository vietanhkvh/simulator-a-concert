// Đèn trang trí thêm: PAR can + pixel bar (sprite additive), màn chùm sáng, uplight, searchlight trời. 2 draw call.
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { liveColor } from './stageDecoPal';
import { DECO } from './stageDecoLayout';

const spriteVert = /* glsl */ `
attribute vec3 aColor; attribute float aInt; attribute float aKind;
varying vec2 vP; varying vec3 vCol; varying float vInt; varying float vKind;
void main() {
  vP = position.xy * 2.0; vCol = aColor; vKind = aKind;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  vInt = aInt * smoothstep(0.8, 3.5, -c.z);
  c.xy += position.xy * s;
  gl_Position = projectionMatrix * c;
}`;
const spriteFrag = /* glsl */ `
varying vec2 vP; varying vec3 vCol; varying float vInt; varying float vKind;
void main() {
  float r = length(vP);
  float a; vec3 c = vCol;
  if (vKind < 0.5) { // thấu kính PAR
    float disc = smoothstep(0.62, 0.5, r);
    float lens = 0.55 + 0.9 * smoothstep(0.5, 0.0, r);
    float halo = pow(max(0.0, 1.0 - r), 3.0) * 0.55;
    a = (disc * lens + halo) * vInt;
    c = mix(vCol, vec3(1.0), smoothstep(0.2, 0.0, r) * 0.5);
  } else { // pixel
    float core = smoothstep(0.5, 0.0, r);
    float halo = pow(max(0.0, 1.0 - r), 2.5) * 0.5;
    a = (core + halo) * vInt;
  }
  gl_FragColor = vec4(c * a, a);
}`;
const beamVert = /* glsl */ `
attribute vec3 aColor; attribute float aInt;
varying vec2 vUv; varying float vFres; varying vec3 vCol; varying float vInt; varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * vec3(normal.x, 0.0, normal.z));
  vFres = abs(dot(n, normalize(-mv.xyz)));
  vCol = aColor; vInt = aInt; vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const beamFrag = /* glsl */ `
varying vec2 vUv; varying float vFres; varying vec3 vCol; varying float vInt; varying float vDepth;
void main() {
  float along = pow(vUv.y, 0.7);
  float soft = pow(vFres, 1.5);
  float near = smoothstep(1.5, 9.0, vDepth);
  float a = along * soft * vInt * near;
  gl_FragColor = vec4(vCol * a, a);
}`;

function addMat(vs: string, fs: string, side: THREE.Side = THREE.FrontSide) {
  return new THREE.ShaderMaterial({
    vertexShader: vs, fragmentShader: fs, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side, fog: false,
  });
}
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, order: number, kind = false) {
  const col = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const it = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  const kd = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  col.setUsage(THREE.DynamicDrawUsage); it.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aColor', col); geo.setAttribute('aInt', it);
  if (kind) geo.setAttribute('aKind', kd);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return { mesh, col, it, kd };
}
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Spr { pos: THREE.Vector3; kind: number; size: number; grp: number; j: number; s: number }

export function createDecoFixtures(scene: THREE.Scene) {
  const { TX, ZF, ZB, TH, ay } = DECO;
  const sprites: Spr[] = [];
  // PAR trên 3 thanh đèn (mặt khán giả + mặt sau) và trên 4 tháp
  const BAR_Z = [-3.6, -1.1, 1.4];
  BAR_Z.forEach((z, g) => {
    for (let j = 0; j < 16; j++) {
      const x = -15.5 + j * (31 / 15);
      sprites.push({ pos: new THREE.Vector3(x, 9.3, z - 0.3), kind: 0, size: 0.6, grp: g, j, s: 0 });
      sprites.push({ pos: new THREE.Vector3(x, 9.3, z + 0.3), kind: 0, size: 0.5, grp: g, j: 15 - j, s: 0 });
    }
  });
  for (const sx of [-1, 1]) for (const z of [ZF, ZB]) for (let j = 0; j < 7; j++) {
    sprites.push({ pos: new THREE.Vector3(sx * (TX - 0.75), 2.5 + j * 1.5, z + (z === ZF ? -0.1 : 0.1)), kind: 0, size: 0.6, grp: 3, j: j + (sx > 0 ? 7 : 0), s: 0 });
  }
  const nPar = sprites.length;
  // pixel bar: viền vòm trước/sau + 4 tháp
  const NA = 78;
  for (const [pz, grp] of [[ZF - 0.5, 4], [ZB + 0.5, 5]] as [number, number][]) {
    for (let i = 0; i <= NA; i++) {
      const s = i / NA, x = -TX + 2 * TX * s;
      sprites.push({ pos: new THREE.Vector3(x, ay(x) - 0.45, pz), kind: 1, size: 0.32, grp, j: i, s });
    }
  }
  for (const sx of [-1, 1]) for (const z of [ZF, ZB]) for (let i = 0; i <= 22; i++) {
    const s = i / 22;
    sprites.push({ pos: new THREE.Vector3(sx * (TX + 0.55), 0.3 + s * (TH - 0.4), z + (z === ZF ? -0.55 : 0.55)), kind: 1, size: 0.3, grp: 6, j: i, s: sx > 0 ? s : 1 - s });
  }
  // uplight sát tường LED
  const NU = 16;
  for (let i = 0; i < NU; i++) sprites.push({ pos: new THREE.Vector3(-15 + 2 * i, 0.1, 3.0), kind: 0, size: 0.5, grp: 7, j: i, s: 0 });
  const NS = sprites.length;

  const spGeo = new THREE.PlaneGeometry(1, 1);
  const spr = instanced(spGeo, addMat(spriteVert, spriteFrag), NS, 7, true);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  sprites.forEach((s, i) => {
    spr.mesh.setMatrixAt(i, m.compose(s.pos, q, sc.setScalar(s.size)));
    spr.kd.array[i] = s.kind;
  });
  spr.kd.needsUpdate = true;
  spr.mesh.instanceMatrix.needsUpdate = true;

  // chùm sáng: màn chùm sau ca sĩ (24), uplight (16), searchlight trời (8)
  const NC = 24, NSK = 8, NB = NC + NU + NSK;
  const bGeo = new THREE.CylinderGeometry(0.03, 0.2, 1, 10, 1, true);
  bGeo.translate(0, -0.5, 0);
  const bm = instanced(bGeo, addMat(beamVert, beamFrag, THREE.DoubleSide), NB, 5);
  scene.add(spr.mesh, bm.mesh);

  const DOWN = new THREE.Vector3(0, -1, 0);
  const cA = new THREE.Color();
  const dir = new THREE.Vector3(), pos = new THREE.Vector3();
  const sparr = { c: spr.col.array as Float32Array, i: spr.it.array as Float32Array };
  const barr = { c: bm.col.array as Float32Array, i: bm.it.array as Float32Array };
  const skyTop = [
    [-1, ZF], [1, ZF], [-1, ZB], [1, ZB],
  ] as [number, number][];

  const ring = (a: number, b: number) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

  return {
    update(f: FrameState, p: number) {
      const hype = Math.min(1, Math.max(0, f.hype));
      const beat = Math.max(0, f.beat);
      const pulse = f.beatPulse;
      const frac = 0.3 + 0.7 * sm(0.05, 0.8, hype);
      const speed = 0.5 + 2.5 * hype;
      const pat = (g: number) => (Math.floor(beat / 8) + g) % 3;

      for (let i = 0; i < NS; i++) {
        const s = sprites[i]!;
        let b: number;
        if (s.kind === 0) {
          const j = s.j;
          const rank = ((j * 7 + s.grp * 3) % 16) / 16;
          const on = sm(0, 0.12, frac - rank);
          let w: number;
          switch (s.grp === 7 ? 0 : pat(s.grp)) {
            case 0: w = 0.5 + 0.5 * Math.sin(beat * Math.PI * 0.5 * speed - j * 0.45); break;
            case 1: w = (Math.floor(beat * speed * 0.5 + j) & 1) ? 0.9 : 0.25; break;
            default: w = Math.pow(0.5 + 0.5 * Math.sin(beat * Math.PI * 0.25 * speed + Math.sin(j * 0.4) * 3), 2); break;
          }
          b = (0.1 + 0.8 * w * on + 0.1 * on) * (0.8 + 0.3 * pulse);
          liveColor(s.j + s.grp * 2, cA);
          b *= s.grp === 7 ? 0.6 : 0.85;
        } else {
          const head = ((beat * 0.06 * (0.6 + 1.6 * hype) * (s.grp === 5 ? -1 : 1)) % 1 + 1) % 1;
          const d = ring(s.s, head);
          b = 0.2 + 0.7 * Math.max(0, 1 - d * (9 - 4 * hype)) + 0.08 * pulse;
          b *= 0.55 + 0.45 * frac;
          liveColor(Math.floor(s.s * 6) + s.grp, cA);
        }
        sparr.c[i * 3] = cA.r; sparr.c[i * 3 + 1] = cA.g; sparr.c[i * 3 + 2] = cA.b;
        sparr.i[i] = b;
      }

      for (let i = 0; i < NB; i++) {
        let len: number, w: number, bright: number;
        if (i < NC) { // màn chùm: các tia đứng, chạy sóng
          pos.set(-11.5 + i, 9.0, 2.7);
          dir.set(Math.sin(p * 0.6 + i * 0.5) * 0.1 * (0.3 + hype), -1, 0.02).normalize();
          len = 9.2; w = 1;
          const rank = ((i * 5) % NC) / NC;
          const on = sm(0, 0.15, frac - rank);
          const wave = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(beat * Math.PI * 0.5 * speed - i * 0.5), 2);
          bright = (0.14 + 0.4 * hype) * on * wave * (0.8 + 0.3 * pulse);
          liveColor(i, cA);
        } else if (i < NC + NU) { // uplight rửa tường LED
          const k = i - NC;
          pos.set(-15 + 2 * k, 0.1, 3.0);
          dir.set(Math.sin(p * 0.3 + k) * 0.05, 1, 0.08).normalize();
          len = 8.5; w = 1.5;
          bright = (0.12 + 0.28 * hype) * (0.7 + 0.3 * pulse);
          liveColor(k + 2, cA);
        } else { // searchlight trời
          const k = i - NC - NU;
          const [sx, tz] = skyTop[k >> 1]!;
          pos.set(sx * TX, TH + 0.2, tz);
          const ph = p * 0.45 * (1 + 0.5 * (k & 1)) + k * 1.3;
          dir.set(0.55 * Math.sin(ph), 1, 0.7 * Math.cos(ph * 0.8 + k)).normalize();
          len = 85; w = 6;
          const on = sm(0, 0.2, frac - (k % 4) * 0.12);
          bright = (0.22 + 0.35 * hype) * on * (0.8 + 0.25 * pulse);
          liveColor(k * 2 + 1, cA);
        }
        q.setFromUnitVectors(DOWN, dir);
        bm.mesh.setMatrixAt(i, m.compose(pos, q, sc.set(w, len, w)));
        barr.c[i * 3] = cA.r; barr.c[i * 3 + 1] = cA.g; barr.c[i * 3 + 2] = cA.b;
        barr.i[i] = bright;
      }
      for (const o of [spr, bm]) {
        o.mesh.instanceMatrix.needsUpdate = true;
        o.col.needsUpdate = true;
        o.it.needsUpdate = true;
      }
    },
    dispose() {
      scene.remove(spr.mesh, bm.mesh);
      for (const o of [spr, bm]) {
        o.mesh.geometry.dispose();
        (o.mesh.material as THREE.Material).dispose();
        o.mesh.dispose();
      }
    },
  };
}
