// Runway (catwalk) từ mép sân khấu ra giữa khán giả + bục tròn cuối. 2 draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../core/types';

export function createRunway(scene: THREE.Scene) {
  const FLOOR = -1.7;
  const H = -FLOOR;
  const deckParts: THREE.BufferGeometry[] = [];
  const g1 = new THREE.BoxGeometry(3.2, H, 19.2);
  g1.translate(0, FLOOR / 2, -14.5);
  deckParts.push(g1);
  const g2 = new THREE.CylinderGeometry(3.5, 3.5, H, 48).toNonIndexed();
  g2.translate(0, FLOOR / 2, -26);
  const deckGeo = mergeGeometries([g1.toNonIndexed(), g2]);
  const deckMat = new THREE.MeshBasicMaterial({ color: 0x100e1e });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  scene.add(deck);

  const strips: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    // dải trên mép + dải dọc chân váy
    const a = new THREE.BoxGeometry(0.08, 0.05, 17.6);
    a.translate(sx * 1.58, 0.02, -13.8);
    strips.push(a.toNonIndexed());
    const b = new THREE.BoxGeometry(0.03, 0.04, 17.6);
    b.translate(sx * 1.615, -0.6, -13.8);
    strips.push(b.toNonIndexed());
  }
  const ring = new THREE.TorusGeometry(3.48, 0.05, 6, 64);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, 0.02, -26);
  strips.push(ring.toNonIndexed());
  const ring2 = new THREE.TorusGeometry(3.52, 0.025, 4, 64);
  ring2.rotateX(Math.PI / 2);
  ring2.translate(0, -0.6, -26);
  strips.push(ring2.toNonIndexed());
  const inner = new THREE.TorusGeometry(2.2, 0.03, 4, 64);
  inner.rotateX(Math.PI / 2);
  inner.translate(0, 0.005, -26);
  strips.push(inner.toNonIndexed());
  // vạch ngang dọc runway
  for (let z = -6; z > -23; z -= 2) {
    const c = new THREE.BoxGeometry(2.9, 0.02, 0.05);
    c.translate(0, 0.005, z);
    strips.push(c.toNonIndexed());
  }
  const stripGeo = mergeGeometries(strips);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x6a4cff, fog: false });
  const stripMesh = new THREE.Mesh(stripGeo, stripMat);
  scene.add(stripMesh);
  for (const g of [...strips, g1, g2, ring, ring2, inner]) g.dispose();

  const col = new THREE.Color();
  return {
    update(f: FrameState, t: number) {
      const hue = (0.72 - f.hype * 0.55 + Math.sin(t * 0.2) * 0.05 + 1) % 1;
      const light = 0.42 + f.beatPulse * 0.25 * (0.4 + f.hype);
      stripMat.color.copy(col.setHSL(hue, 0.9, light));
    },
    dispose() {
      deckGeo.dispose(); deckMat.dispose(); stripGeo.dispose(); stripMat.dispose();
    },
  };
}
