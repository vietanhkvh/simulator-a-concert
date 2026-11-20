# STYLE C — "THÉP & LỬA" (rock / metal arena)

Ảnh xem trước: `preview-C-thep-lua.png` (cùng bố cục với `../style-preview.png`). Nguồn: `01-form-directions.md` (cột C) + `02-color-directions.md` (2.A "Đêm Bạc", mở rộng họ lửa).

## 1. Tóm tắt
- Mọi vật là **khối đẽo phẳng mặt** (low-poly, `flatShading`), nặng, thật, có lửa; đối lập chibi: không bo, không viền, tỉ lệ người thật.
- Loại show: **rock/metal arena** — giàn thép như nhà thờ, tường loa, ống phun lửa, thác pyro, khói thấp.
- Màu: nền noir than–thép, hai nguồn sáng trắng (hồ quang lạnh, tungsten ấm), phần thưởng là **họ lửa** đỏ huyết → cam → trắng nung.
- Ánh sáng kể chuyện: key lạnh từ trái-trên, rim lửa từ phải/sau; **trên lạnh – dưới ấm** cho mọi vật trên trời.
- Chuyển động có trọng lượng: head-bang, nắm đấm, tay sừng, sóng mosh; xuất hiện bằng "sập đèn → bật".

## 2. Bảng màu (700 bóng · 500 thân · 300 sáng · 100 highlight)
| Token | Vai trò | 700 | 500 | 300 | 100 |
|---|---|---|---|---|---|
| `coal` Than | nền, trời, sàn | `#050506` | `#0E0F12` | `#1E2026` | `#3A3D47` |
| `steel` Thép | giàn, kim loại, chữ phụ | `#2C3038` | `#5B6270` | `#8E96A6` | `#C3C9D4` |
| `arc` Hồ quang | beam, key lạnh, "tốt" | `#7FA0C8` | `#CFE4FF` | `#E4F0FF` | `#F5FAFF` |
| `tungsten` | đèn mặt, đèn khán đài, nhấn ấm | `#B88A4A` | `#FFD9A0` | `#FFE8C4` | `#FFF6E6` |
| `blood` Huyết | LED, áo merch, vỏ lửa ngoài; 100 = đỏ tín hiệu | `#3D070D` | `#8A0F1C` | `#C21A26` | `#E8222E` |
| `ember` Than hồng | rìa lửa, bụng mây, mặt dưới vật thể | `#5C1E06` | `#C2410C` | `#E8622A` | `#FF9466` |
| `flame` Lửa | **chủ đạo nóng**, rim, nút chính | `#9A4A08` | `#FF7A1A` | `#FFA047` | `#FFC98A` |
| `whitehot` Trắng nung | lõi lửa, tia sét, lõi secret | `#C48A12` | `#FFD23F` | `#FFE98A` | `#FFF8D6` |
| `paper` Giấy | chữ, lõi sáng | `#A8A8A4` | `#F2F0EA` | `#FAF9F5` | `#FFFFFF` |

Da/tóc: da tự nhiên giảm bão hoà (`#E2C4A8 #BC9274 #7A5238`); tóc đen, nâu, bạc `#C9C3B8`, đỏ huyết — không tóc kẹo. Áo: `coal-300`, `steel-500`, denim thép, 15% áo merch `blood`.

Tương phản WCAG (đã tính): `paper-500` trên `coal-500` **16,8** · `steel-100` trên coal **11,5** · `steel-300` (chữ mờ) **6,5** · nút chính chữ `coal-700` trên `flame-500` **7,8** · nút phụ `paper` trên `coal-300` **14,3** · chip lỗi chữ trắng trên `blood-500` **9,7** · chip `whitehot-500`/`arc-500` chữ coal **14,1 / 14,8**. Cấm: chữ `blood-100` trên coal cỡ nhỏ (4,3 — chỉ dùng ≥ 18 px đậm), chữ trên `ember-500` (4,5), cam cạnh đỏ không có viền sáng (1,7).

## 3. Ba trạng thái Hype
| Trạng thái | primary | secondary | accent | Đèn |
|---|---|---|---|---|
| 0–40 % **Thép nguội** | `arc-700` `#7FA0C8` | `steel-300` `#8E96A6` | `arc-500` `#CFE4FF` | 15 %, beam trắng lạnh, không lửa |
| 40–80 % **Tungsten** | `tungsten-500` `#FFD9A0` | `flame-500` `#FF7A1A` | `arc-500` `#CFE4FF` | 55 %, blinder ấm, ống lửa bắn theo phách mạnh |
| 80–100 % **Lửa lớn** | `flame-500` `#FF7A1A` | `blood-100` `#E8222E` | `whitehot-300` `#FFE98A` | 100 %, thác pyro, LED đỏ, lõi trắng nung |

**Thay cực quang (≥ 40 %):** 8 đèn rọi `arc` từ vành sân quét chéo lên **trần mây khói thấp**; bụng mây hắt `ember-700 → ember-500` theo nhịp ống lửa; ≥ 80 % mây ửng `blood-500` và **tàn lửa bay lên** thay sao băng. Dùng lại `auroraAmount(h)` làm `skyFxAmount`. Trăng nhỏ, lạnh, sắc cạnh.

## 4. Quy tắc hình khối
- **Tỉ lệ:** ca sĩ/ban nhạc 7,5 đầu (H 1,80 m, vai 0,29 H), khán giả billboard 6,5 đầu; bốt to 0,16 H; tay chân 2 đoạn (có khuỷu, gối).
- **Mặt:** 3 mặt phẳng (trán, 2 má) + dải bóng hốc mắt + nêm mũi; **không vẽ mắt**; miệng là 1 tứ giác tối khi hát; tóc là khối đẽo 5–9 mặt.
- **Cạnh:** bo = 0, vát 2–4 % bắt highlight; mỗi mặt một sắc độ (chênh L ≥ 6 %) để đọc được mặt phẳng; chi tiết nhỏ nhất ≥ 4 % chiều lớn.
- **Không viền:** tách khối bằng rim `flame-500` cường độ 0,6 + sương khói; tô Lambert phẳng 1 bậc/mặt, bóng dịch lạnh, sáng dịch ấm.
- **Chất liệu:** thép xước (highlight hẹp), đen lì, da (highlight rộng mờ), chrome đinh tán; tấm ghép lộ đường nối + đinh tán.
- **Emissive:** kiến trúc 0,05 · đèn 1,0 · lửa 1,6 · lõi secret 2,0. **Motif:** tia sét, sao đinh tán 5 cánh nhọn, ngọn lửa.
- **Chuyển động:** gật đầu 4–6°, giậm chân; đỉnh 60 ms, hồi 240 ms; rung camera ≤ 0,3° khi pyro; sóng mosh lan theo hàng.

## 5. Thay đổi theo nhóm vật thể (so với chibi)
| Nhóm | Thép & Lửa | Công |
|---|---|---|
| Ca sĩ | rig cao 7,5 đầu, áo da, tóc khối, chân mic nghiêng, thế đứng rộng | L |
| Ban nhạc | guitar chữ V dài +30 %, bộ trống đủ trên bục 1,2 m, chồng ampli | L |
| Khán giả | bóng đa giác, nắm đấm / tay sừng; 30 % đèn điện thoại, bật lửa thay lightstick kẹo; áo 3 sắc tối | M |
| Sân khấu | giàn hộp thép chữ X mái đầu hồi, tường loa 2 × 9, line-array, 8 ống lửa, thác pyro, catwalk lưới thép, B-stage sọc cảnh báo | M + M |
| Khán đài | dầm thép lộ, cột đèn hộp 4 × 6 bóng, đốm sáng tungsten/arc | S |
| Trời | gần đen, mây khói, đèn rọi, trăng nhỏ, tàn lửa | S |
| Băng rôn cổ vũ | cờ tour vải rách mép, chữ stencil, treo trên giàn; khinh khí cầu → **blimp** tấm ghép | S |
| `ufo` | **cầu gương 12 m** treo cần cẩu, 64 tia quét | L (chung gói secret) |
| `rocket` | tên lửa thép tấm ghép 4 : 1, khói khối, pháo **thác lửa + sao nhọn** | |
| `dragon` | **rồng cơ khí** đốt thép bản lề, khe lò đỏ, phun lửa 3 lớp | |
| `jet` | phản lực đẽo mặt, khói vẽ **tia sét** (thay trái tim), bay thấp | |
| `plane` | **2 trực thăng** căng banner vải giữa hai máy | |
| Chữ ký secret | vòng tia lửa + 6 tàn lửa quay | S |
| UI | tấm thép góc vát, đinh tán, sọc cảnh báo; chữ condensed IN HOA `'Arial Narrow','Roboto Condensed','Helvetica Neue',system-ui` 800–900, giãn 0,06em; chip hình bình hành có icon; nút lún 2 px; số `ui-monospace` | M |

Tổng: ~4 L, 4 M; hình học mới: rig cao, ống lửa, cầu gương, trực thăng, rồng cơ khí.

## 6. Rủi ro
- **Lời bài hát trên nền lửa:** cửa sổ lời nền `rgba(14,15,18,.82)`, additive vùng lời ≤ 0,25; chữ lời luôn `paper-500`, không dùng cam/đỏ.
- **Nhạy sáng:** blinder/pyro ≤ 3 chớp/s, toàn màn ≤ 0,6 trong ≤ 0,4 s; có công tắc "giảm chớp".
- **Mù màu đỏ/cam:** không mã hoá nghĩa bằng cặp `blood`/`flame`; trạng thái luôn kèm icon + hình chip; đúng/sai dùng `arc` (lạnh) đối `blood` (tối) — khác cả độ sáng.
- **Hiệu năng hạt lửa:** lửa là 5 lớp mesh phẳng + ≤ 400 hạt instanced toàn cảnh, không alpha chồng quá 3 lớp; giàn X làm số tam giác ×2 → instancing.
- **Nhận diện:** hướng ít khác biệt nhất về hình → cá tính phải đến từ ánh sáng lửa/khói và motif tia sét.

## 7. Quyết định khi hai tài liệu lệch nhau
1. Đỏ: Đêm Bạc "đỏ chỉ ở secret và Hype ≥ 80 %" → **giữ cho `blood-100`/`flame` trên diện rộng**, nhưng cho phép `ember` mờ (bụng mây, rim) từ 40 %; LED đỏ chỉ ≥ 80 %.
2. Bóng: B "không dịch hue" ↔ A "bóng lạnh, sáng ấm" → **theo A** (cần cho chất lửa), giới hạn dịch ±8°.
3. Tỉ lệ: đề bài ~7 đầu ↔ A 7,5/6,5 → **7,5 mesh / 6,5 billboard**.
4. Emissive: lửa 1,8 (A) ↔ secret 1,8 (B) → **lửa 1,6 < secret 2,0** để secret luôn thắng.
5. Rim: A 0,5–0,8 ↔ B `arc` 0,6 → **0,6, màu `flame-500`** (rim ấm), key mới là `arc`.
6. Đèn rọi: A 8 ↔ B 8–12 → **8** (hiệu năng); Hype 80–100 đổi "White-out" → **"Lửa lớn"**.
7. Rồng: rồng cơ khí (không dùng phượng lửa); phản lực vẽ tia sét, không vẽ tay sừng (khó đọc).
