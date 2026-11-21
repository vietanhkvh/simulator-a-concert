// "Thép & Lửa" · khe emotes (gói S3): giữ nguyên module arena/emotes.ts (hành vi, đội hình, API, 2 draw call) nhưng THAY
// ATLAS bằng bộ biểu tượng rock vẽ canvas cùng lưới 8×5 ô 128 px (mỗi chỉ số IC được gán một hình mới): tay sừng, nắm đấm,
// ngọn lửa, tia sét, đầu lâu đẽo mặt (không ghê), guitar flying-V, dùi trống chéo, mặt nạ quỷ sừng, sao stencil, bật lửa,
// chữ "ROCK!", "CHÁY!", "ĐỈNH!", "NỮA ĐI!" font đậm hẹp kiểu stencil. Tô thép / trắng nung / lửa, KHÔNG viền; mỗi hình có
// một mặt phẳng tối lệch phía sau để đọc được trên nền sáng. Vệt sáng: vá fragment để đổi tint kẹo sang lửa / hồ quang.
import * as THREE from 'three';
import { PAL, RAMPS, hexStr } from '../../../../world/style';
import type { ArenaBuilders, Emotes } from '../../builders';
import { createEmotes } from '../../emotes';
import { ATLAS_COLS, ATLAS_ROWS, CELL, IC } from '../../emotesAtlas';

type G = CanvasRenderingContext2D;
type Pt = [number, number];
const COND = '"Impact", "Haettenschweiler", "Arial Narrow", "DejaVu Sans Condensed", "Liberation Sans Narrow", sans-serif';

function palette() {
  const r = (n: string, k: 100 | 300 | 500 | 700, fb: number) => hexStr(RAMPS[n]?.[k] ?? fb);
  return {
    coal: r('coal', 700, PAL.night[700]), coal3: r('coal', 300, PAL.night[300]),
    steel: r('steel', 300, PAL.grape[300]), steelHi: r('steel', 100, PAL.grape[100]), steelLo: r('steel', 500, PAL.grape[500]),
    hot: r('whitehot', 500, PAL.honey[500]), hotHi: r('whitehot', 100, PAL.honey[100]),
    flame: r('flame', 500, PAL.berry[500]), flameHi: r('flame', 300, PAL.berry[300]),
    ember: r('ember', 500, PAL.peach[500]), blood: r('blood', 300, PAL.berry[700]),
    arc: r('arc', 500, PAL.soda[500]), skin: '#c9a184', skinLo: '#8f6a4f',
  };
}
type P = ReturnType<typeof palette>;

let SHADOW = false; // lượt vẽ mặt phẳng tối lệch phía sau
const poly = (g: G, pts: Pt[], col: string) => {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = SHADOW ? 'rgba(5,5,6,0.82)' : col;
  g.fill();
};
/** Đa giác + mặt bóng: nửa phía (nx, ny) của đa giác tối đi (tô phẳng 2 mặt, không viền). */
const facet = (g: G, pts: Pt[], col: string, shade: string, nx = 1, ny = 0.3, off = 0) => {
  poly(g, pts, col);
  if (SHADOW) return;
  g.save();
  g.clip();
  g.beginPath();
  const L = 200, px = -ny, py = nx;
  g.moveTo(off * nx + px * L, off * ny + py * L);
  g.lineTo(off * nx - px * L, off * ny - py * L);
  g.lineTo(off * nx - px * L + nx * L, off * ny - py * L + ny * L);
  g.lineTo(off * nx + px * L + nx * L, off * ny + py * L + ny * L);
  g.closePath();
  g.fillStyle = shade;
  g.fill();
  g.restore();
};

function horns(g: G, P: P) {
  facet(g, [[-30, 0], [26, 0], [30, 50], [-26, 54]], P.skin, P.skinLo, 1, 0.2, 4);              // lòng bàn tay
  facet(g, [[-30, -56], [-14, -58], [-12, 2], [-30, 2]], P.skin, P.skinLo, 1, 0, -21);            // ngón trỏ
  facet(g, [[14, -46], [28, -48], [30, 2], [12, 2]], P.skin, P.skinLo, 1, 0, 21);                  // ngón út
  poly(g, [[-12, -8], [12, -8], [14, 14], [-12, 14]], P.skinLo);                                   // ngón gập
  facet(g, [[-34, 18], [6, 10], [8, 22], [-30, 30]], P.skin, P.skinLo, 0, 1, 20);                  // ngón cái
  poly(g, [[-26, 54], [30, 50], [28, 62], [-24, 64]], P.coal3);                                    // cổ tay áo
}
function fist(g: G, P: P) {
  facet(g, [[-34, -30], [30, -34], [36, 30], [-30, 36]], P.skin, P.skinLo, 1, 0.1, 4);
  if (!SHADOW) for (const y of [-14, 4]) poly(g, [[-30, y], [33, y - 3], [34, y], [-30, y + 3]], P.skinLo);
  facet(g, [[-38, -4], [-6, -10], [-2, 4], [-34, 12]], P.skin, P.skinLo, 0, 1, 2);               // ngón cái
  poly(g, [[-30, 36], [36, 30], [34, 58], [-26, 60]], P.coal3);                                    // cổ tay áo
}
function flame(g: G, P: P, s = 1) {
  const sc = (pts: Pt[]) => pts.map(([x, y]) => [x * s, y * s] as Pt);
  poly(g, sc([[0, -60], [18, -28], [34, -40], [44, 6], [30, 52], [-30, 52], [-44, 10], [-30, -18], [-16, -2], [-8, -34]]), P.flame);
  poly(g, sc([[2, -30], [16, -4], [26, -12], [28, 22], [16, 50], [-18, 50], [-28, 22], [-14, 6], [-6, 16]]), P.hot);
  poly(g, sc([[0, 0], [12, 22], [8, 48], [-10, 48], [-12, 26]]), P.hotHi);
}
function bolt(g: G, P: P, col = P.hot) {
  facet(g, [[10, -62], [-30, 4], [-2, 4], [-16, 62], [32, -10], [4, -10], [22, -62]], col, P.flame, 1, 0.2, 2);
}
function skull(g: G, P: P) {
  facet(g, [[-40, -20], [-24, -52], [24, -52], [40, -20], [36, 14], [-36, 14]], P.steelHi, P.steel, 1, 0.1, 4);
  facet(g, [[-28, 14], [28, 14], [22, 46], [-22, 46]], P.steelHi, P.steel, 1, 0, 4);              // hàm
  poly(g, [[-30, -12], [-8, -16], [-10, 4], [-26, 6]], P.coal);                                     // hốc mắt góc cạnh
  poly(g, [[30, -12], [8, -16], [10, 4], [26, 6]], P.coal);
  poly(g, [[0, 10], [6, 22], [-6, 22]], P.coal);
  if (!SHADOW) for (const x of [-14, -4, 6]) poly(g, [[x, 32], [x + 6, 32], [x + 6, 44], [x, 44]], P.steel);
}
function guitar(g: G, P: P) {
  g.save(); g.rotate(-0.6);
  facet(g, [[-6, 6], [-34, 62], [-12, 62], [0, 30], [12, 62], [34, 62], [6, 6]], P.flame, P.ember, 1, 0, 0); // flying-V
  poly(g, [[-4, -50], [4, -50], [4, 14], [-4, 14]], P.steelLo);                                    // cần đàn
  poly(g, [[-8, -66], [10, -62], [6, -48], [-6, -48]], P.steelHi);                                 // đầu đàn
  if (!SHADOW) { poly(g, [[-10, 36], [10, 36], [10, 40], [-10, 40]], P.steelHi); poly(g, [[-0.8, -48], [0.8, -48], [0.8, 44], [-0.8, 44]], P.hotHi); }
  g.restore();
}
function sticks(g: G, P: P) {
  for (const a of [-0.7, 0.7]) {
    g.save(); g.rotate(a);
    facet(g, [[-5, -60], [5, -60], [7, 58], [-7, 58]], P.hot, P.ember, 1, 0, 0);
    poly(g, [[-4, -66], [4, -66], [5, -58], [-5, -58]], P.hotHi);
    g.restore();
  }
}
function devil(g: G, P: P) {
  facet(g, [[-38, -26], [-58, -60], [-22, -38]], P.blood, P.coal3, 1, 0, -40);                    // sừng
  facet(g, [[38, -26], [58, -60], [22, -38]], P.blood, P.coal3, 1, 0, 40);
  facet(g, [[-42, -30], [42, -30], [46, 10], [0, 54], [-46, 10]], P.flame, P.ember, 1, 0.15, 3);
  poly(g, [[-30, -10], [-8, -2], [-28, 6]], P.coal);                                               // mắt xếch góc cạnh
  poly(g, [[30, -10], [8, -2], [28, 6]], P.coal);
  poly(g, [[-24, 18], [24, 18], [12, 34], [-12, 34]], P.coal);                                     // miệng cười
  if (!SHADOW) poly(g, [[-16, 20], [16, 20], [14, 24], [-14, 24]], P.hotHi);
}
function star(g: G, P: P, col = P.steelHi) {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 24 : 58, a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push([Math.cos(a) * r, Math.sin(a) * r + 4]); }
  facet(g, pts, col, P.steel, 1, 0.2, 0);
  if (!SHADOW) { // khe stencil
    g.fillStyle = 'rgba(0,0,0,1)';
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(-60, -6, 120, 5); g.fillRect(-3, -60, 5, 30);
    g.globalCompositeOperation = 'source-over';
  }
}
function spark(g: G, P: P) {
  poly(g, [[0, -60], [12, -12], [60, 0], [12, 12], [0, 60], [-12, 12], [-60, 0], [-12, -12]], P.hot);
  poly(g, [[0, -30], [6, -6], [30, 0], [6, 6], [0, 30], [-6, 6], [-30, 0], [-6, -6]], P.hotHi);
}
function lighter(g: G, P: P) {
  facet(g, [[-18, -6], [18, -6], [18, 58], [-18, 58]], P.steel, P.steelLo, 1, 0, 2);
  poly(g, [[-18, -14], [10, -14], [10, -6], [-18, -6]], P.steelHi);
  g.save(); g.translate(0, -40); flame(g, P, 0.5); g.restore();
}
function word(g: G, P: P, txt: string, col: string, sub = P.flame) {
  g.save();
  g.font = `900 52px ${COND}`;
  const w = g.measureText(txt).width;
  const k = Math.min(1.7, 116 / Math.max(1, w));
  g.scale(Math.min(k, 1.25), 1.15);
  g.translate(0, 6);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (SHADOW) { g.fillStyle = 'rgba(5,5,6,0.85)'; g.fillText(txt, 0, 2); g.restore(); return; }
  g.fillStyle = sub; g.fillText(txt, 0, 4);       // mặt phẳng bóng cạnh dưới (lửa)
  g.fillStyle = col; g.fillText(txt, 0, 0);
  // khe stencil ngang
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000'; g.fillRect(-90, -3, 180, 3);
  g.globalCompositeOperation = 'source-over';
  g.restore();
}

export function drawSteelEmoteAtlas(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = ATLAS_COLS * CELL;
  cv.height = ATLAS_ROWS * CELL;
  const g = cv.getContext('2d')!;
  const P = palette();
  const draw: Record<number, (x: G) => void> = {
    [IC.HEART]: (x) => horns(x, P),
    [IC.HEART_PINK]: (x) => flame(x, P),
    [IC.HEART_RAINBOW]: (x) => bolt(x, P),
    [IC.HEART_EYES]: (x) => devil(x, P),
    [IC.HEARTS2]: (x) => fist(x, P),
    [IC.SMILE]: (x) => devil(x, P),
    [IC.LAUGH]: (x) => skull(x, P),
    [IC.STARSTRUCK]: (x) => star(x, P, P.hot),
    [IC.SCREAM]: (x) => skull(x, P),
    [IC.STAR]: (x) => star(x, P),
    [IC.SPARKLE]: (x) => spark(x, P),
    [IC.NOTE]: (x) => guitar(x, P),
    [IC.NOTES2]: (x) => sticks(x, P),
    [IC.CLEF]: (x) => guitar(x, P),
    [IC.FIRE]: (x) => flame(x, P),
    [IC.CLAP]: (x) => fist(x, P),
    [IC.RAISE]: (x) => fist(x, P),
    [IC.FHEART]: (x) => bolt(x, P, P.flameHi),
    [IC.ROCK]: (x) => horns(x, P),
    [IC.MIC]: (x) => sticks(x, P),
    [IC.CROWN]: (x) => skull(x, P),
    [IC.STICK]: (x) => lighter(x, P),
    [IC.HUNDRED]: (x) => word(x, P, 'ROCK!', P.hotHi),
    [IC.BOLT]: (x) => bolt(x, P),
    [IC.ROSE]: (x) => flame(x, P),
    [IC.KISS]: (x) => horns(x, P),
    [IC.TROPHY]: (x) => star(x, P, P.hot),
    [IC.POPPER]: (x) => spark(x, P),
    [IC.T_ENCORE]: (x) => word(x, P, 'NỮA ĐI!', P.hot),
    [IC.T_LOVE]: (x) => word(x, P, 'CHÁY!', P.flameHi, P.blood),
    [IC.T_WOW]: (x) => word(x, P, 'ROCK!', P.steelHi, P.steelLo),
    [IC.T_DINH]: (x) => word(x, P, 'ĐỈNH!', P.hotHi),
    [IC.T_HAY]: (x) => word(x, P, 'CHÁY!', P.hot),
    [IC.T_YEU]: (x) => word(x, P, 'ROCK!', P.flame, P.blood),
  };
  for (const [k, fn] of Object.entries(draw)) {
    const i = Number(k);
    const cx = (i % ATLAS_COLS) * CELL + CELL / 2, cy = Math.floor(i / ATLAS_COLS) * CELL + CELL / 2;
    g.save();
    g.beginPath(); g.rect(cx - CELL / 2, cy - CELL / 2, CELL, CELL); g.clip();
    g.translate(cx, cy);
    g.scale(0.86, 0.86);
    // mặt phẳng tối lệch (đọc được trên nền sáng) rồi hình chính
    SHADOW = true; g.save(); g.translate(5, 6); fn(g); g.restore();
    SHADOW = false; fn(g);
    g.restore();
  }
  return cv;
}

export function createSteelEmotes(scene: THREE.Scene): Emotes {
  const before = new Set(scene.children);
  const em = createEmotes(scene);
  const added = scene.children.filter((c) => !before.has(c)) as THREE.Points[];
  const tex = new THREE.CanvasTexture(drawSteelEmoteAtlas());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const v = (hex: number) => { const c = new THREE.Color(hex).convertLinearToSRGB(); return `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`; };
  const r = (n: string, k: 100 | 300 | 500 | 700, fb: number) => RAMPS[n]?.[k] ?? fb;
  for (const o of added) {
    const mat = o.material as THREE.ShaderMaterial;
    if (!mat?.uniforms) continue;
    if (mat.uniforms.uMap) {
      (mat.uniforms.uMap.value as THREE.Texture | null)?.dispose();
      mat.uniforms.uMap.value = tex;
    } else if (mat.fragmentShader.includes('vTint')) {
      // tint kẹo → lửa (hồng/cam), trắng nung (vàng), hồ quang (xanh/tím)
      const fn = `vec3 steelTint(vec3 t){ if (t.b > t.g && t.b > 0.6) return ${v(r('arc', 500, PAL.soda[500]))}; if (t.g < 0.7) return ${v(r('flame', 500, PAL.berry[500]))}; return ${v(r('whitehot', 500, PAL.honey[500]))}; }\n`;
      const i = mat.fragmentShader.indexOf('void main');
      if (i > 0) {
        mat.fragmentShader = mat.fragmentShader.slice(0, i) + fn + mat.fragmentShader.slice(i).replace(/vTint/g, 'steelTint(vTint)').replace('vec3(1.0), core', `${v(r('whitehot', 100, PAL.honey[100]))}, core`);
        mat.needsUpdate = true;
      }
    }
  }
  return {
    update: (f) => em.update(f),
    burst: (n, k) => em.burst(n, k),
    formation: em.formation ? (k) => em.formation!(k) : undefined,
    dispose() { em.dispose(); tex.dispose(); },
  };
}

export const builders: Partial<ArenaBuilders> = { emotes: (c) => createSteelEmotes(c.scene) };
