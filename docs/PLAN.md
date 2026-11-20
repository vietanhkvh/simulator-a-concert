# PLAN — Demo 1 game giả lập concert

Bản thống nhất sau vòng thảo luận 2 (PM tổng hợp). Chi tiết kỹ thuật đọc kèm
`docs/discussion/01-architect.md` (module, interface) và `docs/discussion/02-gamedev.md` (shader, âm thanh, chấm điểm).
Khi hai file đó khác bản này thì **bản này thắng**.

## 1. Mục tiêu và phạm vi

**Mục tiêu:** 16:00 giờ Việt Nam hôm nay (20/11) có một trang web tĩnh chơi được: người chơi hát một bài qua micro,
thấy lời chạy, được chấm cao độ, và khán giả phản ứng theo thanh Hype.

| Trong phạm vi demo 1 | Ngoài phạm vi (để sau) |
|---|---|
| 1 bài Creative Commons kèm sẵn | Nhập file từ máy người chơi (`.lrc`, UltraStar, video) |
| Micro + nhận diện cao độ + chấm điểm | Màn hiệu chỉnh độ trễ micro |
| Màn nhắc lời HUD: câu hiện tại tô theo âm tiết, câu kế tiếp, dải cao độ | Màn nhắc lời 3D trên sàn sân khấu |
| 1 sân khấu, camera góc nhìn ca sĩ, 2.500 khán giả billboard | 3 địa điểm 1.000 / 2.500 / 5.000 |
| Lightstick lắc theo nhịp, biên độ và màu theo Hype | Đèn flash, wave người, fanchant, encore, banner |
| Chùm sáng sân khấu giả, fog | Bloom, laser, khói |
| Màn bắt đầu, màn kết quả, dòng ghi công bài hát | Lưu điểm, tiến trình, điện thoại |

**Tiêu chí nghiệm thu (kiểm chứng được)**
1. `npm run build` và `npx tsc --noEmit` không lỗi; `npm test` (parser, chấm điểm) xanh.
2. Mở trang, bấm "Bắt đầu": nhạc phát, lời tô màu khớp nhạc (lệch không quá ~100 ms khi nghe thử).
3. `?fakeMic=perfect`: điểm cuối bài > 90 %, Hype lên trên 0,8. `?fakeMic=off`: điểm < 20 %, Hype dưới 0,2.
   `?fakeMic=octave`: điểm tương đương `perfect`.
4. Khán giả 2.500 người vẽ bằng tối đa 2 draw call; ảnh chụp ở Hype thấp và Hype cao khác nhau rõ (biên độ, số lightstick bật).
5. Không có lỗi trong console suốt một lượt chơi trọn bài bằng Playwright headless.
6. Từ chối quyền micro không làm treo game: tự chuyển sang chế độ xem (không chấm điểm thật) kèm thông báo.
7. Màn bắt đầu và màn kết quả hiện "Chasing Marks — Silver Note, CC BY 4.0".

Chưa kiểm chứng được trong container: fps trên máy thật và độ chính xác điểm với giọng hát thật. Hai mục này người dùng xác nhận trên máy.

## 2. Quyết định đã chốt

| Quyết định | Lý do |
|---|---|
| Three.js 0.187 + TypeScript + Vite 8, `pitchy` 4.1, test bằng Vitest | Đã kiểm tra tải được từ npm; nhẹ, không framework UI |
| Bài demo: Silver Note — *Chasing Marks*, bản `instrumental.mp3` + file nốt | CC BY 4.0, dùng thương mại về sau được; có sẵn bản không lời và 252 nốt |
| Chỉ lấy file nốt, mp3, license của bài; không lấy ảnh bìa/nền | Ảnh theo chủ đề của bên thứ ba và có license riêng |
| `manifest.json` tự khai đường dẫn audio, không tin header `#MP3` | Header trong file gốc trỏ sai tên |
| Bài dự phòng: Shearer — *Stay with me* (CC BY-NC-SA) | Chỉ dùng nếu bài chính lệch nốt; phải bỏ khi thu tiền |
| Module chỉ import từ `core/`, nối dây tại `main.ts`, `FrameState` là điểm ghép duy nhất | Theo Architect; cho phép 6 gói làm song song |
| Đồng hồ bài hát = `ctx.currentTime - startAt - outputLatency`, tính bên trong `AudioEngine.now()` | Lấy phần bù `outputLatency` của Game dev, giữ đóng gói của Architect |
| Uniform shader khán giả: `uTime, uBeat, uBeatPulse, uHype, uColorA, uColorB, uWaveMode`; attribute `aPos, aSeed, aZone, aTint` | Chọn Game dev. Trả lời câu hỏi 2 của Architect: không cần `uWavePhase`, sóng suy ra từ `uBeat` + `aZone` |
| `FrameState` thêm trường `waveMode: 0 \| 1 \| 2`, do `main.ts` đặt (1 khi Hype > 0,7) | Hệ quả của dòng trên |
| Số khán giả cố định 2.500, truyền qua `CrowdOptions.count` | Chọn Game dev; đổi theo địa điểm ở bản sau không cần sửa shader |
| Bù trễ micro: hằng số 120 ms, đổi bằng `?latency=`; **không** làm thanh trượt | Chọn Game dev: rẻ hơn, đủ cho demo |
| Micro giả: `?fakeMic=perfect\|off\|octave` bằng oscillator; `main.ts` truyền callback `targetHz()` vào | Chọn Game dev: kết quả xác định được. Callback giữ nguyên tắc "mic không biết bài hát" của Architect |
| Chế độ không micro = tự bật `fakeMic=perfect` khi bị từ chối quyền, có nhãn "Chế độ xem" | Dùng lại đường kiểm thử, không viết thêm |
| Chấm điểm: bỏ quãng tám, dung sai ±1 nửa cung, nốt vàng ×2, nốt tự do không chấm; công thức ở `02-gamedev.md` mục 4 | Hai bên đồng thuận |
| Hype: bắt đầu 0,3; +0,25/s khi đúng, −0,15/s khi sai, trôi về 0,3 lúc nghỉ; lerp 0,5 s trước khi vào shader | Theo Game dev |
| Tắt `echoCancellation`, `noiseSuppression`, `autoGainControl`; màn bắt đầu nhắc đeo tai nghe | Ba bộ lọc này làm méo cao độ |
| Tiếng reo hò tổng hợp bằng noise: hạng mục "nếu còn giờ" | Không nằm trong tiêu chí nghiệm thu |
| Import shader bằng hậu tố `?raw` của Vite | Không thêm plugin |

## 3. Gói việc

P0 làm trước. P1–P6 chạy song song ngay khi P0 xong, mỗi gói chỉ sửa file mình sở hữu.
Cần đổi `src/core/types.ts` thì báo Architect, không tự sửa. Cổng bắt buộc của mọi gói: `npx tsc --noEmit` sạch.

| Gói | Nội dung | File sở hữu | Model | Phụ thuộc | Tiêu chí xong | Phút |
|---|---|---|---|---|---|---|
| P0 | Khung Vite/TS, `core/types.ts` đóng băng, EventBus, GameLoop, mock `FrameState`, chép bài hát + manifest | file cấu hình, `src/core/*`, `src/dev/mocks.ts`, khung `src/main.ts`, `public/songs/*` | Architect (Fable) | — | `npm run dev` chạy trang trống; type đủ cho P1–P6; bài hát nằm trong `public/songs/chasing-marks/` | 25 |
| P1 | Khán giả instanced + lightstick, chuyển động trong shader | `src/render/crowd.ts`, `crowd.vert.glsl`, `crowd.frag.glsl` | **Opus** | P0 | 2.500 người, ≤ 2 draw call, phản ứng với `hype`, `beat`, `waveMode` từ mock | 45 |
| P2 | Micro, `pitchy`, lọc clarity/RMS, trung vị 3 mẫu, `fakeMic` 3 chế độ, xử lý bị từ chối quyền | `src/mic/*` | **Opus** | P0 | `fakeMic=perfect` trả đúng nốt mục tiêu ±0,3 nửa cung; từ chối quyền không ném lỗi chưa bắt | 35 |
| P3 | Parser UltraStar + loader + AudioEngine (đồng hồ, `level()`) | `src/song/*`, `src/audio/*` | Sonnet | P0 | Test parser xanh trên file thật (BPM dấu phẩy, GAP, ngắt câu); `now()` âm trong lúc đếm ngược | 30 |
| P4 | ScoringEngine + HypeMeter (hàm thuần) | `src/scoring/*` | Sonnet | P0 | Test xanh: đúng nốt, lệch quãng tám, lệch 3 nửa cung, im lặng, đoạn nghỉ | 25 |
| P5 | Teleprompter, dải cao độ, HUD điểm/Hype, màn bắt đầu/kết quả, ghi công | `src/ui/*` | Sonnet | P0 | Chạy với mock: âm tiết tô đúng tiến độ, đếm ngược khi nghỉ > 3 s | 40 |
| P6 | Sân khấu, camera lắc theo chuột, fog, 6–8 chùm sáng additive | `src/render/stage.ts`, `src/render/lights.ts` | Sonnet | P0 | Cảnh dựng được, đèn quét theo `beat`, sáng hơn khi `hype` cao; giới hạn DPR 1,5 | 30 |
| P7 | Nối dây `main.ts`, `window.__game`, Playwright chơi trọn bài 3 chế độ `fakeMic`, build, đóng gói | `src/main.ts`, `tests/e2e/*` | Architect (Fable) + Sonnet sửa lỗi | P1–P6 | Đạt đủ 7 tiêu chí nghiệm thu mục 1 | 60 |

Thứ tự ghép trong P7: P3 + P5 (nhạc và lời khớp nhau) → P2 + P4 (micro, điểm, Hype) → P1 + P6 (hình ảnh theo Hype).

## 4. Mốc giờ (giờ Việt Nam, plan viết lúc 11:31)

| Giờ | Mốc |
|---|---|
| 11:31–11:45 | Session cha báo cáo, người dùng xem plan. Không cần chờ duyệt mới chạy P0 nếu không có phản đối |
| 11:45–12:10 | P0. Kết thúc: `types.ts` đóng băng |
| 12:10–13:30 | P1–P6 song song (6 agent) |
| 13:00 | Điểm kiểm tra giữa chừng: gói nào chưa qua `tsc` thì cắt phạm vi gói đó ngay |
| 13:30–14:30 | P7 ghép theo thứ tự ở mục 3 |
| **14:30** | **Đóng băng tính năng.** Sau mốc này chỉ sửa lỗi |
| 14:30–15:20 | Chạy Playwright 3 chế độ, sửa lỗi, chụp ảnh màn hình |
| 15:20–15:45 | Build, đóng gói, viết hướng dẫn chạy 5 dòng, giao demo |
| 15:45–16:00 | Dự phòng |

**Thứ tự cắt giảm khi trễ** (trả lời câu hỏi 3 của Architect; gộp hai danh sách, cắt từ trên xuống):
1. Tiếng reo hò tổng hợp.
2. Sóng màu lightstick (`waveMode` giữ 0, chỉ đồng màu).
3. Chùm sáng sân khấu (giữ fog và nền tối).
4. Nốt vàng ×2.
5. Dải cao độ trên HUD (giữ lời tô màu và điểm).

Không cắt: nhạc + lời chạy đúng nhịp, micro, chấm điểm, khán giả và lightstick phản ứng theo Hype.

## 5. Cách giao demo — cần session cha / người dùng quyết

Ràng buộc: trình duyệt chỉ cho xin quyền micro trên HTTPS hoặc `localhost`; trang nhúng trong iframe còn cần được cấp quyền `microphone`.

| Phương án | Micro | Điều kiện | Nhận xét |
|---|---|---|---|
| A. File nén mã nguồn, người dùng chạy `npm install && npm run dev` | Chắc chắn chạy (`localhost`) | Máy người dùng có Node 20+ | Code về thẳng thư mục repo trên máy; mất 1–2 phút cài |
| B. Bản build tĩnh `dist/` + server tĩnh (`npx serve dist` hoặc `python3 -m http.server`) | Chắc chắn chạy (`localhost`) | Node hoặc Python | Không cần cài thư viện; mở `file://` trực tiếp thì **không** chạy được |
| C. Link Artifact xem ngay trên trình duyệt | Chưa xác minh | Trang phải được cấp quyền micro; file nhạc 4,7 MB nằm trong giới hạn | Nhanh nhất để xem; nếu micro bị chặn thì chỉ xem được chế độ xem |

**Đề xuất của PM:** giao A + B trong cùng một file nén (mã nguồn kèm `dist/` đã build) làm bản chính, vì đây là cách duy nhất
bảo đảm micro hoạt động. Thêm C làm bản xem nhanh nếu session cha xác minh được quyền micro trước 15:00; không được thì C vẫn
giao với nhãn "chế độ xem".

**Dự phòng không micro:** mọi phương án đều có `?fakeMic=perfect` và tự chuyển sang chế độ xem khi bị từ chối quyền,
nên người xem luôn thấy được lời chạy, điểm và khán giả phản ứng.

## 6. Rủi ro

| # | Rủi ro | Cách giảm |
|---|---|---|
| 1 | Nốt của bài demo lệch thời gian so với bản instrumental (dùng file nốt nào: `song.txt` hay `instrumental.txt`, GAP 7,66 s) | P0 kiểm tra ngay khi chép bài; P3 có bước nghe/đo khớp. Lệch thì chỉnh GAP trong manifest hoặc đổi sang bài dự phòng trước 13:00 |
| 2 | Điểm sai trên máy thật do độ trễ micro hoặc nhạc lọt vào micro | Dung sai rộng, `?latency=`, nhắc đeo tai nghe; ghi rõ là hạn chế đã biết của demo 1 |
| 3 | Ghép 6 gói song song bị lệch hợp đồng | `types.ts` đóng băng sau P0, `tsc` là cổng, mỗi gói tự chạy với mock, ghép theo 3 bước |
| 4 | Micro không hoạt động ở cách giao demo được chọn | Bản chính chạy `localhost`; chế độ xem tự bật khi bị chặn |
| 5 | Hiệu năng không đo được trong headless (WebGL phần mềm) | Giới hạn DPR 1,5, quad lightstick nhỏ, `depthWrite=false`; có `?crowd=1000` để hạ số người trên máy yếu |

## 7. Câu hỏi còn mở cho người dùng

1. **Giao code về máy bằng cách nào:** repo `/Volumes/CaseSensitive/simulator-a-concert` có remote GitHub không
   (gửi `owner/repo` để push branch), hay nhận file nén / git bundle? (Câu này session cha đã hỏi, chưa có trả lời.)
2. **Máy bạn có Node 20+ không?** Có thì giao theo phương án A + B; không thì cần Python hoặc chỉ xem qua link (phương án C).
3. **Bài demo:** *Chasing Marks* là nhạc do fan *My Little Pony* sáng tác (license CC BY 4.0, game không dùng hình ảnh nào của bài).
   Chấp nhận cho demo 1, hay muốn đổi sang bài dự phòng (license phi thương mại)?

## 8. Ghi chú sau P0 (Architect)

**Bài demo đã kiểm tra (rủi ro 1):**
- `instrumental.txt` và `song.txt` có phần nốt giống hệt nhau (241 nốt, BPM 260, GAP 7664 ms); chỉ khác header.
  Đã chép `instrumental.txt` thành `public/songs/chasing-marks/notes.txt`.
- `instrumental.mp3` dài 194,93 s, `song.mp3` 194,95 s. Tương quan chéo đường bao 7 s đầu cho độ lệch ~20 ms,
  tức bản instrumental thẳng hàng với bản có lời, nên GAP của file nốt dùng được nguyên (`gapOffsetMs: 0`).
- Trong bản có lời, năng lượng tăng vọt ở ~7,5 s, khớp với GAP 7,66 s. Nốt cuối kết thúc ở 180,7 s.
- Chưa ai nghe bằng tai: P3/P7 vẫn nên nghe thử một lần; lệch thì chỉnh `gapOffsetMs` trong manifest.
- `license.txt` ghi rõ "Creative Commons Attribution 4.0".

**Khác so với interface ở mục 2 / `01-architect.md` (bản trong `src/core/types.ts` thắng):**
- `ScoringEngine.update(songTime, pitch, latencySec, dt)`: thêm `dt` cho Hype. `ScoreState` thêm `percent` (0..100);
  `ScoreState.hype` là giá trị đã làm mượt.
- `FrameState` thêm `waveMode` và `score`. `FrameState.beat` tính theo `visualBpm` (tempo thật, 130 với bài demo, đo từ audio),
  không phải beat UltraStar. `Song` và manifest có thêm `visualBpm`, `attribution`.
- `parseUltraStar(txt, entry)` và `loadSong(entry)` nhận mục manifest thay cho URL; thêm `loadManifest()`.
- `AudioEngine` thêm `resume()` và `durationSec`.
- `createMic(opts)` nhận `{ mode, targetHz }`; `start()` trả về mode thực tế và không reject khi bị từ chối quyền.
- UI: `createHud` trả `Hud` (`setNotice`, `setVisible`); thêm `createScreens(root, { onStart })` với
  `showStart/showLoading/showResult/showError/hide`. Màn kết quả thuộc `Screens`, không thuộc `Hud`.
- Tiện ích dùng chung ở `src/core/time.ts`: `beatToSec`, `visualBeat`, `beatPulse`, `pitchToHz`, `hzToMidi`, `noteAt`.
- `main.ts` đã nối dây đủ luồng với stub (menu → countdown → playing → result) và có `window.__game`; P7 chỉ cần hoàn thiện.
- Quy ước không gian: ca sĩ ở gốc tọa độ, nhìn về −Z; khán giả ở z < −6, sàn y = 0.
