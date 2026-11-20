# Khu 2 — Khán đài sân vận động (ở giữa)

Chỗ ngồi vòng quanh sân. Điểm vào duy nhất: `index.ts` → `createStandsZone(ctx)`.

| File | Trách nhiệm |
|---|---|
| `index.ts` | Tạo khu và cập nhật mỗi frame |
| `builders.ts` | Khe builder theo phong cách: `structure`, `standCrowd` (docs/THEMES.md) |
| `themes/<id>/` | Builder riêng của phong cách (tự đăng ký; hiện chưa có) |
| `stadium.ts` | Kết cấu 3 tầng khán đài, ~26.000 khán giả chấm sáng (lightstick), đèn nhà dọc mép tầng, 4 cột đèn pha; phản ứng với tương tác: hò reo, sóng người, trái tim xếp đèn, đèn flash, pháo hoa |

Nghe sự kiện `cs-interact` và đọc `f.waveMode`. Bán kính / cao độ các tầng nằm ở `STANDS_TIERS` trong
`src/world/layout.ts`. Đèn nhà và đèn pha được thêm vào bộ đệm điểm sáng dùng chung
(`src/world/shared/glowPoints.ts`). Không import từ khu khác.
