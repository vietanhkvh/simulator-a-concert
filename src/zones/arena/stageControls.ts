// Đi lại (phím mũi tên) + nhìn 360° (kéo chuột/chạm, Q/E). Giới hạn trong sân khấu ∪ runway ∪ bục tròn.
import { EYE_HEIGHT } from '../../world/layout';
import * as THREE from 'three';
import { isWalkable, clampToWalkable, nearestWalkable, WALK_MARGIN } from './walkLayout';
import {
  aerialPosition, clamp, clampHeightOffset, clampZoom, composeFov, composeLook, freeFlyStep, lookAngles, rigHeightRange,
  SINGER_FOV_MAX, SINGER_FOV_MIN, VIEW_CONTROL_HINTS, VIEW_PITCH_LIMIT,
} from './viewControl';

export { VIEW_CONTROL_HINTS };

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
/**
 * `rig: true` = pose tự động của đội quay phim (cameraCrew) → nhận đủ điều khiển người chơi (quỹ đạo, nâng/hạ, bay tự do).
 * Pose không có cờ (màn chào sân, sự kiện bí mật) = ghi đè: chỉ xoay + phóng to, offset được đặt lại khi ghi đè bắt đầu.
 */
export interface ViewPose { position: THREE.Vector3; target: THREE.Vector3; fov: number; rig?: boolean }
export type ViewProvider = (mode: ViewMode) => ViewPose | null;
const BLEND_SEC = 0.6;
type ExtMode = Exclude<ViewMode, 'singer'>;
/** Offset người chơi trên một góc máy ngoài (rad / hệ số FOV / m). */
interface ViewOffset { yaw: number; pitch: number; zoom: number; zoomT: number; height: number; hVel: number }
const newOffset = (): ViewOffset => ({ yaw: 0, pitch: 0, zoom: 1, zoomT: 1, height: 0, hVel: 0 });
/** Tốc độ nâng/hạ (m/s) theo rig. */
const LIFT_SPEED: Record<ExtMode, number> = { aerial: 9, flycam: 0, pit: 0.8, crane: 2.5, wide: 2 };
const FREEFLY_SPEED = 8;
const FREEFLY_FAST = 3;
/** Trạng thái điều khiển góc máy cho UI (độ, m). yaw/pitch/fov/height = camera thực đang hiển thị. */
export interface ViewControlState {
  mode: ViewMode; freeFly: boolean; yaw: number; pitch: number; fov: number; height: number;
  offset: { yaw: number; pitch: number; zoom: number; height: number };
}

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

  // ── Điều khiển góc máy ngoài (offset người chơi, nhớ theo từng góc máy; đặt lại khi bài mới bắt đầu) ──
  const offs: Record<ExtMode, ViewOffset> = { aerial: newOffset(), flycam: newOffset(), pit: newOffset(), crane: newOffset(), wide: newOffset() };
  let singerFovT: number | null = null; // null = FOV gốc
  let singerFov: number | null = null;
  const ff = { on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 45 };
  let overrideActive = false;
  let autoFovNow = 50;
  let autoPitchNow = 0;
  const tEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const freeFlyActive = () => ff.on && viewMode === 'flycam';
  const startBlend = () => { if (hasLast) { fromPos.copy(lastPos); fromQuat.copy(lastQuat); fromFov = lastFov; blend = 0; } };
  const setFreeFly = (on: boolean) => {
    if (on === ff.on) return;
    if (on) {
      if (viewMode !== 'flycam' || overrideActive || !hasLast) return;
      ff.pos.copy(lastPos);
      tEuler.setFromQuaternion(lastQuat, 'YXZ');
      ff.yaw = tEuler.y;
      ff.pitch = clamp(tEuler.x, -VIEW_PITCH_LIMIT, VIEW_PITCH_LIMIT);
      ff.fov = lastFov;
      ff.vel.set(0, 0, 0);
      const o = offs.flycam;
      o.yaw = o.pitch = 0; o.zoom = o.zoomT = 1;
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) keys.delete(k); // ca sĩ không đi tiếp
    } else if (viewMode === 'flycam') startBlend(); // drone + camera trượt mượt về đường bay tự động
    ff.on = on;
    window.dispatchEvent(new CustomEvent('cs-freefly', { detail: { on } }));
  };
  /** Đặt lại offset (xoay, zoom, độ cao, bay tự do) của một góc máy, hoặc mọi góc khi mode = undefined. */
  const resetViewOffsets = (mode?: ViewMode) => {
    const list: ExtMode[] = mode === undefined ? ['aerial', 'flycam', 'pit', 'crane', 'wide'] : mode === 'singer' ? [] : [mode];
    let changed = false;
    for (const m of list) {
      const o = offs[m];
      if (o.yaw || o.pitch || o.zoomT !== 1 || o.zoom !== 1 || o.height) changed = true;
      Object.assign(o, newOffset());
    }
    if (mode === undefined || mode === 'singer') singerFovT = null;
    if ((mode === undefined || mode === 'flycam') && ff.on) setFreeFly(false);
    else if (changed && mode !== undefined && mode === viewMode) startBlend();
  };
  /** Kéo chuột / mouse-look / chạm: dx, dy (px) × độ nhạy. */
  const viewDrag = (dx: number, dy: number, s: number) => {
    if (viewMode === 'singer') {
      yaw -= dx * s;
      pitch = THREE.MathUtils.clamp(pitch - dy * s, PITCH_MIN, PITCH_MAX);
      return;
    }
    if (freeFlyActive() && !overrideActive) {
      ff.yaw -= dx * s;
      ff.pitch = clamp(ff.pitch - dy * s, -VIEW_PITCH_LIMIT, VIEW_PITCH_LIMIT);
      return;
    }
    const o = offs[viewMode];
    o.yaw -= dx * s;
    if (o.yaw > Math.PI * 4 || o.yaw < -Math.PI * 4) o.yaw = Math.atan2(Math.sin(o.yaw), Math.cos(o.yaw));
    o.pitch = clamp(o.pitch - dy * s, -VIEW_PITCH_LIMIT - autoPitchNow, VIEW_PITCH_LIMIT - autoPitchNow);
  };
  const viewZoom = (delta: number) => {
    const f = Math.exp(clamp(delta, -300, 300) * 0.0012);
    if (viewMode === 'singer') {
      singerFovT = clamp((singerFovT ?? baseFov ?? 70) * f, SINGER_FOV_MIN, SINGER_FOV_MAX);
      return;
    }
    const o = offs[viewMode];
    o.zoomT = clampZoom(o.zoomT * f, freeFlyActive() ? ff.fov : autoFovNow);
  };
  const key = (c: string) => keys.has(c);
  /** Phím giữ (R/F, bay tự do) + làm mượt zoom; chạy trong applyCamera với dt thật (cả khi pause). */
  const stepHeld = (dt: number, pose: ViewPose | null, isRig: boolean) => {
    const fast = key('ShiftLeft') || key('ShiftRight');
    const up = (key('KeyR') ? 1 : 0) - (key('KeyF') ? 1 : 0);
    const kz = 1 - Math.exp(-10 * dt);
    for (const m of Object.keys(offs) as ExtMode[]) {
      const o = offs[m];
      o.zoom += (o.zoomT - o.zoom) * (m === viewMode ? kz : 1);
      if (Math.abs(o.zoom - o.zoomT) < 1e-4) o.zoom = o.zoomT;
    }
    if (singerFovT !== null || singerFov !== null) {
      const tgt = singerFovT ?? baseFov ?? 70;
      singerFov = (singerFov ?? baseFov ?? 70) + (tgt - (singerFov ?? baseFov ?? 70)) * (viewMode === 'singer' ? kz : 1);
      if (Math.abs(singerFov - tgt) < 1e-3) singerFov = singerFovT === null ? null : tgt;
    }
    if (viewMode === 'singer' || !pose || !isRig) return;
    if (freeFlyActive()) {
      const fwd = (key('KeyW') ? 1 : 0) - (key('KeyS') ? 1 : 0);
      const right = (key('KeyD') ? 1 : 0) - (key('KeyA') ? 1 : 0);
      const sp = FREEFLY_SPEED * (fast ? FREEFLY_FAST : 1);
      const len = Math.hypot(fwd, right, up) || 1;
      const k = 1 - Math.exp(-6 * dt);
      ff.vel.x += ((fwd / len) * sp - ff.vel.x) * k;
      ff.vel.y += ((right / len) * sp - ff.vel.y) * k;
      ff.vel.z += ((up / len) * sp - ff.vel.z) * k;
      if (ff.vel.lengthSq() > 1e-6) {
        const p = freeFlyStep(ff.pos, ff.yaw, ff.vel.x, ff.vel.y, ff.vel.z, 1, dt);
        ff.pos.set(p.x, p.y, p.z);
      }
      return;
    }
    const range = rigHeightRange(viewMode);
    if (!range) return;
    const o = offs[viewMode];
    const want = up * LIFT_SPEED[viewMode] * (fast ? 2.5 : 1);
    o.hVel += (want - o.hVel) * (1 - Math.exp(-8 * dt));
    if (Math.abs(o.hVel) < 1e-3 && up === 0) o.hVel = 0;
    o.height = clampHeightOffset(o.height + o.hVel * dt, pose.position.y, range[0], range[1]);
  };

  /** Gọi trong scene.onBeforeRender: ghi đè transform camera (stage.ts đã đặt góc ngôi thứ nhất). */
  const applyCamera = (camera: THREE.Camera) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (baseFov === null) baseFov = camera.fov;
    const now = performance.now();
    const dt = hasLast ? Math.min(0.25, Math.max(0, (now - lastMs) / 1000)) : 0;
    lastMs = now;
    const pose = debugPose ?? (viewMode !== 'singer' && provider ? provider(viewMode) : null);
    const isRig = !!pose && !debugPose && pose.rig === true;
    const isOverride = !!pose && !debugPose && !pose.rig;
    if (isOverride && !overrideActive) resetViewOffsets(viewMode); // ghi đè bắt đầu → bỏ offset cũ
    overrideActive = isOverride;
    stepHeld(dt, pose, isRig);
    let tFov: number;
    if (pose && debugPose) {
      tPos.copy(pose.position);
      lookM.lookAt(pose.position, pose.target, UP);
      tQuat.setFromRotationMatrix(lookM);
      tFov = pose.fov;
    } else if (pose && viewMode !== 'singer') {
      const o = offs[viewMode];
      autoFovNow = pose.fov;
      if (isRig && freeFlyActive()) {
        tPos.copy(ff.pos);
        tQuat.setFromEuler(tEuler.set(ff.pitch, ff.yaw, 0, 'YXZ'));
        tFov = composeFov(ff.fov, o.zoom);
      } else {
        let lookYaw = o.yaw;
        if (isRig && viewMode === 'aerial') {
          const p = aerialPosition(pose.position, pose.target, o.yaw, o.height);
          tPos.set(p.x, p.y, p.z);
          lookYaw = 0; // yaw = quỹ đạo quanh trục sân khấu, hướng nhìn vẫn về tâm
        } else {
          tPos.copy(pose.position);
          if (isRig && o.height) tPos.y += o.height;
        }
        const [ay, ap] = lookAngles(tPos.x, tPos.y, tPos.z, pose.target.x, pose.target.y, pose.target.z);
        autoPitchNow = ap;
        if (lookYaw === 0 && o.pitch === 0) {
          lookM.lookAt(tPos, pose.target, UP);
          tQuat.setFromRotationMatrix(lookM);
        } else {
          const l = composeLook(ay, ap, lookYaw, o.pitch);
          tQuat.setFromEuler(tEuler.set(l.pitch, l.yaw, 0, 'YXZ'));
        }
        tFov = composeFov(pose.fov, o.zoom);
      }
    } else {
      tPos.copy(camera.position);
      tQuat.copy(camera.quaternion);
      tFov = singerFov ?? baseFov;
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
    const wasFree = freeFlyActive();
    viewMode = mode;
    overrideActive = false;
    if (wasFree) window.dispatchEvent(new CustomEvent('cs-freefly', { detail: { on: false } }));
    else if (freeFlyActive()) window.dispatchEvent(new CustomEvent('cs-freefly', { detail: { on: true } }));
    startBlend();
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
  const handled = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
    'KeyR', 'KeyF', 'ShiftLeft', 'ShiftRight']);

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
    // góc máy ngoài: nháy đúp = đặt lại góc máy; góc ca sĩ: bật/tắt mouse-look như cũ
    if (viewMode !== 'singer') { resetViewOffsets(viewMode); return; }
    setMouseLook(!mouseLook);
  };
  /** Lăn chuột / vuốt trackpad trên khung 3D: phóng to/thu nhỏ (không zoom khi con trỏ trên bảng UI). */
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    const t = e.target as HTMLElement | null;
    if (!document.pointerLockElement) {
      if (!(t instanceof HTMLCanvasElement) || (t.closest && t.closest(NOLOOK))) return;
      if (t.clientWidth < window.innerWidth * 0.5) return; // canvas nhỏ trong UI, không phải khung 3D
    }
    const d = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    if (!Number.isFinite(d) || d === 0) return;
    e.preventDefault();
    viewZoom(d);
  };
  const lookDelta = (dx: number, dy: number) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    // chặn bước nhảy bất thường (một số trình duyệt gửi delta khổng lồ ngay khi khoá)
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
    viewDrag(dx, dy, lookSens);
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
    if (e.code === 'Digit0' || e.code === 'Numpad0') { if (!e.repeat) resetViewOffsets(viewMode); return; }
    if (e.code === 'KeyG') { if (!e.repeat && viewMode === 'flycam') setFreeFly(!ff.on); return; }
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
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;
    const s = e.pointerType === 'touch' ? 0.006 : 0.0045;
    viewDrag(dx, dy, s);
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
  window.addEventListener('wheel', onWheel, { passive: false });
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
    /** Flycam bay tự do (phím G, chỉ ở góc flycam). Phát 'cs-freefly' { on }. */
    setFreeFly,
    isFreeFly: () => freeFlyActive(),
    /** Pose drone khi bay tự do (cameraCrew cho drone đi theo), null = đường bay tự động. Đối tượng dùng lại. */
    getFreeFlyCam: () => (ff.on ? ff : null) as { readonly pos: THREE.Vector3; readonly yaw: number; readonly pitch: number } | null,
    /** Đặt lại offset người chơi (phím 0): một góc máy, hoặc mọi góc (bài mới) khi bỏ trống. */
    resetViewOffsets,
    /** Trạng thái góc máy cho UI: độ (yaw/pitch/fov), m (height = độ cao camera). */
    getViewControlState(): ViewControlState {
      tEuler.setFromQuaternion(lastQuat, 'YXZ');
      const o = viewMode === 'singer' ? null : offs[viewMode];
      const r2d = THREE.MathUtils.radToDeg;
      return {
        mode: viewMode, freeFly: freeFlyActive(),
        yaw: r2d(tEuler.y), pitch: r2d(tEuler.x), fov: lastFov, height: lastPos.y,
        offset: { yaw: o ? r2d(o.yaw) : 0, pitch: o ? r2d(o.pitch) : 0, zoom: o ? o.zoomT : (singerFovT ?? baseFov ?? 70) / (baseFov ?? 70), height: o ? o.height : 0 },
      };
    },
    /** Vị trí camera vừa hiển thị (sau mọi offset). */
    getCameraPosition: () => lastPos.clone(),
    pos,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    /** rawDt: dt thật (cho Q/E khi pause vẫn 0 → không xoay). */
    update(dt: number) {
      if (dt <= 0) return;
      if (keys.has('KeyQ')) yaw += 1.8 * dt;
      if (keys.has('KeyE')) yaw -= 1.8 * dt;
      // bay tự do: W/A/S/D điều khiển drone, không đi ca sĩ (mũi tên vẫn đi)
      const wasd = !freeFlyActive();
      const f = (keys.has('ArrowUp') || (wasd && keys.has('KeyW')) ? 1 : 0) - (keys.has('ArrowDown') || (wasd && keys.has('KeyS')) ? 1 : 0);
      const r = (keys.has('ArrowRight') || (wasd && keys.has('KeyD')) ? 1 : 0) - (keys.has('ArrowLeft') || (wasd && keys.has('KeyA')) ? 1 : 0);
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
      window.removeEventListener('wheel', onWheel);
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
