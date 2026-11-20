// Sự kiện BÍ MẬT khi Hype chạm đỉnh: UFO / tên lửa + pháo hoa / rồng — chọn theo xác suất (SECRET_CHANCES).
// Mỗi sự kiện ~20–24 s, ≤ 4 draw call khi chạy, ẩn khi rảnh. Phát window CustomEvent 'cs-secret' {kind, phase}.
import type * as THREE from 'three';
import type { FrameState } from '../core/types';
import { SecretTrigger, pickAnySecret, type SecretKind } from './secretRoll';
import type { SecretAct } from './secretShared';
import { createUfo } from './secretUfo';
import { createRocket } from './secretRocket';
import { createDragon } from './secretDragon';

export type { SecretKind } from './secretRoll';

/** Chance (0..1) that each secret appears when Hype hits its maximum; the rest of the time nothing secret happens. */
export const SECRET_CHANCES: Record<SecretKind, number> = { ufo: 0.25, rocket: 0.2, dragon: 0.1 };

export function setSecretChances(c: Partial<Record<SecretKind, number>>): void {
  for (const k of ['ufo', 'rocket', 'dragon'] as const) {
    const v = c[k];
    if (typeof v === 'number' && Number.isFinite(v)) SECRET_CHANCES[k] = Math.min(1, Math.max(0, v));
  }
}

export interface SecretEvents {
  update(f: FrameState): void;
  dispose(): void;
}

let pending: { kind: SecretKind; force: boolean } | null = null;
let current: { request(kind: SecretKind, force: boolean): void } | null = null;

/** Force an event now (for test buttons). No-op if one is already running, unless force = true. */
export function triggerSecret(kind?: SecretKind, force = false): void {
  const k = kind && kind in SECRET_CHANCES ? kind : pickAnySecret(SECRET_CHANCES, Math.random);
  if (current) current.request(k, force);
  else pending = { kind: k, force };
}

if (typeof window !== 'undefined') {
  (window as unknown as { __csSecret: unknown }).__csSecret = { trigger: triggerSecret, chances: SECRET_CHANCES };
}

const emit = (kind: SecretKind, phase: 'start' | 'end') => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cs-secret', { detail: { kind, phase } }));
};

export function createSecretEvents(scene: THREE.Scene): SecretEvents {
  const factories: Record<SecretKind, (s: THREE.Scene) => SecretAct> = { ufo: createUfo, rocket: createRocket, dragon: createDragon };
  const acts: Partial<Record<SecretKind, SecretAct>> = {}; // tạo lười ở lần đầu cần
  const trigger = new SecretTrigger(SECRET_CHANCES);
  let running: { kind: SecretKind; act: SecretAct; t: number } | null = null;
  let queued: SecretKind | null = null;

  const end = () => {
    if (!running) return;
    running.act.stop();
    emit(running.kind, 'end');
    running = null;
    trigger.ended();
  };
  const begin = (kind: SecretKind) => {
    const act = (acts[kind] ??= factories[kind](scene));
    act.start();
    running = { kind, act, t: 0 };
    emit(kind, 'start');
  };

  const self = {
    request(kind: SecretKind, force: boolean) {
      if (running && !force) return;
      queued = kind;
    },
  };
  current = self;
  if (pending) { self.request(pending.kind, pending.force); pending = null; }

  return {
    update(f: FrameState) {
      const dt = Math.min(Math.max(f.dt, 0), 0.1);
      const rolled = trigger.step(f.hype, dt, running !== null);
      if (queued) {
        end();
        begin(queued);
        queued = null;
      } else if (rolled && !running) begin(rolled);
      if (running) {
        running.t += dt;
        if (running.t >= running.act.duration) end();
        else running.act.update(running.t, f);
      }
    },
    dispose() {
      if (running) running.act.stop();
      running = null;
      for (const a of Object.values(acts)) a?.dispose();
      if (current === self) current = null;
    },
  };
}
