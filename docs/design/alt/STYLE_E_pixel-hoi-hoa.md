# STYLE E — "ĐÊM SAO ĐIỂM ẢNH" (pixel art · hội hoạ)

Ảnh xem trước: `preview-E-pixel-hoi-hoa.png` (cùng bố cục với A/B/C). Tên làm việc "Pixel Hội hoạ"; tên đề xuất **Đêm Sao Điểm Ảnh**. Trạng thái: bản xem trước, **chưa có mã game**.
Nguồn: **có tra web** (3 lượt, xem mục 9) cho kỹ thuật pixel 3D, quy ước pixel art và bản quyền Munch; mô tả hai bức tranh, năm mất các hoạ sĩ khác và mọi đánh giá hiệu năng/công là **kiến thức nghề + ước lượng, chưa đo**.

## 1. Tóm tắt
- Cả concert là **một bức tranh pixel đang chuyển động**: trời là "Đêm đầy sao" (Van Gogh, 1889), khán giả lẫn "Người thét" (Munch, 1893), sân khấu là khung tranh mạ vàng.
- **Một cỡ pixel duy nhất** cho thế giới; ≤ 31 màu; mọi chuyển sắc bằng dither có trật tự hoặc vệt cọ, không gradient mượt.
- Hype đi từ lam–vàng (Van Gogh) sang son–cam (Munch): càng cuồng, trời càng "thét".
- Đối lập chibi: không bo tròn mềm, không tô bóng mượt; dễ thương đến từ sprite nhỏ và sự hài hước của các nhân vật hội hoạ.

## 2. Bảng màu — 31 màu (700 bóng · 500 thân · 300 sáng · 100 highlight)
| Token | Vai trò | 700 | 500 | 300 | 100 |
|---|---|---|---|---|---|
| `pho` Lam Phổ | trời đêm, nền, nút phụ | `#101A3A` | `#1F3A8A` | `#2F5FB8` | `#5B93D6` |
| `crom` Vàng crôm | sao, khung vàng, nút chính, nốt đúng | `#B3781A` | `#F2B824` | `#F7DC78` | `#FDF6D0` |
| `bach` Lục bách | cây bách, "tốt", xanh ốm của Munch (bậc 100) | `#10261F` | `#1E5A46` | `#3F8F62` | `#A8C66C` |
| `son` Son Munch | **chỉ khi Hype ≥ 80 %**, lỗi, secret | `#5A1420` | `#C8321E` | `#F0641E` | `#F8A04A` |
| `dat` Đất & da | gỗ, toan, làng, da (4 bậc dùng làm 3 tông da) | `#3B2416` | `#7A4526` | `#C98A56` | `#F0C79A` |
| `tim` Tím chiều | khán đài, bóng đổ, áo | `#2A2350` | `#4A3F82` | `#7F6CC0` | `#B9A6E0` |
| `may` Xám mây | đá, giàn đèn, chữ phụ, mây sáng | `#3C4664` | `#6B7690` | `#A9CBE8` | `#E8F1F6` |
Màu lẻ: `ink` mực `#0B0A1A` (viền, nền UI) · `ngoc` `#39B6B0` và `sen` `#E46A9A` (lightstick, đèn màu). Ramp **dịch sắc**: bóng về lam/tím, sáng về vàng. Da = `dat-100/300/500`, bóng da `dat-500/700`; mặt "Người thét" = `dat-100` + `dat-300`.
Tương phản WCAG (đã tính): chữ `crom-100` trên `ink` **18,0** · chữ phụ `may-300` trên ink **11,6** · nút chính ink trên `crom-500` **10,9** · nút phụ kem trên `pho-500` **9,5** · chip tốt/đúng/trễ (ink trên `bach-100` / `crom-300` / `son-100`) **10,2 / 14,4 / 9,4** · chip lỗi kem trên `son-700` **12,4**. Cấm: chữ nhỏ kem trên `son-500` (4,9) và trên `pho-300` (5,6) — chỉ ≥ 18 px đậm; `may-500` trên ink (4,3) chỉ cho chú thích phụ.

## 3. Ba trạng thái Hype
| Trạng thái | primary | secondary | accent | Trời & đèn |
|---|---|---|---|---|
| 0–40 % **Đêm đầy sao** | `pho-500` `#1F3A8A` | `pho-300` `#2F5FB8` | `crom-300` `#F7DC78` | xoáy trôi chậm (0,2 vòng/s), 11 sao "thở" ±1 px theo phách, 25 % đèn |
| 40–80 % **Hướng dương** | `pho-300` `#2F5FB8` | `crom-500` `#F2B824` | `bach-100` `#A8C66C` | quầng sao nở ×1,5, vệt cọ đổi sang lam nhạt + vàng, 60 % đèn |
| 80–100 % **Tiếng thét** | `son-500` `#C8321E` | `son-300` `#F0641E` | `son-100` `#F8A04A` | xoáy duỗi thành **dải gợn ngang son–cam**, dưới là vịnh lam–lục; cả sân làm dáng ôm má thét |
**Thay cực quang (≥ 40 %):** "gió nét cọ" — số vệt cọ sáng, bán kính quầng sao và tốc độ quay của xoáy tăng theo `auroraAmount(h)` (dùng lại làm `skyFxAmount`); ≥ 80 % hàm dòng nội suy từ xoáy sang dải sóng ngang và bảng màu trời hoán đổi `pho → son`.

## 4. Luật điểm ảnh
- **Cỡ pixel:** cảnh 3D vẽ vào đích **480×270** (16:9; màn nhỏ 320×180), phóng **nguyên lần** bằng nearest; không xoay, không co giãn sprite lẻ, không trộn độ phân giải.
- **Cao sprite:** ca sĩ 32 px (20×32) · ban nhạc 16–18 · khán giả 4 tầng 24 / 18 / 12 / 7 px · khán đài xa = chấm 1 px (điểm hoạ kiểu Seurat) · Người thét 16×24 và 10×14.
- **Viền chọn lọc:** chỉ sprite ≥ 18 px có viền `ink` 1 px bên ngoài; tầng xa không viền, tách bằng sắc độ; không viền trong, không pillow shading, không pixel mồ côi.
- **Dither:** chỉ Bayer 4×4 và caro 50 % (chùm đèn, bậc trời, sàn); cấm nhiễu ngẫu nhiên. **Nét cọ:** vệt 3–7 px, một màu mỗi vệt, hướng theo trường dòng.
- **Khung hình (12 fps):** đứng 2 · hát 4 · nhảy 4 · vẫy 4 · thét 3; chuyển động phụ bằng dịch 1 px (sub-pixel giả bằng đổi màu mép). **Parallax 5 lớp:** trời → đồi/làng/cây bách → khán đài → sân khấu → đám đông gần.
- **Silhouette:** mỗi nhân vật khách mời phải nhận ra ở 12 px bằng 1 dấu hiệu (khăn lam–vàng, tóc dài + tay khoanh, đầu trọc + miệng chữ O).

## 5. Hai bức tranh được dùng thế nào
- **Trời = "Đêm đầy sao" động:** một hàm dòng ψ(x,y) = dải ngang lượn + 2 xoáy xoắn ốc + 11 "núi" quanh sao và trăng; vệt cọ chạy vuông góc ∇ψ, màu lấy theo dải ψ (lam Phổ/côban/lam nhạt), gần sao đổi sang kem → vàng → lục nhạt. Trăng khuyết cam trong quầng vàng (phải-trên); **cây bách** lục sẫm dạng ngọn lửa (trái) và **làng có tháp chuông**, cửa sổ vàng nằm ngoài vành sân. Quầng sao đập theo phách; pha ψ trôi theo thời gian.
- **Khán giả:** sprite cầm **ngôi sao có quầng** (thay lightstick). **1 / 12 là "Người thét"** (đầu trọc nhạt, hai tay ôm má, miệng O, thân gợn sóng lam sẫm) — bật khung "thét" khi có tiếng cổ vũ; ở "Tiếng thét" 100 % khán giả dùng dáng này. Hai bóng người phía sau và lan can cầu xuất hiện ở khán đài sau lưng camera.
- **Khách mời (≤ 1 / 40, tất cả thuộc phạm vi công cộng):** Mona Lisa — da Vinci († 1519) · Cô gái đeo hoa tai ngọc trai — Vermeer († 1675) · Sóng lừng ngoài khơi Kanagawa — Hokusai († 1849; dùng cho sóng người và LED) · Hướng dương — Van Gogh († 1890; LED, pháo hoa) · Vệ nữ trên vỏ sò — Botticelli († 1510) · Nụ hôn — Klimt († 1918; cặp đôi áo vàng) · người dạo chơi che ô — Seurat († 1891). **Không dùng:** Picasso († 1973), Dalí († 1989), Magritte († 1967), Warhol († 1987), Matisse († 1954 — còn bảo hộ ở nhiều nước tới 2025+); Mondrian († 1944) được ở EU nhưng tránh vì tranh sau 1930 còn vướng ở Mỹ.

## 6. Thay đổi theo nhóm vật thể (so với chibi)
| Nhóm | Đêm Sao Điểm Ảnh | Công |
|---|---|---|
| Ca sĩ | "hoạ sĩ rock": mũ nồi son, áo choàng trắng dính sơn, **micro = cọ vẽ**; atlas sprite 20×32, 4 hướng × 5 hoạt cảnh | L |
| Ban nhạc | trống = 3 thùng sơn, guitar = bảng pha màu có cần, keyboard đặt trên giá vẽ | M |
| Khán giả | atlas canvas 4 tầng × (thường / thét / khách mời) × khung hình; billboard lấy mẫu nearest, bám lưới pixel | M |
| Sân khấu | khung tranh mạ vàng (hoa văn hạt 4 px, hoa thị 4 góc, huy hiệu sao); LED hai bên = toan trên giá vẽ; runway = một vệt cọ vàng; B-stage = bảng pha màu có lỗ ngón cái | M |
| Khán đài | nền `tim-700` + chấm 1 px theo ô so le (điểm hoạ); đổi màu chấm theo Hype | S |
| Trời | shader trường dòng + lượng tử hoá bảng màu; trăng, sao, bách, làng là sprite | M |
| Băng rôn cổ vũ | **toan căng khung** treo trên vành sân + nhãn bảo tàng (plaque) ghi lời cổ vũ | S |
| `dragon` | **đôi rồng nét cọ** (vàng crôm + ngọc), thân là chuỗi vệt cọ uốn hình sin | L (chung gói secret) |
| `ufo` | **bảng pha màu bay**, đèn = các đốm sơn, chùm rọi dither | |
| `rocket` | **tuýp sơn** phun đuôi sơn vàng → cam → son; pháo nổ thành **sao Van Gogh** nhiều vòng và hoa hướng dương | |
| `jet` | hai **cây cọ bay** vẽ **trái tim nét cọ son** (thay tim khói) | |
| máy bay băng rôn | **máy bay giấy ký hoạ** kéo toan "HÁT NỮA ĐI!" | |
So với các hướng khác: tổng công **cao hơn A, ngang C, thấp hơn B** — đắt ở khâu vẽ atlas sprite (nội dung), rẻ ở hình học (hầu hết là mặt phẳng + billboard).

## 7. Giao diện
- Chữ: chồng monospace hệ thống (`ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace`), đậm, giãn chữ 1–3 px — **không nhúng font**; tiếng Việt đủ dấu nên không dùng font bitmap tự vẽ cho lời.
- Khung 9-slice kiểu **bảng tên phòng tranh**: viền bậc thang 3 px (sáng trên-trái, tối dưới-phải), góc vuông, bóng cứng lệch 3 px; icon pixel 12×12 (sao quầng, xoáy, vệt sơn).
- Thanh Hype chia 25 ô: lam → crôm → son. **Lời bài hát và HUD luôn vẽ ở độ phân giải gốc của màn hình**, không qua bước hạ phân giải.

## 8. An toàn thị giác & triển khai
- **Nhạy sáng:** chuyển `pho → son` nội suy ≥ 1,2 s, không nhấp nháy toàn màn > 3 Hz; quầng sao đập ≤ 2 Hz, biên độ ≤ 15 % diện tích; dither tĩnh theo màn hình để tránh rung.
- **Mù màu:** ba trạng thái Hype khác nhau cả về **độ sáng và hình** (xoáy tròn ↔ dải ngang), không chỉ sắc độ; chip trạng thái luôn kèm ký hiệu (■ ★ ▲ ✕); lam–vàng an toàn cho đỏ–lục.
- **Dựng:** render vào `WebGLRenderTarget` thấp (NearestFilter) → pass lượng tử hoá bảng màu (LUT 31 màu + Bayer) → phóng nguyên lần; có thể bắt đầu từ `RenderPixelatedPass` của three.js (viền theo độ sâu/pháp tuyến). 8.000 khán giả vẫn là instanced billboard 2 draw call, nhưng ở 480×270 các hàng xa nhỏ hơn 1 px → gộp thành chấm khán đài (rẻ hơn hiện tại); cần **bám lưới texel** cho camera/billboard để hết rung khi camera trôi, hoặc giới hạn camera theo bước 1 texel.
- **Rủi ro:** rung pixel khi camera tự do; sprite 4 hướng tốn công vẽ; cảnh quá nhiều chi tiết sáng — giữ luật 60 % lam / 30 % vàng–tím / 10 % nhấn.

## 9. Nguồn & bản quyền
- Van Gogh mất **1890**, Munch mất **1944** → cả hai thuộc phạm vi công cộng (EU/Na Uy: Munch từ 1-1-2015; Mỹ: tác phẩm trước 1929). Chỉ **vẽ lại bằng pixel**, không dùng ảnh chụp của bảo tàng (ảnh chụp có thể có điều khoản riêng).
- https://hyperallergic.com/free-at-last-munch-mondrian-and-kandinsky-enter-the-public-domain · https://qz.com/320717/youre-about-to-see-a-lot-more-legal-versions-of-the-scream · https://www.munch.no/en/object/PE.M.00326
- https://threejs.org/docs/pages/RenderPixelatedPass.html · https://kyriota.github.io/2022/08/02/UnityPixelatedArtStyleInURP/ · https://medium.com/@elliotbentine/pixelizing-3d-objects-b55ec33328f1 · https://otaviopeixoto1.github.io/portfolio/3DPixelArt
- https://lospec.com/articles/pixel-art-outlines-part-2-using-color · https://pixelparmesan.com/anti-aliasing-fundamentals-for-pixel-artists · https://pixeljoint.com/forum/forum_posts.asp?TID=11299
