// "Đêm Sao Điểm Ảnh" — khán giả sân (gói P2, biến thể shader của crowd.vert.glsl mặc định).
// Sprite pixel lấy từ atlas (crowdAtlas.ts), dựng THẲNG trong không gian màn hình của đích thấp (≈427×240):
// chân người bám lưới pixel, kích thước sprite = W×H texel × k (k nguyên) → không co giãn lẻ, không rung.
// 4 tầng theo cỡ chiếu: 24 / 18 / 12 / 7 px. 1/12 "Người thét", ~1/45 khách mời. Hype ≥ 80 %: cả sân ôm má.
// BODY: sprite alpha-test + depth write. STICK: quầng sao dither Bayer 4×4 (additive).

uniform float uTime;
uniform float uBeat;
uniform float uBeatPulse;
uniform float uHype;
uniform float uWaveMix;
uniform float uWavePhase;
uniform float uWaveDir;
uniform float uFlash;

uniform float uPxCheer;     // 0..1 bao hò reo ('cs-interact' cheer)
uniform float uPxScream;    // 0..1 tỉ lệ người ôm má (Hype ≥ 80 %, nới ≥ 1,2 s)
uniform float uPxHeart;     // 0..1 sao đổi hồng sen ('cs-interact' heart)
uniform vec2 uPxView;       // cỡ đích vẽ (px)
uniform vec2 uPxStar[16];   // tâm sao theo tầng × dáng
uniform vec2 uPxCloth[10];  // chỉ số bảng: áo, bóng áo
uniform vec2 uPxSkin[3];    // da, bóng da
uniform float uPxHair[8];
uniform float uPxPants[4];

attribute vec3 aPos;
attribute vec4 aSeed;
attribute vec2 aZone;
attribute float aTint;

#ifdef FOG_EXP2
uniform float fogDensity;
#endif

flat varying vec4 vOrg;   // gốc sprite (px) xy, k, lật ngang
flat varying vec4 vCell;  // ô atlas x0, y0, W, H
flat varying vec4 vIdxA;  // da, bóng da, tóc, quần
flat varying vec4 vIdxB;  // áo, bóng áo, sao, lõi sao
flat varying float vFog;  // sương theo người, lượng tử 4 bậc
#ifdef STICK
flat varying vec4 vHalo;  // tâm sao (px) xy, k, bán kính (texel)
flat varying vec2 vHaloC; // chỉ số màu, cường độ
#endif

const float PI = 3.14159265;

// "Sóng biển" (như mặc định; màu sóng kiểu Hokusai đặt ở dưới).
void oceanField(vec2 p, out float S, out float C) {
  float P = uWavePhase;
  float r1, r2, r3;
  if (uWaveDir < 0.5) {
    r1 = length(p - vec2(0.0, 10.0)); r2 = length(p - vec2(-38.0, 14.0)); r3 = length(p - vec2(30.0, 18.0));
  } else {
    float bend = 0.0045 * (p.y + 30.0) * (p.y + 30.0);
    r1 = p.x - bend; r2 = dot(p, vec2(0.97, -0.24)) - bend * 0.6; r3 = dot(p, vec2(0.94, 0.34));
  }
  float t1 = r1 * (6.2831853 / 14.0) - P;
  float t2 = r2 * (6.2831853 / 9.0) - P * 1.25 + 1.3;
  float t3 = r3 * (6.2831853 / 5.0) - P * 1.75 + 4.1;
  S = (sin(t1) + 0.45 * sin(t2) + 0.2 * sin(t3)) / 1.65;
  C = (cos(t1) + 0.45 * cos(t2) + 0.2 * cos(t3)) / 1.65;
}

void hide() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}

void main() {
  float hBeh = fract(aSeed.x * 31.71 + aSeed.w * 7.37);
  float hHair = fract(aSeed.x * 17.3 + aSeed.z * 5.17);
  float hCloth = fract(aSeed.w * 29.1 + aSeed.z * 3.33 + aSeed.x * 1.7);
  float hKind = fract(aSeed.x * 71.13 + aSeed.z * 23.7 + aSeed.w * 5.31);
  float hThr = fract(aSeed.z * 7.31 + aSeed.x * 3.17);
  float hScr = fract(aSeed.w * 53.1 + aSeed.x * 7.7);
  float u = mix(1.58, 1.78, clamp((aSeed.y - 0.9) * 5.0, 0.0, 1.0));
  float h = clamp(uHype * (0.45 + 0.75 * aSeed.w), 0.0, 1.0);
  float kind = hKind < 0.08333 ? 1.0 : (hKind < 0.1056 ? 2.0 : 0.0); // 1/12 Người thét, 1/45 khách mời
  float guestI = min(4.0, floor(fract(hKind * 977.13) * 5.0));
  float tq = floor(uTime * 12.0) / 12.0; // 12 fps

  // ── Chiếu chân người ──
  vec4 cf = projectionMatrix * viewMatrix * vec4(aPos, 1.0);
  if (cf.w < 0.6) { hide(); return; }
  float pxPerson = u * projectionMatrix[1][1] / cf.w * uPxView.y * 0.5;
  float tier = pxPerson >= 15.0 ? 0.0 : (pxPerson >= 11.0 ? 1.0 : (pxPerson >= 7.5 ? 2.0 : 3.0));
  float k = tier < 0.5 ? max(1.0, floor(pxPerson / 18.0 + 0.45)) : 1.0;
  vec4 TI = tier < 0.5 ? vec4(16.0, 24.0, 0.0, 0.0) : (tier < 1.5 ? vec4(12.0, 18.0, 24.0, 0.0)
          : (tier < 2.5 ? vec4(8.0, 12.0, 42.0, 0.0) : vec4(5.0, 7.0, 54.0, 0.0)));

  // ── Sóng biển ──
  float wm = smoothstep(0.0, 1.0, uWaveMix);
  float oT = 0.5;
  if (wm > 0.001) { float S, Cc; oceanField(aPos.xz, S, Cc); oT = 0.5 + 0.5 * S; }
  float crest = smoothstep(0.76, 0.93, oT) * wm;
  float face = smoothstep(0.56, 0.74, oT) * wm;
  float trough = (1.0 - smoothstep(0.18, 0.34, oT)) * wm;

  // ── Dáng ──
  float fl = clamp((uFlash * 0.85 - fract(hThr * 7.13 + aSeed.y * 3.1)) / 0.08, 0.0, 1.0);
  float scream = step(hScr + 0.002, uPxScream);
  float cheer = step(0.05, uPxCheer) * step(fract(hThr * 3.7), 0.85);
  float tb = fract(uBeat - aSeed.x * 0.25);
  float par = mod(floor(uBeat - aSeed.x * 0.25), 2.0);
  float isJumper = step(hBeh, 0.3);
  float up = step(hThr, h * 1.1 + fl);
  float both = max(step(0.5, crest + cheer), isJumper * step(0.62, h) * step(0.5, par));
  float pose = scream > 0.5 ? 4.0 + mod(floor(tq * 4.0 + aSeed.x * 4.0), 2.0)
             : (both > 0.5 ? 3.0 : (up > 0.5 ? 1.0 + par : 0.0));
  float col;
  if (kind > 1.5) col = 22.0 + 2.0 * guestI + max(scream, step(0.5, cheer + crest));
  else if (kind > 0.5) {
    float yell = max(max(scream, cheer), max(step(0.5, crest), step(0.9, h)));
    col = 18.0 + (yell > 0.5 ? 1.0 + mod(floor(tq * 8.0 + aSeed.x * 3.0), 3.0) : 0.0);
  } else col = min(2.0, floor(hHair * 3.0)) * 6.0 + pose;

  // ── Nhảy / nhún: dịch nguyên pixel ──
  float lift = step(0.3, h) * step(tb, 0.22);
  lift += isJumper * step(0.62, h) * floor(abs(sin(tb * PI)) * 3.0 + 0.5);
  lift += floor(crest * 3.0 + 0.5);
  lift += cheer * floor(uPxCheer * abs(sin((tq * 2.5 + aSeed.x) * PI)) * 3.0 + 0.5);

  vec2 fp = floor((cf.xy / cf.w * 0.5 + 0.5) * uPxView);
  vec2 org = vec2(fp.x - floor(TI.x * k * 0.5), fp.y + lift * k);
  float flip = (kind < 0.5 && aSeed.z < 0.5) ? 1.0 : 0.0;

  // Độ sâu: một điểm trên thân, kéo về phía camera (sprite phẳng một độ sâu).
  vec3 toCam = normalize(cameraPosition - aPos);
  vec4 cd = projectionMatrix * viewMatrix * vec4(aPos + toCam * 0.35 + vec3(0.0, 0.5, 0.0), 1.0);
  float zc = cd.z / cd.w * cf.w;

  // ── Màu theo người (chỉ số bảng 31 màu) ──
  vec2 sk = uPxSkin[int(min(2.0, floor(fract(hHair * 7.3 + aSeed.z * 2.9) * 3.0)))];
  float hairI = uPxHair[int(min(7.0, floor(fract(hHair * 11.0 + aSeed.w * 3.3) * 8.0)))];
  vec2 cl = uPxCloth[int(min(9.0, floor(hCloth * 10.0)))];
  float pants = uPxPants[int(min(3.0, floor(fract(hCloth * 3.9 + aSeed.w * 1.1) * 4.0)))];
  // Sóng: áo đổi sang sóng Hokusai — đáy tối, sườn lam Phổ, ngọn bọt trắng.
  if (trough > 0.5) cl = vec2(cl.y, cl.y);
  if (face > 0.5) cl = vec2(3.0, 2.0);
  if (crest > 0.5) cl = vec2(28.0, 27.0);
  float starI = uHype < 0.4 ? 7.0 : 6.0, coreI = 8.0;
  if (fl > 0.5) { starI = 7.0; coreI = 28.0; }
  if (uPxHeart > 0.5) { starI = 30.0; coreI = 24.0; }

  vOrg = vec4(org, k, flip);
  vCell = vec4(col * TI.x, TI.z, TI.x, TI.y);
  vIdxA = vec4(sk, hairI, pants);
  vIdxB = vec4(cl, starI, coreI);
  float fd = 0.0;
#ifdef FOG_EXP2
  fd = 1.0 - exp(-fogDensity * fogDensity * cf.w * cf.w);
#endif
  vFog = floor(fd * 4.0) / 4.0 * 0.85;

  vec2 corner;
#ifdef BODY
  corner = org + vec2((position.x + 0.5) * TI.x * k, position.y * TI.y * k);
#endif
#ifdef STICK
  // Quầng sao: chỉ người thường đang cầm sao (không ôm má), tầng 24/18/12 px.
  float hasStar = step(kind, 0.5) * step(pose, 3.5) * step(tier, 2.5);
  if (hasStar < 0.5) { hide(); return; }
  int si = int(tier) * 4 + int(pose);
  vec2 sp = uPxStar[si];
  if (flip > 0.5) sp.x = TI.x - 1.0 - sp.x;
  vec2 c0 = org + sp * k;
  float warm = smoothstep(0.4, 0.6, uHype);
  float R = (tier < 0.5 ? 3.0 : 2.0) * (1.0 + 0.5 * warm) + fl + step(0.6, uBeatPulse);
  float span = (2.0 * R + 1.0) * k;
  corner = c0 + vec2(0.5 * k) + vec2(position.x * span, (position.y - 0.5) * span);
  vHalo = vec4(c0, k, R);
  float strength = (0.45 + 0.2 * warm + 0.35 * fl) * (pose > 0.5 ? 1.0 : 0.7);
  vHaloC = vec2(uPxHeart > 0.5 ? 30.0 : (warm > 0.5 ? 6.0 : 5.0), strength);
#endif
  gl_Position = vec4((corner / uPxView * 2.0 - 1.0) * cf.w, zc, cf.w);
}
