// Chế độ developer: bật/tắt từng "lớp" vật thể của một khu mà không sửa module tạo ra chúng.
// track(name, fn) ghi nhận những vật thể mà fn() thêm thẳng vào scene; set(name, false) gỡ chúng khỏi
// scene, set(name, true) gắn lại. Vật thể module tự tạo muộn (sau lúc khởi tạo) không được ghi nhận.
import type * as THREE from 'three';

export interface DebugLayers {
  /** Chạy fn và gán mọi vật thể fn thêm vào scene cho lớp `name`. */
  track<T>(name: string, fn: () => T): T;
  /** Tên các lớp có ít nhất một vật thể. */
  names(): string[];
  /** false nếu không có lớp này (không bật/tắt được). */
  set(name: string, on: boolean): boolean;
  get(name: string): boolean;
  setAll(on: boolean): void;
}

export function createDebugLayers(scene: THREE.Scene): DebugLayers {
  const groups = new Map<string, THREE.Object3D[]>();
  const hidden = new Map<string, THREE.Object3D[]>(); // tên → vật thể đã gỡ khỏi scene
  const set = (name: string, on: boolean): boolean => {
    const objs = groups.get(name);
    if (!objs?.length) return false;
    if (!on && !hidden.has(name)) {
      const removed = objs.filter((o) => o.parent === scene);
      for (const o of removed) scene.remove(o);
      hidden.set(name, removed);
    } else if (on && hidden.has(name)) {
      for (const o of hidden.get(name) ?? []) if (!o.parent) scene.add(o);
      hidden.delete(name);
    }
    return true;
  };
  return {
    track(name, fn) {
      const before = new Set(scene.children);
      const r = fn();
      const added = scene.children.filter((c) => !before.has(c));
      groups.set(name, [...(groups.get(name) ?? []), ...added]);
      return r;
    },
    names: () => [...groups.keys()].filter((n) => (groups.get(n)?.length ?? 0) > 0),
    set,
    get: (name) => !hidden.has(name),
    setAll(on) { for (const n of groups.keys()) set(n, on); },
  };
}
