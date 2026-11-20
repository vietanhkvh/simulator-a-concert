// Cảnh mở màn: 'jump' (nhảy khỏi trực thăng, đáp kiểu siêu anh hùng), 'lift' (bục nâng từ dưới sân khấu),
// 'cable' (thả dây tời từ trực thăng).
// Chạy trên đồng hồ riêng (update(f) cộng f.dt). Cung cấp pose camera + pose ca sĩ (quy ước mắt của singer.ts).
// Phát window CustomEvent 'cs-entrance' { kind, phase: 'start' | 'land' | 'end' }.
import { EYE_HEIGHT } from '../../world/layout';
import * as THREE from 'three';
import type { FrameState } from '../../core/types';
import { createCable, createHeli, createHeroFx, createLiftFx } from './entranceProps';

export type EntranceKind = 'jump' | 'lift' | 'cable';
export const ENTRANCE_SEC: Record<EntranceKind, number> = { jump: 9.0, lift: 8.0, cable: 9.8 };

export interface Entrance {
  play(kind: EntranceKind): void;
  update(f: FrameState): void;
  isPlaying(): boolean;
  getView(): { position: THREE.Vector3; target: THREE.Vector3; fov: number } | null;
  getSingerPose(): { position: THREE.Vector3; yaw: number } | null;
  getLandingSpot(): { x: number; z: number; yaw: number };
  skip(): void;
  dispose(): void;
}

const EYE = EYE_HEIGHT;
const LAND = new THREE.Vector3(0, EYE, -6.6); // đầu runway giữa, trước mép sân khấu, trước cổng z=-9
const FAR_TARGET = new THREE.Vector3(0, 1.4, -24); // nhìn ra khán giả từ sau lưng ca sĩ

// Mốc thời gian
const J = { T: ENTRANCE_SEC.jump, step: 2.0, jump: 2.4, streak: 5.3, impact: 6.6, rise: 7.0, stood: 8.4 };
const LF = { T: ENTRANCE_SEC.lift, open: 1.2, rise0: 1.4, lock: 6.0 };
const CB = { T: ENTRANCE_SEC.cable, down0: 1.2, touch: 7.4, detach: 7.7, climb: 8.0 };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const lerp = THREE.MathUtils.lerp;

interface Shot { pos: THREE.Vector3; target: THREE.Vector3; fov: number }
type ShotDef = [number, number, (o: Shot) => void];
const mkShot = (): Shot => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 60 });
function blendShot(out: Shot, a: Shot, b: Shot, e: number) {
  out.pos.lerpVectors(a.pos, b.pos, e);
  out.target.lerpVectors(a.target, b.target, e);
  out.fov = lerp(a.fov, b.fov, e);
}
/** Camera quỹ đạo quanh tâm c: θ = 0 trước mặt (phía khán giả, -Z), π = sau lưng (+Z). */
function orbit(out: THREE.Vector3, c: THREE.Vector3, theta: number, r: number, y: number) {
  out.set(c.x + Math.sin(theta) * r, y, c.z - Math.cos(theta) * r);
}

export function createEntrance(scene: THREE.Scene): Entrance {
  const heli = createHeli();
  const cable = createCable();
  const hero = createHeroFx(new THREE.Vector3(LAND.x, 0, LAND.z));
  const lift = createLiftFx(LAND);
  scene.add(heli.group, cable.group, hero.group, lift.group);

  let kind: EntranceKind = 'jump';
  let playing = false;
  let t = 0;
  let landed = false;

  const view = { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 60 };
  const pose = { position: new THREE.Vector3(), yaw: 0 };
  const sA = mkShot(), sB = mkShot(), sOut = mkShot();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), dir = new THREE.Vector3();

  /** Mỗi shot: [bắt đầu, thời gian hoà từ shot trước, hàm]. */
  function runShots(shots: ShotDef[], time: number) {
    let i = 0;
    while (i + 1 < shots.length && time >= shots[i + 1][0]) i++;
    shots[i][2](sB);
    const [start, bl] = shots[i];
    const e = bl > 0 ? smooth((time - start) / bl) : 1;
    if (i > 0 && e < 1) {
      shots[i - 1][2](sA);
      blendShot(sOut, sA, sB, e);
    } else blendShot(sOut, sB, sB, 1);
  }
  const shake = (age: number, amp: number) => {
    if (age <= 0) return;
    const a = amp * Math.exp(-age * 5);
    sOut.pos.x += Math.sin(age * 71) * a; sOut.pos.y += Math.sin(age * 53 + 1) * a;
    sOut.target.x += Math.sin(age * 61 + 2) * a * 0.6; sOut.target.y += Math.sin(age * 67) * a * 0.6;
  };
  /** Shot kết: vòng từ θ0 ra sau lưng ca sĩ, nhìn ra khán giả. */
  const endOrbit = (o: Shot, time: number, t0: number, t1: number, T: number, sp: THREE.Vector3, th0: number, r0: number, y0: number, fov0: number) => {
    const k = smooth((time - t0) / (t1 - t0));
    const k2 = smooth((time - (t1 - 0.6)) / (T - t1 + 0.6));
    orbit(o.pos, LAND, lerp(th0, th0 < 0 ? -Math.PI : Math.PI, k), lerp(r0, 3.4, k), lerp(y0, 2.35, smooth(k * 1.4)) + Math.sin(k * Math.PI) * 0.5);
    o.target.copy(sp).y -= 0.2;
    o.target.lerp(FAR_TARGET, k2);
    o.fov = lerp(fov0, 62, k);
  };

  // ================================================================ JUMP
  const HJ0 = new THREE.Vector3(5, 42, -26);
  const heliJ = (time: number, out: THREE.Vector3) => {
    const away = Math.max(0, time - (J.jump + 0.8));
    out.copy(HJ0).add(tmp.set(Math.sin(time * 0.9) * 0.3 + away * away * 2.0, Math.sin(time * 1.3) * 0.25 + away * 1.6, -away * away * 1.2));
    return out;
  };
  const doorJ = (time: number, out: THREE.Vector3) => heliJ(time, out).add(heli.door).add(tmp2.set(0, EYE, 0));
  const jP0 = new THREE.Vector3(), jP1 = new THREE.Vector3(0.6, 22, -7.2);
  doorJ(J.jump, jP0).z -= 0.6;
  const bez = (u: number, out: THREE.Vector3) => {
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    return out.set(a * jP0.x + b * jP1.x + c * LAND.x, a * jP0.y + b * jP1.y + c * LAND.y, a * jP0.z + b * jP1.z + c * LAND.z);
  };
  const jU = (time: number) => { const s = clamp01((time - J.jump) / (J.impact - J.jump)); return s * s * (0.45 + 0.55 * s); };
  const singerJump = (time: number, out: THREE.Vector3): number => {
    if (time < J.step) { doorJ(time, out); return 0; }
    if (time < J.jump) {
      const k = smooth((time - J.step) / (J.jump - J.step));
      doorJ(time, out);
      out.z -= 0.6 * k; out.y += Math.sin(k * Math.PI) * 0.35;
      return 0;
    }
    if (time < J.impact) {
      bez(jU(time), out);
      const s = (time - J.jump) / (J.impact - J.jump);
      return Math.sin(s * Math.PI * 2.0) * 0.6 * (1 - s);
    }
    out.copy(LAND);
    const age = time - J.impact;
    const crouch = 0.65 + 0.18 * Math.exp(-age * 7) * Math.cos(age * 14) - 0.65 * smooth((time - J.rise) / (J.stood - 0.3 - J.rise));
    out.y = EYE - Math.max(0, crouch);
    return 0;
  };
  const camJump = (time: number, sp: THREE.Vector3) => {
    const shots: ShotDef[] = [
      [0, 0, (o) => { o.pos.set(-8 + time * 0.8, 8 + time * 0.6, -52); heliJ(time, o.target).y -= 3; o.fov = 46; }],
      [1.3, 0.8, (o) => { heliJ(time, o.pos).add(tmp2.set(-6, -3.5, -10)); o.target.copy(sp).y -= 0.4; o.fov = 50; }],
      [J.jump + 0.2, 0.5, (o) => { o.pos.copy(sp).add(tmp.set(3.0, 1.6, -3.8)); o.target.copy(sp).y -= 2.4; o.fov = 66; }],
      [J.streak, 0.3, (o) => { o.pos.set(1.6, 0.7, -12.2); o.target.copy(sp); o.fov = 62; }],
      [J.impact, 0.12, (o) => {
        const k = easeOut((time - J.impact) / 0.8);
        o.pos.set(lerp(1.6, 0.9, k), lerp(0.7, 0.75, k), lerp(-12.2, -11.0, k));
        o.target.set(LAND.x, 0.9, LAND.z); o.fov = lerp(60, 52, k);
      }],
      [J.rise, 0.6, (o) => endOrbit(o, time, J.rise, J.stood, J.T, sp, 0.15, 4.4, 0.8, 54)],
    ];
    runShots(shots, time);
    shake(time - J.impact, 0.22);
  };
  const evalJump = (sp: THREE.Vector3) => {
    pose.yaw = singerJump(t, sp);
    camJump(t, sp);
    heliJ(t, heli.group.position);
    const away = Math.max(0, t - (J.jump + 0.8));
    heli.group.rotation.set(-Math.min(0.35, away * 0.12), -Math.min(0.9, away * 0.25), Math.sin(t * 0.8) * 0.03 - Math.min(0.2, away * 0.06));
    heli.aim(t < J.jump + 1.5 ? sp : null);
    heli.update(t);
    heli.group.visible = t < J.streak;
    if (t < J.impact) {
      const s = clamp01((t - J.streak) / (J.impact - J.streak));
      const u = jU(t);
      bez(Math.max(0, u - 0.03), dir).sub(sp).normalize();
      if (dir.lengthSq() < 0.5) dir.set(0, 1, 0);
      const head = tmp.copy(sp); head.y -= 0.6;
      hero.setComet(head, dir, t < J.streak ? 0 : 4 + 30 * s, t < J.streak - 0.6 ? 0 : 0.3 + smooth((t - J.streak + 0.6) / 0.6) * 0.9 + 0.2 * s, t);
    } else {
      const a = t - J.impact;
      dir.set(-0.1, 1, -0.6).normalize();
      hero.setComet(tmp.set(LAND.x, 0.6, LAND.z), dir, Math.max(0, 30 * (1 - a / 0.2)), Math.max(0, 1.1 * (1 - a / 0.35)), t);
    }
    hero.setImpact(t >= J.impact ? t - J.impact : -1);
    if (!landed && t >= J.impact) { landed = true; dispatch('land'); }
  };

  // ================================================================ LIFT
  const DEPTH = 3.4;
  const liftDeck = (time: number) => {
    const k = smooth((time - LF.rise0) / (LF.lock - LF.rise0));
    const e = k;
    const bump = time >= LF.lock ? -0.04 * Math.exp(-(time - LF.lock) * 9) * Math.sin((time - LF.lock) * 30) : 0;
    return -DEPTH * (1 - e) + bump;
  };
  const camLift = (time: number, sp: THREE.Vector3) => {
    const shots: ShotDef[] = [
      [0, 0, (o) => { // thấp trước sân khấu, nhìn nắp hầm
        const k = smooth(time / 3.0);
        o.pos.set(lerp(0.9, 0.6, k), lerp(0.55, 0.8, k), lerp(-12.6, -11.4, k));
        o.target.set(LAND.x, lerp(0.2, 1.4, smooth((time - 1.5) / 3)), LAND.z); o.fov = 50;
      }],
      [3.2, 1.6, (o) => { // cần cẩu nâng lên, lượn sang
        const k = smooth((time - 3.2) / (LF.lock - 3.2 + 0.6));
        orbit(o.pos, LAND, lerp(-0.35, -1.0, k), lerp(5.6, 4.6, k), lerp(1.2, 3.6, k));
        o.target.set(LAND.x, Math.max(0.9, sp.y - 0.3), LAND.z); o.fov = 54;
      }],
      [LF.lock + 0.2, 0.5, (o) => endOrbit(o, time, LF.lock + 0.2, LF.T - 0.4, LF.T, sp, -1.0, 4.6, 3.6, 54)],
    ];
    runShots(shots, time);
    shake(time - LF.lock, 0.05);
  };
  const evalLift = (sp: THREE.Vector3) => {
    const deck = liftDeck(t);
    sp.set(LAND.x, deck + EYE, LAND.z);
    pose.yaw = 0;
    camLift(t, sp);
    const open = smooth(t / LF.open);
    const light = smooth(t / 0.8) * (1 - 0.55 * smooth((t - LF.lock - 0.3) / 1.2));
    const smoke = smooth(t / 1.0) * (1 - smooth((t - LF.lock) / 1.5));
    lift.set(open, deck, light, smoke, t >= LF.lock ? t - LF.lock : -1, t);
    if (!landed && t >= LF.lock) { landed = true; dispatch('land'); }
  };

  // ================================================================ CABLE
  const HC = new THREE.Vector3(0, 30, -9.2);
  const TOP_Y = 26.0;
  const heliC = (time: number, out: THREE.Vector3) => {
    const away = Math.max(0, time - CB.climb);
    out.copy(HC).add(tmp.set(Math.sin(time * 0.7) * 0.25 + away * away * 1.6, Math.sin(time * 1.1) * 0.2 + away * away * 2.2, -away * away * 2.4));
    return out;
  };
  const hookC = (time: number, out: THREE.Vector3) => heliC(time, out).add(tmp2.set(0.2, -1.6, 0));
  const descK = (time: number) => smooth((time - CB.down0) / (CB.touch - CB.down0));
  const singerCable = (time: number, out: THREE.Vector3): number => {
    if (time >= CB.touch) {
      out.copy(LAND);
      const a = time - CB.touch;
      out.y = EYE - 0.18 * Math.sin(clamp01(a / 0.45) * Math.PI);
      return lerp(-0.25, 0, smooth(a / 0.8));
    }
    const k = descK(time);
    const sway = (1 - k) * 0.55 + 0.05;
    out.set(LAND.x + Math.sin(time * 1.7) * sway, lerp(TOP_Y, EYE, k), lerp(HC.z, LAND.z, smooth(k * 1.15)) + Math.sin(time * 1.3 + 1) * sway * 0.4);
    return lerp(Math.PI * 1.15, -0.25, k) + Math.sin(time * 1.1) * 0.1 * (1 - k);
  };
  const camCable = (time: number, sp: THREE.Vector3) => {
    const shots: ShotDef[] = [
      [0, 0, (o) => { o.pos.set(-6 + time, 6 + time * 0.5, -36); o.target.set(0, 24, -9); o.fov = 48; }],
      [1.6, 1.2, (o) => { // quanh ca sĩ, đám đông bên dưới
        const k = smooth((time - 1.6) / (CB.touch - 1.6));
        orbit(o.pos, sp, lerp(-0.25, 0.9, k), lerp(8, 6, k), sp.y + lerp(2.5, 1.0, k));
        o.target.copy(sp).y -= lerp(3.0, 0.6, k); o.fov = lerp(62, 56, k);
      }],
      [CB.touch - 0.6, 0.8, (o) => endOrbit(o, time, CB.touch - 0.6, CB.T - 0.6, CB.T, sp, 0.9, 6.0, 2.6, 56)],
    ];
    runShots(shots, time);
    shake(time - CB.touch, 0.06);
  };
  const hookPt = new THREE.Vector3(), harness = new THREE.Vector3();
  const evalCable = (sp: THREE.Vector3) => {
    pose.yaw = singerCable(t, sp);
    camCable(t, sp);
    heliC(t, heli.group.position);
    const away = Math.max(0, t - CB.climb);
    heli.group.rotation.set(-Math.min(0.3, away * 0.25), -Math.min(0.9, away * 0.45), Math.sin(t * 0.8) * 0.03 - Math.min(0.25, away * 0.2));
    heli.aim(t < CB.climb + 0.5 ? sp : null);
    heli.update(t);
    heli.group.visible = t < CB.T - 0.3;
    hookC(t, hookPt);
    harness.copy(sp).y += 0.45;
    if (t >= CB.detach) {
      // dây tời cuốn lên: đầu dưới kéo về móc
      const r = easeOut((t - CB.detach) / 1.1);
      harness.lerp(hookPt, r);
    }
    cable.group.visible = t < CB.detach + 1.1;
    cable.set(hookPt, harness);
    if (!landed && t >= CB.touch) { landed = true; dispatch('land'); }
  };

  const dispatch = (phase: 'start' | 'land' | 'end') =>
    window.dispatchEvent(new CustomEvent('cs-entrance', { detail: { kind, phase } }));

  const setVisible = (on: boolean) => {
    heli.group.visible = on && kind !== 'lift';
    cable.group.visible = on && kind === 'cable';
    hero.group.visible = on && kind === 'jump';
    lift.group.visible = on && kind === 'lift';
  };

  const finish = () => {
    if (!playing) return;
    if (!landed) { landed = true; dispatch('land'); }
    playing = false;
    setVisible(false);
    dispatch('end');
  };

  const evaluate = () => {
    const sp = pose.position;
    if (kind === 'jump') evalJump(sp);
    else if (kind === 'lift') evalLift(sp);
    else evalCable(sp);
    view.position.copy(sOut.pos);
    view.target.copy(sOut.target);
    view.fov = sOut.fov;
  };

  return {
    play(k) {
      kind = k;
      t = 0;
      landed = false;
      playing = true;
      setVisible(true);
      evaluate();
      dispatch('start');
    },
    update(f) {
      if (!playing) return;
      t += Math.max(0, Math.min(f.dt, 0.1));
      if (t >= ENTRANCE_SEC[kind]) { t = ENTRANCE_SEC[kind]; evaluate(); finish(); return; }
      evaluate();
    },
    isPlaying: () => playing,
    getView: () => (playing ? view : null),
    getSingerPose: () => (playing ? pose : null),
    getLandingSpot: () => ({ x: LAND.x, z: LAND.z, yaw: 0 }),
    skip() {
      if (!playing) return;
      t = ENTRANCE_SEC[kind];
      evaluate();
      finish();
    },
    dispose() {
      scene.remove(heli.group, cable.group, hero.group, lift.group);
      heli.dispose(); cable.dispose(); hero.dispose(); lift.dispose();
    },
  };
}
