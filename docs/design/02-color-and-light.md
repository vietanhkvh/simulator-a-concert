# 02 — Tông màu chủ đạo và ánh sáng (Designer B, vòng đề xuất 1)

Phạm vi: màu, ánh sáng giả, giao diện HTML. Hình khối chibi do Designer A viết ở `01-*.md`.
Trạng thái: **đề xuất**, chưa áp dụng vào mã. Mọi mã hex dưới đây là giá trị đề nghị.

## 1. Kiểm kê hiện trạng

| Nhóm | Nơi dùng | Màu đang dùng | Nhận xét |
|---|---|---|---|
| Đèn sân khấu | `stageDecoPal.ts` | 5 bảng: cyan+magenta `#00E5FF/#FF1FB4`, hổ phách+đỏ `#FFB000/#FF2A2A`, chanh+tím `#9DFF00/#8A2BFF`, cầu vồng HSL, pop; nền lạnh `#2A5BFF…` | Bão hoà 100%, năm bảng không chung một họ màu; bảng chanh+tím và hổ phách+đỏ lệch hẳn khỏi phần còn lại |
| Lightstick | `crowd.vert.glsl` | hồng `(1,.25,.65)`, xanh `(.25,.75,1)`, tím `(.75,.35,1)`, vàng `(1,.85,.45)`; sóng biển xanh–trắng | Gần với hệ đề xuất nhất, giữ làm gốc |
| Khán giả (thân) | `crowd.frag.glsl` | navy, đỏ rượu, teal, xám, đen; da 2 tông nâu | Rất tối và đục, không có chất "đồ chơi" |
| Ca sĩ | `singer.ts` | áo `#D0207A`, viền `#5FF8FF`, tóc `#F6E7B8`, vàng `#FFD34D` | Hợp tông, chỉ cần quy về token |
| Ban nhạc | `band.ts` | cam `#FF8A2A`, hồng `#FF4F7A`, tím `#B47BFF`, xanh `#2FB6D8/#1D5FD0` | Mỗi người một màu tự do, cam hơi gắt |
| Kiến trúc | `stage.ts`, `stageDeco.ts`, `stageRunway.ts` | giàn xám tím `#8886B8/#9A98C8`, sàn `#14122A…#07060F`, viền `#6A4CFF` | Giàn sáng và xám hơn nền, trông "kim loại thật" chứ không chibi |
| Khinh khí cầu | `backdropBalloons.ts` | 12 màu rời (đỏ, vàng, tím, xanh lá `#22E06B`, xanh dương `#1B6CFF`…) | Nhiều màu nguyên sắc nhất app, lệch tông rõ nhất |
| Khán đài xa | `backdropStadium.ts` | `#FFC24F #FF4FA0 #9A6BFF #4FD6FF #3DFFB0` | Tốt, đã gần hệ đề xuất |
| Sự kiện bí mật | `secret*.ts` | tên lửa cam–đỏ `#FF8A1D/#E0203A`, rồng 6 màu pháo, phản lực `#FF2A48/#FF6FB4/#3AE8FF` | Dùng chung màu với đèn và pháo giấy nên không nổi bật riêng |
| Quay phim | `cameraCrew.ts` | xám `#6C6F7A…`, tally đỏ/xanh lá nguyên sắc | Xám lạnh trung tính, không thuộc họ tím |
| Biểu tượng cảm xúc | `emotesAtlas.ts` | đỏ hồng `#FF2F6D`, vàng `#FFE03A`, cyan `#2FD6FF`, lục `#3BD96B` | Ổn, quy về token |
| Giao diện | `style.css` | `--cs-accent #FF4FA3`, `--cs-accent2 #7C5CFF`, vàng `#FFD34D`; trạng thái `#3DDC84/#FFB347/#FF5C5C`; nền `rgba(8,6,20,.7)` | Chỉ 4 biến, còn ~40 màu viết cứng |

Kết luận: app đã nghiêng về **hồng – tím – cyan trên nền chàm đêm**. Ba chỗ lệch tông chính là khinh khí cầu, giàn/quay phim xám, và hai bảng đèn hổ phách+đỏ, chanh+tím.

## 2. Hệ màu đề xuất: "Kẹo đêm" (Candy Night)

### 2.1 Bảng màu gốc

| Token | Tên | Hex | Vai trò |
|---|---|---|---|
| `night` | Chàm đêm | `#14102B` | Trung tính tối: nền, kiến trúc, bóng |
| `berry` | Hồng dâu | `#FF5FA8` | **Chủ đạo**: thương hiệu, ca sĩ, nút chính |
| `grape` | Tím nho | `#8B6BFF` | Phụ: kiến trúc phát sáng, viền, UI phụ |
| `soda` | Xanh soda | `#45D9FF` | Phụ: lightstick, điểm nhấn lạnh |
| `mint` | Bạc hà | `#4FE3C1` | Nhấn lạnh: trạng thái tốt, cực quang |
| `honey` | Vàng mật | `#FFD45A` | Nhấn ấm: nốt hát đúng, sao, vương miện |
| `peach` | Cam đào | `#FF9A6B` | Nhấn ấm phụ: pháo, lửa, cảnh báo nhẹ |
| `cream` | Kem sữa | `#FFF4E6` | Trung tính sáng: chữ, highlight, mắt |

### 2.2 Thang sáng–tối (bóng / thân / sáng / highlight)

| Token | 700 bóng | 500 thân | 300 sáng | 100 highlight |
|---|---|---|---|---|
| night | `#0A0818` | `#14102B` | `#2A2350` | `#4A3F82` |
| berry | `#B8326E` | `#FF5FA8` | `#FF94C4` | `#FFD0E4` |
| grape | `#5238B8` | `#8B6BFF` | `#B5A0FF` | `#DDD4FF` |
| soda | `#1C8FC0` | `#45D9FF` | `#8FE9FF` | `#D2F7FF` |
| mint | `#1E9C84` | `#4FE3C1` | `#96F0DA` | `#D6FAF1` |
| honey | `#C48A12` | `#FFD45A` | `#FFE596` | `#FFF5D1` |
| peach | `#C25A2E` | `#FF9A6B` | `#FFBE9E` | `#FFE2D4` |
| cream | `#C9B8A6` | `#FFF4E6` | `#FFFAF3` | `#FFFFFF` |

Quy tắc bóng: bóng không pha đen mà **dịch về tím** (bậc 700 đã lệch hue ~10° về phía grape) để giữ chất kẹo.

### 2.3 Quy tắc dùng

- **60 / 30 / 10** trên toàn khung hình: 60% `night` (trời, kiến trúc, sàn), 30% `berry + grape + soda` (nhân vật, đèn, lightstick), 10% `honey / peach / mint / cream` (nhấn).
- Mỗi vật thể dùng **tối đa 3 token**: 1 màu thân, 1 màu phụ, 1 màu nhấn. Không dùng màu ngoài bảng.
- **Nhân vật** (ca sĩ, ban nhạc, quay phim, khán giả): thân bậc 500/300, viền phát sáng bậc 300 của màu phụ.
- **Kiến trúc** (giàn, tháp, khán đài, runway): `night-300/100` cho thân, viền phát sáng `grape-500`. Bỏ xám `#8886B8`.
- **Dành riêng cho sự kiện bí mật**: cặp `honey-300` + `cream-100` làm lõi phát sáng, cộng viền `mint-500`. Không vật thể thường nào được dùng lõi `cream-100` phát sáng, để sự kiện bí mật luôn là thứ sáng nhất trên trời.
- **Da** (4 tông, đều ấm): `#FFE0C7`, `#F2BE96`, `#C98A63`, `#8A5A3C`. Má hồng `berry-300` độ mờ 35% trên mọi tông.
- **Tóc** (6 màu): đen tím `#2A1F3D`, nâu `#6B4226`, vàng kem `#F6E0A8`, hồng `berry-300`, xanh `soda-300`, tím `grape-300`. Khán giả: 70% ba màu tự nhiên, 30% ba màu kẹo.
- **Áo khán giả** (thay 5 màu tối hiện tại): `night-100`, `grape-700`, `soda-700`, `berry-700`, `cream-700`; áo merch `night-300` có chấm logo `honey-500`.

### 2.4 Bảng màu theo Hype (thống nhất mọi khu)

| Hype | Tên trạng thái | Đèn sân khấu | Lightstick | Khán đài xa | Bầu trời |
|---|---|---|---|---|---|
| 0–40% | Lạnh, dịu | `grape-500` + `soda-700`, 25% đèn bật | mỗi người một màu, bậc 300, sáng 50% | chấm thưa `grape/soda` | `night` + sao + ngân hà. **Không có cực quang** |
| 40–80% | Ấm dần | `berry-500` + `soda-500` + `grape-500`, 60% đèn | đồng bộ `berry-500 ↔ soda-500` theo phách | sóng hồng–xanh | Cực quang **hiện dần** từ 40% (alpha 0→0,6 trong khoảng 40–55%), màu `mint-500 → soda-500` |
| 80–100% | Rực rỡ | thêm `honey-500` + `peach-500`, 100% đèn, chase nhanh | `berry-300` + `honey-300` chớp trắng `cream` ở phách | cả vòng `berry + honey` | Cực quang đủ 4 dải `mint → soda → grape → berry`, alpha 0,9, mưa sao băng `cream` |

Thay 5 bảng trong `stageDecoPal.ts` bằng 3 bảng trên; cầu vồng HSL chỉ còn dùng cho pháo giấy và chase "HYPE MAX".
Sóng biển của khán giả giữ nguyên ý nhưng quy về token: đáy `grape-700`, sườn `soda-500`, bọt `cream-100`.

### 2.5 Ánh sáng giả cho vật liệu "đồ chơi"

| Thuộc tính | Giá trị |
|---|---|
| Kiểu tô | 2 bậc (thân 500 + bóng 700) với ngưỡng mềm 8–12%, không có bóng đổ thật |
| Rim light | mặt quay khỏi camera viền `cream-300` độ mạnh 0,35; ở Hype > 80% viền đổi sang màu đèn hiện tại |
| Highlight | 1 đốm bóng `cream-100` ở góc trên trái, chiếm ≤ 8% diện tích mặt |
| Bão hoà (HSL S) | thân 75–90%; nền/kiến trúc ≤ 45%; chỉ hiệu ứng mới 100% |
| Emissive | kiến trúc 0,15; viền nhân vật 0,6; lightstick 1,0; lõi sự kiện bí mật 1,6 |
| Độ sáng tối thiểu | mọi nhân vật có L ≥ 35% để tách khỏi nền `night` (L 12%) → tương phản khối ≥ 3:1 |
| Sương | `FogExp2` đổi màu sang `night-300 #2A2350`, vật ở xa nhạt về tím chứ không về đen |
| Giới hạn chói | Vùng cửa sổ lời (mặc định 1/3 dưới giữa): tổng additive ≤ 0,35; tia laser và blinder giảm 50% khi đi qua vùng này. Không khung hình nào có > 25% điểm ảnh ở L > 85% |
| Chớp | ≤ 3 lần chớp toàn màn hình mỗi giây (an toàn động kinh cảm quang) |

### 2.6 Tương phản và mù màu

Tỉ lệ tương phản ước tính trên nền `night-500 #14102B` (tính theo công thức WCAG, chưa đo bằng công cụ):

| Cặp chữ / nền | Tỉ lệ | AA chữ thường (4,5) |
|---|---|---|
| `cream-500` / `night-500` | ≈ 16,5 : 1 | Đạt |
| `honey-500` / `night-500` | ≈ 12,5 : 1 | Đạt |
| `mint-500` / `night-500` | ≈ 11 : 1 | Đạt |
| `soda-500` / `night-500` | ≈ 10,5 : 1 | Đạt |
| `berry-500` / `night-500` | ≈ 6,5 : 1 | Đạt |
| `grape-500` / `night-500` | ≈ 4,6 : 1 | Đạt sát ngưỡng → chữ nhỏ dùng `grape-300` |
| `night-500` / `berry-500` (chữ trên nút) | ≈ 6,5 : 1 | Đạt; **chữ trắng trên berry chỉ ≈ 2,7 : 1, không đạt** → nút chính dùng chữ `night-700` |

Cặp màu mang ý nghĩa không được chỉ dựa vào màu:

| Ý nghĩa | Màu | Tín hiệu thứ hai |
|---|---|---|
| Nốt hát đúng | `honey-500` tô đặc | thanh nốt đầy + lấp lánh |
| Nốt hát sai / bỏ | `night-100` viền `cream-700` | thanh nốt rỗng, viền đứt nét |
| Nốt vàng (điểm đôi) | `honey-300` | biểu tượng ngôi sao ở đầu thanh |
| Micro thật | `mint-500` | biểu tượng micro + dấu tích |
| Micro giả | `honey-500` | biểu tượng robot |
| Không có micro | `peach-500` | biểu tượng micro gạch chéo |

Bỏ cặp đỏ `#FF5C5C` / xanh lá `#3DDC84` hiện tại: hai màu này lẫn nhau với người mù màu đỏ–lục. `mint` và `peach` khác nhau cả về độ sáng (L 60% và 71%) lẫn trục xanh–vàng.

## 3. Giao diện HTML

| Thuộc tính | Hiện tại | Đề xuất |
|---|---|---|
| Font | `system-ui` | Tiêu đề: `'Baloo 2'` 700–800 (bo tròn, có đủ dấu tiếng Việt); nội dung: `'Nunito'` 600–700; dự phòng `system-ui`. Tự host file font, không gọi mạng lúc chơi |
| Bo góc | 12 px / 999 px lẫn lộn | 3 bậc: `--r-sm 10px`, `--r-md 18px`, `--r-pill 999px` |
| Nền bảng | `rgba(8,6,20,.7)` | `rgba(20,16,43,.78)` + viền 2 px `grape-500` độ mờ 45% + bóng ngoài `0 6px 0 night-700` (kiểu sticker) |
| Nút chính | gradient tím→hồng, chữ trắng | nền `berry-500`, chữ `night-700`, bóng dưới 4 px `berry-700`, nhấn lún 2 px |
| Nút phụ | viền trắng mờ | nền `night-300`, chữ `cream-500`, viền `grape-500` |
| Phím bấm (hướng dẫn) | chip xám | nền `cream-500`, chữ `night-500`, bóng dưới 3 px `cream-700` |
| Thanh Hype | gradient xanh→hồng→cam | 3 đoạn khớp mục 2.4: `soda` → `berry` → `honey`, mốc 40% và 80% có vạch |
| Icon | ký tự Unicode (⏪ ❚❚ ▶) | bộ SVG nét tròn 2,5 px, đầu bo, cùng một lưới 24 px |
| Chuyển động | 0,15–0,4 s tuyến tính | nảy nhẹ `cubic-bezier(.34,1.56,.64,1)` 180 ms cho nút và thẻ |

Biến CSS đề xuất thay cho 4 biến hiện có (đổi tên từ `--cs-accent`, `--cs-accent2`, `--cs-sung`, `--cs-gold`):

```
--c-night-700/500/300/100   --c-berry-700/500/300/100   --c-grape-…   --c-soda-…
--c-mint-…   --c-honey-…   --c-peach-…   --c-cream-…
--c-ok: var(--c-mint-500)   --c-warn: var(--c-honey-500)   --c-bad: var(--c-peach-500)
--c-note-hit: var(--c-honey-500)   --c-note-miss: var(--c-night-100)
--surface: rgba(20,16,43,.78)   --stroke: rgba(139,107,255,.45)
--r-sm: 10px   --r-md: 18px   --r-pill: 999px
--font-display: 'Baloo 2', system-ui, sans-serif   --font-body: 'Nunito', system-ui, sans-serif
```

Việc cần làm trong `style.css`: thay toàn bộ màu viết cứng (~40 giá trị) bằng biến; không còn mã hex nào ngoài khối `:root`.

## 4. Format chung dạng token cho code (đặc tả `src/world/palette.ts`, chưa tạo)

| Export | Kiểu | Nội dung |
|---|---|---|
| `PALETTE` | `Record<Hue, Record<700\|500\|300\|100, number>>` | bảng mục 2.2, hex dạng số |
| `SKIN`, `HAIR`, `CLOTH` | `number[]` | mục 2.3 |
| `HYPE_STAGES` | `{ from: number; to: number; lights: Hue[]; sticks: Hue[]; sky: Hue[] }[]` | 3 dòng mục 2.4 với mốc 0 / 0,4 / 0,8 |
| `hypeColor(role, hype, k, out)` | hàm | trả màu cho vai `'light' \| 'stick' \| 'stand' \| 'sky'`, trộn mượt ±5% quanh mỗi mốc; thay `palColor`/`liveColor` |
| `auroraAlpha(hype)` | hàm | `smoothstep(0.40, 0.55, hype) * mix(0.6, 0.9, smoothstep(0.8, 1, hype))` |
| `SECRET_CORE`, `SECRET_RIM` | `number` | `honey-300`, `mint-500` (mục 2.3) |
| `TOY` | hằng | ngưỡng bóng 0,1; rim 0,35; emissive theo loại (mục 2.5) |
| `toCss()` | hàm | sinh chuỗi biến CSS mục 3 để một nguồn duy nhất cấp màu cho cả WebGL lẫn HTML |

Shader GLSL nhận màu qua uniform lấy từ `PALETTE`, không viết `vec3(...)` màu cứng trong file `.glsl`.

## 5. Áp dụng theo ba khu vực

### Khu 1 — Ngoài sân vận động

| Vật thể | Thân | Phụ | Nhấn |
|---|---|---|---|
| Vòm trời | `night-700 → night-500` | chân trời `grape-700` | — |
| Sao, ngân hà | `cream-300` | `soda-100`, `honey-100` | sao lớn `cream-100` |
| Sao băng | `cream-100` | đuôi `soda-300` | — |
| Cực quang (Hype ≥ 40%) | `mint-500` | `soda-500`, `grape-500` | `berry-500` (≥ 80%) |
| Mặt trăng | `cream-500` | bóng `grape-300` | — |
| Khinh khí cầu (6 quả) | sọc `berry-500`/`cream-500`, `soda-500`/`cream-500`, `grape-500`/`honey-500` (lặp lại) | giỏ `peach-700` | băng rôn nền `night-300`, chữ `cream-500` |
| Máy bay kéo băng rôn | `cream-500` | `berry-500` | đèn `honey-300` |
| Máy bay chở khách | `night-100` | — | đèn `peach-500`/`mint-500`/`cream-100` |
| Trực thăng (chào sân) | `night-100` | `berry-500` | đèn rọi `cream-300` |
| Tên lửa (bí mật) | `cream-500` | `berry-500` | lõi lửa `SECRET_CORE`, pháo `honey/berry/soda/mint` |
| Phản lực (bí mật) | `cream-300` | khói `berry-500`, `berry-300`, `soda-500` | lõi `SECRET_CORE` |
| UFO (bí mật) | `grape-300` | vòm `mint-300` | chùm sáng `SECRET_RIM`, lõi `SECRET_CORE` |
| Rồng (bí mật) | `honey-500` hoặc `mint-500` | vây `berry-500` | mắt và lửa `SECRET_CORE` |

### Khu 2 — Khán đài

| Vật thể | Thân | Phụ | Nhấn |
|---|---|---|---|
| Kết cấu khán đài | `night-300` | mép tầng `night-100` | dải đèn `grape-500` |
| Chấm lightstick khán đài | theo `hypeColor('stand')` | — | bọt sóng `cream-100` |
| Cột đèn pha | `night-100` | — | bóng đèn `cream-300` (emissive ≤ 0,8) |
| Màn hình LED lớn | khung `night-700` | nền `grape-700 → berry-700` | chữ `cream-500` |

### Khu 3 — Sân trung tâm

| Vật thể | Thân | Phụ | Nhấn |
|---|---|---|---|
| Ca sĩ (người chơi) | áo `berry-500` | viền `soda-300` | tóc `cream`/vàng kem, micro `honey-500` |
| Trống | `grape-500` | `cream-500` | chũm choẹ `honey-500` |
| Guitar | `soda-500` | `cream-500` | `honey-500` |
| Bass | `mint-500` | `night-100` | `berry-300` |
| Keyboard | `peach-500` | `cream-500` | `grape-300` |
| Hát bè (2) | `berry-300` | `grape-300` | `cream-500` |
| Quay phim, drone, cần cẩu | `night-100` | `grape-300` | đèn tally `peach-500` |
| Khán giả | `CLOTH` (mục 2.3) | da `SKIN`, tóc `HAIR` | lightstick theo `hypeColor('stick')` |
| Sàn sân khấu, runway, bục | `night-500` | ô LED `grape-700` | viền `grape-500`, chase theo `hypeColor('light')` |
| Giàn mái, tháp, loa | `night-300` | khớp nối `night-100` | dải pixel theo `hypeColor('light')` |
| Tường LED sau sân khấu | `night-700` | hoạ tiết `grape/berry/soda` | điểm sáng `honey-300` |
| Pháo giấy, biểu tượng cảm xúc | `berry`, `honey`, `soda`, `mint`, `grape` bậc 500 | viền `night-700` | highlight `cream-100` |
| Laser, tia lửa, khói | theo `hypeColor('light')` | tia lửa `honey-300 → peach-500` | — |

## 6. Điểm cần Designer A phản hồi

1. **Viền nét**: A định dùng viền đậm quanh nhân vật chibi không? Nếu có, tôi đề nghị viền `night-700` dày 4–6% chiều cao nhân vật; nếu không, rim light `cream-300` phải mạnh hơn (0,5).
2. **Tỉ lệ đầu–thân** ảnh hưởng diện tích màu: đầu to nghĩa là màu da và tóc chiếm phần lớn khối. A chốt tỉ lệ (2 đầu hay 2,5 đầu) để tôi cân lại bảng `SKIN`/`HAIR` so với `CLOTH`.
3. **Khán giả 8.000 billboard**: ở xa chỉ còn 1–2 màu mỗi người. A có đồng ý LOD xa chỉ giữ màu tóc + màu lightstick, bỏ màu áo không?
4. **Sự kiện bí mật**: tôi dành riêng lõi `cream-100` phát sáng cho nhóm này. Hình khối của A có cần thêm một dấu hiệu chung (ví dụ vành sáng tròn quanh vật thể) để nhận ra "bí mật" kể cả khi màu bị đèn át?
5. **Kiến trúc**: giàn mái hiện là thanh mảnh kiểu thật. Nếu A đổi sang ống tròn mập kiểu đồ chơi thì thân `night-300` có thể quá tối trên trời đêm; khi đó tôi đề nghị thêm sọc `grape-500` quấn quanh ống.
