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

| Phím / nút | Tác dụng |
|---|---|
| Nút **Tạm dừng** (góc trên phải) hoặc `Esc` | Tạm dừng / tiếp tục. Chuyển sang tab khác cũng tự tạm dừng |
| `Space` | Kêu gọi khán giả hò reo |
| `W` | Sóng lightstick quét ngang khán đài |
| `H` | Khán giả thả tim |
| `F` | Bật / tắt biển đèn flash điện thoại |
| `P` | Bắn pháo hoa và pháo giấy |

Các tương tác có thời gian chờ 4 giây và chỉ làm khán giả sôi động hơn trên hình, không cộng điểm.

## Tham số URL

| Tham số | Ý nghĩa |
|---|---|
| `?latency=120` | Bù độ trễ micro (ms). Tăng nếu hát đúng mà bị chấm trễ. |
| `?fakeMic=perfect` | Micro giả hát đúng giai điệu (xem thử không cần micro). Còn có `off`, `octave`. |
| `?crowd=2500` | Số khán giả (100–10000). |

## Lệnh khác

- `npm test` — unit test (parser, chấm điểm, nhận diện cao độ)
- `npm run build` — kiểm tra kiểu và build ra `dist/`

## Bài hát

*Chasing Marks* — Silver Note, CC BY 4.0, lấy từ kho [UltraStar-Deluxe/songs](https://github.com/UltraStar-Deluxe/songs). Chi tiết license trong `public/songs/`.

## Tài liệu

- `docs/PLAN.md` — plan demo 1, gói việc, quyết định đã chốt
- `docs/discussion/` — đề xuất của Architect và Game dev
