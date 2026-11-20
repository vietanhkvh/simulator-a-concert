# STYLE B — "MỰC & SƠN MÀI" (style sheet một trang)

Xem trước: `preview-B-muc-son-mai.png` (cùng bố cục với `../style-preview.png`). Nguồn: `01-form-directions.md` (hướng B) + `02-color-directions.md` (mục 2.B "Sơn Mài").

## 1. Tóm tắt
- Một **đại nhạc hội giao hưởng – dân tộc đương đại** trong đêm hội đèn: ấm, trang trọng, chậm rãi như múa.
- Mọi vật là **nét cọ dày–mỏng** trên nền **sơn then**, điểm **vàng lá** và **đỏ son**; có khoảng trống cố ý.
- Nhân vật cao 7,5 đầu, không vẽ mắt mũi chi tiết; biểu cảm bằng dáng đứng, tà áo và độ nghiêng đầu.
- Chất liệu Việt rõ ràng: trống đồng Đông Sơn, rồng thời Lý, áo dài – khăn vấn, nón lá, sen, đèn lồng, đèn trời, liễn.
- Cao trào bằng **mật độ đèn và độ ấm**, không strobe; đối lập chibi ở tỉ lệ, viền, nhịp chuyển động và họ màu.

## 2. Bảng màu chốt (700 bóng · **500 thân** · 300 sáng · 100 highlight)
| Tên | Vai trò | 700 | 500 | 300 | 100 |
|---|---|---|---|---|---|
| Sơn then `lacquer` | nền, kiến trúc, sàn | `#0B0606` | **`#1A0E0C`** | `#33201B` | `#5C3D32` |
| Đỏ son `son` | chủ đạo: ca sĩ, cột, trống, liễn | `#8E1B12` | **`#D9381E`** | `#F26B4A` | `#FFC2AE` |
| Vàng lá `gold` | khảm, nét nhấn, nút chính | `#8F6A1A` | **`#D9A93A`** | `#F0CE78` | `#FBEBC0` |
| Ngọc bích `jade` | nhấn lạnh, "tốt", vành secret | `#145C4E` | **`#2FA58A`** | `#7BCDB6` | `#CDEFE4` |
| Chàm `indigo` | trời, bóng, trạng thái lạnh | `#14213F` | **`#2B4A8C`** | `#6C8CCB` | `#C3D2EE` |
| Cam đèn lồng `amber` | đèn lồng, đèn trời, cảnh báo | `#A1500F` | **`#F0892B`** | `#FAB56A` | `#FFE0B8` |
| Xà cừ `pearl` | chỉ cho secret, khói, chữ mờ | `#7C8794` | **`#BFC9D2`** | `#DDE4EA` | `#F4F7FA` |
| Giấy dó `silk` | chữ, nét mực sáng, mây, da trống | `#B5A68A` | **`#F3E9D2`** | `#FAF4E4` | `#FFFCF3` |

Da phẳng `#F6DFC2 #E9C49A #CF9D6E #A8754C #7A5236`; tóc `lacquer` + khăn/trâm `gold`, `indigo`, `son`.

## 3. Ba trạng thái Hype (giữ khung lạnh → ấm → rực, dùng chung mọi khu)
| Hype | Tên | Chính | Phụ | Nhấn | Đèn |
|---|---|---|---|---|---|
| 0–40 % | **Trăng mờ** | `#2B4A8C` | `#145C4E` | `#BFC9D2` | 20 %, lệch pha như đom đóm |
| 40–80 % | **Hội đèn** | `#D9381E` | `#D9A93A` | `#F0892B` | 60 %, đồng bộ theo nhịp trống |
| 80–100 % | **Vàng son** | `#F0CE78` | `#F26B4A` | `#7BCDB6` | 100 %, mưa vàng lá |

**Trên 40 % (thay cực quang): thả đèn trời.** 150–400 đèn instanced bay lên từ sau khán đài (`amber-500 → gold-300`, emissive 0,9), mật độ = `auroraAmount(h)`. Từ 80 %: thêm dải mây dát vàng (`gold-700`, α 0,35), mưa vàng lá, trăng phình 1,15×. Max-hype: đèn trời hội tụ thành cổng, đôi rồng bay qua.

## 4. Quy tắc hình khối
- **Tỉ lệ:** ca sĩ/ban nhạc 7,5 đầu (H 1,72 m), khán giả 7 đầu; tà áo, tay áo dài tới 0,35 H.
- **Mặt:** mỗi mắt 1 nét cọ, 1 chấm son cho môi; không mũi, không má hồng; cảm xúc = nghiêng đầu ±15°.
- **Nét cọ:** bề rộng 0,5–4,5 % H, đầu nét ấn, đuôi khô; đứt 15–25 % chiều dài; bố cục lệch 60/40, ≥ 20 % đường bao bỏ ngỏ.
- **Viền:** bóng dáng bằng mực sáng `silk-500`; mép vật bằng "khảm vàng" `gold-700` 1,5 % (tắt dưới 24 px); không viền đen.
- **Tô bóng:** 2 bậc phẳng + dải loang ở chân vật; bóng ×0,62 dịch 25° về chàm; 1 vệt ánh sơn `gold-100` ≤ 6 %.
- **Chuyển động:** ease-in-out 0,6–1,2 s; tà áo/tua trễ 150–250 ms; xuất hiện bằng "nét cọ vẽ ra" 0,5 s; không squash.
- **Motif:** mặt trời trống đồng (14 tia) = vàng lá · hoa sen = đỏ son · mây cuộn/sóng nước; chim Lạc làm hoạ tiết vành.
- **Chữ ký secret:** vòng cọ hở 40° màu `jade-300` + triện son vuông; lõi `gold-100` (emissive 1,5); xà cừ óng ánh chỉ ở secret.

## 5. Thay đổi so với chibi theo nhóm vật thể
| Nhóm | Bản Mực & Sơn mài |
|---|---|
| Ca sĩ | áo dài `son-500` hai tà (tà sau trễ), quần lụa `silk`, khăn vấn vàng, mép khảm vàng đứt đoạn, micro `gold-300` |
| Ban nhạc | trống (son, da `silk`), đàn tranh, đàn bầu, sáo trúc + bè dây; trang phục `indigo`/`jade`/`silk-700` |
| Khán giả sân | vệt cọ thuôn trên đậm dưới loãng, không tay rời; lightstick → đèn lồng / đèn hoa sen; LOD xa = chấm mực + đốm đèn |
| Sân khấu | mái cong đầu đao 2 tầng, cột sơn son, bình phong 5 tấm, nền sau là mặt trống đồng; runway = cầu gỗ cong 6°; B-stage = mặt trống đồng |
| Khán đài | vành trên là mái ngói cong, lan can `son-700`, chấm = đốm đèn lồng; sóng đỏ–vàng kiểu vảy rồng |
| Trời | `#0A1020 → #14213F → #33201B`; trăng tròn lớn khảm vỏ trứng, mây cuộn nét vàng, núi 3 lớp loang |
| Băng rôn | khinh khí cầu → đèn lồng lớn mang **liễn dọc** (`son-700`, chữ `gold-300`, chữ Quốc ngữ) |
| ★ `ufo` | **đèn trăng khổng lồ** hạ xuống, thả 200 đèn trời |
| ★ `rocket` | **pháo bông trúc** 5 ống; nổ hoa cúc, hoa sen, liễu rủ (`gold`/`son`/`jade`) |
| ★ `dragon` | **đôi rồng thời Lý chầu nguyệt**: thân mảnh uốn hình sin, không sừng, mào lửa; `gold-500` + `jade-500`, bụng xà cừ |
| ★ `jet` | **đàn hạc 9 con** (sếu đầu đỏ) bay chữ V, vệt mực vẽ hoa sen thay tim khói |
| ★ `plane` | **diều sáo** (sáo trúc 2 tầng) kéo liễn dài |

## 6. Giao diện
Bảng sơn mài `rgba(26,14,12,.86)`, viền kép 1 px `gold-700`; góc vát 45° thay pill, radii 4/8 px. Nút chính nền `gold-500`, chữ `lacquer-700`, dải dưới 3 px `son-700`; nút phụ nền sơn then viền kép. Tiêu đề serif (kiểm tra dấu tiếng Việt), nội dung `system-ui`. Chip: ok `jade-300` + ✓ triện tròn · cảnh báo `amber-500` + ▲ · lỗi `son-300` + ✕ triện vuông · nốt đúng `gold-300` cánh sen. Thanh Hype `indigo → son → gold`.

## 7. Rủi ro
- **Đọc lời:** khung lời nền `lacquer-700` α 0,9 (tương phản xấu nhất 13,5); không viết chữ thường bằng `son-500` (4,08) — dùng `son-300`; additive vùng lời ≤ 0,35; đèn trời không bay qua vùng lời.
- **Mù màu:** `gold-500` ↔ `amber-500` (ΔE protan 9, deutan 6) — không bao giờ mang nghĩa, phân biệt bằng hình và độ sáng; `son` ↔ `amber` (deutan 18) → chip luôn kèm ký hiệu.
- **Overdraw nét cọ alpha:** nhiễu mép tính trong fragment × 8.000 khán giả; dùng alpha-test + texture nhiễu dựng sẵn, tắt mép khô ở LOD xa, đèn trời instanced 1 draw call.
- **Chính xác văn hoá:** rồng Lý (không sừng, thân trơn), trống đồng (sao giữa, chim Lạc bay ngược chiều kim đồng hồ), liễn chữ Quốc ngữ; tránh ensō, torii, rồng 5 móng kiểu Thanh, đèn lồng giấy kiểu Nhật. Cần người am hiểu duyệt.
- **Nhịp:** show chậm có thể lệch bài nhanh → giữ tốc độ phản hồi Hype như chibi, chỉ làm chậm chuyển động phụ.

**Công sức:** Trời + đèn trời M · Băng rôn/đèn lồng M · 5 secret L+ · Khán đài M · Khán giả M (rủi ro vừa) · Ca sĩ + ban nhạc L+ · Kiến trúc sân khấu L · Đèn/khói S · Pháo giấy/emote S · UI M.

## 8. Quyết định khi hai nhà thiết kế khác nhau
1. **Viền:** hình khối muốn viền mực, màu cấm viền đen → mực **sáng** (`silk`) cho bóng dáng + khảm vàng cho mép.
2. **Thay cực quang:** dải lụa (hình khối) vs đèn trời (màu) → **đèn trời** từ 40 %; dải lụa thành mây dát vàng từ 80 %.
3. **Tỉ lệ & da:** màu cho rằng da phẳng hợp 3–4 đầu → giữ **7,5 đầu**, da phẳng 2 bậc, mặt chỉ còn nét cọ.
4. **UI:** giấy dó mép xé + nút triện đỏ vs bảng sơn mài + nút vàng → **bảng sơn mài, nút vàng** (tương phản 9,29); triện đỏ chỉ dùng cho chip lỗi và chữ ký secret.
5. **Motif:** bỏ **ensō** (thuần Nhật) → gọi là "vòng cọ hở"; bộ ba chốt: mặt trời trống đồng · sen · mây cuộn.
6. **Secret:** bảng màu còn tả UFO/tên lửa/phản lực → theo hình khối, **thay hẳn**; màu của bảng cũ gán sang vật thay thế.
7. **Rồng:** "rồng + phượng" bị loại → **đôi rồng Lý** vàng + ngọc, bố cục "lưỡng long chầu nguyệt".
8. **Bảng màu:** đề bài nêu 6 màu, hệ màu có 8 → giữ **8** (thêm `amber` cho đèn, `pearl` riêng cho secret).
9. **"Đàn hạc":** hiểu là **bầy chim hạc** (9 con), không phải đàn harp; nhạc cụ dân tộc nằm ở ban nhạc.
