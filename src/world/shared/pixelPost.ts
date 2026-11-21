// Hậu kỳ phong cách pixel: lượng tử hoá về 31 màu của STYLE_E (tìm màu gần nhất trong shader) + ordered dither Bayer 4×4.
// Dither tính theo toạ độ TEXEL của đích thấp (floor(gl_FragCoord / scale)) nên mẫu dither dính vào lưới màn hình,
// không trôi theo camera. Camera không bị đổi (không snap) — mọi phong cách khác không đi qua file này.
import { pixel } from '../style/themes/pixel';

/** Bảng 31 màu, sRGB 0..1 (chép từ pixel.ts: 7 ramp × 4 bậc + ink, ngọc, sen). */
export function pixelPalette(): [number, number, number][] {
  const hex: number[] = [];
  for (const r of Object.values(pixel.ramps)) hex.push(r[700], r[500], r[300], r[100]);
  hex.push(pixel.singles.ink, pixel.singles.ngoc, pixel.singles.sen);
  return hex.map((h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]);
}

/** Màu gần nhất (bình phương khoảng cách sRGB) — bản CPU của vòng lặp trong shader. */
export function nearestPaletteIndex(rgb: readonly [number, number, number], pal = pixelPalette()): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const dr = rgb[0] - pal[i][0], dg = rgb[1] - pal[i][1], db = rgb[2] - pal[i][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export const PIXEL_DITHER = 0.07; // biên độ dither (sRGB), cỡ nửa bước giữa hai bậc ramp gần nhau

export function pixelPostFrag(n: number): string {
  return /* glsl */ `
uniform sampler2D tMap; uniform vec2 uSize; uniform float uScale; uniform vec3 uPal[${n}]; uniform float uDither;
float bayer4(vec2 p){
  vec2 q = mod(p, 4.0);
  float x = q.x, y = q.y;
  // ma trận Bayer 4×4 không bảng: đảo bit xen kẽ của x và x^y
  float a = mod(x, 2.0), b = mod(x + y, 2.0);
  float c = floor(x / 2.0), d = mod(floor(x / 2.0) + floor(y / 2.0), 2.0);
  return (b * 8.0 + a * 4.0 + d * 2.0 + c) / 16.0;
}
void main(){
  vec2 t = floor(gl_FragCoord.xy / uScale);
  vec3 c = texture2D(tMap, (t + 0.5) / uSize).rgb;
  c += (bayer4(t) - 0.46875) * uDither;
  vec3 best = uPal[0]; float bd = 1e9;
  for (int i = 0; i < ${n}; i++) { vec3 d = c - uPal[i]; float s = dot(d, d); if (s < bd) { bd = s; best = uPal[i]; } }
  gl_FragColor = vec4(best, 1.0);
}`;
}
