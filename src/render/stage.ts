// P6: sân khấu tối, camera góc nhìn ca sĩ (đi lại + nhìn 360°), fog, giới hạn DPR 1,5.
// Quy ước: ca sĩ ở gốc, nhìn -Z; sàn sân khấu y=0 (z từ +2 đến -5); khán giả ở z < -6 thấp hơn sàn.
import * as THREE from 'three';
import type { FrameState, Stage } from '../core/types';
import { createRunway } from './stageRunway';
import { createControls } from './stageControls';
import { createBackdrop } from './backdrop';
import { createStageDeco } from './stageDeco';
import { createBand } from './band';
import { createSecretEvents } from './secretEvents';

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x0b0a1c);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.022);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 220);
  camera.position.set(0, 1.65, 0);
  camera.rotation.order = 'YXZ';

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
  addMesh(new THREE.BoxGeometry(26, 3, 0.2), mat(0x07060f), 0, -1.6, -5.05);

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
  slopeMesh.position.set(0, -1.6, -50);
  slopeMesh.rotation.x = Math.atan2(5.6, 74);

  // Runway, phông nền LED + mái vòm hội trường
  const runway = createRunway(scene);
  const backdrop = createBackdrop(scene);
  const deco = createStageDeco(scene);
  const band = createBand(scene);
  const secrets = createSecretEvents(scene);

  // Đi lại + nhìn 360°
  const controls = createControls();
  let t = 0;
  let animT = 0;

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  return {
    scene,
    camera,
    renderer,
    update(f: FrameState) {
      const dt = Math.min(f.dt, 0.1);
      t += dt;
      animT += dt > 0 ? dt : 0;
      controls.update(dt);
      // idle: thở + nhún nhẹ theo beat
      const idleYaw = Math.sin(t * 0.37) * 0.008;
      const idlePitch = Math.sin(t * 0.53) * 0.006 - f.beatPulse * 0.004 * f.hype;
      camera.rotation.y = controls.yaw + idleYaw;
      camera.rotation.x = controls.pitch + idlePitch;
      camera.position.set(controls.pos.x, 1.65 + Math.sin(t * 0.8) * 0.012, controls.pos.z);
      runway.update(f, animT);
      backdrop.update(f, animT);
      deco.update(f, animT);
      band.update(f);
      secrets.update(f);
    },
    render: () => renderer.render(scene, camera),
    resetView: () => controls.reset(),
    dispose() {
      window.removeEventListener('resize', resize);
      controls.dispose();
      runway.dispose();
      backdrop.dispose();
      deco.dispose();
      band.dispose();
      secrets.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  } as Stage & { resetView(): void };
}
