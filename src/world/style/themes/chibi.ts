// "Kẹo đêm · chibi" — phong cách mặc định (docs/design/STYLE_GUIDE.md). Giá trị ở đây PHẢI giữ nguyên:
// theme.test.ts so với ảnh chụp token trước khi có hệ phong cách.
import type { Ramp, Theme } from '../themeTypes';

const R = {
  night: { 700: 0x0a0818, 500: 0x14102b, 300: 0x2a2350, 100: 0x4a3f82 },
  berry: { 700: 0xb8326e, 500: 0xff5fa8, 300: 0xff94c4, 100: 0xffd0e4 },
  grape: { 700: 0x5238b8, 500: 0x8b6bff, 300: 0xb5a0ff, 100: 0xddd4ff },
  soda: { 700: 0x1c8fc0, 500: 0x45d9ff, 300: 0x8fe9ff, 100: 0xd2f7ff },
  mint: { 700: 0x1e9c84, 500: 0x4fe3c1, 300: 0x96f0da, 100: 0xd6faf1 },
  honey: { 700: 0xc48a12, 500: 0xffd45a, 300: 0xffe596, 100: 0xfff5d1 },
  peach: { 700: 0xc25a2e, 500: 0xff9a6b, 300: 0xffbe9e, 100: 0xffe2d4 },
  cream: { 700: 0xc9b8a6, 500: 0xfff4e6, 300: 0xfffaf3, 100: 0xffffff },
} satisfies Record<string, Ramp>;

export const chibi: Theme = {
  id: 'chibi',
  strings: {
    name: 'Kẹo đêm · chibi',
    tagline: 'Đồ chơi bo tròn, viền mực tím, cực quang kẹo ngọt.',
    hypeNames: ['Đêm dịu', 'Ấm dần', 'Rực rỡ'],
    cheers: ['MÃI YÊU ♥', 'HÁT NỮA ĐI!', 'ENCORE!', 'CHÁY HẾT MÌNH', 'WE LOVE YOU', 'NGÔI SAO ĐÊM NAY'],
    secretBanner: 'Sự kiện bí mật!',
  },
  ramps: R,
  singles: { ink: 0x2b1d5c },
  pal: R,
  ink: 0x2b1d5c, inkSky: R.night[100],
  secretCore: R.honey[300], secretRim: R.mint[500],
  skin: [0xffe0c7, 0xf7cba4, 0xe0a57c, 0xb87a55, 0x8a5a3c],
  hair: [0x2a1f3d, 0x4a2f24, 0x6b4226, 0xc99a5b, 0xf6e0a8, 0xff94c4, 0x8fe9ff, 0xb5a0ff],
  cloth: [R.berry[500], R.grape[500], R.soda[500], R.mint[500], R.cream[500]],
  motif: { star: R.honey[500], heart: R.berry[500], bow: R.soda[500] },
  zoneSat: { arena: 1.0, stands: 0.75, outside: 0.6, balloon: 0.8 },
  zoneHueShiftDeg: { arena: 0, stands: 0, outside: 8, balloon: 0 },
  zoneHueTarget: 255,
  shadow: { model: 'tint', shadow: 0.72, hueTarget: 255, hueShiftDeg: 10, minSat: 0.25, tint: 0.3, tintHueOffset: -15, floorLift: 0.06 },
  hype: {
    cool: { name: 'Đêm dịu', lightFraction: 0.25, primary: R.grape[500], secondary: R.soda[700], accent: R.soda[300] },
    warm: { name: 'Ấm dần', lightFraction: 0.6, primary: R.berry[500], secondary: R.soda[500], accent: R.grape[500] },
    vivid: { name: 'Rực rỡ', lightFraction: 1.0, primary: R.berry[500], secondary: R.honey[500], accent: R.peach[500] },
  },
  sky: { zenith: R.night[700], mid: R.night[500], horizon: R.night[300], haze: R.grape[700], glow: R.peach[700], fog: 0x0b0a1c },
  form: {
    headsMesh: 2.3, headsBillboard: 2.1, charH: 1.5,
    bevelMin: 0.12, minDetail: 0.06, vehicleMaxAspect: 2.2,
    outlineRule: 'ink',
    outline: { width: 0.025, secret: 0.035, minPx: 1.5, maxPx: 3, cullPx: 24 },
    shading: 'toy2',
    toy: { softChar: [0.12, 0.18], softProp: [0.08, 0.12], rim: 0.35, rimHigh: 0.5, hi: 0.4, hiHigh: 0.3, hiArea: 0.08 },
    emissive: { arch: 0.15, trim: 0.6, stick: 1.0, secret: 1.6, outline: 0 },
    squash: {
      beat: { down: [0.94, 1.03], up: [1.05, 0.975] },
      jump: { crouch: [0.85, 1.08], stretch: [1.12, 0.94], land: [0.82, 1.1] },
      phase: 0.12, jumpHype: 0.6, headLagMs: [60, 80], headSwayDeg: 8, vehicleStretch: 1.1,
    },
    pop: { peak: 1.15, sec: 0.25, peakAt: 0.15 },
    glare: { lyricsAdditiveMax: 0.35, flashPerSecMax: 3 },
  },
  features: {
    skyFeature: 'aurora',
    secretSet: { ufo: 'default', rocket: 'default', dragon: 'default', jet: 'default', plane: 'default' },
    crowdVariant: 'default', standCrowdVariant: 'default', rigVariant: 'default', stageVariant: 'default',
    bannerCarrier: 'default', heartFigure: 'heart',
    postFx: { kind: 'none' },
    ui: 'chibi',
  },
  ui: {
    bg: R.night[500], text: R.cream[500], textDim: R.grape[100],
    btnBg: R.berry[500], btnFg: R.night[700], subBg: R.night[300], subFg: R.cream[500],
    swatches: [R.night[500], R.berry[500], R.grape[500], R.soda[500], R.mint[500], R.honey[500]],
  },
};
