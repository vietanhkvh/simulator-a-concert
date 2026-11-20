// Atlas biểu tượng cảm xúc vẽ bằng canvas 2D (không dùng font emoji): ô 128 px, gradient,
// viền tối, highlight và quầng sáng (shadowBlur). 8 cột × 5 hàng = 40 ô, dùng 34.

export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 5;
export const CELL = 128;

/** Chỉ số icon trong atlas. */
export const IC = {
  HEART: 0,
  HEART_PINK: 1,
  HEART_RAINBOW: 2,
  HEART_EYES: 3,
  HEARTS2: 4,
  SMILE: 5,
  LAUGH: 6,
  STARSTRUCK: 7,
  SCREAM: 8,
  STAR: 9,
  SPARKLE: 10,
  NOTE: 11,
  NOTES2: 12,
  CLEF: 13,
  FIRE: 14,
  CLAP: 15,
  RAISE: 16,
  FHEART: 17,
  ROCK: 18,
  MIC: 19,
  CROWN: 20,
  STICK: 21,
  HUNDRED: 22,
  BOLT: 23,
  ROSE: 24,
  KISS: 25,
  TROPHY: 26,
  POPPER: 27,
  T_ENCORE: 28,
  T_LOVE: 29,
  T_WOW: 30,
  T_DINH: 31,
  T_HAY: 32,
  T_YEU: 33,
} as const;
export const ICON_COUNT = 34;

/** Màu chủ đạo mỗi icon (0..1) cho vệt sáng / quầng. */
export const ICON_TINT: [number, number, number][] = [
  [1, 0.2, 0.4], [1, 0.45, 0.8], [1, 0.6, 0.3], [1, 0.8, 0.3], [1, 0.3, 0.55],
  [1, 0.85, 0.3], [1, 0.85, 0.3], [1, 0.8, 0.2], [1, 0.8, 0.3], [1, 0.85, 0.2],
  [0.6, 0.9, 1], [0.2, 0.9, 1], [1, 0.35, 0.9], [1, 0.8, 0.3], [1, 0.5, 0.1],
  [1, 0.8, 0.4], [1, 0.8, 0.4], [1, 0.4, 0.6], [1, 0.7, 0.3], [0.7, 0.8, 1],
  [1, 0.8, 0.2], [0.8, 0.4, 1], [1, 0.25, 0.25], [1, 0.95, 0.3], [1, 0.2, 0.3],
  [1, 0.25, 0.45], [1, 0.8, 0.2], [0.9, 0.5, 1], [0.8, 0.4, 1], [1, 0.25, 0.4],
  [1, 0.6, 0.15], [1, 0.8, 0.2], [0.2, 0.9, 1], [1, 0.4, 0.75],
];

type G = CanvasRenderingContext2D;
const INK = '#1c0629';
const FONT = '"Segoe UI", "Helvetica Neue", Arial, "Noto Sans", "DejaVu Sans", "Liberation Sans", sans-serif';

export function drawEmoteAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CELL * ATLAS_COLS;
  c.height = CELL * ATLAS_ROWS;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';

  const lin = (x0: number, y0: number, x1: number, y1: number, stops: string[]) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
    return gr;
  };
  const rad = (x: number, y: number, r: number, stops: string[]) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
    return gr;
  };
  /** Vẽ hình: viền tối có quầng sáng màu glow, rồi tô fill. */
  const shape = (path: () => void, fill: string | CanvasGradient, glow?: string, lw = 6) => {
    g.save();
    g.beginPath();
    path();
    if (glow) {
      g.shadowColor = glow;
      g.shadowBlur = 16;
    }
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
    g.beginPath();
    path();
    g.fillStyle = fill;
    g.fill();
  };
  const shine = (x: number, y: number, rx: number, ry: number, rot: number, a = 0.8) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.fill();
  };
  const heartPath = (cx: number, cy: number, s: number) => () => {
    g.moveTo(cx, cy + 46 * s);
    g.bezierCurveTo(cx - 70 * s, cy - 2 * s, cx - 50 * s, cy - 52 * s, cx - 22 * s, cy - 42 * s);
    g.bezierCurveTo(cx - 8 * s, cy - 38 * s, cx, cy - 26 * s, cx, cy - 20 * s);
    g.bezierCurveTo(cx, cy - 26 * s, cx + 8 * s, cy - 38 * s, cx + 22 * s, cy - 42 * s);
    g.bezierCurveTo(cx + 50 * s, cy - 52 * s, cx + 70 * s, cy - 2 * s, cx, cy + 46 * s);
    g.closePath();
  };
  const heart = (cx: number, cy: number, s: number, fill: string | CanvasGradient, glow?: string, lw = 6) => {
    shape(heartPath(cx, cy, s), fill, glow, lw);
    shine(cx - 28 * s, cy - 22 * s, 9 * s, 6 * s, -0.6, 0.75);
  };
  const starPath = (cx: number, cy: number, ro: number, ri: number, n = 5, rot = -Math.PI / 2) => () => {
    for (let k = 0; k < n * 2; k++) {
      const r = k % 2 ? ri : ro;
      const a = rot + (k * Math.PI) / n;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
  };
  const sparkPath = (cx: number, cy: number, r: number) => () => {
    g.moveTo(cx, cy - r);
    g.quadraticCurveTo(cx, cy, cx + r, cy);
    g.quadraticCurveTo(cx, cy, cx, cy + r);
    g.quadraticCurveTo(cx, cy, cx - r, cy);
    g.quadraticCurveTo(cx, cy, cx, cy - r);
    g.closePath();
  };
  const face = () => {
    shape(() => g.arc(0, 0, 47, 0, Math.PI * 2), rad(-14, -18, 70, ['#fff7a8', '#ffd23a', '#f59a00']), 'rgba(255,200,40,0.9)');
    shine(-20, -28, 13, 7, -0.5, 0.55);
  };
  const blush = () => {
    g.fillStyle = 'rgba(255,90,120,0.45)';
    g.beginPath();
    g.ellipse(-28, 12, 9, 5, 0, 0, 7);
    g.ellipse(28, 12, 9, 5, 0, 0, 7);
    g.fill();
  };
  const ink = (w: number) => {
    g.lineWidth = w;
    g.strokeStyle = INK;
  };
  const SKIN = () => lin(0, -50, 0, 50, ['#ffe9a6', '#ffc94a', '#f0a020']);
  /** Bàn tay xòe (lòng bàn tay + 4 ngón + ngón cái) ở gốc tọa độ, cao ~100*s. */
  const openHand = (x: number, y: number, s: number, rot: number, flip: boolean) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(flip ? -s : s, s);
    const p = () => {
      g.roundRect(-30, -4, 56, 52, 18);
      for (let k = 0; k < 4; k++) g.roundRect(-30 + k * 14.5, -52 + (k === 1 || k === 2 ? -6 : 4) + (k === 3 ? 8 : 0), 12, 56, 6);
      g.ellipse(-34, 22, 10, 21, 0.85, 0, Math.PI * 2);
    };
    shape(p, SKIN(), 'rgba(255,190,60,0.8)', 7);
    g.restore();
  };
  const fist = (pathExtra: () => void, glow = 'rgba(255,190,60,0.8)') => {
    shape(() => {
      g.roundRect(-30, -8, 58, 56, 16);
      pathExtra();
    }, SKIN(), glow, 7);
    // khớp ngón
    ink(3);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(-14 + k * 14, 4);
      g.lineTo(-14 + k * 14, 20);
      g.stroke();
    }
  };
  const bubble = (text: string, c0: string, c1: string, heartAfter = false) => {
    const w = 110;
    const h = 64;
    shape(() => {
      g.roundRect(-w / 2, -h / 2 - 8, w, h, 22);
      g.moveTo(-14, h / 2 - 9);
      g.lineTo(-24, h / 2 + 12);
      g.lineTo(2, h / 2 - 9);
    }, lin(0, -h / 2, 0, h / 2, [c0, c1]), c0, 6);
    shine(-34, -h / 2 + 2, 16, 5, -0.15, 0.45);
    let fs = 34;
    const hw = heartAfter ? 26 : 0;
    g.font = `900 ${fs}px ${FONT}`;
    let tw = g.measureText(text).width;
    const maxW = w - 14 - hw;
    if (tw > maxW) {
      fs = Math.floor((fs * maxW) / tw);
      g.font = `900 ${fs}px ${FONT}`;
      tw = g.measureText(text).width;
    }
    const x0 = -(tw + hw) / 2;
    const ty = -6 + fs * 0.36;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.lineWidth = 6;
    g.strokeStyle = INK;
    g.strokeText(text, x0, ty);
    g.fillStyle = '#ffffff';
    g.fillText(text, x0, ty);
    if (heartAfter) heart(x0 + tw + hw / 2 + 2, -8, 0.3, '#ff2f6d', undefined, 4);
  };

  const cells: (() => void)[] = [];
  // 0 tim đỏ cổ điển
  cells[IC.HEART] = () => heart(0, 4, 1, lin(0, -50, 0, 50, ['#ff6a8e', '#ff1f4f', '#b0002a']), 'rgba(255,40,90,0.9)');
  // 1 tim hồng lấp lánh
  cells[IC.HEART_PINK] = () => {
    heart(0, 6, 0.92, lin(-40, -40, 40, 50, ['#ffc2e6', '#ff5fbf', '#d0208f']), 'rgba(255,110,210,0.95)');
    shape(sparkPath(38, -38, 17), '#ffffff', 'rgba(255,255,255,1)', 3);
    shape(sparkPath(-44, 30, 10), '#fff3a0', 'rgba(255,255,200,1)', 3);
    shape(sparkPath(26, 34, 8), '#ffffff', 'rgba(255,255,255,1)', 2);
  };
  // 2 tim cầu vồng
  cells[IC.HEART_RAINBOW] = () =>
    heart(0, 4, 1, lin(-50, -40, 50, 40, ['#ff3b3b', '#ff9a1f', '#ffe53b', '#3bd96b', '#2fa8ff', '#9a4dff']), 'rgba(255,255,255,0.7)');
  // 3 mặt mắt tim
  cells[IC.HEART_EYES] = () => {
    face();
    heart(-18, -8, 0.32, '#ff2050', undefined, 3);
    heart(18, -8, 0.32, '#ff2050', undefined, 3);
    shape(() => {
      g.moveTo(-24, 14);
      g.quadraticCurveTo(0, 46, 24, 14);
      g.closePath();
    }, '#5a1020', undefined, 4);
  };
  // 4 hai trái tim
  cells[IC.HEARTS2] = () => {
    heart(-16, 10, 0.68, lin(0, -30, 0, 40, ['#ff7aa8', '#e8105a']), 'rgba(255,60,120,0.9)');
    heart(22, -16, 0.5, lin(0, -30, 0, 30, ['#ffd0ea', '#ff5fbf']), 'rgba(255,120,200,0.9)');
  };
  // 5 mặt cười
  cells[IC.SMILE] = () => {
    face();
    blush();
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(-16, -10, 6, 10, 0, 0, 7);
    g.ellipse(16, -10, 6, 10, 0, 0, 7);
    g.fill();
    ink(6);
    g.beginPath();
    g.arc(0, 4, 26, 0.35, Math.PI - 0.35);
    g.stroke();
  };
  // 6 cười ra nước mắt
  cells[IC.LAUGH] = () => {
    face();
    ink(6);
    g.beginPath();
    g.moveTo(-28, -8);
    g.lineTo(-16, -16);
    g.lineTo(-6, -8);
    g.moveTo(6, -8);
    g.lineTo(16, -16);
    g.lineTo(28, -8);
    g.stroke();
    shape(() => {
      g.moveTo(-28, 4);
      g.quadraticCurveTo(0, 8, 28, 4);
      g.quadraticCurveTo(26, 38, 0, 38);
      g.quadraticCurveTo(-26, 38, -28, 4);
      g.closePath();
    }, '#5a1020', undefined, 4);
    g.fillStyle = '#ff6b8a';
    g.beginPath();
    g.ellipse(0, 30, 12, 6, 0, 0, 7);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(-20, 6, 40, 6);
    for (const sx of [-1, 1]) {
      shape(() => {
        g.moveTo(sx * 40, -10);
        g.quadraticCurveTo(sx * 58, 6, sx * 50, 14);
        g.quadraticCurveTo(sx * 40, 18, sx * 38, 6);
        g.closePath();
      }, lin(0, -10, 0, 16, ['#bff0ff', '#2fa8ff']), 'rgba(80,180,255,0.9)', 3);
    }
  };
  // 7 mắt sao
  cells[IC.STARSTRUCK] = () => {
    face();
    shape(starPath(-17, -10, 15, 6.5), lin(0, -24, 0, 4, ['#ffdf5e', '#ff4a1f']), undefined, 3);
    shape(starPath(17, -10, 15, 6.5), lin(0, -24, 0, 4, ['#ffdf5e', '#ff4a1f']), undefined, 3);
    shape(() => {
      g.moveTo(-24, 12);
      g.quadraticCurveTo(0, 16, 24, 12);
      g.quadraticCurveTo(20, 38, 0, 38);
      g.quadraticCurveTo(-20, 38, -24, 12);
      g.closePath();
    }, '#5a1020', undefined, 4);
    g.fillStyle = '#fff';
    g.fillRect(-18, 13, 36, 5);
  };
  // 8 fan hét
  cells[IC.SCREAM] = () => {
    face();
    blush();
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(sx * 17, -12, 11, 0, 7);
      g.fillStyle = '#fff';
      g.fill();
      ink(3);
      g.stroke();
      g.beginPath();
      g.arc(sx * 17, -10, 4.5, 0, 7);
      g.fillStyle = INK;
      g.fill();
    }
    shape(() => g.ellipse(0, 22, 13, 18, 0, 0, Math.PI * 2), '#5a1020', undefined, 4);
    g.fillStyle = '#ff6b8a';
    g.beginPath();
    g.ellipse(0, 32, 8, 5, 0, 0, 7);
    g.fill();
    heart(40, -40, 0.24, '#ff2f6d', 'rgba(255,60,120,1)', 3);
    heart(-44, -34, 0.18, '#ff7ac0', 'rgba(255,60,160,1)', 3);
  };
  // 9 ngôi sao
  cells[IC.STAR] = () => {
    shape(starPath(0, 6, 56, 24), rad(-8, -6, 60, ['#fffbd0', '#ffe03a', '#ff9d00']), 'rgba(255,220,60,1)');
    shine(-14, -10, 10, 5, -0.6, 0.7);
  };
  // 10 lấp lánh
  cells[IC.SPARKLE] = () => {
    shape(sparkPath(-6, 6, 46), rad(-6, 6, 46, ['#ffffff', '#bff4ff', '#4cc9ff']), 'rgba(140,230,255,1)', 5);
    shape(sparkPath(34, -32, 20), rad(34, -32, 20, ['#ffffff', '#fff3a0', '#ffc400']), 'rgba(255,240,150,1)', 4);
    shape(sparkPath(36, 38, 12), rad(36, 38, 12, ['#ffffff', '#ffb0f0']), 'rgba(255,170,240,1)', 3);
  };
  // 11 nốt nhạc đơn
  cells[IC.NOTE] = () => {
    const f = lin(0, -50, 0, 50, ['#9ff6ff', '#2fd6ff', '#1a7dff']);
    shape(() => {
      g.ellipse(-14, 34, 22, 16, -0.4, 0, Math.PI * 2);
      g.rect(2, -50, 11, 84);
      g.moveTo(2, -50);
      g.quadraticCurveTo(46, -36, 40, 2);
      g.lineTo(32, 0);
      g.quadraticCurveTo(34, -22, 2, -28);
      g.closePath();
    }, f, 'rgba(60,220,255,1)');
    g.fillStyle = f;
    g.fillRect(2, -40, 11, 74);
    shine(-22, 28, 7, 4, -0.4, 0.7);
  };
  // 12 nốt đôi
  cells[IC.NOTES2] = () => {
    const f = lin(0, -50, 0, 50, ['#ffb0ff', '#ff3dd8', '#a01aff']);
    shape(() => {
      g.ellipse(-30, 36, 18, 13, -0.4, 0, Math.PI * 2);
      g.ellipse(26, 26, 18, 13, -0.4, 0, Math.PI * 2);
      g.rect(-22, -34, 10, 70);
      g.rect(34, -44, 10, 70);
      g.moveTo(-22, -34);
      g.lineTo(44, -50);
      g.lineTo(44, -34);
      g.lineTo(-22, -18);
      g.closePath();
    }, f, 'rgba(255,80,230,1)');
    g.fillStyle = f;
    g.fillRect(-22, -26, 10, 60);
    g.fillRect(34, -40, 10, 64);
  };
  // 13 khóa Sol
  cells[IC.CLEF] = () => {
    const p = () => {
      g.moveTo(-12, 44);
      g.quadraticCurveTo(4, 56, 8, 38);
      g.lineTo(-2, -38);
      g.bezierCurveTo(-6, -60, 20, -62, 14, -38);
      g.bezierCurveTo(10, -18, -30, -6, -26, 18);
      g.bezierCurveTo(-22, 40, 22, 40, 22, 16);
      g.bezierCurveTo(22, -2, -4, -4, -8, 10);
      g.bezierCurveTo(-10, 20, 0, 24, 4, 20);
    };
    g.save();
    g.beginPath();
    p();
    g.shadowColor = 'rgba(255,210,80,1)';
    g.shadowBlur = 16;
    g.lineWidth = 15;
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
    g.beginPath();
    p();
    g.lineWidth = 8;
    g.strokeStyle = lin(0, -55, 0, 50, ['#fff3b0', '#ffc61a', '#ff8a00']);
    g.stroke();
    shape(() => g.arc(-12, 42, 8, 0, 7), '#ffc61a', undefined, 4);
  };
  // 14 lửa
  cells[IC.FIRE] = () => {
    shape(() => {
      g.moveTo(0, -58);
      g.bezierCurveTo(10, -30, 44, -14, 40, 22);
      g.bezierCurveTo(38, 48, 18, 58, 0, 58);
      g.bezierCurveTo(-20, 58, -42, 46, -40, 20);
      g.bezierCurveTo(-39, 4, -26, -6, -22, -22);
      g.bezierCurveTo(-12, -10, -8, -4, -6, 4);
      g.bezierCurveTo(-4, -20, -6, -40, 0, -58);
      g.closePath();
    }, lin(0, -58, 0, 58, ['#ff3a1a', '#ff6a14', '#ffb21a']), 'rgba(255,100,20,1)');
    g.beginPath();
    g.moveTo(0, -4);
    g.bezierCurveTo(16, 14, 26, 30, 14, 48);
    g.quadraticCurveTo(0, 54, -14, 48);
    g.bezierCurveTo(-24, 30, -8, 16, 0, -4);
    g.fillStyle = lin(0, -4, 0, 52, ['#ffe34d', '#fff8c8']);
    g.fill();
  };
  // 15 vỗ tay
  cells[IC.CLAP] = () => {
    openHand(-12, 10, 0.78, -0.35, false);
    openHand(14, 8, 0.78, 0.3, true);
    ink(5);
    g.strokeStyle = '#fff3a0';
    g.beginPath();
    for (const [a, r0, r1] of [[-2.2, 46, 60], [-1.57, 50, 62], [-0.9, 46, 60]] as [number, number, number][]) {
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 4);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 - 4);
    }
    g.stroke();
  };
  // 16 giơ hai tay
  cells[IC.RAISE] = () => {
    openHand(-26, 10, 0.62, -0.25, false);
    openHand(26, 10, 0.62, 0.25, true);
  };
  // 17 bắn tim (finger heart)
  cells[IC.FHEART] = () => {
    g.save();
    g.translate(0, 14);
    fist(() => {});
    // ngón trỏ + ngón cái bắt chéo
    shape(() => g.roundRect(-8, -40, 14, 42, 7), SKIN(), undefined, 6);
    g.save();
    g.rotate(0.55);
    shape(() => g.roundRect(-12, -42, 14, 40, 7), SKIN(), undefined, 6);
    g.restore();
    g.restore();
    heart(28, -34, 0.36, '#ff2050', 'rgba(255,40,90,1)', 4);
  };
  // 18 rock on
  cells[IC.ROCK] = () => {
    g.save();
    g.translate(0, 12);
    shape(() => {
      g.roundRect(-30, -64, 14, 62, 7);
      g.roundRect(14, -60, 14, 58, 7);
    }, SKIN(), 'rgba(255,190,60,0.8)', 7);
    fist(() => {});
    shape(() => g.roundRect(-34, 16, 46, 14, 7), SKIN(), undefined, 5);
    g.restore();
  };
  // 19 micro
  cells[IC.MIC] = () => {
    g.save();
    g.rotate(0.45);
    shape(() => {
      g.moveTo(-10, -6);
      g.lineTo(10, -6);
      g.lineTo(6, 56);
      g.lineTo(-6, 56);
      g.closePath();
    }, lin(-10, 0, 10, 0, ['#222', '#666', '#111']), undefined, 5);
    shape(() => g.rect(-14, -14, 28, 10), lin(0, -14, 0, -4, ['#ff7ad0', '#c0108a']), undefined, 4);
    shape(() => g.arc(0, -34, 24, 0, Math.PI * 2), rad(-8, -42, 30, ['#ffffff', '#c9d2e0', '#6a7488']), 'rgba(200,220,255,1)');
    g.save();
    g.beginPath();
    g.arc(0, -34, 22, 0, 7);
    g.clip();
    g.strokeStyle = 'rgba(40,40,70,0.45)';
    g.lineWidth = 2;
    for (let k = -30; k <= 30; k += 7) {
      g.beginPath();
      g.moveTo(k - 30, -64);
      g.lineTo(k + 30, -4);
      g.moveTo(k + 30, -64);
      g.lineTo(k - 30, -4);
      g.stroke();
    }
    g.restore();
    shine(-8, -44, 7, 4, -0.5, 0.8);
    g.restore();
  };
  // 20 vương miện
  cells[IC.CROWN] = () => {
    shape(() => {
      g.moveTo(-50, 34);
      g.lineTo(-54, -24);
      g.lineTo(-26, 2);
      g.lineTo(0, -40);
      g.lineTo(26, 2);
      g.lineTo(54, -24);
      g.lineTo(50, 34);
      g.closePath();
    }, lin(0, -40, 0, 34, ['#fff4a8', '#ffcc22', '#d48a00']), 'rgba(255,210,60,1)');
    shape(() => g.roundRect(-50, 26, 100, 14, 5), lin(0, 26, 0, 40, ['#ffd84a', '#c07800']), undefined, 5);
    for (const [x, y, r, col] of [[0, -42, 7, '#ff2f6d'], [-54, -26, 6, '#2fd6ff'], [54, -26, 6, '#2fd6ff'], [-24, 33, 5, '#ff2f6d'], [0, 33, 5, '#3bd96b'], [24, 33, 5, '#ff2f6d'], [0, 8, 9, '#a14dff']] as [number, number, number, string][]) {
      shape(() => g.arc(x, y, r, 0, Math.PI * 2), col, undefined, 3);
      shine(x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.22, -0.5, 0.9);
    }
  };
  // 21 lightstick
  cells[IC.STICK] = () => {
    g.save();
    g.rotate(-0.4);
    shape(() => g.roundRect(-7, 8, 14, 52, 6), lin(-7, 0, 7, 0, ['#333', '#888', '#222']), undefined, 5);
    shape(() => g.roundRect(-11, 2, 22, 12, 4), '#ff5fbf', undefined, 4);
    g.save();
    g.shadowColor = 'rgba(255,90,220,1)';
    g.shadowBlur = 26;
    shape(() => g.arc(0, -24, 28, 0, Math.PI * 2), rad(0, -24, 30, ['#ffffff', '#ffb0f0', '#e040c0', '#8a1ad0']), 'rgba(255,90,220,1)');
    g.restore();
    heart(0, -24, 0.3, 'rgba(255,255,255,0.95)', undefined, 0.01);
    g.restore();
  };
  // 22 huy hiệu 100
  cells[IC.HUNDRED] = () => {
    g.save();
    g.rotate(-0.12);
    g.font = `italic 900 54px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.shadowColor = 'rgba(255,40,40,1)';
    g.shadowBlur = 16;
    g.lineWidth = 9;
    g.strokeStyle = INK;
    g.strokeText('100', 0, -6);
    g.restore();
    g.fillStyle = lin(0, -30, 0, 20, ['#ff7a6a', '#ff1a1a', '#b00000']);
    g.fillText('100', 0, -6);
    shape(() => {
      g.roundRect(-44, 26, 88, 8, 4);
      g.roundRect(-38, 40, 76, 8, 4);
    }, '#ff2a2a', undefined, 4);
    g.restore();
  };
  // 23 tia sét
  cells[IC.BOLT] = () =>
    shape(() => {
      g.moveTo(12, -60);
      g.lineTo(-30, 6);
      g.lineTo(-2, 6);
      g.lineTo(-14, 60);
      g.lineTo(34, -12);
      g.lineTo(6, -12);
      g.lineTo(22, -60);
      g.closePath();
    }, lin(-20, -60, 20, 60, ['#fffbd0', '#ffe82a', '#ffa400']), 'rgba(255,240,80,1)');
  // 24 hoa hồng
  cells[IC.ROSE] = () => {
    g.save();
    g.rotate(0.35);
    ink(10);
    g.beginPath();
    g.moveTo(0, -6);
    g.quadraticCurveTo(-6, 30, 2, 62);
    g.stroke();
    g.lineWidth = 6;
    g.strokeStyle = '#2fae4a';
    g.stroke();
    shape(() => {
      g.ellipse(-16, 30, 14, 7, -0.6, 0, Math.PI * 2);
    }, lin(0, 20, 0, 40, ['#6ee07a', '#1f8a3a']), undefined, 4);
    shape(() => g.ellipse(14, 40, 12, 6, 0.6, 0, Math.PI * 2), lin(0, 30, 0, 50, ['#6ee07a', '#1f8a3a']), undefined, 4);
    shape(() => {
      g.moveTo(-30, -30);
      g.quadraticCurveTo(-34, 4, 0, 4);
      g.quadraticCurveTo(34, 4, 30, -30);
      g.quadraticCurveTo(16, -24, 12, -40);
      g.quadraticCurveTo(0, -30, -12, -40);
      g.quadraticCurveTo(-16, -24, -30, -30);
      g.closePath();
    }, rad(0, -20, 40, ['#ff6a7a', '#e0102e', '#8a0018']), 'rgba(255,40,70,1)');
    g.strokeStyle = 'rgba(90,0,20,0.8)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, -18, 10, 0.3, 4.5);
    g.moveTo(-18, -10);
    g.quadraticCurveTo(0, 6, 18, -10);
    g.stroke();
    g.restore();
  };
  // 25 môi hôn
  cells[IC.KISS] = () => {
    shape(() => {
      g.moveTo(-50, 0);
      g.bezierCurveTo(-34, -30, -14, -30, 0, -16);
      g.bezierCurveTo(14, -30, 34, -30, 50, 0);
      g.bezierCurveTo(30, 36, -30, 36, -50, 0);
      g.closePath();
    }, lin(0, -30, 0, 30, ['#ff7090', '#f0104a', '#a0002a']), 'rgba(255,40,90,1)');
    ink(4);
    g.beginPath();
    g.moveTo(-46, 1);
    g.quadraticCurveTo(0, 12, 46, 1);
    g.stroke();
    shine(-20, -14, 10, 4, -0.2, 0.7);
    shine(16, 16, 12, 4, 0.1, 0.5);
    heart(40, -38, 0.22, '#ff2f6d', 'rgba(255,60,120,1)', 3);
  };
  // 26 cúp
  cells[IC.TROPHY] = () => {
    const gold = lin(-40, 0, 40, 0, ['#c07800', '#ffe066', '#fff6c0', '#ffcc22', '#b06a00']);
    ink(10);
    g.beginPath();
    g.arc(-36, -24, 15, Math.PI * 0.5, Math.PI * 1.6);
    g.moveTo(36, -9);
    g.arc(36, -24, 15, Math.PI * 0.5, -Math.PI * 0.6, true);
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#ffcc22';
    g.stroke();
    shape(() => {
      g.moveTo(-36, -46);
      g.lineTo(36, -46);
      g.quadraticCurveTo(36, 10, 0, 14);
      g.quadraticCurveTo(-36, 10, -36, -46);
      g.closePath();
    }, gold, 'rgba(255,210,60,1)');
    shape(() => {
      g.rect(-7, 12, 14, 18);
      g.roundRect(-26, 28, 52, 12, 3);
      g.roundRect(-32, 38, 64, 14, 4);
    }, gold, undefined, 5);
    shape(starPath(0, -20, 13, 5.5), '#fff6c0', undefined, 3);
  };
  // 27 pháo giấy
  cells[IC.POPPER] = () => {
    const cols = ['#ff2f6d', '#2fd6ff', '#ffe03a', '#3bd96b', '#a14dff', '#ff9a1f'];
    for (let k = 0; k < 14; k++) {
      const a = -1.9 + (k / 13) * 1.9 + Math.sin(k * 7.1) * 0.12;
      const r = 26 + ((k * 37) % 30);
      g.save();
      g.translate(-14 + Math.cos(a) * r, 8 + Math.sin(a) * r);
      g.rotate(k * 1.3);
      g.fillStyle = cols[k % cols.length];
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      if (k % 3 === 0) g.arc(0, 0, 4.5, 0, 7);
      else g.rect(-6, -3, 12, 6);
      g.fill();
      g.stroke();
      g.restore();
    }
    shape(() => {
      g.moveTo(-50, 52);
      g.lineTo(-30, -6);
      g.lineTo(6, 30);
      g.closePath();
    }, lin(-50, 50, 0, 0, ['#a01aff', '#ff3dd8']), 'rgba(255,80,230,0.8)');
    g.save();
    g.beginPath();
    g.moveTo(-50, 52);
    g.lineTo(-30, -6);
    g.lineTo(6, 30);
    g.closePath();
    g.clip();
    g.strokeStyle = '#ffe03a';
    g.lineWidth = 5;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(-60 + k * 16, 0);
      g.lineTo(-20 + k * 16, 60);
      g.stroke();
    }
    g.restore();
    shape(sparkPath(30, -34, 14), '#fff3a0', 'rgba(255,240,150,1)', 3);
  };
  cells[IC.T_ENCORE] = () => bubble('ENCORE!', '#c45bff', '#ff2fa0');
  cells[IC.T_LOVE] = () => bubble('LOVE', '#ff5a7a', '#d0002e');
  cells[IC.T_WOW] = () => bubble('WOW', '#ffb21a', '#ff5a00');
  cells[IC.T_DINH] = () => bubble('ĐỈNH!', '#ffd84a', '#ff8a00');
  cells[IC.T_HAY] = () => bubble('HAY QUÁ!', '#3ee6ff', '#1a6dff');
  cells[IC.T_YEU] = () => bubble('YÊU', '#ff8ad8', '#e0208f', true);

  for (let i = 0; i < ICON_COUNT; i++) {
    g.save();
    g.translate((i % ATLAS_COLS) * CELL + CELL / 2, Math.floor(i / ATLAS_COLS) * CELL + CELL / 2);
    g.beginPath();
    g.rect(-CELL / 2, -CELL / 2, CELL, CELL);
    g.clip();
    g.scale(0.94, 0.94);
    cells[i]();
    g.restore();
  }
  return c;
}
