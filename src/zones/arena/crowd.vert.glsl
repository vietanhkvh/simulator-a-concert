// Khán giả instanced (P1) — phong cách CHIBI "Kẹo đêm" (docs/design/STYLE_GUIDE.md §3, §6 khu 3).
// Dùng chung cho 2 material: thân (BODY, SDF + alpha-test) và quầng lightstick (STICK, additive).
// Mọi chuyển động tính ở đây từ uniform; buffer instance tĩnh sau khi khởi tạo.
// Hình học gốc: quad, position.x ∈ [-0.5, 0.5], position.y ∈ [0, 1].
// Đơn vị hình khối: u = chiều cao nhân vật (1,25–1,45 m). Đầu bán kính 0,24 u → ≈ 2,1 đầu.

uniform float uTime;
uniform float uBeat;
uniform float uBeatPulse;
uniform float uHype;
uniform float uWaveMode;   // 0 đồng màu, 1 sóng quét, 2 nhấp nháy theo nhịp
uniform float uWaveMix;    // 0..1, uWaveMode == 1 (tăng/giảm tuyến tính ~1 s trên CPU)
uniform float uWavePhase;  // rad, pha "sóng biển" tích lũy theo phách trên CPU
uniform float uWaveDir;    // 0 = sóng lan ra từ sân khấu, 1 = "sóng sân vận động" trái → phải
uniform vec3 uColorA;      // hypeColors(h).primary (CPU, mỗi khung)
uniform vec3 uColorB;      // hypeColors(h).secondary
uniform float uFlash;      // 0..1 "biển đèn flash điện thoại"
uniform float uLodDist;    // m: xa hơn → bóng đơn giản (BODY) / quầng to & sáng hơn (STICK)
uniform float uFaceDist;   // m: gần hơn → vẽ mặt
uniform float uTilt;       // 0..1: billboard nghiêng về camera (nhìn từ trên cao đầu vẫn tròn)

// Token màu (sRGB 0..1) từ src/world/style — không viết hex trong GLSL.
uniform vec3 uSkin[5];
uniform vec3 uHair[8];
uniform vec3 uCloth[15];   // hue * 3 + bậc (0 = 500, 1 = 300, 2 = 700); hue: berry, grape, soda, mint, cream
uniform vec3 uMerch;       // áo merch night-300 (chấm honey-500 vẽ ở fragment)
uniform vec3 uAccent[4];   // mũ / nơ: soda-500, berry-500, mint-500, honey-500
uniform vec3 uPersonal[5]; // lightstick riêng lúc hype thấp: bậc 300
uniform vec3 uWaveCol[4];  // sóng biển: đáy grape-700, giữa mint-500, sườn soda-500, bọt cream-100
uniform vec3 uPhoneCol[2]; // đèn điện thoại: cream-500, honey-100
uniform vec3 uRimBase;     // cream-300
uniform vec3 uVividHi;     // cream-100 chớp ở hype > 80%
uniform vec3 uInk;

attribute vec3 aPos;   // vị trí chân
attribute vec4 aSeed;  // pha, hệ số chiều cao, tay trái/phải + ngưỡng bật, độ nhiệt tình
attribute vec2 aZone;  // góc chuẩn hóa -1..1, khoảng cách chuẩn hóa 0..1
attribute float aTint; // biến thiên sáng nhẹ theo người

#ifdef USE_FOG
varying float vFogDepth;
#endif

#ifdef BODY
varying vec4 vP;        // tọa độ billboard (m) xy, u, LOD xa (0/1)
flat varying vec4 vHeadV;    // tâm đầu xy, sin/cos nghiêng đầu
flat varying vec4 vHandsV;   // tay cầm que xy, tay kia xy
flat varying vec4 vStickV;   // tâm đầu que xy, hướng que xy
flat varying vec4 vBox;      // hộp bao (xMin, xMax, yMax) + vai tay cầm que x (có dấu)
flat varying vec4 vSkinV;    // da rgb, kiểu tóc 0..4
flat varying vec4 vHairV;    // tóc rgb, biểu cảm 0..3
flat varying vec4 vClothV;   // áo rgb, motif (0 không, 1 sao, 2 tim, 3 merch)
flat varying vec4 vStickColV;// màu đầu que (đặc) rgb, hình (0 sao / 1 tim) + 2 × điện thoại
flat varying vec4 vRimV;     // màu rim (đã nhân cường độ), hướng mặt (cos: 1 thấy mặt, < 0 thấy lưng)
flat varying vec4 vMiscV;    // lệch ngang của mặt, chớp mắt + 2 × có mặt, trộn sang LOD xa, độ rộng
flat varying vec3 vAccent;   // màu mũ / nơ
#endif

#ifdef STICK
varying vec2 vUv;
flat varying vec3 vColor;
varying vec2 vMetric;   // đơn vị = bán kính đầu que
flat varying float vGlowScale;
flat varying float vPhone;
flat varying float vShapeK;  // 0 sao / 1 tim
#endif

const float PI = 3.14159265;

float hash1(float n) { return fract(sin(n) * 43758.5453); }

// "Sóng biển" (uWaveMode == 1): tổng 3 đoàn sóng kiểu Gerstner (λ 14 / 9 / 5 m).
void oceanField(vec2 p, out float S, out float C, out vec2 dirMain) {
  float P = uWavePhase;
  vec2 d1, d2, d3;
  float r1, r2, r3;
  if (uWaveDir < 0.5) {
    vec2 q1 = p - vec2(0.0, 10.0);
    vec2 q2 = p - vec2(-38.0, 14.0);
    vec2 q3 = p - vec2(30.0, 18.0);
    r1 = length(q1); r2 = length(q2); r3 = length(q3);
    d1 = q1 / r1; d2 = q2 / r2; d3 = q3 / r3;
  } else {
    d1 = vec2(1.0, 0.0);
    d2 = vec2(0.97, -0.24);
    d3 = vec2(0.94, 0.34);
    float bend = 0.0045 * (p.y + 30.0) * (p.y + 30.0);
    r1 = p.x - bend; r2 = dot(p, d2) - bend * 0.6; r3 = dot(p, d3);
  }
  float t1 = r1 * (6.2831853 / 14.0) - P;
  float t2 = r2 * (6.2831853 / 9.0) - P * 1.25 + 1.3;
  float t3 = r3 * (6.2831853 / 5.0) - P * 1.75 + 4.1;
  S = (sin(t1) + 0.45 * sin(t2) + 0.2 * sin(t3)) / 1.65;
  C = (cos(t1) + 0.45 * cos(t2) + 0.2 * cos(t3)) / 1.65;
  dirMain = normalize(d1 + 0.45 * d2 + 0.2 * d3);
}

void main() {
  // Hạt giống phụ suy ra từ aSeed (không thêm attribute).
  float hBeh = fract(aSeed.x * 31.71 + aSeed.w * 7.37);   // hành vi
  float hArm2 = fract(aSeed.z * 13.13 + aSeed.x * 3.91);  // tay thứ hai
  float hW = fract(aSeed.w * 19.7 + aSeed.z * 5.3);       // độ rộng
  float hHair = fract(aSeed.x * 17.3 + aSeed.z * 5.17);
  float hCloth = fract(aSeed.w * 29.1 + aSeed.z * 3.33 + aSeed.x * 1.7);
  float u = mix(1.25, 1.45, clamp((aSeed.y - 0.9) * 5.0, 0.0, 1.0)); // chiều cao nhân vật (m)
  float widthK = 0.9 + 0.2 * hW;
  float side = aSeed.z < 0.5 ? -1.0 : 1.0;
  float enth = aSeed.w;
  float h = clamp(uHype * (0.45 + 0.75 * enth), 0.0, 1.0);

  // ── Sóng biển ──
  float wm = smoothstep(0.0, 1.0, uWaveMix);
  float oS = 0.0, oC = 0.0, oT = 0.5, oFoam = 0.0, oArm = 0.0, oCurl = 0.0, oShim = 0.0;
  vec2 oDir = vec2(0.0, -1.0);
  vec3 oCol = vec3(0.0);
  float oBright = 0.0;
  if (wm > 0.001) {
    oceanField(aPos.xz, oS, oC, oDir);
    oT = 0.5 + 0.5 * oS;
    float aS = oS * 0.8776 + oC * 0.4794;   // tay: trễ 0,5 rad
    float cS = oS * 0.4536 + oC * 0.8912;   // que: trễ 1,1 rad
    oArm = smoothstep(0.45, 0.95, 0.5 + 0.5 * aS);
    oCurl = smoothstep(0.1, 0.8, cS);
    float tw = hash1(floor(uTime * 11.0 + aSeed.x * 7.0) * 7.13 + aSeed.z * 91.7);
    float oOwn = fract(aSeed.w * 37.1 + aSeed.x * 11.9);
    float crest = smoothstep(0.76, 0.93, oT);
    oFoam = crest * smoothstep(oOwn * 0.55, oOwn * 0.55 + 0.25, crest) * (0.55 + 0.45 * tw);
    oShim = sin(dot(aPos.xz, vec2(1.9, 1.3)) - uTime * 6.5) * sin(dot(aPos.xz, vec2(-1.1, 2.3)) + uTime * 4.7);
    float rise = smoothstep(-0.35, 0.35, -oC);
    // Bảng sóng theo guide 2.3: đáy grape-700, sườn soda-500 (mặt sau mint-500), bọt cream-100.
    vec3 face = mix(uWaveCol[1], uWaveCol[2], rise);
    oCol = mix(uWaveCol[0], mix(uWaveCol[0], uWaveCol[2], 0.55), smoothstep(0.15, 0.55, oT + 0.05 * oShim));
    oCol = mix(oCol, face, smoothstep(0.5, 0.82, oT));
    oCol = mix(oCol, uWaveCol[3], oFoam);
    float hyper = smoothstep(0.8, 1.0, uHype);
    oBright = (0.5 + 0.6 * oT * oT + 1.2 * oFoam) * (1.0 + 0.18 * oShim * (1.0 - oT))
            * (1.0 + 0.45 * hyper) * (1.0 + uBeatPulse * 0.15);
  }

  // Cực hype: gần như mọi người nhảy đồng loạt.
  float sync = smoothstep(0.82, 0.9, uHype);
  // Cơn phấn khích ngẫu nhiên: mỗi cửa sổ ~2,5 s có ~6% người "bùng nổ" (kèm "pop").
  float winT = uTime * 0.4 + aSeed.x * 7.0;
  float win = floor(winT);
  float excited = step(0.94, hash1(win * 12.9898 + aSeed.w * 78.233 + aSeed.z * 4.1)) * smoothstep(0.15, 0.4, uHype);
  float popT = fract(winT) / 0.4; // giây kể từ đầu cửa sổ
  float pop = 1.0 + 0.15 * excited * sin(PI * clamp(popT / 0.25, 0.0, 1.0));

  float b = uBeat - aSeed.x * 0.15 * (1.0 - sync);
  float bs = abs(sin(b * PI));
  float bounce = pow(bs, 0.6);

  float isJumper = step(hBeh, 0.3);
  float isSwayer = step(0.3, hBeh) * step(hBeh, 0.55);
  float isClapper = step(0.55, hBeh) * step(hBeh, 0.75);
  float isBobber = step(0.75, hBeh);

  // Nhảy: chạm đất đúng phách (bs = 0 tại phách nguyên).
  float jump = max(isJumper * smoothstep(0.55, 0.7, h), max(sync * (0.6 + 0.4 * enth), excited));
  float lift = bounce * (0.015 + 0.09 * h * h) * (1.0 - jump) + pow(bs, 0.8) * 0.24 * jump * u;
  float idle = sin(uTime * 0.7 + aSeed.x * 6.2831) * 0.03 * (1.0 - h);
  float waveLift = (oT - 0.5) * 0.44 * u + 0.1 * smoothstep(0.75, 0.95, oT);
  lift = mix(lift, lift * 0.25 + waveLift, wm);

  // Squash & stretch (guide §3): nhảy — co khi tiếp đất / lấy đà, vươn khi bay lên;
  // nhún theo phách nhẹ cho người không nhảy.
  float tt = fract(b);
  float kLand = 1.0 - smoothstep(0.0, 0.16, min(tt, 1.0 - tt));
  float kUp = smoothstep(0.04, 0.16, tt) * (1.0 - smoothstep(0.3, 0.5, tt));
  float kBeat = pow(1.0 - bs, 3.0) * (0.4 + 0.6 * h) * (1.0 - jump);
  float jw = jump * (1.0 - wm);
  float sy = 1.0 + jw * (0.12 * kUp - 0.17 * kLand) - 0.06 * kBeat;
  float sx = 1.0 + jw * (0.10 * kLand - 0.06 * kUp) + 0.035 * kBeat;
  sx *= pop;
  sy *= pop;

  // Lắc lư sang ngang chu kỳ 2 phách.
  float swayAmt = mix(0.025, 0.1, isSwayer) * (0.4 + 0.6 * h) * (1.0 - jump * 0.7);
  float lean = sin(b * PI + aSeed.x * 0.6) * swayAmt + idle * 0.5;

  // Đầu: gật theo phách + nghiêng trễ ~70 ms (±8°).
  float R = 0.24 * u;
  float bobAmt = mix(0.01, 0.035, isBobber) * (1.0 - 0.5 * h) * u;
  float tiltA = sin(b * PI - 0.45) * mix(0.05, 0.14, max(isBobber, isSwayer * 0.8)) * (0.5 + 0.5 * h);
  tiltA += 0.06 * excited * sin(uTime * 9.0 + aSeed.x * 20.0);
  tiltA = clamp(tiltA, -0.14, 0.14);
  vec2 head = vec2(lean * 0.2 + tiltA * 0.12 * u, u - R - bobAmt * pow(1.0 - bs, 3.0));

  // Tay cầm lightstick: 1 đoạn (không khuỷu), góc từ phương thẳng đứng (dương = sang phải).
  float armL = 0.27 * u;
  float raise = max(smoothstep(0.05, 0.85, h), excited);
  float baseAngle = side * mix(1.45, 0.35, raise);
  float swing = sin(b * PI) * mix(0.15, 0.75, h) * (1.0 - isClapper * 0.8);
  float angle = baseAngle + swing + idle;
  vec2 tcA = normalize(cameraPosition.xz - aPos.xz + vec2(0.0, 1e-4));
  float travelR = dot(oDir, vec2(tcA.y, -tcA.x));
  float curlTilt = travelR * 0.7 * oCurl;
  angle = mix(angle, side * mix(1.3, 0.15, oArm) + curlTilt + idle, wm);
  vec2 dir = vec2(sin(angle), cos(angle));
  vec2 shoulder = vec2(side * 0.12 * widthK * u, 0.43 * u);
  vec2 hand = shoulder + dir * armL;

  // Tay thứ hai: giơ (đấm nhịp) hoặc buông, tùy seed + hype.
  vec2 shoulder2 = vec2(-side * 0.12 * widthK * u, 0.43 * u);
  float up2 = max(step(hArm2, h * 0.9), max(excited, sync));
  float a2 = -side * (0.55 + 0.2 * sin(b * PI * 2.0 + 1.0)) - side * 0.25 * (1.0 - bounce);
  vec2 hand2Up = shoulder2 + vec2(sin(a2), cos(a2)) * armL;
  vec2 hand2Down = shoulder2 + vec2(-side * 0.13, -0.2) * u + vec2(lean * 0.3, 0.0);
  vec2 hand2 = mix(hand2Down, hand2Up, up2);
  float a2w = -side * mix(1.3, 0.2, oArm) + curlTilt;
  hand2 = mix(hand2, shoulder2 + vec2(sin(a2w), cos(a2w)) * armL, wm);

  // Vỗ tay: hai bàn tay chụm trước ngực đúng phách.
  float clap = isClapper * smoothstep(0.15, 0.35, h) * (1.0 - jump) * pow(1.0 - bs, 4.0) * (1.0 - wm);
  vec2 clapPt = vec2(0.0, 0.5 * u);
  hand = mix(hand, clapPt + vec2(side * 0.05 * u, 0.0), clap);
  hand2 = mix(hand2, clapPt - vec2(side * 0.05 * u, 0.0), clap * step(0.5, up2 + isClapper));
  dir = normalize(mix(dir, normalize(hand - shoulder + vec2(0.0, 0.3 * u)), clap));

  // Đèn flash điện thoại.
  float phoneThr = fract(aSeed.x * 23.17 + aSeed.w * 11.31 + aSeed.z * 3.71);
  float phoneMix = clamp((uFlash * 0.68 - phoneThr) / 0.08, 0.0, 1.0);
  float sway = sin(uTime * 0.6 + aSeed.x * 6.2831) * 0.16 + sin(uTime * 0.23 + aSeed.w * 9.0) * 0.06;
  float pAngle = side * 0.14 + sway;
  vec2 pDir = vec2(sin(pAngle), cos(pAngle));
  vec2 phoneHand = shoulder + pDir * armL;
  float pm = smoothstep(0.0, 1.0, phoneMix);
  hand = mix(hand, phoneHand, pm);
  dir = normalize(mix(dir, pDir, pm));
  float isPhone = step(0.5, phoneMix);

  // Đầu lightstick: que ngắn mập, đầu sao / tim.
  vec2 stickHead = hand + dir * 0.25 * u;
  float stickShape = step(0.5, fract(aSeed.w * 41.7 + aSeed.x * 9.1));

  // Bật / màu lightstick (dùng chung cho thân và quầng).
  float onThreshold = fract(aSeed.z * 7.31 + aSeed.x * 3.17);
  float on = step(onThreshold, 0.45 + uHype * 0.55);
  int pIdx = int(min(4.0, floor(fract(aSeed.x * 13.7 + aSeed.w * 5.3) * 5.0)));
  vec3 own = uPersonal[pIdx];
  vec3 group = mix(uColorA, uColorB, step(0.7, fract(aSeed.x * 3.7 + aSeed.z * 1.3)));
  float warm = smoothstep(0.4, 0.8, uHype);
  float vivid = smoothstep(0.8, 0.95, uHype);
  // 40–80%: đồng bộ berry ↔ soda theo phách (mỗi nửa sân lệch nửa ô nhịp).
  float alt = step(0.5, fract(uBeat * 0.25 + step(0.0, aZone.x) * 0.5));
  group = mix(group, mix(uColorA, uColorB, alt), warm * (1.0 - vivid));
  // > 80%: berry-300 + honey-300 (nhạt hơn primary/secondary), chớp cream theo phách.
  group = mix(group, mix(group, vec3(1.0), 0.12), vivid);
  group = mix(group, uVividHi, vivid * uBeatPulse * 0.5);
  if (uWaveMode > 1.5) {
    float blink = step(0.5, fract(uBeat * 0.5 + step(0.0, aZone.x) * 0.5));
    group = mix(uColorA, uColorB, blink);
  }
  vec3 stickCol = mix(own, group, smoothstep(0.25, 0.7, uHype));
  stickCol = mix(stickCol, oCol * min(oBright, 1.3), wm);

  // Billboard: quay quanh Y về camera, rồi nghiêng (uTilt) về camera quanh chân → nhìn từ trên cao
  // (sân khấu cao 3,5 m) đầu vẫn tròn, không bị ép dẹt.
  vec2 toCam = normalize(cameraPosition.xz - aPos.xz + vec2(0.0, 1e-4));
  float camDist = length(cameraPosition - aPos);
  vec3 right = vec3(toCam.y, 0.0, -toCam.x);
  vec3 vv = normalize(cameraPosition - (aPos + vec3(0.0, 0.5 * u, 0.0)));
  vec3 upS = vec3(0.0, 1.0, 0.0) - vv * vv.y + vec3(-toCam.x, 0.0, -toCam.y) * 1e-3;
  vec3 up = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(upS), uTilt));

  vec2 local;   // tọa độ phẳng (m) trong mặt billboard, gốc ở chân

#ifdef BODY
  // LOD: ngưỡng lệch ±6 m theo từng người để không lộ ranh giới hình vòng.
  float lodJ = (aSeed.w - 0.75) * 24.0;
  float lodFar = step(uLodDist + lodJ, camDist);
  // Trộn dần sang màu LOD xa trong 12 m trước ngưỡng → đổi LOD không thấy bước nhảy.
  float farMix = smoothstep(uLodDist + lodJ - 12.0, uLodDist + lodJ, camDist);
  float nearFace = step(camDist, uFaceDist + (aSeed.x - 0.5) * 3.0);
  // Quad ôm sát hộp bao của người (tay, que, đầu + tóc) → ít fragment hơn hẳn quad cố định.
  float bw = 0.2 * widthK * u;
  float headX = 1.36 * R;
  float stickR = 0.1 * u;
  vec4 box = vec4(min(min(min(hand.x, hand2.x) - 0.07 * u, stickHead.x - stickR), min(-bw, head.x - headX)),
                  max(max(max(hand.x, hand2.x) + 0.07 * u, stickHead.x + stickR), max(bw, head.x + headX)),
                  max(max(max(hand.y, hand2.y) + 0.07 * u, stickHead.y + stickR), head.y + 1.27 * R),
                  shoulder.x);
  local = vec2(mix(box.x, box.y, position.x + 0.5), position.y * box.z);
  vBox = box;
  vP = vec4(local, u, lodFar);
  vHeadV = vec4(head, sin(tiltA), cos(tiltA));
  vHandsV = vec4(hand, hand2);
  vStickV = vec4(stickHead, dir);

  // Da / tóc / áo từ token (guide 2.2).
  int skinI = int(min(4.0, floor(fract(hHair * 7.3 + aSeed.z * 2.9) * 5.0)));
  float hc = fract(hHair * 11.0 + aSeed.w * 3.3);
  int hairI = hc < 0.7 ? int(min(4.0, floor(hc / 0.7 * 5.0))) : 5 + int(min(2.0, floor((hc - 0.7) / 0.3 * 3.0)));
  float hairType = min(4.0, floor(hHair * 5.0));
  int hue = int(min(4.0, floor(hCloth * 5.0)));
  float shR = fract(hCloth * 7.77 + aSeed.y * 3.1);
  int shade = shR < 0.3 ? 0 : (shR < 0.6 ? 1 : 2); // 60% bậc 500/300, 40% bậc 700
  vec3 cloth = uCloth[hue * 3 + shade];
  float mR = fract(hCloth * 13.3 + aSeed.x * 5.9);
  float motif = mR < 0.42 ? 1.0 : (mR < 0.66 ? 2.0 : 0.0);
  if (motif > 1.5 && hue == 0) motif = 1.0;          // áo hồng: sao thay tim
  if (fract(hCloth * 3.9 + aSeed.w * 1.1) < 0.1) { cloth = uMerch; motif = 3.0; }
  int accI = int(min(3.0, floor(fract(aSeed.z * 23.1 + aSeed.w * 7.7) * 4.0)));
  if (hairType > 3.5) accI = 0; // nơ = soda-500

  // Nhuộm theo lightstick (guide 2.2): da 0,12 · tóc 0,22 · áo 0,30, ×1,5 khi hype > 80% (da ≤ 0,2).
  float tintK = (0.5 + 0.5 * on) * (1.0 + 0.5 * vivid) * (1.0 - 0.7 * uFlash);
  vec3 tintC = mix(stickCol, uColorA, 0.5);
  vec3 skin = mix(uSkin[skinI], tintC, min(0.2, 0.12 * tintK) * 0.6);
  vec3 hair = mix(uHair[hairI], tintC, 0.22 * tintK * 0.5);
  cloth = mix(cloth, tintC, 0.3 * tintK * 0.35);
  vSkinV = vec4(skin * (0.97 + aTint), hairType);

  // Biểu cảm: 0 cười, 1 "O" reo, 2 cười tít "^ ^", 3 mắt sao (hype rất cao). Đổi mỗi ~4 s.
  float er = fract(aSeed.w * 53.1 + aSeed.x * 2.7 + floor(uTime * 0.25 + aSeed.z * 9.0) * 0.37);
  float pStar = smoothstep(0.82, 0.95, uHype) * 0.35;
  float pCheer = 0.08 + 0.4 * h;
  float expr = er < pStar ? 3.0 : (er < pStar + pCheer ? 1.0 : (er < pStar + pCheer + 0.28 ? 2.0 : 0.0));
  if (expr < 2.5 && max(excited, jump * step(0.25, bs)) > 0.5) expr = 1.0;
  vHairV = vec4(hair, expr);
  vClothV = vec4(cloth, motif);
  float blink = step(0.965, fract(uTime * 0.29 + aSeed.x * 17.0 + aSeed.w * 3.0));

  // Đầu que trong BODY: đặc, sáng (emissive 1,0) khi bật; tắt → nhựa tối.
  float bright = mix(0.55, 1.0, uHype) * (1.0 - 0.75 * uFlash);
  vec3 headCol = mix(mix(uInk, stickCol, 0.45), mix(stickCol, vec3(1.0), 0.18) * (0.75 + 0.4 * bright),
                     max(on, step(0.001, wm)));
  vStickColV = vec4(headCol, stickShape + 2.0 * isPhone);

  // Rim: mix(cream-300, màu que/hype, 0,7), cường độ 0,35 (0,5 khi hype > 80%).
  vec3 rimSrc = mix(mix(stickCol, uColorA, 0.5), oCol, wm);
  rimSrc = mix(rimSrc, uPhoneCol[0], uFlash * 0.6);
  vec2 faceDir = normalize(-aPos.xz + vec2(0.0, 0.001));
  float front = dot(toCam, faceDir);
  float sideS = toCam.x * faceDir.y - toCam.y * faceDir.x;
  vRimV = vec4(mix(uRimBase, rimSrc, 0.7) * mix(0.35, 0.5, vivid) * (1.0 + 0.6 * wm * oFoam), front);
  vMiscV = vec4(sideS, blink + 2.0 * nearFace, farMix, widthK);
  vAccent = uAccent[accI];
#endif

#ifdef STICK
  vUv = position.xy + vec2(0.5, 0.0);
  float dist = length(cameraPosition.xz - aPos.xz);
  float glowScale = 1.0 + max(0.0, dist - 10.0) * 0.04;
  float farK = smoothstep(uLodDist, uLodDist + 25.0, dist);
  glowScale *= 1.0 + 0.1 * farK;
  float foamFar = 1.0 - 0.65 * smoothstep(15.0, 50.0, dist);
  glowScale *= 1.0 + wm * (0.25 * oT + 0.6 * oFoam * foamFar);
  vGlowScale = glowScale;
  vPhone = isPhone;
  vShapeK = stickShape;
  float headR = 0.085 * u;
  if (isPhone > 0.5) {
    float ps = 0.42 * (0.6 + 0.4 * glowScale);
    vec2 m = vec2(position.x, position.y - 0.5) * ps;
    vMetric = m;
    local = hand + dir * 0.06 * u + m;
    on = 1.0;
  } else {
    // Quad vuông quanh đầu que, xoay theo hướng que.
    float qs = headR * 3.2 * glowScale;
    vec2 m = vec2(position.x, position.y - 0.5) * qs;
    vMetric = m / headR;
    vec2 perp = vec2(dir.y, -dir.x);
    local = stickHead + perp * m.x + dir * m.y;
  }
  local *= max(on, step(0.001, wm));

  float brightS = mix(0.4, 0.95, uHype) * (1.0 + uBeatPulse * 0.7 * uHype);
  brightS = mix(brightS, oBright - 0.6 * oFoam * (1.0 - foamFar), wm) * mix(1.0, max(on, wm), step(0.001, wm));
  brightS *= 1.0 - 0.75 * uFlash;
  brightS *= 1.0 - 0.3 * farK;
  vColor = (wm > 0.001 ? oCol : stickCol) * brightS * clamp(1.0 - phoneMix * 2.0, 0.0, 1.0);
  if (isPhone > 0.5) {
    float tw = 0.78 + 0.22 * sin(uTime * (1.3 + aSeed.w * 1.7) + aSeed.x * 40.0);
    vec3 white = mix(uPhoneCol[0], uPhoneCol[1], step(0.7, fract(aSeed.x * 7.7)));
    vColor = white * tw * clamp(phoneMix * 2.0 - 1.0, 0.0, 1.0) * (0.85 + 0.15 * uFlash);
  }
#endif

  local.y += lift / max(sy, 0.5);
  local.x *= sx;
  local.y *= sy;
  local.x += lean * (1.0 - 0.6 * wm) * local.y;
  local.y *= 1.0 + 0.08 * oS * wm;
  vec2 shear = oDir * (-oC * 0.14 * wm);
  vec3 world = aPos + right * local.x + up * local.y + vec3(shear.x * local.y, 0.0, shear.y * local.y);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
#ifdef USE_FOG
  vFogDepth = -mvPosition.z;
#endif
}
