// "Đêm Sao Điểm Ảnh" — khán giả sân (gói P2). BODY: tra atlas bằng texelFetch theo toạ độ pixel màn hình
// (nearest tuyệt đối), mã vùng → chỉ số bảng 31 màu. STICK: quầng sao dither Bayer 4×4 bám theo ngôi sao.

#ifdef USE_FOG
uniform vec3 fogColor;
#endif
uniform sampler2D uPxAtlas;
uniform vec3 uPxPal[31];

flat varying vec4 vOrg;
flat varying vec4 vCell;
flat varying vec4 vIdxA;
flat varying vec4 vIdxB;
flat varying float vFog;
#ifdef STICK
flat varying vec4 vHalo;
flat varying vec2 vHaloC;
#endif

vec3 fogSrgb() {
#ifdef USE_FOG
  return pow(max(fogColor, vec3(0.0)), vec3(0.4545));
#else
  return vec3(0.0);
#endif
}

float bayer4(vec2 p) {
  vec2 q = mod(p, 4.0);
  int i = int(q.x) + int(q.y) * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}

void main() {
#ifdef BODY
  vec2 l = floor((gl_FragCoord.xy - vOrg.xy) / vOrg.z);
  if (l.x < 0.0 || l.y < 0.0 || l.x >= vCell.z || l.y >= vCell.w) discard;
  if (vOrg.w > 0.5) l.x = vCell.z - 1.0 - l.x;
  vec4 tx = texelFetch(uPxAtlas, ivec2(vCell.xy + l), 0);
  if (tx.a < 0.5) discard;
  int code = int(tx.r * 255.0 + 0.5);
  float idx;
  if (code < 31) idx = float(code);
  else if (code == 32) idx = vIdxA.x;
  else if (code == 33) idx = vIdxA.y;
  else if (code == 34) idx = vIdxA.z;
  else if (code == 35) idx = vIdxB.x;
  else if (code == 36) idx = vIdxB.y;
  else if (code == 37) idx = vIdxA.w;
  else if (code == 38) idx = vIdxB.z;
  else idx = vIdxB.w;
  vec3 c = uPxPal[int(idx + 0.5)];
  gl_FragColor = vec4(mix(c, fogSrgb(), vFog), 1.0);
#endif

#ifdef STICK
  vec2 d = floor((gl_FragCoord.xy - vHalo.xy) / vHalo.z);
  float r = length(d);
  if (r < 1.5) discard;
  float amt = (1.0 - r / (vHalo.w + 1.0)) * vHaloC.y;
  if (bayer4(d) >= amt) discard;
  vec3 c = uPxPal[int(vHaloC.x + 0.5)] * 0.6 * (1.0 - vFog);
  gl_FragColor = vec4(c, 1.0);
#endif
}
