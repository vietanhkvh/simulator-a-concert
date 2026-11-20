// "Mực & Sơn mài · bản Việt" · khe emotes (L6): giữ nguyên module arena/emotes.ts (hành vi, đội hình, API, 2 draw call)
// nhưng THAY ATLAS bằng bộ biểu tượng Việt vẽ canvas cùng lưới 8×5 ô 128 px (mỗi chỉ số IC được gán một hình mới):
// sen, đèn lồng đỏ, đèn ông sao, mặt trời trống đồng vàng, hạc, tim nét cọ son, nốt nhạc nét cọ, quạt, nón lá, dây pháo,
// chữ thư pháp serif đậm "HAY QUÁ!", "TUYỆT!", "HÁT NỮA!", "YÊU" — tô vàng / son / ngọc, viền vàng mảnh (không viền đen).
// Vệt sáng của icon đặc biệt: vá fragment shader để đổi màu tint kẹo sang vàng quỳ / son / ngọc.
import * as THREE from 'three';
import { mixHex, RAMPS, hexStr } from '../../../../world/style';
import type { ArenaBuilders, Emotes } from '../../builders';
import { createEmotes } from '../../emotes';
import { ATLAS_COLS, ATLAS_ROWS, CELL, IC } from '../../emotesAtlas';

const SERIF = '"Noto Serif", "DejaVu Serif", Georgia, "Times New Roman", serif';
type G = CanvasRenderingContext2D;
type Pal = { son: Record<number, number>; gold: Record<number, number>; jade: Record<number, number>; silk: Record<number, number>; lac: Record<number, number> };

const edge = (g: G, P: Pal, w = 3) => { g.lineWidth = w; g.strokeStyle = hexStr(P.gold[300]); g.lineJoin = 'round'; g.stroke(); };
function heartPath(g: G, s: number) {
  g.beginPath(); g.moveTo(0, s * 0.42);
  g.bezierCurveTo(-s * 0.95, -s * 0.15, -s * 0.5, -s * 0.85, 0, -s * 0.38);
  g.bezierCurveTo(s * 0.5, -s * 0.85, s * 0.95, -s * 0.15, 0, s * 0.42); g.closePath();
}
function brushHeart(g: G, P: Pal, col: number, s = 52) {
  heartPath(g, s); g.fillStyle = hexStr(col); g.fill(); edge(g, P);
  // nét cọ khô quét qua
  g.strokeStyle = hexStr(mixHex(col, 0xffffff, 0.35)); g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-s * 0.45, -s * 0.3); g.quadraticCurveTo(-s * 0.2, -s * 0.5, s * 0.05, -s * 0.25); g.stroke();
}
function lotus(g: G, P: Pal, a: number, b: number) {
  const petal = (ang: number, len: number, wid: number, col: number) => {
    g.save(); g.rotate(ang); g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(wid, -len * 0.55, 0, -len); g.quadraticCurveTo(-wid, -len * 0.55, 0, 0);
    g.fillStyle = hexStr(col); g.fill(); edge(g, P, 2.5); g.restore();
  };
  g.translate(0, 26);
  for (const r of [-1.15, 1.15]) petal(r, 46, 20, b);
  for (const r of [-0.6, 0.6]) petal(r, 60, 22, a);
  petal(0, 70, 24, mixHex(a, 0xffffff, 0.25));
  g.beginPath(); g.ellipse(0, 4, 40, 9, 0, 0, Math.PI * 2); g.fillStyle = hexStr(P.jade[500]); g.fill(); edge(g, P, 2.5);
}
function lantern(g: G, P: Pal) {
  g.beginPath(); g.ellipse(0, 4, 40, 36, 0, 0, Math.PI * 2); g.fillStyle = hexStr(P.son[500]); g.fill(); edge(g, P);
  g.strokeStyle = hexStr(P.son[700]); g.lineWidth = 2.5;
  for (const k of [-0.6, -0.3, 0.3, 0.6]) { g.beginPath(); g.ellipse(0, 4, 40 * Math.abs(k) + 2, 36, 0, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = hexStr(P.gold[500]); g.fillRect(-16, -38, 32, 9); g.fillRect(-16, 36, 32, 9);
  g.strokeStyle = hexStr(P.son[500]); g.lineWidth = 5; g.beginPath(); g.moveTo(0, 45); g.lineTo(0, 60); g.stroke();
  g.beginPath(); g.ellipse(0, 4, 18, 22, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,220,140,0.35)'; g.fill();
}
function starLantern(g: G, P: Pal) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 52, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 2); }
  g.closePath(); g.fillStyle = hexStr(P.son[500]); g.fill(); edge(g, P, 4);
  g.beginPath(); g.arc(0, 2, 14, 0, Math.PI * 2); g.fillStyle = hexStr(P.gold[300]); g.fill();
  g.strokeStyle = hexStr(P.gold[700]); g.lineWidth = 4; g.beginPath(); g.moveTo(30, 30); g.lineTo(56, 58); g.stroke();
}
function drumSun(g: G, P: Pal) {
  g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.fillStyle = hexStr(P.gold[500]); g.fill(); edge(g, P, 3);
  g.strokeStyle = hexStr(P.gold[700]); g.lineWidth = 3;
  for (const r of [50, 40, 30]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  g.beginPath();
  for (let i = 0; i < 28; i++) { const r = i % 2 ? 7 : 27, a = i * Math.PI / 14; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fillStyle = hexStr(P.gold[100]); g.fill(); g.strokeStyle = hexStr(P.gold[700]); g.lineWidth = 2; g.stroke();
}
function crane(g: G, P: Pal) {
  g.fillStyle = hexStr(P.silk[100]);
  g.beginPath(); g.moveTo(-50, 10); g.quadraticCurveTo(-10, -50, 10, 0); g.quadraticCurveTo(30, -55, 56, -30); g.quadraticCurveTo(20, -10, 14, 16);
  g.quadraticCurveTo(-10, 20, -50, 10); g.fill(); edge(g, P, 3);
  g.strokeStyle = hexStr(P.silk[100]); g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(12, 12); g.quadraticCurveTo(30, 30, 18, 52); g.stroke();
  g.beginPath(); g.arc(18, 52, 6, 0, Math.PI * 2); g.fillStyle = hexStr(P.son[500]); g.fill();
  g.strokeStyle = hexStr(P.lac[500]); g.lineWidth = 4; g.beginPath(); g.moveTo(24, 54); g.lineTo(40, 60); g.stroke();
}
function note(g: G, P: Pal, col: number, dbl = false) {
  g.fillStyle = hexStr(col); g.strokeStyle = hexStr(col); g.lineCap = 'round';
  const one = (x: number) => {
    g.beginPath(); g.ellipse(x - 12, 30, 17, 12, -0.4, 0, Math.PI * 2); g.fill(); edge(g, P, 2.5);
    g.strokeStyle = hexStr(col); g.lineWidth = 8; g.beginPath(); g.moveTo(x + 3, 26); g.lineTo(x + 3, -42); g.stroke();
  };
  if (dbl) { one(-16); one(30); g.lineWidth = 12; g.strokeStyle = hexStr(col); g.beginPath(); g.moveTo(-13, -40); g.quadraticCurveTo(10, -50, 33, -40); g.stroke(); }
  else { one(6); g.lineWidth = 7; g.beginPath(); g.moveTo(9, -42); g.quadraticCurveTo(36, -30, 28, -4); g.stroke(); }
}
function fan(g: G, P: Pal) {
  g.beginPath(); g.moveTo(0, 40); g.arc(0, 40, 66, Math.PI * 1.15, Math.PI * 1.85); g.closePath();
  g.fillStyle = hexStr(P.son[500]); g.fill(); edge(g, P, 3);
  g.strokeStyle = hexStr(P.gold[500]); g.lineWidth = 2.5;
  for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.15 + 0.7 * i / 8); g.beginPath(); g.moveTo(0, 40); g.lineTo(Math.cos(a) * 66, 40 + Math.sin(a) * 66); g.stroke(); }
  g.beginPath(); g.arc(0, 40, 40, Math.PI * 1.15, Math.PI * 1.85); g.lineWidth = 8; g.strokeStyle = hexStr(P.gold[300]); g.stroke();
}
function hat(g: G, P: Pal) {
  g.beginPath(); g.moveTo(0, -48); g.lineTo(60, 26); g.quadraticCurveTo(0, 40, -60, 26); g.closePath();
  g.fillStyle = hexStr(P.silk[300]); g.fill(); edge(g, P, 3);
  g.strokeStyle = hexStr(P.gold[700]); g.lineWidth = 2;
  for (const t of [0.35, 0.6, 0.85]) { g.beginPath(); g.moveTo(-60 * t, -48 + 74 * t); g.quadraticCurveTo(0, -48 + 88 * t, 60 * t, -48 + 74 * t); g.stroke(); }
  g.strokeStyle = hexStr(P.son[500]); g.lineWidth = 4; g.beginPath(); g.moveTo(-34, 30); g.quadraticCurveTo(0, 62, 34, 30); g.stroke();
}
function firecracker(g: G, P: Pal) {
  g.strokeStyle = hexStr(P.gold[700]); g.lineWidth = 3; g.beginPath(); g.moveTo(0, -58); g.lineTo(0, 58); g.stroke();
  for (let i = 0; i < 6; i++) {
    const y = -48 + i * 19, sx = i % 2 ? 1 : -1;
    g.save(); g.translate(sx * 12, y); g.rotate(sx * 0.5);
    g.beginPath(); g.rect(-6, -14, 12, 28); g.fillStyle = hexStr(P.son[500]); g.fill(); edge(g, P, 2);
    g.restore();
  }
  g.fillStyle = hexStr(P.gold[300]);
  for (const [x, y] of [[-30, 50], [28, 46], [0, 62]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
}
function word(g: G, P: Pal, s: string, col: number) {
  let fs = 46; g.font = `900 ${fs}px ${SERIF}`;
  const w = g.measureText(s).width; if (w > 116) { fs *= 116 / w; g.font = `900 ${fs}px ${SERIF}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 7; g.strokeStyle = hexStr(P.lac[700]); g.strokeText(s, 0, 6);
  g.lineWidth = 2.5; g.strokeStyle = hexStr(P.gold[300]); g.fillStyle = hexStr(col); g.fillText(s, 0, 6); g.strokeText(s, 0, 6);
}

/** Atlas Việt cùng lưới với emotesAtlas (ATLAS_COLS × ATLAS_ROWS ô CELL px). */
export function drawLacquerEmoteAtlas(): HTMLCanvasElement {
  const P: Pal = { son: RAMPS.son!, gold: RAMPS.gold!, jade: RAMPS.jade!, silk: RAMPS.silk!, lac: RAMPS.lacquer! };
  const cv = document.createElement('canvas');
  cv.width = ATLAS_COLS * CELL; cv.height = ATLAS_ROWS * CELL;
  const g = cv.getContext('2d')!;
  const pink = mixHex(P.son[300], P.son[100], 0.5);
  const draw: Record<number, (g: G) => void> = {
    [IC.HEART]: (x) => brushHeart(x, P, P.son[500]),
    [IC.HEART_PINK]: (x) => lotus(x, P, pink, P.son[300]),
    [IC.HEART_RAINBOW]: (x) => drumSun(x, P),
    [IC.HEART_EYES]: (x) => lantern(x, P),
    [IC.HEARTS2]: (x) => { x.save(); x.translate(-16, 8); brushHeart(x, P, P.son[500], 40); x.restore(); x.translate(20, -14); brushHeart(x, P, P.gold[500], 34); },
    [IC.SMILE]: (x) => hat(x, P),
    [IC.LAUGH]: (x) => fan(x, P),
    [IC.STARSTRUCK]: (x) => starLantern(x, P),
    [IC.SCREAM]: (x) => firecracker(x, P),
    [IC.STAR]: (x) => starLantern(x, P),
    [IC.SPARKLE]: (x) => { x.scale(0.7, 0.7); drumSun(x, P); },
    [IC.NOTE]: (x) => note(x, P, P.son[500]),
    [IC.NOTES2]: (x) => note(x, P, P.gold[500], true),
    [IC.CLEF]: (x) => note(x, P, P.jade[500]),
    [IC.FIRE]: (x) => firecracker(x, P),
    [IC.CLAP]: (x) => fan(x, P),
    [IC.RAISE]: (x) => hat(x, P),
    [IC.FHEART]: (x) => brushHeart(x, P, P.gold[500]),
    [IC.ROCK]: (x) => crane(x, P),
    [IC.MIC]: (x) => lantern(x, P),
    [IC.CROWN]: (x) => drumSun(x, P),
    [IC.STICK]: (x) => lantern(x, P),
    [IC.HUNDRED]: (x) => word(x, P, 'TUYỆT!', P.gold[300]),
    [IC.BOLT]: (x) => firecracker(x, P),
    [IC.ROSE]: (x) => lotus(x, P, pink, P.son[300]),
    [IC.KISS]: (x) => lotus(x, P, P.gold[300], P.gold[500]),
    [IC.TROPHY]: (x) => drumSun(x, P),
    [IC.POPPER]: (x) => firecracker(x, P),
    [IC.T_ENCORE]: (x) => word(x, P, 'HÁT NỮA!', P.gold[300]),
    [IC.T_LOVE]: (x) => word(x, P, 'YÊU', P.son[300]),
    [IC.T_WOW]: (x) => word(x, P, 'HAY QUÁ!', P.jade[300]),
    [IC.T_DINH]: (x) => word(x, P, 'TUYỆT!', P.gold[300]),
    [IC.T_HAY]: (x) => word(x, P, 'HAY QUÁ!', P.gold[300]),
    [IC.T_YEU]: (x) => word(x, P, 'YÊU', P.son[500]),
  };
  for (const [k, fn] of Object.entries(draw)) {
    const i = Number(k);
    g.save();
    g.translate((i % ATLAS_COLS) * CELL + CELL / 2, Math.floor(i / ATLAS_COLS) * CELL + CELL / 2);
    fn(g);
    g.restore();
  }
  return cv;
}

export function createLacquerEmotes(scene: THREE.Scene): Emotes {
  const before = new Set(scene.children);
  const em = createEmotes(scene);
  const added = scene.children.filter((c) => !before.has(c)) as THREE.Points[];
  const tex = new THREE.CanvasTexture(drawLacquerEmoteAtlas());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const gold = RAMPS.gold!, son = RAMPS.son!, jade = RAMPS.jade!;
  const v = (hex: number) => { const c = new THREE.Color(hex).convertLinearToSRGB(); return `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`; };
  for (const o of added) {
    const mat = o.material as THREE.ShaderMaterial;
    if (!mat?.uniforms) continue;
    if (mat.uniforms.uMap) {
      (mat.uniforms.uMap.value as THREE.Texture | null)?.dispose();
      mat.uniforms.uMap.value = tex;
    } else if (mat.fragmentShader.includes('vTint')) {
      // tint kẹo → vàng quỳ (vàng), son (hồng/cam), ngọc (xanh/tím)
      const fn = `vec3 lacqTint(vec3 t){ if (t.b > t.g && t.b > 0.6) return ${v(jade[300])}; if (t.g < 0.7) return ${v(son[300])}; return ${v(gold[300])}; }\n`;
      const i = mat.fragmentShader.indexOf('void main');
      if (i > 0) {
        mat.fragmentShader = mat.fragmentShader.slice(0, i) + fn + mat.fragmentShader.slice(i).replace(/vTint/g, 'lacqTint(vTint)').replace('vec3(1.0), core', `${v(gold[100])}, core`);
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

export const builders: Partial<ArenaBuilders> = { emotes: (c) => createLacquerEmotes(c.scene) };
