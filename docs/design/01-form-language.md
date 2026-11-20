# Ngôn ngữ hình khối chibi — đề xuất vòng 1 (Designer A)

Phạm vi: hình khối và chuyển động của mọi vật thể. Màu sắc và ánh sáng do Designer B phụ trách (`02-*.md`).
Ràng buộc kỹ thuật: dựng hình thủ tục bằng three.js, không có file model ngoài, không đèn thật (vật liệu `MeshBasic` / shader), ngân sách hiện tại khoảng 56–79 draw call mỗi khung hình.

## 1. Kiểm kê vật thể hiện có

Thang "mức chibi": 0 = tả thực/kỹ thuật, 1 = low-poly trung tính, 2 = đã hơi dễ thương, 3 = đúng chibi.

| Khu | Vật thể | File (`src/render/`) | Cách dựng hiện tại | Mức chibi |
|---|---|---|---|---|
| 3 | Ca sĩ | `singer.ts` | ~34 mesh hộp/trụ/cầu, cao 1,75 m, đầu ≈ 1/3,6 thân | 1 |
| 3 | Ban nhạc (6 người) | `band.ts` | 1 skinned mesh gộp, cùng tỉ lệ ca sĩ | 1 |
| 3 | Khán giả sân (8.000) | `crowd.ts`, `crowd.*.glsl` | Billboard instanced, hình người vẽ bằng SDF trong fragment shader, đầu ≈ 1/7 thân | 0–1 |
| 3 | Lightstick, đèn flash | `crowd.frag.glsl` | SDF capsule + quầng sáng | 1 |
| 3 | Đội quay phim, dolly, cần cẩu, drone | `cameraCrew.ts` | 3 instanced mesh hộp/trụ | 0–1 |
| 3 | Sân khấu, mái giàn, tháp, loa, tháp LED, nhạc cụ, hàng rào | `stage.ts`, `stageDeco*.ts` | Hộp/trụ gộp, giàn thanh mảnh | 0 |
| 3 | Runway, bục, cổng đèn | `stageRunway.ts`, `walkLayout.ts` | Mặt phẳng + viền phát sáng | 0 |
| 3 | Đèn (chùm sáng, PAR, rèm đèn), laser, pháo hoa sân khấu, khói | `lights.ts`, `stageDecoFixtures.ts`, `stageFx.ts` | Nón/đĩa additive, Points | 1 (trung tính) |
| 3 | Pháo giấy | `confetti.ts` | Points vuông | 1 |
| 3 | Biểu tượng cảm xúc (34 kiểu) | `emotes.ts`, `emotesAtlas.ts` | Points + atlas vẽ canvas, có viền đậm | 3 |
| 3 | Đạo cụ chào sân: trực thăng, dù, cáp, bục nâng | `entrance.ts`, `entranceProps.ts` | Hộp/trụ/cầu, ~11 mesh | 0–1 |
| 3 | Tường LED, 2 màn hình LED | `backdrop.ts`, `ledScreens.ts` | Mặt phẳng + shader / canvas | 1 |
| 2 | Khán đài 3 tầng, cột đèn pha | `backdropStadium.ts` | Mesh vành cong tối + đĩa sáng | 0 |
| 2 | Khán giả khán đài (26.000 chấm) | `backdropStadium.ts` | 1 Points | — (chấm) |
| 1 | Khinh khí cầu + băng rôn | `backdropBalloons.ts` | Lathe sọc + giỏ hộp + băng rôn canvas | 2 |
| 1 | Máy bay chở khách, đèn drone | `backdropSky.ts` | Bóng nhỏ + đèn nháy | 0 |
| 1 | Máy bay cánh quạt kéo băng rôn, khinh khí cầu bay qua | `backdropFlyby.ts` | Lathe + hộp + băng rôn shader | 1 |
| 1 | UFO | `secretUfo.ts` | Lathe đĩa + vòm cầu + vòng đèn, 4 draw call | 2 |
| 1 | Tên lửa + giàn phóng + pháo hoa | `secretRocket.ts` | Trụ + hộp cánh, Points | 1 |
| 1 | Rồng | `secretDragon.ts` | 56 đốt instanced + đầu gộp (cầu, nón, hộp) | 1 |
| 1 | Máy bay phản lực + khói | `secretJet.ts` | Trụ + nón + hộp cánh, ribbon khói | 0–1 |
| 1 | Sao, sao băng, dải ngân hà, trăng, cực quang | `backdropSky.ts` | Points, quad instanced, shader vòm | 1 (trung tính) |
| UI | Màn chờ, thẻ chào sân, HUD, bảng tạm dừng, hướng dẫn phím, cửa sổ lời | `src/ui/*.ts`, `style.css` | HTML/CSS bo tròn dạng viên thuốc, pictogram SVG nét mảnh | 1–2 |

Nhận xét: chỉ biểu tượng cảm xúc và khinh khí cầu đã gần phong cách đích. Nhân vật có tỉ lệ người thật, phương tiện và kết cấu là hộp cạnh sắc.

## 2. Bộ quy tắc hình khối dùng chung

### 2.1 Bảy quy tắc gốc (áp dụng cho mọi vật thể)

| # | Quy tắc | Con số |
|---|---|---|
| R1 | Đầu to, thân ngắn | Nhân vật cao 2,2–2,5 "đầu" (đầu : thân+chân ≈ 1 : 1,2–1,5) |
| R2 | Không cạnh sắc | Bán kính bo ≥ 12% cạnh ngắn nhất; khối chính là cầu, capsule, lathe; hộp chỉ dùng khi đã bo |
| R3 | Mập và ngắn | Phương tiện: dài ≤ 2,2 × đường kính thân (hiện 4–6×); chi tiết nhô ra (cánh, đuôi, sừng) ngắn 40–50% và dày gấp đôi |
| R4 | Ít chi tiết, chi tiết to | Mỗi vật thể tối đa 3 cấp chi tiết: khối chính, 2–4 khối phụ, 3–6 điểm nhấn. Chi tiết nhỏ nhất ≥ 6% chiều lớn nhất |
| R5 | Mặt ở mọi nơi hợp lý | Nhân vật và "sinh vật" (rồng, UFO, khinh khí cầu, máy bay) có mắt; đồ vật tĩnh (loa, giàn) thì không |
| R6 | Viền + bóng đồ chơi | Viền tối quanh bóng vật thể và 1 vệt highlight trắng mềm ở góc trên trái |
| R7 | Mềm khi chuyển động | Squash & stretch bảo toàn thể tích, biên độ theo bảng 2.5 |

### 2.2 Nhân vật (ca sĩ, ban nhạc, quay phim)

| Bộ phận | Quy cách (chiều cao tổng H = 1,5 m cho người lớn chibi; giữ điểm mắt người chơi 1,65 m riêng cho camera) |
|---|---|
| Đầu | Cầu hơi dẹt: rộng 0,46 H, cao 0,42 H, sâu 0,42 H |
| Thân | Capsule/đậu: cao 0,30 H, rộng 0,30 H, không cổ (đầu ngồi thẳng lên thân, lún 0,03 H) |
| Chân | 2 capsule ngắn: dài 0,22 H, đường kính 0,13 H; bàn chân là nửa cầu 0,15 H |
| Tay | Capsule 1 đoạn (không khuỷu) dài 0,26 H, đường kính 0,10 H; bàn tay là cầu 0,11 H, không ngón |
| Mắt | 2 elip dọc: cao 0,11 H, rộng 0,075 H, cách nhau 0,17 H, đặt ở 45% chiều cao đầu tính từ cằm; mỗi mắt 1 đốm sáng trắng 25% ở góc trên |
| Miệng | Cung nhỏ rộng 0,06 H ngay dưới đường mắt 0,05 H; khi hát mở thành elip cao tới 0,06 H theo `beatPulse` |
| Má | 2 đĩa hồng đường kính 0,07 H, độ trong 50%, dưới ngoài mắt |
| Tóc | 1–3 khối cầu/nửa cầu lớn phủ 55–65% đầu, 1 chỏm tóc hoặc phụ kiện nhận diện (nơ, mũ, tai nghe) |
| Phụ kiện | To bất cân đối: micro có đầu cầu đường kính 0,14 H; nhạc cụ thu ngắn 30%, thân mập hơn 30% |

Cách vẽ mặt: một `CanvasTexture` 256 px dán lên mặt trước đầu (mắt, miệng, má trong cùng texture), 4 biểu cảm xếp thành atlas 2×2 (thường, hát, cười tít, ngạc nhiên) và chọn bằng UV offset. Không dựng mắt bằng mesh.

### 2.3 Khán giả billboard (shader SDF)

| Hạng mục | Hiện tại | Chibi |
|---|---|---|
| Tỉ lệ đầu | Bán kính đầu ≈ 0,11 chiều cao | Bán kính đầu 0,23–0,25 chiều cao; tâm đầu ở 0,72 chiều cao |
| Thân | 2 hộp bo + quần có khe chân | 1 hình đậu (`sdRoundBox` bo 45% bề rộng) cao 0,34; chân là 2 capsule ngắn 0,16, bỏ khe chân |
| Tay | 2 đoạn có khuỷu | 1 capsule mỗi tay, bán kính 0,06; bàn tay là đĩa bán kính 0,075 |
| Mặt (chỉ LOD gần, < 35 m, và chỉ khi quay mặt về camera) | Không có | 2 chấm mắt elip (0,035 × 0,05) + má hồng; miệng mở khi nhảy (`uHype` > 0,6). Chi phí: 2 phép `length` |
| Tóc | 4 kiểu | Giữ 4 kiểu nhưng phóng to theo đầu; thêm 2 kiểu có phụ kiện (băng đô tai mèo, mũ len) |
| Lightstick | Capsule mảnh | Ngắn 30%, mập gấp đôi, đầu là ngôi sao / trái tim / cầu (3 biến thể theo seed) |
| LOD xa | Bóng người đơn giản | Chỉ đầu tròn + thân đậu + que sáng; không mặt |
| Viền | Rim màu lightstick | Thêm viền tối 1,5 px bằng `smoothstep` trên khoảng cách SDF (rẻ, đã có sẵn khoảng cách) |

Chiều cao khán giả giảm còn 1,25–1,45 m (trước 1,55–1,85) để đầu to không che hàng sau; tăng độ dốc sàn nếu cần.

### 2.4 Phương tiện, đạo cụ, công trình

| Loại | Quy tắc phóng đại |
|---|---|
| Máy bay, phản lực | Thân là 1 capsule mập (dài 2,0 × đường kính), mũi tròn; cánh ngắn bằng 0,8 chiều dài thân, dày 12%, đầu cánh bo tròn; đuôi đứng to 130%; buồng lái là vòm kính chiếm 35% thân; 2 mắt trên kính lái |
| Trực thăng | Thân hình quả trứng (dài 1,4 × cao), đuôi ngắn 50% và cong lên, cánh quạt là 2 lá bầu dục dày; càng đáp là 2 ống cong tròn |
| Tên lửa | Tỉ lệ dài : đường kính 2,2 : 1 (hiện ~6 : 1), mũi bán cầu, 3 cánh đuôi tròn như vây cá, 1 cửa sổ tròn to có viền, vòi phun loe hình chuông |
| UFO | Đĩa dày hơn (cao 0,35 × đường kính), vòm kính to 55% đường kính, bên trong có phi công chibi nhỏ; đèn vòng là 8 quả cầu to thay vì nhiều chấm nhỏ; 3 chân cầu |
| Rồng | Đầu to gấp 2,2 đường kính thân; thân ngắn còn 32–36 đốt, mập hơn 40%; mắt tròn to (30% bề ngang đầu) có đốm sáng; sừng ngắn bo tròn; má hồng; chân ngắn 4 chiếc dạng cầu; đuôi kết thúc bằng chùm lông tròn hoặc ngôi sao |
| Khinh khí cầu | Vỏ tròn hơn (rộng = 0,95 cao), 6 múi phồng, giỏ bo tròn có 1–2 hành khách chibi vẫy tay; mặt cười nhẹ trên vỏ là tuỳ chọn |
| Sân khấu, giàn, loa | Thanh giàn dày gấp 2 và giảm 50% số thanh; trụ tháp tròn; loa là hộp bo 20% với màng loa tròn to; nhạc cụ thu ngắn và mập; cạnh sàn bo 0,15 m |
| Khán đài | Giữ tối giản; bo mép tầng, cột đèn pha thành "cây nấm" đầu tròn 6 bóng to thay vì lưới nhiều bóng nhỏ |
| Vật ở rất xa (chấm khán đài, sao) | Không chibi hoá hình; chỉ làm chấm tròn mềm, sao 4 cánh tròn đầu; sao băng đầu tròn to, đuôi ngắn và mập |

### 2.5 Chuyển động (squash & stretch)

| Tình huống | Biên độ (trục dọc / trục ngang, bảo toàn thể tích) | Thời lượng |
|---|---|---|
| Nhún theo nhịp (nhân vật, khán giả) | 0,94 / 1,03 ở đáy, 1,05 / 0,975 ở đỉnh | 1 phách |
| Nhảy khi Hype > 0,6 | Lấy đà 0,85 / 1,08 → bay 1,12 / 0,94 → chạm đất 0,82 / 1,10 | 0,12 s mỗi pha |
| Đầu | Lắc trễ 60–80 ms sau thân, biên độ ±8° | liên tục |
| Phương tiện bay | Kéo dài 1,10 theo hướng bay khi tăng tốc, phồng 1,06 khi lơ lửng (chu kỳ 1,6 s) | — |
| Xuất hiện / biến mất | Pop: 0 → 1,15 → 1,0 | 0,25 s |
| Rồng | Sóng thân giữ nguyên; thêm nhịp "thở" phồng 5% dọc thân | 2 s |

### 2.6 Viền và highlight

| Đối tượng | Kỹ thuật viền | Lý do |
|---|---|---|
| Mesh ít (ca sĩ, ban nhạc, secret, phương tiện) | Inverted hull: bản sao lật mặt, đẩy theo pháp tuyến 2–3% kích thước, màu tối. Gộp vào cùng geometry bằng nhóm vật liệu thì thêm 1 draw call mỗi vật thể | Đẹp nhất, ổn định ở mọi góc |
| Mesh instanced nhiều (quay phim, giàn, loa) | Fresnel rim tối trong fragment shader (`1 - dot(N, V)`), không thêm draw call | Rẻ |
| Khán giả billboard | Viền từ khoảng cách SDF | Miễn phí |
| Chấm, hạt, chùm sáng | Không viền | Là ánh sáng, không phải vật thể |

Độ dày viền trên màn hình: 1,5–3 px ở gần, tắt dần khi vật thể nhỏ hơn 24 px. Highlight: 1 elip trắng mềm, diện tích 6–8% mặt nhìn thấy, đặt góc trên trái, độ trong 35–45%; làm bằng `dot(N, L cố định)` trong shader hoặc vẽ sẵn vào texture.

### 2.7 "Chữ ký" hình ảnh lặp lại

Ba motif, dùng lặp ở mọi khu để app nhìn là một bộ: **ngôi sao 5 cánh tròn đầu** (đầu lightstick, đuôi rồng, mũi tên lửa, logo bục tròn), **trái tim mập** (khói phản lực, má, cửa sổ UFO), **nơ / dải ruy băng** (băng rôn, đuôi khinh khí cầu, tóc hát bè). Mỗi vật thể lớn mang đúng 1 motif. Bán kính bo và độ dày viền dùng chung một bộ hằng số (đề xuất file `src/render/style/chibi.ts`) để mọi module import.

## 3. Bảng áp dụng theo khu vực

Công: S < 1 giờ agent, M 1–2 giờ, L > 2 giờ. Draw call là thay đổi so với hiện tại.

### Khu 3 — sân trung tâm (gần nhất)

| Vật thể | Thay đổi hình khối | Ưu tiên | Công | Draw call |
|---|---|---|---|---|
| Khán giả sân | Tỉ lệ đầu 0,24, thân đậu, tay 1 đoạn, mặt ở LOD gần, viền SDF, lightstick mập có đầu sao/tim | Cao | M | 0 |
| Ca sĩ | Dựng lại theo 2.2; gộp phần tĩnh để từ ~34 mesh xuống ≤ 8; mặt bằng texture; viền inverted hull | Cao | M | −25 |
| Ban nhạc | Cùng khung xương chibi với ca sĩ (đổi tỉ lệ xương + geometry), nhạc cụ mập; viền bằng fresnel | Cao | M | 0 |
| Quay phim, drone, cần cẩu | Người theo 2.2 bản tối giản; máy quay to như đồ chơi, ống kính tròn lớn; drone thân tròn 4 cánh quạt đĩa, có mắt | Vừa | S | 0 |
| Đạo cụ chào sân | Trực thăng trứng, dù tròn 8 múi phồng, bục nâng viền tròn, cáp có móc tròn | Vừa | M | 0 |
| Sân khấu, giàn, loa, nhạc cụ | Giàn dày và thưa hơn, tháp tròn, loa bo tròn, bo mép sàn | Vừa | M | 0 |
| Runway, cổng đèn | Bo góc chỗ giao, đầu bục tròn sẵn; cổng đèn dày gấp đôi, thêm ngôi sao trên đỉnh | Thấp | S | 0 |
| Pháo giấy | Hình dạng theo motif (sao, tim, dải ruy băng) thay vì vuông, bằng atlas 2×2 | Thấp | S | 0 |
| Đèn, laser, khói, pháo hoa | Không đổi hình; tia pháo hoa đầu tròn | Thấp | S | 0 |
| Biểu tượng cảm xúc | Đã đúng phong cách; dùng làm chuẩn tham chiếu cho độ dày viền và highlight | — | — | 0 |
| Giao diện HTML | Bo góc 14–18 px thống nhất, pictogram nét dày 3 px đầu tròn, nút có bóng đổ ngắn kiểu sticker; thay 3 pictogram chào sân bằng hình chibi | Vừa | S | — |

### Khu 2 — khán đài

| Vật thể | Thay đổi | Ưu tiên | Công | Draw call |
|---|---|---|---|---|
| Kết cấu khán đài | Bo mép tầng, lan can thành dải tròn | Thấp | S | 0 |
| Cột đèn pha | Dạng "nấm" 6 bóng to | Thấp | S | 0 |
| Chấm khán giả | Chấm tròn mềm; trái tim mosaic giữ nguyên | Thấp | S | 0 |

### Khu 1 — ngoài sân vận động

| Vật thể | Thay đổi | Ưu tiên | Công | Draw call |
|---|---|---|---|---|
| Rồng | Theo 2.4 + mục 4 | Cao | L | +1 (viền) |
| UFO | Theo 2.4 + mục 4 | Cao | M | +1 |
| Tên lửa | Theo 2.4 + mục 4 | Cao | M | +1 |
| Máy bay phản lực | Theo 2.4 + mục 4 | Cao | M | 0 (viền fresnel) |
| Máy bay kéo băng rôn | Theo 2.4 + mục 4 | Vừa | S | 0 |
| Khinh khí cầu | Múi phồng, giỏ tròn, hành khách chibi; dời ra sau khán đài xa nhất theo yêu cầu người dùng thì phóng to 1,6–2× để vẫn đọc được | Vừa | M | 0 |
| Máy bay chở khách | Bóng mập có 2 đèn to; ưu tiên thấp vì rất nhỏ | Thấp | S | 0 |
| Trăng | Trăng khuyết mập có mặt ngủ (mắt nhắm, má hồng) | Vừa | S | 0 |
| Sao, sao băng | Sao 4 cánh tròn; sao băng đầu ngôi sao, đuôi mập ngắn | Thấp | S | 0 |
| Cực quang | Không đổi hình (là ánh sáng) | — | — | 0 |

## 4. Secret object: chi tiết nên thêm

| Vật thể | Chi tiết trau chuốt (theo thứ tự làm) |
|---|---|
| UFO | Phi công chibi trong vòm (vẫy tay khi lơ lửng); 8 đèn cầu to chạy đuổi; vành đĩa 2 tầng có đinh tán tròn; ăng-ten đầu ngôi sao rung theo nhịp; 3 chân cầu thò ra khi lơ lửng; tia hút có các vòng tròn chạy xuống và vài lightstick + trái tim xoay bay lên; khi vụt đi để lại vòng khói hình sao |
| Tên lửa | Cửa sổ tròn có phi hành gia chibi; sơn 2 dải màu + 1 ngôi sao lớn; 3 vây tròn; vòi phun chuông; lửa đuôi 3 lớp dạng giọt mập (không phải hạt li ti); khói phóng là các cục bông tròn chồng nhau; giàn phóng có tay giữ bo tròn mở ra; pháo hoa nổ thành hình sao và tim |
| Rồng | Đầu: mắt to có đốm sáng và chớp mắt 3–5 s một lần, lông mày, 2 sừng tròn, râu là 2 capsule mềm lượn sóng, má hồng, hàm mở khi phun; bờm là hàng chỏm cầu giảm dần dọc sống lưng; bụng màu sáng hơn với vạch ngang; 4 chân ngắn có 3 ngón tròn quẫy khi bay; vảy là họa tiết bán nguyệt trong shader; ngậm 1 viên ngọc phát sáng; đuôi chùm lông + ngôi sao; hơi thở là sao và tim lấp lánh |
| Máy bay phản lực | Thân capsule mập, vòm kính lớn thấy phi công đội mũ; mắt trên mũi; cánh tam giác bo đầu; 2 vòi đốt sau tròn có vòng sáng; số hiệu + ngôi sao trên cánh; khói là dải mập mép lượn sóng nhẹ, có các ngôi sao nhỏ rơi ra; đội hình nghiêng cánh chào khi qua sân |
| Máy bay kéo băng rôn | Kiểu máy bay 2 tầng cánh đồ chơi: thân trứng, cánh quạt to quay thấy rõ, phi công quàng khăn bay phấp phới (motif nơ), bánh xe tròn to; dây kéo có 3 cờ đuôi nheo; băng rôn mép răng cưa tròn, 2 đầu có nơ |

Quy tắc chung cho secret: xuất hiện bằng "pop" (2.5), có 1 khoảnh khắc "diễn" hướng về camera (vẫy tay, nháy mắt, chào cánh), và rời đi để lại 1 motif chữ ký (sao hoặc tim).

## 5. Điểm cần Designer B phản hồi

1. **Màu viền:** viền nên là một màu tối cố định (ví dụ tím than) cho mọi vật thể, hay là màu chính của từng vật thể làm tối đi 60%? Độ dày viền phụ thuộc lựa chọn này.
2. **Mặt trên nền tối:** sân rất tối, mắt và miệng màu gì để còn đọc được ở 20–30 m; có cần quầng sáng nhẹ quanh đầu nhân vật chính không?
3. **Highlight đồ chơi và ánh sáng sân khấu:** vệt highlight trắng cố định có mâu thuẫn với màu đèn đổi theo Hype không; nên nhuộm highlight theo bảng màu hiện hành?
4. **Phân biệt ba khu bằng độ bão hoà:** tôi đề xuất chi tiết hình khối giảm dần theo khoảng cách; màu có nên giảm bão hoà tương ứng (khu 1 nhạt và lạnh hơn) để giữ chiều sâu?
5. **Da và tóc khán giả:** khi đầu to gấp đôi, vùng da và tóc chiếm nhiều diện tích hơn hẳn; cần bảng 5–6 màu da, 6–8 màu tóc và quy tắc nhuộm theo màu lightstick.
