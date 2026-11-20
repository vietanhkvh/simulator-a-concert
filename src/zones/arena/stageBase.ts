// Khu SÂN TRUNG TÂM — nền sân khấu chính: sàn diễn, mép trước, loa monitor, khung truss cũ, sàn dốc khu khán giả.
// Quy ước: ca sĩ ở gốc, nhìn -Z; mặt sân khấu y = STAGE_Y (z từ +3 đến -5); khán giả ở z < -6, thấp hơn sàn.
import * as THREE from 'three';
import { GROUND_RISE, GROUND_RUN, GROUND_Y0, STAGE_FRONT_Z, STAGE_HALF_W, STAGE_HEIGHT, STAGE_Y } from '../../world/layout';

export function createStageBase(scene: THREE.Scene): { dispose(): void } {
  const disposables: { dispose(): void }[] = [];
  const mat = (color: number, extra: Partial<THREE.MeshBasicMaterialParameters> = {}) => {
    const m = new THREE.MeshBasicMaterial({ color, ...extra });
    disposables.push(m);
    return m;
  };
  const addMesh = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  // Sàn sân khấu (tối, hơi tím) + mép + vạch gaffer
  addMesh(new THREE.BoxGeometry(26, 0.3, 8), mat(0x14122a), 0, -0.15, -1);
  addMesh(new THREE.BoxGeometry(26, 0.06, 0.12), mat(0x6a4cff), 0, 0.02, -4.9);
  // Mép trước rủ xuống hố
  const lipH = STAGE_HEIGHT + 1.5; // phủ từ sát mặt sân khấu xuống quá sàn khán giả
  addMesh(new THREE.BoxGeometry(STAGE_HALF_W * 2, lipH, 0.2), mat(0x07060f), 0, STAGE_Y - 0.1 - lipH / 2, STAGE_FRONT_Z - 0.05);

  // Màn hình monitor (wedge) ở sát mép dưới khung hình
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(0, 0);
  wedgeShape.lineTo(0.7, 0);
  wedgeShape.lineTo(0, 0.38);
  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 1.1, bevelEnabled: false });
  disposables.push(wedgeGeo);
  const wedgeMat = mat(0x0a0a14);
  const lipMat = mat(0x3a2aa0);
  for (const x of [-1.6, 0, 2.1]) {
    // Nêm: mặt thấp hướng ca sĩ (+Z), mặt cao hướng khán giả; extrude dọc X
    const w = new THREE.Mesh(wedgeGeo, wedgeMat);
    w.rotation.y = -Math.PI / 2;
    w.position.set(x + 0.55, 0, -3.6);
    scene.add(w);
    addMesh(new THREE.BoxGeometry(1.1, 0.03, 0.03), lipMat, x, 0.38, -3.9);
  }

  // Khung truss hai bên + xà ngang trên cao
  const trussMat = mat(0x1b1836);
  for (const sx of [-1, 1]) {
    addMesh(new THREE.BoxGeometry(0.3, 12, 0.3), trussMat, sx * 11, 6, -5);
    addMesh(new THREE.BoxGeometry(0.3, 12, 0.3), trussMat, sx * 11, 6, 1);
  }
  addMesh(new THREE.BoxGeometry(22.6, 0.3, 0.3), trussMat, 0, 11, -5);
  addMesh(new THREE.BoxGeometry(22.6, 0.3, 0.3), trussMat, 0, 8.5, -5);

  // Sàn khu khán giả (dốc, tối). depthWrite=false, vẽ trước, để không bao giờ che khán giả.
  const slope = new THREE.PlaneGeometry(120, 90, 1, 1);
  slope.rotateX(-Math.PI / 2);
  const slopeMat = mat(0x0a0914, { depthWrite: false });
  const slopeMesh = addMesh(slope, slopeMat, 0, 0, 0);
  slopeMesh.renderOrder = -10;
  // Mặt phẳng nghiêng: y từ -1,6 tại z=-6 lên +4 tại z=-80
  slopeMesh.position.set(0, GROUND_Y0, -50);
  slopeMesh.rotation.x = Math.atan2(GROUND_RISE, GROUND_RUN);

  return {
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
