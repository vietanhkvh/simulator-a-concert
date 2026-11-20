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

## Điều khiển khi đang diễn

Bảng hướng dẫn phím hiện ở cạnh trái trong ~15 giây đầu của bài đầu tiên rồi thu về nút **?**; bấm `H` hoặc **?** để ẩn/hiện (được ghi nhớ). Danh sách dưới đây giống hệt bảng trong game (`src/ui/controlsGuide.ts`, có test kiểm tra đồng bộ).

| Chức năng | Phím |
|---|---|
| Di chuyển | `W` `A` `S` `D` / mũi tên |
| Xoay góc nhìn | Kéo chuột / `Q` `E` |
| Chuột tự do | `M` / nhấp đúp (bấm `M` hoặc `Esc` để thoát) |
| Đổi góc máy | `V` (ca sĩ → flycam → hố → cần cẩu → toàn cảnh) |
| Đưa micro cho khán giả | Giữ `C` (tối đa 10 giây, chỉ bài có nốt) |
| Hò reo | `1` / `Space` |
| Sóng lightstick | `2` |
| Thả tim | `3` |
| Đèn flash | `4` (bật / tắt) |
| Pháo hoa | `5` (pháo hoa + pháo giấy) |
| Tua lùi / tới 10 s | `[` / `]` (hoặc nút ⏪/⏩, bấm thanh tiến độ để tua tới vị trí bất kỳ) |
| Thu nhỏ khung lời | `T` |
| Tạm dừng / xưởng chỉnh | `Esc` hoặc nút **Tạm dừng** (chuyển tab cũng tự tạm dừng) |
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
| `?entrance=parachute` | Màn chào sân: `parachute` (nhảy dù từ trực thăng), `hero` (đáp đất kiểu siêu anh hùng), `off` (tắt). Mặc định chọn ngẫu nhiên; bấm `Enter` để bỏ qua. |
| `?crowd=8000` | Số khán giả (100–10000). Game tự giảm số người được vẽ nếu máy chậm. |

## Lệnh khác

- `npm test` — unit test (parser, chấm điểm, nhận diện cao độ)
- `npm run build` — kiểm tra kiểu và build ra `dist/`

## Bài hát

*Chasing Marks* — Silver Note, CC BY 4.0, lấy từ kho [UltraStar-Deluxe/songs](https://github.com/UltraStar-Deluxe/songs). Chi tiết license trong `public/songs/`.

## Tài liệu

- `docs/PLAN.md` — plan demo 1, gói việc, quyết định đã chốt
- `docs/discussion/` — đề xuất của Architect và Game dev
