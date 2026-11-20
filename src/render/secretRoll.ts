// Logic thuần (không three.js) cho sự kiện bí mật: tung xúc xắc theo xác suất + bật lại (re-arm) + hồi chiêu.
export type SecretKind = 'ufo' | 'rocket' | 'dragon';
export const SECRET_KINDS: readonly SecretKind[] = ['ufo', 'rocket', 'dragon'];

export const HYPE_FIRE = 0.95;
export const HYPE_REARM = 0.8;
export const COOLDOWN_SEC = 30;

/**
 * Chọn 1 sự kiện theo xác suất. Nếu tổng > 1 thì chuẩn hoá về 1; phần còn lại (1 - tổng) = không có gì.
 * `rnd` trả về [0,1).
 */
export function rollSecret(chances: Record<SecretKind, number>, rnd: () => number): SecretKind | null {
  const p = SECRET_KINDS.map((k) => Math.max(0, Number.isFinite(chances[k]) ? chances[k] : 0));
  const sum = p.reduce((a, b) => a + b, 0);
  const scale = sum > 1 ? 1 / sum : 1;
  let r = rnd();
  for (let i = 0; i < SECRET_KINDS.length; i++) {
    const pi = p[i]! * scale;
    if (r < pi) return SECRET_KINDS[i]!;
    r -= pi;
  }
  return null;
}

/** Chọn chắc chắn 1 loại (cho nút thử khi không chỉ định kind): theo tỉ lệ chances, đều nhau nếu tất cả = 0. */
export function pickAnySecret(chances: Record<SecretKind, number>, rnd: () => number): SecretKind {
  const p = SECRET_KINDS.map((k) => Math.max(0, chances[k] || 0));
  const sum = p.reduce((a, b) => a + b, 0);
  if (sum <= 0) return SECRET_KINDS[Math.min(2, Math.floor(rnd() * 3))]!;
  let r = rnd() * sum;
  for (let i = 0; i < 3; i++) {
    if (r < p[i]!) return SECRET_KINDS[i]!;
    r -= p[i]!;
  }
  return SECRET_KINDS[2]!;
}

/**
 * Máy trạng thái kích hoạt: khi hype vượt lên ≥ 0.95 (đã bật lại vì từng xuống < 0.8) và đã qua hồi chiêu
 * 30 s kể từ khi sự kiện trước kết thúc → tung 1 lần.
 */
export class SecretTrigger {
  time = 0;
  armed = true;
  cooldownUntil = -Infinity;
  constructor(private chances: Record<SecretKind, number>, private rnd: () => number = Math.random) {}

  /** Gọi mỗi khung. Trả về loại sự kiện cần bắt đầu (hoặc null). `running` = đang có sự kiện. */
  step(hype: number, dt: number, running: boolean): SecretKind | null {
    this.time += Math.max(0, dt);
    if (hype < HYPE_REARM) {
      this.armed = true;
      return null;
    }
    if (hype >= HYPE_FIRE && this.armed) {
      this.armed = false;
      if (running || this.time < this.cooldownUntil) return null;
      return rollSecret(this.chances, this.rnd);
    }
    return null;
  }

  /** Báo một sự kiện vừa kết thúc → bắt đầu hồi chiêu. */
  ended(): void {
    this.cooldownUntil = this.time + COOLDOWN_SEC;
  }
}
