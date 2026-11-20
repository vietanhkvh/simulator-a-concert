# STYLE A — LƯỚI NEON (EDM / synth-pop rave)

Ảnh xem trước: `preview-A-luoi-neon.png` (cùng bố cục với `../style-preview.png`). Nguồn: `01-form-directions.md` (A · Lưới Neon) + `02-color-directions.md` (2.C Lưới Laser).

## 1. Tóm tắt
- Mọi vật là **khối đen viền ánh sáng**; ánh sáng (đường, lưới, tấm LED) là chất liệu duy nhất.
- Show ngụ ý: đêm rave EDM / synth-pop — tia mảnh, sương dày, nhịp máy, khán giả là "màn hình điểm ảnh".
- Đối lập chibi ở ba trục: **không mặt, không bo, không tô bóng**; người 7 đầu thay vì 2,3 đầu.
- Màu lạnh toàn bộ (chanh axit, cyan, lam, tím); **cam cháy là màu ấm duy nhất**, chỉ dành cho secret và lỗi.
- Hướng rẻ nhất về GPU hình khối (bỏ inverted hull, bỏ atlas mặt), đắt nhất về additive/bloom.

## 2. Bảng màu cuối
| Tên (token) | Vai trò | 700 bóng | 500 thân | 300 sáng | 100 highlight |
|---|---|---|---|---|---|
| Đen lục lam `void` | nền, kiến trúc, thân vật thể | `#020507` | `#071015` | `#10242C` | `#1F4450` |
| Chanh axit `acid` | chủ đạo, ca sĩ, nút chính | `#6FA800` | `#C6FF2E` | `#DEFF85` | `#F2FFCF` |
| Cyan ion `ion` | laser, viền mặc định, lightstick | `#008C9E` | `#00E5F0` | `#7DF3F8` | `#D0FBFD` |
| Lam điện `volt` | wash lạnh, khán đài, lưới sàn | `#0B3FC4` | `#2E7BFF` | `#7FB0FF` | `#CFE1FF` |
| Tím cực tím `uv` | đèn UV, trời, mặt trời sọc | `#4A12B8` | `#8A3DFF` | `#B88AFF` | `#E3D1FF` |
| Vàng natri `sodium` | cảnh báo, đỉnh Hype, chữ drone | `#A88A00` | `#FFD400` | `#FFE566` | `#FFF6BF` |
| Cam cháy `flare` | chỉ secret + chip lỗi | `#B83A00` | `#FF6A1A` | `#FF9C66` | `#FFD9C2` |
| Băng `frost` | chữ, lõi tia, drone | `#8FA3A8` | `#E6F4F2` | `#F3FAF9` | `#FFFFFF` |

## 3. Ba trạng thái Hype
| Hype | Tên | Chính | Phụ | Nhấn | Đèn |
|---|---|---|---|---|---|
| 0–40 % | **Chờ tín hiệu** | `#0B3FC4` | `#4A12B8` | `#008C9E` | 20 %, UV + 2 tia quét chậm |
| 40–80 % | **Quét** | `#00E5F0` | `#8A3DFF` | `#2E7BFF` | 65 %, laser quạt, sóng pixel-map 8×8 |
| 80–100 % | **Quá tải** | `#C6FF2E` | `#7DF3F8` | `#FFD400` | 100 %, EQ cột trên khán đài |

**Trên 40 % (thay cực quang):** 12–24 tia từ hai tháp đèn và vành mái đan thành **vòm lưới laser** (`ion-500`, α = `auroraAmount(h)` × 0,7) + 300 chấm drone `frost` đậu ở nút lưới; ≥ 80 % lưới đổi `acid-500`. Max-hype: lưới "quá tải" vỡ thành mưa tia 1,2 s → tối 0,3 s → secret hiện với viền `flare`.

## 4. Quy tắc hình khối
- **Tỉ lệ:** ca sĩ/ban nhạc 7,0 đầu (H 1,78 m, vai 0,26 H, chân 0,50 H); khán giả 6,5 đầu; tay chân 2 đoạn, bàn tay hình nêm.
- **Mặt:** không vẽ; một dải visor phát sáng 0,09 H × 0,03 H; hát = dải nhấp nháy theo âm lượng.
- **Cạnh:** bo = 0, vát 45° ở 4–8 % cạnh ngắn; góc 30°/60°/90°; mọi vật đọc được chỉ bằng đường bao.
- **Viền:** không mực; đường sáng emissive 1,5–2,5 px theo màu vai trò, tắt dưới 16 px; ≤ 3 sắc viền cùng lúc.
- **Tô bóng:** thân unlit L 4–8 %, 0 bậc; emissive: kiến trúc 0,08 · trim 1,0 · que 1,1 · laser 1,3 · secret 1,7.
- **Chuyển động:** cắt cứng theo phách, không squash; giật 1,00 → 1,06 → 1,00 trong 80 ms; quay bước 15°/45°; hiện bằng quét dòng 0,2 s.
- **Motif:** tam giác (acid) · lưới ô (ion) · mặt trời sọc ngang (uv).

## 5. Thay đổi so với chibi theo nhóm vật thể
| Nhóm | Lưới Neon | Công |
|---|---|---|
| Ca sĩ | rig 7 đầu, áo khoác vạt nhọn `void-300`, viền `acid-500`, visor, micro `frost` | L |
| Ban nhạc (6) | bóng đen, mỗi người một sắc viền (`ion`/`volt`/`uv`), nhạc cụ chỉ còn đường bao | L (chung rig) |
| Khán giả 8.000 | SDF bóng đen đặc, đầu lục giác, viền 1 px; que = thanh thẳng 0,35 H + vòng cổ tay; xa chỉ còn que + chấm đầu | M |
| Sân khấu | giàn kim tự tháp dây (`LineSegments`), mái lưới ô, runway/B-stage lục giác lát lưới LED, tường LED = mặt trời sọc + sóng âm | M |
| Khán đài | mép tầng thành đường `volt-500`, chấm vuông 2 px, tháp đèn hộp, 2 màn LED nền `volt→uv` chữ `acid` | S |
| Bầu trời | `#020507→#10242C`, không sao, sương dày, mặt trời sọc 12 dải lặn sau sân khấu, lưới phối cảnh ở sàn/chân trời | M |
| Khinh khí cầu + băng rôn | zeppelin hình thoi 4 : 1 gân `ion`; băng rôn = bảng LED chạy chữ `acid` | M |
| ★ UFO | đĩa mỏng 0,12 × đường kính, vành 24 đoạn chạy đuổi, tia hút = nón lưới dây `acid-300` | S (tham số) |
| ★ Tên lửa | kim 6 : 1, 3 vây tam giác, sọc `sodium`; pháo hoa nổ thành vòng tròn + tam giác | S (tham số) |
| ★ Rồng đôi | 40 đốt lăng trụ rỗng chỉ có cạnh (`ion` + `acid`), lõi sáng chạy dọc thân, mắt `flare` | L |
| ★ Phản lực | 5 phi cơ delta chỉ có đường bao; khói ribbon phẳng vẽ tim vector + 1 đường EQ | M |
| ★ Máy bay băng rôn | **thay bằng drone show**: 300 điểm sáng `sodium` xếp chữ cổ vũ | M |
| Chữ ký secret | vành sao → **tam giác `flare` xoay** 1,35× + 3 tia quét; lõi `#FFFFFF` | S |
| Pháo giấy, emote | tam giác, vạch kim tuyến `ion-300`/`acid-300`, biểu tượng vector | S |

## 6. Giao diện
Bảng HUD `rgba(7,16,21,.80)`, viền 1 px `ion-700`, **góc vát 45° 8 px**, radii 0. Tiêu đề IN HOA giãn 0,08–0,12 em; số và nhãn monospace (số 7 đoạn). Nút chính nền `acid-500` chữ `void-700` (17,3 : 1); nút phụ viền `ion-500`. Keycap vuông, gạch chân `ion`. Thanh Hype phân đoạn `volt → ion → acid`. Chip: ok `acid` + ✓ `[OK]` · cảnh báo `sodium` + ▲ sọc chéo · lỗi `flare` + ✕ viền đứt · nốt đúng `ion-300` thanh đặc.

## 7. Rủi ro
- **Lời bài hát:** khung lời `void-700` α 0,9 (14,8 : 1); additive vùng lời ≤ 0,30; không dùng `uv-500` làm chữ (3,83 : 1) — dùng `uv-300`; chữ mờ `frost-700` chỉ ≥ 18 px.
- **Nhạy sáng:** cắt cứng ≤ 3 lần/s, không đảo sáng/tối toàn màn; bloom kẹp, tổng additive ≤ 1,6; tuỳ chọn "giảm chớp" đổi mọi cắt thành fade 150 ms.
- **Mù màu:** `acid` ↔ `sodium` (ΔE protan 12, deutan 8) → luôn kèm ký hiệu + mẫu sọc; `volt` ↔ `uv` (deutan 10) chỉ làm cặp wash; `ion` ↔ `frost` (protan 15) → chữ phụ khác cỡ/kiểu.
- **Hiệu năng:** draw call giảm (−5) nhưng overdraw additive cao nhất (lưới trời, laser, que); khối đen dễ chìm nếu viền tắt → giữ sương `void-300` và rim tối thiểu.
- **Cảm xúc:** nhân vật không mặt có thể lạnh; bù bằng tư thế, visor nhấp nháy và sắc viền riêng.

**Tổng công:** khu 1 (trời, khí cầu, secret) **L** · khu 2 (khán đài) **S** · khu 3 (người, sân khấu, đèn) **L** · UI **M** → khoảng 4 hạng mục L.

## 8. Quyết định khi hai designer khác nhau
- **Tên:** phong cách gọi là "Lưới Neon"; "Lưới Laser" là tên bảng màu của nó.
- **Màu viền:** theo vai trò (form) nhưng khoá trong bảng của màu: `ion` mặc định, `acid` cho ca sĩ, ban nhạc mỗi người một sắc lạnh, ≤ 3 sắc.
- **`plane`:** theo form — drone show thay máy bay; băng `sodium` của designer màu thành màu chữ drone, tách khỏi drone nền `frost`.
- **Chữ ký secret:** hình tam giác xoay của form + màu `flare-500` của designer màu (cam không dùng ở đâu khác trên trời).
- **Bầu trời:** giữ mặt trời sọc và lưới phối cảnh (form), bỏ sao và để trăng mờ sau sương (màu); "màn laser quét" = vòm lưới laser + drone.
- **Tên lửa:** thân đen viền `frost` thay vì thân `frost-700` đặc, giữ sọc `sodium` — để đúng luật "khối đen".
- **UI:** vát 8 px (form) thay vì 6 px; chip ok giữ `acid` kèm ✓ `[OK]`, chưa đổi sang `ion-300`.
- **Khung Hype:** giữ ba ngưỡng 40/80 chung với chibi, chỉ đổi tên và trục (tĩnh → quét → quá tải).
