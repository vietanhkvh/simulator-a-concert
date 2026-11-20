# 02 — Đề xuất kỹ thuật game (Senior Game Dev)

Vòng thảo luận 1. Phạm vi: demo 1 lúc 16:00 ICT = prototype cốt lõi (1 bài CC, micro, chấm cao độ,
màn nhắc lời, 1 sân khấu, khán giả billboard lắc lightstick, thanh Hype).
Phần module/interface do Architect viết ở file riêng; file này chỉ nói kỹ thuật game.

## 1. Khán giả

**Nguyên tắc:** toàn bộ khán giả tĩnh trên CPU sau khi khởi tạo. Mọi chuyển động tính trong vertex
shader từ vài uniform chung. Không cập nhật buffer theo frame.

**Bố trí chỗ đứng**
- Khu đứng hình quạt trước sân khấu: góc mở ~120°, bán kính từ 6 m đến 45 m (mức 5.000 người).
- Sinh vị trí theo hàng vòng cung, cách nhau ~0,55 m, cộng jitter ngẫu nhiên ±0,15 m để không thẳng hàng.
- Sàn dốc nhẹ lên phía sau (y tăng ~0,04 m mỗi mét) để hàng sau không bị hàng trước che hết.
- Demo 1 dùng cố định 2.500 người; con số là một hằng số cấu hình để sau này đổi theo địa điểm.

**Hình học và draw call**
- Một `InstancedBufferGeometry`, mỗi instance gồm 2 quad: thân người (bóng đen) và lightstick.
  Cả hai nằm chung một geometry, phân biệt bằng attribute `aPart` (0 = thân, 1 = lightstick).
- Thân: quad 0,5 × 1,7 m, hình dạng vẽ bằng SDF trong fragment shader (đầu tròn + vai), không cần texture.
- Lightstick: quad nhỏ 0,12 × 0,35 m, màu phát sáng, blend additive.
- Vì thân cần blend thường và lightstick cần additive: 2 mesh dùng chung attribute buffer → **2 draw call**.
- Billboard chỉ xoay quanh trục Y về phía camera (camera gần như cố định nên tính một lần trong shader).

**Attribute mỗi instance (10 float)**
- `aPos` (vec3): vị trí chân.
- `aSeed` (vec4): pha ngẫu nhiên, hệ số chiều cao 0,9–1,1, tay cầm trái/phải, độ "nhiệt tình" 0,5–1.
- `aZone` (vec2): góc và khoảng cách chuẩn hóa tới sân khấu, dùng cho sóng màu và wave.
- `aTint` (float): độ xám của bóng (0,02–0,08) để tách lớp.

**Uniform điều khiển chung**
- `uBeat`: pha nhịp liên tục (số beat tính từ đầu bài, dạng float). Tính từ đồng hồ bài hát và BPM.
- `uHype` (0–1), `uTime`, `uColorA`, `uColorB`, `uWaveMode` (0 = đồng màu, 1 = sóng quét, 2 = nhấp nháy theo nhịp).

**Chuyển động (giả mã vertex shader)**
```glsl
float delay = aSeed.x * 0.08;                 // mỗi người lệch tới ~80 ms cho tự nhiên
float b = uBeat - delay;
float bounce = pow(abs(sin(b * PI)), 0.6);    // nhún mỗi beat
pos.y += bounce * 0.12 * uHype * aSeed.w;     // Hype thấp thì gần như đứng yên
if (aPart == 1.0) {                           // lightstick lắc quanh vai
  float swing = sin(b * PI) * mix(0.25, 0.9, uHype);
  pos.xy = rotate(pos.xy - shoulder, swing) + shoulder;
  pos.y += mix(-0.3, 0.25, uHype);            // Hype cao thì giơ cao hơn
}
```
**Màu lightstick:** `mix(uColorA, uColorB, wave)` với `wave` phụ thuộc `uWaveMode`;
chế độ sóng quét dùng `sin(aZone.x * 4.0 - uBeat * 0.5)`. Tỉ lệ người bật lightstick = `step(aSeed.z, 0.5 + uHype * 0.5)`.

**Ngân sách hiệu năng:** 60 fps trên laptop card tích hợp (Intel Iris/M1) ở 1080p với 5.000 người.
5.000 × 2 quad = 20.000 tam giác, không đáng kể; chi phí thật là overdraw của lớp additive, nên giữ
quad lightstick nhỏ và `depthWrite = false`. Giới hạn `devicePixelRatio` ở 1,5.

## 2. Sân khấu, camera, đèn

- **Camera:** góc nhìn ca sĩ, đặt ở (0, 1,65 m, 0) trên sân khấu cao 1,5 m, nhìn xuống khán giả, FOV 70°.
  Demo 1: camera lắc nhẹ theo chuột (±15°) để có cảm giác hiện diện, không di chuyển.
- **Sân khấu:** mép sàn sân khấu ở cạnh dưới khung hình, một màn hình nhắc lời đặt nghiêng trên sàn
  (plane có `CanvasTexture`), hai bên có khung truss dạng hộp đơn giản.
- **Đèn giả:** 6–8 chùm sáng là hình nón cụt/quad kéo dài, blend additive, alpha giảm dần theo chiều dài,
  quét qua lại theo `uBeat`. Không có `Light` thật, không đổ bóng. Material khán giả là unlit.
- **Sương mù:** `scene.fog` màu tím than để hàng xa chìm dần, che được đường biên khu khán giả.

| Demo 1 | Để sau |
|---|---|
| Camera ca sĩ, sàn sân khấu, màn nhắc lời | Bloom hậu kỳ, laser, khói động |
| 6–8 chùm sáng quét theo nhịp | Đèn flash điện thoại, pháo giấy |
| Fog, nền tối | 3 địa điểm, khán đài tầng trên |
| Lightstick đồng màu + sóng quét ở điệp khúc | Wave người, banner, fanchant |

## 3. Âm thanh

**Phát nhạc và đồng hồ bài hát**
- Giải mã file bằng `decodeAudioData`, phát bằng `AudioBufferSourceNode`.
- Đồng hồ duy nhất của game: `songTime = audioCtx.currentTime - startTime - outputLatency`.
  Mọi thứ (lời, nốt, beat, shader) đọc từ đây, không dùng `performance.now()` hay thời gian frame.
- `AudioContext` chỉ tạo sau thao tác bấm "Bắt đầu" của người chơi (chính sách autoplay).

**Micro**
- `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`.
  Cả ba đều tắt: chúng bóp méo cao độ, cắt nốt ngân dài và thêm độ trễ.
- Micro nối vào `AnalyserNode` (`fftSize` 2048), không nối ra loa để tránh hú.
- Cần HTTPS hoặc `localhost` thì trình duyệt mới cho xin quyền micro.

**Nhận diện cao độ**
- Dùng thư viện `pitchy` (thuật toán McLeod, ~3 KB, trả về tần số và độ rõ `clarity`).
- Chạy mỗi frame trên luồng chính, khoảng 60 lần/giây. Bỏ mẫu khi `clarity < 0,85` hoặc RMS dưới ngưỡng im lặng.
- Giới hạn dải 70–1.000 Hz. Làm mượt bằng trung vị 3 mẫu để khử nhảy quãng tám.
- Phương án dự phòng nếu `pitchy` có vấn đề khi build: tự viết autocorrelation ~40 dòng.

**Độ trễ micro (demo 1)**
- Không làm màn hiệu chỉnh. Dùng một hằng số bù `MIC_LATENCY_MS = 120` cộng cửa sổ chấm rộng
  (xem mục 4), và cho đổi qua tham số URL `?latency=`. Màn hiệu chỉnh để sau.

**Nhạc lọt vào micro khi dùng loa ngoài**
- Demo 1: hiện thông báo "Hãy đeo tai nghe" ở màn bắt đầu. Đây là cách duy nhất chắc chắn.
- Giảm nhẹ: ngưỡng RMS và `clarity` cao lọc được phần lớn nhạc nền đa âm (nhạc đệm cho clarity thấp).
- Không bật `echoCancellation` để chữa: nó làm hỏng cao độ giọng hát.

## 4. Chấm điểm và thanh Hype

**Chấm theo nốt**
- Đổi tần số sang số nốt MIDI dạng thực: `m = 69 + 12 * log2(f / 440)`.
- Sai lệch bỏ quãng tám: `d = ((m - target) mod 12 + 18) mod 12 - 6`, kết quả trong [-6, 6].
- Mỗi mẫu rơi vào thời gian của một nốt (sau khi bù trễ): đúng nếu `|d| ≤ 1,0` nửa cung (dễ tính cho demo).
- Điểm một nốt = số mẫu đúng / số mẫu kỳ vọng của nốt đó; nốt đạt khi tỉ lệ ≥ 0,5.
- Tổng điểm = Σ(tỉ lệ × độ dài nốt) / Σ(độ dài nốt) × 10.000. Nốt vàng (`*`) nhân đôi, nốt tự do (`F`) không chấm.

**Hype (0–1)**
- Bắt đầu 0,3. Mỗi frame trong lúc có nốt: đúng thì `+0,25 × dt`, sai hoặc im lặng thì `-0,15 × dt`.
- Trong đoạn nghỉ nhạc: trôi chậm về 0,3 (`±0,02 × dt`), để không bị phạt khi không có gì để hát.
- Giá trị đưa vào shader được làm mượt (lerp ~0,5 s) để khán giả không giật.

**Hype tác động**
- Biên độ nhún và lắc lightstick, độ cao giơ tay, tỉ lệ người bật lightstick (mục 1).
- Hype > 0,7 trong điệp khúc: chuyển `uWaveMode` sang sóng quét; chùm sáng quét nhanh và sáng hơn.
- Âm lượng tiếng reo hò = hàm của Hype (demo 1: tạo bằng noise lọc băng tần, không cần file).

## 5. Màn nhắc lời

- **Dữ liệu UltraStar:** mỗi dòng nốt `: start length pitch text` là một âm tiết; dòng `-` là ngắt câu.
  Thời gian: `t = GAP/1000 + beat × 60 / (BPM × 4)` (BPM trong file là 1/4 nhịp thật).
- **Bố cục HUD (HTML/CSS chồng lên canvas):**
  - Trên cùng: thanh Hype và điểm.
  - Giữa dưới: dải cao độ của câu hiện tại. Mỗi nốt là một thanh ngang (x = thời gian, y = cao độ
    co giãn theo min/max của câu), một chấm sáng là cao độ người chơi, thanh tô màu dần khi hát đúng.
  - Dưới cùng: câu đang hát (chữ lớn) và câu kế tiếp (nhỏ, mờ).
- **Highlight âm tiết:** mỗi âm tiết là một `<span>`; tô bằng `background-clip: text` với gradient có
  điểm dừng = tiến độ trong âm tiết, cập nhật mỗi frame. Âm tiết đã qua giữ màu đầy.
- **Báo trước:** nghỉ dài hơn 3 giây thì hiện thanh đếm ngược co dần tới lúc vào câu.
- Bản trên sàn sân khấu (3D) vẽ lại cùng nội dung lên `CanvasTexture`; demo 1 chỉ cần 2 dòng chữ, cập nhật khi đổi câu.

## 6. Tự kiểm thử không có micro thật

- **Chế độ `?fakeMic=1`:** thay nguồn micro bằng `OscillatorNode` phát đúng tần số nốt mục tiêu theo
  đồng hồ bài hát, nối vào cùng `AnalyserNode`. Đi qua toàn bộ đường nhận diện → chấm → Hype như thật.
  - `?fakeMic=perfect` kỳ vọng điểm > 90 %, Hype lên gần 1.
  - `?fakeMic=off` (lệch 3 nửa cung) kỳ vọng điểm < 20 %, Hype tụt.
  - `?fakeMic=octave` (lệch đúng 1 quãng tám) phải cho điểm như `perfect`.
- **Hook kiểm thử:** `window.__game = { songTime, score, hype, fps }` để Playwright đọc.
- **Playwright headless:** Chromium chạy với `--autoplay-policy=no-user-gesture-required` và
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`; chụp màn hình ở 5 s, 30 s và cuối bài,
  kiểm tra các giá trị trong `__game` và không có lỗi console.
- **Giới hạn:** headless dùng WebGL phần mềm nên số fps đo được không đại diện cho máy thật;
  hiệu năng 5.000 người phải được xác nhận trên máy người dùng.
- **Test đơn vị (Vitest):** parser UltraStar, hàm sai lệch bỏ quãng tám, công thức điểm.

## 7. Ước lượng và rủi ro

| Hạng mục demo 1 | Thời gian | Model |
|---|---|---|
| Khung Vite + TS + vòng lặp game + đồng hồ bài hát | 20 phút | Sonnet |
| Parser UltraStar + chọn 1 bài CC + test | 25 phút | Sonnet |
| Micro + nhận diện cao độ + `fakeMic` | 35 phút | Opus |
| Chấm điểm + Hype | 20 phút | Sonnet |
| Shader khán giả + lightstick | 45 phút | Opus |
| Sân khấu, chùm sáng, fog, camera | 30 phút | Sonnet |
| HUD nhắc lời + dải cao độ | 35 phút | Sonnet |
| Ghép nối, Playwright, sửa lỗi | 40 phút | Sonnet + review |

Tổng khoảng 4 giờ công; chạy 3 luồng song song (âm thanh / hình ảnh / HUD) thì cần khoảng 1,5–2 giờ thực,
vừa trước 16:00 nếu bắt đầu implement trước 12:30.

**Ba rủi ro lớn nhất**
1. **Bài CC không có nốt chuẩn hoặc lệch thời gian.** Phải nghe thử và kiểm tra `GAP` ngay đầu buổi.
   Cắt giảm: chọn bài khác trong kho `UltraStar-Deluxe/songs`; tệ nhất là tự soạn một giai điệu ngắn 30 giây
   bằng oscillator kèm file nốt tự viết.
2. **Độ trễ micro và nhạc lọt vào micro làm điểm sai trên máy thật.** Không kiểm chứng được trong headless.
   Cắt giảm: cửa sổ chấm rộng, tham số `?latency=`, yêu cầu tai nghe, ghi rõ là hạn chế đã biết của demo 1.
3. **Ghép nối ba luồng song song trễ giờ.** Cắt giảm: chốt interface đồng hồ bài hát và trạng thái game
   trước khi tách luồng; thứ tự bỏ bớt nếu thiếu giờ là màn nhắc lời 3D trên sàn → sóng màu lightstick →
   chùm sáng. Không bỏ: micro, chấm điểm, HUD lời, khán giả nhún theo Hype.
