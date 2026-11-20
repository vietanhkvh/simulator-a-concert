// Kích thước ĐÍCH VẼ cảnh 3D. Bình thường = cửa sổ; khi hậu kỳ 'pixelate' bật (world.ts) = đích độ phân giải thấp.
// Module nào tính cỡ điểm (gl_PointSize) hay bề dày viền theo pixel phải đọc ở đây thay cho window.innerHeight /
// renderer.getDrawingBufferSize(), nếu không hạt và viền sẽ to gấp nhiều lần trong ảnh pixel.
import type * as THREE from 'three';

const lowRes = { on: false, width: 0, height: 0 };

/** (world.ts) Bật/tắt đích thấp. */
export function setLowResTarget(size: { width: number; height: number } | null): void {
  lowRes.on = !!size;
  if (size) { lowRes.width = size.width; lowRes.height = size.height; }
}
/** Chiều cao khung vẽ theo "px CSS" (thay cho window.innerHeight). */
export function viewHeightPx(): number {
  if (lowRes.on) return lowRes.height;
  return typeof window !== 'undefined' ? window.innerHeight : 720;
}
/** Kích thước bộ đệm đang vẽ vào (thay cho renderer.getDrawingBufferSize). */
export function drawSize(renderer: THREE.WebGLRenderer, out: THREE.Vector2): THREE.Vector2 {
  if (lowRes.on) return out.set(lowRes.width, lowRes.height);
  return renderer.getDrawingBufferSize(out);
}
