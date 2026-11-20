// Phông nền: tường LED sau ca sĩ (shader), cánh gà hai bên, mái vòm hội trường gradient màu, đèn nhà hát.
// ~5 draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrameState } from '../core/types';

const LED_FRAG = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse; uniform float uLevel; uniform float uPhase;
varying vec2 vUv;
vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.0)-3.0)-1.0,0.,1.); return v*mix(vec3(1.),k,s); }
void main(){
  vec2 p = (vUv - 0.5) * vec2(2.6, 1.0);
  float t = uTime;
  float r = length(p);
  float a = atan(p.y, p.x);
  // nền gradient chảy
  float flow = sin(p.x*3.0 + t*0.7) + sin(p.y*4.0 - t*0.9 + p.x*1.5) + sin(r*6.0 - t*1.3 - uPhase*1.5);
  float baseH = mix(0.58, 0.95, uHype) + flow*mix(0.04, 0.16, uHype) + vUv.x*mix(0.08,0.35,uHype);
  vec3 col = hsv(fract(baseH), 0.85, 0.35 + 0.15*uLevel);
  // tia sáng từ tâm (quay chậm), mạnh hơn khi hype
  float rays = pow(0.5 + 0.5*sin(a*12.0 + t*0.6), 6.0) * smoothstep(1.4, 0.1, r);
  col += hsv(fract(baseH + 0.33), 0.7, 1.0) * rays * (0.15 + 0.6*uHype);
  // vòng xung theo beat
  float ring = smoothstep(0.06, 0.0, abs(r - fract(uPhase)*1.6));
  col += hsv(fract(baseH + 0.5), 0.6, 1.0) * ring * (0.25 + 0.75*uPulse) * (0.3 + uHype);
  // lưới pixel LED
  vec2 g = fract(vUv * vec2(260.0, 100.0));
  float pix = smoothstep(0.0, 0.18, g.x) * smoothstep(0.0, 0.18, g.y) * smoothstep(1.0, 0.82, g.x) * smoothstep(1.0, 0.82, g.y);
  col *= 0.72 + 0.28*pix;
  col *= 0.75 + 0.35*uPulse*uHype;
  // viền tối mép
  col *= smoothstep(0.0, 0.03, vUv.y) * smoothstep(1.0, 0.97, vUv.y);
  gl_FragColor = vec4(col, 1.0);
}`;

const DOME_FRAG = /* glsl */ `
uniform float uTime; uniform float uHype; uniform float uPulse;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float el = d.y; // -1..1
  float az = atan(d.x, -d.z);
  float s = el*3.0 + sin(az*2.0 + uTime*0.05)*0.35 + uTime*0.03;
  vec3 blue = vec3(0.05,0.06,0.28), mag = vec3(0.32,0.05,0.30), teal = vec3(0.03,0.24,0.28);
  float b = fract(s);
  vec3 col = b < 0.33 ? mix(blue, mag, b/0.33) : (b < 0.66 ? mix(mag, teal, (b-0.33)/0.33) : mix(teal, blue, (b-0.66)/0.34));
  // dải sáng mềm quanh tầm mắt (ánh hắt sau khán giả)
  float band = exp(-pow((el - 0.08)*6.0, 2.0));
  col *= 0.35 + 0.8*band;
  // cột/khung ban công tối theo phương ngang
  float tiers = smoothstep(0.35, 0.5, abs(fract(el*9.0) - 0.5)) * step(0.0, el) * step(el, 0.35);
  col *= 1.0 - 0.6*tiers;
  // trên đỉnh tối dần
  col *= mix(1.0, 0.25, smoothstep(0.25, 0.9, el));
  col *= smoothstep(-0.25, 0.0, el);
  col *= 0.55 + 0.35*uHype + 0.15*uPulse*uHype;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createBackdrop(scene: THREE.Scene) {
  const disposables: { dispose(): void }[] = [];
  const uniforms = {
    uTime: { value: 0 }, uHype: { value: 0 }, uPulse: { value: 0 }, uLevel: { value: 0 }, uPhase: { value: 0 },
  };

  // Mái vòm
  const domeGeo = new THREE.SphereGeometry(150, 48, 24);
  const domeMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: DOME_FRAG,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.renderOrder = -20;
  dome.frustumCulled = false;
  scene.add(dome);
  disposables.push(domeGeo, domeMat);

  // Tường LED
  const ledGeo = new THREE.PlaneGeometry(26, 10);
  const ledMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: LED_FRAG,
    fog: false,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 5.2, 3.5);
  led.rotation.y = Math.PI;
  scene.add(led);
  disposables.push(ledGeo, ledMat);

  // Cánh gà + khung truss tối (1 mesh)
  const dark: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    dark.push(g.toNonIndexed());
    g.dispose();
  };
  box(28, 0.6, 0.6, 0, 10.5, 3.4); // xà trên tường LED
  box(28, 0.3, 0.4, 0, 0.0, 3.4); // chân tường
  for (const sx of [-1, 1]) {
    box(0.5, 13, 0.5, sx * 13.3, 6.2, 3.4); // cột khung
    box(6, 12, 0.3, sx * 16.2, 6, 3.2, -sx * 0.5); // cánh gà xiên
    box(0.3, 12, 9, sx * 13.9, 6, -1); // tường cánh hai bên sân khấu
    box(0.4, 0.4, 9, sx * 13.3, 12.4, -1); // xà dọc
  }
  const darkGeo = mergeGeometries(dark);
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x15122c });
  scene.add(new THREE.Mesh(darkGeo, darkMat));
  disposables.push(darkGeo, darkMat);
  dark.forEach((g) => g.dispose());

  // Dải đèn trang trí trên cánh gà/tường bên (1 mesh, màu chạy theo hype)
  const acc: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const g = new THREE.BoxGeometry(0.06, 0.06, 8.6);
      g.translate(sx * 13.72, 1.2 + i * 1.9, -1);
      acc.push(g.toNonIndexed()); g.dispose();
    }
    for (let i = 0; i < 4; i++) {
      const g = new THREE.BoxGeometry(0.08, 11, 0.08);
      g.translate(sx * (13.3 + 0.27), 6.2, 3.1 - i * 0.0);
      if (i > 0) { g.dispose(); continue; }
      acc.push(g.toNonIndexed()); g.dispose();
    }
  }
  const g0 = new THREE.BoxGeometry(26.4, 0.08, 0.08); g0.translate(0, 10.17, 3.08); acc.push(g0.toNonIndexed()); g0.dispose();
  const g9 = new THREE.BoxGeometry(26.4, 0.08, 0.08); g9.translate(0, 0.17, 3.08); acc.push(g9.toNonIndexed()); g9.dispose();
  const accGeo = mergeGeometries(acc);
  const accMat = new THREE.MeshBasicMaterial({ color: 0xff3fa8, fog: false });
  scene.add(new THREE.Mesh(accGeo, accMat));
  disposables.push(accGeo, accMat);
  acc.forEach((g) => g.dispose());

  // Đèn nhà hát: các hàng chấm màu theo tầng ban công dọc tường xa (1 draw call)
  const pts: number[] = [];
  const cols: number[] = [];
  const palette = [new THREE.Color(0xff4fa0), new THREE.Color(0x4fd6ff), new THREE.Color(0xffc24f), new THREE.Color(0x9a6bff), new THREE.Color(0x3dffb0)];
  const R = 70;
  for (let tier = 0; tier < 4; tier++) {
    const y = 4 + tier * 4.5;
    const rad = R + tier * 6;
    const n = 220 + tier * 40;
    for (let i = 0; i < n; i++) {
      // vòng cung phía trước + hai bên (bỏ phần sau sân khấu)
      const a = -Math.PI * 0.62 + (i / (n - 1)) * Math.PI * 1.24;
      const x = Math.sin(a) * rad;
      const z = -Math.cos(a) * rad - 8;
      pts.push(x, y + Math.sin(i * 0.7) * 0.05, z);
      const c = palette[(i + tier * 2) % palette.length];
      const k = 0.55 + 0.45 * ((i * 7919) % 13) / 13;
      cols.push(c.r * k, c.g * k, c.b * k);
    }
  }
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  ptGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const ptMat = new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: 0.75, depthWrite: false });
  const points = new THREE.Points(ptGeo, ptMat);
  scene.add(points);
  disposables.push(ptGeo, ptMat);

  const c = new THREE.Color();
  return {
    update(f: FrameState, t: number) {
      uniforms.uTime.value = t;
      uniforms.uHype.value = f.hype;
      uniforms.uPulse.value = f.beatPulse;
      uniforms.uLevel.value = f.level;
      uniforms.uPhase.value = f.beat;
      accMat.color.copy(c.setHSL((0.6 + f.hype * 0.35 + t * 0.03) % 1, 0.9, 0.45 + 0.2 * f.beatPulse));
      ptMat.opacity = 0.55 + 0.25 * f.hype + 0.15 * f.beatPulse;
    },
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}
