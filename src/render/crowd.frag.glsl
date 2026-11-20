// Khán giả instanced (P1): BODY = bóng người vẽ bằng SDF; STICK = lightstick phát sáng (additive).

varying vec2 vUv;

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

#ifdef BODY
varying vec2 vLocal;
varying vec2 vShoulder;
varying vec2 vHand;
varying float vTint;
varying vec3 vGlow;
#endif

#ifdef STICK
varying vec3 vColor;
varying vec2 vMetric;
varying float vGlowScale;
#endif

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t) - r;
}

float sdRoundBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

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

void main() {
#ifdef BODY
  vec2 p = vLocal;
  float hs = vShoulder.y / 1.42; // hệ số chiều cao
  float d = length(p - vec2(0.0, 1.6 * hs)) - 0.115 * hs;                         // đầu
  d = min(d, sdRoundBox(p - vec2(0.0, 1.17 * hs), vec2(0.215, 0.29) * hs, 0.09)); // vai + ngực
  d = min(d, sdRoundBox(p - vec2(0.0, 0.5 * hs), vec2(0.17, 0.6) * hs, 0.05));    // thân dưới
  d = min(d, sdCapsule(p, vec2(0.0, 1.4 * hs), vec2(0.0, 1.5 * hs), 0.055));      // cổ
  d = min(d, sdCapsule(p, vShoulder, vHand, 0.05));                               // tay cầm lightstick
  float aa = fwidth(d) * 0.75 + 1e-4;
  float alpha = 1.0 - smoothstep(-aa, aa, d);
  if (alpha < 0.02) discard;

  vec3 col = vec3(vTint);
  // Viền sáng phía trên (ánh lightstick & đèn sân khấu hắt lên).
  float top = smoothstep(1.0 * hs, 1.8 * hs, p.y);
  float rim = smoothstep(-0.035, 0.0, d);
  col += vGlow * (0.12 * top + 0.9 * rim * top);
  gl_FragColor = vec4(col, alpha);
#ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogAmount());
#endif
#endif

#ifdef STICK
  vec2 q = vMetric;
  float s = vGlowScale;
  float core = sdCapsule(q, vec2(0.0, 0.07 * s), vec2(0.0, 0.07 * s + 0.3), 0.022);
  float coreMask = 1.0 - smoothstep(0.0, 0.012 + 0.01 * s, core);
  float glow = exp(-max(core, 0.0) * 22.0 / s) * 0.55;
  // Mép quad mờ dần về 0 để không lộ hình chữ nhật.
  vec2 e = abs(vUv - vec2(0.5)) * 2.0;
  float edge = (1.0 - smoothstep(0.7, 1.0, e.x)) * (1.0 - smoothstep(0.8, 1.0, e.y));
  vec3 col = vColor * (glow + coreMask * 0.9) + vec3(1.0) * coreMask * 0.18 * length(vColor);
  col *= edge;
  col *= 1.0 - 0.8 * fogAmount();
  gl_FragColor = vec4(col, 1.0);
#endif
}
