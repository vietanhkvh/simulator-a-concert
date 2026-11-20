import type { GameEvents } from './types';

type Handler<T> = (payload: T) => void;

/** Bus sự kiện có kiểu. Dùng cho sự kiện rời rạc; dữ liệu mỗi frame đi qua FrameState. */
export class EventBus<E extends object = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    this.handlers.get(type)?.forEach((fn) => (fn as Handler<E[K]>)(payload));
  }
}
