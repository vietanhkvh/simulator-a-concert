// "Thép & Lửa" — khán giả sân (gói S3). BODY: người đa giác 6,5 đầu ghép từ đa giác lồi cạnh thẳng (đầu có mặt
// phẳng hàm, vai hình thang, thân hình nêm, tay 2 đoạn thẳng, chân), tô phẳng 2–3 mặt/phần: SÁNG (key hồ quang
// lạnh từ trên-trái) / BÓNG / RIM (lửa ấm từ dưới). Không viền, không vẽ mắt (chỉ dải hốc mắt tối khi rất gần).
// STICK: màn hình điện thoại trắng-xanh + ngọn lửa bật lửa (additive).

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
uniform vec3 uStCoal;
uniform vec3 uStHot;
uniform vec3 uStPhone;
uniform vec3 uStBlood;

#ifdef BODY
uniform vec3 uStCloth[6];
varying vec4 vP;
flat varying vec4 vHead;
flat varying vec4 vEl;
flat varying vec4 vHd;
flat varying vec4 vBox;
flat varying vec4 vSkin;
flat varying vec4 vHair;
flat varying vec4 vCloth;
flat varying vec4 vPants;
flat varying vec4 vRim;
flat varying vec4 vKey;
flat varying vec4 vMisc;
#endif

#ifdef STICK
varying vec2 vMetric;
flat varying vec4 vSt;
flat varying float vScale;
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

#ifdef BODY
// Hộp cạnh thẳng dọc đoạn a→b (nửa bề ngang w), kéo dài 0,6 w ở hai đầu → khớp gãy góc. Không bo.
float sdSeg(vec2 p, vec2 a, vec2 b, float w) {
  vec2 d = b - a;
  float L = max(length(d), 1e-5);
  vec2 t = d / L;
  vec2 q = p - a;
  float x = dot(q, t), y = dot(q, vec2(-t.y, t.x));
  return max(abs(x - 0.5 * L) - 0.5 * L - 0.6 * w, abs(y) - w);
}
// Hộp xoay theo trục t, tâm c, nửa kích thước (dọc t, ngang t).
float sdOBox(vec2 p, vec2 c, vec2 t, vec2 hs) {
  vec2 q = p - c;
  return max(abs(dot(q, t)) - hs.x, abs(dot(q, vec2(-t.y, t.x))) - hs.y);
}

float gU, gHH, gW, gH, gWk, gShX;
vec2 gQ; // tọa độ trong khung đầu (đã xoay)

float sdHead(vec2 q) {
  float d = max(abs(q.x) - 0.5 * gW, abs(q.y) - 0.5 * gH);
  d = max(d, (abs(q.x) + q.y - (0.5 * gW + 0.5 * gH - 0.13 * gHH)) * 0.7071);   // vát đỉnh
  vec2 n = normalize(vec2(0.45 * gH, -0.32 * gW));                               // mặt phẳng hàm
  d = max(d, dot(vec2(abs(q.x), q.y) - vec2(0.5 * gW, -0.02 * gH), n));
  return d;
}
vec2 headQ(vec2 p) {
  vec2 r = p - vHead.xy;
  return vec2(r.x * vHead.w + r.y * vHead.z, -r.x * vHead.z + r.y * vHead.w);
}
float sdHairBack(vec2 q) { // tóc dài: mảng sau đầu chảy xuống vai
  float d = max(abs(q.x) - 0.62 * gW, max(q.y - 0.45 * gH, -q.y - 1.25 * gH));
  return max(d, (abs(q.x) - q.y * 0.18 - 0.66 * gW));
}
float sdHairTop(vec2 q, float ht) {
  if (ht < 1.5 && ht > 0.5) { // mohawk
    return max(abs(q.x + q.y * 0.15) - 0.11 * gW, max(q.y - 0.78 * gH, 0.25 * gH - q.y));
  }
  if (ht > 1.5 && ht < 2.5) { // lưỡi trai
    return max(abs(q.y - 0.24 * gH) - 0.05 * gH, abs(q.x - 0.12 * gW) - 0.66 * gW);
  }
  return 1.0;
}
float sdTorso(vec2 p) {
  float u = gU;
  vec2 a = vec2(abs(p.x), p.y);
  float d = max(0.47 * u - p.y, p.y - 0.85 * u);
  d = max(d, dot(a - vec2(0.092 * gWk * u, 0.47 * u), normalize(vec2(0.3, -0.04 * gWk))));
  d = max(d, dot(a - vec2(gShX + 0.01 * u, 0.80 * u), normalize(vec2(0.045, 0.085))));
  return d;
}
float sdHips(vec2 p) { return max(abs(p.x) - 0.1 * gWk * gU, abs(p.y - 0.455 * gU) - 0.055 * gU); }
float sdLeg(vec2 p, float s) { return sdSeg(p, vec2(s * 0.055 * gU, 0.46 * gU), vec2(s * 0.078 * gU, 0.02 * gU), 0.043 * gU); }
float sdNeck(vec2 p) { return max(abs(p.x - vHead.x * 0.5) - 0.036 * gU, max(0.78 * gU - p.y, p.y - vHead.y)); }

// Bàn tay + đồ cầm (phone / bật lửa). kind: 0 đấm, 1 sừng, 2 mở, 3 điện thoại, 4 bật lửa. sub: 0 da, 1 đồ vật, 2 màn hình
float sdHand(vec2 p, vec2 e, vec2 hd, float kind, out float sub) {
  vec2 t = normalize(hd - e);
  float u = gU;
  sub = 0.0;
  float d;
  if (kind > 1.5 && kind < 2.5) {
    d = sdOBox(p, hd + t * 0.045 * u, t, vec2(0.05, 0.03) * u);           // bàn tay mở
    d = max(d, dot(p - (hd + t * 0.09 * u), t) + abs(dot(p - hd, vec2(-t.y, t.x))) * 0.5 - 0.004 * u);
  } else {
    float hs = (kind > 0.5 && kind < 1.5) ? 1.25 : 1.0;                  // tay sừng to hơn để đọc được ở 3–6 m
    d = sdOBox(p, hd + t * 0.028 * u * hs, t, vec2(0.032, 0.031) * u * hs); // nắm đấm vuông
  }
  if (kind > 0.5 && kind < 1.5) {                                         // tay sừng: ngón trỏ + ngón út
    vec2 nn = vec2(-t.y, t.x);
    float f1 = sdOBox(p, hd + t * 0.115 * u + nn * 0.03 * u, t, vec2(0.052, 0.012) * u);
    float f2 = sdOBox(p, hd + t * 0.105 * u - nn * 0.03 * u, t, vec2(0.046, 0.012) * u);
    d = min(d, min(f1, f2));
  }
  if (kind > 2.5 && kind < 3.5) {                                         // điện thoại dọc
    float ph = sdOBox(p, hd + t * 0.07 * u, t, vec2(0.052, 0.027) * u);
    if (ph < 0.0) sub = 1.0 + step(ph, -0.006 * u);
    d = min(d, ph);
  }
  if (kind > 3.5) {                                                       // thân bật lửa
    float lt = sdOBox(p, hd + t * 0.066 * u, t, vec2(0.016, 0.011) * u);
    if (lt < 0.0) sub = 1.0;
    d = min(d, lt);
  }
  return d;
}
#endif

void main() {
#ifdef BODY
  vec2 p = vP.xy;
  if (p.x < vBox.x || p.x > vBox.y || p.y > vBox.z) discard;
  gU = vP.z;
  gHH = vMisc.w;
  gWk = vMisc.z;
  gW = 0.8 * gHH;
  gH = gHH * (1.0 - 0.2 * vMisc.x);
  gShX = abs(vBox.w);
  float sd = sign(vBox.w);
  vec2 sh1 = vec2(vBox.w, 0.80 * gU), sh2 = vec2(-vBox.w, 0.80 * gU);
  vec2 e1 = vEl.xy, e2 = vEl.zw, hd1 = vHd.xy, hd2 = vHd.zw;
  float fog = fogAmount();
  float farMix = vKey.w;
  float front = vRim.w;
  float ht = vSkin.w;
  vec3 keyC = vKey.rgb;
  vec3 rimC = vRim.rgb;
  float u = gU;
  vec2 q = headQ(p);

  if (vP.w > 0.5) {
    // ── LOD xa: bóng góc cạnh (đầu, thân + chân liền, tay thẳng) + đốm nắm đấm. Không mặt phẳng phụ.
    float dH = max(abs(q.x) - 0.42 * gHH, abs(q.y) - 0.5 * gHH);
    float dB = max(max(abs(p.x) - (0.07 + 0.07 * p.y / u) * gWk * u, p.y - 0.84 * u), -p.y);
    float dA = min(min(sdSeg(p, sh1, e1, 0.045 * u), sdSeg(p, e1, hd1, 0.04 * u)),
                   min(sdSeg(p, sh2, e2, 0.045 * u), sdSeg(p, e2, hd2, 0.04 * u)));
    float dF = min(min(dH, dB), dA);
    float dK = min(length(p - hd1), length(p - hd2)) - 0.05 * u;
    dF = min(dF, dK);
    if (dF > fwidth(dF) * 0.4) discard;
    vec3 base = dK < 0.0 ? vSkin.rgb : (dH < 0.0 ? mix(vHair.rgb, vSkin.rgb, 0.3) : mix(vCloth.rgb, vPants.rgb, smoothstep(0.55 * u, 0.4 * u, p.y)));
    vec3 c = base * (0.22 + 0.6 * keyC) * (0.8 + 0.3 * smoothstep(0.3 * u, 1.0 * u, p.y));
    c += rimC * base * 0.3 * (0.4 + 0.6 * (1.0 - smoothstep(0.0, u, p.y)));
    gl_FragColor = vec4(mix(c, fogSrgb(), fog), 1.0);
    return;
  }

  // ── LOD gần: quét các phần theo thứ tự trước → sau; phần đầu tiên chứa p thắng. ──
  float sub = 0.0;
  float part = -1.0;
  float kind1 = vHair.w, kind2 = vMisc.y;
  vec3 base = vec3(0.0);
  vec2 cen = vec2(0.0);      // tâm đường chia mặt sáng / bóng
  vec2 ax = vec2(0.0, 1.0);  // trục của phần (đường chia chạy dọc trục)
  float rimW = 0.03 * u;
  float dd;
  if ((dd = sdHand(p, e1, hd1, kind1, sub)) < 0.0) { part = 0.0; }
  else if ((dd = sdHand(p, e2, hd2, kind2, sub)) < 0.0) { part = 1.0; sub = 0.0; }
  else if (sdSeg(p, e1, hd1, 0.03 * u) < 0.0) { part = 2.0; cen = e1; ax = normalize(hd1 - e1); }
  else if (sdSeg(p, e2, hd2, 0.03 * u) < 0.0) { part = 3.0; cen = e2; ax = normalize(hd2 - e2); }
  else if (sdSeg(p, sh1, e1, 0.036 * u) < 0.0) { part = 4.0; cen = sh1; ax = normalize(e1 - sh1); }
  else if (sdSeg(p, sh2, e2, 0.036 * u) < 0.0) { part = 5.0; cen = sh2; ax = normalize(e2 - sh2); }
  else if (sdHairTop(q, ht) < 0.0) { part = 6.0; }
  else if (sdHead(q) < 0.0) { part = 7.0; }
  else if (ht < 0.5 && sdHairBack(q) < 0.0) { part = 8.0; }
  else if (sdNeck(p) < 0.0) { part = 9.0; cen = vec2(0.0, 0.8 * u); }
  else if (sdTorso(p) < 0.0) { part = 10.0; }
  else if (sdHips(p) < 0.0) { part = 11.0; cen = vec2(0.0, 0.45 * u); }
  else if (sdLeg(p, -1.0) < 0.0) { part = 12.0; cen = vec2(-0.055 * u, 0.46 * u); ax = normalize(vec2(-0.023, -0.44)); }
  else if (sdLeg(p, 1.0) < 0.0) { part = 13.0; cen = vec2(0.055 * u, 0.46 * u); ax = normalize(vec2(0.023, -0.44)); }
  if (part < 0.0) discard;

  // Facet: 0 bóng, 1 sáng, 2 đỉnh (sáng nhất), 3 rim, 4 trung gian.
  float facet = 0.0;
  vec2 L = normalize(vec2(-0.5, 1.0));   // key hồ quang từ trên-trái
  float rimHit = 0.0;
  vec2 rp = p - vec2(0.0, rimW);
  if (part < 1.5) {
    vec2 e = part < 0.5 ? e1 : e2, hd = part < 0.5 ? hd1 : hd2;
    vec2 t = normalize(hd - e);
    facet = dot(p - hd - t * 0.04 * u, L) > 0.0 ? 2.0 : (dot(p - hd, vec2(-t.y, t.x) * sign(dot(vec2(-t.y, t.x), L))) > 0.0 ? 1.0 : 0.0);
    base = vSkin.rgb;
    if (sub > 0.5) base = part < 0.5 && kind1 > 3.5 ? vec3(0.55, 0.58, 0.64) : uStCoal * 1.6;
  } else if (part < 5.5) {
    vec2 n = vec2(-ax.y, ax.x);
    n *= sign(dot(n, L) + 1e-4);
    facet = dot(p - cen, n) > 0.0 ? 1.0 : 0.0;
    float w = part < 3.5 ? 0.03 * u : 0.036 * u;
    vec2 a = part < 3.5 ? cen : cen, b = part == 2.0 ? hd1 : (part == 3.0 ? hd2 : (part == 4.0 ? e1 : e2));
    float along = dot(p - cen, ax);
    base = (part > 3.5 && along < 0.09 * u) ? vCloth.rgb : vSkin.rgb;   // tay áo ngắn
    if (part > 3.5 && along < 0.09 * u) facet = max(facet, step(0.0, dot(p - cen, L) - 0.0));
  } else if (part < 8.5) {
    // Đầu: 3 mặt (má sáng trái, má bóng phải, mặt phẳng hàm) + đỉnh.
    float headIn = sdHead(q);
    bool hair = part != 7.0;
    float topY = ht > 3.5 && ht < 4.5 ? 0.3 : 0.28;
    if (part == 7.0) {
      bool coverAll = front < 0.0 && (ht < 0.5 || ht > 4.5);
      if (ht > 2.5 && ht < 3.5) hair = false;                                   // trọc
      else if (ht > 0.5 && ht < 1.5) hair = q.y > 0.3 * gH && abs(q.x) < 0.14 * gW; // mohawk: hai bên cạo
      else hair = coverAll || q.y > topY * gH - (ht < 0.5 ? 0.0 : 0.0) || (ht < 0.5 && abs(q.x) > 0.36 * gW && q.y > -0.25 * gH);
      if (front < 0.0 && ht > 0.5 && ht < 2.5) hair = hair || q.y > 0.0;
    }
    if (hair) {
      base = vHair.rgb;
      if (ht > 1.5 && ht < 2.5) base = mix(uStCloth[4] * 0.8, uStCloth[0], step(0.15, fract(vHair.r * 37.0 + vSkin.g * 11.0))); // mũ đỏ huyết / đen
      if (ht > 3.5 && ht < 4.5 && part == 7.0 && q.y < 0.48 * gH) base = uStCloth[4] * 0.85;            // bandana
    } else {
      base = vSkin.rgb;
    }
    facet = q.x < -0.06 * gW + 0.3 * q.y ? 1.0 : 0.0;
    if (q.y > 0.36 * gH) facet = 2.0;
    else if (q.y < -0.2 * gH && part == 7.0 && !hair) facet = 4.0;
    // Hốc mắt: dải tối khi rất gần, chỉ thấy mặt trước.
    if (part == 7.0 && !hair && vPants.w > 0.5 && abs(q.y - 0.07 * gH) < 0.045 * gH && abs(q.x) < 0.3 * gW) facet = 5.0;
    rimW = 0.06 * gHH;
  } else if (part < 9.5) {
    base = vSkin.rgb * 0.8;
    facet = p.x < cen.x ? 1.0 : 0.0;
  } else if (part < 10.5) {
    // Thân: mặt vai trên (đỉnh), ngực trái sáng, phải bóng, rim dưới; áo band có tia sét trắng nhỏ.
    base = vCloth.rgb;
    facet = p.x < -0.015 * u + 0.12 * (p.y - 0.6 * u) ? 1.0 : 0.0;
    if (p.y > 0.735 * u - abs(p.x) * 0.25) facet = 2.0;
    if (vCloth.w > 0.5) {
      vec2 bq = p - vec2(0.0, 0.655 * u);
      float zig = bq.y > 0.0 ? 0.009 * u : -0.009 * u;
      if (abs(bq.y) < 0.045 * u && abs(bq.x + bq.y * 0.55 - zig) < 0.0105 * u) { base = vec3(0.95); facet = 1.0; }
    }
  } else {
    base = part < 11.5 ? vPants.rgb * 0.85 : vPants.rgb;
    if (part > 11.5 && p.y < 0.075 * u) base = uStCoal * 2.2;   // bốt
    vec2 n = vec2(-ax.y, ax.x);
    n *= sign(dot(n, L) + 1e-4);
    facet = dot(p - cen, n) > 0.0 ? 1.0 : 0.0;
    if (part < 11.5) { facet = p.x < 0.0 ? 1.0 : 0.0; }
    
  }

  // ── Tô phẳng theo mặt ──
  vec3 cool = vec3(0.86, 0.93, 1.1);
  vec3 c;
  float eye = step(4.5, facet);
  if (eye > 0.5) facet = 1.0;
  if (facet > 3.5) c = base * (0.12 + 0.35 * keyC) * cool;       // mặt phẳng hàm
  else if (facet > 1.5) c = base * (0.18 + 0.85 * keyC);               // đỉnh: hứng key từ trên
  else if (facet > 0.5) c = base * (0.14 + 0.55 * keyC);                // mặt sáng
  else c = base * (0.08 + 0.22 * keyC) * cool;                         // mặt bóng
  // Rim lửa từ dưới: mặt rim trên cạnh dưới; mặt bóng nhận chút hắt ấm.
  // Lửa từ dưới = ánh sáng định hướng mềm (không phải viền): mặt hướng xuống / quay khỏi key (mặt bóng, mặt hàm)
  // nhận tông ấm phẳng; mọi mặt nhận thêm chút ấm giảm dần lên cao. Không có dải sáng mảnh theo cạnh.
  float lowF = (facet < 0.5 || (facet > 3.5 && facet < 4.5)) ? 1.0 : 0.2;
  float fall = 1.0 - smoothstep(0.0, 1.0 * u, p.y);
  c += rimC * base * (0.5 * lowF + 0.15) * (0.4 + 0.6 * fall);
  c *= 1.0 - 0.35 * eye;   // hốc mắt: bóng nhẹ, không phải kính đen
  // LOD: trộn dần về màu phẳng của LOD xa (không lộ vòng).
  vec3 flatC = mix(vCloth.rgb, vPants.rgb, smoothstep(0.55 * u, 0.4 * u, p.y)) * (0.22 + 0.6 * keyC);
  c = mix(c, flatC, farMix * 0.7);
  gl_FragColor = vec4(mix(c, fogSrgb(), fog), 1.0);
#endif

#ifdef STICK
  vec2 m = vMetric;
  vec3 col;
  float s = vScale;
  if (vSt.w > 0.5) {
    // Ngọn lửa: lõi trắng nung + hình thoi cam, quầng nhỏ.
    vec2 fq = m - vec2(0.0, -0.035);
    float fl = abs(fq.x) * 2.2 + abs(fq.y - 0.02) * 0.9;
    float core = 1.0 - smoothstep(0.035, 0.045, fl);
    float inner = 1.0 - smoothstep(0.015, 0.022, abs(fq.x) * 2.5 + abs(fq.y - 0.005));
    float halo = exp(-dot(m, m) / (0.003 * s * s)) * 0.4;
    if (core + halo < 0.01) discard;
    col = vSt.rgb * (core + halo) + uStHot * inner * 0.8;
  } else {
    // Màn hình / đèn flash: chữ nhật sáng trắng-xanh + quầng.
    vec2 a = abs(m);
    float scr = step(a.x, 0.022) * step(a.y, 0.04);
    float halo = exp(-dot(m, m) / (0.004 * s * s)) * 0.5;
    if (scr + halo < 0.01) discard;
    col = vSt.rgb * (scr * 1.1 + halo);
  }
  col *= 1.0 - 0.7 * fogAmount();
  gl_FragColor = vec4(col, 1.0);
#endif
}
