// "Thép & Lửa" · khe `sky` (S6): vòm trời gần đen (đỉnh xám xanh lạnh, chân trời ánh natri công nghiệp), sao thưa vuông / thoi
// cứng, trăng NHỎ sắc cạnh (đa giác 7 cạnh, 7 mặt phẳng trắng hồ quang, không mặt), đường chân trời công nghiệp xa phía sau
// khán đài (cần cẩu, ống khói + đèn đỏ nháy, cột điện cao thế, nhà xưởng răng cưa), "sao băng" = vệt tàn lửa bay lên rồi vòng cung.
// Tất cả nằm trong MỘT draw call (vòm trời bám camera, shader tự vẽ). Không texture → không gì phải dispose ngoài geometry/material.
import * as THREE from 'three';
import { SKY_RADIUS } from '../../../../world/layout';
import { drawSize } from '../../../../world/shared/viewport';
import { hexToRgb, RAMPS } from '../../../../world/style';
import type { OutsideBuildContext, OutsideBuilders, SkyHandle } from '../../builders';

/** Hướng trăng: lệch phải 30°, cao 48° (nhìn từ ca sĩ về phía −Z). */
const MOON_AZ = 0.52, MOON_EL = THREE.MathUtils.degToRad(48);
export const STEEL_MOON_DIR = new THREE.Vector3(
  Math.sin(MOON_AZ) * Math.cos(MOON_EL), Math.sin(MOON_EL), -Math.cos(MOON_AZ) * Math.cos(MOON_EL),
).normalize();
const MOON_R = 0.04; // bán kính (rad) ≈ 2,9°
export const EMBER_POOL = 6;
const CELLS = 12; // số ô quanh vòng chân trời công nghiệp

const f = (x: number) => x.toFixed(4);
const rgb = (hex: number) => `vec3(${hexToRgb(hex).map(f).join(', ')})`;

const VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`;

const frag = () => {
  const C = RAMPS.coal!, S = RAMPS.steel!, A = RAMPS.arc!, T = RAMPS.tungsten!, B = RAMPS.blood!, E = RAMPS.ember!, F = RAMPS.flame!, W = RAMPS.whitehot!;
  const md = STEEL_MOON_DIR;
  const mr = new THREE.Vector3().crossVectors(md, new THREE.Vector3(0, 1, 0)).normalize();
  const mu = new THREE.Vector3().crossVectors(mr, md).normalize();
  const vec = (v: THREE.Vector3) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
  return /* glsl */ `
#define PI 3.14159265
const vec3 MD = ${vec(md)}; const vec3 MR = ${vec(mr)}; const vec3 MU = ${vec(mu)};
const float MOON_R = ${f(MOON_R)};
uniform float uTime; uniform float uHype;
uniform vec4 uCom[${EMBER_POOL}];
varying vec3 vDir;
float hash11(float p){ return fract(sin(p * 127.1) * 43758.5453); }
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wrapA(float a){ return mod(a + PI, 2.0 * PI) - PI; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sdBox(vec2 p, vec2 c, vec2 hs){ vec2 q = abs(p - c) - hs; return max(q.x, q.y); }
float cross2(vec2 a, vec2 b){ return a.x * b.y - a.y * b.x; }

// quỹ đạo tàn lửa: bay lên rồi vòng cung (toạ độ góc cục bộ quanh điểm phóng)
vec2 emberPath(float a, float vx){ return vec2(vx * a, 0.34 * a - 0.09 * a * a); }

void main(){
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0)), h = max(d.y, 0.0);
  float az = atan(d.x, -d.z);
  float warm = smoothstep(0.4, 0.85, uHype);
  // gần đen: đỉnh xám xanh lạnh, chân trời ánh natri nhạt
  vec3 zen = mix(${rgb(C[700])}, ${rgb(S[700])}, 0.22);
  vec3 hor = mix(${rgb(C[500])}, ${rgb(S[700])}, 0.2);
  vec3 col = mix(hor, zen, smoothstep(0.0, 0.85, h));
  float glow = exp(-h * 5.5) * (0.65 + 0.35 * sin(az * 3.0 + 1.0));
  col += mix(${rgb(T[700])}, ${rgb(E[500])}, warm) * glow * (0.2 + 0.1 * warm);
  col += ${rgb(S[500])} * 0.05 * exp(-h * 3.0) * (1.0 - warm * 0.5);

  // sao thưa: ô vuông / thoi cứng, trắng lạnh, không toả
  float ak = cos(clamp(el, -1.4, 1.4));
  vec2 sp = vec2(az * ak, el) * 38.0;
  vec2 cid = floor(sp), cf = fract(sp) - 0.5;
  float sh = hash21(cid);
  if (sh > 0.984 && el > 0.05) {
    vec2 q = abs(cf - (vec2(hash21(cid + 7.1), hash21(cid + 3.3)) - 0.5) * 0.4);
    float sz = 0.1 + 0.1 * hash21(cid + 1.7);
    float shape = sh > 0.992 ? step(max(q.x, q.y), sz) : step(q.x + q.y, sz * 1.35);
    float on = step(0.12, fract(uTime * 0.17 + sh * 90.0));
    col += ${rgb(A[300])} * shape * on * (0.45 + 0.55 * hash21(cid + 9.0)) * smoothstep(0.05, 0.25, el);
  }

  // trăng nhỏ sắc cạnh: đa giác 7 cạnh, mỗi mặt một tông phẳng, viền mặt tối, không mặt người
  float mf = dot(d, MD);
  if (mf > 0.985) {
    vec2 l = vec2(dot(d, MR), dot(d, MU)) / MOON_R;
    float r = length(l);
    col += ${rgb(A[700])} * exp(-max(r - 1.0, 0.0) * 1.9) * 0.05 * step(1.0, r);
    vec2 c0 = vec2(-0.14, 0.1);
    float inside = 0.0, shade = 0.0, edge = 1.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float a0 = 2.0 * PI * (fi + 0.35 * hash11(fi + 3.0)) / 7.0 + 0.4;
      float a1 = 2.0 * PI * (fi + 1.0 + 0.35 * hash11(fi + 4.0 - 7.0 * step(6.5, fi + 1.0))) / 7.0 + 0.4;
      vec2 v0 = vec2(cos(a0), sin(a0)) * (0.9 + 0.1 * hash11(fi + 11.0));
      vec2 v1 = vec2(cos(a1), sin(a1)) * (0.9 + 0.1 * hash11(mod(fi + 1.0, 7.0) + 11.0));
      vec2 p0 = v0 - c0, p1 = v1 - c0, pp = l - c0;
      float s0 = cross2(p0, pp), s1 = cross2(pp, p1);
      float sw = cross2(p0, p1);
      if (sw > 0.0 && s0 >= 0.0 && s1 >= 0.0) {
        // tam giác (c0, v0, v1): ngoài cạnh v0-v1 thì ra khỏi mặt trăng
        vec2 e = v1 - v0;
        float out1 = cross2(e, l - v0);
        if (out1 >= 0.0) {
          inside = 1.0;
          vec2 mid = (v0 + v1) * 0.5;
          shade = 0.52 + 0.3 * hash11(fi * 7.3 + 1.0) + 0.3 * dot(normalize(mid), vec2(-0.55, 0.75));
          edge = min(out1 / length(e), min(s0 / length(p0), s1 / length(p1)));
        }
      }
    }
    if (inside > 0.5) {
      vec3 mc = mix(${rgb(S[300])}, ${rgb(A[300])}, clamp(shade, 0.0, 1.0));
      mc = mix(mc, ${rgb(A[100])}, smoothstep(0.82, 1.1, shade) * 0.5);
      mc *= mix(0.62, 1.0, smoothstep(0.0, 0.05, edge));
      col = mc * 1.05;
    }
  }

  // đường chân trời công nghiệp xa (sau khán đài): ô quanh vòng, ngẫu nhiên theo ô
  const float SC = 1.5;
  float px = 0.0016 / SC;
  float cw = 2.0 * PI / ${CELLS}.0;
  float xN = (az + PI) / cw;
  float ci = floor(xN);
  vec2 P = vec2((fract(xN) - 0.5) * cw, el) / SC;
  float cm = mod(ci, ${CELLS}.0);
  float tp = hash11(cm * 1.37 + 5.0), h2 = hash11(cm * 2.71 + 1.0), off = (hash11(cm * 3.3 + 8.0) - 0.5) * 0.08;
  float sd = 1.0; vec3 bcn = vec3(0.0); vec2 bp = vec2(0.0); float bph = hash11(cm + 20.0);
  float Ht = 0.1;
  if (tp < 0.2) {            // ống khói đôi
    Ht = 0.17 + 0.14 * h2;
    float y = clamp(P.y / Ht, 0.0, 1.0);
    sd = max(abs(P.x - off) - mix(0.022, 0.012, y), P.y - Ht);
    float Ht2 = Ht * 0.78, y2 = clamp(P.y / Ht2, 0.0, 1.0);
    sd = min(sd, max(abs(P.x - off - 0.075) - mix(0.017, 0.01, y2), P.y - Ht2));
    sd = min(sd, sdBox(P, vec2(off + 0.03, 0.0), vec2(0.1, 0.012)));
    bp = vec2(off, Ht + 0.006);
  } else if (tp < 0.42) {     // cần cẩu tháp
    Ht = 0.2 + 0.12 * h2;
    sd = sdBox(P, vec2(off, Ht * 0.5), vec2(0.0055, Ht * 0.5));
    sd = min(sd, sdBox(P, vec2(off - 0.03, Ht - 0.004), vec2(0.115, 0.004)));
    sd = min(sd, sdBox(P, vec2(off + 0.075, Ht - 0.02), vec2(0.02, 0.014)));
    sd = min(sd, sdBox(P, vec2(off + 0.003, Ht + 0.016), vec2(0.004, 0.02)));
    sd = min(sd, sdSeg(P, vec2(off, Ht + 0.036), vec2(off - 0.14, Ht)) - 0.0012);
    sd = min(sd, sdSeg(P, vec2(off, Ht + 0.036), vec2(off + 0.09, Ht - 0.004)) - 0.0012);
    sd = min(sd, sdBox(P, vec2(off, 0.0), vec2(0.03, 0.01)));
    bp = vec2(off, Ht + 0.04);
  } else if (tp < 0.62) {      // cột điện cao thế (khung rỗng)
    Ht = 0.16 + 0.1 * h2;
    float y = clamp(P.y / Ht, 0.0, 1.0);
    float wo = mix(0.036, 0.007, y), wi = wo - 0.0045;
    float frame = max(abs(P.x - off) - wo, P.y - Ht);
    float hole = max(abs(P.x - off) - wi, P.y - Ht + 0.0);
    sd = max(frame, -hole);
    sd = min(sd, sdBox(P, vec2(off, Ht * 0.34), vec2(wo, 0.0025)));
    sd = min(sd, sdBox(P, vec2(off, Ht * 0.62), vec2(wo, 0.0025)));
    sd = min(sd, sdBox(P, vec2(off, Ht * 0.80), vec2(0.07, 0.003)));
    sd = min(sd, sdBox(P, vec2(off, Ht * 0.92), vec2(0.045, 0.003)));
    sd = max(sd, -P.y - 0.2);
    bp = vec2(off, Ht + 0.004);
  } else if (tp < 0.8) {     // nhà xưởng răng cưa + ống thông gió
    Ht = 0.05;
    float saw = 0.05 + 0.028 * fract((P.x + off) * 15.0);
    sd = max(abs(P.x - off) - 0.15, P.y - saw);
    sd = min(sd, sdBox(P, vec2(off + 0.08, 0.06), vec2(0.008, 0.06)));
    bp = vec2(off + 0.08, 0.124);
  } else if (tp < 0.9) {      // xi-lô thấp
    sd = min(sdBox(P, vec2(off - 0.04, 0.035), vec2(0.022, 0.035)), sdBox(P, vec2(off + 0.02, 0.045), vec2(0.022, 0.045)));
    sd = min(sd, sdBox(P, vec2(off - 0.01, 0.01), vec2(0.09, 0.01)));
    bp = vec2(0.0, -1.0);
  } else { sd = 1.0; }
  float sil = smoothstep(px, -px, sd) * step(-0.25, el);
  vec3 scol = mix(${rgb(C[700])} * 0.9, ${rgb(T[700])} * 0.3, exp(-max(el, 0.0) * 22.0) * (0.5 + 0.5 * warm));
  col = mix(col, scol, sil);
  // đèn báo đỏ nháy trên đỉnh
  if (bp.y > 0.0) {
    float blink = step(0.62, fract(uTime * (0.55 + 0.25 * bph) + bph * 7.0));
    float db = length(P - bp) * SC;
    float bg = exp(-db * db / 0.00002) + 0.25 * exp(-db / 0.007);
    col += (${rgb(B[100])} * 1.6 + ${rgb(F[500])} * 0.2) * bg * (0.18 + 0.82 * blink);
  }
  col = mix(col, ${rgb(C[700])} * 0.8, smoothstep(0.0, -0.05, el));

  // tàn lửa bay lên rồi vòng cung (thay sao băng): vệt đầu trắng nung → cam → than hồng
  for (int i = 0; i < ${EMBER_POOL}; i++) {
    vec4 cm4 = uCom[i];
    float age = uTime - cm4.z;
    if (age > 0.0 && age < 2.5) {
      float vx = cm4.w * 0.1;
      vec2 P2 = vec2(wrapA(az - cm4.x) * cos(cm4.y), el - cm4.y);
      float env = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(1.5, 2.5, age));
      vec2 hd = emberPath(age, vx), tl = emberPath(max(age - 0.55, 0.0), vx);
      if (length(P2 - hd) < 0.3) {
        vec2 pa = P2 - tl, ba = hd - tl;
        float u = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        float dd = length(pa - ba * u);
        float w = 0.0034 * u * u + 0.0006;
        float s = smoothstep(w, w * 0.3, dd) * pow(u, 1.3);
        vec3 ec = mix(${rgb(E[300])}, ${rgb(W[100])}, pow(u, 3.0));
        col += ec * s * env * 1.25;
        for (int k = 1; k < 5; k++) {
          float fk = float(k);
          float ag = max(age - 0.1 * fk - 0.09 * hash11(fk + cm4.z), 0.0);
          vec2 sp2 = emberPath(ag, vx) + (vec2(hash11(fk * 3.1 + cm4.z), hash11(fk * 5.3 + cm4.z)) - 0.5) * 0.02;
          col += ${rgb(F[300])} * smoothstep(0.0034, 0.0006, length(P2 - sp2)) * env * (0.5 - 0.09 * fk);
        }
      }
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;
};

export function createSteelSky(ctx: OutsideBuildContext): SkyHandle & { moonPosition: THREE.Vector3 } {
  const { scene, uniforms } = ctx;
  uniforms.uPx = { value: 500 };
  uniforms.uRes = { value: 1 };
  let seed = 77;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const com = Array.from({ length: EMBER_POOL }, () => new THREE.Vector4(0, 0, -100, 0));
  const geo = new THREE.SphereGeometry(SKY_RADIUS, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime!, uHype: uniforms.uHype!, uCom: { value: com } },
    vertexShader: VERT, fragmentShader: frag(), side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -20;
  dome.frustumCulled = false;
  const v2 = new THREE.Vector2();
  dome.onBeforeRender = (renderer, _s, camera) => {
    drawSize(renderer, v2);
    uniforms.uPx!.value = v2.y * camera.projectionMatrix.elements[5]! * 0.5;
    uniforms.uRes!.value = Math.max(0.6, v2.y / 720);
  };
  scene.add(dome);

  const queue: number[] = [];
  let slot = 0, now = 0, lastT = -1, prevH = -1;
  const TH = [0.2, 0.4, 0.6, 0.8], BURST = [1, 2, 3, 4];
  const armed = [true, true, true, true];
  const spawn = (t: number) => {
    const c = com[slot]!; slot = (slot + 1) % EMBER_POOL;
    const az = (rnd() - 0.5) * 4.4;
    c.set(az, 0.1 + rnd() * 0.3, t, (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.9));
  };
  const burst = (n: number) => { for (let k = 0; k < n; k++) queue.push(now + (n > 1 ? (k / (n - 1)) * 1.8 : 0) + rnd() * 0.15); };
  const hook = { triggerMeteors: burst };
  (window as unknown as { __csSky?: unknown }).__csSky = hook;
  return {
    moonPosition: STEEL_MOON_DIR.clone().multiplyScalar(SKY_RADIUS),
    burstMeteors: burst,
    update(t) {
      now = t;
      const dt = lastT < 0 ? 0 : Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      const h = (uniforms.uHype?.value as number) ?? 0;
      if (prevH < 0) prevH = h;
      for (let i = 0; i < 4; i++) {
        if (h < TH[i]! - 0.05) armed[i] = true;
        if (armed[i] && prevH < TH[i]! && h >= TH[i]!) { armed[i] = false; burst(BURST[i]!); }
      }
      prevH = h;
      // ≥ 80 %: mưa tàn lửa đều (≈ 1,3 vệt / s, dưới giới hạn 3 chớp / s)
      if (dt > 0 && h >= 0.8 && rnd() < 1.3 * dt) queue.push(t);
      for (let k = queue.length - 1; k >= 0; k--) if (queue[k]! <= t) { spawn(t); queue.splice(k, 1); }
    },
    dispose() {
      scene.remove(dome);
      geo.dispose(); mat.dispose();
      const w = window as unknown as { __csSky?: unknown };
      if (w.__csSky === hook) delete w.__csSky;
    },
  };
}

export const builders: Partial<OutsideBuilders> = { sky: createSteelSky };
