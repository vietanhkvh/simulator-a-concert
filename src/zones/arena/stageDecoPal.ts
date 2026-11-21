// Bảng màu đèn dùng chung giữa lights.ts và các đồ trang trí sân khấu (stageDeco*.ts).
// Adapter mỏng trên 3 trạng thái Hype dùng chung (src/world/style: cool 0–40 %, warm 40–80 %, vivid 80–100 %),
// nên đèn, lightstick, khán đài và trời luôn cùng một bảng. Đa dạng = mỗi nhóm đèn lấy vai trò
// primary / secondary / accent khác nhau và vai trò chạy đuổi theo phách.
import * as THREE from 'three';
import { HYPE_STAGES, PAL, hypeColors, hypeMix, rgbToColor, themed, toColor } from '../../world/style';

/** Trạng thái hiện tại; lights.ts cập nhật mỗi frame (hype, beat). */
export const livePal = { hype: 0, beat: 0, chase: 0 };

// 3 màu Hype (THREE.Color tuyến tính, như mọi màu khác của three) — tính lại khi hype đổi.
const tri: THREE.Color[] = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
/** Màu thứ 4 chỉ xuất hiện khi rực rỡ: kem chớp (thay trắng tinh). */
const CREAM = new THREE.Color();
const SODA = new THREE.Color();
let triHype = -1;
themed(() => { toColor(PAL.cream[300], CREAM); toColor(PAL.soda[500], SODA); triHype = -1; });

function refresh(h: number) {
  if (Math.abs(h - triHype) < 0.002) return;
  triHype = h;
  const c = hypeColors(h);
  rgbToColor(c.primary, tri[0]);
  rgbToColor(c.secondary, tri[1]);
  rgbToColor(c.accent, tri[2]);
  // ở mức rực rỡ vẫn giữ một chút soda trong vai accent để bảng không ngả hết về nóng
  const w = hypeMix(h);
  tri[2]!.lerp(SODA, 0.35 * w[2]);
}

/** Bộ 3 màu Hype hiện tại [primary, secondary, accent] (đừng sửa). */
export function hypeTriad(h = livePal.hype): readonly THREE.Color[] {
  refresh(Math.min(1, Math.max(0, h)));
  return tri;
}

/** Tỉ lệ đèn bật theo guide 2.3 (25 % / 60 % / 100 %), trộn mượt. */
export function lightFraction(h: number): number {
  const w = hypeMix(h);
  return w[0] * HYPE_STAGES[0].lightFraction + w[1] * HYPE_STAGES[1].lightFraction + w[2] * HYPE_STAGES[2].lightFraction;
}

// vai trò cho chỉ số k: primary nhiều nhất (≈ 60/30/10 theo guide), accent ít
const ROLE = [0, 1, 0, 2, 1, 0, 1, 0] as const;
const A = new THREE.Color();
let mixHype = NaN;
let mixW = hypeMix(0);

/**
 * Màu cho đèn thứ k: vai trò chạy đuổi theo phách (mỗi 4 phách dịch 1 bước, chỉ khi hype ≥ 40 %),
 * trộn mượt giữa hai bước. Ở mức rực rỡ, nhịp mạnh thỉnh thoảng chớp kem.
 */
export function palColor(k: number, out: THREE.Color, beat = livePal.beat, hype = livePal.hype): THREE.Color {
  const t = hypeTriad(hype);
  // Gọi hàng trăm lần mỗi frame với cùng hype: nhớ trọng số thay vì cấp mảng mới mỗi lần (giảm rác cho GC).
  if (hype !== mixHype) { mixHype = hype; mixW = hypeMix(hype); }
  const w = mixW;
  const moving = 1 - w[0];
  const ph = (beat / 4) * moving + livePal.chase;
  const step = Math.floor(ph);
  const f = ph - step;
  const kk = ((k % 8) + 8) % 8;
  const r0 = ROLE[(kk + step) % 8]!, r1 = ROLE[(kk + step + 1) % 8]!;
  const s = f * f * (3 - 2 * f);
  out.copy(t[r0]!).lerp(t[r1]!, s * s);
  // kem chớp nhẹ ở accent khi rực rỡ (không trắng tinh)
  if (w[2] > 0 && r0 === 2) out.lerp(A.copy(CREAM), 0.25 * w[2]);
  return out;
}

/** Giữ chữ ký cũ: màu trực tiếp của đèn k. minVivid giữ lại cho tương thích (bảng mới luôn đủ màu). */
export function liveColor(k: number, out: THREE.Color, minVivid = 0.3) {
  void minVivid;
  return palColor(k, out);
}
