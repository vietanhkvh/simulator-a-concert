// Chế độ developer: bật/tắt từng "lớp" vật thể của một khu mà không sửa module tạo ra chúng.
// track(name, fn) ghi nhận những vật thể mà fn() thêm thẳng vào scene; set(name, false) gỡ chúng khỏi
// cha của chúng (scene hoặc nhóm), set(name, true) gắn lại. Gỡ khỏi cha (thay vì đặt visible=false) vì nhiều module
// tự ghi đè `visible` mỗi frame.
//   watch(name, fn): như track nhưng dùng cho vật thể module tạo MUỘN (lúc chạy, vd. sự kiện bí mật): vật thể mới
//     thêm vào scene khi fn chạy được gán cho lớp; nếu lớp đang ẩn thì chúng bị gỡ ngay.
//   split(from, to, pred): tách khỏi lớp `from` (kể cả vật thể lồng trong nhóm) những vật thể thỏa pred thành lớp
//     mới `to` (vd. cực quang / sao / laser nằm chung một nhóm với vật khác).
import type * as THREE from 'three';

export interface DebugLayers {
  /** Chạy fn và gán mọi vật thể fn thêm vào scene cho lớp `name`. */
  track<T>(name: string, fn: () => T): T;
  /** Như track, dùng mỗi frame cho vật thể tạo muộn; tôn trọng trạng thái ẩn hiện tại của lớp. */
  watch<T>(name: string, fn: () => T): T;
  /** Tách vật thể (cả lồng sâu) của lớp `from` thỏa pred sang lớp `to`. Trả về số vật thể tách được. */
  split(from: string, to: string, pred: (o: THREE.Object3D) => boolean): number;
  /** Tên các lớp có ít nhất một vật thể. */
  names(): string[];
  /** false nếu không có lớp này (không bật/tắt được). */
  set(name: string, on: boolean): boolean;
  get(name: string): boolean;
  setAll(on: boolean): void;
}

interface Hidden { obj: THREE.Object3D; parent: THREE.Object3D }

export function createDebugLayers(scene: THREE.Scene): DebugLayers {
  const groups = new Map<string, THREE.Object3D[]>();
  const hidden = new Map<string, Hidden[]>(); // tên → vật thể đã gỡ (kèm cha cũ)
  const hide = (name: string, objs: THREE.Object3D[]) => {
    const list = hidden.get(name) ?? [];
    for (const o of objs) if (o.parent) { list.push({ obj: o, parent: o.parent }); o.parent.remove(o); }
    hidden.set(name, list);
  };
  const set = (name: string, on: boolean): boolean => {
    const objs = groups.get(name);
    if (!objs?.length) return false;
    if (!on && !hidden.has(name)) hide(name, objs);
    else if (on && hidden.has(name)) {
      for (const h of hidden.get(name) ?? []) if (!h.obj.parent) h.parent.add(h.obj);
      hidden.delete(name);
    }
    return true;
  };
  const add = (name: string, objs: THREE.Object3D[]) => {
    if (!objs.length) return;
    groups.set(name, [...(groups.get(name) ?? []), ...objs]);
    if (hidden.has(name)) hide(name, objs); // lớp đang ẩn: vật thể mới cũng ẩn
  };
  return {
    track(name, fn) {
      const before = new Set(scene.children);
      const r = fn();
      add(name, scene.children.filter((c) => !before.has(c)));
      return r;
    },
    watch(name, fn) {
      const n = scene.children.length;
      const before = new Set(scene.children);
      const r = fn();
      if (scene.children.length !== n) add(name, scene.children.filter((c) => !before.has(c)));
      return r;
    },
    split(from, to, pred) {
      const src = groups.get(from) ?? [];
      const found: THREE.Object3D[] = [];
      const visit = (o: THREE.Object3D) => { if (pred(o)) found.push(o); else for (const c of o.children) visit(c); };
      for (const o of src) visit(o);
      if (!found.length) return 0;
      const top = new Set(found.filter((o) => src.includes(o)));
      groups.set(from, src.filter((o) => !top.has(o)));
      add(to, found);
      return found.length;
    },
    names: () => [...groups.keys()].filter((n) => (groups.get(n)?.length ?? 0) > 0),
    set,
    get: (name) => !hidden.has(name),
    setAll(on) { for (const n of groups.keys()) set(n, on); },
  };
}
