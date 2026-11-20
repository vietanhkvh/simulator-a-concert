# 01 — Hướng phong cách mới, phía HÌNH KHỐI (Designer A)

Yêu cầu: thêm **2 phong cách** khác hẳn "Kẹo đêm · chibi". Tài liệu này đề xuất **3 ứng viên** để art director gộp với phần màu/ánh sáng của Designer B rồi chọn 2.
Nguồn: có tra web (2 lượt, kết quả mỏng: xác nhận cel-shade/neon/flat là nhóm phổ biến của game nhạc, lưới synthwave nên vẽ trong fragment shader, thuỷ mặc thường làm bằng post-process + nhiễu giấy); phần còn lại là kiến thức nghề. **Không có số đo FPS** nào trong tài liệu này — mọi đánh giá hiệu năng là ước lượng từ cấu trúc mã (đã đọc `src/world/style/*`, danh sách file 3 khu, uniform của `crowd.*.glsl`), chưa chạy thử.

## 1. Khảo sát 14 hướng

Ràng buộc chấm điểm: hình học thủ tục three.js · 8.000 billboard SDF (2 draw call) · không texture ngoài canvas · đọc được ban đêm khi có cửa sổ lời · GPU tích hợp (tránh post-process toàn màn hình). Hợp = 1–5.

| # | Hướng | Điểm nhận diện | Tham chiếu (chỉ tên) | Hợp | Ghi chú kỹ thuật |
|---|---|---|---|---|---|
| 1 | Synthwave / retro-futurist neon | lưới phối cảnh, mặt trời sọc, nét sáng trên khối đen | Tron: Legacy, Rez Infinite, Beat Saber, Daft Punk Alive 2007 | **5** | cạnh sáng = `LineSegments`/fresnel, rẻ hơn tô bóng; đêm là nền tự nhiên |
| 2 | Cyberpunk thành phố đêm | biển hiệu dày, mưa, hologram | Blade Runner 2049, Cyberpunk 2077, Ghostrunner | 3 | cần mật độ chi tiết + phản xạ ướt; trùng 60% với #1 |
| 3 | Low-poly hiện thực cách điệu | mặt phẳng lộ, không bo, tỉ lệ thật | Monument Valley, Art of Rally, Superhot | **5** | `flatShading`, ít đỉnh hơn chibi; billboard SDF đa giác dễ |
| 4 | Cel-shade anime dáng cao | 7–8 đầu, mặt vẽ, viền mực | Hi-Fi Rush, Persona 5, Project Sekai, Jet Set Radio | 3 | mặt + tóc đẹp cần mesh thủ công; vẫn "dễ thương", gần chibi nhất |
| 5 | Cắt giấy / origami diorama | lớp phẳng xếp tầng, nếp gấp | Tearaway, Paper Mario, Lotte Reiniger | 4 | lớp phẳng rẻ; nhưng giọng vẫn "thủ công dễ thương" |
| 6 | Poster phẳng / Swiss | mảng màu phẳng, chữ lớn, lưới | Blue Note covers, Saul Bass, Sayonara Wild Hearts | 4 | unlit rất rẻ; thiếu chiều sâu khi camera tự do trên sân khấu |
| 7 | Vaporwave | tượng thạch cao, pastel, lỗi hình | Hotline Miami (bìa), Hypnospace Outlaw | 2 | pastel = lại gần "kẹo"; mỉa mai, khó hợp concert |
| 8 | Glam rock / metal sân khấu thực | giàn thép, pyro, tường loa, khói | Rammstein, Metallica M72, Rock Band, Brütal Legend | **4** | hợp nhất khi cách điệu low-poly (#3); thực quá thì cần texture |
| 9 | Đơn sắc + 1 màu nhấn | đen-trắng, 1 hue | Limbo, Inside, Sin City, MadWorld | 4 | rất rẻ; rủi ro đơn điệu trong 3–4 phút diễn |
| 10 | Thuỷ mặc / màu nước Á Đông | nét cọ dày-mỏng, khoảng trống, loang | Okami, Sumi-e, mở màn Olympic Bắc Kinh 2008, Ghost of Tsushima (Kurosawa) | **4** | làm **trong material** (bậc tô + nhiễu mép), không cần post-process |
| 11 | Art Deco gala | tia quạt, bậc thang, vàng-đen đối xứng | The Great Gatsby (2013), BioShock, Ziegfeld Follies | 4 | hình học thuần → rất thủ tục; đám đông đứng vẫy que hơi lạc |
| 12 | Festival bohemian | cờ đuôi nheo, gỗ, đèn dây | Tomorrowland, Burning Man, Coachella | 3 | cần nhiều vật nhỏ hữu cơ; ấm áp, gần chibi về cảm xúc |
| 13 | Holographic Y2K | chrome lỏng, ánh ngũ sắc, blob | bìa nhạc 1999–2003, Wipeout 3 | 3 | ngũ sắc = fresnel rẻ; nhưng khối blob tròn trùng chibi |
| 14 | Dark fantasy / gothic opera | vòm nhọn, nến, cánh quạ | Castlevania, Bloodborne, Phantom of the Opera | 3 | kiến trúc lathe/extrude được; tối + chi tiết nhỏ → khó đọc ban đêm |

Loại trước: #4, #5, #7, #12, #13 (còn chất "dễ thương/tròn"); #2 gộp vào #1; #6, #9 mượn làm **quy tắc UI**; #11, #14 mượn motif cho ứng viên B.

## 2. Ba ứng viên

| | **A · LƯỚI NEON** | **B · MỰC & SƠN MÀI** | **C · THÉP & LỬA** |
|---|---|---|---|
| Gốc | #1 (+#2, #9) | #10 (+#11, #5) | #3 + #8 |
| Loại show | EDM / synth-pop rave | đại nhạc hội giao hưởng – dân tộc đương đại | rock arena |
| Một câu | Mọi vật là **khối đen viền ánh sáng**; ánh sáng là chất liệu duy nhất | Mọi vật là **nét cọ**: dày-mỏng, có khoảng trống, vàng trên đen | Mọi vật là **khối đẽo phẳng mặt**, nặng, thật, có lửa |
| Đối lập chibi ở | không mặt, không bo, không tô bóng | không viền đều, không đối xứng, tĩnh và chậm | không bo, tỉ lệ thật, bề mặt lì |

### 2.1 Đặc tả hình khối (cùng mức chính xác với STYLE_GUIDE mục 3)

| Hạng mục | A · Lưới Neon | B · Mực & Sơn mài | C · Thép & Lửa |
|---|---|---|---|
| Tỉ lệ mesh / billboard | **7,0 / 6,5 đầu**; H 1,78 m; vai 0,26 H; chân 0,50 H | **7,5 / 7,0 đầu**; H 1,72 m; tay áo/tà dài tới 0,35 H | **7,5 / 6,5 đầu**; H 1,80 m; vai rộng 0,29 H; đầu rộng 0,13 H |
| Thân, tay, chân | lăng trụ 6 cạnh thuôn; tay chân **2 đoạn** (có khuỷu, gối); bàn tay hình nêm | thân là 1 khối áo dài (lathe 8 cạnh), tay 2 đoạn ẩn trong tay áo rộng; chân ít lộ | hộp vát + trụ 6 cạnh; tay chân 2 đoạn; giày/bốt to 0,16 H |
| Mặt | **không mặt**: kính/visor 1 dải phát sáng ngang (0,09 H × 0,03 H); hát = dải nhấp nháy theo âm lượng | **không mắt mũi**: 1 nét cọ ngang cho mắt, hoặc mặt nạ/nón che; biểu cảm bằng tư thế đầu ±15° | mặt = **3 mặt phẳng** (trán, 2 má) + bóng hốc mắt; không vẽ mắt; tóc là khối đẽo 5–9 mặt |
| Bóng dáng | tam giác ngược, góc 30°/60°/90°; mọi vật đọc được chỉ bằng đường bao | bất đối xứng 60/40; mỗi vật có 1 chỗ "bỏ trống" (≥ 20% đường bao không vẽ) | chữ nhật, hình thang nặng đáy; chi tiết nhỏ nhất ≥ 4% chiều lớn nhất |
| Cạnh | **bo = 0**; vát 45° ở 4–8% cạnh ngắn; cạnh cứng (> 30°) được vẽ thành **đường sáng** | bo 3–5%; mép "khô": alpha theo nhiễu, lệch ±6% | bo = 0; vát 2–4% lấy highlight; mọi mặt phẳng lộ (`flatShading`) |
| Viền | đường sáng emissive 1,5–2,5 px, **màu = màu vai trò** (không phải mực tối); tắt dưới 16 px | viền mực **dày-mỏng 0,5–4,5% H** theo `N·V` + nhiễu dọc nét; đứt 15–25% chiều dài; không rim sáng | **không viền**; tách khối bằng rim đèn ngược 0,5–0,8 và sương |
| Tô bóng | thân unlit gần đen (L 4–8%); 0 bậc; chỉ có lưới/đường/tấm phát sáng. "Chrome" = fresnel 2 màu | **3 bậc loang**: giấy / mực nhạt / mực đặc; ngưỡng mềm 20–30% + nhiễu mép; 1 màu sơn (son/vàng) phẳng không bóng | Lambert phẳng 1 bậc/mặt + highlight kim loại hẹp; bóng dịch về lạnh, sáng dịch về ấm |
| Emissive | kiến trúc 0 · đường 1,0 · tấm LED 1,2 · lightstick 1,2 · lõi secret 2,0 | kiến trúc 0,05 · đèn lồng 0,9 · vàng lá 0,5 · lõi secret 1,4 | kiến trúc 0,05 · đèn 1,0 · lửa 1,8 · lõi secret 2,0 |
| Chuyển động | **cắt cứng theo phách**: không squash; giật scale 1,00 → 1,06 → 1,00 trong 80 ms; quay theo bước 15°/45°; xuất hiện bằng "quét dòng" 0,2 s (wipe dọc) | **chậm, có trễ**: ease-in-out 0,6–1,2 s; vải/tà trễ 150–250 ms; xuất hiện bằng "nét cọ vẽ ra" 0,5 s (alpha chạy dọc nét) | **có trọng lượng**: gật đầu 4–6°, giậm chân; đỉnh nhanh (60 ms) hồi chậm (240 ms); rung camera ≤ 0,3° khi pyro; xuất hiện bằng "sập đèn → bật" |
| Motif (3) | **tam giác**, **lưới ô**, **mặt trời sọc ngang** | **vòng tròn cọ (ensō)/trăng**, **sóng nước – mây cuộn**, **chim Lạc – hoa sen** (vành trống đồng) | **tia sét**, **đinh tán – ngôi sao 5 cánh nhọn**, **ngọn lửa** |
| Phương tiện | dài 3,5–4,5 × thân; hình nêm; cánh mỏng 3% | dài 5–8 × thân, uốn chữ S; dáng diều, thuyền, chim | dài 3–4 × thân; tấm ghép lộ đường nối; ống xả, đinh tán |
| Khán giả SDF | bóng người **đen đặc** 6,5 đầu, đầu = lục giác; viền sáng 1 px màu que; que = **thanh thẳng** dài 0,35 H + vòng cổ tay; LOD xa chỉ còn que + chấm đầu | bóng người = **vệt cọ** thuôn (trên đậm, dưới loãng), không tay rời; tay giơ **đèn lồng nhỏ/quạt** phát sáng ấm; LOD xa = chấm mực + đốm đèn | bóng người đa giác 6,5 đầu, **tay giơ nắm đấm / tay sừng**, 30% có đèn điện thoại; áo 3 sắc tối; LOD xa = đầu + vai + đốm sáng |
| Sân khấu | khung dây **tam giác/kim tự tháp**, mái là lưới ô phát sáng; runway là dải ô LED; tường LED = mặt trời sọc + EQ | mái **cong đầu đao** 2 tầng, cột sơn son; nền sau là **bình phong 5 tấm**; runway = cầu gỗ cong 6°; B-stage = mặt trống đồng (vành đồng tâm) | giàn **hộp thép chữ X** (thanh 0,3 m, giữ đủ số thanh), tường loa 2 × 9 thùng, bục trống cao 1,2 m, 8 ống phun lửa mép sân khấu |
| Bầu trời | chân trời có **lưới phối cảnh** + mặt trời sọc 12 dải lặn sau khán đài; sao là điểm thưa; cực quang → **màn laser quét**; sao băng → vệt thẳng | **trăng tròn lớn** (đường kính góc ×3), mây cuộn nét cọ, núi 3 lớp mờ sau khán đài; cực quang → **dải lụa**; sao băng → **đèn trời** bay lên | trời gần đen, mây khói bắt đèn quét; trăng nhỏ, lạnh; cực quang → **chùm đèn rọi chéo trời** (8 cột); sao băng → tàn lửa bay lên |
| Khinh khí cầu | **khí cầu zeppelin** hình thoi dài 4:1, băng rôn = bảng LED chạy chữ | **đèn lồng lớn / diều sáo**, băng rôn = **liễn dọc** | **blimp** thân tấm ghép, băng rôn vải rách mép in chữ stencil |
| UI | góc vát 45° (8 px), viền 1 px sáng, nền đen 85%; chữ **geometric sans in hoa**, giãn chữ 0,08 em; số kiểu 7 đoạn | bảng = giấy dó có mép xé (clip-path), triện đỏ vuông cho nút chính; chữ **serif có chân tương phản cao**, lời hát căn giữa có nét gạch cọ | bảng = tấm thép góc vuông, 4 đinh tán, vạch sọc cảnh báo; chữ **condensed đậm in hoa** kiểu stencil; nút có độ lún 2 px |

### 2.2 Sự kiện bí mật: diễn giải lại hoặc thay thế

Tên sự kiện `cs-secret.kind` **giữ nguyên** (`ufo｜rocket｜dragon｜jet｜plane`); chỉ đổi hình và tên hiển thị.

| kind | A · Lưới Neon | B · Mực & Sơn mài | C · Thép & Lửa |
|---|---|---|---|
| `ufo` | giữ: **đĩa mỏng** (cao 0,12 × đường kính), vành 24 đoạn sáng chạy đuổi, tia hút = hình nón lưới dây | **thay: trăng–đèn lồng khổng lồ** hạ xuống, thả 200 đèn trời | **thay: quả cầu gương 12 m** treo cần cẩu, bắn 64 tia quét |
| `rocket` | giữ: tên lửa **kim** tỉ lệ 6 : 1, 3 vây tam giác; pháo hoa nổ thành **vòng tròn và tam giác** | **thay: pháo bông trúc** bắn từ 5 ống; nổ thành hoa cúc, hoa sen, chim Lạc | giữ: tên lửa thép tấm ghép 4 : 1, khói đặc, pháo nổ kiểu **thác lửa + sao nhọn** |
| `dragon` | **rồng dây sáng**: 40 đốt lăng trụ rỗng chỉ có cạnh, lõi sáng chạy dọc thân | **đôi rồng thời Lý** (thân mảnh uốn 9 khúc, đốt nhỏ hơn 35%) **hoặc rồng + phượng**; thân vẽ bằng nét cọ, nhả ngọc thành ensō | **rồng cơ khí** đốt thép bản lề, phun lửa thật (hạt 3 lớp); hoặc **phượng lửa** nếu muốn bỏ rồng |
| `jet` | 5 phi cơ **tam giác delta** chỉ có đường bao; khói = dải ribbon phẳng vẽ **tim vector** + 1 đường EQ | **thay: đàn hạc 9 con** bay đội hình chữ V, vệt mực vẽ **hoa sen/ensō** thay tim | giữ: phản lực đẽo mặt, đốt sau 2 vòng lửa; khói vẽ **tia sét hoặc tay sừng**; bay thấp, rung camera |
| `plane` | **drone show**: 300 điểm sáng xếp chữ băng rôn (điểm dùng chung `glowPoints`) | **diều sáo** kéo liễn dài, hoặc thuyền rồng bay | **trực thăng 2 chiếc** căng banner vải giữa hai máy |
| Chữ ký secret | vành → **tam giác xoay** 1,35×, 3 tia quét | vành → **ensō cọ** không khép (hở 40°) + triện đỏ | vành → **vòng tia lửa** + 6 tàn lửa quay |

### 2.3 Bảng theo khu: thay đổi lớn nhất so với chibi

Công: S < 1 giờ agent · M 1–2 giờ · L > 2 giờ. DC = thay đổi draw call ước lượng so với chibi. Rủi ro: T thấp · V vừa · C cao.

| Khu | Vật thể | A · Lưới Neon | B · Mực & Sơn mài | C · Thép & Lửa |
|---|---|---|---|---|
| 1 ngoài | Trời, trăng, cực quang | lưới + mặt trời sọc + màn laser · M · DC 0 · T | trăng lớn, mây cọ, núi 3 lớp, dải lụa · M · DC +1 · T | mây khói, cột đèn rọi · S · DC 0 · T |
| 1 | Khinh khí cầu (6) | zeppelin + bảng LED · M · 0 · T | đèn lồng/diều + liễn · M · 0 · T | blimp + banner · S · 0 · T |
| 1 | 5 secret ★ | 3 dựng lại (rồng dây, drone show, jet delta), 2 tham số hoá · **L** · −2 (bỏ inverted hull) · T | 4 thay mới, 1 dựng lại · **L+** · +1 · V (nét cọ alpha, overdraw) | 2 thay (cầu gương, trực thăng), 3 dựng lại · **L** · 0 · V (hạt lửa) |
| 2 khán đài | Kết cấu, chấm, cột đèn, khung LED | mép tầng thành đường sáng; chấm vuông 2 px · S · 0 · T | mái ngói cong vành trên, chấm = đốm đèn lồng · M · 0 · T | dầm thép lộ, cột đèn hộp 4 × 6 bóng · S · 0 · T |
| 3 sân | Khán giả 8.000 | biến thể SDF rẻ nhất (bóng đen + viền) · M · 0 · **T** (ít lệnh hơn chibi) | vệt cọ + nhiễu mép · M · 0 · **V** (nhiễu trong fragment × overdraw) | đa giác + tay 2 đoạn · M · 0 · T |
| 3 | Ca sĩ + ban nhạc + quay phim | rig mới 7 đầu, không mặt · **L** · −3 (không atlas mặt, không hull) · T | rig 7,5 đầu + áo dài/tà có trễ; nhạc cụ đổi: **trống, đàn tranh, bầu, sáo + dàn dây** · **L+** · +2 · V | rig 7,5 đầu đẽo mặt; nhạc cụ dài thêm 30%, thêm ampli · **L** · 0 · T |
| 3 | Giàn mái, tháp, loa, sàn, cổng | khung tam giác + `LineSegments` · M · +1 · T | mái đầu đao, cột, bình phong, cầu cong · **L** · +2 · T | giàn hộp X đủ thanh, tường loa (instanced) · M · 0 · V (số tam giác ×2) |
| 3 | Đèn, laser, khói, pháo | thêm lưới sàn theo phách; laser là chủ đạo · S · 0 · T | giảm 50% số chùm; thêm đèn lồng treo, khói thấp · S · 0 · T | thêm 8 ống lửa + blinder · M · +1 · V |
| 3 | Pháo giấy, emote | tam giác, vạch, biểu tượng vector · S · 0 · T | cánh hoa, lá vàng; emote thành triện · S · 0 · T | tia lửa, giấy bạc vuông; emote stencil · S · 0 · T |
| UI | HTML/CSS | token + clip-path vát · M | giấy, triện, serif · M | thép, stencil · M |
| **Tổng** | | **~4 L, rủi ro thấp nhất** | **~5 L, nhiều hình mới nhất** | **~4 L, rủi ro hạt/tam giác** |

## 3. Chiến lược mã: THEME chuyển đổi được

Hiện trạng: `src/world/style/{palette,form,three,index}.ts` là hằng số module, ~42 file import; tên màu (`berry`, `grape`…) và hằng chibi (`HEADS_MESH`, `SQUASH`, `FACE`) nằm thẳng trong mã các khu; rig ở `arena/chibiRig.ts`, `cameraCrewToon.ts`.

| Lớp | Đề xuất | Dùng chung hay theo theme |
|---|---|---|
| Chọn theme | `src/world/style/theme.ts`: `interface Theme { id; palette; form; crowd; rig; props; ui }` + `getTheme()`; chọn ở sảnh, **dựng lại world khi đổi** (không đổi nóng giữa bài) | chung |
| Màu | giữ **8 ô × 4 bậc** làm khe; thêm lớp **vai trò** (`ROLE.bg/primary/secondary/accentWarm/accentCool/text/ink`) để mã khu gọi vai trò thay vì `berry`. Mỗi theme = 1 file `themes/<id>/palette.ts` + `HYPE_STAGES` riêng | theo theme (dữ liệu) |
| Hình khối | `form.ts` thành `FormSpec`: `heads`, `charH`, `bodyRatio`, `bevel`, `outline{mode: 'ink'｜'glow'｜'brush'｜'none'}`, `shade{steps, soft}`, `motion{mode: 'squash'｜'snap'｜'drift'｜'weight'}`, `appear{mode}`, `vehicleAspect`, `emissive` | theo theme (dữ liệu) |
| Shader khán giả | 1 cặp file, chèn `#define CROWD_STYLE n` lúc biên dịch → **vẫn 2 draw call**; hàm SDF thân/đầu/que tách thành khối `#if`; uniform màu giữ nguyên tên | chung khung, khác nhánh |
| Rig nhân vật | `chibiRig.ts` → `rig.ts` nhận `RigSpec`; cần thêm **khuỷu + gối** (2 khớp/chi) cho cả ba ứng viên → hình học **mới**, animation dùng lại pha/nhịp | chung khung; 1 lần làm, 3 theme dùng |
| Đạo cụ, secret | bảng đăng ký `props[kind] → builder`; theme không khai báo thì rơi về bản chibi (cho phép phát hành từng phần) | theo theme (mã) |
| Viền | `outline.mode`: `ink` (hiện có) · `glow` = `LineSegments` từ `EdgesGeometry` · `brush` = hull + alpha nhiễu · `none` | chung tiện ích |
| Giữ nguyên | `layout.ts`, luồng `FrameState`, sự kiện `cs-*`, `glowPoints`, logic Hype/chấm điểm/âm thanh, lịch secret (`secretRoll`), camera | chung 100% |
| UI | `toCss()` theo theme + `data-theme` trên `<html>`; hình nút bằng `clip-path`/`border-radius` theo biến | theo theme (CSS) |
| Kiểm thử | `style.test.ts` chạy cho từng theme: 0 hex ngoài palette, tương phản chữ ≥ AA, tổng additive vùng lời ≤ 0,35 | chung |

Tới được bằng tham số hoá hay cần hình học mới (ước lượng theo số vật thể ở bảng 2.3):

| | Tham số hoá builder cũ | Nhánh shader mới | Hình học mới |
|---|---|---|---|
| A · Lưới Neon | ~55% (giàn, sàn, khán đài, đèn, khinh khí cầu, tên lửa, UFO) | khán giả, trời (lưới, mặt trời), viền `glow` | rig cao, rồng dây, drone show |
| B · Mực & Sơn mài | ~30% (sàn, đèn, chấm khán đài) | khán giả, tô 3 bậc loang, viền `brush`, mây/núi | rig + trang phục, mái/bình phong, nhạc cụ, 4 secret |
| C · Thép & Lửa | ~50% (giàn, loa, khán đài, tên lửa, phản lực, blimp) | khán giả, tô phẳng mặt | rig cao, ống lửa, cầu gương, trực thăng, rồng cơ khí |

Thứ tự gợi ý: (1) tách `Theme` + vai trò màu với chibi là theme duy nhất, ảnh chụp không đổi; (2) rig cao dùng chung; (3) nhánh SDF khán giả; (4) từng theme theo gói khu như G1–G9 cũ.

## 4. Xếp hạng (phía hình khối)

| Hạng | Ứng viên | Lý do |
|---|---|---|
| **1** | **A · Lưới Neon** | Xa chibi nhất về mọi trục (không mặt, không bo, không tô bóng); nền đêm là lợi thế sẵn; biến thể khán giả rẻ hơn bản hiện tại; draw call giảm; lightstick và laser vốn đã là "nhân vật chính". Điểm yếu: nhân vật không mặt có thể bị thấy lạnh; khối đen dễ chìm nếu thiếu đường sáng |
| **2** | **B · Mực & Sơn mài** | Bản sắc mạnh và khác biệt nhất với game concert khác; cho phép chất liệu Việt (trống đồng, rồng Lý, đèn lồng, liễn); đổi cả loại show. Điểm yếu: công lớn nhất (4 secret thay mới, mái, nhạc cụ), nét cọ bằng alpha có rủi ro overdraw, show chậm có thể lệch với bài hát nhanh |
| 3 | C · Thép & Lửa | Dễ hiểu, dễ làm, hợp "ca sĩ đứng sân vận động" nhất; nhưng là hướng **ít khác biệt nhất về nhận diện** (giống nhiều game), phụ thuộc màu và ánh sáng để có cá tính, và hạt lửa là rủi ro hiệu năng chính |

Nếu chỉ chọn 2: **A + B** (hai cực: ánh sáng lạnh hình học ↔ nét cọ ấm hữu cơ). Chọn C thay B nếu ưu tiên tiến độ hoặc nếu danh sách bài hát thiên về rock/pop sôi động.

## 5. Câu hỏi

### Cho Designer B (màu / ánh sáng)

1. **A:** thân vật thể L 4–8% trên nền `night` có đủ tách không, hay cần nâng nền trời/sương lên? Đề xuất giới hạn bao nhiêu hue đường sáng cùng lúc (tôi giả định ≤ 3)?
2. **B:** nền là **giấy tối** (mực sáng trên đen, kiểu sơn mài) hay cần một "trang giấy sáng" ở đâu đó (trăng, bình phong)? Cặp son + vàng lá có giữ được 3 trạng thái Hype mà không thành đỏ-vàng lễ hội đơn điệu?
3. **C:** rim đèn ngược 0,5–0,8 thay viền có đủ tách ca sĩ khỏi tường LED ở Hype > 80% không; lửa (emissive 1,8) và secret (2,0) tranh nhau thế nào?
4. Ba trạng thái Hype (lạnh / ấm / rực) có giữ làm khung chung cho mọi theme không, hay mỗi theme được đổi trục (ví dụ B: tĩnh → động thay vì lạnh → nóng)?
5. Quy tắc bão hoà theo khu (1,0 / 0,75 / 0,6) và sương tím có còn đúng khi A dùng đường sáng (xa vẫn chói) và B dùng lớp mờ theo khoảng cách?
6. Giới hạn chói vùng lời (additive ≤ 0,35): A và C sẽ chạm trần thường xuyên — cần trần riêng theo theme hay làm tối nền cửa sổ lời?

### Cho người dùng (chỉ người dùng quyết được)

1. Hai phong cách mới nên gắn với **loại nhạc** nào: EDM/synth-pop, giao hưởng–dân tộc, rock? (quyết định A / B / C)
2. Ca sĩ **không có khuôn mặt** (kính phát sáng ở A, nét cọ ở B) có chấp nhận được không, hay bắt buộc phải thấy mặt?
3. Ở hướng B, muốn chất liệu **Việt Nam rõ ràng** (trống đồng, rồng thời Lý, áo dài, đèn lồng Hội An) hay Á Đông chung chung?
4. Sự kiện bí mật: giữ đúng 5 thứ cũ và chỉ vẽ lại, hay **cho phép thay** (đàn hạc thay phản lực, cầu gương thay UFO, phượng thay rồng)?
5. Theme chọn **ở sảnh trước khi diễn** (dựng lại cảnh) là đủ, hay muốn đổi ngay giữa bài? Mỗi theme có cần đổi cả **nhạc cụ ban nhạc** và trang phục?
6. Ưu tiên nào cao hơn: **khác biệt tối đa** (A + B) hay **xong nhanh** (A + C)?

Nguồn web đã xem: [Amanotes — art styles in music games](https://www.amanotes.com/post/top-3-most-popular-art-styles-in-music-games) · [PC Gamer — synthwave & games](https://pcgamer.com/how-synthwave-music-inspired-games-to-explore-a-past-that-never-existed) · [Vice — Hi-Fi Rush](https://vice.com/en/article/88qyw5/how-a-designer-known-for-horror-made-the-musical-gaming-triumph-hi-fi-rush) · [Codrops — Still: ink wash in WebGPU](https://tympanus.net/codrops/2026/09/09/still-from-akira-to-ink-wash-building-a-generative-garden-in-webgpu/) · [three.js forum — infinite shader grid](https://discourse.threejs.org/t/forever-grid-infinte-shader-grid/84748)
