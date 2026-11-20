import { describe, expect, it } from 'vitest';
import { COOLDOWN_SEC, SecretTrigger, pickAnySecret, rollSecret, type SecretKind } from './secretRoll';

function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function tally(ch: Record<SecretKind, number>, n = 10000, seed = 42) {
  const rnd = seeded(seed);
  const c = { ufo: 0, rocket: 0, dragon: 0, none: 0 };
  for (let i = 0; i < n; i++) c[rollSecret(ch, rnd) ?? 'none']++;
  return c;
}

describe('rollSecret', () => {
  it('respects default chances over 10,000 rolls', () => {
    const c = tally({ ufo: 0.25, rocket: 0.2, dragon: 0.1 });
    expect(c.ufo / 1e4).toBeCloseTo(0.25, 1);
    expect(Math.abs(c.ufo / 1e4 - 0.25)).toBeLessThan(0.02);
    expect(Math.abs(c.rocket / 1e4 - 0.2)).toBeLessThan(0.02);
    expect(Math.abs(c.dragon / 1e4 - 0.1)).toBeLessThan(0.015);
    expect(Math.abs(c.none / 1e4 - 0.45)).toBeLessThan(0.02);
  });
  it('normalises when chances sum > 1', () => {
    const c = tally({ ufo: 1, rocket: 1, dragon: 2 });
    expect(c.none).toBe(0);
    expect(Math.abs(c.ufo / 1e4 - 0.25)).toBeLessThan(0.02);
    expect(Math.abs(c.dragon / 1e4 - 0.5)).toBeLessThan(0.02);
  });
  it('zero chances never fire; negatives ignored', () => {
    expect(tally({ ufo: 0, rocket: -1, dragon: 0 }).none).toBe(10000);
  });
  it('pickAnySecret always returns a kind', () => {
    const rnd = seeded(3);
    for (let i = 0; i < 100; i++) expect(['ufo', 'rocket', 'dragon']).toContain(pickAnySecret({ ufo: 0, rocket: 0, dragon: 0 }, rnd));
    expect(pickAnySecret({ ufo: 0, rocket: 0, dragon: 0.1 }, rnd)).toBe('dragon');
  });
});

describe('SecretTrigger', () => {
  const always = { ufo: 1, rocket: 0, dragon: 0 };
  it('fires once on rising edge and re-arms only below 0.8', () => {
    const t = new SecretTrigger(always, seeded());
    expect(t.step(0.5, 0.1, false)).toBeNull();
    expect(t.step(0.96, 0.1, false)).toBe('ufo');
    expect(t.step(0.99, 0.1, false)).toBeNull(); // vẫn cao → không tung lại
    expect(t.step(0.85, 0.1, false)).toBeNull(); // chưa xuống < 0.8
    expect(t.step(0.97, 0.1, false)).toBeNull();
    expect(t.step(0.7, 0.1, false)).toBeNull(); // re-arm
    expect(t.step(0.97, 0.1, false)).toBe('ufo');
  });
  it('honours the 30 s cooldown after an event ends and skips while running', () => {
    const t = new SecretTrigger(always, seeded());
    expect(t.step(0.96, 0.1, false)).toBe('ufo');
    t.step(0.5, 0.1, true);
    expect(t.step(0.96, 0.1, true)).toBeNull(); // đang chạy
    t.ended();
    t.step(0.5, 1, false);
    expect(t.step(0.96, 1, false)).toBeNull(); // trong hồi chiêu
    t.step(0.5, COOLDOWN_SEC, false);
    expect(t.step(0.96, 0.1, false)).toBe('ufo');
  });
  it('a miss still consumes the arm', () => {
    const t = new SecretTrigger({ ufo: 0, rocket: 0, dragon: 0 }, seeded());
    expect(t.step(0.96, 0.1, false)).toBeNull();
    expect(t.armed).toBe(false);
  });
});
