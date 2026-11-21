// "Đêm Sao Điểm Ảnh" · khe `skyFeature` (P1, STYLE_E §3 "thay cực quang ≥ 40 %"): GIÓ NÉT CỌ.
// Bật khi Hype > 40 % (tắt < 37 %), lượng = auroraAmount(h) (= skyFxAmount). Một vòm phủ (1 draw call, chỉ vẽ khi bật) vẽ thêm vệt cọ
// DÀI sáng (kem / vàng crôm / lục nhạt; ở "Tiếng thét" cam–vàng) chạy theo cùng trường dòng với vòm trời, mọc/tắt so le từng vệt
// (12 bước/s, không chớp toàn màn). Đồng thời ghi `uPixWind` (dùng chung qua ctx.uniforms) để vòm trời skyDome.ts nở quầng sao ×1,5
// và tăng tốc xoáy. Vệt không vẽ đè lên bóng đồi / làng / cây bách, lõi sao và trăng.
import * as THREE from 'three';
import { SKY_RADIUS } from '../../../../world/layout';
import { auroraAmount, RAMPS } from '../../../../world/style';
import type { OutsideBuildContext, OutsideBuilders, SkyFeatureHandle } from '../../builders';
import { glc, pixelFieldGlsl } from './skyField';
import { PIXEL_SKY_VERT } from './skyDome';

const ON = 0.4, OFF = 0.37;

const frag = () => {
  const C = RAMPS.crom!, B = RAMPS.bach!, S = RAMPS.son!, M = RAMPS.may!;
  return /* glsl */ `
${pixelFieldGlsl()}
uniform float uAmt;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  if (el < hillH(az) + 0.035) discard;
  float u, xx;
  if (cypressAll(az, el, u, xx) < 0.012) discard;
  if (starDist(d, 1.0) < 2.0 || length(d - MOON) / MOON_R < 1.7) discard;
  float a = atan(d.z, -d.x);
  float k = cos(clamp(el, 0.0, 1.2));
  vec2 p = vec2(a * k, el);
  bool scr = screamPx();
  vec2 T = flowT(a, el, k, scr ? 1.0 : 0.0);
  float life = floor(uTime * 12.0) / 12.0 * 0.11;
  float sh = strokeAt(p, T, 0.045, 0.0052, 0.95, 31.0, uAmt * (scr ? 0.3 : 0.5), life);
  if (sh < 0.0) discard;
  vec3 col;
  if (scr) col = sh < 0.4 ? ${glc(C[300])} : (sh < 0.75 ? ${glc(S[100])} : ${glc(C[100])});
  else col = sh < 0.35 ? ${glc(M[100])} : (sh < 0.65 ? ${glc(C[300])} : (sh < 0.85 ? ${glc(B[100])} : ${glc(C[100])}));
  gl_FragColor = vec4(col, 1.0);
}`;
};

export function createPixelSkyWind(ctx: OutsideBuildContext): SkyFeatureHandle {
  const { scene, uniforms } = ctx;
  const scr = (uniforms.uPixScream ??= { value: 0 }) as { value: number };
  const wind = (uniforms.uPixWind ??= { value: 0 }) as { value: number };
  const swirl = (uniforms.uSwirl ??= { value: 0 }) as { value: number };
  const amt = { value: 0 };
  const geo = new THREE.SphereGeometry(SKY_RADIUS - 2, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime!, uPulse: uniforms.uPulse!, uPixScream: scr, uPixWind: wind, uSwirl: swirl, uAmt: amt },
    vertexShader: PIXEL_SKY_VERT, fragmentShader: frag(), side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -19;
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  let on = false, cur = 0;
  return {
    update(f) {
      const h = f.hype;
      if (!on && h > ON) on = true; else if (on && h < OFF) on = false;
      const target = on ? Math.max(auroraAmount(h), 0.08) : 0;
      const rate = target > cur ? 1 / 0.8 : 1 / 1.6;
      cur += Math.sign(target - cur) * Math.min(Math.abs(target - cur), rate * f.dt);
      if (cur < 0.001) cur = 0;
      amt.value = cur;
      wind.value = cur;
      mesh.visible = cur > 0.001;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose(); mat.dispose();
      wind.value = 0;
    },
  };
}

export const builders: Partial<OutsideBuilders> = { skyFeature: createPixelSkyWind };
