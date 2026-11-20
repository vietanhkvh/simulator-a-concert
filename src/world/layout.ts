// LAYOUT — NGUỒN SỰ THẬT DUY NHẤT cho các kích thước dùng chung giữa ba khu.
// Đổi một con số ở đây thì mọi khu đọc nó sẽ đổi theo; khu không tự chép lại các số này.
//
// Hệ tọa độ: đơn vị mét. Ca sĩ đứng ở gốc (0, STAGE_Y, 0) và nhìn về -Z; khán giả ở phía -Z;
// +X là bên phải ca sĩ; +Y hướng lên. Từ gần ra xa: sân trung tâm → khán đài → ngoài sân.

// Chưa chuyển (còn số cứng trong file, cần rà khi đổi cao độ hoặc dời vật thể):
//   • Mặt sân khấu y = 0 được NGẦM ĐỊNH ở rất nhiều chỗ trong khu arena (stageDeco, band, singer, lights,
//     stageFx, entrance, walkLayout…). Muốn sân khấu cao hơn khán giả thì HẠ FIELD_Y, giữ STAGE_Y = 0.
//   • arena/lights.ts: vị trí các cụm đèn trên mái/bục, chấm đèn runway (y 0,12 = mặt sàn diễn).
//   • arena/stageFx.ts: dàn blinder (y 6,4, z -10), tia laser.   • arena/confetti.ts: vùng rơi (y 9–14, so với sân khấu).
//   • arena/cameraCrew.ts: độ cao drone 4–11 m (so với sân khấu), vị trí tháp quay (7, -40), cần cẩu (-9,6; -5,8).
//   • arena/entrance*.ts: điểm đáp (0, 0, -6,6), độ cao trực thăng.   • arena/stageBase.ts: hộp sàn diễn 26×8.
//   • arena/emotes.ts: vùng sinh biểu tượng (tới 62 m, tránh dải runway).
//   • stands/stadium.ts: cột đèn pha (gốc y 0, khuất sau khán đài), hàng đèn trên cùng (r 125,5; y 35,6).
//   (Đã chuyển theo FIELD_Y: sàn/chân váy runway, mép + panel trước sân khấu, cầu thang + rào hố, đội quay phim,
//    vệt màu đèn, khói thấp, chân màn hình LED, biểu tượng cảm xúc, đáy tầng 1 khán đài.)
//   • outside/balloons.ts: tọa độ 6 khinh khí cầu (BALLOONS).   • outside/sky.ts: đường bay máy bay chở khách.
//   • outside/secretUfo.ts (0, 18, -40), secretDragon.ts (-4, 20, -62), secretJet.ts (0, 48, -34): tâm từng sự kiện.
//   • main.ts: camera sự kiện bí mật (0, 62, -112).

// ───────────── Camera / không khí ─────────────
/** Chiều cao mắt ca sĩ so với mặt sàn đang đứng (m). */
export const EYE_HEIGHT = 1.65;
export const CAMERA_FOV = 70;
/** Tầm nhìn xa của camera: mọi vật xa hơn mức này bị cắt. */
export const CAMERA_FAR = 220;
export const FOG_COLOR = 0x0b0a1c;
export const FOG_DENSITY = 0.022;

// ───────────── KHU 3: SÂN TRUNG TÂM (arena) ─────────────
/** Cao độ mặt sân khấu chính, runway và các bục (m). Người chơi đi trên mặt này. */
export const STAGE_Y = 0;
/** Cao độ sàn khán giả đứng ở hàng đầu (m). Sân khấu cao hơn khán giả STAGE_Y - FIELD_Y. */
export const FIELD_Y = -3.5;
/** Độ cao sân khấu so với sàn khán giả hàng đầu (m). */
export const STAGE_HEIGHT = STAGE_Y - FIELD_Y;
/** Bán kính hàng khán giả đầu tiên tính từ ca sĩ (m). */
export const FIELD_R0 = 7.1;
/** Bán kính tối đa của khu khán giả đứng (m); ngoài mức này là vành đai trống trước khán đài. */
export const FIELD_R_MAX = 62;
/** Sàn khán giả dốc lên phía sau (m cao / m xa) để hàng sau vẫn thấy sân khấu. */
export const FIELD_SLOPE = 0.05;
/** Cao độ sàn khán giả tại bán kính r tính từ ca sĩ (mô hình dốc tỏa tròn, khán giả sân dùng). */
export const fieldY = (r: number): number => FIELD_Y + Math.max(0, r - FIELD_R0) * FIELD_SLOPE;

/** Mặt đất nền (tấm phẳng nghiêng vẽ dưới chân khán giả): thấp hơn sàn khán giả 0,1 m ở mép hố… */
export const GROUND_Y0 = FIELD_Y - 0.1;
/** …bắt đầu dốc từ z này… */
export const GROUND_Z0 = -6;
/** …và lên GROUND_RISE mét sau GROUND_RUN mét về phía -Z. */
export const GROUND_RISE = 5.6;
export const GROUND_RUN = 74;
/** Cao độ mặt đất nền tại z (đội quay phim, sự kiện trên trời dùng để đặt vật chạm đất). */
export const groundYAtZ = (z: number): number =>
  (z > GROUND_Z0 ? GROUND_Y0 : GROUND_Y0 + Math.min(GROUND_Z0 - z, 90) * (GROUND_RISE / GROUND_RUN));

/** Sân khấu chính: hình chữ nhật |x| ≤ STAGE_HALF_W, z từ STAGE_FRONT_Z (mép phía khán giả) tới STAGE_BACK_Z. */
export const STAGE_HALF_W = 13;
export const STAGE_FRONT_Z = -5;
export const STAGE_BACK_Z = 3;
/** Hố sân khấu: khe giữa mép sân khấu và hàng rào khán giả. */
export const PIT_FENCE_Z = -6.9;
/** Hàng rào khán giả: không ai đứng gần sân khấu hơn z này. */
export const CROWD_BARRIER_Z = -7.6;
/** Mái giàn phía trên sân khấu chiếm vùng này — vật bay và camera phải tránh. */
export const ROOF = { halfW: 20, zBack: 4, zFront: -6, yMin: 7, yMax: 14 } as const;
/** Tường LED sau lưng ca sĩ. */
export const LED_WALL = { z: 3.5, width: 26, height: 10, centreY: 5.2 } as const;
/** Hai màn hình LED lớn cuối sân (đối xứng ±x), tâm ở độ cao y. */
export const LED_SCREENS = { x: 30, y: 15, z: -75, width: 24 } as const;

// ───────────── KHU 2: KHÁN ĐÀI (stands) ─────────────
/** Tâm vòng cung khán đài (cũng là tâm sân vận động trên mặt bằng). */
export const STADIUM_CENTRE = { x: 0, z: -10 } as const;
/** Khán đài ôm quanh sân trong khoảng góc này (rad, 0 = hướng -Z từ tâm). */
export const STANDS_ARC = { from: -0.72 * Math.PI, to: 0.72 * Math.PI } as const;
/**
 * Các tầng khán đài, từ trong ra ngoài. rf/yf0: bán kính và đáy của mặt trước tầng;
 * r0→r1, y0→y1: mặt dốc nơi khán giả ngồi.
 */
export const STANDS_TIERS = [
  { rf: 84, yf0: FIELD_Y - 0.5, r0: 84, r1: 96, y0: 6, y1: 12 },
  { rf: 97, yf0: 12, r0: 97, r1: 108, y0: 15, y1: 21 },
  { rf: 109, yf0: 21, r0: 109, r1: 120, y0: 24, y1: 30 },
] as const;
export const STANDS_R_INNER = STANDS_TIERS[0].rf;
export const STANDS_R_OUTER = STANDS_TIERS[STANDS_TIERS.length - 1].r1;
/** Đỉnh khán đài (mép trên tầng cao nhất + lan can/đèn), dùng để đặt vật "phía sau/phía trên khán đài". */
export const STANDS_TOP_Y = 36;

// ───────────── KHU 1: NGOÀI SÂN (outside) ─────────────
/** Bán kính vòm trời (sao, cực quang bám theo camera). Phải nhỏ hơn CAMERA_FAR. */
export const SKY_RADIUS = 185;
/**
 * Khinh khí cầu cổ vũ đứng sau khán đài xa nhất (r ≈ 138–158 m quanh STADIUM_CENTRE); tâm vỏ ở độ cao này (m),
 * đủ để cả vỏ lẫn băng rôn treo dưới (~35 m) ló trên mép khán đài từ mắt ca sĩ.
 */
export const BALLOON_Y = { min: 70, max: 84 } as const;
/** Máy bay kéo băng rôn bay ngang sân ở độ cao/độ sâu này (thấp hơn cụm khinh khí cầu, lọt khung nhìn mặc định của ca sĩ). */
export const FLYBY = { y: 38, z: -66 } as const;
/** Tâm bầu trời phía trên sân nơi các sự kiện bí mật diễn ra (pháo hoa tên lửa, trái tim khói…). */
export const SKY_SHOW_CENTRE = { x: 0, y: 50, z: -30 } as const;
