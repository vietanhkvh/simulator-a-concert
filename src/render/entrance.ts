// Cảnh mở màn: ca sĩ nhảy dù từ trực thăng ('parachute') hoặc đáp đất kiểu siêu anh hùng ('hero').
// Chạy trên đồng hồ riêng (update(f) cộng f.dt). Cung cấp pose camera + pose ca sĩ (quy ước mắt của singer.ts).
// Phát window CustomEvent 'cs-entrance' { kind, phase: 'start' | 'land' | 'end' }.
import * as THREE from 'three';
import type { FrameState } from '../core/types';
import { createCanopy, createHeli, createHeroFx } from './entranceProps';

export type EntranceKind = 'parachute' | 'hero';
export const ENTRANCE_SEC: Record<EntranceKind, number> = { parachute: 10.4, hero: 8.2 };

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

const EYE = 1.65;
const LAND = new THREE.Vector3(0, EYE, -6.6); // đầu runway giữa, trước mép sân khấu, trước cổng z=-9
const FAR_TARGET = new THREE.Vector3(0, 1.4, -24); // nhìn ra khán giả từ sau lưng ca sĩ

// Mốc thời gian
const P = { T: ENTRANCE_SEC.parachute, step: 1.6, jump: 1.9, open: 4.1, touch: 9.2 };
const H = { T: ENTRANCE_SEC.hero, fall: 1.0, impact: 3.0, rise: 4.2, stood: 6.6 };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const lerp = THREE.MathUtils.lerp;

interface Shot { pos: THREE.Vector3; target: THREE.Vector3; fov: number }
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
  const canopy = createCanopy();
  const hero = createHeroFx(new THREE.Vector3(LAND.x, 0, LAND.z));
  scene.add(heli.group, canopy.group, hero.group);

  let kind: EntranceKind = 'parachute';
  let playing = false;
  let t = 0;
  let landed = false;

  const view = { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 60 };
  const pose = { position: new THREE.Vector3(), yaw: 0 };
  const sA = mkShot(), sB = mkShot(), sOut = mkShot();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), cometDir = new THREE.Vector3();

  // --- Dù: đường bay chữ S trên khán giả, tiếp đất từ phía +x dọc z ≈ -6,6
  const HELI0 = new THREE.Vector3(6, 45, -24);
  const heliPos = new THREE.Vector3();
  const doorW = new THREE.Vector3();
  const fallStart = new THREE.Vector3();
  const G = 9.8, FALL_V = new THREE.Vector3(0.6, 0, -2.4);
  const fallEnd = new THREE.Vector3();
  let glide: THREE.CatmullRomCurve3 | null = null;
  const touchPt = LAND.clone().add(new THREE.Vector3(1.4, 0, 0));
  let yawS = 0, rollS = 0;

  const heliAt = (time: number, out: THREE.Vector3) => {
    const away = Math.max(0, time - 2.6);
    out.copy(HELI0).add(tmp.set(Math.sin(time * 0.9) * 0.3 + away * away * 2.2, Math.sin(time * 1.3) * 0.25 + away * 1.5, -away * away * 1.6));
    return out;
  };
  const doorAt = (time: number, out: THREE.Vector3) => {
    heliAt(time, out);
    return out.add(heli.door).add(tmp2.set(0, EYE, 0));
  };
  // Tính trước điểm rơi + đường lượn
  doorAt(P.jump, fallStart);
  {
    const tau = P.open - P.jump;
    fallEnd.copy(fallStart).addScaledVector(FALL_V, tau);
    fallEnd.y -= 0.5 * G * tau * tau;
    glide = new THREE.CatmullRomCurve3([
      fallEnd.clone(),
      new THREE.Vector3(13, 15.5, -28),
      new THREE.Vector3(21, 10, -17),
      new THREE.Vector3(14, 4.5, -8.2),
      new THREE.Vector3(6, EYE + 0.9, -6.9),
      touchPt.clone(),
    ], false, 'centripetal');
  }

  const singerPara = (time: number, out: THREE.Vector3): number => {
    // trả về yaw
    if (time < P.step) { doorAt(time, out); return 0; }
    if (time < P.jump) {
      const k = smooth((time - P.step) / (P.jump - P.step));
      doorAt(time, out);
      out.z -= 0.5 * k; out.y += Math.sin(k * Math.PI) * 0.25;
      return 0;
    }
    if (time < P.open) {
      const tau = time - P.jump;
      out.copy(fallStart).addScaledVector(FALL_V, tau);
      out.y -= 0.5 * G * tau * tau;
      return tau * 2.2 + Math.sin(tau * 5) * 0.3; // xoay nhẹ khi rơi tự do
    }
    if (time < P.touch) {
      const s = (time - P.open) / (P.touch - P.open);
      const u = clamp01(s * (1.2 - 0.2 * s));
      glide!.getPointAt(u, out);
      glide!.getTangentAt(Math.min(u, 0.999), tmp2);
      return Math.atan2(-tmp2.x, -tmp2.z);
    }
    // chạy đà ngắn rồi quay ra khán giả
    const k = easeOut((time - P.touch) / 0.55);
    out.copy(touchPt).lerp(LAND, k);
    out.y = EYE - Math.sin(clamp01((time - P.touch) / 0.25) * Math.PI) * 0.12;
    const turn = smooth((time - P.touch - 0.25) / 0.6);
    return lerp(Math.PI / 2, 0, turn);
  };

  const camPara = (time: number, sp: THREE.Vector3) => {
    const shots: [number, number, (o: Shot) => void][] = [
      [0, 0, (o) => { // góc rộng từ dưới: trực thăng trên nền cực quang
        o.pos.set(-10 + time * 1.2, 7 + time * 0.8, -48);
        heliAt(time, o.target).y -= 3; o.fov = 46;
      }],
      [1.3, 0.8, (o) => { // cận cửa trực thăng
        heliAt(time, o.pos).add(tmp2.set(-6, -3.5, -10)); o.target.copy(sp).y -= 0.4; o.fov = 50;
      }],
      [2.15, 0.5, (o) => { // lao xuống cùng ca sĩ
        o.pos.copy(sp).add(tmp.set(3.0, 1.4, -3.6));
        o.target.copy(sp).y -= 2.2; o.fov = 64;
      }],
      [3.85, 0.9, (o) => { // quay quanh khi lượn trên khán giả
        const k = smooth((time - 3.85) / (P.touch - 3.85));
        orbit(o.pos, sp, lerp(0.35, 1.2, k), lerp(8, 10, k), sp.y + lerp(-1.5, 3.2, k));
        o.target.copy(sp).y += lerp(2.2, 0.3, k); o.fov = lerp(62, 56, k);
      }],
      [P.touch - 0.4, 0.7, (o) => { // chạm đất → đẩy vào → vòng ra sau lưng
        const k1 = smooth((time - (P.touch - 0.4)) / 1.0);
        const k2 = smooth((time - (P.touch + 0.35)) / (P.T - P.touch - 0.35));
        orbit(o.pos, LAND, lerp(1.0, Math.PI, k2), lerp(lerp(6.5, 4.2, k1), 3.4, k2), lerp(lerp(3.6, 2.0, k1), 2.35, k2));
        o.target.copy(sp).y -= 0.15;
        o.target.lerp(FAR_TARGET, k2);
        o.fov = lerp(52, 62, k2);
      }],
    ];
    runShots(shots, time);
  };

  const camHero = (time: number, sp: THREE.Vector3) => {
    const shots: [number, number, (o: Shot) => void][] = [
      [0, 0, (o) => { // thấp trên runway, nhìn lên qua cổng sáng
        o.pos.set(0.8, 0.5, -12.4);
        o.target.copy(sp); o.fov = 60;
      }],
      [H.impact, 0.15, (o) => {
        const k = easeOut((time - H.impact) / 1.2);
        o.pos.set(lerp(0.8, 0.6, k), lerp(0.5, 0.65, k), lerp(-12.4, -11.2, k));
        o.target.set(LAND.x, 0.9, LAND.z); o.fov = lerp(60, 52, k);
      }],
      [H.rise, 0.7, (o) => { // vòng từ trước-thấp ra sau lưng
        const k = smooth((time - H.rise) / (H.stood - H.rise));
        const k2 = smooth((time - (H.stood - 0.6)) / (H.T - H.stood + 0.6));
        orbit(o.pos, LAND, lerp(0.15, Math.PI, k), lerp(4.6, 3.4, k), lerp(0.75, 2.35, smooth(k * 1.6)) + Math.sin(k * Math.PI) * 0.6);
        o.target.copy(sp).y -= 0.2;
        o.target.lerp(FAR_TARGET, k2);
        o.fov = lerp(54, 62, k);
      }],
    ];
    runShots(shots, time);
    // rung camera khi va chạm
    const age = time - H.impact;
    if (age > 0) {
      const a = 0.22 * Math.exp(-age * 5);
      sOut.pos.x += Math.sin(age * 71) * a; sOut.pos.y += Math.sin(age * 53 + 1) * a;
      sOut.target.x += Math.sin(age * 61 + 2) * a * 0.6; sOut.target.y += Math.sin(age * 67) * a * 0.6;
    }
  };

  /** Mỗi shot: [bắt đầu, thời gian hoà từ shot trước, hàm]. */
  function runShots(shots: [number, number, (o: Shot) => void][], time: number) {
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

  const singerHero = (time: number, out: THREE.Vector3) => {
    const S = tmp2.set(16, 75, -24);
    if (time < H.fall) { out.copy(S); return; }
    if (time < H.impact) {
      const s = (time - H.fall) / (H.impact - H.fall);
      const e = s * s * (0.35 + 0.65 * s);
      out.copy(S).lerp(LAND, e);
      out.y = lerp(S.y, LAND.y - 0.65, e);
      return;
    }
    out.copy(LAND);
    const age = time - H.impact;
    // ngồi thụp (giả tư thế 3 điểm), nảy nhẹ, rồi đứng dậy chậm
    const crouch = 0.65 + 0.18 * Math.exp(-age * 7) * Math.cos(age * 14) - 0.65 * smooth((time - H.rise) / (H.stood - 0.4 - H.rise));
    out.y = EYE - Math.max(0, crouch);
  };

  const dispatch = (phase: 'start' | 'land' | 'end') =>
    window.dispatchEvent(new CustomEvent('cs-entrance', { detail: { kind, phase } }));

  const setVisible = (on: boolean) => {
    heli.group.visible = on && kind === 'parachute';
    canopy.group.visible = on && kind === 'parachute';
    hero.group.visible = on && kind === 'hero';
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
    if (kind === 'parachute') {
      const yaw = singerPara(t, sp);
      // làm mượt yaw/roll (nghiêng dù theo khúc cua)
      const dYaw = Math.atan2(Math.sin(yaw - yawS), Math.cos(yaw - yawS));
      const glideOn = t >= P.open && t < P.touch;
      yawS += dYaw * (t < P.open ? 1 : 0.15);
      rollS += ((glideOn ? THREE.MathUtils.clamp(-dYaw * 9, -0.45, 0.45) : 0) - rollS) * 0.08;
      pose.yaw = t < P.open || t >= P.touch ? yaw : yawS;
      if (t >= P.touch) yawS = yaw;
      camPara(t, sp);

      // trực thăng
      heliAt(t, heli.group.position);
      const away = Math.max(0, t - 2.6);
      heli.group.rotation.set(-Math.min(0.35, away * 0.12), -Math.min(0.9, away * 0.25), Math.sin(t * 0.8) * 0.03 - Math.min(0.2, away * 0.06));
      heli.update(t);
      heli.group.visible = t < 8.5;

      // dù
      if (t >= P.open) {
        const k = (t - P.open) / 0.45;
        const pop = k < 1 ? easeOut(k) * (1 + 0.15 * Math.sin(k * Math.PI)) : 1;
        canopy.group.visible = true;
        if (t < P.touch) {
          canopy.group.position.copy(sp).y -= 0.25;
          canopy.group.rotation.set(0.18, pose.yaw, rollS);
          canopy.inflate.scale.set(lerp(0.08, 1, pop), lerp(0.5, 1, pop), lerp(0.08, 1, pop));
          canopy.setOpacity(1);
        } else {
          const a = t - P.touch;
          const drift = Math.max(0, a - 0.35);
          canopy.group.position.copy(touchPt).add(tmp.set(drift * 3.2, -0.25 + drift * drift * 1.4, -drift * 1.2));
          canopy.group.rotation.set(Math.min(1.25, 0.18 + a * 2.2), Math.PI / 2, 0);
          const c = smooth(a / 0.5);
          canopy.inflate.scale.set(lerp(1, 0.75, c), lerp(1, 0.45, c), lerp(1, 0.85, c));
          canopy.setOpacity(1 - smooth((a - 0.5) / 0.7));
        }
      } else canopy.group.visible = false;

      if (!landed && t >= P.touch) { landed = true; dispatch('land'); }
    } else {
      singerHero(t, sp);
      pose.yaw = 0;
      camHero(t, sp);
      // sao chổi
      const head = tmp.copy(sp);
      head.y -= 0.6;
      const dir = cometDir.set(16, 75 - EYE, -24 - LAND.z).normalize();
      const pre = clamp01(t / H.fall);
      if (t < H.impact) {
        const s = clamp01((t - H.fall) / (H.impact - H.fall));
        hero.setComet(head, dir, t < H.fall ? 0 : 6 + 34 * s, t < H.fall ? 0.4 + 0.8 * pre : 1.3, t);
      } else {
        const a = t - H.impact;
        hero.setComet(tmp.set(LAND.x, 0.6, LAND.z), dir, Math.max(0, 40 * (1 - a / 0.25)), Math.max(0, 1.6 * (1 - a / 0.6)), t);
      }
      hero.setImpact(t >= H.impact ? t - H.impact : -1);
      if (!landed && t >= H.impact) { landed = true; dispatch('land'); }
    }
    view.position.copy(sOut.pos);
    view.target.copy(sOut.target);
    view.fov = sOut.fov;
  };

  return {
    play(k) {
      kind = k;
      t = 0;
      landed = false;
      yawS = 0; rollS = 0;
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
      scene.remove(heli.group, canopy.group, hero.group);
      heli.dispose(); canopy.dispose(); hero.dispose();
    },
  };
}
