// "Đêm Sao Điểm Ảnh" · phụ trợ chung cho khe `sky` (skyDome.ts) và `skyFeature` (skyWind.ts) — KHÔNG đăng ký builder.
// Trường dòng ψ của trời "Đêm đầy sao" (dải ngang lượn + 2 xoáy + 11 "núi" quanh sao + trăng) và của trời "Tiếng thét" (dải gợn
// ngang), vệt cọ theo trường dòng, Bayer 4×4, bóng cây bách + đồi + làng có tháp chuông. Mọi hằng hướng tính bằng JS lúc gọi hàm.
// Quy ước góc trong shader: az = atan(d.x, −d.z) (0 = nhìn từ ca sĩ ra khán đài −Z, + = phải) · el = độ cao (rad).
// Bản đồ vệt cọ dùng a = atan(d.z, −d.x) (đường nối nằm ở hướng +X, ngoài mọi góc máy chính) và p = (a·cos el, el).
import * as THREE from 'three';
import { hexToRgb } from '../../../../world/style';

const dir = (az: number, el: number) =>
  new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();

/** 11 sao có quầng: [az, el, bán kính lõi (rad)]. 7 phía trước (góc ca sĩ), 4 phía sau (B-stage / góc toàn cảnh). */
export const PIXEL_STARS: readonly [number, number, number][] = [
  [-0.78, 0.46, 0.019], [-0.42, 0.86, 0.022], [-0.05, 0.98, 0.016], [0.3, 0.86, 0.019], [-0.56, 0.31, 0.015],
  [0.2, 0.33, 0.017], [0.86, 0.42, 0.02],
  [2.55, 0.3, 0.02], [2.95, 0.55, 0.022], [-2.85, 0.36, 0.018], [-2.45, 0.62, 0.02],
];
/** Trăng khuyết: phải-trên phía trước. */
export const PIXEL_MOON = { az: 0.6, el: 0.66, r: 0.055 } as const;
export const PIXEL_MOON_DIR = dir(PIXEL_MOON.az, PIXEL_MOON.el);
/** Hai xoáy đan nhau giữa trời phía trước: [az, el, bán kính, chiều quay]. */
const SWIRLS: readonly [number, number, number, number][] = [[-0.2, 0.6, 0.2, 1], [0.24, 0.5, 0.15, -1]];
/** Cây bách: [az, đỉnh el, nửa bề rộng gốc]. Cây lớn trái-trước, cây nhỏ sau sân khấu. */
const CYPRESS: readonly [number, number, number][] = [[-0.64, 0.88, 0.072], [Math.PI - 0.52, 0.5, 0.042]];
/** Tháp chuông làng: az. */
const STEEPLES = [0.34, -Math.PI + 0.4];

const f = (x: number) => x.toFixed(5);
const v3 = (v: THREE.Vector3) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
export const glc = (hex: number) => `vec3(${hexToRgb(hex).map(f).join(', ')})`;

/** Khai báo uniform + hàm GLSL dùng chung. Đọc token khi gọi (không chép lúc import). */
export function pixelFieldGlsl(): string {
  const stars = PIXEL_STARS.map(([az, el]) => v3(dir(az, el))).join(', ');
  const radii = PIXEL_STARS.map(([, , r]) => f(r)).join(', ');
  const up = new THREE.Vector3(0, 1, 0);
  const sw = SWIRLS.map(([az, el, r, s]) => {
    const c = dir(az, el);
    const u = new THREE.Vector3().crossVectors(up, c).normalize();
    const v = new THREE.Vector3().crossVectors(c, u).normalize();
    return { c, u, v, r, s };
  });
  const M = PIXEL_MOON_DIR;
  const mR = new THREE.Vector3().crossVectors(up, M).normalize().multiplyScalar(-1); // phải trên màn
  const mU = new THREE.Vector3().crossVectors(mR, M).normalize(); // lên trên màn
  // đĩa che tạo trăng khuyết: lệch sang trái-trên → vành sáng nằm bên phải
  const shadowC = M.clone().addScaledVector(mR, -0.5 * PIXEL_MOON.r).addScaledVector(mU, 0.22 * PIXEL_MOON.r);
  return /* glsl */ `
#define PI 3.14159265
#define TAU 6.28318531
uniform float uTime; uniform float uSwirl; uniform float uPixScream; uniform float uPixWind; uniform float uPulse;
const vec3 ST[11] = vec3[11](${stars});
const float SR[11] = float[11](${radii});
const vec3 SWC[2] = vec3[2](${v3(sw[0]!.c)}, ${v3(sw[1]!.c)});
const vec3 SWU[2] = vec3[2](${v3(sw[0]!.u)}, ${v3(sw[1]!.u)});
const vec3 SWV[2] = vec3[2](${v3(sw[0]!.v)}, ${v3(sw[1]!.v)});
const float SWR[2] = float[2](${f(sw[0]!.r)}, ${f(sw[1]!.r)});
const float SWS[2] = float[2](${f(sw[0]!.s)}, ${f(sw[1]!.s)});
const vec3 MOON = ${v3(M)}; const vec3 MOON_SH = ${v3(shadowC)}; const float MOON_R = ${f(PIXEL_MOON.r)};

float h11(float p) { return fract(sin(p * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wrapA(float x) { return mod(x + PI, TAU) - PI; }
vec3 dirOf(float a, float el) { float c = cos(el); return vec3(-c * cos(a), sin(el), c * sin(a)); }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
/** true = điểm ảnh này đã sang trời "Tiếng thét" (hoà tan theo Bayer, không trộn màu). */
bool screamPx() { return uPixScream > bayer4(gl_FragCoord.xy) + 0.001; }

// ψ "Đêm đầy sao": trả ψ liền mạch (hướng vệt cọ); cv = giá trị màu (có thêm nhánh xoắn ốc); sw = trọng số xoáy.
float psiS(float a, float el, out float cv, out float sw) {
  vec3 d = dirOf(a, el);
  float psi = el * 7.0 + 0.45 * sin(3.0 * a + 2.5 * el + uTime * 0.12) + 0.25 * sin(5.0 * a - 3.0 * el - uTime * 0.17)
    + 0.12 * sin(9.0 * a + uTime * 0.3);
  cv = psi; sw = 0.0;
  for (int i = 0; i < 2; i++) {
    vec3 q = d - SWC[i];
    float r = length(q) / SWR[i];
    float w = 1.0 - smoothstep(0.35, 1.25, r);
    float th = atan(dot(q, SWV[i]), dot(q, SWU[i]));
    float ps = r * 3.2 + float(i) * 0.37;
    psi = mix(psi, ps, w);
    cv = mix(cv, ps + 0.42 * sin(th * SWS[i] - r * 7.0 + uSwirl * SWS[i]), w);
    sw = max(sw, w);
  }
  float wind = 1.0 + 0.5 * uPixWind;
  for (int i = 0; i < 11; i++) {
    float r = length(d - ST[i]) / (SR[i] * wind);
    float w = 1.0 - smoothstep(2.2, 4.6, r);
    psi = mix(psi, r * 0.5, w); cv = mix(cv, r * 0.5 + 0.25, w);
  }
  float rm = length(d - MOON) / MOON_R;
  float wm = 1.0 - smoothstep(1.6, 3.6, rm);
  psi = mix(psi, rm * 0.6, wm); cv = mix(cv, rm * 0.6, wm);
  return psi;
}
float psiS0(float a, float el) { float c, s; return psiS(a, el, c, s); }
// ψ "Tiếng thét": dải gợn ngang.
float psiR(float a, float el) {
  return el * 4.6 + 0.45 * sin(2.0 * a + 1.5 * el + uTime * 0.4) + 0.18 * sin(5.0 * a + 4.0 * el - uTime * 0.7)
    + 0.06 * sin(11.0 * a - uTime * 0.5);
}
/** Tiếp tuyến dòng trong toạ độ p (= a·k, el). mode 0 = đêm sao, 1 = tiếng thét. */
vec2 flowT(float a, float el, float k, float mode) {
  const float e = 0.004;
  vec2 g;
  if (mode < 0.5) { float p0 = psiS0(a, el); g = vec2(psiS0(a + e / k, el) - p0, psiS0(a, el + e) - p0); }
  else { float p0 = psiR(a, el); g = vec2(psiR(a + e / k, el) - p0, psiR(a, el + e) - p0); }
  vec2 t = vec2(-g.y, g.x);
  float l = length(t);
  return l > 1e-7 ? t / l : vec2(1.0, 0.0);
}
/**
 * Vệt cọ: lưới ô cỡ cs trong p; mỗi ô một vệt dài 2·hl (3–7 px), rộng 2·hw, hướng theo T. Trả hash màu của vệt (≥ 0)
 * hoặc −1 nếu không trúng vệt nào. keep(hash) < density mới vẽ. life: số đổi mỗi chu kỳ để vệt mọc/tắt (0 = tĩnh).
 */
float strokeAt(vec2 p, vec2 T, float cs, float hw, float lenK, float seed, float density, float life) {
  vec2 N = vec2(-T.y, T.x);
  vec2 c0 = floor(p / cs);
  float best = -1.0, bestPri = -1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cid = c0 + vec2(float(i), float(j));
    float keep = fract(h21(cid + seed) + life * h21(cid + seed + 2.3));
    if (keep > density) continue;
    vec2 c = (cid + 0.5 + (vec2(h21(cid + seed + 3.1), h21(cid + seed + 7.7)) - 0.5) * 0.8) * cs;
    vec2 q = p - c;
    float hl = cs * lenK * (0.55 + 0.45 * h21(cid + seed + 11.3));
    if (abs(dot(q, T)) < hl && abs(dot(q, N)) < hw) {
      float pri = h21(cid + seed + 5.9);
      if (pri > bestPri) { bestPri = pri; best = h21(cid + seed + 13.7); }
    }
  }
  return best;
}
/** Khoảng cách tới quầng sao gần nhất, chuẩn hoá theo bán kính lõi (×nhịp đập / ×gió). */
float starDist(vec3 d, float scale) {
  float m = 99.0;
  for (int i = 0; i < 11; i++) m = min(m, length(d - ST[i]) / (SR[i] * scale));
  return m;
}
/** Độ cao đường đồi theo az: phía trước nhô trên mép khán đài xa, phía sau sân khấu thấp (khung trời mở). */
float hillH(float az) {
  float aaz = abs(az);
  return mix(0.055, 0.284, smoothstep(2.3, 1.5, aaz)) + 0.016 * sin(az * 5.0 + 1.0) + 0.007 * sin(az * 13.0);
}
float cypressSd(float az, float el, float ca, float top, float W, out float u, out float xx) {
  float x = wrapA(az - ca) * cos(el);
  float base = -0.06;
  u = clamp((el - base) / (top - base), 0.0, 1.0);
  float xc = 0.012 * sin(u * 6.0 + 0.6) * u;
  xx = x - xc;
  float side = step(0.0, xx);
  float hw = W * pow(1.0 - u, 0.8) * (0.8 + 0.2 * sin(u * 44.0 + side * 2.1)) + 0.0025;
  return max(abs(xx) - hw, max(el - top, base - el));
}
/** Bóng cây bách gần nhất: sd < 0 là bên trong. */
float cypressAll(float az, float el, out float u, out float xx) {
  float u1, x1;
  float s0 = cypressSd(az, el, ${f(CYPRESS[0]![0])}, ${f(CYPRESS[0]![1])}, ${f(CYPRESS[0]![2])}, u, xx);
  float s1 = cypressSd(az, el, ${f(CYPRESS[1]![0])}, ${f(CYPRESS[1]![1])}, ${f(CYPRESS[1]![2])}, u1, x1);
  if (s1 < s0) { u = u1; xx = x1; return s1; }
  return s0;
}
/** Bóng làng (nhà + tháp chuông), không gồm đồi. kind: 1 nhà (win = 1 nếu điểm cửa sổ), 2 tháp. */
float villageSd(float az, float el, float H, float pxA, out float kind, out float win) {
  kind = 0.0; win = 0.0;
  float sd = 1.0;
  bool zone = (az > -0.45 && az < 1.25) || abs(az) > 2.35;
  const float cw = 0.03;
  float ci = floor(az / cw);
  float hx = (fract(az / cw) - 0.5) * cw;
  if (zone && h11(ci * 1.7 + 0.3) > 0.28) {
    float x = hx - (h11(ci * 4.1) - 0.5) * 0.008;
    float hw = 0.007 + 0.005 * h11(ci * 2.3);
    float bh = 0.009 + 0.011 * h11(ci * 3.1);
    float body = max(abs(x) - hw, el - (H + bh));
    float roof = max(abs(x) - hw - 0.002, el - (H + bh + (hw + 0.002 - abs(x)) * 0.75));
    sd = min(body, roof);
    if (sd < 0.0) {
      kind = 1.0;
      if (h11(ci * 5.3) > 0.3 && abs(x) < pxA * 0.9 && abs(el - (H + bh * 0.45)) < pxA * 0.9) win = 1.0;
    }
  }
  for (int i = 0; i < 2; i++) {
    float sa = i == 0 ? ${f(STEEPLES[0]!)} : ${f(STEEPLES[1]!)};
    float x = wrapA(az - sa);
    float Hs = hillH(sa);
    float tower = max(abs(x) - 0.0055, el - (Hs + 0.075));
    float spire = max(abs(x) - 0.0068 * clamp((Hs + 0.15 - el) / 0.075, 0.0, 1.0), el - (Hs + 0.15));
    float s = min(tower, spire);
    if (s < sd) { sd = s; kind = 2.0; win = (abs(x) < pxA * 0.9 && abs(el - (Hs + 0.05)) < pxA * 0.9) ? 1.0 : 0.0; }
  }
  return sd;
}
`;
}
