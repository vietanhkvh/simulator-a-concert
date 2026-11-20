// "Mực & Sơn mài · bản Việt" — docs/design/alt/STYLE_B2_muc-son-mai-viet.md (+ STYLE_B_muc-son-mai.md mục 4, 6).
// Hex chép nguyên từ style sheet; chỗ sheet không cho thì suy ra và đánh dấu `// derived`.
import type { Ramp, Theme } from '../themeTypes';

const R = {
  lacquer: { 700: 0x0b0606, 500: 0x1a0e0c, 300: 0x33201b, 100: 0x5c3d32 }, // sơn then
  son: { 700: 0x8e1b12, 500: 0xd9381e, 300: 0xf26b4a, 100: 0xffc2ae }, // đỏ son
  gold: { 700: 0x8f6a1a, 500: 0xd9a93a, 300: 0xf0ce78, 100: 0xfbebc0 }, // vàng quỳ
  jade: { 700: 0x145c4e, 500: 0x2fa58a, 300: 0x7bcdb6, 100: 0xcdefe4 }, // ngọc bích
  indigo: { 700: 0x14213f, 500: 0x2b4a8c, 300: 0x6c8ccb, 100: 0xc3d2ee }, // chàm
  amber: { 700: 0xa1500f, 500: 0xf0892b, 300: 0xfab56a, 100: 0xffe0b8 }, // cam đèn lồng
  pearl: { 700: 0x7c8794, 500: 0xbfc9d2, 300: 0xdde4ea, 100: 0xf4f7fa }, // bạc quỳ · xà cừ
  silk: { 700: 0xb5a68a, 500: 0xf3e9d2, 300: 0xfaf4e4, 100: 0xfffcf3 }, // vỏ trứng
} satisfies Record<string, Ramp>;

export const lacquer: Theme = {
  id: 'lacquer',
  strings: {
    name: 'Mực & Sơn mài · bản Việt',
    tagline: 'Đêm hội Thăng Long: sơn then, vàng quỳ, đỏ son, đèn trời.',
    hypeNames: ['Trăng mờ', 'Hội đèn', 'Vàng son'],
    cheers: ['HÁT NỮA ĐI!', 'THĂNG LONG', 'ĐÊM HỘI ĐÈN', 'VÀNG SON RỰC RỠ', 'MÃI YÊU', 'RỒNG BAY LÊN'],
    secretBanner: 'Điềm lành xuất hiện!',
  },
  ramps: R,
  singles: {},
  // Gán vào 8 ô token: night←sơn then · berry←đỏ son · honey←vàng quỳ · mint←ngọc bích · grape←chàm
  // · peach←cam đèn lồng · cream←vỏ trứng · soda←bạc quỳ/xà cừ.
  pal: { night: R.lacquer, berry: R.son, honey: R.gold, mint: R.jade, grape: R.indigo, peach: R.amber, cream: R.silk, soda: R.pearl },
  // Không viền đen: bóng dáng bằng mực sáng (silk-500) trên trời, mép vật bằng "khảm vàng" gold-700.
  ink: R.gold[700], inkSky: R.silk[500],
  secretCore: R.gold[100], secretRim: R.jade[300],
  skin: [0xf6dcc0, 0xeec9a2, 0xdcae82, 0xc08e62, 0x9a6c46], // derived: da phẳng 2 bậc, ấm hơn chibi (sheet không cho hex)
  // tóc đen/nâu là chính; ba ô "kẹo" của chibi thay bằng khăn vấn vàng / chàm / ngọc. — derived từ ramp
  hair: [0x0b0606, 0x1a0e0c, 0x33201b, 0x5c3d32, 0xb5a68a, R.gold[500], R.indigo[500], R.jade[500]],
  cloth: [R.son[500], R.indigo[500], R.jade[500], R.gold[500], R.silk[500]], // cờ ngũ sắc
  motif: { star: R.gold[500], heart: R.son[500], bow: R.jade[500] }, // mặt trời trống đồng · hoa sen · mây cuộn
  zoneSat: { arena: 1.0, stands: 0.8, outside: 0.7, balloon: 0.9 }, // derived: sheet không tách; giữ ấm hơn chibi ở xa
  zoneHueShiftDeg: { arena: 0, stands: 0, outside: 6, balloon: 0 },
  zoneHueTarget: 221, // chàm
  // "bóng ×0,62 dịch 25° về chàm", 2 bậc phẳng, không phủ lavender.
  shadow: { model: 'tint', shadow: 0.62, hueTarget: 221, hueShiftDeg: 25, minSat: 0.2, tint: 0.12, tintHueOffset: 0, floorLift: 0.04, glBias: [0.93, 0.96, 1.11] },
  hype: {
    cool: { name: 'Trăng mờ', lightFraction: 0.2, primary: 0x2b4a8c, secondary: 0x145c4e, accent: 0xbfc9d2 },
    warm: { name: 'Hội đèn', lightFraction: 0.6, primary: 0xd9381e, secondary: 0xd9a93a, accent: 0xf0892b },
    vivid: { name: 'Vàng son', lightFraction: 1.0, primary: 0xf0ce78, secondary: 0xf26b4a, accent: 0x7bcdb6 },
  },
  // Trời chàm (sheet: "Chàm — trời, núi đá vôi"); zenith tối hơn indigo-700. fog = sơn then pha chàm.
  sky: { zenith: 0x0a1226 /* derived */, mid: R.indigo[700], horizon: 0x1e3566 /* derived: giữa indigo-700 và 500 */, haze: R.indigo[500], glow: R.amber[700], fog: 0x0d0a12 /* derived */ },
  form: {
    headsMesh: 7.5, headsBillboard: 7, charH: 1.72,
    bevelMin: 0.06, minDetail: 0.045, vehicleMaxAspect: 3,
    outlineRule: 'goldInlay',
    outline: { width: 0.015, secret: 0.02, minPx: 1, maxPx: 2.5, cullPx: 24 },
    shading: 'brush',
    toy: { softChar: [0.02, 0.04], softProp: [0.02, 0.04], rim: 0.2, rimHigh: 0.3, hi: 0.25, hiHigh: 0.2, hiArea: 0.06 },
    emissive: { arch: 0.1, trim: 0.5, stick: 1.0, secret: 1.5, outline: 0 },
    // Không squash; chuyển động chậm 0,6–1,2 s, tà áo trễ 150–250 ms.
    squash: {
      beat: { down: [0.99, 1.005], up: [1.01, 0.995] },
      jump: { crouch: [0.97, 1.02], stretch: [1.03, 0.98], land: [0.97, 1.02] },
      phase: 0.3, jumpHype: 0.8, headLagMs: [150, 250], headSwayDeg: 15, vehicleStretch: 1.0,
    },
    pop: { peak: 1.0, sec: 0.5, peakAt: 0.3 }, // "nét cọ vẽ ra" 0,5 s, không nảy
    glare: { lyricsAdditiveMax: 0.35, flashPerSecMax: 0 },
  },
  features: {
    skyFeature: 'lanterns',
    secretSet: { ufo: 'moonLantern', rocket: 'bambooFireworks', dragon: 'lyDragons', jet: 'cranesS', plane: 'fluteKite' },
    crowdVariant: 'brushLantern', standCrowdVariant: 'lanternDots', rigVariant: 'aoDai', stageVariant: 'dinh',
    bannerCarrier: 'hoiAnLantern', heartFigure: 'vietnamS',
    postFx: { kind: 'none' },
    ui: 'lacquer',
  },
  ui: {
    bg: R.lacquer[500], text: R.silk[500], textDim: R.gold[300],
    btnBg: R.gold[500], btnFg: R.lacquer[700], subBg: R.lacquer[300], subFg: R.silk[500],
    swatches: [R.lacquer[500], R.son[500], R.gold[500], R.jade[500], R.indigo[500], R.amber[500], R.silk[500]],
  },
};
