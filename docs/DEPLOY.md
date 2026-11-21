# Xuất bản bản dựng tĩnh

Game là web tĩnh (Vite), `base: './'` nên chạy được ở gốc tên miền lẫn thư mục con (vd. `https://user.github.io/ten-repo/`). Không có máy chủ, không có API; mọi thứ (âm thanh micro, file nhập) xử lý trên máy người chơi.

## Dựng

```bash
npm ci
npm run build      # tsc --noEmit + vite build
```

Kết quả ở `dist/`: `index.html`, `assets/` (tên file có hash), `songs/`, `favicon.svg`, `robots.txt`, `_headers`. Chỉ cần đưa nguyên thư mục `dist/` lên host. Xem thử cục bộ: `npm run preview`.

## Bắt buộc: HTTPS

Trình duyệt chỉ cho dùng micro (`getUserMedia`) trên **HTTPS** hoặc `localhost`. Qua HTTP thường, game vẫn chạy nhưng không có micro (hiện thông báo trong bảng micro, chơi ở chế độ xem không chấm điểm). Cả 4 host dưới đây cấp HTTPS miễn phí trên tên miền của họ.

## Cache và nén

- `assets/*` (tên có hash): `Cache-Control: public, max-age=31536000, immutable`.
- `index.html`: `Cache-Control: no-cache` (luôn kiểm tra lại để người dùng nhận bản mới).
- `songs/*`: cache ngắn (1 ngày) vì tên file không có hash.
- Nén brotli/gzip: hầu hết host tự bật cho JS/CSS/HTML; không cần làm gì thêm. File `.mp3` đã nén sẵn.
- `public/_headers` đã chứa các quy tắc trên (+ `nosniff`, `Referrer-Policy`, `Permissions-Policy: microphone=(self)`), dùng được cho Cloudflare Pages và Netlify. GitHub Pages không cho tùy chỉnh header (cache do GitHub quy định); Vercel dùng `vercel.json` (mẫu bên dưới).

## Từng host

> Đánh dấu **(chưa kiểm chứng)**: lúc soạn tài liệu này môi trường không truy cập được trang tài liệu chính thức của host (chỉ tìm kiếm web giới hạn), nên các bước và hạn mức dưới đây viết theo hiểu biết hiện có. Hãy đối chiếu với tài liệu của host trước khi dùng.

### GitHub Pages (nơi đã chọn)
Workflow `.github/workflows/pages.yml` đã có sẵn trong repo: mỗi lần push vào `main` sẽ chạy test, build và triển khai.
1. Đẩy mã lên GitHub (`git push origin main`).
2. Bật một lần: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Xem tab Actions; khi xong, game ở `https://vietanhkvh.github.io/simulator-a-concert/` (HTTPS có sẵn nên micro dùng được; đường dẫn tương đối nên chạy đúng trong thư mục con).
4. Lưu ý: GitHub Pages không cho tuỳ chỉnh header nên `public/_headers` không có tác dụng ở đây (cache do GitHub quy định); repo miễn phí phải để công khai mới dùng được Pages; có hạn mức dung lượng site và băng thông (xem tài liệu GitHub).
5. Chưa kiểm chứng: số phiên bản các action trong workflow (`checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`) viết theo hiểu biết hiện có; nếu Actions báo phiên bản cũ, nâng lên bản mới nhất.

### Cloudflare Pages
1. Dashboard → Workers & Pages → Create → Pages → kết nối Git, hoặc **Direct Upload** (kéo thả thư mục `dist/`).
2. Với kết nối Git: Build command `npm run build`, Build output directory `dist`, biến môi trường Node 22 nếu cần.
3. `_headers` được đọc tự động từ gốc output. Đã kiểm chứng: tối đa 100 quy tắc, mỗi dòng ≤ 2000 ký tự, quy tắc áp theo thứ tự trong file. Giới hạn số file gói miễn phí: 20.000 (đã kiểm chứng qua tìm kiếm); giới hạn dung lượng mỗi file (chưa kiểm chứng) — file lớn nhất của game là `.mp3` bài demo, cần nhỏ hơn mức đó.

### Netlify (chưa kiểm chứng)
1. Add new site → Import from Git (Build command `npm run build`, Publish directory `dist`), hoặc kéo thả thư mục `dist/` vào trang Deploys (Netlify Drop).
2. `_headers` đặt ở gốc thư mục publish (đã có trong `dist/`), cùng cú pháp với Cloudflare Pages.
3. Gói miễn phí có hạn mức băng thông/build theo tháng — xem tài liệu Netlify.

### Vercel (chưa kiểm chứng)
1. Import project từ Git; preset **Vite**: Build `npm run build`, Output Directory `dist` (thường tự nhận).
2. Vercel bỏ qua `_headers`. Tạo `vercel.json` ở gốc repo:
   ```json
   { "headers": [
     { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
     { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
   ] }
   ```
3. Lưu ý: gói Hobby của Vercel dành cho dự án phi thương mại cá nhân — đối chiếu điều khoản hiện hành.

## Kiểm tra sau khi lên mạng
- Mở bằng `https://`, bấm “Thử micro” và cho phép micro.
- Tắt WebGL (hoặc mở trên máy cũ) để thấy thông báo thân thiện; `?dev=1` để xem chi tiết lỗi trong toast và console.
- Mở DevTools → Network: `assets/*` trả `immutable`, `index.html` trả `no-cache`.
- Panel “Giới thiệu / Bản quyền” ở sảnh giữ ghi công CC BY 4.0 cho bài demo; không bỏ khi xuất bản.
