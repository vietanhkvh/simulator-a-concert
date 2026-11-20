# Khu 1 — Ngoài sân vận động (xa nhất)

Bầu trời và mọi thứ bay trên trời. Điểm vào duy nhất: `index.ts` → `createOutsideZone(ctx)`.

| File | Trách nhiệm |
|---|---|
| `index.ts` | Tạo khu, cập nhật mỗi frame, lộ API: băng rôn, fly-by, sự kiện bí mật, sao băng |
| `sky.ts` | Vòm trời, 3.400 sao + dải ngân hà, sao băng theo mốc Hype, trăng, cực quang, 2 máy bay chở khách |
| `balloons.ts` | 6 khinh khí cầu + băng rôn cổ vũ (`setCheerBanners`), yêu cầu fly-by (`triggerFlyby`) |
| `flyby.ts` | Máy bay cánh quạt kéo băng rôn + khinh khí cầu bay lên khi Hype đạt đỉnh |
| `secretEvents.ts` | Điều phối sự kiện bí mật: gieo tỉ lệ, kích hoạt, `getSecretFocus()` |
| `secretRoll.ts` | Luật gieo tỉ lệ / nạp lại / thời gian chờ (thuần, có test) |
| `secretShared.ts` | Phần dùng chung của các sự kiện: phát `cs-secret`, tiêu điểm camera, hàm easing |
| `secretUfo.ts` `secretRocket.ts` `secretDragon.ts` `secretJet.ts` | Từng sự kiện: UFO, tên lửa + pháo hoa, rồng, máy bay phản lực vẽ khói |

Phát sự kiện `cs-secret`. Không import từ khu khác; kích thước chung lấy ở `src/world/layout.ts`.
