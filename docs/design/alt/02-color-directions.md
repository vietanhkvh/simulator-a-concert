# 02 — Hướng màu & ánh sáng cho 2 phong cách mới (Designer B)

Phạm vi: đề xuất từ phía **màu, ánh sáng, UI**; chưa sửa mã. Cấu trúc token bám `src/world/style/palette.ts` (8 màu × 4 bậc 700/500/300/100, `INK`, `SKIN`/`HAIR`/`CLOTH`, `SECRET_*`, `HYPE_STAGES`, `ZONE_SAT`, `toonRamp`) và `src/ui/tokens.css`. Nguồn: **có truy cập web** (3 lượt tìm: WCAG 2.3.1, ngôn ngữ đèn concert, bảng màu synthwave — link cuối tài liệu); phần còn lại là kiến thức nghề. Mọi con số tương phản do tôi tự tính bằng script (công thức ở mục 3).

## 1. Khảo sát 11 ngôn ngữ màu/ánh sáng không "kẹo dễ thương"
| # | Hướng | Tâm trạng | Hành vi đèn điển hình | Rủi ro với game mình | Kết luận |
|---|---|---|---|---|---|
| 1 | Synthwave magenta/cyan + hoàng hôn | hoài cổ 80s, lái xe đêm | wash 2 màu đối, lưới laser, ít strobe | **trùng hue với `berry`/`soda`/`grape` hiện tại** → nhìn như recolour | loại |
| 2 | Cyberpunk neon axit + mưa mù | lạnh, công nghiệp, căng | beam mảnh, haze dày, biển LED | bloom additive dễ cháy trắng; chanh/vàng lẫn với người mù màu | **chọn (C)** — bỏ hẳn hồng |
| 3 | Đơn sắc + 1 màu nhấn (white-out rock, noir) | lạnh lùng, sang, kịch tính | beam trắng cắt haze, blinder, blackout, bóng đổ | flash trắng = rủi ro co giật cao nhất; dễ "thiếu màu" | **chọn (A)** |
| 4 | Arena rock tungsten/hổ phách + đỏ thẫm | ấm, mồ hôi, cổ điển | PAR ấm, backlight đỏ, blinder vàng | đỏ thẫm chìm trên nền đêm; đỏ/cam lẫn nhau | gộp ý tungsten vào (A) |
| 5 | EDM festival RGB laser | cực đại, hưng phấn | laser quạt, strobe dày, pixel-map | vượt 3 chớp/s nếu không khoá; cầu vồng = hết bản sắc | gộp lưới laser vào (C) |
| 6 | Gala giao hưởng vàng/đỏ rượu/ngà | trang trọng | wash tĩnh, follow-spot, không strobe | show quá tĩnh so với thanh Hype | gộp vàng/ngà vào (B) |
| 7 | Mực Á Đông + son + vàng lá | huyền thoại, lễ hội | đèn lồng, wash đỏ, tia vàng, khói thấp | vàng/cam lẫn nhau; đỏ trên nền nâu đen thấp tương phản | **chọn (B)** — hợp rồng, đèn trời |
| 8 | Vaporwave pastel | mơ, mỉa mai | wash phẳng, không beam | vẫn là pastel → gần chibi | loại |
| 9 | Holographic / chrome Y2K | bóng bẩy, pop | gương, tia cầu vồng | cần phản xạ môi trường (đắt); cầu vồng khó đặt token | chỉ mượn cho xà cừ ở (B) |
| 10 | Festival hoàng hôn đất | mộc, tự do | đèn dây, lửa, wash cam | game là **đêm**; phải đổi cả bầu trời | loại |
| 11 | Dark fantasy lam lục/tím/xương | u tối, nghi lễ | đuốc lạnh, sương, tia đơn | tím/lam lục gần `grape`/`mint`; khán giả lightstick lạc tông | loại |

Quy tắc an toàn chung cho cả ba ứng viên (kế thừa guide mục 3): ≤ 3 lần chớp toàn màn hình/giây (WCAG 2.3.1); **không chớp đỏ bão hoà** (ngưỡng "red flash": R/(R+G+B) ≥ 0,8 — đỏ của ta: `signal-500` 0,74, `son-500` 0,72, đều dưới ngưỡng nhưng vẫn cấm strobe đỏ); vùng cửa sổ lời có trần additive riêng; mọi trạng thái UI có ký hiệu ngoài màu.

## 2. Ba ứng viên — token đầy đủ
### 2.A "Đêm Bạc" — noir đơn sắc + một nốt đỏ (white-out rock show)
| Token | Vai trò | 700 bóng | 500 thân | 300 sáng | 100 highlight |
|---|---|---|---|---|---|
| `coal` Than | nền, trời, sàn | `#050506` | `#0E0F12` | `#1E2026` | `#3A3D47` |
| `steel` Thép | giàn, kiến trúc, kim loại | `#2C3038` | `#5B6270` | `#8E96A6` | `#C3C9D4` |
| `tungsten` Trắng ấm 3200K | đèn mặt, lightstick ấm | `#B88A4A` | `#FFD9A0` | `#FFE8C4` | `#FFF6E6` |
| `arc` Trắng lạnh 6500K | beam, rim, "tốt" | `#7FA0C8` | `#CFE4FF` | `#E4F0FF` | `#F5FAFF` |
| `signal` Đỏ tín hiệu | **màu nhấn duy nhất**, phần thưởng | `#8A0F1C` | `#E8222E` | `#FF5A5F` | `#FFB3B0` |
| `ember` Hổ phách | cảnh báo, pháo, lửa | `#9A4A08` | `#F08A1C` | `#FFB25A` | `#FFDDAE` |
| `slate` Lam thép | trạng thái lạnh, sương | `#1F3A5C` | `#3F6FA8` | `#7FA6D6` | `#C2D8F0` |
| `paper` Giấy | chữ, nút chính, lõi sáng | `#A8A8A4` | `#F2F0EA` | `#FAF9F5` | `#FFFFFF` |

| Mục | Giá trị |
|---|---|
| Viền | **không viền**; thay bằng rim-light `arc-300` cường độ 0,6 (fresnel), bóng đổ cứng |
| Da / tóc | tự nhiên, giảm bão hoà ×0,55: `SKIN` `#EBD3C0 #D9B89C #BC9274 #94694C #6B4832`; `HAIR` `#0E0F12 #2B2420 #4A3A2E #8A7A66 #C9C3B8 #F2F0EA #5B6270 #8A0F1C` (không tóc kẹo) |
| `CLOTH` | `coal-300`, `steel-500`, `steel-100`, `paper-500` (85%) + `signal-700` (15% áo merch) |
| Secret | `SECRET_CORE` `#FFFFFF` (emissive 1,8) · `SECRET_RIM` `signal-300` `#FF5A5F`. **Đỏ chỉ xuất hiện ở secret, micro ca sĩ và Hype ≥ 80%** |
| Hype 0–40 "Tắt đèn" | primary `slate-500` `#3F6FA8` · secondary `steel-300` `#8E96A6` · accent `arc-700` `#7FA0C8` · 15% đèn |
| Hype 40–80 "Tungsten" | `tungsten-500` `#FFD9A0` · `arc-500` `#CFE4FF` · `ember-500` `#F08A1C` · 55% đèn |
| Hype 80–100 "White-out" | `arc-300` `#E4F0FF` · `tungsten-300` `#FFE8C4` · `signal-500` `#E8222E` · 100% đèn |
| Thay cực quang (> 40%) | **đèn rọi trời + trần mây thấp**: 8–12 search-light từ vành sân quét lên, mây hắt sáng từ dưới (`steel-700 → tungsten-700`); ≥ 80% mây ửng `signal-700`. Dùng lại `auroraAmount(h)` làm `skyFxAmount` |
| `ZONE_SAT` / tương phản | arena 1,0 · stands 0,5 · outside 0,25 · balloon 0,6; hue shift 0°; sương `coal-300` (xa nhạt về xám lạnh) |
| Bóng | 3 bậc cứng (ngưỡng mềm 2–4%), chỉ đổi độ sáng ×0,45, **không dịch hue**, sàn L = 0,04 (được gần đen) |
| Emissive | kiến trúc 0,05 · trim 0,3 · lightstick 1,0 · lõi beam 1,4 · secret 1,8; additive toàn màn ≤ 0,6 trong ≤ 0,4 s; **vùng lời ≤ 0,25** |
| Trời (đỉnh → chân trời) | `#050506 → #0E0F12 → #1E2026`, quầng thành phố `#3A2A1C` 12%; sao thưa, trăng `paper-500` nhỏ, sắc nét |
| UI | surface `rgba(14,15,18,.82)` · viền 1 px `steel-500` · chữ `paper-500` / phụ `steel-100` / mờ `steel-300` · nút chính nền `paper-500` chữ `coal-700`, hover gạch dưới `signal-500` 3 px · radii 0 / 2 px / không pill · bóng: không |
| Chip trạng thái | ok `arc-500` + ✓ · warn `ember-500` + ▲ · bad `signal-300` + ✕ (viền nét đứt) · nốt đúng `paper-100` ô đặc / trượt `steel-500` ô rỗng |
| Font (system) | tiêu đề IN HOA giãn chữ 0,08em: `'Helvetica Neue','Arial Narrow','Roboto Condensed','Segoe UI',system-ui,sans-serif` 800; nội dung `system-ui`; số `ui-monospace` |

### 2.B "Sơn Mài" — đen then, đỏ son, vàng lá, ngọc bích (hội đèn Á Đông)
| Token | Vai trò | 700 bóng | 500 thân | 300 sáng | 100 highlight |
|---|---|---|---|---|---|
| `lacquer` Sơn then | nền, kiến trúc | `#0B0606` | `#1A0E0C` | `#33201B` | `#5C3D32` |
| `son` Đỏ son | **chủ đạo**, ca sĩ, cổng, trống | `#8E1B12` | `#D9381E` | `#F26B4A` | `#FFC2AE` |
| `gold` Vàng lá | trim, chữ nhấn, nút chính | `#8F6A1A` | `#D9A93A` | `#F0CE78` | `#FBEBC0` |
| `jade` Ngọc bích | nhấn lạnh, "tốt", lightstick | `#145C4E` | `#2FA58A` | `#7BCDB6` | `#CDEFE4` |
| `indigo` Chàm | trời, bóng, trạng thái lạnh | `#14213F` | `#2B4A8C` | `#6C8CCB` | `#C3D2EE` |
| `amber` Cam đèn lồng | đèn lồng, lửa, cảnh báo | `#A1500F` | `#F0892B` | `#FAB56A` | `#FFE0B8` |
| `pearl` Xà cừ | khảm trai, kim loại, khói | `#7C8794` | `#BFC9D2` | `#DDE4EA` | `#F4F7FA` |
| `silk` Giấy dó | chữ, da trống, mây | `#B5A68A` | `#F3E9D2` | `#FAF4E4` | `#FFFCF3` |

| Mục | Giá trị |
|---|---|
| Viền | "khảm vàng": nét `gold-700` `#8F6A1A` mảnh 1,5% (tắt dưới 24 px); vật trên trời `indigo-300`. Không dùng viền đen (chìm vào nền) |
| Da / tóc | cách điệu phẳng kiểu tranh khắc gỗ: `SKIN` `#F6DFC2 #E9C49A #CF9D6E #A8754C #7A5236`; `HAIR` `#0B0606 #1A0E0C #33201B #5C3D32 #7C8794` (80%) + `#8E1B12 #14213F #D9A93A` (20%, khăn/trâm) |
| `CLOTH` | `son-700`, `indigo-500`, `jade-700`, `silk-700`, `lacquer-100`; 50% bậc 700, 50% bậc 500 |
| Secret | `SECRET_CORE` `gold-100` `#FBEBC0` (emissive 1,5) · `SECRET_RIM` `jade-300` `#7BCDB6`; **`pearl` óng ánh (dịch hue theo góc nhìn ±20°) chỉ dành cho secret** |
| Hype 0–40 "Trăng mờ" | `indigo-500` `#2B4A8C` · `jade-700` `#145C4E` · `pearl-500` `#BFC9D2` · 20% đèn |
| Hype 40–80 "Hội đèn" | `son-500` `#D9381E` · `gold-500` `#D9A93A` · `amber-500` `#F0892B` · 60% đèn |
| Hype 80–100 "Vàng son" | `gold-300` `#F0CE78` · `son-300` `#F26B4A` · `jade-300` `#7BCDB6` · 100% đèn |
| Thay cực quang (> 40%) | **thả đèn trời**: 150–400 đèn lồng instanced bay lên từ sau khán đài (`amber-500 → gold-300`, emissive 0,9), mật độ = `auroraAmount(h)`; ≥ 80% thêm dải "mây ngũ sắc" dát vàng (`gold-700` α 0,35) và mưa vàng lá |
| `ZONE_SAT` | arena 1,0 · stands 0,8 · outside 0,65 · balloon 0,9; khu 1 dịch hue 6° về `indigo` (225°); sương `mix(lacquer-300, indigo-700, .5)` = `#24202D` |
| Bóng | 2 bậc phẳng + dải chuyển "bokashi" ở chân vật thể; bóng ×0,62, dịch hue 25° về chàm, `minSat` 0,2, sàn L = 0,07; highlight dải ngang `gold-100` ≤ 6% (ánh sơn bóng) |
| Emissive | kiến trúc 0,12 · trim vàng 0,5 · đèn lồng 0,9 · lightstick 0,9 · secret 1,5; vùng lời ≤ 0,35 |
| Trời | `#0A1020 → #14213F → #33201B`, quầng chân trời `amber-700` 10%; **trăng tròn lớn** `gold-100`, mây cuộn nét vàng |
| UI | surface `rgba(26,14,12,.86)` · viền kép 1 px `gold-700` (2 px cách 2 px) · chữ `silk-500` / phụ `gold-300` / mờ `pearl-500` · nút chính nền `gold-500` chữ `lacquer-700`, dải dưới 3 px `son-700` · radii 4 / 8 px, góc vát 45° thay pill |
| Chip trạng thái | ok `jade-300` + ✓ ấn triện tròn · warn `amber-500` + ▲ · bad `son-300` + ✕ ấn triện vuông · nốt đúng `gold-300` cánh sen đặc / trượt `lacquer-100` rỗng |
| Font (system) | tiêu đề serif: `'Iowan Old Style','Palatino Linotype','Noto Serif',Georgia,'Times New Roman',serif` 700 (kiểm tra dấu tiếng Việt trên Windows/Android); nội dung `system-ui` |

### 2.C "Lưới Laser" — neon axit trên đen lục lam (cyber-rave)
| Token | Vai trò | 700 bóng | 500 thân | 300 sáng | 100 highlight |
|---|---|---|---|---|---|
| `void` Đen lục lam | nền, kiến trúc | `#020507` | `#071015` | `#10242C` | `#1F4450` |
| `acid` Chanh axit | **chủ đạo**, ca sĩ, nút chính | `#6FA800` | `#C6FF2E` | `#DEFF85` | `#F2FFCF` |
| `ion` Cyan ion | laser, lightstick, viền sáng | `#008C9E` | `#00E5F0` | `#7DF3F8` | `#D0FBFD` |
| `volt` Lam điện | wash lạnh, khán đài | `#0B3FC4` | `#2E7BFF` | `#7FB0FF` | `#CFE1FF` |
| `uv` Tím cực tím | đèn UV, bóng, trời | `#4A12B8` | `#8A3DFF` | `#B88AFF` | `#E3D1FF` |
| `sodium` Vàng natri | cảnh báo, đỉnh Hype, biển báo | `#A88A00` | `#FFD400` | `#FFE566` | `#FFF6BF` |
| `flare` Cam cháy | **màu ấm duy nhất**, secret, lỗi | `#B83A00` | `#FF6A1A` | `#FF9C66` | `#FFD9C2` |
| `frost` Băng | chữ, lõi tia | `#8FA3A8` | `#E6F4F2` | `#F3FAF9` | `#FFFFFF` |

| Mục | Giá trị |
|---|---|
| Viền | **không viền mực**; "viền neon" phát sáng 1–2 px (fresnel mũ 3, emissive 0,8) màu `ion-500`, ca sĩ `acid-500`; thân vật thể gần đen |
| Da / tóc | cách điệu bóng tối + rim: `SKIN` `#D8C7BE #BFA595 #9A7E6C #735847 #4E3A30` rồi `mix(da, void-100, .45)`; `HAIR` `#020507 #10242C #1F4450 #8FA3A8 #E6F4F2` (70%) + nhuộm `#C6FF2E #00E5F0 #B88AFF` (30%) |
| `CLOTH` | `void-300`, `void-100`, `volt-700`, `uv-700` (80%) + `frost-700` (20%); sọc phản quang `ion-300` |
| Secret | `SECRET_CORE` `#FFFFFF` (emissive 1,7) · `SECRET_RIM` `flare-500` `#FF6A1A`. **Cam chỉ dành cho secret và chip lỗi** → secret là vật ấm duy nhất trên trời lạnh |
| Hype 0–40 "Chờ tín hiệu" | `volt-700` `#0B3FC4` · `uv-700` `#4A12B8` · `ion-700` `#008C9E` · 20% đèn |
| Hype 40–80 "Quét" | `ion-500` `#00E5F0` · `uv-500` `#8A3DFF` · `volt-500` `#2E7BFF` · 65% đèn |
| Hype 80–100 "Quá tải" | `acid-500` `#C6FF2E` · `ion-300` `#7DF3F8` · `sodium-500` `#FFD400` · 100% đèn |
| Thay cực quang (> 40%) | **lưới laser trời**: 12–24 tia từ vành mái đan thành vòm lưới (`ion-500`, α = `auroraAmount(h)` × 0,7) + 300 chấm drone xếp hình; ≥ 80% lưới đổi `acid-500`, drone xếp chữ cổ vũ |
| `ZONE_SAT` | arena 1,0 · stands 0,85 · outside 0,7 · balloon 0,9; khu 1 dịch hue 10° về `ion` (184°); sương `void-300` dày (haze ×1,5) |
| Bóng | thân gần như unlit: albedo ×0,35; bóng ×0,5, dịch hue 30° về `volt` (220°), `minSat` 0,3, sàn L = 0,03; ánh sáng đến từ emissive + rim |
| Emissive | kiến trúc 0,08 · trim neon 1,0 · lightstick 1,1 · laser 1,3 · secret 1,7; ngưỡng bloom ≥ 0,9; tổng additive một điểm ảnh ≤ 1,6; vùng lời ≤ 0,30 |
| Trời | `#020507 → #071015 → #10242C`, dải mù chân trời `void-100` + ô nhiễm sáng `uv-700` 15%; không sao (mây mù), trăng mờ sau haze |
| UI | surface `rgba(7,16,21,.80)` · viền 1 px `ion-700` + góc vát 6 px · chữ `frost-500` / phụ `ion-300` / mờ `frost-700` · nút chính nền `acid-500` chữ `void-700` · radii 0 / 2 px · nét quét scanline α ≤ 0,04 (tĩnh, không nhấp nháy) |
| Chip trạng thái | ok `acid-500` + ✓ `[OK]` · warn `sodium-500` + ▲ sọc chéo · bad `flare-500` + ✕ viền đứt · nốt đúng `ion-300` thanh đặc / trượt `void-100` thanh rỗng |
| Font (system) | tiêu đề IN HOA: `'Eurostile','Bank Gothic','Segoe UI','Roboto',system-ui,sans-serif` 700 giãn 0,12em; số và nhãn `ui-monospace,'SF Mono',Menlo,Consolas,monospace` |

## 3. Tương phản WCAG và mù màu (số đã tính)
Công thức: `c' = c/12,92` nếu `c ≤ 0,04045`, ngược lại `((c+0,055)/1,055)^2,4`; `L = 0,2126R' + 0,7152G' + 0,0722B'`; **tỉ lệ = (L_sáng + 0,05) / (L_tối + 0,05)**. "Xấu nhất" = surface bán trong suốt đè lên điểm ảnh trắng của cảnh 3D (alpha-blend trong sRGB). Chuẩn: AA chữ thường ≥ 4,5; chữ lớn/biểu tượng ≥ 3,0.

| Cặp (chữ / nền) | A Đêm Bạc | B Sơn Mài | C Lưới Laser |
|---|---|---|---|
| Chữ chính / nền-500 | 16,82 | 15,64 | 16,99 |
| Chữ chính / surface xấu nhất | 9,98 (`#393A3D`) | 10,59 (`#3A302E`) | 9,34 (`#394044`) |
| Chữ phụ / nền-500 · xấu nhất | 11,52 · 6,84 | 12,41 · 8,41 | 14,67 · 8,06 |
| Chữ mờ / nền-500 · xấu nhất | 6,45 · **3,83** | 11,24 · 7,61 | 7,29 · **4,00** |
| Nút chính: chữ / nền nút | 17,88 | 9,29 | 17,27 |
| Nút chính / nền-500 (nhận diện nút) | 16,82 | 8,71 | 16,22 |
| Chip ok / warn / bad trên nền-500 | 14,78 / 7,63 / 6,28 | 10,12 / 7,48 / 6,27 | 16,22 / 13,41 / 6,70 |
| Lời bài hát / khung lời (nền-700 α 0,9, xấu nhất) | 14,62 | 13,52 | 14,83 |
| Màu chủ đạo bậc 500 làm chữ trên nền-500 | `signal` **4,29** | `son` **4,08** | `uv` **3,83** · `volt` 4,93 |

Hệ quả: (1) chữ mờ của A và C chỉ dùng cho chữ ≥ 18 px hoặc tăng α surface lên 0,90; (2) **không viết chữ thường bằng `signal-500`, `son-500`, `uv-500`** — dùng bậc 300 (`signal-300` 6,28; `son-300` 6,27; `uv-300` 7,42); (3) chữ trắng trên nút đỏ không đạt (`#FFF`/`signal-500` 4,47; `#FFF`/`son-500` 4,63 chỉ vừa qua) → cả ba theme dùng **nút sáng chữ tối**.

Mù màu — mô phỏng Viénot 1999 (protan / deutan), khoảng cách ΔE CIE76; < 20 = dễ lẫn:

| Theme | Cặp dễ lẫn | Thường | Protan | Deutan | Xử lý |
|---|---|---|---|---|---|
| A | `signal-500` ↔ `ember-500` | 48 | 43 | 24 | sát ngưỡng: chip luôn kèm ▲/✕; đèn không mang nghĩa |
| A | `signal-500` ↔ `steel-500` | 90 | 34 | 67 | đỏ **tối đi** với protan → vật mang đỏ phải thêm emissive ≥ 0,6 |
| B | `gold-500` ↔ `amber-500` | 27 | **9** | **6** | không bao giờ dùng cặp này để phân biệt nghĩa; phân biệt bằng độ sáng/hình |
| B | `son-500` ↔ `amber-500` · `son-500` ↔ `gold-500` | 35 · 59 | 30 · 39 | **18** · 20 | chip bad dùng ấn vuông + ✕; warn dùng ▲ |
| B | `jade-300` ↔ `son-300` (ok/bad) | 91 | 34 | 51 | an toàn (lệch độ sáng 10,1 vs 6,3) |
| C | `acid-500` ↔ `sodium-500` (ok/warn) | 44 | **12** | **8** | bắt buộc ký hiệu + mẫu sọc; cân nhắc đổi ok sang `ion-300` |
| C | `volt-500` ↔ `uv-500` | 48 | 30 | **10** | chỉ dùng làm cặp wash, không mã hoá thông tin |
| C | `ion-500` ↔ `frost-500` | 42 | **15** | 27 | chữ phụ `ion-300` phải khác cỡ/kiểu so với chữ chính |

## 4. Kịch bản đèn (mỗi theme là một show khác)
**A — Đêm Bạc** (ngôn ngữ: beam trắng, bóng tối, im lặng trước cú nổ)
- 0–40%: gần blackout; 1 follow-spot `arc-500` bám ca sĩ, backlight `slate-500` thấp; haze mỏng, giàn chỉ thấy silhouette.
- Lightstick 0–40%: 30% số que bật, trắng ấm `tungsten-700`, **không đồng bộ** (như bật lửa).
- Khán đài 0–40%: chấm thưa `steel-300`, lấp lánh kiểu flash điện thoại (mỗi chấm ≤ 1 lần/2 s).
- 40–80%: wash `tungsten-500` từ trước, beam `arc-500` từ sau (đối nhiệt màu ấm/lạnh); beam quạt mở theo phách; đèn rọi trời bật dần.
- Lightstick 40–80%: đồng bộ theo sóng ấm ↔ lạnh quét từ sân khấu ra sau, chu kỳ 2 phách.
- 80–100%: toàn bộ beam trắng + **lần đầu tiên xuất hiện đỏ** (backlight `signal-500` tĩnh, không strobe); blinder `tungsten-300` theo downbeat, ≤ 2 lần/s, tắt dần 0,25 s.
- Khán đài 80–100%: cả vòng trắng, một dải đỏ chạy vòng 1 vòng/8 phách; mây thấp ửng đỏ.
- Max-hype: **blackout 0,4 s → white-out** (additive toàn màn 0,6 trong 0,4 s, vùng lời bị che mặt nạ ≤ 0,25) → secret hiện là vật duy nhất mang rim đỏ trên trời đen; pháo hoa chỉ trắng + đỏ.

**B — Sơn Mài** (ngôn ngữ: đèn lồng, wash ấm, chuyển động chậm như múa)
- 0–40%: đêm trăng chàm; wash `indigo-500`, 4 đèn lồng lớn `amber-700` trên sân khấu, khói thấp `pearl-700` trôi trên sàn.
- Lightstick 0–40%: `jade-700`, đung đưa chậm lệch pha như đom đóm.
- Khán đài 0–40%: chấm `indigo-300` thưa + vài chấm `amber-500` như cửa sổ làng.
- 40–80%: wash `son-500` lên sân khấu, tia `gold-500` hẹp quét chậm (1 lượt/4 phách); **đèn trời bắt đầu bay lên** từ sau khán đài.
- Lightstick 40–80%: đồng bộ `son-500 ↔ gold-500` theo nhịp trống; khán đài thành sóng đỏ–vàng kiểu vảy rồng (hoạ tiết bán nguyệt).
- 80–100%: toàn sân vàng lá; mưa vàng lá (hạt `gold-300`) thay pháo giấy; tia `jade-300` làm màu đối duy nhất; trăng phình 1,15×.
- Khán đài 80–100%: mosaic mây cuộn + hoa sen; lightstick `gold-300` chớp `silk-100` ở downbeat (≤ 2 lần/s).
- Max-hype: hàng trăm đèn trời hội tụ thành cổng; hai rồng `gold-500`/`jade-500` bay qua, thân `pearl` óng ánh; pháo hoa dạng cúc và liễu rủ `gold`/`son`; **không strobe**, cao trào bằng mật độ và độ ấm.

**C — Lưới Laser** (ngôn ngữ: tia mảnh, haze dày, nhịp máy)
- 0–40%: sân khấu chìm trong haze `void-300`; đèn UV `uv-700` làm sọc phản quang trên áo và viền neon tự phát sáng; 2 tia `ion-700` quét chậm.
- Lightstick 0–40%: `volt-700` nhấp chậm kiểu "đang kết nối", ngẫu nhiên từng cụm 20–30 người (ô lưới).
- Khán đài 0–40%: lưới điểm `uv-700` chạy dòng dữ liệu ngang, tốc độ thấp.
- 40–80%: laser quạt `ion-500` từ giàn mái, wash `uv-500`; **lưới laser trời đan dần**; tường LED chạy dạng sóng âm.
- Lightstick 40–80%: pixel-map theo ô 8×8 (khán giả là màn hình): sóng `ion-500 ↔ volt-500` lan đồng tâm từ ca sĩ.
- 80–100%: đổi chủ đạo sang `acid-500`; tia đếm theo 1/2 phách (chuyển cắt cứng nhưng ≤ 3 lần/s); `sodium-500` chớp ở mép giàn như đèn cảnh báo.
- Khán đài 80–100%: equalizer cột dọc toàn vòng theo âm lượng; drone xếp chữ cổ vũ.
- Max-hype: lưới trời "quá tải" → vỡ thành mưa tia rơi 1,2 s → 0,3 s tối → secret xuất hiện với rim `flare-500` (màu ấm duy nhất); khói tên lửa/phản lực được laser cắt lớp thành mặt phẳng sáng.
- Khoá an toàn riêng: bloom kẹp, tổng additive ≤ 1,6; không đảo sáng/tối toàn màn quá 3 lần/s; tuỳ chọn "giảm chớp" hạ mọi cắt cứng thành fade 150 ms.

## 5. Bảng ánh xạ vật thể → token
| Khu | Nhóm vật thể | A Đêm Bạc | B Sơn Mài | C Lưới Laser |
|---|---|---|---|---|
| 1 | Vòm trời, sao | `coal-700→300`; sao thưa `paper-700` | `indigo-700→lacquer-300`; sao `silk-300` | `void-700→300`; không sao, mù `void-100` |
| 1 | Trăng | `paper-500`, nhỏ, cứng nét | `gold-100`, tròn lớn, quầng `amber-700` | `frost-700` mờ sau haze |
| 1 | Hiệu ứng trời > 40% | đèn rọi `arc-500` + mây `steel-700`/`tungsten-700` | đèn trời `amber-500`/`gold-300` + mây `gold-700` | lưới `ion-500` → `acid-500`, drone `frost-300` |
| 1 | Khinh khí cầu + băng rôn | vỏ `steel-500`/`paper-500` sọc; băng `coal-300` chữ `paper-500` | vỏ `son-500`/`silk-500`, tua `gold-500`; băng `lacquer-300` chữ `gold-300` | vỏ `void-300` gân `ion-500`; băng LED `void-500` chữ `acid-500` |
| 1 | ★ Máy bay băng rôn | `steel-300`, băng `paper-500` chữ `signal-500` | `silk-500`, `son-500`, `gold-300` | `void-100`, băng `sodium-500` chữ `void-700` |
| 1 | ★ UFO | `steel-100`, vòm `arc-500`, tia `paper-100` | `pearl-500`, vòm `jade-300`, tia `gold-100` | `void-100`, vòm `ion-300`, tia `acid-300` |
| 1 | ★ Tên lửa + pháo hoa | `paper-500` sọc `signal-500`; pháo `paper-100`/`signal-300` | `silk-500` sọc `son-500`; pháo `gold-300`/`son-300`/`jade-300` | `frost-700` sọc `sodium-500`; pháo `acid-500`/`ion-500`/`uv-300` |
| 1 | ★ Rồng đôi | `steel-300` + `paper-500`, bờm `signal-500` | `gold-500` + `jade-500`, bụng `pearl-300`, vây `son-500` | khung dây `ion-500` + `acid-500`, mắt `flare-500` |
| 1 | ★ Phản lực + tim khói | thân `steel-500`; khói `paper-300`, tim `signal-300` | thân `pearl-700`; khói `son-300`/`gold-300` | thân `void-100`; khói `ion-300`/`acid-300` |
| 2 | Kết cấu khán đài | `coal-300`, mép `steel-700` | `lacquer-300`, lan can `son-700`, mép `gold-700` | `void-300`, mép neon `volt-500` |
| 2 | Chấm khán giả | `hypeColor('stand')`, đỉnh `paper-100` | `hypeColor('stand')`, đỉnh `silk-100` | `hypeColor('stand')`, đỉnh `frost-100` |
| 2 | Cột đèn pha | `steel-500`, bóng `arc-300` (≤ 0,8) | `lacquer-100`, bóng `amber-300` (≤ 0,7) | `void-100`, bóng `ion-100` (≤ 0,8) |
| 2 | 2 màn LED lớn | khung `coal-700`, hình đen trắng, chữ `paper-500` | khung `son-700` nẹp `gold-500`, nền `lacquer-500→son-700` | khung `void-700`, nền `volt-700→uv-700`, chữ `acid-500` |
| 3 | Khán giả sân + lightstick | `CLOTH` A, que `hypeColor('stick')` | `CLOTH` B, que hình đèn lồng | `CLOTH` C + sọc `ion-300`, que dạng thanh |
| 3 | Ca sĩ | áo `paper-500`, trim `steel-100`, micro `signal-500` | áo `son-500`, trim `gold-500`, micro `gold-300` | áo `void-300`, viền neon `acid-500`, micro `frost-500` |
| 3 | Ban nhạc (6) | toàn `coal-300`/`steel-500`; nhạc cụ `steel-100`, 1 chi tiết `signal-700` | trống `son-500`, dây `jade-500`, phím `indigo-500`, bè `silk-700` | thân `void-300`; viền `ion`/`volt`/`uv` mỗi người một màu |
| 3 | Quay phim, drone, cẩu | `coal-300`, tally `signal-500` | `lacquer-100`, tally `son-300` | `void-100`, tally `flare-500` |
| 3 | Giàn mái, tháp, loa | `steel-700`, khớp `steel-500` | `lacquer-300`, đầu cột `son-700`, nẹp `gold-700` | `void-300`, ống neon `ion-700` |
| 3 | Sàn, runway, B-stage | `coal-500` bóng gương, mép `paper-700` | `lacquer-500` bóng sơn, mép `gold-500` | `void-500`, lưới LED `volt-700`, mép `acid-700` |
| 3 | Tường LED sau | sọc trắng/đen, `signal` khi ≥ 80% | hoạ tiết mây, sóng: `son`/`gold`/`indigo` | sóng âm, lưới: `ion`/`uv`/`acid` |
| 3 | Đèn, laser, khói | `hypeColor('light')`; khói `steel-300` | `hypeColor('light')`; khói `pearl-700` | `hypeColor('light')`; khói `void-100` |
| 3 | Pháo giấy | `paper-100` + `steel-100` (+ `signal-300` ≥ 80%) | vàng lá `gold-300`, cánh hoa `son-300` | dải kim tuyến `ion-300`, `acid-300` |
| UI | Lobby, HUD, khung lời, bảng tạm dừng | bảng phẳng góc vuông, thanh Hype trắng → vạch đỏ ở 80% | bảng sơn mài viền kép vàng, thanh Hype `indigo → son → gold` | bảng HUD vát góc, thanh Hype phân đoạn `volt → ion → acid` |

## 6. Xếp hạng của Designer B
| Hạng | Ứng viên | Khác chibi | Dễ đọc | An toàn chớp | Mù màu | Công sức màu/đèn | Lý do |
|---|---|---|---|---|---|---|---|
| 1 | **B Sơn Mài** | rất cao (ấm, nâu đen thay chàm, không hồng) | tốt | **tốt nhất** (không strobe) | trung bình (vàng ↔ cam) | vừa (đèn trời instanced mới) | bản sắc rõ nhất, hợp sẵn rồng/pháo hoa/khinh khí cầu, cao trào bằng mật độ thay vì chớp |
| 2 | **A Đêm Bạc** | rất cao (bỏ gần hết màu) | **tốt nhất** | kém nhất nếu không khoá white-out | tốt (chủ yếu sáng/tối) | thấp (ít token, bỏ viền) | đối cực hoàn toàn với B và với chibi; rẻ nhất; rủi ro "nhạt" trong 0–40% |
| 3 | C Lưới Laser | vừa (vẫn là neon lạnh trên nền tối như bản hiện tại) | tốt | trung bình (cần kẹp bloom) | kém nhất (chanh ↔ vàng, lam ↔ tím) | cao (pixel-map, lưới trời, drone) | ngoạn mục nhất nhưng gần họ màu `soda`/`grape` cũ và tốn GPU additive nhất |

Đề xuất cặp cho giám đốc mỹ thuật: **B + A** (một ấm–trang trí, một lạnh–tối giản; khoảng cách lớn nhất với nhau và với "Kẹo đêm"). Nếu người dùng muốn một theme "công nghệ", thay A bằng C. Lưu ý triển khai chung: đổi `ColorName` thành kiểu theo theme (`Theme = { pal, ink, skin, hair, cloth, secret, stages, zoneSat, ramp, skyFx }`), giữ nguyên chữ ký `hypeColors()` / `auroraAmount()`; `tokens.css` sinh theo `[data-theme]`.

## 7. Câu hỏi
**Cho Designer A (hình khối):**
1. Theme A và C không có viền mực — hình khối của bạn có cần viền để đọc silhouette không, hay rim-light / viền neon là đủ?
2. Tỉ lệ nhân vật ở các hướng mới là bao nhiêu đầu? Da tự nhiên (A) chỉ hợp với tỉ lệ ≥ 5 đầu; da phẳng (B) hợp 3–4 đầu.
3. Vật thay cực quang (đèn rọi + mây / đèn trời / lưới laser + drone) cần hình khối mới — bạn nhận phần mesh, tôi nhận shader và màu?
4. Lightstick đổi hình theo theme (bật lửa/que trắng, đèn lồng, thanh LED) có khả thi trong 2 draw call của khán giả không?
5. Rồng ở theme C là khung dây neon (wireframe) — có mâu thuẫn với ngôn ngữ hình của bạn cho secret không?
6. Motif thay sao/tim/nơ: tôi cần 3 motif mỗi theme để gán màu (gợi ý A: vạch, vòng, tia · B: mây, sen, sóng · C: lưới, tam giác, dạng sóng).

**Cho người dùng (quyết định về gu):**
1. Muốn hai phong cách mới **ấm–truyền thống** (Sơn Mài) và **lạnh–tối giản** (Đêm Bạc), hay ưu tiên một cái **công nghệ/neon** (Lưới Laser)?
2. Có chấp nhận một theme gần như **không màu** (đen–trắng + đỏ) không, hay sân khấu luôn phải rực rỡ?
3. Cực quang là dấu ấn hiện tại — được phép **thay** bằng đèn trời / lưới laser / đèn rọi trong theme mới, hay bắt buộc giữ cực quang ở mọi theme?
4. Chất Á Đông của Sơn Mài nên **đậm Việt Nam** (sơn mài, đèn lồng Hội An, rồng thời Lý) hay Á Đông chung chung?
5. Mức chớp sáng: thích cao trào kiểu rock (blinder trắng, có tuỳ chọn giảm chớp) hay luôn dịu mắt?
6. Người chơi đổi theme ở lobby (cả ba cùng tồn tại) hay theme gắn với từng bài hát/sân khấu?

Nguồn web: [WCAG 2.2 — Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) · [MDN — Seizure disorders](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Seizure_disorders) · [Harman — Color theory for concert lighting](https://pro.harman.com/insights/av/color-theory-for-concert-lighting-design) · [Chauvet — Jacob Collier Djesse tour (một giờ chỉ dùng trắng)](https://chauvetprofessional.com/news/luke-edwards-breaks-rules-on-jacob-colliers-djesse-world-tour-with-chauvet-professional/) · [Shehds — Rock concert lighting design](https://shehds.com/blogs/news/rock-concert-lighting-design) · [daisyUI trends — Synthwave/Outrun](https://trends.daisyui.com/trend/synthwave-outrun/) · [Lospec — bảng màu synthwave](https://lospec.com/palette-list/tag/synthwave)
