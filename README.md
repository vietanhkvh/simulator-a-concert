# Simulator a Concert — demo 1

Game web giả lập ca sĩ biểu diễn concert: hát qua micro, game chấm cao độ, khán giả 2.500 người phản ứng theo thanh Hype.

## Chạy trên máy (cần Node 20+)

```bash
npm install
```

```bash
npm run dev
```

Mở `http://localhost:5173`, bấm **Bắt đầu**, cho phép dùng micro. Hãy đeo tai nghe để micro không thu lại tiếng nhạc.

## Chạy không cần Node

Thư mục `dist/` là bản build sẵn. Chạy một server tĩnh trong đó, ví dụ:

```bash
cd dist && python3 -m http.server 5173
```

Micro chỉ hoạt động trên `localhost` hoặc HTTPS, không chạy khi mở file trực tiếp.

## Nhập bài từ máy

Ở màn bắt đầu, dưới nút **Bắt đầu**, chọn (hoặc kéo-thả) một hay nhiều file. **File của bạn không rời khỏi thiết bị**: game đọc file ngay trong trình duyệt (File API, object URL, `decodeAudioData`), không upload.

| Chọn | Chế độ |
|---|---|
| Nhạc (mp3/ogg/wav/m4a…) + UltraStar `.txt` | Lời + chấm cao độ như bài có sẵn (bỏ qua `#MP3`, tên bài/ca sĩ lấy từ header) |
| Nhạc + `.lrc` | Lời theo câu, không có dải nốt |
| Video karaoke (mp4/webm) | Nhạc lấy từ video, video hiện ở giữa-dưới để đọc lời in sẵn |
| Chỉ file nhạc | Hát tự do, không lời |

Ba chế độ sau không có nốt nên không chấm điểm cao độ: Hype tăng khi micro bắt được giọng hát (chế độ `.lrc` chỉ tính trong lúc có câu lời) và giảm khi im lặng. Nhịp cho khán giả/đèn mặc định 120 BPM.

## Sảnh chờ và màn chào sân

Mở trang là vào **sảnh chờ** (che kín sân vận động): tên bài, khu nhập bài, bảng micro và ba thẻ chọn màn chào sân —
**1** Nhảy khỏi trực thăng, **2** Bục nâng từ dưới sân khấu, **3** Thả cáp từ trực thăng (phím `1`/`2`/`3` hoặc mũi tên;
lựa chọn được nhớ). Ô **Bỏ qua màn chào sân** để vào thẳng bài. Bấm **Bắt đầu**: xin micro và tải bài, màn hình tối dần
rồi mở ra sân khấu với màn chào sân. Trong lúc chào sân chưa phát nhạc, chưa hiện lời/video, chưa chấm điểm;
chỉ khi màn chào sân kết thúc (hoặc bấm `Enter`/`Esc` để bỏ qua) mới đếm ngược 3 s và vào bài.
**Hát lại** ở màn kết quả và trong menu tạm dừng không chiếu lại màn chào sân; nút **Về sảnh** ở màn kết quả quay về sảnh.
Khi có sự kiện bí mật, camera tự chuyển sang góc **Toàn cảnh** rồi trả lại góc cũ khi sự kiện kết thúc.

## Điều khiển khi đang diễn

Bảng hướng dẫn phím hiện ở cạnh trái trong ~15 giây đầu của bài đầu tiên rồi thu về nút **?**; bấm `H` hoặc **?** để ẩn/hiện (được ghi nhớ). Danh sách dưới đây giống hệt bảng trong game (`src/ui/controlsGuide.ts`, có test kiểm tra đồng bộ).

| Chức năng | Phím |
|---|---|
| Di chuyển | `W` `A` `S` `D` / mũi tên |
| Xoay góc nhìn | Kéo chuột / `Q` `E` |
| Chuột tự do | `M` / nhấp đúp (bấm `M` hoặc `Esc` để thoát) |
| Đổi góc máy | `V` (ca sĩ → flycam → hố → cần cẩu → toàn cảnh) |
| Xoay góc máy | Kéo chuột (ở mọi góc máy khác ca sĩ) |
| Phóng to / thu nhỏ | Lăn chuột |
| Nâng / hạ máy quay | `R` / `F` |
| Flycam bay tự do | `G` (bấm `G` lần nữa để thoát) |
| Bay flycam | `W` `A` `S` `D` `R` `F` + giữ `Shift` để bay nhanh hơn |
| Đặt lại góc máy | `0` |
| Đưa micro cho khán giả | Giữ `C` (tối đa 10 giây, chỉ bài có nốt) |
| Hò reo | `1` / `Space` |
| Sóng lightstick | `2` |
| Thả tim | `3` |
| Đèn flash | `4` (bật / tắt) |
| Pháo hoa | `5` (pháo hoa + pháo giấy) |
| Tua lùi / tới 10 s | `[` / `]` (hoặc nút ⏪/⏩, bấm thanh tiến độ để tua tới vị trí bất kỳ) |
| Thu nhỏ khung lời | `T` |
| Tạm dừng / xưởng chỉnh | `Esc` hoặc nút **Tạm dừng** (chuyển tab cũng tự tạm dừng) |
| Bỏ qua màn chào sân | `Enter` / `Esc` |
| Chọn màn chào sân (ở sảnh) | `1` `2` `3` / mũi tên |
| Ẩn/hiện hướng dẫn | `H` |

Góc trên phải có các nút nhỏ **Góc máy (V)**, **Chuột tự do (M)**, **Kết thúc** (bấm 2 lần trong 3 giây để kết thúc buổi diễn và xem kết quả với điểm hiện có) và **Tạm dừng**. Khi đang gõ trong ô nhập (menu tạm dừng) các phím game không có tác dụng.

### Tạm dừng = xưởng chỉnh

Khi tạm dừng, đồng hồ bài, điểm và chấm micro đứng yên nhưng sân khấu vẫn chạy (đi lại, xoay, đổi góc máy vẫn được) để thử. Bảng bên phải có: **Tiếp tục**, **Hát lại từ đầu**, **Kết thúc buổi diễn**; micro (chọn thiết bị, thử micro, độ nhạy, bù trễ 0–400 ms); âm lượng nhạc / tiếng đám đông / khán giả hát theo (0–150 %, có nút nghe thử); Hype xem trước, chất lượng vẽ khán giả và nút thử từng tương tác; sự kiện bí mật (nếu có); góc máy và chuột tự do; băng rôn cổ vũ (mỗi dòng một khẩu hiệu, tối đa 6 dòng × 24 ký tự); tua ±10 s và thanh tua. Các chỉnh âm lượng, bù trễ, băng rôn được lưu trong trình duyệt. Chỉ nhạc dừng; tiếng đám đông vẫn nghe được khi thử.

Ở điệp khúc (các câu lời lặp lại), khi Hype trên 0,45 khán giả tự hát theo giai điệu.

Chọn micro ở góc trên phải của màn bắt đầu (ví dụ nghe bằng tai nghe nhưng thu bằng micro của máy).

Các tương tác có thời gian chờ 4 giây và chỉ làm khán giả sôi động hơn trên hình, không cộng điểm.

## Tham số URL

| Tham số | Ý nghĩa |
|---|---|
| `?latency=120` | Bù độ trễ micro (ms). Tăng nếu hát đúng mà bị chấm trễ. Cũng chỉnh được trong menu tạm dừng. |
| `?fakeMic=perfect` | Micro giả hát đúng giai điệu (xem thử không cần micro). Còn có `off`, `octave`. |
| `?entrance=jump` | Ghi đè màn chào sân chọn ở sảnh: `jump` (nhảy khỏi trực thăng), `lift` (bục nâng), `cable` (thả cáp), `off` (tắt). Giá trị cũ `hero`→`jump`, `parachute`→`cable`. |
| `?crowd=8000` | Số khán giả (100–10000). Game tự giảm số người được vẽ nếu máy chậm. |
| `?dev=1` | Bật chế độ developer (nhớ trong localStorage tới khi mở `?dev=0`). Xem mục dưới. |

## Chế độ developer

Bảng nổi để thử nhanh mọi tính năng, dùng được ở mọi trạng thái (sảnh, chào sân, đang diễn, tạm dừng, kết quả).
Không đổi gameplay trừ khi bấm một nút trong bảng.

- **Bật:** `?dev=1` (nhớ tới khi `?dev=0`), phím **`** (backquote) hoặc **F2** bất cứ lúc nào, link nhỏ "DEV" góc dưới trái
  ở sảnh, hoặc nút "Mở bảng developer" trong menu tạm dừng. Huy hiệu vàng "DEV" ở góc trên trái = đang bật (bấm để ẩn/hiện bảng).
- **Bảng** (`src/ui/devPanel.ts`): kéo bằng thanh tiêu đề, thu gọn bằng "–" (vị trí và trạng thái thu gọn được nhớ; lần đầu mở ở dạng thu gọn); phím game không bị chặn khi bảng không được focus,
  và bị bỏ qua khi đang gõ trong ô nhập của bảng. Các mục:
  - *Số liệu* (~4 Hz): FPS / thời gian frame (trung bình + 1% thấp trong 3 s), draw call / tam giác / geometry / texture /
    program, số khán giả + chất lượng tự động, trạng thái, thời gian bài, Hype (hiển thị và của điểm), micro (chế độ, mức, nốt),
    góc máy, vị trí/hướng người chơi, sự kiện bí mật / chào sân đang chạy. Nút "Copy stats" chép JSON.
  - *Trạng thái game*: bắt đầu ngay (không chào sân) hoặc với từng kiểu chào sân, hát lại, kết thúc, màn kết quả, tua ±10/30 s,
    tới điệp khúc, tới 10 s trước khi hết bài.
  - *Hype*: khóa Hype hiển thị (0–100 %) cho mọi module hình + âm thanh, **không** đổi điểm (thanh Hype trên HUD hiện giá trị khóa kèm nhãn "DEV"; xem trước trong menu tạm dừng hiện nhãn "XEM"); nút nhanh 0/20/40/60/80/95/100 %;
    quét 0→100 % trong 20 s (thử ngưỡng cực quang 40 %, sao băng 20/40/60/80 %…).
  - *Micro*: đổi micro giả lúc đang chạy (`real` / `perfect` / `off` / `octave` / `silent`), bù trễ, độ nhạy.
  - *Kích hoạt*: tương tác (hò reo, sóng, thả tim, flash, pháo hoa, hát theo), pyro, pháo giấy, đội hình tim, từng loại biểu tượng,
    laser (Hype 90 %), khán giả hát theo bật/tắt, sự kiện bí mật + tỉ lệ, máy bay kéo băng rôn, mưa sao băng, xem thử màn chào sân,
    đặt băng rôn (nhiều khẩu hiệu cách nhau bằng `|`).
  - *Camera*: mọi góc máy (theo `VIEW_MODES` của khu sân trung tâm), chuột tự do, dịch chuyển (sân khấu, cuối runway, bục trái/phải,
    B-stage), độ nhạy nhìn, nút Flycam (G) và Đặt lại góc máy (0) khi `window.__csControls` có, **camera bay tự do** (WASD, Q/E lên/xuống, kéo chuột để nhìn, giữ Shift để nhanh; không bị giới hạn lối đi).
  - *Khu & lớp*: ẩn/hiện từng khu (ngoài sân, khán đài, sân trung tâm, điểm sáng dùng chung) và từng lớp trong khu
    (vd. `crowd`, `lights`, `stageFx`, `emotes`, `confetti`, `led`, `band`, `crew`, `sky`, `balloons`, `stadium`…), chất lượng
    vẽ khán giả, đổi số khán giả (tải lại với `?crowd=`). Đã tách thêm các lớp `aurora`, `stars`, `meteors` (trong `sky`), `crowdDots`
    (khán giả chấm sáng ở khán đài), `lasers` (trong `stageFx`) và `secrets` (vật thể sự kiện bí mật, tạo lười lúc chạy). Chưa tách riêng
    được: đèn nhà / đèn pha / đèn hàng không (chung một draw call `glow`, chỉ tắt cả cụm) và cường độ cực quang theo Hype (uniform trong shader).
  - *Nhật ký*: 30 sự kiện gần nhất (`cs-interact`, `cs-secret`, `cs-entrance`, `cs-view`, `cs-mouselook`) + lỗi/cảnh báo console
    từ lúc tải trang, kèm thời điểm (giây).

**Cho kiểm thử tự động: `window.__dev`** (có cả khi chưa bật bảng):

| Hàm | Việc |
|---|---|
| `stats()`, `snapshot()`, `log()` | số liệu (như bảng) / không có FPS / `{ events, errors }` |
| `show()`, `hide()`, `toggle()`, `enable()`, `disable()` | bảng và chế độ developer |
| `startInstant()`, `startWithEntrance('jump'｜'lift'｜'cable')`, `restart()`, `end()`, `result()` | trạng thái game |
| `seekBy(s)`, `seekTo(s)`, `chorusSec()`, `duration()` | tua |
| `setHypeLock(0..1 ｜ null)`, `getHypeLock()`, `sweepHype(sec=20)` | Hype hiển thị |
| `setMicMode('real'｜'perfect'｜'off'｜'octave'｜'silent')`, `setLatency(ms)`, `setSensitivity(gain)` | micro |
| `interact('cheer'｜'wave'｜'heart'｜'flash'｜'fireworks'｜'sing')`, `pyro()`, `confetti()`, `emote(kind)`, `formation(kind?)`, `setCrowdSing(on)` | hiệu ứng |
| `secret(kind)`, `secretKinds()`, `setSecretChance(kind, 0..1)`, `flyby()`, `meteors(n)`, `entrancePreview(kind)`, `banners(lines)` | sự kiện |
| `views()`, `setView(id)`, `setMouseLook(on)`, `teleportTargets()`, `teleport(name ｜ {x, z, yaw})`, `setLookSens(v)`, `setFreeFly(on)`, `cameraPose()` | camera |
| `setZoneVisible('outside'｜'stands'｜'arena'｜'glow', on)`, `layers(zone)`, `setLayerVisible(zone, name, on)`, `setCrowdQuality(q)`, `reloadWithCrowd(n)` | khu & lớp |

## Lệnh khác

- `npm test` — unit test (parser, chấm điểm, nhận diện cao độ)
- `npm run build` — kiểm tra kiểu và build ra `dist/`

## Bài hát

*Chasing Marks* — Silver Note, CC BY 4.0, lấy từ kho [UltraStar-Deluxe/songs](https://github.com/UltraStar-Deluxe/songs). Chi tiết license trong `public/songs/`.

## Tài liệu

- `docs/ARCHITECTURE.md` — cấu trúc mã nguồn theo ba khu (ngoài sân, khán đài, sân trung tâm), quy tắc phụ thuộc
- `docs/PLAN.md` — plan demo 1, gói việc, quyết định đã chốt
- `docs/discussion/` — đề xuất của Architect và Game dev
