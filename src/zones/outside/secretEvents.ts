// Sự kiện BÍ MẬT khi Hype chạm đỉnh: UFO / tên lửa + pháo hoa / rồng / phi đội phản lực vẽ khói — chọn theo xác suất (SECRET_CHANCES).
// Mỗi sự kiện ~20–24 s, ≤ 4 draw call khi chạy, ẩn khi rảnh. Phát window CustomEvent 'cs-secret' {kind, phase}.
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { SecretTrigger, pickAnySecret, type SecretKind } from './secretRoll';
import { emitSecret, secretFocusState, type SecretAct } from './secretShared';

export type { SecretKind } from './secretRoll';

/** Chance (0..1) that each secret appears when Hype hits its maximum; the rest of the time nothing secret happens. */
export const SECRET_CHANCES: Record<SecretKind, number> = { ufo: 0.2, rocket: 0.2, dragon: 0.1, jet: 0.2 };

export function setSecretChances(c: Partial<Record<SecretKind, number>>): void {
  for (const k of ['ufo', 'rocket', 'dragon', 'jet'] as const) {
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
  void preloadDefaultSecrets();
  const k = kind && kind in SECRET_CHANCES ? kind : pickAnySecret(SECRET_CHANCES, Math.random);
  if (current) current.request(k, force);
  else pending = { kind: k, force };
}

if (typeof window !== 'undefined') {
  (window as unknown as { __csSecret: unknown }).__csSecret = { trigger: triggerSecret, chances: SECRET_CHANCES, setChances: setSecretChances, focus: getSecretFocus };
}

const emit = (kind: SecretKind, phase: 'start' | 'end') => emitSecret(kind, phase);

/** Điểm nhìn mặc định khi act không tự báo (UFO lơ lửng / rồng phun lửa). */
const FOCUS_FALLBACK: Record<SecretKind, THREE.Vector3> = {
  ufo: new THREE.Vector3(0, 18, -40),
  rocket: new THREE.Vector3(0, 50, -20),
  dragon: new THREE.Vector3(-4, 20, -62),
  jet: new THREE.Vector3(0, 48, -20),
};

/** Điểm đáng nhìn hiện tại của sự kiện bí mật / máy bay kéo băng rôn (null khi không có gì). */
export function getSecretFocus(): THREE.Vector3 | null {
  return secretFocusState.active ? secretFocusState.v.clone() : null;
}

export type SecretFactories = Record<SecretKind, (s: THREE.Scene) => SecretAct>;

// Mã bốn sự kiện mặc định nằm ở chunk riêng (./secretActs): tải khi Hype ≥ 0,8 (sự kiện chỉ tung ở ≥ 0,95) hoặc khi có
// lệnh trigger. Sự kiện được tung trước khi tải xong sẽ chờ (vài chục ms) rồi mới bắt đầu; tải lỗi → bỏ lượt đó.
let defaultActs: typeof import('./secretActs') | null = null;
let defaultActsFailed = false;
let defaultActsLoading: Promise<void> | null = null;
/** Tải mã sự kiện bí mật mặc định (một lần). */
export function preloadDefaultSecrets(): Promise<void> {
  return (defaultActsLoading ??= import('./secretActs').then(
    (m) => { defaultActs = m; },
    (err: unknown) => { defaultActsFailed = true; console.warn('[secret] không tải được sự kiện bí mật', err); },
  ));
}
const needAct = (): typeof import('./secretActs') => {
  if (!defaultActs) throw new Error('secretActs chưa tải (preloadDefaultSecrets)');
  return defaultActs;
};
/** Builder mặc định (chibi) của từng sự kiện; index.ts thay từng cái theo phong cách (builders.ts). Gọi được sau khi tải. */
export const DEFAULT_SECRET_FACTORIES: SecretFactories = {
  ufo: (s) => needAct().createUfo(s),
  rocket: (s) => needAct().createRocket(s),
  dragon: (s) => needAct().createDragon(s),
  jet: (s) => needAct().createJet(s),
};

export function createSecretEvents(scene: THREE.Scene, factories: SecretFactories = DEFAULT_SECRET_FACTORIES): SecretEvents {
  const acts: Partial<Record<SecretKind, SecretAct>> = {}; // tạo lười ở lần đầu cần
  const trigger = new SecretTrigger(SECRET_CHANCES);
  let running: { kind: SecretKind; act: SecretAct; t: number } | null = null;
  let queued: SecretKind | null = null;
  const usesDefault = (Object.keys(factories) as SecretKind[]).some((k) => factories[k] === DEFAULT_SECRET_FACTORIES[k]);
  /** Builder của `kind` gọi được ngay? (builder mặc định cần chunk secretActs; builder phong cách nằm sẵn trong chunk của nó) */
  const ready = (kind: SecretKind): boolean => {
    if (factories[kind] !== DEFAULT_SECRET_FACTORIES[kind] || defaultActs) return true;
    void preloadDefaultSecrets();
    return false;
  };

  const end = () => {
    if (!running) return;
    running.act.stop();
    emit(running.kind, 'end');
    running = null;
    secretFocusState.active = false;
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
      if (usesDefault && f.hype >= 0.8 && !defaultActsLoading) void preloadDefaultSecrets();
      if (queued) {
        if (ready(queued)) {
          end();
          begin(queued);
          queued = null;
        } else if (defaultActsFailed) { queued = null; trigger.ended(); }
      } else if (rolled && !running) {
        if (ready(rolled)) begin(rolled);
        else if (!defaultActsFailed) queued = rolled; // chờ chunk tải xong
      }
      if (running) {
        running.t += dt;
        if (running.t >= running.act.duration) end();
        else {
          running.act.update(running.t, f);
          const fv = secretFocusState.v;
          if (running.act.focus) running.act.focus(running.t, fv);
          else fv.copy(FOCUS_FALLBACK[running.kind]);
          secretFocusState.active = true;
        }
      }
    },
    dispose() {
      if (running) { running.act.stop(); emit(running.kind, 'end'); } // main.ts trả lại góc máy cũ
      running = null;
      secretFocusState.active = false;
      for (const a of Object.values(acts)) a?.dispose();
      if (current === self) current = null;
    },
  };
}
