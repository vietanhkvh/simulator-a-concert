/**
 * Điểm vào của trang: cài hộp lỗi toàn cục, kiểm tra WebGL2, rồi mới nạp game (src/main.ts) bằng import động
 * để thiếu WebGL / lỗi dựng cảnh hiện thông báo thân thiện thay vì trang đen.
 */
import {
  checkWebGL, hideBootLoader, installErrorBoundary, showDeviceNoticeIfNeeded, showFatal, showNoWebGL, watchContextLoss,
} from './core/webSupport';

installErrorBoundary();
const gl = checkWebGL();
if (!gl.ok) {
  showNoWebGL(gl.reason);
} else {
  showDeviceNoticeIfNeeded();
  const canvas = document.getElementById('stage');
  if (canvas instanceof HTMLCanvasElement) watchContextLoss(canvas);
  import('./main').catch((err: unknown) => {
    console.error('[boot] không khởi động được game', err);
    hideBootLoader();
    showFatal('Không khởi động được trò chơi', [
      'Có thể kết nối mạng bị gián đoạn khi tải trò chơi, hoặc card đồ họa không dựng được cảnh 3D.',
      'Hãy tải lại trang. Nếu vẫn lỗi, thử trình duyệt khác hoặc bật tăng tốc phần cứng.',
    ]);
  });
}
