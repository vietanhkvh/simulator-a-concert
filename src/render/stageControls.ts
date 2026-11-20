// Đi lại (phím mũi tên) + nhìn 360° (kéo chuột/chạm, Q/E). Giới hạn trong sân khấu ∪ runway ∪ bục tròn.
import * as THREE from 'three';

const PITCH_MIN = THREE.MathUtils.degToRad(-35);
const PITCH_MAX = THREE.MathUtils.degToRad(45);
const SPEED = 4;
const EYE = 1.65;

export function walkable(x: number, z: number): boolean {
  if (Math.abs(x) <= 12.3 && z >= -4.7 && z <= 2.5) return true;
  if (Math.abs(x) <= 1.3 && z >= -24 && z <= -4.7) return true;
  const dz = z + 26;
  return x * x + dz * dz <= 3.2 * 3.2;
}

/** Góc nhìn: 'singer' = ngôi thứ nhất; còn lại lấy pose từ provider (cameraCrew.getView). */
export type ViewMode = 'singer' | 'flycam' | 'pit' | 'crane' | 'wide';
export const VIEW_ORDER: ViewMode[] = ['singer', 'flycam', 'pit', 'crane', 'wide'];
export interface ViewPose { position: THREE.Vector3; target: THREE.Vector3; fov: number }
export type ViewProvider = (mode: ViewMode) => ViewPose | null;
const BLEND_SEC = 0.6;

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

export function createControls() {
  const pos = new THREE.Vector3(0, EYE, 0);
  const vel = new THREE.Vector2(); // x, z
  let yaw = 0;
  let pitch = THREE.MathUtils.degToRad(2);
  const keys = new Set<string>();

  // ── Góc nhìn bên ngoài ──
  let viewMode: ViewMode = 'singer';
  let provider: ViewProvider | null = null;
  let hookScene: THREE.Scene | null = null;
  let prevHook: THREE.Scene['onBeforeRender'] | null = null;
  let baseFov: number | null = null;
  let blend = 1;
  let lastMs = 0;
  let hasLast = false;
  const lastPos = new THREE.Vector3();
  const lastQuat = new THREE.Quaternion();
  let lastFov = 70;
  const fromPos = new THREE.Vector3();
  const fromQuat = new THREE.Quaternion();
  let fromFov = 70;
  const tPos = new THREE.Vector3();
  const tQuat = new THREE.Quaternion();
  const lookM = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);
  const singerPose = { position: new THREE.Vector3(0, EYE, 0), yaw: 0 };

  /** Gọi trong scene.onBeforeRender: ghi đè transform camera (stage.ts đã đặt góc ngôi thứ nhất). */
  const applyCamera = (camera: THREE.Camera) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (baseFov === null) baseFov = camera.fov;
    const now = performance.now();
    const dt = hasLast ? Math.min(0.25, Math.max(0, (now - lastMs) / 1000)) : 0;
    lastMs = now;
    const pose = viewMode !== 'singer' && provider ? provider(viewMode) : null;
    let tFov: number;
    if (pose) {
      tPos.copy(pose.position);
      lookM.lookAt(pose.position, pose.target, UP);
      tQuat.setFromRotationMatrix(lookM);
      tFov = pose.fov;
    } else {
      tPos.copy(camera.position);
      tQuat.copy(camera.quaternion);
      tFov = baseFov;
    }
    blend = Math.min(1, blend + dt / BLEND_SEC);
    if (blend < 1 && hasLast) {
      const e = blend * blend * (3 - 2 * blend);
      tPos.lerpVectors(fromPos, tPos, e);
      tQuat.slerpQuaternions(fromQuat, tQuat, e);
      tFov = fromFov + (tFov - fromFov) * e;
    }
    camera.position.copy(tPos);
    camera.quaternion.copy(tQuat);
    if (Math.abs(camera.fov - tFov) > 1e-3) { camera.fov = tFov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    lastPos.copy(tPos);
    lastQuat.copy(tQuat);
    lastFov = tFov;
    hasLast = true;
  };
  const setView = (mode: ViewMode) => {
    if (mode === viewMode || !VIEW_ORDER.includes(mode)) return;
    viewMode = mode;
    if (hasLast) { fromPos.copy(lastPos); fromQuat.copy(lastQuat); fromFov = lastFov; blend = 0; }
    if (mode !== 'singer' && dragId !== null) dragId = null;
    window.dispatchEvent(new CustomEvent('cs-view', { detail: { mode } }));
  };
  const cycleView = (dir: number) => {
    const i = VIEW_ORDER.indexOf(viewMode);
    setView(VIEW_ORDER[(i + dir + VIEW_ORDER.length) % VIEW_ORDER.length]);
  };
  const detachHook = () => {
    if (hookScene) hookScene.onBeforeRender = prevHook ?? (() => {});
    hookScene = null;
    prevHook = null;
  };
  const handled = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']);

  // Mouse-look: pointer lock, hoặc "sticky" (không có/ lỗi pointer lock) dùng pointermove delta.
  let mouseLook = false;
  let sticky = false;
  const NOLOOK = 'button,input,textarea,select,a,label,[data-nodrag]';
  const canvasEl = () => document.querySelector('canvas') as HTMLCanvasElement | null;
  const emit = () => window.dispatchEvent(new CustomEvent('cs-mouselook', { detail: { on: mouseLook } }));
  const setMouseLook = (on: boolean) => {
    if (on === mouseLook) return;
    mouseLook = on;
    if (on) {
      sticky = false;
      const c = canvasEl();
      try {
        if (c && typeof c.requestPointerLock === 'function') {
          const r = c.requestPointerLock() as unknown as Promise<void> | undefined;
          if (r && typeof r.catch === 'function') r.catch(() => { if (mouseLook && !document.pointerLockElement) sticky = true; });
        } else sticky = true;
      } catch { sticky = true; }
    } else {
      sticky = false;
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ }
    }
    emit();
  };
  const onLockChange = () => {
    if (!document.pointerLockElement && mouseLook && !sticky) { mouseLook = false; emit(); }
  };
  const onLockError = () => { if (mouseLook) sticky = true; };
  const onDblClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t || (t.closest && t.closest(NOLOOK))) return;
    if (!(t instanceof HTMLCanvasElement)) return;
    setMouseLook(!mouseLook);
  };
  const lookDelta = (dx: number, dy: number) => {
    if (viewMode !== 'singer') return;
    yaw -= dx * 0.0045;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0045, PITCH_MIN, PITCH_MAX);
  };
  const onMouseMoveLocked = (e: MouseEvent) => {
    if (mouseLook && document.pointerLockElement) lookDelta(e.movementX, e.movementY);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.code === 'KeyM') { if (!e.repeat) setMouseLook(!mouseLook); return; }
    if (e.code === 'KeyV') { if (!e.repeat) cycleView(e.shiftKey ? -1 : 1); return; }
    if (!handled.has(e.code)) return;
    keys.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
  const onBlur = () => keys.clear();

  let dragId: number | null = null;
  let lx = 0;
  let ly = 0;
  const onDown = (e: PointerEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && t.closest && t.closest(NOLOOK)) return;
    if (mouseLook) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
  };
  const onMove = (e: PointerEvent) => {
    if (mouseLook) {
      if (sticky && e.pointerType === 'mouse') lookDelta(e.movementX, e.movementY);
      return;
    }
    if (dragId !== e.pointerId) return;
    if (viewMode !== 'singer') { lx = e.clientX; ly = e.clientY; return; }
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;
    const s = e.pointerType === 'touch' ? 0.006 : 0.0045;
    yaw -= dx * s;
    pitch = THREE.MathUtils.clamp(pitch - dy * s, PITCH_MIN, PITCH_MAX);
  };
  const onUp = (e: PointerEvent) => { if (dragId === e.pointerId) dragId = null; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('dblclick', onDblClick);
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', onLockError);
  document.addEventListener('mousemove', onMouseMoveLocked);

  const api = {
    isMouseLook: () => mouseLook,
    /** Đổi góc nhìn (V xoay vòng: singer → flycam → pit → crane → wide). */
    setView,
    cycleView,
    getViewMode: () => viewMode,
    /**
     * Nguồn pose cho góc nhìn ngoài (vd. (m) => crew.getView(m)). `scene` = scene của stage: camera
     * được ghi đè trong scene.onBeforeRender nên không cần sửa stage.ts. Bỏ trống = giữ scene đã gắn.
     */
    setViewProvider(fn: ViewProvider | null, scene?: THREE.Scene) {
      provider = fn;
      if (scene && scene !== hookScene) {
        detachHook();
        hookScene = scene;
        prevHook = scene.onBeforeRender;
        const prev = prevHook;
        scene.onBeforeRender = function (this: THREE.Scene, ...args: Parameters<THREE.Scene['onBeforeRender']>) {
          prev.apply(this, args);
          const camera = args[2];
          applyCamera(camera);
        };
      }
    },
    /** Ghi đè camera thủ công (khi không gắn scene hook): gọi ngay trước renderer.render. */
    applyCamera,
    /** Vị trí mắt ca sĩ (y = 1,65) + yaw (0 = nhìn -Z). Đối tượng dùng lại, đừng giữ tham chiếu để sửa. */
    getSingerPose() {
      singerPose.position.copy(pos);
      singerPose.yaw = yaw;
      return singerPose;
    },
    setMouseLook,
    pos,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    /** rawDt: dt thật (cho Q/E khi pause vẫn 0 → không xoay). */
    update(dt: number) {
      if (dt <= 0) return;
      if (keys.has('KeyQ')) yaw += 1.8 * dt;
      if (keys.has('KeyE')) yaw -= 1.8 * dt;
      const f = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
      const r = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      // hướng nhìn: -Z xoay theo yaw
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      let tx = fx * f + rx * r;
      let tz = fz * f + rz * r;
      const len = Math.hypot(tx, tz);
      if (len > 0) { tx = (tx / len) * SPEED; tz = (tz / len) * SPEED; }
      const k = 1 - Math.exp(-(len > 0 ? 8 : 10) * dt);
      vel.x += (tx - vel.x) * k;
      vel.y += (tz - vel.y) * k;
      if (Math.abs(vel.x) < 1e-4 && Math.abs(vel.y) < 1e-4) return;
      const nx = pos.x + vel.x * dt;
      const nz = pos.z + vel.y * dt;
      if (walkable(nx, nz)) { pos.x = nx; pos.z = nz; }
      else if (walkable(nx, pos.z)) { pos.x = nx; vel.y = 0; }
      else if (walkable(pos.x, nz)) { pos.z = nz; vel.x = 0; }
      else {
        // trượt theo cung tròn bục: chiếu về biên
        const dz = nz + 26;
        const d = Math.hypot(nx, dz);
        if (nz < -22 && d > 0) {
          const px = (nx / d) * 3.19, pz = (dz / d) * 3.19 - 26;
          if (walkable(px, pz)) { pos.x = px; pos.z = pz; }
        } else vel.set(0, 0);
      }
    },
    reset() {
      pos.set(0, EYE, 0);
      vel.set(0, 0);
      yaw = 0;
      pitch = THREE.MathUtils.degToRad(2);
    },
    dispose() {
      setMouseLook(false);
      detachHook();
      if (current === api) current = null;
      window.removeEventListener('dblclick', onDblClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      document.removeEventListener('mousemove', onMouseMoveLocked);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    },
  };
  (window as unknown as { __csControls?: unknown }).__csControls = api; // debug/kiểm thử
  current = api;
  return api;
}

export type StageControls = ReturnType<typeof createControls>;
let current: StageControls | null = null;
/** Controls đang hoạt động (stage.ts tạo bên trong createStage). */
export function getControls(): StageControls | null {
  return current;
}
