// "Mực & Sơn mài" — khe `stageBase`: sàn gỗ sơn then khảm viền vàng + rắc vỏ trứng + sen, mặt tiền 3,5 m là ô gỗ chạm
// nổi vàng + hàng đèn lồng nhỏ, loa monitor thành bục gỗ thấp, sàn dốc khu khán giả. 4 draw call.
import * as THREE from 'three';
import { GROUND_RISE, GROUND_RUN, GROUND_Y0, STAGE_BACK_Z, STAGE_FRONT_Z, STAGE_HALF_W, STAGE_HEIGHT, STAGE_Y } from '../../../../world/layout';
import { PAL, toColor } from '../../../../world/style';
import type { ArenaBuildContext, ArenaBuilders } from '../../builders';
import { Kit, R, V, createLanterns, kitMaterial } from './stageKit';

const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Mặt sàn 26 × 8 m: sơn then, viền kép vàng quỳ, rắc vỏ trứng, sen khảm. */
function deckTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const P = R();
  const W = 2080, H = 640, s = W / 26; // px / m
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = hx(P.lac[500]); g.fillRect(0, 0, W, H);
  // vân ván gỗ (sọc dọc rất nhẹ)
  g.globalAlpha = 0.25; g.fillStyle = hx(P.lac[700]);
  for (let x = 0; x < W; x += s * 0.5) g.fillRect(x, 0, 2, H);
  // rắc vỏ trứng: mảnh đa giác nhỏ
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = hx(P.silk[700]);
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * W, y = rnd() * H, r = 2 + rnd() * 5;
    g.globalAlpha = 0.12 + rnd() * 0.22;
    g.beginPath();
    for (let k = 0; k < 4; k++) { const a = k * 1.6 + rnd(); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.fill();
  }
  g.globalAlpha = 1;
  // viền khảm vàng kép
  g.strokeStyle = hx(P.gold[500]);
  g.lineWidth = 10; g.strokeRect(0.3 * s, 0.3 * s, W - 0.6 * s, H - 0.6 * s);
  g.lineWidth = 3; g.strokeRect(0.55 * s, 0.55 * s, W - 1.1 * s, H - 1.1 * s);
  // hoạ tiết hồi văn ở góc
  for (const [cx, cy] of [[0.55, 0.55], [25.45, 0.55], [0.55, 7.45], [25.45, 7.45]]) {
    g.lineWidth = 4; g.strokeRect(cx * s - 22, cy * s - 22, 44, 44); g.strokeRect(cx * s - 10, cy * s - 10, 20, 20);
  }
  // sen khảm: hàng dọc mép trước / sau + bông lớn giữa
  const lotus = (x: number, y: number, sc: number, front: boolean) => {
    g.save(); g.translate(x, y); g.scale(sc, front ? -sc : sc);
    g.fillStyle = hx(P.gold[700]); g.beginPath(); g.ellipse(0, 6, 34, 9, 0, 0, Math.PI * 2); g.fill();
    for (const [dx, rot, c] of [[-16, -0.7, P.gold[500]], [16, 0.7, P.gold[500]], [-7, -0.25, P.son[500]], [7, 0.25, P.son[500]], [0, 0, P.gold[300]]] as const) {
      g.save(); g.translate(dx, -10); g.rotate(rot); g.fillStyle = hx(c); g.beginPath(); g.ellipse(0, -10, 8, 22, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.restore();
  };
  for (let x = 2.5; x < 25; x += 3) { lotus(x * s, 1.25 * s, 0.9, false); lotus(x * s, H - 1.0 * s, 0.9, true); }
  // vòng sen lớn nơi ca sĩ đứng (z = 0 → y px = (3 - 0) / 8)
  const cx = W / 2, cy = (STAGE_BACK_Z / 8) * H;
  g.strokeStyle = hx(P.gold[500]); g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy, 1.6 * s, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 1.75 * s, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    g.save(); g.translate(cx + Math.cos(a) * 1.25 * s, cy + Math.sin(a) * 1.25 * s); g.rotate(a + Math.PI / 2);
    g.fillStyle = hx(k % 2 ? P.gold[500] : P.gold[700]); g.beginPath(); g.ellipse(0, 0, 9, 24, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createLacquerStageBase(ctx: ArenaBuildContext) {
  const { scene, glow } = ctx;
  const P = R();
  const disposables: { dispose(): void }[] = [];
  const objs: THREE.Object3D[] = [];
  const k = new Kit();

  // khối sàn đặc (như mặc định: xuống dưới mặt đất nền)
  const deckH = STAGE_Y - (GROUND_Y0 - 0.2);
  k.box(26, deckH, 8, 0, STAGE_Y - deckH / 2 - 0.12, -1, P.lac[700]);
  // mép sàn: gờ sơn son + chỉ vàng
  k.box(26.3, 0.22, 8.3, 0, STAGE_Y - 0.13, -1, P.son[700]);
  k.box(26.36, 0.05, 8.36, 0, STAGE_Y - 0.03, -1, P.gold[500], 0, true);
  // mặt tiền 3,5 m: ô gỗ chạm (khung vàng, lòng son sẫm, bông sen nổi vàng), chừa giữa cho runway
  const FZ = STAGE_FRONT_Z - 0.06;
  const top = STAGE_Y - 0.35, bot = STAGE_Y - STAGE_HEIGHT + 0.1;
  k.box(STAGE_HALF_W * 2, STAGE_HEIGHT + 0.2, 0.12, 0, STAGE_Y - STAGE_HEIGHT / 2 - 0.1, FZ + 0.05, P.lac[500]);
  for (let i = 0; i < 12; i++) for (const sx of [-1, 1]) {
    const x = sx * (2.35 + i * 0.94), w = 0.84, h = top - bot - 0.1, y = (top + bot) / 2;
    if (Math.abs(x) + w / 2 > STAGE_HALF_W - 0.05) continue;
    k.box(w - 0.12, h - 0.12, 0.05, x, y, FZ - 0.03, P.son[700]);
    k.box(w, 0.06, 0.08, x, top - 0.05, FZ - 0.04, P.gold[500], 0, true);
    k.box(w, 0.06, 0.08, x, bot + 0.05, FZ - 0.04, P.gold[500], 0, true);
    k.box(0.06, h, 0.08, x - w / 2, y, FZ - 0.04, P.gold[700], 0, true);
    // sen nổi: đài + 3 cánh
    k.sphere(0.16, x, y - 0.5, FZ - 0.08, P.gold[700], 1.4, 0.5, 0.4, true);
    k.sphere(0.12, x, y - 0.18, FZ - 0.09, P.gold[300], 0.7, 1.6, 0.4, true);
    k.sphere(0.12, x - 0.17, y - 0.24, FZ - 0.085, P.gold[500], 0.7, 1.4, 0.4, true);
    k.sphere(0.12, x + 0.17, y - 0.24, FZ - 0.085, P.gold[500], 0.7, 1.4, 0.4, true);
    // vân mây cuộn trên
    k.add(new THREE.TorusGeometry(0.14, 0.025, 4, 12, Math.PI * 1.5), P.gold[500], k.xf(x, y + 0.65, FZ - 0.08), true);
  }
  // monitor: bục gỗ thấp sơn then viền vàng (vị trí như mặc định)
  for (const x of [-1.6, 0, 2.1]) {
    k.box(1.0, 0.3, 0.7, x + 0.05, 0.15, -3.55, P.lac[300]);
    k.box(1.02, 0.03, 0.04, x + 0.05, 0.3, -3.9, P.gold[700], 0, true);
  }
  const geo = k.build();
  const mat = kitMaterial();
  objs.push(new THREE.Mesh(geo, mat));
  disposables.push(geo, mat);

  // mặt sàn (canvas)
  const tex = deckTexture();
  const topGeo = new THREE.PlaneGeometry(26, 8).rotateX(-Math.PI / 2);
  topGeo.translate(0, STAGE_Y + 0.004, -1);
  const topMat = new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : P.lac[500], polygonOffset: true, polygonOffsetFactor: -1 });
  objs.push(new THREE.Mesh(topGeo, topMat));
  disposables.push(topGeo, topMat);
  if (tex) disposables.push(tex);

  // hàng đèn lồng nhỏ dưới mép trước sân khấu
  const lp: { x: number; y: number; z: number; s: number }[] = [];
  for (let x = -12; x <= 12.01; x += 2) if (Math.abs(x) > 2.5) lp.push({ x, y: STAGE_Y - 0.4, z: FZ - 0.35, s: 0.55 });
  const lan = createLanterns(scene, lp, P.son[300], P.gold[500]);
  const lc = toColor(P.amber[300]);
  for (const l of lp) addGlow(glow, l.x, l.y - 0.3, l.z, lc, 0.55, 1.6);
  void PAL;

  // sàn dốc khu khán giả (như mặc định)
  const slope = new THREE.PlaneGeometry(200, 90, 1, 1).rotateX(-Math.PI / 2);
  const slopeMat = new THREE.MeshBasicMaterial({ color: P.lac[700], depthWrite: false });
  const slopeMesh = new THREE.Mesh(slope, slopeMat);
  slopeMesh.renderOrder = -10;
  slopeMesh.position.set(0, GROUND_Y0, -50);
  slopeMesh.rotation.x = Math.atan2(GROUND_RISE, GROUND_RUN);
  objs.push(slopeMesh);
  disposables.push(slope, slopeMat);

  scene.add(...objs);
  // StaticHandle: đèn lồng ở đây đứng yên (đèn lắc nằm ở stageDeco); không cần update.
  void V;
  return {
    dispose() { scene.remove(...objs); lan.dispose(); disposables.forEach((d) => d.dispose()); },
  };
}

/** Quầng đèn lồng vào Points điểm sáng chung (nhấp nháy rất nhẹ như lửa nến). */
export function addGlow(glow: ArenaBuildContext['glow'], x: number, y: number, z: number, c: THREE.Color, k: number, size: number) {
  glow.pos.push(x, y, z);
  glow.col.push(c.r * k, c.g * k, c.b * k);
  glow.size.push(size);
  glow.info.push(0, 1.1 + ((x * 7.3 + z * 3.1) % 1), x + z, 0);
}

export const builders: Partial<ArenaBuilders> = { stageBase: createLacquerStageBase };
