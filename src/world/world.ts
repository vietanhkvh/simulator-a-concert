// WORLD — nơi DUY NHẤT ghép ba khu thành một cảnh: tạo renderer/scene/camera, uniform + điểm sáng dùng chung,
// rồi gọi lần lượt ba khu. main.ts chỉ làm việc với World và các handle của từng khu.
//
//   outside (ngoài sân, xa nhất)  →  stands (khán đài)  →  arena (sân trung tâm, gần nhất)
//
// Quy ước tọa độ (xem layout.ts): ca sĩ ở gốc, nhìn về -Z; khán giả ở phía -Z; +Y hướng lên.
import * as THREE from 'three';
import { createDebugLayers } from '../core/debugLayers';
import type { FrameState, Stage } from '../core/types';
import { createArenaZone, type ArenaOptions, type ArenaZone } from '../zones/arena';
import { createOutsideZone, type OutsideZone } from '../zones/outside';
import { createStandsZone, type StandsZone } from '../zones/stands';
import { CAMERA_FAR, CAMERA_FOV, EYE_HEIGHT, FOG_DENSITY } from './layout';
import { buildGlowPoints, createGlowBuf } from './shared/glowPoints';
import { setLowResTarget } from './shared/viewport';
import { getActiveThemeId, getTheme, SKY, type ThemeId } from './style';
import { createWorldUniforms, updateWorldUniforms } from './shared/worldUniforms';
import type { ZoneContext } from './zone';

export interface World extends Stage {
  readonly outside: OutsideZone;
  readonly stands: StandsZone;
  readonly arena: ArenaZone;
  /** Phong cách world này được dựng cho (token lúc dựng). Đổi phong cách = applyTheme() rồi rebuildWorld(). */
  readonly themeId: ThemeId;
  /** Thời gian dựng hình học + vật liệu (ms, chưa gồm biên dịch shader ở frame đầu). */
  readonly buildMs: number;
  /** Hậu kỳ đang bật: null hoặc kích thước đích thấp + hệ số phóng nguyên lần. */
  postFx(): { kind: 'pixelate'; width: number; height: number; scale: number } | null;
  /** `keepRenderer`: giữ WebGLRenderer (và canvas) để dựng world khác trên cùng context. */
  dispose(opts?: { keepRenderer?: boolean }): void;
  /** Debug (chế độ developer): ẩn/hiện một khu, hoặc 'glow' = điểm sáng dùng chung (sao + khán giả chấm sáng). */
  setZoneVisible(zone: DebugZoneName, on: boolean): boolean;
  /** Debug: số liệu renderer của lần vẽ gần nhất. */
  stats(): WorldStats;
}

export type DebugZoneName = 'outside' | 'stands' | 'arena' | 'glow';
export interface WorldStats {
  calls: number; triangles: number; points: number; lines: number;
  geometries: number; textures: number; programs: number; sceneObjects: number;
  theme: ThemeId; postFx: string;
}

const POST_VERT = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// Mỗi texel của đích thấp phủ đúng uScale × uScale pixel màn hình (nearest, không nội suy).
const POST_FRAG = /* glsl */ `
uniform sampler2D tMap; uniform vec2 uSize; uniform float uScale;
void main(){ gl_FragColor = vec4(texture2D(tMap, (floor(gl_FragCoord.xy / uScale) + 0.5) / uSize).rgb, 1.0); }`;

/**
 * Dựng world cho PHONG CÁCH ĐANG BẬT (world/style: getTheme()). `reuse`: renderer của world trước (đã dispose với
 * keepRenderer) — dùng lại context WebGL thay vì tạo mới.
 */
export function createWorld(canvas: HTMLCanvasElement, opts: ArenaOptions, reuse?: THREE.WebGLRenderer): World {
  const t0 = performance.now();
  const themeId = getActiveThemeId();
  const renderer = reuse ?? new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.info.autoReset = false; // render() tự reset: số liệu gồm cả lượt hậu kỳ
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(SKY.fog);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, CAMERA_FAR);
  camera.position.set(0, EYE_HEIGHT, 0);
  camera.rotation.order = 'YXZ';

  // Hậu kỳ tuỳ chọn của phong cách (theme.features.postFx). 'pixelate': vẽ cảnh 3D vào đích thấp (≈ width × height,
  // chỉnh theo tỉ lệ cửa sổ), rồi phóng NGUYÊN LẦN bằng nearest. UI/lời bài hát là DOM nên giữ độ phân giải gốc.
  const fx = getTheme().features.postFx;
  const post = fx.kind === 'pixelate' ? (() => {
    const rt = new THREE.WebGLRenderTarget(fx.width, fx.height, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false,
    });
    // three chỉ mã hoá sRGB + tone mapping khi vẽ ra màn hình hoặc ra đích XR. Đánh dấu đích này như đích XR để vật liệu
    // có sẵn (MeshBasicMaterial…) cho đúng màu như khi vẽ thẳng; shader thô của game vốn đã ghi sRGB.
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    (rt as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
    const u = { tMap: { value: rt.texture }, uSize: { value: new THREE.Vector2(fx.width, fx.height) }, uScale: { value: 1 } };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); // 1 tam giác phủ màn hình
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false, fog: false });
    const quad = new THREE.Mesh(geo, mat);
    quad.frustumCulled = false;
    const qScene = new THREE.Scene();
    qScene.add(quad);
    const qCam = new THREE.Camera();
    const buf = new THREE.Vector2();
    return {
      rt, u, qScene, qCam,
      resize() {
        renderer.getDrawingBufferSize(buf);
        const scale = Math.max(1, Math.round(buf.y / fx.height));
        const w = Math.max(1, Math.ceil(buf.x / scale)), h = Math.max(1, Math.ceil(buf.y / scale));
        rt.setSize(w, h);
        u.uSize.value.set(w, h);
        u.uScale.value = scale;
        setLowResTarget({ width: w, height: h });
      },
      dispose() { rt.dispose(); geo.dispose(); mat.dispose(); },
    };
  })() : null;
  if (!post) setLowResTarget(null);

  const uniforms = createWorldUniforms();
  const glow = createGlowBuf();
  const ctx: ZoneContext = { scene, camera, uniforms, glow };

  // Từ xa tới gần. Điểm sáng dùng chung được dựng sau khi khu ngoài sân và khán đài đã thêm điểm.
  const outside = createOutsideZone(ctx);
  const stands = createStandsZone(ctx);
  const worldLayers = createDebugLayers(scene); // chế độ developer
  const glowPoints = worldLayers.track('glow', () => buildGlowPoints(scene, uniforms, glow));
  const arena = createArenaZone(ctx, opts);

  let animT = 0; // đồng hồ hoạt họa: đứng yên khi dt = 0 (tạm dừng)

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    post?.resize();
  };
  resize();
  window.addEventListener('resize', resize);

  const buildMs = performance.now() - t0;

  return {
    scene, camera, renderer, outside, stands, arena, themeId, buildMs,
    postFx: () => (post ? { kind: 'pixelate', width: post.u.uSize.value.x, height: post.u.uSize.value.y, scale: post.u.uScale.value } : null),
    update(f: FrameState) {
      const dt = Math.min(f.dt, 0.1);
      animT += dt > 0 ? dt : 0;
      updateWorldUniforms(uniforms, f, animT);
      arena.update(f, animT);
      outside.update(f, animT);
      stands.update(f, animT);
    },
    render() {
      renderer.info.reset();
      if (!post) { renderer.render(scene, camera); return; }
      renderer.setRenderTarget(post.rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(post.qScene, post.qCam);
    },
    setZoneVisible(zone, on) {
      if (zone === 'glow') return worldLayers.set('glow', on);
      const z = zone === 'outside' ? outside : zone === 'stands' ? stands : arena;
      if (!z.setVisible) return false;
      z.setVisible(on);
      return true;
    },
    stats() {
      const i = renderer.info;
      let n = 0;
      scene.traverse(() => { n++; });
      return {
        calls: i.render.calls, triangles: i.render.triangles, points: i.render.points, lines: i.render.lines,
        geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0, sceneObjects: n,
        theme: themeId, postFx: post ? `${post.u.uSize.value.x}×${post.u.uSize.value.y} ×${post.u.uScale.value}` : 'none',
      };
    },
    dispose(o) {
      window.removeEventListener('resize', resize);
      arena.dispose();
      stands.dispose();
      outside.dispose();
      glowPoints.dispose();
      post?.dispose();
      setLowResTarget(null);
      scene.clear();
      renderer.setRenderTarget(null);
      renderer.renderLists.dispose();
      if (!o?.keepRenderer) renderer.dispose();
    },
  };
}

/** Dựng lại world cho phong cách đang bật trên cùng canvas + renderer (không tải lại trang). */
export function rebuildWorld(prev: World, canvas: HTMLCanvasElement, opts: ArenaOptions): World {
  const renderer = prev.renderer;
  prev.dispose({ keepRenderer: true });
  return createWorld(canvas, opts, renderer);
}
