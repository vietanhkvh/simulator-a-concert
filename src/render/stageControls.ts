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
  const handled = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE']);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!handled.has(e.code) || isTyping()) return;
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
    if (t && t.closest && t.closest('button,input,textarea,select,a,label,[data-nodrag]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
  };
  const onMove = (e: PointerEvent) => {
    if (dragId !== e.pointerId) return;
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

  return {
    pos,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    /** rawDt: dt thật (cho Q/E khi pause vẫn 0 → không xoay). */
    update(dt: number) {
      if (dt <= 0) return;
      if (keys.has('KeyQ')) yaw += 1.8 * dt;
      if (keys.has('KeyE')) yaw -= 1.8 * dt;
      const f = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
      const r = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    },
  };
}
