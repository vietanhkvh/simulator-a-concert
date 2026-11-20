# STYLE B2 — "MỰC & SƠN MÀI · bản Việt" (style sheet một trang)

Xem trước: `preview-B2-muc-son-mai-viet.png`. Bản đầu giữ nguyên: `STYLE_B_muc-son-mai.md`, `preview-B-muc-son-mai.png`.

## 1. Tóm tắt
- Đại nhạc hội **"Thăng Long"**: đêm hội đèn giao hưởng – dân tộc, ấm và trang trọng.
- Mọi vật là **nét cọ dày–mỏng** trên **sơn then**, dát **vàng quỳ**, điểm **đỏ son**, trăng **khảm vỏ trứng**.
- Hai dấu ấn dân tộc ở max Hype: **đôi rồng thời Lý** trồi lên chầu nguyệt và **dải đất hình chữ S** thay tim khói.
- Nhân vật cao 7,5 đầu, áo dài – khăn vấn – nón lá; mỗi mắt một nét cọ.
- Cao trào bằng mật độ đèn và độ ấm, không strobe.

## 2. Bảng màu chốt (hex giữ như bản đầu; đổi 3 tên cho đúng chất liệu sơn mài)
| Tên | Vai trò | 700 | 500 | 300 | 100 |
|---|---|---|---|---|---|
| Sơn then `lacquer` | nền, kiến trúc, sàn | `#0B0606` | **`#1A0E0C`** | `#33201B` | `#5C3D32` |
| Đỏ son `son` | ca sĩ, cột, trống, liễn, mào rồng | `#8E1B12` | **`#D9381E`** | `#F26B4A` | `#FFC2AE` |
| Vàng quỳ `gold` (cũ: Vàng lá) | khảm, rồng 1, nút chính, viền chữ S | `#8F6A1A` | **`#D9A93A`** | `#F0CE78` | `#FBEBC0` |
| Ngọc bích `jade` | rồng 2, "tốt", vành secret | `#145C4E` | **`#2FA58A`** | `#7BCDB6` | `#CDEFE4` |
| Chàm `indigo` | trời, núi đá vôi, trạng thái lạnh | `#14213F` | **`#2B4A8C`** | `#6C8CCB` | `#C3D2EE` |
| Cam đèn lồng `amber` | đèn lồng Hội An, đèn trời, cảnh báo | `#A1500F` | **`#F0892B`** | `#FAB56A` | `#FFE0B8` |
| Bạc quỳ · xà cừ `pearl` | bụng rồng, đèn trăng; chỉ cho secret | `#7C8794` | **`#BFC9D2`** | `#DDE4EA` | `#F4F7FA` |
| Vỏ trứng `silk` (cũ: Giấy dó) | chữ, nét mực sáng, trăng, hạc | `#B5A68A` | **`#F3E9D2`** | `#FAF4E4` | `#FFFCF3` |

Cờ ngũ sắc dùng lại `indigo · silk · jade · gold · son` — không thêm màu mới.

## 3. Ba trạng thái Hype (không đổi)
| Hype | Tên | Chính | Phụ | Nhấn |
|---|---|---|---|---|
| 0–40 % | Trăng mờ | `#2B4A8C` | `#145C4E` | `#BFC9D2` |
| 40–80 % | Hội đèn | `#D9381E` | `#D9A93A` | `#F0892B` |
| 80–100 % | Vàng son | `#F0CE78` | `#F26B4A` | `#7BCDB6` |

Trên 40 %: **thả đèn trời** thay cực quang (150–400 đèn instanced, mật độ = `auroraAmount(h)`); từ 80 % mưa vàng quỳ.

## 4. Quy tắc hình khối (như bản đầu, rút gọn)
Ca sĩ 7,5 đầu, khán giả 7 đầu · nét cọ 0,5–4,5 % H, đứt 15–25 % · viền mực sáng + khảm vàng 1,5 %, không viền đen · tô 2 bậc phẳng + dải loang · chuyển động 0,6–1,2 s, tà áo trễ 150–250 ms · secret ký bằng vòng cọ hở 40° màu ngọc + triện son.

## 5. Rồng Việt (`dragon`) — "Thăng Long"
**Dạng chốt: rồng thời Lý**, có chút khoẻ của đầu Trần ở độ dày thân phía cổ.
- Thân **tròn, trơn, dài**, uốn khúc mềm **hình sin**, thon dần đều về đuôi; không vẽ vảy to (chỉ vạch bụng mảnh).
- Đầu ngẩng cao, **không sừng**; **mào lửa** son phía trên mũi; **môi trên vươn dài cong lên** như vòi; miệng há, lưỡi mảnh, **ngậm ngọc**.
- **Bờm và râu** thành nhiều dải dài bay ngược ra sau; vây lưng là hàng răng lửa nhỏ, liền mạch.
- Bốn **chân mảnh**, **3 móng**, có túm lông khuỷu.
- Màu: rồng vàng quỳ + rồng ngọc bích, bụng bạc quỳ/xà cừ, mào và vây đỏ son.
- **So sánh:** rồng Trần thân mập khoẻ hơn, có sừng, khúc uốn thưa; rồng Nguyễn đầu to, râu bờm thành dải tia, đuôi xoáy, 5 móng cho vua. **Tránh** nét rồng Trung Hoa (thân dày vảy to, sừng hươu lớn, 5 móng) và rồng Nhật (3 móng nhưng thân dày, đầu to có sừng).
- **Kịch bản:** hai rồng trồi lên từ sau hai đầu mái sân khấu (hoặc từ mặt nước thủy đình), uốn sin đi lên 6 s, "nét cọ vẽ ra" từ đuôi tới đầu, rồi **chầu nguyệt** hai bên trăng; ngọc sáng dần theo Hype. Phương án phụ: chầu mặt trời trống đồng trên tường LED.
- **Nguồn (tra web 11/2026):** [Wikipedia — Vietnamese dragon](https://en.wikipedia.org/wiki/Vietnamese_dragon) · [Tuổi Trẻ — dáng rồng các triều đại](https://tuoitre.vn/tet-giap-thin-xem-linh-vat-rong-ti-thi-to-mo-dang-rong-cac-trieu-dai-phong-kien-viet-nam-20240202005948463.htm) · [LSVN — so sánh hình tượng rồng](https://lsvn.vn/so-sanh-hinh-tuong-rong-qua-cac-trieu-dai-cua-viet-nam-bieu-tuong-va-van-hoa-tuong-khac-1707710738.html) · [Diễn Đàn — Rồng Việt Nam (PDF)](https://www.diendan.org/phe-binh-nghien-cuu/rong-viet-nam/Rong%20Viet%20Nam.pdf) · [VinWonders — hoa văn Đại Việt](https://vinwonders.com/vi/product-information/gian-hoa-van-dai-viet-tinh-hoa-viet-nam-grand-world/).
- **Chỗ nguồn chưa thống nhất:** Wikipedia ghi rồng Lý không sừng, thường 3 móng; Tuổi Trẻ (dẫn PGS Nguyễn Du Chi) ghi 4 ngón. Đã chọn **3 móng, không sừng**; cần đối chiếu sách "Hoa văn Việt Nam" hoặc hiện vật Hoàng thành Thăng Long trước khi làm thật.

## 6. Chữ S thay tim khói (`jet`)
- **Hình:** dải đất hình chữ S cách điệu, mép **khảm vàng** đứt đoạn, lòng sáng mờ `gold-100`, quầng `amber`; **hai cụm đèn phía đông** cho Hoàng Sa (5 đốm) và Trường Sa (7 đốm); một **sao vàng nền son** ở vị trí Thủ đô. Không vẽ biên giới nước khác; trong game không ghi chữ lên hình (nhãn trong preview chỉ là chú thích).
- **Ba nhịp (≈ 9 s):** (1) chín hạc bay vào đội hình chữ V · (2) hạc đầu đàn vạch nét từ Bắc vào Nam, các con sau thả đèn dọc đường bay · (3) chữ S rực lên, "sông đèn trời" chảy qua lòng chữ S, hai cụm đảo sáng sau cùng; giữ 4 s rồi tan thành đèn trời.
- **Nhìn từ sân khấu (góc ca sĩ):** chữ S dựng đứng trên khán đài đối diện, cao 25–45° so với đường chân trời, trục Bắc–Nam thẳng đứng, không bị mái che.
- **Nhìn từ camera cao:** billboard luôn quay về camera quanh trục dọc; nằm trên trục dọc sân, lệch 8° để không trùng trăng và đôi rồng; cao ≥ 0,3 chiều cao khung hình để cụm đảo ≥ 3 px.

## 7. Thay đổi theo nhóm vật thể (so với chibi)
| Nhóm | Bản Việt |
|---|---|
| Ca sĩ | áo dài son hai tà, quần lụa, khăn vấn vàng, mép khảm vàng, thêu sen |
| Ban nhạc | trống, **đàn nguyệt**, đàn tranh, đàn bầu, sáo trúc, trống cơm + bè dây |
| Khán giả | vệt cọ, nón lá/khăn; **đèn lồng Hội An** và đèn hoa sen; tuỳ chọn tô phẳng viền đậm kiểu tranh Đông Hồ cho LOD gần |
| Sân khấu | mái đầu đao 2 tầng, cột son, bình phong, mặt trống đồng 14 tia; B-stage = mặt trống đồng (phương án: **thủy đình** múa rối nước) |
| Khán đài | mái ngói cong, đốm đèn lồng; **cờ ngũ sắc** thay dây cờ |
| Trời, chân trời | trăng khảm vỏ trứng; **núi đá vôi kiểu Hạ Long** 3 lớp loang (phương án: ruộng bậc thang) |
| Băng rôn | đèn lồng Hội An lớn mang liễn dọc chữ Quốc ngữ |
| ★ `ufo` / `rocket` / `plane` | đèn trăng khổng lồ thả đèn trời / pháo bông trúc 5 ống / diều sáo kéo liễn |
| ★ `dragon` / `jet` | đôi rồng Lý "Thăng Long" (mục 5) / hạc + đèn trời vẽ chữ S (mục 6) |

## 8. Giao diện
Như bản đầu: bảng sơn mài viền kép vàng, góc vát; nút chính vàng quỳ chữ sơn then; chip có ký hiệu (✓ triện tròn, ▲, ✕ triện vuông, cánh sen).

## 9. Rủi ro và công sức
- **Hình chữ S:** là biểu tượng nhạy cảm — phải luôn có đủ hai quần đảo, không cắt xén khi camera đổi góc; cần người Việt duyệt trước khi phát hành.
- **Rồng:** dễ trượt sang rồng Trung Hoa nếu thêm sừng/vảy/5 móng; khoá rig ở 3 móng, không sừng.
- **Đọc lời, mù màu, overdraw:** như bản đầu (vàng ↔ cam không mang nghĩa; đèn trời và chữ S không đi qua vùng lời).
- **Công sức:** rồng Lý L+ (rig mới, bờm nhiều dải) · chữ S + hạc L (billboard + 300 đèn instanced) · các khu khác như bản đầu; thêm cờ ngũ sắc S, núi đá vôi S, đàn nguyệt S.

## 10. Thay đổi so với bản B đầu
1. Rồng thành tâm điểm: to gấp ~2, trồi từ sau mái lên chầu nguyệt, có chú thích đặc điểm Lý.
2. "Đàn hạc vẽ hoa sen" → **hạc + sông đèn trời vẽ chữ S**, kèm 3 khung nhịp và ghi chú góc nhìn.
3. Thêm: núi đá vôi Hạ Long, cờ ngũ sắc, đàn nguyệt, đèn lồng Hội An; trăng nhỏ lại, dời lên cao.
4. Đổi tên 3 màu theo chất liệu sơn mài (vàng quỳ, bạc quỳ · xà cừ, vỏ trứng); hex không đổi.
5. Sửa 2 chỗ chật: chú thích pháo bông dời lên khoảng trời trống; chùm pháo ngọc tách khỏi đầu mái.
6. Bảng "thay gì so với chibi" bên trái nhường chỗ cho 3 khung chữ S; rút quy tắc hình khối còn 7.
