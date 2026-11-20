# Khu 3 — Sân trung tâm (gần nhất)

Sân khấu, các đường đi, nơi người chơi và khán giả sân đứng. Điểm vào duy nhất: `index.ts` → `createArenaZone(ctx, opts)`.

| File | Trách nhiệm |
|---|---|
| `index.ts` | Tạo khu, thứ tự cập nhật mỗi frame, camera góc ca sĩ, lộ các handle cho `main.ts` |
| `stageBase.ts` `ledWall.ts` | Sàn diễn, mép, loa monitor, mặt đất nền · tường LED sau lưng ca sĩ + cánh gà |
| `stageDeco.ts` `stageDecoFixtures.ts` `stageDecoLayout.ts` `stageDecoPal.ts` | Mái giàn, tháp, loa, nhạc cụ, hàng rào, sàn LED, cổng đèn · đèn PAR/pixel · bảng màu |
| `walkLayout.ts` `stageRunway.ts` | Nguồn duy nhất của các lối đi + bục (có test) · dựng hình runway |
| `stageControls.ts` | Người chơi: đi lại, xoay, chuột tự do, đổi góc máy; phát `cs-view`, `cs-mouselook` |
| `crowd.ts` `crowd.vert.glsl` `crowd.frag.glsl` | Khán giả sân (instancing), sóng biển, đèn flash, tự giảm chất lượng |
| `lights.ts` `stageFx.ts` `confetti.ts` `emotes.ts` `emotesAtlas.ts` | Đèn sân khấu · laser/pháo hoa/khói · pháo giấy · biểu tượng cảm xúc |
| `ledScreens.ts` | Hai màn hình LED lớn cuối sân (lời bài hát hoặc video) |
| `singer.ts` `band.ts` `cameraCrew.ts` | Hình ca sĩ · nhạc công · đội quay phim, cần cẩu, flycam và các góc máy |
| `entrance.ts` `entranceProps.ts` | Ba màn chào sân; phát `cs-entrance` |

Cao độ sân khấu / sàn khán giả lấy ở `src/world/layout.ts`. Không import từ khu khác.
