# 04 — Nghiên cứu hướng D "K-pop"

Mục đích: tìm xem **điều gì khiến một concert được nhận ra ngay là K-pop**, và phần nào làm được trong pipeline của game (three.js, hình học + shader thủ tục, texture vẽ bằng canvas, không asset ngoài).
**Có truy cập web:** có — 7 lượt tìm kiếm (11/2026). Phần stage/lightstick/fan project/thuật ngữ có nguồn; phần **trang phục, typography, merch, fancam nhiều góc máy dựa chủ yếu vào hiểu biết sẵn có** (kết quả tìm kiếm mỏng) — coi là nhận định, chưa kiểm chứng. Tên nhóm/công ty thật chỉ xuất hiện ở đây làm tham chiếu; **artwork và style sheet dùng danh tính hư cấu** (nghệ sĩ "VELLUNE", fandom "LUMI", lightstick "Tinh Quang").

## 1. Phát hiện chính

### 1.1 Lightstick chính thức và "đại dương ánh sáng"
- Mỗi nghệ sĩ có một cây lightstick chính thức hình dạng riêng; khán giả gần như ai cũng cầm → cả sân một màu thay vì đèn điện thoại lốm đốm.
- Fan **ghép que với số ghế** qua app chính thức trước show; trong show que nhận hiệu ứng từ **hệ điều khiển trung tâm**, đồng bộ với âm thanh và ánh sáng: đổi màu, bật/tắt theo chuỗi, tạo hoa văn trên khán đài (Korea Herald; hướng dẫn Weverse). Báo chí mô tả hệ thống điều khiển tích hợp nhiều loại que "sai số bằng không" (Asiae 2023). Que điều khiển từ xa xuất hiện từ khoảng 2016 (Borneo Bulletin).
- Chi tiết "Bluetooth" và "xếp thành chữ" chỉ có ở nguồn blog độ tin cậy thấp — tôi vẫn dùng ý tưởng *xếp chữ theo ghế* vì nó phù hợp cơ chế ghép ghế, nhưng ghi nhận là chưa có nguồn chính thống.

### 1.2 Sân khấu
- **Sân khấu nối dài** (đường băng đưa nghệ sĩ ra giữa khán giả), **sân khấu 360°**, **bục nâng** đưa nghệ sĩ từ dưới sàn lên cao, **sân khấu/xe di chuyển** chở nghệ sĩ đi vòng sân chào khán đài trên (Korea Herald, Inquirer, Tribune, Khan).
- **Tường LED và sàn LED** cong bao quanh người diễn, có màn LED gắn cơ cấu chuyển động (khoảng 2.000 tấm trong một show được báo chí nêu); VCR đồ hoạ chuyển động giữa các phần.
- Không tìm thấy nguồn cho "gondola bay" — vật thể "vòng sân khấu bay" trong preview là **sáng tạo của tôi** dựa trên bục treo/xích đu nâng (IU "swing lift").

### 1.3 Hiệu ứng và phần kết
- Drone show là điểm nhấn encore ở sân vận động: 300 đến 1.000 drone xếp logo, hành tinh, hình (Tribune; Korea JoongAng Daily; Korea Times). Pháo hoa trên sân + pháo giấy gần như mặc định ở đêm cuối (Korea Times).
- Laser, cột CO2, dây ruy băng bắn: phổ biến, dựa vào hiểu biết sẵn có.

### 1.4 Văn hoá fan
- **Slogan**: có loại chính thức và loại fan tự làm; fan phát miễn phí ngoài sân hoặc đặt sẵn trên ghế, kèm hướng dẫn **giơ lên đúng một đoạn/bài** để gây bất ngờ cho nghệ sĩ; nội dung thường được bình chọn trước (Soompi, Korea.net, Her Campus).
- **Fan chant (응원법)**: hô tên, câu đệm vào khoảng nghỉ của bài — gọi–đáp có kịch bản, học trước khi đi xem.
- Quy định kích thước vật cổ vũ (ngang ngực/vai) → slogan khổ nhỏ cầm tay, không phải băng rôn lớn.

### 1.5 Trình diễn và quay phim
- **"Killing part"**: khoảnh khắc ấn tượng nhất của bài/vũ đạo (không nhất thiết là điệp khúc), thường gắn với một động tác hay một fancam lan truyền (ticket.co.jp, KpopStarz).
- **"Ending fairy"**: cận cảnh một thành viên giữ dáng vài giây khi bài kết (allkpop, IBTimes).
- Đội hình đổi liên tục, đồng bộ từng phách; fancam dọc từng người; nhiều góc máy — dựa vào hiểu biết sẵn có.

### 1.6 Concept, trang phục, đồ hoạ
- Concept theo từng album: girl-crush/boy-crush tối (đen, crôm, đỏ), tươi sáng "refreshing" (trắng, xanh nước, pastel), Y2K retro (collage, denim, VHS), mộng mơ/ethereal (trắng, ánh ngọc trai, kim loại lỏng — ArtAsiaPacific, Vogue PH, Tatler), hip-hop.
- Trang phục phối bộ: mỗi người một biến thể trong cùng bảng màu — cropped jacket, harness, sequin, PVC, bốt cao; tóc nhuộm là một phần concept (hiểu biết sẵn có).
- Logo chữ + biểu tượng đơn giản, màu fandom chính thức, photocard, lower-third kiểu truyền hình (hiểu biết sẵn có).

## 2. 15 quy ước khiến show "đọc ra" là K-pop

| # | Quy ước | Khả thi trong pipeline |
|---|---|---|
| 1 | Cả sân **một màu lightstick**, không lốm đốm | Dễ — đã có 8.000 instance + màu theo Hype |
| 2 | Lightstick **đồng bộ theo phách**, sóng chạy qua khán đài | Dễ — hàm (ghế, thời gian) trong shader |
| 3 | Khán đài **xếp hoa văn/chữ theo ghế** | Vừa — mask chữ vẽ canvas → texture tra theo toạ độ ghế |
| 4 | Lightstick chính thức hình dạng riêng (vòm trong + lõi) | Dễ — mesh nhỏ instanced, vòm fresnel |
| 5 | Sân khấu nối dài chữ T/Y + bục nâng | Vừa — đã có runway và B-stage, thêm bục nâng |
| 6 | Cổng/tường LED + **sàn LED** đồ hoạ chuyển động | Vừa — shader thủ tục; sàn LED là điểm mới |
| 7 | Màn dọc phát **cận cảnh** kèm lower-third | Vừa — render-to-texture camera phụ (tốn GPU) |
| 8 | Vũ công/nhóm **đội hình hình học**, đồng bộ tuyệt đối | Khó — rig người thật + thư viện tư thế |
| 9 | Dừng "điểm nhấn" và giữ dáng kết bài | Dễ khi đã có rig — hold tư thế + cắt camera |
| 10 | Trang phục phối bộ, chất liệu bóng/sequin, tóc nhuộm | Vừa — shader 3 bậc + specular, sequin nhấp nháy |
| 11 | **Slogan giơ đồng loạt** một bài + fan chant | Dễ — quad instanced bật theo sự kiện; chant = âm thanh sẵn có |
| 12 | Laser quạt + CO2 + pháo giấy + ruy băng | Dễ/Vừa — line additive, hạt instanced |
| 13 | **Drone show** xếp logo/tim | Dễ — points instanced nội suy giữa các hình |
| 14 | Pháo hoa kết + xe/bục di chuyển chào khán đài | Vừa — đã có pháo hoa; bục bay là mesh mới |
| 15 | Giao diện kiểu fan-app/photocard/truyền hình | Dễ — CSS |

Không khả thi/không làm: gương mặt và vũ đạo giống người thật, nhạc/chant của nhóm thật, logo và thiết kế que thật (lý do pháp lý và phạm vi).

## 3. Hệ quả cho thiết kế
- Điểm khác biệt lớn nhất so với A/B/C và chibi **không nằm ở màu mà ở hành vi**: ánh sáng do khán giả tạo ra, được điều khiển tập trung và đồng bộ → thay cực quang bằng *biển lightstick xếp chữ + tán laser*.
- Rủi ro lớn nhất: **người tỉ lệ thật có mặt đẹp** (mục 8, 10) — cần atlas mặt vẽ canvas và rig có khuỷu/gối; đây là hạng mục L duy nhất.
- Ca sĩ giữ là **solo + 4 vũ công**: game chỉ có một giọng người chơi; nhóm idol đòi nhiều giọng và nhiều "gương mặt" riêng.

## 4. Nguồn
- Korea Herald — hệ thống đồng bộ lightstick: https://www.koreaherald.com/article/10385887
- Asiae — hệ điều khiển lightstick tích hợp: https://www.asiae.co.kr/en/article/2023080618555334824
- Borneo Bulletin — lịch sử lightstick: https://borneobulletin.com.bn/how-k-pop-light-sticks-revolutionised-fan-culture-and-concerts
- Weverse — hướng dẫn ghép que với ghế: https://weverse.io/seventeen/notice/21046 · https://weverse.io/txt/notice/19211
- Korea Herald — sân khấu 360° ở sân vận động: https://www.koreaherald.com/article/10715254
- Inquirer — sân khấu tour 2026: https://entertainment.inquirer.net/663440/bts-arirang-experiment-takes-shape-onstage
- Khan — sân khấu xoay, hạ ghế nghệ sĩ: https://sports.khan.co.kr/en/article/202610210857017
- Tribune — sân khấu di chuyển, drone, pháo hoa: https://tribune.com.pk/story/2603609/bts-arirang-world-tour-opens-in-goyang-with-large-scale-production?amp=1
- Korea JoongAng Daily — drone + pháo hoa: https://www.koreajoongangdaily.com/entertainment/drones-tweety-bird-and-fireworks-iu-celebrates-100th-concert-with-a-bang/12196682
- Korea Times — pháo hoa sân vận động; pháo giấy đêm cuối: https://www.koreatimes.co.kr/entertainment/20250707/blackpink-sets-goyang-ablaze-with-historic-stadium-tour-kickoff-debuts-new-track-jump · https://www.koreatimes.co.kr/amp/entertainment/k-pop/20241202/review-nct-dream-closes-world-tour-with-spectacular-seoul-finale
- Soompi — slogan và những điều cần biết: https://www.soompi.com/article/1362790wpp/your-first-k-pop-concert-10-things-you-need-to-know-before-you-go
- Korea.net — fan event/banner: https://www.korea.net/NewsFocus/HonoraryReporters/view?articleId=213447
- Her Campus — slogan đặt sẵn trên ghế: https://www.hercampus.com/culture/what-expect-kpop-concert-first-time/
- allkpop / IBTimes — "ending fairy": https://www.allkpop.com/article/2020/04/the-analysis-of-ending-fairy · https://www.ibtimes.com/ending-fairy-meaning-who-started-it-bts-exos-xiumin-3715481
- ticket.co.jp / KpopStarz — "killing part": https://www.ticket.co.jp/entx/knowhow/about-the-killing-part/ · https://www.kpopstarz.com/articles/309462/20221006/4-most-iconic-killing-parts-kpop-songs.htm
- The Mary Sue — các concept: https://www.themarysue.com/explaining-kpop-concepts/
- ArtAsiaPacific / Tatler / Vogue PH — thẩm mỹ ánh ngọc trai, Y3K, ethereal: https://artasiapacific.com/ideas/myth-making-in-aespa-s-girls · https://www.tatlerasia.com/style/fashion/y3k-style-analysis-aespa · https://vogue.ph/fashion/celebrity-fashion/aespa-my-world-teaser/
