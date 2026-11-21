// "Đêm Sao Điểm Ảnh" · khe `sky` (P1, STYLE_E §3, §5): trời "Đêm đầy sao" ĐỘNG vẽ trong MỘT vòm bám camera (1 draw call).
//  · nền = dải màu lam Phổ theo hàm dòng ψ (dải ngang lượn + 2 xoáy đan nhau, pha trôi ~0,2 vòng/s) phủ VỆT CỌ 3–7 px chạy theo
//    trường dòng, mỗi vệt một màu (lệch ±1 bậc ramp) — không gradient mượt;
//  · 11 sao có quầng vòng (lõi kem → vàng crôm → vòng lục nhạt / lam nhạt), lõi "thở" ±1 px theo phách, quầng nở ×1,5 theo gió;
//  · trăng khuyết cam trong quầng vàng (phải-trên); cây bách lục sẫm dạng ngọn lửa + đồi + làng có tháp chuông, cửa sổ vàng —
//    nằm trên mép khán đài xa (phía trước) và sau sân khấu (phía sau); viền mực 1 px;
//  · Hype ≥ 80 %: hoà tan Bayer 4×4 (1,6 s, không chớp) sang trời "Tiếng thét": dải gợn ngang son–cam, dưới là vịnh lam–lục;
//  · "sao băng" = nét cọ vàng crôm 4 bậc kéo chéo (pool 6, bắn ở mốc Hype 20/40/60/80 % như mặc định + mưa nhẹ ≥ 80 %).
// Uniform chia sẻ với skyWind.ts (khe skyFeature) qua ctx.uniforms: uPixScream (0..1, do file này điều khiển), uPixWind (gió).
import * as THREE from 'three';
import { SKY_RADIUS } from '../../../../world/layout';
import { drawSize } from '../../../../world/shared/viewport';
import { RAMPS, getTheme } from '../../../../world/style';
import type { OutsideBuildContext, OutsideBuilders, SkyHandle } from '../../builders';
import { glc, PIXEL_MOON_DIR, pixelFieldGlsl } from './skyField';

const COMETS = 6;
/** Hoà sang "Tiếng thét" khi Hype ≥ 80 %, về lại dưới 76 %; thời gian chuyển (≥ 1,2 s theo STYLE_E §8). */
const SCREAM_ON = 0.8, SCREAM_OFF = 0.76, SCREAM_SEC = 1.6;

export const PIXEL_SKY_VERT = /* glsl */ `varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`;

const frag = () => {
  const P = RAMPS.pho!, C = RAMPS.crom!, B = RAMPS.bach!, S = RAMPS.son!, D = RAMPS.dat!, T = RAMPS.tim!, M = RAMPS.may!;
  const INK = getTheme().ink;
  return /* glsl */ `
${pixelFieldGlsl()}
uniform vec4 uCom[${COMETS}];
varying vec3 vDir;

vec3 blue(int i) {
  if (i <= 0) return ${glc(P[700])};
  if (i == 1) return ${glc(P[500])};
  if (i == 2) return ${glc(P[300])};
  if (i == 3) return ${glc(P[100])};
  if (i == 4) return ${glc(M[300])};
  return ${glc(M[100])};
}
vec3 screamBand(int i) {
  if (i == 0) return ${glc(S[500])};
  if (i == 1) return ${glc(S[300])};
  if (i == 2) return ${glc(S[100])};
  if (i == 3) return ${glc(C[500])};
  return ${glc(S[300])};
}
vec3 bayCol(int i) {
  if (i <= 0) return ${glc(P[700])};
  if (i == 1) return ${glc(P[500])};
  if (i == 2) return ${glc(B[500])};
  return ${glc(P[300])};
}
int strokeOfs(float sh) { return sh < 0.0 ? 0 : (sh < 0.42 ? 1 : (sh < 0.84 ? -1 : 2)); }

vec3 starry(vec3 d, float a, float el, vec2 p, float k) {
  float cv, sw;
  psiS(a, el, cv, sw);
  vec2 T = flowT(a, el, k, 0.0);
  float sh = strokeAt(p, T, 0.026, 0.0042, 0.62, 0.0, 0.93, 0.0);
  int o = strokeOfs(sh);
  float lv = floor(fract(cv) * 3.0) + 1.0;          // pho-500 / pho-300 / pho-100
  lv += sw > 0.55 ? 1.0 : 0.0;                      // lòng xoáy sáng hơn (lam nhạt → kem)
  lv -= el > 0.98 ? 1.0 : 0.0;                      // đỉnh trời tối hơn
  vec3 col = blue(int(clamp(lv + float(o == 2 ? 1 : o), 0.0, 5.0)));

  // quầng sao: vòng ngoài theo gió (×1,5 ở 100 %), lõi thở theo phách (±1 px)
  float hw = starDist(d, 1.0 + 0.5 * uPixWind), hc = starDist(d, 1.0 + 0.16 * uPulse);
  if (hw < 3.3) col = o >= 1 ? ${glc(M[300])} : ${glc(P[100])};
  if (hw < 2.5) col = o == 1 ? ${glc(C[300])} : (o == -1 ? ${glc(B[100])} : (o == 2 ? ${glc(C[100])} : ${glc(M[100])}));
  if (hc < 1.7) col = o == 1 ? ${glc(C[300])} : ${glc(C[500])};
  if (hc < 1.0) col = ${glc(C[300])};
  if (hc < 0.5) col = ${glc(C[100])};

  // trăng khuyết cam trong quầng vàng
  float rm = length(d - MOON) / MOON_R;
  if (rm < 2.9) {
    if (rm < 2.9) col = o >= 1 ? ${glc(M[300])} : ${glc(P[100])};
    if (rm < 2.2) col = o == -1 ? ${glc(M[100])} : ${glc(C[100])};
    if (rm < 1.6) col = o == 1 ? ${glc(C[300])} : ${glc(C[500])};
    if (rm < 1.0) {
      float rs = length(d - MOON_SH) / MOON_R;
      col = rs > 0.95 ? (rm > 0.78 || rs < 1.12 ? ${glc(S[300])} : ${glc(S[100])}) : ${glc(C[500])};
    }
  }
  return col;
}

vec3 scream(float a, float el, vec2 p, float k) {
  float q0 = psiR(a, el);
  vec2 T = flowT(a, el, k, 1.0);
  float sh = strokeAt(p, T, 0.028, 0.0045, 0.7, 17.0, 0.75, 0.0);
  int o = min(strokeOfs(sh), 1);
  float hb = 0.19 + 0.03 * sin(3.0 * a + uTime * 0.2);
  if (el < hb) return bayCol(int(clamp(floor(fract(q0 * 1.6) * 3.0) + float(o == 2 ? 1 : o), 0.0, 3.0)));
  int i = int(mod(floor(fract(q0) * 5.0) + float(o) + 5.0, 5.0));
  vec3 col = screamBand(i);
  if (el > 1.05 && i == 0) col = ${glc(S[700])};
  return col;
}

vec3 land(vec3 col, float az, float el, float pxA, bool scr) {
  float H = hillH(az);
  float u, xx;
  float sc = cypressAll(az, el, u, xx);
  if (sc < 0.0) {
    if (sc > -pxA * 1.1) return ${glc(INK)};
    float st = fract(xx / 0.011 + u * 5.0 + sin(u * 23.0) * 0.4);
    return st < 0.32 ? ${glc(B[500])} : (st > 0.85 ? ${glc(B[300])} : ${glc(B[700])});
  }
  float kind, win;
  float sv = villageSd(az, el, H, pxA, kind, win);
  float sh = el - H;
  float sd = min(sv, sh);
  if (sd >= 0.0) return col;
  if (win > 0.5) return ${glc(C[500])};
  if (sd > -pxA * 1.05 && el > -0.02) return ${glc(INK)};
  if (sv < 0.0) return kind > 1.5 ? ${glc(T[500])} : (scr ? ${glc(D[700])} : ${glc(T[700])});
  float band = fract((H - el) * 38.0 + sin(az * 7.0) * 0.5 + 0.3 * sin(az * 23.0));
  if (scr) return band < 0.5 ? ${glc(D[700])} : ${glc(T[700])};
  return band < 0.5 ? ${glc(B[700])} : ${glc(P[700])};
}

void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  float a = atan(d.z, -d.x);
  float pxA = clamp(length(fwidth(d)), 0.001, 0.02);
  float k = cos(clamp(el, 0.0, 1.2));
  vec2 p = vec2(a * k, el);
  bool scr = screamPx();
  vec3 col = el < -0.05 ? ${glc(P[700])} : (scr ? scream(a, el, p, k) : starry(d, a, el, p, k));
  col = land(col, az, el, pxA, scr);

  // "sao băng" = nét cọ vàng crôm: đầu crôm-100 → đuôi crôm-700, 4 bậc cứng
  for (int i = 0; i < ${COMETS}; i++) {
    vec4 c = uCom[i];
    float age = uTime - c.z;
    if (age < 0.0 || age > 1.3) continue;
    vec2 q = vec2(wrapA(az - c.x) * cos(c.y), el - c.y);
    vec2 v = vec2(cos(c.w), -sin(c.w));
    vec2 head = v * age * 0.45;
    float L = min(age * 0.45, 0.22) * (1.0 - smoothstep(0.9, 1.3, age));
    vec2 r = head - q;
    float s = dot(r, v), x = abs(r.x * v.y - r.y * v.x);
    float w = 0.0085 - 0.0045 * clamp(s / max(L, 1e-4), 0.0, 1.0);
    if (s > -0.004 && s < L && x < w && el > hillH(az)) {
      float seg = floor(clamp(s / max(L, 1e-4), 0.0, 0.999) * 4.0);
      col = seg < 0.5 ? ${glc(C[100])} : (seg < 1.5 ? ${glc(C[300])} : (seg < 2.5 ? ${glc(C[500])} : ${glc(C[700])}));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;
};

export function createPixelSky(ctx: OutsideBuildContext): SkyHandle & { moonPosition: THREE.Vector3 } {
  const { scene, uniforms } = ctx;
  uniforms.uPx = { value: 500 };
  uniforms.uRes = { value: 1 };
  // dùng chung với khe skyFeature (skyWind.ts): tạo ở đây nếu chưa có
  const scr = (uniforms.uPixScream ??= { value: 0 }) as { value: number };
  const wind = (uniforms.uPixWind ??= { value: 0 }) as { value: number };
  const swirl = (uniforms.uSwirl ??= { value: 0 }) as { value: number };
  scr.value = 0; wind.value = 0; swirl.value = 0;
  let seed = 4111;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const com = Array.from({ length: COMETS }, () => new THREE.Vector4(0, 0, -100, 0));
  const geo = new THREE.SphereGeometry(SKY_RADIUS, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime!, uPulse: uniforms.uPulse!, uPixScream: scr, uPixWind: wind, uSwirl: swirl, uCom: { value: com },
    },
    vertexShader: PIXEL_SKY_VERT, fragmentShader: frag(), side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -20;
  dome.frustumCulled = false;
  const v2 = new THREE.Vector2();
  dome.onBeforeRender = (renderer, _s, camera) => {
    drawSize(renderer, v2);
    uniforms.uPx!.value = v2.y * camera.projectionMatrix.elements[5]! * 0.5;
    uniforms.uRes!.value = Math.max(0.6, v2.y / 720);
  };
  scene.add(dome);

  const queue: number[] = [];
  let slot = 0, now = 0, lastT = -1, prevH = -1, screamOn = false;
  const TH = [0.2, 0.4, 0.6, 0.8], BURST = [1, 2, 3, 4];
  const armed = [true, true, true, true];
  const spawn = (t: number) => {
    const c = com[slot]!; slot = (slot + 1) % COMETS;
    const back = rnd() < 0.3;
    const az = (back ? Math.PI : 0) + (rnd() - 0.5) * 1.6;
    const sgn = rnd() < 0.5 ? -1 : 1;
    // góc: kéo chéo xuống 12–40°, trái hoặc phải
    const ang = THREE.MathUtils.degToRad(12 + rnd() * 28);
    c.set(az, 0.55 + rnd() * 0.4, t, sgn > 0 ? ang : Math.PI - ang);
  };
  const burst = (n: number) => { for (let k = 0; k < n; k++) queue.push(now + (n > 1 ? (k / (n - 1)) * 1.6 : 0) + rnd() * 0.12); };
  const hook = { triggerMeteors: burst };
  (window as unknown as { __csSky?: unknown }).__csSky = hook;
  return {
    moonPosition: PIXEL_MOON_DIR.clone().multiplyScalar(SKY_RADIUS),
    burstMeteors: burst,
    update(t) {
      now = t;
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const h = (uniforms.uHype?.value as number) ?? 0;
      if (prevH < 0) prevH = h;
      for (let i = 0; i < 4; i++) {
        if (h < TH[i]! - 0.05) armed[i] = true;
        if (armed[i] && prevH < TH[i]! && h >= TH[i]!) { armed[i] = false; burst(BURST[i]!); }
      }
      prevH = h;
      if (!screamOn && h >= SCREAM_ON) screamOn = true; else if (screamOn && h < SCREAM_OFF) screamOn = false;
      const target = screamOn ? 1 : 0;
      scr.value += Math.sign(target - scr.value) * Math.min(Math.abs(target - scr.value), dt / SCREAM_SEC);
      // xoáy trôi 0,2 vòng/s, nhanh dần theo gió nét cọ (tích phân pha → đổi tốc độ không giật)
      swirl.value = (swirl.value + dt * Math.PI * 2 * 0.2 * (1 + 0.8 * wind.value)) % (Math.PI * 2);
      // ≥ 80 %: mưa nét cọ nhẹ (≈ 0,8 vệt / s, dưới 3 chớp / s)
      if (dt > 0 && h >= 0.8 && rnd() < 0.8 * dt) queue.push(t);
      for (let k = queue.length - 1; k >= 0; k--) if (queue[k]! <= t) { spawn(t); queue.splice(k, 1); }
    },
    dispose() {
      scene.remove(dome);
      geo.dispose(); mat.dispose();
      const w = window as unknown as { __csSky?: unknown };
      if (w.__csSky === hook) delete w.__csSky;
    },
  };
}

export const builders: Partial<OutsideBuilders> = { sky: createPixelSky };
