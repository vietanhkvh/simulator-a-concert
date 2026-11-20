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
