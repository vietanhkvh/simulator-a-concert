// "Mực & Sơn mài" — khán giả vệt cọ (gói L4). BODY: thân = nét cọ dọc thuôn, đậm trên → loãng ở chân, mép khô đứt
// 15–25 % (nhiễu), đầu nhỏ (tóc / nón lá / khăn / búi), KHÔNG vẽ mặt; đèn lồng đặc sáng trên que. LOD xa = chấm mực
// + đốm đèn. STICK: quầng ấm của đèn lồng / nến (additive).

#ifdef USE_FOG
uniform vec3 fogColor;
varying float vFogDepth;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear;
uniform float fogFar;
#endif
#endif

uniform float uHype;
uniform vec3 uLqInk;     // sơn then 700: tóc, nét mực
uniform vec3 uLqSilk;    // vỏ trứng 500: rim mực sáng
uniform vec3 uLqGold;    // vàng quỳ 500: chóp đèn
uniform vec3 uLqWash;    // sơn then 300: loang ở chân
uniform vec3 uLqStick;   // que tre

#ifdef BODY
varying vec2 vL;
flat varying vec4 vHead;
flat varying vec4 vArm;
flat varying vec4 vLant;
flat varying vec4 vBK;
flat varying vec4 vCloth;
flat varying vec3 vSkin;
flat varying vec3 vHatC;
flat varying vec4 vLantC;
#endif
#ifdef STICK
varying vec2 vM;
flat varying vec4 vColor;
#endif

float fogAmount() {
#ifdef USE_FOG
#ifdef FOG_EXP2
  return 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
#else
  return smoothstep(fogNear, fogFar, vFogDepth);
#endif
#else
  return 0.0;
#endif
}
vec3 fogSrgb() {
#ifdef USE_FOG
  return pow(max(fogColor, vec3(0.0)), vec3(0.4545));
#else
  return vec3(0.0);
#endif
}

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * t);
}

#ifdef BODY
/** Đèn lồng: < 0 bên trong. q đơn vị = bán kính. */
float sdLantern(vec2 q, float shape) {
  if (shape < 0.5) return length(q * vec2(1.08, 0.94)) - 1.0;                  // tròn (đèn lồng đỏ)
  if (shape < 1.5) return length(q * vec2(1.25, 0.82)) - 1.0;                  // bầu dài (Hội An)
  float a = atan(q.x, q.y);
  if (shape < 2.5) {                                                            // hoa sen
    float r = 0.62 + 0.38 * pow(abs(cos(a * 2.5)), 0.7);
    return q.y < -0.35 ? length(q * vec2(0.9, 2.2)) - 0.85 : length(q) - r;
  }
  float r = 0.5 + 0.5 * pow(abs(cos(a * 2.5)), 3.0);                          // ông sao
  return length(q) - r;
}
#endif

void main() {
#ifdef BODY
  vec2 p = vL;
  float u = vBK.x, lean = vBK.y, seed = vBK.z;
  float far = vBK.w;
  float fog = fogAmount();
  vec3 lantC = vLantC.rgb, cloth = vCloth.rgb;
  float lr = vLant.z;
  float shape = mod(vLant.w, 10.0);
  float candle = step(5.0, vLant.w);
  vec2 lq = (p - vLant.xy) / lr;

  if (far > 0.5) {
    // LOD xa: chấm mực + đốm đèn
    if (length(lq) < 1.0) { gl_FragColor = vec4(mix(lantC * (0.9 + 0.3 * vLantC.a), fogSrgb(), fog * 0.6), 1.0); return; }
    vec2 e = (p - vec2(lean * 0.5 * u, 0.5 * u)) / vec2(0.12 * u, 0.5 * u);
    if (dot(e, e) > 1.0) discard;
    vec3 c = mix(cloth * 0.55, uLqWash, smoothstep(-0.2, -1.0, e.y) * 0.6);
    c += lantC * 0.18 * vLantC.a;
    gl_FragColor = vec4(mix(c, fogSrgb(), fog), 1.0);
    return;
  }

  // đèn lồng (đặc, phát sáng)
  float dl = candle > 0.5 ? length(lq * vec2(1.6, 1.0)) - 1.0 : sdLantern(lq, shape);
  if (dl < 0.0) {
    vec3 c = lantC * (0.85 + 0.35 * vLantC.a);
    if (candle < 0.5) {
      if (shape < 1.5) {
        c *= 0.86 + 0.14 * cos(lq.x * 7.0);                         // nan đèn
        if (abs(lq.y) > (shape < 0.5 ? 0.82 : 0.72)) c = uLqGold;   // chóp vàng
      } else c = mix(c, vec3(1.0, 0.97, 0.85), 0.35 * smoothstep(0.6, 0.0, length(lq)));
      c = mix(c, vec3(1.0, 0.95, 0.8), 0.3 * smoothstep(0.7, 0.0, length(lq - vec2(-0.2, 0.15))));
    } else c = mix(c, vec3(1.0), 0.4);
    gl_FragColor = vec4(mix(c, fogSrgb(), fog * 0.5), 1.0);
    return;
  }
  // tua đèn
  if (candle < 0.5 && shape < 1.5 && abs(p.x - vLant.x) < 0.006 * u && p.y < vLant.y - lr * 0.8 && p.y > vLant.y - lr * 1.45) {
    gl_FragColor = vec4(mix(uLqGold * 0.8, fogSrgb(), fog), 1.0); return;
  }

  vec3 col;
  bool hit = false;
  float edge = 1.0;
  // que tre
  vec2 stickTop = vLant.xy - normalize(vLant.xy - vArm.zw) * lr;
  if (candle < 0.5 && sdSeg(p, vArm.zw, stickTop) < 0.0075 * u) { col = uLqStick; hit = true; }

  // đầu + mũ / khăn (không mặt)
  vec2 hq = p - vHead.xy;
  float R = vHead.z, hat = vHead.w;
  float front = vCloth.a;
  if (!hit && hat > 0.5 && hat < 1.5) {
    float hy = hq.y - R * 0.2, hh = 0.11 * u, hw = 0.15 * u;
    if (hy > 0.0 && hy < hh && abs(hq.x) < hw * (1.0 - hy / hh)) {
      col = vHatC * (hq.x < 0.0 ? 1.08 : 0.78);                    // nón lá: 2 bậc
      if (hy < 0.006 * u) col *= 0.7;
      hit = true;
    }
  }
  if (!hit) {
    float dh = length(hq * vec2(1.12, 1.0)) - R;
    if (hat > 2.5) dh = min(dh, length(hq - vec2(0.0, R * 0.55) - vec2(0.0, R * 0.35)) - R * 0.5); // búi
    if (dh < 0.0) {
      float hairLine = R * (0.15 - 0.25 * hq.x / R * 0.3);
      bool backView = front < -0.1;
      if (hat > 1.5 && hat < 2.5 && hq.y > R * 0.22) col = vHatC * (hq.x < 0.0 ? 1.0 : 0.8);
      else if (backView || hq.y > hairLine || abs(hq.x) > R * 0.78) col = uLqInk * 1.6;
      else col = vSkin * (hq.x < R * 0.25 ? 1.0 : 0.82);
      hit = true;
    }
  }
  // cổ
  float sy = 0.81 * u;
  if (!hit && p.y > sy - 0.02 * u && p.y < vHead.y - R * 0.6 && abs(p.x - lean * p.y) < 0.022 * u) { col = vSkin * 0.85; hit = true; }
  // tay cầm đèn (một nét)
  if (!hit && sdSeg(p, vArm.xy, vArm.zw) < 0.03 * u) { col = cloth * 0.85; hit = true; }

  // thân: nét cọ dọc thuôn (áo dài / áo bà ba), mép khô đứt
  float yN = p.y / sy;
  if (!hit && yN < 1.02 && p.y > 0.0) {
    float cx = lean * p.y;
    float w = yN > 0.62 ? mix(0.085, 0.112, smoothstep(0.62, 0.98, yN)) : mix(0.095, 0.08, smoothstep(0.0, 0.62, yN));
    w *= u * (1.0 - 0.6 * smoothstep(0.97, 1.02, yN));
    float n = vnoise(vec2(p.y * 22.0 / u, seed * 37.0));
    w *= 0.86 + 0.24 * n;
    float ax = abs(p.x - cx) / w;
    if (ax < 1.0) {
      float streak = vnoise(vec2((p.x - cx) / w * 2.6 + seed * 11.0, p.y * 3.2 / u + seed * 5.0));
      if (ax > 0.5 && streak > 0.74) discard;                       // mép khô đứt
      float dis = vnoise(p * 34.0 / u + seed * 3.0);
      if (dis * 0.7 + yN * 2.4 < 0.32) discard;                       // loang ở chân
      float shade = (p.x - cx) > w * 0.25 ? 0.72 : 1.0;               // 2 bậc phẳng
      vec3 dark = cloth * 0.72;
      vec3 wash = mix(cloth, uLqWash, 0.5);
      col = mix(wash, dark, smoothstep(0.05, 0.7, yN)) * shade;
      if (shade < 1.0) col *= vec3(0.9, 0.93, 1.1);
      col = mix(col, uLqSilk * 0.8, smoothstep(0.86, 0.98, ax) * 0.3);  // mực sáng ở mép
      edge = ax;
      hit = true;
    }
  }
  if (!hit) discard;
  // ánh đèn hắt lên người
  float ld = length(p - vLant.xy) / u;
  col += lantC * vLantC.a * 0.32 * exp(-ld * ld * 9.0) * (1.0 - candle * 0.3);
  gl_FragColor = vec4(mix(col, fogSrgb(), fog), 1.0);
#endif

#ifdef STICK
  float d = length(vM);
  float candle = vColor.a;
  float a = candle > 0.5 ? exp(-d * d * 14.0) * 1.6 + exp(-d * d * 3.0) * 0.25 : exp(-d * d * 3.2) * 0.85 + exp(-d * d * 0.9) * 0.18;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb * a * (1.0 - 0.75 * fogAmount()), 1.0);
#endif
}
