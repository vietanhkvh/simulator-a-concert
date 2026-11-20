// Khán giả instanced (P1) — CHIBI "Kẹo đêm".
// BODY: nhân vật 2,1 đầu vẽ bằng SDF trong billboard (alpha-test + depth write), viền ink từ khoảng cách SDF,
//       tô 2 bậc (bóng dịch về tím), rim theo màu que, mặt ở LOD gần, bóng đơn giản ở LOD xa.
// STICK: quầng sáng đầu que sao / tim (additive) + đèn flash điện thoại.

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

#ifdef BODY
uniform vec3 uInk;
uniform vec3 uCream;     // cream-500: giày, que
uniform vec3 uCreamHi;   // cream-100: đốm mắt, highlight
uniform vec3 uPants;     // night-100
uniform vec3 uCheek;     // berry-300
uniform vec3 uMouth;     // berry-700
uniform vec3 uStar;      // honey-500
uniform vec3 uHeart;     // berry-500
uniform vec3 uShadowTint;// grape-700

varying vec4 vP;
flat varying vec4 vHeadV;
flat varying vec4 vHandsV;
flat varying vec4 vStickV;
flat varying vec4 vBox;
flat varying vec4 vSkinV;
flat varying vec4 vHairV;
flat varying vec4 vClothV;
flat varying vec4 vStickColV;
flat varying vec4 vRimV;
flat varying vec4 vMiscV;
flat varying vec3 vAccent;
#endif

#ifdef STICK
varying vec2 vUv;
flat varying vec3 vColor;
varying vec2 vMetric;
flat varying float vGlowScale;
flat varying float vPhone;
flat varying float vShapeK;
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

// Sao 5 cánh (iq), bán kính ngoài r, độ lõm rf.
float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

// Tim (iq): cao ~1,1, đáy ở y = 0.
float sdHeartRaw(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return length(p - vec2(0.25, 0.75)) - 0.35355339;
  vec2 a = p - vec2(0.0, 1.0);
  vec2 b = p - 0.5 * max(p.x + p.y, 0.0);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}
// Motif tròn mập theo đơn vị "bán kính ≈ 1".
float sdMotif(vec2 q, float heart) {
  if (heart > 0.5) return sdHeartRaw(q * 0.6 + vec2(0.0, 0.55)) / 0.6 - 0.08;
  return sdStar5(q, 0.95, 0.52) - 0.14;
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
// Shader này xuất màu sRGB trực tiếp; fogColor là màu tuyến tính → đổi gần đúng sang sRGB cho khớp nền.
vec3 fogSrgb() {
#ifdef USE_FOG
  return pow(max(fogColor, vec3(0.0)), vec3(0.4545));
#else
  return vec3(0.0);
#endif
}

#ifdef BODY
// n·L của khối cầu giả từ tọa độ 2D chuẩn hóa (|n| ≤ 1).
float sph(vec2 n, vec3 l) {
  return dot(vec3(n, sqrt(max(1.0 - dot(n, n), 0.0))), l);
}

// Bậc bóng: tối hơn, dịch về tím (grape-700), không bao giờ đen.
// Giống palette.shadowOf: tối đều (giữ tỉ lệ kênh → không ngả cam/đỏ), rồi phủ nhẹ lavender cùng độ sáng.
vec3 shadowOf(vec3 c) {
  vec3 d = c * 0.72;
  const vec3 LUM = vec3(0.3, 0.59, 0.11);
  vec3 lav = min(uShadowTint * (dot(d, LUM) / max(dot(uShadowTint, LUM), 1e-3)), vec3(1.0));
  return mix(d, lav, 0.24) + vec3(0.015, 0.01, 0.04);
}
// Hợp mềm (iq) — gộp tay + bàn tay để viền ink chỉ chạy quanh bóng ngoài.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Vùng tóc (x) và phụ kiện mũ / nơ (y) trong hệ đầu chuẩn hóa (bán kính đầu = 1). back = 1 → nhìn từ sau.
vec2 hairSdf(vec2 q, float type, float side, float back) {
  float dC = length(q - vec2(0.0, 0.03)) - 1.07;
  float sideLock = max(0.72 - abs(q.x), -0.28 - q.y);
  float hair;
  float acc = 9.0;
  if (type < 0.5) {
    // Hai búi tròn.
    float fr = 0.14 - 0.08 * cos(q.x * 7.5);
    hair = max(dC, min(fr - q.y, sideLock));
    hair = min(hair, min(length(q - vec2(0.68, 0.74)), length(q - vec2(-0.68, 0.74))) - 0.34);
  } else if (type < 1.5) {
    // Mũ lưỡi trai (màu nhấn) + tóc ngắn hai bên.
    acc = max(length(q - vec2(0.0, 0.03)) - 1.1, 0.24 - q.y);
    acc = min(acc, sdRoundBox(q - vec2(side * 0.62, 0.27), vec2(0.56, 0.085), 0.08));
    hair = max(length(q) - 1.05, max(0.74 - abs(q.x), -0.22 - q.y));
  } else if (type < 2.5) {
    // Tóc bob: ôm đầu, mái bằng, ngang cằm.
    float outer = max(length(q - vec2(0.0, 0.02)) - 1.14, -0.62 - q.y);
    vec2 w = (q - vec2(0.0, -0.2)) / vec2(0.8, 0.82);
    float win = max((length(w) - 1.0) * 0.8, q.y - (0.2 - 0.05 * cos(q.x * 9.0)));
    hair = max(outer, -win * (1.0 - back) + back * -9.0);
  } else if (type < 3.5) {
    // Tóc dựng / nhọn tròn đầu.
    float ang = atan(q.x, q.y);
    float sp = 0.2 * pow(max(cos(ang * 6.0), 0.0), 2.0) * step(abs(ang), 1.35);
    float outer = length(q - vec2(0.0, 0.03)) - (1.05 + sp);
    float fr = 0.04 + 0.28 * abs(fract(q.x * 2.2 + 0.5) - 0.5);
    hair = max(outer, min(fr - q.y, sideLock));
  } else {
    // Đuôi ngựa (vẽ ở lớp sau) + mái lệch + nơ soda.
    float fr = 0.12 + 0.24 * q.x * side;
    hair = max(dC, min(fr - q.y, sideLock));
    vec2 qb = q - vec2(-side * 0.74, 0.62);
    acc = min(length(qb - vec2(0.15, 0.0)) - 0.15, length(qb + vec2(0.15, 0.0)) - 0.15);
    acc = min(acc, length(qb) - 0.08);
  }
  return vec2(hair, acc);
}
#endif

void main() {
#ifdef BODY
  vec2 p = vP.xy;
  // Discard sớm: ngoài hộp bao người (phần lớn diện tích quad) → bỏ qua toàn bộ SDF.
  if (p.x < vBox.x || p.x > vBox.y || p.y > vBox.z) discard;
  float u = vP.z;
  float R = 0.24 * u;
  vec2 hc = vHeadV.xy;
  vec2 hand = vHandsV.xy;
  vec2 hand2 = vHandsV.zw;
  vec2 sh1 = vec2(vBox.w, 0.43 * u);
  vec2 sh2 = vec2(-vBox.w, 0.43 * u);
  vec2 sH = vStickV.xy;
  vec2 sDir = vStickV.zw;
  float wk = vMiscV.w;
  float farMix = vMiscV.z;
  vec3 farBody = mix(vClothV.rgb, uPants, 0.3);
  float fog = fogAmount();
  vec2 bodyC = vec2(0.0, 0.33 * u);
  vec2 bodyHalf = vec2(0.155 * wk, 0.155) * u;

  if (vP.w > 0.5) {
    // ── LOD xa (≥ 35 m): đầu tròn màu tóc + thân hạt đậu (liền chân) + tay + đầu que. Không viền, không mặt.
    float dH = length(p - hc) - R * 1.04;
    float dB = sdRoundBox(p - vec2(0.0, 0.27 * u), vec2(0.15 * wk, 0.27) * u, 0.13 * u);
    float dA = min(sdCapsule(p, sh1, hand, 0.05 * u), sdCapsule(p, sh2, hand2, 0.05 * u));
    float dS = length(p - sH) - 0.095 * u;
    float dF = min(min(dH, dB), min(dA, dS));
    // Nới theo kích thước pixel để tay mảnh vẫn không bị đứt khi người chỉ vài pixel.
    if (dF > fwidth(dF) * 0.35) discard;
    vec3 c = dS < 0.0 ? vStickColV.rgb : (dH < 0.0 ? vHairV.rgb : farBody);
    float lit = dS < 0.0 ? 1.0 : 0.82 + 0.18 * smoothstep(0.3 * u, 0.9 * u, p.y);
    c *= lit;
    if (dS > 0.0) c += vRimV.rgb * 0.3 * smoothstep(0.5 * u, 1.0 * u, p.y);
    gl_FragColor = vec4(mix(c, fogSrgb(), fog), 1.0);
    return;
  }

  // Kích thước pixel (m) → bề dày viền ink: 2,5% chiều cao, kẹp 1,5–3 px, tắt khi nhân vật < 24 px.
  vec2 fw = fwidth(p);
  float px = max(max(fw.x, fw.y), 1e-5);
  float w = clamp(0.025 * u, 1.5 * px, 3.0 * px) * step(24.0 * px, u) * (1.0 - farMix);
  const vec3 L3 = vec3(-0.42, 0.55, 0.72); // ánh sáng từ trên-trái-trước (sân khấu)

  vec3 alb;
  float dl;          // khoảng cách SDF của lớp trên cùng tại pixel này
  float ndl = 1.0;   // n·L giả 2D (cho tô 2 bậc)
  float inner = 9.0; // đường ink mảnh bên trong lớp (tóc / mặt)
  float isHair = 0.0;
  float emissive = 0.0;
  vec2 hq = vec2(0.0);
  float head = 0.0;
  bool hit = false;

  // Tay + bàn tay (dùng chung cho lớp 4 và để bàn tay nằm đè lên cán que).
  float dH1 = length(p - hand) - 0.065 * u;
  float dH2 = length(p - hand2) - 0.065 * u;
  float dHands = min(dH1, dH2);
  float dA1 = sdCapsule(p, sh1, hand, 0.052 * u);
  float dA2 = sdCapsule(p, sh2, hand2, 0.052 * u);
  // Bóng ngoài của cả cánh tay (vai → bàn tay), hợp mềm: không còn vòng ink chỗ cổ tay.
  float kArm = 0.03 * u;
  float dLimb = min(smin(dA1, dH1, kArm), smin(dA2, dH2, kArm));

  // ── Lớp 5 (trước nhất): lightstick (que + đầu sao / tim) hoặc điện thoại.
  vec2 sPerp = vec2(sDir.y, -sDir.x);
  vec3 stickC = vStickColV.rgb;
  float stickShape = mod(vStickColV.w, 2.0);
  if (vStickColV.w > 1.5) {
    vec2 pp = p - (hand + sDir * 0.07 * u);
    float dPh = sdRoundBox(vec2(dot(pp, sPerp), dot(pp, sDir)), vec2(0.045, 0.075) * u, 0.018 * u);
    if (dPh < 0.0) { hit = true; dl = dPh; alb = uInk * 1.6; }
  } else {
    float hr = 0.085 * u;
    vec2 sq = p - sH;
    vec2 sl = vec2(dot(sq, sPerp), dot(sq, sDir)) / hr;
    float dHd = dot(sl, sl) < 1.25 ? sdMotif(sl, stickShape) * hr : 1.0;
    float dWand = sdCapsule(p, hand, sH - sDir * 0.5 * hr, 0.02 * u);
    if (dHd < 0.0) {
      hit = true; dl = dHd; alb = stickC; emissive = 1.0;
      // Đốm highlight kem trên đầu que.
      alb = mix(alb, uCreamHi, 0.55 * (1.0 - smoothstep(0.16, 0.24, length(sl - vec2(-0.3, 0.35)))));
    } else if (dWand < 0.0 && dHands > 0.0) {
      // Cán que: bàn tay nắm phía trước cán (không vẽ cán / viền cán đè lên bàn tay).
      hit = true; dl = dWand; alb = uCream; ndl = 0.5;
    }
  }

  // ── Lớp 4: tay 1 đoạn + bàn tay tròn.
  if (!hit) {
    if (dHands < 0.0) {
      // dl = bóng gộp tay+bàn tay → viền chỉ ở mép ngoài, đường nối cổ tay không bị khoanh tròn.
      hit = true; dl = min(dLimb, dHands); alb = vSkinV.rgb;
      vec2 hcN = dH1 < dH2 ? hand : hand2;
      ndl = sph((p - hcN) / (0.065 * u), L3);
    } else {
      float dArm = min(dA1, dA2);
      if (dArm < 0.0 || dLimb < 0.0) { hit = true; dl = dLimb; alb = vClothV.rgb; ndl = 0.3; }
    }
  }

  // ── Lớp 3: đầu (da + tóc + mũ / nơ), nghiêng theo vHeadV.zw.
  float hairType = vSkinV.w;
  float side = sign(vBox.w + 1e-6);
  float back = step(vRimV.w, -0.05);
  vec2 q = p - hc;
  q = vec2(vHeadV.w * q.x - vHeadV.z * q.y, vHeadV.z * q.x + vHeadV.w * q.y);
  vec2 qn = q / R;
  if (!hit && dot(qn, qn) < 1.9) {
    float dSkin = length(qn) - 1.0;
    vec2 hs = hairSdf(qn, hairType, side, back);
    float dHair = back > 0.5 ? min(hs.x, dSkin - 0.001) : hs.x;
    float dHeadAll = min(dSkin, min(dHair, hs.y));
    if (dHeadAll < 0.0) {
      hit = true; head = 1.0; dl = dHeadAll * R; hq = qn;
      ndl = sph(qn, L3);
      if (hs.y < 0.0) {
        alb = vAccent; isHair = 1.0; inner = -hs.y * R;
      } else if (dHair < 0.0) {
        alb = vHairV.rgb; isHair = 1.0; inner = -dHair * R + 9.0 * back;
      } else {
        alb = vSkinV.rgb;
      }
      alb = mix(alb, vHairV.rgb, farMix * (1.0 - isHair));
    }
  }

  // ── Lớp 2: thân hạt đậu + motif ngực.
  if (!hit) {
    vec2 pb = p - bodyC;
    pb.x *= 1.0 + 0.12 * clamp(pb.y / bodyHalf.y, -1.0, 1.0); // hạt đậu: vai hẹp hơn hông
    float dBody = sdRoundBox(pb, bodyHalf, 0.13 * u);
    if (dBody < 0.0) {
      hit = true; dl = dBody; alb = vClothV.rgb;
      ndl = sph(pb / (bodyHalf + 0.01 * u), L3);
      float motif = vClothV.w;
      vec2 mq = (p - vec2(0.0, 0.35 * u)) / (0.06 * u);
      if (vRimV.w > 0.0 && motif > 0.5 && farMix < 0.99 && (motif > 2.5 || dot(mq, mq) < 1.3)) {
        if (motif > 2.5) {
          // Áo merch night-300 + chấm honey-500.
          vec2 g = fract(p / (0.075 * u) + vec2(0.25, 0.0)) - 0.5;
          if (length(g) < 0.17) alb = uStar;
        } else {
          float dM = sdMotif(mq, motif - 1.0) * 0.06 * u;
          if (dM < 0.0) { alb = motif > 1.5 ? uHeart : uStar; inner = -dM; }
        }
      }
      alb = mix(alb, farBody, farMix);
    }
  }

  // ── Lớp 1: chân ngắn + giày kem.
  if (!hit) {
    float lx = 0.068 * u;
    float dLeg = min(sdCapsule(p, vec2(lx, 0.07 * u), vec2(lx, 0.2 * u), 0.048 * u),
                     sdCapsule(p, vec2(-lx, 0.07 * u), vec2(-lx, 0.2 * u), 0.048 * u));
    vec2 sp = vec2(abs(p.x) - lx * 1.1, p.y - 0.035 * u);
    float dShoe = max(length(sp * vec2(0.85, 1.25)) - 0.058 * u, -p.y);
    if (dShoe < 0.0) { hit = true; dl = dShoe; alb = uCream; ndl = 0.4; }
    else if (dLeg < 0.0) { hit = true; dl = dLeg; alb = uPants; ndl = -0.6; }
    if (hit) alb = mix(alb, farBody * 0.8, farMix);
  }

  // ── Lớp 0 (sau cùng): đuôi ngựa.
  if (!hit && hairType > 3.5) {
    vec2 qp = (qn - vec2(-side * 0.98, -0.2)) / vec2(0.34, 0.6);
    float dP = (length(qp) - 1.0) * 0.34;
    if (dP < 0.0) { hit = true; dl = dP * R; alb = vHairV.rgb; isHair = 1.0; ndl = -0.2; }
  }

  // Alpha-test (không blend): bỏ pixel ngoài bóng, phần còn lại ghi depth.
  if (!hit) discard;

  // ── Mặt (LOD gần, nhìn từ trước): mắt elip dọc + đốm, má hồng, miệng nhỏ; 4 biểu cảm + chớp mắt.
  float faceOn = step(1.5, vMiscV.y) * (1.0 - back) * step(isHair, 0.5) * head;
  vec3 faceCol = alb;
  float faceInk = 0.0;
  if (faceOn > 0.5) {
    vec2 f = hq - vec2(clamp(vMiscV.x, -0.6, 0.6) * 0.42, 0.0);
    float expr = vHairV.w;
    float blink = mod(vMiscV.y, 2.0);
    vec2 fe = vec2(abs(f.x) - 0.36, f.y + 0.06);
    // Má
    float cheek = 1.0 - smoothstep(0.12, 0.16, length(vec2(abs(f.x) - 0.6, f.y + 0.32)));
    faceCol = mix(faceCol, uCheek, 0.6 * cheek);
    float lw = 0.045 + 0.6 * px / R; // nét mảnh nhưng không mất pixel
    if (expr > 2.5) {
      // Mắt sao.
      float dS = sdStar5(fe * vec2(1.0, 0.95), 0.24, 0.5) - 0.03;
      if (dS < 0.0) faceCol = dS > -lw ? uInk : uStar;
    } else if (expr > 1.5 || blink > 0.5) {
      // "^ ^" cười tít / chớp mắt (blink: nét ngang).
      float arc = expr > 1.5 ? max(abs(length(fe - vec2(0.0, -0.12)) - 0.15) - lw, -(fe.y + 0.04))
                             : sdCapsule(fe, vec2(-0.11, -0.02), vec2(0.11, -0.02), lw);
      faceInk = max(faceInk, step(arc, 0.0));
    } else {
      float dE = (length(fe / vec2(0.13, 0.19)) - 1.0) * 0.13;
      if (dE < 0.0) {
        faceCol = uInk;
        float hl = length(fe - vec2(-0.045, 0.075)) - 0.058;
        if (hl < 0.0) faceCol = uCreamHi;
      }
    }
    // Miệng: cười / "O" reo / miệng cười mở (cười tít, mắt sao).
    vec2 fm = f - vec2(0.0, -0.36);
    if (expr > 0.5 && expr < 1.5) {
      float o = 0.07 + 0.03 * uHype;
      float dO = (length(fm / vec2(o * 0.85, o)) - 1.0) * o * 0.85;
      if (dO < 0.0) faceCol = dO > -lw ? uInk : uMouth;
    } else if (expr > 1.5) {
      float dO = max(length(fm - vec2(0.0, 0.04)) - 0.13, fm.y - 0.04);
      if (dO < 0.0) faceCol = dO > -lw ? uInk : uMouth;
    } else {
      float sm = max(abs(length(fm - vec2(0.0, 0.08)) - 0.11) - lw * 0.8, fm.y - 0.02);
      if (sm < 0.0) faceCol = uMouth;
    }
    faceCol = mix(faceCol, uInk, faceInk);
  }
  alb = mix(alb, faceCol, faceOn * (1.0 - farMix));

  // ── Tô đồ chơi 2 bậc + rim + highlight.
  float toon = smoothstep(0.05, 0.2, ndl); // ngưỡng mềm ~15%
  vec3 col = mix(shadowOf(alb), alb, toon) * (0.88 - 0.08 * uHype * (1.0 - emissive));
  if (isHair > 0.5) {
    // 1 đốm highlight kem trên tóc / mũ (≤ 8% diện tích), 40% (30% khi hype > 80%).
    vec2 hh = hq - vec2(-0.42, 0.6);
    hh = vec2(0.85 * hh.x + 0.53 * hh.y, -0.53 * hh.x + 0.85 * hh.y);
    float blob = 1.0 - smoothstep(0.85, 1.0, length(hh / vec2(0.24, 0.1)));
    col = mix(col, uCreamHi, blob * mix(0.4, 0.3, step(0.8, uHype)) * (1.0 - farMix));
  }
  // Ánh lightstick riêng hắt lên mặt / tay gần bàn tay cầm que.
  col += stickC * 0.12 * exp(-length(p - sH) * 6.0 / u) * (1.0 - emissive);
  // Rim (viền sáng) ngay trong nét ink, mạnh ở phía ngược sáng và phía trên.
  float rimBand = smoothstep(-(w + 0.035 * u), -w, dl) * (1.0 - emissive);
  float rimSide = clamp(0.8 - ndl * 1.2, 0.0, 1.0) + 0.4 * smoothstep(0.55 * u, 1.0 * u, p.y);
  col += vRimV.rgb * rimBand * rimSide;
  // Viền ink (ngoài + nét trong mảnh giữa tóc và da / motif).
  float ink = step(-w, dl) + step(inner, w * 0.6) * step(0.0, inner);
  col = mix(col, uInk, clamp(ink, 0.0, 1.0));
  gl_FragColor = vec4(mix(col, fogSrgb(), fog), 1.0);
#endif

#ifdef STICK
  vec2 q = vMetric;
  float s = vGlowScale;
  if (vPhone > 0.5) {
    // Điện thoại giơ cao: màn hình kem bo góc phát sáng (~10×16 cm, to dần theo khoảng cách để còn đọc được)
    // + quầng mềm. Quầng chia theo diện tích (ss²) → biển flash xa không cháy trắng.
    float ss = 0.6 + 0.4 * s;
    vec2 qq = q / ss;
    float dR = sdRoundBox(qq, vec2(0.05, 0.08), 0.028);
    float pcore = 1.0 - smoothstep(-0.004, 0.01, dR);
    float dd = max(dR, 0.0);
    float halo = (exp(-dd * 26.0) * 0.5 + exp(-dd * 9.0) * 0.14) / (ss * ss);
    vec2 pe = abs(vUv - vec2(0.5)) * 2.0;
    float pedge = 1.0 - smoothstep(0.75, 1.0, max(pe.x, pe.y));
    vec3 pc = vColor * (pcore * mix(1.15, 0.8, clamp(s - 1.0, 0.0, 1.0)) + halo * (1.0 - pcore)) * pedge;
    pc *= 1.0 - 0.7 * fogAmount();
    gl_FragColor = vec4(pc, 1.0);
    return;
  }
  // Quầng sao / tim: hình motif mờ to dần + quầng tròn mềm. q tính theo bán kính đầu que.
  float r = length(q);
  if (r > 1.6 * s) discard;
  float dM = sdMotif(q / s, vShapeK);
  float shape = 1.0 - smoothstep(0.0, 0.3, dM);
  float glow = exp(-max(dM, 0.0) * 3.2) * 0.32 + exp(-r * 2.6 / s) * 0.12;
  vec2 e = abs(vUv - vec2(0.5)) * 2.0;
  float edge = 1.0 - smoothstep(0.8, 1.0, max(e.x, e.y));
  // Quầng to ra theo khoảng cách nhưng giữ tổng năng lượng ~ không đổi → biển sáng xa không cháy trắng.
  vec3 col = vColor * (glow + shape * 0.35) / (s * s);
  col *= edge;
  col *= 1.0 - 0.8 * fogAmount();
  gl_FragColor = vec4(col, 1.0);
#endif
}
