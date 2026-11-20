// Khu SÂN TRUNG TÂM — nền sân khấu chính (Kẹo đêm): sàn diễn night-500 mép bo, mặt trước 3,5 m, loa monitor wedge bo tròn,
// khung ống hai bên, sàn dốc khu khán giả. 2 draw call (toy gộp + sàn dốc).
import * as THREE from 'three';
import { GROUND_RISE, GROUND_RUN, GROUND_Y0, STAGE_FRONT_Z, STAGE_HALF_W, STAGE_HEIGHT, STAGE_Y } from '../../world/layout';
import { PAL } from '../../world/style';
import { Toy, createToyMaterial } from './stageStyle';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function createStageBase(scene: THREE.Scene): { dispose(): void } {
  const disposables: { dispose(): void }[] = [];
  const toy = new Toy();

  // Khối sàn diễn đặc từ mặt sân khấu xuống dưới mặt đất nền (không hở gầm ở hai bên/phía sau).
  const deckH = STAGE_Y - (GROUND_Y0 - 0.2);
  toy.box(26, deckH, 8, 0, STAGE_Y - deckH / 2 - 0.1, -1, PAL.night[500], { r: 0.45 });
  // mép trên bo tròn (lip) + mép trước rủ xuống hố (mặt tiền 3,5 m)
  toy.box(26.5, 0.5, 8.5, 0, STAGE_Y - 0.25, -1, PAL.night[300], { r: 0.2 });
  const lipH = STAGE_HEIGHT + 0.5;
  toy.box(STAGE_HALF_W * 2 - 0.2, lipH, 0.2, 0, STAGE_Y - 0.1 - lipH / 2, STAGE_FRONT_Z - 0.05, PAL.night[500], { r: 0.09 });
  // dải sáng viền sàn (trim grape)
  toy.tube(V(-12.5, 0.03, -4.88), V(12.5, 0.03, -4.88), 0.12, PAL.grape[500], { trim: true });

  // Loa monitor (nêm bo tròn), mặt thấp hướng ca sĩ (+Z), mặt cao hướng khán giả
  const wedge = new THREE.Shape();
  wedge.moveTo(0, 0); wedge.lineTo(0.7, 0); wedge.lineTo(0, 0.38);
  for (const x of [-1.6, 0, 2.1]) {
    const w = new THREE.ExtrudeGeometry(wedge, { depth: 1.0, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    w.translate(0, 0.04, 0.05);
    w.rotateY(-Math.PI / 2);
    w.translate(x + 0.55, 0, -3.6 + 0.04);
    toy.add(w, PAL.night[300]);
    toy.box(1.0, 0.07, 0.07, x, 0.4, -3.92, PAL.grape[500], { trim: true });
  }

  // Khung ống hai bên + xà ngang trên cao (ống tròn, đai nho)
  for (const sx of [-1, 1]) for (const z of [-5, 1]) toy.tubeBands(V(sx * 11, 0, z), V(sx * 11, 12, z), 0.3, PAL.night[300], PAL.grape[500], 0.2, 1.2);
  toy.tubeBands(V(-11.3, 11, -5), V(11.3, 11, -5), 0.3, PAL.night[300], PAL.grape[500], 0.2, 1.2);
  toy.tubeBands(V(-11.3, 8.5, -5), V(11.3, 8.5, -5), 0.3, PAL.night[300], PAL.grape[500], 0.2, 1.2);
  for (const sx of [-1, 1]) for (const z of [-5, 1]) toy.sphere(0.24, sx * 11, 12, z, PAL.cream[500]);

  const geo = toy.build();
  const tm = createToyMaterial();
  disposables.push(geo, tm);
  const mesh = new THREE.Mesh(geo, tm.mat);
  scene.add(mesh);

  // Sàn khu khán giả (dốc, tối). depthWrite=false, vẽ trước, để không bao giờ che khán giả.
  const slope = new THREE.PlaneGeometry(200, 90, 1, 1);
  slope.rotateX(-Math.PI / 2);
  const slopeMat = new THREE.MeshBasicMaterial({ color: PAL.night[700], depthWrite: false });
  const slopeMesh = new THREE.Mesh(slope, slopeMat);
  disposables.push(slope, slopeMat);
  slopeMesh.renderOrder = -10;
  // Mặt phẳng nghiêng: y từ GROUND_Y0 tại z=-6 lên thêm GROUND_RISE sau GROUND_RUN m
  slopeMesh.position.set(0, GROUND_Y0, -50);
  slopeMesh.rotation.x = Math.atan2(GROUND_RISE, GROUND_RUN);
  scene.add(slopeMesh);

  return {
    dispose() {
      scene.remove(mesh, slopeMesh);
      for (const d of disposables) d.dispose();
    },
  };
}
