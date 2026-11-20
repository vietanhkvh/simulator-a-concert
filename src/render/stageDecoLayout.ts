// Hằng số bố cục khung mái sân khấu, dùng chung cho stageDeco.ts và stageDecoFixtures.ts.
const TX = 19; // x của tháp
export const DECO = {
  TX,
  ZF: -5.2, // vòm trước
  ZB: 3.0, // vòm sau
  TH: 12.5, // chiều cao tháp
  ay: (x: number) => 12.5 + 3.2 * (1 - (x / TX) * (x / TX)),
};
