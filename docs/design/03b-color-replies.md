# 03b — Phản hồi của Designer B về đề xuất hình khối (vòng 2)

Đã đọc `01-form-language.md`. Token màu tham chiếu `02-color-and-light.md` (bảng "Kẹo đêm"). Chưa áp dụng vào mã.

## 1. Trả lời 5 câu hỏi của Designer A

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Màu viền | **Một màu cố định cho mọi vật thể: `ink` `#2B1D5C`** (tím than, sáng hơn nền `night-500 #14102B`). Không dùng "màu thân tối đi 60%": 8.000 billboard sẽ cần thêm phép tính mỗi điểm ảnh và viền mỗi vật một màu làm mất tính đồng bộ. Độ dày: 2,5% kích thước vật thể (A đề xuất 2–3%), 1,5–3 px trên màn hình, tắt dưới 24 px như A viết. |
| 2 | Mặt trên nền tối | Mắt `ink #2B1D5C` đặc, đốm sáng `cream-100 #FFFFFF`; miệng `berry-700 #B8326E`; má `berry-300 #FF94C4` độ mờ 45%. Để đọc được ở 20–30 m, **mặt là vùng tự phát sáng**: da nhân vật có sàn độ sáng L ≥ 62% (không bị đèn kéo xuống dưới mức này). Quầng sáng quanh đầu chỉ cho ca sĩ: đĩa additive `cream-300`, bán kính 0,9 × đầu, cường độ 0,18. Ban nhạc và khán giả không có quầng. |
| 3 | Highlight và đèn sân khấu | Tách hai lớp. **Highlight đồ chơi** (đốm góc trên trái) cố định màu `cream-100`, độ mờ 40%, không đổi theo Hype: nó là dấu hiệu vật liệu. **Rim light** mới là lớp nhận màu đèn: `mix(cream-300, hypeColor('light'), 0.7)`, cường độ 0,35 (0,5 khi Hype > 80%). Như vậy không mâu thuẫn. |
| 4 | Bão hoà theo khu | Đồng ý giảm dần, có ngoại lệ. Hệ số nhân bão hoà: khu 3 = 1,0; khu 2 = 0,75; khu 1 = 0,6, đồng thời dịch hue 8° về `grape`. Hệ số độ sáng tối thiểu: 1,0 / 0,85 / 0,7. **Ngoại lệ: sự kiện bí mật và cực quang giữ 1,0** dù ở khu 1, vì chúng phải là thứ nổi nhất khi xuất hiện. Khinh khí cầu dời ra sau khán đài dùng 0,8 (không phải 0,6) vì băng rôn cần đọc được. |
| 5 | Da và tóc khán giả | **Da 5 tông:** `#FFE0C7`, `#F7CBA4`, `#E0A57C`, `#B87A55`, `#8A5A3C` (thêm 1 tông so với 02). **Tóc 8 màu:** tự nhiên `#2A1F3D`, `#4A2F24`, `#6B4226`, `#C99A5B`, `#F6E0A8`; kẹo `#FF94C4`, `#8FE9FF`, `#B5A0FF`. Tỉ lệ 70% tự nhiên / 30% kẹo. **Nhuộm theo lightstick:** `màu = mix(gốc, màu que, k)` với k = 0,12 cho da, 0,22 cho tóc, 0,30 cho áo; k nhân thêm 1,5 khi Hype > 80%. Da không bao giờ vượt k = 0,2 để mặt không đổi thành xanh hay hồng. |

## 2. Điểm không đồng ý hoặc mâu thuẫn, kèm phương án

| Điểm trong 01 | Vấn đề về màu | Phương án thỏa hiệp |
|---|---|---|
| Viền inverted hull "màu tối" (R6, 2.6) | Viền đen hoặc `night-700` chìm hẳn vào trời đêm và sàn tối; vật thể mất viền đúng ở chỗ cần nhất. | Viền `ink #2B1D5C` (sáng hơn nền ~1,6 lần) **cộng** rim sáng phía ngoài ở mặt quay khỏi camera. Với vật thể khu 1 trên trời, viền đổi sang `night-100 #4A3F82` để tách khỏi vòm trời. Đề nghị A chấp nhận viền không phải lúc nào cũng "tối". |
| "Sinh vật có mắt" trên khinh khí cầu và máy bay (R5) | Sáu khinh khí cầu + máy bay + phản lực + UFO + rồng + trăng đều có mặt thì trời có hơn 12 khuôn mặt, tranh chú ý với ca sĩ và làm lõi `cream` của sự kiện bí mật bớt đặc biệt. | Mắt chỉ cho **vật thể "diễn"**: rồng, UFO (phi công), trăng, và các sự kiện bí mật. Khinh khí cầu và máy bay chở khách không có mắt trên thân; cái dễ thương đến từ hành khách chibi trong giỏ, đúng như A đã đề xuất ở 2.4. Mọi mắt dùng chung `ink` + đốm `cream-100`, không thêm màu mới. |
| Motif sao / tim / nơ (2.7) | Chưa có màu, dễ thành mỗi nơi một màu. | Khóa màu theo motif: **sao = `honey-500 #FFD45A`**, **tim = `berry-500 #FF5FA8`**, **nơ / ruy băng = `soda-500 #45D9FF`**, viền `ink`, highlight `cream-100`. Trái tim mosaic trên khán đài và khói phản lực đã là hồng, khớp sẵn. |
| Lightstick đầu sao / tim / cầu (2.3) | Đầu que có hình mà vẫn đổi màu theo Hype thì mâu thuẫn với khóa màu motif ở trên. | Đầu que là ngoại lệ: lấy màu `hypeColor('stick')` như thân que. Khóa màu motif chỉ áp cho vật thể rắn, không áp cho nguồn sáng. |
| Khán giả thấp còn 1,25–1,45 m, đầu to | Diện tích da + tóc tăng khoảng 4 lần; ở Hype thấp sân sẽ thành một biển màu da ấm, lệch khỏi tỉ lệ 60/30/10. | Ở LOD xa (> 35 m) đầu tô bằng **màu tóc**, không tô da (khớp ý A "LOD xa không mặt"). Ở LOD gần giữ da. Ngoài ra áp hệ số tối theo hàng: hàng càng xa độ sáng da × 0,85. |
| Trăng có mặt ngủ, má hồng | Hợp, nhưng trăng `cream` + má `berry` nằm cạnh cực quang `mint` dễ rối. | Giữ. Trăng dùng `cream-500` thân, bóng `grape-300`, má `berry-300` 35%; đặt ở góc trời đối diện dải cực quang chính. |
| File token: A đề xuất `src/render/style/chibi.ts`, B đề xuất `src/world/palette.ts` | Hai file ở hai cây thư mục, trong khi mã đang được tái cấu trúc thành `src/zones/{outside,stands,arena}` + `src/world`. File trong `src/render/` sẽ thành thư mục cũ. | Gộp vào **`src/world/style/`**: `palette.ts` (màu, B chịu trách nhiệm), `form.ts` (bán kính bo, độ dày viền, tỉ lệ nhân vật, biên độ squash, A chịu trách nhiệm), `index.ts` export chung. Ba zone chỉ import từ `src/world/style`, không zone nào tự khai báo màu hay bán kính. |
| Biểu tượng cảm xúc "dùng làm chuẩn tham chiếu viền" | Atlas hiện viền nâu đỏ `#5A1020`, khác `ink`. | Đổi viền atlas sang `ink #2B1D5C` khi áp dụng, để chuẩn tham chiếu và phần còn lại là một. |

Các phần còn lại của 01 (tỉ lệ 2,2–2,5 đầu, bo ≥ 12%, phương tiện mập, squash & stretch, mặt bằng `CanvasTexture`, chi tiết sự kiện bí mật) tôi đồng ý và không có xung đột màu.

## 3. Đề nghị chốt chung

1. **Bảng màu:** 8 màu gốc "Kẹo đêm" × 4 bậc, cộng `ink #2B1D5C` làm màu viền thứ 9. Không vật thể nào dùng màu ngoài bảng.
2. **Viền:** một màu `ink` cho mọi vật thể, dày 2,5%; vật thể trên trời dùng `night-100`; luôn kèm rim sáng.
3. **Hai lớp sáng:** highlight đồ chơi cố định `cream-100` 40%; rim light nhận màu đèn theo Hype.
4. **Mặt:** mắt `ink`, đốm `cream-100`, miệng `berry-700`, má `berry-300`; da có sàn sáng L ≥ 62%; chỉ ca sĩ có quầng sáng.
5. **Ai có mắt:** nhân vật, rồng, phi công UFO, trăng, sự kiện bí mật. Khinh khí cầu và máy bay thường thì không.
6. **Màu motif:** sao vàng mật, tim hồng dâu, nơ xanh soda; nguồn sáng (lightstick) là ngoại lệ.
7. **Chiều sâu ba khu:** bão hoà 1,0 / 0,75 / 0,6 và dịch 8° về tím ở khu 1; sự kiện bí mật và cực quang giữ 1,0; cực quang chỉ hiện khi Hype ≥ 40%.
8. **Một nguồn token:** `src/world/style/{palette,form,index}.ts`, cấp cho cả shader, mesh và biến CSS.
