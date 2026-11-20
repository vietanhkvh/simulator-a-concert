// "Mực & Sơn mài" — khán giả sân (gói L4): người vệt cọ ≈ 7 đầu cầm đèn lồng trên que ngắn.
// Cùng attribute / uniform chung với crowd.vert.glsl mặc định (JS của crowd.ts giữ nguyên); 2 material BODY / STICK.
// Lắc chậm 2 phách (không nảy); Hype cao: giơ đèn cao, lắc đồng loạt; cơn phấn khích = nhấc đèn nhanh.
// Sóng biển → sóng đèn giơ cao (đỉnh vàng quỳ, đáy ngọc); flash → nến / đèn điện thoại trắng nhỏ.

uniform float uTime;
uniform float uBeat;
uniform float uBeatPulse;
uniform float uHype;
uniform float uWaveMode;
uniform float uWaveMix;
uniform float uWavePhase;
uniform float uWaveDir;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uFlash;
uniform float uLodDist;
uniform float uTilt;

uniform vec3 uLqCloth[8];  // chàm 500/700, ngọc 500/700, sơn then 100, son 700, cam 700, vỏ trứng 700
uniform vec3 uLqSkin[5];
uniform vec3 uLqScarf[4];  // khăn: son, vàng, chàm, ngọc
uniform vec3 uLqLant[4];   // đèn lồng đỏ, cam, hoa sen hồng, ông sao
uniform vec3 uLqWave[4];   // đáy ngọc 700, ngọc 500, vàng 500, vàng 100
uniform vec3 uLqPhone[2];  // vỏ trứng 100, cam 100 (nến)

attribute vec3 aPos;
attribute vec4 aSeed;
attribute vec2 aZone;
attribute float aTint;

#ifdef USE_FOG
varying float vFogDepth;
#endif

#ifdef BODY
varying vec2 vL;
flat varying vec4 vHead;   // tâm đầu xy, R, kiểu (0 tóc, 1 nón lá, 2 khăn, 3 búi)
flat varying vec4 vArm;    // vai xy, tay xy
flat varying vec4 vLant;   // tâm đèn xy, bán kính, hình (0 tròn, 1 bầu, 2 sen, 3 sao; +10 = nến)
flat varying vec4 vBK;     // u, lean, seed, LOD xa
flat varying vec4 vCloth;  // màu áo, mặt trước (cos)
flat varying vec3 vSkin;
flat varying vec3 vHatC;
flat varying vec4 vLantC;  // màu đèn, độ sáng
#endif

#ifdef STICK
varying vec2 vM;
flat varying vec4 vColor;  // rgb, nến
#endif

const float PI = 3.14159265;
float hash1(float n) { return fract(sin(n) * 43758.5453); }

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
  float hA = fract(aSeed.w * 29.1 + aSeed.z * 3.33 + aSeed.x * 1.7);
  float hB = fract(aSeed.x * 17.3 + aSeed.z * 5.17);
  float hC = fract(aSeed.z * 13.13 + aSeed.x * 3.91);
  float hD = fract(aSeed.x * 23.17 + aSeed.w * 11.31 + aSeed.z * 3.71);
  float u = mix(1.55, 1.75, clamp((aSeed.y - 0.9) * 5.0, 0.0, 1.0));
  float R = u / 14.0;
  float side = aSeed.z < 0.5 ? -1.0 : 1.0;
  float h = clamp(uHype * (0.45 + 0.75 * aSeed.w), 0.0, 1.0);

  // ── sóng đèn ──
  float wm = smoothstep(0.0, 1.0, uWaveMix);
  float oS = 0.0, oC = 0.0, oT = 0.5;
  vec2 oDir = vec2(0.0, -1.0);
  if (wm > 0.001) {
    oceanField(aPos.xz, oS, oC, oDir);
    oT = 0.5 + 0.5 * (oS * 0.8776 + oC * 0.4794);
  }

  float sync = smoothstep(0.82, 0.92, uHype);
  float winT = uTime * 0.4 + aSeed.x * 7.0;
  float excited = step(0.94, hash1(floor(winT) * 12.9898 + aSeed.w * 78.233 + aSeed.z * 4.1)) * smoothstep(0.15, 0.4, uHype);
  float popT = fract(winT) / 0.4;
  float spike = excited * sin(PI * clamp(popT / 0.9, 0.0, 1.0));

  float b = uBeat - aSeed.x * 0.35 * (1.0 - sync);
  float sw = sin(b * PI * 0.5 + aSeed.w * 2.0 * (1.0 - sync)); // một nhịp lắc qua lại = 4 phách → mỗi bên 2 phách
  float lean = sw * mix(0.02, 0.055, h) * (1.0 - 0.6 * wm) + sin(uTime * 0.45 + aSeed.x * 6.28) * 0.01;

  vec2 head = vec2(lean * (u - R), u - R);

  // tay cầm đèn: thấp ngang ngực → giơ cao theo Hype / sóng / phấn khích
  float raise = max(smoothstep(0.15, 0.9, h), sync);
  raise = mix(raise, smoothstep(0.35, 0.9, oT) * 1.05, wm);
  raise = clamp(raise + spike * 0.8, 0.0, 1.1);
  vec2 shoulder = vec2(side * 0.1 * u + lean * 0.81 * u, 0.81 * u);
  float armL = 0.34 * u;
  float aAng = side * mix(2.75, 0.3, raise);
  vec2 hand = shoulder + vec2(sin(aAng), cos(aAng)) * armL;
  float sAng = sw * mix(0.1, 0.28, h) * (1.0 - 0.5 * wm) + side * 0.06;
  vec2 dir = vec2(sin(sAng), cos(sAng));

  // nến / điện thoại
  float phoneMix = clamp((uFlash * 0.62 - hD) / 0.08, 0.0, 1.0);
  float isPhone = step(0.5, phoneMix);
  vec2 candleHand = vec2(side * 0.04 * u, 0.62 * u + 0.04 * sin(uTime * 0.6 + aSeed.x * 6.0));
  hand = mix(hand, candleHand, smoothstep(0.0, 1.0, phoneMix));
  dir = normalize(mix(dir, vec2(0.0, 1.0), phoneMix));

  float shapeR = fract(aSeed.w * 41.7 + aSeed.x * 9.1);
  float shape = shapeR < 0.55 ? 0.0 : (shapeR < 0.75 ? 1.0 : (shapeR < 0.94 ? 2.0 : 3.0));
  float lr = 0.07 * u * (0.9 + 0.25 * hC) * (shape > 1.5 ? 1.15 : 1.0);
  float stickL = 0.26 * u;
  vec2 lant = hand + dir * (stickL + lr);
  if (isPhone > 0.5) { lr = 0.03 * u; lant = hand + vec2(0.0, 0.05 * u); }

  // màu đèn
  vec3 own = uLqLant[int(shape)];
  vec3 group = mix(uColorA, uColorB, step(0.6, hC));
  float vivid = smoothstep(0.78, 0.92, uHype);
  vec3 lantC = mix(own, group, vivid * 0.85);
  float mid = smoothstep(0.4, 0.55, uHype) * (1.0 - vivid);
  float fly = 0.72 + 0.28 * sin(uTime * (0.9 + hB * 1.3) + aSeed.x * 40.0);  // đom đóm lệch pha khi Hype thấp
  float bright = mix(fly * 0.75, 1.0, smoothstep(0.3, 0.6, uHype));
  bright *= 1.0 + mid * 0.25 * uBeatPulse + vivid * 0.2 * uBeatPulse;
  vec3 waveC = mix(mix(uLqWave[0], uLqWave[1], smoothstep(0.1, 0.4, oT)), mix(uLqWave[2], uLqWave[3], smoothstep(0.85, 0.97, oT)), smoothstep(0.4, 0.7, oT));
  lantC = mix(lantC, waveC, wm);
  bright = mix(bright, 0.3 + 0.95 * oT * oT, wm);
  bright *= 1.0 - 0.6 * uFlash * (1.0 - isPhone);
  if (isPhone > 0.5) { lantC = mix(uLqPhone[0], uLqPhone[1], step(0.5, hB)); bright = 1.0; }

  // billboard (như crowd mặc định)
  vec2 toCam = normalize(cameraPosition.xz - aPos.xz + vec2(0.0, 1e-4));
  float camDist = length(cameraPosition - aPos);
  vec3 right = vec3(toCam.y, 0.0, -toCam.x);
  vec3 vv = normalize(cameraPosition - (aPos + vec3(0.0, 0.5 * u, 0.0)));
  vec3 upS = vec3(0.0, 1.0, 0.0) - vv * vv.y + vec3(-toCam.x, 0.0, -toCam.y) * 1e-3;
  vec3 up = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(upS), uTilt));
  vec2 local;

#ifdef BODY
  float lodJ = (aSeed.w - 0.75) * 24.0;
  float lodFar = step(uLodDist + lodJ, camDist);
  float hatR = fract(hA * 7.7 + aSeed.y * 3.1);
  float hat = hatR < 0.3 ? 1.0 : (hatR < 0.55 ? 2.0 : (hatR < 0.7 ? 3.0 : 0.0));
  float hatW = hat > 0.5 && hat < 1.5 ? 0.15 * u : R * 1.25;
  float hatTop = hat > 0.5 && hat < 1.5 ? head.y + R * 0.2 + 0.11 * u : head.y + R * 1.15;
  float lr2 = lr * 1.35;
  vec4 box = vec4(min(min(-0.14 * u, hand.x - 0.03 * u), min(lant.x - lr2, head.x - hatW)),
                  max(max(0.14 * u, hand.x + 0.03 * u), max(lant.x + lr2, head.x + hatW)),
                  max(hatTop, lant.y + lr2), 0.0);
  local = vec2(mix(box.x, box.y, position.x + 0.5), position.y * box.z);
  vL = local;
  vHead = vec4(head, R, hat);
  vArm = vec4(shoulder, hand);
  vLant = vec4(lant, lr, shape + 10.0 * isPhone);
  vec2 faceDir = normalize(-aPos.xz + vec2(0.0, 0.001));
  vBK = vec4(u, lean, fract(aSeed.x * 91.7 + aSeed.w * 13.1), lodFar);
  int ci = int(min(7.0, floor(hA * 8.0)));
  vCloth = vec4(uLqCloth[ci] * (0.94 + aTint * 2.0), dot(toCam, faceDir));
  vSkin = uLqSkin[int(min(4.0, floor(hB * 5.0)))];
  vHatC = hat < 1.5 ? mix(uLqCloth[7], vec3(0.95, 0.88, 0.7), 0.35) : uLqScarf[int(min(3.0, floor(hC * 4.0)))];
  vLantC = vec4(lantC, bright);
#endif

#ifdef STICK
  float dist = length(cameraPosition.xz - aPos.xz);
  float gs = 1.0 + max(0.0, dist - 12.0) * 0.012;
  float qs = lr * (isPhone > 0.5 ? 4.0 : 3.6) * gs * (1.0 + 0.25 * wm * oT);
  vec2 m = vec2(position.x, position.y - 0.5) * 2.0;
  vM = m;
  local = lant + m * qs;
  vec3 c = lantC * bright * (isPhone > 0.5 ? 0.9 : 0.55);
  c *= mix(1.0, 0.3, smoothstep(12.0, 70.0, dist));
  vColor = vec4(c, isPhone);
#endif

  vec3 world = aPos + right * local.x + up * local.y;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
#ifdef STICK
  mvPosition.xyz += normalize(-mvPosition.xyz) * 0.12;
#endif
  gl_Position = projectionMatrix * mvPosition;
#ifdef USE_FOG
  vFogDepth = -mvPosition.z;
#endif
}
