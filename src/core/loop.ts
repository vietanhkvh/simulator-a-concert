/** Vòng requestAnimationFrame. dt tính bằng giây, kẹp ≤ 0,1 để tab bị treo không gây nhảy. */
export interface GameLoop {
  start(): void;
  stop(): void;
}

export function createLoop(tick: (dt: number) => void): GameLoop {
  let raf = 0;
  let last = 0;
  const frame = (t: number) => {
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    tick(dt);
    raf = requestAnimationFrame(frame);
  };
  return {
    start() {
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    },
  };
}
