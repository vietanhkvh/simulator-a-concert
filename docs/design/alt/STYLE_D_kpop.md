# STYLE D — "NGỌC TRAI & SAN HÔ" (K-pop)

Ảnh xem trước: `preview-D-kpop.png` (cùng bố cục với `../style-preview.png`). Nghiên cứu: `04-kpop-research.md`. Danh tính trong ảnh là **hư cấu**: nghệ sĩ "VELLUNE", fandom "LUMI", lightstick "Tinh Quang" — không mô phỏng nhóm, logo hay que cổ vũ thật nào.

## 1. Tóm tắt
- Show pop thần tượng **bóng bẩy, thời trang, đồng bộ từng phách**; đối lập chibi: người tỉ lệ thật, không viền, không khối mập.
- Concept chính: **tươi sáng ánh holo** — ngọc trai + aqua trên nền đêm nhung, san hô nóng làm điểm nhấn. Concept phụ tuỳ chọn **"Crôm đen"** (girl/boy-crush): đổi `pearl` → đen bóng `#0A0A0F`, aqua → crôm, giữ san hô; chỉ đổi token, không đổi hình.
- Ánh sáng do **khán giả** tạo ra: biển lightstick một màu, điều khiển tập trung, vẽ sóng và chữ trên khán đài.
- Khác A (bóng đen viền neon), B (mực + sơn mài), C (thép đẽo + lửa): D là **bề mặt sáng, nhẵn, phản chiếu**, có gương mặt.

## 2. Bảng màu (700 bóng · 500 thân · 300 sáng · 100 highlight)
| Token | Vai trò | 700 | 500 | 300 | 100 |
|---|---|---|---|---|---|
| `midnight` Đêm nhung | nền, trời, kiến trúc | `#050A18` | `#0B1430` | `#1B2A55` | `#37508A` |
| `pearl` Ngọc trai | trang phục ca sĩ, chữ, sàn sáng | `#B9C4D6` | `#EEF3FA` | `#F7FAFE` | `#FFFFFF` |
| `aqua` Aqua ngọc | **màu fandom chính thức**, lightstick, "tốt" | `#0F8FA3` | `#3FD9E6` | `#8FEDF3` | `#D6FAFC` |
| `coral` San hô nóng | **chủ đạo nóng**, nút chính, chữ trên khán đài | `#B8243F` | `#FF4F6D` | `#FF8FA0` | `#FFD6DC` |
| `lilac` Tử đinh hương | laser, holo, trạng thái giữa | `#5B4BC4` | `#9D8CFF` | `#C5BAFF` | `#E9E4FF` |
| `chrome` Crôm | giàn, kim loại, chữ phụ | `#3C4558` | `#8B96AB` | `#C4CCDA` | `#EEF1F6` |
| `lemon` Chanh ánh kim | nốt đúng, pháo giấy, lõi secret | `#B89A10` | `#FFE14A` | `#FFEE94` | `#FFF9D6` |

- **Holo:** gradient 115° `aqua-300 → lilac-300 → coral-300 → lemon-300 → aqua-300`, dịch pha theo `dot(N, V)` + thời gian (0,1 vòng/s) + 1 vệt trắng hẹp; chỉ dùng cho viền, gấu váy, khối LED, lightstick.
- **Da** (5): `#F7D3BE #EBC0A4 #D9A27E #B97F5E #8A5A3C`; bóng dịch về san hô, highlight `#FFF3EA`. **Tóc:** tự nhiên `#1C1830 #6B4226 #F3E6C4` (60 %), nhuộm `#C5BAFF #FF8FA0 #8FEDF3` (40 %); ca sĩ tóc ombré lilac → aqua; luôn có 1 "vòng thiên thần" trắng.
- **Áo khán giả:** `midnight-300`, `pearl`, 15 % áo merch `coral`; băng đô tia ✦ màu aqua.

Tương phản WCAG (đã tính): `pearl-500`/`midnight-500` **16,3** · `chrome-300` (chữ mờ) **11,2** · `chrome-500` **6,1** · nút chính chữ `midnight-700`/`coral-500` **6,2** · nút phụ `pearl`/`midnight-300` **12,5** · chip `aqua-500` **11,6** · chip `lemon-500` **15,2** · chip `lilac-300` **11,1** · chip lỗi trắng/`coral-700` **6,2**. Cấm: chữ trắng trên `coral-500` (3,2); `aqua` cạnh `coral` không có khe tối (1,9).

## 3. Ba trạng thái Hype
| Trạng thái | primary | secondary | accent | Ánh sáng |
|---|---|---|---|---|
| 0–40 % **Chờ diễn** | `aqua-700` `#0F8FA3` | `midnight-100` `#37508A` | `chrome-300` `#C4CCDA` | 20 % đèn; que sáng 40 %, mỗi người một nhịp thở |
| 40–80 % **Đồng bộ** | `aqua-500` `#3FD9E6` | `lilac-500` `#9D8CFF` | `pearl-500` `#EEF3FA` | 60 % đèn; que khoá phách, sóng chạy quanh sân |
| 80–100 % **Encore** | `coral-500` `#FF4F6D` | `lemon-500` `#FFE14A` | `pearl-100` `#FFFFFF` | 100 % đèn; chữ trên khán đài, pháo giấy, ruy băng |

**Thay cực quang (≥ 40 %):** (1) **biển lightstick theo ghế** — texture mask canvas (chữ "LUMI", tim, ✦, sóng chéo) tra theo toạ độ ghế, hiện dần bằng `auroraAmount(h)`; (2) **tán laser** 17 tia quạt từ đỉnh mái, 3 màu aqua/lilac/coral, quét ≤ 0,5 Hz; (3) ≥ 80 % thêm drone và mưa pháo giấy thay sao băng. Trời chỉ còn sao thưa, không ngân hà.

## 4. Quy tắc hình khối
- **Tỉ lệ:** ca sĩ 7,5–8 đầu (H 1,72 m), vũ công 7,5, khán giả billboard 7; chân 0,52 H, vai 0,27 H, eo 0,6 × vai; chi 2 đoạn thon dần, có khuỷu và gối.
- **Mặt:** đầu ovan cằm nhọn nhẹ, **atlas canvas 6 biểu cảm × 3 khẩu hình**: mắt hạnh + đường mi đậm có đuôi, mống mắt 1 đốm sáng, mũi 1 nét bóng, môi gradient san hô, má 12 %. Vũ công và khán giả dùng bản rút gọn (2 nét mi + môi). Không vẽ mũi/miệng bằng hình học.
- **Không viền.** Tô **3 bậc** (bóng / thân / sáng) + **1 vệt specular** trắng dọc mỗi chi (rộng 13 % bề ngang) + rim `aqua-300` 0,5 từ phía sau.
- **Chất liệu:** satin ngọc trai (specular rộng), PVC/da bóng (specular hẹp, sắc), crôm (matcap 4 dải), **sequin** = nhiễu ô 64 × 64, 6 % ô sáng `pearl-100`, đổi ô mỗi phách.
- **Cạnh:** bo 6–10 %; kiến trúc mảnh, mọi cạnh sân khấu là dải LED; vòm lightstick trong suốt fresnel.
- **Emissive:** kiến trúc 0,05 · LED 1,0 · lightstick 1,2 · laser 1,4 · lõi secret 2,0. **Motif:** tia ✦ 4 cánh, vành quỹ đạo nghiêng 22°, ruy băng holo.
- **Chuyển động:** đếm 8 phách; đội hình (V, hàng chéo, kim cương) đổi mỗi 8 phách bằng trượt 0,4 s; **"điểm nhấn"** = đứng hình 0,3 s ở phách mạnh điệp khúc + camera đẩy 4 %; **kết bài** = ca sĩ giữ dáng 3 s, màn dọc phát cận cảnh. Xuất hiện bằng "bật sáng quét" 0,2 s, không pop co giãn.

## 5. Thay đổi theo nhóm vật thể (so với chibi)
| Nhóm | Ngọc trai & San hô | Công |
|---|---|---|
| Ca sĩ | **solo**, rig 7,5–8 đầu, cropped jacket ngọc trai + áo san hô + váy xếp ly gấu holo + bốt cao; mic cầm tay đính đá; atlas mặt | L |
| Ban nhạc | → **4 vũ công** techwear `midnight` viền aqua, đội hình chữ V; ban nhạc thu gọn thành bục DJ/keyboard sau cổng LED | L |
| Khán giả | lightstick "Tinh Quang" (vòm trong, lõi ✦, vành quỹ đạo san hô), băng đô ✦, **slogan giơ đồng loạt** khi "đưa mic"; hô theo kịch bản | M |
| Sân khấu | cổng LED bo tròn nhiều lớp, 2 khối LED treo, **2 màn dọc** (VCR / cận cảnh + lower-third), sàn LED gợn sóng, đường băng chữ T, **bục nâng** thay B-stage, 4 cột CO2 | M + M |
| Khán đài | chấm sáng → **ma trận ghế** vẽ sóng/chữ; mái viền LED | M |
| Trời | đêm nhung, sao thưa, tán laser | S |
| Băng rôn cổ vũ | slogan cầm tay khổ nhỏ; khinh khí cầu → **khí cầu LED chạy chữ** | S |
| `plane` | gộp vào khí cầu LED (thông điệp fan chạy chữ) | M (chung gói secret) |
| `jet` | **drone show 600 điểm** vẽ tim → logo ✦ | |
| `rocket` | **pháo hoa bế mạc** nổ hình ✦ + vòng tròn, kèm đại bác pháo giấy và ruy băng | |
| `dragon` | **đôi rồng ruy băng**: 2 dải drone + ruy băng holo xoắn nhau (aqua, san hô) | |
| `ufo` | **vòng sân khấu bay**: gondola vành LED treo cáp, lướt trên khán giả | |
| Chữ ký secret | vành quỹ đạo nghiêng quay 1 vòng/2 s + 4 tia ✦ `lemon` | S |
| UI | thẻ bo 10–18 px, viền holo 1,5 px, nền `midnight` 82 %; nút viên thuốc; lower-third có vạch màu trái; Hype dạng photocard; font `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` 700–900, số `ui-monospace` | S |

**Solo hay nhóm?** Khuyến nghị **solo + 4 vũ công**: người chơi chỉ có một giọng, một cao độ; nhóm idol cần chia câu hát và nhiều gương mặt riêng (gấp 4–5 lần công rig + atlas) mà không thêm gameplay. Vũ công cho đủ tín hiệu "đội hình đồng bộ". Mở rộng sau: vũ công hát bè ở điệp khúc.

Công theo khu (ước lượng): ngoài sân **M** (5 secret mới, nhưng phần lớn là hạt/điểm instanced) · khán đài **M** · sân trong **L** · UI **S**; tổng ~3 L, 5 M. So với: A = L / S / L / M · B = M–L / M / L+ / M (theo bảng công trong hai tài liệu đó) · C ≈ 4 L, 4 M. D nhẹ hơn ở ngoài sân và UI, nặng hơn ở khán đài (ma trận ghế), ngang C ở sân trong (rig người thật) cộng thêm atlas mặt.

## 6. Rủi ro
- **Mặt người tỉ lệ thật dễ "kỳ dị":** giữ mặt phẳng hoá kiểu minh hoạ thời trang, không shading mặt theo đèn; camera gần nhất ≥ 2,5 m; billboard khán giả không có mặt chi tiết.
- **Nhạy sáng:** lightstick khoá phách nhưng đổi màu bằng fade ≥ 120 ms, ≤ 3 chớp/s; chớp toàn sân ≤ 0,6 trong ≤ 0,4 s; laser không quét qua camera; có công tắc "giảm chớp" (sóng thay cho nháy).
- **Mù màu:** cặp aqua/san hô khác cả độ sáng (L 80 % so với 62 %) nên vẫn tách được với đỏ–lục; đúng/sai luôn kèm icon ✓ ✦ ♪ ✕; chữ trên khán đài sáng hơn nền ≥ 3 : 1 về độ chói, không chỉ khác hue.
- **Hiệu năng:** màn cận cảnh render-to-texture = thêm 1 lượt vẽ → 256 × 512, 15 fps, tắt ở máy yếu (thay bằng atlas mặt); mask ghế là 1 texture 256 × 64; drone/pháo giấy ≤ 1.500 hạt instanced; holo và sequin thuần shader, không thêm draw call.
- **Lời bài hát trên nền sáng:** cửa sổ lời nền `rgba(5,10,24,.82)`, chữ luôn `pearl-500`.
- **Pháp lý/nhận diện:** không dùng hình dạng que, màu chính thức, logo, vũ đạo của nhóm thật; kiểm tra tên hư cấu trước khi phát hành.

## 7. Điểm còn mở
1. Màu fandom `aqua` gần `soda`/`mint` của chibi về hue — khác biệt đến từ nền xanh mực, bề mặt trắng bóng và san hô; nếu vẫn thấy gần, đổi fandom sang `lilac`.
2. "Vòng sân khấu bay" không có nguồn thực tế trực tiếp (xem research) — có thể thay bằng xe diễu hành quanh sân.
3. Có cần giọng bè của vũ công hay không là quyết định gameplay, ngoài phạm vi style.
