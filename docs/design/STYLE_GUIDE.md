# STYLE GUIDE — "Kẹo đêm" chibi (bản chốt)

Tài liệu duy nhất implementer cần đọc. Gộp từ `01`, `02`, `03a`, `03b`. Ảnh xem trước: `style-preview.png`.
Trạng thái: **đã chốt giữa hai designer, chờ người dùng duyệt**; chưa áp dụng vào mã.

## 1. Phong cách trong 5 dòng

1. Mọi thứ là **đồ chơi chibi trong đêm concert**: đầu to, thân ngắn, khối tròn mập, không cạnh sắc.
2. Một bảng màu **"Kẹo đêm"**: nền chàm đêm, hồng dâu chủ đạo, tím nho + xanh soda phụ, vàng/cam/bạc hà để nhấn.
3. Mọi vật thể rắn có **viền `ink`**, tô **2 bậc** (bóng dịch về tím), **1 đốm highlight** kem ở góc trên trái.
4. Chuyển động **mềm**: squash & stretch, xuất hiện bằng "pop"; ba motif lặp lại là **sao, tim, nơ**.
5. **Ca sĩ là tâm điểm**: chỉ người và sinh vật có mặt; sự kiện bí mật là thứ sáng nhất trên trời.

## 2. Màu

### 2.1 Bảng màu gốc (hex theo bậc)

| Token | Tên | Vai trò | 700 bóng | 500 thân | 300 sáng | 100 highlight |
|---|---|---|---|---|---|---|
| `night` | Chàm đêm | nền, kiến trúc | `#0A0818` | `#14102B` | `#2A2350` | `#4A3F82` |
| `berry` | Hồng dâu | **chủ đạo**, ca sĩ, nút chính | `#B8326E` | `#FF5FA8` | `#FF94C4` | `#FFD0E4` |
| `grape` | Tím nho | phụ, viền sáng kiến trúc | `#5238B8` | `#8B6BFF` | `#B5A0FF` | `#DDD4FF` |
| `soda` | Xanh soda | phụ, lightstick | `#1C8FC0` | `#45D9FF` | `#8FE9FF` | `#D2F7FF` |
| `mint` | Bạc hà | nhấn lạnh, cực quang, "tốt" | `#1E9C84` | `#4FE3C1` | `#96F0DA` | `#D6FAF1` |
| `honey` | Vàng mật | nhấn ấm, nốt đúng, sao | `#C48A12` | `#FFD45A` | `#FFE596` | `#FFF5D1` |
| `peach` | Cam đào | nhấn ấm phụ, lửa, cảnh báo | `#C25A2E` | `#FF9A6B` | `#FFBE9E` | `#FFE2D4` |
| `cream` | Kem sữa | chữ, highlight, mắt | `#C9B8A6` | `#FFF4E6` | `#FFFAF3` | `#FFFFFF` |
| `ink` | Mực tím | **viền nét** (màu thứ 9, 1 bậc) | — | `#2B1D5C` | — | — |

Tỉ lệ khung hình 60 / 30 / 10: `night` / `berry + grape + soda` / các màu nhấn. Không dùng màu ngoài bảng.

### 2.2 Da, tóc, áo

| Nhóm | Giá trị |
|---|---|
| `SKIN` (5) | `#FFE0C7` `#F7CBA4` `#E0A57C` `#B87A55` `#8A5A3C`; sàn độ sáng L ≥ 62% |
| `HAIR` (8) | tự nhiên `#2A1F3D` `#4A2F24` `#6B4226` `#C99A5B` `#F6E0A8` (70%); kẹo `#FF94C4` `#8FE9FF` `#B5A0FF` (30%) |
| `CLOTH` khán giả | `berry`, `grape`, `soda`, `mint`, `cream`: 60% bậc 500/300, 40% bậc 700; áo merch `night-300` + chấm `honey-500` |
| Mặt | mắt `ink` + đốm `cream-100`; miệng `berry-700`; má `berry-300` độ mờ 40% |
| Nhuộm theo lightstick | `mix(gốc, màu que, k)`: da 0,12 · tóc 0,22 · áo 0,30 (×1,5 khi Hype > 80%, da tối đa 0,2) |

### 2.3 Ba trạng thái Hype (dùng chung cho đèn, lightstick, khán đài, trời)

| Hype | Đèn sân khấu | Lightstick | Khán đài | Bầu trời |
|---|---|---|---|---|
| 0–40% lạnh | `grape-500` + `soda-700`, 25% đèn | mỗi người một màu bậc 300, sáng 50% | chấm thưa `grape` / `soda` | sao + ngân hà, **không cực quang** |
| 40–80% ấm dần | `berry-500` + `soda-500` + `grape-500`, 60% đèn | đồng bộ `berry-500 ↔ soda-500` theo phách | sóng hồng–xanh | cực quang hiện dần, `mint-500 → soda-500` |
| 80–100% rực | thêm `honey-500` + `peach-500`, 100% đèn | `berry-300` + `honey-300`, chớp `cream` | cả vòng `berry` + `honey` | đủ 4 dải `mint → soda → grape → berry`, mưa sao băng |

Cực quang: `auroraAlpha(h) = smoothstep(0.40, 0.55, h) × mix(0.6, 0.9, smoothstep(0.8, 1, h))` → bằng 0 khi Hype < 40%.
Chuyển trạng thái trộn mượt ±5% quanh mốc. Ba bảng này thay 5 bảng trong `stageDecoPal.ts`. Sóng biển khán giả: đáy `grape-700`, sườn `soda-500`, bọt `cream-100`.

### 2.4 Sự kiện bí mật và chiều sâu

| Quy tắc | Giá trị |
|---|---|
| `SECRET_CORE` / `SECRET_RIM` | `honey-300` `#FFE596` / `mint-500` `#4FE3C1` |
| Độc quyền | chỉ secret được dùng `cream-100` **phát sáng (emissive > 1,0)** |
| Chữ ký secret | vành sáng tròn 1,35 × kích thước lớn nhất, dày 2%, luôn quay về camera, phồng chu kỳ 1,6 s (`SECRET_RIM`) + 4–6 sao quay quanh (`SECRET_CORE`) + pop khi xuất hiện |
| Bão hoà theo khu | khu 3 = 1,0 · khu 2 = 0,75 · khu 1 = 0,6 và dịch hue 8° về `grape`; khinh khí cầu 0,8; **secret và cực quang giữ 1,0** |
| Sương | `night-300`; vật xa nhạt về tím, không về đen |

## 3. Hình khối

| Hạng mục | Quy tắc |
|---|---|
| Tỉ lệ nhân vật | **2,3 đầu** (ca sĩ, ban nhạc, quay phim; H = 1,5 m, đầu rộng 0,46 H, cao 0,42 H); khán giả billboard **2,1 đầu** (bán kính đầu 0,24 chiều cao, cao 1,25–1,45 m). Điểm mắt camera người chơi giữ 1,65 m |
| Thân, tay, chân | thân hình đậu 0,30 H, không cổ; tay 1 capsule 0,26 H (không khuỷu), bàn tay là cầu 0,11 H; chân capsule 0,22 H, bàn chân nửa cầu |
| Mặt | 1 `CanvasTexture` 256 px, atlas 2×2 biểu cảm (thường, hát, cười tít, ngạc nhiên); mắt elip dọc 0,075 × 0,11 H cách nhau 0,17 H; má đĩa 0,07 H. Không dựng mắt bằng mesh |
| Bo tròn | bán kính ≥ 12% cạnh ngắn nhất; khối chính là cầu / capsule / lathe |
| Mập và ngắn | phương tiện dài ≤ 2,2 × đường kính thân; cánh, đuôi, sừng ngắn 40–50% và dày gấp đôi; chi tiết nhỏ nhất ≥ 6% chiều lớn nhất |
| Viền | `ink`, dày 2,5% chiều cao vật thể (secret 3,5%), 1,5–3 px trên màn hình, tắt dưới 24 px, màu trộn dần về màu sương; vật thể trên trời dùng `night-100`; luôn kèm rim sáng |
| Kỹ thuật viền | mesh ít (ca sĩ, secret, phương tiện): inverted hull, +1 draw call · mesh instanced (ban nhạc, quay phim, giàn, loa): fresnel trong shader, +0 · khán giả: từ khoảng cách SDF, +0 · chấm, hạt, chùm sáng: không viền |
| Tô bóng đồ chơi | 2 bậc (500 thân + 700 bóng); ngưỡng mềm 12–18% cho nhân vật, 8–12% cho đạo cụ; highlight `cream-100` cố định, ≤ 8% diện tích, độ mờ 40% (30% khi Hype > 80%); rim `mix(cream-300, màu đèn, 0.7)` cường độ 0,35 (0,5 khi Hype > 80%) |
| Emissive | kiến trúc 0,15 · chi tiết trang trí (trim) 0,6 · lightstick 1,0 · lõi secret 1,6 · viền nét 0 |
| Squash & stretch | nhún theo phách 0,94 / 1,03 ↔ 1,05 / 0,975; nhảy (Hype > 0,6) 0,85 / 1,08 → 1,12 / 0,94 → 0,82 / 1,10, mỗi pha 0,12 s; đầu lắc trễ 60–80 ms, ±8°; phương tiện kéo dài 1,10 khi tăng tốc |
| Pop | mọi thứ xuất hiện 0 → 1,15 → 1,0 trong 0,25 s |
| Motif | **sao** 5 cánh tròn đầu = `honey-500`; **tim** mập = `berry-500`; **nơ / ruy băng** = `soda-500`; viền `ink`, highlight `cream-100`. Mỗi vật thể lớn mang đúng 1 motif. Đầu lightstick (sao / tim / cầu) là nguồn sáng nên lấy màu theo Hype |
| Giới hạn chói | vùng cửa sổ lời: tổng additive ≤ 0,35; ≤ 3 lần chớp toàn màn hình mỗi giây |

## 4. Các điểm hai designer lệch nhau và quyết định cuối

| Điểm | A | B | **Chốt** | Lý do |
|---|---|---|---|---|
| Màu viền | `night-700` | `ink` `#2B1D5C` | **`ink`**; trên trời `night-100` | `night-700` chìm vào nền đêm; `ink` sáng hơn nền nên viền còn đọc được |
| Độ dày viền | 2,5% | 4–6% → 2,5% | **2,5%** (secret 3,5%) | viền dày nuốt tay và mắt ở tỉ lệ 2,3 đầu |
| Ai có mắt | mọi "sinh vật", cả khinh khí cầu, máy bay | chỉ vật thể "diễn" | **Chỉ người và sinh vật**: nhân vật, rồng, trăng, và các phi công / hành khách chibi ngồi trong UFO, tên lửa, máy bay, giỏ khinh khí cầu. Thân phương tiện không có mặt | hơn 12 khuôn mặt trên trời tranh chú ý với ca sĩ |
| Số token mỗi vật thể | cần ≥ 4 cho nhân vật | tối đa 3 | **Đồ vật, kiến trúc: 3** · nhân vật: 3 + `SKIN` + `HAIR` · secret: 3 + `SECRET_CORE` + `SECRET_RIM` | da và tóc là bắt buộc, không phải lựa chọn màu |
| Áo khán giả | bậc 500/300 | bậc 700 | **60% bậc 500/300, 40% bậc 700**; LOD xa (> 35 m) bỏ áo và da, đầu tô màu tóc | toàn bậc 700 thì khối người chìm; toàn da thì sân thành biển màu da |
| Font | chỉ `Baloo 2` | `Baloo 2` + `Nunito` | **`Baloo 2` 700 tự host** cho tiêu đề, số, băng rôn; nội dung `system-ui` | giữ trang gọn nhẹ (một file font) |
| Vị trí token | `src/render/style/chibi.ts` | `src/world/palette.ts` | **`src/world/style/{palette,form,index}.ts`** | khớp cấu trúc `src/zones` + `src/world`; zone chỉ import từ `src/world/style` |
| `cream-100` | dùng cho mắt, highlight | chỉ secret | cấm chỉ áp cho **emissive > 1,0** | đốm mắt không phát sáng nên không tranh với secret |

## 5. Token cho code

### `src/world/style/palette.ts`

| Export | Giá trị |
|---|---|
| `PALETTE` | `Record<'night'\|'berry'\|'grape'\|'soda'\|'mint'\|'honey'\|'peach'\|'cream', Record<700\|500\|300\|100, number>>` theo 2.1 |
| `INK`, `INK_SKY` | `0x2B1D5C`, `0x4A3F82` |
| `SKIN`, `HAIR`, `CLOTH` | mảng theo 2.2 (shader nhận `uSkin[5]`, `uHair[8]`, `uCloth[5]`) |
| `MOTIF` | `{ star: honey-500, heart: berry-500, bow: soda-500 }` |
| `SECRET_CORE`, `SECRET_RIM` | `0xFFE596`, `0x4FE3C1` |
| `HYPE_STAGES` | 3 dòng mục 2.3, mốc 0 / 0,4 / 0,8 |
| `hypeColor(role, hype, k, out)` | `role`: `'light' \| 'stick' \| 'stand' \| 'sky'`; thay `palColor` / `liveColor` |
| `auroraAlpha(hype)` | công thức mục 2.3 |
| `ZONE_SAT` | `{ arena: 1.0, stands: 0.75, outside: 0.6, balloon: 0.8 }` |
| `toCss()` | sinh biến CSS bên dưới từ `PALETTE` |

### `src/world/style/form.ts`

| Hằng | Giá trị |
|---|---|
| `HEADS_MESH`, `HEADS_BILLBOARD` | 2,3 · 2,1 |
| `CHAR_H` | 1,5 (m) |
| `BEVEL_MIN` | 0,12 |
| `OUTLINE` | `{ width: 0.025, secret: 0.035, minPx: 1.5, maxPx: 3, cullPx: 24 }` |
| `TOY` | `{ softChar: [0.12, 0.18], softProp: [0.08, 0.12], rim: 0.35, rimHigh: 0.5, hi: 0.4, hiArea: 0.08 }` |
| `EMISSIVE` | `{ arch: 0.15, trim: 0.6, stick: 1.0, secret: 1.6 }` |
| `SQUASH` | `{ beat: [0.94, 1.03, 1.05, 0.975], jump: [[0.85, 1.08], [1.12, 0.94], [0.82, 1.10]], phase: 0.12 }` |
| `POP` | `{ peak: 1.15, sec: 0.25 }` |
| `VEHICLE_MAX_ASPECT`, `LOD_FAR` | 2,2 · 35 (m, ±3) |
| `SECRET_HALO` | `{ scale: 1.35, width: 0.02, period: 1.6, stars: 5 }` |

### Biến CSS (khối `:root`, không còn hex nào ngoài đây)

`--c-<màu>-<bậc>` cho 8 màu × 4 bậc · `--c-ink` · `--c-ok: mint-500` · `--c-warn: honey-500` · `--c-bad: peach-500` · `--c-note-hit: honey-500` · `--c-note-miss: night-100` · `--surface: rgba(20,16,43,.78)` · `--stroke: rgba(139,107,255,.45)` · `--r-sm: 10px` · `--r-md: 18px` · `--r-pill: 999px` · `--font-display: 'Baloo 2', system-ui, sans-serif`.
Giao diện: nút chính nền `berry-500`, **chữ `night-700`** (chữ trắng trên hồng không đạt tương phản), bóng dưới 4 px `berry-700`; bảng kiểu sticker (viền 2 px, bóng dưới đặc); trạng thái luôn có biểu tượng kèm màu; bỏ cặp đỏ / xanh lá.

## 6. Bảng áp dụng theo ba khu

Công: S < 1 giờ agent · M 1–2 giờ · L > 2 giờ. DC = thay đổi draw call. ★ = secret object.

### Khu 1 — ngoài sân vận động (`src/zones/outside`)

| Vật thể | Hình khối | Token | Ưu tiên | Công | DC |
|---|---|---|---|---|---|
| Vòm trời, sao, ngân hà | sao 4 cánh tròn đầu | `night-700→500`, `cream-300`, `soda-100` | Thấp | S | 0 |
| Sao băng | đầu ngôi sao, đuôi mập ngắn | `cream-100`, đuôi `soda-300` | Thấp | S | 0 |
| Cực quang | không đổi hình; **ẩn dưới Hype 40%** | `mint`, `soda`, `grape`, `berry` (≥ 80%) | **Cao** | S | 0 |
| Trăng | trăng khuyết mập, mặt ngủ, má hồng; đặt đối diện dải cực quang | `cream-500`, `grape-300`, `berry-300` | Vừa | S | 0 |
| Khinh khí cầu (6) | **dời ra sau khán đài xa nhất, phóng to 1,6–2×**; 6 múi phồng; 2 tròn, 2 hình tim, 2 hình sao bo tròn; giỏ tròn có hành khách chibi vẫy tay | 4 kiểu sọc: `berry`/`cream`, `soda`/`cream`, `grape`/`honey`, `mint`/`cream`; băng rôn `night-300` chữ `cream-500` | Cao | M | 0 |
| Máy bay chở khách | bóng mập, 2 đèn to | `night-100`, đèn `peach` / `mint` | Thấp | S | 0 |
| ★ Máy bay kéo băng rôn | 2 tầng cánh đồ chơi, thân trứng, cánh quạt to; phi công quàng khăn bay (nơ); bánh xe tròn; dây có 3 cờ đuôi nheo; băng rôn mép răng cưa tròn, hai đầu thắt nơ | `cream-500`, `berry-500`, `honey-300` | Vừa | S | 0 |
| ★ UFO | đĩa dày (cao 0,35 × đường kính), vòm kính 55%; **phi công chibi vẫy tay**; 8 đèn cầu to chạy đuổi; vành 2 tầng có đinh tán tròn; ăng-ten đầu sao rung theo nhịp; 3 chân cầu; tia hút có vòng tròn chạy xuống, kéo lightstick + tim bay lên; rời đi để lại vòng khói hình sao | `grape-300`, vòm `mint-300`, + CORE / RIM | Cao | M | +1 |
| ★ Tên lửa | tỉ lệ 2,2 : 1, mũi bán cầu; **cửa sổ tròn có phi hành gia**; 2 dải sơn + 1 sao lớn; 3 vây tròn; vòi phun chuông; lửa 3 lớp dạng giọt mập; khói là cục bông tròn; giàn phóng tay giữ bo tròn; pháo hoa nổ thành sao và tim | `cream-500`, `berry-500`, + CORE; pháo `honey` / `berry` / `soda` / `mint` | Cao | M | +1 |
| ★ Rồng | đầu = 2,2 × đường kính thân; 32–36 đốt mập hơn 40%; **mắt to chớp mỗi 3–5 s**, lông mày, sừng tròn, râu capsule lượn sóng, má hồng; bờm chỏm cầu; bụng sáng có vạch; 4 chân ngắn 3 ngón; vảy bán nguyệt trong shader; ngậm ngọc phát sáng; đuôi chùm lông + sao; hơi thở là sao và tim | `honey-500` hoặc `mint-500`, vây `berry-500`, + CORE / RIM | Cao | L | +1 |
| ★ Máy bay phản lực | thân capsule mập, vòm kính lớn thấy phi công đội mũ; cánh tam giác bo đầu; 2 vòi đốt có vòng sáng; số hiệu + sao trên cánh; khói là dải mập mép lượn sóng, rơi ra sao nhỏ; nghiêng cánh chào khi qua sân | `cream-300`, khói `berry-500` / `berry-300` / `soda-500`, + CORE | Cao | M | 0 |

Mọi ★: thêm chữ ký secret (mục 2.4), một khoảnh khắc "diễn" hướng về camera, rời đi để lại 1 motif.

### Khu 2 — khán đài (`src/zones/stands`)

| Vật thể | Hình khối | Token | Ưu tiên | Công | DC |
|---|---|---|---|---|---|
| Kết cấu khán đài | bo mép tầng, lan can thành dải tròn | `night-300`, mép `night-100`, dải `grape-500` | Thấp | S | 0 |
| Chấm khán giả | chấm tròn mềm; giữ sóng, tim mosaic | `hypeColor('stand')`, bọt `cream-100` | Vừa | S | 0 |
| Cột đèn pha | "cây nấm" đầu tròn 6 bóng to | `night-100`, bóng `cream-300` (emissive ≤ 0,8) | Thấp | S | 0 |
| 2 màn hình LED lớn | khung bo tròn dày | khung `night-700`, nền `grape-700 → berry-700`, chữ `cream-500` | Thấp | S | 0 |

### Khu 3 — sân trung tâm (`src/zones/arena`)

| Vật thể | Hình khối | Token | Ưu tiên | Công | DC |
|---|---|---|---|---|---|
| Khán giả sân (8.000) | đầu 0,24, thân đậu, tay 1 đoạn, mặt ở LOD gần, viền SDF, lightstick mập đầu sao / tim / cầu; LOD xa chỉ đầu + thân + que | `CLOTH`, `SKIN`, `HAIR`, que `hypeColor('stick')` | **Cao** | M | 0 |
| Ca sĩ | dựng lại 2,3 đầu, mặt texture, viền inverted hull; gộp ~34 mesh xuống ≤ 8; quầng `cream-300` 0,18 quanh đầu | áo `berry-500`, trim `soda-300`, micro `honey-500` | **Cao** | M | −25 |
| Ban nhạc (6) | cùng khung chibi, nhạc cụ ngắn 30% và mập 30%; viền fresnel | trống `grape`, guitar `soda`, bass `mint`, keyboard `peach`, hát bè `berry-300` | Cao | M | 0 |
| Quay phim, drone, cần cẩu | người chibi tối giản; máy quay to như đồ chơi; drone thân tròn | `night-100`, `grape-300`, tally `peach-500` | Vừa | S | 0 |
| Đạo cụ chào sân | trực thăng hình trứng, đuôi ngắn cong; bục nâng viền tròn; cáp có móc tròn | `night-100`, `berry-500`, đèn rọi `cream-300` | Vừa | M | 0 |
| Giàn mái, tháp, loa, nhạc cụ | ống tròn 0,45 m (chéo 0,22 m), giảm 50% số thanh, khớp cầu 0,6 m, sọc quấn; loa bo 20% màng tròn to; bo mép sàn 0,15 m | `night-300`, khớp `night-100`, sọc `grape-500` | Vừa | M | 0 |
| Sàn, runway, bục, cổng đèn | bo góc chỗ giao; cổng dày gấp đôi, sao trên đỉnh | `night-500`, ô LED `grape-700`, viền `grape-500` | Thấp | S | 0 |
| Tường LED sau sân khấu | giữ; hoạ tiết sao / tim | `night-700`, `grape` / `berry` / `soda`, điểm `honey-300` | Thấp | S | 0 |
| Đèn, laser, khói, pháo hoa | không đổi hình; lấy màu từ `hypeColor('light')` | 3 bảng Hype | **Cao** | S | 0 |
| Pháo giấy | hình sao, tim, ruy băng (atlas 2×2) | 5 màu bậc 500 | Thấp | S | 0 |
| Biểu tượng cảm xúc | đã đúng phong cách; đổi viền sang `ink` | giữ, viền `ink` | Thấp | S | 0 |
| Giao diện HTML | token CSS, `Baloo 2`, nút sticker, icon SVG nét 2,5–3 px đầu tròn, thẻ chào sân vẽ chibi | mục 5 | Vừa | M | — |

## 7. Thứ tự triển khai (gói việc độc lập)

| Gói | Khu | Nội dung | Phụ thuộc | Nghiệm thu nhìn thấy được |
|---|---|---|---|---|
| **G0** | world | `src/world/style/*`, `toCss()`, đổi `stageDecoPal` sang `hypeColor` | — | Test: 0 hex ngoài `palette.ts` và `:root`; đèn đổi 3 trạng thái đúng mốc 40 / 80% |
| **G1** | outside | Cực quang theo `auroraAlpha`, trăng, sao, sao băng, máy bay chở khách | G0 | Hype 30% không có cực quang; 45% hiện mờ; 90% đủ 4 dải |
| **G2** | outside | Khinh khí cầu dời ra sau khán đài, 3 hình + 4 kiểu sọc, hành khách; máy bay kéo băng rôn ★ | G0 | Từ góc ca sĩ đọc được cả 6 băng rôn phía trên khán đài xa |
| **G3** | outside | ★ UFO + ★ tên lửa | G0 | Ảnh góc toàn cảnh: thấy phi công / phi hành gia, vành secret, pháo hình sao và tim |
| **G4** | outside | ★ Rồng + ★ máy bay phản lực | G0 | Rồng chớp mắt, ngậm ngọc; phản lực nghiêng cánh, khói có sao rơi |
| **G5** | stands | Khán đài, chấm, cột đèn nấm, khung màn hình LED | G0 | Khán đài cùng tông với sân; chấm đổi màu đúng 3 trạng thái |
| **G6** | arena | Khán giả sân chibi (shader) | G0 | Hàng gần thấy đầu to, mặt, viền; vẫn 2 draw call |
| **G7** | arena | Ca sĩ + ban nhạc + quay phim | G0 | 4 góc máy ngoài: tỉ lệ 2,3 đầu, mặt đọc được ở 25 m; draw call giảm ≥ 20 |
| **G8** | arena | Giàn, tháp, loa, sàn, runway, cổng, đạo cụ chào sân | G0 | Không còn hộp cạnh sắc trong ảnh góc toàn cảnh |
| **G9** | arena + UI | `style.css` theo token, font, icon; pháo giấy, viền emote | G0 | Màn chờ, HUD, bảng tạm dừng dùng chung nút sticker; chữ đạt tương phản AA |

G0 làm trước; G1–G9 chạy song song (mỗi gói chỉ sửa file trong khu của mình). Thứ tự ưu tiên nếu phải cắt: G0 → G6 → G7 → G1 → G3 → G4 → G2 → G8 → G9 → G5.
