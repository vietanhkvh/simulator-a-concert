# STYLE A2 — ĐÊM NEON · ANIME (idol / ca sĩ ảo live)

Ảnh xem trước: `preview-A2-anime.png` (cùng bố cục với `../style-preview.png` và `preview-A-luoi-neon.png`; bản A giữ nguyên để đối chiếu).
Nghiên cứu: 2 lượt tìm web (kỹ thuật toon three.js; văn hoá penlight/đèn sân khấu idol) + kiến thức sẵn có về quy ước hoạt hình anime; nguồn ở cuối.

## 1. Tóm tắt
- Nhân vật **anime không chibi**: cao 7 đầu, có mặt thật (mắt to có đốm sáng, cằm nhọn), tóc theo mảng lớn, tô cel 2–3 bậc, nét mực dày-mỏng, viền sáng trắng.
- Show ngụ ý: đêm diễn idol / ca sĩ ảo / anime âm nhạc — city-pop neon, laser, tường LED, màn hình cận mặt, biển penlight đổi màu theo cụm.
- Giữ năng lượng EDM/synth của A (laser, đêm lạnh, neon) nhưng **ánh sáng phục vụ nhân vật**, không thay nhân vật.
- Cách điệu kiểu anime: tia tốc độ, impact frame, lấp lánh 4 cánh, lens flare, chữ hiệu ứng (SFX) trên màn hình.
- Đắt hơn A ở nhân vật (mặt, tóc, viền) nhưng dễ gây thiện cảm nhất trong các hướng không chibi.

## 2. Bảng màu
| Tên (token) | Vai trò | 700 bóng | 500 thân | 300 sáng | 100 highlight |
|---|---|---|---|---|---|
| Xanh đêm `night` | nền, kiến trúc, trời | `#070B1F` | `#0E1538` | `#1D2A66` | `#3A4FA8` |
| Hồng idol `idol` | chủ đạo, ca sĩ, tóc, nơ | `#B0126A` | `#FF3D9A` | `#FF8CC4` | `#FFD6EA` |
| Xanh ngọc `aqua` | laser, mắt, penlight, viền UI | `#008C99` | `#19E0E6` | `#86F2F2` | `#D4FBFA` |
| Tím neon `violet` | wash, bóng, cực quang | `#4B22B8` | `#8A5CFF` | `#BBA2FF` | `#E6DCFF` |
| Chanh `lime` | penlight, chip ok (dùng lại từ Lưới Laser) | `#6FA800` | `#C6FF2E` | `#DEFF85` | `#F2FFCF` |
| Vàng sao `sun` | lấp lánh, đỉnh Hype, secret | `#B88600` | `#FFC928` | `#FFE07A` | `#FFF4CC` |
| Da đào `skin` | da: bóng cel → sáng | `#EFA79C` | `#FFDCC8` | `#FFECDF` | `#FFF7F1` |
| Trắng viền `rim` | rim light, chữ, trang phục | `#9AA6D6` | `#EEF2FF` | `#F8FAFF` | `#FFFFFF` |

**Mực:** `#1B1440` (chàm) cho bao ngoài; nét trên da `#A8505A`, nét trên tóc = bậc 700 của màu tóc (colour-trace). Da khác: nâu `#C98A6B`/bóng `#9A5E52`, sáng `#FFE9DC`/bóng `#F2B5A8` — bóng da luôn dịch về hồng-tím, không pha xám. Tóc: 6 màu idol (hồng, ngọc, tím, vàng, chàm, trắng bạc).

## 3. Ba trạng thái Hype
| Hype | Tên | Chính | Phụ | Nhấn | Sân khấu |
|---|---|---|---|---|---|
| 0–40 % | **Khúc dạo** | `#3A4FA8` | `#8A5CFF` | `#008C99` | đêm xanh, 1 follow-spot, penlight thưa và lệch pha |
| 40–80 % | **Điệp khúc** | `#19E0E6` | `#FF3D9A` | `#8A5CFF` | laser quạt, penlight đồng bộ theo cụm, tường LED chạy tia tốc độ |
| 80–100 % | **Cao trào** | `#FFC928` | `#FF3D9A` | `#FFFFFF` | biển penlight rực, lấp lánh, impact frame ở downbeat |

**Trên 40 %:** cực quang **được giữ** nhưng vẽ kiểu cel — 3 dải phẳng mép cứng (tím → ngọc → ngọc sáng), đi kèm quạt laser hồng/ngọc từ giàn mái và sao 4 cánh; ≥ 80 % thêm mưa lấp lánh vàng và sao băng thành vệt tốc độ.

## 4. Quy tắc hình khối
- **Tỉ lệ:** ca sĩ + ban nhạc 7,0 đầu, khán giả 6,5 đầu; chân 0,52 H, vai 1,3 đầu, eo hẹp; bàn tay có ngón trỏ tách.
- **Mặt:** vẽ trên canvas atlas 512 px (như rig chibi): mắt cao 0,22 đầu, mi trên đậm có đuôi, mống mắt 3 tông + 2 đốm sáng + 1 đốm hồng; mũi 1 chấm; miệng 6 khẩu hình; má hồng gạch chéo; cằm nhọn.
- **Tóc:** 9–14 lọn nhọn là mesh riêng, 3 tông + 1 dải sáng zíc-zắc ("vòng thiên thần"); lọn dài và vạt váy trễ 120–200 ms.
- **Nét:** inverted-hull 2,2 % chiều cao cho bao ngoài (tắt dưới 14 px), nét trong vẽ trên canvas; không viền quanh mắt.
- **Tô bóng:** toon 2 bậc (da, vải) / 3 bậc (tóc, kim loại), ngưỡng cứng; bóng mái tóc đổ lên trán; rim trắng 1 phía theo đèn hậu.
- **Chuyển động:** nhịp anime — giữ hình 2–3 khung ở đỉnh tư thế, smear 1 khung khi vung tay, squash nhẹ ≤ 4 %; impact frame (đảo tông + tia) ≤ 2 lần/s.
- **Motif:** lấp lánh 4 cánh (sun) · tia tốc độ (rim) · chấm halftone (idol).

## 5. Thay đổi so với chibi
| Nhóm | Đêm Neon Anime | Công (A → A2) |
|---|---|---|
| Ca sĩ | rig 7 đầu, mặt atlas, tóc đuôi dài theo lọn, áo idol trắng–chàm–hồng, bốt cao, micro cầm tay | L → **L+** |
| Ban nhạc (6) | cùng rig, tóc mỗi người một màu, mặt atlas đơn giản hơn (3 khẩu hình) | chung rig |
| Khán giả 8.000 | SDF: đầu tròn + vai + mảng tóc 2 tông, viền mực 1 px; penlight thanh bo tròn có lõi trắng, màu theo cụm 8×8; 15 % áo happi/khăn | M → M |
| Sân khấu | giàn hộp có thanh chéo, tường LED hồng-tím + halftone + tia tốc độ, 2 màn cận mặt (render-target mặt ca sĩ), sàn bóng phản chiếu | M → **L** |
| Khán đài | tầng tối viền `night-100`, penlight vạch ngắn theo cụm màu | S → S |
| Bầu trời | chàm → tím → hồng chân trời, thành phố có cửa sổ sáng, sao 4 cánh, cực quang cel | M → M |
| Khinh khí cầu + băng rôn | khí cầu thân trắng sọc hồng, bảng LED chữ chanh; băng rôn cổ vũ của fan trên khán đài | M → M |
| ★ Rồng đôi | **giữ**: rồng hồng + rồng ngọc, bụng sáng, bờm nhọn, sừng vàng, mắt có đốm sáng, nhả ngọc lấp lánh | L → L |
| ★ UFO | giữ: đĩa trắng bụng tím, vòm kính có vệt sáng, tia hút 2 bậc + lấp lánh | S → S |
| ★ Tên lửa + pháo hoa | giữ: tên lửa thon 4 : 1, lửa 3 lớp; pháo hoa cánh thuôn nhọn + chữ "BÙNG!!" | S → M |
| ★ Phản lực | giữ: 2–5 phản lực trắng, khói **cụm tròn 2 tông có viền** vẽ tim | M → M |
| ★ Máy bay băng rôn | giữ máy bay cánh quạt nhỏ, băng rôn vải có chữ viền mực (không vẽ trong preview) | S |
| Pháo giấy, emote | lấp lánh, tim, nốt nhạc viền mực; emote kiểu sticker manga | S → S |

## 6. Giao diện
Kiểu rhythm-game / visual novel: bảng nghiêng 12° (parallelogram), bóng đổ cứng lệch 4 px màu `idol`/`violet`, nền chấm halftone. Nút chính trắng chữ mực (16 : 1), nút phụ nền `night` viền `aqua`. Khung lời = hộp thoại bo 10 px viền trắng, nền `night-700` α 0,9, nhãn "♪ LỜI", chữ đã hát đổi `aqua`. Chip nghiêng: ✓ chanh · ★ ngọc · ▲ vàng sọc · ✕ viền đứt hồng. Tiêu đề nghiêng đậm có bóng cứng.

## 7. Rủi ro
- **Lời bài hát:** tường LED hồng sáng ngay sau khung lời → khung α ≥ 0,9, additive vùng lời ≤ 0,30; không dùng chữ trắng trên `idol-500` (≈ 3,3 : 1).
- **Nhạy sáng:** impact frame và nháy trắng kiểu anime là rủi ro lớn nhất → ≤ 2 lần/s (chuẩn ≤ 3), diện tích đảo tông ≤ 25 % màn hình, tuỳ chọn "giảm chớp" đổi thành fade 150 ms.
- **Mù màu:** `idol` ↔ `violet` và `lime` ↔ `sun` dễ lẫn (deutan) → chip luôn có ký hiệu; cụm penlight chỉ trang trí, không mang nghĩa.
- **Hiệu năng:** inverted-hull nhân đôi tam giác nhân vật (+7 draw call cho ca sĩ + ban nhạc); màn cận mặt cần 1 render-target 256 px; tóc nhiều lọn.
- **Chất lượng mặt:** atlas canvas phải vẽ tay cẩn thận (mắt lệch 1 px là "uncanny"); mặt 3D xoay nghiêng cần bóng mặt vẽ sẵn thay vì N·L.

**Tổng công:** khu 1 **L** · khu 2 **S** · khu 3 **L+** (mặt, tóc, viền, màn cận mặt) · UI **M** → nhiều hơn A khoảng 1 hạng mục L.

## 8. A (Lưới Neon) so với A2 (Anime)
A mạnh ở sự khác biệt tuyệt đối và hiệu năng: không mặt, không tô bóng, ít draw call, rủi ro thấp, hợp EDM thuần; yếu ở cảm xúc — nhân vật lạnh, khó gắn bó với ca sĩ. A2 mạnh ở nhân vật: có gương mặt, biểu cảm, tóc và váy chuyển động, màn hình cận mặt, hợp J-pop / idol / ca sĩ ảo và dễ được yêu thích; yếu ở công sức (mặt atlas, tóc, viền) và gần chibi hơn về bảng màu hồng–ngọc dù tỉ lệ và nét hoàn toàn khác. Chọn A nếu ưu tiên tiến độ và chất "rave"; chọn A2 nếu muốn người chơi nhìn vào ca sĩ.

Nguồn: [Three.js cel shading với MeshToonMaterial](https://salivity.github.io/three.js/article/three-js-cel-shading-with-meshtoonmaterial) · [Three.js From Zero — stylized NPR](https://masterallarts.pages.dev/learn/threejs-from-zero/s4-09-stylized-npr/) · [Guilty Gear toon line control](https://www.docswell.com/s/ASW_Academy/5LVY67-GG-Toonline-Eng) · [Unity Toon Shader — outline, angel ring](https://docs.unity3d.com/Packages/com.unity.toonshader@0.12/manual/GettingStarted.html) · [On Penlights and Lightsticks](https://idolcast.substack.com/p/on-penlights-and-lightsticks) · [Lighting of a virtual pop idol show](https://openaccess.cms-conferences.org/publications/book/978-1-958651-77-3/article/978-1-958651-77-3_8)
