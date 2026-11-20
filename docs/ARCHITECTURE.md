# Kiến trúc mã nguồn

Cảnh 3D được chia thành **ba khu** theo khoảng cách tới người chơi. Mỗi vật thể thuộc đúng một khu.

| Khu | Thư mục | Phạm vi |
|---|---|---|
| 1. Ngoài sân vận động (xa nhất) | `src/zones/outside/` | Bầu trời và mọi thứ bay trên trời |
| 2. Khán đài (ở giữa) | `src/zones/stands/` | Chỗ ngồi vòng quanh sân, bán kính 84–120 m |
| 3. Sân trung tâm (gần nhất) | `src/zones/arena/` | Sân khấu, đường đi, người chơi, khán giả sân (tới 62 m) |

## Sơ đồ thư mục

```
src/
  main.ts            luồng game: sảnh → chào sân → đếm ngược → diễn → kết quả; nối UI, âm thanh, world
  core/              kiểu dữ liệu (FrameState…), vòng lặp, thời gian
  world/
    world.ts         NƠI DUY NHẤT ghép ba khu: renderer, scene, camera, gọi update từng khu
    layout.ts        NGUỒN DUY NHẤT của kích thước dùng chung (cao độ, bán kính, vị trí)
    zone.ts          hợp đồng Zone / ZoneContext
    zones.test.ts    test giữ ranh giới giữa các khu
    shared/          uniform dùng chung + điểm sáng dùng chung (1 draw call cho cả hai khu xa)
  zones/
    outside/ stands/ arena/   mỗi khu: index.ts (điểm vào duy nhất) + README.md + các file riêng
  audio/ mic/ scoring/ song/ ui/   không phụ thuộc vào zones
```

## Quy tắc phụ thuộc

1. File trong một khu chỉ import từ **chính khu đó**, `src/core` và `src/world`. Khu không import chéo nhau.
2. Mã ngoài khu (`main.ts`, `world.ts`) chỉ import `zones/<khu>` (tức `index.ts`), không import file bên trong.
3. Kích thước dùng chung lấy từ `world/layout.ts`; không chép lại số vào từng file.
4. Khu trao đổi với nhau chỉ qua `FrameState` (world truyền mỗi frame) và các sự kiện dưới đây.

Quy tắc 1 và 2 được kiểm bằng `src/world/zones.test.ts` (chạy cùng `npm test`).

## Mỗi frame

`main.ts` dựng `FrameState` → `world.update(f)` → cập nhật uniform chung → `arena.update` → `outside.update`
→ `stands.update` → `world.render()`. Thứ tự tạo khu là từ xa tới gần: outside → stands → arena.

## Sự kiện giữa các khu (CustomEvent trên `window`)

| Tên | `detail` | Ai phát | Ai nghe |
|---|---|---|---|
| `cs-interact` | `{ kind: 'cheer'｜'wave'｜'heart'｜'flash'｜'pyro', on? }` | `main.ts` (phím 1–5, menu thử) | stands (`stadium.ts`) |
| `cs-secret` | `{ kind: 'ufo'｜'rocket'｜'dragon'｜'jet'｜'plane', phase: 'start'｜'end' }` | outside (`secretShared.ts`) | `main.ts` (đổi góc máy) |
| `cs-entrance` | `{ kind: 'jump'｜'lift'｜'cable', phase: 'start'｜'land'｜'end' }` | arena (`entrance.ts`) | `main.ts` (bắt đầu nhạc, reo hò) |
| `cs-view` | `{ mode }` | arena (`stageControls.ts`) | `main.ts` (nhãn góc máy) |
| `cs-mouselook` | `{ on }` | arena (`stageControls.ts`) | `main.ts` (gợi ý chuột tự do) |
| `cs-freefly` | `{ on }` (tùy chọn) | arena (`stageControls.ts`) | `main.ts` (chip gợi ý flycam) |

## Vật thể → khu → file

| Vật thể | Khu | File |
|---|---|---|
| Vòm trời, sao, sao băng, trăng, cực quang, máy bay chở khách | outside | `sky.ts` |
| Khinh khí cầu + băng rôn cổ vũ | outside | `balloons.ts` |
| Máy bay kéo băng rôn (Hype đạt đỉnh) | outside | `flyby.ts` |
| UFO, tên lửa, rồng, máy bay phản lực | outside | `secretUfo.ts` `secretRocket.ts` `secretDragon.ts` `secretJet.ts` |
| Tầng khán đài, khán giả chấm sáng, đèn nhà, cột đèn pha | stands | `stadium.ts` |
| Sàn diễn, mặt đất nền, tường LED, cánh gà | arena | `stageBase.ts` `ledWall.ts` |
| Mái giàn, tháp, loa, nhạc cụ, hàng rào, cổng đèn | arena | `stageDeco*.ts` |
| Runway, bục, sân khấu phụ | arena | `walkLayout.ts` `stageRunway.ts` |
| Người chơi, camera, góc máy | arena | `stageControls.ts` `cameraCrew.ts` |
| Ca sĩ, nhạc công | arena | `singer.ts` `band.ts` |
| Khán giả sân + lightstick | arena | `crowd.ts` + `crowd.*.glsl` |
| Đèn sân khấu, laser, pháo hoa, pháo giấy, biểu tượng cảm xúc | arena | `lights.ts` `stageFx.ts` `confetti.ts` `emotes.ts` |
| Hai màn hình LED lớn | arena | `ledScreens.ts` |
| Màn chào sân | arena | `entrance.ts` `entranceProps.ts` |

## Đổi cao độ sân khấu

Sửa `STAGE_Y` / `FIELD_Y` trong `world/layout.ts`. Các chỗ đã đọc từ đó: khán giả sân, biểu tượng cảm xúc,
thân runway, mép sân khấu, mặt đất nền, cầu thang + hàng rào hố, đội quay phim, sự kiện trên trời.
Các chỗ còn số cứng (cần rà khi đổi) được liệt kê ở đầu `world/layout.ts` mục "Chưa chuyển".

## Chế độ developer

`src/ui/devPanel.ts` (bảng + `window.__dev`) chỉ gọi các hành động `main.ts` cung cấp (`DevHost`). Ẩn/hiện khu và lớp dùng
các hàm debug tùy chọn `setVisible` / `debugLayers` / `setLayerVisible` trên handle mỗi khu, dựa trên `core/debugLayers.ts`:
index.ts của khu bọc mỗi lời gọi `createX(scene)` bằng `layers.track(tên, …)` để ghi nhận vật thể được thêm vào scene, rồi
gỡ/gắn lại chúng (khỏi cha của chúng, vì nhiều module tự ghi đè `visible`). `layers.split(từ, tới, pred)` tách lớp con (cực quang, sao, laser, khán giả chấm sáng…) theo `renderOrder`/uniform; `layers.watch(tên, fn)` bọc lời gọi tạo vật thể lười (sự kiện bí mật). `World.setZoneVisible(zone, on)` và `World.stats()` (số liệu renderer) ở `world/world.ts`. Xem README.
