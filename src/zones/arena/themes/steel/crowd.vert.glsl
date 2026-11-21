// "Thép & Lửa" — khán giả sân (gói S3, khe `crowd`, biến thể shader của crowd.vert.glsl mặc định).
// Người đa giác 6,5 đầu, mặt phẳng tô phẳng (sáng / bóng / rim), không viền, không mặt. Tay: nắm đấm, tay sừng,
// bàn tay mở, ĐIỆN THOẠI (~30 %), BẬT LỬA (~12 %, nhiều hơn khi Hype thấp / chế độ flash).
// BODY: thân alpha-test + depth write. STICK: màn hình điện thoại + ngọn lửa bật lửa (additive).
// Chuyển động nặng: đấm theo phách (lên 60 ms, xuống 240 ms), head-bang, nhảy khi Hype cao, đẩy xô; sóng = SÓNG MOSH.
// Hình gốc: quad, position.x ∈ [-0.5, 0.5], position.y ∈ [0, 1]. Đơn vị: m, gốc ở chân.

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
uniform float uFaceDist;
uniform float uTilt;

// Token "Thép & Lửa" (sRGB 0..1) — đặt từ crowd.ts, không viết hex trong GLSL.
uniform vec3 uStSkin[5];
uniform vec3 uStHair[8];
uniform vec3 uStCloth[6];  // đen, than, than sáng, denim, đỏ huyết, thép tối
uniform vec3 uStDenim;
uniform vec3 uStArc;       // key lạnh từ trên
uniform vec3 uStTung;      // rim tungsten (Hype vừa)
uniform vec3 uStFire;      // rim lửa cam
uniform vec3 uStBlood;     // rim đỏ "Lửa lớn"
uniform vec3 uStHot;       // trắng nung (ngọn lửa)
uniform vec3 uStPhone;     // màn hình điện thoại trắng-xanh
uniform vec3 uStCoal;

attribute vec3 aPos;
attribute vec4 aSeed;
attribute vec2 aZone;
attribute float aTint;

#ifdef USE_FOG
varying float vFogDepth;
#endif

#ifdef BODY
varying vec4 vP;              // local xy, u, LOD xa
flat varying vec4 vHead;      // tâm đầu xy, sin/cos nghiêng
flat varying vec4 vEl;        // khuỷu tay 1 xy, khuỷu tay 2 xy
flat varying vec4 vHd;        // bàn tay 1 xy, bàn tay 2 xy
flat varying vec4 vBox;       // xMin, xMax, yMax, vai tay 1 x (có dấu)
flat varying vec4 vSkin;      // da rgb, kiểu tóc
flat varying vec4 vHair;      // tóc rgb, đồ tay 1 (0 đấm, 1 sừng, 2 mở, 3 điện thoại, 4 bật lửa)
flat varying vec4 vCloth;     // áo rgb, áo band (0/1)
flat varying vec4 vPants;     // quần rgb, gần (hốc mắt)
flat varying vec4 vRim;       // màu rim × cường độ, hướng mặt (1 thấy mặt)
flat varying vec4 vKey;       // màu key × cường độ, trộn sang LOD xa
flat varying vec4 vMisc;      // gật đầu 0..1, đồ tay 2 (0 đấm / 1 sừng), độ rộng, chiều cao đầu
#endif

#ifdef STICK
varying vec2 vMetric;         // tọa độ trong quad (m)
flat varying vec4 vSt;        // màu rgb, kiểu (0 điện thoại / 1 bật lửa)
flat varying float vScale;
#endif

const float PI = 3.14159265;
float hash1(float n) { return fract(sin(n) * 43758.5453); }

// "Sóng mosh": đoàn sóng dày, mặt sóng răng cưa, lăn qua đám đông; S ∈ -1..1 (đỉnh = 1), C = đạo hàm pha.
void moshField(vec2 p, out float S, out float C, out vec2 dir) {
  float P = uWavePhase;
  float r1;
  if (uWaveDir < 0.5) { vec2 q = p - vec2(0.0, 6.0); r1 = length(q); dir = q / max(r1, 1e-3); }
  else { dir = normalize(vec2(1.0, -0.12)); r1 = dot(p, dir) - 0.004 * (p.y + 30.0) * (p.y + 30.0); }
  float r2 = dot(p, vec2(-0.6, -0.8));
  float rag = sin(p.x * 0.8 + p.y * 1.3) * 0.55 + sin(p.x * 2.3 - p.y * 1.7) * 0.25;
  float t1 = r1 * (6.2831853 / 10.0) - P * 1.2 + rag;
  float t2 = r2 * (6.2831853 / 6.0) - P * 1.7 + 2.0;
  S = 0.78 * sin(t1) + 0.22 * sin(t2);
  C = 0.78 * cos(t1) + 0.22 * cos(t2);
}

void main() {
  float hBeh = fract(aSeed.x * 31.71 + aSeed.w * 7.37);
  float hArm2 = fract(aSeed.z * 13.13 + aSeed.x * 3.91);
  float hW = fract(aSeed.w * 19.7 + aSeed.z * 5.3);
  float hHair = fract(aSeed.x * 17.3 + aSeed.z * 5.17);
  float hCloth = fract(aSeed.w * 29.1 + aSeed.z * 3.33 + aSeed.x * 1.7);
  float hItem = fract(aSeed.x * 23.17 + aSeed.w * 11.31 + aSeed.z * 3.71);
  float u = mix(1.58, 1.86, clamp((aSeed.y - 0.9) * 5.0, 0.0, 1.0)); // chiều cao (m)
  float HH = u / 6.5;                                                  // chiều cao đầu
  float wk = 0.9 + 0.22 * hW;
  float side = aSeed.z < 0.5 ? -1.0 : 1.0;
  float enth = aSeed.w;
  float h = clamp(uHype * (0.45 + 0.75 * enth), 0.0, 1.0);
  float vivid = smoothstep(0.78, 0.9, uHype);

  // ── Đồ trên tay 1 (theo seed): 30 % điện thoại, 12 % bật lửa (+ tới 10 % khi Hype thấp), còn lại đấm / sừng / mở.
  float lowH = 1.0 - smoothstep(0.2, 0.6, uHype);
  float item = hItem < 0.30 ? 3.0 : (hItem < 0.42 + 0.10 * lowH ? 4.0 : (hItem < 0.72 ? 0.0 : (hItem < 0.9 ? 1.0 : 2.0)));
  // Chế độ flash: biển đèn điện thoại + bật lửa.
  float flashThr = fract(hItem * 7.13 + aSeed.y * 3.1);
  float fl = clamp((uFlash * 0.8 - flashThr) / 0.08, 0.0, 1.0);
  if (fl > 0.5 && item < 2.5) item = fract(hItem * 13.7) < 0.68 ? 3.0 : 4.0;
  float isLight = step(2.5, item);
  float item2 = step(0.6, fract(hArm2 * 5.3 + aSeed.w)) * step(0.5, h); // tay 2: đấm, Hype cao có tay sừng

  // ── Sóng mosh ──
  float wm = smoothstep(0.0, 1.0, uWaveMix);
  float mS = 0.0, mC = 0.0, crest = 0.0;
  vec2 mDir = vec2(0.0, -1.0);
  if (wm > 0.001) {
    moshField(aPos.xz, mS, mC, mDir);
    crest = smoothstep(0.35, 0.92, mS) * wm;
  }

  // ── Nhịp: đấm lên nhanh 60 ms (≈ 0,12 phách ở 120 BPM), hạ 240 ms (≈ 0,48 phách) ──
  float sync = smoothstep(0.82, 0.9, uHype);
  float b = uBeat - aSeed.x * 0.1 * (1.0 - sync);
  float tb = fract(b);
  float pump = tb < 0.12 ? smoothstep(0.0, 0.12, tb) : 1.0 - smoothstep(0.12, 0.6, tb);
  float bs = abs(sin(b * PI));

  float isJumper = step(hBeh, 0.28);
  float isBanger = step(0.28, hBeh) * step(hBeh, 0.55);
  float jump = max(isJumper * smoothstep(0.62, 0.8, h), sync * (0.5 + 0.5 * enth)) * (1.0 - wm);
  float lift = pow(bs, 0.8) * 0.16 * u * jump - 0.012 * u * pump * (1.0 - jump);
  lift += wm * (0.05 * u * mS + 0.09 * u * crest * bs);

  // Đẩy xô: lắc ngang theo vùng (cả cụm cùng nghiêng) + nghiêng theo phách.
  float shove = sin(aPos.x * 0.35 + aPos.z * 0.22 + uTime * 1.1) * sin(uTime * 0.37 + aPos.z * 0.15 + aPos.x * 0.1);
  float lean = shove * (0.02 + 0.07 * h) + sin(b * PI + aSeed.x * 2.0) * 0.015 * (0.5 + h);

  // Head-bang: gật mạnh theo phách (đầu hạ + ngắn lại), nghiêng ±5°.
  float bang = mix(0.25, 1.0, isBanger) * (0.25 + 0.75 * h);
  float nod = pump * bang;
  float tiltA = sin(b * PI * 0.5 + aSeed.x * 6.0) * 0.087 * (0.4 + 0.6 * h);
  vec2 head = vec2(lean * 0.4 * u + tiltA * 0.1 * HH, u - 0.5 * HH - nod * 0.28 * HH);

  // ── Tay (2 đoạn, khuỷu) ──
  float shX = 0.125 * wk * u, shY = 0.80 * u;
  float L1 = 0.175 * u, L2 = 0.16 * u;
  vec2 sh1 = vec2(side * shX, shY);
  vec2 sh2 = vec2(-side * shX, shY);
  float thr1 = fract(aSeed.z * 7.31 + aSeed.x * 3.17);
  float up1 = isLight > 0.5 ? smoothstep(thr1 - 0.05, thr1, 0.4 + 0.55 * h + fl) : smoothstep(thr1 - 0.06, thr1, 0.12 + 0.95 * h);
  up1 = max(up1, crest * step(0.25, hArm2));
  float up2 = max(smoothstep(hArm2 - 0.06, hArm2, h * 0.95 - 0.25), max(sync * step(0.3, hArm2), crest * step(0.6, hArm2)));
  // giơ: cánh tay trên chếch ra ngoài, cẳng tay gần thẳng đứng; đấm theo phách duỗi thẳng lên.
  float pumpK = (1.0 - isLight) * (0.35 + 0.65 * h);
  float sway = sin(uTime * 0.6 + aSeed.x * 6.2831) * 0.12;
  float a1 = side * (mix(1.0, 0.35, pump * pumpK) - isLight * 0.25 + isLight * sway * 0.5);
  float f1 = side * (mix(-0.15, 0.06, pump * pumpK) + isLight * (0.05 + sway));
  vec2 e1Up = sh1 + L1 * vec2(sin(a1), cos(a1));
  vec2 h1Up = e1Up + L2 * vec2(sin(f1), cos(f1));
  vec2 e1Dn = sh1 + L1 * normalize(vec2(side * 0.2, -1.0));
  vec2 h1Dn = e1Dn + L2 * normalize(vec2(side * 0.02 - lean, -1.0));
  vec2 e1 = mix(e1Dn, e1Up, up1), hd1 = mix(h1Dn, h1Up, up1);
  float pump2 = (0.35 + 0.65 * h);
  float a2 = -side * mix(0.95, 0.3, pump * pump2);
  float f2 = -side * mix(-0.2, 0.08, pump * pump2);
  vec2 e2Up = sh2 + L1 * vec2(sin(a2), cos(a2));
  vec2 h2Up = e2Up + L2 * vec2(sin(f2), cos(f2));
  vec2 e2Dn = sh2 + L1 * normalize(vec2(-side * 0.22, -1.0));
  vec2 h2Dn = e2Dn + L2 * normalize(vec2(-side * 0.04 - lean, -1.0));
  vec2 e2 = mix(e2Dn, e2Up, up2), hd2 = mix(h2Dn, h2Up, up2);

  // ── Billboard (như mặc định: quay về camera + nghiêng uTilt) ──
  vec2 toCam = normalize(cameraPosition.xz - aPos.xz + vec2(0.0, 1e-4));
  float camDist = length(cameraPosition - aPos);
  vec3 right = vec3(toCam.y, 0.0, -toCam.x);
  vec3 vv = normalize(cameraPosition - (aPos + vec3(0.0, 0.5 * u, 0.0)));
  vec3 upS = vec3(0.0, 1.0, 0.0) - vv * vv.y + vec3(-toCam.x, 0.0, -toCam.y) * 1e-3;
  vec3 up = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(upS), uTilt));
  vec2 faceDir = normalize(-aPos.xz + vec2(0.0, 0.001));
  float front = dot(toCam, faceDir);
  // Sóng mosh: người nghiêng theo hướng sóng đi (thành phần ngang trên màn hình).
  float travelR = dot(mDir, vec2(toCam.y, -toCam.x));
  lean += wm * (travelR * mC * 0.16 + crest * travelR * 0.06);

  // ── Ánh sáng: key hồ quang lạnh từ trên, rim lửa ấm từ dưới ──
  float nearStage = 1.0 - smoothstep(8.0, 40.0, length(aPos.xz));
  float burst = uBeatPulse * smoothstep(0.6, 0.7, uHype) * (0.4 + 0.6 * nearStage);
  vec3 rimCol = mix(uStTung, uStFire, smoothstep(0.35, 0.7, uHype));
  rimCol = mix(rimCol, mix(uStFire, uStBlood, 0.55), vivid);
  float rimI = 0.18 + 0.55 * smoothstep(0.2, 0.9, uHype) * (0.6 + 0.4 * nearStage) + 0.45 * burst + 0.35 * vivid;
  rimCol = mix(rimCol, uStFire, crest);
  rimI = mix(rimI, rimI * 0.25 + 1.1 * crest, wm);
  rimCol = mix(rimCol, uStPhone, uFlash * 0.55);
  float keyI = mix(1.0, 0.32, vivid) * (0.8 + 0.2 * (1.0 - nearStage)) * (1.0 - 0.45 * wm * (1.0 - crest));
  keyI *= 1.0 - 0.3 * uFlash;

  vec2 local;

#ifdef BODY
  float lodJ = (aSeed.w - 0.75) * 24.0;
  float lodFar = step(uLodDist + lodJ, camDist);
  float farMix = smoothstep(uLodDist + lodJ - 12.0, uLodDist + lodJ, camDist);
  float nearFace = step(camDist, 9.0 + (aSeed.x - 0.5) * 2.0) * step(0.25, front);
  float tall = max(max(hd1.y, hd2.y) + 0.17 * u, head.y + 0.72 * HH);
  vec4 box = vec4(min(min(min(hd1.x, hd2.x), min(e1.x, e2.x)) - 0.08 * u, min(-shX - 0.04 * u, head.x - 0.6 * HH)),
                  max(max(max(hd1.x, hd2.x), max(e1.x, e2.x)) + 0.08 * u, max(shX + 0.04 * u, head.x + 0.6 * HH)),
                  tall, sh1.x);
  local = vec2(mix(box.x, box.y, position.x + 0.5), position.y * box.z);
  vBox = box;
  vP = vec4(local, u, lodFar);
  vHead = vec4(head, sin(tiltA), cos(tiltA));
  vEl = vec4(e1, e2);
  vHd = vec4(hd1, hd2);

  int skinI = int(min(4.0, floor(fract(hHair * 7.3 + aSeed.z * 2.9) * 5.0)));
  float hc = fract(hHair * 11.0 + aSeed.w * 3.3);
  int hairI = int(min(7.0, floor(hc * 8.0)));
  float hairType = min(5.0, floor(hHair * 6.0)); // 0 tóc dài, 1 mohawk, 2 mũ lưỡi trai, 3 trọc, 4 bandana, 5 tóc ngắn
  int ci = hCloth < 0.28 ? 0 : (hCloth < 0.5 ? 1 : (hCloth < 0.62 ? 2 : (hCloth < 0.82 ? 3 : (hCloth < 0.9 ? 4 : 5))));
  vec3 cloth = uStCloth[ci];
  float band = step(fract(hCloth * 13.3 + aSeed.x * 5.9), 0.28) * step(float(ci), 1.5); // áo band đen / than: tia sét trắng
  vec3 pants = fract(hCloth * 3.9 + aSeed.w * 1.1) < 0.45 ? uStDenim : uStCloth[0];
  float tint = 0.94 + aTint * 2.0;
  vSkin = vec4(uStSkin[skinI] * tint, hairType);
  vHair = vec4(uStHair[hairI], item);
  vCloth = vec4(cloth * tint, band);
  vPants = vec4(pants, nearFace);
  vRim = vec4(rimCol * rimI, front);
  vKey = vec4(uStArc * keyI, farMix);
  vMisc = vec4(nod, item2, wk, HH);
#endif

#ifdef STICK
  // Màn hình điện thoại / ngọn lửa bật lửa ở tay 1 (chỉ khi cầm đèn và tay đang giơ).
  float dist = length(cameraPosition.xz - aPos.xz);
  float sc = 1.0 + max(0.0, dist - 12.0) * 0.008;
  vScale = sc;
  vec2 fdir = normalize(hd1 - e1);
  float isLighter = step(3.5, item);
  vec2 anchor = isLighter > 0.5 ? hd1 + fdir * 0.055 * u + vec2(0.0, 0.03 * u) : hd1 + fdir * 0.05 * u;
  float qs = (isLighter > 0.5 ? 0.22 : 0.34) * sc;
  vec2 m = vec2(position.x, position.y - 0.5) * qs;
  vMetric = m / sc;
  local = anchor + m;
  float show = isLight * smoothstep(0.5, 0.9, up1);
  local *= step(0.01, show);
  float tw = 0.8 + 0.2 * sin(uTime * (1.3 + aSeed.w * 1.7) + aSeed.x * 40.0);
  float flick = 0.75 + 0.25 * hash1(floor(uTime * 14.0) + aSeed.x * 91.0);
  vec3 c = isLighter > 0.5 ? mix(uStFire, uStHot, 0.45) * flick * 1.15 : uStPhone * tw * (0.85 + 0.25 * uFlash);
  c *= show * mix(1.0, 0.22, smoothstep(12.0, 45.0, dist));
  vSt = vec4(c, isLighter);
#endif

  local.y += lift;
  local.x += lean * local.y;
  vec2 shear = mDir * (-mC * 0.12 * wm);
  vec3 world = aPos + right * local.x + up * local.y + vec3(shear.x * local.y, 0.0, shear.y * local.y);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
#ifdef STICK
  mvPosition.xyz += normalize(-mvPosition.xyz) * 0.25;
#endif
  gl_Position = projectionMatrix * mvPosition;
#ifdef USE_FOG
  vFogDepth = -mvPosition.z;
#endif
}
