import { describe, expect, it } from 'vitest';
import {
  createGovernor, guessStartTier, isQualityMode, pixelRatioFor, wantAntialias, type QualityGovernor, type QualityTier,
} from './quality';

/** Đưa `sec` giây frame time `ms` vào bộ điều tốc; trả về các lần đổi bậc. */
function run(g: QualityGovernor, ms: number, sec: number, active = true): QualityTier[] {
  const out: QualityTier[] = [];
  for (let t = 0; t < sec * 1000; t += ms) {
    const r = g.sample(ms, active);
    if (r) out.push(r);
  }
  return out;
}

describe('pixelRatioFor', () => {
  it('caps by tier and device', () => {
    expect(pixelRatioFor('ultra', 3)).toBe(2);
    expect(pixelRatioFor('high', 3)).toBe(1.5);
    expect(pixelRatioFor('high', 1)).toBe(1);
    expect(pixelRatioFor('medium', 2)).toBe(1);
    expect(pixelRatioFor('low', 2)).toBe(0.75);
    expect(pixelRatioFor('low', 1)).toBe(0.75);
    expect(pixelRatioFor('ultra', NaN)).toBe(1);
  });
  it('ignores the tier when the theme renders to a low-res target', () => {
    for (const t of ['low', 'medium', 'high', 'ultra'] as const) expect(pixelRatioFor(t, 2, true)).toBe(1.5);
  });
});

describe('wantAntialias', () => {
  it('off at pixel ratio ≥ 2 or low tier', () => {
    expect(wantAntialias('high', 1.5)).toBe(true);
    expect(wantAntialias('ultra', 2)).toBe(false);
    expect(wantAntialias('low', 0.75)).toBe(false);
  });
});

describe('guessStartTier', () => {
  it('software GL → low', () => {
    expect(guessStartTier({ gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', cores: 16, memoryGB: 8 })).toBe('low');
    expect(guessStartTier({ gpu: 'llvmpipe (LLVM 15.0.7, 256 bits)' })).toBe('low');
  });
  it('weak hardware never starts at ultra', () => {
    expect(guessStartTier({ cores: 2, memoryGB: 8 })).toBe('low');
    expect(guessStartTier({ cores: 4, memoryGB: 8, gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)' })).toBe('medium');
    expect(guessStartTier({ cores: 8, memoryGB: 8, gpu: 'Intel(R) HD Graphics 520' })).toBe('medium');
    expect(guessStartTier({ mobile: true, cores: 8, memoryGB: 4 })).toBe('low');
    expect(guessStartTier({ mobile: true, cores: 8, memoryGB: 8 })).toBe('medium');
  });
  it('integrated modern / unknown → high, discrete → ultra', () => {
    expect(guessStartTier({ cores: 8, memoryGB: 8, gpu: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)' })).toBe('high');
    expect(guessStartTier({ cores: 8, memoryGB: 8 })).toBe('high');
    expect(guessStartTier({ cores: 12, memoryGB: 8, gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)' })).toBe('ultra');
  });
});

describe('isQualityMode', () => {
  it('validates', () => {
    expect(isQualityMode('auto')).toBe(true);
    expect(isQualityMode('low')).toBe(true);
    expect(isQualityMode('max')).toBe(false);
    expect(isQualityMode(null)).toBe(false);
  });
});

describe('createGovernor', () => {
  it('does nothing during warm-up (shader compilation)', () => {
    const g = createGovernor('ultra');
    expect(run(g, 200, 2.9)).toEqual([]);
    expect(g.tier).toBe('ultra');
  });

  it('steps down one tier after ~2 s under target, settles, then continues', () => {
    const g = createGovernor('ultra');
    run(g, 16.7, 4); // warm-up at 60 fps
    const steps = run(g, 30, 2.6); // 33 fps < 51
    expect(steps).toEqual(['high']);
    expect(run(g, 30, 3.2)).toEqual(['medium']);
  });

  it('a very weak device (1–5 fps) reaches low within ~15 s', () => {
    const g = createGovernor('ultra');
    const steps = run(g, 400, 15);
    expect(steps).toEqual(['medium', 'low']); // dưới mức sàn 30 fps: hạ 2 bậc một lần
    expect(run(g, 400, 30)).toEqual([]); // không còn bậc nào thấp hơn
  });

  it('a single long hitch (1 s) does not trigger a downgrade', () => {
    const g = createGovernor('high');
    run(g, 16.7, 4);
    g.sample(1000, true);
    run(g, 16.7, 10);
    expect(g.tier).toBe('high');
  });

  it('short hitches do not trigger a downgrade', () => {
    const g = createGovernor('high');
    run(g, 16.7, 4);
    const changes: QualityTier[] = [];
    for (let i = 0; i < 10; i++) { changes.push(...run(g, 16.7, 5)); g.sample(250, true); } // khựng 250 ms mỗi 5 s
    expect(changes).not.toContain('medium');
  });

  it('vsync-jittered 45 fps (alternating 16.7 / 33.3 ms) counts as slow', () => {
    const g = createGovernor('high');
    run(g, 16.7, 4);
    let out: QualityTier | null = null;
    for (let i = 0; i < 400 && !out; i++) out = g.sample(i % 3 === 2 ? 33.3 : 16.7, true);
    expect(out).toBe('medium');
  });

  it('upgrades only after ~10 s of headroom', () => {
    const g = createGovernor('medium');
    run(g, 16.7, 3); // warm-up
    expect(run(g, 16.7, 9)).toEqual([]);
    expect(run(g, 16.7, 2)).toEqual(['high']);
  });

  it('never oscillates: a failed upgrade bans that tier', () => {
    const g = createGovernor('medium');
    // 'medium' giữ 60 fps, 'high' chỉ 40 fps.
    const ft = () => (g.tier === 'medium' ? 16.7 : 25);
    const changes: QualityTier[] = [];
    for (let t = 0; t < 300_000; t += ft()) {
      const r = g.sample(ft(), true);
      if (r) changes.push(r);
    }
    expect(changes).toEqual(['high', 'medium']);
    expect(g.ceiling).toBe('medium');
    expect(g.tier).toBe('medium');
  });

  it('ignores samples while inactive (paused / hidden tab) and re-settles after', () => {
    const g = createGovernor('high');
    run(g, 16.7, 4);
    expect(run(g, 100, 20, false)).toEqual([]);
    expect(g.fps).toBe(0);
    // Frame đầu sau khi quay lại thường rất dài: không được tính.
    expect(g.sample(2000, true)).toBeNull();
    expect(run(g, 16.7, 5)).toEqual([]);
    expect(g.tier).toBe('high');
  });

  it('hold() and reset()', () => {
    const g = createGovernor('high');
    run(g, 16.7, 4);
    g.hold(3);
    expect(run(g, 100, 2.9)).toEqual([]);
    g.reset('ultra');
    expect(g.tier).toBe('ultra');
    expect(g.ceiling).toBe('ultra');
    expect(run(g, 100, 2.9)).toEqual([]);
  });

  it('downgrades from a proven tier do not lower the ceiling', () => {
    const g = createGovernor('ultra');
    run(g, 16.7, 4);
    expect(run(g, 25, 3)).toEqual(['high']);
    expect(g.ceiling).toBe('ultra');
  });
});
