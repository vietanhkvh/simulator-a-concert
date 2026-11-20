// "Đêm Sao Điểm Ảnh" — docs/design/alt/STYLE_E_pixel-hoi-hoa.md. Hex chép nguyên từ style sheet (31 màu);
// chỗ suy ra đánh dấu `// derived`.
import type { Ramp, Theme } from '../themeTypes';

const INK = 0x0b0a1a, NGOC = 0x39b6b0, SEN = 0xe46a9a;
const R = {
  pho: { 700: 0x101a3a, 500: 0x1f3a8a, 300: 0x2f5fb8, 100: 0x5b93d6 }, // lam Phổ
  crom: { 700: 0xb3781a, 500: 0xf2b824, 300: 0xf7dc78, 100: 0xfdf6d0 }, // vàng crôm
  bach: { 700: 0x10261f, 500: 0x1e5a46, 300: 0x3f8f62, 100: 0xa8c66c }, // lục bách
  son: { 700: 0x5a1420, 500: 0xc8321e, 300: 0xf0641e, 100: 0xf8a04a }, // son Munch
  dat: { 700: 0x3b2416, 500: 0x7a4526, 300: 0xc98a56, 100: 0xf0c79a }, // đất & da
  tim: { 700: 0x2a2350, 500: 0x4a3f82, 300: 0x7f6cc0, 100: 0xb9a6e0 }, // tím chiều
  may: { 700: 0x3c4664, 500: 0x6b7690, 300: 0xa9cbe8, 100: 0xe8f1f6 }, // xám mây
} satisfies Record<string, Ramp>;

// Ô token ghép từ các bậc của sheet (không thêm hex mới trừ chỗ ghi derived):
const night: Ramp = { 700: INK, 500: R.pho[700], 300: R.tim[700], 100: R.tim[500] }; // mực → lam Phổ tối → tím chiều
const soda: Ramp = { 700: R.pho[500], 500: R.pho[300], 300: R.pho[100], 100: R.may[300] }; // lam Phổ lùi một bậc
const mint: Ramp = { 700: R.bach[500], 500: R.bach[300], 300: R.bach[100], 100: 0xd6e6b4 /* derived */ }; // lục bách lùi một bậc
const berry: Ramp = { 700: 0xa83a6c /* derived */, 500: SEN, 300: 0xf09cbc /* derived */, 100: 0xfad2e2 /* derived */ }; // hồng sen
const cream: Ramp = { 700: R.may[300], 500: R.crom[100], 300: 0xfefae6 /* derived */, 100: 0xffffff /* derived */ }; // kem, bóng ngả lam

export const pixel: Theme = {
  id: 'pixel',
  strings: {
    name: 'Đêm Sao Điểm Ảnh',
    tagline: 'Pixel art gặp hội hoạ: trời Van Gogh, khán giả "Người thét".',
    hypeNames: ['Đêm đầy sao', 'Hướng dương', 'Tiếng thét'],
    cheers: ['HÁT NỮA ĐI!', 'ĐÊM ĐẦY SAO', 'THÉT LÊN NÀO!', 'HƯỚNG DƯƠNG', 'VẼ TIẾP ĐI', 'ENCORE!'],
    secretBanner: 'KIỆT TÁC XUẤT HIỆN!',
  },
  ramps: R,
  singles: { ink: INK, ngoc: NGOC, sen: SEN },
  // Gán vào 8 ô token: night←mực+lam Phổ+tím chiều · grape←tím chiều · soda←lam Phổ (lùi 1 bậc) · honey←vàng crôm
  // · mint←lục bách (lùi 1 bậc) · peach←son Munch · berry←hồng sen (ramp suy ra) · cream←kem crôm-100 / mây.
  // `dat` (da, gỗ) và `may` (đá, chữ phụ) chỉ có ở ramps.
  pal: { night, grape: R.tim, soda, honey: R.crom, mint, peach: R.son, berry, cream },
  ink: INK, inkSky: INK,
  secretCore: R.crom[300], secretRim: NGOC,
  skin: [R.dat[100], R.dat[100], R.dat[300], R.dat[300], R.dat[500]], // da = dat-100/300/500
  hair: [INK, R.dat[700], R.dat[500], R.crom[700], R.crom[300], SEN, R.pho[100], R.tim[300]],
  cloth: [R.pho[300], R.crom[500], R.bach[300], NGOC, SEN],
  motif: { star: R.crom[500], heart: R.son[500], bow: NGOC }, // sao quầng · vệt sơn · xoáy
  zoneSat: { arena: 1.0, stands: 0.9, outside: 1.0, balloon: 1.0 }, // tách lớp bằng sắc độ, không giảm bão hoà (≤ 31 màu)
  zoneHueShiftDeg: { arena: 0, stands: 0, outside: 0, balloon: 0 },
  zoneHueTarget: 235,
  // Ramp dịch sắc: bóng lùi một bậc ramp (700 → về mực); màu ngoài bảng: L × 0,7, hue về lam/tím.
  shadow: { model: 'rampStep', shadow: 0.7, hueTarget: 235, hueShiftDeg: 14, minSat: 0.2, tint: 0, tintHueOffset: 0, floorLift: 0.03, glBias: [0.9, 0.93, 1.17] },
  hype: {
    cool: { name: 'Đêm đầy sao', lightFraction: 0.25, primary: 0x1f3a8a, secondary: 0x2f5fb8, accent: 0xf7dc78 },
    warm: { name: 'Hướng dương', lightFraction: 0.6, primary: 0x2f5fb8, secondary: 0xf2b824, accent: 0xa8c66c },
    vivid: { name: 'Tiếng thét', lightFraction: 1.0, primary: 0xc8321e, secondary: 0xf0641e, accent: 0xf8a04a },
  },
  sky: { zenith: R.pho[700], mid: R.pho[500], horizon: R.pho[300], haze: R.pho[100], glow: R.crom[700], fog: 0x0e1430 /* derived: giữa mực và pho-700 */ },
  form: {
    headsMesh: 3.2, headsBillboard: 3, charH: 1.6, // sprite ca sĩ 20×32 px ≈ 3,2 đầu
    bevelMin: 0, minDetail: 0.03, vehicleMaxAspect: 3,
    outlineRule: 'pixel1',
    outline: { width: 0.03, secret: 0.03, minPx: 1, maxPx: 1, cullPx: 18 },
    shading: 'pixel',
    toy: { softChar: [0, 0.01], softProp: [0, 0.01], rim: 0.15, rimHigh: 0.2, hi: 0.3, hiHigh: 0.25, hiArea: 0.05 },
    emissive: { arch: 0.15, trim: 0.6, stick: 1.0, secret: 1.6, outline: 0 },
    // 12 fps, chuyển động phụ bằng dịch 1 px: squash gần như tắt.
    squash: {
      beat: { down: [1, 1], up: [1, 1] },
      jump: { crouch: [0.95, 1.03], stretch: [1.03, 0.97], land: [0.95, 1.03] },
      phase: 1 / 12, jumpHype: 0.6, headLagMs: [83, 83], headSwayDeg: 4, vehicleStretch: 1.0,
    },
    pop: { peak: 1.0, sec: 0.17, peakAt: 0.08 },
    glare: { lyricsAdditiveMax: 0.35, flashPerSecMax: 3 },
  },
  features: {
    skyFeature: 'vangogh',
    secretSet: { ufo: 'paletteUfo', rocket: 'paintTube', dragon: 'brushDragons', jet: 'brushHeart', plane: 'paperPlane' },
    crowdVariant: 'spriteScream', standCrowdVariant: 'pointillist', rigVariant: 'painterSprite', stageVariant: 'giltFrame',
    bannerCarrier: 'canvasPlaque', heartFigure: 'brushHeart',
    postFx: { kind: 'pixelate', width: 480, height: 270 },
    ui: 'pixel',
  },
  ui: {
    bg: INK, text: R.crom[100], textDim: R.may[300],
    btnBg: R.crom[500], btnFg: INK, subBg: R.pho[500], subFg: R.crom[100],
    swatches: [INK, R.pho[500], R.pho[300], R.crom[500], R.bach[300], R.son[500], R.tim[300]],
  },
};
