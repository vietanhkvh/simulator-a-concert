# 03a — Phản hồi của Designer A (hình khối) cho đề xuất màu `02-color-and-light.md`

Tổng quan: tôi đồng ý với hệ "Kẹo đêm", thang 4 bậc, bảng Hype 3 trạng thái và việc gom token vào một nguồn. Dưới đây là câu trả lời, các điểm lệch và đề nghị chốt.

## 1. Trả lời 5 câu hỏi của Designer B

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Viền nét | **Có viền.** Màu `night-700` như B đề nghị, nhưng độ dày **2,5% chiều cao nhân vật** (không phải 4–6%), kẹp trong khoảng 1,5–3 px trên màn hình và tắt hẳn khi vật thể nhỏ hơn 24 px. Vì có viền, rim light giữ ở 0,35 |
| 2 | Tỉ lệ đầu–thân | **2,3 đầu** cho ca sĩ, ban nhạc, quay phim (H = 1,5 m: đầu cao 0,63 m). Khán giả billboard **2,1 đầu** (bán kính đầu 0,24 chiều cao). Diện tích nhìn từ trước: tóc ≈ 30%, da ≈ 22%, áo ≈ 33%, quần/chân ≈ 15% → `HAIR` là mảng màu lớn thứ hai, cần cân như một màu thân |
| 3 | LOD khán giả xa | **Đồng ý bỏ màu áo** từ 35 m (±3 m trộn). LOD xa gồm: đầu tròn màu tóc, thân đậu một màu `night-100` nhuộm 30% màu lightstick, que sáng. Bỏ da, mặt, viền |
| 4 | Dấu hiệu chung của sự kiện bí mật | **Có, bằng hình khối:** (a) một vành sáng tròn mảnh quanh vật thể, đường kính 1,35 × kích thước lớn nhất, dày 2% đường kính, luôn quay mặt về camera, nhịp phồng 1,6 s; (b) 4–6 ngôi sao tròn đầu quay quanh vành; (c) xuất hiện bằng "pop" 0 → 1,15 → 1,0 trong 0,25 s. Vành dùng `SECRET_RIM`, sao dùng `SECRET_CORE` |
| 5 | Kiểu giàn | **Ống tròn mập:** đường kính thanh chính 0,45 m (hiện ~0,3 m hộp), thanh chéo 0,22 m, số thanh giảm 50%, khớp nối là cầu 0,6 m. Đồng ý sọc `grape-500` quấn quanh: bề rộng sọc = 1 đường kính ống, bước 4 đường kính, chỉ trên thanh chính |

## 2. Điểm không đồng ý hoặc mâu thuẫn, kèm phương án

| Điểm trong `02` | Vấn đề với phần hình khối | Phương án thỏa hiệp |
|---|---|---|
| Viền 4–6% chiều cao | Ở tỉ lệ 2,3 đầu, viền 6% (9 cm) nuốt mất tay (đường kính 15 cm) và mắt | 2,5% như trên; riêng secret object ở xa được 3,5% vì cần đọc từ 100 m |
| Tối đa 3 token mỗi vật thể | Nhân vật cần tối thiểu da, tóc, áo, nhấn = 4; rồng và UFO có nhiều bộ phận | Giới hạn 3 token áp dụng cho **đồ vật và kiến trúc**. Nhân vật: 3 token trang phục + `SKIN` + `HAIR` (không tính vào giới hạn). Secret: 3 token + `SECRET_CORE` + `SECRET_RIM` |
| Lõi `cream-100` chỉ dành cho secret | Mắt nhân vật (đốm sáng) và highlight đồ chơi cũng là `cream-100` | Cấm áp dụng cho `cream-100` **phát sáng (emissive > 1,0)**; đốm mắt và highlight không phát sáng thì được dùng |
| Rim `cream-300` đổi sang màu đèn khi Hype > 80% | Trùng vai với highlight đồ chơi; hai lớp sáng cùng lúc làm mất dáng tròn | Rim đổi theo đèn như B viết; highlight giữ `cream-100` cố định, giảm độ trong còn 30% khi Hype > 80% |
| Emissive viền nhân vật 0,6 | Viền `night-700` là viền tối, không phát sáng; con số này dễ bị hiểu là viền nét | Đổi tên thành "emissive của chi tiết trang trí (trim)" = 0,6; viền nét emissive 0 |
| Tô 2 bậc ngưỡng mềm 8–12% | Trên khối cầu to (đầu) dải chuyển quá hẹp sẽ ra vệt cứng như cel-shading gắt | Ngưỡng mềm 12–18% cho đầu và thân; 8–12% cho đạo cụ |
| Áo khán giả `night-100`, `grape-700`, `soda-700`… | Toàn bậc 700 trên nền `night`: với đầu to, phần áo còn nhỏ nên khối người chìm, viền `night-700` không tách được | Áo dùng bậc **500/300** cho 60% khán giả (hàng gần), bậc 700 cho 40%; hoặc giữ 700 nhưng thêm viền sáng SDF 1 px `night-100` |
| Khinh khí cầu 3 kiểu sọc lặp lại | Khi dời ra sau khán đài xa nhất và phóng to 1,6–2×, 6 quả giống nhau từng cặp sẽ lộ | Thêm kiểu thứ tư `mint-500`/`cream-500`; phân biệt thêm bằng hình: 2 quả tròn, 2 quả hình tim mập, 2 quả hình sao bo tròn |
| Font `Baloo 2` + `Nunito` tự host | Không mâu thuẫn hình khối, nhưng tăng dung lượng tải đầu (~150–250 KB cho 2 font đủ dấu tiếng Việt) so với mục tiêu "web gọn nhẹ" | Chỉ host `Baloo 2` (700) cho tiêu đề và số; nội dung dùng `system-ui`. Băng rôn và biểu tượng chữ trên canvas dùng cùng `Baloo 2` để thống nhất |
| File token `src/world/palette.ts` | Tôi đã đề xuất `src/render/style/chibi.ts`; mã đang tái cấu trúc thành `src/zones/{outside,stands,arena}` + `src/world` | Rút đề xuất `src/render/style/`. Dùng chung thư mục `src/world/`: `palette.ts` (màu, của B) và `chibi.ts` (tỉ lệ, bo, viền, squash, của A), cùng re-export qua `src/world/style.ts`. Ba zone chỉ import từ `src/world/style` |
| "Không `vec3` màu cứng trong `.glsl`" | Shader khán giả SDF cần 4 da + 6 tóc + 5 áo; truyền từng uniform rời thì rườm | Truyền 3 mảng uniform (`uSkin[4]`, `uHair[6]`, `uCloth[5]`) nạp từ `palette.ts` |
| Sương `night-300` | Đồng ý; lưu ý viền nét phải mờ theo sương, nếu không vật ở xa có viền đen nổi trên nền tím | Màu viền = `mix(night-700, màu sương, hệ số sương)` |

## 3. Đề nghị chốt chung

1. **Tỉ lệ nhân vật:** 2,3 đầu (mesh), 2,1 đầu (billboard); mặt vẽ bằng texture, mắt `night-700` có đốm `cream-100`, má `berry-300` 35%.
2. **Viền:** `night-700`, 2,5% chiều cao (secret 3,5%), 1,5–3 px, tắt dưới 24 px, mờ theo sương. Kỹ thuật: inverted hull cho mesh ít, fresnel cho instanced, SDF cho khán giả.
3. **Tô bóng đồ chơi:** 2 bậc (500 + 700 dịch tím), ngưỡng mềm 12–18% cho nhân vật và 8–12% cho đạo cụ, rim 0,35, một highlight `cream-100` ≤ 8% diện tích.
4. **Giới hạn màu:** đồ vật/kiến trúc 3 token; nhân vật 3 token + `SKIN` + `HAIR`; secret 3 token + `SECRET_CORE` + `SECRET_RIM`.
5. **Chữ ký secret:** vành sáng 1,35× + sao quay + pop 0,25 s; chỉ secret được dùng `cream-100` emissive > 1,0.
6. **Kiến trúc:** ống tròn 0,45 m, khớp cầu, thân `night-300`, sọc `grape-500`; bán kính bo tối thiểu 12% cạnh ngắn nhất cho mọi khối.
7. **LOD theo khu:** khu 3 đủ chi tiết; từ 35 m bỏ áo, da, mặt, viền; khu 2 chỉ là chấm; khu 1 phóng đại hình và bão hoà giảm theo sương.
8. **Một nguồn hằng số:** `src/world/palette.ts` + `src/world/chibi.ts`, re-export qua `src/world/style.ts`; `toCss()` cấp biến cho HTML; không hex viết cứng ngoài hai file này và khối `:root`.
