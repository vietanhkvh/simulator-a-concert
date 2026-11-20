// Đoạn GLSL dùng chung cho đèn / hiệu ứng additive: giới hạn chói ở vùng cửa sổ lời (đáy giữa màn hình)
// và đổi màu tuyến tính → sRGB (shader thô không qua colorspace_fragment).
import { GLARE } from '../../world/style';

/** Vertex: khai báo + gán vClip (gọi `GLARE_VERT_MAIN` sau khi đã có gl_Position). */
export const GLARE_VERT_PARS = /* glsl */ `varying vec4 vClip;`;
export const GLARE_VERT_MAIN = /* glsl */ `vClip = gl_Position;`;
/**
 * Fragment: `lyricDim()` trả hệ số ≤ 1. Cửa sổ lời ≈ NDC x ∈ [-0,55; 0,55], y ∈ [-1; -0,5];
 * mỗi lớp additive bị nén về ≈ GLARE.lyricsAdditiveMax / 2 ở đó (nhiều lớp chồng vẫn ≤ 0,35).
 */
export const GLARE_FRAG_PARS = /* glsl */ `
varying vec4 vClip;
float lyricDim() {
  vec2 n = vClip.xy / max(vClip.w, 1e-4);
  float m = smoothstep(0.7, 0.45, abs(n.x)) * smoothstep(-0.38, -0.6, n.y);
  return mix(1.0, ${(GLARE.lyricsAdditiveMax * 0.5).toFixed(3)} / 0.6, m);
}
vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(0.4545)); }
`;
