// "Thép & Lửa" — docs/design/alt/STYLE_C_thep-lua.md. Hex chép nguyên từ style sheet; chỗ suy ra đánh dấu `// derived`.
import type { Ramp, Theme } from '../themeTypes';

const R = {
  coal: { 700: 0x050506, 500: 0x0e0f12, 300: 0x1e2026, 100: 0x3a3d47 },
  steel: { 700: 0x2c3038, 500: 0x5b6270, 300: 0x8e96a6, 100: 0xc3c9d4 },
  arc: { 700: 0x7fa0c8, 500: 0xcfe4ff, 300: 0xe4f0ff, 100: 0xf5faff },
  tungsten: { 700: 0xb88a4a, 500: 0xffd9a0, 300: 0xffe8c4, 100: 0xfff6e6 },
  blood: { 700: 0x3d070d, 500: 0x8a0f1c, 300: 0xc21a26, 100: 0xe8222e },
  ember: { 700: 0x5c1e06, 500: 0xc2410c, 300: 0xe8622a, 100: 0xff9466 },
  flame: { 700: 0x9a4a08, 500: 0xff7a1a, 300: 0xffa047, 100: 0xffc98a },
  whitehot: { 700: 0xc48a12, 500: 0xffd23f, 300: 0xffe98a, 100: 0xfff8d6 },
  paper: { 700: 0xa8a8a4, 500: 0xf2f0ea, 300: 0xfaf9f5, 100: 0xffffff },
} satisfies Record<string, Ramp>;

export const steel: Theme = {
  id: 'steel',
  strings: {
    name: 'Thép & Lửa',
    tagline: 'Rock arena đẽo mặt phẳng: giàn thép, đèn rọi, khói và lửa.',
    hypeNames: ['Thép nguội', 'Tungsten', 'Lửa lớn'],
    cheers: ['HÁT NỮA ĐI!', 'ROCK TỚI SÁNG', 'ĐỐT CHÁY ĐÊM NAY', 'TO NỮA LÊN!', 'THÉP & LỬA', 'ENCORE!'],
    secretBanner: 'CÓ BIẾN TRÊN TRỜI!',
  },
  ramps: R,
  singles: { denim: 0x3b4a66 /* derived: "denim thép" */ },
  // Gán vào 8 ô token: night←than · berry←lửa (chủ đạo nóng, nút chính) · honey←trắng nung · peach←than hồng
  // · grape←thép · soda←hồ quang · mint←tungsten · cream←giấy. `blood` chỉ có ở ramps (Hype ≥ 80 %, áo merch).
  pal: { night: R.coal, berry: R.flame, honey: R.whitehot, peach: R.ember, grape: R.steel, soda: R.arc, mint: R.tungsten, cream: R.paper },
  // Không viền: ô "mực" dùng coal-700 (chi tiết mặt / chữ); viền vật trên trời = steel-700 (gần như lẫn vào trời).
  ink: R.coal[700], inkSky: R.steel[700],
  secretCore: R.whitehot[100], secretRim: R.flame[500],
  skin: [0xe2c4a8, 0xcfab8e /* derived */, 0xbc9274, 0x9b7256 /* derived */, 0x7a5238],
  // tóc đen, nâu, bạc, đỏ huyết — không tóc kẹo (ô 5–7 lặp lại các màu thật). — derived ngoài #C9C3B8
  hair: [0x0e0f12, 0x2a1c14, 0x4a3122, 0x6b4a30, 0xc9c3b8, R.blood[300], 0x1e2026, 0x8e96a6],
  cloth: [R.coal[300], R.steel[500], 0x3b4a66, R.blood[500], R.coal[100]], // 3 sắc tối + denim + merch huyết
  motif: { star: R.steel[100], heart: R.whitehot[500], bow: R.flame[500] }, // sao đinh tán · tia sét · ngọn lửa
  zoneSat: { arena: 1.0, stands: 0.7, outside: 0.6, balloon: 0.8 }, // derived
  zoneHueShiftDeg: { arena: 0, stands: 0, outside: 6, balloon: 0 },
  zoneHueTarget: 215, // lạnh (hồ quang)
  // "bóng dịch lạnh, sáng dịch ấm", giới hạn ±8°; Lambert phẳng 1 bậc/mặt (chênh L ≥ 6 %).
  shadow: { model: 'tint', shadow: 0.6, hueTarget: 215, hueShiftDeg: 8, minSat: 0.08, tint: 0.18, tintHueOffset: 0, floorLift: 0.03, glBias: [0.94, 0.99, 1.07] },
  hype: {
    cool: { name: 'Thép nguội', lightFraction: 0.15, primary: 0x7fa0c8, secondary: 0x8e96a6, accent: 0xcfe4ff },
    warm: { name: 'Tungsten', lightFraction: 0.55, primary: 0xffd9a0, secondary: 0xff7a1a, accent: 0xcfe4ff },
    vivid: { name: 'Lửa lớn', lightFraction: 1.0, primary: 0xff7a1a, secondary: 0xe8222e, accent: 0xffe98a },
  },
  sky: { zenith: R.coal[700], mid: R.coal[500], horizon: R.coal[300], haze: R.steel[700], glow: R.ember[700], fog: 0x08080a /* derived */ },
  form: {
    headsMesh: 7.5, headsBillboard: 6.5, charH: 1.8,
    bevelMin: 0, minDetail: 0.04, vehicleMaxAspect: 4,
    outlineRule: 'none',
    outline: { width: 0, secret: 0, minPx: 0, maxPx: 0, cullPx: 24 },
    shading: 'facet',
    toy: { softChar: [0, 0.02], softProp: [0, 0.02], rim: 0.6, rimHigh: 0.6, hi: 0.2, hiHigh: 0.15, hiArea: 0.04 },
    emissive: { arch: 0.05, trim: 1.0, stick: 1.0, secret: 2.0, outline: 0 },
    // Có trọng lượng: gật đầu 4–6°, đỉnh 60 ms, hồi 240 ms; không squash mềm.
    squash: {
      beat: { down: [0.985, 1.01], up: [1.01, 0.99] },
      jump: { crouch: [0.95, 1.03], stretch: [1.04, 0.97], land: [0.94, 1.04] },
      phase: 0.06, jumpHype: 0.7, headLagMs: [40, 60], headSwayDeg: 5, vehicleStretch: 1.0,
    },
    pop: { peak: 1.0, sec: 0.12, peakAt: 0.06 }, // "sập đèn → bật"
    glare: { lyricsAdditiveMax: 0.25, flashPerSecMax: 3 },
  },
  features: {
    skyFeature: 'searchlights',
    secretSet: { ufo: 'mirrorBall', rocket: 'steelRocket', dragon: 'mechDragon', jet: 'lightningJets', plane: 'twinHelis' },
    crowdVariant: 'facetFists', standCrowdVariant: 'tungstenDots', rigVariant: 'facetRocker', stageVariant: 'truss',
    bannerCarrier: 'blimp', heartFigure: 'lightning',
    postFx: { kind: 'none' },
    ui: 'steel',
  },
  ui: {
    bg: R.coal[500], text: R.paper[500], textDim: R.steel[100],
    btnBg: R.flame[500], btnFg: R.coal[700], subBg: R.coal[300], subFg: R.paper[500],
    swatches: [R.coal[500], R.steel[500], R.arc[500], R.tungsten[500], R.blood[300], R.flame[500], R.whitehot[500]],
  },
};
