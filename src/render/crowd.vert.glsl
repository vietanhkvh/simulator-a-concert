// Khán giả instanced (P1). Dùng chung cho 2 material: thân (BODY) và lightstick (STICK).
// Mọi chuyển động tính ở đây từ uniform; buffer instance tĩnh sau khi khởi tạo.
// Hình học gốc: quad, position.x ∈ [-0.5, 0.5], position.y ∈ [0, 1].

uniform float uTime;
uniform float uBeat;
uniform float uBeatPulse;
uniform float uHype;
uniform float uWaveMode;   // 0 đồng màu, 1 sóng quét, 2 nhấp nháy theo nhịp
uniform float uWaveMix;    // 0..1, uWaveMode == 1 làm mượt trên CPU
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uFlash;      // 0..1 "biển đèn flash điện thoại" (đoạn nhạc lắng), làm mượt trên CPU

attribute vec3 aPos;   // vị trí chân
attribute vec4 aSeed;  // pha, hệ số chiều cao, tay trái/phải + ngưỡng bật, độ nhiệt tình
attribute vec2 aZone;  // góc chuẩn hóa -1..1, khoảng cách chuẩn hóa 0..1
attribute float aTint; // độ xám bóng

varying vec2 vUv;
#ifdef USE_FOG
varying float vFogDepth;
#endif

#ifdef BODY
varying vec2 vLocal;
varying vec2 vShoulder;
varying vec2 vHand;
varying float vTint;
varying vec3 vGlow;
varying vec2 vHand2;
varying vec2 vHead;
varying vec4 vShape;   // hệ số cao, hệ số rộng, kiểu tóc 0..1, màu áo 0..1
varying vec3 vStickCol;
varying float vFront;  // 1 = camera nhìn thấy mặt trước (phía sân khấu), 0 = thấy lưng
#endif

#ifdef STICK
varying vec3 vColor;
varying vec2 vMetric;
varying float vGlowScale;
varying float vPhone;
#endif

const float PI = 3.14159265;

vec3 personalColor(float s) {
  // Mỗi fan có lightstick riêng khi chưa "đồng bộ": 4 màu.
  if (s < 0.25) return vec3(1.0, 0.25, 0.65);
  if (s < 0.5) return vec3(0.25, 0.75, 1.0);
  if (s < 0.75) return vec3(0.75, 0.35, 1.0);
  return vec3(1.0, 0.85, 0.45);
}

float hash1(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  // Hạt giống phụ suy ra từ aSeed (không thêm attribute).
  float hBeh = fract(aSeed.x * 31.71 + aSeed.w * 7.37);   // hành vi
  float hArm2 = fract(aSeed.z * 13.13 + aSeed.x * 3.91);  // tay thứ hai
  float hW = fract(aSeed.w * 19.7 + aSeed.z * 5.3);       // độ rộng
  float hHair = fract(aSeed.x * 17.3 + aSeed.z * 5.17);
  float hCloth = fract(aSeed.w * 29.1 + aSeed.z * 3.33 + aSeed.x * 1.7);
  float height = aSeed.y * (0.93 + 0.14 * fract(aSeed.z * 41.3 + aSeed.w * 2.1));
  float widthK = 0.84 + 0.32 * hW;
  float side = aSeed.z < 0.5 ? -1.0 : 1.0;
  float enth = aSeed.w;
  float h = clamp(uHype * (0.45 + 0.75 * enth), 0.0, 1.0);

  // Cực hype: gần như mọi người nhảy đồng loạt.
  float sync = smoothstep(0.82, 0.9, uHype);
  // Cơn phấn khích ngẫu nhiên: mỗi cửa sổ ~2,5 s có ~6% người "bùng nổ".
  float win = floor(uTime * 0.4 + aSeed.x * 7.0);
  float excited = step(0.94, hash1(win * 12.9898 + aSeed.w * 78.233 + aSeed.z * 4.1)) * smoothstep(0.15, 0.4, uHype);

  // Lệch pha nhỏ (~0,15 phách) để không giống robot; đồng bộ dần khi sync.
  float b = uBeat - aSeed.x * 0.15 * (1.0 - sync);
  float bs = abs(sin(b * PI));
  float bounce = pow(bs, 0.6);

  float isJumper = step(hBeh, 0.3);
  float isSwayer = step(0.3, hBeh) * step(hBeh, 0.55);
  float isClapper = step(0.55, hBeh) * step(hBeh, 0.75);
  float isBobber = step(0.75, hBeh);

  // Nhảy: chạm đất đúng phách (bs = 0 tại phách nguyên).
  float jump = max(isJumper * smoothstep(0.55, 0.7, h), max(sync * (0.6 + 0.4 * enth), excited));
  float lift = bounce * (0.02 + 0.12 * h * h) * (1.0 - jump) + pow(bs, 0.8) * 0.34 * jump * height;
  float idle = sin(uTime * 0.7 + aSeed.x * 6.2831) * 0.03 * (1.0 - h);

  // Lắc lư sang ngang chu kỳ 2 phách (người lắc lư mạnh, người khác nhẹ).
  float swayAmt = mix(0.025, 0.11, isSwayer) * (0.4 + 0.6 * h) * (1.0 - jump * 0.7);
  float lean = sin(b * PI + aSeed.x * 0.6) * swayAmt + idle * 0.5;

  // Gật đầu theo phách (mạnh hơn ở người "gật đầu" và khi hype thấp).
  float bobAmt = mix(0.012, 0.045, isBobber) * (1.0 - 0.5 * h);
  vec2 head = vec2(lean * 0.25, 1.6 * height - bobAmt * pow(1.0 - bs, 3.0));

  // Tay cầm lightstick: góc tính từ phương thẳng đứng (radian, dương = sang phải màn hình).
  float raise = max(smoothstep(0.05, 0.85, h), excited);
  float baseAngle = side * mix(0.95, 0.3, raise);
  float swing = sin(b * PI) * mix(0.12, 0.85, h) * (1.0 - isClapper * 0.8);
  float angle = baseAngle + swing + idle;
  vec2 dir = vec2(sin(angle), cos(angle));
  vec2 shoulder = vec2(side * 0.17 * widthK, 1.42) * height;
  vec2 hand = shoulder + dir * 0.6 * height;

  // Tay thứ hai: giơ (đấm nhịp) hoặc buông, tùy seed + hype.
  vec2 shoulder2 = vec2(-side * 0.17 * widthK, 1.42) * height;
  float up2 = max(step(hArm2, h * 0.9), max(excited, sync));
  float a2 = -side * (0.3 + 0.15 * sin(b * PI * 2.0 + 1.0)) - side * 0.25 * (1.0 - bounce);
  vec2 hand2Up = shoulder2 + vec2(sin(a2), cos(a2)) * 0.58 * height;
  vec2 hand2Down = shoulder2 + vec2(-side * 0.07, -0.55) * height + vec2(lean * 0.3, 0.0);
  vec2 hand2 = mix(hand2Down, hand2Up, up2);

  // Vỗ tay: hai tay chụm trên đầu đúng phách.
  float clap = isClapper * smoothstep(0.15, 0.35, h) * (1.0 - jump) * pow(1.0 - bs, 4.0);
  vec2 clapPt = vec2(side * 0.04, 1.95) * height;
  hand = mix(hand, clapPt + vec2(side * 0.03, 0.0), clap);
  hand2 = mix(hand2, clapPt - vec2(side * 0.03, 0.0), clap * step(0.5, up2 + isClapper));
  dir = normalize(hand - shoulder);

  // Đèn flash điện thoại: ngưỡng ngẫu nhiên riêng quyết định ai giơ điện thoại; uFlash càng cao
  // càng nhiều người (tối đa ~60%). phoneMix 0..1: <0,5 lightstick tắt dần, >0,5 đèn điện thoại sáng dần.
  float phoneThr = fract(aSeed.x * 23.17 + aSeed.w * 11.31 + aSeed.z * 3.71);
  float phoneMix = clamp((uFlash * 0.68 - phoneThr) / 0.08, 0.0, 1.0);
  // Tay giơ gần thẳng đứng, lắc lư rất chậm (chu kỳ ~10 s), không theo phách.
  float sway = sin(uTime * 0.6 + aSeed.x * 6.2831) * 0.16 + sin(uTime * 0.23 + aSeed.w * 9.0) * 0.06;
  float pAngle = side * 0.14 + sway;
  vec2 pDir = vec2(sin(pAngle), cos(pAngle));
  vec2 phoneHand = shoulder + pDir * 0.62 * height;
  hand = mix(hand, phoneHand, smoothstep(0.0, 1.0, phoneMix));

  // Billboard quanh trục Y hướng về camera.
  vec2 toCam = normalize(cameraPosition.xz - aPos.xz);
  vec3 right = vec3(toCam.y, 0.0, -toCam.x);

  vec2 local;   // tọa độ phẳng (m) trong mặt billboard, gốc ở chân
  vUv = position.xy + vec2(0.5, 0.0);

#ifdef BODY
  // Quad đủ rộng để chứa cả cánh tay giơ cao.
  vec2 size = vec2(1.5, 2.5) * height;
  local = vec2(position.x * size.x, position.y * size.y);
  vLocal = local;
  vShoulder = shoulder;
  vHand = hand;
  vTint = aTint;
  vHand2 = hand2;
  vHead = head;
  vShape = vec4(height, widthK, hHair, hCloth);
  vStickCol = personalColor(fract(aSeed.x * 13.7 + aSeed.w * 5.3));
  vStickCol = mix(vStickCol, mix(uColorA, uColorB, 0.5 * uWaveMix), smoothstep(0.25, 0.7, uHype));
  vFront = smoothstep(-0.15, 0.15, dot(toCam, normalize(-aPos.xz + vec2(0.0, 0.001))));
  // Ánh lightstick hắt lên vai/đầu khi đông người cùng sáng.
  vGlow = mix(uColorA, uColorB, 0.5 * uWaveMix) * (0.06 + 0.22 * uHype);
  vGlow = mix(vGlow, vec3(0.16, 0.16, 0.18), uFlash * 0.7);
  local.y += lift;
#endif

#ifdef STICK
  float onThreshold = fract(aSeed.z * 7.31 + aSeed.x * 3.17);
  float on = step(onThreshold, 0.45 + uHype * 0.55);

  // Hàng xa: phóng to quầng sáng một chút để vẫn đọc được thành "biển sáng".
  float dist = length(cameraPosition.xz - aPos.xz);
  float glowScale = 1.0 + max(0.0, dist - 10.0) * 0.04;
  vGlowScale = glowScale;
  float isPhone = step(0.5, phoneMix);
  vPhone = isPhone;
  if (isPhone > 0.5) {
    // Quad vuông nhỏ quanh đèn điện thoại (ngay trên bàn tay).
    float ps = 0.42 * (0.6 + 0.4 * glowScale);
    vMetric = vec2(position.x, position.y - 0.5) * ps;
    local = hand + pDir * 0.04 * height + vMetric;
    local.y += lift;
    on = 1.0;
  } else {
    vec2 size = vec2(0.26 * glowScale, 0.36 + 0.12 * glowScale);
    vMetric = vec2(position.x * size.x, position.y * size.y);
    vec2 perp = vec2(dir.y, -dir.x);
    vec2 base = hand - dir * 0.06 * glowScale;
    local = base + perp * vMetric.x + dir * vMetric.y;
    local.y += lift;
  }
  local *= on;

  // Màu: cá nhân → đồng màu khi hype lên; sóng quét / nhấp nháy theo chế độ.
  vec3 own = personalColor(fract(aSeed.x * 13.7 + aSeed.w * 5.3));
  vec3 group = mix(uColorA, uColorB, aSeed.x * 0.12);
  float wave = 0.5 + 0.5 * sin(aZone.x * 5.0 + aZone.y * 2.0 - uBeat * PI * 0.5);
  group = mix(group, mix(uColorA, uColorB, wave), uWaveMix);
  if (uWaveMode > 1.5) {
    float blink = step(0.5, fract(uBeat * 0.5 + step(0.0, aZone.x) * 0.5));
    group = mix(uColorA, uColorB, blink);
  }
  vec3 col = mix(own, group, smoothstep(0.25, 0.7, uHype));
  float bright = mix(0.4, 0.95, uHype) * (1.0 + uBeatPulse * 0.7 * uHype);
  bright *= mix(0.7, 1.0, wave * uWaveMix + (1.0 - uWaveMix));
  // Đoạn lắng: lightstick người khác mờ đi, người giơ điện thoại thì lightstick tắt hẳn rồi đổi sang đèn trắng.
  bright *= 1.0 - 0.75 * uFlash;
  vColor = col * bright * clamp(1.0 - phoneMix * 2.0, 0.0, 1.0);
  if (isPhone > 0.5) {
    float tw = 0.78 + 0.22 * sin(uTime * (1.3 + aSeed.w * 1.7) + aSeed.x * 40.0);
    vec3 white = mix(vec3(1.0, 0.97, 0.92), vec3(1.0, 0.86, 0.66), step(0.7, fract(aSeed.x * 7.7)));
    vColor = white * tw * clamp(phoneMix * 2.0 - 1.0, 0.0, 1.0) * (0.85 + 0.15 * uFlash);
  }
#endif

  local.x += lean * local.y;
  vec3 world = aPos + right * local.x + vec3(0.0, local.y, 0.0);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
#ifdef USE_FOG
  vFogDepth = -mvPosition.z;
#endif
}
