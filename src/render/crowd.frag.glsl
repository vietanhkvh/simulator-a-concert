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
varying vec2 vHand2;
varying vec2 vHead;
varying vec4 vShape;
varying vec3 vStickCol;
varying float vFront;
varying float vLod;
varying vec4 vBox;

vec3 clothColor(float c) {
  if (c < 0.2) return vec3(0.06, 0.08, 0.2);    // xanh navy
  if (c < 0.38) return vec3(0.22, 0.05, 0.08);  // đỏ rượu
  if (c < 0.54) return vec3(0.04, 0.17, 0.17);  // xanh teal
  if (c < 0.7) return vec3(0.5, 0.5, 0.5);      // áo phông trắng
  return vec3(0.025, 0.025, 0.03);              // áo merch đen
}
#endif

#ifdef STICK
varying vec3 vColor;
varying vec2 vMetric;
varying float vGlowScale;
varying float vPhone;
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
  // Discard sớm: ngoài hộp bao người (phần lớn diện tích quad) → bỏ qua toàn bộ SDF.
  if (p.x < vBox.x || p.x > vBox.y || p.y > vBox.z) discard;
  float hs = vShape.x;
  float wk = vShape.y;
  float hair = vShape.z;
  vec2 hc = vHead;
  float hr = 0.112 * hs;
  vec2 sh1 = vShoulder, sh2 = vec2(-vShoulder.x, vShoulder.y);
  vec3 cloth = clothColor(vShape.w);

  if (vLod > 0.5) {
    // LOD xa: bóng đơn giản (đầu + thân liền chân + 2 tay thẳng), không AA, alpha-test.
    float dS = min(length(p - hc) - hr * 1.1,
                   sdRoundBox(p - vec2(0.0, 0.78 * hs), vec2(0.18 * vShape.y * hs, 0.62 * hs), 0.09 * hs));
    float dA = min(sdCapsule(p, sh1, vHand, 0.055 * hs), sdCapsule(p, sh2, vHand2, 0.055 * hs));
    float dF = min(dS, dA);
    // Nới theo kích thước pixel để tay mảnh vẫn không bị đứt khi người chỉ vài pixel.
    if (dF > fwidth(dF) * 0.35) discard;
    float topF = smoothstep(0.8 * hs, 1.9 * hs, p.y);
    vec3 lightF = vec3(0.14 + vTint * 3.0) + vGlow * (0.6 + 1.2 * topF) + vStickCol * 0.2;
    vec3 colF = mix(cloth, vec3(0.05), step(p.y, 0.85 * hs) * 0.6) * lightF + vGlow * 0.5 * topF;
    gl_FragColor = vec4(colF, 1.0);
#ifdef USE_FOG
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogAmount());
#endif
    return;
  }

  // Các phần cơ thể (SDF, đơn vị m).
  float dHead = length((p - hc) * vec2(1.08, 0.95)) - hr;
  float dNeck = sdCapsule(p, vec2(0.0, 1.36 * hs), hc - vec2(0.0, 0.08 * hs), 0.045 * hs);
  // Vai thuôn + ngực, eo hẹp hơn.
  float dTorso = sdRoundBox(p - vec2(0.0, 1.2 * hs), vec2(0.2 * wk, 0.2) * hs, 0.085 * hs);
  dTorso = min(dTorso, sdRoundBox(p - vec2(0.0, 0.9 * hs), vec2(0.165 * wk, 0.16) * hs, 0.05));
  float dLegs = sdRoundBox(p - vec2(0.0, 0.4 * hs), vec2(0.155 * wk, 0.42) * hs, 0.04);
  // Khe giữa hai chân.
  dLegs = max(dLegs, -sdRoundBox(p - vec2(0.0, 0.18 * hs), vec2(0.018, 0.22) * hs, 0.01));
  vec2 el1 = mix(sh1, vHand, 0.5) + vec2(sign(sh1.x) * 0.04, -0.02) * hs;
  vec2 el2 = mix(sh2, vHand2, 0.5) + vec2(sign(sh2.x) * 0.04, -0.02) * hs;
  float dArm = min(sdCapsule(p, sh1, el1, 0.05 * hs), sdCapsule(p, el1, vHand, 0.042 * hs));
  dArm = min(dArm, min(sdCapsule(p, sh2, el2, 0.05 * hs), sdCapsule(p, el2, vHand2, 0.042 * hs)));
  float dHands = min(length(p - vHand) - 0.045 * hs, length(p - vHand2) - 0.045 * hs);

  // Tóc: 0 ngắn, 1 dài, 2 mũ lưỡi trai, 3 búi.
  float dHair;
  float hairType = floor(hair * 4.0);
  if (hairType < 0.5) {
    dHair = max(length(p - hc - vec2(0.0, 0.02 * hs)) - hr * 1.05, -(p.y - hc.y - 0.01 * hs));
  } else if (hairType < 1.5) {
    dHair = min(length(p - hc - vec2(0.0, 0.015 * hs)) - hr * 1.12,
                sdRoundBox(p - hc - vec2(0.0, -0.13 * hs), vec2(0.13, 0.15) * hs, 0.05 * hs));
    dHair = max(dHair, -(p.y - hc.y + 0.3 * hs));
  } else if (hairType < 2.5) {
    dHair = max(length(p - hc - vec2(0.0, 0.015 * hs)) - hr * 1.1, -(p.y - hc.y - 0.03 * hs));
    dHair = min(dHair, sdRoundBox(p - hc - vec2(0.07 * hs * (vShoulder.x > 0.0 ? 1.0 : -1.0), 0.035 * hs), vec2(0.11, 0.012) * hs, 0.008));
  } else {
    dHair = max(length(p - hc) - hr * 1.06, -(p.y - hc.y - 0.035 * hs));
    dHair = min(dHair, length(p - hc - vec2(0.0, 0.14 * hs)) - 0.055 * hs);
  }
  // Nhìn từ sau: toàn bộ đầu là tóc.
  dHair = mix(min(dHair, dHead + 0.003), dHair, vFront);
  if (hairType > 0.5 && hairType < 1.5) dHair = mix(min(dHair, dHead), dHair, vFront);

  float d = min(min(min(dHead, dNeck), min(dTorso, dLegs)), min(min(dArm, dHands), dHair));
  // Alpha-test (không blend): bỏ pixel ngoài bóng, phần còn lại ghi depth.
  if (d > 0.0) discard;

  // Vật liệu (màu nền / albedo), theo thứ tự lớp phía sau → phía trước.
  vec3 skin = mix(vec3(0.42, 0.29, 0.22), vec3(0.62, 0.47, 0.38), fract(hair * 7.3));
  vec3 pants = vec3(0.03, 0.032, 0.045) + vec3(0.03, 0.035, 0.06) * step(0.5, fract(vShape.w * 5.1));
  vec3 hairCol = mix(vec3(0.03, 0.022, 0.018), vec3(0.16, 0.1, 0.05), step(0.75, fract(hair * 11.0)));
  if (hairType > 1.5 && hairType < 2.5) hairCol = clothColor(fract(vShape.w + 0.37)) * 0.8;
  vec3 alb = pants;
  float isSkin = 0.0;
  if (dTorso < 0.0) alb = cloth;
  if (dNeck < 0.0) { alb = skin; isSkin = 1.0; }
  if (dHead < 0.0) { alb = skin; isSkin = 1.0; }
  if (dHair < 0.0) { alb = hairCol; isSkin = 0.0; }
  if (dArm < 0.0) { alb = vShape.w < 0.85 ? cloth * 0.85 : skin; isSkin = vShape.w < 0.85 ? 0.0 : 1.0; }
  if (dHands < 0.0) { alb = skin; isSkin = 1.0; }
  // Logo nhỏ sáng trên áo merch đen.
  if (vShape.w >= 0.7 && dTorso < 0.0 && dArm > 0.0) {
    float logo = 1.0 - smoothstep(0.02 * hs, 0.032 * hs, length(p - vec2(0.0, 1.22 * hs)));
    alb = mix(alb, mix(vec3(1.0, 0.3, 0.7), vec3(1.0, 0.85, 0.3), step(0.85, vShape.w)) * 1.6, logo * vFront);
  }
  // Mặt: mắt / bóng tối nhẹ ở nửa dưới đầu cho cảm giác khối.
  if (dHead < 0.0 && dHair > 0.0) alb *= 0.8 + 0.2 * smoothstep(-0.08, 0.04, (p.y - hc.y) / hs);
  // Nhìn từ sau: không thấy mặt.
  alb = mix(mix(alb, hairCol, step(dHead, 0.0)), alb, vFront);

  // Chiếu sáng: nền tối + ánh lightstick riêng (mạnh gần bàn tay) + ánh sân khấu hắt từ trên.
  float topY = smoothstep(0.8 * hs, 1.9 * hs, p.y);
  float nearStick = exp(-length(p - vHand) * 5.0 / hs);
  vec3 light = vec3(0.14 + vTint * 3.0) + vGlow * (0.45 + 0.9 * topY);
  light += vStickCol * (0.15 + 0.7 * nearStick) * (0.35 + 0.65 * isSkin);
  vec3 col = alb * light;
  // Viền sáng (rim) quanh bóng, mạnh hơn ở đầu/vai.
  float rim = smoothstep(-0.03 * hs, 0.0, d);
  col += (vGlow * 1.4 + vStickCol * 0.12) * rim * (0.25 + 0.75 * topY);
  gl_FragColor = vec4(col, 1.0);
#ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogAmount());
#endif
#endif

#ifdef STICK
  vec2 q = vMetric;
  float s = vGlowScale;
  if (vPhone > 0.5) {
    // Đèn flash điện thoại: lõi trắng nhỏ + quầng mềm.
    float ss = 0.6 + 0.4 * s;
    float r = length(q) / ss;
    float pcore = 1.0 - smoothstep(0.022, 0.042, r);
    float halo = exp(-r * 16.0) * 0.55 + exp(-r * 6.0) * 0.12;
    vec2 pe = abs(vUv - vec2(0.5)) * 2.0;
    float pedge = 1.0 - smoothstep(0.75, 1.0, max(pe.x, pe.y));
    vec3 pc = vColor * (pcore * 1.6 + halo) * pedge;
    pc *= 1.0 - 0.7 * fogAmount();
    gl_FragColor = vec4(pc, 1.0);
    return;
  }
  float core = sdCapsule(q, vec2(0.0, 0.07 * s), vec2(0.0, 0.07 * s + 0.3), 0.022);
  // Ngoài quầng sáng (đóng góp < ~1%) → bỏ sớm, giảm overdraw additive.
  if (core > 0.2 * s) discard;
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
