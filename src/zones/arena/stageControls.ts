// Đi lại (phím mũi tên) + nhìn 360° (kéo chuột/chạm, Q/E). Giới hạn trong sân khấu ∪ runway ∪ bục tròn.
import { EYE_HEIGHT } from '../../world/layout';
import * as THREE from 'three';
import { isWalkable, clampToWalkable, nearestWalkable, WALK_MARGIN } from './walkLayout';

const PITCH_MIN = THREE.MathUtils.degToRad(-35);
const PITCH_MAX = THREE.MathUtils.degToRad(45);
const SPEED = 4;
/** Góc cúi mặc định (độ): sân khấu cao 3,5 m nên hơi cúi để thấy các hàng đầu. */
const DEFAULT_PITCH_DEG = -4;
const EYE = EYE_HEIGHT;

/** Đứng được (sân khấu ∪ mọi runway/bục trong walkLayout, lề WALK_MARGIN). */
export function walkable(x: number, z: number): boolean {
  return isWalkable(x, z, WALK_MARGIN);
}

/** Độ nhạy mouse-look (rad/px), lưu localStorage. */
const SENS_KEY = 'cs-look-sens';
const SENS_DEFAULT = 0.0022;
let lookSens = SENS_DEFAULT;
try {
  const v = parseFloat(localStorage.getItem(SENS_KEY) ?? '');
  if (Number.isFinite(v) && v > 0) lookSens = THREE.MathUtils.clamp(v, 0.0003, 0.02);
} catch { /* ignore */ }
export function setLookSensitivity(v: number): void {
  if (!Number.isFinite(v) || v <= 0) return;
  lookSens = THREE.MathUtils.clamp(v, 0.0003, 0.02);
  try { localStorage.setItem(SENS_KEY, String(lookSens)); } catch { /* ignore */ }
}
export function getLookSensitivity(): number {
  return lookSens;
}

/** Ẩn con trỏ bằng CSS khi mouse-look (cả pointer lock lẫn chế độ "sticky"). */
const HIDE_CLASS = 'cs-mouselook';
function ensureCursorStyle() {
  if (typeof document === 'undefined' || document.getElementById('cs-mouselook-style')) return;
  const st = document.createElement('style');
  st.id = 'cs-mouselook-style';
  st.textContent = `body.${HIDE_CLASS}, body.${HIDE_CLASS} canvas { cursor: none !important; }`;
  document.head.appendChild(st);
}

/** Góc nhìn: 'singer' = ngôi thứ nhất; còn lại lấy pose từ provider (cameraCrew.getView). */
export type ViewMode = 'singer' | 'aerial' | 'flycam' | 'pit' | 'crane' | 'wide';
/** Danh sách góc máy theo thứ tự phím V, kèm nhãn tiếng Việt (UI dựng nút từ đây). */
export const VIEW_MODES: readonly { id: ViewMode; label: string }[] = [
  { id: 'singer', label: 'Ca sĩ' },
  { id: 'aerial', label: 'Trên không' },
  { id: 'flycam', label: 'Flycam' },
  { id: 'pit', label: 'Hố' },
  { id: 'crane', label: 'Cần cẩu' },
  { id: 'wide', label: 'Toàn cảnh' },
];
export const VIEW_ORDER: ViewMode[] = VIEW_MODES.map((v) => v.id);
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
  let pitch = THREE.MathUtils.degToRad(DEFAULT_PITCH_DEG);
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
  let debugPose: ViewPose | null = null;

  /** Gọi trong scene.onBeforeRender: ghi đè transform camera (stage.ts đã đặt góc ngôi thứ nhất). */
  const applyCamera = (camera: THREE.Camera) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (baseFov === null) baseFov = camera.fov;
    const now = performance.now();
    const dt = hasLast ? Math.min(0.25, Math.max(0, (now - lastMs) / 1000)) : 0;
    lastMs = now;
    const pose = debugPose ?? (viewMode !== 'singer' && provider ? provider(viewMode) : null);
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

  // Mouse-look: pointer lock (ẩn con trỏ), hoặc "sticky" (không có/lỗi pointer lock) dùng pointermove
  // movementX/Y + CSS cursor:none. Mọi đường bật/tắt đều đi qua applyState → luôn phát 'cs-mouselook'.
  let mouseLook = false;
  let sticky = false;
  const NOLOOK = 'button,input,textarea,select,a,label,[data-nodrag]';
  const canvasEl = () => document.querySelector('canvas') as HTMLCanvasElement | null;
  ensureCursorStyle();
  const applyState = (on: boolean) => {
    const changed = on !== mouseLook;
    mouseLook = on;
    if (!on) sticky = false;
    document.body?.classList.toggle(HIDE_CLASS, on);
    if (changed) window.dispatchEvent(new CustomEvent('cs-mouselook', { detail: { on } }));
  };
  /** Bật/tắt mouse-look. Gọi đồng bộ trong handler click/phím (pointer lock cần user gesture). */
  const setMouseLook = (on: boolean) => {
    if (on === mouseLook) return;
    if (on) {
      sticky = false;
      dragId = null;
      const c = canvasEl();
      try {
        if (c && typeof c.requestPointerLock === 'function') {
          const r = c.requestPointerLock() as unknown as Promise<void> | undefined;
          if (r && typeof r.catch === 'function') r.catch(() => { if (mouseLook && document.pointerLockElement !== c) sticky = true; });
        } else sticky = true;
      } catch { sticky = true; }
      applyState(true);
    } else {
      applyState(false);
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ }
    }
  };
  let wasLocked = false;
  const onLockChange = () => {
    const locked = !!document.pointerLockElement;
    if (locked) {
      sticky = false;
      if (!mouseLook) applyState(true); // khoá do nơi khác yêu cầu → đồng bộ trạng thái
    } else if (wasLocked && mouseLook) {
      applyState(false); // Esc / trình duyệt tự nhả khoá
    }
    wasLocked = locked;
  };
  const onLockError = () => { if (mouseLook) sticky = true; };
  const onDblClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t || (t.closest && t.closest(NOLOOK))) return;
    if (!(t instanceof HTMLCanvasElement) && !document.pointerLockElement) return;
    setMouseLook(!mouseLook);
  };
  const lookDelta = (dx: number, dy: number) => {
    if (viewMode !== 'singer') return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    // chặn bước nhảy bất thường (một số trình duyệt gửi delta khổng lồ ngay khi khoá)
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
    yaw -= dx * lookSens;
    pitch = THREE.MathUtils.clamp(pitch - dy * lookSens, PITCH_MIN, PITCH_MAX);
  };
  /** Một nguồn duy nhất cho delta chuột khi mouse-look (pointermove; mousemove chỉ khi không có PointerEvent). */
  const onLookMove = (e: MouseEvent) => {
    if (!mouseLook) return;
    if ((e as PointerEvent).pointerType && (e as PointerEvent).pointerType !== 'mouse') return;
    if (document.pointerLockElement || sticky) lookDelta(e.movementX, e.movementY);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.code === 'KeyM') { if (!e.repeat) setMouseLook(!mouseLook); return; }
    if (e.code === 'Escape' && mouseLook) { setMouseLook(false); return; }
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
    if (mouseLook) { onLookMove(e); return; }
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
  const usePointer = typeof window.PointerEvent === 'function';
  if (!usePointer) document.addEventListener('mousemove', onLookMove);

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
    setLookSensitivity,
    getLookSensitivity,
    /** Debug/kiểm thử: đặt vị trí (chiếu vào lối đi gần nhất) và hướng nhìn. */
    teleport(x: number, z: number, yawRad?: number, pitchRad?: number) {
      const p = nearestWalkable(x, z);
      pos.x = p.x; pos.z = p.z; vel.set(0, 0);
      if (yawRad !== undefined) yaw = yawRad;
      if (pitchRad !== undefined) pitch = THREE.MathUtils.clamp(pitchRad, PITCH_MIN, PITCH_MAX);
    },
    /** Debug: camera ở vị trí tuỳ ý (vd. nhìn từ trên cao); null = về lại ngôi thứ nhất. */
    setDebugCamera(p: { x: number; y: number; z: number; tx: number; ty: number; tz: number; fov?: number } | null) {
      debugPose = p ? { position: new THREE.Vector3(p.x, p.y, p.z), target: new THREE.Vector3(p.tx, p.ty, p.tz), fov: p.fov ?? 60 } : null;
    },
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
      const p = clampToWalkable(pos, { x: nx, z: nz });
      // trượt dọc mép: vận tốc = chuyển động thực (bỏ thành phần đâm vào tường)
      if (p.x !== nx || p.z !== nz) { vel.x = (p.x - pos.x) / dt; vel.y = (p.z - pos.z) / dt; }
      pos.x = p.x;
      pos.z = p.z;
    },
    reset() {
      pos.set(0, EYE, 0);
      vel.set(0, 0);
      yaw = 0;
      pitch = THREE.MathUtils.degToRad(DEFAULT_PITCH_DEG);
    },
    dispose() {
      setMouseLook(false);
      detachHook();
      if (current === api) current = null;
      window.removeEventListener('dblclick', onDblClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      document.removeEventListener('mousemove', onLookMove);
      document.body?.classList.remove(HIDE_CLASS);
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
/** Controls đang hoạt động (zones/arena/index.ts tạo trong createArenaZone). */
export function getControls(): StageControls | null {
  return current;
}
